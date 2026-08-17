import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inspectGlb} from './validate-authorized-geometry-qa.mjs';

const ROOT=process.cwd();
const API_VERSION='2026-07';
const input=JSON.parse(await fs.readFile(path.join(ROOT,'data/identity/shopify-furniture-model3d-candidates.json'),'utf8'));
const qaConfig=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/shopify-furniture-model3d-qa-targets.json'),'utf8'));
const qaTargets=new Map((qaConfig.targets??[]).map((target)=>[target.candidate_id,target]));
const runtimeDir=path.join(ROOT,'.runtime/shopify-model3d-inspection');
const generatedAt=new Date().toISOString();

const query=`query ProductTwinModel3dInspection($id: ID!) {
  node(id: $id) {
    ... on ProductVariant {
      id
      title
      sku
      barcode
      selectedOptions { name value }
      product {
        id
        media(first: 50) {
          nodes {
            mediaContentType
            ... on Model3d { id sources { format mimeType filesize url } }
          }
        }
      }
    }
  }
}`;

async function resolveModel(candidate){
  const endpoint=`${candidate.merchant_origin}/api/${API_VERSION}/graphql.json`;
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','user-agent':'product-twin-shopify-model3d-inspector/0.1'},body:JSON.stringify({query,variables:{id:candidate.identity.merchant_variant_gid}})});
  const text=await response.text();
  if(!response.ok)throw new Error(`storefront ${response.status}: ${text.slice(0,240)}`);
  const json=JSON.parse(text);
  if(json.errors?.length)throw new Error(json.errors.map((item)=>item.message).join(' | '));
  const variant=json.data?.node;
  const model=(variant?.product?.media?.nodes??[]).find((media)=>media?.id===candidate.identity.merchant_model3d_gid);
  if(!model)throw new Error('stable merchant Model3d reference no longer resolves');
  const source=(model.sources??[]).find((item)=>String(item.format).toLowerCase()==='glb'||String(item.mimeType).toLowerCase()==='model/gltf-binary');
  if(!source?.url)throw new Error('resolved Model3d has no GLB source');
  return {variant,model,source};
}

function glbJson(buffer){
  if(buffer.subarray(0,4).toString('ascii')!=='glTF')throw new Error('asset is not GLB');
  for(let offset=12;offset+8<=buffer.length;){
    const length=buffer.readUInt32LE(offset);
    const type=buffer.readUInt32LE(offset+4);
    if(type===0x4e4f534a)return JSON.parse(buffer.subarray(offset+8,offset+8+length).toString('utf8').trim());
    offset+=8+length;
  }
  throw new Error('GLB JSON chunk missing');
}

function materialSummary(document){
  const materials=document.materials??[];
  const textures=document.textures??[];
  const images=document.images??[];
  return {
    material_count:materials.length,
    texture_count:textures.length,
    image_count:images.length,
    materials:materials.slice(0,30).map((material,index)=>({
      index,
      name:material.name??null,
      alpha_mode:material.alphaMode??'OPAQUE',
      double_sided:material.doubleSided===true,
      base_color_factor:material.pbrMetallicRoughness?.baseColorFactor??null,
      base_color_texture_present:Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index),
      metallic_factor:material.pbrMetallicRoughness?.metallicFactor??null,
      roughness_factor:material.pbrMetallicRoughness?.roughnessFactor??null,
      normal_texture_present:Number.isInteger(material.normalTexture?.index)
    }))
  };
}

function variantMaterialBinding(candidate,materials){
  const values=Object.values(candidate.identity.selected_options??{}).map((value)=>String(value).toLowerCase()).filter(Boolean);
  const materialText=materials.materials.map((material)=>material.name??'').join(' ').toLowerCase();
  const matched=values.filter((value)=>value.length>=3&&materialText.includes(value));
  return {
    state:matched.length===values.length&&values.length?'EMBEDDED_MATERIAL_NAMES_MATCH_SELECTED_OPTIONS':'UNRESOLVED_PRODUCT_LEVEL_MODEL',
    selected_option_values:values,
    matched_values:matched,
    note:'Material-name matching is supporting evidence only; visual QA and exact variant binding remain required.'
  };
}

function scaleEvaluation(candidateId,actualDimensions){
  const target=qaTargets.get(candidateId);
  if(!target)return {state:'EXPECTED_DIMENSIONS_NOT_CONFIGURED',pass:false};
  const actual=[...actualDimensions].sort((a,b)=>a-b);
  const expected=[...target.expected_dimensions_mm].sort((a,b)=>a-b);
  const relativeErrors=expected.map((value,index)=>Math.abs(actual[index]-value)/value);
  const maximumRelativeError=Math.max(...relativeErrors);
  return {
    state:maximumRelativeError<=qaConfig.maximum_relative_error?'MANUFACTURER_SCALE_QA_PASS':'MANUFACTURER_SCALE_QA_BLOCKED',
    pass:maximumRelativeError<=qaConfig.maximum_relative_error,
    expected_dimensions_mm:target.expected_dimensions_mm,
    sorted_actual_mm:actual,
    sorted_expected_mm:expected,
    relative_errors:relativeErrors,
    maximum_relative_error:maximumRelativeError,
    allowed_relative_error:qaConfig.maximum_relative_error,
    dimension_source:target.dimension_source,
    source_note:target.source_note
  };
}

