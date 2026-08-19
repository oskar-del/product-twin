#!/usr/bin/env python3
"""Derive terrain evidence for SVÄRTINGE 54:28 from the receipted, gate-tracked Lantmäteriet DTM COG.

Gate-tracked asset: Markhöjdmodell DTM COG **m650_55.tif** (STAC dtm-cog/650_55), 246,140,605 bytes,
multihash 1220789c… — the identity GATE_SE_TERRAIN closes against. This script re-verifies that
multihash on every run and runs provenance QA (pin inside the base laser-scan polygon, outside every
later update patch) before deriving heights.

IMPORTANT — evidence status: GATE_SE_TERRAIN is still OPEN (its closure is a separate, deliberate
change to the gate's own acceptance logic). Until it closes, the RH2000 heights / slope / Glan profile
below are a PROVISIONAL internal derivation from a verified source — NOT to be presented as official
terrain, contours or finished-floor input, and they close no legal gate.

Inputs (gitignored, licence-receipted under .runtime/):
  .runtime/lantmateriet/terrain-cog/m650_55.tif           gate-tracked DTM COG (sha256 re-verified)
  .runtime/lantmateriet/terrain-cog/m650_55_ursprung.json provenance polygons (patch QA)
Output (committed derived product, not raw provider bytes):
  data/sites/sweden/saterdalsvagen-14/terrain-dem-derived-v0.1.json

Run: .runtime/venv/bin/python scripts/derive_svartinge_terrain.py
"""
import json, math, os, sys, hashlib, datetime
import rasterio
from rasterio.windows import Window
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COGDIR = os.path.join(ROOT, ".runtime/lantmateriet/terrain-cog")
SCENE = os.path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json")
OUT = os.path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/terrain-dem-derived-v0.1.json")
PIN_WGS84 = [16.0317063331, 58.6522414431]
ALIGN_CONTROL = [559869.000, 6501790.311]
TRACKED = {"file": "m650_55.tif",
           "sha256": "789c7144922ab546ff8c149f8f82fb6a144fb751b2ff599abb8e96a9f5e56de2",
           "bytes": 246140605,
           "multihash": "1220789c7144922ab546ff8c149f8f82fb6a144fb751b2ff599abb8e96a9f5e56de2",
           "stac_item": "https://api.lantmateriet.se/stac-hojd/v1/collections/dtm-cog/items/650_55"}


