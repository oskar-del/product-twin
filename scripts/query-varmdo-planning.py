#!/usr/bin/env python3
"""Query Värmdö kommun's public WFS for the planning and shoreline-protection
status of a registered property, and receipt every answer.

The parcel polygon (authoritative, Lantmäteriet) is reprojected to the service's
EPSG:3011 and used as the INTERSECTS filter, so the answer covers the whole
property, not a centre point.

EVERY layer query is preceded by a CONTROL query proving the filter mechanism
returns features on that same layer. A zero result is only recorded as a
verified negative when its control passed; otherwise it is recorded as
INCONCLUSIVE. An untested zero is not evidence of absence.

Usage: python3 scripts/query-varmdo-planning.py --site data/sites/sweden/djuro-byvag-34
"""
import argparse, hashlib, json, urllib.parse, urllib.request, datetime
from pathlib import Path
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
WFS = "https://karta.varmdo.se/geoserver/wfs"
SERVICE_CRS = "EPSG:3011"

LAYERS = [
    ("extern_db:vy_lst_utvidgat_strandskydd_y",
     "Utvidgat strandskydd 300 m (Länsstyrelsen i Stockholms län)",
     "Does Länsstyrelsen's extended shoreline protection cover this property?"),
    ("intern_db:vy_strandskydd_utvidgat_lststockholm_y",
     "Utvidgat strandskydd, Lst Stockholm (kommunens kopia)",
     "Same question against the kommun's own copy of the decision."),
    ("op_2022_2035_db:vy_op_ant_utokad_strandskydd_300m_y",
     "Utökat strandskydd 300 m (översiktsplan 2022–2035, antagen)",
     "How the adopted comprehensive plan depicts extended protection here."),
    ("intern_db:vy_gallande_detaljplaner_y",
     "Gällande detaljplaner",
     "Is the property inside a detaljplan in force?"),
    ("intern_db:vy_pagaende_detaljplaner_y",
     "Pågående detaljplaner",
     "Is a detaljplan under way over the property?"),
    ("intern_db:vy_upphavda_detaljplaner_efter_20230101_y",
     "Upphävda detaljplaner efter 2023-01-01",
     "Has a plan over the property been revoked since 2023-01-01?"),
]


def get(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{WFS}?{q}", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    return raw, json.loads(raw)


def feature_query(layer, cql=None, count=None):
    p = {"service": "WFS", "version": "2.0.0", "request": "GetFeature",
         "typeNames": layer, "outputFormat": "application/json",
         "srsName": SERVICE_CRS}
    if cql:
        p["cql_filter"] = cql
    if count:
        p["count"] = count
    return get(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    a = ap.parse_args()
    site = Path(a.site) if Path(a.site).is_absolute() else ROOT / a.site
    pd = json.loads((site / "property-division-derived-v0.1.json").read_text())
    e0, n0 = pd["origin_sweref"]
    ring_local = pd["subject_rings_local"][0]
    designation = pd["subject"]

    tf = Transformer.from_crs("EPSG:3006", SERVICE_CRS, always_xy=True)
    ring_3011 = [tf.transform(e0 + x, n0 + z) for x, z in ring_local]
    wkt = "POLYGON((" + ",".join(f"{x:.3f} {y:.3f}" for x, y in ring_3011) + "))"
    cql = f"INTERSECTS(geom,SRID=3011;{wkt})"
    print(f"subject            : {designation}")
    print(f"parcel -> {SERVICE_CRS}   : {len(ring_3011)} vertices, "
          f"centre ~{sum(p[0] for p in ring_3011)/len(ring_3011):.0f},"
          f"{sum(p[1] for p in ring_3011)/len(ring_3011):.0f}")

    results = []
    for layer, title, question in LAYERS:
        entry = {"layer": layer, "title": title, "question": question,
                 "service": WFS, "service_crs": SERVICE_CRS}
        try:
            # CONTROL: does this layer return anything at all through this path?
            _, ctl = feature_query(layer, count=1)
            total = ctl.get("numberMatched")
            entry["control"] = {"unfiltered_numberMatched": total,
                                "passed": bool(total and total > 0)}
            if not entry["control"]["passed"]:
                entry["result"] = "INCONCLUSIVE"
                entry["detail"] = "layer returned no features even unfiltered"
                results.append(entry); print(f"  ? {layer}: INCONCLUSIVE"); continue

            raw, d = feature_query(layer, cql=cql)
            n = d.get("numberMatched", 0)
            entry["query_sha256"] = hashlib.sha256(raw).hexdigest()
            entry["response_bytes"] = len(raw)
            entry["numberMatched"] = n
            if n == 0:
                entry["result"] = "VERIFIED_NEGATIVE"
                entry["detail"] = (f"the parcel polygon intersects none of the "
                                   f"{total} features in this layer")
                print(f"  - {title}: NONE  (control: {total} features in layer)")
            else:
                entry["result"] = "MATCH"
                entry["features"] = [
                    {k: v for k, v in f["properties"].items()
                     if v not in (None, "") and not k.startswith("lank")}
                    for f in d.get("features", [])]
                print(f"  + {title}: {n} MATCH")
                for f in entry["features"][:3]:
                    print(f"      {json.dumps(f, ensure_ascii=False)[:200]}")
        except Exception as ex:
            entry["result"] = "ERROR"; entry["detail"] = str(ex)
            print(f"  ! {layer}: ERROR {ex}")
        results.append(entry)

    doc = {
        "schema_version": "municipal-planning-status/v0.1",
        "entity_type": "MunicipalPlanningStatusReceiptSet",
        "subject": designation,
        "evidence_class": "AUTHORITATIVE",
        "authority": "Värmdö kommun (publik WFS); Länsstyrelsen i Stockholms län for the "
                     "utvidgat strandskydd decision layer",
        "service_endpoint": WFS,
        "service_crs": SERVICE_CRS,
        "query_method": "WFS 2.0 GetFeature, cql_filter INTERSECTS against the authoritative "
                        "Lantmäteriet parcel polygon reprojected EPSG:3006 -> EPSG:3011",
        "parcel_wkt_3011": wkt,
        "retrieved_at": datetime.datetime.now(datetime.timezone.utc)
                        .isoformat(timespec="seconds"),
        "control_discipline": "each layer was first queried unfiltered; a zero result is "
                              "recorded as VERIFIED_NEGATIVE only where that control returned "
                              "features, otherwise INCONCLUSIVE",
        "layers": results,
        "limitations": [
            "This is the kommun's published map service, which is the authoritative public "
            "depiction but is not the plan document or the Länsstyrelsen decision itself. "
            "A property-level answer for a transaction should quote the plan or decision.",
            "Absence of a detaljplan does not mean building is unregulated: outside plan, "
            "Värmdö's översiktsplan, strandskydd and the PBL bygglov rules govern.",
            "No dispens, forhandsbesked or bygglov history for this property was queried.",
        ],
    }
    out = site / "municipal-planning-status-v0.1.json"
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print(f"written            : {out}")


if __name__ == "__main__":
    main()
