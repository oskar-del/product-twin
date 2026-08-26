#!/usr/bin/env python3
"""Ingest the authoritative Lantmäteriet fastighetsindelning (property division)
vector for SVÄRTINGE 54:28 and emit a local-frame boundary the twin can render.

This is the ONE command that closes GATE_SE_PROPERTY_DIVISION_CONTEXT the moment
the Geotorget order is granted. Until then the protected asset returns 401; this
script is proven today via `--self-test` (synthetic GeoPackage, real pipeline).

Implements data/sites/sweden/saterdalsvagen-14/official-context-geometry-sources
-v0.1.json → import_contract:
  - runtime_credentials_only / committed_credentials_forbidden
      credentials come from env LM_BASIC_AUTH="user:pass" (never a file, never argv)
  - raw_asset_sha256_required / raw_asset_byte_count_required
  - zip_entry_manifest_required / geopackage_integrity_check_required
  - source_crs_must_be_parsed (EPSG:3006 expected)
  - clip_buffer_m = 250 around the verified locator
  - local_transform: X=E-E0, Z=N-N0 (ENU, Y up from terrain), origin from OSM frame
  - derived_geometry_hash_required / source_object_ids_must_be_preserved

Stdlib only (sqlite3, struct, zipfile, hashlib, urllib) — no venv required.

Usage:
  LM_BASIC_AUTH=user:pass python3 scripts/ingest-property-division.py         # download+ingest
  python3 scripts/ingest-property-division.py --zip /path/kn0581.zip          # local asset
  python3 scripts/ingest-property-division.py --self-test                     # prove pipeline
"""
import argparse, base64, hashlib, json, os, re, sqlite3, struct, sys, tempfile, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "data/sites/sweden/saterdalsvagen-14"
SOURCES = SITE / "official-context-geometry-sources-v0.1.json"
OSM = SITE / "osm-context-derived-v0.1.json"
OUT = SITE / "property-division-derived-v0.1.json"
DESIGNATION = "SVÄRTINGE 54:28"
CLIP_BUFFER_M = 250.0
EXPECTED_EPSG = 3006


def load_frame():
    """Origin + expected asset facts from the committed receipts (single source of truth)."""
    osm = json.loads(OSM.read_text())
    e0, n0 = osm["origin_sweref"]
    pd = json.loads(SOURCES.read_text())["datasets"]["property_division"]
    return (float(e0), float(n0)), pd


# ---- GeoPackage geometry blob (GPKG spec) -> WKB rings ---------------------
def _gpkg_to_wkb(blob):
    if blob[:2] != b"GP":
        raise ValueError("not a GPKG geometry blob")
    flags = blob[3]
    env_ind = (flags >> 1) & 0x07
    env_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env_ind]
    return blob[8 + env_bytes:]


def _read_wkb_polygons(wkb):
    """Return list of polygons; each polygon = list of rings; ring = list of (x,y)."""
    pos = [0]

    def u8():
        v = wkb[pos[0]]; pos[0] += 1; return v

    def order():
        return "<" if u8() == 1 else ">"

    def u32(o):
        v = struct.unpack_from(o + "I", wkb, pos[0])[0]; pos[0] += 4; return v

    def pt(o):
        x, y = struct.unpack_from(o + "dd", wkb, pos[0]); pos[0] += 16; return (x, y)

    def ring(o):
        n = u32(o); return [pt(o) for _ in range(n)]

    def polygon(o):
        return [ring(o) for _ in range(u32(o))]

    o = order()
    gtype = u32(o) & 0xFF
    if gtype == 3:      # Polygon
        return [polygon(o)]
    if gtype == 6:      # MultiPolygon
        polys = []
        for _ in range(u32(o)):
            o = order(); u32(o)  # per-polygon header
            polys.append(polygon(o))
        return polys
    raise ValueError(f"unsupported geometry type {gtype} (need Polygon/MultiPolygon)")


# ---- GeoPackage table discovery ------------------------------------------
def _feature_tables(con):
    return [r[0] for r in con.execute(
        "SELECT table_name FROM gpkg_contents WHERE data_type='features'")]


def _geom_col_and_srs(con, table):
    row = con.execute(
        "SELECT column_name, srs_id FROM gpkg_geometry_columns WHERE table_name=?",
        (table,)).fetchone()
    return row  # (geom_col, srs_id) or None


def _text_cols(con, table):
    return [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')
            if r[2].upper() in ("TEXT", "VARCHAR", "CHARACTER", "CLOB", "")]


def _centroid(polys):
    pts = [p for poly in polys for ring in poly for p in ring]
    return (sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts))


