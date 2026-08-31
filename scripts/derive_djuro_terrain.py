#!/usr/bin/env python3
"""Derive real-terrain + viewshed evidence for DJURÖ 4:147 (Djurö byväg 34) from the
receipted Lantmäteriet 1 m DEM.

Inputs (gitignored, licence-receipted under .runtime/):
  .runtime/lantmateriet/terrain/*.tif        Markhojdmodell Nedladdning, grid 1 m, EPSG:3006
  .runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json  SHA-256 receipt + licence

Output (committed derived product):
  data/sites/sweden/djuro-byvag-34/terrain-dem-derived-v0.1.json

Method:
  - Re-verify every tile against the receipt SHA-256 before use.
  - Sample elevation (RH2000) at the address pin and the main-house centroid.
  - Horn (1981) 3x3 slope/aspect at the pin.
  - Water mask: NO marktacke (land-cover) vector was obtainable (LM returned 403 for that
    collection under the current Geotorget grant). Water is instead classified directly
    from the same DEM by an elevation-flatness heuristic (cell RH2000 elevation < 0.3 m AND
    local relief in a 5x5 window < 0.15 m -> water). This is disclosed as DERIVED, not
    AUTHORITATIVE — it is a documented heuristic on real DEM values, not an official
    hydrography source.
  - Viewshed: cast a ray every 3 degrees around the compass from eye height (ground + 1.6 m)
    at the address pin. Walk the ray outward in 2 m steps to 600 m; at each step require the
    line-of-sight (straight line from eye to that step's ground elevation) to clear the DEM
    ground elevation at every closer step (classic radial line-of-sight visibility). The first
    step where line-of-sight holds AND the water mask says "water" is recorded as the sea-view
    hit for that azimuth. Directions with no qualifying hit within 600 m are NOT a sea view.
"""
import json, math, glob, hashlib, os, sys, datetime
import numpy as np, rasterio
from rasterio.merge import merge

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECEIPT = os.path.join(ROOT, ".runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json")
TILEDIR = os.path.join(ROOT, ".runtime/lantmateriet/terrain")
SITE = os.path.join(ROOT, "data/sites/sweden/djuro-byvag-34")
OUT = os.path.join(SITE, "terrain-dem-derived-v0.1.json")

PIN_E, PIN_N = 710934.881, 6582029.947  # address geocode point, SWEREF99 TM (see intake-v0.1.json)
EYE_HEIGHT_M = 1.6
WATER_ELEV_MAX = 0.3
WATER_LOCAL_RELIEF_MAX = 0.15
RAY_STEP_M = 2.0
RAY_MAX_M = 600.0
AZIMUTH_STEP_DEG = 3


def die(msg):
    print("FAIL:", msg); sys.exit(1)


def verify_tiles(receipt):
    found = {os.path.basename(p): p for p in glob.glob(os.path.join(TILEDIR, "*.tif"))}
    for name, meta in receipt["tiles"].items():
        p = found.get(name)
        if not p:
            die(f"tile {name} missing from {TILEDIR}")
        h = hashlib.sha256(open(p, "rb").read()).hexdigest()
        if h != meta["sha256"]:
            die(f"tile {name} SHA-256 mismatch (receipt {meta['sha256'][:12]} vs file {h[:12]})")
    print(f"tiles: {len(receipt['tiles'])} verified against receipt SHA-256")
    return [found[n] for n in receipt["tiles"]]


