#!/usr/bin/env python3
"""MIMER §6 — receipted QUANTITY take-off (BoM skeleton) for the WINNER house
"Vinkelhuset mot Glan" (BRAGE design, 2026-09-01 mandate).
Truth law: quantities are DERIVED from BRAGE's developed scene geometry
(house-in-scene-v0.3-patch.json) via shoelace on the real element polygons, and
receipted to that file. Geometry class is CONCEPT (all envelope/terrain/access
gates open per BRAGE evidence_policy). Unit RATES are NOT invented — each line
carries rate=null + a named authoritative price source. No SEK total is asserted.
Swap to BRAGE developed (engineered) dims when they land."""
import json
V="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/07-Lender-Dossier"
BRAGE="/Users/oskarpeterson/Documents/AI/product twin/repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-in-scene-v0.3-patch.json"
patch=json.load(open(BRAGE))
el={e["id"]:e for e in patch["add_elements"]}

def shoelace(p):
    s=0
    for i in range(len(p)):
        x0,z0=p[i]; x1,z1=p[(i+1)%len(p)]; s+=x0*z1-x1*z0
    return abs(s)/2
def perim(p):
    d=0
    for i in range(len(p)):
        x0,z0=p[i]; x1,z1=p[(i+1)%len(p)]; d+=((x1-x0)**2+(z1-z0)**2)**0.5
    return d

bar=el["HOUSE_BAR"]["geometry"]; wing=el["HOUSE_WING_N"]["geometry"]; terr=el["TERRACE_SOUTH"]["geometry"]
bar_a=shoelace(bar["points_xz"]); wing_a=shoelace(wing["points_xz"]); terr_a=shoelace(terr["points_xz"])
bar_h=bar["height_m"]; wing_h=wing["height_m"]
ground_foot=bar_a+wing_a                      # BYA indicative
upper_bta=round(bar_a*0.5)                     # 1.5-plan over EAST HALF of bar (per 04-WINNER-DEVELOPED)
heated_bta=round(bar_a+upper_bta)              # bar ground + upper half
cold_wing=round(wing_a)                        # garage/service (unheated)
# external wall: bar + wing perimeters minus the shared bar<->wing party segment (X[3,9] at Z=3 = 6 m, counted twice)
shared=6.0
ext_perim=round(perim(bar["points_xz"])+perim(wing["points_xz"])-2*shared,1)
ext_wall_ground=round(ext_perim*bar_h)
import math
roof_slope=round(ground_foot/math.cos(math.radians(26)))   # asymmetric gable ~26deg
south_glass_run=round(bar["points_xz"][1][0]-bar["points_xz"][0][0])  # bar S frontage length (X span) = 20 m

def line(code,desc,qty,unit,src,note=""):
    return {"code":code,"item":desc,"quantity":qty,"unit":unit,"unit_rate_SEK":None,
            "rate_status":"NEEDS_SOURCE","price_source":src,"line_cost_SEK":None,"note":note}

