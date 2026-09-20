#!/usr/bin/env python3
"""Render the official-building-footprint verification screen.

Usage: python3 scripts/render-buildings-screen.py   (run from the repo root)
"""
import json, sys
from pathlib import Path
site = Path("data/sites/sweden/djuro-byvag-34")
pd = json.loads((site/"property-division-derived-v0.1.json").read_text())
bd = json.loads((site/"buildings-official-derived-v0.1.json").read_text())
subject = pd["subject_rings_local"][0]
ctx = pd["context_rings_local"]

W,H,PAD = 1400, 980, 60
pts = [p for p in subject] + [p for b in bd["buildings"] for poly in b["rings_local"] for r in poly for p in r]
xs=[p[0] for p in pts]; zs=[p[1] for p in pts]
minx,maxx,minz,maxz = min(xs),max(xs),min(zs),max(zs)
s = min((W-2*PAD)/(maxx-minx), (H-2*PAD)/(maxz-minz))
cx,cz = (minx+maxx)/2,(minz+maxz)/2
def T(p): return (W/2+(p[0]-cx)*s, H/2-(p[1]-cz)*s)
def path(ring): return "M"+" L".join(f"{T(p)[0]:.1f},{T(p)[1]:.1f}" for p in ring)+" Z"

el=[]
for ring in ctx:
    el.append(f'<path d="{path(ring[0])}" fill="#1b2a24" stroke="#2d4038" stroke-width="1"/>')
el.append(f'<path d="{path(subject)}" fill="#176b5222" stroke="#176b52" stroke-width="2.5"/>')
for b in bd["buildings"]:
    on = b["placement"]=="ON_PARCEL"
    fill = "#d8b874" if on else "#3a4b43"
    stroke = "#f0dca8" if on else "#4c6056"
    for poly in b["rings_local"]:
        el.append(f'<path d="{path(poly[0])}" fill="{fill}" stroke="{stroke}" stroke-width="{1.6 if on else 0.9}"/>')
    if on:
        x,y = T(b["centroid_local"])
        el.append(f'<text x="{x:.0f}" y="{y-4:.0f}" text-anchor="middle" fill="#101916" font-family="Inter,sans-serif" font-size="12" font-weight="700">{b["footprint_area_m2"]:.1f} m²</text>')
        el.append(f'<text x="{x:.0f}" y="{y+10:.0f}" text-anchor="middle" fill="#2c3a32" font-family="Inter,sans-serif" font-size="10">{b["object_type"]}</text>')
c = bd["counts"]
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<rect width="{W}" height="{H}" fill="#101916"/>
{chr(10).join(el)}
<text x="{PAD}" y="42" fill="#d8b874" font-family="Georgia,serif" font-size="24">DJURÖ 4:147 — official building footprints (Lantmäteriet byggnad_kn0120)</text>
<text x="{PAD}" y="66" fill="#8ea399" font-family="Inter,sans-serif" font-size="13">AUTHORITATIVE · EPSG:3006 → LOCAL_ENU · clip {bd["clip_buffer_m"]:.0f} m · {c["within_clip_radius"]} footprints in clip · {c["on_parcel"]} on parcel · {bd["on_parcel_footprint_area_m2"]} m² total footprint on 5,156.3 m² parcel</text>
<text x="{PAD}" y="{H-42}" fill="#6c7f76" font-family="Inter,sans-serif" font-size="11">raw sha256 {bd["raw_asset"]["sha256"][:32]}…  ·  derived geom sha256 {bd["derived_geometry_sha256"][:32]}…</text>
<text x="{PAD}" y="{H-24}" fill="#6c7f76" font-family="Inter,sans-serif" font-size="11">gold = on parcel · grey = context within 200 m · green outline = registered property boundary · dark = neighbouring registered parcels</text>
</svg>'''
Path("docs/screens/djuro-01-buildings-official.svg").write_text(svg)
print("ok")
