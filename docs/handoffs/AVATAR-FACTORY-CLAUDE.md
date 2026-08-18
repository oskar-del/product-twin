# Avatar Factory (Claude) — persistent handoff

Standing session for **Acquisition / Avatar Factory** on `oskar-del/product-twin`.

## Session facts

- **Worktree branch:** `agent/avatar-factory-claude` (worktree at `../repo-avatar-factory`, created from `origin/main` @ `667ffc1`).
- **Mandate:** OpenAI-era audit §1 (`docs/OPENAI-ERA-AUDIT-2026-08-18.md`, lives on other branches). Permission-light acquisition first.
- **Hard rule:** no supplier/manufacturer email is ever sent without Oskar's explicit go on exact content.
- Nothing in this handoff implies a push, merge or deployment beyond what the "Status" lines state.

## Priorities (audit order)

1. Photo-to-avatar end-to-end on an owned product — Anatomic SITT as exact-twin target. **← done (infra + proof); waiting on Oskar's photos + measurements + `MESHY_API_KEY`.**
2. Broaden Shopify Model3D census from 1 merchant to ~20.
3. Draft BIMobject Developer API + pCon applications (docs, not emails).
4. Finish the 8 missing Kator/Legaz review claims.
5. One-page manufacturer value-offer doc.

---

## P1 — Photo-to-avatar for Anatomic SITT · STATUS: infra complete + wiring-proven

**What "done" means here:** the pipeline is fully built and wired; the *only* remaining inputs are real photos, real measurements, and the `MESHY_API_KEY` secret. Verified below.

### Files added

| file | role |
|---|---|
| `config/geometry/anatomic-sitt-zitzi-delfi-pro-target.json` | exact-twin target (photo-capture route), grounded in real Zitzi Delfi Pro registry data |
| `config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json` | turnkey runtime job template — copy to gitignored `.runtime/avatars/`, fill only `<<FILL>>` fields |
| `docs/ANATOMIC-SITT-PHOTO-CAPTURE-GUIDE.md` | step-by-step: pick subject → shoot 5 views → measure → clear rights → run |
| `docs/legal/anatomic-sitt-reconstruction-authorization.md` | one-signature family-firm rights authorization (TEMPLATE, unsigned, unsent) |

### Why Anatomic SITT

Family firm (org 556411-7348; brother-in-law is CEO). Real manufacturer, rigid physical products, **rights clear with one internal signature** — the cheapest exact-G3 rights path in the corpus, zero cold-outreach. Grounded reference product: **Zitzi Delfi Pro** (real registry entries HMI 53369–53371 / 85704–85705, sizes 0–4, internal widths 30/34/38 cm, max user 90 kg; sources: hmi-basen.dk, portale.siva.it, medicalexpo). The exact SKU + full W/D/H envelope are **capture-confirmed** (measured), never fabricated.

### P1 end-to-end proof (2026-08-18, node v22.14.0, no key, no real photos)

Run from the worktree root:

```sh
# 1) Unfilled template correctly BLOCKS on exactly the fields Oskar supplies:
AVATAR_JOB=config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json npm run avatar:photo:preflight
#   → status: BLOCKED · blocked: [temporary_https_image_references, known_physical_scale]

# 2) A filled job PASSES preflight 13/13 (synthetic values used for the proof only):
#    (copy template to .runtime/avatars/, fill https URLs + numeric dims + rights ref)
#   → status: PASS · 13/13

# 3) Generation without the key reaches the credential gate, not a code error:
npm run avatar:photo:run
#   → status: CREDENTIAL_REQUIRED · reason: MESHY_API_KEY is not configured
```

Interpretation: the pipeline is fully wired. Preflight gate → generation gate → QA gate all execute. The only missing inputs are (a) real HTTPS-hosted photos of the 5 views, (b) measured W/D/H, (c) `MESHY_API_KEY`, and (d) a signed authorization for redistribution scope.

Baseline tests still green: `avatar:photo:preflight:test` (6), `avatar:photo:qa:test` (5), `avatar:reconstruction:score:test` (3), `avatar:reconstruction:job:test` (2).

**NOT checked / still blocked:**
- No real avatar generated (no photos, no key, by design).
- Registry envelope is internal-width only; full W/D/H must be measured — not sourced from registry.
- Rights authorization is an unsigned template; redistribution stays `review` until signed.
- Meshy reconstruction quality on Zitzi's foam/fabric/strap surfaces is unproven — guide recommends a rigid subject first.
- Claim ceiling is G2 pre-QA; G3 needs multi-view QA PASS + verified exact SKU + recorded rights scope. Photo capture never grants G4/engineering authority.

---

## P2–P5 — STATUS: not started

See `docs/handoffs/AVATAR-FACTORY-CLAUDE.md` updates and task list. Landmines to respect from the audit: agent-authored visual QA (e.g. Furniture Avatar Package #2) must be independently re-derived or human-viewed before any PASS; Kator/Legaz is independently G0 (0/12 publishable) despite doc claims.

## Handoff contract (per AGENTS.md §5)

- Branch/commit: see "Session facts". Dirty/clean state stated per commit in git log.
- Monitoring: none of the added files assert live price/stock/rights — no recurring monitor required yet. When a real authorization is signed, its scope + revocation condition become a monitored fact.
- Merge/deploy: none performed.
