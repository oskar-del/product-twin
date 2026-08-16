from pathlib import Path
import json
import trimesh

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / "config/geometry/gf-sanipex-1158140-target.json").read_text())
OUT = ROOT / "data/geometry/avatars"
METRICS = ROOT / "data/metrics"
OUT.mkdir(parents=True, exist_ok=True)
METRICS.mkdir(parents=True, exist_ok=True)

# Manufacturer-verified outer packaging/item envelope for the exact article.
L = CFG["physical"]["unit_envelope_mm"]["length"] / 1000
W = CFG["physical"]["unit_envelope_mm"]["width"] / 1000
H = CFG["physical"]["unit_envelope_mm"]["height"] / 1000
ID = CFG["physical"]["measurements_mm"]["inner_diameter"] / 1000

scene = trimesh.Scene()

# Product Twin-owned schematic fitting geometry. It deliberately represents the verified envelope
# and d16 connection, not GF's protected industrial-design geometry.
# Main body aligned on X, using a conservative circular 25 mm envelope.
body = trimesh.creation.cylinder(radius=min(W,H)/2, height=L, sections=48)
# trimesh cylinder is Z-aligned; rotate to X.
body.apply_transform(trimesh.transformations.rotation_matrix(__import__('math').pi/2, [0,1,0]))
scene.add_geometry(body, node_name="proxy_body_25mm_envelope")

# d16 connector/bore cues at both ends: schematic, not a boolean/exact connection profile.
for side, x in [("a", -L/2 - 0.002), ("b", L/2 + 0.002)]:
    ring = trimesh.creation.annulus(r_min=ID/2, r_max=min(W,H)*0.46, height=0.004, sections=48)
    ring.apply_transform(trimesh.transformations.rotation_matrix(__import__('math').pi/2, [0,1,0]))
    ring.apply_translation([x,0,0])
    scene.add_geometry(ring, node_name=f"d16_interface_{side}_schematic")

asset = OUT / "gf-sanipex-1158140-g2-system-proxy.glb"
asset.write_bytes(scene.export(file_type="glb"))

loaded = trimesh.load(asset, force="scene")
extents = (loaded.bounds[1] - loaded.bounds[0]) * 1000
# The interface cue rings add 4 mm beyond the body on each side, so body envelope QA is represented
# separately from whole proxy extents. We validate cross-section exactly and ensure total proxy stays close.
cross = sorted([float(extents[1]), float(extents[2])])
expected_cross = sorted([CFG["physical"]["unit_envelope_mm"]["width"], CFG["physical"]["unit_envelope_mm"]["height"]])
err_cross = max(abs(c-e)/e for c,e in zip(cross, expected_cross))
qa_pass = err_cross <= 0.01 and 45 <= float(extents[0]) <= 55

metric = {
  "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
  "target_id": CFG["target_id"],
  "avatar_id": "AVATAR_GF_SANIPEX_MT_1158140_G2_SYSTEM_PROXY",
  "status": "G2_PROXY_SCALE_INTERFACE_PASS" if qa_pass else "SCALE_FAIL",
  "promotion_level": "G2" if qa_pass else "G0",
  "asset_path": str(asset.relative_to(ROOT)),
  "asset_bytes": asset.stat().st_size,
  "exact_identity": {
    "manufacturer_part_no": CFG["manufacturer_part_no"],
    "gf_item_no": CFG["gf_item_no"],
    "ean": CFG["ean"],
    "etim_class": CFG["etim_class"]
  },
  "verified_product_envelope_mm": CFG["physical"]["unit_envelope_mm"],
  "verified_interface": CFG["interface_model"],
  "proxy_whole_extents_mm": {"x": float(extents[0]), "y": float(extents[1]), "z": float(extents[2])},
  "cross_section_relative_error": err_cross,
  "disclosure": "Exact identity + manufacturer-dimensioned G2 system proxy. Shape/threads/connection detailing are schematic and must not be interpreted as GF manufacturer geometry.",
  "g4_state": "official BIM identity/formats verified but geometry download requires account",
  "next_gate": "authorized manufacturer BIM retrieval + scale/interface QA + Spain/EU procurement"
}
(METRICS / "gf-sanipex-1158140-g2-proxy-latest.json").write_text(json.dumps(metric, indent=2))
print(json.dumps(metric, indent=2))
if not qa_pass:
    raise SystemExit("GF Sanipex G2 proxy failed scale/interface QA")
