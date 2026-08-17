# Visual Media Studio — Persistent Chat Handoff

## Role

This is the long-lived workstream for truthful, repeatable imagery and video from Site, Design, Room, Product Twin and Design Asset scenes. It owns visual direction, deterministic media contracts and provider-backed generation when the evidence and rights gates allow it.

Repository branch: `agent/visual-media-studio-v1`

Isolated worktree baseline: Product Twin `4a32e4cc397bffb3a665ceae2d4fe3e4d5c12143`. The originally named checkpoint `c90c72c` could not be resolved locally or on the repository remote; it must not be claimed as the base.

## Owns

- deterministic camera, lens, lighting and shot manifests;
- canonical stills for plots, buildings, rooms and products;
- walkthrough paths, storyboards and edit timelines;
- render, image-to-video and hybrid pipelines;
- provider model, version, prompt, seed, cost and reproducibility records;
- visual continuity and source-scene comparison;
- concept, G2 proxy, reconstructed and exact-product disclosures;
- publishable derivatives only where source and model rights permit them.

## Does not own

- geometry acquisition or G-level promotion;
- site, planning, terrain or building truth;
- product price, stock, delivery or procurement claims;
- Room Lab interaction logic;
- final approval of its own fidelity or rights claims.

## Starting truth

- Residential G2 assets are dimension-verified planning proxies with simplified material cues, not exact photorealistic likenesses.
- Generic Design Assets remain separate from Product Twins and never inherit SKU, price, stock, supplier, checkout or procurement data.
- Shopify and manufacturer media may have unresolved display, derivative or publication rights.
- CANOPUS presentations are creative references, not measured BIM, surveyed terrain or planning evidence.
- Credentials and mutable provider payloads stay outside Git and chat.

## First milestone

Create one reproducible Room Lab media proof from a frozen scene:

1. versioned scene, camera/shot, render/generative job, output, rights, fidelity and cost contracts;
2. six canonical QA cameras and one hero camera;
3. a 15–30 second deterministic living-room camera path;
4. controlled still/video outputs before any generative enhancement;
5. provider experiments only after rights, credential and cost preflight;
6. fail-closed comparison against source geometry, placement identity and quantity.

## First contract slice

The Room Lab v9 contract bundle lives at `data/media/room-lab/v0.1/`. It is bound to immutable Room Lab source commit `3d36f07c32e42b168a74c5bc03a263e8c63e6eab`, four source-file digests, and the eight canonical Product Twin G2 asset digests.

Current state:

- scene, camera, storyboard, rights, deterministic render, optional provider test, output, fidelity-QA and cost records are defined;
- six QA stills, one hero still and a 20-second / 24 fps / 480-frame camera-only control are planned, not rendered;
- the assumed 6.0 × 4.6 × 2.8 m shell remains explicitly non-surveyed;
- the garden-window representation is an assumed visual overlay on an intact wall, not an authoritative opening;
- every output is G2 planning-preview-only and forbids an exact-product claim;
- the optional Replicate test is blocked: provider-processing rights are `REVIEW`, the immutable model version is absent, credentials are not configured, and direct-3D control frames do not exist;
- no output is approved for Room Lab consumption or publication.

Run the fail-closed gate with:

```sh
npm run media:room-lab:test
npm run media:room-lab:validate
git diff --check
```

The test suite includes an exact passing fixture and deliberate transform, identity, asset-hash, source-lane, opening, rights, cost, reviewer-independence, provider and output-binding failures.

## Boundaries

- Never present a G2 proxy as an exact photographed Product Twin.
- Never remove source, rights or attribution metadata from derivatives.
- Never let verification media alter room dimensions, placements, openings or quantities.
- Never publish generative output as surveyed, built or exact without evidence.
- Never commit credentials or mutable provider responses.
