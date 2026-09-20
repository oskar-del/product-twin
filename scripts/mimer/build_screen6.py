#!/usr/bin/env python3
"""MIMER Screen 6 "Numbers" — the Lender dossier numbers rendered as a chapter on
Platform's "ink" chrome, with evidence chips. ONE parameterized generator:

  build_screen6.py --site <site_dir> --geometry <geometry_spec.json> [--vault <dir>] [--out <html>]

--site      dir holding property-division-derived-v0.1.json (authoritative parcel)
--geometry  a BRAGE scene-patch (add_elements w/ CONCEPT_BUILDING) → derives quantities;
            anything else → quantities NEEDS_GEOMETRY, all money NEEDS_SOURCE (dry-run mode)
--vault     dir holding 06-cost-bom / 07-comps / 08-ffe JSON (optional; for the live site)

Truth law: no number is invented. Rates are rate-card SLOTS (NEEDS_SOURCE) until an
offert lands. Also emits a rate-card CSV next to the HTML.
"""
import json, argparse, os, math, statistics, csv

CHIP={"AUTHORITATIVE":"#176b52","INDICATIVE":"#c18a2d","DERIVED":"#497aa2",
      "REPORTED":"#a65b68","CONCEPT":"#735a9e","NEEDS_SOURCE":"#6b6b6b","NOT_VERIFIED":"#a65b68"}
def chip(cls,label=None):
    c=CHIP.get(cls.split("(")[0].strip().upper(),"#6b6b6b")
    return f'<span class="chip" style="--c:{c}">{label or cls}</span>'

def shoelace(p):
    s=0
    for i in range(len(p)): x0,z0=p[i]; x1,z1=p[(i+1)%len(p)]; s+=x0*z1-x1*z0
    return abs(s)/2
def perim(p):
    d=0
    for i in range(len(p)): x0,z0=p[i]; x1,z1=p[(i+1)%len(p)]; d+=((x1-x0)**2+(z1-z0)**2)**0.5
    return d

def parcel_area(site_dir):
    f=os.path.join(site_dir,"property-division-derived-v0.1.json")
    if not os.path.exists(f): return None
    d=json.load(open(f))
    rings=d.get("subject_rings_local") or []
    area=round(shoelace(rings[0]),1) if rings else None
    return {"subject":d.get("subject"),"area_m2":area,"authority":d.get("authority"),
            "object_id":(d.get("source_object_ids") or [None])[0],
            "evidence_class":d.get("evidence_class","AUTHORITATIVE"),
            "raw_sha":(d.get("raw_asset") or {}).get("sha256","")[:12]}

def geometry_metrics(geo_path):
    """Return CONCEPT quantity metrics if the spec has CONCEPT_BUILDING polygons, else None."""
    if not geo_path or not os.path.exists(geo_path): return None
    d=json.load(open(geo_path))
    els=d.get("add_elements") or d.get("elements") or []
    bldgs=[e for e in els if e.get("type","").startswith("CONCEPT_BUILDING") and e.get("geometry",{}).get("points_xz")]
    if not bldgs: return None
    foot=0; per=0; hmax=0
    for b in bldgs:
        g=b["geometry"]; a=shoelace(g["points_xz"]); foot+=a; per+=perim(g["points_xz"]); hmax=max(hmax,g.get("height_m",3.0))
    bar=[b for b in bldgs if "BAR" in b["id"]]
    heated=round((shoelace(bar[0]["geometry"]["points_xz"])*1.5) if bar else foot*0.7)
    return {"n_buildings":len(bldgs),"ground_footprint_BYA_m2":round(foot,1),
            "ext_wall_perimeter_m":round(per,1),"ext_wall_gross_m2":round(per*hmax),
            "roof_slope_m2":round(foot/math.cos(math.radians(26))),"heated_BTA_m2":heated,
            "spec_id":d.get("patch_id") or d.get("spec_id") or os.path.basename(geo_path)}

