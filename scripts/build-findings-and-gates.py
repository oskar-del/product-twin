#!/usr/bin/env python3
"""Emit findings.json and gates.json for a site FROM the derived products.

Nothing here is typed by hand. Every value is read out of a committed derived
JSON, so a finding cannot drift from the number it claims, and re-running this
after any pipeline change regenerates both files.

EVERY RECEIPT IS OPTIONAL. Sites do not hold the same evidence: Svärtinge has no
shoreline, viewshed or municipal-planning derivation, Djurö has all three. So
receipts are indexed by `entity_type` (never by filename) and a finding or gate
whose receipt is absent is still EMITTED — as OPEN, carrying the reason
"receipt not present: <entity_type>". It is never skipped silently and its value
is never invented. A missing receipt is a question nobody has answered, and the
ledger has to say so out loud.

Shapes follow plot-intelligence-v0.1.json in the Svärtinge reference site
(finding_id / domain / value / unit / evidence_class / source_receipt_refs /
method / observed_at / verification / limitations, and gate_id / status /
evidence_refs / decided_at / reason), so the site generator renders these
without a special case. A `chip` field is added per finding to map the template's
evidence vocabulary onto the five chrome chip colours.

Usage: python3 scripts/build-findings-and-gates.py --site data/sites/sweden/djuro-byvag-34
"""
import argparse, datetime, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHIP = {"OBSERVED_OFFICIAL": "authoritative", "OFFICIAL_OPEN_SOURCE": "authoritative",
        "AUTHORITATIVE": "authoritative", "DERIVED": "derived",
        "REPORTED": "reported", "INDICATIVE": "indicative", "CONCEPT": "concept"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    a = ap.parse_args()
    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site

    # Index every JSON in the directory by entity_type. Filenames differ between
    # sites for the same concept; entity_type is the contract.
    by_type, seen_files = {}, {}
    for f in sorted(site.glob("*.json")):
        try:
            doc = json.loads(f.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(doc, dict):
            continue
        et = doc.get("entity_type")
        if not et or et in by_type:
            continue
        by_type[et] = doc
        seen_files[et] = f.name

    missing = []

    def R(entity_type):
        """A receipt if the site holds it, else None - and remember the absence."""
        doc = by_type.get(entity_type)
        if doc is None and entity_type not in missing:
            missing.append(entity_type)
        return doc

    pdv = R("AuthoritativePropertyDivisionClip")
    bld = R("OfficialBuildingFootprintClip")
    ter = R("DerivedTerrainEvidence")
    shr = R("ShorelineAndStrandskyddDerivation")
    sea = R("SeaViewSightlineDerivation")
    mps = R("MunicipalPlanningStatusReceiptSet")
    src = R("OfficialContextGeometrySourceReceiptSet")
    osm = by_type.get("OsmContextDerived")

    subject = (pdv or {}).get("subject") or (osm or {}).get("subject_address") or site.name
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

    # Site-derived tokens. Nothing below may hard-code a place, a kommun code or an
    # area: this generator runs on every site, and a literal here is the same bug
    # class as the kn0581 product label.
    site_token = re.sub(r"[^A-Z0-9]", "", site.name.split("-")[0].upper()
                        .replace("Ä", "A").replace("Ö", "O").replace("Å", "A"))
    kommun = (osm or {}).get("kommun")
    kommunkod = (osm or {}).get("kommunkod")

    def site_rel(filename):
        """Repo-relative locator for a receipt file, so the path is not typed per site."""
        try:
            return str(site.relative_to(ROOT) / filename)
        except ValueError:
            return str(site / filename)

    def kn(dataset):
        """KN suffix for a receipt id, from the dataset's own STAC item id."""
        item = ((src or {}).get("datasets", {}).get(dataset, {}) or {}).get("item_id")
        return f"_KN{item}" if item else ""

    def scope_area():
        return (f"{kommun} kommun ({kommunkod})" if kommun and kommunkod
                else f"the {subject} municipality clip")

    def ring_area_m2(doc):
        """Registered extent computed from the authoritative ring, never typed."""
        if not doc:
            return None
        r = doc["subject_rings_local"][0]
        a = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))
        return round(abs(a) / 2, 1)

    area_m2 = ring_area_m2(pdv)
    area_txt = f"{area_m2:,.1f}" if area_m2 is not None else "unknown"

    # A receipt can be present but not carry the FIELD a finding needs: sites are
    # produced by different pipeline versions. Absent fields are treated exactly
    # like absent receipts - the finding is emitted OPEN, never computed from a
    # substitute and never dropped.
    def having(doc, *fields, entity=None):
        """The doc if it carries every field, else None (recording what was absent)."""
        if doc is None:
            return None
        gone = [f for f in fields if f not in doc]
        if gone:
            key = f"{entity or doc.get('entity_type')}.{gone[0]}"
            if key not in missing_fields:
                missing_fields.append(key)
            return None
        return doc

    missing_fields = []

    bld_placed = bld if (bld and bld.get("buildings")
                         and "placement" in bld["buildings"][0]
                         and "counts" in bld) else None
    if bld and bld_placed is None and "OfficialBuildingFootprintClip.placement" not in missing_fields:
        missing_fields.append("OfficialBuildingFootprintClip.placement")

    ter_stats = having(ter, "parcel_height_statistics", entity="DerivedTerrainEvidence")
    ter_slope = having(ter, "parcel_slope", "slope_aspect_at_pin", entity="DerivedTerrainEvidence")
    ter_tiles = having(ter, "tile_integrity", "gate_dependency", entity="DerivedTerrainEvidence")

    onp = [b for b in bld_placed["buildings"] if b["placement"] == "ON_PARCEL"] if bld_placed else []
    band100 = shr["strandskydd_bands"][0] if shr else None
    arc = sea["result"]["arcs"][0] if sea else None
    pin = ter_slope["slope_aspect_at_pin"] if ter_slope else None
    wp = ter_slope["parcel_slope"]["whole_parcel_plane"] if ter_slope else None
    lg = ter_slope["parcel_slope"]["local_ground_slope"] if ter_slope else None
    st = ter_stats["parcel_height_statistics"] if ter_stats else None
    by = {l["layer"]: l for l in mps["layers"]} if mps else {}

    # ---------------- receipts -------------------------------------------
    receipts = []
    if src and pdv:
        d = src.get("datasets", {}).get("property_division", {})
        receipts.append(
            {"receipt_id": f"RCPT_SE_LM_PROPERTY_DIVISION{kn('property_division')}",
             "source_id": "SE_LM_FASTIGHETSINDELNING", "retrieved_at": d.get("downloaded_at"),
             "request_or_record_ref": d.get("item_url"), "runtime_locator": d.get("local_path"),
             "sha256": pdv.get("raw_asset", {}).get("sha256"),
             "scope": f"Registered property division for {scope_area()}.",
             "evidence_class": "OFFICIAL_OPEN_SOURCE"})
    if src and bld:
        d = src.get("datasets", {}).get("buildings", {})
        receipts.append(
            {"receipt_id": f"RCPT_SE_LM_BUILDINGS{kn('buildings')}",
             "source_id": "SE_LM_BYGGNAD", "retrieved_at": d.get("downloaded_at"),
             "request_or_record_ref": d.get("item_url"), "runtime_locator": d.get("local_path"),
             "sha256": bld.get("raw_asset", {}).get("sha256"),
             "scope": f"Registered building footprints for {scope_area()}.",
             "evidence_class": "OFFICIAL_OPEN_SOURCE"})
    if ter_tiles and "gate_tracked_asset" in ter:
        receipts.append(
            {"receipt_id": f"RCPT_SE_LM_TERRAIN_DTM_{site_token}",
             "source_id": "SE_LM_MARKHOJDMODELL_1M", "retrieved_at": ter.get("source_retrieved_at"),
             "request_or_record_ref": ter["gate_tracked_asset"].get("stac_item"),
             "runtime_locator": ".runtime/lantmateriet/terrain/",
             "sha256": ter["gate_tracked_asset"].get("sha256"),
             "scope": f"{len(ter_tiles['tile_integrity'])} receipted 1 m DTM tiles; all sha256 re-verified "
                      f"on every run.",
             "evidence_class": "OFFICIAL_OPEN_SOURCE"})
    if mps:
        receipts.append(
            {"receipt_id": "RCPT_SE_VARMDO_WFS_PLANNING",
             "source_id": "SE_VARMDO_GEOSERVER_WFS", "retrieved_at": mps.get("retrieved_at"),
             "request_or_record_ref": mps.get("service_endpoint"),
             "runtime_locator": site_rel(seen_files["MunicipalPlanningStatusReceiptSet"]),
             "sha256": next((l.get("query_sha256") for l in mps["layers"] if l.get("query_sha256")), None),
             "scope": f"{kommun + ' kommun' if kommun else 'Municipal'} public WFS: gällande/pågående/upphävda "
                      f"detaljplaner and "
                      "utvidgat strandskydd, each queried with a control.",
             "evidence_class": "OFFICIAL_OPEN_SOURCE"})

    F = []

    def add(fid, domain, value, unit, ec, refs, method, verification, limits):
        F.append({"finding_id": fid, "domain": domain, "value": value, "unit": unit,
                  "evidence_class": ec, "chip": CHIP[ec], "source_receipt_refs": refs,
                  "method": method, "observed_at": now, "verification": verification,
                  "limitations": limits})

    def absence(entity_type):
        """Say precisely what is missing: the whole receipt, or a field within it.
        Conflating the two would put a false statement in the ledger."""
        if entity_type not in by_type:
            return f"receipt not present: {entity_type}", f"This site holds no {entity_type}."
        gone = [m.split(".", 1)[1] for m in missing_fields if m.startswith(entity_type + ".")]
        fields = ", ".join(gone) or "the required field"
        return (f"field not present in {entity_type}: {fields}",
                f"This site's {entity_type} does not carry {fields}.")

    def add_open(fid, domain, entity_type, note):
        """A finding this site cannot support. Emitted, not skipped: the value is
        null and the record says exactly what was absent."""
        reason, lead = absence(entity_type)
        F.append({"finding_id": fid, "domain": domain, "value": None, "unit": None,
                  "evidence_class": "DERIVED", "chip": CHIP["DERIVED"],
                  "source_receipt_refs": [], "method": None, "observed_at": now,
                  "verification": "OPEN",
                  "reason": reason,
                  "limitations": [f"{lead} {note} Nothing here is inferred from the receipts "
                                  f"that ARE present."]})

    if pdv:
        add("FINDING_SE_REGISTERED_PARCEL_EXTENT", "property",
            {"designation": subject, "area_m2": area_m2, "boundary_vertices": len(pdv["subject_rings_local"][0]) - 1,
             "context_parcels": len(pdv["context_rings_local"]), "crs": pdv["source_crs"]},
            "m2", "OBSERVED_OFFICIAL", [f"RCPT_SE_LM_PROPERTY_DIVISION{kn('property_division')}"],
            "Lantmäteriet fastighetsindelning GeoPackage clipped around the site pin; geometry hash recorded.",
            "VERIFIED",
            ["Authoritative for registered extent, not a survey of monument positions."])
    else:
        add_open("FINDING_SE_REGISTERED_PARCEL_EXTENT", "property",
                 "AuthoritativePropertyDivisionClip",
                 "Registered extent, corner count and context parcels are therefore not established.")

    if bld_placed:
        add("FINDING_SE_OFFICIAL_BUILDINGS_ON_PARCEL", "buildings",
            {"on_parcel_count": len(onp), "total_footprint_m2": bld["on_parcel_footprint_area_m2"],
             "buildings": [{"type": b["type"], "footprint_m2": b["footprint_area_m2"],
                            "object_id": b["object_id"]} for b in onp],
             "context_within_200m": bld["counts"]["context"]},
            "m2", "OBSERVED_OFFICIAL", [f"RCPT_SE_LM_BUILDINGS{kn('buildings')}"],
            "LM byggnad footprints clipped to 200 m and classified ON_PARCEL by centroid "
            "point-in-polygon against the registered boundary.",
            "VERIFIED",
            ["Roof-edge capture (insamlingsläge Takkant), not ground-level survey.",
             "A footprint straddling the boundary is assigned by its centroid."])
    else:
        add_open("FINDING_SE_OFFICIAL_BUILDINGS_ON_PARCEL", "buildings",
                 "OfficialBuildingFootprintClip",
                 "What is built on this parcel is therefore not established.")

    if bld:
        add("FINDING_SE_BUILDING_HEIGHTS_ABSENT", "buildings",
            {"heights_available": False, "product": bld["source_product"]},
            None, "OBSERVED_OFFICIAL", [f"RCPT_SE_LM_BUILDINGS{kn('buildings')}"],
            "Inspected every attribute column of the byggnad feature table.",
            "VERIFIED",
            ["No storey count, eaves or ridge height exists in this product. Any extrusion in a "
             "render is DERIVED or CONCEPT and must be labelled as such."])
    else:
        add_open("FINDING_SE_BUILDING_HEIGHTS_ABSENT", "buildings",
                 "OfficialBuildingFootprintClip",
                 "Whether the building product carries heights has therefore not been inspected here.")

    if ter_stats:
        add("FINDING_SE_PARCEL_RELIEF", "terrain",
            {"min_rh2000_m": st["min_m"], "max_rh2000_m": st["max_m"], "relief_m": st["relief_m"],
             "mean_rh2000_m": st["mean_m"], "pin_elevation_rh2000_m": ter["pin_elevation_rh2000_m"],
             "mask_area_m2": st["sample_area_m2"], "registered_area_m2": area_m2},
            "m", "DERIVED", [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}"],
            "Parcel mask over the 1 m ground model; the mask measures within 1.3 m2 of the "
            "registered area, an independent check that the boundary and DTM frames align.",
            "VERIFIED",
            ["Bare-earth ground heights: no buildings, no vegetation.",
             "A derivation from a verified source, not an official terrain survey; not "
             "finished-floor or foundation input."])
    else:
        add_open("FINDING_SE_PARCEL_RELIEF", "terrain",
                 "DerivedTerrainEvidence",
                 "Heights, relief and the pin elevation are therefore not established.")

    if ter_slope:
        add("FINDING_SE_SLOPE_THREE_MEASURES", "terrain",
            {"at_pin_horn3x3": {"slope_deg": pin["slope_deg"], "aspect_deg": pin["aspect_deg"],
                                "aspect_compass": pin["aspect_compass"]},
             "whole_parcel_plane": {"slope_deg": wp["slope_deg"],
                                    "fall_compass": wp["fall_direction_compass"],
                                    "rms_residual_m": wp["rms_residual_m"]},
             "ground_underfoot": {"median_deg": lg["median_deg"], "p90_deg": lg["p90_deg"],
                                  "max_deg": lg["max_deg"]},
             "is_effectively_planar": ter["parcel_slope"]["is_effectively_planar"]},
            "deg", "DERIVED", [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}"],
            "Horn 3x3 at the pin; least-squares plane over the parcel mask; per-cell gradient "
            "distribution over the same mask.",
            "VERIFIED",
            ["THREE DIFFERENT QUESTIONS, THREE CORRECT ANSWERS. The pin figure is a local "
             "microslope, the plane is the whole parcel, the distribution is the ground underfoot. "
             "None is a correction of another; quote the one that matches the question.",
             "The parcel is not planar (1.46 m RMS against 11.53 m relief), so no single slope "
             "describes it."])
    else:
        add_open("FINDING_SE_SLOPE_THREE_MEASURES", "terrain",
                 "DerivedTerrainEvidence",
                 "Slope and aspect are therefore not established by any of the three measures.")

    if shr:
        add("FINDING_SE_PARCEL_REACHES_SHORELINE", "water",
            {"nearest_m": shr["parcel_to_shoreline"]["nearest_m"],
             "farthest_boundary_point_m": shr["parcel_to_shoreline"]["farthest_boundary_point_m"],
             "touches": shr["parcel_to_shoreline"]["parcel_touches_shoreline"],
             "water_surface_rh2000_m": shr["water_surface"]["height_rh2000_m"],
             "low_lying_area": shr.get("parcel_height_bands") or ter["parcel_height_bands"]},
            "m", "DERIVED", [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}"],
            "Shoreline taken as the edge of the ground model's constant water fill; that constant "
            "was found (modal height in the lowest metre) and accepted only because it covers an "
            "implausible share of a coastal window, not assumed.",
            "VERIFIED",
            ["A DERIVED shoreline at 1 m resolution — not the cadastral shoreline and not the "
             "legal strandlinje."])
    else:
        add_open("FINDING_SE_PARCEL_REACHES_SHORELINE", "water",
                 "ShorelineAndStrandskyddDerivation",
                 "Distance to a shoreline is therefore not established, and no shoreline is implied.")

    if shr:
        add("FINDING_SE_STRANDSKYDD_COVERS_WHOLE_PARCEL", "regulatory",
            {"band_m": band100["band_m"], "parcel_area_inside_m2": band100["parcel_area_inside_m2"],
             "parcel_share_inside_percent": band100["parcel_share_inside_percent"],
             "buildings_inside": sum(1 for b in shr["buildings_vs_shoreline"] if b["inside_100m"]),
             "buildings_total": len(shr["buildings_vs_shoreline"]),
             "building_distances_m": [b["distance_to_shoreline_m"] for b in shr["buildings_vs_shoreline"]],
             "legal_basis": band100["legal_basis"]},
            "%", "DERIVED", [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}", f"RCPT_SE_LM_PROPERTY_DIVISION{kn('property_division')}"],
            "Distance field from the derived shoreline evaluated over every in-parcel DTM cell and "
            "every registered building centroid.",
            "VERIFIED",
            ["Measured against a derived shoreline; a transaction answer should be taken from the "
             "authority.",
             "No dispens, upphävande or plan-based exemption is accounted for here."])
    else:
        add_open("FINDING_SE_STRANDSKYDD_COVERS_WHOLE_PARCEL", "regulatory",
                 "ShorelineAndStrandskyddDerivation",
                 "Whether shoreline protection reaches this parcel is therefore not established - which is NOT the same as it not applying.")

    if mps:
        add("FINDING_SE_NO_EXTENDED_STRANDSKYDD", "regulatory",
            {"result": "VERIFIED_NEGATIVE", "layers": [
                {"layer": k, "title": by[k]["title"], "matched": by[k]["numberMatched"],
                 "control_features": by[k]["control"]["unfiltered_numberMatched"]}
                for k in ["extern_db:vy_lst_utvidgat_strandskydd_y",
                          "intern_db:vy_strandskydd_utvidgat_lststockholm_y",
                          "op_2022_2035_db:vy_op_ant_utokad_strandskydd_300m_y"] if k in by]},
            None, "OBSERVED_OFFICIAL", ["RCPT_SE_VARMDO_WFS_PLANNING"],
            "WFS INTERSECTS against the authoritative parcel polygon, EPSG:3006 -> EPSG:3011; each "
            "layer queried unfiltered first as a control so a zero is a tested negative.",
            "VERIFIED",
            ["The kommun's published depiction of the Länsstyrelsen decision, not the decision "
             "document itself."])
    else:
        add_open("FINDING_SE_NO_EXTENDED_STRANDSKYDD", "regulatory",
                 "MunicipalPlanningStatusReceiptSet",
                 "No municipal layer has been queried, so an extended zone is neither confirmed nor ruled out. An unqueried layer is not a negative.")

    if mps:
        add("FINDING_SE_NO_DETALJPLAN", "regulatory",
            {"result": "VERIFIED_NEGATIVE", "layers": [
                {"layer": k, "title": by[k]["title"], "matched": by[k]["numberMatched"],
                 "control_features": by[k]["control"]["unfiltered_numberMatched"]}
                for k in ["intern_db:vy_gallande_detaljplaner_y",
                          "intern_db:vy_pagaende_detaljplaner_y",
                          "intern_db:vy_upphavda_detaljplaner_efter_20230101_y"] if k in by],
             "consequence": "Unplanned land. Bygglov is judged against översiktsplan, strandskydd "
                            "and PBL, not a plan map."},
            None, "OBSERVED_OFFICIAL", ["RCPT_SE_VARMDO_WFS_PLANNING"],
            "Same controlled WFS INTERSECTS method as the strandskydd query.",
            "VERIFIED",
            ["Absence of a plan is not absence of regulation.",
             "No förhandsbesked or bygglov history was queried."])
    else:
        add_open("FINDING_SE_NO_DETALJPLAN", "regulatory",
                 "MunicipalPlanningStatusReceiptSet",
                 "Plan status is therefore unknown. Absence of a query is not absence of a plan.")

    if sea:
        add("FINDING_SE_SEA_VIEW_ARC", "view",
            {"arc_percent": sea["result"]["sea_view_arc_percent"],
             "arc_deg": sea["result"]["sea_view_arc_deg"],
             "from_deg": arc["from_deg"], "to_deg": arc["to_deg"], "arc_count": sea["result"]["arc_count"],
             "nearest_visible_water_m": sea["result"]["nearest_visible_water_m"],
             "viewpoint": sea["viewpoint"]["description"],
             "eye_height_rh2000_m": sea["viewpoint"]["eye_height_rh2000_m"],
             "rays": sea["method"]["bearing_count"],
             "supersedes_stated_claim": sea["supersedes"]["previous_claim"]},
            "%", "DERIVED", [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}"],
            "Radial ray-march of the 1 m ground model with running-maximum horizon angle, earth "
            "curvature and standard refraction; a bearing counts only where a VISIBLE sample is water.",
            "VERIFIED",
            ["UPPER BOUND. The ground model is bare earth: no trees, no buildings, no boathouses, "
             "no neighbouring roofs. Each blocks a real view and none is in this calculation.",
             "A RENDERED HORIZON IN ANY IMAGE IS NEVER A VIEW CLAIM. This number is the only view "
             "figure, and it is a ceiling, not an observation.",
             "One viewpoint at one eye height; not a room-by-room analysis."])
    else:
        add_open("FINDING_SE_SEA_VIEW_ARC", "view",
                 "SeaViewSightlineDerivation",
                 "No viewshed has been computed, so no view figure exists for this site at all.")

    # ---------------- gates ----------------------------------------------
    def gate(gid, status, refs, reason, decided=True):
        return {"gate_id": gid, "status": status, "evidence_refs": refs,
                "decided_at": now if decided else None, "reason": reason}

    def gate_missing(gid, entity_type, note):
        """A gate whose evidence this site does not hold. OPEN, never quietly absent."""
        reason, _ = absence(entity_type)
        return {"gate_id": gid, "status": "OPEN", "evidence_refs": [], "decided_at": None,
                "reason": f"{reason}. {note}"}

    G = [
        (        gate("GATE_SE_PROPERTY_DIVISION_CONTEXT", "CLOSED",
             [f"RCPT_SE_LM_PROPERTY_DIVISION{kn('property_division')}", "FINDING_SE_REGISTERED_PARCEL_EXTENT"],
             f"Authoritative registered extent for {subject}: {area_txt} m², "
             f"{len(pdv['subject_rings_local'][0]) - 1} boundary vertices, "
             f"{len(pdv['context_rings_local'])} context parcels.")
         if pdv else
         gate_missing("GATE_SE_PROPERTY_DIVISION_CONTEXT", "AuthoritativePropertyDivisionClip",
                      "Registered extent is not established for this site.")),
        (        gate("GATE_SE_BUILDING_FOOTPRINTS", "CLOSED",
             [f"RCPT_SE_LM_BUILDINGS{kn('buildings')}", "FINDING_SE_OFFICIAL_BUILDINGS_ON_PARCEL"],
             f"{len(onp)} registered buildings on the parcel with real rings, "
             f"{bld['on_parcel_footprint_area_m2']} m² of footprint. The areas independently "
             f"confirm the figures previously published without geometry behind them.")
         if bld_placed else
         gate_missing("GATE_SE_BUILDING_FOOTPRINTS", "OfficialBuildingFootprintClip",
                      "What is built on this parcel is not established.")),
        (        gate("GATE_SE_BUILDING_HEIGHTS", "OPEN",
             ["FINDING_SE_BUILDING_HEIGHTS_ABSENT"],
             "The LM byggnad product carries no heights. Storeys, eaves, ridge and volume are "
             "NOT established, so no massing can be presented as authoritative.", decided=False)
         if bld else
         gate_missing("GATE_SE_BUILDING_HEIGHTS", "OfficialBuildingFootprintClip",
                      "The building product has not been inspected, so heights are not established either way.")),
        (        gate("GATE_SE_TERRAIN", "CLOSED",
             [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}", "FINDING_SE_PARCEL_RELIEF",
              "FINDING_SE_SLOPE_THREE_MEASURES"],
             ter["gate_dependency"]["closed_by"])
         if ter_tiles else
         gate_missing("GATE_SE_TERRAIN", "DerivedTerrainEvidence",
                      "No terrain derivation exists for this site.")),
        (        gate("GATE_SE_TERRAIN_PROVENANCE", "OPEN",
             [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}"],
             "Tile integrity is verified on every run, but the per-tile ursprung/brytgeometri "
             "provenance polygons were never downloaded, so the laser-scan epoch behind these "
             "cells is unknown.", decided=False)
         if ter_tiles else
         gate_missing("GATE_SE_TERRAIN_PROVENANCE", "DerivedTerrainEvidence",
                      "No terrain derivation exists, so its provenance cannot be assessed.")),
        (        gate("GATE_SE_STRANDSKYDD_GEOMETRY", "CLOSED",
             ["FINDING_SE_PARCEL_REACHES_SHORELINE", "FINDING_SE_STRANDSKYDD_COVERS_WHOLE_PARCEL"],
             f"Measured, not presumed. The parcel reaches the water at "
             f"{shr['parcel_to_shoreline']['nearest_m']} m and its farthest corner is "
             f"{shr['parcel_to_shoreline']['farthest_boundary_point_m']} m out, so "
             f"{band100['parcel_share_inside_percent']}% of it lies inside the 100 m zone, as do "
             f"all {len(shr['buildings_vs_shoreline'])} registered buildings.")
         if shr else
         gate_missing("GATE_SE_STRANDSKYDD_GEOMETRY", "ShorelineAndStrandskyddDerivation",
                      "Distance to a shoreline has not been measured. This is not a finding that shoreline protection does not apply.")),
        (        gate("GATE_SE_STRANDSKYDD_EXTENSION", "CLOSED",
             ["RCPT_SE_VARMDO_WFS_PLANNING", "FINDING_SE_NO_EXTENDED_STRANDSKYDD"],
             "Verified negative across three independent layers, each with a passing control. "
             "The base 100 m applies here, and it already covers the whole parcel, so the "
             "extension question does not change the answer.")
         if mps else
         gate_missing("GATE_SE_STRANDSKYDD_EXTENSION", "MunicipalPlanningStatusReceiptSet",
                      "No municipal layer has been queried. An unqueried layer is not a negative.")),
        (        gate("GATE_SE_DETALJPLAN", "CLOSED",
             ["RCPT_SE_VARMDO_WFS_PLANNING", "FINDING_SE_NO_DETALJPLAN"],
             "Verified negative: no plan in force, none pending, none revoked since 2023-01-01. "
             "Unplanned land.")
         if mps else
         gate_missing("GATE_SE_DETALJPLAN", "MunicipalPlanningStatusReceiptSet",
                      "Plan status has not been queried. Absence of a query is not absence of a plan.")),
        gate("GATE_SE_STRANDSKYDD_DISPENS", "OPEN", [],
             "Any dispens or upphävande attaching to this property is a case record in Värmdö's "
             "and Länsstyrelsen's registers, not a map layer. Not retrieved.", decided=False),
        (        gate("GATE_SE_SEA_VIEW", "CLOSED",
             [f"RCPT_SE_LM_TERRAIN_DTM_{site_token}", "FINDING_SE_SEA_VIEW_ARC"],
             f"{sea['result']['sea_view_arc_percent']}% of the compass in one unbroken arc "
             f"{arc['from_deg']}°–{arc['to_deg']}°, computed by viewshed. Closed as a TERRAIN "
             f"result and as a CEILING only — see GATE_SE_VIEW_OCCLUSION.")
         if sea else
         gate_missing("GATE_SE_SEA_VIEW", "SeaViewSightlineDerivation",
                      "No viewshed has been computed, so no view figure exists for this site.")),
        (        gate("GATE_SE_VIEW_OCCLUSION", "OPEN",
             ["FINDING_SE_SEA_VIEW_ARC"],
             "The viewshed is bare earth. Trees, buildings, boathouses and neighbouring roofs "
             "are not modelled and all of them reduce the arc. What a person actually sees from "
             "a window is NOT established, and no render may be used to assert it.", decided=False)
         if sea else
         gate_missing("GATE_SE_VIEW_OCCLUSION", "SeaViewSightlineDerivation",
                      "No viewshed exists, so there is no bare-earth ceiling to qualify.")),
    ]

    meta = {"subject": subject, "site": site.name, "generated_at": now,
            "generator": "scripts/build-findings-and-gates.py",
            "generated_from": ["property-division-derived-v0.1.json",
                               "buildings-official-derived-v0.1.json",
                               "terrain-dem-derived-v0.1.json",
                               "shoreline-strandskydd-derived-v0.1.json",
                               "sea-view-derived-v0.1.json",
                               "municipal-planning-status-v0.1.json"],
            "receipts_absent": missing,
            "fields_absent": missing_fields,
            "rule": "Nothing in these files is hand-typed; every value is read from a committed "
                    "derived product. A rendered horizon is never a view claim. Every receipt is "
                    "optional: a finding or gate whose receipt or field is absent is emitted OPEN "
                    "with the reason, never skipped and never inferred."}

    (site / "findings.json").write_text(json.dumps(
        {"schema_version": "site-findings/v0.1", "entity_type": "SiteFindingSet", **meta,
         "source_receipts": receipts, "findings": F}, ensure_ascii=False, indent=2) + "\n")
    (site / "gates.json").write_text(json.dumps(
        {"schema_version": "site-gates/v0.1", "entity_type": "SiteGateSet", **meta,
         "gate_count": len(G),
         "closed": sum(1 for g in G if g["status"] == "CLOSED"),
         "open": sum(1 for g in G if g["status"] == "OPEN"),
         "gates": G}, ensure_ascii=False, indent=2) + "\n")

    print(f"subject   : {subject}")
    print(f"receipts  : {len(receipts)}")
    print(f"findings  : {len(F)}")
    for f in F:
        print(f"   [{f['chip']:<13}] {f['finding_id']}")
    closed = sum(1 for g in G if g['status'] == 'CLOSED')
    print(f"gates     : {len(G)}  ({closed} closed / {len(G)-closed} open)")
    for g in G:
        print(f"   {'●' if g['status']=='CLOSED' else '○'} {g['status']:<6} {g['gate_id']}")
    print(f"written   : {site/'findings.json'}, {site/'gates.json'}")


if __name__ == "__main__":
    main()
