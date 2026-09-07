# Renders the Newport shoppable living room from the committed furniture manifest.
# Colours come from each piece's DOCUMENTED feed colour (Newport feed 2175 `color`
# field) via a deterministic Swedish-colour-name -> RGB table. A colour name absent
# from the table renders as a flagged neutral; nothing is invented per-object.
import bpy, math, os, json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(BASE, 'data/showrooms/newport-living-room-furniture-manifest-v0.2.json')
OUT = os.path.join(BASE, '.runtime/renders/newport-living-room-v0.2.png')

# Every key is a colour word Newport itself publishes in the feed's `color` field.
SV_COLOUR = {
    'beige': (0.76, 0.70, 0.58), 'sand': (0.78, 0.72, 0.60), 'vit': (0.90, 0.89, 0.86),
    'brun': (0.35, 0.24, 0.16),  'guld': (0.75, 0.60, 0.28), 'mässing': (0.72, 0.58, 0.30),
    'röd': (0.42, 0.10, 0.12),   'svart': (0.05, 0.05, 0.05), 'grå': (0.50, 0.50, 0.50),
    'natur': (0.72, 0.63, 0.48), 'ivory': (0.88, 0.85, 0.77), 'camel': (0.66, 0.50, 0.31),
}
UNDOCUMENTED = (0.55, 0.55, 0.55)

def colour_for(spec):
    """First documented colour word wins; deterministic, no guessing."""
    raw = (spec or '').lower()
    for word, rgb in SV_COLOUR.items():
        if word in raw:
            return rgb, 'documented:' + word
    return UNDOCUMENTED, 'undocumented'

manifest = json.load(open(MANIFEST))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 160; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.filepath = OUT; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Base Contrast'
sc.view_settings.exposure = -1.6

def import_glb(p):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in before]

def tint(objs, rgb):
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
            name = (m.name or '').lower()
            if any(k in name for k in ('metal', 'brass', 'mässing', 'chrome', 'steel')):
                b.inputs['Base Color'].default_value = (*SV_COLOUR['mässing'], 1)
                b.inputs['Metallic'].default_value = 1.0
                b.inputs['Roughness'].default_value = 0.3
            else:
                b.inputs['Base Color'].default_value = (*rgb, 1)
                b.inputs['Roughness'].default_value = 0.8
                b.inputs['Metallic'].default_value = 0.0