await fs.mkdir(runtimeDir,{recursive:true});
const inspections=[];
for(const candidate of input.candidates??[]){
  console.log(`Inspecting ${candidate.identity.vendor??'unknown'} ${candidate.identity.product_title??candidate.candidate_id}`);
  try{
    const resolved=await resolveModel(candidate);
    const response=await fetch(resolved.source.url,{headers:{'user-agent':'product-twin-shopify-model3d-inspector/0.1'}});
    if(!response.ok)throw new Error(`GLB fetch ${response.status}`);
    const contentLength=Number(response.headers.get('content-length'));
    if(Number.isFinite(contentLength)&&contentLength>150_000_000)throw new Error('GLB exceeds 150 MB inspection limit');
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length>150_000_000)throw new Error('GLB exceeds 150 MB inspection limit');
    const inspection=inspectGlb(buffer);
    const document=glbJson(buffer);
    const materials=materialSummary(document);
    const binding=variantMaterialBinding(candidate,materials);
    const scaleQa=scaleEvaluation(candidate.candidate_id,inspection.dimensions_mm);
    const runtimeAssetPath=path.join(runtimeDir,`${candidate.candidate_id}.glb`);
    await fs.writeFile(runtimeAssetPath,buffer);
    inspections.push({
      candidate_id:candidate.candidate_id,
      category_id:candidate.category_id,
      merchant_origin:candidate.merchant_origin,
      identity:{
        product_title:candidate.identity.product_title,
        vendor:candidate.identity.vendor,
        variant_title:candidate.identity.variant_title,
        sku:candidate.identity.sku,
        selected_options:candidate.identity.selected_options,
        merchant_product_gid:candidate.identity.merchant_product_gid,
        merchant_variant_gid:candidate.identity.merchant_variant_gid,
        merchant_model3d_gid:candidate.identity.merchant_model3d_gid
      },
      status:'LIVE_MODEL3D_INSPECTED_VARIANT_QA_REQUIRED',
      asset:{format:'glb',bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),source_url_persisted:false,binary_committed:false,runtime_file_retained:true},
      geometry:{dimensions_mm:inspection.dimensions_mm,position_accessor_count:inspection.position_accessor_count,scale_state:scaleQa.state,scale_qa:scaleQa},
      materials,
      variant_material_binding:binding,
      rights:{state:'REVIEW',render_scope:'UNRESOLVED',derivative_storage:'RUNTIME_INSPECTION_ONLY',redistribution:false},
      promotion:{current_level:'G2_CANDIDATE',target_level:'G3',blocked_by:[...(scaleQa.pass?[]:['manufacturer scale QA']), 'exact selected-variant material binding','render and platform-display rights review','live checkout refresh for project destination']}
    });
  }catch(error){
    inspections.push({candidate_id:candidate.candidate_id,status:'LIVE_MODEL3D_INSPECTION_FAILED',error:String(error?.message??error)});
  }
}

const summary={
  generated_at:generatedAt,
  candidates:inspections.length,
  inspected:inspections.filter((item)=>item.status==='LIVE_MODEL3D_INSPECTED_VARIANT_QA_REQUIRED').length,
  failed:inspections.filter((item)=>item.status==='LIVE_MODEL3D_INSPECTION_FAILED').length,
  exact_variant_material_bindings:inspections.filter((item)=>item.variant_material_binding?.state==='EMBEDDED_MATERIAL_NAMES_MATCH_SELECTED_OPTIONS').length,
  manufacturer_scale_qa_passes:inspections.filter((item)=>item.geometry?.scale_qa?.pass===true).length,
  promoted_g3:0,
  policy:'GLB source URLs are not persisted. Resolved binaries remain only under gitignored runtime for inspection; stable hashes, measurements and QA states are persisted.'
};
await fs.mkdir(path.join(ROOT,'data/metrics'),{recursive:true});
await fs.writeFile(path.join(ROOT,'data/metrics/shopify-furniture-model3d-inspection-latest.json'),JSON.stringify({summary,inspections},null,2)+'\n');
  console.log(JSON.stringify({summary,inspections:inspections.map((item)=>({candidate_id:item.candidate_id,status:item.status,title:item.identity?.product_title,variant:item.identity?.variant_title,bytes:item.asset?.bytes,dimensions_mm:item.geometry?.dimensions_mm,scale_qa:item.geometry?.scale_qa?.state,maximum_scale_error:item.geometry?.scale_qa?.maximum_relative_error,materials:item.materials?.material_count,binding:item.variant_material_binding?.state,matched:item.variant_material_binding?.matched_values}))},null,2));
