import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const target=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/gf-sanipex-4700-096-target.json'),'utf8'));
const runtime=path.join(ROOT,'.runtime','gf-sanipex-4700-096');
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','geometry'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const interesting=/cad|bim|cadenas|partcommunity|3dfindit|download|\.obj(?:[?#]|$)|\.ifc(?:[?#]|$)|\.rfa(?:[?#]|$)|\.dwg(?:[?#]|$)|\.sat(?:[?#]|$)|\.step(?:[?#]|$)|\.stp(?:[?#]|$)/i;
const assetExt=/\.(obj|ifc|rfa|dwg|sat|step|stp|zip)(?:[?#]|$)/i;
const network=[];
const downloads=[];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await context.newPage();
page.on('response',r=>{if(interesting.test(r.url()))network.push({url:r.url(),status:r.status(),content_type:r.headers()['content-type']??null})});
page.on('download',async d=>{
  try{
    const name=d.suggestedFilename();
    const out=path.join(runtime,name);
    await d.saveAs(out);
    const buf=await fs.readFile(out);
    downloads.push({suggested_filename:name,runtime_path:path.relative(ROOT,out),bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),source_url:d.url()});
  }catch(e){downloads.push({error:String(e)})}
});

function slimText(s){return String(s??'').replace(/\s+/g,' ').trim()}

async function controls(root){
  try{
    return await root.locator('a:visible,button:visible,[role="button"]:visible').evaluateAll(els=>els.slice(0,250).map(e=>({tag:e.tagName.toLowerCase(),text:(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim().slice(0,180),href:e.href||null,aria:e.getAttribute('aria-label')})));
  }catch{return []}
}

async function clickByName(root,regex){
  const variants=[root.getByRole?.('button',{name:regex}),root.getByRole?.('link',{name:regex}),root.getByText?.(regex,{exact:true}),root.locator?.('button:visible').filter?.({hasText:regex}),root.locator?.('a:visible').filter?.({hasText:regex})].filter(Boolean);
  for(const loc of variants){
    let n=0;try{n=await loc.count()}catch{}
    for(let i=0;i<n;i++){
      try{if(await loc.nth(i).isVisible()){await loc.nth(i).click({timeout:6000});return true}}catch{}
    }
  }
  return false;
}

let pageError=null;
try{
  await page.goto(target.manufacturer_page,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(7000);
  await clickByName(page,/accept all|accept cookies|agree/i).catch(()=>false);
  await page.waitForTimeout(1200);

  const initialBody=slimText(await page.locator('body').innerText().catch(()=>''));
  const identityEvidence={
    code_visible:initialBody.includes(target.manufacturer_code),
    family_visible:/sanipex/i.test(initialBody),
    d16_visible:/d\s*16|16\s*mm/i.test(initialBody),
    half_inch_visible:/1\s*[∕\/]\s*2|1\/2/i.test(initialBody),
    dimensions_visible:['43','37','16.5','27'].filter(x=>initialBody.includes(x))
  };

  const before=await controls(page);
  const clickedCad=await clickByName(page,/^CAD$|CAD data|CAD/i);
  if(clickedCad)await page.waitForTimeout(5500);
  const cadFrames=page.frames();
  const afterCad=[];
  for(const f of cadFrames)afterCad.push(...await controls(f));

  let clickedBim=false;
  for(const f of page.frames())if(await clickByName(f,/^BIM$|BIM data|BIM/i)){clickedBim=true;break}
  if(clickedBim)await page.waitForTimeout(5500);
  const afterBim=[];
  for(const f of page.frames())afterBim.push(...await controls(f));

  // Use intended visible download/format controls only. Do not synthesize protected endpoints.
  const formats=[/\bOBJ\b/i,/\bIFC\b/i,/\bRevit\b|\bRFA\b/i,/3D\s*DWG|\bDWG\b/i,/\bSAT\b/i,/\bSTEP\b|\bSTP\b/i];
  for(const regex of formats){
    for(const f of page.frames()){
      const beforeCount=downloads.length;
      const clicked=await clickByName(f,regex);
      if(clicked){
        await page.waitForTimeout(3500);
        // Some UIs require a second Download click after selecting a format.
        if(downloads.length===beforeCount){await clickByName(f,/download|descargar|herunterladen/i);await page.waitForTimeout(4500)}
        if(downloads.length>beforeCount)break;
      }
    }
  }

  const linkCandidates=[...before,...afterCad,...afterBim].filter(x=>interesting.test(`${x.text??''} ${x.href??''} ${x.aria??''}`));
  const directAssets=[...new Map([...network.map(x=>[x.url,x]),...linkCandidates.filter(x=>x.href).map(x=>[x.href,{url:x.href,status:null,content_type:null}])]).values()].filter(x=>assetExt.test(x.url));

  const result={
    generated_at:new Date().toISOString(),target_id:target.target_id,manufacturer:target.manufacturer,model:target.model,
    page_reached:Boolean(initialBody),identity_evidence:identityEvidence,
    cad_control_clicked:clickedCad,bim_control_clicked:clickedBim,
    visible_asset_controls:[...new Map(linkCandidates.map(x=>[`${x.text}|${x.href}`,x])).values()].slice(0,120),
    direct_asset_references:directAssets.slice(0,80),
    downloads,
    network_signals:[...new Map(network.map(x=>[x.url,x])).values()].slice(-180),
    status:downloads.some(x=>!x.error)?'MANUFACTURER_CAD_BIM_BINARY_CAPTURED_EPHEMERAL':(directAssets.length?'PRODUCT_BOUND_ASSET_REFERENCE_FOUND':'CAD_BIM_UI_PROBED_NO_BINARY'),
    promotion:{current_level:'G0',target_level:'G4',exact_claim_allowed:false,blockers:['validate captured asset is product-bound and physically matches manufacturer dimensions','validate connection/interface metadata','confirm render/derivative/persistent-storage rights','resolve Spain/EU procurement route']},
    policy:'Only manufacturer public CAD/BIM controls were used. Any captured binary remains ephemeral and is not committed.'
  };
  await fs.writeFile(path.join(ROOT,'data','geometry','gf-sanipex-4700-096-cad-bim-probe.json'),JSON.stringify(result,null,2));
  await fs.writeFile(path.join(ROOT,'data','metrics','gf-sanipex-4700-096-cad-bim-probe-latest.json'),JSON.stringify({generated_at:result.generated_at,target_id:result.target_id,status:result.status,page_reached:result.page_reached,cad_control_clicked:result.cad_control_clicked,bim_control_clicked:result.bim_control_clicked,direct_asset_references:result.direct_asset_references.length,downloads:result.downloads.filter(x=>!x.error).length,identity_evidence:result.identity_evidence},null,2));
  console.log(JSON.stringify({status:result.status,cad:clickedCad,bim:clickedBim,direct_assets:directAssets.length,downloads:downloads.filter(x=>!x.error).map(x=>({name:x.suggested_filename,bytes:x.bytes,sha256:x.sha256}))},null,2));
}catch(e){
  pageError=String(e);
  const result={generated_at:new Date().toISOString(),target_id:target.target_id,status:'ERROR',error:pageError,network_signals:network.slice(-100),downloads,policy:'No manufacturer binary committed.'};
  await fs.writeFile(path.join(ROOT,'data','geometry','gf-sanipex-4700-096-cad-bim-probe.json'),JSON.stringify(result,null,2));
  await fs.writeFile(path.join(ROOT,'data','metrics','gf-sanipex-4700-096-cad-bim-probe-latest.json'),JSON.stringify(result,null,2));
  console.error(pageError);
}finally{await browser.close()}