print('NEWPORT ROOM — placements:')
for p in manifest['placements']:
    objs = import_glb(os.path.join(BASE, p['asset']['uri']))
    is_meshy = str(p['asset'].get('fidelity', '')).startswith('MESHY')

    # Meshy reconstructions arrive at an arbitrary scale. Normalise every piece to the
    # dimensions the twin actually documents, so the room stays dimension-verified
    # (this is what "G2" means here) instead of trusting whatever the GLB shipped with.
    declared = ((p.get('fit') or {}).get('actual_dims_mm')) or {}
    if declared.get('width'):
        import mathutils as _mu
        roots = [o for o in objs if o.parent is None]
        lo = _mu.Vector((1e9, 1e9, 1e9)); hi = _mu.Vector((-1e9, -1e9, -1e9))
        for o in objs:
            if o.type != 'MESH':
                continue
            for c in o.bound_box:
                w = o.matrix_world @ _mu.Vector(c)
                lo = _mu.Vector((min(lo[i], w[i]) for i in range(3)))
                hi = _mu.Vector((max(hi[i], w[i]) for i in range(3)))
        cur = hi - lo
        # GLB axes: X=width, Y=depth, Z=height once imported Z-up
        want = (declared['width'] / 1000.0, declared['depth'] / 1000.0, declared['height'] / 1000.0)
        if cur.x > 1e-6 and cur.y > 1e-6 and cur.z > 1e-6:
            # The twin's dims are CATEGORY DEFAULTS (scale_state: "category_default"),
            # not measured for this SKU -- forcing a real reconstruction into that box
            # would distort true geometry to match a guessed number. So scale uniformly
            # off HEIGHT only: it is the most stable category constant (seat/table height)
            # and it preserves the reconstruction's real proportions.
            k = want[2] / cur.z
            for o in roots:
                o.scale = (o.scale[0] * k, o.scale[1] * k, o.scale[2] * k)
            bpy.context.view_layer.update()
            # re-seat on the floor after scaling
            lo2 = 1e9
            for o in objs:
                if o.type != 'MESH':
                    continue
                for c in o.bound_box:
                    lo2 = min(lo2, (o.matrix_world @ _mu.Vector(c)).z)
            for o in roots:
                o.location.z -= lo2
            print(f"    height-scaled {p['source_placement_alias']}: {round(cur.x,2)}x{round(cur.y,2)}x{round(cur.z,2)}m -> h={want[2]}m k={round(k,3)} => {round(cur.x*k,2)}x{round(cur.y*k,2)}x{round(cur.z*k,2)}m")
    rgb, state = colour_for((p.get('material_cues') or {}).get('color'))
    if is_meshy:
        state = 'meshy_baked_texture(kept)'
    t = p['transform']
    for o in objs:
        if o.parent is None:
            o.location.x += t['translation_m'][0]
            o.location.y += t['translation_m'][2]   # manifest is Y-up, Blender Z-up
            o.location.z += t['translation_m'][1]
            o.rotation_mode = 'XYZ'
            o.rotation_euler[2] += t['rotation_y_rad']
    if not is_meshy:
        tint(objs, rgb)
    print(f"  {p['source_placement_alias']:20s} {p['product_twin_id']:20s} {state:22s} {p['commerce']['unit_price']} SEK")

def mat(name, base, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
bpy.context.object.data.materials.append(mat('oak_floor', (0.30, 0.23, 0.15), 0.55))
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4.2, 15))
w = bpy.context.object; w.rotation_euler[0] = math.radians(90)
w.data.materials.append(mat('plaster', (0.34, 0.35, 0.37), 0.92))

world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
nt = world.node_tree; bg = nt.nodes['Background']
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sun_elevation = math.radians(16); sky.sun_rotation = math.radians(200)
sky.sun_intensity = 0.12
nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.30

sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 1.6; sun.data.angle = math.radians(2.0); sun.data.color = (1.0, 0.9, 0.78)
sun.rotation_euler = (math.radians(60), 0, math.radians(40))
sc.collection.objects.link(sun)

# --- auto-frame the furniture: derive the camera from the actual bounding box,
# so the shot can never silently crop a piece the way hand-tuned angles did. ---
import mathutils
furniture = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('Plane', 'Plane.001')]
mins = mathutils.Vector((1e9, 1e9, 1e9)); maxs = mathutils.Vector((-1e9, -1e9, -1e9))
for o in furniture:
    for corner in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(corner)
        mins = mathutils.Vector((min(mins[i], w[i]) for i in range(3)))
        maxs = mathutils.Vector((max(maxs[i], w[i]) for i in range(3)))
center = (mins + maxs) / 2.0
size = maxs - mins
radius = max(size.x, size.y, size.z) / 2.0
print(f'  bbox center={[round(v,2) for v in center]} size={[round(v,2) for v in size]}')

cam_data = bpy.data.cameras.new('Cam'); cam_data.lens = 35
cam = bpy.data.objects.new('Cam', cam_data)
# 3/4 view, pulled back proportional to the group's radius (with headroom margin)
dist = radius * 3.1 + 1.2
cam.location = (center.x + dist * 0.62, center.y - dist * 0.80, center.z + radius * 1.15 + 0.9)
direction = center - mathutils.Vector(cam.location)
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
sc.collection.objects.link(cam); sc.camera = cam

bpy.ops.render.render(write_still=True)
total = sum(p['commerce']['unit_price'] or 0 for p in manifest['placements'])
print(f"WROTE {OUT}")
print(f"ROOM TOTAL: {total} SEK across {len(manifest['placements'])} tracked Newport pieces")
