# Platform & 3D Engine — Claude Session Handoff

## Why this session exists
Three workstreams are each building their own three.js viewer (Svärtinge twin, Essence microsite, Avatar showroom) plus four legacy prototypes. That's the same engine written five times. This session owns the SHARED technology so every surface gets the best stack once: one twin-engine, one design system, one bundling/publish pipeline.

- Repository: `oskar-del/product-twin` · Branch: **`agent/platform-engine`** (create from main)
- Worktree: `git worktree add "../repo-platform" -b agent/platform-engine origin/main` — work ONLY there.
- Read first: `AGENTS.md`, `docs/OPENAI-ERA-AUDIT-2026-08-18.md`, `docs/VALUE-STORY-AND-IDEA-LEDGER.md`, the three viewer implementations (`prototype/svartinge-neighbourhood/`, `prototype/showroom/`, Essence branch), and the Gemini harvest verdict in the ledger.

## Owns
- **twin-engine**: one reusable module (scene graph, evidence-class layers, camera presets/tweens, INTELLIGENCE/REALISTIC/COMPARE/SYSTEMS profiles, terrain mesh loader for LM COG/DEM, OSM/vector context extrusion, Mapbox context layer, clickable-object → panel contract, availability-status coloring, sun/time, viewshed overlay).
- **Stack decisions with evidence**: three.js vs alternatives, 3d-tiles-renderer, COPC/point-cloud viewing, gaussian splats (parked-watch), state management, perf budgets (mobile!), embed/iframe architecture, artifact-vs-deploy bundling (esbuild single-file = proven pattern).
- **Design system for buyer surfaces**: H&H light/serif aesthetic tokens + the locked showroom language (white modular furniture, round + hotspots, real-listing header card) as reusable UI components.
- **Publish pipeline**: one command from scene-data → bundled self-contained HTML → artifact link or safe_deploy target.

## Does NOT own
Product decisions (Brain), evidence/G-promotion (Avatar Factory + Verification), site truth (Spatial), client scope (Essence). It serves them.

## First milestones
1. **Audit the five viewers** → extraction plan: what becomes twin-engine v0.1 (probably the Svärtinge viewer core, generalized).
2. **twin-engine v0.1** consumed by ONE surface (Essence microsite is nearest) without regressions — gate: its validators still pass.
3. **Bundle command**: `npm run engine:bundle -- <scene>` → self-contained HTML (the manual esbuild dance from 2026-08-18, automated).
4. **Perf budget doc**: target devices, poly/texture budgets per surface class (twin / microsite / showroom / portal).

## Rules
One checkout = one executor. Deliverable-first: every block ends with something visible or a merged reusable module. Decisions >scope → Brain. Never edit other worktrees or `~/.codex/`.

## Current state
- 2026-08-19: seeded by Brain. Nothing built.
