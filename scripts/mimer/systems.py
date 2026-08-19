#!/usr/bin/env python3
"""
MIMER · Svärtinge 54:28 — systems skeleton / X-ray (Mission step 4).
Schematic building services read against the REAL fall-line terrain, hubbed on
the House Heart placed in step 3. Two panels + assembled sheet (05-Systems/):
  - systems-section.png   fall-vs-terrain X-ray (VA, stormwater, el, heat, FTX)
  - house-heart.png       House Heart hub-and-spoke schematic
  - systems-sheet.png     assembled one-pager
Truth law: every system is rulebook-backed pattern or CONCEPT-labeled. No exact
current-code clause is asserted as verified; rules-of-thumb are marked "typ.".
Terrain DERIVED (1 m DEM, GATE_SE_TERRAIN open); all services CONCEPT.
"""
import glob, os, math, textwrap
import numpy as np, rasterio
from rasterio.merge import merge
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch, Circle, FancyBboxPatch

ROOT="/Users/oskarpeterson/Documents/AI/product twin"
DEM=f"{ROOT}/repo/.runtime/lantmateriet/terrain"
VAULT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/05-Systems"
os.makedirs(VAULT,exist_ok=True)
PIN=(559869.0,6501790.31)
INK="#1b2330"; GOLD="#b8892f"; MUT="#5b6472"
C_WATER="#2f7fb0"; C_SEWER="#8a5a2f"; C_STORM="#3c7d4e"; C_EL="#c0392b"; C_HEAT="#a3562f"; C_VENT="#7d5ba6"; C_HEART="#b8892f"
FF_LOWER=66.8; FF_UPPER=69.7; TERRACE=66.3; WALL_H=2.7; ROOF_RISE=2.0; AZ=207

def load(rad):
    srcs=[rasterio.open(f) for f in sorted(glob.glob(DEM+"/*.tif"))]
    m,tr=merge(srcs,bounds=(PIN[0]-rad,PIN[1]-rad,PIN[0]+rad,PIN[1]+rad))
    for s in srcs:s.close()
    return m[0].astype(float),tr
def samp(z,tr,e,n):
    c,r=~tr*(e,n);return z[int(round(r)),int(round(c))]
def arrow(ax,p0,p1,c,lw=2.4,style="-|>"):
    ax.add_patch(FancyArrowPatch(p0,p1,arrowstyle=style,mutation_scale=14,color=c,lw=lw,zorder=9))

