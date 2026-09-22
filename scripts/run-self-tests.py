#!/usr/bin/env python3
"""Run every script self-test in this repo, and NAME THE SCRIPTS THAT HAVE NONE.

Rule 21 says a check that has never been shown to fail is only telling you it ran.
The corollary this script exists for: a runner that reports "all tests passed" while
most scripts have no test is the same lie one level up. So the gap is output, not a
silent omission — an untested script is printed as NO SELF-TEST, and the exit code
is non-zero if any test FAILS (not if coverage is thin; that is a fact to see, not
a failure to block on).

Why this exists at all: ingest-property-division.py's --self-test raised TypeError
on every invocation from 349bdcc769 until 2026-09-22 and nobody noticed, because
nothing ran it. A self-test that is not invoked by anything is decoration.

    python3 scripts/run-self-tests.py [--quiet]

--quiet prints only the summary line, for callers that run this on every check.
The coverage number stays in that line: it is the honest figure and must not be
the thing that gets trimmed for brevity.
"""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = sorted(p for p in (ROOT / "scripts").glob("*.py") if p.name != Path(__file__).name)


def supports_self_test(path):
    try:
        return "--self-test" in path.read_text()
    except OSError:
        return False


def main():
    quiet = "--quiet" in sys.argv[1:]
    tested, untested, failures = [], [], []
    for path in SCRIPTS:
        if not supports_self_test(path):
            untested.append(path.name)
            continue
        proc = subprocess.run([sys.executable, str(path), "--self-test"],
                              capture_output=True, text=True, cwd=ROOT)
        ok = proc.returncode == 0
        tested.append((path.name, ok))
        if not ok:
            failures.append((path.name, (proc.stderr or proc.stdout).strip().splitlines()[-3:]))

    if not quiet:
        for name, ok in tested:
            print(f"  {'PASS' if ok else 'FAIL'}  {name}")
        for name in untested:
            print(f"  ----  {name}   NO SELF-TEST")
        print()

    print(f"{sum(1 for _, ok in tested if ok)} passed, {len(failures)} failed, "
          f"{len(untested)} of {len(SCRIPTS)} scripts have no self-test at all.")
    if untested and not quiet:
        print("An untested script is not a passing script. The line above is the real "
              "coverage, and it is thin.")
    for name, tail in failures:
        print(f"\n--- {name}")
        for line in tail:
            print(f"    {line}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
