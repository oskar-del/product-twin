#!/usr/bin/env python3
"""
MIMER · Svärtinge 54:28 — house concept (Mission step 3).
Typology: Swedish SLUTTNINGSHUS / souterräng 1.5-plan, long axis along the
contour (NW–SE), cut against the NE bank, opening SW to the measured Glan view
+ sun. Deliverables (vault 04-House-Design/):
  - concept-section.png     real fall-line section w/ stepped house
  - concept-massing.png     massing on the real 1 m DEM
  - concept-plans.png       lower + upper level schematic plans
  - house-concept-sheet.png assembled one-pager
All house geometry = CONCEPT; terrain = DERIVED (GATE_SE_TERRAIN open).
"""
import glob, os, math, textwrap
import numpy as np, rasterio
from rasterio.merge import merge
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as P2, Rectangle, FancyArrowPatch
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from scipy.ndimage import uniform_filter

ROOT="/Users/oskarpeterson/Documents/AI/product twin"
DEM=f"{ROOT}/repo/.runtime/lantmateriet/terrain"
VAULT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/04-House-Design"
os.makedirs(VAULT,exist_ok=True)
PIN=(559869.0,6501790.31)
INK="#1b2330"; GOLD="#b8892f"; BLUE="#2f6fb0"; GREEN="#3c7d4e"; GLASS="#8fb8d8"; WALL="#d9cbb2"; ROOF="#5b6472"; MUT="#5b6472"
plt.rcParams["font.family"]="DejaVu Sans"

# ---- concept level datums (CONCEPT, m RH2000) ----
FF_LOWER=66.8; FF_UPPER=69.7; TERRACE=66.3; WALL_H=2.7; ROOF_RISE=2.0
AZ_FALL=207  # downslope SW

def load(rad):
    srcs=[rasterio.open(f) for f in sorted(glob.glob(DEM+"/*.tif"))]
    m,tr=merge(srcs,bounds=(PIN[0]-rad,PIN[1]-rad,PIN[0]+rad,PIN[1]+rad))
    for s in srcs: s.close()
    return m[0].astype(float),tr

def sample(z,tr,e,n):
    c,r=~tr*(e,n); return z[int(round(r)),int(round(c))]

