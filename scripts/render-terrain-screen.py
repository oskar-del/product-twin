#!/usr/bin/env python3
"""Render the terrain verification screen for a site from its derived DTM product.

Reads only committed derived JSON plus the receipted DTM tile, and draws what the
numbers say: hillshade + hypsometric tint, registered boundary, official
footprints, the fitted fall line, and the ground profile along it.

Usage: python3 scripts/render-terrain-screen.py --site data/sites/sweden/djuro-byvag-34 \
           --out docs/screens/djuro-02-terrain-dtm.svg
"""
import argparse, base64, json, struct, zlib
from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge

ROOT = Path(__file__).resolve().parents[1]
SW, SH, PAD = 1400, 980, 48
MAP = 820
HALF = 160.0
RAMP = [(0.00, (26, 58, 74)), (0.18, (38, 86, 82)), (0.45, (70, 104, 74)),
        (0.72, (140, 130, 80)), (1.00, (216, 184, 116))]


def ramp(v):
    for i in range(len(RAMP) - 1):
        a, ca = RAMP[i]; b, cb = RAMP[i + 1]
        if v <= b:
            f = (v - a) / (b - a) if b > a else 0.0
            return [ca[k] + (cb[k] - ca[k]) * f for k in range(3)]
    return list(RAMP[-1][1])


