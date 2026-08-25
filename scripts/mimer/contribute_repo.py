#!/usr/bin/env python3
"""MIMER — contribute the M1–M6 analysis into the repo so the Site Intelligence
page + twin consume ONE Svärtinge truth. Writes versioned derived-data JSON into
data/sites/sweden/saterdalsvagen-14/mimer/ and copies the sheet PNGs into sheets/.
Public-repo-safe: all derived from the public 1 m DEM / PVGIS / OSM + the existing
receipted evidence file. Commercial framing (microsite, lender dossier) stays in the vault."""
import json, os, shutil
REPO="/Users/oskarpeterson/Documents/AI/product twin/repo-mimer/data/sites/sweden/saterdalsvagen-14"
VAULT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )"
MIMER=f"{REPO}/mimer"; SHEETS=f"{MIMER}/sheets"
os.makedirs(SHEETS,exist_ok=True)

GATE_NOTE="Provisional analysis derived from the receipted public 1 m Lantmäteriet DEM; GATE_SE_TERRAIN OPEN — not official terrain/survey. House & systems are CONCEPT."

for src,dst in [("02-Sun-and-Views/sun-study.json","sun-study-v0.1.json"),
                ("02-Sun-and-Views/pvgis-yield.json","pvgis-yield-v0.1.json")]:
    shutil.copyfile(f"{VAULT}/{src}", f"{MIMER}/{dst}")

json.dump({
 "schema":"mimer-site-plan-derived/v0.1","subject":"SVÄRTINGE 54:28","evidence_class":"DERIVED",
 "gate_dependency":{"gate_id":"GATE_SE_TERRAIN","status":"OPEN","note":GATE_NOTE},
 "relief_m":13.93,"slope_at_pin_deg":14.2,"aspect_deg":207,"aspect_compass":"SW",
 "building_shelf":{"definition":"largest contiguous slope<12° patch inside the −4.5 m setback inset",
   "area_m2_approx":306,"setback_m":4.5,"note":"CONCEPT — indicative boundary trace, not a surveyed envelope"},
 "access":{"road":"Säterdalsvägen","source":"OSM (reference)","frontage_corner":"SW/low (~65.5 m)",
   "note":"Google snapped #14→#8; frontage reference-only"},
 "va_point_schematic":{"location":"road, SW low corner","gravity_fall_house_to_main":True},
 "historic_plan_signals_1936":{"act":"avstyckningsplan 0581K-22D:1008 (in force 1936-05-26)",
   "signals":["one dwelling house per plot","max road gradient 1:12","40 m high-voltage corridor (location unlocated)",
              "open roadside drainage","water provided before sale/construction"],
   "status":"HISTORIC signal — not confirmed present entitlement",
   "receipts":["RCPT_SE_NORRKOPING_PLAN_22D1008_DESCRIPTION","RCPT_SE_NORRKOPING_PLAN_22D1008_MAP"]},
 "sheet":"sheets/svartinge-site-plan.png"
}, open(f"{MIMER}/site-plan-derived-v0.1.json","w"), indent=2, ensure_ascii=False)

json.dump({
 "schema":"mimer-house-concept/v0.1","subject":"SVÄRTINGE 54:28","evidence_class":"CONCEPT",
 "typology":"Swedish sluttningshus / souterräng 1.5-plan",
 "rationale":"Gentle building shelf (~10°) with a steep NE bank (>25°) rising behind → cut against the bank, open SW; a flat slab would need heavy cut/fill.",
 "orientation":{"long_axis":"NW–SE (along contour)","opens":"SW to measured Glan axis + midday–sunset sun"},
 "footprint_m":{"length_nw_se":15,"width_ne_sw":9},
 "level_datums_rh2000_m_concept":{"terrace":66.3,"lower_ff":66.8,"upper_ff":69.7},
 "roof":{"type":"mono-pitch falling SW","pv_plane":"SW ~912 kWh/kWp (see pvgis-yield-v0.1.json)"},
 "program":{"lower":["great room/kitchen (SW glazing)","master + SW view","bath/wardrobe","entry/stair","House Heart","carport/store (NE)"],
            "upper":["gallery over living + SW balcony","bed 2/3 (SW)","study/bed 4","tech/PV inverter (NE)"]},
 "sheets":["sheets/house-concept-sheet.png","sheets/concept-section.png","sheets/concept-plans.png"]
}, open(f"{MIMER}/house-concept-v0.1.json","w"), indent=2, ensure_ascii=False)

