# Persistent Chat Topology

## Operating model

One long-lived Brain chat coordinates six long-lived specialist chats. Specialist chats preserve their own design history and may launch bounded subagents for parallel research, tests or implementation. Subagents do not replace the persistent chat.

The current cross-workstream milestone and numbered directives are recorded in `docs/BRAIN-CONTROL-BOARD.md` on branch `agent/product-twin-integration`. Each specialist reads that board at milestone start and after returning a checkpoint.

| Chat | Persistent branch / project | Handoff |
| --- | --- | --- |
| Brain / Product Twin Integration | `agent/product-twin-integration` | `docs/handoffs/INTEGRATION.md` |
| Avatar Factory & Source Graph | `agent/avatar-factory-source-graph` | `docs/handoffs/AVATAR-FACTORY.md` |
| Plot-to-Project Spatial Studio | `agent/plot-to-project-spatial-studio` | `docs/handoffs/CANOPUS-SITE-TWIN.md` |
| Room Lab & Commerce Showroom | Sites project `appgprj_6a822d27eeb08191ab5be5783925f742`; canonical branch handoff to be added | `docs/handoffs/ROOM-LAB.md` |
| Build, Procurement & Logistics OS | `agent/build-procurement-logistics` | `docs/handoffs/BUILD-PROCUREMENT-LOGISTICS.md` |
| Visual Media Studio | `agent/visual-media-studio` | `docs/handoffs/VISUAL-MEDIA-STUDIO.md` |
| Verification, Evidence & Monitoring | `agent/verification-evidence-monitoring` | `docs/handoffs/VERIFICATION-EVIDENCE-MONITORING.md` |

## Start a specialist chat

1. Open a new Work chat.
2. Select GitHub repository `oskar-del/product-twin` and the specialist branch above.
3. Send this first message, replacing the handoff path:

```text
This is the persistent specialist chat for this branch. Read AGENTS.md, docs/PLOT-TO-PROJECT-TWIN-ARCHITECTURE.md and <HANDOFF_PATH> completely. Confirm the exact branch/current repository state, summarize what is verified versus blocked, and continue from the handoff's first milestone. Keep this chat's decision history. Use bounded subagents only for independent work; do not delegate the ongoing product/design conversation. Do not merge to main or change another workstream's files without the Brain chat's integration decision.
```

For Room Lab, also provide the live URL and Sites IDs from its handoff so the chat attaches to the existing deployment rather than creating a second site.

## Chat responsibilities

### Brain / Product Twin Integration

Owns product direction, shared contracts, sequencing, cross-workstream decisions, merge order and final synthesis. It should keep brainstorming with the user while specialists execute.

### Avatar Factory & Source Graph

Owns commerce/source adapters, canonical product identity, images/native files/generic libraries to 3D, G0–G5, scale, materials, rights, attribution and the Product Twin/Design Asset library.

### Plot-to-Project Spatial Studio

Owns plot and neighbourhood 3D, parcel/CRS/terrain, climate, sun, views, garden inputs, planning/access evidence, AI design scenarios, building massing and building-to-room decomposition. CANOPUS is the first measured case.

### Room Lab & Commerce Showroom

Owns product discovery and shopping UX, room templates, placement and fit, exact versus generic disclosure, saved scenes, cart/RFQ/affiliate/SEO journeys and the customer-facing 3D showroom.

### Build, Procurement & Logistics OS

Owns BoM, destination supply, substitutions, lead time, landed cost, freight, customs, delivery, installation, construction packages, manufacturing/prefab/additive routes and as-built handover for ES, SE, GB and US.

### Visual Media Studio

Owns stills, cameras, shot manifests, room/product/property imagery, walkthroughs, hotel films, Replicate pipelines, visual continuity, generation cost and truthful disclosures.

### Verification, Evidence & Monitoring

Owns independent review, schemas, mutation tests, CI/release gates, evidence freshness and monitors. It never waives its own failed scripted gate.

## When to create another persistent chat

Create a new specialist only when all three are true:

1. the topic has its own long-running decisions and backlog;
2. it has a clear write surface or contract boundary;
3. keeping it in an existing chat repeatedly causes context or ownership conflicts.

Do not create separate persistent chats yet for garden intelligence, SEO, market expansion or render style. Keep them within Spatial, Commerce/Procurement and Visual Media until they meet the three tests.

## Claude-era addendum (2026-08-18)

Claude sessions joined the same repo while ChatGPT quota is out (until ~Aug 24). Same one-branch-per-workstream rule; each session uses its OWN worktree (never a shared checkout, never `~/.codex/.chatgpt-projects/`).

| Claude session | Branch | Worktree |
| --- | --- | --- |
| Product Twin Brain (coordination, merges, audits) | `agent/brain` | `repo-brain/` |
| Plot-to-Project Spatial Studio | `agent/spatial-studio-claude` | `repo-spatial-studio/` |
| Avatar Factory / Acquisition | `agent/avatar-factory-claude` | `repo-avatar-factory/` |
| Essence Moraira pilot | `agent/essence-moraira-pilot` | (own worktree) |

Standing rules added by the Brain (owner-approved):
1. **Deliverable-first** — every working block ends with a visible asset (screenshot/render/image), verified by the producing session's own eyes. Receipts accompany assets, never replace them.
2. **Decisions route to the Brain** via session message; the owner is only asked about money, external sends (emails/applications/publishing), and rights commitments.
3. **Acquisition order** (per `docs/OPENAI-ERA-AUDIT-2026-08-18.md`): permission-free routes first (photo-to-avatar on owned residential furniture, Roca/GF professional downloads, multi-merchant Shopify Model3D census, BIMobject/pCon platform applications, manufacturer value-offer). Supplier letters are the reward, not the dependency. Anatomic Sitt is out of scope (wrong domain — medtech belongs to Opero/Munin).