# ============================================================ SECTION X-RAY
def section():
    from matplotlib.lines import Line2D
    z,tr=load(140)
    dx=math.sin(math.radians(AZ));dy=math.cos(math.radians(AZ))
    ds=np.arange(-24,45)
    prof=np.array([samp(z,tr,PIN[0]+dx*d,PIN[1]+dy*d) for d in ds])
    fig,ax=plt.subplots(figsize=(13.5,7.4))
    ax.plot(ds,prof,color="#7a6a4f",lw=2.4,zorder=3)
    ax.fill_between(ds,prof,prof.min()-5,color="#ece3cd",zorder=2)
    d_ne,d_sw=3,19; top=FF_UPPER+WALL_H
    # house ghost + roof line
    ax.add_patch(Rectangle((d_ne,FF_LOWER),d_sw-d_ne,top-FF_LOWER,facecolor="#ffffff",
                 edgecolor="#b0a794",lw=1.3,alpha=0.6,zorder=4))
    ax.plot([d_ne,d_sw],[top+ROOF_RISE,top],color="#b0a794",lw=1.3,zorder=4)
    ax.text((d_ne+d_sw)/2,FF_UPPER+0.9,"upper 1.5 / loft",ha="center",fontsize=8,color="#9a9284",zorder=5)
    ax.text((d_ne+d_sw)/2,FF_LOWER+0.9,"living (souterräng)",ha="center",fontsize=8,color="#9a9284",zorder=5)
    hx,hy=10,FF_LOWER+1.1; road_d=26; ri=int(np.argmin(abs(ds-road_d))); road_z=prof[ri]
    # --- heat: borehole down (draw first, behind)
    arrow(ax,(hx,FF_LOWER-0.3),(hx,prof.min()-4.0),C_HEAT,lw=2.4)
    ax.text(hx+0.5,prof.min()-3.4,"bergvärme borehole",fontsize=8,color=C_HEAT,weight="bold",zorder=9)
    # --- PV strip + el up to HH
    ax.plot([d_ne+2.5,d_sw-1],[top+ROOF_RISE-0.7,top-0.15],color="#243b66",lw=5,zorder=7)
    arrow(ax,(d_ne+4,top+0.2),(hx+0.3,hy+0.7),"#243b66",lw=1.6,style="->")
    # --- FTX intake NE
    arrow(ax,(d_ne-4,FF_UPPER+1.4),(hx-0.7,hy+0.5),C_VENT,lw=1.7,style="->")
    ax.text(d_ne-11,FF_UPPER+1.7,"FTX intake (NE)",color=C_VENT,fontsize=8,weight="bold",zorder=9)
    # --- VA water in (road->HH) and gravity foul out (HH->main)
    arrow(ax,(road_d-0.6,road_z+0.2),(hx+0.9,hy+0.1),C_WATER,lw=2.2)
    arrow(ax,(hx-0.7,FF_LOWER-0.2),(road_d-0.4,road_z-1.4),C_SEWER,lw=2.6)
    ax.text(hx+1.0,64.4,"gravity foul  ·  fall ≈1:15  (≫ typ. min 1:100)",color=C_SEWER,fontsize=8.4,weight="bold",zorder=9)
    # --- stormwater to a distinct soakaway SW-downslope of house
    soak_d=22
    arrow(ax,(d_sw-0.5,top+ROOF_RISE-0.7),(soak_d,TERRACE-1.6),C_STORM,lw=2)
    ax.add_patch(Circle((soak_d,TERRACE-1.9),0.6,facecolor="none",edgecolor=C_STORM,lw=1.6,ls=(0,(2,2)),zorder=6))
    ax.text(soak_d+1.2,TERRACE-2.2,"soakaway (esker, permeable — verify)",color=C_STORM,fontsize=8,weight="bold",zorder=9)
    # road/VA main marker + House Heart on top
    ax.plot(road_d,road_z,"s",color=INK,ms=10,zorder=8)
    ax.text(road_d+0.8,road_z+0.2,"Säterdalsvägen · VA main + water meter",fontsize=8.2,color=INK,weight="bold",zorder=9)
    ax.add_patch(Circle((hx,hy),1.25,facecolor=C_HEART,edgecolor=INK,lw=1.6,zorder=10))
    ax.text(hx,hy,"HH",ha="center",va="center",fontsize=8.5,color="white",weight="bold",zorder=11)
    ax.text(hx,hy+1.9,"House Heart",ha="center",fontsize=8.2,color=C_HEART,weight="bold",zorder=11)
    leg=[Line2D([0],[0],color=C_WATER,lw=3,label="Water in (pressurised, from main)"),
         Line2D([0],[0],color=C_SEWER,lw=3,label="Foul sewer (gravity to main)"),
         Line2D([0],[0],color=C_STORM,lw=3,label="Stormwater → soakaway (separated)"),
         Line2D([0],[0],color="#243b66",lw=3,label="PV DC → inverter → panel"),
         Line2D([0],[0],color=C_EL,lw=3,label="El service in"),
         Line2D([0],[0],color=C_HEAT,lw=3,label="Ground-source heat (bergvärme)"),
         Line2D([0],[0],color=C_VENT,lw=3,label="FTX supply/extract (heat recovery)")]
    # el service in arrow
    arrow(ax,(road_d-0.4,road_z+0.4),(hx+1.0,hy-0.3),C_EL,lw=1.6,style="->")
    ax.legend(handles=leg,loc="upper right",fontsize=8.2,framealpha=0.95,title="services (CONCEPT)",title_fontsize=8.5)
    ax.set_xlabel("distance along fall line — NE (upslope) ←→ SW (downslope, view)  [m]",fontsize=9)
    ax.set_ylabel("elevation RH2000 [m]"); ax.set_ylim(prof.min()-5,80); ax.set_xlim(-24,44)
    ax.set_title("MIMER · Svärtinge 54:28 — systems X-ray on the real fall line   ·   CONCEPT services · terrain DERIVED",fontsize=11.5)
    ax.grid(alpha=0.2); fig.tight_layout()
    out=f"{VAULT}/systems-section.png"; fig.savefig(out,dpi=130); plt.close(fig); print("wrote",out)

