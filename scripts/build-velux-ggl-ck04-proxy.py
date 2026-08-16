from pathlib import Path
import json
import trimesh

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "config/geometry/velux-ggl-ck04-target.json").read_text())
OUT = ROOT / "data/geometry/avatars"
METRICS = ROOT / "data/metrics"
OUT.mkdir(parents=True, exist_ok=True)
METRICS.mkdir(parents=True, exist_ok=True)

# Verified manufacturer dimensions, converted to metres.
W = CFG["verified_geometry_envelope"]["outer_width_mm"] / 1000
H = CFG["verified_geometry_envelope"]["outer_height_mm"] / 1000
OW = CFG["verified_geometry_envelope"]["opening_width_mm"] / 1000
OH = CFG["verified_geometry_envelope"]["opening_height_mm"] / 1000
GW = CFG["verified_geometry_envelope"]["visible_glazing_width_mm"] / 1000
GH = CFG["verified_geometry_envelope"]["visible_glazing_height_mm"] / 1000

# DEPTH IS A PROXY ONLY. VELUX frame profile depth has not been verified for this target.
D = 0.050
FRAME_D = 0.045
SASH_D = 0.030
GLASS_D = 0.006

scene = trimesh.Scene()

def box(name, extents, xyz):
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(xyz)
    scene.add_geometry(mesh, node_name=name)

# Outer frame rails. Rail sizes are derived only from verified outer/opening envelopes.
side = max((W - OW) / 2, 0.001)
top_bottom = max((H - OH) / 2, 0.001)
box("outer_frame_left", [side, FRAME_D, H], [-W/2 + side/2, 0, H/2])
box("outer_frame_right", [side, FRAME_D, H], [W/2 - side/2, 0, H/2])
box("outer_frame_bottom", [OW, FRAME_D, top_bottom], [0, 0, top_bottom/2])
box("outer_frame_top", [OW, FRAME_D, top_bottom], [0, 0, H - top_bottom/2])

# Sash rails use the verified opening envelope outside and visible glazing envelope inside.
sash_side = max((OW - GW) / 2, 0.001)
sash_tb = max((OH - GH) / 2, 0.001)
opening_z0 = top_bottom
box("sash_left", [sash_side, SASH_D, OH], [-OW/2 + sash_side/2, -0.004, opening_z0 + OH/2])
box("sash_right", [sash_side, SASH_D, OH], [OW/2 - sash_side/2, -0.004, opening_z0 + OH/2])
box("sash_bottom", [GW, SASH_D, sash_tb], [0, -0.004, opening_z0 + sash_tb/2])
box("sash_top", [GW, SASH_D, sash_tb], [0, -0.004, opening_z0 + OH - sash_tb/2])

# Neutral glass plane; no proprietary finish or glazing appearance is copied.
box("visible_glazing_proxy", [GW, GLASS_D, GH], [0, -0.008, opening_z0 + sash_tb + GH/2])

# Thin top-control schematic bar: generic proxy, not exact industrial-design geometry.
control_h = min(0.020, sash_tb * 0.35)
box("top_control_bar_proxy", [GW * 0.92, 0.012, control_h], [0, -0.027, opening_z0 + OH - sash_tb/2])

asset = OUT / "velux-ggl-ck04-g2-system-proxy.glb"
asset.write_bytes(scene.export(file_type="glb"))

loaded = trimesh.load(asset, force="scene")
bounds = loaded.bounds
extents = bounds[1] - bounds[0]
# X=verified width, Z=verified height. Y is intentionally a proxy depth.
width_mm = float(extents[0] * 1000)
depth_mm = float(extents[1] * 1000)
height_mm = float(extents[2] * 1000)
width_err = abs(width_mm - CFG["verified_geometry_envelope"]["outer_width_mm"]) / CFG["verified_geometry_envelope"]["outer_width_mm"]
height_err = abs(height_mm - CFG["verified_geometry_envelope"]["outer_height_mm"]) / CFG["verified_geometry_envelope"]["outer_height_mm"]
qa_pass = width_err <= 0.002 and height_err <= 0.002

metric = {
    "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    "target_id": CFG["target_id"],
    "avatar_id": "AVATAR_VELUX_GGL_CK04_G2_SYSTEM_PROXY",
    "status": "G2_PROXY_SCALE_PASS" if qa_pass else "SCALE_FAIL",
    "promotion_level": "G2" if qa_pass else "G0",
    "asset_path": str(asset.relative_to(ROOT)),
    "asset_bytes": asset.stat().st_size,
    "verified_axes": {"width_mm": width_mm, "height_mm": height_mm},
    "proxy_axis": {"depth_mm": depth_mm, "reason": "product frame/profile depth not yet source-verified"},
    "expected": {
        "outer_width_mm": CFG["verified_geometry_envelope"]["outer_width_mm"],
        "outer_height_mm": CFG["verified_geometry_envelope"]["outer_height_mm"],
        "opening_width_mm": CFG["verified_geometry_envelope"]["opening_width_mm"],
        "opening_height_mm": CFG["verified_geometry_envelope"]["opening_height_mm"],
        "visible_glazing_width_mm": CFG["verified_geometry_envelope"]["visible_glazing_width_mm"],
        "visible_glazing_height_mm": CFG["verified_geometry_envelope"]["visible_glazing_height_mm"]
    },
    "relative_error": {"width": width_err, "height": height_err},
    "disclosure": "Dimension-verified G2 system proxy. Width/height/opening/glazing envelopes are manufacturer-sourced; depth, frame profile and industrial-design details are simplified proxy geometry.",
    "system_rules": CFG["verified_system_rules"],
    "next_gate": "official VELUX BIM geometry + rights/access + exact variant commerce"
}
(METRICS / "velux-ggl-ck04-g2-proxy-latest.json").write_text(json.dumps(metric, indent=2))
print(json.dumps(metric, indent=2))
if not qa_pass:
    raise SystemExit("VELUX proxy failed verified width/height scale QA")
