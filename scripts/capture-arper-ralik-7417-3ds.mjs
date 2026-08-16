import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const target=JSON.parse(await fs.readFile(path.join(ROOT,'config/geometry/arper-ralik-7417-target.json'),'utf8'));
const runtime=path.join(ROOT,'.runtime','arper-ralik-7417');
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await context.newPage();
let sourceUrl=null,saved=null,method=null;
try{
  await page.goto(target.manufacturer_page,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(8000);
  for(const re of [/accept all/i,/aceptar todas/i,/accept/i,/aceptar/i]){
    const b=page.getByRole('button',{name:re});if(await b.count().catch(()=>0)){try{await b.first().click({timeout:1500});break}catch{}}
  }
  await page.waitForTimeout(1500);

  const exact=page.getByText(/^3DS$/i);
  if(await exact.count().catch(()=>0)){
    for(let i=0;i<await exact.count();i++){
      const el=exact.nth(i);
      const anchor=el.locator('xpath=ancestor-or-self::a[1]');
      const href=await anchor.getAttribute('href').catch(()=>null);
      if(href){
        try{sourceUrl=new URL(href,page.url()).href;const r=await context.request.get(sourceUrl,{timeout:120000});if(r.ok()){const body=await r.body();if(body.length>10000){saved=path.join(runtime,'source.3ds');await fs.writeFile(saved,body);method='direct_resource_href';break}}}catch{}
      }
      try{
        const dlPromise=page.waitForEvent('download',{timeout:20000}).catch(()=>null);await el.click({timeout:5000});const dl=await dlPromise;
        if(dl){saved=path.join(runtime,'source.3ds');await dl.saveAs(saved);sourceUrl=dl.url();method='browser_download';break}
      }catch{}
    }
  }

  if(!saved){
    const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.textContent||'').trim(),href:a.href})).filter(x=>/\.3ds(?:[?#]|$)/i.test(x.href)&&!/max/i.test(x.text))).catch(()=>[]);
    const link=links.find(x=>/7417|207417|ralik/i.test(x.href+x.text))??links[0];
    if(link?.href){try{const r=await context.request.get(link.href,{timeout:120000});if(r.ok()){const body=await r.body();if(body.length>10000){saved=path.join(runtime,'source.3ds');await fs.writeFile(saved,body);sourceUrl=link.href;method='dom_3ds_href_scan'}}}catch{}}
  }

  let asset=null;
  if(saved){
    const body=await fs.readFile(saved);asset={runtime_path:path.relative(ROOT,saved),source_url:sourceUrl,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),signature_hex:body.subarray(0,2).toString('hex'),three_ds_signature_valid:body.subarray(0,2).toString('hex').toLowerCase()==='4d4d'};
  }
  const out={generated_at:new Date().toISOString(),target_id:target.target_id,status:asset?.three_ds_signature_valid?'EXACT_MANUFACTURER_3DS_CAPTURED':'NO_VALID_3DS_CAPTURED',method,asset,manufacturer_page:target.manufacturer_page,policy:'Public manufacturer resource only. Source binary is ephemeral and never committed; conversion/render rights remain a separate gate.'};
  await fs.writeFile(path.join(ROOT,'data/metrics/arper-ralik-7417-3ds-capture-latest.json'),JSON.stringify(out,null,2));
  console.log(JSON.stringify({status:out.status,method,asset:asset?{bytes:asset.bytes,sha256:asset.sha256,source_url:asset.source_url}:null},null,2));
} finally {await browser.close()}