# ---- §6 rate-card template (unit · quantity · rate slot · source slot) --------------------
RATECARD=[
 ("01","Site prep + cut/fill, retaining","m2 footprint","ground_footprint_BYA_m2","husleverantör markofferto + geotech"),
 ("02","Foundation / grundläggning","m2","ground_footprint_BYA_m2","geotech-dependent; SCB byggnadsprisindex"),
 ("03","Superstructure frame + ext walls (timber)","m2 wall","ext_wall_gross_m2","husleverantör offert"),
 ("04","Roof incl. structure + covering","m2 roof","roof_slope_m2","husleverantör offert"),
 ("05","Windows / doors (glazing)","per schedule",None,"husleverantör offert"),
 ("06","Interior fit-out + kitchen + baths","m2 BTA","heated_BTA_m2","husleverantör offert / snickeri"),
 ("07","Ground-source heat pump + borehole","installation",None,"VVS-entreprenör offert"),
 ("08","Hydronic underfloor + FTX","m2 BTA","heated_BTA_m2","VVS-entreprenör offert"),
 ("09","Electrical + PV + EV point","installation",None,"el-entreprenör offert"),
 ("10","VA connection + on-plot foul/stormwater","connection",None,"Norrköping Vatten tariff"),
 ("11","External works, driveway, landscaping","lump",None,"mark-entreprenör offert"),
 ("12","Soft costs: bygglov, KA, färdigställandeskydd, kreditivränta","lump",None,"kommun taxa + insurer + bank"),
]

def cost_lines(metrics):
    rows=[]
    for code,item,unit,qkey,src in RATECARD:
        qty = (metrics.get(qkey) if (metrics and qkey) else None)
        rows.append({"code":code,"item":item,"unit":unit,
                     "quantity": qty if qty is not None else ("NEEDS_GEOMETRY" if qkey else "—"),
                     "rate_SEK":"NEEDS_SOURCE","line_SEK":"NEEDS_SOURCE","source":src})
    return rows

def load_json(vault,name):
    if not vault: return None
    f=os.path.join(vault,name)
    return json.load(open(f)) if os.path.exists(f) else None

def bom_metrics(vault):
    """Prefer the committed BoM concept_metrics (single source of truth) over re-derivation."""
    b=load_json(vault,"06-cost-bom-quantity-takeoff-v0.1.json")
    if not b or "concept_metrics" not in b: return None
    m=b["concept_metrics"]
    return {"ground_footprint_BYA_m2":m.get("ground_footprint_BYA_m2"),
            "ext_wall_gross_m2":m.get("ext_wall_incl_gables_m2") or m.get("ext_wall_ground_gross_m2") or m.get("ext_wall_gross_m2"),
            "roof_slope_m2":m.get("roof_slope_m2"),"heated_BTA_m2":m.get("heated_BTA_m2"),
            "reconciliation":b.get("brief_reconciliation"),
            "spec_id":b.get("derived_from","committed BoM").split("(")[0].strip()}

