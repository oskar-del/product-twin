import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const config=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/herman-miller-sayl-fixed-models.json'),'utf8'));
const runtime=path.join(ROOT,'.runtime','herman-miller-sayl-fixed');
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const rows=[];
for(const asset of config.assets){
  let row={format:asset.format,url:asset.url,role:asset.role,reachable:false};
  try{
    const r=await fetch(asset.url,{redirect:'follow',headers:{'user-agent':'product-twin-fixed-model-validator/0.1'}});
    row.http_status=r.status;row.content_type=r.headers.get('content-type')??null;row.content_length_header=r.headers.get('content-length')?Number(r.headers.get('content-length')):null;row.resolved_url=r.url;
    if(r.ok){
      const body=Buffer.from(await r.arrayBuffer());
      const ext=asset.format==='Revit'?'.zip':asset.format==='SketchUp'?'.skp':'.dwg';
      const tmp=path.join(runtime,`asset${rows.length}${ext}`);await fs.writeFile(tmp,body);
      row.reachable=true;row.bytes=body.length;row.sha256=crypto.createHash('sha256').update(body).digest('hex');
      row.signature={first_16_hex:body.subarray(0,16).toString('hex'),first_32_ascii:body.subarray(0,32).toString('ascii').replace(/[^\x20-\x7E]/g,'.')};
      if(asset.format==='Revit')row.container_valid=body.subarray(0,2).toString('hex')==='504b';
      if(asset.format==='AutoCAD 3D')row.file_signature_valid=body.subarray(0,6).toString('ascii').startsWith('AC10');
      row.persisted_binary=false;
    }
  }catch(e){row.error=String(e?.message??e)}
  rows.push(row);
}
const summary={generated_at:new Date().toISOString(),manufacturer:config.manufacturer,configuration_family:config.configuration_family,assets_checked:rows.length,assets_reachable:rows.filter(x=>x.reachable).length,formats_reachable:rows.filter(x=>x.reachable).map(x=>x.format),binaries_committed:false,source_state:rows.some(x=>x.format==='Revit'&&x.reachable)?'MANUFACTURER_BIM_SOURCE_LIVE_TESTED':'GEOMETRY_SOURCE_PARTIAL_OR_FAILED',rights_state:'space_planning_use_supported; persistent storage/redistribution review'};
const out={summary,assets:rows,policy:config.asset_policy};
await fs.writeFile(path.join(ROOT,'data/metrics/herman-miller-sayl-fixed-models-latest.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(summary,null,2));
