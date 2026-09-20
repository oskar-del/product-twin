#!/usr/bin/env python3
"""MIMER §6 — receipted QUANTITY take-off (BoM skeleton) for the WINNER house
"Vinkelhuset mot Glan", re-derived from BRAGE house-v0.3-geometry-spec.json
(spec BRAGE_SE_SVARTINGE_54_28_HOUSE_V03, commit 7a37f92).

Truth law: quantities are COMPUTED from the v0.3 room polygons (shoelace areas,
shapely union for the building outline, roof math from the roof spec) — NOT typed.
Each computed total is asserted against the spec's own area_summary. Geometry class
is CONCEPT (envelope/terrain/FFL gates open). Unit RATES stay NEEDS_SOURCE; no total."""
import json, math, os
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT="/Users/oskarpeterson/Documents/AI/product twin"
SPEC=f"{ROOT}/repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-v0.3-geometry-spec.json"
PATCH=f"{ROOT}/repo-brage/OPEN AI/Säterdalsvägen 14 - Svärtinge/04-House-Design/BRAGE/geometry/house-in-scene-v0.3-patch.json"
OUT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/07-Lender-Dossier/06-cost-bom-quantity-takeoff-v0.1.json"

spec=json.load(open(SPEC))
rooms=spec["rooms"]; roof=spec["roof"]; wing=spec["wing_roof"]; summ=spec["area_summary"]

def shoelace(p):
    s=0
    for i in range(len(p)): x0,z0=p[i]; x1,z1=p[(i+1)%len(p)]; s+=x0*z1-x1*z0
    return abs(s)/2

# ---- per-storey + heated/cold from polygons ------------------------------------------------
by={}; heated_excl=0.0; heated_incl=0.0; cold=0.0
for r in rooms:
    a=shoelace(r["footprint_xz"])
    assert abs(a-r["floor_area_m2"])<0.6, f"{r['id']} polygon {a} != declared {r['floor_area_m2']}"
    by[r["storey"]]=by.get(r["storey"],0)+a
    if r["heated"]:
        heated_incl+=a
        if r["storey"]!="SOUTERRAIN": heated_excl+=a
    else: cold+=a
for k,v in by.items(): by[k]=round(v,1)
heated_excl=round(heated_excl,1); heated_incl=round(heated_incl,1); cold=round(cold,1)

# ---- BYA + exterior wall from the union outline of the GROUND storey -----------------------
ground_polys=[Polygon(r["footprint_xz"]) for r in rooms if r["storey"]=="GROUND"]
outline=unary_union(ground_polys)
bya=round(outline.area,1)
ext_perim=round(outline.exterior.length,1)
ext_wall_ground=round(ext_perim*roof["wall_plate_Y"])          # perimeter x plate height
gable_ends=round(2*(0.5*roof["span_m"]*roof["ridge_height_above_plate_m"]),1)  # two triangles
ext_wall_incl_gables=round(ext_wall_ground+gable_ends)

# ---- assertions against the spec's own area_summary (computed, not typed) ------------------
assert bya==summ["ground_footprint_m2"], (bya,summ["ground_footprint_m2"])
assert heated_excl==summ["heated_m2_excl_souterrain"], (heated_excl,summ["heated_m2_excl_souterrain"])
assert heated_incl==summ["heated_m2_incl_souterrain"], (heated_incl,summ["heated_m2_incl_souterrain"])
assert cold==summ["cold_m2"], (cold,summ["cold_m2"])

# ---- roof: bar gable (both planes 30 deg) + cold wing mono-pitch (15 deg) ------------------
ridge_len=math.dist(roof["ridge_xz"][0],roof["ridge_xz"][1])
plane_slope=(roof["span_m"]/2)/math.cos(math.radians(roof["pitch_deg"]))+roof["eaves_overhang_m"]
bar_roof=round(2*(ridge_len+2*roof["eaves_overhang_m"])*plane_slope,1)
garage=[r for r in rooms if r["id"]=="ROOM_GARAGE"][0]; ga=shoelace(garage["footprint_xz"])
wing_roof=round(ga/math.cos(math.radians(wing["pitch_deg"]))*1.0,1)
roof_slope=round(bar_roof+wing_roof,1)

