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
import argparse, base64, json, os, pathlib, sys, urllib.error, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from cog_window import RemoteCog, CogError

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


def probe_native_source(terrain):
    """
    Can we read the 1 m COG by range request, as the receipt's own method describes?

    Brain's ruling assumed yes — the pin sample was "a windowed nearest-cell sample of the
    verified gate-tracked DTM COG", so the tile is read remotely rather than held locally. It
    turns out the data asset needs credentials that are not present here, and saying exactly
    that is more useful than "not available": the fix is an authorisation, not a 246 MB
    download. The result is recorded so the gate's reason can name the real obstacle.
    """
    item_url = ((terrain.get("gate_tracked_asset") or {}).get("stac_item"))
    if not item_url:
        return {"attempted": False, "reason": "the receipt names no STAC item"}
    try:
        with urllib.request.urlopen(item_url, timeout=30) as response:
            item = json.load(response)
    except Exception as exc:                                   # noqa: BLE001 - reported, not raised
        return {"attempted": True, "stac": "unreachable", "error": f"{type(exc).__name__}: {exc}"}

    href = ((item.get("assets") or {}).get("data") or {}).get("href")
    if not href:
        return {"attempted": True, "stac": "ok", "reason": "the STAC item exposes no data asset"}

    request = urllib.request.Request(href, headers={"Range": "bytes=0-1023"})
    auth = os.environ.get("LM_BASIC_AUTH")
    if auth:
        request.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            head = response.read(4)
        readable = head[:4] in (b"II*\x00", b"MM\x00*")
        return {"attempted": True, "stac": "ok", "asset_url": href, "http_status": response.status,
                "looks_like_tiff": readable, "credentials_used": bool(auth),
                "readable": readable}
    except urllib.error.HTTPError as exc:
        return {"attempted": True, "stac": "ok", "asset_url": href, "http_status": exc.code,
                "credentials_used": bool(auth), "readable": False,
                "reason": ("the 1 m raster requires Lantmäteriet credentials; set LM_BASIC_AUTH "
                           "from the granted Geotorget order" if exc.code in (401, 403)
                           else f"HTTP {exc.code}")}
    except Exception as exc:                                   # noqa: BLE001
        return {"attempted": True, "stac": "ok", "asset_url": href, "readable": False,
                "error": f"{type(exc).__name__}: {exc}"}


def sample_native(terrain, footprint, anchor):
    """
    Sample the footprint at the raster's own 1 m resolution, over HTTP range requests.

    This is what the receipt's own method describes for the pin — "a windowed nearest-cell
    sample of the verified gate-tracked DTM COG" — applied to the footprint. The tile is 246 MB;
    the window is a handful of cells, so a COG read fetches the header and the one 512 × 512
    tile the footprint lands in. No download, no local copy.
    """
    item_url = ((terrain.get("gate_tracked_asset") or {}).get("stac_item"))
    if not item_url:
        return None, {"attempted": False, "reason": "the receipt names no STAC item"}
    try:
        with urllib.request.urlopen(item_url, timeout=30) as response:
            item = json.load(response)
        href = ((item.get("assets") or {}).get("data") or {}).get("href")
        if not href:
            return None, {"attempted": True, "reason": "the STAC item exposes no data asset"}
        cog = RemoteCog(href)
        e0, n0 = anchor
        xs = [p[0] for p in footprint]
        zs = [p[1] for p in footprint]
        heights = []
        x = min(xs)
        while x <= max(xs) + 1e-9:                    # native grid: one sample per metre
            z = min(zs)
            while z <= max(zs) + 1e-9:
                value = cog.sample(e0 + x, n0 + z)
                if value is not None:
                    heights.append(value)
                z += cog.py
            x += cog.px
        if not heights:
            return None, {"attempted": True, "reason": "every cell in the window was nodata"}
        return heights, {
            "attempted": True, "readable": True, "credentials_used": bool(os.environ.get("LM_BASIC_AUTH")),
            "asset": href.rsplit("/", 1)[-1],
            "tile_sha256": (terrain.get("gate_tracked_asset") or {}).get("sha256"),
            "pixel_size_m": cog.px, "samples": len(heights),
            "range_requests": cog.requests, "bytes_read": cog.bytes_read,
            "method": "windowed nearest-cell sample of the gate-tracked DTM COG over HTTP range requests",
        }
    except CogError as exc:
        return None, {"attempted": True, "readable": False,
                      "credentials_used": bool(os.environ.get("LM_BASIC_AUTH")), "reason": str(exc)}
    except Exception as exc:                                   # noqa: BLE001
        return None, {"attempted": True, "readable": False,
                      "credentials_used": bool(os.environ.get("LM_BASIC_AUTH")),
                      "error": f"{type(exc).__name__}: {exc}"}


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

    anchor = (terrain.get("coordinate_anchor") or {}).get("sweref99tm_en")
    native_heights, native = (None, {"attempted": False, "reason": "no coordinate anchor"})
    if anchor:
        native_heights, native = sample_native(terrain, footprint, anchor)
    if native_heights:
        # The real measurement replaces the interpolation entirely — it is not a refinement of
        # it, it is a different and better number, and the guard opens.
        heights = native_heights
        spacing = native["pixel_size_m"]
        resolved = True
    terrain["fall_within_footprint_m"] = {
        "native_source": native,
        "element": args.element,
        "value_m": round(max(heights) - min(heights), 2),
        "min_m": round(min(heights), 2),
        "max_m": round(max(heights), 2),
        "samples": len(heights),
        "sampling_spacing_m": spacing,
        "footprint_m": [round(max(xs) - min(xs), 1), round(max(zs) - min(zs), 1)],
        "resolution_sufficient": resolved,
        "evidence_class": "DERIVED",
        "method": (native.get("method") if native_heights else
                   f"bilinear interpolation of the committed {field['size_m']} m / "
                   f"{field['segments']}-segment heightfield over the {args.element} footprint"),
        "source_element": "scene.design.footprints." + args.element,
        "design_provenance": (design.get("provenance") or {}).get("patch"),
        "limitations": [
            (f"Sampling spacing is {spacing:g} m and the footprint's shortest side is "
             f"{shortest_side:g} m, so this is an interpolation of a coarse surface, not a "
             f"measurement of the footprint." if not resolved else
             f"Interpolated from a {spacing:g} m heightfield."),
            ("Sampled at the raster's native 1 m resolution over HTTP range requests; no local copy."
             if native_heights else
             "The 1 m raster could not be read: "
             + (native.get("reason") or native.get("error") or "unknown")
             + f" (HTTP {native.get('http_status')})." if not native.get("readable") else
             "The 1 m raster is readable; windowed sampling is not implemented yet."),
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
    print(f"  1 m source         readable={native.get('readable')} "
          f"http={native.get('http_status')} creds={native.get('credentials_used')}")
    if not native.get("readable"):
        print(f"                     {native.get('reason') or native.get('error')}")


if __name__ == "__main__":
    main()
