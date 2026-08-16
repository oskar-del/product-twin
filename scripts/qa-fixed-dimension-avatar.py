import json, math, os
from pathlib import Path
import trimesh

ROOT=Path(__file__).resolve().parents[1]
target_path=os.environ.get('AVATAR_TARGET')
if not target_path: raise SystemExit('AVATAR_TARGET is required')
target=json.loads((ROOT/target_path).read_text())
slug=target['target_id'].lower()
import re
slug=re.sub(r'[^a-z0-9]+','-',slug).strip('-')
runtime=ROOT/'.runtime'/slug
capture_path=ROOT/'data/metrics'/f'{slug}-3ds-capture-latest.json'
capture=json.loads(capture_path.read_text()) if capture_path.exists() else {}
glb=runtime/'model.glb'
out_path=ROOT/'data/metrics'/f'{slug}-glb-qa-latest.json'

out={'generated_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'target_id':target['target_id'],'capture_status':capture.get('status'),'qa_status':'NO_CONVERTED_GLB','promotion_level':'G0','exact_geometry':False,'rights_state':'review'}
if glb.exists() and capture.get('status')=='EXACT_MANUFACTURER_3DS_CAPTURED':
    try:
        obj=trimesh.load(glb,force='scene'); scene=obj if isinstance(obj,trimesh.Scene) else trimesh.Scene(obj)
        raw_sorted=sorted(float(x) for x in scene.extents)
        expected=sorted(float(x) for x in target['physical']['dimensions_mm_sorted'])
        tests=[]
        for unit,factor in [('millimeters',1.0),('centimeters',10.0),('meters',1000.0)]:
            measured=[x*factor for x in raw_sorted]
            rel=[abs(measured[i]-expected[i])/expected[i] for i in range(3)]
            tests.append({'unit':unit,'factor':factor,'extents_mm_sorted':measured,'relative_errors':rel,'rms':math.sqrt(sum(x*x for x in rel)/3),'max':max(rel)})
        best=min(tests,key=lambda x:x['rms']); tol=float(target['physical'].get('qa_tolerance_percent',5))/100
        passed=best['max']<=tol
        out.update({'qa_status':'EXACT_GEOMETRY_SCALE_PASS_RIGHTS_REVIEW' if passed else 'SCALE_FAIL','promotion_level':'G3_CANDIDATE' if passed else 'G0','exact_geometry':bool(passed),'source_asset_sha256':capture.get('asset',{}).get('sha256'),'source_url':capture.get('asset',{}).get('source_url'),'best_unit_hypothesis':best['unit'],'extents_mm_sorted':best['extents_mm_sorted'],'expected_mm_sorted':expected,'max_relative_error':best['max'],'rms_relative_error':best['rms'],'geometry_stats':{'mesh_count':len(scene.geometry),'vertices':sum(len(g.vertices) for g in scene.geometry.values() if hasattr(g,'vertices')),'faces':sum(len(g.faces) for g in scene.geometry.values() if hasattr(g,'faces'))},'remaining_blockers':(['confirm Product Twin render/derivative/persistent-storage rights','resolve exact live commerce or RFQ identity'] if passed else ['manufacturer geometry scale does not match verified fixed dimensions'])})
    except Exception as e: out.update({'qa_status':'GLB_LOAD_FAILED','error':str(e)})
out_path.write_text(json.dumps(out,indent=2))
print(json.dumps({'metric':str(out_path.relative_to(ROOT)),'target_id':out['target_id'],'qa_status':out['qa_status'],'promotion_level':out['promotion_level'],'extents_mm_sorted':out.get('extents_mm_sorted'),'max_relative_error':out.get('max_relative_error')},indent=2))
