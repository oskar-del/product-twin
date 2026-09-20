#!/usr/bin/env python3
"""Ingest the authoritative Lantmäteriet byggnad (building footprint) vector for a
site and emit local-frame rings the twin can render.

Mirrors scripts/ingest-property-division.py: same receipts contract, same GPKG
WKB reader, same LOCAL_ENU transform (X=E-E0, Z=N-N0), stdlib only.

  - raw_asset_sha256_required / raw_asset_byte_count_required
  - zip_entry_manifest_required / geopackage_integrity_check_required
  - source_crs_must_be_parsed (EPSG:3006 expected)
  - clip_buffer_m default 200 around the site origin
  - source_object_ids_must_be_preserved (objektidentitet)
  - derived_geometry_hash_required

Buildings are additionally classified ON_PARCEL vs CONTEXT by testing each
footprint centroid against the authoritative subject boundary ring from
property-division-derived-v0.1.json (point-in-polygon, same local frame).

Usage:
  python3 scripts/ingest-buildings-official.py \
      --site data/sites/sweden/djuro-byvag-34 \
      --zip "../lm-data/byggnad_kn0120.zip" --buffer 200
"""
import argparse, hashlib, json, math, sqlite3, struct, sys, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_EPSG = 3006
DEFAULT_BUFFER_M = 200.0


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
    if gtype == 3:
        return [polygon(o)]
    if gtype == 6:
        polys = []
        for _ in range(u32(o)):
            o = order(); u32(o)
            polys.append(polygon(o))
        return polys
    raise ValueError(f"unsupported geometry type {gtype}")


# ---- geometry helpers ------------------------------------------------------
def ring_area(ring):
    """Shoelace area (m^2), absolute."""
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def ring_centroid(ring):
    """Area-weighted polygon centroid; falls back to vertex mean for degenerate rings."""
    cx = cy = a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        cr = x1 * y2 - x2 * y1
        a += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr
    if abs(a) < 1e-9:
        n = len(ring)
        return (sum(p[0] for p in ring) / n, sum(p[1] for p in ring) / n)
    a *= 0.5
    return (cx / (6 * a), cy / (6 * a))


def point_in_ring(pt, ring):
    """Ray-casting point-in-polygon."""
    x, y = pt
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y):
            xin = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xin:
                inside = not inside
    return inside


def bearing_deg(dx, dz):
    """Compass bearing from local ENU offsets (x=E, z=N)."""
    b = math.degrees(math.atan2(dx, dz))
    return b + 360.0 if b < 0 else b


