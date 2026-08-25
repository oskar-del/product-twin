#!/usr/bin/env python3
"""Assemble the MIMER sun-study one-pager (single PNG) from the derived parts."""
import json, os
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.gridspec import GridSpec

VAULT = "/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/02-Sun-and-Views"
sun = json.load(open(f"{VAULT}/sun-study.json"))
pv = json.load(open(f"{VAULT}/pvgis-yield.json"))

INK = "#1b2330"; GOLD = "#b8892f"; MUT = "#5b6472"
plt.rcParams["font.family"] = "DejaVu Sans"

fig = plt.figure(figsize=(11.7, 16.5))  # A3-ish portrait
fig.patch.set_facecolor("white")
gs = GridSpec(5, 2, figure=fig, height_ratios=[0.55, 2.0, 1.15, 1.5, 0.5],
              hspace=0.28, wspace=0.12, left=0.05, right=0.95, top=0.97, bottom=0.03)

# --- header
axh = fig.add_subplot(gs[0, :]); axh.axis("off")
axh.text(0, 0.72, "MIMER · Svärtinge 54:28", fontsize=25, weight="bold", color=INK)
axh.text(0, 0.34, "Sun study — what the light does on this plot", fontsize=14, color=GOLD)
axh.text(0, 0.02, "Norrköping · 58.65°N, 16.03°E · SW slope 14° · pin 69.8 m RH2000 · "
                  "derived from the real 1 m Lantmäteriet DEM", fontsize=9.5, color=MUT)

# --- sun path (left) + equinox shadow strip (right)
axp = fig.add_subplot(gs[1, 0]); axp.axis("off")
axp.imshow(mpimg.imread(f"{VAULT}/sun-path-polar.png"));
axs = fig.add_subplot(gs[1, 1]); axs.axis("off")
axs.imshow(mpimg.imread(f"{VAULT}/sun-shadows-equinox.png"))
axs.set_title("Terrain shadows · equinox 09/12/15/18h (see per-season sheets)", fontsize=8.5, color=MUT)

# --- sun angle table + terrace box
axt = fig.add_subplot(gs[2, 0]); axt.axis("off")
axt.text(0, 1.0, "Sun angles (azimuth° / altitude°)", fontsize=12, weight="bold", color=INK)
rows = [["", "09h", "12h", "15h", "18h"]]
label = {"summer-solstice":"21 Jun","equinox":"22 Sep","winter-solstice":"21 Dec"}
for k in ["summer-solstice","equinox","winter-solstice"]:
    r=[label[k]]
    for h in ["9","12","15","18"]:
        a=sun["sun_positions"][k][h]
        r.append(f"{a['az']:.0f}/{a['alt']:.0f}" if a['alt']>0 else "—")
    rows.append(r)
tb = axt.table(cellText=rows, loc="center", cellLoc="center", bbox=[0,0.12,1,0.72])
tb.auto_set_font_size(False); tb.set_fontsize(9.5)
for (r,c),cell in tb.get_celld().items():
    cell.set_edgecolor("#dcdcdc")
    if r==0 or c==0: cell.set_text_props(weight="bold", color=INK)
axt.text(0,0.02,"'—' = sun below horizon.  Summer noon 53° · winter noon only 8°.",
         fontsize=8, color=MUT)

axr = fig.add_subplot(gs[2, 1]); axr.axis("off")
axr.add_patch(plt.Rectangle((0,0),1,1, transform=axr.transAxes, facecolor="#faf6ec", edgecolor=GOLD, lw=1.4))
axr.text(0.05,0.88,"Best terrace orientation", fontsize=12, weight="bold", color=GOLD, transform=axr.transAxes)
rec = sun["terrace_recommendation"]
axr.text(0.05,0.72,rec["orientation"], fontsize=11, weight="bold", color=INK, transform=axr.transAxes)
import textwrap
axr.text(0.05,0.60,"\n".join(textwrap.wrap(rec["why"],52)), fontsize=8.4, color=INK,
         va="top", transform=axr.transAxes)
axr.text(0.05,0.13,"Avoid: "+ "\n".join(textwrap.wrap(rec["avoid"],48)), fontsize=8,
         color="#8a3b2f", va="top", transform=axr.transAxes)

# --- PVGIS chart + yield table
axpv = fig.add_subplot(gs[3, 0]); axpv.axis("off")
axpv.imshow(mpimg.imread(f"{VAULT}/pvgis-monthly.png"))

axy = fig.add_subplot(gs[3, 1]); axy.axis("off")
axy.text(0,1.0,"Solar yield by roof plane (PVGIS v5.2)", fontsize=12, weight="bold", color=INK)
yr=[["Roof plane","kWh/kWp·yr"]]
for p in pv["planes"]:
    yr.append([p["plane"], f"{p['E_y_kWh_per_kWp']:.0f}"])
ty = axy.table(cellText=yr, loc="center", cellLoc="left", bbox=[0,0.28,1,0.62])
ty.auto_set_font_size(False); ty.set_fontsize(9.3)
for (r,c),cell in ty.get_celld().items():
    cell.set_edgecolor("#dcdcdc")
    if r==0: cell.set_text_props(weight="bold", color="white"); cell.set_facecolor(INK)
sx = pv["sizing_example"]
axy.text(0,0.20,f"Facing the Glan view (SW 40°) keeps ~97% of the south-optimal yield.",
         fontsize=8.6, color=GOLD, weight="bold")
axy.text(0,0.10,f"Example: {sx['assumed_kWp']} kWp on '{sx['plane']}' ≈ {sx['annual_kWh']:,} kWh/yr.",
         fontsize=8.6, color=INK)

# --- footer / evidence class
axf = fig.add_subplot(gs[4, :]); axf.axis("off")
axf.add_patch(plt.Rectangle((0,0.35),1,0.6, transform=axf.transAxes, facecolor="#f2f3f5", edgecolor="none"))
axf.text(0.02,0.62,"EVIDENCE CLASS", fontsize=8, weight="bold", color=MUT, transform=axf.transAxes)
axf.text(0.02,0.40,
    "Terrain shadows & sun angles: DERIVED from the real 1 m Lantmäteriet DEM (RH2000) — bare earth only, "
    "no buildings or trees; GATE_SE_TERRAIN open → provisional, not official terrain.   "
    "PV yield: EXTERNAL MODEL (JRC PVGIS v5.2 / SARAH2); roof planes are CONCEPT, not a built roof.   "
    "On-plot tree shading NOT yet surveyed.",
    fontsize=7.6, color=INK, va="top", transform=axf.transAxes, wrap=True)

out = f"{VAULT}/sun-study-sheet.png"
fig.savefig(out, dpi=130, facecolor="white"); plt.close(fig)
print("wrote", out)
