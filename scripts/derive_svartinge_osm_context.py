#!/usr/bin/env python3
"""Derive a DERIVED neighbourhood-context layer for SVÄRTINGE 54:28 from OpenStreetMap.

Input (gitignored): .runtime/osm/svartinge-osm.json  (Overpass buildings + highways)
Output (committed, DERIVED, ODbL-attributed):
  data/sites/sweden/saterdalsvagen-14/osm-context-derived-v0.1.json

Building footprints are reduced to PCA-oriented bounding boxes (position, size,
rotation) so the existing BOX massing renderer can place them at real OSM
positions/orientations; roads become local-ENU polylines. This is crowd-sourced
context, NOT authoritative cadastral geometry — evidence_class stays DERIVED and
the byggnad/fastighetsindelning vectors supersede it when acquired.

Run: .runtime/venv/bin/python scripts/derive_svartinge_osm_context.py
"""
import json, math, os, datetime
import numpy as np
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSM = os.path.join(ROOT, ".runtime/osm/svartinge-osm.json")
OUT = os.path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/osm-context-derived-v0.1.json")
PIN = [16.0317063331, 58.6522414431]
BUILDING_HALF = 200.0   # keep buildings within ±200 m of the pin (360 m window + margin)
ROAD_HALF = 260.0

tr = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)
E0, N0 = tr.transform(PIN[0], PIN[1])


def to_local(lon, lat):
    e, n = tr.transform(lon, lat)
    return (e - E0, n - N0)  # x east, z north


def oriented_box(pts):
    """PCA-oriented bounding box of local (x,z) points -> (cx,cz,w,d,rot_deg)."""
    a = np.array(pts, float)
    c = a.mean(axis=0)
    cov = np.cov((a - c).T)
    _, vecs = np.linalg.eigh(cov)
    axis = vecs[:, -1]                       # principal axis
    ang = math.atan2(axis[1], axis[0])
    rot = np.array([[math.cos(-ang), -math.sin(-ang)], [math.sin(-ang), math.cos(-ang)]])
    r = (a - c) @ rot.T
    mn, mx = r.min(axis=0), r.max(axis=0)
    w, d = float(mx[0] - mn[0]), float(mx[1] - mn[1])
    mid = (mn + mx) / 2
    cx, cz = c + rot.T @ mid
    return float(cx), float(cz), w, d, math.degrees(ang)


def main():
    data = json.load(open(OSM))
    els = data.get("elements", [])
    buildings, roads = [], []
    bi = ri = 0
    for e in els:
        tags = e.get("tags", {})
        geom = e.get("geometry", [])
        if not geom:
            continue
        if tags.get("building"):
            pts = [to_local(g["lon"], g["lat"]) for g in geom]
            cx, cz, w, d, rot = oriented_box(pts)
            if abs(cx) > BUILDING_HALF or abs(cz) > BUILDING_HALF:
                continue
            if w < 3 or d < 3 or w > 120 or d > 120:   # drop slivers / megastructures (parsing noise)
                continue
            lv = tags.get("building:levels")
            try:
                levels = float(lv) if lv else None
            except ValueError:
                levels = None
            h = None
            try:
                h = float(tags.get("height")) if tags.get("height") else None
            except ValueError:
                h = None
            height = round(h if h else (levels * 3.0 if levels else 5.6), 1)
            bi += 1
            buildings.append({"id": f"OSM_B_{bi:03d}", "center_xz": [round(cx, 1), round(cz, 1)],
                              "size": [round(w, 1), height, round(d, 1)], "rotation_deg": round(rot, 1),
                              "levels": levels, "name": tags.get("name")})
        elif tags.get("highway") in ("residential", "tertiary", "service", "unclassified", "secondary", "living_street"):
            pts = [to_local(g["lon"], g["lat"]) for g in geom]
            pts = [[round(x, 1), round(z, 1)] for x, z in pts if abs(x) <= ROAD_HALF and abs(z) <= ROAD_HALF]
            if len(pts) < 2:
                continue
            ri += 1
            roads.append({"id": f"OSM_R_{ri:03d}", "name": tags.get("name"), "highway": tags["highway"],
                          "width_m": 7 if tags["highway"] in ("tertiary", "secondary") else 5,
                          "points_xz": pts})

    # nearest-first, keep a believable but bounded set
    buildings.sort(key=lambda b: math.hypot(*b["center_xz"]))
    buildings = buildings[:60]

    out = {
        "schema_version": "svartinge-osm-context-derived/v0.1",
        "entity_type": "OsmContextDerived",
        "subject": "SVÄRTINGE 54:28",
        "evidence_class": "DERIVED",
        "source": "OpenStreetMap (Overpass)",
        "licence": "ODbL 1.0",
        "attribution": "© OpenStreetMap contributors",
        "attribution_required": True,
        "derived_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = municipal pin (E0,N0 SWEREF99TM)",
        "origin_sweref": [round(E0, 3), round(N0, 3)],
        "method": "OSM building footprints reduced to PCA-oriented bounding boxes; highways to local polylines. Heights from building:levels×3 m or height tag, else 5.6 m.",
        "limitations": [
            "Crowd-sourced context, NOT authoritative cadastral geometry or surveyed heights.",
            "Footprints are simplified to oriented boxes; orientation/size are approximate.",
            "Superseded by the Lantmäteriet byggnad vector when acquired.",
        ],
        "counts": {"buildings": len(buildings), "roads": len(roads)},
        "buildings": buildings,
        "roads": roads,
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    open(OUT, "a").write("\n")
    print(f"buildings {len(buildings)} (nearest 60 within ±{BUILDING_HALF:.0f} m), roads {len(roads)}")
    print("named roads:", sorted({r["name"] for r in roads if r["name"]}))
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
