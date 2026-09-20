#!/usr/bin/env python3
"""MIMER FF&E line — price the Vinkelhuset living room from Platform's ACTUAL room
composition (shoppable-room-newport-living), receipted per row, with three spec
levels from the SAME Newport catalog:
  THIS SET   = the curated room as composed (11 receipted rows)         [INDICATIVE]
  MID SET    = sum of per-category MEDIAN in-stock catalog price        [DERIVED]
  PREMIUM    = sum of per-category p90 in-stock catalog price           [DERIVED]
Truth law: every number traces to a receipt (scene row or catalog category stats).
No price is invented; catalog stats carry N + as-of date."""
import json, statistics, os
ROOT="/Users/oskarpeterson/Documents/AI/product twin"
SCENE=f"{ROOT}/repo-platform/data/scenes/shoppable-room-newport-living/scene-v0.1.json"
CAT=f"{ROOT}/repo-avatar-factory/data/newport/newport-catalog.jsonl"
OUT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/07-Lender-Dossier/08-ffe-living-room-v0.1.json"

scene=json.load(open(SCENE))
items=[e for e in scene["elements"] if e.get("commerce")]
this_rows=[{"slot":e["id"],"product":e["commerce"]["product_name"],"brand":e["commerce"]["brand"],
            "sku":e["commerce"]["sku"],"gtin":e["commerce"].get("gtin",""),
            "category":e["commerce"].get("category",""),"price_SEK":e["commerce"]["price"],
            "url":e["commerce"]["product_url"],"evidence_class":e.get("evidence_class","INDICATIVE")}
           for e in items]
this_total=sum(r["price_SEK"] for r in this_rows)

def parse_price(s):
    if isinstance(s,(int,float)): return float(s)
    if not s: return None
    d="".join(ch for ch in str(s) if ch.isdigit())
    return float(d) if d else None

cat_rows={}
with open(CAT) as fh:
    for line in fh:
        line=line.strip()
        if not line: continue
        r=json.loads(line)
        leaf=(r.get("category") or "").split(">")[-1].strip().lower()
        if not leaf: continue
        av=(r.get("availability") or "").lower()
        p=parse_price(r.get("sale_price") or r.get("price"))
        if p and p>0 and ("in" in av or av==""):  # in_stock or unknown
            cat_rows.setdefault(leaf,[]).append(p)

def pct(vals,q):
    vals=sorted(vals);
    if not vals: return None
    i=min(len(vals)-1,int(round(q*(len(vals)-1))))
    return vals[i]

tiers=[]
mid_total=0; prem_total=0; missing=[]
for r in this_rows:
    leaf=(r["category"] or "").strip().lower()
    vals=cat_rows.get(leaf,[])
    if vals:
        med=statistics.median(vals); p90=pct(vals,0.90)
        mid_total+=med; prem_total+=p90
        tiers.append({"slot":r["slot"],"category":r["category"],"catalog_n":len(vals),
                      "this_SEK":r["price_SEK"],"mid_median_SEK":round(med),"premium_p90_SEK":round(p90)})
    else:
        # fall back to the actual row when the category has no catalog match
        mid_total+=r["price_SEK"]; prem_total+=r["price_SEK"]; missing.append(r["category"])
        tiers.append({"slot":r["slot"],"category":r["category"],"catalog_n":0,
                      "this_SEK":r["price_SEK"],"mid_median_SEK":r["price_SEK"],"premium_p90_SEK":r["price_SEK"],
                      "note":"no catalog category match — actual row used for all tiers"})

ffe={
 "schema":"mimer-ffe-line/v0.1","subject":"SVÄRTINGE 54:28 — Vinkelhuset living room (Glanrummet)",
 "as_of":"2026-09-20","price_as_of":scene["generated_at"][:10],
 "evidence_class":"THIS_SET=INDICATIVE(receipted rows) / MID+PREMIUM=DERIVED(category stats)",
 "source_room":"repo-platform shoppable-room-newport-living/scene-v0.1.json (SCENE_SHOPPABLE_ROOM_NEWPORT_LIVING_V01)",
 "catalog":"repo-avatar-factory/data/newport/newport-catalog.jsonl",
 "receipt_id":"RCPT_SE_NEWPORT_CATALOG_ROOM_FFE",
 "spec_levels":{
   "this_set_SEK":this_total,
   "mid_set_SEK":round(mid_total),
   "premium_set_SEK":round(prem_total),
   "n_items":len(this_rows)},
 "method":{
   "this_set":"curated room as composed by Platform — 11 receipted catalog rows (sku+gtin+url+price)",
   "mid_set":"sum of per-category MEDIAN in-stock price across the same Newport leaf categories",
   "premium_set":"sum of per-category p90 in-stock price across the same Newport leaf categories"},
 "this_set_rows":this_rows,
 "tier_breakdown":tiers,
 "truth_note":"THIS SET totals real receipted rows. MID/PREMIUM are catalog category statistics (N per category shown), not specific chosen products — reproducible from the catalog, not invented. Newport is a furnishing REFERENCE for buyer/valuation context; it is NOT part of the §6 construction cost and NOT a lender security.",
 "categories_without_catalog_match":sorted(set(missing))
}
os.makedirs(os.path.dirname(OUT),exist_ok=True)
open(OUT,"w").write(json.dumps(ffe,ensure_ascii=False,indent=2))
print(f"THIS SET {this_total:,} | MID {round(mid_total):,} | PREMIUM {round(prem_total):,} SEK  ({len(this_rows)} items)".replace(',',' '))
print("categories with no catalog match:",sorted(set(missing)) or "none")
print("wrote",OUT)
