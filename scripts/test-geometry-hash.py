#!/usr/bin/env python3
"""
Prove the geometry hash distinguishes what it must and ignores what it must not.

A hash that has only ever agreed with itself is untested; each case below is a way a naive
implementation quietly gets it wrong.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geometry_hash import geometry_sha256, canonical_form

passed = failed = 0
def check(label, condition, detail=""):
    global passed, failed
    if condition: passed += 1
    else:
        failed += 1
        print(f"FAIL  {label}" + (f"\n      {detail}" if detail else ""))

SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]]
TRI = [[0, 0], [5, 0], [0, 5]]

print("§1 the same geometry hashes the same")
a = geometry_sha256([("B1", [SQUARE]), ("B2", [TRI])])
check("identical input", a == geometry_sha256([("B1", [SQUARE]), ("B2", [TRI])]))
check("row order ignored", a == geometry_sha256([("B2", [TRI]), ("B1", [SQUARE])]),
      "a hash that moves with table order reports differences that are not differences")
check("float noise ignored",
      a == geometry_sha256([("B1", [[[0.0000000001, 0], [10, 0], [10, 10], [0, 10]]]), ("B2", [TRI])]),
      "sub-millimetre float noise must not change the hash")
check("negative zero ignored",
      a == geometry_sha256([("B1", [[[-0.0, -0.0], [10, 0], [10, 10], [0, 10]]]), ("B2", [TRI])]))
check("extra coordinates beyond x,z ignored",
      a == geometry_sha256([("B1", [[[0, 0, 99], [10, 0, 99], [10, 10, 99], [0, 10, 99]]]), ("B2", [TRI])]),
      "a z-value carried alongside must not enter a 2-D footprint hash")

print("§2 different geometry hashes differently")
check("a moved point", a != geometry_sha256([("B1", [[[0, 0], [10, 0], [10, 10.5], [0, 10]]]), ("B2", [TRI])]))
check("a millimetre matters", a != geometry_sha256([("B1", [[[0.001, 0], [10, 0], [10, 10], [0, 10]]])
                                                   , ("B2", [TRI])]))
check("a renamed object", a != geometry_sha256([("B9", [SQUARE]), ("B2", [TRI])]),
      "the id is part of the claim: which building this is matters")
check("a dropped object", a != geometry_sha256([("B1", [SQUARE])]))
check("an added ring", a != geometry_sha256([("B1", [SQUARE, TRI]), ("B2", [TRI])]))

print("§3 nesting cannot be re-partitioned")
# The classic separator failure: without explicit delimiters these two flatten identically.
left = geometry_sha256([("X", [[[1, 2], [3, 4], [5, 6]]])])
right = geometry_sha256([("X", [[[1, 2], [3, 4], [5, 6]], [[1, 2], [3, 4], [5, 6]]])])
check("one ring vs two identical rings", left != right)
check("point split across rings changes the hash",
      geometry_sha256([("X", [[[1, 1], [2, 2], [3, 3], [4, 4]]])])
      != geometry_sha256([("X", [[[1, 1], [2, 2], [3, 3]], [[4, 4], [1, 1], [2, 2]]])]))
check("an id cannot forge a separator",
      geometry_sha256([("A|B", [SQUARE])]) != geometry_sha256([("A", [SQUARE, SQUARE])]),
      "an object id containing the ring delimiter must not be able to imitate extra rings")

print("§4 malformed input is refused, not hashed")
for label, objects in [
    ("a 2-point ring", [("X", [[[0, 0], [1, 1]]])]),
    ("no rings", [("X", [])]),
]:
    try:
        geometry_sha256(objects)
        check(f"{label} refused", False, "it was hashed instead of raising")
    except ValueError:
        check(f"{label} refused", True)

print("§4b multi-part buildings group under one id")
# LM byggnad carries a multi-part building as several rows under one objektidentitet.
grouped = geometry_sha256([("X", [SQUARE]), ("X", [TRI])])
check("two rows under one id == one row with two rings",
      grouped == geometry_sha256([("X", [SQUARE, TRI])]),
      "a multi-part building must hash the same however the register splits its rows")
check("part order ignored", grouped == geometry_sha256([("X", [TRI]), ("X", [SQUARE])]))
check("grouping is not flattening", grouped != geometry_sha256([("X", [SQUARE])]))

print("§5 the canonical form is printable, so a disagreement can be diffed")
form = canonical_form([("B1", [TRI])])
check("form contains the id and the separators", "B1|" in form and ";" in form and "," in form)
check("coordinates are fixed precision", "0.000,0.000" in form, form[:60])

print(f"\n{passed} passed, {failed} failed ({passed + failed} checks)")
sys.exit(1 if failed else 0)
