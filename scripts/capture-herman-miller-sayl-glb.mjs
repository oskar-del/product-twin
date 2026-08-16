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
const generatedAssetUrls=new Map();
const BAD_ASSET=/\/hotspots\/|shadow_catcher|render_accessories|default_rendering_assets|icons?|babylon|flare|handmeshes/i;
const PRODUCT_EXPORT_ENDPOINT=/glbExport|\/v1\/ar(?:-od)?\/|web-ar\/view/i;

function collectGlbStrings(value,source){
  if(value==null)return;
  if(typeof value==='string'){
    if(/https?:\/\/[^\s"']+\.glb(?:[?#][^\s"']*)?/i.test(value)&&!BAD_ASSET.test(value))generatedAssetUrls.set(value,{url:value,source});
    return;
  }
  if(Array.isArray(value)){for(const v of value)collectGlbStrings(v,source);return;}
  if(typeof value==='object')for(const v of Object.values(value))collectGlbStrings(v,source);
}

page.on('response',async r=>{
  const u=r.url();
  if(/glb|gltf|glbExport|3dcloud|webar/i.test(u))network.push({url:u,status:r.status(),content_type:r.headers()['content-type']??null,is_generic_asset:BAD_ASSET.test(u),is_product_export_endpoint:PRODUCT_EXPORT_ENDPOINT.test(u)});
  if(PRODUCT_EXPORT_ENDPOINT.test(u)&&r.status()>=200&&r.status()<300){
    try{const txt=await r.text();let body;try{body=JSON.parse(txt)}catch{body=txt}collectGlbStrings(body,u)}catch{}
  }
  if(/\.glb(?:[?#]|$)/i.test(u)&&!BAD_ASSET.test(u))generatedAssetUrls.set(u,{url:u,source:'network_glb_response'});
});

async function deepInteractiveSnapshot(){
  return page.evaluate(()=>{
    const out=[];const seen=new Set();
    function walk(root,depth=0){
      if(!root||depth>12||seen.has(root))return;seen.add(root);
      const els=root.querySelectorAll?root.querySelectorAll('*'):[];
      for(const el of els){
        const tag=(el.tagName||'').toLowerCase();const role=el.getAttribute?.('role');const aria=el.getAttribute?.('aria-label')||el.getAttribute?.('title')||'';const text=(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,180);
        const interactive=['button','a','label'].includes(tag)||role==='button'||role==='menuitem'||el.onclick;
        if(interactive&&(text||aria))out.push({tag,role,aria,text,part:el.getAttribute?.('part')||null,class_name:String(el.className||'').slice(0,160)});
        if(el.shadowRoot)walk(el.shadowRoot,depth+1);
      }
    }
    walk(document);return out.slice(0,500);
  }).catch(()=>[]);
}

async function deepClick(regex){
  const source=regex.source,flags=regex.flags;
  return page.evaluate(({source,flags})=>{
    const re=new RegExp(source,flags);let clicked=null;const seen=new Set();
    function walk(root,depth=0){
      if(clicked||!root||depth>12||seen.has(root))return;seen.add(root);
      const els=root.querySelectorAll?root.querySelectorAll('*'):[];
      for(const el of els){
        const tag=(el.tagName||'').toLowerCase();const role=el.getAttribute?.('role');const aria=el.getAttribute?.('aria-label')||el.getAttribute?.('title')||'';const text=(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ');
        const interactive=['button','a','label'].includes(tag)||role==='button'||role==='menuitem'||typeof el.onclick==='function';
        if(interactive&&re.test(`${aria} ${text}`)){try{el.click();clicked={tag,role,aria,text:text.slice(0,180)};return}catch{}}
        if(el.shadowRoot)walk(el.shadowRoot,depth+1);
      }
    }
    walk(document);return clicked;
  },{source,flags}).catch(()=>null);
}

let download=null;
try{
  await page.goto(target.manufacturer_sources.configurator_iframe,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(22000);

  const initialUrl=page.url();
  const custom=await page.locator('marxent-kongfigurator').evaluateAll(els=>els.map(el=>({configuration_id:el.getAttribute('configuration-id'),sku:el.getAttribute('sku'),environment:el.getAttribute('environment'),enable_ar:el.getAttribute('enable-ar')}))).catch(()=>[]);
  const initialControls=await deepInteractiveSnapshot();

  // Try normal Playwright semantics first, then recurse through open shadow roots.
  const downloadCandidates=[page.getByRole('button',{name:/downloads?|export/i}),page.getByText(/^(downloads?|export)$/i),page.locator('button:visible').filter({hasText:/download|export/i}),page.locator('[role="button"]:visible').filter({hasText:/download|export/i})];
  let opened=false,openedBy=null;
  for(const loc of downloadCandidates){const n=await loc.count().catch(()=>0);if(!n)continue;for(let i=0;i<n;i++){try{await loc.nth(i).click({timeout:5000});opened=true;openedBy='playwright_locator';break}catch{}}if(opened)break;}
  if(!opened){openedBy=await deepClick(/download|export/i);opened=Boolean(openedBy)}
  await page.waitForTimeout(3000);

  const afterOpenControls=await deepInteractiveSnapshot();
  const glbLocators=[page.getByText(/^GLB$/i),page.getByRole('button',{name:/GLB|3D model/i}),page.getByRole('link',{name:/GLB|3D model/i}),page.locator('button:visible').filter({hasText:/3D model|GLB/i}),page.locator('a:visible').filter({hasText:/3D model|GLB/i})];
  let glbClicked=false,glbClickedBy=null;
  if(opened){
    outer: for(const loc of glbLocators){const n=await loc.count().catch(()=>0);if(!n)continue;for(let i=0;i<n;i++){try{const dlPromise=page.waitForEvent('download',{timeout:30000}).catch(()=>null);await loc.nth(i).click({timeout:5000});glbClicked=true;glbClickedBy='playwright_locator';const dl=await dlPromise;if(dl){download=dl;break outer}await page.waitForTimeout(3500)}catch{}}}
    if(!glbClicked){glbClickedBy=await deepClick(/\bGLB\b|3D model/i);glbClicked=Boolean(glbClickedBy);if(glbClicked){download=await page.waitForEvent('download',{timeout:12000}).catch(()=>null);await page.waitForTimeout(4000)}}
  }

  let saved=null,assetSource=null,sourceClass=null;
  if(download){
    const suggested=download.suggestedFilename();const file=path.join(runtime,suggested.toLowerCase().endsWith('.glb')?suggested:'sayl-configured.glb');
    await download.saveAs(file);saved=file;assetSource=download.url();sourceClass='explicit_browser_download';
  }

  // Only accept product-export evidence. Never fall back to arbitrary GLBs such as UI hotspots.
  if(!saved){
    await page.waitForTimeout(3000);
    const candidates=[...generatedAssetUrls.values()].filter(x=>!BAD_ASSET.test(x.url));
    const preferred=[...candidates].reverse().find(x=>PRODUCT_EXPORT_ENDPOINT.test(x.source)||/\/ar(?:-od)?\//i.test(x.url)||/export|configured|product/i.test(x.url));
    if(preferred?.url){
      try{const r=await context.request.get(preferred.url,{timeout:120000});if(r.ok()){const body=await r.body();if(body.length>20000&&body.subarray(0,4).toString('ascii')==='glTF'){saved=path.join(runtime,'sayl-configured.glb');await fs.writeFile(saved,body);assetSource=preferred.url;sourceClass='product_export_network_reference'}}catch{}
    }
  }

  let asset=null;
  if(saved){
    const buf=await fs.readFile(saved);const magic=buf.subarray(0,4).toString('ascii');
    asset={runtime_path:path.relative(ROOT,saved),source_url:assetSource,source_class:sourceClass,bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),glb_magic_valid:magic==='glTF',generic_asset_rejected:assetSource?BAD_ASSET.test(assetSource):false};
    if(asset.generic_asset_rejected)asset=null;
  }

  const finalCustom=await page.locator('marxent-kongfigurator').evaluateAll(els=>els.map(el=>({configuration_id:el.getAttribute('configuration-id'),sku:el.getAttribute('sku'),environment:el.getAttribute('environment')}))).catch(()=>[]);
  const finalUrl=page.url();
  const productBoundAsset=Boolean(asset?.glb_magic_valid&&asset.source_url&&!BAD_ASSET.test(asset.source_url)&&['explicit_browser_download','product_export_network_reference'].includes(asset.source_class));
  const result={
    generated_at:new Date().toISOString(),target_id:target.target_id,
    status:productBoundAsset?'PRODUCT_BOUND_GLB_CAPTURED_REQUIRES_SCALE_RIGHTS_QA':(opened?'DOWNLOAD_UI_REACHED_NO_PRODUCT_GLB':'NO_PRODUCT_GLB_CAPTURED'),
    manufacturer:'Herman Miller',product_family:'Sayl Chairs',
    public_ui:{initial_url:initialUrl,final_url:finalUrl,configurator_attributes_initial:custom,configurator_attributes_final:finalCustom,download_control_found:opened,download_control_evidence:openedBy,glb_control_clicked:glbClicked,glb_control_evidence:glbClickedBy,initial_controls:initialControls,post_download_controls:afterOpenControls},
    asset,
    generated_asset_references:[...generatedAssetUrls.values()].filter(x=>!BAD_ASSET.test(x.url)).slice(-80),
    rejected_generic_glbs:[...new Map(network.filter(x=>/\.glb(?:[?#]|$)/i.test(x.url)&&BAD_ASSET.test(x.url)).map(x=>[x.url,x])).values()].slice(-50),
    network_signals:[...new Map(network.map(x=>[x.url,x])).values()].slice(-180),
    rights:{render_workflow_supported_by_manufacturer:true,asset_storage:'ephemeral_only',redistribution:'review',derivative:'review'},
    promotion:{current_level:'G0',maximum_before_scale_validation:productBoundAsset?'G2':'G0',exact_claim_allowed:false,blockers:[...(productBoundAsset?['validate product asset bounds/scale and selected configuration identity']:['capture intended product GLB; generic configurator/UI GLBs are rejected']),'confirm derivative/storage/redistribution terms before persistent asset handling','join selected manufacturer configuration to live commerce/RFQ']},
    policy:'Only product-bound export/download GLBs are eligible. Generic UI/hotspot/render-accessory GLBs are explicitly rejected. Manufacturer binaries remain ephemeral and are never committed.'
  };
  await fs.writeFile(path.join(ROOT,'data/metrics/herman-miller-sayl-public-glb-capture-latest.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,download_control_found:opened,glb_control_clicked:glbClicked,asset:asset?{source_url:asset.source_url,source_class:asset.source_class,bytes:asset.bytes,sha256:asset.sha256}:null,rejected_generic_glbs:result.rejected_generic_glbs.length},null,2));
} finally {await browser.close()}
