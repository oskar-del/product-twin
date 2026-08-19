#!/usr/bin/env python3
"""
MIMER · Svärtinge 54:28 — annotated site plan (Mission step 2).
Buildable-envelope CONCEPT over the real 1 m DEM, read against the 1936
avstyckningsplan signals (one dwelling, 1:12 max road grade, roadside drainage,
water-before-build) + slope + Säterdalsvägen access + schematic VA point.

Evidence classes: terrain/contours DERIVED (bare-earth, GATE_SE_TERRAIN open);
boundary = INDICATIVE municipal trace (not surveyed); envelope/VA = CONCEPT;
1936 signals = HISTORIC (material, not present entitlement); road = OSM REFERENCE.
"""
import json, glob, os, textwrap
import numpy as np
import rasterio
from rasterio.merge import merge
from pyproj import Transformer
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon, FancyArrow
from matplotlib.lines import Line2D
from shapely.geometry import Polygon as ShpPoly, Point

ROOT = "/Users/oskarpeterson/Documents/AI/product twin"
DEM_DIR = f"{ROOT}/repo/.runtime/lantmateriet/terrain"
VAULT = "/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/01-Site-Intelligence"
os.makedirs(VAULT, exist_ok=True)

PIN_EN = (559869.0, 6501790.31)
CORNERS = [(559841.42,6501771.29,65.55),(559894.67,6501774.14,69.0),
           (559898.48,6501806.48,79.48),(559846.18,6501812.18,75.72)]  # SW,SE,NE,NW
RADIUS = 95
SETBACK = 4.5   # m — Swedish default clearance to boundary outside detaljplan (concept)

INK="#1b2330"; GOLD="#b8892f"; BLUE="#2f6fb0"; GREEN="#3c7d4e"; RED="#a23b2f"; MUT="#5b6472"

def load():
    srcs=[rasterio.open(f) for f in sorted(glob.glob(f"{DEM_DIR}/*.tif"))]
    m,tr=merge(srcs,bounds=(PIN_EN[0]-RADIUS,PIN_EN[1]-RADIUS,PIN_EN[0]+RADIUS,PIN_EN[1]+RADIUS))
    for s in srcs: s.close()
    z=m[0].astype("float64"); z[z<-1000]=np.nan
    return z,tr

def en2px(tr,e,n):
    c,r=~tr*(e,n); return c,r

def slope_deg(z,res=1.0):
    gy,gx=np.gradient(z,res,res)
    return np.degrees(np.arctan(np.hypot(gx,gy)))

def smooth(a,k=3):
    from scipy.ndimage import uniform_filter
    return uniform_filter(a,size=k,mode="nearest")

