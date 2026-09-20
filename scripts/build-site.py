#!/usr/bin/env python3
"""
build-site.py — emit a plot's site page (screen 1 report + screen 2 twin) from its receipts.

    python3 scripts/build-site.py <site-dir> [--out FILE] [--open]

Svärtinge is the reference instance, but nothing here is Svärtinge-specific: the generator
reads whatever derived JSONs a site directory happens to hold, indexes them by `entity_type`
(NOT by filename — Djurö and Svärtinge name the same concepts differently), and renders only
the sections whose receipts are actually present. A site with no shoreline derivation simply
has no shoreline section; it never gets a placeholder, and no figure is ever typed in here.

Three honesty rules are enforced in code, not by convention:

  1. Every rendered figure carries the receipt it came from. `fig()` refuses a value that has
     no source, so an unsourced number cannot reach the page.
  2. Receipts are cross-checked against each other and against the raw archives on disk. A
     mismatch renders as a PROVENANCE CONFLICT banner instead of a confident number.
  3. Evidence class travels with the figure. A DERIVED number never renders in AUTHORITATIVE
     colours, and a rendered horizon is never a view claim — view statements come only from a
     viewshed derivation.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
from datetime import datetime, timezone

REPO = pathlib.Path(__file__).resolve().parents[1]
CHROME_TOKENS = REPO.parent / "repo-platform" / "engine" / "ui" / "chrome" / "tokens.css"
LM_DATA = REPO.parent / "lm-data"

EVIDENCE_ORDER = ["AUTHORITATIVE", "INDICATIVE", "DERIVED", "REPORTED_UNVERIFIED", "CONCEPT"]


# ---------------------------------------------------------------- loading

def load_site(site_dir: pathlib.Path):
    """Index every readable JSON in the directory by entity_type."""
    docs, files = {}, []
    for path in sorted(site_dir.glob("*.json")):
        try:
            doc = json.loads(path.read_text())
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            files.append({"file": path.name, "error": str(exc)})
            continue
        if not isinstance(doc, dict):
            continue
        entity = doc.get("entity_type")
        files.append({
            "file": path.name,
            "entity_type": entity,
            "schema_version": doc.get("schema_version"),
            "evidence_class": doc.get("evidence_class"),
            # `subject` is a plain designation in most receipts but an object in a few of the
            # older Svärtinge ones; only a scalar can be compared across files.
            "subject": next((v for v in (doc.get("subject"), doc.get("subject_address"))
                             if isinstance(v, str)), None),
            "raw_sha256": (doc.get("raw_asset") or {}).get("sha256"),
            "raw_bytes": (doc.get("raw_asset") or {}).get("byte_count"),
            "derived_sha256": doc.get("derived_geometry_sha256"),
        })
        if entity:
            docs.setdefault(entity, doc)
    return docs, files


def pick(docs, *entity_types):
    for name in entity_types:
        if name in docs:
            return docs[name]
    return None


# ---------------------------------------------------------------- figures

class Figure:
    """A number plus the receipt that produced it. There is no way to make one without a source."""

    def __init__(self, value, unit, source, evidence, note=None):
        if source is None:
            raise ValueError(f"figure {value!r} has no source receipt")
        if evidence not in EVIDENCE_ORDER:
            raise ValueError(f"figure {value!r} has unknown evidence class {evidence!r}")
        self.value, self.unit, self.source, self.evidence, self.note = value, unit, source, evidence, note

    def text(self):
        if isinstance(self.value, float):
            return f"{self.value:,.1f}".replace(",", " ")
        if isinstance(self.value, int):
            return f"{self.value:,}".replace(",", " ")
        return str(self.value)


def as_rings(value):
    """
    Normalise footprint geometry to a flat list of rings.

    The two sites nest this differently: Svärtinge's `footprint_rings_local` is a list of rings,
    while Djurö's `rings_local` is a list of polygons each holding its own rings. Passing the
    wrong depth through produces coordinates that are arrays rather than numbers, which reaches
    the viewer as NaN geometry. Rather than guess per site, walk down until the leaves are
    numeric pairs.
    """
    rings = []

    def descend(node):
        if not isinstance(node, list) or not node:
            return
        head = node[0]
        if (isinstance(head, list) and len(head) >= 2
                and all(isinstance(v, (int, float)) for v in head[:2])):
            rings.append(node)                      # node is a ring of [x, z] points
            return
        for child in node:
            descend(child)

    descend(value)
    return [ring for ring in rings if len(ring) >= 3]


def shoelace(ring):
    total = 0.0
    for i in range(len(ring)):
        x1, z1 = ring[i][0], ring[i][1]
        x2, z2 = ring[(i + 1) % len(ring)][0], ring[(i + 1) % len(ring)][1]
        total += x1 * z2 - x2 * z1
    return abs(total) / 2


def distinct_corners(ring):
    """A stored ring usually repeats its first point to close. Corners are the distinct ones."""
    if len(ring) > 1 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
        return len(ring) - 1
    return len(ring)


# ---------------------------------------------------------------- adapters

def read_identity(docs):
    osm = pick(docs, "OsmContextDerived") or {}
    division = pick(docs, "AuthoritativePropertyDivisionClip") or {}
    subject = division.get("subject") or osm.get("subject") or "UNKNOWN PARCEL"
    return {
        "designation": subject,
        "address": osm.get("subject_address"),
        "kommun": osm.get("kommun"),
        "kommunkod": osm.get("kommunkod"),
    }


def read_boundary(docs):
    doc = pick(docs, "AuthoritativePropertyDivisionClip")
    if not doc:
        return None
    ring = (doc.get("subject_rings_local") or [None])[0]
    if not ring:
        return None
    src = "property division receipt"
    return {
        "area": Figure(round(shoelace(ring), 1), "m²", src, doc.get("evidence_class", "AUTHORITATIVE")),
        "corners": Figure(distinct_corners(ring), "corners", src, doc.get("evidence_class", "AUTHORITATIVE"),
                          note=f"{len(ring)} stored points, ring closed"),
        "context_parcels": Figure(len(doc.get("context_rings_local") or []), "parcels", src, "AUTHORITATIVE"),
        "authority": doc.get("authority"),
        "source_product": doc.get("source_product"),
        "raw_sha256": (doc.get("raw_asset") or {}).get("sha256"),
        "raw_bytes": (doc.get("raw_asset") or {}).get("byte_count"),
        "ring": ring,
        # Context parcels are polygon-nested in both sites' receipts, same as footprints.
        "context_rings": as_rings(doc.get("context_rings_local") or []),
        "limitations": doc.get("limitations") or [],
    }


def read_terrain(docs):
    doc = pick(docs, "DerivedTerrainEvidence", "TerrainHeightDerivation")
    if not doc:
        return None
    src = "terrain DTM receipt"
    out = {"authority": doc.get("authority"), "limitations": doc.get("limitations") or [],
           "verdict": (doc.get("parcel_slope") or {}).get("verdict"), "grid": None, "heightfield": None}

    footprint = doc.get("plot_footprint") or {}
    stats = doc.get("parcel_height_statistics") or {}
    relief = footprint.get("relief_m", stats.get("relief_m"))
    if relief is not None:
        out["relief"] = Figure(relief, "m", src, "DERIVED", note="fall across the parcel · 1 m DTM · RH2000")
    low = footprint.get("min_m", stats.get("min_m"))
    high = footprint.get("max_m", stats.get("max_m"))
    if low is not None and high is not None:
        out["range"] = Figure(f"{low}–{high}", "m", src, "DERIVED", note="RH2000 across the parcel")

    slope = doc.get("slope_aspect_at_pin") or {}
    plane = ((doc.get("parcel_slope") or {}).get("whole_parcel_plane") or {})
    slope_deg = slope.get("slope_deg", plane.get("slope_deg"))
    if slope_deg is not None:
        aspect = slope.get("aspect_compass") or plane.get("aspect_compass") or ""
        out["slope"] = Figure(slope_deg, "°", src, "DERIVED", note=f"slope {aspect}".strip())

    if doc.get("heightfield", {}).get("vertices"):
        out["heightfield"] = doc["heightfield"]
    grid = doc.get("neighbourhood_grid")
    if grid and grid.get("heights_rh2000_m"):
        out["grid"] = grid
    return out


def read_buildings(docs):
    doc = pick(docs, "OfficialBuildingFootprintClip", "AuthoritativeBuildingFootprintClip")
    if not doc:
        return None
    src = "official building footprint receipt"
    counts = doc.get("counts") or {}
    total = doc.get("building_count", counts.get("within_clip_radius"))
    rows = doc.get("buildings") or []
    footprints = []
    for building in rows:
        footprints.extend(as_rings(building.get("footprint_rings_local")
                                   or building.get("rings_local") or []))
    out = {
        "count": Figure(total, "footprints", src, doc.get("footprint_evidence_class", doc.get("evidence_class", "AUTHORITATIVE"))),
        "source_product": doc.get("source_product"),
        "footprints": footprints,
        "limitations": doc.get("limitations") or [],
    }
    if counts.get("on_parcel") is not None:
        out["on_parcel"] = Figure(counts["on_parcel"], "on the parcel", src, "AUTHORITATIVE")
    if doc.get("on_parcel_footprint_area_m2") is not None:
        out["on_parcel_area"] = Figure(doc["on_parcel_footprint_area_m2"], "m²", src, "AUTHORITATIVE",
                                       note="existing footprint area on the parcel")
    return out


def read_shoreline(docs):
    doc = pick(docs, "ShorelineAndStrandskyddDerivation")
    if not doc:
        return None
    src = "shoreline/strandskydd derivation"
    parcel = doc.get("parcel_to_shoreline") or {}
    out = {"bands": [], "gates": doc.get("gate_status") or {}, "limitations": doc.get("limitations") or [],
           "points": doc.get("shoreline_points_local") or []}
    if parcel.get("nearest_m") is not None:
        out["nearest"] = Figure(parcel["nearest_m"], "m", src, "DERIVED", note="parcel to modelled shoreline")
    for band in doc.get("strandskydd_bands") or []:
        out["bands"].append({
            "band_m": band.get("band_m"),
            "legal_basis": band.get("legal_basis"),
            "share": Figure(band.get("parcel_share_inside_percent"), "%", src, "DERIVED",
                            note=f"of the parcel inside the {band.get('band_m')} m band"),
            "area": band.get("parcel_area_inside_m2"),
        })
    return out


def read_view(docs):
    doc = pick(docs, "SeaViewSightlineDerivation")
    if not doc:
        return None
    src = "viewshed derivation"
    result = doc.get("result") or {}
    method = doc.get("method") or {}
    out = {"limitations": doc.get("limitations") or [], "method": method}
    if result.get("sea_view_arc_percent") is not None:
        out["arc_percent"] = Figure(result["sea_view_arc_percent"], "%", src, "DERIVED",
                                    note="of the horizon with open water visible")
    if result.get("nearest_visible_water_m") is not None:
        out["nearest_water"] = Figure(result["nearest_visible_water_m"], "m", src, "DERIVED",
                                      note="to the nearest visible water")
    if result.get("arc_count") is not None:
        out["arc_count"] = Figure(result["arc_count"], "arcs", src, "DERIVED")
    return out


def read_planning(docs):
    doc = pick(docs, "MunicipalPlanningStatusReceiptSet")
    if not doc:
        return None
    return {
        "authority": doc.get("authority"),
        "endpoint": doc.get("service_endpoint"),
        "retrieved_at": doc.get("retrieved_at"),
        "control": doc.get("control_discipline"),
        "layers": doc.get("layers") or [],
        "limitations": doc.get("limitations") or [],
    }


# ---------------------------------------------------------------- checks

def consistency_checks(docs, files, identity, boundary, buildings):
    """Cross-check the receipts against each other and against the archives on disk."""
    problems = []

    subjects = {f["subject"] for f in files if f.get("subject") and f.get("entity_type") != "OsmContextDerived"}
    if len(subjects) > 1:
        problems.append({
            "severity": "CONFLICT",
            "what": "Receipts disagree about which parcel this is",
            "detail": " · ".join(sorted(subjects)),
        })

    kommunkod = identity.get("kommunkod")
    if kommunkod:
        for label, product in (("property division", boundary and boundary.get("source_product")),
                               ("building footprints", buildings and buildings.get("source_product"))):
            if not product:
                continue
            # The kommun code is embedded in the product name (fastighetsindelning_kn0581),
            # so it has to be matched anywhere in the string, not just at a token boundary.
            codes = set(re.findall(r"kn(\d{4})", product))
            if codes and kommunkod not in codes:
                problems.append({
                    "severity": "CONFLICT",
                    "what": f"The {label} receipt names another kommun's source product",
                    "detail": (f"receipt says “{product}”, but this site is {identity.get('kommun')} "
                               f"(kommunkod {kommunkod}). The label is not evidence — see the archive check below."),
                })

    for entry in files:
        sha, size = entry.get("raw_sha256"), entry.get("raw_bytes")
        if not sha:
            continue
        match = None
        if LM_DATA.is_dir():
            for candidate in LM_DATA.glob("*.zip"):
                if size and candidate.stat().st_size != size:
                    continue
                digest = hashlib.sha256()
                with candidate.open("rb") as handle:
                    for chunk in iter(lambda: handle.read(1 << 20), b""):
                        digest.update(chunk)
                if digest.hexdigest() == sha:
                    match = candidate.name
                    break
        entry["archive_match"] = match
        if match:
            problems.append({
                "severity": "VERIFIED",
                "what": f"{entry['file']} raw archive re-hashed on disk",
                "detail": f"sha256 matches {match} byte-for-byte",
            })
        else:
            problems.append({
                "severity": "UNVERIFIABLE",
                "what": f"{entry['file']} raw archive not found locally",
                "detail": f"sha256 {sha[:12]}… could not be re-hashed against {LM_DATA}",
            })
    return problems


# ---------------------------------------------------------------- render

def esc(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def chip(evidence, detail=None):
    label = "REPORTED" if evidence == "REPORTED_UNVERIFIED" else evidence
    text = f"{label} · {detail}" if detail else label
    return f'<span class="ink-chip" data-evidence="{esc(evidence)}">{esc(text)}</span>'


def metric(label, figure):
    if figure is None:
        return ""
    note = f"<small>{esc(figure.note)}</small>" if figure.note else ""
    unit = f" {esc(figure.unit)}" if figure.unit and figure.unit not in ("corners", "parcels", "footprints", "arcs", "on the parcel") else ""
    return (f'<div class="ink-metric"><span>{esc(label)}</span><b>{esc(figure.text())}{unit}</b>'
            f'{note}{chip(figure.evidence, figure.source)}</div>')


def card(tag, title, body, state=None, evidence=None, paper=False):
    cls = "ink-card paper ink-paper-surface" if paper else "ink-card"
    foot = ""
    if state or evidence:
        foot = ('<div class="ink-state-line">'
                + (chip(evidence) if evidence else "")
                + (f"<span>{esc(state)}</span>" if state else "") + "</div>")
    return (f'<article class="{cls}"><div class="ink-tag">{esc(tag)}</div>'
            f'<h3>{esc(title)}</h3><p>{body}</p>{foot}</article>')


def build_page(site_dir, docs, files, out_path):
    identity = read_identity(docs)
    boundary = read_boundary(docs)
    terrain = read_terrain(docs)
    buildings = read_buildings(docs)
    shoreline = read_shoreline(docs)
    view = read_view(docs)
    planning = read_planning(docs)
    problems = consistency_checks(docs, files, identity, boundary, buildings)

    tokens = CHROME_TOKENS.read_text() if CHROME_TOKENS.exists() else ""
    if not tokens:
        print(f"WARNING: Platform chrome tokens not found at {CHROME_TOKENS}; page will be unstyled",
              file=sys.stderr)

    # ---- metrics
    metrics = []
    if boundary:
        metrics.append(metric("Registered boundary", boundary["area"]))
        metrics.append(metric("Boundary corners", boundary["corners"]))
    if terrain and terrain.get("relief"):
        metrics.append(metric("Terrain on the parcel", terrain["relief"]))
    if buildings:
        metrics.append(metric("Official footprints", buildings["count"]))
    if shoreline and shoreline.get("nearest"):
        metrics.append(metric("Parcel to shoreline", shoreline["nearest"]))
    if view and view.get("arc_percent"):
        metrics.append(metric("Open-water arc", view["arc_percent"]))

    # ---- reading cards, only where a receipt exists
    cards = []
    if boundary:
        cards.append(card(
            "Property identity", identity["designation"],
            f"{esc(boundary['authority'] or 'The authority')}'s property division gives this parcel "
            f"<b>{esc(boundary['area'].text())} m²</b> across {esc(boundary['corners'].text())} corners "
            f"({esc(boundary['corners'].note)}), with {esc(boundary['context_parcels'].text())} context "
            f"parcels in the clip.",
            state="Registered geometry is not a set-out survey", evidence=boundary["area"].evidence))
    if terrain:
        verdict = terrain.get("verdict")
        body = ""
        if terrain.get("relief"):
            body += f"The parcel falls <b>{esc(terrain['relief'].text())} m</b>"
            if terrain.get("range"):
                body += f" ({esc(terrain['range'].text())} m RH2000)"
            body += ". "
        if terrain.get("slope"):
            body += f"Plane slope {esc(terrain['slope'].text())}° {esc(terrain['slope'].note or '')}. "
        if verdict:
            body += f"<em>{esc(verdict)}</em>"
        cards.append(card("Ground", "Terrain from the 1 m DTM", body or "Terrain model acquired.",
                          state="Derived from the height model; not a survey", evidence="DERIVED"))
    if shoreline:
        rows = " ".join(
            f"<b>{esc(str(band['share'].value))}%</b> of the parcel lies inside the {esc(str(band['band_m']))} m band."
            for band in shoreline["bands"] if band["share"].value is not None)
        nearest = (f"The modelled shoreline is <b>{esc(shoreline['nearest'].text())} m</b> away. "
                   if shoreline.get("nearest") else "")
        cards.append(card("Water & environment", "Strandskydd reaches this parcel", nearest + rows,
                          state="Shoreline modelled from the DTM — not an authoritative zone overlay",
                          evidence="DERIVED"))
    if view:
        body = ""
        if view.get("arc_percent"):
            body += (f"<b>{esc(view['arc_percent'].text())}%</b> of the horizon has open water visible "
                     f"from the viewpoint")
            if view.get("arc_count"):
                body += f", in {esc(view['arc_count'].text())} separate arcs"
            body += ". "
        if view.get("nearest_water"):
            body += f"Nearest visible water {esc(view['nearest_water'].text())} m. "
        method = view.get("method") or {}
        if method.get("eye_height_m"):
            body += (f"Computed at {esc(str(method['eye_height_m']))} m eye height over "
                     f"{esc(str(method.get('bearing_count', '?')))} bearings, earth curvature "
                     f"{'applied' if method.get('earth_curvature_applied') else 'not applied'}.")
        cards.append(card("View", "Open water, computed not claimed", body,
                          state="A viewshed from the height model — no rendered horizon is a view claim",
                          evidence="DERIVED"))
    if planning:
        verified = [layer for layer in planning["layers"] if layer.get("control")]
        cards.append(card(
            "Planning", "Municipal layers queried",
            f"{len(planning['layers'])} layer(s) queried against {esc(planning['endpoint'] or 'the municipal service')} "
            f"at {esc(planning['retrieved_at'] or 'an unrecorded time')}. "
            f"{esc(planning['control'] or '')}",
            state=f"{len(verified)} layer(s) carry a control query", evidence="AUTHORITATIVE", paper=True))

    # ---- problems banner
    conflicts = [p for p in problems if p["severity"] == "CONFLICT"]
    banner = ""
    if conflicts:
        items = "".join(f"<li><b>{esc(p['what'])}</b><br>{esc(p['detail'])}</li>" for p in conflicts)
        banner = f'<div class="conflict"><div class="ink-kicker">Provenance conflict</div><ul>{items}</ul></div>'

    # ---- receipts table
    rows = []
    for entry in sorted(files, key=lambda e: e["file"]):
        match = entry.get("archive_match")
        if entry.get("raw_sha256"):
            state = (f'<span class="ok">re-hashed · {esc(match)}</span>' if match
                     else '<span class="warn">archive not on disk</span>')
        else:
            state = '<span class="dim">no raw archive</span>'
        rows.append(
            f"<tr><td>{esc(entry['file'])}</td><td>{esc(entry.get('entity_type') or '—')}</td>"
            f"<td>{chip(entry['evidence_class']) if entry.get('evidence_class') in EVIDENCE_ORDER else '—'}</td>"
            f"<td class='mono'>{esc((entry.get('derived_sha256') or entry.get('raw_sha256') or '')[:12]) or '—'}</td>"
            f"<td>{state}</td></tr>")

    # ---- twin payload
    twin = {
        "designation": identity["designation"],
        "boundary": boundary["ring"] if boundary else None,
        "context": (boundary["context_rings"] if boundary else [])[:120],
        "buildings": (buildings["footprints"] if buildings else [])[:400],
        "shoreline": (shoreline["points"] if shoreline else [])[:4000],
        "terrain": None,
    }
    if terrain and terrain.get("grid"):
        grid = terrain["grid"]
        twin["terrain"] = {"kind": "grid", "x": grid["x"], "z": grid["z"], "h": grid["heights_rh2000_m"]}
    elif terrain and terrain.get("heightfield"):
        field = terrain["heightfield"]
        twin["terrain"] = {"kind": "field", "size_m": field.get("size_m"),
                           "segments": field.get("segments"), "vertices": field.get("vertices")}

    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    title = identity.get("address") or identity["designation"]

    html = f"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} — site intelligence</title>
<style>
{tokens}
html,body{{margin:0;background:var(--ink-bg)}}
.screen{{display:none}} .screen.active{{display:block}}
.hero{{padding:56px var(--ink-gutter) 28px;border-bottom:1px solid var(--ink-line)}}
.hero h1{{font:500 clamp(38px,6vw,76px)/.95 var(--ink-serif);letter-spacing:-.04em;margin:12px 0 14px}}
.hero p{{max-width:720px;font-size:14px;line-height:1.6;color:var(--ink-text-dim);margin:0}}
.conflict{{margin:18px 0 0;padding:16px 18px;border:1px solid var(--ink-reported);
  border-radius:var(--ink-radius);background:rgba(166,91,104,.12)}}
.conflict ul{{margin:8px 0 0;padding-left:18px;font-size:11px;line-height:1.65}}
table{{width:100%;border-collapse:collapse;font-size:10px}}
th,td{{text-align:left;padding:9px 10px;border-bottom:1px solid var(--ink-line);vertical-align:top}}
th{{font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-bronze)}}
.mono{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}}
.ok{{color:#3ec79d}} .warn{{color:#e6b45c}} .dim{{color:var(--ink-text-faint)}}
#stage{{width:100%;height:76vh;display:block;background:#0d1512}}
.stagenote{{padding:12px var(--ink-gutter) 60px;font-size:9px;letter-spacing:.06em;color:var(--ink-text-faint)}}
.foot{{padding:26px var(--ink-gutter) 60px;font-size:9px;letter-spacing:.06em;color:var(--ink-text-faint)}}
</style>
<div class="ink">
  <header class="ink-topbar">
    <div class="ink-topbar-id">
      <span class="ink-kicker">PLOT-TO-PROJECT · SITE INTELLIGENCE</span>
      <b>{esc(identity['designation'])}{' · ' + esc(identity['kommun']) if identity.get('kommun') else ''}</b>
    </div>
    <nav class="ink-modes" aria-label="Screens">
      <button class="ink-mode" type="button" data-screen="report" aria-pressed="true">Site intelligence</button>
      <button class="ink-mode" type="button" data-screen="twin" aria-pressed="false">Spatial lab</button>
    </nav>
  </header>

  <section class="screen active" id="screen-report">
    <div class="hero">
      <span class="ink-kicker">{esc(identity.get('address') or identity['designation'])}</span>
      <h1>Know the land<br>before designing.</h1>
      <p>A source-bound reading of this parcel. Every figure below carries the receipt it came from,
         and anything without one is absent rather than estimated.</p>
      {banner}
    </div>
    <div class="ink-body">
      <section class="ink-section">{''.join(['<section class="ink-metrics">'] + metrics + ['</section>'])}</section>
      <section class="ink-section">
        <div class="ink-section-head"><h2>What is established</h2>
          <p>Evidence findings, not sales copy. Each keeps its source class, method and limitations.</p></div>
        <div class="ink-cards">{''.join(cards)}</div>
      </section>
      <section class="ink-section">
        <div class="ink-section-head"><h2>Receipts</h2>
          <p>Every file this page was built from. Where the raw archive is on disk it is re-hashed here,
             so provenance is checked rather than asserted.</p></div>
        <table><thead><tr><th>File</th><th>Entity</th><th>Class</th><th>sha256</th><th>Archive check</th></tr></thead>
        <tbody>{''.join(rows)}</tbody></table>
      </section>
    </div>
  </section>

  <section class="screen" id="screen-twin">
    <canvas id="stage"></canvas>
    <div class="stagenote" id="stagenote">Loading twin…</div>
  </section>

  <div class="foot">GENERATED {esc(generated)} · python3 scripts/build-site.py {esc(str(site_dir))}
    · EVERY FIGURE COMPUTED FROM A RECEIPT IN THAT DIRECTORY</div>
</div>

<script type="importmap">{{"imports":{{"three":"https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js",
"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/"}}}}</script>
<script>
for (const button of document.querySelectorAll(".ink-mode")) {{
  button.addEventListener("click", () => {{
    for (const other of document.querySelectorAll(".ink-mode"))
      other.setAttribute("aria-pressed", String(other === button));
    for (const screen of document.querySelectorAll(".screen"))
      screen.classList.toggle("active", screen.id === "screen-" + button.dataset.screen);
    window.dispatchEvent(new Event("resize"));
  }});
}}
</script>
<script type="module">
import * as THREE from "three";
import {{OrbitControls}} from "three/addons/controls/OrbitControls.js";

const DATA = {json.dumps(twin)};
const note = document.getElementById("stagenote");
const canvas = document.getElementById("stage");
// preserveDrawingBuffer keeps the frame readable after render, so the twin can be captured
// with canvas.toDataURL() for a committed screenshot.
const renderer = new THREE.WebGLRenderer({{canvas, antialias: true, preserveDrawingBuffer: true}});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1512);
scene.fog = new THREE.Fog(0x0d1512, 220, 900);
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 4000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;   // never below the horizon: no backstage view

// x=EAST, z=NORTH viewed from +y is left-handed, i.e. mirrored. Flip the content group once.
const world = new THREE.Group();
world.scale.x = -1;
scene.add(world);

scene.add(new THREE.HemisphereLight(0xdfe8ef, 0x2b3a33, 1.05));
const sun = new THREE.DirectionalLight(0xffe9c8, 1.5);
sun.position.set(-120, 180, 90);
scene.add(sun);

let groundY = 0;
const counts = {{terrain: 0, context: 0, buildings: 0, shoreline: 0}};

// ---- terrain
if (DATA.terrain?.kind === "grid") {{
  const {{x, z, h}} = DATA.terrain;
  // The axes are not guaranteed ascending — Djurö's z runs north-to-south — so the plane is
  // built from absolute spans and the rows are read in the axis's own direction.
  const geometry = new THREE.PlaneGeometry(
    Math.abs(x[x.length - 1] - x[0]), Math.abs(z[z.length - 1] - z[0]),
    x.length - 1, z.length - 1);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const zAscending = z[z.length - 1] >= z[0];
  const xAscending = x[x.length - 1] >= x[0];
  let i = 0;
  for (let row = 0; row < z.length; row++) {{
    const sourceRow = zAscending ? row : z.length - 1 - row;
    for (let col = 0; col < x.length; col++) {{
      const sourceCol = xAscending ? col : x.length - 1 - col;
      const height = h[sourceRow]?.[sourceCol];
      position.setY(i++, Number.isFinite(height) ? height : 0);
    }}
  }}
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({{color: 0x53614f, roughness: 1}}));
  mesh.position.set((x[0] + x[x.length - 1]) / 2, 0, (z[0] + z[z.length - 1]) / 2);
  world.add(mesh);
  counts.terrain = x.length * z.length;
  groundY = h[Math.floor(z.length / 2)][Math.floor(x.length / 2)] ?? 0;
}} else if (DATA.terrain?.kind === "field") {{
  const {{size_m, segments, vertices}} = DATA.terrain;
  const geometry = new THREE.PlaneGeometry(size_m, size_m, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count && i < vertices.length; i++) position.setY(i, vertices[i][1]);
  geometry.computeVertexNormals();
  world.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({{color: 0x53614f, roughness: 1}})));
  counts.terrain = vertices.length;
  groundY = vertices[Math.floor(vertices.length / 2)]?.[1] ?? 0;
}} else {{
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({{color: 0x3f4b3f, roughness: 1}}));
  plane.rotateX(-Math.PI / 2);
  world.add(plane);
}}

function ringLine(ring, color, lift, width) {{
  const points = ring.map(p => new THREE.Vector3(p[0], groundY + lift, p[1]));
  if (points.length) points.push(points[0].clone());
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({{color, linewidth: width ?? 1}}));
  world.add(line);
  return line;
}}

for (const ring of DATA.context ?? []) {{ ringLine(ring, 0x46584f, 0.4); counts.context++; }}

// Official footprints, extruded to a nominal height: the FOOTPRINT is authoritative,
// the height is not, so they render as flat slabs rather than pretending to be massing.
for (const ring of DATA.buildings ?? []) {{
  const shape = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], p[1])));
  const geometry = new THREE.ExtrudeGeometry(shape, {{depth: 3.2, bevelEnabled: false}});
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({{color: 0x7d8a84, roughness: .9}}));
  mesh.position.y = groundY + 0.5;
  world.add(mesh);
  counts.buildings++;
}}

if (DATA.shoreline?.length) {{
  const geometry = new THREE.BufferGeometry().setFromPoints(
    DATA.shoreline.map(p => new THREE.Vector3(p[0], groundY + 0.3, p[1])));
  world.add(new THREE.Points(geometry, new THREE.PointsMaterial({{color: 0x497aa2, size: 1.6}})));
  counts.shoreline = DATA.shoreline.length;
}}

// The subject parcel last, on top, in the authoritative colour.
let centre = new THREE.Vector3(0, groundY, 0);
let radius = 90;
if (DATA.boundary) {{
  ringLine(DATA.boundary, 0x176b52, 1.2, 3);
  ringLine(DATA.boundary, 0xffcf6a, 1.6, 2);
  const box = new THREE.Box3();
  for (const p of DATA.boundary) box.expandByPoint(new THREE.Vector3(p[0], groundY, p[1]));
  centre = box.getCenter(new THREE.Vector3());
  radius = Math.max(box.getSize(new THREE.Vector3()).length(), 40);
}}

// Camera framed from the subject's own bounding box — derived, never typed.
camera.position.set(centre.x + radius * 0.9, groundY + radius * 0.85, centre.z + radius * 1.25);
controls.target.copy(centre);

function resize() {{
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = canvas.clientHeight || Math.round(innerHeight * 0.76);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}}
addEventListener("resize", resize);
resize();

note.textContent = `${{DATA.designation}} · terrain ${{counts.terrain}} samples · `
  + `${{counts.buildings}} official footprints · ${{counts.context}} context parcels`
  + (counts.shoreline ? ` · ${{counts.shoreline}} shoreline points` : "")
  + " · AUTHORITATIVE boundary + footprints · terrain DERIVED · building heights NOT established";

renderer.setAnimationLoop(() => {{ controls.update(); renderer.render(scene, camera); }});
</script>
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html)

    return {
        "identity": identity, "boundary": boundary, "terrain": terrain, "buildings": buildings,
        "shoreline": shoreline, "view": view, "planning": planning,
        "problems": problems, "metrics": len(metrics), "cards": len(cards), "twin": twin,
    }


def main():
    parser = argparse.ArgumentParser(description="Build a site page from a plot's derived receipts.")
    parser.add_argument("site_dir", type=pathlib.Path)
    parser.add_argument("--out", type=pathlib.Path, default=None)
    args = parser.parse_args()

    site_dir = args.site_dir.resolve()
    if not site_dir.is_dir():
        sys.exit(f"no such site directory: {site_dir}")

    docs, files = load_site(site_dir)
    if not docs:
        sys.exit(f"no readable receipts in {site_dir}")

    out_path = args.out or (REPO / "dist" / "sites" / site_dir.name / "index.html")
    facts = build_page(site_dir, docs, files, out_path)

    identity = facts["identity"]
    print(f"wrote {out_path}")
    print(f"  parcel        {identity['designation']}"
          + (f" · {identity['address']}" if identity.get("address") else "")
          + (f" · {identity['kommun']} ({identity['kommunkod']})" if identity.get("kommun") else ""))
    print(f"  receipts      {len(files)} files · {len(docs)} entity types")
    if facts["boundary"]:
        b = facts["boundary"]
        print(f"  boundary      {b['area'].text()} m² · {b['corners'].text()} corners "
              f"({b['corners'].note}) · {b['context_parcels'].text()} context parcels")
    if facts["terrain"] and facts["terrain"].get("relief"):
        t = facts["terrain"]
        slope = f" · slope {t['slope'].text()}°" if t.get("slope") else ""
        print(f"  terrain       {t['relief'].text()} m fall{slope}")
    if facts["buildings"]:
        extra = f" · {facts['buildings']['on_parcel'].text()} on the parcel" if facts["buildings"].get("on_parcel") else ""
        print(f"  buildings     {facts['buildings']['count'].text()} official footprints{extra}")
    if facts["shoreline"] and facts["shoreline"].get("nearest"):
        print(f"  shoreline     {facts['shoreline']['nearest'].text()} m to modelled shoreline")
    if facts["view"] and facts["view"].get("arc_percent"):
        print(f"  viewshed      {facts['view']['arc_percent'].text()}% open-water arc")
    print(f"  rendered      {facts['metrics']} metrics · {facts['cards']} evidence cards")

    verified = [p for p in facts["problems"] if p["severity"] == "VERIFIED"]
    unverifiable = [p for p in facts["problems"] if p["severity"] == "UNVERIFIABLE"]
    conflicts = [p for p in facts["problems"] if p["severity"] == "CONFLICT"]
    print(f"  archive check {len(verified)} re-hashed · {len(unverifiable)} not on disk")
    for problem in conflicts:
        print(f"  CONFLICT      {problem['what']}\n                {problem['detail']}")
    return 1 if conflicts else 0


if __name__ == "__main__":
    sys.exit(main())
