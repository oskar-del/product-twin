#!/usr/bin/env python3
"""Ingest the official Lantmäteriet byggnad (building) footprints for the Svärtinge
study area and emit a local-frame clip the twin renders as AUTHORITATIVE footprints.

Upgrades the OSM-derived context (PCA bounding boxes) to the real registered
building geometry. LM byggnad vector carries NO height, so footprints are
AUTHORITATIVE and height stays DERIVED (never invented — per import_contract
building_heights_may_be_invented:false).

Reuses the proven GeoPackage/WKB/transform helpers from ingest-property-division.py
(same ingest pattern; nationwide via the same STAC grant, one kommunkod per run).

Usage:
  python3 scripts/ingest-buildings.py                       # ../lm-data/byggnad_kn0581.zip
  python3 scripts/ingest-buildings.py --zip PATH --radius 200
  python3 scripts/ingest-buildings.py --self-test
"""
import argparse, hashlib, importlib.util, json, math, os, pathlib, re, sqlite3, struct, sys, tempfile, zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geometry_hash import METHOD_ID, geometry_sha256   # one canonical form, shared with Djurö's pipeline
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SITE = "data/sites/sweden/saterdalsvagen-14"

# The Site resolver lives in the property-division ingest; both scripts must agree about which
# kommun a site belongs to, and there must be exactly one place that decides it.
_pd_spec = importlib.util.spec_from_file_location(
    "ingest_property_division", Path(__file__).resolve().parent / "ingest-property-division.py")
_pd = importlib.util.module_from_spec(_pd_spec)
_pd_spec.loader.exec_module(_pd)
Site = _pd.Site
DEFAULT_RADIUS_M = 200.0
EXPECTED_EPSG = 3006

# Reuse the proven helpers (no duplication); the sibling's __main__ guard keeps it inert on import.
_spec = importlib.util.spec_from_file_location("ipd", str(Path(__file__).with_name("ingest-property-division.py")))
ipd = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(ipd)


def origin(site):
    e0, n0 = site.origin
    return float(e0), float(n0)


def extract_gpkg(zip_path):
    zf = zipfile.ZipFile(zip_path)
    manifest = [{"name": i.filename, "size": i.file_size} for i in zf.infolist()]
    name = next(i.filename for i in zf.infolist() if i.filename.lower().endswith(".gpkg"))
    tmp = Path(tempfile.mkdtemp()) / "b.gpkg"
    tmp.write_bytes(zf.read(name))
    return tmp, manifest


def _first(rec, *cols):
    for c in cols:
        v = rec.get(c)
        if v not in (None, "None", ""):
            return v
    return None


def ingest(gpkg_path, o, radius):
    e0, n0 = o
    con = sqlite3.connect(f"file:{gpkg_path}?mode=ro", uri=True)
    con.execute("PRAGMA integrity_check")
    out, srs = [], set()
    for table in ipd._feature_tables(con):
        gc = ipd._geom_col_and_srs(con, table)
        if not gc:
            continue
        geom_col, srs_id = gc
        colnames = [d[0] for d in con.execute(f'SELECT * FROM "{table}" LIMIT 0').description]
        for row in con.execute(f'SELECT rowid,* FROM "{table}"'):
            rec = dict(zip(["rowid"] + colnames, row))
            blob = rec.get(geom_col)
            if not blob:
                continue
            try:
                polys = ipd._read_wkb_polygons(ipd._gpkg_to_wkb(blob))
            except Exception:
                continue
            cx, cy = ipd._centroid(polys)
            if ((cx - e0) ** 2 + (cy - n0) ** 2) ** 0.5 > radius:
                continue
            srs.add(srs_id)
            rings = [[[round(x - e0, 3), round(y - n0, 3)] for (x, y) in ring]
                     for poly in polys for ring in poly]
            out.append({
                "object_id": _first(rec, "objektidentitet") or f"{table}:{rec['rowid']}",
                "type": _first(rec, "objekttyp"),
                "purpose": _first(rec, "andamal1", "andamal2"),
                "is_main": (_first(rec, "huvudbyggnad") == "Ja"),
                "pos_uncertainty_m": _first(rec, "lagesosakerhetplan"),
                "footprint_rings_local": rings,
                "rings_local": rings,                    # Djurö's field name for the same geometry
            })
    con.close()
    return out, srs


