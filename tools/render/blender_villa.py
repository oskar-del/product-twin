import bpy, json, math, sys
from mathutils import Vector
import numpy as np
argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else ["V1"]
VID=argv[0]
OL=json.load(open("/Users/oskarpeterson/Documents/AI/product twin/repo/data/sites/essence-moraira/scene/floorplans/villa-outlines.json"))
SPEC=json.load(open("/private/tmp/claude-501/-Users-oskarpeterson-Documents-AI/fa90304f-6600-463f-8146-eb8df80e98f1/scratchpad/villa_specs.json")) if False else None
rec=OL[VID]
bpy.ops.wm.read_factory_settings(use_empty=True)
def w2b(x,y,z): return (x, z, y)
def mat(name,rgb,rough=0.6,metal=0.0,trans=0.0,ior=1.45,bump=None):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
    def sv(k,v):
        if k in b.inputs: b.inputs[k].default_value=v
    sv("Base Color",(*rgb,1)); sv("Roughness",rough); sv("Metallic",metal)
    sv("Transmission Weight",trans); sv("Transmission",trans); sv("IOR",ior)
    if trans>0.5: sv("Roughness",0.02)
    if bump:
        nt=m.node_tree; tex=nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value=bump[0]
        bp=nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value=bump[1]
        nt.links.new(tex.outputs["Fac"],bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"],b.inputs["Normal"])
    return m
M={'stucco':mat('stucco',(0.80,0.72,0.58),0.55,bump=(12,0.10)),
   'white':mat('white',(0.90,0.86,0.78),0.5,bump=(12,0.07)),
   'stone':mat('stone',(0.74,0.66,0.52),0.8,bump=(20,0.25)),
   'wood':mat('wood',(0.55,0.38,0.22),0.55,bump=(30,0.2)),
   'glass':mat('glass',(0.06,0.09,0.11),0.02,0,1.0,1.45),
   'roof':mat('roof',(0.78,0.72,0.60),0.5,bump=(14,0.08)),
   'grass':mat('grass',(0.26,0.34,0.17),1.0,bump=(3,0.4)),
   'water':mat('water',(0.02,0.16,0.22),0.03,0,1.0,1.33),
   'sea':mat('sea',(0.04,0.13,0.20),0.12)}
def newmesh(name,verts,faces,material,smooth=False):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob); ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth=smooth
    return ob
# ---- orient building: long facade faces +X(sea/camera) ----
bpoly=np.array(rec['building']); c=bpoly.mean(0); bpoly=bpoly-c
padpoly=np.array(rec['pad'])-c
# PCA angle of building
u,s,vt=np.linalg.svd(bpoly-bpoly.mean(0))
ang=math.atan2(vt[0][1],vt[0][0])          # principal axis angle
rot=-ang                                    # rotate principal axis to X (long axis along X -> facade faces Y); we want facade to +X so add 90
rot=-ang+math.pi/2
ct,st=math.cos(rot),math.sin(rot)
def R(p): return (p[0]*ct-p[1]*st, p[0]*st+p[1]*ct)
def prism(poly,h0,h1,material,scale=1.0,name="p"):
    n=len(poly); verts=[]
    for p in poly:
        x,z=R([p[0]*scale,p[1]*scale]); verts.append(w2b(x,h0,z))
    for p in poly:
        x,z=R([p[0]*scale,p[1]*scale]); verts.append(w2b(x,h1,z))
    faces=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    faces.append(tuple(range(n-1,-1,-1))); faces.append(tuple(range(n,2*n)))
    return newmesh(name,verts,faces,material)
gh,uh=3.4,3.1
prism(padpoly.tolist(),0.0,0.4,M['stone'],1.15,"pad")
prism(rec_local:=(bpoly).tolist(),0.4,0.4+gh,M['stucco'],1.0,"g")
prism(bpoly.tolist(),0.4+1.1,0.4+2.6,M['glass'],1.01,"gb")
prism(bpoly.tolist(),0.4+gh+0.3,0.4+gh+0.3+uh,M['white'],0.86,"u")
prism(bpoly.tolist(),0.4+gh+0.3+0.9,0.4+gh+0.3+2.1,M['glass'],0.87,"ub")
def slab(poly,h,material,scale,name):
    return prism(poly,h,h+0.35,material,scale,name)