# ============================================================ HOUSE HEART HUB
def heart():
    fig,ax=plt.subplots(figsize=(11,8)); ax.axis("off"); ax.set_xlim(0,10); ax.set_ylim(0,8)
    # central heart
    ax.add_patch(Circle((5,4),1.25,facecolor=C_HEART,edgecolor=INK,lw=2,zorder=5))
    ax.text(5,4.15,"HOUSE",ha="center",va="center",fontsize=12,color="white",weight="bold",zorder=6)
    ax.text(5,3.55,"HEART",ha="center",va="center",fontsize=12,color="white",weight="bold",zorder=6)
    ax.text(5,2.35,"services core · lower level",ha="center",fontsize=8,color=C_HEART,zorder=6)
    spokes=[
        (2.0,7.0,C_WATER,"VA / WATER","Incoming water + meter from road main;\nfoul out by gravity (fall ≈1:15 ≫ typ. 1:100)."),
        (5.0,7.0,C_EL,"ELECTRICITY","Grid service from Säterdalsvägen → main panel;\nPV inverter + battery-ready; EV point at carport."),
        (8.0,7.0,C_HEAT,"HEATING","Ground-source heat pump (bergvärme) + tank →\nhydronic underfloor; borehole permit-checked."),
        (8.0,1.0,C_VENT,"VENTILATION","Balanced FTX with heat recovery (typ. ≥75%);\nintake NE-shaded, extract wet rooms + kitchen."),
        (5.0,1.0,C_STORM,"STORMWATER","Roof → soakaway on permeable Isälvssediment,\nseparated from foul; infiltration to verify."),
        (2.0,1.0,"#555","SMART / METER","Sub-metering, leak + temp sensors, PV/heat-pump\ntelemetry — the digital-twin data feed."),
    ]
    for x,y,c,t,d in spokes:
        ax.add_patch(FancyBboxPatch((x-1.35,y-0.62),2.7,1.24,boxstyle="round,pad=0.06",
                     facecolor="white",edgecolor=c,lw=1.8,zorder=4))
        ax.text(x,y+0.34,t,ha="center",fontsize=9.2,color=c,weight="bold",zorder=6)
        ax.text(x,y-0.18,d,ha="center",va="center",fontsize=6.7,color=INK,zorder=6)
        ax.add_patch(FancyArrowPatch((5,4),(x,y),arrowstyle="-",color=c,lw=1.6,alpha=0.5,
                     connectionstyle="arc3,rad=0.0",zorder=2))
    ax.set_title("MIMER · Svärtinge 54:28 — House Heart: every service on one core  (CONCEPT)",fontsize=11.5)
    out=f"{VAULT}/house-heart.png"; fig.savefig(out,dpi=130,bbox_inches="tight"); plt.close(fig); print("wrote",out)

# ============================================================ SHEET
def sheet():
    import matplotlib.image as mpimg
    from matplotlib.gridspec import GridSpec
    fig=plt.figure(figsize=(11.7,15.5)); fig.patch.set_facecolor("white")
    gs=GridSpec(4,1,figure=fig,height_ratios=[0.42,1.5,1.35,0.5],hspace=0.14,left=0.04,right=0.96,top=0.97,bottom=0.03)
    axh=fig.add_subplot(gs[0]);axh.axis("off")
    axh.text(0,0.68,"MIMER · Svärtinge 54:28",fontsize=23,weight="bold",color=INK)
    axh.text(0,0.32,"Systems skeleton — the terrain does the work",fontsize=14,color=GOLD)
    axh.text(0,0.02,"Every service hubbed on the House Heart · water/foul by gravity · heat from the ground · air balanced with recovery",fontsize=9.3,color=MUT)
    for i,img in enumerate(["systems-section.png","house-heart.png"]):
        a=fig.add_subplot(gs[i+1]);a.axis("off");a.imshow(mpimg.imread(f"{VAULT}/{img}"))
    axf=fig.add_subplot(gs[3]);axf.axis("off")
    axf.add_patch(Rectangle((0,0.3),1,0.62,transform=axf.transAxes,facecolor="#f2f3f5",edgecolor="none"))
    axf.text(0.02,0.60,"TRUTH LAW",fontsize=8,weight="bold",color=MUT,transform=axf.transAxes)
    axf.text(0.02,0.40,
        "All services are CONCEPT (schematic intent, not engineered design). Terrain is DERIVED (1 m Lantmäteriet DEM, "
        "GATE_SE_TERRAIN open). Fall/slope figures are rules-of-thumb (\"typ.\") to be verified against BBR + the utility's "
        "connection data; the ground-source borehole and stormwater infiltration depend on geotech + the Övre Svärtinge "
        "groundwater-body permit. We propose + check; a licensed engineer stamps.",
        fontsize=7.6,color=INK,va="top",transform=axf.transAxes)
    out=f"{VAULT}/systems-sheet.png"; fig.savefig(out,dpi=130,facecolor="white"); plt.close(fig); print("wrote",out)

if __name__=="__main__":
    section(); heart(); sheet()
