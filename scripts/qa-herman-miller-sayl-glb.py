import json
from pathlib import Path
import math
import trimesh

ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / "data/metrics/herman-miller-sayl-public-glb-capture-latest.json"
TARGET = ROOT / "config/geometry/herman-miller-sayl-target.json"
OUT = ROOT / "data/metrics/herman-miller-sayl-glb-qa-latest.json"

capture = json.loads(CAPTURE.read_text()) if CAPTURE.exists() else {}
target = json.loads(TARGET.read_text())
asset = capture.get("asset") or {}
runtime_path = asset.get("runtime_path")

result = {
    "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    "target_id": target.get("target_id"),
    "capture_status": capture.get("status"),
    "qa_status": "NO_PRODUCT_BOUND_ASSET",
    "promotion_level": "G0",
    "exact_product_claim_allowed": False,
    "policy": "Geometry must be product-bound and physically plausible before promotion. Manufacturer binary remains ephemeral."
}

if runtime_path and capture.get("status") == "PRODUCT_BOUND_GLB_CAPTURED_REQUIRES_SCALE_RIGHTS_QA":
    asset_file = ROOT / runtime_path
    if asset_file.exists():
        try:
            loaded = trimesh.load(asset_file, force="scene")
            if isinstance(loaded, trimesh.Trimesh):
                scene = trimesh.Scene(loaded)
            else:
                scene = loaded
            bounds = scene.bounds
            raw_extents = [float(bounds[1][i] - bounds[0][i]) for i in range(3)]
            raw_sorted = sorted(raw_extents)

            physical = target["physical"]
            h_min, h_max = physical["height_mm_range"]
            expected_sorted = sorted([
                float(physical["depth_mm"]),
                float(physical["width_adjustable_arms_mm"]),
                (float(h_min) + float(h_max)) / 2.0,
            ])
            factors = {"millimeters": 1.0, "centimeters": 10.0, "meters": 1000.0}
            tests = []
            for unit, factor in factors.items():
                measured = [x * factor for x in raw_sorted]
                rel = [abs(measured[i] - expected_sorted[i]) / expected_sorted[i] for i in range(3)]
                rms = math.sqrt(sum(x*x for x in rel) / 3.0)
                tests.append({
                    "unit_hypothesis": unit,
                    "factor_to_mm": factor,
                    "extents_mm_sorted": measured,
                    "relative_errors": rel,
                    "rms_relative_error": rms,
                    "max_relative_error": max(rel),
                })
            best = min(tests, key=lambda x: x["rms_relative_error"])
            d, w, h = best["extents_mm_sorted"]
            tol = float(physical["scale_qa"]["overall_tolerance_percent"]) / 100.0
            depth_ok = abs(d - physical["depth_mm"]) / physical["depth_mm"] <= tol
            width_ok = min(
                abs(w - physical["width_adjustable_arms_mm"]) / physical["width_adjustable_arms_mm"],
                abs(w - physical["width_fixed_arms_mm"]) / physical["width_fixed_arms_mm"],
            ) <= tol
            # Height is adjustable, so accept target range plus configured tolerance.
            height_ok = h >= h_min * (1 - tol) and h <= h_max * (1 + tol)
            hard_low, hard_high = physical["scale_qa"]["hard_reject_if_any_axis_outside_factor"]
            hard_plausible = all(
                expected_sorted[i] * hard_low <= best["extents_mm_sorted"][i] <= expected_sorted[i] * hard_high
                for i in range(3)
            )
            scale_pass = depth_ok and width_ok and height_ok and hard_plausible

            mesh_count = len(scene.geometry)
            vertex_count = sum(len(g.vertices) for g in scene.geometry.values() if hasattr(g, "vertices"))
            face_count = sum(len(g.faces) for g in scene.geometry.values() if hasattr(g, "faces"))

            result.update({
                "qa_status": "SCALE_PASS_RIGHTS_AND_CONFIGURATION_REVIEW" if scale_pass else "SCALE_FAIL",
                "promotion_level": "G2" if scale_pass else "G0",
                "asset_sha256": asset.get("sha256"),
                "asset_source_url": asset.get("source_url"),
                "asset_source_class": asset.get("source_class"),
                "raw_bounds": bounds.tolist(),
                "raw_extents": raw_extents,
                "best_unit_hypothesis": best["unit_hypothesis"],
                "extents_mm_sorted": best["extents_mm_sorted"],
                "expected_mm_sorted": expected_sorted,
                "scale_error": {
                    "rms_relative": best["rms_relative_error"],
                    "max_relative": best["max_relative_error"],
                    "depth_ok": depth_ok,
                    "width_ok": width_ok,
                    "height_ok": height_ok,
                    "hard_plausible": hard_plausible,
                },
                "geometry_stats": {
                    "mesh_count": mesh_count,
                    "vertex_count": vertex_count,
                    "face_count": face_count,
                },
                "remaining_blockers": (
                    [
                        "freeze/verify exact configured SKU and options represented by the GLB",
                        "confirm persistent storage / derivative conversion / redistribution terms",
                        "resolve exact live commerce or RFQ identity for that same configuration",
                    ] if scale_pass else ["captured GLB does not match manufacturer physical envelope"]
                ),
            })
        except Exception as exc:
            result.update({"qa_status": "GEOMETRY_LOAD_FAILED", "error": str(exc), "promotion_level": "G0"})
    else:
        result.update({"qa_status": "RUNTIME_ASSET_MISSING", "promotion_level": "G0"})

OUT.write_text(json.dumps(result, indent=2))
print(json.dumps({
    "target_id": result["target_id"],
    "qa_status": result["qa_status"],
    "promotion_level": result["promotion_level"],
    "extents_mm_sorted": result.get("extents_mm_sorted"),
}, indent=2))