def product_name(site, manifest):
    """
    Name the product from the .gpkg inside the archive we hashed, same mechanism as the
    property-division ingest. The archive is the evidence; a composed name is only a fallback
    and labels itself as one.
    """
    if manifest:
        names = [Path(entry["name"]).stem for entry in manifest
                 if str(entry.get("name", "")).lower().endswith(".gpkg")]
        if len(names) != 1:
            raise SystemExit(f"expected exactly one .gpkg in the archive, found {names}")
        found = re.search(r"kn(\d{4})", names[0])
        if found and found.group(1) != site.kommun:
            raise SystemExit(
                f"archive names kommun kn{found.group(1)} but this site is {site.kommun_name} "
                f"(kommunkod {site.kommun}). Refusing to emit a receipt whose product name "
                f"contradicts the site.")
        return f"{names[0]} (GeoPackage)"
    return f"byggnad_kn{site.kommun} (GeoPackage, name derived from kommunkod — no archive read)"



def ring_area_m2(ring):
    total = 0.0
    for i in range(len(ring)):
        x1, z1 = ring[i][0], ring[i][1]
        x2, z2 = ring[(i + 1) % len(ring)][0], ring[(i + 1) % len(ring)][1]
        total += x1 * z2 - x2 * z1
    return abs(total) / 2


def ring_centroid(ring):
    xs = [p[0] for p in ring]
    zs = [p[1] for p in ring]
    return [round(sum(xs) / len(xs), 3), round(sum(zs) / len(zs), 3)]


def point_in_ring(point, ring):
    """Ray casting. Used only to classify a building as on-parcel or context."""
    x, z = point
    inside = False
    for i in range(len(ring)):
        x1, z1 = ring[i][0], ring[i][1]
        x2, z2 = ring[(i + 1) % len(ring)][0], ring[(i + 1) % len(ring)][1]
        if (z1 > z) != (z2 > z):
            crossing = x1 + (z - z1) * (x2 - x1) / ((z2 - z1) or 1e-12)
            if crossing > x:
                inside = not inside
    return inside


def parcel_ring(site):
    """The subject parcel from this site's own property-division receipt, if it has one."""
    path = site.dir / "property-division-derived-v0.1.json"
    if not path.exists():
        return None
    first = (json.loads(path.read_text()).get("subject_rings_local") or [None])[0]
    if not first:
        return None
    return first[0] if isinstance(first[0][0], list) else first


def enrich(buildings, site):
    """
    Add the per-building facts Djurö's receipt carries and mine did not.

    Two ingests for one concept was the same class of problem as two gate registries: the DATA
    agreed on Djurö's buildings while the receipts disagreed in shape, so their derived hashes
    could never match. This is the poorer receipt catching up to the richer one.
    """
    parcel = parcel_ring(site)
    for building in buildings:
        rings = building.get("footprint_rings_local") or []
        outer = rings[0] if rings else None
        building["footprint_area_m2"] = round(ring_area_m2(outer), 1) if outer and len(outer) >= 3 else None
        building["centroid_local"] = ring_centroid(outer) if outer else None
        if building["centroid_local"]:
            cx, cz = building["centroid_local"]
            building["distance_from_origin_m"] = round(math.hypot(cx, cz), 2)
            building["bearing_from_origin_deg"] = round((math.degrees(math.atan2(cx, cz)) + 360) % 360, 1)
        building["on_parcel"] = bool(parcel and building["centroid_local"]
                                     and point_in_ring(building["centroid_local"], parcel))
        # Djurö's field names for the same facts, so one consumer can read either receipt.
        building["source_object_id"] = building["object_id"]
        building["object_type"] = building["type"]
        building["is_main_building"] = building["is_main"]
        building["plan_uncertainty_m"] = building.get("pos_uncertainty_m")
    return buildings, parcel is not None

