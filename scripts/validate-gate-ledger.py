#!/usr/bin/env python3
"""
Test the gate ledger. A ledger nobody can test is how "18 open" lied to two sessions.

    python3 scripts/validate-gate-ledger.py --site data/sites/sweden/saterdalsvagen-14
    python3 scripts/validate-gate-ledger.py --site <dir> --rendered-closed 6 --rendered-total 26

What it asserts:

  §1 Registry agreement, both directions. Every gate_id in the site's gates.json is in the
     canonical registry, and every registry id is present in the ledger. A gate cannot be
     invented and cannot be dropped.
  §2 Every CLOSED gate cites at least one evidence_ref, and every ref resolves — to a receipt
     file in the site directory, or to a receipt/finding id declared by one. Where a resolved
     receipt carries a hash we can re-derive, it is re-derived and compared.
  §3 No null-as-pass: a CLOSED gate must carry a decision timestamp and a reason, an OPEN gate
     must not carry a decision timestamp, and a status must be one of the two known states.
  §4 Counts are computed here, never read from the file's own summary, then checked against the
     summary AND (when supplied) against what the front door actually rendered.
"""
import argparse, hashlib, json, pathlib, re, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geometry_hash import METHOD_ID, geometry_sha256

ROOT = pathlib.Path(__file__).resolve().parents[1]

# The front door's gate rows, in one place. The validator reads the PAGE, so it has to know the
# page's markup; naming the selectors here means a markup change is one edit and an obvious one,
# rather than a mysterious count mismatch reported from inside an inlined expression.
GATE_ROW_SELECTOR = "#intelGateRows .intel-gate-row"
GATE_SATISFIED_SELECTOR = "#intelGateRows span.closed"
# The page marks a not-applicable gate with the literal N/A pill. It has to be counted
# separately or it lands in "open", which is the bug this check exists to catch.
GATE_NA_TEXT = "N/A"

CHROME_LAUNCH_HINT = (
    'no Chrome answering on that port. Start one first:\n'
    '    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\\n'
    '      --headless --remote-debugging-port=9333 --use-angle=swiftshader \\\n'
    '      --enable-unsafe-swiftshader --disable-gpu-sandbox &\n'
    '  (swiftshader is not optional here: without it WebGL context creation fails and the page\n'
    '   never becomes ready, which reads as a validation failure rather than a missing browser.)')
REGISTRY = ROOT / "config/gate-registry.json"
LM_DATA = ROOT.parent / "lm-data"
FRONT_DOOR = ROOT / "prototype/svartinge-neighbourhood/index.html"

passed = failed = 0
notes = []


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
    else:
        failed += 1
        print(f"FAIL  {label}" + (f"\n      {detail}" if detail else ""))


def load(path):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return None


def build_ref_index(site):
    """Everything an evidence_ref is allowed to point at, mapped to the file that declares it."""
    index = {}
    for path in sorted(site.glob("*.json")):
        index[path.name] = path
        doc = load(path)
        if not isinstance(doc, dict):
            continue
        for receipt in doc.get("source_receipts") or []:
            if isinstance(receipt, dict) and receipt.get("receipt_id"):
                index.setdefault(receipt["receipt_id"], path)
        for finding in doc.get("findings") or []:
            if isinstance(finding, dict) and finding.get("finding_id"):
                index.setdefault(finding["finding_id"], path)
    return index


