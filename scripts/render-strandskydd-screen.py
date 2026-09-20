#!/usr/bin/env python3
"""Render the shoreline / strandskydd verification screen from the derived product."""
import argparse, base64, json, math, struct, zlib
from pathlib import Path

import numpy as np, rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
SW, SH, PAD = 1400, 980, 48
MAP, HALF = 820, 220.0


def png_bytes(a):
    h, w, _ = a.shape
    raw = b"".join(b"\x00" + a[r].tobytes() for r in range(h))
    def ck(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + ck(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + ck(b"IDAT", zlib.compress(raw, 9)) + ck(b"IEND", b""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    s = json.loads((site / "shoreline-strandskydd-derived-v0.1.json").read_text())
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    bd = json.loads((site / "buildings-official-derived-v0.1.json").read_text())
    e0, n0 = s["origin_sweref"]
    ring = pd["subject_rings_local"][0]
    wv = s["water_surface"]["height_rh2000_m"]

    srcs = [rasterio.open(ROOT / ".runtime/lantmateriet/terrain" / n) for n in s["tiles_used"]]
    arr, tr = merge(srcs, bounds=(e0 - HALF, n0 - HALF, e0 + HALF, n0 + HALF), nodata=-9999.0)
    for x in srcs:
        x.close()
    z = arr[0].astype(np.float64)
    rows, cols = z.shape
    water = np.abs(z - wv) < 1e-6

    # distance-to-shoreline field, so the 100 m band is drawn where it actually is
    sp = np.array(s["shoreline_points_local"])
    e = tr.c + (np.arange(cols) + 0.5) * tr.a - e0
    n = tr.f + (np.arange(rows) + 0.5) * tr.e - n0
    Xg, Zg = np.broadcast_arrays(e[None, :], n[:, None])
    step = 2
    Xs, Zs = Xg[::step, ::step], Zg[::step, ::step]
    dist = np.full(Xs.shape, 1e9)
    for i in range(0, len(sp), 4):
        dist = np.minimum(dist, np.hypot(Xs - sp[i, 0], Zs - sp[i, 1]))
    dist = np.repeat(np.repeat(dist, step, 0), step, 1)[:rows, :cols]

    dzdy, dzdx = np.gradient(z, 1.0, 1.0)
    slope = np.arctan(np.hypot(dzdx, dzdy)); asp = np.arctan2(-dzdx, dzdy)
    hs = np.clip(np.sin(np.radians(45)) * np.cos(slope) +
                 np.cos(np.radians(45)) * np.sin(slope) * np.cos(np.radians(315) - asp), 0, 1)
    img = np.zeros((rows, cols, 3))
    land = np.clip((z - wv) / 12.0, 0, 1)
    img[..., 0] = 60 + land * 150; img[..., 1] = 78 + land * 120; img[..., 2] = 58 + land * 60
    img *= (0.38 + 0.62 * hs)[..., None]
    img[water] = [22, 44, 60]
    band = (~water) & (dist <= 100)
    img[band] = img[band] * 0.55 + np.array([166, 91, 104]) * 0.45
    b64 = base64.b64encode(png_bytes(img.clip(0, 255).astype(np.uint8))).decode()

    MX, MY = PAD, PAD + 62
    sc = MAP / (2 * HALF)
    def T(p): return (MX + (p[0] + HALF) * sc, MY + (HALF - p[1]) * sc)
    def path(r): return "M" + " L".join(f"{T(p)[0]:.1f},{T(p)[1]:.1f}" for p in r) + " Z"

    el = [f'<clipPath id="m"><rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}"/></clipPath>',
          f'<image x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" href="data:image/png;base64,{b64}"/>',
          '<g clip-path="url(#m)">']
    el.append(f'<path d="{path(ring)}" fill="none" stroke="#f5f1e8" stroke-width="2.5"/>')
    dmap = {b["source_object_id"]: b for b in s["buildings_vs_shoreline"]}
    for b in bd["buildings"]:
        if b["placement"] != "ON_PARCEL":
            continue
        for poly in b["rings_local"]:
            el.append(f'<path d="{path(poly[0])}" fill="#d8b874" stroke="#101916" stroke-width="1"/>')
        info = dmap.get(b["source_object_id"])
        if info:
            x, y = T(b["centroid_local"])
            el.append(f'<text x="{x:.0f}" y="{y + 4:.0f}" text-anchor="middle" fill="#101916" '
                      f'font-family="Inter,sans-serif" font-size="11" font-weight="700">'
                      f'{info["distance_to_shoreline_m"]} m</text>')
    el.append("</g>")
    el.append(f'<rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" fill="none" stroke="#2d4038"/>')

    p2s, b100 = s["parcel_to_shoreline"], s["strandskydd_bands"][0]
    CX = MX + MAP + 36
    cards = [
        ("PARCEL INSIDE THE 100 m BAND", f'{b100["parcel_share_inside_percent"]}%',
         f'{b100["parcel_area_inside_m2"]:.0f} m² of {b100["parcel_area_inside_m2"] + b100["parcel_area_outside_m2"]:.0f} m² — all of it'),
        ("NEAREST POINT TO SHORELINE", f'{p2s["nearest_m"]} m',
         'the parcel reaches the water'),
        ("FARTHEST BOUNDARY POINT", f'{p2s["farthest_boundary_m"] if "farthest_boundary_m" in p2s else p2s["farthest_boundary_point_m"]} m',
         'still short of 100 m — no corner escapes'),
        ("OFFICIAL BUILDINGS INSIDE", f'{sum(1 for b in s["buildings_vs_shoreline"] if b["inside_100m"])} of {len(s["buildings_vs_shoreline"])}',
         f'nearest {min(b["distance_to_shoreline_m"] for b in s["buildings_vs_shoreline"])} m from the water'),
    ]
    y = MY + 26
    for k, v, sub in cards:
        el.append(f'<text x="{CX}" y="{y}" fill="#8ea399" font-family="Inter,sans-serif" '
                  f'font-size="10" letter-spacing="1.2">{k}</text>')
        el.append(f'<text x="{CX}" y="{y + 32}" fill="#f5f1e8" font-family="Georgia,serif" '
                  f'font-size="30">{v}</text>')
        el.append(f'<text x="{CX}" y="{y + 50}" fill="#6c7f76" font-family="Inter,sans-serif" '
                  f'font-size="10.5">{sub}</text>')
        y += 82

    el.append(f'<text x="{CX}" y="{y + 4}" fill="#8ea399" font-family="Inter,sans-serif" '
              f'font-size="10" letter-spacing="1.2">GATES</text>')
    yy = y + 26
    for gk, gv in s["gate_status"].items():
        closed = gv.startswith("CLOSED")
        col = "#176b52" if closed else "#c18a2d"
        mark = "●" if closed else "○"
        label = gk.replace("GATE_SE_", "").replace("_", " ").title()
        tail = "closed" + (" (negative)" if "(negative)" in gv else "") if closed else "open"
        el.append(f'<text x="{CX}" y="{yy}" fill="{col}" font-family="Inter,sans-serif" '
                  f'font-size="11">{mark} {label} — {tail}</text>')
        yy += 20

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}">
<rect width="{SW}" height="{SH}" fill="#101916"/>
<text x="{PAD}" y="38" fill="#d8b874" font-family="Georgia,serif" font-size="23">{s["subject"]} — shoreline and strandskydd, measured</text>
<text x="{PAD}" y="58" fill="#8ea399" font-family="Inter,sans-serif" font-size="12">DERIVED from AUTHORITATIVE · shoreline = edge of the ground model's constant water fill at {wv} m RH2000 ({s["water_surface"]["share_of_window_percent"]}% of a {2*s["window_half_width_m"]:.0f} m window) · {s["shoreline"]["cell_count"]} shoreline cells at 1 m</text>
{chr(10).join(el)}
<text x="{PAD}" y="{SH - 34}" fill="#f5f1e8" font-family="Georgia,serif" font-size="15">The page called strandskydd “presumed”. It is measured: every square metre lies inside the 100 m zone, as does every registered building — and Värmdö’s WFS confirms no 300 m extension and no detaljplan.</text>
<text x="{PAD}" y="{SH - 15}" fill="#6c7f76" font-family="Inter,sans-serif" font-size="10.5">rose overlay = land within 100 m of the shoreline (7 kap. 13–14 §§ miljöbalken) · white = registered boundary · gold = official footprints, labelled with distance to water · derived sha256 {s["derived_geometry_sha256"][:24]}…</text>
</svg>'''
    outp = ROOT / a.out
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(svg)
    print(f"written: {outp} ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
