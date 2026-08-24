import assert from 'node:assert/strict';
import {buildRoomCommerceProcurementManifest,contentHash,hashObject,loadRoomCommerceSources} from './build-room-commerce-procurement-manifest.mjs';
import {validateRoomCommerceProcurementManifest} from './validate-room-commerce-procurement-manifest.mjs';

const sources=await loadRoomCommerceSources();
const clone=value=>structuredClone(value);
const build=(source=sources,options={})=>buildRoomCommerceProcurementManifest(clone(source),options);
const baseline=build();
const validate=(manifest=baseline.manifest,exportManifest=baseline.exportManifest,source=sources,options={})=>validateRoomCommerceProcurementManifest(manifest,exportManifest,clone(source),options);
const mutateManifest=(change,{changeExport=null}={})=>{
  const manifest=clone(baseline.manifest);const exportManifest=clone(baseline.exportManifest);change(manifest);
  if(changeExport)changeExport(exportManifest);
  manifest.room_lab_export.sha256=hashObject(exportManifest);manifest.content_hash.value=contentHash(manifest);
  return validate(manifest,exportManifest);
};
const rejectsSource=(change,pattern)=>{const mutated=clone(sources);change(mutated);assert.throws(()=>build(mutated),pattern);};

assert.equal(baseline.manifest.line_items.length,8);
assert.equal(baseline.manifest.summary.destination_deliverable_lines,7);
assert.equal(baseline.manifest.summary.destination_deliverable_percentage,87.5);
assert.equal(baseline.manifest.summary.original_merchandise_subtotal.amount,1126.96);
assert.equal(baseline.manifest.summary.conditional_valnas_scenario_subtotal.amount,1176.96);
assert.equal(baseline.manifest.summary.purchase_ready_lines,0);
assert.equal(baseline.manifest.summary.local_lines,0);
assert.deepEqual(validate(),[]);
assert.equal(baseline.exportManifest.offers.length,14);
assert.equal(baseline.exportManifest.offers.filter(row=>row.scope==='FROZEN_ORIGINAL_SELECTED').length,8);
assert.equal(baseline.exportManifest.offers.filter(row=>row.scope==='CONDITIONAL_SUBSTITUTION_NOT_SELECTED').length,1);
assert.equal(baseline.exportManifest.offers.filter(row=>row.scope==='OUTSIDE_FROZEN_PROCUREMENT_POPULATION').length,5);

rejectsSource(source=>{source.offers.offers[0].retailer_territory_country='SE';source.offers.offers[0].delivery.country='SE';},/cross-market evidence is forbidden/);
rejectsSource(source=>{delete source.design.destination;},/Frozen design destination mismatch/);
rejectsSource(source=>{delete source.offers.offers[0].observed_at;},/missing evidence timestamp/);
rejectsSource(source=>{const kivik=source.furniture.items.find(row=>row.id==='kivik');kivik.record_lane='DESIGN_ASSET';},/Design Asset commerce leakage|Product Twin only/);
rejectsSource(source=>{source.furniture.items.find(row=>row.id==='kivik').identity.article='000.000.00';},/article identity mismatch|canonical scene\/furniture\/design\/offer\/session join failed/);

let errors=mutateManifest(manifest=>{manifest.line_items[0].evidence.observation.expires_at='2026-08-17T17:00:00+02:00';});
assert.ok(errors.some(error=>/stale|source truth/.test(error)),'stale evidence presented as current must fail');

errors=mutateManifest(manifest=>{manifest.line_items[0].tax.amount=0;});
assert.ok(errors.some(error=>/unknown tax must be null/.test(error)),'unknown costs represented as zero must fail');

errors=mutateManifest(manifest=>{manifest.line_items[0].product_twin_id='PT_IKEA_FAKE_00000000';});
assert.ok(errors.some(error=>/source truth|identit/i.test(error)),'Product identity mismatch must fail');

errors=mutateManifest(manifest=>{const line=manifest.line_items.find(row=>row.room_product_id==='listerby');line.room_product_id='valnas';line.product_twin_id='PT_IKEA_VALNAS_20628038';line.selection.substitution_applied=true;});
assert.ok(errors.some(error=>/silent substitution|frozen scene/.test(error)),'silent substitution must fail');

errors=mutateManifest(manifest=>{const sub=manifest.substitutions[0];sub.approval.state='APPROVED';sub.approval.client_design_approval='APPROVED';sub.approval.automatic_substitution_allowed=true;sub.approval.approval_evidence_ref='FORGED';});
assert.ok(errors.some(error=>/client approval cannot be bypassed/.test(error)),'client approval bypass must fail');

errors=mutateManifest(manifest=>{const line=manifest.line_items[0];line.purchase_readiness='PURCHASE_READY';line.gates=line.gates.map(gate=>({...gate,result:'PASS'}));line.blocked_gate_ids=[];manifest.summary.purchase_ready_lines=1;});
assert.ok(errors.some(error=>/false purchase-ready|No line is currently purchase-ready|independently derived/.test(error)),'false purchase-ready status must fail');

errors=validate(baseline.manifest,baseline.exportManifest,sources,{currentAt:'2026-08-18T00:00:00+02:00'});
assert.ok(errors.some(error=>/selected offer is stale/.test(error))&&errors.some(error=>/alternative offer is stale/.test(error)),'current validation must cover selected and alternative offers');

const blocked=Object.fromEntries(baseline.manifest.line_items.map(line=>[line.room_product_id,line.blocked_gate_ids]));
console.log(JSON.stringify({status:'ROOM_COMMERCE_PROCUREMENT_TEST_PASS',mutations:['cross-market leakage','stale evidence presented as current','missing destination','missing timestamps','unknown costs represented as zero','Product identity mismatch','Design Asset commerce leakage','silent substitution','client-approval bypass','false purchase-ready status'],blocked_gates:blocked,valnas:{approval:baseline.manifest.substitutions[0].approval,deltas:baseline.manifest.substitutions[0].deltas}},null,2));