def build(site_dir,geo_path,vault,out_html):
    parcel=parcel_area(site_dir)
    metrics=bom_metrics(vault) or geometry_metrics(geo_path)  # committed BoM wins; geometry is fallback
    rc=cost_lines(metrics)
    comps=load_json(vault,"07-comps-framework-v0.1.json")
    ffe=load_json(vault,"08-ffe-living-room-v0.1.json")
    dry = metrics is None

    # ---- rate-card CSV ----
    csv_path=os.path.splitext(out_html)[0]+"-ratecard.csv"
    with open(csv_path,"w",newline="") as fh:
        w=csv.writer(fh); w.writerow(["code","item","unit","quantity","unit_rate_SEK","line_SEK","source"])
        for r in rc: w.writerow([r["code"],r["item"],r["unit"],r["quantity"],r["rate_SEK"],r["line_SEK"],r["source"]])

    subj=parcel["subject"] if parcel else os.path.basename(site_dir)
    area=f'{parcel["area_m2"]:,.1f}'.replace(","," ") if parcel and parcel["area_m2"] else "—"

    # ---- cost table html ----
    ct="".join(f'<tr><td class="mono">{r["code"]}</td><td>{r["item"]}</td><td>{r["unit"]}</td>'
               f'<td class="num">{r["quantity"] if isinstance(r["quantity"],str) else format(r["quantity"],",.0f").replace(","," ")}</td>'
               f'<td class="slot">{r["rate_SEK"]}</td><td class="slot">{r["line_SEK"]}</td>'
               f'<td class="src">{r["source"]}</td></tr>' for r in rc)

    # ---- comps html ----
    if comps and comps.get("receipted_area_benchmark"):
        b=comps["receipted_area_benchmark"]; f12=b["figures_12mo"]; ind=comps.get("indicative_reference_only",{})
        comps_html=(f'<p>{chip("REPORTED","area benchmark")} <b>{b["source"]}</b> — '
            f'12-mo <b>{f12["kr_per_m2"]:,} kr/m²</b>, avg <b>{f12["avg_price_kr"]:,} kr</b> '
            f'({f12["n_sold"]} sold, +{f12["change_pct"]}%). Data {b["data_updated"]}.</p>'
            f'<p>{chip("INDICATIVE","not a valuation")} {ind.get("calc","")} ≈ '
            f'<b>{ind.get("figure_kr",0):,} kr</b> — {ind.get("status","")}.</p>'
            f'<p>{chip("NOT_VERIFIED","finished value")} {comps["outputs_when_run"]["value_status"]}</p>'
            ).replace(","," ")
    else:
        comps_html=f'<p>{chip("NOT_VERIFIED","finished value")} No comps for this site yet — pull ≥6 adjusted sold comps.</p>'

    # ---- ffe html ----
    if ffe:
        s=ffe["spec_levels"]
        ffe_html=(f'<p>{chip("INDICATIVE","this set")} <b>{s["this_set_SEK"]:,} SEK</b> · '
            f'{chip("DERIVED","mid")} {s["mid_set_SEK"]:,} SEK · '
            f'{chip("DERIVED","premium")} {s["premium_set_SEK"]:,} SEK '
            f'({s["n_items"]} items, {ffe["source_room"].split("/")[-2]}, priced {ffe["price_as_of"]}).</p>'
            f'<p class="src">Furnishing reference only — NOT §6 construction cost, NOT lender security.</p>'
            ).replace(","," ")
    else:
        ffe_html=f'<p>{chip("NEEDS_SOURCE","FF&E")} No room composition bound for this site.</p>'

    # ---- ledger ----
    recon = metrics.get("reconciliation") if metrics else None
    LEDGER=[]
    if recon:
        LEDGER.append(("Heated-area basis",
          f'{recon["brief_figure_m2"]} m² concept → {recon["computed_m2"]} m² computed from BRAGE v0.3 ({recon["difference_m2"]}); souterrain +70 if built',
          "DERIVED"))
    LEDGER+=[("Monument survey","boundary markers on ground","NOT_VERIFIED"),
            ("Present entitlement","current plan interpretation + HV corridor","NOT_VERIFIED"),
            ("Geotechnical / depth-to-rock","foundation basis","NOT_VERIFIED"),
            ("VA connection","point, capacity, paid status","NOT_VERIFIED"),
            ("Legal access","road-manager approval","NOT_VERIFIED"),
            ("Construction cost total","rates NEEDS_SOURCE (§6)","NEEDS_SOURCE"),
            ("Finished value","comps not pulled (§7)","NOT_VERIFIED")]
    led="".join(f'<li>{chip(c)} <b>{t}</b> — {d}</li>' for t,d,c in LEDGER)

    banner = ('DRY-RUN — no house geometry bound: quantities NEEDS_GEOMETRY, all money NEEDS_SOURCE'
              if dry else 'Concept geometry — swaps to engineered dims when they land')

    html=f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Screen 6 · Numbers · {subj}</title>
<style>
:root{{--bg:#101916;--card:#17241f;--paper:#f5f1e8;--bronze:#d8b874;--ink:#dfe7e2;--mut:#8fa39a;--line:#24352d}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--ink);
 font-family:Inter,system-ui,sans-serif;line-height:1.5}}
