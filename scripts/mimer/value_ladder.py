#!/usr/bin/env python3
"""MIMER · Svärtinge 54:28 — value ladder infographic (Mission step 5).
Each evidence block × what a Buyer / Bank / Architect would pay for. The left
spine shows the asset moving from raw plot -> de-risked project. Value claims are
evidence-derived (no invented valuations); figures trace to prior blocks."""
import os
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

VAULT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/06-Value-Ladder"
os.makedirs(VAULT,exist_ok=True)
INK="#1b2330"; GOLD="#b8892f"; MUT="#5b6472"
C_BUY="#2f7fb0"; C_BANK="#3c7d4e"; C_ARCH="#8a5a2f"

# rungs bottom->top (ascending asset maturity)
RUNGS=[
 ("01 · Site intelligence","raw plot → informed plot",
  "View & constraints are measured, not claimed — bid & buy informed.",
  "20 SHA-sourced receipts + honest open gates → cheap, trustable diligence.",
  "Real terrain + 1936 signals, HV corridor, groundwater → design from truth."),
 ("02 · Sun & views","informed → light-proven",
  "Glan view + light quantified (summer 53°, winter 8°); SW sun-terrace.",
  "Modelled PV ≈912 kWh/kWp → energy & running-cost story, green-loan angle.",
  "Exact sun angles + best orientation handed over — saves a shading study."),
 ("03 · Site plan","light-proven → development-ready",
  "Answers 'can I build here?' — buildable shelf, access, VA all work.",
  "Buildable envelope + access + servicing = the developable-value core.",
  "Slope + shelf + setback → footprint zone set, fewer massing iterations."),
 ("04 · House concept","development-ready → designed product",
  "Sees the actual home that fits the land — a product, not a vacant lot.",
  "Typology + GFA → an end-value (GDV) & build-cost basis for a loan.",
  "Souterräng decided from terrain + a room brief → a running start."),
 ("05 · Systems skeleton","designed → buildable & low-cost to run",
  "Gravity VA (no pump), bergvärme, FTX → low total cost of ownership.",
  "Energy strategy → energy class / green mortgage; servicing de-risked.",
  "Services routing + House Heart core → coordinated MEP, fewer clashes."),
]

fig,ax=plt.subplots(figsize=(13.2,15.2)); ax.axis("off")
ax.set_xlim(0,12); ax.set_ylim(0,15.4)
ax.text(0.2,15.0,"MIMER · Svärtinge 54:28 — Value ladder",fontsize=22,weight="bold",color=INK)
ax.text(0.2,14.5,"At each evidence block: what a buyer, a bank and an architect would pay for",fontsize=13,color=GOLD)
# column headers
cols=[(3.2,"BUYER",C_BUY),(6.6,"BANK / LENDER",C_BANK),(10.0,"ARCHITECT / BUILDER",C_ARCH)]
for x,t,c in cols:
    ax.text(x,13.95,t,ha="center",fontsize=11,weight="bold",color=c)
ax.text(0.9,13.95,"BLOCK",ha="center",fontsize=10,weight="bold",color=INK)

y=13.4; dy=2.42
for i,(title,spine,buy,bank,arch) in enumerate(RUNGS):
    yc=y-i*dy
    # spine label (left)
    ax.add_patch(FancyBboxPatch((0.15,yc-0.95),1.5,1.7,boxstyle="round,pad=0.04",
                 facecolor="#faf6ec",edgecolor=GOLD,lw=1.4))
    ax.text(0.9,yc+0.45,title.split(" · ")[0],ha="center",fontsize=11,weight="bold",color=GOLD)
    ax.text(0.9,yc-0.05,title.split(" · ")[1],ha="center",fontsize=7.3,color=INK,wrap=True)
    ax.text(0.9,yc-0.7,spine,ha="center",fontsize=6.6,style="italic",color=MUT,wrap=True)
    for (x,_,c),txt in zip(cols,[buy,bank,arch]):
        ax.add_patch(FancyBboxPatch((x-1.55,yc-0.95),3.1,1.7,boxstyle="round,pad=0.04",
                     facecolor="white",edgecolor=c,lw=1.5))
        import textwrap
        ax.text(x,yc,"\n".join(textwrap.wrap(txt,34)),ha="center",va="center",fontsize=7.9,color=INK)

# ascending value arrow on far left
ax.add_patch(FancyArrowPatch((0.05,y-4*dy-0.9),(0.05,y+0.9),arrowstyle="-|>",
             mutation_scale=22,color=GOLD,lw=3))
ax.text(-0.02,y-2*dy,"asset maturity → risk premium compresses",rotation=90,va="center",
        ha="right",fontsize=8.5,color=GOLD,weight="bold")

# footer: what unlocks the next tier
fy=y-4*dy-1.35
ax.add_patch(FancyBboxPatch((0.15,fy-0.75),11.7,1.15,boxstyle="round,pad=0.05",
             facecolor="#f2f3f5",edgecolor="none"))
ax.text(0.35,fy+0.22,"WHAT UNLOCKS THE NEXT VALUE TIER (open gates — honest):",fontsize=8.5,weight="bold",color=MUT)
ax.text(0.35,fy-0.28,"registered legal boundary & area · HV-corridor location · plot entitlement / current-plan interpretation · "
        "geotech + infiltration · VA connection confirmation.  Each closed gate converts a 'concept' claim into a priced, "
        "bankable fact.  Truth law: evidence-derived, terrain DERIVED (GATE_SE_TERRAIN open), house & systems CONCEPT.",
        fontsize=7.5,color=INK,va="top")

out=f"{VAULT}/value-ladder.png"
fig.savefig(out,dpi=130,bbox_inches="tight",facecolor="white"); plt.close(fig); print("wrote",out)