# ============================================================ SECTION
def section():
    z,tr=load(140)
    dxf=math.sin(math.radians(AZ_FALL)); dyf=math.cos(math.radians(AZ_FALL))
    ds=np.arange(-45,86)
    prof=np.array([sample(z,tr,PIN[0]+dxf*d,PIN[1]+dyf*d) for d in ds])
    fig,ax=plt.subplots(figsize=(13,6.2))
    ax.plot(ds,prof,color="#7a6a4f",lw=2.4,zorder=3)
    ax.fill_between(ds,prof,prof.min()-3,color="#e9dec6",zorder=2)
    # house on shelf d≈3..19 (along fall = building WIDTH SW..NE)
    d_ne, d_sw = 3, 19               # NE(back) .. SW(front)
    # upper box (full width) + lower souterräng walking out SW
    ax.add_patch(Rectangle((d_ne,FF_UPPER),(d_sw-d_ne),WALL_H,facecolor=WALL,edgecolor=INK,lw=1.6,zorder=5))
    ax.add_patch(Rectangle((d_ne,FF_LOWER),(d_sw-d_ne),FF_UPPER-FF_LOWER,facecolor="#efe7d6",edgecolor=INK,lw=1.4,zorder=5))
    # mono-pitch roof high NE -> low SW (roof plane faces SW for PV)
    roof=[(d_ne,FF_UPPER+WALL_H+ROOF_RISE),(d_sw,FF_UPPER+WALL_H),
          (d_sw,FF_UPPER+WALL_H-0.25),(d_ne,FF_UPPER+WALL_H+ROOF_RISE-0.25)]
    ax.add_patch(P2(roof,closed=True,facecolor=ROOF,edgecolor=INK,lw=1.4,zorder=6))
    # PV strip on SW roof
    ax.plot([d_ne+3,d_sw-1],[FF_UPPER+WALL_H+ROOF_RISE-0.9,FF_UPPER+WALL_H-0.2],color="#243b66",lw=4,zorder=7)
    ax.annotate("PV (SW roof · ~912 kWh/kWp)",(d_sw-9,FF_UPPER+WALL_H+1.4),fontsize=8.5,color="#243b66",weight="bold")
    # SW glass facade (two storeys of view)
    ax.plot([d_sw,d_sw],[FF_LOWER,FF_UPPER+WALL_H],color=GLASS,lw=6,zorder=6)
    ax.annotate("SW view wall\n(2 storeys glass →\nGlan + sun)",(d_sw+1.5,FF_LOWER+2.0),fontsize=8.6,color=BLUE,weight="bold")
    # terrace walk-out SW at lower FF
    ax.add_patch(Rectangle((d_sw,TERRACE-0.15),7,0.3,facecolor="#b9a77f",edgecolor=INK,lw=1,zorder=5))
    ax.annotate("terrace",(d_sw+3,TERRACE+0.4),fontsize=8.5,color="#7a6a4f",ha="center")
    # NE entry at grade (drive climbs to upper level) — cut against bank
    ax.annotate("entry / carport\nat NE grade",(d_ne-1,FF_UPPER+0.5),fontsize=8.6,color=GREEN,weight="bold",ha="right")
    ax.annotate("cut against\nNE bank",(d_ne-8,74.5),fontsize=8.5,color="#8a5a2f",ha="center")
    ax.annotate("",(d_ne,FF_UPPER+WALL_H+2.4),(d_ne-9,77.8),arrowprops=dict(arrowstyle="->",color="#8a5a2f",lw=1.6))
    # road + VA
    ri=np.argmin(abs(ds-26))
    ax.annotate("Säterdalsvägen\n+ VA (gravity fall ✓)",(26,prof[ri]-2.2),fontsize=8.6,color=BLUE,ha="center",weight="bold")
    ax.plot(26,prof[ri],"s",color=BLUE,ms=9,zorder=6)
    # level labels
    for y,l in [(FF_UPPER,"upper FF ≈ 69.7"),(FF_LOWER,"lower FF ≈ 66.8")]:
        ax.axhline(y,color="#aaa",lw=0.7,ls=":",zorder=1); ax.annotate(l,(-44,y+0.15),fontsize=7.5,color=MUT)
    ax.set_xlabel("distance along fall line — NE (upslope) ←→ SW (downslope, view+sun)  [m]",fontsize=9)
    ax.set_ylabel("elevation RH2000 [m]"); ax.set_ylim(prof.min()-3,84); ax.set_xlim(-46,86)
    ax.set_title("MIMER · Svärtinge 54:28 — concept section on the real fall line (souterräng 1.5-plan)\n"
                 "terrain DERIVED (1 m DEM, GATE_SE_TERRAIN open) · house geometry CONCEPT",fontsize=11.5)
    ax.grid(alpha=0.25); fig.tight_layout()
    out=f"{VAULT}/concept-section.png"; fig.savefig(out,dpi=130); plt.close(fig); print("wrote",out)

