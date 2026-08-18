# Essence Moraira — site data (Turis pilot)

Evidence for the Essence Moraira spatial showcase (see `docs/handoffs/ESSENCE-MORAIRA-PILOT.md`).
Developer: **Grupo Turis Promociones** · Architect: **Pepe Giner** · We are the **sales agent (H&H)**.

| File | What |
|---|---|
| `project-v0.1.json` | Project identity + 4 villas, builder-stated built/plot/beds (from the official microsite). |
| `evidence-sources-v0.1.json` | Source receipts: H&H feed, developer microsite, Catastro services. |
| `catastro/benicolet-parcel-inventory-v0.1.json` | All 16 Calle Benicolet parcels — authoritative area, WGS84 + ETRS89 centroid, use, on-record build year. |
| `catastro/README.md` | Parcel-lock status: what's locked, the reconciliation gap, and the input needed to close it. |

## M1 status (2026-08-18)

- **Feed pull — DONE (negative):** Essence Moraira is **not** in the current H&H Janela feed
  (`0500015622.xml`, 36 props). No Turis, no Benicolet, no titled Essence project. The developer's own
  microsite `essencemoraira.com` is the primary asset source instead.
- **Parcel lock — PARTIAL:** street + full parcel inventory locked with authoritative Catastro geometry;
  exact 4 Essence parcels **not** locked (re-parcelling not yet in Catastro). See `catastro/README.md`.

**Open input from Oskar (as anticipated in the handoff):** the Turis plot plan / cadastral refs, or a
geolocated plot boundary, closes the parcel lock deterministically.
