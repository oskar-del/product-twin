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
page.on('response',r=>{const u=r.url();if(/download|bim|export|obj|ifc|rfa|dwg|fbx|sat|zip|asset|file/i.test(u))network.push({url:u,status:r.status(),content_type:r.headers()['content-type']??null})});
page.on('download',async d=>{
  try{
    const name=d.suggestedFilename();const out=path.join(runtime,name);
    await d.saveAs(out);const buf=await fs.readFile(out);
    downloads.push({name,runtime_path:path.relative(ROOT,out),bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),source_url:d.url()});
  }catch(e){downloads.push({error:String(e)})}
});

const slim=s=>String(s??'').replace(/\s+/g,' ').trim();
async function clickAny(root,rx){
  const locs=[
    root.getByRole?.('button',{name:rx}),root.getByRole?.('link',{name:rx}),root.getByRole?.('option',{name:rx}),
    root.getByRole?.('checkbox',{name:rx}),root.getByRole?.('radio',{name:rx}),root.getByRole?.('menuitem',{name:rx}),
    root.getByText?.(rx,{exact:true}),root.locator?.('button:visible').filter?.({hasText:rx}),root.locator?.('a:visible').filter?.({hasText:rx}),
    root.locator?.('label:visible').filter?.({hasText:rx}),root.locator?.('[role="option"]:visible').filter?.({hasText:rx}),
    root.locator?.('[role="checkbox"]:visible').filter?.({hasText:rx}),root.locator?.('[role="radio"]:visible').filter?.({hasText:rx})
  ].filter(Boolean);
  for(const loc of locs){let n=0;try{n=await loc.count()}catch{};for(let i=0;i<n;i++){try{const el=loc.nth(i);if(await el.isVisible()){await el.click({timeout:6000});return true}}catch{}}}
  return false;
}

async function selectFormat(root,key){
  const rx=key==='RFA'?/^(RFA|Revit)$/i:new RegExp(`^${key}$`,'i');
  try{
    const sels=root.locator('select:visible');const n=await sels.count();
    for(let i=0;i<n;i++){
      const s=sels.nth(i);const opts=await s.locator('option').evaluateAll(os=>os.map(o=>({label:(o.textContent||'').trim(),value:o.value})));
      const hit=opts.find(o=>rx.test(o.label)||rx.test(o.value));
      if(hit){await s.selectOption(hit.value);return {selected:true,method:'native_select',evidence:hit}}
    }
  }catch{}
  try{
    const inputs=root.locator('input[type="checkbox"]:visible,input[type="radio"]:visible');const n=await inputs.count();
    for(let i=0;i<n;i++){
      const el=inputs.nth(i);const a=await el.evaluate(e=>({value:e.value||'',id:e.id||'',name:e.name||'',aria:e.getAttribute('aria-label')||'',parent:(e.closest('label')?.innerText||e.parentElement?.innerText||'').trim()}));
      if([a.value,a.id,a.name,a.aria,a.parent].some(v=>rx.test(v))){await el.check({timeout:5000}).catch(async()=>el.click({timeout:5000}));return {selected:true,method:'native_check_radio',evidence:a}}
    }
  }catch{}
  if(await clickAny(root,rx))return {selected:true,method:'visible_ui_label',evidence:null};
  return {selected:false,method:null,evidence:null};
}

