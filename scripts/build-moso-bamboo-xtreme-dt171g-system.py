from pathlib import Path
import json, math
import trimesh

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/'config/geometry/moso-bamboo-xtreme-dt171g-target.json').read_text())
OUT=ROOT/'data/geometry/avatars'; MET=ROOT/'data/metrics'
OUT.mkdir(parents=True,exist_ok=True); MET.mkdir(parents=True,exist_ok=True)

L=CFG['module']['length_mm']/1000
W=CFG['module']['width_mm']/1000
T=CFG['module']['thickness_mm']/1000
G=CFG['installation']['joint_gap_mm']['design_default']/1000

# Single exact-envelope board proxy plus 3-board repeat assembly.
scene=trimesh.Scene()
for i in range(3):
    y=(i-1)*(W+G)
    board=trimesh.creation.box(extents=[L,W,T])
    board.apply_translation([L/2,y,T/2])
    scene.add_geometry(board,node_name=f'board_{i+1}_exact_envelope_proxy')
asset=OUT/'moso-bamboo-xtreme-bo-dtht171g-g2-system-proxy.glb'
asset.write_bytes(scene.export(file_type='glb'))

loaded=trimesh.load(asset,force='scene')
ext=(loaded.bounds[1]-loaded.bounds[0])*1000
expected_x=CFG['module']['length_mm']
expected_y=3*CFG['module']['width_mm']+2*CFG['installation']['joint_gap_mm']['design_default']
expected_z=CFG['module']['thickness_mm']
errs={
 'length':abs(float(ext[0])-expected_x)/expected_x,
 'repeat_width':abs(float(ext[1])-expected_y)/expected_y,
 'thickness':abs(float(ext[2])-expected_z)/expected_z
}
qa=max(errs.values())<=0.002

pitch_m=W+G
effective_area_per_board_m2=L*pitch_m
boards_per_m2=1/effective_area_per_board_m2
area=CFG['takeoff']['default_test_area_m2']
waste=CFG['takeoff']['default_waste_percent']/100
raw=area*boards_per_m2
with_waste=raw*(1+waste)
ordered=math.ceil(with_waste)
ordered_nominal_board_area=ordered*(L*W)

metric={
 'generated_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
 'target_id':CFG['target_id'],'avatar_id':'AVATAR_MOSO_BAMBOO_XTREME_BO_DTHT171G_G2_SYSTEM_PROXY',
 'status':'G2_REPEAT_TAKEOFF_PASS' if qa else 'SCALE_FAIL','promotion_level':'G2' if qa else 'G0',
 'asset_path':str(asset.relative_to(ROOT)),'asset_bytes':asset.stat().st_size,
 'module_mm':CFG['module'],'joint_gap_mm':CFG['installation']['joint_gap_mm'],
 'three_board_repeat_expected_mm':{'length':expected_x,'width':expected_y,'thickness':expected_z},
 'three_board_repeat_measured_mm':{'length':float(ext[0]),'width':float(ext[1]),'thickness':float(ext[2])},
 'relative_error':errs,
 'takeoff_test':{
   'area_m2':area,'design_gap_mm':CFG['installation']['joint_gap_mm']['design_default'],
   'effective_repeat_pitch_mm':pitch_m*1000,
   'effective_coverage_per_full_board_m2':effective_area_per_board_m2,
   'preliminary_boards_per_m2':boards_per_m2,
   'raw_board_count':raw,
   'waste_percent':CFG['takeoff']['default_waste_percent'],
   'board_count_after_waste_rounded_up':ordered,
   'ordered_nominal_board_face_area_m2':ordered_nominal_board_area,
   'caution':CFG['takeoff']['caution']
 },
 'installation':{'method':CFG['installation']['method'],'bim_file_available':CFG['installation']['bim_file_available']},
 'disclosure':'Exact MOSO product-family/code and manufacturer-published board dimensions/joint range. Product Twin-owned G2 board geometry is a rectangular module proxy; exact groove/bevel profile and proprietary appearance are not claimed.',
 'next_gate':'authorized profile/PBR geometry + live Spain/EU offer/RFQ + project-specific fixing/joist layout'
}
(MET/'moso-bamboo-xtreme-dt171g-g2-system-latest.json').write_text(json.dumps(metric,indent=2))
print(json.dumps(metric,indent=2))
if not qa: raise SystemExit('MOSO repeat system failed module/joint scale QA')