# ============================================================ MASSING 3D
def massing():
    rad=70; z,tr=load(rad); z=uniform_filter(z,3)
    H,W=z.shape
    # local grid (E,N from pin)
    xs=np.linspace(-rad,rad,W); ys=np.linspace(rad,-rad,H)  # row0 = north+
    X,Y=np.meshgrid(xs,ys)
    fig=plt.figure(figsize=(12,9)); ax=fig.add_subplot(111,projection="3d")
    ax.plot_surface(X,Y,z,cmap="terrain",alpha=0.32,linewidth=0,antialiased=True,
                    rcount=100,ccount=100,vmin=np.nanmin(z),vmax=np.nanmax(z))
    # house footprint centred downslope of pin
    C=np.array([math.sin(math.radians(AZ_FALL))*11,math.cos(math.radians(AZ_FALL))*11])  # E,N
    along=np.array([math.sin(math.radians(117)),math.cos(math.radians(117))]) # NW-SE contour
    across=np.array([math.sin(math.radians(207)),math.cos(math.radians(207))]) # SW fall
    L,Wd=8.0,5.0
    def corner(sL,sW): return C+sL*L*along+sW*Wd*across
    fp=[corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1)]  # 0,1=NE back ; 2,3=SW front
    # base on the local ground so the box perches on the shelf (clarity > burial)
    gmin=min(sample(z,tr,PIN[0]+p[0],PIN[1]+p[1]) for p in fp)
    base=gmin-0.3; topw=base+3.0+WALL_H
    hi=[topw+ROOF_RISE,topw+ROOF_RISE,topw,topw]  # NE high, SW low
    faces=[]
    for i in range(4):
        a=fp[i]; b=fp[(i+1)%4]
        faces.append(([(a[0],a[1],base),(b[0],b[1],base),(b[0],b[1],hi[(i+1)%4]),(a[0],a[1],hi[i])],WALL))
    # SW front face highlighted as glass
    faces[2]=([(fp[2][0],fp[2][1],base),(fp[3][0],fp[3][1],base),
               (fp[3][0],fp[3][1],hi[3]),(fp[2][0],fp[2][1],hi[2])],GLASS)
    roof=[(fp[i][0],fp[i][1],hi[i]) for i in range(4)]
    for verts,fc in faces:
        ax.add_collection3d(Poly3DCollection([verts],facecolor=fc,edgecolor=INK,lw=1.4,alpha=1.0))
    ax.add_collection3d(Poly3DCollection([roof],facecolor=ROOF,edgecolor=INK,lw=1.4,alpha=1.0))
    # SW view arrow (above roof, pointing downslope SW)
    a0=C+across*Wd; a1=C+across*(Wd+20)
    ax.quiver(a0[0],a0[1],topw+2,(a1-a0)[0],(a1-a0)[1],-7,color=GOLD,lw=3.5,arrow_length_ratio=0.2)
    ax.text(a1[0]-4,a1[1]-2,topw-2,"Glan view + sun (SW)",color="#8a6520",fontsize=11,weight="bold")
    ax.set_title("MIMER · Svärtinge 54:28 — concept massing on the real 1 m DEM (souterräng, facing SW)\n"
                 "terrain DERIVED · house CONCEPT",fontsize=11)
    ax.set_xlabel("E (m)"); ax.set_ylabel("N (m)"); ax.set_zlabel("elev (m)")
    ax.view_init(elev=26,azim=-118); ax.set_box_aspect((1,1,0.42))
    try: ax.set_zlim(z.min(),z.max()+6)
    except: pass
    out=f"{VAULT}/concept-massing.png"; fig.savefig(out,dpi=130,bbox_inches="tight"); plt.close(fig); print("wrote",out)

# ============================================================ FLOOR PLANS
def room(ax,x,y,w,h,label,fc="#f4efe4"):
    ax.add_patch(Rectangle((x,y),w,h,facecolor=fc,edgecolor=INK,lw=1.4))
    ax.annotate(label,(x+w/2,y+h/2),ha="center",va="center",fontsize=8.5,color=INK)

def plans():
    fig,axes=plt.subplots(1,2,figsize=(14,6.4))
    # geometry: footprint 15 (NW-SE, horizontal) x 9 (NE-SW, vertical). SW view = bottom.
    for ax,(title,rooms) in zip(axes,[
        ("LOWER LEVEL (souterräng) · FF ≈ 66.8 — walks out SW to terrace + view",
         [(0,0,9,5.4,"GREAT ROOM / KITCHEN\n(full-width SW glazing)","#eaf1f6"),
          (9,0,6,3.0,"MASTER\n+ SW view","#eaf1f6"),
          (9,3.0,6,2.4,"bath /\nwardrobe","#f4efe4"),
          (0,5.4,6,3.0,"entry hall /\nstair (from NE)","#f4efe4"),
          (6,5.4,3,3.0,"House Heart\n(services core)","#efe1c4"),
          (9,5.4,6,3.0,"carport /\nstore (NE grade)","#e5e5e5")]),
        ("UPPER LEVEL (1.5 / loft) · FF ≈ 69.7 — bedrooms + gallery over living",
         [(0,0,9,5.4,"GALLERY over great room\n+ SW balcony","#eaf1f6"),
          (9,0,6,2.7,"bed 2 · SW","#eaf1f6"),
          (9,2.7,6,2.7,"bed 3 · SW","#eaf1f6"),
          (0,5.4,5,3.0,"stair /\nlanding","#f4efe4"),
          (5,5.4,4,3.0,"study /\nbed 4","#f4efe4"),
          (9,5.4,6,3.0,"tech / PV inverter\n+ storage (NE)","#e5e5e5")]),
    ]):
        for r in rooms: room(ax,*r)
        # SW view arrow (bottom)
        ax.annotate("",(7.5,-1.4),(7.5,-0.1),arrowprops=dict(arrowstyle="-|>",color=GOLD,lw=3))
        ax.annotate("SW · Glan view + sun",(7.5,-1.9),ha="center",color=GOLD,fontsize=9,weight="bold")
        ax.annotate("NE · cut against bank / entry",(7.5,8.9),ha="center",color=GREEN,fontsize=8.5,weight="bold")
        ax.set_xlim(-1,16); ax.set_ylim(-2.6,9.4); ax.set_aspect("equal"); ax.axis("off")
        ax.set_title(title,fontsize=9.5,color=INK)
    fig.suptitle("MIMER · Svärtinge 54:28 — schematic floor plans (CONCEPT, not to scale for build)",fontsize=12)
    fig.tight_layout(rect=[0,0,1,0.95])
    out=f"{VAULT}/concept-plans.png"; fig.savefig(out,dpi=130); plt.close(fig); print("wrote",out)

