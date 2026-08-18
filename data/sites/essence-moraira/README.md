# Essence Moraira — site data (Turis pilot)

Evidence for the Essence Moraira spatial showcase (see `docs/handoffs/ESSENCE-MORAIRA-PILOT.md`).
Developer: **Grupo Turis Promociones** · Architect: **Pepe Giner** · We are the **sales agent (H&H)**.

| File | What |
|---|---|
| `project-v0.1.json` | Project identity + 4 villas, builder-stated built/plot/beds + permit exps and floor levels. |
| `plans-manifest-v0.1.json` | The 9 municipal floorplan PDFs (parcela, floor, permit exp, date, floor levels). |
| `evidence-sources-v0.1.json` | Source receipts: H&H feed, developer microsite, plans, Catastro services. |
| `catastro/benicolet-parcel-inventory-v0.1.json` | All 16 Calle Benicolet parcels — area, WGS84 + ETRS89 centroid, use, build year, Essence annotations. |
| `catastro/README.md` | Parcel-lock status: Villa 4 locked, Villas 1–3 gap, input needed to close it. |
| `locator/` | Catastro block-95784 cadastral map + PNOA orthophoto for the Benicolet cluster. |

Client media (9 plan PDFs + the 2025-10-28 drone aerial) are in the vault:
`~/Documents/Opero/Concept Casa/Projects/Essence Moraira ( TURIS )/`.

## M1 status (2026-08-18)

- **Feed pull — DONE (negative):** Essence Moraira is **not** in the current H&H Janela feed
  (`0500015622.xml`, 36 props). No Turis, no Benicolet, no titled Essence project. The developer's own
  microsite `essencemoraira.com` is the primary asset source instead — 4 villas, full specs, floorplans,
  renders and a dated drone aerial pulled.
- **Location — LOCKED:** CL Benicolet, Teulada-Moraira, **Catastro block 95784**; centre ≈ 38.700505 N,
  0.119172 E. Architect José Giner Ivars (Pepe Giner); promoter SPV Orange Villas Development S.L.;
  Teulada permits 21/29/31/32-25 (2025).
- **Parcel lock — Villa 4 LOCKED** (`9578421`, parcel 21) by size + position + stamped floor level.
  **Villas 1–3 not yet locked** (re-parcelación not in Catastro). See `catastro/README.md`.

**Open input from Oskar (as anticipated in the handoff):** the developer's *plano de parcelación* / cadastral
refs closes Villas 1–3 deterministically. Villa 4 + the site block are enough to start M2.
