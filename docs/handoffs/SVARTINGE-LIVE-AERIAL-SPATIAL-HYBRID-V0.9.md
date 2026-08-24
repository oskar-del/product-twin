# Svärtinge live-aerial spatial hybrid v0.9

Date: 2026-08-24

Branch: `agent/plot-to-project-spatial-studio`

## Correction

The v0.8 Realistic mode used static generated reconstructions as full-screen stage backplates. Those views were clearly labelled and useful as references, but they were not a navigable spatial Twin.

V0.9 corrects that architecture:

- Realistic mode renders the live Three.js scene at every stage.
- The Norrköping municipal 2017 aerial layer is requested live and UV-registered onto the local terrain mesh.
- Roads, indicative context buildings, forest depth, plot clearing and lake context remain navigable geometry above the aerial ground.
- The four generated existing-condition views remain in the separate `Realistic view` reference gallery.
- No design, building or room is unlocked while `selected_house_profile` is null.

## Runtime pixel policy

The local development server exposes one fixed, read-only route: `/runtime/norrkoping-aerial`.

- The upstream host and WMS request are hard-coded to the existing Norrköping municipal layer receipt.
- No credentials, user-provided URL or arbitrary proxy target is accepted.
- The response is held in memory long enough to reach the browser.
- `Cache-Control: no-store`, `X-Evidence-Effect: NONE` and `X-Pixel-Persistence: MEMORY_ONLY` are returned.
- No response bytes are written to the repository or runtime folders.
- Failure returns a procedural fallback and does not block the evidence Twin.

The layer label `2017` is a municipal service title. It is not promoted to a verified imagery capture date. Publication and imagery-origin reconciliation remain open.

## Evidence effect

The live drape improves visual grounding only. It does not verify or close:

- the legal cadastral boundary or registered area
- surveyed terrain or spot levels
- legal access
- planning entitlement or buildable envelope
- utilities or capacity
- building placement, finished-floor level, design, room or construction geometry

## Acceptance

The validator requires the main Realistic profile to remain navigable, rejects any return to full-screen geometry-replacing backplates, verifies the fixed municipal route and no-store headers, and rejects server-side pixel persistence code.