# ============================================================ SHEET
def sheet():
    import matplotlib.image as mpimg
    from matplotlib.gridspec import GridSpec
    fig=plt.figure(figsize=(11.7,16.5)); fig.patch.set_facecolor("white")
    gs=GridSpec(4,2,figure=fig,height_ratios=[0.5,1.55,1.35,1.15],hspace=0.16,wspace=0.06,
                left=0.04,right=0.96,top=0.97,bottom=0.03)
    axh=fig.add_subplot(gs[0,:]); axh.axis("off")
    axh.text(0,0.7,"MIMER · Svärtinge 54:28",fontsize=24,weight="bold",color=INK)
    axh.text(0,0.34,"House concept — a sluttningshus that steps down to the view",fontsize=14,color=GOLD)
    axh.text(0,0.02,"Souterräng 1.5-plan · long axis along the contour (NW–SE) · cut against the NE bank · opens SW to Glan + sun",fontsize=9.5,color=MUT)
    axm=fig.add_subplot(gs[1,:]); axm.axis("off"); axm.imshow(mpimg.imread(f"{VAULT}/concept-massing.png"))
    axs=fig.add_subplot(gs[2,:]); axs.axis("off"); axs.imshow(mpimg.imread(f"{VAULT}/concept-section.png"))
    axp=fig.add_subplot(gs[3,0]); axp.axis("off"); axp.imshow(mpimg.imread(f"{VAULT}/concept-plans.png"))
    axt=fig.add_subplot(gs[3,1]); axt.axis("off")
    axt.text(0,1.0,"Why this typology",fontsize=12,weight="bold",color=INK)
    body=("The plot's gentle ground is a narrow shelf (~10°) with a steep bank (>25°) "
          "rising behind it to the NE. A flat slab would fight the fall (heavy cut/fill); "
          "a flat-roof box ignores both slope and view.\n\n"
          "A souterräng 1.5-plan is the land's own logic:\n"
          "• enter at NE grade off the climbing drive — cut lightly into the bank;\n"
          "• drop the main living to a lower level that walks out SW to a terrace at the view;\n"
          "• two storeys of SW glass face the measured Glan axis + midday-sunset sun;\n"
          "• mono-pitch roof falls SW → a clean PV plane (~912 kWh/kWp, ~97% of optimal);\n"
          "• foul water falls by gravity to the road main — no pump.\n\n"
          "Modern Swedish expression: clean volumes, standing-seam + timber, deep SW eave "
          "for summer shade (sun 53°) while low winter sun (8°) reaches deep inside.")
    axt.text(0,0.93,"\n".join(textwrap.wrap(body,50)).replace("\n \n","\n\n"),fontsize=8.4,va="top",color=INK)
    axt.text(0,-0.02,"CONCEPT — all house geometry is proposed, not engineered; terrain DERIVED, GATE_SE_TERRAIN open.",
             fontsize=7.4,color=MUT,va="top")
    out=f"{VAULT}/house-concept-sheet.png"; fig.savefig(out,dpi=130,facecolor="white"); plt.close(fig); print("wrote",out)

if __name__=="__main__":
    section(); massing(); plans(); sheet()
