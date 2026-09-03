# Hero-still PoC v3: material truth. Overrides are now DERIVED from each twin's
# documented `material_cues` in data/geometry/native-3d-showcase-manifest.json
# (real Shopify storefront product options), not hand-picked guesses. A twin whose
# manufacturer only publishes an abstract fabric grade ("Upholstery Group: Cat 3")
# with no real swatch/hex gets a flat, clearly-undocumented neutral -- we do not
# invent "cognac leather" or "warm grey" colours the source data doesn't contain.
# Only a documented Finish (e.g. NORR11 Fave "Chrome Steel") drives a specific colour.
import bpy, math, os, json
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAT = os.path.join(BASE, '.runtime/showcase/native-3d')
OUT = os.path.join(BASE, '.runtime/renders/hero-still-poc-v3.png')
MANIFEST = os.path.join(BASE, 'data/geometry/native-3d-showcase-manifest.json')

FINISH_TO_RGB = {
    # Deterministic, documented-value-only lookup -- every key here is a real
    # option value observed in a manufacturer's own Shopify product options.
    'chrome steel': (0.75, 0.75, 0.78),
    'black  steel': (0.03, 0.03, 0.035),
    'black steel': (0.03, 0.03, 0.035),
}
UNDOCUMENTED_FABRIC_RGB = (0.5, 0.5, 0.5)  # flat neutral: no real swatch data exists

def material_cues_for(twin_id):
    manifest = json.load(open(MANIFEST))
    for e in manifest['entries']:
        if e['twin_id'] == twin_id:
            return e.get('material_cues', {'state': 'undocumented'})
    return {'state': 'undocumented', 'reason': 'twin not in manifest'}

def resolve_colours(twin_id):
    cues = material_cues_for(twin_id)
    fabric_rgb = UNDOCUMENTED_FABRIC_RGB
    frame_rgb, frame_metal = (0.05, 0.05, 0.05), 0.3  # unknown-frame default, low metallic
    if cues.get('state') == 'documented':
        for opt in cues.get('options', []):
            if opt['name'].lower() == 'finish':
                # a Finish option with exactly one *currently selected* value would be
                # ideal; the Storefront API here only exposes the full value list, so
                # we take the first documented value deterministically (not a guess --
                # it is one of the manufacturer's own published finish names).
                val = opt['values'][0].strip().lower()
                if val in FINISH_TO_RGB:
                    frame_rgb = FINISH_TO_RGB[val]
                    frame_metal = 1.0
    return fabric_rgb, frame_rgb, frame_metal, cues.get('state')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 200; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = -0.5

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def place(objs, x, y, rot):
    for o in objs:
        if o.parent is None:
            o.location.x += x; o.location.y += y
            o.rotation_mode='XYZ'; o.rotation_euler[2] += math.radians(rot)

def override_mats(objs, fabric_rgb, frame_rgb=(0.05,0.05,0.05), frame_metal=1.0):
    # heuristic: biggest-area materials = upholstery; thin/metal-named = frame
    for o in objs:
        if o.type != 'MESH': continue
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            b = m.node_tree.nodes.get('Principled BSDF')
            if not b: continue
            name = (m.name or '').lower()
            if any(k in name for k in ('metal','chrome','steel','frame','leg')):
                b.inputs['Base Color'].default_value=(*frame_rgb,1)
                b.inputs['Metallic'].default_value=frame_metal
                b.inputs['Roughness'].default_value=0.25
            else:
                b.inputs['Base Color'].default_value=(*fabric_rgb,1)
                b.inputs['Roughness'].default_value=0.75
                b.inputs['Metallic'].default_value=0.0

print('MATERIAL TRUTH:')
sofa_id = 'PT_NORR11_MAN_3_SEATER_SOFA_NOR_MAN_3_SEAT_SOFA_CAT3'
sofa = import_glb(os.path.join(NAT, sofa_id + '.glb'))
fab, frm, met, state = resolve_colours(sofa_id)
place(sofa, 0, 0, 0); override_mats(sofa, fab, frm, met)
print(f'  {sofa_id}: fabric={state} frame_rgb={frm}')

day_id = 'PT_NORR11_MAN_DAY_BED_NOR_MAN_DAYBED_CAT1'
day = import_glb(os.path.join(NAT, day_id + '.glb'))
fab, frm, met, state = resolve_colours(day_id)
place(day, -2.35, 0.55, 10); override_mats(day, fab, frm, met)
print(f'  {day_id}: fabric={state} frame_rgb={frm}')

fave_id = 'PT_NORR11_FAVE_NOR_FAVE_CHR_CHRME_CAT0'
fave = import_glb(os.path.join(NAT, fave_id + '.glb'))
fab, frm, met, state = resolve_colours(fave_id)
place(fave, 2.05, 0.85, -38); override_mats(fave, fab, frm, met)
print(f'  {fave_id}: fabric={state} frame_rgb={frm} frame_metal={met}')

def mat(name, base, rough, metal=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*base,1); b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal; return m

# oak floor with procedural planks
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,0))
floor=bpy.context.object
fm=bpy.data.materials.new('oak'); fm.use_nodes=True
nt=fm.node_tree; b=nt.nodes['Principled BSDF']
tex=nt.nodes.new('ShaderNodeTexWave'); tex.wave_type='BANDS'; tex.inputs['Scale'].default_value=0.9
tex.inputs['Distortion'].default_value=6.0; tex.inputs['Detail'].default_value=2.5
ramp=nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color=(0.34,0.23,0.13,1); ramp.color_ramp.elements[1].color=(0.47,0.34,0.20,1)
nt.links.new(tex.outputs['Color'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value=0.45
floor.data.materials.append(fm)

# backdrop wall closer, warm plaster
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,3.4,20))
wall=bpy.context.object; wall.rotation_euler[0]=math.radians(90)
wall.data.materials.append(mat('plaster',(0.70,0.64,0.56),0.9))

# golden-hour: lower sun energy, warm color
w=bpy.data.worlds.new('W'); sc.world=w; w.use_nodes=True
nt=w.node_tree; bg=nt.nodes['Background']
sky=nt.nodes.new('ShaderNodeTexSky'); sky.sun_elevation=math.radians(7); sky.sun_rotation=math.radians(210)
sky.sun_intensity=0.25
nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value=0.5
sun=bpy.data.objects.new('Sun', bpy.data.lights.new('Sun','SUN'))
sun.data.energy=2.6; sun.data.angle=math.radians(1.2); sun.data.color=(1.0,0.82,0.62)
sun.rotation_euler=(math.radians(78),0,math.radians(38))
sc.collection.objects.link(sun)

cam=bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens=50; cam.location=(2.9,-4.3,1.25); cam.rotation_euler=(math.radians(83),0,math.radians(29))
sc.collection.objects.link(cam); sc.camera=cam
bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
