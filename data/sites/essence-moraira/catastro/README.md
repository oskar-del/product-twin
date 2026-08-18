# Essence Moraira — Catastro parcel lock (M1, Stage 1)

*As of 2026-08-18. Re-prove by re-running the request URLs in `../evidence-sources-v0.1.json`.*

## What is locked

- **Municipality**: Teulada (Alicante) — Catastro province `03`, municipio `128`.
- **Street**: `CL BENICOLET` — Catastro via code `767`. Postal `03724`/`03725`.
- **Full street parcel inventory**: `benicolet-parcel-inventory-v0.1.json` — all 16 Calle Benicolet
  parcels with authoritative Catastro plot area (`areaValue`), ETRS89/UTM30N centroid, WGS84 centroid,
  cadastral address, current use and on-record built area + record year. Never eyeballed — every value
  from Catastro INSPIRE WFS `GetParcel` and OVC `Consulta_DNPRC` / `Consulta_CPMRC`.
- **Cluster location**: centre ≈ **38.700505 N, 0.119172 E**; bbox lon 0.11829–0.11984, lat 38.69960–38.70144.

Parcel number = refcat chars 6–7, so the Catastro cartography labels map directly:
`9578`**`421`**` = block 95784 parcel 21`, `9578420 = parcel 20`, etc. Locator images:
`../locator/catastro-block-95784-benicolet.png` (parcels + labels) and `../locator/pnoa-ortho-benicolet.jpg`.

## Villa 4 — candidate lock (MEDIUM confidence)

**Villa 4 "Essence Patio" (Parcela 04, plot 5 147 m²) ≈ Catastro `9578421BC4897N` (block 95784, parcel 21).**
Two signals support it; the elevation signal was tested and did **not**:
1. **Size** ✅ — parcel 21 (4 510 m² current) is the single largest plot on Calle Benicolet; Villa 4 is by far
   the largest villa (5 147 m² vs ~1.1–1.4k for V1–3). The 14 % gap is the pre-final re-parcelling.
2. **Position** ✅ — parcel 21 is the southernmost of the 95784 sub-cluster; matches the drone aerial.
3. **Elevation** ❌ — I sampled IGN MDT05 (`../spatial/v0.1/terrain-mdt05-samples-v0.1.json`): parcel 21 =
   64.7 m, but parcels 19 (63.8) and 01 (62.3) are **lower**. The plans' +70.55/+75.0 m are finished-floor
   platforms (cut/fill on sloping plots), not natural ground, so absolute floor level does **not** discriminate
   the parcel. This is left as an explicit negative — not a corroborator. A georeferenced developer plot plan
   would confirm parcel 21 outright.

## Villas 1–3 — NOT yet locked (the honest gap)

The 4 Essence plots (builder-stated **1 413 / 1 128 / 1 223 / 5 147 m²**, total **8 911 m²**) do **not**
reconcile 1:1 with current Catastro parcels:

- Every Benicolet parcel still carries a **building recorded 1987–2000** on its Catastro record (only
  9578425 shows "suelos sin edificar"). Essence is **off-plan new-build** (permits 2025), so its plots are a
  **re-parcelación + demolition that has not yet propagated into Catastro**.
- Villas 1–3 sit on block 95784 immediately N of parcel 21, on the **+75 m terrace** (candidate current
  parcels 18/19/20 and possibly 16/17/26). Assigning exact refcats now would be arithmetic coincidence —
  which the "measured, never eyeballed" rule forbids.

**Conclusion:** Villa 4 is locked; the site area + block are locked; Villas 1–3 exact refcats need the
developer's **plano de parcelación** (their "Parcela 01–04" is their own numbering, not Catastro parcels).

## To close the lock (any one of these)

1. **Developer plot plan / cadastral references** from Grupo Turis (we are their sales agent — near-zero
   friction). Their `PARCELA 01–04` map directly to the villas.
2. **A map pin / geolocated plot boundary** for the development → point-in-polygon against the inventory
   locks the parcels deterministically.
3. **Wait for the Catastro re-parcelling update** and re-run the inventory (unreliable timing).

Option 1 or 2 is the M1 close-out input. Until then the site envelope for M2 is the **Benicolet street
block** (authoritative geometry present); the per-villa plot boundaries are marked PROVISIONAL.
