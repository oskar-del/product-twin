# Contact sheet of the 40 bedroom hero proxies -> docs/screens/03-bedroom-heroes.png
import bpy, os, json, math, mathutils
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'docs/screens/03-bedroom-heroes.png')
items = json.load(open(os.path.join(BASE, '.runtime/bedroom-heroes.json')))

BG = (0.063, 0.098, 0.086, 1.0)   # #101916
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1760, 1000
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = -0.15
sc.render.film_transparent = False

world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = BG
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
dome = bpy.data.objects.new('Dome', bpy.data.lights.new('Dome','AREA'))
dome.data.energy = 4200; dome.data.size = 46; dome.data.shape = 'SQUARE'
dome.location = (0, -5, 16); dome.rotation_euler = (0, 0, 0)
sc.collection.objects.link(dome)

def imp(p):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in before]

# Two bands: beds (10 per row x 2) then lamps (10 per row x 2), each on its own grid.
COLS, GAPX, GAPZ = 10, 2.5, 2.9
placed = 0
for band, subset in enumerate([items[:20], items[20:]]):
    for i, it in enumerate(subset):
        objs = imp(os.path.join(BASE, it['file'].join(['data/geometry/avatars/', ''])) if False
                   else os.path.join(BASE, 'data/geometry/avatars', it['file']))
        col, row = i % COLS, i // COLS
        x = (col - (COLS - 1) / 2) * GAPX
        y = -(band * 2 + row) * GAPZ
        for o in objs:
            if o.parent is None:
                o.location.x += x; o.location.y += y
        placed += 1

# ground
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
m = bpy.data.materials.new('floor'); m.use_nodes = True
b = m.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.09, 0.14, 0.12, 1)
b.inputs['Roughness'].default_value = 0.95
bpy.context.object.data.materials.append(m)

key = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
key.data.energy = 3.2; key.data.angle = math.radians(12); key.data.color = (1.0, 0.95, 0.88)
key.rotation_euler = (math.radians(52), 0, math.radians(38))
sc.collection.objects.link(key)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'AREA'))
fill.data.energy = 900; fill.data.size = 20
fill.location = (-9, 7, 9); fill.rotation_euler = (math.radians(58), 0, math.radians(-150))
sc.collection.objects.link(fill)

# This is a GEOMETRY contact sheet, so every proxy is forced to one matte spine
# material. The stock ELECTRICAL spine material is semi-metallic and its flat
# cylinder cap mirrored the dark world, rendering the pendants as black discs.
# Material truth is a separate deliverable (item 4), not this sheet.
for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    b = mat.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Metallic'].default_value = 0.0
        b.inputs['Roughness'].default_value = 0.72

# Orthographic camera fitted by projecting the real bbox corners into camera space:
# the previous perspective fit guessed a distance from span and cropped the grid twice.
corners = []
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.startswith('Plane'):
        continue
    for c in o.bound_box:
        corners.append(o.matrix_world @ mathutils.Vector(c))
centre = sum(corners, mathutils.Vector((0, 0, 0))) / len(corners)

cam_data = bpy.data.cameras.new('Cam')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('Cam', cam_data)
tilt = math.radians(58)
back = 30.0
cam.location = (centre.x,
                centre.y - math.cos(tilt) * back,
                centre.z + math.sin(tilt) * back)
cam.rotation_euler = (centre - mathutils.Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(cam); sc.camera = cam
bpy.context.view_layer.update()

inv = cam.matrix_world.inverted()
mx = my = 0.0
for c in corners:
    v = inv @ c
    mx = max(mx, abs(v.x)); my = max(my, abs(v.y))
aspect = sc.render.resolution_x / sc.render.resolution_y
cam_data.ortho_scale = 2 * max(mx, my * aspect) * 1.06
print(f'ortho_scale={cam_data.ortho_scale:.2f} (mx={mx:.2f} my={my:.2f})')

bpy.ops.render.render(write_still=True)
print(f'WROTE {OUT} · placed {placed} proxies')
