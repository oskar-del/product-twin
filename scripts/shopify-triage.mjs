import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,".runtime/shopify");
const candidates=JSON.parse(await fs.readFile(path.join(RUNTIME,"candidates.json"),"utf8"));
const FITNESS_WEIGHT={primary:1.0,secondary:0.75,experimental:0.45};

function mediaScore(c){const media=c.product?.media??[];if(!media.length)return 0;const imageCount=media.filter(m=>m.type==="image"||m.mediaContentType==="IMAGE").length;return Math.min(1,imageCount/3||media.length/3);}
function offerScore(c){const o=c.best_offer;if(!o)return 0;let s=0;if(o.price_minor!=null)s+=.30;if(o.currency)s+=.10;if(o.seller)s+=.15;if(o.available!==false)s+=.15;if(o.checkout_url)s+=.15;if(o.attributed_url)s+=.15;return Math.min(1,s);}
function identityScore(c){let s=0;if(c.identity?.shopify_id)s+=.35;if(c.identity?.title)s+=.30;if(c.identity?.url)s+=.20;if(c.best_offer?.sku)s+=.15;return Math.min(1,s);}
function textQuality(c){const title=c.product?.title??c.identity?.title??"";const desc=typeof c.product?.description==="string"?c.product.description:JSON.stringify(c.product?.description??"");let s=0;if(title.length>=5)s+=.45;if(desc.length>=40)s+=.25;if((c.product?.categories??[]).length)s+=.15;if((c.product?.variant_count??0)>0)s+=.15;return Math.min(1,s);}
function provisionalCategory(c){const hints=c.taxonomy?.canonical_category_hints??[];const scores=new Map();for(const h of hints){const w=FITNESS_WEIGHT[h.source_fitness]??.5;scores.set(h.canonical_category_id,(scores.get(h.canonical_category_id)??0)+w);}const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]);if(!ranked.length)return{id:null,confidence:0,alternatives:[]};const total=ranked.reduce((a,x)=>a+x[1],0);return{id:ranked[0][0],confidence:Number((ranked[0][1]/total).toFixed(3)),alternatives:ranked.slice(1,4).map(([id,score])=>({id,score:Number((score/total).toFixed(3))}))};}
function triage(c){const category=provisionalCategory(c);const scores={identity:identityScore(c),commerce:offerScore(c),media:mediaScore(c),text:textQuality(c)};const candidate_quality=scores.identity*.27+scores.commerce*.38+scores.media*.22+scores.text*.13;const holds=[];if(scores.identity<.65)holds.push("identity_enrichment");if(scores.commerce<.55)holds.push("commerce_enrichment");if(scores.media<.25)holds.push("media_enrichment");if(!category.id||category.confidence<.55)holds.push("taxonomy_review");return{...c,taxonomy:{...(c.taxonomy??{}),canonical_category_id:category.id,canonical_category_confidence:category.confidence,canonical_category_alternatives:category.alternatives,classification_status:category.confidence>=.75?"provisional_high":"provisional_review"},triage:{candidate_quality:Number(candidate_quality.toFixed(4)),scores,holds,next_gate:"identity_dimensions_geometry_rights_specification",render_ready:false}};}

const triaged=candidates.map(triage).sort((a,b)=>b.triage.candidate_quality-a.triage.candidate_quality);
const byCategory=new Map();for(const c of triaged){const key=c.taxonomy?.canonical_category_id??"UNCLASSIFIED";const arr=byCategory.get(key)??[];arr.push(c);byCategory.set(key,arr);}
await fs.writeFile(path.join(RUNTIME,"triage.json"),JSON.stringify(triaged));
const analytics={generated_at:new Date().toISOString(),input_candidates:candidates.length,triaged_candidates:triaged.length,classified_categories:byCategory.size,by_category:Object.fromEntries([...byCategory].map(([k,v])=>[k,{count:v.length,top_quality:v[0]?.triage?.candidate_quality??null,average_quality:Number((v.reduce((a,x)=>a+x.triage.candidate_quality,0)/Math.max(1,v.length)).toFixed(4))}])),storage_policy:"triage_payload_ephemeral_not_cached",disclaimer:"Shopify catalog-derived records exist only in ephemeral runtime. Category assignment is provisional and does not imply technical suitability."};
await fs.mkdir(path.join(ROOT,"data/metrics"),{recursive:true});
await fs.writeFile(path.join(ROOT,"data/metrics/shopify-triage-latest.json"),JSON.stringify(analytics,null,2));
console.log(`Triaged ${triaged.length} live candidates across ${byCategory.size} provisional categories (ephemeral).`);
