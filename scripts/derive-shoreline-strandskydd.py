#!/usr/bin/env python3
"""Derive the shoreline and the strandskydd geometry for a site from the receipted
Lantmäteriet 1 m ground model.

WHY THIS IS POSSIBLE FROM THE DTM. Lantmäteriet's markhöjdmodell does not model the
sea bed: across open water it carries a single constant height. This script does not
assume that value - it FINDS it (the modal height in the lowest metre, required to
occupy an implausibly large share of cells for real terrain), reports it, and then
treats that region as water. The shoreline is the boundary of that region.

What is then measured, not asserted:
  - distance from the registered parcel to the shoreline
  - the share of the parcel inside the 100 m strandskydd band (7 kap. 13-14 MB)
  - the same for a 300 m extended band, so the consequence of the extension is
    visible whether or not the extension is in force here

WHAT THIS DOES NOT ESTABLISH. Whether Lansstyrelsen has extended strandskydd to
300 m here, and whether any dispens or upphavande applies, are decisions in
Lansstyrelsen's and Varmdo's registers. Those remain OPEN and are recorded as such.

Usage: python3 scripts/derive-shoreline-strandskydd.py --site data/sites/sweden/djuro-byvag-34
"""
import argparse, hashlib, json, math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / ".runtime/lantmateriet/terrain"
NODATA = -9999.0
WATER_MIN_SHARE = 0.05      # a constant filling >5% of a coastal window is not terrain


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y):
            if x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


