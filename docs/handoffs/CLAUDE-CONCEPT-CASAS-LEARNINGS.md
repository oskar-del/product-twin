# Claude workstream — plot-to-project + media pipeline learnings
*Branch: `agent/claude-concept-casas`. Source: Claude "project creation" session (Aug 13–18, 2026), which ran a
full plot→project cycle on a private resort study. All client/deal specifics stay in the private vault; this doc
carries only the transferable engineering + process learnings, for any workstream (esp. visual-media-studio and
plot-to-project-spatial-studio).*

## What was proven end-to-end (private study, scripts reusable)
Cadastral boundary (Catastro INSPIRE + OVC) → 5 m LiDAR terrain (IGN MDT05 via IDEE WCS, cross-validated vs
EU-DEM <1 m) → sightline + solar analysis that GENERATED the design rules → parametric massing on real terrain →
image-to-video motion clips (Replicate) → edited film with synthesized score → presentation factory (reportlab).
Every design decision traced to a measurement; every figure source-tiered (OFFICIAL/MEASURED/SELLER/ASSUMPTION).

## Media pipeline — hard-won rules (visual-media-studio should adopt)
1. **Prompt order decides output**: lead image-to-video prompts with SCENE LIFE ("people walk, light shifts,
   water moves"), camera move LAST. Camera-first prompts return a moving camera over a frozen world.
2. **Compose the still FOR its camera move**: lateral track needs a sideways subject; arc needs an off-centre
   doorway; tilt needs a vertical stack. Free, and beats model upgrades.
3. **Model choice**: measure what the viewer reacts to, not proxies. Raw pixel displacement rewarded shake and
   teleporting people. Correct check = independent motion with camera movement subtracted, PLUS human/vision-model
   review of actual playback. A metric where BAD output scores well is worse than none.
4. **Model-per-shot-type budgeting**: premium model for hero moves, mid tier for pushes, cheapest for ≤2 s
   cutaways. Downgrade the tier, never the composition.
5. ffmpeg traps: `zoompan` preserves frame count (put `fps=` first); xfade offsets need MEASURED durations or the
   chain collapses; never feed annotated images to generative models (produce clean + annotated variants).

## Verification protocol (repo AGENTS.md-compatible)
- "Checked" = the artefact was OPENED AND LOOKED AT. Frame extraction is not watching video.
- Validate every automated checker against one known-good and one known-bad case before believing it.
- Build QC as a vision-model agent flow scoring explicit criteria (warping, implausible motion, jitter,
  collisions, scene life, identity preservation). Nothing ships unpassed.

## Deliverable discipline
- Build documents from a REQUIRED-CONTENTS template, never from whatever assets exist. Assert: all required pages
  present, no image reused, every claim traceable, containers not overflowed — then rasterize and LOOK.
- The "what is known / what is open" page is the most persuasive page in any client document. Publish the gaps.

## Proposed next workstream: `agent/essence-moraira-pilot`
**Scope (locked 2026-08-18): SPATIAL SHOWCASE ONLY — no commerce, no furniture, no design changes.** A real
builder's live multi-villa off-plan project becomes the demo of the plot-to-project spatial flow: real plots
(cadastre) → real terrain (LiDAR) → 3D massing of THEIR villas from THEIR floorplans on the real street →
measured inter-villa sightlines, sun, privacy → neighbourhood film + optional interactive street viewer
(Svärtinge 7-stage viewer is the direct precedent — this is its Spanish sibling). Their designs are fixed input;
their photos used wherever real assets exist; generative media only for what cannot exist yet. Commerce/avatar
integration is explicitly a LATER phase, not this pilot.

## Claude ⇄ Codex sync protocol
GitHub = only shared truth. Claude works in its own clone (not the Codex worktrees), one branch per WORKSTREAM
(same `agent/*` convention), push/pull often, evidence-bearing claims only. Public repo: no client identities,
prices, parcel references or deal specifics — generalized learnings and scripts only.