def emit(site, buildings, o, srs, raw_sha, raw_bytes, manifest, radius):
    e0, n0 = o
    buildings, parcel_known = enrich(buildings, site)
    on_parcel = [b for b in buildings if b["on_parcel"]]
    payload = {
        "schema_version": "buildings-official-derived/v0.1",
        "entity_type": "OfficialBuildingFootprintClip",
        "authority": "Lantmäteriet",
        "subject": site.designation,
        "source_product": product_name(site, manifest),
        "kommun": site.kommun_name,
        "kommunkod": site.kommun,
        "footprint_evidence_class": "AUTHORITATIVE",
        "height_evidence_class": "DERIVED",   # LM byggnad has no height; never invented
        "source_crs": f"EPSG:{sorted(srs)[0]}" if srs else None,
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = municipal pin (E0,N0 SWEREF99TM)",
        "origin_sweref": [e0, n0],
        "evidence_class": "AUTHORITATIVE",
        "source_table": "byggnad",
        "clip_radius_m": radius,
        "clip_buffer_m": radius,                 # Djurö's name for the same radius
        "counts": {
            "within_clip_radius": len(buildings),
            "on_parcel": len(on_parcel) if parcel_known else None,
            "context": (len(buildings) - len(on_parcel)) if parcel_known else None,
        },
        "on_parcel_footprint_area_m2": (round(sum(b["footprint_area_m2"] or 0 for b in on_parcel), 1)
                                        if parcel_known else None),
        "building_count": len(buildings),
        "main_building_count": sum(1 for b in buildings if b["is_main"]),   # source huvudbyggnad='Ja'
        "dwelling_count": sum(1 for b in buildings if b["type"] == "Bostad"),
        "type_breakdown": {t: sum(1 for b in buildings if b["type"] == t)
                           for t in sorted({b["type"] for b in buildings if b["type"]})},
        "source_object_ids": [b["object_id"] for b in buildings],
        "buildings": buildings,
        "raw_asset": {"sha256": raw_sha, "byte_count": raw_bytes},
        "zip_entry_manifest": manifest,
        "limitations": [
            "Footprints are the registered LM byggnad geometry (authoritative).",
            "Heights are NOT in this product; any extrusion is DERIVED, not authoritative.",
        ],
    }
    # Shared canonical form: sorted by object id, 1 mm precision, explicit separators. A hash
    # that only agrees with its own pipeline cannot tell two pipelines they derived the same
    # shapes, which is the only question it is asked.
    # `derivation_sha256`, not `derived_geometry_sha256`: it hashes a DERIVATION — the shapes we
    # derived from the register — and the old name read as if the register itself had a hash.
    payload["derivation_sha256"] = geometry_sha256(
        (b["object_id"], b["footprint_rings_local"]) for b in buildings)
    payload["derivation_sha256_method"] = METHOD_ID
    return payload


def run(site, zip_path, radius):
    zip_path = Path(zip_path or (ROOT.parent / "lm-data" / f"byggnad_kn{site.kommun}.zip"))
    if not zip_path.exists():
        raise SystemExit(f"no byggnad archive for kn{site.kommun} at {zip_path} — pass --zip")
    if not zip_path.exists():
        raise SystemExit(f"asset not found: {zip_path}")
    raw = zip_path.read_bytes()
    raw_sha, raw_bytes = hashlib.sha256(raw).hexdigest(), len(raw)
    gpkg, manifest = extract_gpkg(zip_path)
    o = origin(site)
    buildings, srs = ingest(gpkg, o, radius)
    if EXPECTED_EPSG not in srs and srs:
        print(f"WARN: expected EPSG:{EXPECTED_EPSG}, saw {sorted(srs)}")
    payload = emit(site, buildings, o, srs, raw_sha, raw_bytes, manifest, radius)
    out = site.dir / "buildings-official-derived-v0.1.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"WROTE {out}")
    print(f"  kommun={payload['kommun']} ({payload['kommunkod']})  product={payload['source_product']}")
    print(f"  {payload['building_count']} footprints within {radius:.0f} m "
          f"({payload['dwelling_count']} Bostad)  crs={payload['source_crs']}")
    print(f"  types: {payload['type_breakdown']}")
    print(f"  raw sha256={raw_sha[:16]}…  bytes={raw_bytes}")
    print(f"  derivation sha256={payload['derivation_sha256'][:16]}…  method={payload['derivation_sha256_method']}")


# ---- self-test ----
def _gpkg_blob(srs, rings):
    b = struct.pack("<BI", 1, 6) + struct.pack("<I", len(rings))  # MultiPolygon
    for ring in rings:
        b += struct.pack("<BI", 1, 3) + struct.pack("<I", 1) + struct.pack("<I", len(ring))
        for x, y in ring:
            b += struct.pack("<dd", x, y)
    return b"GP" + bytes([0, 0]) + struct.pack("<i", srs) + b


