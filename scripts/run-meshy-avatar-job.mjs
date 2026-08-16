import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const jobPath=process.env.AVATAR_JOB;
const apiKey=process.env.MESHY_API_KEY;
if(!jobPath)throw new Error('AVATAR_JOB is required');
const job=JSON.parse(await fs.readFile(path.resolve(ROOT,jobPath),'utf8'));
const runtime=path.join(ROOT,'.runtime','avatars',job.job_id);
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

function resultBase(status){return {generated_at:new Date().toISOString(),job_id:job.job_id,engine:'meshy',status,subject:job.subject,policy:{exact_product_claim_allowed:false,source_images_not_copied:true,generated_asset_public_commit_allowed:job.rights?.redistribution_allowed==='yes'}}}
async function persistMetric(obj){await fs.writeFile(path.join(ROOT,'data','metrics','meshy-avatar-job-latest.json'),JSON.stringify(obj,null,2));}

if(job.rights?.reconstruction_allowed!=='yes'){
  const out={...resultBase('RIGHTS_BLOCKED'),reason:'reconstruction_allowed must be yes'};await persistMetric(out);console.log(JSON.stringify(out,null,2));process.exit(0);
}
if(!apiKey){const out={...resultBase('CREDENTIAL_REQUIRED'),reason:'MESHY_API_KEY is not configured'};await persistMetric(out);console.log(JSON.stringify(out,null,2));process.exit(0);}

const images=(job.source_images??[]).filter(x=>x.rights_state==='cleared_for_reconstruction').map(x=>x.source_uri_or_reference).filter(x=>/^https?:\/\//.test(String(x))).slice(0,4);
if(!images.length)throw new Error('No cleared publicly accessible image URLs in job');

const multi=images.length>1;
const createUrl=multi?'https://api.meshy.ai/openapi/v1/multi-image-to-3d':'https://api.meshy.ai/openapi/v1/image-to-3d';
const body=multi?{
  image_urls:images,
  ai_model:'latest',
  should_texture:true,
  enable_pbr:true,
  image_enhancement:false,
  remove_lighting:true,
  target_formats:['glb'],
  origin_at:'bottom'
}:{
  image_url:images[0],
  ai_model:'latest',
  should_texture:true,
  enable_pbr:true,
  image_enhancement:false,
  remove_lighting:true,
  target_formats:['glb'],
  origin_at:'bottom'
};

const created=await fetch(createUrl,{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify(body)});
const createdText=await created.text();if(!created.ok)throw new Error(`Meshy create ${created.status}: ${createdText.slice(0,800)}`);
const taskId=JSON.parse(createdText).result;
const getUrl=`${createUrl}/${taskId}`;
let task;
for(let i=0;i<120;i++){
  const res=await fetch(getUrl,{headers:{authorization:`Bearer ${apiKey}`}});const text=await res.text();if(!res.ok)throw new Error(`Meshy status ${res.status}: ${text.slice(0,800)}`);task=JSON.parse(text);
  if(task.status==='SUCCEEDED'||task.status==='FAILED'||task.status==='CANCELED')break;
  await new Promise(r=>setTimeout(r,5000));
}
if(task?.status!=='SUCCEEDED'){
  const out={...resultBase('GENERATION_FAILED'),external_task_id:taskId,engine_status:task?.status??'TIMEOUT',error:task?.task_error?.message??null};await persistMetric(out);console.log(JSON.stringify(out,null,2));process.exit(1);
}
const glbUrl=task.model_urls?.glb;if(!glbUrl)throw new Error('Meshy succeeded without GLB URL');
const glbRes=await fetch(glbUrl);if(!glbRes.ok)throw new Error(`GLB download ${glbRes.status}`);const bytes=Buffer.from(await glbRes.arrayBuffer());
const glbPath=path.join(runtime,'model.glb');await fs.writeFile(glbPath,bytes);

const dimensions=job.dimensions??{};
const scaleVerified=['manufacturer_verified','measured'].includes(dimensions.scale_state);
const maximumClaim=(job.subject?.identity_state==='verified'&&scaleVerified&&job.rights?.render_allowed==='yes')?'G2':'G1';
const out={
  ...resultBase('SUCCEEDED_REQUIRES_QA'),
  external_task_id:taskId,
  mode:multi?'multi_image_ai':'single_image_ai',
  source_view_count:images.length,
  runtime_asset_path:path.relative(ROOT,glbPath),
  asset_bytes:bytes.length,
  pbr_requested:true,
  maximum_claim_level_before_qa:maximumClaim,
  promotion_blockers:[
    'source-view rerender QA not completed',
    ...(scaleVerified?[]:['physical scale not manufacturer-verified/measured']),
    ...(job.subject?.identity_state==='verified'?[]:['canonical product identity not verified']),
    ...(job.rights?.render_allowed==='yes'?[]:['render rights not cleared']),
    'AI reconstruction remains inferred geometry unless validated against authoritative geometry'
  ],
  note:'Meshy output is retained in ephemeral runtime. Promotion/commit is a separate QA + rights action.'
};
await persistMetric(out);console.log(JSON.stringify(out,null,2));