def main():
    z,tr=load(); H,W=z.shape
    z=smooth(z,3)
    slope=smooth(slope_deg(z),3)
    T=Transformer.from_crs(4326,3006,always_xy=True)
    osm=json.load(open("/tmp/mimer_osm.json"))

    fig,ax=plt.subplots(figsize=(13.5,13.5))
    # slope shading (green=gentle -> red=steep)
    ax.imshow(slope,cmap="RdYlGn_r",vmin=0,vmax=25,alpha=0.55)
    # contours every 1 m, index every 5 m
    ys,xs=np.mgrid[0:H,0:W]
    cs=ax.contour(xs,ys,z,levels=np.arange(np.floor(np.nanmin(z)),np.nanmax(z),1),
                  colors="#5b6472",linewidths=0.5,alpha=0.7)
    cs5=ax.contour(xs,ys,z,levels=np.arange(np.floor(np.nanmin(z)/5)*5,np.nanmax(z),5),
                   colors=INK,linewidths=1.1)
    ax.clabel(cs5,fmt="%.0f",fontsize=8,inline=True)

    # ---- plot boundary + corners
    cpx=[en2px(tr,e,n) for e,n,_ in CORNERS]
    ax.add_patch(MplPolygon(cpx,closed=True,fill=False,edgecolor=GOLD,lw=3,zorder=6))
    for (e,n,zc),(px,py) in zip(CORNERS,cpx):
        ax.plot(px,py,"o",color=GOLD,ms=6,zorder=7)
        ax.annotate(f"{zc:.1f}",(px,py),textcoords="offset points",xytext=(6,6),
                    fontsize=9,weight="bold",color=INK,zorder=8)
    ppx=en2px(tr,*PIN_EN)
    ax.plot(*ppx,marker="*",ms=16,color=GOLD,markeredgecolor=INK,zorder=8)

    # ---- developable area = boundary inset by SETBACK (dashed) ; within it the
    #      preferred building shelf = largest contiguous slope<12deg patch.
    shp=ShpPoly([(e,n) for e,n,_ in CORNERS])
    inset=shp.buffer(-SETBACK)
    ipx=[en2px(tr,e,n) for e,n in inset.exterior.coords]
    ax.add_patch(MplPolygon(ipx,closed=True,fill=False,edgecolor=GREEN,lw=1.8,
                            ls=(0,(5,4)),zorder=5))
    ax.annotate(f"developable (−{SETBACK:.1f} m setback)",en2px(tr,*inset.exterior.coords[0]),
                textcoords="offset points",xytext=(4,-12),fontsize=8,color=GREEN,zorder=8)
    env_pts=[]
    minx,miny,maxx,maxy=inset.bounds
    for e in np.arange(minx,maxx,1.2):
        for n in np.arange(miny,maxy,1.2):
            if inset.contains(Point(e,n)):
                c,r=en2px(tr,e,n)
                if 0<=int(r)<H and 0<=int(c)<W and slope[int(r),int(c)]<12:
                    env_pts.append((e,n))
    if env_pts:
        from shapely.geometry import MultiPoint
        env=MultiPoint(env_pts).buffer(2.2).buffer(-2.2)
        polys=[env] if env.geom_type=="Polygon" else list(env.geoms)
        big=max(polys,key=lambda p:p.area)
        xy=[en2px(tr,e,n) for e,n in big.exterior.coords]
        ax.add_patch(MplPolygon(xy,closed=True,facecolor="#7fb08a",edgecolor=GREEN,
                                lw=2.4,alpha=0.5,zorder=6))
        ec=big.centroid; ecx,ecy=en2px(tr,ec.x,ec.y)
        ax.annotate("PREFERRED\nBUILDING SHELF\n(slope<12°, concept)",(ecx,ecy),ha="center",
                    va="center",fontsize=9.5,weight="bold",color="#245a33",zorder=9)
        print("shelf area ~%.0f m2 (largest slope<12deg patch inside %.1fm setback)"%(big.area,SETBACK))

    # ---- Säterdalsvägen + access
    for r in osm["roads"]:
        if "terdal" in (r["name"] or ""):
            en=[T.transform(lo,la) for lo,la in r["coords"]]
            px=[en2px(tr,e,n) for e,n in en]
            xs2=[p[0] for p in px]; ys2=[p[1] for p in px]
            ax.plot(xs2,ys2,color="#333",lw=5,alpha=0.85,zorder=4,solid_capstyle="round")
            ax.plot(xs2,ys2,color="white",lw=1,ls=(0,(6,6)),zorder=4)
    ax.annotate("Säterdalsvägen",en2px(tr,559820,6501748),fontsize=10,weight="bold",
                color="#222",rotation=25,zorder=8)
    # access point = SW low corner meets road
    acc=en2px(tr,559840,6501768)
    ax.annotate("ACCESS / driveway\n(enter low, ≤1:12 grade)",acc,textcoords="offset points",
                xytext=(-140,-30),fontsize=9.5,weight="bold",color=BLUE,
                arrowprops=dict(arrowstyle="->",color=BLUE,lw=2),zorder=9)
    # VA connection schematic (at road, SW low corner)
    va=en2px(tr,559836,6501764)
    ax.plot(*va,marker="s",ms=11,color=BLUE,markeredgecolor="white",zorder=9)
    ax.annotate("VA point (schematic)\ngravity fall house→road ✓",va,textcoords="offset points",
                xytext=(10,-46),fontsize=9,color=BLUE,weight="bold",zorder=9)

    # ---- slope / view / sun direction arrow (downslope SW toward Glan)
    a0=en2px(tr,559880,6501800); a1=en2px(tr,559858,6501776)
    ax.annotate("",a1,a0,arrowprops=dict(arrowstyle="-|>",color=GOLD,lw=3),zorder=8)
    ax.annotate("fall + view + sun → SW",en2px(tr,559864,6501802),fontsize=9.5,
                weight="bold",color=GOLD,rotation=42,zorder=9)

    ax.set_xlim(0,W); ax.set_ylim(H,0); ax.set_xticks([]); ax.set_yticks([])
    ax.set_title("MIMER · Svärtinge 54:28 — annotated site plan   ·   ~1,938 m² (indicative)",
                 fontsize=15,weight="bold",color=INK,pad=12)

    # legend
    leg=[Line2D([0],[0],color=GOLD,lw=3,label="Plot boundary (indicative trace — not surveyed)"),
         MplPolygon([(0,0)],facecolor="#7fb08a",edgecolor=GREEN,alpha=0.5,label="Preferred building shelf, slope<12° (CONCEPT)"),
         Line2D([0],[0],color=GREEN,lw=1.8,ls=(0,(5,4)),label="Developable area (−4.5 m setback)"),
         Line2D([0],[0],color=INK,lw=1.1,label="Contour 5 m (DERIVED, 1 m DEM)"),
         Line2D([0],[0],color="#333",lw=4,label="Säterdalsvägen (OSM reference)"),
         Line2D([0],[0],marker="s",color="w",markerfacecolor=BLUE,ms=10,label="Access + VA point (schematic)"),
         Line2D([0],[0],marker="*",color="w",markerfacecolor=GOLD,markeredgecolor=INK,ms=13,label="Listing pin 69.8 m")]
    ax.legend(handles=leg,loc="upper left",fontsize=8.5,framealpha=0.92)

    # 1936-plan signal box
    sig=("1936 avstyckningsplan 0581K-22D:1008 (HISTORIC signals — not present entitlement):\n"
         "• one dwelling house per plot   • max road gradient 1:12   • 40 m high-voltage corridor (verify location)\n"
         "• open roadside drainage   • water provided before sale/construction.  Ground: Isälvssediment (esker) →\n"
         "favourable stormwater infiltration, but verify. Envelope, VA & driveway grade are CONCEPT pending survey.\n"
         "Design read: gentle ground is a narrow shelf near the 70 m contour → a terraced / along-contour house "
         "(long axis NW–SE, living stepping down SW) fits the land; a slab across the fall would need heavy cut/fill.")
    ax.text(0.5,-0.02,sig,transform=ax.transAxes,ha="center",va="top",fontsize=8.4,
            color=INK,bbox=dict(boxstyle="round,pad=0.5",facecolor="#faf6ec",edgecolor=GOLD))

    out=f"{VAULT}/svartinge-site-plan.png"
    fig.savefig(out,dpi=130,bbox_inches="tight",facecolor="white"); plt.close(fig)
    print("wrote",out)

if __name__=="__main__":
    main()
