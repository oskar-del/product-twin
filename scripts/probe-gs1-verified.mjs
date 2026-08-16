import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config/identity/gs1-verification-targets.json'),'utf8'));
await fs.mkdir(path.join(ROOT,'data','identity'),{recursive:true});
await fs.mkdir(path.join(ROOT,'data','metrics'),{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'en-US'});
const page=await context.newPage();

async function clickIfVisible(root,patterns){
  for(const p of patterns){
    const loc=root.getByRole?.('button',{name:p})??null;
    if(loc){try{if(await loc.count()){await loc.first().click({timeout:2500});return true}}catch{}}
  }
  return false;
}

function cleanText(s){return String(s??'').replace(/\s+/g,' ').trim()}

const target=cfg.targets?.[0];
let result={generated_at:new Date().toISOString(),source_id:'gs1_verified',target_id:target?.target_id??null,gtin:target?.gtin??null,status:'UNRESOLVED',query_submitted:false,page_reached:false,matched_signals:[],evidence_excerpt:null,policy:'One deliberate public Verified by GS1 lookup; no crawling or batching.'};

try{
  const urls=['https://www.gs1.org/services/verified-by-gs1','https://www2.gs1.org/services/verified-by-gs1'];
  let loaded=false;
  for(const url of urls){
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForTimeout(5000);
      if((await page.title()).length||cleanText(await page.locator('body').innerText().catch(()=>''))){loaded=true;result.page_reached=true;break}
    }catch{}
  }
  if(!loaded)throw new Error('GS1 public service page not reachable');

  await clickIfVisible(page,[/accept all/i,/accept/i,/agree/i]);
  await page.waitForTimeout(1500);

  const roots=[page,...page.frames().filter(f=>f!==page.mainFrame())];
  let submitted=false;
  for(const root of roots){
    let inputs=[];
    try{
      inputs=[
        root.getByPlaceholder?.(/barcode|gtin/i),
        root.locator?.('input[placeholder*="GTIN" i]'),
        root.locator?.('input[placeholder*="barcode" i]'),
        root.locator?.('input[type="text"]')
      ].filter(Boolean);
    }catch{}
    for(const loc of inputs){
      let n=0;try{n=await loc.count()}catch{}
      if(!n)continue;
      for(let i=0;i<n;i++){
        try{
          const el=loc.nth(i);
          if(!(await el.isVisible()))continue;
          const ph=(await el.getAttribute('placeholder'))??'';
          const aria=(await el.getAttribute('aria-label'))??'';
          if(i>0&&!/gtin|barcode/i.test(`${ph} ${aria}`))continue;
          await el.fill(target.gtin,{timeout:4000});
          const searchButtons=[root.getByRole?.('button',{name:/search|verify/i}),root.locator?.('button:visible').filter?.({hasText:/search|verify/i})].filter(Boolean);
          let clicked=false;
          for(const b of searchButtons){try{if(await b.count()){await b.first().click({timeout:5000});clicked=true;break}}catch{}}
          if(!clicked){try{await el.press('Enter',{timeout:3000});clicked=true}catch{}}
          if(clicked){submitted=true;result.query_submitted=true;break}
        }catch{}
      }
      if(submitted)break;
    }
    if(submitted)break;
  }

  if(submitted)await page.waitForTimeout(9000);

  const texts=[];
  for(const root of roots){
    try{const t=cleanText(await root.locator('body').innerText({timeout:5000}));if(t)texts.push(t)}catch{}
  }
  const combined=cleanText(texts.join(' '));
  const lower=combined.toLowerCase();
  const signals=[];
  if(lower.includes(target.gtin.toLowerCase()))signals.push('gtin_visible_in_result');
  for(const s of target.expected_brand_signals??[])if(lower.includes(s.toLowerCase()))signals.push(`brand:${s}`);
  for(const s of target.expected_product_signals??[])if(lower.includes(s.toLowerCase()))signals.push(`product:${s}`);
  if(/licen[cs]e|licensed to|company/i.test(combined))signals.push('licensee_or_company_evidence');
  if(/valid|verified|issued by gs1|found/i.test(combined))signals.push('verification_language');
  result.matched_signals=[...new Set(signals)];

  const gtinIndex=lower.indexOf(target.gtin.toLowerCase());
  const brandIndex=Math.max(...(target.expected_brand_signals??[]).map(s=>lower.indexOf(s.toLowerCase())),-1);
  const idx=Math.max(gtinIndex,brandIndex);
  if(idx>=0)result.evidence_excerpt=combined.slice(Math.max(0,idx-280),Math.min(combined.length,idx+850));
  else result.evidence_excerpt=combined.slice(0,900)||null;

  const brandHit=(target.expected_brand_signals??[]).some(s=>lower.includes(s.toLowerCase()));
  const productHits=(target.expected_product_signals??[]).filter(s=>lower.includes(s.toLowerCase())).length;
  if(submitted&&brandHit&&productHits>=1)result.status='NEUTRAL_IDENTITY_MATCH';
  else if(submitted&&brandHit)result.status='LICENSEE_IDENTITY_MATCH_PRODUCT_DATA_INCOMPLETE';
  else if(submitted&&signals.length)result.status='GS1_RESPONSE_RECEIVED_MATCH_UNRESOLVED';
  else if(submitted)result.status='PUBLIC_LOOKUP_SUBMITTED_NO_MATCH_EVIDENCE';
  else result.status='PUBLIC_LOOKUP_UI_NOT_AUTOMATABLE';
}catch(e){result.status='ERROR';result.error=String(e)}finally{await browser.close()}

result.generated_at=new Date().toISOString();
await fs.writeFile(path.join(ROOT,'data','identity','gs1-verified-latest.json'),JSON.stringify(result,null,2));
await fs.writeFile(path.join(ROOT,'data','metrics','gs1-verified-latest.json'),JSON.stringify({generated_at:result.generated_at,source_id:result.source_id,target_id:result.target_id,gtin:result.gtin,status:result.status,page_reached:result.page_reached,query_submitted:result.query_submitted,matched_signals:result.matched_signals},null,2));
console.log(JSON.stringify({status:result.status,page_reached:result.page_reached,query_submitted:result.query_submitted,matched_signals:result.matched_signals},null,2));