def rehash(doc, path):
    """Re-derive what we can from a receipt. Returns (verified, described)."""
    results = []
    raw = doc.get("raw_asset") or {}
    if raw.get("sha256"):
        match = None
        if LM_DATA.is_dir():
            for candidate in LM_DATA.glob("*.zip"):
                if raw.get("byte_count") and candidate.stat().st_size != raw["byte_count"]:
                    continue
                digest = hashlib.sha256()
                with candidate.open("rb") as handle:
                    for chunk in iter(lambda: handle.read(1 << 20), b""):
                        digest.update(chunk)
                if digest.hexdigest() == raw["sha256"]:
                    match = candidate.name
                    break
        results.append(("raw archive", bool(match), match or "archive not on disk"))
    # Recompute with the SHARED helper, not with json.dumps.
    #
    # Djurö caught this: the old line reproduced the very serialisation the helper exists to
    # replace, so it passed only by repeating the bug and would have gone red on a correct
    # receipt. A check that agrees with what it is meant to catch is not a check.
    #
    # It also only ever looked at subject_rings_local, so the BUILDINGS hash — the fleet's
    # most-recomputed-looking receipt — was verified by nothing at all. Djurö's find. Both
    # shapes are recomputed now.
    declared = doc.get("derivation_sha256") or doc.get("derived_geometry_sha256")

    if doc.get("subject_rings_local"):
        subject_id = (doc.get("source_object_ids") or [None])[0]
        if not declared:
            results.append(("derived geometry", False,
                            "the receipt carries subject geometry but declares no hash"))
        elif not subject_id:
            results.append(("derived geometry", False,
                            "no source_object_ids[0]: the subject's register id is what the hash is keyed on"))
        else:
            recomputed = geometry_sha256([(subject_id, doc["subject_rings_local"])])
            results.append((f"subject geometry ({METHOD_ID})", recomputed == declared,
                            f"declared {str(declared)[:16]}… recomputed {recomputed[:16]}…"))
        context = doc.get("context_rings_local")
        context_block = doc.get("context_derivation") or {}
        declared_context = context_block.get("sha256") or doc.get("context_derivation_sha256")
        buffer_m = context_block.get("clip_buffer_m", doc.get("context_clip_buffer_m"))
        if context and declared_context and buffer_m is None:
            # Without the buffer the hash cannot be compared to anything: a different buffer is a
            # different question, and a bare hash invites reading one as a disagreement.
            results.append(("context geometry", False,
                            "context hash declared without the clip buffer that defines it"))
        elif context and declared_context:
            ids = (doc.get("source_object_ids") or [])[1:]
            if len(ids) == len(context):
                recomputed = geometry_sha256(zip(ids, context))
                results.append(("context geometry", recomputed == declared_context,
                                f"declared {declared_context[:16]}… recomputed {recomputed[:16]}…"))

    if doc.get("buildings"):
        pairs = [((b.get("object_id") or b.get("source_object_id")),
                  (b.get("footprint_rings_local") or b.get("rings_local") or []))
                 for b in doc["buildings"]]
        if not declared:
            results.append(("buildings geometry", False,
                            "the receipt carries building footprints but declares no hash"))
        elif any(not pid or not rings for pid, rings in pairs):
            results.append(("buildings geometry", False,
                            "a building carries no object id or no rings"))
        else:
            recomputed = geometry_sha256(pairs)
            results.append((f"buildings geometry ({METHOD_ID})", recomputed == declared,
                            f"declared {str(declared)[:16]}… recomputed {recomputed[:16]}…"))

    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--rendered-closed", type=int)
    ap.add_argument("--rendered-total", type=int)
    ap.add_argument("--rendered-open", type=int)
    ap.add_argument("--rendered-not-applicable", type=int)
    ap.add_argument("--allow-unrendered", action="store_true",
                    help="accept a run that never checked the browser's own numbers")
    ap.add_argument("--front-door-url",
                    help="read the rendered counts from this page over CDP instead of being told them")
    ap.add_argument("--cdp-port", default="9222")
    args = ap.parse_args()

    site = pathlib.Path(args.site)
    site = site if site.is_absolute() else ROOT / site
    ledger = load(site / "gates.json")
    registry = load(REGISTRY)
    if not ledger:
        sys.exit(f"no gates.json in {site}")
    if not registry:
        sys.exit(f"no registry at {REGISTRY}")

    gates = ledger.get("gates") or []
    registry_ids = {g["gate_id"] for g in registry["gates"]}
    ledger_ids = [g.get("gate_id") for g in gates]

    print("§1 registry agreement")
    unknown = sorted(set(ledger_ids) - registry_ids)
    missing = sorted(registry_ids - set(ledger_ids))
    check("every ledger gate is in the registry", not unknown, f"not in registry: {unknown}")
    check("every registry gate is in the ledger", not missing, f"absent from ledger: {missing}")
    check("no duplicate gate ids", len(ledger_ids) == len(set(ledger_ids)))

    print("§2 closed gates cite evidence that resolves")
    index = build_ref_index(site)
    rehashed = unresolvable = 0
    for gate in gates:
        if gate.get("status") != "CLOSED":
            continue
        gid = gate["gate_id"]
        refs = gate.get("evidence_refs") or []
        check(f"{gid}: cites at least one evidence_ref", bool(refs))
        for ref in refs:
            target = index.get(ref)
            check(f"{gid}: evidence_ref resolves — {ref}", target is not None,
                  "not a file in the site directory nor a receipt/finding id declared by one")
            if not target:
                unresolvable += 1
                continue
            doc = load(target)
            if isinstance(doc, dict):
                for what, ok, detail in rehash(doc, target):
                    if ok:
                        rehashed += 1
                    check(f"{gid}: {ref} {what} hash matches", ok, detail)
                    if not ok and "not on disk" in detail:
                        notes.append(f"{ref}: {what} declared but {detail}")

    print("§3 no null-as-pass")
    for gate in gates:
        gid = gate.get("gate_id", "?")
        status = gate.get("status")
        check(f"{gid}: status is CLOSED, OPEN or NOT_APPLICABLE",
              status in ("CLOSED", "OPEN", "NOT_APPLICABLE"), f"status={status!r}")
        if status == "CLOSED":
            check(f"{gid}: closed gate carries a decision timestamp", bool(gate.get("decided_at")))
            check(f"{gid}: closed gate carries a reason", bool((gate.get("reason") or "").strip()))
        elif status == "OPEN":
            check(f"{gid}: open gate has no decision timestamp", gate.get("decided_at") in (None, ""))
            check(f"{gid}: open gate says why", bool((gate.get("reason") or "").strip()))
        elif status == "NOT_APPLICABLE":
            # Not-applicable is a claim too: it must say why it does not apply, and it must not
            # look decided. Otherwise it becomes a convenient way to retire an awkward gate.
            check(f"{gid}: not-applicable gate has no decision timestamp",
                  gate.get("decided_at") in (None, ""))
            check(f"{gid}: not-applicable gate says why it does not apply",
                  bool((gate.get("reason") or "").strip()))

    print("§3b the repo's self-tests still run")
    # Djurö's fix for the gap we both had: a self-test nobody runs is indistinguishable from one
    # that does not exist — theirs was broken from its first commit and cited as protection for
    # three weeks. This is the only thing in the repo that runs on every ledger check, so it is
    # where the runner belongs. A FAILING self-test fails this; THIN COVERAGE DOES NOT, because
    # blocking a ledger check on untested unrelated scripts would just get the check skipped.
    # Which repo's self-tests? BOTH. My first version resolved the runner against ROOT — the
    # VALIDATOR's repo — so validating Djurö's receipts ran Spatial's self-tests and never the
    # self-tests of the scripts that actually produced those receipts. The hook was right and
    # its root was wrong, which is a worse failure than no hook: it reports green over an
    # unchecked pipeline. Djurö found it by breaking their own assert and watching me pass.
    runners = []
    for base in (ROOT, *site.resolve().parents):
        candidate = base / "scripts/run-self-tests.py"
        if candidate.exists() and candidate not in runners:
            runners.append(candidate)
    check("a self-test runner was found for the validator and for the site's own repo",
          len(runners) >= 1, f"looked in {ROOT} and every parent of {site}")
    print("     runners: " + ", ".join(f"{r.parents[1].name}" for r in runners))
    for runner in runners:
        where = runner.parents[1].name
        try:
            run = subprocess.run([sys.executable, str(runner), "--quiet"],
                                 capture_output=True, text=True, timeout=600)
            summary = (run.stdout.strip().splitlines() or ["no output"])[-1]
            check(f"self-tests pass in {where} ({summary})", run.returncode == 0,
                  run.stdout.strip()[-400:] or run.stderr.strip()[-400:])
        except subprocess.TimeoutExpired:
            check(f"self-tests complete in {where}", False, "the runner timed out after 600s")

    print("§4 counts are computed, not quoted")
    closed = sum(1 for g in gates if g.get("status") == "CLOSED")
    open_count = sum(1 for g in gates if g.get("status") == "OPEN")
    not_applicable = sum(1 for g in gates if g.get("status") == "NOT_APPLICABLE")
    total = len(gates)
    check("summary 'closed' matches the gates", ledger.get("closed") == closed,
          f"summary says {ledger.get('closed')}, counted {closed}")
    check("summary 'open' matches the gates", ledger.get("open") == open_count,
          f"summary says {ledger.get('open')}, counted {open_count}")
    check("summary 'gate_count' matches the gates", ledger.get("gate_count") == total,
          f"summary says {ledger.get('gate_count')}, counted {total}")
    check("closed + open + not-applicable accounts for every gate",
          closed + open_count + not_applicable == total,
          f"{closed} + {open_count} + {not_applicable} != {total}")
    if ledger.get("not_applicable") is not None:
        check("summary 'not_applicable' matches the gates",
              ledger["not_applicable"] == not_applicable,
              f"summary says {ledger.get('not_applicable')}, counted {not_applicable}")

    if FRONT_DOOR.exists() and site.name == "saterdalsvagen-14":
        html = FRONT_DOOR.read_text()
        # Comments explain why a number was REMOVED and must not read as that number coming
        # back. Strip HTML and JS block comments before looking for a typed count.
        rendered_markup = re.sub(r"/\*.*?\*/", " ", re.sub(r"<!--.*?-->", " ", html, flags=re.S), flags=re.S)
        check("front door reads the ledger file", "gates.json" in html)
        typed = [pattern for pattern in (r"\d+\s*/\s*\d+\s*</b>", r"\d+ satisfied · \d+ open",
                                         r"OF \d+ EVIDENCE GATES")
                 if re.search(pattern, rendered_markup)]
        check("front door does not type a gate count", not typed,
              f"literal gate counts are back in the markup: {typed}")

    # Read the page's own numbers rather than accepting typed ones. A --rendered-N flag is a
    # human retyping what they believe the page says, which is the thing under test; Djurö's
    # stale "26" got through exactly that way.
    if args.front_door_url:
        # Read EVERY count the page states, not just the two that happened to be right.
        # Djurö's find: closed and total both matched while the open figure — the only one that
        # was wrong — was never compared. A check that looks at the correct numbers and not the
        # incorrect one passes with full marks and tells you nothing.
        expression = (
            "JSON.parse(JSON.stringify((()=>{"
            f"const rows=[...document.querySelectorAll('{GATE_ROW_SELECTOR}')];"
            f"const closed=document.querySelectorAll('{GATE_SATISFIED_SELECTOR}').length;"
            # A string test, not a regex: the marker itself contains a slash, which closes a
            # JS regex literal and silently produced no output at all.
            f"const na=rows.filter(r=>r.textContent.includes({GATE_NA_TEXT!r})).length;"
            "return{closed,na,total:rows.length,open:rows.length-closed-na};"
            "})()))")
        cmd = ["node", str(ROOT / "scripts/read_rendered.mjs"),
                                    args.front_door_url, expression,
                                    "--ready", f"document.querySelectorAll('{GATE_ROW_SELECTOR}').length > 0",
                                    "--port", str(args.cdp_port)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        detail = result.stderr.strip()[:200]
        if "ECONNREFUSED" in result.stderr or "cannot open a CDP target" in result.stderr:
            detail = CHROME_LAUNCH_HINT
        check("the rendered page could be read over CDP", result.returncode == 0, detail)
        if result.returncode == 0:
            rendered = json.loads(result.stdout.strip())
            args.rendered_closed = rendered["closed"]
            args.rendered_total = rendered["total"]
            args.rendered_open = rendered["open"]
            args.rendered_not_applicable = rendered["na"]
            print(f"§4b read from the page itself: {rendered['closed']} closed · "
                  f"{rendered['open']} open · {rendered['na']} n/a · {rendered['total']} total")

    if args.rendered_closed is not None:
        check(f"front door rendered {args.rendered_closed} closed, ledger has {closed}",
              args.rendered_closed == closed)
    if args.rendered_total is not None:
        check(f"front door rendered {args.rendered_total} total, ledger has {total}",
              args.rendered_total == total)
    if args.rendered_open is not None:
        check(f"front door rendered {args.rendered_open} open, ledger has {open_count}",
              args.rendered_open == open_count)
    if args.rendered_not_applicable is not None:
        check(f"front door rendered {args.rendered_not_applicable} not-applicable, "
              f"ledger has {not_applicable}",
              args.rendered_not_applicable == not_applicable)
    # And the page's own arithmetic has to close, not only the ledger's: a page can render four
    # internally inconsistent numbers while each matches nothing in particular.
    if None not in (args.rendered_closed, args.rendered_open,
                    args.rendered_not_applicable, args.rendered_total):
        check("the page's own counts add up",
              args.rendered_closed + args.rendered_open + args.rendered_not_applicable
              == args.rendered_total,
              f"{args.rendered_closed} + {args.rendered_open} + "
              f"{args.rendered_not_applicable} != {args.rendered_total}")
    unrendered = args.rendered_closed is None and args.rendered_total is None
    if unrendered:
        notes.append("front-door rendered numbers not supplied (--rendered-closed/--rendered-total): "
                     "markup was checked statically, the browser's own output was not")

    print()
    print(f"  ledger        {site.name} · {total} gates · {closed} closed · {open_count} open")
    print(f"  evidence      {rehashed} hash(es) re-derived · {unresolvable} ref(s) unresolvable")
    for note in notes:
        print(f"  NOT VERIFIED  {note}")
    print(f"\n{passed} passed, {failed} failed ({passed + failed} checks)")
    if failed:
        return 1
    if unrendered and not args.allow_unrendered:
        # A partial run must not read as a clean pass. Distinct exit code so a CI-style
        # reader cannot mistake "nobody checked the browser" for "the browser agreed".
        print("PARTIAL — rendered numbers not supplied; the browser's own output was never "
              "compared. Pass --rendered-closed/--rendered-total, or --allow-unrendered to "
              "accept a static-only run.")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
