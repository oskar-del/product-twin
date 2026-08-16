from pathlib import Path
import json
import trimesh

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/geometry/avatars'; MET=ROOT/'data/metrics'
OUT.mkdir(parents=True,exist_ok=True); MET.mkdir(parents=True,exist_ok=True)


def now():
    return __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()

def add_box(scene,name,extents,xyz):
    m=trimesh.creation.box(extents=extents);m.apply_translation(xyz);scene.add_geometry(m,node_name=name)

# --- ROCA A32727500B ---
roca=json.loads((ROOT/'config/geometry/roca-a32727500b-basin-target.json').read_text())
L=roca['dimensions_mm']['length']/1000
W=roca['dimensions_mm']['width']/1000
H=roca['dimensions_mm']['height']/1000
scene=trimesh.Scene()
# Product Twin-owned schematic countertop basin: exact outer envelope, generic rim/bowl representation.
rim=0.028
base=0.010
add_box(scene,'basin_base_proxy',[L,W,base],[0,0,base/2])
add_box(scene,'rim_front',[L,rim,H],[0,-W/2+rim/2,H/2])
add_box(scene,'rim_back',[L,rim,H],[0,W/2-rim/2,H/2])
add_box(scene,'rim_left',[rim,W-2*rim,H],[-L/2+rim/2,0,H/2])
add_box(scene,'rim_right',[rim,W-2*rim,H],[L/2-rim/2,0,H/2])
# Generic central drain cue, not exact Roca geometry.
drain=trimesh.creation.cylinder(radius=0.018,height=0.006,sections=48);drain.apply_translation([0,0,base+0.003]);scene.add_geometry(drain,node_name='drain_cue_proxy')
roca_asset=OUT/'roca-a32727500b-g2-basin-proxy.glb';roca_asset.write_bytes(scene.export(file_type='glb'))
loaded=trimesh.load(roca_asset,force='scene');ext=(loaded.bounds[1]-loaded.bounds[0])*1000
expected=[roca['dimensions_mm']['length'],roca['dimensions_mm']['width'],roca['dimensions_mm']['height']]
errs=[abs(float(a)-b)/b for a,b in zip(ext,expected)];roca_pass=max(errs)<=0.002
roca_metric={
 'generated_at':now(),'target_id':roca['target_id'],'avatar_id':'AVATAR_ROCA_A32727500B_G2_BASIN_PROXY',
 'status':'G2_PROXY_SCALE_COMMERCE_PASS' if roca_pass else 'SCALE_FAIL','promotion_level':'G2' if roca_pass else 'G0',
 'asset_path':str(roca_asset.relative_to(ROOT)),'asset_bytes':roca_asset.stat().st_size,
 'expected_mm':{'length':expected[0],'width':expected[1],'height':expected[2]},
 'measured_mm':{'length':float(ext[0]),'width':float(ext[1]),'height':float(ext[2])},'relative_error_max':max(errs),
 'specification':roca['specification'],'commerce_reference':roca['commerce_reference'],
 'disclosure':'Exact Roca product reference, dimensions, installation/spec and direct-Spain commerce reference. Product Twin-owned G2 geometry is a schematic basin envelope; exact Roca industrial-design shape is not claimed.',
 'next_gate':'authorized exact CAD/BIM geometry + connection geometry + live price/stock refresh'
}
(MET/'roca-a32727500b-g2-proxy-latest.json').write_text(json.dumps(roca_metric,indent=2))

# --- IKEA SKURUP 804.071.14 ---
ikea=json.loads((ROOT/'config/geometry/ikea-skurup-80407114-target.json').read_text())
D=ikea['dimensions_mm']['diameter']/1000
IH=ikea['dimensions_mm']['height']/1000
scene=trimesh.Scene()
# Generic cone gives the right overall pendant shade envelope without copying IKEA's exact profile.
shade=trimesh.creation.cone(radius=D/2,height=IH,sections=64)
shade.apply_translation([0,0,IH/2])
scene.add_geometry(shade,node_name='pendant_shade_proxy')
# Small E27 interface cue is kept inside the verified overall height envelope.
cap=trimesh.creation.cylinder(radius=0.022,height=0.030,sections=32);cap.apply_translation([0,0,IH-0.015]);scene.add_geometry(cap,node_name='e27_interface_cue')
ikea_asset=OUT/'ikea-skurup-80407114-g2-pendant-proxy.glb';ikea_asset.write_bytes(scene.export(file_type='glb'))
loaded=trimesh.load(ikea_asset,force='scene');ext=(loaded.bounds[1]-loaded.bounds[0])*1000
# Cylinder/cone XY axes both equal diameter; Z = height. Cord is a separate parametric placement property, not included in fixed shade bounds.
diam=float(max(ext[0],ext[1]));height=float(ext[2])
derr=abs(diam-ikea['dimensions_mm']['diameter'])/ikea['dimensions_mm']['diameter'];herr=abs(height-ikea['dimensions_mm']['height'])/ikea['dimensions_mm']['height'];ikea_pass=max(derr,herr)<=0.002
ikea_metric={
 'generated_at':now(),'target_id':ikea['target_id'],'avatar_id':'AVATAR_IKEA_SKURUP_80407114_G2_PENDANT_PROXY',
 'status':'G2_PROXY_SCALE_COMMERCE_PASS' if ikea_pass else 'SCALE_FAIL','promotion_level':'G2' if ikea_pass else 'G0',
 'asset_path':str(ikea_asset.relative_to(ROOT)),'asset_bytes':ikea_asset.stat().st_size,
 'verified_fixed_envelope_mm':{'diameter':ikea['dimensions_mm']['diameter'],'height':ikea['dimensions_mm']['height']},
 'measured_fixed_envelope_mm':{'diameter':diam,'height':height},'relative_error':{'diameter':derr,'height':herr},
 'parametric_placement':{'cord_length_mm':ikea['dimensions_mm']['cord_length'],'note':'Cord/drop is adjustable placement metadata and is not part of the fixed shade mesh.'},
 'specification':ikea['specification'],'commerce_reference':ikea['commerce_reference'],
 'disclosure':'Exact IKEA article identity, Spain commerce reference and manufacturer-published dimensions/spec. Product Twin-owned G2 shade geometry is a generic conical proxy; exact IKEA industrial-design geometry is not claimed.',
 'next_gate':'authorized exact geometry/render rights + photometric data + live stock/delivery refresh'
}
(MET/'ikea-skurup-80407114-g2-proxy-latest.json').write_text(json.dumps(ikea_metric,indent=2))

print(json.dumps({'roca':{'status':roca_metric['status'],'measured_mm':roca_metric['measured_mm']},'ikea':{'status':ikea_metric['status'],'measured_mm':ikea_metric['measured_fixed_envelope_mm']}},indent=2))
if not roca_pass or not ikea_pass:
    raise SystemExit('One or more house-finishing proxies failed scale QA')
