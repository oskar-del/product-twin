#!/usr/bin/env python3
"""
One geometry hash, so two pipelines can prove they derived the same shapes.

Djurö's diagnosis: a derived-geometry hash is only comparable within one pipeline unless the
canonical form is shared. Ours disagreed on Djurö's buildings even though the DATA agreed
exactly — 35 footprints, 35 rings, same archive — because the two receipts differ in shape and
each hashed its own serialisation.

Three properties, each of which a naive `sha256(json.dumps(...))` gets wrong:

  1. EXPLICIT SEPARATORS. Without them, nesting collides: [[1,2],[3]] and [[1],[2,3]] flatten to
     the same digits. Rings, objects and coordinates each get their own delimiter, so a shape
     cannot be re-partitioned without changing the hash.
  2. SORTED BY OBJECT ID. Two runs that read the same table in a different order describe the
     same geometry; a hash that moves with row order reports a difference that is not one.
  3. FIXED PRECISION. Floats that survive a JSON round-trip as 1.0000000000000002 are the same
     coordinate. Everything is quantised to the millimetre before hashing — finer than any
     survey claim we are allowed to make, coarser than float noise.

The hash covers GEOMETRY ONLY. Field names, counts and metadata are deliberately excluded: the
question it answers is "did we derive the same shapes", not "did we write the same receipt".
"""
import hashlib
from decimal import Decimal, ROUND_HALF_EVEN

# Delimiters chosen to be impossible inside a formatted number, so no value can forge one.
COORD_SEP = ","
POINT_SEP = ";"
RING_SEP = "|"
OBJECT_SEP = "\n"
PRECISION = Decimal("0.001")          # 1 mm


# The method id is COMPOSED from the parameters that define the canonical form, never typed.
# Two pipelines each writing their own "geometry_hash/v1" string would be shared-by-assertion one
# level up: the label would agree while the form quietly diverged. Change a separator or the
# precision and this moves, so a receipt cannot claim a method it did not use.
METHOD_ID = (f"geometry_hash/v1"
             f"+p{PRECISION.as_tuple().exponent}"
             f"+c{ord(COORD_SEP)}.{ord(POINT_SEP)}.{ord(RING_SEP)}.{ord(OBJECT_SEP)}"
             f"+sorted_by_object_id+grouped_parts+xz_only")


def quantise(value):
    """A coordinate as a stable decimal string — no float noise, no negative zero."""
    if value is None:
        raise ValueError("coordinate is None")
    d = Decimal(str(float(value))).quantize(PRECISION, rounding=ROUND_HALF_EVEN)
    if d == 0:
        d = Decimal("0.000")          # -0.000 and 0.000 are the same place
    return format(d, "f")


def canonical_ring(ring):
    if len(ring) < 3:
        raise ValueError(f"ring has {len(ring)} points; a ring needs at least 3")
    return POINT_SEP.join(COORD_SEP.join(quantise(c) for c in point[:2]) for point in ring)


def canonical_form(objects):
    """
    objects: iterable of (object_id, rings), rings being [[ [x,z], ... ], ... ].
    Returns the exact string that gets hashed — printable, so a disagreement can be diffed
    rather than guessed at.

    An object id may appear more than once: Lantmäteriet's byggnad table carries a multi-part
    building as several rows under one objektidentitet, and Djurö's clip has exactly that — one
    id with a 32,9 m² footprint and a 31,2 m² footprint. Rows are therefore GROUPED by id, not
    rejected. My first version raised on a duplicate id, which encoded an assumption about the
    register that the register does not share.
    """
    grouped = {}
    for object_id, rings in objects:
        key = str(object_id)
        grouped.setdefault(key, []).extend(rings)
    prepared = []
    for key in sorted(grouped):                      # row order is not geometry
        forms = sorted(canonical_ring(r) for r in grouped[key])   # nor is part order
        if not forms:
            raise ValueError(f"{key}: no rings")
        prepared.append(f"{key}{RING_SEP}" + RING_SEP.join(forms))
    return OBJECT_SEP.join(prepared)


def geometry_sha256(objects):
    return hashlib.sha256(canonical_form(objects).encode("utf-8")).hexdigest()
