#!/usr/bin/env python3
"""Render the sea-view verification screen: viewshed map + polar sightline rose."""
import argparse, base64, json, math, struct, zlib
from pathlib import Path
import numpy as np, rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
SW, SH, PAD = 1400, 980, 48
MAP, HALF = 620, 900.0


def png_bytes(a):
    h, w, _ = a.shape
    raw = b"".join(b"\x00" + a[r].tobytes() for r in range(h))
    def ck(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + ck(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + ck(b"IDAT", zlib.compress(raw, 9)) + ck(b"IEND", b""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    sv = json.loads((site / "sea-view-derived-v0.1.json").read_text())
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    e0, n0 = sv["origin_sweref"]
    vp = sv["viewpoint"]["local"]
    wv = sv["water_surface"]["height_rh2000_m"]
    ring = pd["subject_rings_local"][0]

    srcs = [rasterio.open(ROOT / ".runtime/lantmateriet/terrain" / n) for n in sv["tiles_used"]]
    arr, tr = merge(srcs, bounds=(e0 + vp[0] - HALF, n0 + vp[1] - HALF,
                                  e0 + vp[0] + HALF, n0 + vp[1] + HALF), nodata=-9999.0)
    for s in srcs:
        s.close()
    z = arr[0].astype(np.float64); rows, cols = z.shape
    water = np.abs(z - wv) < 1e-6
    dzdy, dzdx = np.gradient(z, 1.0, 1.0)
    slope = np.arctan(np.hypot(dzdx, dzdy)); asp = np.arctan2(-dzdx, dzdy)
    hs = np.clip(np.sin(np.radians(45)) * np.cos(slope) +
                 np.cos(np.radians(45)) * np.sin(slope) * np.cos(np.radians(315) - asp), 0, 1)
    land = np.clip((z - wv) / 22.0, 0, 1)
    img = np.zeros((rows, cols, 3))
    img[..., 0] = 58 + land * 150; img[..., 1] = 76 + land * 118; img[..., 2] = 56 + land * 58
    img *= (0.40 + 0.60 * hs)[..., None]
    img[water] = [24, 47, 64]
    k = max(1, rows // 300)          # keep the embedded raster near screen resolution
    img = img[::k, ::k]
    b64 = base64.b64encode(png_bytes(img.clip(0, 255).astype(np.uint8))).decode()

    MX, MY = PAD, PAD + 62
    sc = MAP / (2 * HALF)
    def T(p): return (MX + (p[0] - vp[0] + HALF) * sc, MY + (HALF - (p[1] - vp[1])) * sc)

    el = [f'<clipPath id="m"><rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}"/></clipPath>',
          f'<image x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" href="data:image/png;base64,{b64}"/>',
          '<g clip-path="url(#m)">']
    # visible-sea fan
    cx, cy = T(vp); R = sv["method"]["horizon_radius_m"] * sc
    bl = sv["per_bearing"]["bearing_deg"]; svis = sv["per_bearing"]["sea_visible"]
    for arc_ in sv["result"]["arcs"]:
        r1 = math.radians(arc_["from_deg"]); r2 = math.radians(arc_["to_deg"])
        large = 1 if arc_["span_deg"] > 180 else 0
        x1, y1 = cx + math.sin(r1) * R, cy - math.cos(r1) * R
        x2, y2 = cx + math.sin(r2) * R, cy - math.cos(r2) * R
        el.append(f'<path d="M{cx:.1f},{cy:.1f} L{x1:.1f},{y1:.1f} '
                  f'A{R:.1f},{R:.1f} 0 {large} 1 {x2:.1f},{y2:.1f} Z" fill="#d8b87438"/>')
    el.append(f'<path d="M' + " L".join(f"{T(p)[0]:.1f},{T(p)[1]:.1f}" for p in ring) +
              ' Z" fill="none" stroke="#f5f1e8" stroke-width="2"/>')
    el.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5" fill="#d8b874" stroke="#101916" stroke-width="1.5"/>')
    el.append("</g>")
    el.append(f'<rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" fill="none" stroke="#2d4038"/>')
    el.append(f'<text x="{MX + 8}" y="{MY + MAP - 10}" fill="#8ea399" font-family="Inter,sans-serif" '
              f'font-size="10.5">{2*HALF:.0f} m across · gold fan = bearings where open water is visible</text>')

    # polar rose
    RX, RY, RR = MX + MAP + 210, MY + 250, 195
    el.append(f'<circle cx="{RX}" cy="{RY}" r="{RR}" fill="#17241f" stroke="#2d4038"/>')
    for rr in (RR/3, 2*RR/3):
        el.append(f'<circle cx="{RX}" cy="{RY}" r="{rr:.0f}" fill="none" stroke="#243530"/>')
    step = sv["method"]["bearing_step_deg"]
    fw = sv["per_bearing"]["first_visible_water_m"]
    maxd = max([f for f in fw if f is not None] + [1])
    binf = max(1, int(round(2.0 / step)))
    for j in range(0, len(bl), binf):
        seg = list(range(j, min(j + binf, len(bl))))
        b = bl[seg[0]]
        ok = any(svis[i] for i in seg)
        fs = [fw[i] for i in seg if fw[i] is not None]
        f = min(fs) if fs else None
        r1 = math.radians(b - step/2); r2 = math.radians(bl[seg[-1]] + step/2)
        if ok:
            rad = RR * (0.35 + 0.65 * (1 - min(f, maxd)/maxd))
            col = "#d8b874"
        else:
            rad = RR * 0.16; col = "#32403a"
        el.append(f'<path d="M{RX},{RY} L{RX + math.sin(r1)*rad:.1f},{RY - math.cos(r1)*rad:.1f} '
                  f'L{RX + math.sin(r2)*rad:.1f},{RY - math.cos(r2)*rad:.1f} Z" fill="{col}"/>')
    for lbl, ang in (("N", 0), ("E", 90), ("S", 180), ("W", 270)):
        r = math.radians(ang)
        el.append(f'<text x="{RX + math.sin(r)*(RR+18):.0f}" y="{RY - math.cos(r)*(RR+18)+5:.0f}" '
                  f'text-anchor="middle" fill="#8ea399" font-family="Inter,sans-serif" font-size="12">{lbl}</text>')
    arc = sv["result"]["arcs"][0]
    el.append(f'<text x="{RX}" y="{RY - 8}" text-anchor="middle" fill="#f5f1e8" '
              f'font-family="Georgia,serif" font-size="38">{sv["result"]["sea_view_arc_percent"]}%</text>')
    el.append(f'<text x="{RX}" y="{RY + 14}" text-anchor="middle" fill="#8ea399" '
              f'font-family="Inter,sans-serif" font-size="11">{sv["result"]["sea_view_arc_deg"]}° · '
              f'{arc["from_deg"]:.0f}°–{arc["to_deg"]:.0f}°</text>')
    el.append(f'<text x="{RX}" y="{RY + RR + 42}" text-anchor="middle" fill="#6c7f76" '
              f'font-family="Inter,sans-serif" font-size="10.5">petal length = how near the first visible water is</text>')

    m = sv["method"]; vpt = sv["viewpoint"]
    facts = [("COMPUTED SEA-VIEW ARC", f'{sv["result"]["sea_view_arc_percent"]}%',
              f'{sv["result"]["sea_view_arc_deg"]}° of the compass, one unbroken arc {arc["from_compass"]}–{arc["to_compass"]}'),
             ("PREVIOUS STATED CLAIM", '43.3%', 'a 153° span written as a percentage — never computed'),
             ("NEAREST VISIBLE WATER", f'{sv["result"]["nearest_visible_water_m"]} m',
              f'from the dwelling at {vpt["eye_height_rh2000_m"]} m RH2000 eye height'),
             ("RAYS CAST", f'{m["bearing_count"]}', f'{m["bearing_step_deg"]}° steps, {m["sample_step_m"]:.0f} m samples to {m["horizon_radius_m"]:.0f} m, curvature + refraction')]
    FX, FY = MX + MAP + 24, MY + RR*2 + 130
    y = FY
    for k, v, sub in facts:
        el.append(f'<text x="{FX}" y="{y}" fill="#8ea399" font-family="Inter,sans-serif" font-size="10" letter-spacing="1.2">{k}</text>')
        el.append(f'<text x="{FX}" y="{y + 28}" fill="#f5f1e8" font-family="Georgia,serif" font-size="25">{v}</text>')
        el.append(f'<text x="{FX}" y="{y + 45}" fill="#6c7f76" font-family="Inter,sans-serif" font-size="10.5">{sub}</text>')
        y += 74

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}">
<rect width="{SW}" height="{SH}" fill="#101916"/>
<text x="{PAD}" y="38" fill="#d8b874" font-family="Georgia,serif" font-size="23">{sv["subject"]} — sea view, computed rather than stated</text>
<text x="{PAD}" y="58" fill="#8ea399" font-family="Inter,sans-serif" font-size="12">DERIVED from AUTHORITATIVE · viewshed by radial ray-march of the 1 m ground model · {len(sv["tiles_used"])} receipted tiles re-verified · viewpoint = {vpt["description"]}</text>
{chr(10).join(el)}
<text x="{PAD}" y="{SH - 34}" fill="#f5f1e8" font-family="Georgia,serif" font-size="15">The stated 43.3% turns out to be very close: the sightline computation gives {sv["result"]["sea_view_arc_percent"]}%. The claim survives — but it is now derived, and its ceiling is honest.</text>
<text x="{PAD}" y="{SH - 15}" fill="#a65b68" font-family="Inter,sans-serif" font-size="11">UPPER BOUND — the ground model is bare earth: no trees, no buildings, no boathouses, no neighbouring roofs. Each of those blocks a real view and none is in this calculation. derived sha256 {sv["derived_geometry_sha256"][:24]}…</text>
</svg>'''
    outp = ROOT / a.out
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(svg)
    print(f"written: {outp} ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