def die(m): print("FAIL:", m); sys.exit(1)


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    p55 = os.path.join(COGDIR, TRACKED["file"])
    if not os.path.exists(p55):
        die("gate-tracked COG m650_55.tif absent")
    h = sha256(p55)
    if h != TRACKED["sha256"]:
        die(f"gate-tracked COG multihash mismatch ({h[:12]}… vs 789c7144…)")
    d = rasterio.open(p55)
    nodata = d.nodata

    def sample(E, N):
        r, c = d.index(E, N)
        if 0 <= r < d.height and 0 <= c < d.width:
            v = d.read(1, window=Window(c, r, 1, 1))[0, 0]
            return None if v == nodata else float(v)
        return None

    def sample3(E, N):
        r, c = d.index(E, N)
        if 1 <= r < d.height - 1 and 1 <= c < d.width - 1:
            return d.read(1, window=Window(c - 1, r - 1, 3, 3)).astype(float)
        return None

    tr = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)
    E0, N0 = tr.transform(PIN_WGS84[0], PIN_WGS84[1])
    dctrl = math.hypot(E0 - ALIGN_CONTROL[0], N0 - ALIGN_CONTROL[1])
    if dctrl > 0.01:
        die(f"pin transform disagrees with alignment control by {dctrl:.3f} m")

    z_pin = sample(E0, N0)
    if z_pin is None:
        die("pin outside DTM coverage")

    # Provenance QA from the real ursprung polygons.
    prov = {"checked": False}
    up = os.path.join(COGDIR, "m650_55_ursprung.json")
    if os.path.exists(up):
        u = json.load(open(up))

        def ring(pt, rng):
            inside = False; j = len(rng) - 1
            for i in range(len(rng)):
                xi, yi = rng[i][0], rng[i][1]; xj, yj = rng[j][0], rng[j][1]
                if ((yi > pt[1]) != (yj > pt[1])) and (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi):
                    inside = not inside
                j = i
            return inside

        def pip(x, y, g):
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
            return any(poly and ring((x, y), poly[0]) for poly in polys)

        base_hit = False; patch_max_e = 0
        for f in u.get("features", []):
            g = f.get("geometry") or {}
            xs = []
            def walk(c):
                if c and isinstance(c[0], (int, float)):
                    xs.append(c[0])
                elif isinstance(c, list):
                    for p in c:
                        walk(p)
            walk(g.get("coordinates", []))
            if not xs:
                continue
            if (max(xs) - min(xs)) > 5000:
                base_hit = base_hit or pip(E0, N0, g)
            else:
                patch_max_e = max(patch_max_e, max(xs))
        prov = {"checked": True, "pin_in_base_source_polygon": base_hit,
                "easternmost_update_patch_E": round(patch_max_e, 2),
                "pin_E": round(E0, 2), "pin_east_of_all_patches": bool(E0 > patch_max_e),
                "conclusion": "Plot terrain is from the base source epoch (outside every later update patch)."}

    scene = json.load(open(SCENE))
    plot = next(e for e in scene["elements"] if e["id"] == "PLOT_54_28")
    corners = [{"local_xz": [x, z], "sweref_en": [round(E0 + x, 2), round(N0 + z, 2)],
                "elevation_rh2000": round(sample(E0 + x, N0 + z), 2)}
               for x, z in plot["geometry"]["points_xz"]]
    czs = [c["elevation_rh2000"] for c in corners]

    w = sample3(E0, N0)
    dzdx = ((w[0, 2] + 2 * w[1, 2] + w[2, 2]) - (w[0, 0] + 2 * w[1, 0] + w[2, 0])) / 8.0
    dzdy = ((w[2, 0] + 2 * w[2, 1] + w[2, 2]) - (w[0, 0] + 2 * w[0, 1] + w[0, 2])) / 8.0
    slope = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
    aspect = (90 - math.degrees(math.atan2(dzdy, -dzdx))) % 360
    compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int(((aspect + 22.5) % 360) // 45)]

    view = next((e for e in scene["elements"] if e.get("type") == "VIEW_DIRECTION"), None)
    az_deg = view["geometry"]["azimuth_deg"] if view else 185
    az = math.radians(az_deg)
    profile = []
    for dist in range(0, 801, 25):
        z = sample(E0 + math.sin(az) * dist, N0 + math.cos(az) * dist)
        if z is None:
            break
        profile.append([dist, round(z, 2)])

    # Heightfield over the scene grid (360 m, 24 seg), relative to pin datum.
    # The tracked COG's east edge (E560000) clips ~16% of the window; missing cells
    # are clamped to the nearest covered cell in their row and counted honestly.
    size, seg = 360, 24
    rows = []; covered = missing = 0
    for iz in range(seg + 1):
        row = []
        for ix in range(seg + 1):
            x = -size / 2 + size * ix / seg
            z = -size / 2 + size * iz / seg
            zv = sample(E0 + x, N0 + z)
            if zv is None:
                missing += 1; row.append((x, z, None))
            else:
                covered += 1; row.append((x, z, round(zv - z_pin, 2)))
        # clamp missing to nearest covered value in the row
        last = next((v for _, _, v in row if v is not None), 0.0)
        for i, (x, z, v) in enumerate(row):
            if v is None:
                row[i] = (x, z, last)
            else:
                last = v
        rows.append(row)
    vertices = [[round(x, 2), y, round(z, 2)] for row in rows for (x, z, y) in row]

    out = {
        "schema_version": "svartinge-terrain-dem-derived/v0.1",
        "entity_type": "DerivedTerrainEvidence",
        "subject": "SVÄRTINGE 54:28",
        "evidence_class": "DERIVED",
        "gate_dependency": {
            "gate_id": "GATE_SE_TERRAIN",
            "status": "OPEN",
            "raster_now_acquired": True,
            "effect": "The gate-tracked DTM COG is now acquired and multihash-verified, but GATE_SE_TERRAIN is not yet formally closed (closing it is a separate change to the gate's acceptance logic in the validator/mutation suite, to be coordinated with the Product Twin brain per repo rules). Until then these RH2000 heights, slope/aspect and Glan profile are PROVISIONAL internal outputs and must not be presented as official terrain or close a legal gate.",
        },
        "authority": "Lantmäteriet",
        "product": "Markhöjdmodell DTM (grid 1 m, COG)",
        "licence": "Användningsvillkor för värdefulla datamängder (HVD open data)",
        "source_crs": str(d.crs),
        "gate_tracked_asset": {**TRACKED, "sha256_reverified": True},
        "method": "Windowed nearest-cell sample of the verified gate-tracked DTM COG; Horn 3x3 slope/aspect; heights relative to the listing-pin datum for the local ENU viewer.",
        "derived_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "coordinate_anchor": {
            "listing_pin_wgs84": PIN_WGS84,
            "sweref99tm_en": [round(E0, 3), round(N0, 3)],
            "cross_checked_against": "viewer geographic-alignment control 559869.000 / 6501790.311",
            "agreement_m": round(dctrl, 4),
        },
        "provenance_qa": prov,
        "coverage_qa": {
            "study_window_m": size, "grid_vertices": len(vertices),
            "covered": covered, "clamped_missing": missing,
            "note": "The gate-tracked COG covers E<=560000; the pin is 131 m from that edge so ~16% of the 360 m window (far-east strip) is clamped to the nearest covered cell. Full coverage would add the adjacent tile m650_56.",
        },
        "pin_elevation_rh2000_m": round(z_pin, 2),
        "plot_footprint": {
            "note": "Elevations sampled at the INDICATIVE municipal-map plot trace, not a surveyed boundary.",
            "corners": corners, "min_m": min(czs), "max_m": max(czs), "relief_m": round(max(czs) - min(czs), 2),
        },
        "slope_aspect_at_pin": {"slope_deg": round(slope, 1), "aspect_deg": round(aspect),
                                "aspect_compass": compass, "method": "Horn (1981) 3x3 on 1 m grid"},
        "glan_sightline_profile": {
            "azimuth_deg": az_deg, "step_m": 25, "elevation_rh2000_m": profile,
            "drop_m": round(profile[0][1] - profile[-1][1], 2) if len(profile) > 1 else 0,
            "note": "Real terrain descent toward Glan. Confirms elevation/fall only; does NOT prove an unobstructed sightline (vegetation, buildings and the registered boundary are not modelled here).",
        },
        "heightfield": {"size_m": size, "segments": seg,
                        "height_reference": "RH2000 minus listing-pin datum (relative metres, up positive)",
                        "vertices": vertices},
        "limitations": [
            "Source raster is the gate-tracked official 1 m DTM COG (multihash verified), but GATE_SE_TERRAIN is OPEN: these values are PROVISIONAL and must not be presented as official terrain until the gate is formally closed.",
            "The plot boundary, access, utilities and remaining legal gates stay OPEN and unproven.",
            "Sampling is nearest-cell at 1 m; sub-metre micro-relief and breaklines (brytgeometri) are not modelled; the far-east strip is clamped, not sampled.",
            "The Glan profile and slope/aspect are computed at/through the indicative locator, not a surveyed set-out point.",
        ],
        "not_checked": "Formal GATE_SE_TERRAIN closure (validator/mutation acceptance rewrite); east-neighbour tile m650_56 for full window coverage; breakline (brytgeometri) integration; laser point cloud; registered legal area/boundary (needs fastighetsindelning vector — not yet ordered); vegetation/building occlusion of the Glan view.",
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    open(OUT, "a").write("\n")
    print(f"gate-tracked COG multihash RE-VERIFIED (1220789c…)")
    print(f"pin {z_pin:.2f} m RH2000; relief {out['plot_footprint']['relief_m']} m; slope {slope:.1f} deg {compass}")
    print(f"Glan az {az_deg}: drop {out['glan_sightline_profile']['drop_m']} m over {profile[-1][0]} m")
    print(f"coverage {covered}/{len(vertices)} ({missing} clamped); provenance pin_in_base={prov.get('pin_in_base_source_polygon')} east_of_patches={prov.get('pin_east_of_all_patches')}")
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
