#!/usr/bin/env python3
"""Render deterministic seven-view QA evidence for the four Room Alpha avatars."""
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/geometry/manifests/furniture-avatar-manifest-v0.1.json"
OUT = ROOT / "data/evidence/furniture-avatar-manifest-v0.1-qa-pack"
METRIC = ROOT / "data/metrics/furniture-avatar-manifest-v0.1-qa.json"
REVIEW = ROOT / "data/evidence/furniture-avatar-manifest-v0.1-visual-review.json"

spec = importlib.util.spec_from_file_location("design_asset_renderer", ROOT / "scripts/render-design-asset-qa-pack.py")
renderer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = renderer
spec.loader.exec_module(renderer)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def master_sheet(records):
    tile_w, tile_h, columns = 480, 300, 2
    rows = math.ceil(len(records) / columns)
    sheet = Image.new("RGB", (tile_w * columns, tile_h * rows + 44), (247, 248, 250))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 15), "Furniture Avatar Manifest v0.1 — canonical QA", fill=(22, 26, 32))
    for i, record in enumerate(records):
        contact = Image.open(OUT / record["asset_directory"] / "contact-sheet.png").convert("RGB")
        contact.thumbnail((tile_w - 14, tile_h - 34), Image.Resampling.LANCZOS)
        x = (i % columns) * tile_w + (tile_w - contact.width) // 2
        y = 44 + (i // columns) * tile_h
        sheet.paste(contact, (x, y))
        draw.text(((i % columns) * tile_w + 10, y + tile_h - 25), record["asset_id"], fill=(32, 36, 44))
    destination = OUT / "all-assets-contact-sheet.png"
    sheet.save(destination, format="PNG", optimize=True)
    return destination

def main():
    manifest = json.loads(MANIFEST.read_text())
    review = json.loads(REVIEW.read_text()) if REVIEW.exists() else None
    reviews = {item["asset_id"]: item for item in review.get("assets", [])} if review else {}
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for asset in [a for a in manifest["assets"] if a["primary_selection"]]:
        glb_path = ROOT / asset["geometry"]["uri"]
        glb = renderer.Glb(glb_path)
        front = asset["orientation"]["front_vector"]
        view_specs = dict(renderer.VIEW_SPECS)
        if front is not None:
            # Renderer direction is camera position from target; view along the
            # declared focal vector means placing the camera opposite it.
            camera = tuple(-v for v in front)
            view_specs["front"] = {"direction": camera, "up": (0,1,0), "target_y": .48}
            view_specs["rear"] = {"direction": tuple(-v for v in camera), "up": (0,1,0), "target_y": .48}
            view_specs["three_quarter"] = {"direction": (camera[0]+1, .42, camera[2]+1), "up": (0,1,0), "target_y": .42}
            view_specs["floor_contact"] = {"direction": (camera[0]+1, .16, camera[2]+1), "up": (0,1,0), "target_y": .12}
        renderer.VIEW_SPECS = view_specs
        asset_dir_name = asset["asset_id"].lower()
        asset_dir = OUT / asset_dir_name
        views = [renderer.render_view(glb, name, asset_dir / f"{name}.png", asset["dimensions"], {"model_rotation":{"declared":True},"back_face_shown":False}) for name in view_specs]
        contact = renderer.contact_sheet(asset["asset_id"], views, asset_dir)
        positions = glb.all_positions(); bounds_min=positions.min(axis=0); bounds_max=positions.max(axis=0); center=(bounds_min+bounds_max)*.5
        measured = {"width":float((bounds_max[0]-bounds_min[0])*1000),"depth":float((bounds_max[2]-bounds_min[2])*1000),"height":float((bounds_max[1]-bounds_min[1])*1000),"unit":"mm"}
        errors = [abs(measured[k]-asset["dimensions"][k])/asset["dimensions"][k] for k in ("width","depth","height")]
        records.append({
            "asset_id":asset["asset_id"],"role":asset["role"],"asset_directory":asset_dir_name,
            "geometry_sha256":sha(glb_path),"declared_dimensions":asset["dimensions"],"measured_dimensions":measured,
            "automated_checks":{"all_seven_views_rendered":len(views)==7,"floor_contact_error_mm":abs(float(bounds_min[1])*1000),"centre_pivot_offset_mm":{"x":abs(float(center[0])*1000),"z":abs(float(center[2])*1000)},"max_dimension_relative_error":max(errors),"material_count":len(glb.materials),"embedded_texture_count":sum(m.texture is not None for m in glb.materials)},
            "orientation_contract":asset["orientation"],"views":views,"contact_sheet":{"file":contact.name,"sha256":sha(contact),"bytes":contact.stat().st_size},
            "manual_review":reviews.get(asset["asset_id"], {"state":"PENDING_INDEPENDENT_REVIEW"}),"publication":{"public_allowed":False,"rights_state":asset["rights"]["rendering_state"],"attribution_display_state":asset["attribution"]["display_state"]}
        })
    master = master_sheet(records)
    metric={"version":"0.1","record_type":"FURNITURE_AVATAR_CANONICAL_QA","manifest":"data/geometry/manifests/furniture-avatar-manifest-v0.1.json","renderer":"scripts/render-furniture-avatar-manifest-qa.py","review_evidence":str(REVIEW.relative_to(ROOT)) if review else None,"review_evidence_sha256":sha(REVIEW) if review else None,"policy":"Committed canonical renders prove inspectable geometry behavior only; rights, exact finish, attribution UI, and public publication remain independent gates.","view_contract":list(renderer.VIEW_SPECS),"summary":{"assets":len(records),"views_per_asset":7,"rendered_views":sum(len(r["views"]) for r in records),"reviewed_assets":sum(1 for r in records if r["manual_review"].get("overall")=="PASS_G2_PLANNING_QA"),"publicly_publishable":0},"qa_pack":{"git_policy":"COMMITTED_REVIEW_EVIDENCE","directory":str(OUT.relative_to(ROOT)),"master_contact_sheet":master.name,"master_contact_sheet_sha256":sha(master)},"assets":records}
    METRIC.write_text(json.dumps(metric,indent=2)+"\n")
    print(json.dumps(metric["summary"],indent=2))

if __name__ == "__main__": main()
