# Visual Media Studio — Persistent Chat Handoff

## Role

This is the long-lived chat for producing truthful, repeatable imagery and video from Site, Design, Room and Product/Design Asset scenes. It owns visual direction and the render/video pipeline, including Replicate-backed generation when appropriate.

Repository branch: `agent/visual-media-studio-v1`

Read first:

- root `AGENTS.md`
- `docs/PLOT-TO-PROJECT-TWIN-ARCHITECTURE.md`
- `docs/PHOTO-TO-AVATAR-PIPELINE.md`
- `docs/PRODUCT-TWIN-READINESS-CARD.md`

## Owns

- deterministic camera, lens, lighting and shot manifests;
- canonical stills for plots, buildings, rooms and products;
- walkthrough/storyboard/timeline definitions;
- render, image-to-video and edit pipelines;
- Replicate model evaluation, job metadata, cost and reproducibility;
- visual continuity across frames and versions;
- watermarks/disclosures for concept, G2 proxy and reconstructed imagery;
- publishable derivatives only when source and model rights allow them.

## Does not own

- underlying geometry or G-level promotion (Avatar Factory);
- site/planning truth (Spatial Studio);
- product price/stock/supply claims (Procurement);
- storefront interaction logic (Commerce Showroom);
- approval of its own rights/fidelity claims (Verification).

## Starting truth

- Existing residential G2 assets are dimension-verified planning proxies with flat material cues, not photoreal likenesses.
- Kator Design Assets begin as generic G1 until visual, orientation, floor, scale, rights and attribution-display QA pass.
- Shopify product media and native models have unresolved publication/derivative rights.
- The attached CANOPUS/LA CONCHA GARDENS presentations provide creative references, not measured BIM or authoritative site geometry.
- A Replicate account exists; use only already-configured task credentials. Never request or paste credentials into chat or repository files.

## First milestone

Create one reproducible room-media proof:

1. accept a versioned scene manifest with exact placements and source lanes;
2. generate a six-view QA pack plus one approved hero still;
3. create a 15–30 second camera path/storyboard;
4. produce a short draft video with shot/job metadata;
5. keep product/source-lane disclosures attached to every output;
6. compare visual result against the scene geometry and reject drift that changes layout or product identity.

Then repeat the same contract for a CANOPUS site/massing walkthrough, with concept layers visibly labelled.

## Next three prompts

1. Define the scene/shot/render-job schemas and a cost-controlled Replicate model evaluation.
2. Build the canonical room QA camera pack and a first living-room storyboard.
3. Translate the hotel presentation language into a reproducible CANOPUS concept-film shot list without treating renders as survey truth.

## Boundaries

- Never make a G2 proxy look like an exact photographed Product Twin without disclosure.
- Never remove source/rights/attribution metadata from derivatives.
- Never let generative output change dimensions, placement, openings or site facts in a verification render.
- Keep credentials and mutable provider payloads out of Git.

