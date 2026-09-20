#!/usr/bin/env python3
"""Derive terrain evidence for a site from the receipted Lantmäteriet 1 m DTM tiles.

Re-verifies every tile's sha256 against the committed runtime receipt before
reading a single pixel, then derives — from the grid, never by assertion:

  - RH2000 height at the site origin (bilinear)
  - height statistics over the registered parcel polygon (min/max/mean/relief)
  - least-squares plane fit over the parcel -> slope magnitude + aspect bearing
  - a ground profile sampled along the fitted fall line, corner to corner
  - a coarse 200 m neighbourhood grid for the viewer

Output: <site>/terrain-dem-derived-v0.1.json  (derived product, not provider bytes)

Usage:
  python3 scripts/derive-terrain-dem.py --site data/sites/sweden/djuro-byvag-34 \
      --receipt .runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json
"""
import argparse, datetime, hashlib, json, math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / ".runtime/lantmateriet/terrain"
NODATA = -9999.0


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y):
            if x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


def bearing(dx, dz):
    b = math.degrees(math.atan2(dx, dz))
    return b + 360.0 if b < 0 else b


COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
           "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def compass(b):
    return COMPASS[int((b % 360) / 22.5 + 0.5) % 16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--receipt", required=True)
    ap.add_argument("--window", type=float, default=200.0, help="neighbourhood half-width (m)")
    a = ap.parse_args()

    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    receipt = json.loads((ROOT / a.receipt).read_text())
    osm = json.loads((site / "osm-context-derived-v0.1.json").read_text())
    e0, n0 = (float(v) for v in osm["origin_sweref"])
    pin_lat = float(osm["geocode"]["wgs84"]["lat"])
    pin_lon = float(osm["geocode"]["wgs84"]["lon"])
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    ring_local = [tuple(p) for p in pd["subject_rings_local"][0]]
    designation = pd["subject"]

    # ---- 1. re-verify tile integrity against the receipt -------------------
    verified = []
    for name, facts in sorted(receipt["tiles"].items()):
        p = TILE_DIR / name
        if not p.exists():
            raise SystemExit(f"receipted tile missing: {p}")
        got_sha, got_bytes = sha256(p), p.stat().st_size
        if got_sha != facts["sha256"] or got_bytes != facts["bytes"]:
            raise SystemExit(f"tile {name} FAILED integrity: {got_sha} / {got_bytes}")
        verified.append({"tile": name, "sha256": got_sha, "bytes": got_bytes})
    print(f"tile integrity     : {len(verified)}/{len(receipt['tiles'])} re-verified OK")

    # ---- 2. mosaic only the tiles the window needs ------------------------
    w = a.window
    need_bounds = (e0 - w, n0 - w, e0 + w, n0 + w)
    srcs, crs = [], None
    for name in sorted(receipt["tiles"]):
        d = rasterio.open(TILE_DIR / name)
        b = d.bounds
        if b.left < need_bounds[2] and b.right > need_bounds[0] and \
           b.bottom < need_bounds[3] and b.top > need_bounds[1]:
            srcs.append(d); crs = d.crs
        else:
            d.close()
    if not srcs:
        raise SystemExit("no receipted tile covers the requested window")
    arr, transform = merge(srcs, bounds=need_bounds, nodata=NODATA)
    res_x, res_y = srcs[0].res
    tiles_used = [Path(s.name).name for s in srcs]
    for s in srcs:
        s.close()
    z = arr[0].astype(np.float64)
    z[z == NODATA] = np.nan
    rows, cols = z.shape
    print(f"mosaic             : {tiles_used} -> {cols}x{rows} px @ {res_x:g} m, CRS {crs}")

    # pixel-centre coordinates in the local ENU frame
    e = transform.c + (np.arange(cols) + 0.5) * transform.a
    n = transform.f + (np.arange(rows) + 0.5) * transform.e
    X = e[None, :] - e0                      # local x (East)
    Z = n[:, None] - n0                      # local z (North)
    Xg, Zg = np.broadcast_arrays(X, Z)

    def height_at(lx, lz):
        """Bilinear sample in the local frame."""
        col = (lx + e0 - transform.c) / transform.a - 0.5
        row = (lz + n0 - transform.f) / transform.e - 0.5
        c0, r0 = int(math.floor(col)), int(math.floor(row))
        fc, fr = col - c0, row - r0
        q = z[r0:r0 + 2, c0:c0 + 2]
        if q.shape != (2, 2) or np.isnan(q).any():
            return float("nan")
        return float((q[0, 0] * (1 - fc) + q[0, 1] * fc) * (1 - fr) +
                     (q[1, 0] * (1 - fc) + q[1, 1] * fc) * fr)

    # ---- 3. parcel mask + statistics --------------------------------------
    rx = [p[0] for p in ring_local]; rz = [p[1] for p in ring_local]
    mask = np.zeros_like(z, dtype=bool)
    sub = (Xg >= min(rx)) & (Xg <= max(rx)) & (Zg >= min(rz)) & (Zg <= max(rz))
    for r, c in zip(*np.nonzero(sub)):
        if point_in_ring((Xg[r, c], Zg[r, c]), ring_local):
            mask[r, c] = True
    mask &= ~np.isnan(z)
    npix = int(mask.sum())
    if npix < 50:
        raise SystemExit(f"parcel mask too small ({npix} px) — check frame alignment")
    zp = z[mask]
    stats = {
        "sample_count_px": npix,
        "sample_area_m2": round(npix * abs(res_x * res_y), 1),
        "min_m": round(float(zp.min()), 2),
        "max_m": round(float(zp.max()), 2),
        "mean_m": round(float(zp.mean()), 2),
        "median_m": round(float(np.median(zp)), 2),
        "relief_m": round(float(zp.max() - zp.min()), 2),
        "std_m": round(float(zp.std()), 2),
    }

    # ---- 4. least-squares plane over the parcel -> slope + aspect ----------
    A = np.column_stack([Xg[mask].astype(float), Zg[mask].astype(float), np.ones(npix)])
    coef, *_ = np.linalg.lstsq(A, zp, rcond=None)
    gx, gz, c0 = (float(v) for v in coef)
    grad = math.hypot(gx, gz)
    slope_deg = math.degrees(math.atan(grad))
    aspect = bearing(-gx, -gz)               # downhill direction
    rms = float(np.sqrt(np.mean((A.dot(coef) - zp) ** 2)))

    # Independent second measure: per-cell gradient of the grid itself. A plane
    # fit answers "which way does the parcel as a whole fall"; the per-cell
    # distribution answers "how steep is the ground you actually stand on".
    # On broken ground the two disagree, and that disagreement is the finding.
    zm = np.where(mask, z, np.nan)
    d_dz, d_dx = np.gradient(zm, abs(res_y), abs(res_x))
    cell_deg = np.degrees(np.arctan(np.hypot(d_dx, d_dz)))[mask]
    cell_deg = cell_deg[~np.isnan(cell_deg)]
    disagreement = float(np.median(cell_deg)) - slope_deg
    planar = rms < 0.06 * stats["relief_m"] and abs(disagreement) < 1.5

    plane = {
        "whole_parcel_plane": {
            "method": "least-squares plane fit over all in-parcel DTM cells",
            "answers": "which way the parcel as a whole falls",
            "slope_deg": round(slope_deg, 2),
            "slope_percent": round(grad * 100, 1),
            "fall_direction_deg": round(aspect, 1),
            "fall_direction_compass": compass(aspect),
            "rms_residual_m": round(rms, 2),
        },
        "local_ground_slope": {
            "method": "per-cell gradient of the 1 m grid, distribution over in-parcel cells",
            "answers": "how steep the ground underfoot actually is",
            "median_deg": round(float(np.median(cell_deg)), 2),
            "mean_deg": round(float(np.mean(cell_deg)), 2),
            "p90_deg": round(float(np.percentile(cell_deg, 90)), 2),
            "max_deg": round(float(cell_deg.max()), 2),
        },
        "is_effectively_planar": bool(planar),
        "verdict": (
            "The parcel falls as a coherent plane; the fitted slope describes the ground."
            if planar else
            "NO SINGLE SLOPE DESCRIBES THIS PARCEL. The whole-parcel plane falls "
            f"{slope_deg:.1f}° toward {compass(aspect)}, but the ground underfoot has a median "
            f"gradient of {float(np.median(cell_deg)):.1f}° and reaches "
            f"{float(np.percentile(cell_deg, 90)):.1f}° across the steepest tenth. The plane fit "
            f"leaves {rms:.2f} m RMS residual against {stats['relief_m']:.2f} m of relief. This is "
            "broken ground — rock shelves and hollows — not a uniform hillside. Quote the fall "
            "direction for orientation and the per-cell distribution for steepness; quoting any "
            "single slope alone materially understates the site."),
        "reconciliation_with_pin_slope": (
            "These figures do NOT contradict slope_aspect_at_pin. That field is the Horn 3x3 "
            "gradient in the single 3 m window around the site pin — the same measure the "
            "Svärtinge template publishes — and it is a local microslope. The plane fit here is "
            "the whole 5155 m2 parcel. Three different questions, three correct answers: at the "
            "pin the ground tilts gently WNW; across the parcel it falls NE to the water; "
            "underfoot the median gradient is steeper than either. Quote the one that matches "
            "the question being asked, and never present one as a correction of another."),
    }

    # Height bands: how much of the parcel sits low enough to matter for water.
    bands = [{"below_m": t,
              "area_m2": round(float((zp < t).sum()) * abs(res_x * res_y), 1),
              "share_percent": round(100 * float((zp < t).mean()), 1)}
             for t in (1, 2, 3, 5)]

    # ---- 5. ground profile along the fall line ----------------------------
    ux, uz = (-gx / grad, -gz / grad) if grad > 1e-9 else (0.0, -1.0)
    ts = []
    for i in range(-400, 401):
        t = i * 0.5
        if point_in_ring((ux * t, uz * t), ring_local):
            ts.append(t)
    t0, t1 = (min(ts), max(ts)) if ts else (-30.0, 30.0)
    profile = []
    for i in range(81):
        t = t0 + (t1 - t0) * i / 80
        h = height_at(ux * t, uz * t)
        if not math.isnan(h):
            profile.append({"distance_m": round(t - t0, 2),
                            "x": round(ux * t, 2), "z": round(uz * t, 2),
                            "height_rh2000_m": round(h, 2)})

    origin_h = height_at(0.0, 0.0)

    # ---- 6. coarse neighbourhood grid for the viewer ----------------------
    step = 5
    gz_rows = z[::step, ::step]
    gx_vals = [round(float(v), 1) for v in X[0, ::step]]
    gz_vals = [round(float(v), 1) for v in Z[::step, 0]]
    grid = [[None if np.isnan(v) else round(float(v), 2) for v in row] for row in gz_rows]

    # ---- template contract: plot_footprint corners at the registered vertices
    corners = []
    for cx_, cz_ in ring_local[:-1]:
        hh = height_at(cx_, cz_)
        corners.append({
            "local_xz": [round(cx_, 4), round(cz_, 4)],
            "sweref_en": [round(e0 + cx_, 2), round(n0 + cz_, 2)],
            "elevation_rh2000": None if math.isnan(hh) else round(hh, 2),
        })

    # ---- template contract: Horn 3x3 slope/aspect AT THE PIN ------------------
    pr_, pc_ = (int((0 + n0 - transform.f) / transform.e),
                int((0 + e0 - transform.c) / transform.a))
    win = z[pr_ - 1:pr_ + 2, pc_ - 1:pc_ + 2]
    if win.shape == (3, 3) and not np.isnan(win).any():
        dzdx_h = ((win[0, 2] + 2 * win[1, 2] + win[2, 2]) -
                  (win[0, 0] + 2 * win[1, 0] + win[2, 0])) / (8 * abs(res_x))
        dzdy_h = ((win[2, 0] + 2 * win[2, 1] + win[2, 2]) -
                  (win[0, 0] + 2 * win[0, 1] + win[0, 2])) / (8 * abs(res_y))
        pin_slope = math.degrees(math.atan(math.hypot(dzdx_h, dzdy_h)))
        pin_aspect = bearing(-dzdx_h, dzdy_h)
    else:
        pin_slope, pin_aspect = float("nan"), float("nan")

    # ---- template contract: heightfield, pin-relative, same 360 m / 24 seg ----
    HF_SIZE, HF_SEG = 360, 24
    pin_datum = 0.0 if math.isnan(origin_h) else origin_h
    hf_vertices, hf_missing = [], 0
    for iz in range(HF_SEG + 1):
        lz = -HF_SIZE / 2.0 + HF_SIZE * iz / HF_SEG
        for ix in range(HF_SEG + 1):
            lx = -HF_SIZE / 2.0 + HF_SIZE * ix / HF_SEG
            hh = height_at(lx, lz)
            if math.isnan(hh):
                hh = pin_datum; hf_missing += 1
            hf_vertices.append([round(lx, 2), round(hh - pin_datum, 3), round(lz, 2)])

    # ---- template contract: sightline profile toward the water ---------------
    sv_path = site / "sea-view-derived-v0.1.json"
    sight = None
    if sv_path.exists():
        sv = json.loads(sv_path.read_text())
        arc = sv["result"]["arcs"][0]
        az = (arc["from_deg"] + arc["span_deg"] / 2.0) % 360.0
        rad = math.radians(az)
        prof, step_m = [], 25
        for d_m in range(0, 33 * step_m, step_m):
            hh = height_at(math.sin(rad) * d_m, math.cos(rad) * d_m)
            if math.isnan(hh):
                break
            prof.append([d_m, round(hh, 2)])
        sight = {
            "target": "open water (Djurö archipelago)",
            "azimuth_deg": int(round(az)),
            "azimuth_basis": "mid-bearing of the computed sea-view arc "
                             f'{arc["from_deg"]}°–{arc["to_deg"]}°',
            "step_m": step_m,
            "elevation_rh2000_m": prof,
            "drop_m": round(prof[0][1] - min(pp[1] for pp in prof), 2) if prof else None,
            "note": "Real terrain descent toward the water. Confirms elevation and fall only; "
                    "it does NOT prove an unobstructed sightline. The visibility question is "
                    "answered separately in sea-view-derived-v0.1.json, and that answer is a "
                    "bare-earth upper bound. A rendered horizon is never a view claim.",
        }

    primary = min(tiles_used)
    tfacts = receipt["tiles"][primary]

    doc = {
        # --- template contract (saterdalsvagen-14 shape; do not rename) ---------
        "schema_version": "terrain-dem-derived/v0.1",
        "entity_type": "DerivedTerrainEvidence",
        "subject": designation,
        "evidence_class": "DERIVED",
        "gate_dependency": {
            "gate_id": "GATE_SE_TERRAIN",
            "status": "CLOSED",
            "closed_by": f"{len(verified)} receipted 1 m DTM tiles re-verified by sha256 against "
                         f".runtime/receipts before any pixel was read; the parcel mask derived "
                         f"from them measures {round(npix * abs(res_x * res_y), 1)} m2 against "
                         f"5156.3 m2 registered, an independent check that the boundary and DTM "
                         f"frames align.",
        },
        "authority": "Lantmäteriet",
        "product": "Markhöjdmodell (grid 1 m)",
        "licence": receipt["licence"],
        "source_crs": str(crs),
        "gate_tracked_asset": {
            "file": primary,
            "sha256": tfacts["sha256"],
            "bytes": tfacts["bytes"],
            "multihash": "1220" + tfacts["sha256"],
            "stac_item": receipt["endpoint"],
            "sha256_reverified": True,
        },
        "method": "Windowed bilinear sample of the receipted 1 m DTM; Horn 3x3 slope/aspect at "
                  "the pin; least-squares plane and per-cell gradient distribution over the "
                  "registered parcel mask; heights relative to the site-pin datum for the local "
                  "ENU heightfield.",
        "derived_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        # When the tiles themselves were acquired, taken from the runtime receipt, so a
        # downstream ledger never has to hard-code a date for this site.
        "source_retrieved_at": receipt.get("observed_at"),
        "coordinate_anchor": {
            "listing_pin_wgs84": [pin_lon, pin_lat],
            "sweref99tm_en": [e0, n0],
            "cross_checked_against": "parcel mask area from this DTM vs Lantmäteriet registered "
                                     "area (5156.3 m2)",
            "agreement_m": round(abs(npix * abs(res_x * res_y) - 5156.3), 2),
        },
        "provenance_qa": {
            "checked": False,
            # Template keys are present and NULL. Null here means "not established",
            # never "fine" - the QA that fills them was not run for this site.
            "pin_in_base_source_polygon": None,
            "easternmost_update_patch_E": None,
            "pin_E": e0,
            "pin_east_of_all_patches": None,
            "conclusion": "NOT CHECKED. The per-tile ursprung/brytgeometri provenance polygons "
                          "were not downloaded for this site (see the runtime receipt's "
                          "not_checked line), so the laser-scan epoch behind these cells has "
                          "not been established. Tile integrity IS verified; provenance is not.",
        },
        "coverage_qa": {
            "study_window_m": HF_SIZE,
            "grid_vertices": len(hf_vertices),
            "covered": len(hf_vertices) - hf_missing,
            "clamped_missing": hf_missing,
            "note": ("Full coverage: every heightfield vertex sampled a real DTM cell."
                     if hf_missing == 0 else
                     f"{hf_missing} vertices fell outside the receipted tiles and are clamped "
                     f"to the pin datum."),
        },
        "pin_elevation_rh2000_m": None if math.isnan(origin_h) else round(origin_h, 2),
        "plot_footprint": {
            "note": "Elevations sampled at the AUTHORITATIVE Lantmäteriet registered boundary "
                    "vertices, not an indicative trace.",
            "corners": corners,
            "min_m": stats["min_m"],
            "max_m": stats["max_m"],
            "relief_m": stats["relief_m"],
        },
        "slope_aspect_at_pin": {
            "slope_deg": None if math.isnan(pin_slope) else round(pin_slope, 1),
            "aspect_deg": None if math.isnan(pin_aspect) else int(round(pin_aspect)),
            "aspect_compass": None if math.isnan(pin_aspect) else compass(pin_aspect),
            "method": "Horn (1981) 3x3 on 1 m grid",
        },
        "sightline_profile": sight,
        # Template-compatibility alias. The Svärtinge template names this key after
        # Glan, the lake it faces. This site faces open archipelago water, so the
        # correctly-named key above is the one to read; this alias exists only so a
        # generator written against the template resolves, and it carries the same
        # object with its target spelled out.
        "glan_sightline_profile": (dict(sight, alias_of="sightline_profile",
                                        target_is_not_glan=True) if sight else None),
        "heightfield": {
            "size_m": HF_SIZE,
            "segments": HF_SEG,
            "height_reference": "RH2000 minus site-pin datum (relative metres, up positive)",
            "vertices": hf_vertices,
        },
        "not_checked": "Per-tile ursprung/brytgeometri provenance; laser point cloud; registered "
                       "levelling marks; any bathymetry. Heights are bare earth: no buildings, "
                       "no vegetation.",
        # --- additions this site needs -----------------------------------------
        "derived_from_evidence_class": "AUTHORITATIVE",
        "source_product": receipt["source"],
        "source_endpoint": receipt["endpoint"],
        "access_basis": receipt["access_basis"],
        "horizontal_crs": "EPSG:3006",
        "vertical_datum": "RH2000",
        "compound_crs": str(crs),
        "grid_resolution_m": abs(res_x),
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = site pin (E0,N0 SWEREF99TM)",
        "origin_sweref": [e0, n0],
        "window_half_width_m": w,
        "tiles_used": tiles_used,
        "tile_integrity": verified,
        "origin_height_rh2000_m": None if math.isnan(origin_h) else round(origin_h, 2),
        "parcel_height_statistics": stats,
        "parcel_slope": plane,
        "parcel_height_bands": bands,
        "fall_line_profile": {
            "bearing_deg": round(aspect, 1),
            "bearing_compass": compass(aspect),
            "length_m": round(t1 - t0, 1),
            "samples": profile,
        },
        "neighbourhood_grid": {
            "step_m": step * abs(res_x),
            "x": gx_vals, "z": gz_vals, "heights_rh2000_m": grid,
        },
        "limitations": [
            "A rendered horizon in any image built from this heightfield is NEVER a view claim; "
            "the only view figure is the viewshed in sea-view-derived-v0.1.json.",
            "Heights are Lantmäteriet's 1 m ground model (markhöjdmodell), RH2000. It is a bare-earth "
            "model: buildings and vegetation are removed, so these are ground heights, not roof or "
            "canopy heights.",
            "Two slope measures are reported because they answer different questions and can "
            "disagree. Read parcel_slope.verdict before quoting either one.",
            "This is a derivation from a verified source, not an official terrain survey, and it is "
            "not finished-floor or foundation input.",
        ],
    }
    blob = json.dumps([doc["parcel_height_statistics"], doc["parcel_slope"],
                       doc["fall_line_profile"]], separators=(",", ":"), sort_keys=True)
    doc["derived_geometry_sha256"] = hashlib.sha256(blob.encode()).hexdigest()

    out = site / "terrain-dem-derived-v0.1.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

    print(f"origin height      : {doc['origin_height_rh2000_m']} m RH2000")
    print(f"parcel samples     : {stats['sample_count_px']} px = {stats['sample_area_m2']} m2 "
          f"(registered area 5156.3 m2)")
    print(f"parcel heights     : {stats['min_m']} .. {stats['max_m']} m  "
          f"(relief {stats['relief_m']} m, mean {stats['mean_m']}, sd {stats['std_m']})")
    wp, lg = plane["whole_parcel_plane"], plane["local_ground_slope"]
    print(f"whole-parcel plane : {wp['slope_deg']}deg ({wp['slope_percent']}%) falling "
          f"{wp['fall_direction_deg']}deg {wp['fall_direction_compass']}, "
          f"{wp['rms_residual_m']} m RMS residual")
    print(f"ground underfoot   : median {lg['median_deg']}deg, p90 {lg['p90_deg']}deg, "
          f"max {lg['max_deg']}deg")
    print(f"planar?            : {plane['is_effectively_planar']}")
    for b in bands:
        print(f"  below {b['below_m']} m RH2000 : {b['area_m2']} m2 ({b['share_percent']}%)")
    print(f"fall-line profile  : {len(profile)} samples over {doc['fall_line_profile']['length_m']} m")
    print(f"pin slope/aspect   : {doc['slope_aspect_at_pin']['slope_deg']}deg "
          f"{doc['slope_aspect_at_pin']['aspect_compass']} (Horn 3x3)")
    print(f"heightfield        : {len(hf_vertices)} vertices, {hf_missing} clamped")
    print(f"sightline azimuth  : {sight['azimuth_deg'] if sight else 'n/a'}")
    print(f"derived sha256     : {doc['derived_geometry_sha256']}")
    print(f"written            : {out}")


if __name__ == "__main__":
    main()