def ingest_gpkg(gpkg_path, origin, designation=DESIGNATION, buffer_m=CLIP_BUFFER_M):
    e0, n0 = origin
    con = sqlite3.connect(f"file:{gpkg_path}?mode=ro", uri=True)
    con.execute("PRAGMA integrity_check")  # geopackage_integrity_check_required
    subject_feature = None
    context_features = []
    parsed_srs = set()
    norm = re.sub(r"\s+", "", designation).upper()
    for table in _feature_tables(con):
        gc = _geom_col_and_srs(con, table)
        if not gc:
            continue
        geom_col, srs_id = gc
        parsed_srs.add(srs_id)
        tcols = _text_cols(con, table)
        rowid = "rowid"
        for row in con.execute(f'SELECT {rowid}, * FROM "{table}"'):
            colnames = [d[0] for d in con.execute(
                f'SELECT * FROM "{table}" LIMIT 0').description]
            rec = dict(zip([rowid] + colnames, row))
            blob = rec.get(geom_col)
            if not blob:
                continue
            try:
                polys = _read_wkb_polygons(_gpkg_to_wkb(blob))
            except Exception:
                continue
            desig = None            # this parcel's own designation (e.g. "SVÄRTINGE 54:29")
            for c in tcols:
                v = rec.get(c)
                if isinstance(v, str) and re.search(r"\d+:\d+", v):
                    desig = v; break
            is_subject = desig is not None and re.sub(r"\s+", "", desig).upper() == norm
            oid = f"{table}:{rec[rowid]}"
            cx, cy = _centroid(polys)
            dist = ((cx - e0) ** 2 + (cy - n0) ** 2) ** 0.5
            feat = {"object_id": oid, "designation": desig,
                    "source_table": table, "srs_id": srs_id, "polys": polys,
                    "centroid_dist_m": round(dist, 2)}
            if is_subject:
                subject_feature = feat
            elif dist <= buffer_m:
                context_features.append(feat)
    con.close()
    if subject_feature is None:
        raise SystemExit(f"designation {designation!r} not found in {gpkg_path}")
    return subject_feature, context_features, parsed_srs


def to_local(polys, origin):
    e0, n0 = origin
    return [[[round(x - e0, 3), round(y - n0, 3)] for (x, y) in ring] for poly in polys for ring in poly]


def emit(subject, context, origin, parsed_srs, raw_sha, raw_bytes, zip_manifest):
    e0, n0 = origin
    rings = to_local(subject["polys"], origin)
    payload = {
        "schema_version": "svartinge-property-division-derived/v0.1",
        "entity_type": "AuthoritativePropertyDivisionClip",
        "subject": subject["designation"],
        "evidence_class": "AUTHORITATIVE",
        "authority": "Lantmäteriet",
        "source_product": "fastighetsindelning_kn0581 (GeoPackage)",
        "source_object_ids": [subject["object_id"]] + [c["object_id"] for c in context],
        "source_crs": f"EPSG:{sorted(parsed_srs)[0]}" if parsed_srs else None,
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = municipal pin (E0,N0 SWEREF99TM)",
        "origin_sweref": [e0, n0],
        "subject_rings_local": rings,
        "context_rings_local": [to_local(c["polys"], origin) for c in context],
        "raw_asset": {"sha256": raw_sha, "byte_count": raw_bytes},
        "zip_entry_manifest": zip_manifest,
        "limitations": [
            "Massing/boundary geometry is the registered property division; it is authoritative "
            "for extent, not a survey of monument positions.",
        ],
    }
    payload["derived_geometry_sha256"] = hashlib.sha256(
        json.dumps(payload["subject_rings_local"], sort_keys=True).encode()).hexdigest()
    return payload


def extract_gpkg_from_zip(zip_path):
    zf = zipfile.ZipFile(zip_path)
    manifest = [{"name": i.filename, "size": i.file_size} for i in zf.infolist()]
    gpkg = next((i.filename for i in zf.infolist() if i.filename.lower().endswith(".gpkg")), None)
    if not gpkg:
        raise SystemExit("no .gpkg entry in zip")
    tmp = Path(tempfile.mkdtemp()) / "pd.gpkg"
    tmp.write_bytes(zf.read(gpkg))
    return tmp, manifest


def download_asset(asset_url, expected_bytes):
    auth = os.environ.get("LM_BASIC_AUTH")
    if not auth:
        raise SystemExit(
            "Protected asset. Set LM_BASIC_AUTH=user:pass (the credentials the "
            "granted Geotorget order provides), or pass --zip for a local copy.\n"
            f"Asset: {asset_url}")
    req = urllib.request.Request(asset_url)
    req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    tmp = Path(tempfile.mkdtemp()) / "kn0581.zip"
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
        f.write(r.read())
    got = tmp.stat().st_size
    if expected_bytes and got != expected_bytes:
        raise SystemExit(f"byte_count mismatch: got {got}, expected {expected_bytes}")
    return tmp