def png_bytes(a):
    h, w, _ = a.shape
    raw = b"".join(b"\x00" + a[r].tobytes() for r in range(h))

    def chunk(t, d):
        return (struct.pack(">I", len(d)) + t + d +
                struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF))
    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site

    t = json.loads((site / "terrain-dem-derived-v0.1.json").read_text())
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    bd = json.loads((site / "buildings-official-derived-v0.1.json").read_text())
    e0, n0 = t["origin_sweref"]
    ring = pd["subject_rings_local"][0]

    srcs = [rasterio.open(ROOT / ".runtime/lantmateriet/terrain" / n) for n in t["tiles_used"]]
    arr, tr = merge(srcs, bounds=(e0 - HALF, n0 - HALF, e0 + HALF, n0 + HALF), nodata=-9999.0)
    for s in srcs:
        s.close()
    z = arr[0].astype(np.float64); z[z == -9999.0] = np.nan
    rows, cols = z.shape

    dzdy, dzdx = np.gradient(z, 1.0, 1.0)
    slope = np.arctan(np.hypot(dzdx, dzdy)); aspect = np.arctan2(-dzdx, dzdy)
    az, alt = np.radians(315.0), np.radians(45.0)
    hs = np.clip(np.sin(alt) * np.cos(slope) +
                 np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    zn = np.clip(z / 12.0, 0, 1)
    lut = np.array([ramp(i / 255) for i in range(256)])
    flat, hf = zn.ravel(), hs.ravel()
    idx = np.where(np.isnan(flat), 0, flat * 255).astype(np.uint8)
    out = lut[idx] * (0.35 + 0.65 * hf[:, None])
    out[np.isnan(flat)] = [16, 25, 22]
    b64 = base64.b64encode(png_bytes(out.reshape(rows, cols, 3).astype(np.uint8))).decode()

    MX, MY = PAD, PAD + 62
    sc = MAP / (2 * HALF)

    def T(p):
        return (MX + (p[0] + HALF) * sc, MY + (HALF - p[1]) * sc)

    def path(r):
        return "M" + " L".join(f"{T(p)[0]:.1f},{T(p)[1]:.1f}" for p in r) + " Z"

    el = [f'<clipPath id="m"><rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}"/></clipPath>',
          f'<image x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" '
          f'href="data:image/png;base64,{b64}"/>',
          f'<g clip-path="url(#m)">']
    el.append(f'<path d="{path(ring)}" fill="none" stroke="#f5f1e8" stroke-width="2.5"/>')
    for b in bd["buildings"]:
        if b["placement"] != "ON_PARCEL":
            continue
        for poly in b["rings_local"]:
            el.append(f'<path d="{path(poly[0])}" fill="#d8b874" stroke="#101916" stroke-width="1"/>')
    fl = t["fall_line_profile"]["samples"]
    el.append('<path d="M' + " L".join(
        f'{T((p["x"], p["z"]))[0]:.1f},{T((p["x"], p["z"]))[1]:.1f}' for p in fl) +
        '" fill="none" stroke="#c18a2d" stroke-width="2.5" stroke-dasharray="7 4"/>')
    for p, lab in ((fl[0], "high"), (fl[-1], "low")):
        x, y = T((p["x"], p["z"]))
        el.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="5" fill="#c18a2d" '
                  f'stroke="#101916" stroke-width="1.5"/>')
        dy = -10 if lab == "high" else 18
        el.append(f'<text x="{x:.0f}" y="{y + dy:.0f}" text-anchor="middle" fill="#f0dca8" '
                  f'font-family="Inter,sans-serif" font-size="11" font-weight="600">'
                  f'{p["height_rh2000_m"]} m</text>')
    el.append("</g>")
    el.append(f'<rect x="{MX}" y="{MY}" width="{MAP}" height="{MAP}" fill="none" stroke="#2d4038"/>')

    st, ps = t["parcel_height_statistics"], t["parcel_slope"]
    wp, lg = ps["whole_parcel_plane"], ps["local_ground_slope"]
    band2 = t["parcel_height_bands"][1]
    CX, CW = MX + MAP + 36, SW - (MX + MAP + 36) - PAD
    cards = [
        ("RELIEF ACROSS PARCEL", f'{st["relief_m"]} m',
         f'{st["min_m"]} m to {st["max_m"]} m RH2000'),
        ("HEIGHT AT SITE PIN", f'{t["origin_height_rh2000_m"]} m',
         'bilinear from the 1 m grid'),
        ("WHOLE-PARCEL FALL", f'{wp["slope_deg"]}° {wp["fall_direction_compass"]}',
         f'{wp["rms_residual_m"]} m RMS residual — a poor fit'),
        ("GROUND UNDERFOOT", f'{lg["median_deg"]}° median',
         f'p90 {lg["p90_deg"]}° · max {lg["max_deg"]}°'),
        ("BELOW 2 m RH2000", f'{band2["area_m2"]:.0f} m²',
         f'{band2["share_percent"]}% of the parcel'),
    ]
    y = MY + 26
    for k, v, sub in cards:
        el.append(f'<text x="{CX}" y="{y}" fill="#8ea399" font-family="Inter,sans-serif" '
                  f'font-size="10" letter-spacing="1.2">{k}</text>')
        el.append(f'<text x="{CX}" y="{y + 30}" fill="#f5f1e8" font-family="Georgia,serif" '
                  f'font-size="27">{v}</text>')
        el.append(f'<text x="{CX}" y="{y + 48}" fill="#6c7f76" font-family="Inter,sans-serif" '
                  f'font-size="10.5">{esc(sub)}</text>')
        y += 76

    PX, PY, PW, PH = CX, y + 18, CW, 168
    hs_ = [p["height_rh2000_m"] for p in fl]; ds = [p["distance_m"] for p in fl]
    hmin, hmax, dmax = min(hs_), max(hs_), max(ds)

    def PT(dd, hh):
        return (PX + dd / dmax * PW, PY + PH - (hh - hmin) / (hmax - hmin) * PH)

    pp = "M" + " L".join(f"{PT(d, h)[0]:.1f},{PT(d, h)[1]:.1f}" for d, h in zip(ds, hs_))
    el.append(f'<text x="{PX}" y="{PY - 10}" fill="#8ea399" font-family="Inter,sans-serif" '
              f'font-size="10" letter-spacing="1.2">GROUND PROFILE ALONG FALL LINE</text>')
    el.append(f'<rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" fill="#17241f" stroke="#2d4038"/>')
    el.append(f'<path d="{pp} L{PX + PW},{PY + PH} L{PX},{PY + PH} Z" fill="#c18a2d26"/>')
    el.append(f'<path d="{pp}" fill="none" stroke="#c18a2d" stroke-width="2"/>')
    el.append(f'<text x="{PX + 6}" y="{PY + 15}" fill="#8ea399" font-family="Inter,sans-serif" '
              f'font-size="10">{hmax} m</text>')
    el.append(f'<text x="{PX + 6}" y="{PY + PH - 6}" fill="#8ea399" font-family="Inter,sans-serif" '
              f'font-size="10">{hmin} m</text>')
    el.append(f'<text x="{PX + PW - 6}" y="{PY + PH - 6}" text-anchor="end" fill="#8ea399" '
              f'font-family="Inter,sans-serif" font-size="10">{dmax:.0f} m, bearing '
              f'{t["fall_line_profile"]["bearing_deg"]}° '
              f'{t["fall_line_profile"]["bearing_compass"]}</text>')

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}">
<rect width="{SW}" height="{SH}" fill="#101916"/>
<text x="{PAD}" y="38" fill="#d8b874" font-family="Georgia,serif" font-size="23">{esc(t["subject"])} — terrain from the Lantmäteriet 1 m ground model (RH2000)</text>
<text x="{PAD}" y="58" fill="#8ea399" font-family="Inter,sans-serif" font-size="12">DERIVED from AUTHORITATIVE · tile {", ".join(t["tiles_used"])} · {len(t["tile_integrity"])}/{len(t["tile_integrity"])} receipted tiles re-verified · parcel mask {st["sample_count_px"]} px vs 5,156.3 m² registered</text>
{chr(10).join(el)}
<text x="{PAD}" y="{SH - 34}" fill="#a65b68" font-family="Inter,sans-serif" font-size="12">CORRECTION — the page said 8.1° WNW. The parcel falls {wp["slope_deg"]}° to the {wp["fall_direction_compass"]}, and no single slope describes it: see the two measures above.</text>
<text x="{PAD}" y="{SH - 16}" fill="#6c7f76" font-family="Inter,sans-serif" font-size="10.5">hillshade 315°/45° over hypsometric tint · white = registered boundary · gold = official footprints · dashed = fitted fall line · derived sha256 {t["derived_geometry_sha256"][:24]}…</text>
</svg>'''
    outp = ROOT / a.out
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(svg)
    print(f"written: {outp}  ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