slab(bpoly.tolist(),0.4+gh,M['roof'],1.08,"r0")
slab(bpoly.tolist(),0.4+gh+0.3+uh,M['roof'],0.92,"r1")
# ---- pool + deck in front (+X) ----
bb=bpoly; xmin,xmax=R([bb[:,0].min(),0])[0],R([bb[:,0].max(),0])[0]
front=max(w2b(*R([p[0],p[1]]),0)[0] for p in [(bx,bz) for bx,bz in bpoly])  # not used
# place pool ahead along +X
poolw,poold=8,4
pv=[w2b(14,0.35,-poolw/2),w2b(14+poold,0.35,-poolw/2),w2b(14+poold,0.35,poolw/2),w2b(14,0.35,poolw/2)]
newmesh("pool",pv,[(0,1,2,3)],M['water'])
dv=[w2b(11,0.4,-7),w2b(20,0.4,-7),w2b(20,0.4,7),w2b(11,0.4,7)]
newmesh("deck",dv,[(0,1,2,3)],M['stone'])
# ---- ground (sloped down to sea +X) ----
gv=[]; gf=[]; gsx=[-60,120]; gsz=[-80,80]; NG=12
for j in range(NG):
    for i in range(NG):
        x=gsx[0]+(gsx[1]-gsx[0])*i/(NG-1); z=gsz[0]+(gsz[1]-gsz[0])*j/(NG-1)
        y=-0.02*max(0,x)                    # slope down toward +X (sea)
        gv.append(w2b(x,y,z))
for j in range(NG-1):
    for i in range(NG-1):
        a=j*NG+i; gf.append((a,a+NG,a+NG+1,a+1))
newmesh("ground",gv,gf,M['grass'],smooth=True)
# sea
sv=[w2b(140,-3,-400),w2b(700,-3,-400),w2b(700,-3,400),w2b(140,-3,400)]
newmesh("sea",sv,[(0,1,2,3)],M['sea'])
# trees
import random as _r; _r.seed(3)
tcon=mat('tcon',(0.20,0.30,0.14),1.0); ttr=mat('ttr',(0.3,0.22,0.14),1.0)
def cone(cx,cz,rad,h):
    seg=9; verts=[w2b(cx,h,cz)]
    for i in range(seg):
        a=2*math.pi*i/seg; verts.append(w2b(cx+rad*math.cos(a),0,cz+rad*math.sin(a)))
    faces=[(0,i+1,(i%seg)+2 if i<seg-1 else 1) for i in range(seg)]; faces.append(tuple(range(seg,0,-1)))
    newmesh("tree",verts,faces,tcon,smooth=True)
for _ in range(10):
    x=_r.uniform(-40,-8) if _r.random()<0.5 else _r.uniform(22,60); z=_r.uniform(-40,40)
    cone(x,z,2.2+_r.random(),4+_r.random()*2)
# ---- world sky (warm, low sun) ----
W=bpy.data.worlds.new("W"); bpy.context.scene.world=W; W.use_nodes=True
nt=W.node_tree; bg=nt.nodes.get("Background"); sky=nt.nodes.new("ShaderNodeTexSky")
try: sky.sky_type='NISHITA'; sky.sun_elevation=math.radians(12); sky.sun_rotation=math.radians(120); sky.altitude=150; sky.air_density=1.2; sky.dust_density=2.0
except Exception as e: print(e)
nt.links.new(sky.outputs[0],bg.inputs[0]); bg.inputs[1].default_value=0.6
sl=bpy.data.lights.new("sun",'SUN'); sl.energy=3.5; sl.angle=math.radians(1.0); sl.color=(1.0,0.82,0.60)
so=bpy.data.objects.new("sun",sl); bpy.context.collection.objects.link(so); so.rotation_euler=(math.radians(78),0,math.radians(-30))
# ---- camera: 3/4 hero, villa facing +X toward sea/camera ----
cam=bpy.data.cameras.new("cam"); cam.lens=38
co=bpy.data.objects.new("cam",cam); bpy.context.collection.objects.link(co)
loc=Vector(w2b(44,16,24)); tgt=Vector(w2b(4,3.5,0)); co.location=loc
d=(tgt-loc).normalized(); co.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=co
sc=bpy.context.scene; sc.render.engine='CYCLES'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for dv in prefs.devices: dv.use=True
    sc.cycles.device='GPU'
except Exception as e: print("GPU",e)
sc.cycles.samples=200; sc.cycles.use_denoising=True
sc.render.resolution_x=1500; sc.render.resolution_y=900
sc.view_settings.view_transform='Filmic'; sc.view_settings.look='Medium High Contrast'; sc.view_settings.exposure=-0.35
sc.render.image_settings.file_format='PNG'
sc.render.filepath="/private/tmp/claude-501/-Users-oskarpeterson-Documents-AI/fa90304f-6600-463f-8146-eb8df80e98f1/scratchpad/villa_render/%s.png"%VID
bpy.ops.render.render(write_still=True); print("DONE",VID)