def self_test(site):
    o = origin(site); e0, n0 = o
    near = [[(e0 + 5, n0 + 5), (e0 + 15, n0 + 5), (e0 + 15, n0 + 15), (e0 + 5, n0 + 5)]]
    far = [[(e0 + 500, n0), (e0 + 510, n0), (e0 + 510, n0 + 10), (e0 + 500, n0)]]
    d = Path(tempfile.mkdtemp()); g = d / "b.gpkg"
    con = sqlite3.connect(g)
    con.executescript("""
      CREATE TABLE gpkg_contents(table_name TEXT,data_type TEXT,identifier TEXT,srs_id INT);
      CREATE TABLE gpkg_geometry_columns(table_name TEXT,column_name TEXT,geometry_type_name TEXT,srs_id INT);
      CREATE TABLE byggnad(fid INTEGER PRIMARY KEY, objektidentitet TEXT, objekttyp TEXT,
                           andamal1 TEXT, huvudbyggnad TEXT, lagesosakerhetplan TEXT, geometri BLOB);
    """)
    con.execute("INSERT INTO gpkg_contents VALUES('byggnad','features','b',3006)")
    con.execute("INSERT INTO gpkg_geometry_columns VALUES('byggnad','geometri','MULTIPOLYGON',3006)")
    con.execute("INSERT INTO byggnad VALUES(1,'uuid-near','Bostad','Småhus;','Ja','0.25',?)", (_gpkg_blob(3006, near),))
    con.execute("INSERT INTO byggnad VALUES(2,'uuid-far','Komplementbyggnad','Garage;','Nej','0.7',?)", (_gpkg_blob(3006, far),))
    con.commit(); con.close()
    buildings, srs = ingest(g, o, DEFAULT_RADIUS_M)
    assert srs == {3006}, srs
    assert len(buildings) == 1, f"clip failed: {len(buildings)}"
    b = buildings[0]
    assert b["object_id"] == "uuid-near" and b["is_main"] and b["type"] == "Bostad", b
    assert b["footprint_rings_local"][0][0] == [5.0, 5.0], b["footprint_rings_local"][0][0]
    manifest = [{"name": f"byggnad_kn{site.kommun}.gpkg", "size": 1}]
    p = emit(site, buildings, o, srs, "dead", 1, manifest, DEFAULT_RADIUS_M)
    assert p["footprint_evidence_class"] == "AUTHORITATIVE" and p["height_evidence_class"] == "DERIVED"
    assert p["kommunkod"] == site.kommun, p["kommunkod"]
    assert p["source_product"] == f"byggnad_kn{site.kommun} (GeoPackage)", p["source_product"]
    fallback = emit(site, buildings, o, srs, "dead", 1, None, DEFAULT_RADIUS_M)
    assert "no archive read" in fallback["source_product"], fallback["source_product"]
    try:
        emit(site, buildings, o, srs, "dead", 1, [{"name": "byggnad_kn9999.gpkg", "size": 1}],
             DEFAULT_RADIUS_M)
        raise AssertionError("a contradicting archive name was accepted")
    except SystemExit:
        pass
    print(f"SELF-TEST PASS · {site.designation} · {site.kommun_name or '?'} (kn{site.kommun})")
    print(f"  product line    {p['source_product']} (read from the archive manifest)")
    print(f"  local ENU       origin {e0},{n0} · footprint[0]={b['footprint_rings_local'][0][0]}")
    print("  200 m clip      kept the near building, dropped the 500 m one")
    print("  evidence        footprint=AUTHORITATIVE, height=DERIVED (never invented)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Ingest an official building footprint clip.")
    ap.add_argument("--site", default=DEFAULT_SITE, help="site directory holding the receipts")
    ap.add_argument("--kommun", help="kommunkod, e.g. 0581 (Norrköping) or 0120 (Värmdö)")
    ap.add_argument("--designation", help='parcel designation, e.g. "SVÄRTINGE 54:28"')
    ap.add_argument("--origin", help="ENU origin as E,N in SWEREF99TM (default: the site's receipts)")
    ap.add_argument("--zip"); ap.add_argument("--radius", type=float, default=DEFAULT_RADIUS_M)
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    site = Site(a.site, a.kommun, a.designation, a.origin)
    if a.self_test:
        self_test(site)
    else:
        run(site, a.zip, a.radius)
