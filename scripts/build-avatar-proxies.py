from pathlib import Path
import math
import trimesh

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "geometry" / "avatars"
OUT.mkdir(parents=True, exist_ok=True)


def add_box(scene, extents, translation, name):
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(translation)
    scene.add_geometry(mesh, node_name=name)


def add_cylinder(scene, radius, height, translation, name, rotate=None):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=40)
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translation)
    scene.add_geometry(mesh, node_name=name)


def export(scene, filename):
    target = OUT / filename
    target.write_bytes(scene.export(file_type="glb"))
    print(f"wrote {target.relative_to(ROOT)} ({target.stat().st_size} bytes)")


# Huawei SUN2000-10KTL-M1
# Manufacturer verified outer dimensions: 525 W x 470 H x 146.5 D mm.
# This is a dimension-verified G2 visual proxy, NOT manufacturer geometry.
w, d, h = 0.525, 0.1465, 0.470
huawei = trimesh.Scene()
add_box(huawei, [w * 0.98, d * 0.90, h * 0.94], [0, 0, h * 0.47], "main_enclosure")
add_box(huawei, [w * 0.90, d * 0.05, h * 0.72], [0, -(d * 0.45), h * 0.50], "front_panel")
add_box(huawei, [w * 0.55, d * 0.88, h * 0.16], [0, 0, h * 0.08], "connection_zone")
add_cylinder(huawei, 0.018, 0.004, [w * 0.34, -(d * 0.485), h * 0.73], "status_indicator", (math.pi / 2, [1, 0, 0]))
export(huawei, "huawei-sun2000-10ktl-m1-g2-proxy.glb")


# AstralPool Victoria Plus Silent VS 67547
# Manufacturer drawing supplies lettered dimensions. Until drawing axes are independently
# verified, use a conservative equipment envelope derived from the documented maxima.
# This is a G2 visual/equipment proxy, NOT exact industrial-design geometry.
L, W, H = 0.584, 0.354, 0.359
pump = trimesh.Scene()
add_box(pump, [L * 0.80, W * 0.68, H * 0.07], [0, 0, H * 0.035], "base")
add_cylinder(pump, W * 0.23, L * 0.42, [L * 0.12, 0, H * 0.48], "motor", (math.pi / 2, [0, 1, 0]))
add_cylinder(pump, W * 0.29, W * 0.36, [-L * 0.18, 0, H * 0.42], "pump_volute", (math.pi / 2, [1, 0, 0]))
add_cylinder(pump, W * 0.23, H * 0.42, [-L * 0.34, 0, H * 0.30], "prefilter_pot")
add_cylinder(pump, 0.035, 0.09, [-L * 0.48, 0, H * 0.42], "inlet", (math.pi / 2, [0, 1, 0]))
add_cylinder(pump, 0.035, 0.09, [-L * 0.18, 0, H * 0.72], "outlet")
export(pump, "astralpool-victoria-plus-silent-vs-67547-g2-proxy.glb")