let result;
try{
  await page.goto(target.bim_page,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(9000);
  await clickAny(page,/accept all|accept|zustimmen|alle akzeptieren/i).catch(()=>false);
  await page.waitForTimeout(1000);

  const body=slim(await page.locator('body').innerText().catch(()=>''));
  const identity={
    manufacturer_part_visible:body.includes(target.manufacturer_part_no),
    gf_item_visible:body.includes(target.gf_item_no),
    ean_visible:body.includes(target.ean),
    etim_visible:body.includes(target.etim_class),
    d16_visible:/d16|D16|d\s*16/i.test(body),
    available_formats:(target.geometry.official_formats??[]).filter(fmt=>new RegExp(fmt.replace('DWG2D','dwg').replace('DWG3D','dwg'),'i').test(body))
  };

  let selectedVariant=false;
  for(const f of page.frames())if(await clickAny(f,new RegExp(target.manufacturer_part_no,'i'))){selectedVariant=true;break}
  if(selectedVariant)await page.waitForTimeout(1500);

  let opened=false;
  for(const f of page.frames())if(await clickAny(f,/download|herunterladen|descargar|scarica|télécharger/i)){opened=true;break}
  if(opened)await page.waitForTimeout(2800);
  const panelBody=slim(await page.locator('body').innerText().catch(()=>''));
  const accountRequired=/Benutzerkonto erforderlich|user account required|account required|sign in.*continue|anmelden.*fortzufahren|registrieren.*anmelden/i.test(panelBody);
  const tokenIndex=Math.max(panelBody.indexOf('OBJ'),panelBody.indexOf('IFC'),panelBody.indexOf('Revit'),panelBody.indexOf('RFA'));
  const format_neighborhood=tokenIndex>=0?panelBody.slice(Math.max(0,tokenIndex-650),Math.min(panelBody.length,tokenIndex+1800)):null;

  const attempts=[];
  if(!accountRequired){
    for(const key of ['OBJ','IFC','RFA']){
      const before=downloads.length;let selection={selected:false,method:null,evidence:null};
      for(const f of page.frames()){selection=await selectFormat(f,key);if(selection.selected)break}
      if(selection.selected){
        await page.waitForTimeout(800);
        if(downloads.length===before){for(const f of page.frames())if(await clickAny(f,/^download$|^herunterladen$|export|generate|erstellen/i))break;}
        await page.waitForTimeout(6000);
      }
      attempts.push({format:key,...selection,download_delta:downloads.length-before});
      if(downloads.length>before)break;
    }
  }

  const geometryDownloads=downloads.filter(d=>d.name&&/\.(obj|ifc|rfa|dwg|dxf|fbx|sat|step|stp|zip)$/i.test(d.name));
  const status=geometryDownloads.length?'PRODUCT_BOUND_BIM_DOWNLOAD_CAPTURED_EPHEMERAL':accountRequired?'BIM_FORMATS_VERIFIED_ACCOUNT_REQUIRED':opened?'DOWNLOAD_UI_OPENED_NO_GEOMETRY_BINARY':'BIM_PAGE_REACHED_DOWNLOAD_UI_NOT_OPENED';
  result={
    generated_at:new Date().toISOString(),target_id:target.target_id,status,
    page_reached:Boolean(body),identity_evidence:identity,variant_selected:selectedVariant,download_ui_opened:opened,account_required:accountRequired,attempts,
    geometry_downloads:geometryDownloads,other_downloads:downloads.filter(d=>!geometryDownloads.includes(d)),format_neighborhood,
    network_signals:[...new Map(network.map(x=>[x.url,x])).values()].slice(-200),
    rights:{source_intent:'official BIM service for design/specification',persistent_storage:'review',derivative_conversion:'review',render_use:'review'},
    policy:'Interact only with the public official BIM service UI. If the service requires an account, stop and record the gate; do not synthesize or bypass protected download endpoints.'
  };
}catch(e){result={generated_at:new Date().toISOString(),target_id:target.target_id,status:'ERROR',error:String(e),downloads,network_signals:network.slice(-140)}}finally{await browser.close()}

await fs.writeFile(path.join(ROOT,'data','geometry',`${slug}-capture.json`),JSON.stringify(result,null,2));
await fs.writeFile(path.join(ROOT,'data','metrics',`${slug}-capture-latest.json`),JSON.stringify({generated_at:result.generated_at,target_id:result.target_id,status:result.status,page_reached:result.page_reached??false,identity_evidence:result.identity_evidence??null,download_ui_opened:result.download_ui_opened??false,account_required:result.account_required??false,attempts:result.attempts??[],geometry_downloads:(result.geometry_downloads??[]).map(x=>({name:x.name,bytes:x.bytes,sha256:x.sha256}))},null,2));
console.log(JSON.stringify({status:result.status,identity:result.identity_evidence,account_required:result.account_required,geometry_downloads:(result.geometry_downloads??[]).map(x=>({name:x.name,bytes:x.bytes,sha256:x.sha256}))},null,2));
