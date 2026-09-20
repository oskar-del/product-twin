# Material-truth still -> docs/screens/04-material-truth.png
# Colour comes from each twin's material_cues.colour_text (REPORTED merchant text)
# via scripts/material_truth_lib.py. Controls are included on purpose: a colour
# string naming no single hue ("Flerfargad"/"Transparent") and a twin with no
# colour at all must both render as a flagged neutral, never a guessed hue.
import bpy, os, sys, json, math, mathutils
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'scripts'))
from material_truth_lib import resolve_colour

# Raw render goes to .runtime/; compose_material_truth.py adds the label strip
# and writes docs/screens/. Keeping these paths separate means re-running the
# composer cannot composite its own output.
OUT = os.path.join(BASE, '.runtime/material-truth-raw.png')
items = json.load(open(os.path.join(BASE, '.runtime/material-truth-set.json')))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1760, 820
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.15

world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.063, 0.098, 0.086, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

def imp(p):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in before]

# Two rows with ADAPTIVE spacing: a fixed gap wasted most of the frame because the
# set mixes a 2 m sofa with a 0.3 m table lamp. Each piece advances by its own
# half-width, so big and small pieces sit at a readable density.
ROWS = 2
per_row = (len(items) + ROWS - 1) // ROWS
resolved = []
row_widths = []
placed = []
for row in range(ROWS):
    chunk = items[row * per_row:(row + 1) * per_row]
    cursor = 0.0
    entries = []
    for it in chunk:
        w = (it.get('w') or 600) / 1000.0
        cursor += w / 2
        entries.append((it, cursor))
        cursor += w / 2 + 0.55          # 55 cm of air between pieces
    row_widths.append(cursor - 0.55)
    placed.append(entries)

for row, entries in enumerate(placed):
    half = row_widths[row] / 2
    y = -row * 2.6
    for it, cx in entries:
        objs = imp(os.path.join(BASE, it['asset']))
        rgb, metallic, state = resolve_colour(it.get('colour_text'))
        for o in objs:
            if o.parent is None:
                o.location.x += cx - half
                o.location.y += y
            if o.type != 'MESH':
                continue
            for slot in o.material_slots:
                m = slot.material
                if not m or not m.node_tree:
                    continue
                mm = m.copy()
                slot.material = mm
                b = mm.node_tree.nodes.get('Principled BSDF')
                if not b:
                    continue
                b.inputs['Base Color'].default_value = (*rgb, 1)
                b.inputs['Metallic'].default_value = metallic
                b.inputs['Roughness'].default_value = 0.3 if metallic else 0.72
        resolved.append({**it, 'state': state, 'rgb': rgb})
        print(f"  {str(it.get('colour_text')):18s} -> {state:26s} {it['name'][:40]}")

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
fm = bpy.data.materials.new('floor'); fm.use_nodes = True
fb = fm.node_tree.nodes['Principled BSDF']
fb.inputs['Base Color'].default_value = (0.09, 0.14, 0.12, 1)
fb.inputs['Roughness'].default_value = 0.95
bpy.context.object.data.materials.append(fm)

key = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
key.data.energy = 3.0; key.data.angle = math.radians(14); key.data.color = (1.0, 0.96, 0.9)
key.rotation_euler = (math.radians(50), 0, math.radians(35))
sc.collection.objects.link(key)
dome = bpy.data.objects.new('Dome', bpy.data.lights.new('Dome', 'AREA'))
dome.data.energy = 6000; dome.data.size = 40
dome.location = (0, -6, 14)
sc.collection.objects.link(dome)

# ortho fit from real bbox corners (same routine as the hero sheet)
corners = []
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.startswith('Plane'):
        continue
    for c in o.bound_box:
        corners.append(o.matrix_world @ mathutils.Vector(c))
centre = sum(corners, mathutils.Vector((0, 0, 0))) / len(corners)
cd = bpy.data.cameras.new('Cam'); cd.type = 'ORTHO'
cam = bpy.data.objects.new('Cam', cd)
tilt = math.radians(30); back = 40.0
cam.location = (centre.x, centre.y - math.cos(tilt) * back, centre.z + math.sin(tilt) * back)
cam.rotation_euler = (centre - mathutils.Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(cam); sc.camera = cam
bpy.context.view_layer.update()
inv = cam.matrix_world.inverted(); mx = my = 0.0
for c in corners:
    v = inv @ c; mx = max(mx, abs(v.x)); my = max(my, abs(v.y))
cd.ortho_scale = 2 * max(mx, my * (sc.render.resolution_x / sc.render.resolution_y)) * 1.06

json.dump(resolved, open(os.path.join(BASE, '.runtime/material-truth-resolved.json'), 'w'), indent=2)
bpy.ops.render.render(write_still=True)
doc = sum(1 for r in resolved if r['state'].startswith('documented'))
print(f"WROTE {OUT} · {len(resolved)} pieces · documented={doc} controls={len(resolved)-doc}")
