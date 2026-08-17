from pathlib import Path
import datetime
import json
import trimesh

ROOT = Path(__file__).resolve().parents[1]
TARGET_PATH = ROOT / "config/geometry/ikea-melodi-60386527-target.json"
ASSET_PATH = ROOT / "data/geometry/avatars/ikea-melodi-60386527-g2-pendant-proxy.glb"
METRIC_PATH = ROOT / "data/metrics/ikea-melodi-60386527-g2-proxy-latest.json"

target = json.loads(TARGET_PATH.read_text())
diameter_m = target["dimensions_mm"]["diameter"] / 1000
height_m = target["dimensions_mm"]["shade_height"] / 1000

scene = trimesh.Scene()

# A neutral rotational envelope is intentionally used instead of copying the
# product silhouette. It proves physical scale and placement, not exact likeness.
shade = trimesh.creation.cone(radius=diameter_m / 2, height=height_m, sections=64)
shade.apply_translation([0, 0, height_m / 2])
scene.add_geometry(shade, node_name="melodi_shade_envelope_proxy")

# The E27 cue stays inside the official fixed-height envelope.
cap = trimesh.creation.cylinder(radius=0.022, height=0.03, sections=32)
cap.apply_translation([0, 0, height_m - 0.015])
scene.add_geometry(cap, node_name="e27_interface_cue")

ASSET_PATH.parent.mkdir(parents=True, exist_ok=True)
METRIC_PATH.parent.mkdir(parents=True, exist_ok=True)
ASSET_PATH.write_bytes(scene.export(file_type="glb"))

loaded = trimesh.load(ASSET_PATH, force="scene")
extents_mm = (loaded.bounds[1] - loaded.bounds[0]) * 1000
measured_diameter = float(max(extents_mm[0], extents_mm[1]))
measured_height = float(extents_mm[2])
diameter_error = abs(measured_diameter - target["dimensions_mm"]["diameter"]) / target["dimensions_mm"]["diameter"]
height_error = abs(measured_height - target["dimensions_mm"]["shade_height"]) / target["dimensions_mm"]["shade_height"]
passed = max(diameter_error, height_error) <= 0.002

metric = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "target_id": target["target_id"],
    "avatar_id": "AVATAR_IKEA_MELODI_60386527_G2_PENDANT_PROXY",
    "status": "G2_PROXY_SCALE_COMMERCE_PASS" if passed else "SCALE_FAIL",
    "promotion_level": "G2" if passed else "G0",
    "asset_path": str(ASSET_PATH.relative_to(ROOT)),
    "asset_bytes": ASSET_PATH.stat().st_size,
    "verified_fixed_envelope_mm": {
        "diameter": target["dimensions_mm"]["diameter"],
        "height": target["dimensions_mm"]["shade_height"],
    },
    "measured_fixed_envelope_mm": {
        "diameter": measured_diameter,
        "height": measured_height,
    },
    "relative_error": {
        "diameter": diameter_error,
        "height": height_error,
    },
    "parametric_placement": {
        "cord_length_mm": target["dimensions_mm"]["cord_length"],
        "note": "Cord/drop is adjustable placement metadata and is not part of the fixed shade mesh.",
    },
    "specification": target["specification"],
    "commerce_reference": target["commerce_reference"],
    "disclosure": "Exact IKEA MELODI article identity, Spain commerce reference and official dimensions/specification. Product Twin-owned G2 geometry is a neutral rotational envelope proxy; exact IKEA industrial-design shape is not claimed.",
    "next_gate": "authorized exact geometry/render rights + photometric data + live stock/delivery refresh",
}
METRIC_PATH.write_text(json.dumps(metric, indent=2) + "\n")

print(json.dumps(metric, indent=2))
if not passed:
    raise SystemExit("IKEA MELODI proxy failed scale QA")
