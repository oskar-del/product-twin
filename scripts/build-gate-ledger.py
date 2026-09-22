#!/usr/bin/env python3
"""
Regenerate a site's gate ledger against the CANONICAL registry.

    python3 scripts/build-gate-ledger.py --site data/sites/sweden/saterdalsvagen-14

Two generators exist and neither is wrong: repo-djuro's build-findings-and-gates.py derives
findings and eleven gates straight from the receipts, and Svärtinge's plot-intelligence record
carries eighteen gates covering entitlement, access, utilities and clearance that no derivation
answers yet. Running the generic generator alone on Svärtinge would silently drop seven gates —
a site would appear to have fewer unanswered questions because we changed tools.

So this script reconciles rather than replaces:

  1. it runs the generic generator (read-only use of repo-djuro's file) for its findings and
     its receipt-derived closures;
  2. it evaluates the registry's own closure rules for gates the generic set does not cover;
  3. it carries forward a legacy SATISFIED gate only when nothing newer speaks to it;
  4. every remaining registry gate is emitted OPEN with a reason saying why — never dropped.

A gate is only ever closed by a receipt that answers the question the registry states. Where
Brain asked for a closure the evidence does not support, the gate stays open and says so.
"""
import argparse, json, pathlib, re, subprocess, sys
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config/gate-registry.json"
GENERIC = ROOT.parent / "repo-djuro/scripts/build-findings-and-gates.py"
SATISFIED = {"CLOSED", "SATISFIED"}


def load(path):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return None


def receipts_by_entity(site):
    docs = {}
    for path in sorted(site.glob("*.json")):
        doc = load(path)
        if isinstance(doc, dict) and doc.get("entity_type"):
            docs.setdefault(doc["entity_type"], (doc, path.name))
    return docs


def run_generic(site):
    """Run the generic generator in place. Returns (findings, gates) or (None, None)."""
    if not GENERIC.exists():
        print(f"  note: generic generator not found at {GENERIC}; registry rules only",
              file=sys.stderr)
        return None, None
    try:
        result = subprocess.run(
            [sys.executable, str(GENERIC), "--site", str(site.resolve())],
            capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"  note: generic generator did not run ({exc}); registry rules only", file=sys.stderr)
        return None, None
    if result.returncode != 0:
        print(f"  note: generic generator exited {result.returncode}; registry rules only",
              file=sys.stderr)
        if result.stderr.strip():
            print("        " + result.stderr.strip().splitlines()[-1], file=sys.stderr)
        return None, None
    return load(site / "findings.json"), load(site / "gates.json")


def dig(doc, path):
    node = doc
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def evaluate_condition_rule(rule, docs):
    """
    A designer's own stated condition, evaluated against a measurement.

    The threshold is parsed out of the condition TEXT rather than typed into the registry: the
    designer owns the condition, we own the measurement, and neither should be able to drift
    from the other silently. A condition that stops parsing fails the gate open with a reason —
    it never falls back to a remembered number.
    """
    src = rule["condition_from"]
    scene = docs.get(src["entity_type"])
    if not scene:
        # NOT APPLICABLE, not OPEN. A gate asks whether a designer's stated condition is met;
        # where no design exists there is no condition, and reporting it as an open question
        # tells a reader this plot has an unanswered question it does not have. Keyed on the
        # ABSENCE OF THE RECEIPT, never on the site — a "site == djuro" rule would be a site
        # literal inside a generic registry, which is the kn0581 bug class exactly, and it would
        # go stale the day that plot gets a designer. Djurö's framing.
        return "NOT_APPLICABLE", (f"No {src['entity_type']} carrying {src['path']} exists for this "
                                  f"site, so there is no designer-stated condition to test. This "
                                  f"becomes an open question the moment a design lands."), []
    scene_doc, scene_file = scene
    entries = dig(scene_doc, src["path"]) or []
    entry = next((e for e in entries if e.get("id") == src["match_id"]), None)
    if not entry:
        return False, (f"{src['match_id']} is not in {src['path']} of {scene_file}: the designer "
                       f"states no such condition"), []
    text = str(entry.get(src["field"]) or "")
    # Every number-with-unit, not the first: "between 2,5 m and 4 m" has two thresholds and no
    # single answer, so taking the first would quietly pick one and call the gate decided.
    numbers = re.findall(r"(-?\d+(?:[.,]\d+)?)\s*m\b", text)
    if not numbers:
        return False, (f"the condition could not be read as a number: \"{text}\". The gate stays "
                       f"open rather than assuming a threshold."), []
    if len(numbers) > 1:
        return False, (f"condition ambiguous: \"{text}\" states {len(numbers)} measurements "
                       f"({', '.join(numbers)} m) and this gate compares one. It stays open rather "
                       f"than choosing which the designer meant."), []
    threshold = float(numbers[0].replace(",", "."))

    meas = rule["measurement_from"]
    names = meas["entity_type"] if isinstance(meas["entity_type"], list) else [meas["entity_type"]]
    value = measured_file = None
    label = meas["label"]
    caveat = ""
    for name in names:
        if name not in docs:
            continue
        doc, filename = docs[name]
        measured_file = filename
        # Prefer the measurement that answers the question actually asked — but only when its
        # own guard says it is resolved finely enough to mean anything. A coarse interpolation
        # of the right quantity is not better than a precise measurement of the wrong one; it
        # just hides the mismatch instead of showing it.
        if meas.get("prefer_path") and dig(doc, meas["prefer_guard"]) is True:
            value = dig(doc, meas["prefer_path"])
            label = meas.get("prefer_label", label)
        if value is None:
            value = dig(doc, meas["path"])
            if value is None and meas.get("fallback_path"):
                value = dig(doc, meas["fallback_path"])
            if value is not None and meas.get("fallback_note"):
                caveat = f" NOTE: {meas['fallback_note']}."
                preferred = dig(doc, meas["prefer_path"]) if meas.get("prefer_path") else None
                if preferred is not None:
                    caveat += (f" The footprint figure interpolates to {preferred} m but its "
                               f"sampling is coarser than the footprint, so it is not used.")
        if value is not None:
            break
    if value is None:
        return False, f"no measurement for {meas['path']} in {' or '.join(names)}", []

    ok = float(value) >= threshold if rule.get("operator", ">=") == ">=" else float(value) <= threshold
    verdict = "holds" if ok else "does NOT hold"
    reason = (f"The designer's condition is \"{text}\" ({scene_file}). The {label} measures "
              f"{value} m ({measured_file}), so the condition {verdict}: "
              f"{value} {rule.get('operator','>=')} {threshold}.{caveat}")
    return ok, reason, [scene_file, measured_file]


