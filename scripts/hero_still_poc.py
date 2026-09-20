# Hero-still PoC v4: material truth.
#
# Colour is resolved from the DOCUMENTED cascade in scripts/material_truth_lib.py:
#   1. twin.material_cues.colour_text   - the merchant's own colour word (REPORTED)
#   2. native-3d manifest "Finish" option - Shopify product option (REPORTED)
#   3. undocumented                     - flat neutral, never a guessed hue
#
# No per-object RGB is hardcoded. v2 of this file guessed "cognac leather-ish",
# "warm grey fabric" and "boucle + chrome"; those inventions are gone.
import bpy, math, os, sys, json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'scripts'))
from material_truth_lib import resolve_colour, twin_cues

NAT = os.path.join(BASE, '.runtime/showcase/native-3d')
OUT = os.path.join(BASE, '.runtime/renders/hero-still-poc-v4.png')
MANIFEST = os.path.join(BASE, 'data/geometry/native-3d-showcase-manifest.json')

SCENE = {
    'PT_NORR11_MAN_3_SEATER_SOFA_NOR_MAN_3_SEAT_SOFA_CAT3': (0.0, 0.0, 0),
    'PT_NORR11_MAN_DAY_BED_NOR_MAN_DAYBED_CAT1': (-2.35, 0.55, 10),
    'PT_NORR11_FAVE_NOR_FAVE_CHR_CHRME_CAT0': (2.05, 0.85, -38),
}


def manifest_finish(twin_id):
    """Tier 2: the Shopify 'Finish' option, when the merchant publishes one."""
    if not os.path.exists(MANIFEST):
        return None
    for e in json.load(open(MANIFEST)).get('entries', []):
        if e['twin_id'] == twin_id:
            for opt in (e.get('material_cues') or {}).get('options', []):
                if opt['name'].lower() == 'finish':
                    return opt['values'][0]
    return None


def resolve_for(twin_id):
    cues = twin_cues(BASE, twin_id) or {}
    rgb, metallic, state = resolve_colour(cues.get('colour_text'))
    if state == 'undocumented':
        rgb, metallic, state2 = resolve_colour(manifest_finish(twin_id))
        if state2 != 'undocumented':
            state = 'manifest_' + state2
    return rgb, metallic, state


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 200
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = -0.5


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def place(objs, x, y, rot):
    for o in objs:
        if o.parent is None:
            o.location.x += x
            o.location.y += y
            o.rotation_mode = 'XYZ'
            o.rotation_euler[2] += math.radians(rot)


def override_mats(objs, rgb, metallic=0.0):
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.node_tree:
                continue
            b = m.node_tree.nodes.get('Principled BSDF')
            if not b:
                continue
            b.inputs['Base Color'].default_value = (*rgb, 1)
            b.inputs['Metallic'].default_value = metallic
            b.inputs['Roughness'].default_value = 0.3 if metallic else 0.75


def mat(name, base, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


print('MATERIAL TRUTH:')
for twin_id, (px, py, rot) in SCENE.items():
    glb = os.path.join(NAT, twin_id + '.glb')
    if not os.path.exists(glb):
        print(f'  SKIP {twin_id}: GLB not in .runtime (gitignored, regenerate with resolve-native-3d-showcase.mjs)')
        continue
    objs = import_glb(glb)
    rgb, metallic, state = resolve_for(twin_id)
    place(objs, px, py, rot)
    override_mats(objs, rgb, metallic)
    print(f'  {twin_id}: {state} rgb={tuple(round(v, 3) for v in rgb)} metallic={metallic}')

# oak floor with procedural planks
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
floor = bpy.context.object
fm = bpy.data.materials.new('oak')
fm.use_nodes = True
nt = fm.node_tree
b = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexWave')
tex.wave_type = 'BANDS'
tex.inputs['Scale'].default_value = 0.9
tex.inputs['Distortion'].default_value = 6.0
tex.inputs['Detail'].default_value = 2.5
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.34, 0.23, 0.13, 1)
ramp.color_ramp.elements[1].color = (0.47, 0.34, 0.20, 1)
nt.links.new(tex.outputs['Color'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.45
floor.data.materials.append(fm)

bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 3.4, 20))
wall = bpy.context.object
wall.rotation_euler[0] = math.radians(90)
wall.data.materials.append(mat('plaster', (0.34, 0.35, 0.37), 0.92))

w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
nt = w.node_tree
bg = nt.nodes['Background']
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sun_elevation = math.radians(7)
sky.sun_rotation = math.radians(210)
sky.sun_intensity = 0.25
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.5

sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 2.6
sun.data.angle = math.radians(1.2)
sun.data.color = (1.0, 0.82, 0.62)
sun.rotation_euler = (math.radians(78), 0, math.radians(38))
sc.collection.objects.link(sun)

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 50
cam.location = (2.9, -4.3, 1.25)
cam.rotation_euler = (math.radians(83), 0, math.radians(29))
sc.collection.objects.link(cam)
sc.camera = cam

bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
