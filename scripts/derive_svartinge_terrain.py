#!/usr/bin/env python3
"""Derive real-terrain evidence for SVÄRTINGE 54:28 from the receipted Lantmäteriet 1 m DEM.

Inputs (gitignored, licence-receipted under .runtime/):
  .runtime/lantmateriet/terrain/*.tif            Markhöjdmodell Nedladdning, grid 1 m, EPSG:5845 (SWEREF99 TM + RH2000)
  .runtime/receipts/lantmateriet-terrain-2026-08-18.json   SHA-256 receipt + licence (HVD open data)

Output (committed derived product — NOT raw provider bytes):
  data/sites/sweden/saterdalsvagen-14/terrain-dem-derived-v0.1.json

The script re-verifies every tile against the receipt SHA-256 before use, cross-checks the
listing-pin transform (pyproj EPSG:4326->EPSG:3006) against the viewer's SWEREF alignment
control, then derives: pin elevation, plot-footprint relief, slope/aspect, a southbound Glan
sightline profile, and a coarse heightfield (relative to the pin datum) over the scene's
360 m x 24-segment terrain grid for the viewer.

Run (local, one-time deps):
  python3 -m venv .runtime/venv && . .runtime/venv/bin/activate && pip install rasterio pyproj
  .runtime/venv/bin/python scripts/derive_svartinge_terrain.py
"""
import json, math, glob, hashlib, os, sys, datetime
import numpy as np, rasterio
from rasterio.merge import merge
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECEIPT = os.path.join(ROOT, ".runtime/receipts/lantmateriet-terrain-2026-08-18.json")
TILEDIR = os.path.join(ROOT, ".runtime/lantmateriet/terrain")
SCENE = os.path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/neighbourhood-scene-v0.2.json")
OUT = os.path.join(ROOT, "data/sites/sweden/saterdalsvagen-14/terrain-dem-derived-v0.1.json")
PIN_WGS84 = [16.0317063331, 58.6522414431]  # listing pin [lon, lat]
ALIGN_CONTROL = [559869.000, 6501790.311]   # viewer SWEREF alignment origin (E, N), from geographic-alignment test


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
            die(f"tile {name} SHA-256 mismatch (receipt {meta['sha256'][:12]}… vs file {h[:12]}…)")
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

    # Pin transform, cross-checked against the viewer alignment control.
    tr = Transformer.from_crs("EPSG:4326", "EPSG:3006", always_xy=True)
    E0, N0 = tr.transform(PIN_WGS84[0], PIN_WGS84[1])
    dcontrol = math.hypot(E0 - ALIGN_CONTROL[0], N0 - ALIGN_CONTROL[1])
    if dcontrol > 0.01:
        die(f"pin transform {E0:.3f}/{N0:.3f} disagrees with alignment control by {dcontrol:.3f} m")

    def sample(E, N):
        col = int(round((E - tf.c) / tf.a)); row = int(round((N - tf.f) / tf.e))
        if 0 <= row < H and 0 <= col < W:
            v = float(dem[row, col])
            return None if v == nodata else v
        return None

    z_pin = sample(E0, N0)
    if z_pin is None:
        die("pin outside DEM coverage")

    # Plot-footprint elevations (INDICATIVE positions — terrain is authoritative, boundary is not).
    scene = json.load(open(SCENE))
    plot = next(e for e in scene["elements"] if e["id"] == "PLOT_54_28")
    corners = []
    for x, z in plot["geometry"]["points_xz"]:
        corners.append({"local_xz": [x, z], "sweref_en": [round(E0 + x, 2), round(N0 + z, 2)],
                        "elevation_rh2000": round(sample(E0 + x, N0 + z), 2)})
    czs = [c["elevation_rh2000"] for c in corners]

    # Slope/aspect at pin via Horn 3x3 on the 1 m grid.
    r0 = int(round((N0 - tf.f) / tf.e)); c0 = int(round((E0 - tf.c) / tf.a))
    w = dem[r0 - 1:r0 + 2, c0 - 1:c0 + 2].astype(float)
    dzdx = ((w[0, 2] + 2 * w[1, 2] + w[2, 2]) - (w[0, 0] + 2 * w[1, 0] + w[2, 0])) / (8 * abs(tf.a))
    dzdy = ((w[2, 0] + 2 * w[2, 1] + w[2, 2]) - (w[0, 0] + 2 * w[0, 1] + w[0, 2])) / (8 * abs(tf.e))
    slope = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
    aspect = (90 - math.degrees(math.atan2(dzdy, -dzdx))) % 360
    compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int(((aspect + 22.5) % 360) // 45)]

    # Southbound Glan sightline profile along the reported view azimuth.
    view = next((e for e in scene["elements"] if e.get("type") == "VIEW_DIRECTION"), None)
    az_deg = view["geometry"]["azimuth_deg"] if view else 185
    az = math.radians(az_deg)
    profile = []
    for dist in range(0, 801, 25):
        z = sample(E0 + math.sin(az) * dist, N0 + math.cos(az) * dist)
        if z is None:
            break
        profile.append([dist, round(z, 2)])

    # Coarse heightfield over the scene terrain grid (360 m, 24 segments), relative to the pin datum.
    size, seg = 360, 24
    vertices, ys = [], []
    for iz in range(seg + 1):
        for ix in range(seg + 1):
            x = -size / 2 + size * ix / seg
            z = -size / 2 + size * iz / seg
            zv = sample(E0 + x, N0 + z)
            y = round((zv - z_pin), 2) if zv is not None else 0.0
            vertices.append([round(x, 2), y, round(z, 2)])
            ys.append(y)

    out = {
        "schema_version": "svartinge-terrain-dem-derived/v0.1",
        "entity_type": "DerivedTerrainEvidence",
        "subject": "SVÄRTINGE 54:28",
        "evidence_class": "DERIVED",
        "gate_dependency": {
            "gate_id": "GATE_SE_TERRAIN",
            "status": "OPEN",
            "effect": "GATE_SE_TERRAIN lists 'RH2000 spot heights', 'slope or drainage conclusions' and 'terrain mesh presented as official' as forbidden outputs until closed. The heights, slope/aspect and Glan profile below are therefore a PROVISIONAL internal derivation only — they must NOT be presented as official terrain, surveyed contours, finished-floor input, or used to close a legal gate until GATE_SE_TERRAIN is formally closed.",
        },
        "gate_tracked_asset_discrepancy": {
            "note": "terrain-source-metadata-v0.1.json tracks a single 10 km COG (m650_55.tif, 246140605 bytes, multihash 1220789c…) as the gate-closure asset. This derivation instead used the equivalent Markhöjdmodell 1 m grid tiles (grid1m/65_5/05/*.tif) that were downloaded to .runtime/. Same authority, 1 m grid, RH2000; elevations expected equivalent, but the exact gate-tracked COG multihash is NOT verified here and the metadata's nodata/coverage + update-patch QA has NOT been run against these tiles.",
        },
        "authority": "Lantmäteriet",
        "product": receipt["source"],
        "licence": receipt["licence"],
        "source_crs": crs,
        "method": "Bilinear-free nearest-cell sample of the receipted 1 m DEM mosaic; Horn 3x3 slope/aspect; heights expressed relative to the listing-pin datum for the local ENU viewer.",
        "derived_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "source_receipt": {
            "file": os.path.relpath(RECEIPT, ROOT),
            "tiles": {n: {"sha256": m["sha256"], "bytes": m["bytes"]} for n, m in receipt["tiles"].items()},
        },
        "coordinate_anchor": {
            "listing_pin_wgs84": PIN_WGS84,
            "sweref99tm_en": [round(E0, 3), round(N0, 3)],
            "cross_checked_against": "viewer geographic-alignment control 559869.000 / 6501790.311",
            "agreement_m": round(dcontrol, 4),
        },
        "pin_elevation_rh2000_m": round(z_pin, 2),
        "plot_footprint": {
            "note": "Elevations sampled at the INDICATIVE municipal-map plot trace, not a surveyed boundary.",
            "corners": corners,
            "min_m": min(czs), "max_m": max(czs), "relief_m": round(max(czs) - min(czs), 2),
        },
        "slope_aspect_at_pin": {
            "slope_deg": round(slope, 1), "aspect_deg": round(aspect), "aspect_compass": compass,
            "method": "Horn (1981) 3x3 on 1 m grid",
        },
        "glan_sightline_profile": {
            "azimuth_deg": az_deg,
            "step_m": 25,
            "elevation_rh2000_m": profile,
            "drop_m": round(profile[0][1] - profile[-1][1], 2) if len(profile) > 1 else 0,
            "note": "Real terrain descent toward Glan. Confirms elevation/fall only; does NOT prove an unobstructed sightline (vegetation, buildings and the registered boundary are not modelled here).",
        },
        "heightfield": {
            "size_m": size, "segments": seg,
            "height_reference": "RH2000 minus listing-pin datum (relative metres, up positive)",
            "vertices": vertices,
        },
        "limitations": [
            "Source raster is official Lantmäteriet 1 m DEM data, but GATE_SE_TERRAIN is OPEN: these values are PROVISIONAL and must not be presented as official terrain until the gate is formally closed against the tracked asset.",
            "The plot boundary, access, utilities and legal gates remain OPEN and unproven.",
            "Sampling is nearest-cell at 1 m; sub-metre micro-relief and breaklines (brytgeometri) are not modelled.",
            "The Glan profile and slope/aspect are computed at/through the indicative locator, not a surveyed set-out point.",
        ],
        "not_checked": "GATE_SE_TERRAIN closure protocol: exact tracked COG m650_55.tif multihash (1220789c…), nodata/coverage QA, update-patch boundary provenance; registered legal area/boundary (needs fastighetsindelning vector — not yet ordered); breaklines + ursprung metadata; laser point cloud; vegetation/building occlusion of the Glan view.",
    }
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
    open(OUT, "a").write("\n")

    print(f"pin elevation {z_pin:.2f} m (RH2000); plot relief {out['plot_footprint']['relief_m']} m")
    print(f"slope {slope:.1f} deg, aspect {compass} ({aspect:.0f} deg)")
    print(f"Glan profile az {az_deg} deg: drop {out['glan_sightline_profile']['drop_m']} m over {profile[-1][0]} m")
    print(f"wrote {os.path.relpath(OUT, ROOT)}  ({os.path.getsize(OUT)} bytes; heightfield {len(vertices)} vertices)")


if __name__ == "__main__":
    main()
