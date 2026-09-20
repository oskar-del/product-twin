#!/usr/bin/env python3
"""Derive the sea-view arc for a site by ray-marching the receipted 1 m ground model.

The page carried "43.3% sea view (321°–114°)". 321°→114° is simply a 153° span
written as a percentage of the compass; it is a STATED arc, not a viewshed. This
script replaces it with a computed one.

Method. From a viewpoint at eye height above the ground surface, cast rays at a
fixed angular step out to a horizon radius. Along each ray, keep the running
maximum elevation angle — the horizon so far. A sample is VISIBLE when its own
elevation angle exceeds that running maximum. A bearing counts as sea-view when
any visible sample along it is a water cell (the ground model's constant water
fill, found not assumed). Earth curvature and standard refraction are applied.

WHAT THIS IS AND IS NOT. The ground model is BARE EARTH: it contains no trees,
no buildings, no boathouses, no neighbouring roofs. Every one of those blocks a
real view and none of them is in this calculation. The arc below is therefore an
UPPER BOUND on what can be seen — the view the site would have on cleared ground.
It is a terrain result, not a survey of what a person sees from a window.

Usage: python3 scripts/derive-sea-view.py --site data/sites/sweden/djuro-byvag-34
"""
import argparse, hashlib, json, math
from pathlib import Path