bom={
 "schema":"mimer-bom-quantity-takeoff/v0.2","subject":"SVÄRTINGE 54:28",
 "house":"Vinkelhuset mot Glan (WINNER)","as_of":"2026-09-01",
 "evidence_class":"DERIVED_QUANTITIES(CONCEPT geometry) / RATES_NOT_VERIFIED",
 "derived_from":"BRAGE house-in-scene-v0.3-patch.json (PATCH_SE_SVARTINGE_54_28_VINKELHUSET_V03) — shoelace on the real element polygons; receipted to that file",
 "geometry_gate_note":"BRAGE evidence_policy: all geometry CONCEPT; open gates = registered_area(now AUTHORITATIVE via parcel #21), legal_boundary(extent AUTHORITATIVE), BYA_BTA, terrain_DTM_slope_FFL, legal_access, utility_capacity. Swap to engineered dims when BRAGE developed set lands.",
 "concept_metrics":{
   "bar_footprint_m2":round(bar_a,1),"wing_footprint_m2":round(wing_a,1),
   "ground_footprint_BYA_m2":round(ground_foot,1),"upper_1_5plan_BTA_m2":upper_bta,
   "heated_BTA_m2":heated_bta,"cold_wing_m2":cold_wing,"total_enclosed_m2":heated_bta+cold_wing,
   "ext_wall_perimeter_m":ext_perim,"ext_wall_ground_gross_m2":ext_wall_ground,
   "roof_slope_m2":roof_slope,"south_glass_frontage_m":south_glass_run,"terrace_deck_m2":round(terr_a,1)},
 "truth_note":"Quantities are provisional CONCEPT take-offs from the WINNER geometry (not engineered; monument survey + geotech + FFL open). NO unit rate is asserted; NO total is computed.",
 "cost_drivers_flagged":[
   "Foundation/grundläggning is the live variable — depth-to-rock varies ~0-22 m nearby (dossier §3); WEST_SOUTERRANG upgrade is conditional on the 1 m DTM south-fall >= ~2.5 m (BRAGE conditional_upgrade) and is EXCLUDED from base quantities.",
   "L-plan (bar + cold wing) shortens the heated envelope vs a square box — a cost-favourable parti, but the wing adds its own foundation + roof."],
 "lines":[
  line("01","Site prep + cut/fill on shelf, retaining to NE bank",round(ground_foot,1),"m2 footprint","husleverantör markofferto + geotech","souterräng west-end EXCLUDED (conditional on DTM)"),
  line("02","Foundation / grundläggning (bar + wing, flat-plot datum)",round(ground_foot,1),"m2","geotech-dependent; SCB byggnadsprisindex mark/grund","THE cost driver — see §3"),
  line("03","Superstructure frame + ext walls (timber, tjärsvart trähus)",ext_wall_ground,"m2 wall","husleverantör offert (Eksjöhus/kataloghus à-pris)","+ upper-half gable walls TBD from developed section"),
  line("04","Asymmetric gable roof (standing-seam sheet, PV-ready S plane)",roof_slope,"m2 roof","husleverantör offert"),
  line("05","South glazing (alu-clad timber, ~"+str(south_glass_run)+" m S frontage) + fully-glazed Glanrummet",None,"per schedule","husleverantör offert","schedule TBD from drawings — the signature feature"),
  line("06","Interior fit-out + kitchen + baths (heated BTA)",heated_bta,"m2 BTA","husleverantör offert / snickeri à-pris"),
  line("07","Ground-source heat pump (bergvärme) + borehole",1,"installation","VVS-entreprenör offert; borrning per m","permit near Övre Svärtinge groundwater body (§3)"),
  line("08","Hydronic underfloor + FTX ventilation (heated BTA)",heated_bta,"m2 BTA","VVS-entreprenör offert","short runs off the placed House Heart"),
  line("09","Electrical + PV (S gable plane) + EV point in garage",1,"installation","el-entreprenör offert; PV per kWp"),
  line("10","Cold garage/service wing fit (unheated)",cold_wing,"m2","husleverantör offert","resale checkbox + wind screen"),
  line("11","VA connection + on-plot gravity foul + stormwater soakaway",1,"connection","Norrköping Vatten anslutningsavgift (published tariff) + grävning","gravity fall ~1:15, no pump (§4)"),
  line("12","External works: driveway (grade <=1:12 per 1936 plan), terrace deck ("+str(round(terr_a))+" m2), vindficka windbreak, landscaping",None,"lump","mark-entreprenör offert"),
  line("13","Soft costs: bygglov/anslutning fees, KA, färdigställandeskydd, byggkreditiv ränta",1,"lump","Norrköping kommun taxa + insurer + bank","§9 statutory stack")
 ],
 "excluded_conditional":[
   {"id":"WEST_SOUTERRANG","reason":"conditional on 1 m DTM south-fall >= ~2.5 m; do not model until DTM closes (BRAGE)"},
   {"id":"OPT_SAUNA_POD","reason":"optional outbuilding; not in base scope"}],
 "unit_rate_sources_to_obtain":[
   "SCB — Priser för nyproducerade småhus / Byggnadsprisindex (BPI) — authoritative national benchmark",
   "Husleverantör bindande offert (Eksjöhus or equivalent) — the primary line-item source",
   "VVS/el/mark sub-contractor offerter for systems + groundworks",
   "Norrköping Vatten VA-anslutningstaxa + Norrköping kommun bygglovstaxa (published)",
   "Geoteknisk undersökning — sets lines 01-02 (the driver)"],
 "next":"Fill rates from a husleverantör offert + SCB benchmark, reconcile, then compute line_cost + total. Swap CONCEPT dims for BRAGE engineered dims when they land. Until then the total is deliberately null."
}
open(f"{V}/06-cost-bom-quantity-takeoff-v0.1.json","w").write(json.dumps(bom,ensure_ascii=False,indent=2))
m=bom["concept_metrics"]
print("Vinkelhuset BoM:",len(bom['lines']),"lines")
print(" bar",m["bar_footprint_m2"],"wing",m["wing_footprint_m2"],"| BYA",m["ground_footprint_BYA_m2"],
      "| heated BTA",m["heated_BTA_m2"],"cold",m["cold_wing_m2"],"total enclosed",m["total_enclosed_m2"])
print(" ext perim",m["ext_wall_perimeter_m"],"wall",m["ext_wall_ground_gross_m2"],"roof",m["roof_slope_m2"],
      "S-glass",m["south_glass_frontage_m"],"terrace",m["terrace_deck_m2"])
