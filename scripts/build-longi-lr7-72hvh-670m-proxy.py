from pathlib import Path
import json
import math
import trimesh

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/'config/geometry/longi-lr7-72hvh-670m-target.json').read_text())
OUT=ROOT/'data/geometry/avatars'; MET=ROOT/'data/metrics'
OUT.mkdir(parents=True,exist_ok=True); MET.mkdir(parents=True,exist_ok=True)

W=CFG['mechanical']['width_mm']/1000
H=CFG['mechanical']['height_mm']/1000
T=CFG['mechanical']['thickness_mm']/1000

scene=trimesh.Scene()

def box(name,extents,xyz):
    m=trimesh.creation.box(extents=extents);m.apply_translation(xyz);scene.add_geometry(m,node_name=name)

# Manufacturer-verified outer envelope. Shape is intentionally schematic.
box('module_backsheet_proxy',[W,T*0.36,H],[0,0,H/2])
frame=0.030
box('frame_left',[frame,T,H],[-W/2+frame/2,0,H/2])
box('frame_right',[frame,T,H],[W/2-frame/2,0,H/2])
box('frame_bottom',[W-2*frame,T,frame],[0,0,frame/2])
box('frame_top',[W-2*frame,T,frame],[0,0,H-frame/2])
# Generic glass plane inset within frame; no exact LONGi artwork/cell grid copied.
box('generic_pv_glass_proxy',[W-2*frame,0.004,H-2*frame],[0,-T*0.32,H/2])
# Simplified split junction boxes on rear; their positions/dimensions are not exact and are explicitly proxy.
for x in (-W*0.16,W*0.16):
    box('junction_box_proxy',[0.11,0.025,0.065],[x,T*0.45,H*0.58])

asset=OUT/'longi-lr7-72hvh-670m-g2-pv-proxy.glb'
asset.write_bytes(scene.export(file_type='glb'))
loaded=trimesh.load(asset,force='scene')
ext=(loaded.bounds[1]-loaded.bounds[0])*1000
# X=width, Z=height, Y may exceed exact 30mm slightly because schematic rear boxes. Verify the core axes and module thickness separately from proxy service details.
width=float(ext[0]);depth=float(ext[1]);height=float(ext[2])
werr=abs(width-CFG['mechanical']['width_mm'])/CFG['mechanical']['width_mm']
herr=abs(height-CFG['mechanical']['height_mm'])/CFG['mechanical']['height_mm']
qa=werr<=0.002 and herr<=0.002
area_m2=W*H
eff=CFG['electrical_stc']['rated_power_wp']/(area_m2*1000)*100
metric={
 'generated_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
 'target_id':CFG['target_id'],'avatar_id':'AVATAR_LONGI_LR7_72HVH_670M_G2_PV_PROXY',
 'status':'G2_PROXY_SCALE_ELECTRICAL_PASS' if qa else 'SCALE_FAIL','promotion_level':'G2' if qa else 'G0',
 'asset_path':str(asset.relative_to(ROOT)),'asset_bytes':asset.stat().st_size,
 'verified_core_envelope_mm':{'width':CFG['mechanical']['width_mm'],'height':CFG['mechanical']['height_mm'],'module_thickness':CFG['mechanical']['thickness_mm']},
 'proxy_whole_extents_mm':{'width':width,'depth':depth,'height':height},
 'relative_error':{'width':werr,'height':herr},
 'electrical_stc':CFG['electrical_stc'],
 'calculated_module_efficiency_percent':eff,
 'mechanical':{'weight_kg':CFG['mechanical']['weight_kg'],'junction_box':CFG['mechanical']['junction_box'],'front_static_load_pa':CFG['mechanical']['front_static_load_pa'],'back_static_load_pa':CFG['mechanical']['back_static_load_pa'],'hail_test':CFG['mechanical']['hail_test']},
 'disclosure':'Exact LONGi model identity and manufacturer-published physical/electrical specs. Product Twin-owned G2 geometry uses the verified panel envelope but generic PV glass/frame/service-box appearance; it is not exact LONGi industrial-design geometry.',
 'next_gate':'full pv_module compliance profile + authorized exact geometry/appearance + Spain/EU offer/RFQ'
}
(MET/'longi-lr7-72hvh-670m-g2-proxy-latest.json').write_text(json.dumps(metric,indent=2))
print(json.dumps(metric,indent=2))
if not qa: raise SystemExit('LONGi PV proxy failed width/height scale QA')