json.dump({
 "schema":"mimer-systems-skeleton/v0.1","subject":"SVÄRTINGE 54:28","evidence_class":"CONCEPT",
 "hub":"House Heart (services core, lower level)",
 "systems":{
  "water":"Incoming pressurised + meter from Säterdalsvägen main",
  "foul_sewer":"Gravity to main; fall ≈1:15 (house ~1.7 m above main over ~26 m) ≫ typ. min ~1:100 — no pump",
  "stormwater":"Roof → soakaway on permeable Isälvssediment (esker), separated from foul; infiltration to verify",
  "electricity":"Grid service → main panel; PV DC→inverter→panel; battery-ready; EV point at carport",
  "heating":"Ground-source heat pump (bergvärme) + tank → hydronic underfloor; rock ~9 m (SGU, variable); permit near Övre Svärtinge groundwater body",
  "ventilation":"Balanced FTX heat recovery (typ. ≥75%); intake NE-shaded, extract wet rooms + kitchen",
  "smart_meter":"Sub-metering + leak/temp sensors + PV/heat-pump telemetry — the digital-twin data feed"},
 "verify_against":["BBR","utility VA connection data","geotech/infiltration","groundwater-body permit"],
 "sheets":["sheets/systems-sheet.png","sheets/systems-section.png","sheets/house-heart.png"]
}, open(f"{MIMER}/systems-skeleton-v0.1.json","w"), indent=2, ensure_ascii=False)

json.dump({
 "schema":"mimer-value-map/v0.1","subject":"SVÄRTINGE 54:28","evidence_class":"DERIVED_ARGUMENT",
 "thesis":"Each evidence block moves the asset up a maturity rung and compresses the risk premium a buyer/bank/architect prices in.",
 "rungs":["raw→informed (site intel)","informed→light-proven (sun)","light-proven→development-ready (site plan)",
          "development-ready→designed product (house)","designed→buildable & low-cost (systems)"],
 "open_gates_unlock_next_tier":["registered legal boundary & area","HV-corridor location","entitlement/current-plan interpretation",
          "geotech + infiltration","VA connection confirmation"],
 "sheet":"sheets/value-ladder.png"
}, open(f"{MIMER}/value-map-v0.1.json","w"), indent=2, ensure_ascii=False)

SHEET_SRC={
 "svartinge-site-plan.png":"01-Site-Intelligence/svartinge-site-plan.png",
 "sun-study-sheet.png":"02-Sun-and-Views/sun-study-sheet.png",
 "sun-path-polar.png":"02-Sun-and-Views/sun-path-polar.png",
 "pvgis-monthly.png":"02-Sun-and-Views/pvgis-monthly.png",
 "house-concept-sheet.png":"04-House-Design/house-concept-sheet.png",
 "concept-section.png":"04-House-Design/concept-section.png",
 "concept-plans.png":"04-House-Design/concept-plans.png",
 "systems-sheet.png":"05-Systems/systems-sheet.png",
 "systems-section.png":"05-Systems/systems-section.png",
 "house-heart.png":"05-Systems/house-heart.png",
 "value-ladder.png":"06-Value-Ladder/value-ladder.png",
}
for dst,src in SHEET_SRC.items():
    shutil.copyfile(f"{VAULT}/{src}", f"{SHEETS}/{dst}")

print("wrote", len([f for f in os.listdir(MIMER) if f.endswith('.json')]), "json +", len(os.listdir(SHEETS)), "sheets to", MIMER)