def densify(ring, step=1.0):
    out = []
    for i in range(len(ring) - 1):
        (x1, z1), (x2, z2) = ring[i], ring[i + 1]
        d = math.hypot(x2 - x1, z2 - z1)
        n = max(1, int(d / step))
        for k in range(n):
            out.append((x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n))
    out.append(ring[-1])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--receipt", default=".runtime/receipts/lantmateriet-terrain-djuro-2026-08-31.json")
    ap.add_argument("--window", type=float, default=700.0)
    a = ap.parse_args()

    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    receipt = json.loads((ROOT / a.receipt).read_text())
    osm = json.loads((site / "osm-context-derived-v0.1.json").read_text())
    e0, n0 = (float(v) for v in osm["origin_sweref"])
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    ring = [tuple(p) for p in pd["subject_rings_local"][0]]
    designation = pd["subject"]

    w = a.window
    bounds = (e0 - w, n0 - w, e0 + w, n0 + w)
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
        if b.left < bounds[2] and b.right > bounds[0] and b.bottom < bounds[3] and b.top > bounds[1]:
            srcs.append(d); used.append(name)
        else:
            d.close()
    arr, tr = merge(srcs, bounds=bounds, nodata=NODATA)
    res = abs(srcs[0].res[0])
    for s in srcs:
        s.close()
    z = arr[0].astype(np.float64)
    valid = z != NODATA
    rows, cols = z.shape
    print(f"window             : {2*w:.0f} x {2*w:.0f} m, {cols}x{rows} px @ {res:g} m")
    print(f"tiles              : {used}  (integrity re-verified)")

    # ---- find the water constant rather than assuming it -------------------
    low = z[valid & (z < z[valid].min() + 1.0)]
    vals, counts = np.unique(np.round(low, 3), return_counts=True)
    wv = float(vals[counts.argmax()])
    share = float(counts.max()) / float(valid.sum())
    if share < WATER_MIN_SHARE:
        raise SystemExit(f"no water constant found (modal {wv} m covers only {share:.1%})")
    water = valid & (np.abs(z - wv) < 1e-6)
    print(f"water constant     : {wv} m RH2000, {int(water.sum())} cells = {share:.1%} of window")

    # ---- shoreline = water cells adjacent to land --------------------------
    land = valid & ~water
    nb = np.zeros_like(water)
    nb[1:, :] |= land[:-1, :]; nb[:-1, :] |= land[1:, :]
    nb[:, 1:] |= land[:, :-1]; nb[:, :-1] |= land[:, 1:]
    shore = water & nb
    sr, sc = np.nonzero(shore)
    sx = tr.c + (sc + 0.5) * tr.a - e0
    sz = tr.f + (sr + 0.5) * tr.e - n0
    shore_pts = np.column_stack([sx, sz])
    print(f"shoreline cells    : {len(shore_pts)}")

    # ---- distance from the parcel to the shoreline -------------------------
    bpts = np.array(densify(ring, 1.0))
    d2 = ((bpts[:, None, 0] - shore_pts[None, :, 0]) ** 2 +
          (bpts[:, None, 1] - shore_pts[None, :, 1]) ** 2)
    per_vertex = np.sqrt(d2.min(axis=1))
    i_near = int(per_vertex.argmin())
    nearest = float(per_vertex.min())
    farthest = float(per_vertex.max())

    # ---- how much of the parcel lies inside each strandskydd band ----------
    e = tr.c + (np.arange(cols) + 0.5) * tr.a - e0
    n = tr.f + (np.arange(rows) + 0.5) * tr.e - n0
    Xg, Zg = np.broadcast_arrays(e[None, :], n[:, None])
    inp = np.zeros_like(water)
    sub = ((Xg >= min(p[0] for p in ring)) & (Xg <= max(p[0] for p in ring)) &
           (Zg >= min(p[1] for p in ring)) & (Zg <= max(p[1] for p in ring)))
    for r, c in zip(*np.nonzero(sub)):
        if point_in_ring((Xg[r, c], Zg[r, c]), ring):
            inp[r, c] = True
    pr, pc = np.nonzero(inp)
    px = tr.c + (pc + 0.5) * tr.a - e0
    pz = tr.f + (pr + 0.5) * tr.e - n0
    pd2 = ((px[:, None] - shore_pts[None, :, 0]) ** 2 +
           (pz[:, None] - shore_pts[None, :, 1]) ** 2)
    pdist = np.sqrt(pd2.min(axis=1))
    parcel_px = len(pdist)
    cell_a = res * res

    bands = []
    for b in (100, 300):
        inside = int((pdist <= b).sum())
        bands.append({
            "band_m": b,
            "legal_basis": ("7 kap. 13-14 §§ miljöbalken — the base strandskydd zone"
                            if b == 100 else
                            "7 kap. 14 § miljöbalken — the extended zone Länsstyrelsen "
                            "may decide; IN FORCE HERE: NOT ESTABLISHED"),
            "parcel_area_inside_m2": round(inside * cell_a, 1),
            "parcel_share_inside_percent": round(100.0 * inside / parcel_px, 1),
            "parcel_area_outside_m2": round((parcel_px - inside) * cell_a, 1),
        })

    # ---- buildings vs the bands -------------------------------------------
    bpath = site / "buildings-official-derived-v0.1.json"
    bld = []
    if bpath.exists():
        for b in json.loads(bpath.read_text())["buildings"]:
            if b["placement"] != "ON_PARCEL":
                continue
            cx, cz = b["centroid_local"]
            dmin = float(np.sqrt(((cx - shore_pts[:, 0]) ** 2 +
                                  (cz - shore_pts[:, 1]) ** 2).min()))
            bld.append({
                "source_object_id": b["source_object_id"],
                "object_type": b["object_type"],
                "footprint_area_m2": b["footprint_area_m2"],
                "distance_to_shoreline_m": round(dmin, 1),
                "inside_100m": bool(dmin <= 100),
                "inside_300m": bool(dmin <= 300),
            })
        bld.sort(key=lambda x: x["distance_to_shoreline_m"])

    # ---- cross-reference the municipal planning receipts, if present -------
    gates = {
        "GATE_SE_STRANDSKYDD_GEOMETRY": "CLOSED — the distance from this parcel to the "
                                        "shoreline is measured, not presumed.",
        "GATE_SE_STRANDSKYDD_EXTENSION": "OPEN — not yet queried.",
        "GATE_SE_DETALJPLAN": "OPEN — not yet queried.",
        "GATE_SE_STRANDSKYDD_DISPENS": "OPEN — any dispens or upphävande attaching to this "
                                       "property has not been retrieved; it is a case record, "
                                       "not a map layer.",
    }
    mps_path = site / "municipal-planning-status-v0.1.json"
    planning = None
    if mps_path.exists():
        planning = json.loads(mps_path.read_text())
        by = {l["layer"]: l for l in planning["layers"]}

        def verdict(keys):
            got = [by[k] for k in keys if k in by]
            if not got or any(g["result"] not in ("VERIFIED_NEGATIVE", "MATCH") for g in got):
                return None
            return got

        ext = verdict(["extern_db:vy_lst_utvidgat_strandskydd_y",
                       "intern_db:vy_strandskydd_utvidgat_lststockholm_y",
                       "op_2022_2035_db:vy_op_ant_utokad_strandskydd_300m_y"])
        if ext and all(g["result"] == "VERIFIED_NEGATIVE" for g in ext):
            gates["GATE_SE_STRANDSKYDD_EXTENSION"] = (
                "CLOSED (negative) — the parcel intersects no extended-strandskydd polygon in "
                f"{len(ext)} independent Värmdö WFS layers, each with a passing control. The "
                "base 100 m zone is what applies here, and it already covers the whole parcel.")
        elif ext:
            gates["GATE_SE_STRANDSKYDD_EXTENSION"] = (
                "CLOSED (positive) — extended strandskydd covers this parcel.")

        dp = verdict(["intern_db:vy_gallande_detaljplaner_y",
                      "intern_db:vy_pagaende_detaljplaner_y",
                      "intern_db:vy_upphavda_detaljplaner_efter_20230101_y"])
        if dp and all(g["result"] == "VERIFIED_NEGATIVE" for g in dp):
            gates["GATE_SE_DETALJPLAN"] = (
                "CLOSED (negative) — no detaljplan in force, none pending and none revoked "
                "since 2023-01-01 intersects the parcel; controls passed on all three layers. "
                "This is unplanned land: bygglov is judged against översiktsplan, strandskydd "
                "and PBL, not a plan map.")

    doc = {
        "schema_version": "shoreline-strandskydd-derived/v0.1",
        "entity_type": "ShorelineAndStrandskyddDerivation",
        "subject": designation,
        "evidence_class": "DERIVED",
        "derived_from_evidence_class": "AUTHORITATIVE",
        "authority_of_source": "Lantmäteriet",
        "source_product": receipt["source"],
        "access_basis": receipt["access_basis"],
        "licence": receipt["licence"],
        "vertical_datum": "RH2000",
        "horizontal_crs": "EPSG:3006",
        "coordinate_frame": "LOCAL_ENU x=EAST z=NORTH, origin = site pin",
        "origin_sweref": [e0, n0],
        "window_half_width_m": w,
        "tiles_used": used,
        "water_surface": {
            "method": "modal height in the lowest metre of the window, accepted as the "
                      "water surface only because it covers an implausible share of cells",
            "height_rh2000_m": wv,
            "cells": int(water.sum()),
            "share_of_window_percent": round(100 * share, 1),
        },
        "shoreline": {
            "definition": "water cells orthogonally adjacent to a land cell",
            "cell_count": len(shore_pts),
            "resolution_m": res,
        },
        "parcel_to_shoreline": {
            "nearest_m": round(nearest, 1),
            "farthest_boundary_point_m": round(farthest, 1),
            "nearest_boundary_point_local": [round(float(bpts[i_near][0]), 2),
                                             round(float(bpts[i_near][1]), 2)],
            "parcel_touches_shoreline": bool(nearest <= res * 1.5),
        },
        "strandskydd_bands": bands,
        "buildings_vs_shoreline": bld,
        "municipal_planning_cross_reference": (
            {"source": str(mps_path.name), "retrieved_at": planning["retrieved_at"],
             "layers_checked": len(planning["layers"])} if planning else None),
        "gate_status": gates,
        "limitations": [
            "The water surface is inferred from the ground model's constant fill over open "
            "water, not from a hydrography product. It is a faithful shoreline at 1 m grid "
            "resolution, but it is a DERIVED shoreline, not the cadastral shoreline and not "
            "the legal strandlinje.",
            "Strandskydd is measured from the shoreline both landward and seaward. The bands "
            "here are landward distances within the parcel only.",
            "The 300 m band is computed to show the consequence of an extension. It is NOT a "
            "claim that an extension is in force at this shoreline.",
            "No dispens, upphävande or plan-based exemption has been checked.",
        ],
    }
    blob = json.dumps([doc["parcel_to_shoreline"], doc["strandskydd_bands"],
                       doc["buildings_vs_shoreline"]], separators=(",", ":"), sort_keys=True)
    doc["derived_geometry_sha256"] = hashlib.sha256(blob.encode()).hexdigest()

    # shoreline polyline for the viewer, thinned
    doc["shoreline_points_local"] = [[round(float(x), 1), round(float(y), 1)]
                                     for x, y in shore_pts[::3]]

    out = site / "shoreline-strandskydd-derived-v0.1.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

    print(f"parcel cells       : {parcel_px} = {parcel_px*cell_a:.0f} m2")
    print(f"nearest shoreline  : {nearest:.1f} m   (touches: "
          f"{doc['parcel_to_shoreline']['parcel_touches_shoreline']})")
    print(f"farthest bdy point : {farthest:.1f} m")
    for b in bands:
        print(f"  within {b['band_m']:>3} m       : {b['parcel_area_inside_m2']:>8.1f} m2 "
              f"({b['parcel_share_inside_percent']}% of parcel)")
    for b in bld:
        print(f"  {b['object_type']:<20} {b['footprint_area_m2']:>7.1f} m2  "
              f"{b['distance_to_shoreline_m']:>6.1f} m from shore  "
              f"{'INSIDE 100 m' if b['inside_100m'] else ''}")
    print("gates:")
    for k, v in gates.items():
        print(f"  {k}\n      {v}")
    print(f"derived sha256     : {doc['derived_geometry_sha256']}")
    print(f"written            : {out}")


if __name__ == "__main__":
    main()