def main():
    receipt = json.load(open(RECEIPT))
    tiles = verify_tiles(receipt)
    srcs = [rasterio.open(t) for t in tiles]
    crs = str(srcs[0].crs)
    dem, tf = merge(srcs)
    dem = dem[0]
    H, W = dem.shape
    nodata = srcs[0].nodata
    print(f"mosaic {W}x{H}, crs={crs}, nodata={nodata}")

    def rc(E, N):
        col = int(round((E - tf.c) / tf.a))
        row = int(round((N - tf.f) / tf.e))
        return row, col

    def sample(E, N):
        row, col = rc(E, N)
        if 0 <= row < H and 0 <= col < W:
            v = float(dem[row, col])
            return None if (nodata is not None and v == nodata) else v
        return None

    z_pin = sample(PIN_E, PIN_N)
    if z_pin is None:
        die("pin outside DEM coverage")

    # Horn 3x3 slope/aspect at the pin
    r0, c0 = rc(PIN_E, PIN_N)
    w = dem[r0 - 1:r0 + 2, c0 - 1:c0 + 2].astype(float)
    dzdx = ((w[0, 2] + 2 * w[1, 2] + w[2, 2]) - (w[0, 0] + 2 * w[1, 0] + w[2, 0])) / (8 * abs(tf.a))
    dzdy = ((w[2, 0] + 2 * w[2, 1] + w[2, 2]) - (w[0, 0] + 2 * w[0, 1] + w[0, 2])) / (8 * abs(tf.e))
    slope = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
    aspect = (90 - math.degrees(math.atan2(dzdy, -dzdx))) % 360
    compass16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    compass = compass16[int(((aspect + 11.25) % 360) // 22.5)]

    # Water mask helper: elevation + local relief heuristic (DERIVED, not AUTHORITATIVE hydrography)
    def is_water(E, N):
        row, col = rc(E, N)
        if not (2 <= row < H - 2 and 2 <= col < W - 2):
            return False
        z = dem[row, col]
        if nodata is not None and z == nodata:
            return False
        if z >= WATER_ELEV_MAX:
            return False
        win = dem[row - 2:row + 3, col - 2:col + 3].astype(float)
        if nodata is not None:
            win = win[win != nodata]
        if win.size == 0:
            return False
        relief = float(win.max() - win.min())
        return relief < WATER_LOCAL_RELIEF_MAX

    # Viewshed: radial line-of-sight from eye height at the pin
    eye_z = z_pin + EYE_HEIGHT_M
    rays = []
    for az_deg in range(0, 360, AZIMUTH_STEP_DEG):
        az = math.radians(az_deg)
        dx, dz = math.sin(az), math.cos(az)  # x=East, z=North (matches viewer convention)
        max_clear_slope = -1e9
        hit = None
        n_steps = int(RAY_MAX_M / RAY_STEP_M)
        for i in range(1, n_steps + 1):
            dist = i * RAY_STEP_M
            E = PIN_E + dx * dist
            N = PIN_N + dz * dist
            zg = sample(E, N)
            if zg is None:
                break
            elev_angle = (zg - eye_z) / dist  # tan(angle), small-angle proxy is fine for ranking
            visible = elev_angle >= max_clear_slope
            if elev_angle > max_clear_slope:
                max_clear_slope = elev_angle
            if visible and hit is None and is_water(E, N):
                hit = {"distance_m": round(dist, 1), "elevation_rh2000_m": round(zg, 2)}
                break
            if visible is False:
                pass
        rays.append({
            "azimuth_deg": az_deg,
            "sea_view": hit is not None,
            "first_water_hit": hit,
        })

    # Coarse heightfield over a 260 m grid (24 segments) around the pin, relative to pin datum,
    # for the 3D viewer terrain mesh (matches the Svärtinge viewer's grid convention).
    size, seg = 260, 24
    vertices = []
    for iz in range(seg + 1):
        for ix in range(seg + 1):
            x = -size / 2 + size * ix / seg
            z = -size / 2 + size * iz / seg
            zv = sample(PIN_E + x, PIN_N + z)
            y = round((zv - z_pin), 2) if zv is not None else -0.3
            vertices.append([round(x, 2), y, round(z, 2)])

    sea_hits = [r for r in rays if r["sea_view"]]
    sea_arcs = []
    if sea_hits:
        cur = None
        for r in rays:
            if r["sea_view"]:
                if cur is None:
                    cur = [r["azimuth_deg"], r["azimuth_deg"]]
                else:
                    cur[1] = r["azimuth_deg"]
            else:
                if cur is not None:
                    sea_arcs.append(tuple(cur)); cur = None
        if cur is not None:
            sea_arcs.append(tuple(cur))
        # merge wraparound arc (0deg and 357deg belonging together)
        if len(sea_arcs) > 1 and sea_arcs[0][0] == 0 and sea_arcs[-1][1] == rays[-1]["azimuth_deg"]:
            first = sea_arcs.pop(0)
            last = sea_arcs.pop(-1)
            sea_arcs.append((last[0], first[1] + 360))

    def compass_of(deg):
        return compass16[int(((deg % 360) + 11.25) // 22.5) % 16]

    out = {
        "schema_version": "djuro-terrain-dem-derived/v0.1",
        "entity_type": "DerivedTerrainEvidence",
        "subject": "DJURÖ 4:147 (Djurö byväg 34)",
        "evidence_class": "DERIVED",
        "authority": "Lantmäteriet",
        "product": receipt["source"],
        "licence": receipt["licence"],
        "source_crs": crs,
        "derived_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "source_receipt": {
            "file": os.path.relpath(RECEIPT, ROOT),
            "tiles": {n: {"sha256": m["sha256"], "bytes": m["bytes"]} for n, m in receipt["tiles"].items()},
        },
        "coordinate_anchor": {"sweref99tm_en": [PIN_E, PIN_N], "source": "intake-v0.1.json geocode->parcel resolution"},
        "pin_elevation_rh2000_m": round(z_pin, 2),
        "slope_aspect_at_pin": {
            "slope_deg": round(slope, 1), "aspect_deg": round(aspect), "aspect_compass": compass,
            "method": "Horn (1981) 3x3 on 1 m grid",
        },
        "water_mask_method": {
            "class": "DERIVED",
            "note": "marktacke (official LM land-cover/hydrography vector) was requested but denied (HTTP 403) under the current Geotorget grant. Water cells are instead classified directly from the same receipted 1 m DEM: elevation < 0.3 m RH2000 AND local 5x5 relief < 0.15 m. This is a disclosed heuristic on real elevation data, not an official water boundary — do not present it as AUTHORITATIVE hydrography.",
            "elevation_threshold_m": WATER_ELEV_MAX,
            "local_relief_threshold_m": WATER_LOCAL_RELIEF_MAX,
        },
        "viewshed": {
            "class": "DERIVED",
            "method": f"Radial line-of-sight from eye height {EYE_HEIGHT_M} m above the pin's ground elevation, {AZIMUTH_STEP_DEG} deg azimuth steps, {RAY_STEP_M} m ray steps out to {RAY_MAX_M} m, classic terrain-masking (a ray is blocked once any closer point's elevation angle exceeds all prior maxima). Reports the first unobstructed step per azimuth that also satisfies the water mask above.",
            "eye_height_m": EYE_HEIGHT_M,
            "max_range_m": RAY_MAX_M,
            "sea_view_azimuth_count": len(sea_hits),
            "sea_view_azimuth_fraction": round(len(sea_hits) / len(rays), 3),
            "sea_view_arcs_deg": [
                {"from_deg": a % 360, "to_deg": b % 360, "from_compass": compass_of(a), "to_compass": compass_of(b)}
                for a, b in sea_arcs
            ],
            "rays": rays,
        },
        "heightfield": {
            "size_m": size, "segments": seg,
            "height_reference": "RH2000 minus pin datum (relative metres, up positive)",
            "vertices": vertices,
        },
        "limitations": [
            "Water classification is a DEM elevation/flatness heuristic, not the official LM hydrography vector (denied, HTTP 403) — small ponds, wet rock, or very flat non-water ground near the threshold could misclassify in either direction at the margin.",
            "Viewshed does not model vegetation (tree canopy), the house's own structure, or neighbouring buildings' height (LM byggnad carries no height) — a real summer view may be more or less open than this bare-earth DEM result depending on tree cover, which is not evaluated here.",
            "Eye height is a fixed 1.6 m standing-eye-level assumption at the address pin ground elevation, not at any specific window, deck, or upper-floor height in the (unbuilt/renovated) house.",
            "Ray sampling is nearest-cell at 1 m DEM resolution with 2 m steps; sub-metre features (sea walls, rocks) are not resolved.",
        ],
        "not_checked": "official hydrography boundary (marktacke, denied); vegetation/canopy height; upper-floor / deck-height view (only ground+1.6m eye level checked); neighbouring building heights.",
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    open(OUT, "a").write("\n")

    print(f"pin elevation {z_pin:.2f} m RH2000; slope {slope:.1f} deg aspect {compass} ({aspect:.0f} deg)")
    print(f"sea-view azimuths: {len(sea_hits)}/{len(rays)} ({100*len(sea_hits)/len(rays):.0f}%)")
    for arc in out["viewshed"]["sea_view_arcs_deg"]:
        print(f"  arc {arc['from_compass']} ({arc['from_deg']}) -> {arc['to_compass']} ({arc['to_deg']})")
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
