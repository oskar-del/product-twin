import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRoomCommerceProcurementManifest,canonicalJson,contentHash,deriveLineGates,EXPORT_PATH,EXPECTED_SCENE_PRODUCTS,EXPECTED_TWINS,hashObject,LINE_GATE_IDS,loadRoomCommerceSources,MANIFEST_PATH} from './build-room-commerce-procurement-manifest.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=value=>structuredClone(value);
const add=(errors,condition,message)=>{if(!condition)errors.push(message);};
const same=(left,right)=>canonicalJson(left)===canonicalJson(right);
const isUnknownCost=cost=>typeof cost?.state==='string'&&(cost.state.startsWith('UNKNOWN')||cost.state==='NOT_AVAILABLE');
const MUTABLE_KEY=/(^|_)(cart_id|cart_token|cart_payload|checkout_id|checkout_url|checkout_token|checkout_payload|order_id|order_token|order_payload|session_token|payment_intent|payment_token|rfq_payload)(_|$)/i;
const MUTABLE_VALUE=/(shopify\/(Cart|Checkout)|\/cart\/|checkout\/|session-token|payment_intent)/i;

function scanMutable(value,pathValue='manifest',errors=[]){
  if(Array.isArray(value)){value.forEach((child,index)=>scanMutable(child,`${pathValue}[${index}]`,errors));return errors;}
  if(!value||typeof value!=='object')return errors;
  for(const [key,child] of Object.entries(value)){
    if(MUTABLE_KEY.test(key))errors.push(`${pathValue}.${key}: mutable checkout/order/session payload fields are forbidden`);
    if(typeof child==='string'&&MUTABLE_VALUE.test(child))errors.push(`${pathValue}.${key}: mutable commerce identifier values are forbidden`);
    scanMutable(child,`${pathValue}.${key}`,errors);
  }
  return errors;
}

export function validateRoomLabExport(exportManifest,furniture,expectedExport){
  const errors=[];
  add(errors,exportManifest?.manifest_version==='room-commerce/v1','Room Lab export version must be room-commerce/v1');
  add(errors,exportManifest?.destination?.country==='ES'&&exportManifest?.destination?.postcode==='29660','Room Lab export destination must be ES-29660');
  add(errors,Boolean(exportManifest?.destination?.as_of),'Room Lab export requires as_of');
  const productTwins=(furniture.items??[]).filter(item=>item.record_lane==='PRODUCT_TWIN').map(item=>item.id);
  const designAssets=new Set((furniture.items??[]).filter(item=>item.record_lane==='DESIGN_ASSET').map(item=>item.id));
  add(errors,same((exportManifest.offers??[]).map(row=>row.product_id),productTwins),'Room Lab export must cover the exact Product Twin catalogue in importer order');
  for(const offer of exportManifest.offers??[]){
    add(errors,!designAssets.has(offer.product_id),`${offer.product_id}: Design Asset commerce leakage in Room Lab export`);
    add(errors,typeof offer.summary==='string'&&offer.summary.length>0,`${offer.product_id}: Room Lab export summary is required`);
    add(errors,typeof offer.official_url==='string'&&offer.official_url.startsWith('https://'),`${offer.product_id}: immutable identity URL is required`);
    add(errors,['FROZEN_ORIGINAL_SELECTED','CONDITIONAL_SUBSTITUTION_NOT_SELECTED','OUTSIDE_FROZEN_PROCUREMENT_POPULATION'].includes(offer.scope),`${offer.product_id}: invalid export scope`);
  }
  add(errors,same(exportManifest,expectedExport),'Room Lab export does not exactly match the deterministic procurement adapter');
  return errors;
}

