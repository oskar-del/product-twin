import json
from pathlib import Path
import math
import trimesh

ROOT=Path(__file__).resolve().parents[1]
TARGET=json.loads((ROOT/'config/geometry/arper-ralik-7417-target.json').read_text())
CAP=json.loads((ROOT/'data/metrics/arper-ralik-7417-3ds-capture-latest.json').read_text()) if (ROOT/'data/metrics/arper-ralik-7417-3ds-capture-latest.json').exists() else {}
GLB=ROOT/'.runtime/arper-ralik-7417/model.glb'
OUT=ROOT/'data/metrics/arper-ralik-7417-glb-qa-latest.json'

out={
  'generated_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
  'target_id':TARGET['target_id'],
  'capture_status':CAP.get('status'),
  'qa_status':'NO_CONVERTED_GLB',
  'promotion_level':'G0',
  'exact_geometry':False,
  'rights_state':'review'
}

if GLB.exists() and CAP.get('status')=='EXACT_MANUFACTURER_3DS_CAPTURED':
  try:
    obj=trimesh.load(GLB,force='scene')
    scene=obj if isinstance(obj,trimesh.Scene) else trimesh.Scene(obj)
    raw=sorted(float(x) for x in scene.extents)
    exp=sorted(float(x) for x in TARGET['physical']['dimensions_mm_sorted'])
    tests=[]
    for unit,factor in [('millimeters',1.0),('centimeters',10.0),('meters',1000.0)]:
      m=[x*factor for x in raw]
      rel=[abs(m[i]-exp[i])/exp[i] for i in range(3)]
      tests.append({'unit':unit,'factor':factor,'extents_mm_sorted':m,'relative_errors':rel,'rms':math.sqrt(sum(x*x for x in rel)/3),'max':max(rel)})
    best=min(tests,key=lambda x:x['rms'])
    tol=TARGET['physical']['qa_tolerance_percent']/100
    passed=best['max']<=tol
    out.update({
      'qa_status':'EXACT_GEOMETRY_SCALE_PASS_RIGHTS_REVIEW' if passed else 'SCALE_FAIL',
      'promotion_level':'G3_CANDIDATE' if passed else 'G0',
      'exact_geometry':bool(passed),
      'source_asset_sha256':CAP.get('asset',{}).get('sha256'),
      'source_url':CAP.get('asset',{}).get('source_url'),
      'best_unit_hypothesis':best['unit'],
      'extents_mm_sorted':best['extents_mm_sorted'],
      'expected_mm_sorted':exp,
      'max_relative_error':best['max'],
      'rms_relative_error':best['rms'],
      'geometry_stats':{
        'mesh_count':len(scene.geometry),
        'vertices':sum(len(g.vertices) for g in scene.geometry.values() if hasattr(g,'vertices')),
        'faces':sum(len(g.faces) for g in scene.geometry.values() if hasattr(g,'faces'))
      },
      'remaining_blockers':(['confirm manufacturer terms for Product Twin render/derivative handling','resolve live commerce or RFQ for exact article/configuration'] if passed else ['manufacturer geometry scale does not match verified product dimensions'])
    })
  except Exception as e:
    out.update({'qa_status':'GLB_LOAD_FAILED','error':str(e)})

OUT.write_text(json.dumps(out,indent=2))
print(json.dumps({k:out.get(k) for k in ['target_id','qa_status','promotion_level','extents_mm_sorted','max_relative_error']},indent=2))
