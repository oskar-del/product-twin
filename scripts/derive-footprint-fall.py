#!/usr/bin/env python3
"""
Derive the fall WITHIN a design footprint, and record how coarsely it was measured.

BRAGE's souterrain condition asks for the fall "across HOUSE_BAR footprint". The gate has been
answering with the fall across the whole PARCEL, which is a bigger number and a different
question. This computes the footprint figure — and, just as importantly, records the sampling
resolution next to it, because the honest answer today is that we cannot measure it properly:

  the committed heightfield samples 360 m at 24 segments = 15 m spacing
  HOUSE_BAR is 20 × 7 m

A 7 m depth is smaller than one grid cell. Anything computed here is an interpolation of a
coarse surface, not a measurement of the footprint, so it is emitted with the resolution and a
limitation, and the gate refuses to use it while the spacing is coarser than the footprint. When
the 1 m DTM (m650_55.tif, 246 MB, not held locally) is available, re-running this with that
source makes the figure real and the gate picks it up automatically.

    python3 scripts/derive-footprint-fall.py --site <dir> [--element HOUSE_BAR]
"""
import argparse, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def bilinear(field, x, z):
    """Height at (x,z) from a square, regularly spaced heightfield of [x,y,z] vertices."""
    size, segments = field["size_m"], field["segments"]
    n = segments + 1
    step = size / segments
    half = size / 2
    fx = (x + half) / step
    fz = (z + half) / step
    if not (0 <= fx <= segments and 0 <= fz <= segments):
        return None
    ix, iz = int(min(fx, segments - 1)), int(min(fz, segments - 1))
    tx, tz = fx - ix, fz - iz
    v = field["vertices"]
    def h(i, j):
        return v[j * n + i][1]
    return (h(ix, iz) * (1 - tx) * (1 - tz) + h(ix + 1, iz) * tx * (1 - tz)
            + h(ix, iz + 1) * (1 - tx) * tz + h(ix + 1, iz + 1) * tx * tz)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--element", default="HOUSE_BAR")
    args = ap.parse_args()
    site = pathlib.Path(args.site)
    site = site if site.is_absolute() else ROOT / site

    terrain_path = site / "terrain-dem-derived-v0.1.json"
    scene_path = site / "neighbourhood-scene-v0.2.json"
    if not terrain_path.exists() or not scene_path.exists():
        sys.exit(f"need both {terrain_path.name} and {scene_path.name} in {site}")

    terrain = json.loads(terrain_path.read_text())
    scene = json.loads(scene_path.read_text())
    field = terrain.get("heightfield")
    if not field or not field.get("vertices"):
        sys.exit("the terrain receipt carries no heightfield to sample")

    design = scene.get("design") or {}
    footprint = (design.get("footprints") or {}).get(args.element)
    if not footprint:
        sys.exit(f"no {args.element} footprint in the scene's design payload")

    xs = [p[0] for p in footprint]
    zs = [p[1] for p in footprint]
    spacing = field["size_m"] / field["segments"]
    steps = 12
    heights = []
    for i in range(steps + 1):
        for j in range(steps + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / steps
            z = min(zs) + (max(zs) - min(zs)) * j / steps
            h = bilinear(field, x, z)
            if h is not None:
                heights.append(h)
    if not heights:
        sys.exit("the footprint falls outside the heightfield")

    shortest_side = min(max(xs) - min(xs), max(zs) - min(zs))
    resolved = spacing <= shortest_side / 2      # at least two samples across the short side

    terrain["fall_within_footprint_m"] = {
        "element": args.element,
        "value_m": round(max(heights) - min(heights), 2),
        "min_m": round(min(heights), 2),
        "max_m": round(max(heights), 2),
        "samples": len(heights),
        "sampling_spacing_m": spacing,
        "footprint_m": [round(max(xs) - min(xs), 1), round(max(zs) - min(zs), 1)],
        "resolution_sufficient": resolved,
        "evidence_class": "DERIVED",
        "method": (f"bilinear interpolation of the committed {field['size_m']} m / "
                   f"{field['segments']}-segment heightfield over the {args.element} footprint"),
        "source_element": "scene.design.footprints." + args.element,
        "design_provenance": (design.get("provenance") or {}).get("patch"),
        "limitations": [
            (f"Sampling spacing is {spacing:g} m and the footprint's shortest side is "
             f"{shortest_side:g} m, so this is an interpolation of a coarse surface, not a "
             f"measurement of the footprint." if not resolved else
             f"Interpolated from a {spacing:g} m heightfield."),
            "The 1 m DTM itself is not held locally; re-run against it to make this a measurement.",
        ],
    }
    terrain_path.write_text(json.dumps(terrain, ensure_ascii=False, indent=2) + "\n")

    block = terrain["fall_within_footprint_m"]
    print(f"wrote fall_within_footprint_m into {terrain_path.name}")
    print(f"  element            {args.element} · {block['footprint_m'][0]} × {block['footprint_m'][1]} m")
    print(f"  fall               {block['value_m']} m ({block['min_m']} → {block['max_m']})")
    print(f"  sampling           {block['samples']} points at {spacing:g} m spacing")
    print(f"  resolution enough  {'YES' if resolved else 'NO — coarser than the footprint'}")
    print(f"  parcel fall        {(terrain.get('plot_footprint') or {}).get('relief_m')} m (what the gate uses today)")


if __name__ == "__main__":
    main()
