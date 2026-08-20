import bpy, bmesh, json, math, sys
from mathutils import Vector
SCENE="/Users/oskarpeterson/Documents/AI/product twin/repo/data/sites/essence-moraira/scene/essence-neighbourhood-scene-v0.1.json"
OUT ="/Users/oskarpeterson/Documents/AI/product twin/repo/data/sites/essence-moraira/scene/floorplans/villa-outlines.json"
S=json.load(open(SCENE)); OL=json.load(open(OUT))
rotOverride={'V1':0.6,'V2':0.2,'V3':-0.3,'V4':2.2}
# clean
bpy.ops.wm.read_factory_settings(use_empty=True)
def w2b(x,y,z): return (x, z, y)                 # blender X=x(E), Y=z(S), Z=y(up)
def mat(name,rgb,rough=0.6,metal=0.0,trans=0.0,ior=1.45,emit=None):
    m=bpy.data.materials.get(name)
    if m: return m
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    def setv(k,v):
        if k in b.inputs: b.inputs[k].default_value=v
    setv("Base Color",(*rgb,1)); setv("Roughness",rough); setv("Metallic",metal)
    setv("Transmission Weight",trans); setv("Transmission",trans); setv("IOR",ior)
    if trans>0.5: setv("Roughness",0.03)
    return m
add=None
M={
 'stucco':mat('stucco',(0.83,0.76,0.63),0.5),
 'white':mat('white',(0.93,0.90,0.83),0.42),
 'stone':mat('stone',(0.66,0.60,0.50),0.85),
 'glass':mat('glass',(0.09,0.13,0.16),0.03,0.0,1.0,1.45),
 'roof':mat('roof',(0.80,0.76,0.66),0.5),
 'grass':mat('grass',(0.30,0.37,0.21),1.0),
 'nbld':mat('nbld',(0.80,0.77,0.71),0.7),
 'nroof':mat('nroof',(0.45,0.22,0.15),0.7),
}

def add_bump(m,scale=8.0,strength=0.12):
    nt=m.node_tree; b=nt.nodes.get("Principled BSDF")
    tex=nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value=scale
    bump=nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value=strength
    nt.links.new(tex.outputs["Fac"],bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"],b.inputs["Normal"])
    return m

for _n,_sc,_st in [('stucco',10,0.10),('white',10,0.08),('stone',14,0.18),('grass',3.5,0.35)]:
    add_bump(M[_n],_sc,_st)
def newmesh(name,verts,faces,material):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth=False
    return ob
# ---- terrain ----
T=S['terrain']; nx,nz=T['nx'],T['nz']
tv=[]; 
for j in range(nz):
    for i in range(nx):
        x=T['x0']+i*T['dx']; z=T['z0']+j*T['dz']; y=T['heights'][j*nx+i]
        tv.append(w2b(x,y,z))
tf=[]
for j in range(nz-1):
    for i in range(nx-1):
        a=j*nx+i; b=a+1; c=a+nx; d=c+1; tf.append((a,c,d,b))
newmesh("terrain",tv,tf,M['grass'])
# ---- prism from local polygon ----
def prism(poly,cx,cz,base_y,rot,h0,h1,material,scale=1.0,name="p"):
    ct,st=math.cos(rot),math.sin(rot)
    def wp(lx,lz,h):
        lx*=scale; lz*=scale
        wx=cx+lx*ct+lz*st; wz=cz-lx*st+lz*ct; wy=base_y+h
        return w2b(wx,wy,wz)
    n=len(poly); verts=[]; 
    for p in poly: verts.append(wp(p[0],p[1],h0))
    for p in poly: verts.append(wp(p[0],p[1],h1))
    faces=[]
    for i in range(n):
        j=(i+1)%n; faces.append((i,j,n+j,n+i))
    faces.append(tuple(range(n-1,-1,-1)))          # bottom
    faces.append(tuple(range(n,2*n)))              # top
    return newmesh(name,verts,faces,material)
def slab(poly,cx,cz,base_y,rot,h,material,scale=1.0,name="s"):
    return prism(poly,cx,cz,base_y,rot,h,h+0.35,material,scale,name)
# ---- villas ----
gh,uh=3.4,3.1
V={v['id']:v for v in S['villas']}
for vid in ['V1','V2','V3','V4']:
    v=V[vid]; cx,cz,by=v['cx'],v['cz'],v['base_y']; rot=rotOverride[vid]
    rec=OL[vid]
    prism(rec['pad'],cx,cz,by,rot,0.0,0.35,M['stone'],1.0,vid+"_pad")
    prism(rec['building'],cx,cz,by,rot,0.35,0.35+gh,M['stucco'],1.0,vid+"_g")
    prism(rec['building'],cx,cz,by,rot,0.35+1.15,0.35+2.55,M['glass'],1.008,vid+"_gb")   # ground ribbon
    prism(rec['building'],cx,cz,by,rot,0.35+gh+0.28,0.35+gh+0.28+uh,M['white'],0.88,vid+"_u")
    prism(rec['building'],cx,cz,by,rot,0.35+gh+0.28+0.9,0.35+gh+0.28+2.1,M['glass'],0.888,vid+"_ub")
    slab(rec['building'],cx,cz,by,rot,0.35+gh,M['roof'],1.06,vid+"_r0")
    slab(rec['building'],cx,cz,by,rot,0.35+gh+0.28+uh,M['roof'],0.94,vid+"_r1")
# ---- existing house + neighbours ----
def boxpoly(w,d): return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]
c=S['central_house']; ch_by=T['heights'][min(len(T['heights'])-1,0)]
def hy(x,z):
    i=max(0,min(nx-1,round((x-T['x0'])/T['dx']))); j=max(0,min(nz-1,round((z-T['z0'])/T['dz'])))
    return T['heights'][j*nx+i]