def evaluate_rule(rule, docs):
    if "condition_from" in rule:
        return evaluate_condition_rule(rule, docs)
    """Registry closure rule → (closed, reason, evidence_refs)."""
    wanted = rule["entity_type"]
    names = [wanted] if isinstance(wanted, str) else list(wanted)
    for name in names:
        if name in docs:
            doc, filename = docs[name]
            missing = [f for f in rule.get("requires_fields", []) if not doc.get(f)]
            if missing:
                return False, f"field not present in {name}: {', '.join(missing)}", []
            pattern = rule.get("requires_pattern")
            matched = None
            if pattern:
                value = str(doc.get(pattern["field"]) or "")
                found = re.search(pattern["regex"], value)
                if not found:
                    return False, (f"field {pattern['field']} in {name} does not carry "
                                   f"{pattern['regex']}: {value!r}"), []
                matched = found.group(0)
            reason = f"Answered by {filename} ({name})."
            if matched:
                reason += f" {pattern['means']} Here: {matched}."
            if rule.get("still_not_established"):
                reason += " " + rule["still_not_established"]
            return True, reason, [filename]
    return False, f"receipt not present: {' or '.join(names)}", []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    args = ap.parse_args()
    site = pathlib.Path(args.site)
    site = site if site.is_absolute() else ROOT / site
    if not site.is_dir():
        sys.exit(f"no such site directory: {site}")

    registry = load(REGISTRY)
    if not registry:
        sys.exit(f"cannot read the gate registry at {REGISTRY}")

    docs = receipts_by_entity(site)
    findings_doc, generic_gates_doc = run_generic(site)

    generic = {}
    for gate in (generic_gates_doc or {}).get("gates", []):
        generic[gate["gate_id"]] = gate

    legacy = {}
    intelligence = load(site / "plot-intelligence-v0.1.json")
    for gate in (intelligence or {}).get("gates", []):
        legacy[gate["gate_id"]] = gate

    subject = next((d.get("subject") for d, _ in docs.values() if isinstance(d.get("subject"), str)), None)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    gates, sources = [], {"generic": 0, "registry_rule": 0, "legacy": 0, "open_no_derivation": 0}
    for entry in registry["gates"]:
        gate_id = entry["gate_id"]
        ids = [gate_id] + entry.get("aliases", [])

        hit = next((generic[i] for i in ids if i in generic), None)
        if hit:
            closed = str(hit.get("status", "")).upper() in SATISFIED
            # The generic generator indexes receipts by the entity_type names IT knows. Svärtinge
            # records the same evidence under different names (DerivedTerrainEvidence rather than
            # TerrainHeightDerivation; OfficialBuildingFootprintClip rather than
            # AuthoritativeBuildingFootprintClip), so it reports "receipt not present" for
            # evidence this site demonstrably holds. Where the registry rule recognises the
            # site's own name and closes, the rule wins — a gate must not stay open because two
            # pipelines disagree about a label.
            if not closed and "closes_when" in entry:
                rule_closed, rule_reason, rule_refs = evaluate_rule(entry["closes_when"], docs)
                if rule_closed:
                    gates.append({"gate_id": gate_id, "status": "CLOSED",
                                  "question": entry["question"], "domain": entry["domain"],
                                  "evidence_refs": rule_refs, "decided_at": now,
                                  "reason": rule_reason + " The generic generator did not "
                                            "recognise this site's receipt name.",
                                  "decided_by": "registry rule over generic"})
                    sources["registry_rule"] += 1
                    continue
            record = {"gate_id": gate_id, "status": "CLOSED" if closed else "OPEN",
                      "question": entry["question"], "domain": entry["domain"],
                      "evidence_refs": hit.get("evidence_refs", []),
                      "decided_at": now if closed else None,
                      "reason": hit.get("reason", ""), "decided_by": "generic generator"}
            sources["generic"] += 1
            gates.append(record)
            continue

        if "closes_when" in entry:
            closed, reason, refs = evaluate_rule(entry["closes_when"], docs)
            status = closed if isinstance(closed, str) else ("CLOSED" if closed else "OPEN")
            gates.append({"gate_id": gate_id, "status": status,
                          "question": entry["question"], "domain": entry["domain"],
                          "evidence_refs": refs,
                          "decided_at": now if status == "CLOSED" else None,
                          "reason": reason, "decided_by": "registry rule"})
            sources["registry_rule"] += 1
            continue

        old = next((legacy[i] for i in ids if i in legacy), None)
        if old and str(old.get("status", "")).upper() in SATISFIED:
            gates.append({"gate_id": gate_id, "status": "CLOSED",
                          "question": entry["question"], "domain": entry["domain"],
                          "evidence_refs": old.get("evidence_refs", []),
                          "decided_at": old.get("decided_at"),
                          "reason": old.get("reason", ""),
                          "decided_by": "carried forward from plot-intelligence"})
            sources["legacy"] += 1
            continue

        reason = (old.get("reason") if old else None) or (
            "No derivation at this site answers this gate yet." if entry.get("note") is None
            else entry["note"])
        if entry.get("note"):
            reason = f"{reason} {entry['note']}" if old else entry["note"]
        gates.append({"gate_id": gate_id, "status": "OPEN", "question": entry["question"],
                      "domain": entry["domain"], "evidence_refs": [], "decided_at": None,
                      "reason": reason, "decided_by": "registry default"})
        sources["open_no_derivation"] += 1

    closed = [g for g in gates if g["status"] == "CLOSED"]
    not_applicable = [g for g in gates if g["status"] == "NOT_APPLICABLE"]
    payload = {
        "schema_version": "site-gates/v0.2",
        "entity_type": "SiteGateSet",
        "subject": subject,
        "site": site.name,
        "generated_at": now,
        "generator": "scripts/build-gate-ledger.py",
        "registry": "config/gate-registry.json",
        "rule": ("Every gate in the canonical registry is emitted for every site. A gate a site "
                 "cannot answer is OPEN with a reason, never dropped."),
        "gate_count": len(gates),
        "closed": len(closed),
        "open": len(gates) - len(closed) - len(not_applicable),
        "not_applicable": len(not_applicable),
        "decided_by_counts": sources,
        "receipts_absent": (generic_gates_doc or {}).get("receipts_absent"),
        "fields_absent": (generic_gates_doc or {}).get("fields_absent"),
        "gates": gates,
    }
    (site / "gates.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")

    print(f"wrote {site / 'gates.json'}")
    print(f"  subject       {subject}")
    print(f"  registry      {len(registry['gates'])} canonical gates")
    print(f"  result        {len(closed)} closed / {len(gates) - len(closed) - len(not_applicable)} open"
          + (f" / {len(not_applicable)} not applicable" if not_applicable else ""))
    print(f"  decided by    generic {sources['generic']} · registry rule {sources['registry_rule']}"
          f" · carried forward {sources['legacy']} · open by default {sources['open_no_derivation']}")
    if findings_doc:
        print(f"  findings      {len(findings_doc.get('findings', []))} (from the generic generator)")
    for gate in closed:
        print(f"    CLOSED  {gate['gate_id']}")

    if intelligence:
        before = {g["gate_id"] for g in intelligence.get("gates", [])}
        dropped = before - {g["gate_id"] for g in gates}
        if dropped:
            sys.exit(f"REFUSING: regeneration would drop {len(dropped)} gate(s): {sorted(dropped)}")
        print(f"  superset      all {len(before)} plot-intelligence gates retained")


if __name__ == "__main__":
    main()
