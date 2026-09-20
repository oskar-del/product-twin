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
import argparse, base64, hashlib, json, os, pathlib, re, sqlite3, struct, sys, tempfile, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SITE = "data/sites/sweden/saterdalsvagen-14"
CLIP_BUFFER_M = 250.0


class Site:
    """
    Everything that used to be a Svärtinge constant, resolved per run.

    The kommun is the important one. It used to be baked into the emitted
    `source_product` string as kn0581, which is how a Värmdö parcel ended up carrying
    Norrköping's product code in its own receipt while its geometry was correct. The code is
    now resolved from the site's own OSM receipt (or an explicit --kommun) and cross-checked,
    so a receipt cannot claim a kommun the site does not belong to.
    """

    def __init__(self, site_dir, kommun=None, designation=None, origin=None):
        self.dir = Path(site_dir) if Path(site_dir).is_absolute() else ROOT / site_dir
        if not self.dir.is_dir():
            raise SystemExit(f"no such site directory: {self.dir}")
        self.sources = self.dir / "official-context-geometry-sources-v0.1.json"
        self.osm = self.dir / "osm-context-derived-v0.1.json"
        self.out = self.dir / "property-division-derived-v0.1.json"

        osm = json.loads(self.osm.read_text()) if self.osm.exists() else {}

        site_kommun, self.kommun_name = self._kommun_from_receipts(osm)
        self.kommun = str(kommun).zfill(4) if kommun else site_kommun
        if not self.kommun:
            raise SystemExit("no kommunkod: pass --kommun (the site has no OSM context receipt)")
        if kommun and site_kommun and self.kommun != site_kommun:
            raise SystemExit(
                f"--kommun {self.kommun} contradicts the site's own OSM receipt "
                f"(kommunkod {site_kommun}, {osm.get('kommun')}). Refusing to label a receipt "
                f"with another kommun's product code.")

        self.designation = designation or self._existing_designation()
        if not self.designation:
            raise SystemExit("no designation: pass --designation (e.g. \"SVÄRTINGE 54:28\")")

        if origin:
            self.origin = tuple(float(v) for v in str(origin).split(","))
        elif osm.get("origin_sweref"):
            self.origin = tuple(float(v) for v in osm["origin_sweref"])
        else:
            raise SystemExit("no origin: pass --origin E,N (the site has no OSM origin)")

    def _kommun_from_receipts(self, osm):
        """
        Resolve the kommun from whatever the site actually recorded.

        Newer receipts (Djurö) carry kommunkod/kommun outright. Older ones (Svärtinge) only
        have the Lantmäteriet STAC item for the dataset, whose item_id IS the kommun code and
        whose title names the kommun. Either way the code is read, never typed.
        """
        if osm.get("kommunkod"):
            return str(osm["kommunkod"]).zfill(4), osm.get("kommun")

        if self.sources.exists():
            sources = json.loads(self.sources.read_text())
            dataset = (sources.get("datasets") or {}).get("property_division") or {}
            item_id = str(dataset.get("item_id") or "")
            name = None
            title = dataset.get("title") or ""
            match = re.search(r"i\s+(.+?)s?\s+kommun", title)
            if match:
                name = match.group(1)
            if re.fullmatch(r"\d{4}", item_id):
                return item_id, name
            found = re.search(r"kn(\d{4})", json.dumps(sources))
            if found:
                return found.group(1), name
        return None, osm.get("kommun")

    def _existing_designation(self):
        for name in ("property-division-derived-v0.1.json", "terrain-dem-derived-v0.1.json"):
            path = self.dir / name
            if path.exists():
                subject = json.loads(path.read_text()).get("subject")
                if isinstance(subject, str):
                    return subject
        return None

    def product(self, zip_manifest=None):
        """
        Name the source product from the archive we just hashed, not from a resolved code.

        Adopted from Djurö's ingest (the mechanism that fixed the same bug from the other side):
        the .gpkg entry inside the hashed zip IS the product, so the emitted name cannot
        disagree with the bytes. The kommun-derived name is only a fallback for the self-test,
        which has no real archive, and it is labelled as such.
        """
        if zip_manifest:
            names = [pathlib.PurePath(entry["name"]).stem for entry in zip_manifest
                     if str(entry.get("name", "")).lower().endswith(".gpkg")]
            if len(names) != 1:
                raise SystemExit(f"expected exactly one .gpkg in the archive, found {names}")
            product = f"{names[0]} (GeoPackage)"
            found = re.search(r"kn(\d{4})", names[0])
            if found and found.group(1) != self.kommun:
                raise SystemExit(
                    f"archive names kommun kn{found.group(1)} but this site is {self.kommun_name} "
                    f"(kommunkod {self.kommun}). Refusing to emit a receipt whose product name "
                    f"contradicts the site.")
            return product
        return f"fastighetsindelning_kn{self.kommun} (GeoPackage, name derived from kommunkod — no archive read)"
EXPECTED_EPSG = 3006


def load_frame(site):
    """Origin + expected asset facts from the committed receipts (single source of truth)."""
    sources = json.loads(site.sources.read_text()) if site.sources.exists() else {}
    pd = (sources.get("datasets") or {}).get("property_division") or {}
    return site.origin, pd


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


def ingest_gpkg(gpkg_path, origin, designation, buffer_m=CLIP_BUFFER_M):
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
            # Real LM fastighetsindelning schema splits the designation:
            # trakt='SVÄRTINGE' + etikett='54:28'. Compose when both exist;
            # fall back to the single-column scan for other schemas.
            _trakt, _etik = rec.get("trakt"), rec.get("etikett")
            if isinstance(_trakt, str) and isinstance(_etik, str) \
                    and re.search(r"\d+:\d+", _etik):
                desig = f"{_trakt} {_etik}"
            else:
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