prism(boxpoly(11,10),c['cx'],c['cz'],hy(c['cx'],c['cz']),0,0,6,M['nbld'],1.0,"exist")
for k,b in enumerate(S['context_buildings']):
    xs=[p[0] for p in b['ring_xz']]; zs=[p[1] for p in b['ring_xz']]
    poly=[[p[0]-sum(xs)/len(xs),p[1]-sum(zs)/len(zs)] for p in b['ring_xz']]
    ccx=sum(xs)/len(xs); ccz=sum(zs)/len(zs)
    if not (T['x0']+2<ccx<T['x0']+(nx-1)*T['dx']-2 and T['z0']+2<ccz<T['z0']+(nz-1)*T['dz']-2): continue
    nby=hy(ccx,ccz)
    prism(poly,ccx,ccz,nby,0,0,b['height'],M['nbld'],1.0,"n%d"%k)
    slab(poly,ccx,ccz,nby,0,b['height'],M['nroof'],1.02,"nr%d"%k)

# ---- trees ----
import random as _r; _r.seed(7)
tconi=mat('tcon',(0.24,0.34,0.18),1.0); ttrunk=mat('ttrunk',(0.32,0.24,0.16),1.0)
def cone(cx,cz,by,rad,h,material):
    seg=8; verts=[w2b(cx,by+h,cz)]; 
    for i in range(seg):
        a=2*math.pi*i/seg; verts.append(w2b(cx+rad*math.cos(a),by,cz+rad*math.sin(a)))
    faces=[(0,i+1,(i%seg)+2 if i<seg-1 else 1) for i in range(seg)]
    faces.append(tuple(range(seg,0,-1)))
    newmesh("tree",verts,faces,material)
for _ in range(34):
    i=_r.randint(0,nx-1); j=_r.randint(0,nz-1)
    x=T['x0']+i*T['dx']; z=T['z0']+j*T['dz']; y=T['heights'][j*nx+i]
    cone(x,z,y+1.6,1.6+_r.random(),2.6+_r.random(),tconi)
    prism([[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]],x,z,y,0,0,1.7,ttrunk)
# ---- world sky ----
W=bpy.data.worlds.new("W"); bpy.context.scene.world=W; W.use_nodes=True
nt=W.node_tree; bg=nt.nodes.get("Background")
sky=nt.nodes.new("ShaderNodeTexSky"); 
try: sky.sky_type='NISHITA'
except: pass
try:
    sky.sun_elevation=math.radians(16); sky.sun_rotation=math.radians(215); sky.altitude=200
except: pass
nt.links.new(sky.outputs[0],bg.inputs[0]); bg.inputs[1].default_value=0.5
# ---- sun ----
sl=bpy.data.lights.new("sun",'SUN'); sl.energy=3.0; sl.angle=math.radians(1.2); sl.color=(1.0,0.86,0.66)
so=bpy.data.objects.new("sun",sl); bpy.context.collection.objects.link(so)
so.rotation_euler=(math.radians(74),0,math.radians(40))
# ---- sea ----
# (sea omitted)
# ---- camera ----
cam=bpy.data.cameras.new("cam"); cam.lens=30
co=bpy.data.objects.new("cam",cam); bpy.context.collection.objects.link(co)
loc=Vector(w2b(-52,92,74)); tgt=Vector(w2b(8,62,-22))
co.location=loc
d=(tgt-loc).normalized(); co.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=co
# ---- render ----
sc=bpy.context.scene; sc.render.engine='CYCLES'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for dv in prefs.devices: dv.use=True
    sc.cycles.device='GPU'
except Exception as e: print("GPU setup failed",e)
sc.cycles.samples=200; sc.cycles.use_denoising=True
sc.render.resolution_x=1280; sc.render.resolution_y=720; sc.render.resolution_percentage=100
sc.view_settings.view_transform='Filmic'
sc.view_settings.exposure=-0.2
sc.view_settings.look='Medium Contrast'
sc.render.filepath="/private/tmp/claude-501/-Users-oskarpeterson-Documents-AI/fa90304f-6600-463f-8146-eb8df80e98f1/scratchpad/render/dev_hero3.png"
sc.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True)
print("RENDER DONE")