.wrap{{max-width:960px;margin:0 auto;padding:40px 32px 80px}}
.kicker{{color:var(--bronze);letter-spacing:.18em;text-transform:uppercase;font-size:12px;font-weight:600}}
h1{{font-family:Georgia,"Cormorant Garamond",serif;font-weight:600;font-size:34px;margin:.15em 0 .1em}}
h2{{font-family:Georgia,serif;font-weight:600;font-size:22px;margin:2.2em 0 .5em;color:var(--paper);
 border-bottom:1px solid var(--line);padding-bottom:.35em}}
.sub{{color:var(--mut);font-size:14px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin:14px 0}}
table{{border-collapse:collapse;width:100%;font-size:12.5px}}
th,td{{border-bottom:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}}
th{{color:var(--bronze);font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase}}
td.num,td.mono{{font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}}
td.num{{text-align:right}} td.slot{{color:#caa24e;font-family:ui-monospace,monospace;font-size:11px}}
td.src{{color:var(--mut);font-size:11px}}
.chip{{display:inline-block;background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c);
 border:1px solid var(--c);border-radius:999px;padding:1px 9px;font-size:10.5px;font-weight:600;
 letter-spacing:.03em;white-space:nowrap}}
ul{{list-style:none;padding:0}} li{{padding:6px 0;border-bottom:1px solid var(--line);font-size:13.5px}}
.banner{{background:color-mix(in srgb,var(--bronze) 12%,transparent);border-left:3px solid var(--bronze);
 padding:9px 14px;font-size:12px;color:var(--paper);border-radius:4px;margin:8px 0 4px}}
.big{{font-family:Georgia,serif;font-size:26px;color:var(--paper)}}
</style></head><body><div class="wrap">
<div class="kicker">Screen 6 · Numbers</div>
<h1>{subj}</h1>
<div class="sub">{chip(parcel["evidence_class"] if parcel else "NOT_VERIFIED","parcel")} plot <b>{area} m²</b>
 {"· "+parcel["authority"]+" "+ (parcel["object_id"] or "") if parcel else ""} · as-of 2026-09-20</div>
<div class="banner">{banner}</div>

<h2>§6 · Construction cost — rate-card</h2>
<div class="sub">Quantities {"derived from "+metrics["spec_id"] if metrics else "pending geometry"}. Every rate is a SLOT — a husleverantör offert drops straight in. No total asserted.</div>
<div class="card"><table>
<tr><th>#</th><th>Item</th><th>Unit</th><th>Qty</th><th>Unit rate</th><th>Line</th><th>Source slot</th></tr>
{ct}</table></div>

<h2>§7 · Finished value</h2>
<div class="card">{comps_html}</div>

<h2>FF&amp;E · Living-room furnishing reference</h2>
<div class="card">{ffe_html}</div>

<h2>NOT-verified ledger</h2>
<div class="card"><ul>{led}</ul></div>

<p class="sub" style="margin-top:28px">Generated by build_screen6.py · site={os.path.basename(site_dir)} · geometry={os.path.basename(geo_path) if geo_path else "none"} · rate-card CSV: {os.path.basename(csv_path)}</p>
</div></body></html>"""
    os.makedirs(os.path.dirname(out_html),exist_ok=True)
    open(out_html,"w").write(html)
    return {"subject":subj,"area":area,"dry_run":dry,"cost_lines":len(rc),
            "metrics":metrics,"out":out_html,"csv":csv_path,
            "ffe":ffe["spec_levels"] if ffe else None,
            "comps":bool(comps and comps.get("receipted_area_benchmark"))}

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True); ap.add_argument("--geometry",default=None)
    ap.add_argument("--vault",default=None); ap.add_argument("--out",required=True)
    a=ap.parse_args()
    r=build(a.site,a.geometry,a.vault,a.out)
    print(json.dumps(r,ensure_ascii=False,indent=1))