export function validateRoomCommerceProcurementManifest(manifest,exportManifest,sources,{currentAt=null}={}){
  const errors=[];
  add(errors,manifest?.schema_version==='room-commerce-procurement/v1','Unsupported canonical procurement schema version');
  add(errors,manifest?.manifest_id==='PROC_MARBELLA_LIVING_ROOM_ES_29660_V1','Unexpected procurement manifest ID');
  add(errors,manifest?.producing_workstream==='Build, Procurement & Logistics OS','Producing workstream mismatch');
  add(errors,/^[a-f0-9]{40}$/.test(manifest?.producer?.producer_commit??'')||manifest?.producer?.producer_commit==='PENDING_FIRST_PRODUCER_COMMIT','Producer commit must be a 40-character commit or the explicit pre-commit checkpoint marker');
  add(errors,manifest?.destination?.country==='ES'&&manifest?.destination?.market==='ES'&&manifest?.destination?.postcode==='29660'&&manifest?.destination?.key==='ES-29660','Canonical destination must be ES-29660 in the ES market');
  add(errors,same(manifest?.population?.scene_product_ids,EXPECTED_SCENE_PRODUCTS),'Frozen scene population changed');
  add(errors,same(manifest?.population?.product_twin_ids,EXPECTED_TWINS),'Frozen Product Twin population changed');
  add(errors,manifest?.line_items?.length===8,'Canonical manifest must contain exactly eight original lines');
  add(errors,manifest?.summary?.destination_deliverable_lines===7&&manifest?.summary?.destination_deliverable_percentage===87.5,'Destination coverage must remain 7/8 (87.5%)');
  add(errors,manifest?.summary?.original_merchandise_subtotal?.amount===1126.96,'Original subtotal must remain EUR 1,126.96');
  add(errors,manifest?.summary?.conditional_valnas_scenario_subtotal?.amount===1176.96,'Conditional VALNÄS subtotal must remain EUR 1,176.96');
  add(errors,manifest?.summary?.local_lines===0,'No retailer may be classified local without locality evidence');
  add(errors,manifest?.summary?.purchase_ready_lines===0,'No line is currently purchase-ready');
  add(errors,manifest?.market_isolation?.authoritative_market==='ES','ES must remain the only authoritative market');
  for(const market of ['SE','GB','US'])add(errors,manifest?.market_isolation?.non_authoritative_markets?.[market]==='NO_EVIDENCE_EXPORTED',`${market}: Spain evidence must not leak into this market`);

  const ids=[];
  for(const line of manifest?.line_items??[]){
    ids.push(line.room_product_id);
    add(errors,line.record_lane==='PRODUCT_TWIN',`${line.line_id}: Design Assets cannot receive commerce or procurement fields`);
    add(errors,line.selection?.state==='FROZEN_ORIGINAL_SELECTED'&&line.selection?.substitution_applied===false,`${line.line_id}: silent substitution is forbidden`);
    add(errors,line.destination_delivery?.destination?.key==='ES-29660'&&line.evidence?.market_scope==='ES_ONLY',`${line.line_id}: missing or crossed destination market`);
    add(errors,Boolean(line.evidence?.observation?.source_observed_at&&line.evidence?.observation?.expires_at),`${line.line_id}: observation timestamp and expiry are required`);
    for(const [name,cost] of [['tax',line.tax],['freight',line.freight],['landed_cost',line.landed_cost]])add(errors,!(isUnknownCost(cost)&&cost.amount!==null),`${line.line_id}: unknown ${name} must be null, never zero or another number`);
    const derived=deriveLineGates(line);
    add(errors,same(line.gates?.map(row=>row.id),LINE_GATE_IDS),`${line.line_id}: exact deterministic gate set is required`);
    add(errors,same(line.gates,derived),`${line.line_id}: gate outcomes must be independently derived`);
    add(errors,same(line.blocked_gate_ids,derived.filter(row=>row.result==='BLOCKED').map(row=>row.id)),`${line.line_id}: blocked gate list must be derived`);
    add(errors,line.purchase_readiness==='NOT_PURCHASE_READY',`${line.line_id}: false purchase-ready status`);
    add(errors,line.checkout_rfq?.mutable_payload_embedded===false,`${line.line_id}: mutable checkout payloads are forbidden`);
  }
  add(errors,same(ids,EXPECTED_SCENE_PRODUCTS),'Line order and identities must exactly match the frozen scene');
  const listerby=(manifest?.line_items??[]).find(line=>line.room_product_id==='listerby');
  add(errors,listerby?.product_twin_id==='PT_IKEA_LISTERBY_30513904'&&listerby?.destination_delivery?.eligibility==='INELIGIBLE','LISTERBY must remain selected and unavailable');
  const valnas=manifest?.substitutions?.find(row=>row.substitution_id==='SUB_LISTERBY_TO_VALNAS');
  add(errors,manifest?.substitutions?.length===1&&Boolean(valnas),'Exactly one canonical VALNÄS substitution record is required');
  add(errors,valnas?.alternative?.product_twin_id==='PT_IKEA_VALNAS_20628038'&&valnas?.alternative?.article_no==='206.280.38','VALNÄS Product Twin identity mismatch');
  add(errors,valnas?.approval?.state==='CONDITIONAL_NOT_APPROVED'&&valnas?.approval?.client_design_approval==='REQUIRED'&&valnas?.approval?.automatic_substitution_allowed===false&&valnas?.approval?.approval_evidence_ref===null,'VALNÄS client approval cannot be bypassed');
  add(errors,valnas?.deltas?.price?.amount===50&&valnas?.deltas?.dimensions_mm?.width===-220&&valnas?.deltas?.dimensions_mm?.depth===120&&valnas?.deltas?.dimensions_mm?.height===130,'VALNÄS canonical deltas changed');
  add(errors,valnas?.alternative?.evidence?.observation?.source_observed_at==='2026-08-17','VALNÄS must retain its 17 August 2026 observation date');
  add(errors,manifest?.content_hash?.value===contentHash(manifest),'Canonical manifest content hash mismatch');
  add(errors,manifest?.room_lab_export?.sha256===hashObject(exportManifest),'Room Lab export content hash mismatch');
  scanMutable(manifest,'manifest',errors);
  scanMutable(exportManifest,'room_lab_export',errors);
  let expected;
  try{expected=buildRoomCommerceProcurementManifest(clone(sources),{compiledAt:manifest.compiled_at,producerCommit:manifest.producer.producer_commit});}
  catch(error){errors.push(`Canonical source compilation failed: ${error.message}`);return errors;}
  add(errors,same(manifest,expected.manifest),'Canonical manifest does not exactly match independently rebuilt source truth');
  errors.push(...validateRoomLabExport(exportManifest,sources.furniture,expected.exportManifest));
  if(currentAt){
    const now=Date.parse(currentAt);add(errors,Number.isFinite(now),'Current validation time is invalid');
    for(const line of manifest.line_items??[])add(errors,now<=Date.parse(line.evidence.observation.expires_at),`${line.line_id}: selected offer is stale at ${currentAt}`);
    for(const substitution of manifest.substitutions??[])add(errors,now<=Date.parse(substitution.alternative.evidence.observation.expires_at),`${substitution.substitution_id}: alternative offer is stale at ${currentAt}`);
  }
  return [...new Set(errors)];
}

export async function validateCommittedRoomCommerce({currentAt=null}={}){
  const [manifest,exportManifest,sources]=await Promise.all([fs.readFile(path.join(ROOT,MANIFEST_PATH),'utf8').then(JSON.parse),fs.readFile(path.join(ROOT,EXPORT_PATH),'utf8').then(JSON.parse),loadRoomCommerceSources()]);
  return validateRoomCommerceProcurementManifest(manifest,exportManifest,sources,{currentAt});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const currentFlag=process.argv.find(value=>value==='--current'||value.startsWith('--current-at='));const currentAt=currentFlag==='--current'?new Date().toISOString():currentFlag?.slice('--current-at='.length)??null;const errors=await validateCommittedRoomCommerce({currentAt});
  console.log(JSON.stringify({status:errors.length?'ROOM_COMMERCE_PROCUREMENT_FAIL':'ROOM_COMMERCE_PROCUREMENT_PASS',errors},null,2));if(errors.length)process.exitCode=1;
}