# ---- glazing from the per-room openings (sum area) ----------------------------------------
glazing=round(sum((o.get("area_m2") or 0) for r in rooms for o in r.get("openings",[])),1)
south_glass=round(sum((o.get("area_m2") or 0) for r in rooms for o in r.get("openings",[]) if o.get("wall")=="SOUTH"),1)

# ---- terrace: house spec is house-only; take TERRACE_SOUTH from the v0.3 scene patch -------
terr=None
if os.path.exists(PATCH):
    p=json.load(open(PATCH))
    for e in p.get("add_elements",[]):
        if e["id"]=="TERRACE_SOUTH" and e.get("geometry",{}).get("points_xz"):
            terr=round(shoelace(e["geometry"]["points_xz"]),1)

def line(code,desc,qty,unit,src,note=""):
    return {"code":code,"item":desc,"quantity":qty,"unit":unit,"unit_rate_SEK":None,
            "rate_status":"NEEDS_SOURCE","price_source":src,"line_cost_SEK":None,"note":note}

bom={
 "schema":"mimer-bom-quantity-takeoff/v0.3","subject":"SVÄRTINGE 54:28",
 "house":"Vinkelhuset mot Glan (WINNER)","as_of":"2026-09-20",
 "evidence_class":"COMPUTED_QUANTITIES(CONCEPT geometry) / RATES_NOT_VERIFIED",
 "derived_from":"BRAGE house-v0.3-geometry-spec.json (BRAGE_SE_SVARTINGE_54_28_HOUSE_V03, commit 7a37f92) — computed via shoelace + shapely union + roof math; asserted against the spec area_summary",
 "supersedes":"v0.2 take-off from house-in-scene-v0.3-patch.json (concept 210 m² heated)",
 "geometry_gate_note":"BRAGE evidence_policy: all geometry CONCEPT. Registered area/extent AUTHORITATIVE (parcel #21); BYA/BTA, terrain_DTM_slope_FFL, legal_access, utility_capacity OPEN.",
 "concept_metrics":{
   "ground_footprint_BYA_m2":bya,
   "heated_BTA_excl_souterrain_m2":heated_excl,
   "heated_BTA_incl_souterrain_m2":heated_incl,
   "heated_BTA_m2":heated_excl,   # primary heated figure used downstream = excl souterrain
   "cold_wing_garage_m2":cold,
   "upper_1_5plan_m2":by.get("UPPER"),
   "souterrain_m2":by.get("SOUTERRAIN"),
   "ext_wall_perimeter_m":ext_perim,
   "ext_wall_ground_gross_m2":ext_wall_ground,
   "ext_wall_gable_ends_m2":gable_ends,
   "ext_wall_incl_gables_m2":ext_wall_incl_gables,
   "roof_slope_m2":roof_slope,
   "roof_bar_gable_m2":bar_roof,
   "roof_wing_mono_m2":wing_roof,
   "glazing_total_m2":glazing,
   "south_glazing_m2":south_glass,
   "terrace_deck_m2":terr},
 "brief_reconciliation":summ["brief_reconciliation"],
 "truth_note":"Quantities COMPUTED from v0.3 room polygons and asserted against the spec's area_summary (206.4 heated excl souterrain, not the 210 concept in the sprint brief). Geometry CONCEPT. NO unit rate asserted; NO total computed.",
 "cost_drivers_flagged":[
   "Souterrain (70 m² heated incl.) adds a lower-level slab + retaining against the NE bank — conditional on the 1 m DTM south-fall; it lifts heated area from 206.4 to 276.4 if built.",
   "Foundation/grundläggning is the live variable — depth-to-rock varies ~0-22 m nearby (dossier §3); rate cannot be set before the plot geotechnical result."],
 "lines":[
  line("01","Site prep + cut/fill on shelf, retaining to NE bank",bya,"m2 footprint","husleverantör markofferto + geotech","souterrain lower slab conditional on DTM"),
  line("02","Foundation / grundläggning (bar + wing)",bya,"m2","geotech-dependent; SCB byggnadsprisindex mark/grund","THE cost driver — see §3"),
  line("03","Superstructure frame + ext walls (timber, tjärsvart trähus)",ext_wall_incl_gables,"m2 wall","husleverantör offert (Eksjöhus/kataloghus à-pris)","= "+str(ext_wall_ground)+" ground + "+str(gable_ends)+" gable ends"),
  line("04","Gable roof 30° (standing-seam) + cold-wing mono 15°",roof_slope,"m2 roof","husleverantör offert","bar "+str(bar_roof)+" + wing "+str(wing_roof)),
  line("05","Glazing (alu-clad timber triple), incl. Glanrummet",glazing,"m2 glazing","husleverantör offert","of which "+str(south_glass)+" m² south"),
  line("06","Interior fit-out + kitchen + baths (heated BTA excl souterrain)",heated_excl,"m2 BTA","husleverantör offert / snickeri à-pris"),
  line("07","Ground-source heat pump (bergvärme) + borehole",1,"installation","VVS-entreprenör offert; borrning per m","permit near Övre Svärtinge groundwater body (§3)"),
  line("08","Hydronic underfloor + FTX ventilation (heated BTA)",heated_excl,"m2 BTA","VVS-entreprenör offert","short runs off the placed House Heart"),
  line("09","Electrical + PV (S gable plane) + EV point in garage",1,"installation","el-entreprenör offert; PV per kWp"),
  line("10","Cold garage/service wing fit (unheated)",cold,"m2","husleverantör offert","resale checkbox + wind screen"),
  line("11","VA connection + on-plot gravity foul + stormwater soakaway",1,"connection","Norrköping Vatten anslutningsavgift (published tariff) + grävning","gravity fall ~1:15, no pump (§4)"),
  line("12","External works: driveway (grade <=1:12 per 1936 plan), terrace deck"+(f" ({terr} m2)" if terr else "")+", vindficka windbreak, landscaping",None,"lump","mark-entreprenör offert"),
  line("13","Soft costs: bygglov/anslutning fees, KA, färdigställandeskydd, byggkreditiv ränta",1,"lump","Norrköping kommun taxa + insurer + bank","§9 statutory stack")
 ],
 "excluded_conditional":[
   {"id":"WEST_SOUTERRANG","reason":"conditional on 1 m DTM south-fall >= ~2.5 m; adds the 70 m² souterrain heated area + lower slab"}],
 "unit_rate_sources_to_obtain":[
   "SCB — Priser för nyproducerade småhus / Byggnadsprisindex (BPI)",
   "Husleverantör bindande offert (Eksjöhus or equivalent) — primary line-item source",
   "VVS/el/mark sub-contractor offerter",
   "Norrköping Vatten VA-anslutningstaxa + kommun bygglovstaxa",
   "Geoteknisk undersökning — sets lines 01-02"],
 "next":"Fill rates from a husleverantör offert + SCB benchmark, reconcile, compute total. Until then total is null."
}
open(OUT,"w").write(json.dumps(bom,ensure_ascii=False,indent=2))
m=bom["concept_metrics"]
print("v0.3 BoM (COMPUTED, asserted vs area_summary):")
print(f"  BYA {m['ground_footprint_BYA_m2']} | heated excl {m['heated_BTA_excl_souterrain_m2']} incl {m['heated_BTA_incl_souterrain_m2']} | cold {m['cold_wing_garage_m2']} | upper {m['upper_1_5plan_m2']} | souterrain {m['souterrain_m2']}")
print(f"  ext perim {m['ext_wall_perimeter_m']} -> wall {m['ext_wall_ground_gross_m2']} +gables {m['ext_wall_gable_ends_m2']} = {m['ext_wall_incl_gables_m2']}")
print(f"  roof {m['roof_slope_m2']} (bar {m['roof_bar_gable_m2']} + wing {m['roof_wing_mono_m2']}) | glazing {m['glazing_total_m2']} (S {m['south_glazing_m2']}) | terrace {m['terrace_deck_m2']}")
print(f"  brief reconciliation: {bom['brief_reconciliation']['brief_figure_m2']} concept -> {bom['brief_reconciliation']['computed_m2']} computed ({bom['brief_reconciliation']['difference_m2']})")