# ---- ingest ----------------------------------------------------------------
def ingest(gpkg_path, origin, subject_ring, buffer_m):
    e0, n0 = origin
    con = sqlite3.connect(f"file:{gpkg_path}?mode=ro", uri=True)
    ok = con.execute("PRAGMA integrity_check").fetchone()[0]
    if ok != "ok":
        raise SystemExit(f"geopackage integrity_check failed: {ok}")

    row = con.execute(
        "SELECT table_name, column_name, srs_id FROM gpkg_geometry_columns "
        "WHERE table_name IN (SELECT table_name FROM gpkg_contents WHERE data_type='features')"
    ).fetchone()
    if not row:
        raise SystemExit("no feature table with geometry in GeoPackage")
    table, geom_col, srs_id = row
    if srs_id != EXPECTED_EPSG:
        raise SystemExit(f"unexpected CRS {srs_id}, expected EPSG:{EXPECTED_EPSG}")

    # Bounding-box prefilter in SWEREF99TM, then exact centroid-distance clip.
    minx, maxx = e0 - buffer_m, e0 + buffer_m
    miny, maxy = n0 - buffer_m, n0 + buffer_m
    cols = [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')]
    attr = [c for c in cols if c != geom_col]
    sql = (f'SELECT {geom_col}, ' + ", ".join(f'"{c}"' for c in attr) +
           f' FROM "{table}" WHERE fid IN '
           f'(SELECT id FROM rtree_{table}_{geom_col} '
           f'WHERE maxx>=? AND minx<=? AND maxy>=? AND miny<=?)')
    scanned = 0
    out = []
    for r in con.execute(sql, (minx, maxx, miny, maxy)):
        scanned += 1
        props = dict(zip(attr, r[1:]))
        polys = _read_wkb_polygons(_gpkg_to_wkb(r[0]))
        # local frame: x = E - E0, z = N - N0
        local = [[[(round(x - e0, 3), round(y - n0, 3)) for x, y in ring] for ring in poly]
                 for poly in polys]
        outer = local[0][0]
        cx, cz = ring_centroid(outer)
        if math.hypot(cx, cz) > buffer_m:
            continue
        area = round(sum(ring_area(p[0]) - sum(ring_area(h) for h in p[1:]) for p in local), 1)
        on_parcel = point_in_ring((cx, cz), subject_ring)
        purposes = [props.get(f"andamal{i}") for i in range(1, 6)]
        rings_flat = [[list(p) for p in ring] for poly in local for ring in poly]
        out.append({
            # --- template contract (saterdalsvagen-14 shape; do not rename) -----
            "object_id": props.get("objektidentitet"),
            "type": props.get("objekttyp"),
            "purpose": props.get("andamal1"),
            "is_main": props.get("huvudbyggnad") == "Ja",
            "pos_uncertainty_m": props.get("lagesosakerhetplan"),
            "footprint_rings_local": rings_flat,
            # --- additions this site needs (strandskydd, viewshed, placement) ---
            "source_object_id": props.get("objektidentitet"),
            "object_version": props.get("objektversion"),
            "valid_from": props.get("versiongiltigfran"),
            "object_type": props.get("objekttyp"),
            "purpose_all": [p for p in purposes if p],
            "is_main_building": props.get("huvudbyggnad") == "Ja",
            "house_number": props.get("husnummer"),
            "capture_reference": props.get("insamlingslage"),
            "source_organisation": props.get("ursprunglig_organisation"),
            "plan_uncertainty_m": props.get("lagesosakerhetplan"),
            "height_uncertainty_m": props.get("lagesosakerhethojd"),
            "placement": "ON_PARCEL" if on_parcel else "CONTEXT",
            "footprint_area_m2": area,
            "centroid_local": [round(cx, 3), round(cz, 3)],
            "distance_from_origin_m": round(math.hypot(cx, cz), 1),
            "bearing_from_origin_deg": round(bearing_deg(cx, cz), 1),
            "rings_local": [[[list(p) for p in ring] for ring in poly] for poly in local],
        })
    con.close()
    out.sort(key=lambda b: (b["placement"] != "ON_PARCEL", b["distance_from_origin_m"]))
    return out, scanned, table, srs_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--zip", required=True)
    ap.add_argument("--buffer", type=float, default=DEFAULT_BUFFER_M)
    a = ap.parse_args()

    site = Path(a.site)
    if not site.is_absolute():
        site = ROOT / site
    osm = json.loads((site / "osm-context-derived-v0.1.json").read_text())
    origin = tuple(float(v) for v in osm["origin_sweref"])
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    designation = pd["subject"]
    subject_ring = [tuple(p) for p in pd["subject_rings_local"][0]]
    sources = json.loads((site / "official-context-geometry-sources-v0.1.json").read_text())
    receipt = sources["datasets"]["buildings"]

    zpath = Path(a.zip)
    if not zpath.is_absolute():
        zpath = (ROOT / zpath).resolve()
    raw = zpath.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    with zipfile.ZipFile(zpath) as z:
        manifest = [{"name": i.filename, "size": i.file_size} for i in z.infolist()]
        gpkgs = [i.filename for i in z.infolist() if i.filename.lower().endswith(".gpkg")]
        if len(gpkgs) != 1:
            raise SystemExit(f"expected one .gpkg in zip, found {gpkgs}")
        with tempfile.TemporaryDirectory() as td:
            z.extract(gpkgs[0], td)
            buildings, scanned, table, srs = ingest(
                Path(td) / gpkgs[0], origin, subject_ring, a.buffer)

    on_parcel = [b for b in buildings if b["placement"] == "ON_PARCEL"]
    # The template's type vocabulary is carried in full so a consumer can index
    # any canonical key; a zero is a true statement about this clip, not a gap.
    types = {"Bostad": 0, "Komplementbyggnad": 0, "Samhällsfunktion": 0}
    for b in buildings:
        types[b["type"]] = types.get(b["type"], 0) + 1

    doc = {
        # --- template contract (saterdalsvagen-14 shape; do not rename) ---------
        "schema_version": "buildings-official-derived/v0.1",
        "entity_type": "OfficialBuildingFootprintClip",
        "subject": designation,
        "authority": "Lantmäteriet",
        "source_product": f"{zpath.stem} (GeoPackage)",
        "footprint_evidence_class": "AUTHORITATIVE",
        "height_evidence_class": "DERIVED",
        "source_crs": f"EPSG:{srs}",
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = municipal pin (E0,N0 SWEREF99TM)",
        "origin_sweref": list(origin),
        "clip_radius_m": a.buffer,
        "building_count": len(buildings),
        "main_building_count": sum(1 for b in buildings if b["is_main"]),
        "dwelling_count": sum(1 for b in buildings if b["type"] == "Bostad"),
        "type_breakdown": dict(sorted(types.items())),
        # --- additions this site needs -----------------------------------------
        "evidence_class": "AUTHORITATIVE",
        "source_table": table,
        "clip_buffer_m": a.buffer,
        "catalogue_receipt": receipt,
        "counts": {
            "candidates_in_bbox": scanned,
            "within_clip_radius": len(buildings),
            "on_parcel": len(on_parcel),
            "context": len(buildings) - len(on_parcel),
        },
        "on_parcel_footprint_area_m2": round(sum(b["footprint_area_m2"] for b in on_parcel), 1),
        "source_object_ids": [b["object_id"] for b in buildings],
        "buildings": buildings,
        "raw_asset": {"sha256": sha, "byte_count": len(raw)},
        "zip_entry_manifest": manifest,
        "limitations": [
            "Footprints are the registered LM byggnad geometry (authoritative).",
            "Heights are NOT in this product; any extrusion is DERIVED, not authoritative.",
            "Footprints are Lantmäteriet's registered building outlines captured at roof edge "
            "(insamlingslage), not a ground-level survey; plan uncertainty is per-feature.",
            "ON_PARCEL/CONTEXT is a centroid test against the registered property boundary; a "
            "footprint straddling the boundary is assigned by its centroid.",
            "The product carries no building heights; storeys and volume are NOT established here.",
        ],
    }
    geom_blob = json.dumps(
        [b["footprint_rings_local"] for b in buildings], separators=(",", ":"), sort_keys=True)
    doc["derived_geometry_sha256"] = hashlib.sha256(geom_blob.encode()).hexdigest()

    out = site / "buildings-official-derived-v0.1.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

    print(f"subject            : {designation}")
    print(f"raw sha256         : {sha}")
    print(f"raw bytes          : {len(raw)}")
    print(f"bbox candidates    : {scanned}")
    print(f"within {a.buffer:.0f} m       : {len(buildings)}")
    print(f"on parcel          : {len(on_parcel)}  "
          f"({doc['on_parcel_footprint_area_m2']} m2 total footprint)")
    for b in on_parcel:
        print(f"    - {b['type']:<20} {b['footprint_area_m2']:>7.1f} m2  "
              f"{'HUVUDBYGGNAD' if b['is_main'] else ''} "
              f"[{b['object_id']}]")
    print(f"derived geom sha256: {doc['derived_geometry_sha256']}")
    print(f"written            : {out}")


if __name__ == "__main__":
    main()
