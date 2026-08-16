import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const targetPath=process.argv[2]||'config/geometry/gf-sanipex-1158140-target.json';
const target=JSON.parse(await fs.readFile(path.join(ROOT,targetPath),'utf8'));
const slug=target.target_id.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const runtime=path.join(ROOT,'.runtime',slug);
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','geometry'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100},locale:'en-GB'});
const page=await context.newPage();
const downloads=[];const network=[];
page.on('response',r=>{const u=r.url();if(/download|bim|export|obj|ifc|rfa|dwg|fbx|sat|zip/i.test(u))network.push({url:u,status:r.status(),content_type:r.headers()['content-type']??null})});
page.on('download',async d=>{
  try{
    const name=d.suggestedFilename();const out=path.join(runtime,name);
    await d.saveAs(out);const buf=await fs.readFile(out);
    downloads.push({name,runtime_path:path.relative(ROOT,out),bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),source_url:d.url()});
  }catch(e){downloads.push({error:String(e)})}
});

const slim=s=>String(s??'').replace(/\s+/g,' ').trim();
async function clickAny(root,rx){
  const locs=[root.getByRole?.('button',{name:rx}),root.getByRole?.('link',{name:rx}),root.getByText?.(rx,{exact:true}),root.locator?.('button:visible').filter?.({hasText:rx}),root.locator?.('a:visible').filter?.({hasText:rx}),root.locator?.('label:visible').filter?.({hasText:rx})].filter(Boolean);
  for(const loc of locs){let n=0;try{n=await loc.count()}catch{};for(let i=0;i<n;i++){try{const el=loc.nth(i);if(await el.isVisible()){await el.click({timeout:6000});return true}}catch{}}}
  return false;
}
async function snapshot(){
  const out=[];
  for(const f of page.frames()){
    try{out.push(...await f.locator('button:visible,a:visible,[role="button"]:visible,label:visible,input:visible').evaluateAll(els=>els.slice(0,220).map(e=>({tag:e.tagName.toLowerCase(),text:(e.innerText||e.textContent||e.value||'').replace(/\s+/g,' ').trim().slice(0,180),href:e.href||null,type:e.type||null,name:e.name||null,value:e.value||null,aria:e.getAttribute('aria-label')}))))}catch{}
  }
  return out;
}

let result;
try{
  await page.goto(target.bim_page,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(9000);
  await clickAny(page,/accept all|accept|zustimmen|alle akzeptieren/i).catch(()=>false);
  await page.waitForTimeout(1200);

  const body=slim(await page.locator('body').innerText().catch(()=>''));
  const identity={
    manufacturer_part_visible:body.includes(target.manufacturer_part_no),
    gf_item_visible:body.includes(target.gf_item_no),
    ean_visible:body.includes(target.ean),
    etim_visible:body.includes(target.etim_class),
    d16_visible:/d16|D16|d\s*16/i.test(body),
    available_formats:(target.geometry.official_formats??[]).filter(fmt=>new RegExp(fmt.replace('DWG2D','dwg').replace('DWG3D','dwg'),'i').test(body))
  };

  const initialControls=await snapshot();
  let selectedVariant=false;
  for(const f of page.frames())if(await clickAny(f,new RegExp(`^${target.manufacturer_part_no}|${target.manufacturer_part_no}`,'i'))){selectedVariant=true;break}
  if(selectedVariant)await page.waitForTimeout(2000);

  let opened=false;
  for(const f of page.frames())if(await clickAny(f,/download|herunterladen|descargar|scarica|télécharger/i)){opened=true;break}
  if(opened)await page.waitForTimeout(3000);
  const afterDownloadOpen=await snapshot();

  const wanted=[{key:'OBJ',rx:/^OBJ$|\bOBJ\b/i},{key:'IFC',rx:/^IFC$|\bIFC\b/i},{key:'RFA',rx:/^RFA$|Revit/i}];
  const attempts=[];
  for(const w of wanted){
    const before=downloads.length;let selected=false;
    for(const f of page.frames())if(await clickAny(f,w.rx)){selected=true;break}
    if(selected){
      await page.waitForTimeout(1000);
      // If format selection doesn't immediately download, use the visible download/export action.
      if(downloads.length===before){for(const f of page.frames())if(await clickAny(f,/download|herunterladen|export|generate/i))break;}
      await page.waitForTimeout(6000);
    }
    attempts.push({format:w.key,selected,download_delta:downloads.length-before});
  }

  const controls=await snapshot();
  const assetLikeControls=[...initialControls,...afterDownloadOpen,...controls].filter(x=>/OBJ|IFC|RFA|Revit|DWG|FBX|SAT|download|herunterladen|export/i.test(`${x.text} ${x.href??''}`));
  const geometryDownloads=downloads.filter(d=>d.name&&/\.(obj|ifc|rfa|dwg|dxf|fbx|sat|zip)$/i.test(d.name));
  result={
    generated_at:new Date().toISOString(),target_id:target.target_id,status:geometryDownloads.length?'PRODUCT_BOUND_BIM_DOWNLOAD_CAPTURED_EPHEMERAL':(opened?'DOWNLOAD_UI_OPENED_NO_GEOMETRY_BINARY':'BIM_PAGE_REACHED_DOWNLOAD_UI_NOT_OPENED'),
    page_reached:Boolean(body),identity_evidence:identity,variant_selected:selectedVariant,download_ui_opened:opened,attempts,
    geometry_downloads:geometryDownloads,other_downloads:downloads.filter(d=>!geometryDownloads.includes(d)),
    asset_like_controls:[...new Map(assetLikeControls.map(x=>[`${x.tag}|${x.text}|${x.href}`,x])).values()].slice(0,160),
    network_signals:[...new Map(network.map(x=>[x.url,x])).values()].slice(-180),
    rights:{source_intent:'official BIM service for design/specification',persistent_storage:'review',derivative_conversion:'review',render_use:'review'},
    policy:'Interact only with the public official BIM service. Downloaded manufacturer binaries remain ephemeral and are never committed.'
  };
}catch(e){result={generated_at:new Date().toISOString(),target_id:target.target_id,status:'ERROR',error:String(e),downloads,network_signals:network.slice(-120)}}finally{await browser.close()}

const stem=slug;
await fs.writeFile(path.join(ROOT,'data','geometry',`${stem}-capture.json`),JSON.stringify(result,null,2));
await fs.writeFile(path.join(ROOT,'data','metrics',`${stem}-capture-latest.json`),JSON.stringify({generated_at:result.generated_at,target_id:result.target_id,status:result.status,page_reached:result.page_reached??false,identity_evidence:result.identity_evidence??null,download_ui_opened:result.download_ui_opened??false,geometry_downloads:(result.geometry_downloads??[]).map(x=>({name:x.name,bytes:x.bytes,sha256:x.sha256}))},null,2));
console.log(JSON.stringify({status:result.status,identity:result.identity_evidence,geometry_downloads:(result.geometry_downloads??[]).map(x=>({name:x.name,bytes:x.bytes,sha256:x.sha256}))},null,2));
