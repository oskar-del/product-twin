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
import argparse, hashlib, importlib.util, json, os, sqlite3, struct, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "data/sites/sweden/saterdalsvagen-14"
OSM = SITE / "osm-context-derived-v0.1.json"
OUT = SITE / "buildings-official-derived-v0.1.json"
DEFAULT_ZIP = ROOT.parent / "lm-data" / "byggnad_kn0581.zip"
DEFAULT_RADIUS_M = 200.0
EXPECTED_EPSG = 3006

# Reuse the proven helpers (no duplication); the sibling's __main__ guard keeps it inert on import.
_spec = importlib.util.spec_from_file_location("ipd", str(Path(__file__).with_name("ingest-property-division.py")))
ipd = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(ipd)


def origin():
    e0, n0 = json.loads(OSM.read_text())["origin_sweref"]
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
            })
    con.close()
    return out, srs


def emit(buildings, o, srs, raw_sha, raw_bytes, manifest, radius):
    e0, n0 = o
    payload = {
        "schema_version": "svartinge-buildings-official-derived/v0.1",
        "entity_type": "OfficialBuildingFootprintClip",
        "authority": "Lantmäteriet",
        "source_product": "byggnad_kn0581 (GeoPackage)",
        "footprint_evidence_class": "AUTHORITATIVE",
        "height_evidence_class": "DERIVED",   # LM byggnad has no height; never invented
        "source_crs": f"EPSG:{sorted(srs)[0]}" if srs else None,
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = municipal pin (E0,N0 SWEREF99TM)",
        "origin_sweref": [e0, n0],
        "clip_radius_m": radius,
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
    payload["derived_geometry_sha256"] = hashlib.sha256(
        json.dumps([b["footprint_rings_local"] for b in buildings], sort_keys=True).encode()).hexdigest()
    return payload


def run(zip_path, radius):
    zip_path = Path(zip_path or DEFAULT_ZIP)
    if not zip_path.exists():
        raise SystemExit(f"asset not found: {zip_path}")
    raw = zip_path.read_bytes()
    raw_sha, raw_bytes = hashlib.sha256(raw).hexdigest(), len(raw)
    gpkg, manifest = extract_gpkg(zip_path)
    o = origin()
    buildings, srs = ingest(gpkg, o, radius)
    if EXPECTED_EPSG not in srs and srs:
        print(f"WARN: expected EPSG:{EXPECTED_EPSG}, saw {sorted(srs)}")
    payload = emit(buildings, o, srs, raw_sha, raw_bytes, manifest, radius)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"WROTE {OUT.relative_to(ROOT)}")
    print(f"  {payload['building_count']} footprints within {radius:.0f} m "
          f"({payload['dwelling_count']} Bostad)  crs={payload['source_crs']}")
    print(f"  types: {payload['type_breakdown']}")
    print(f"  raw sha256={raw_sha[:16]}…  bytes={raw_bytes}")
    print(f"  derived sha256={payload['derived_geometry_sha256'][:16]}…")


# ---- self-test ----
def _gpkg_blob(srs, rings):
    b = struct.pack("<BI", 1, 6) + struct.pack("<I", len(rings))  # MultiPolygon
    for ring in rings:
        b += struct.pack("<BI", 1, 3) + struct.pack("<I", 1) + struct.pack("<I", len(ring))
        for x, y in ring:
            b += struct.pack("<dd", x, y)
    return b"GP" + bytes([0, 0]) + struct.pack("<i", srs) + b


def self_test():
    o = origin(); e0, n0 = o
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
    p = emit(buildings, o, srs, "dead", 1, [], DEFAULT_RADIUS_M)
    assert p["footprint_evidence_class"] == "AUTHORITATIVE" and p["height_evidence_class"] == "DERIVED"
    print("SELF-TEST PASS")
    print("  MultiPolygon parse ✓  200 m clip kept near, dropped far ✓  ENU transform ✓")
    print("  footprint=AUTHORITATIVE, height=DERIVED (never invented) ✓")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip"); ap.add_argument("--radius", type=float, default=DEFAULT_RADIUS_M)
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        self_test()
    else:
        run(a.zip, a.radius)