import numpy as np, rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / ".runtime/lantmateriet/terrain"
NODATA = -9999.0
EARTH_R = 6371000.0
REFRACTION = 0.13          # standard atmospheric refraction coefficient
COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
           "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def compass(b):
    return COMPASS[int((b % 360) / 22.5 + 0.5) % 16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--receipt", default=".runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json")
    ap.add_argument("--eye-height", type=float, default=1.6)
    ap.add_argument("--radius", type=float, default=2500.0)
    ap.add_argument("--step-deg", type=float, default=0.5)
    a = ap.parse_args()

    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    receipt = json.loads((ROOT / a.receipt).read_text())
    osm = json.loads((site / "osm-context-derived-v0.1.json").read_text())
    e0, n0 = (float(v) for v in osm["origin_sweref"])
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    designation = pd["subject"]

    # viewpoint = centroid of the registered dwelling, if we have footprints
    vp, vp_label = (0.0, 0.0), "site pin"
    bpath = site / "buildings-official-derived-v0.1.json"
    if bpath.exists():
        for b in json.loads(bpath.read_text())["buildings"]:
            if b["placement"] == "ON_PARCEL" and b["object_type"] == "Bostad":
                vp = tuple(b["centroid_local"])
                vp_label = f'centroid of the registered dwelling ({b["footprint_area_m2"]} m²)'
                break

    R = a.radius
    srcs, used = [], []
    for name, facts in sorted(receipt["tiles"].items()):
        p = TILE_DIR / name
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for c in iter(lambda: f.read(1 << 20), b""):
                h.update(c)
        if h.hexdigest() != facts["sha256"]:
            raise SystemExit(f"tile {name} failed integrity")
        d = rasterio.open(p); b = d.bounds
        if (b.left < e0 + vp[0] + R and b.right > e0 + vp[0] - R and
                b.bottom < n0 + vp[1] + R and b.top > n0 + vp[1] - R):
            srcs.append(d); used.append(name)
        else:
            d.close()
    arr, tr = merge(srcs, bounds=(e0 + vp[0] - R, n0 + vp[1] - R,
                                  e0 + vp[0] + R, n0 + vp[1] + R), nodata=NODATA)
    res = abs(srcs[0].res[0])
    for s in srcs:
        s.close()
    z = arr[0].astype(np.float64)
    rows, cols = z.shape
    valid = z != NODATA
    print(f"tiles              : {used} (integrity re-verified)")
    print(f"mosaic             : {cols}x{rows} px @ {res:g} m, radius {R:.0f} m")

    low = z[valid & (z < z[valid].min() + 1.0)]
    vals, counts = np.unique(np.round(low, 3), return_counts=True)
    wv = float(vals[counts.argmax()])
    wshare = float(counts.max()) / float(valid.sum())
    if wshare < 0.05:
        raise SystemExit("no water constant found")
    water = valid & (np.abs(z - wv) < 1e-6)
    print(f"water constant     : {wv} m RH2000 over {wshare:.1%} of the mosaic")

    # viewpoint ground height (nearest cell) + eye height
    def rc(lx, lz):
        c = int((lx + e0 - tr.c) / tr.a)
        r = int((lz + n0 - tr.f) / tr.e)
        return r, c
    vr, vc = rc(*vp)
    vz = float(z[vr, vc]) + a.eye_height
    print(f"viewpoint          : {vp_label} at local {vp}, ground {z[vr, vc]:.2f} m, "
          f"eye {vz:.2f} m RH2000")

    nb = int(round(360.0 / a.step_deg))
    ts = np.arange(res, R, res)
    curv = (1.0 - REFRACTION) * ts ** 2 / (2 * EARTH_R)   # drop from curvature+refraction

    bearings, sea, first_water, horizon = [], [], [], []
    for i in range(nb):
        br = i * a.step_deg
        rad = math.radians(br)
        xs = vp[0] + math.sin(rad) * ts
        zs = vp[1] + math.cos(rad) * ts
        cc = ((xs + e0 - tr.c) / tr.a).astype(np.int64)
        rr = ((zs + n0 - tr.f) / tr.e).astype(np.int64)
        ok = (rr >= 0) & (rr < rows) & (cc >= 0) & (cc < cols)
        h = np.full(ts.shape, np.nan)
        w = np.zeros(ts.shape, bool)
        h[ok] = z[rr[ok], cc[ok]]
        w[ok] = water[rr[ok], cc[ok]]
        h[h == NODATA] = np.nan
        ang = np.degrees(np.arctan2(h - curv - vz, ts))
        ang = np.where(np.isnan(ang), -90.0, ang)
        run = np.maximum.accumulate(ang)
        vis = ang >= np.concatenate(([-90.0], run[:-1]))
        vw = vis & w
        bearings.append(round(br, 2))
        sea.append(bool(vw.any()))
        first_water.append(round(float(ts[vw.argmax()]), 1) if vw.any() else None)
        horizon.append(round(float(run[-1]), 3))

    sea = np.array(sea)
    pct = 100.0 * sea.mean()

    # contiguous arcs, wrapping at north
    arcs = []
    if sea.all():
        arcs.append({"from_deg": 0.0, "to_deg": 360.0, "span_deg": 360.0,
                     "from_compass": "N", "to_compass": "N"})
    elif sea.any():
        start = None
        idx = list(range(nb))
        first_false = int(np.argmin(sea))
        for k in range(nb):
            i = (first_false + k) % nb
            if sea[i] and start is None:
                start = i
            elif not sea[i] and start is not None:
                f, t = start * a.step_deg, i * a.step_deg
                arcs.append({"from_deg": round(f, 1), "to_deg": round(t, 1),
                             "span_deg": round((t - f) % 360, 1),
                             "from_compass": compass(f), "to_compass": compass(t)})
                start = None
        if start is not None:
            f, t = start * a.step_deg, first_false * a.step_deg
            arcs.append({"from_deg": round(f, 1), "to_deg": round(t, 1),
                         "span_deg": round((t - f) % 360, 1),
                         "from_compass": compass(f), "to_compass": compass(t)})
    arcs.sort(key=lambda x: -x["span_deg"])

    doc = {
        "schema_version": "sea-view-derived/v0.1",
        "entity_type": "SeaViewSightlineDerivation",
        "subject": designation,
        "evidence_class": "DERIVED",
        "derived_from_evidence_class": "AUTHORITATIVE",
        "authority_of_source": "Lantmäteriet",
        "source_product": receipt["source"],
        "vertical_datum": "RH2000",
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = site pin",
        "origin_sweref": [e0, n0],
        "tiles_used": used,
        "method": {
            "algorithm": "radial ray-march with running-maximum horizon angle",
            "bearing_step_deg": a.step_deg,
            "bearing_count": nb,
            "sample_step_m": res,
            "horizon_radius_m": R,
            "earth_curvature_applied": True,
            "refraction_coefficient": REFRACTION,
            "eye_height_m": a.eye_height,
        },
        "viewpoint": {"description": vp_label, "local": [round(vp[0], 2), round(vp[1], 2)],
                      "ground_height_rh2000_m": round(float(z[vr, vc]), 2),
                      "eye_height_rh2000_m": round(vz, 2)},
        "water_surface": {"height_rh2000_m": wv,
                          "share_of_mosaic_percent": round(100 * wshare, 1)},
        "result": {
            "sea_view_arc_percent": round(pct, 1),
            "sea_view_arc_deg": round(360.0 * pct / 100.0, 1),
            "arc_count": len(arcs),
            "arcs": arcs,
            "nearest_visible_water_m": (round(min(f for f in first_water if f is not None), 1)
                                        if any(f is not None for f in first_water) else None),
        },
        "per_bearing": {
            "bearing_deg": bearings,
            "sea_visible": [bool(v) for v in sea],
            "first_visible_water_m": first_water,
            "horizon_angle_deg": horizon,
        },
        "supersedes": {
            "previous_claim": "43.3% sea view, arc 321°–114°",
            "why_replaced": "321°–114° is a 153° compass span expressed as a percentage. It was "
                            "a stated arc, never a sightline computation, and it took no account "
                            "of terrain occlusion.",
        },
        "limitations": [
            "BARE EARTH. The ground model contains no trees, no buildings, no boathouses and no "
            "neighbouring roofs. All of those block a real view and none is in this calculation. "
            "This arc is an UPPER BOUND — the view on cleared ground, not the view from a window.",
            "The water surface is the ground model's constant fill, so the arc counts sea and any "
            "other body of water the model fills identically.",
            "A single viewpoint at one eye height. Moving the viewpoint or raising a floor level "
            "changes the result; this is not a room-by-room view analysis.",
            "Visibility is geometric. Haze, light and season are not modelled.",
        ],
    }
    blob = json.dumps(doc["result"], separators=(",", ":"), sort_keys=True)
    doc["derived_geometry_sha256"] = hashlib.sha256(blob.encode()).hexdigest()
    out = site / "sea-view-derived-v0.1.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

    print(f"sea-view arc       : {pct:.1f}%  ({360.0*pct/100.0:.1f}° of the compass) "
          f"in {len(arcs)} arc(s)")
    for arc in arcs[:6]:
        print(f"    {arc['from_deg']:>6.1f}° -> {arc['to_deg']:>6.1f}°  "
              f"({arc['span_deg']:>5.1f}°)  {arc['from_compass']}–{arc['to_compass']}")
    print(f"nearest water seen : {doc['result']['nearest_visible_water_m']} m")
    print(f"previous claim     : 43.3% (321°–114°) — a stated span, now superseded")
    print(f"derived sha256     : {doc['derived_geometry_sha256']}")
    print(f"written            : {out}")


if __name__ == "__main__":
    main()
