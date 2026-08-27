#!/usr/bin/env python3
"""MIMER §6 — receipted QUANTITY take-off (BoM skeleton) for the CONCEPT house.
Truth law: quantities are DERIVED from the concept geometry (house-concept-v0.1.json)
and receipted to it. Unit RATES are NOT invented — each line carries rate=null and a
named authoritative price source to obtain. No SEK total is asserted."""
import json
V="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/07-Lender-Dossier"
MIMER="/Users/oskarpeterson/Documents/AI/product twin/repo-mimer/data/sites/sweden/saterdalsvagen-14/mimer"
hc=json.load(open(f"{MIMER}/house-concept-v0.1.json"))
L=hc["footprint_m"]["length_nw_se"]; W=hc["footprint_m"]["width_ne_sw"]   # 15 x 9
foot=L*W                       # 135 m2 footprint
perim=2*(L+W)                  # 48 m
h_low, h_up = 2.7, 2.6         # concept storey heights (m)
gfa_low=foot                   # lower level full footprint
gfa_up=round(0.70*foot)        # upper 1.5-plan: gallery+beds under the mono-pitch (~70%)
gfa=gfa_low+gfa_up             # concept BTA
wall_area=round(perim*(h_low)+perim*0.7*h_up)  # ext wall gross, upper reduced by pitch
roof_area=round(L* (W/ 0.9))   # mono-pitch slope area ≈ plan / cos(pitch~26deg)

def line(code,desc,qty,unit,src,note=""):
    return {"code":code,"item":desc,"quantity":qty,"unit":unit,"unit_rate_SEK":None,
            "rate_status":"NEEDS_SOURCE","price_source":src,"line_cost_SEK":None,"note":note}

bom={
 "schema":"mimer-bom-quantity-takeoff/v0.1","subject":"SVÄRTINGE 54:28","as_of":"2026-08-27",
 "evidence_class":"DERIVED_QUANTITIES / RATES_NOT_VERIFIED",
 "derived_from":"house-concept-v0.1.json (CONCEPT geometry) — receipted to that file",
 "concept_metrics":{"footprint_m2":foot,"gfa_bta_m2_concept":gfa,"lower_level_m2":gfa_low,
   "upper_level_m2":gfa_up,"ext_wall_gross_m2":wall_area,"roof_slope_m2":roof_area,"perimeter_m":perim},
 "truth_note":"Quantities are provisional CONCEPT take-offs (geometry not engineered; monument survey + geotech open). NO unit rate is asserted; NO total is computed. Each rate must be filled from the named source before any figure is bankable.",
 "cost_drivers_flagged":[
   "Foundation/grundläggning is the live variable — depth-to-rock varies ~0-22 m nearby (dossier §3). Rate cannot be set before the plot geotechnical result.",
   "Souterräng cut against the NE bank adds retaining + drainage vs a flat slab."],
 "lines":[
  line("01","Site prep, cut/fill on shelf, retaining to NE bank",foot,"m2 footprint","husleverantör markofferto + geotech","souterräng — quantity firms after geotech"),
  line("02","Foundation / grundläggning (slab + edge, souterräng)",foot,"m2","geotech-dependent; SCB byggnadsprisindex mark/grund","THE cost driver — see §3"),
  line("03","Superstructure frame + ext walls (timber, Eksjöhus-class)",wall_area,"m2 wall","husleverantör offert (Eksjöhus/kataloghus à-pris)"),
  line("04","Mono-pitch roof incl. structure + covering",roof_area,"m2 roof","husleverantör offert"),
  line("05","Windows/doors (SW glazing bias)",None,"per schedule","husleverantör offert","schedule TBD from drawings"),
  line("06","Interior fit-out + kitchen + baths",gfa,"m2 BTA","husleverantör offert / snickeri à-pris"),
  line("07","Ground-source heat pump (bergvärme) + borehole",1,"installation","VVS-entreprenör offert; borrning per m","permit near Övre Svärtinge groundwater body (§3)"),
  line("08","Hydronic underfloor + FTX ventilation",gfa,"m2 BTA","VVS-entreprenör offert"),
  line("09","Electrical + PV (SW roof) + EV point",1,"installation","el-entreprenör offert; PV per kWp"),
  line("10","VA connection + on-plot gravity foul + stormwater soakaway",1,"connection","Norrköping Vatten anslutningsavgift (published tariff) + grävning","dossier §4 — gravity fall ~1:15, no pump"),
  line("11","External works, driveway (grade <=1:12 per 1936 plan), landscaping",None,"lump","mark-entreprenör offert"),
  line("12","Bygglov/anslutning fees, KA, färdigställandeskydd, byggkreditiv ränta",1,"lump","Norrköping kommun taxa + insurer + bank","soft costs — §9 statutory stack")
 ],
 "unit_rate_sources_to_obtain":[
   "SCB — Priser för nyproducerade småhus / Byggnadsprisindex (BPI) — authoritative national benchmark",
   "Husleverantör bindande offert (Eksjöhus or equivalent) — the primary line-item source",
   "VVS/el/mark sub-contractor offerter for systems + groundworks",
   "Norrköping Vatten VA-anslutningstaxa + Norrköping kommun bygglovstaxa (published)",
   "Geoteknisk undersökning — sets lines 01-02 (the driver)"],
 "next":"Fill rates from a husleverantör offert + SCB benchmark, reconcile the two, then compute line_cost + total. Until then the total is deliberately null."
}
open(f"{V}/06-cost-bom-quantity-takeoff-v0.1.json","w").write(json.dumps(bom,ensure_ascii=False,indent=2))
print("wrote BoM:",len(bom['lines']),"lines; GFA(concept)",gfa,"m2; wall",wall_area,"roof",roof_area,"perim",perim)
