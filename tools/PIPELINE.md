# Floorplan → 3D → Showcase pipeline

Turn a developer's architectural drawings into a plausible, beautiful product twin —
two-storey dollhouse models, an interactive site twin, path-traced renders, films, and a
shareable showcase microsite. Proven on **Essence Moraira** (Orange Villas Development, 4 villas).
**Next input: the Svärtinge house designs** — same steps, swap the PDFs + site data.

## Inputs
- **Architect floorplans** — vector PDFs (one per villa per floor: sótano / baja / alta).
  Must be true vector (CAD export), with a distinct **wall layer** (colour/width), a north arrow,
  and a stated scale (Essence = 1:50). Room schedules give built areas.
- **Site** (optional but makes it geometry-true): terrain (IGN/national LiDAR grid) and
  parcel geometry (cadastre). Essence used EPSG:25830 + Catastro INSPIRE WFS.

## Steps & scripts
1. **Read the sheets** — identify villa (`Parcela nº`), floors, `SUPERFICIE DE PARCELA`, built m²
   (PyMuPDF `get_text`). → per-villa specs.
2. **Extract walls** — the walls are one vector layer (Essence: black + grey strokes, *not* the
   dark-green hatch / red dimensions). Filter by colour, rasterize, downsample to a 0.3 m
   **wall-occupancy grid**; keep the largest connected component (drops section/detail drawings).
   → `v{n}baja.png` (floor texture) + wall grid.
3. **Align floors** — cross-correlate ground vs upper wall grids to seat the upper storey inside
   the ground footprint. → `v{n}floors.json` (baja + alta cells, textures, offsets).
4. **Dollhouse** — extrude the wall cells (three.js), floor plan on the slab, translucent roof:
   `prototype/essence-moraira/dollhouse2.html?v=1..4` (`?roof=off` to see in).
5. **Footprint outlines** — Moore-trace + Douglas-Peucker the grids → `villa-outlines.json`
   (`pad` = ground/terrace from baja, `building` = mass from alta).
6. **Site twin** — `prototype/essence-moraira/index.html` extrudes building outlines on real
   terrain/parcels, ribbon-glass, terrace pads; `captureTwinPath()` renders fly-through frames → ffmpeg.
7. **Path-traced renders (Blender/Cycles)** — `tools/render/blender_render.py` (development),
   `blender_villa.py` (isolated per-villa hero: terrace, pool, sea, warm sun), `blender_orbit.py`
   (fly-around). Metal GPU, ~15 s/frame. Rebuilds the same geometry with PBR materials + Nishita sky.
8. **Showcase microsite** — `tools/showcase/build_showcase.py <config.json> <out.html>` embeds the
   renders / floorplans / specs / film into a self-contained editorial page (see below).

## Reusable showcase template
`tools/showcase/` = `build_showcase.py` + `template.html`. **New development = new
`showcase.json` + assets folder**, same design class. Canonical example:
`data/sites/essence-moraira/showcase/showcase.json`.

```
python3 tools/showcase/build_showcase.py \
  data/sites/<dev>/showcase/showcase.json  out.html
```
Then publish `out.html` as a private Artifact and share the link.

## Honest limits (carry forward)
- **Placement/orientation** of villas on the plot is best-judgment unless the developer's
  **parcelación / site plan** (DWG or georeferenced PDF) is supplied — then snap exactly.
- Per-villa outlines improve with a cleaner wall-layer; Villa footprints that include large
  terraces read long — use the `alta` outline for the building mass.
- Renders are archviz-grade (GI, glass, sky); photoreal needs textured PBR maps + HDRI.