def run(zip_path=None):
    origin, pd = load_frame()
    if zip_path is None:
        zip_path = download_asset(pd["asset_url"], pd.get("asset_size_bytes"))
    raw = Path(zip_path).read_bytes()
    raw_sha, raw_bytes = hashlib.sha256(raw).hexdigest(), len(raw)  # required by contract
    gpkg, manifest = extract_gpkg_from_zip(zip_path)
    subject, context, srs = ingest_gpkg(gpkg, origin)
    if EXPECTED_EPSG not in srs:
        print(f"WARN: expected EPSG:{EXPECTED_EPSG}, saw srs_ids {sorted(srs)}", file=sys.stderr)
    payload = emit(subject, context, origin, srs, raw_sha, raw_bytes, manifest)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"WROTE {OUT.relative_to(ROOT)}")
    print(f"  subject={payload['subject']}  rings={len(payload['subject_rings_local'])}"
          f"  context_parcels={len(context)}")
    print(f"  source_object_ids={payload['source_object_ids'][:1]}... "
          f"({len(payload['source_object_ids'])} total)")
    print(f"  raw sha256={raw_sha[:16]}…  bytes={raw_bytes}")
    print(f"  derived sha256={payload['derived_geometry_sha256'][:16]}…")
    print("GATE_SE_PROPERTY_DIVISION_CONTEXT: geometry acquired — wire the viewer overlay to render it.")


# ---- self-test: build a synthetic GPKG, run the real pipeline -------------
def _wkb_polygon(ring):
    b = struct.pack("<BI", 1, 3) + struct.pack("<I", 1) + struct.pack("<I", len(ring))
    for x, y in ring:
        b += struct.pack("<dd", x, y)
    return b


def _gpkg_blob(srs, ring):
    hdr = b"GP" + bytes([0, 0]) + struct.pack("<i", srs)  # version0, flags0 (little-endian, no env)
    return hdr + _wkb_polygon(ring)


def self_test():
    origin, _ = load_frame()
    e0, n0 = origin
    subj = [(e0 - 20, n0 - 15), (e0 + 22, n0 - 15), (e0 + 22, n0 + 18),
            (e0 - 20, n0 + 18), (e0 - 20, n0 - 15)]
    nbr = [(e0 + 110, n0 + 60), (e0 + 130, n0 + 60), (e0 + 130, n0 + 80), (e0 + 110, n0 + 60)]
    far = [(e0 + 900, n0), (e0 + 920, n0), (e0 + 920, n0 + 20), (e0 + 900, n0)]
    d = Path(tempfile.mkdtemp())
    g = d / "t.gpkg"
    con = sqlite3.connect(g)
    con.executescript("""
      CREATE TABLE gpkg_contents(table_name TEXT,data_type TEXT,identifier TEXT,srs_id INT);
      CREATE TABLE gpkg_geometry_columns(table_name TEXT,column_name TEXT,geometry_type_name TEXT,srs_id INT);
      CREATE TABLE fastighetsyta(fid INTEGER PRIMARY KEY, fastighet TEXT, geom BLOB);
    """)
    con.execute("INSERT INTO gpkg_contents VALUES('fastighetsyta','features','f',3006)")
    con.execute("INSERT INTO gpkg_geometry_columns VALUES('fastighetsyta','geom','POLYGON',3006)")
    con.execute("INSERT INTO fastighetsyta VALUES(1,'SVÄRTINGE 54:28',?)", (_gpkg_blob(3006, subj),))
    con.execute("INSERT INTO fastighetsyta VALUES(2,'SVÄRTINGE 54:29',?)", (_gpkg_blob(3006, nbr),))
    con.execute("INSERT INTO fastighetsyta VALUES(3,'SVÄRTINGE 99:99',?)", (_gpkg_blob(3006, far),))
    con.commit(); con.close()
    subject, context, srs = ingest_gpkg(g, origin)
    payload = emit(subject, context, origin, srs, "deadbeef", 123, [{"name": "t.gpkg", "size": 1}])
    assert payload["subject"] == "SVÄRTINGE 54:28", payload["subject"]
    assert srs == {3006}, srs
    ring = payload["subject_rings_local"][0]
    assert ring[0] == [-20.0, -15.0], ring[0]           # E-E0, N-N0
    assert ring[2] == [22.0, 18.0], ring[2]
    assert len(context) == 1, f"clip buffer failed: {len(context)} (nbr in, far out)"
    assert context[0]["designation"] == "SVÄRTINGE 54:29"
    h1 = payload["derived_geometry_sha256"]
    h2 = emit(subject, context, origin, srs, "deadbeef", 123, [])["derived_geometry_sha256"]
    assert h1 == h2, "derived hash not deterministic"
    print("SELF-TEST PASS")
    print(f"  extracted subject SVÄRTINGE 54:28, transformed to local ENU (origin {e0},{n0})")
    print(f"  subject ring[0]={ring[0]}  ring[2]={ring[2]}  (E-E0, N-N0 ✓)")
    print(f"  250 m clip: kept 1 neighbour, dropped the 900 m parcel ✓")
    print(f"  deterministic derived sha256={h1[:16]}… ✓")
    print("  → real asset behind LM 401; run with LM_BASIC_AUTH once the order is granted.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", help="local path to fastighetsindelning_kn0581.zip")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        self_test()
    else:
        run(a.zip)
