import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const target=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/herman-miller-sayl-target.json'),'utf8'));
const runtime=path.join(ROOT,'.runtime','herman-miller-sayl');
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
const page=await context.newPage();
const network=[];
page.on('response',r=>{const u=r.url();if(/glb|gltf|glbExport|3dcloud|webar/i.test(u))network.push({url:u,status:r.status(),content_type:r.headers()['content-type']??null})});

let download=null;
try{
  await page.goto(target.manufacturer_sources.configurator_iframe,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(18000);

  const initialUrl=page.url();
  const custom=await page.locator('marxent-kongfigurator').evaluateAll(els=>els.map(el=>({configuration_id:el.getAttribute('configuration-id'),sku:el.getAttribute('sku'),environment:el.getAttribute('environment'),enable_ar:el.getAttribute('enable-ar')}))).catch(()=>[]);
  const visibleTexts=await page.locator('button:visible,[role="button"]:visible,a:visible').allTextContents().catch(()=>[]);

  const downloadCandidates=[
    page.getByRole('button',{name:/downloads?/i}),
    page.getByText(/^downloads?$/i),
    page.locator('button:visible').filter({hasText:/download/i}),
    page.locator('[role="button"]:visible').filter({hasText:/download/i})
  ];
  let opened=false;
  for(const loc of downloadCandidates){
    const n=await loc.count().catch(()=>0);if(!n)continue;
    for(let i=0;i<n;i++){
      try{await loc.nth(i).click({timeout:5000});opened=true;break}catch{}
    }
    if(opened)break;
  }
  await page.waitForTimeout(2500);

  const afterOpenTexts=await page.locator('button:visible,[role="button"]:visible,a:visible,label:visible').allTextContents().catch(()=>[]);
  const glbLocators=[
    page.getByText(/^GLB$/i),
    page.getByRole('button',{name:/GLB/i}),
    page.getByRole('link',{name:/GLB/i}),
    page.getByText(/3D model/i),
    page.locator('button:visible').filter({hasText:/3D model|GLB/i}),
    page.locator('a:visible').filter({hasText:/3D model|GLB/i})
  ];

  if(opened){
    outer: for(const loc of glbLocators){
      const n=await loc.count().catch(()=>0);if(!n)continue;
      for(let i=0;i<n;i++){
        try{
          const dlPromise=page.waitForEvent('download',{timeout:30000}).catch(()=>null);
          await loc.nth(i).click({timeout:5000});
          const dl=await dlPromise;
          if(dl){download=dl;break outer}
          await page.waitForTimeout(2500);
        }catch{}
      }
    }
  }

  // Some configurators export via a generated URL rather than browser download. Capture any GLB response/request seen.
  let saved=null;
  if(download){
    const suggested=download.suggestedFilename();const file=path.join(runtime,suggested.toLowerCase().endsWith('.glb')?suggested:'sayl-configured.glb');
    await download.saveAs(file);saved=file;
  }
  if(!saved){
    const glbNet=[...network].reverse().find(x=>/\.glb(?:[?#]|$)|glbExport/i.test(x.url));
    if(glbNet?.url){
      try{const r=await context.request.get(glbNet.url,{timeout:120000});if(r.ok()){const body=await r.body();if(body.length>20){saved=path.join(runtime,'sayl-configured.glb');await fs.writeFile(saved,body)}}}catch{}
    }
  }

  let asset=null;
  if(saved){
    const buf=await fs.readFile(saved);const magic=buf.subarray(0,4).toString('ascii');
    asset={runtime_path:path.relative(ROOT,saved),bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),glb_magic_valid:magic==='glTF'};
  }
  const finalCustom=await page.locator('marxent-kongfigurator').evaluateAll(els=>els.map(el=>({configuration_id:el.getAttribute('configuration-id'),sku:el.getAttribute('sku'),environment:el.getAttribute('environment')}))).catch(()=>[]);
  const finalUrl=page.url();
  const result={
    generated_at:new Date().toISOString(),target_id:target.target_id,
    status:asset?.glb_magic_valid?'PUBLIC_UI_GLB_CAPTURED_REQUIRES_SCALE_RIGHTS_QA':(opened?'DOWNLOAD_UI_FOUND_NO_GLB_CAPTURED':'DOWNLOAD_UI_NOT_FOUND'),
    manufacturer:'Herman Miller',product_family:'Sayl Chairs',
    public_ui:{initial_url:initialUrl,final_url:finalUrl,configurator_attributes_initial:custom,configurator_attributes_final:finalCustom,download_control_found:opened,initial_visible_controls:visibleTexts.slice(0,120),post_download_menu_controls:afterOpenTexts.slice(0,160)},
    asset,
    network_signals:[...new Map(network.map(x=>[x.url,x])).values()].slice(-150),
    rights:{render_workflow_supported_by_manufacturer:true,asset_storage:'ephemeral_only',redistribution:'review',derivative:'review'},
    promotion:{current_level:'G0',maximum_before_scale_validation:asset?.glb_magic_valid?'G2':'G0',exact_claim_allowed:false,blockers:[...(asset?.glb_magic_valid?['validate asset bounds/scale and selected configuration identity']:['capture intended GLB through public Downloads workflow']),'confirm derivative/storage/redistribution terms before persistent asset handling','join selected manufacturer configuration to live commerce/RFQ']},
    policy:'The script interacts only with Herman Miller’s public configurator UI. Captured manufacturer binary remains in ephemeral CI runtime and is never committed.'
  };
  await fs.writeFile(path.join(ROOT,'data/metrics/herman-miller-sayl-public-glb-capture-latest.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,download_control_found:opened,asset:asset?{bytes:asset.bytes,sha256:asset.sha256,glb_magic_valid:asset.glb_magic_valid}:null,final_url:finalUrl},null,2));
} finally {await browser.close()}
