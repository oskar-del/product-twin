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

## What is NOT yet locked — the gap (publish it, do not fake it)

The 4 Essence plots (builder-stated: **1 413 / 1 128 / 1 223 / 5 147 m²**, total **8 911 m²**) do **not**
reconcile cleanly with the current Catastro parcels on Calle Benicolet:

- No current parcel matches the villa plot sizes within tolerance (closest single: 9578421 = 4 510 m²
  vs Villa 4's 5 147 m²; a 637 m² / 14 % gap).
- Every candidate Benicolet parcel still carries a **building recorded 1987–2000** on its Catastro record
  (only 9578425 shows "suelos sin edificar"). Essence is **off-plan new-build**, so its plots are being
  formed by **re-parcelling/assembly + demolition that has not yet propagated into Catastro**.

**Conclusion:** the exact Essence parcel references cannot be locked from public Catastro alone at this
date. Any 4-parcel assignment now would be arithmetic coincidence (assembling old parcels to hit ~8 911 m²)
— which the pipeline's "measured, never eyeballed" rule forbids.

## To close the lock (any one of these)

1. **Developer plot plan / cadastral references** from Grupo Turis (we are their sales agent — near-zero
   friction). Their `PARCELA 01–04` map directly to the villas.
2. **A map pin / geolocated plot boundary** for the development → point-in-polygon against the inventory
   locks the parcels deterministically.
3. **Wait for the Catastro re-parcelling update** and re-run the inventory (unreliable timing).

Option 1 or 2 is the M1 close-out input. Until then the site envelope for M2 is the **Benicolet street
block** (authoritative geometry present); the per-villa plot boundaries are marked PROVISIONAL.