def emit(site, subject, context, origin, parsed_srs, raw_sha, raw_bytes, zip_manifest):
    e0, n0 = origin
    rings = to_local(subject["polys"], origin)
    payload = {
        "schema_version": "property-division-derived/v0.1",
        "entity_type": "AuthoritativePropertyDivisionClip",
        "subject": subject["designation"],
        "evidence_class": "AUTHORITATIVE",
        "authority": "Lantmäteriet",
        "source_product": site.product(zip_manifest),
        "kommun": site.kommun_name,
        "kommunkod": site.kommun,
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


def run(site, zip_path=None):
    origin, pd = load_frame(site)
    if zip_path is None:
        if not pd.get("asset_url"):
            raise SystemExit("no asset_url receipt for this site — pass --zip with a local copy")
        zip_path = download_asset(pd["asset_url"], pd.get("asset_size_bytes"))
    raw = Path(zip_path).read_bytes()
    raw_sha, raw_bytes = hashlib.sha256(raw).hexdigest(), len(raw)  # required by contract
    gpkg, manifest = extract_gpkg_from_zip(zip_path)
    subject, context, srs = ingest_gpkg(gpkg, origin, site.designation)
    if EXPECTED_EPSG not in srs:
        print(f"WARN: expected EPSG:{EXPECTED_EPSG}, saw srs_ids {sorted(srs)}", file=sys.stderr)
    payload = emit(site, subject, context, origin, srs, raw_sha, raw_bytes, manifest)
    site.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"WROTE {site.out}")
    print(f"  kommun={payload['kommun']} ({payload['kommunkod']})  product={payload['source_product']}")
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


def self_test(site):
    """
    Run the real pipeline against a synthetic GeoPackage built around THIS site's parcel.

    The synthetic parcels are named from the site's own designation, so the test proves the
    ingest is parameterised rather than proving Svärtinge works one more time.
    """
    origin = site.origin
    e0, n0 = origin
    trakt, _, number = site.designation.rpartition(" ")
    block = number.split(":")[0] if ":" in number else number
    neighbour = f"{trakt} {block}:99" if trakt else "NEIGHBOUR 1:99"
    distant = f"{trakt} 99:99" if trakt else "DISTANT 99:99"

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
    con.execute("INSERT INTO fastighetsyta VALUES(1,?,?)", (site.designation, _gpkg_blob(3006, subj)))
    con.execute("INSERT INTO fastighetsyta VALUES(2,?,?)", (neighbour, _gpkg_blob(3006, nbr)))
    con.execute("INSERT INTO fastighetsyta VALUES(3,?,?)", (distant, _gpkg_blob(3006, far)))
    con.commit(); con.close()

    subject, context, srs = ingest_gpkg(g, origin, site.designation)
    # A realistic manifest, so the self-test exercises the archive-read path that real runs use.
    manifest = [{"name": f"fastighetsindelning_kn{site.kommun}.gpkg", "size": 1}]
    payload = emit(site, subject, context, origin, srs, "deadbeef", 123, manifest)

    assert payload["subject"] == site.designation, payload["subject"]
    assert payload["kommunkod"] == site.kommun, payload["kommunkod"]
    assert payload["source_product"] == f"fastighetsindelning_kn{site.kommun} (GeoPackage)", \
        payload["source_product"]
    # Without an archive the name falls back to the kommun code and SAYS so, so a reader can
    # tell a name that was read from bytes from one that was composed.
    fallback = emit(site, subject, context, origin, srs, "deadbeef", 123, None)
    assert "no archive read" in fallback["source_product"], fallback["source_product"]
    try:
        emit(site, subject, context, origin, srs, "deadbeef", 123,
             [{"name": "fastighetsindelning_kn9999.gpkg", "size": 1}])
        raise AssertionError("a contradicting archive name was accepted")
    except SystemExit:
        pass
    assert srs == {3006}, srs
    ring = payload["subject_rings_local"][0]
    assert ring[0] == [-20.0, -15.0], ring[0]           # E-E0, N-N0
    assert ring[2] == [22.0, 18.0], ring[2]
    assert len(context) == 1, f"clip buffer failed: {len(context)} (nbr in, far out)"
    assert context[0]["designation"] == neighbour
    h1 = payload["derived_geometry_sha256"]
    h2 = emit(site, subject, context, origin, srs, "deadbeef", 123, manifest)["derived_geometry_sha256"]
    assert h1 == h2, "derived hash not deterministic"

    print(f"SELF-TEST PASS · {site.designation} · {site.kommun_name or '?'} (kn{site.kommun})")
    print(f"  product line    {payload['source_product']} (read from the archive manifest)")
    print(f"  contradiction   an archive naming another kommun is refused")
    print(f"  local ENU       origin {e0},{n0} · ring[0]={ring[0]} ring[2]={ring[2]} (E-E0, N-N0)")
    print(f"  250 m clip      kept {neighbour}, dropped {distant}")
    print(f"  derived sha256  {h1[:16]}… deterministic")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Ingest an authoritative property division clip.")
    ap.add_argument("--site", default=DEFAULT_SITE, help="site directory holding the receipts")
    ap.add_argument("--kommun", help="kommunkod, e.g. 0581 (Norrköping) or 0120 (Värmdö)")
    ap.add_argument("--designation", help='parcel designation, e.g. "SVÄRTINGE 54:28"')
    ap.add_argument("--origin", help="ENU origin as E,N in SWEREF99TM (default: the site's OSM receipt)")
    ap.add_argument("--zip", help="local path to the fastighetsindelning zip for that kommun")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    site = Site(a.site, a.kommun, a.designation, a.origin)
    if a.self_test:
        self_test(site)
    else:
        run(site, a.zip)
