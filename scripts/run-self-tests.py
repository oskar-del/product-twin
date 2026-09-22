#!/usr/bin/env python3
"""
Run every self-test in this repo, and name the scripts that have none.

Djurö's design, and the important half is the second clause. A runner that reports
"1 passed, 0 failed" while most scripts are untested is the same lie one level up: it reads as
coverage and is a single test. Thin coverage is printed, loudly, and is NOT a failure — only a
FAILING test is. That distinction is what lets this be called from a gate without blocking work
on scripts nobody has written tests for yet.

This exists because Djurö's own self-test was broken from its first commit and nobody noticed
for three weeks, while being cited as protection — including to me. A test that is never run is
indistinguishable from one that does not exist.

    python3 scripts/run-self-tests.py [--quiet]
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

# Scripts whose self-test is a separate file rather than a --self-test flag.
STANDALONE = {"test-geometry-hash.py"}


def has_self_test(path):
    """
    Does the script DECLARE --self-test as an option?

    Not "does the text mention it": a script that merely references the flag in a comment, or
    ignores unknown flags, will run its real main path instead — which is how the first version
    of this runner spent eight minutes rebuilding sites and fetching a raster.
    """
    try:
        text = path.read_text(errors="ignore")
    except OSError:
        return False
    return 'add_argument("--self-test"' in text or "add_argument('--self-test'" in text


def main():
    quiet = "--quiet" in sys.argv
    # Exclude self: this file contains the detection string in its own source, so the first
    # version detected itself, ran itself, and hung. A runner must not be its own subject.
    me = pathlib.Path(__file__).name
    candidates = sorted(p for p in SCRIPTS.glob("*.py")
                        if not p.name.startswith("test-") and p.name != me)
    with_tests, without = [], []
    for path in candidates:
        (with_tests if has_self_test(path) else without).append(path)
    standalone = sorted(SCRIPTS / name for name in STANDALONE if (SCRIPTS / name).exists())

    passed, failed, results = 0, 0, []
    for path in with_tests:
        try:
            run = subprocess.run([sys.executable, str(path), "--self-test"],
                                 capture_output=True, text=True, cwd=ROOT, timeout=90)
            ok = run.returncode == 0
            detail = run
        except subprocess.TimeoutExpired:
            ok, detail = False, None
        if detail is None:
            passed, failed = passed, failed + 1
            results.append((path.name, False, "timed out after 90s — a self-test that hangs is a failing one"))
            continue
        run = detail
        passed, failed = passed + ok, failed + (not ok)
        results.append((path.name, ok, (run.stderr.strip().splitlines() or [""])[-1][:120]))
    for path in standalone:
        run = subprocess.run([sys.executable, str(path)], capture_output=True, text=True, cwd=ROOT)
        ok = run.returncode == 0
        passed, failed = passed + ok, failed + (not ok)
        results.append((path.name, ok, (run.stderr.strip().splitlines() or [""])[-1][:120]))

    if not quiet:
        for name, ok, detail in results:
            print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"\n        {detail}" if not ok else ""))
        print()
        print(f"  coverage: {len(results)} of {len(candidates) + len(standalone)} scripts have a "
              f"self-test; {len(without)} have none")
        if without:
            print("  no self-test: " + ", ".join(p.name for p in without))
    print(f"\n{passed} passed, {failed} failed "
          f"({len(without)} of {len(candidates) + len(standalone)} scripts untested)")
    # Thin coverage is reported, never failed on. A broken test is a failure.
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
