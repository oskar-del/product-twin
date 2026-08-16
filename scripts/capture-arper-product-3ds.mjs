import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const targetPath=process.env.ARPER_TARGET;
if(!targetPath)throw new Error('ARPER_TARGET is required');
const target=JSON.parse(await fs.readFile(path.resolve(ROOT,targetPath),'utf8'));
const slug=target.target_id.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const runtime=path.join(ROOT,'.runtime',slug);
await fs.mkdir(runtime,{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await context.newPage();
let sourceUrl=null,saved=null,method=null;
try{
  await page.goto(target.manufacturer_page,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForTimeout(7000);
  for(const re of [/accept all/i,/aceptar todas/i,/accept/i,/aceptar/i]){const b=page.getByRole('button',{name:re});if(await b.count().catch(()=>0)){try{await b.first().click({timeout:1500});break}catch{}}}
  await page.waitForTimeout(1200);

  const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.textContent||'').trim().replace(/\s+/g,' '),href:a.href})).filter(x=>/\.3ds(?:[?#]|$)/i.test(x.href))).catch(()=>[]);
  const exactLinks=links.filter(x=>!/(3ds\s*max|max)/i.test(x.text));
  const article=String(target.article_no||'').toLowerCase();
  const family=String(target.product_family||'').toLowerCase().replace(/\s+/g,'_');
  const ranked=exactLinks.sort((a,b)=>{
    const score=x=>{const s=(x.href+' '+x.text).toLowerCase();return (article&&s.includes(article)?5:0)+(family&&s.includes(family)?2:0)+(/\.3ds(?:[?#]|$)/i.test(x.href)?1:0)};
    return score(b)-score(a);
  });
  const link=ranked[0];
  if(link?.href){
    try{const r=await context.request.get(link.href,{timeout:120000});if(r.ok()){const body=await r.body();if(body.length>10000){saved=path.join(runtime,'source.3ds');await fs.writeFile(saved,body);sourceUrl=link.href;method='direct_dom_3ds_href'}}}catch{}
  }

  if(!saved){
    const exact=page.getByText(/^3DS$/i);
    if(await exact.count().catch(()=>0)){
      for(let i=0;i<await exact.count();i++){
        try{const dlPromise=page.waitForEvent('download',{timeout:20000}).catch(()=>null);await exact.nth(i).click({timeout:5000});const dl=await dlPromise;if(dl){saved=path.join(runtime,'source.3ds');await dl.saveAs(saved);sourceUrl=dl.url();method='browser_download';break}}catch{}
      }
    }
  }

  let asset=null;
  if(saved){const body=await fs.readFile(saved);asset={runtime_path:path.relative(ROOT,saved),source_url:sourceUrl,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),signature_hex:body.subarray(0,2).toString('hex'),three_ds_signature_valid:body.subarray(0,2).toString('hex').toLowerCase()==='4d4d'};}
  const out={generated_at:new Date().toISOString(),target_id:target.target_id,article_no:target.article_no,status:asset?.three_ds_signature_valid?'EXACT_MANUFACTURER_3DS_CAPTURED':'NO_VALID_3DS_CAPTURED',method,asset,manufacturer_page:target.manufacturer_page,policy:'Public manufacturer resource only. Source binary is ephemeral and never committed; geometry usage rights remain an independent gate.'};
  const metric=path.join(ROOT,'data','metrics',`${slug}-3ds-capture-latest.json`);await fs.writeFile(metric,JSON.stringify(out,null,2));
  console.log(JSON.stringify({metric:path.relative(ROOT,metric),status:out.status,asset:asset?{bytes:asset.bytes,sha256:asset.sha256,source_url:asset.source_url}:null},null,2));
}finally{await browser.close()}
