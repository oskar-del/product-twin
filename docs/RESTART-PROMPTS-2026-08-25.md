# Fleet restart prompts — corrected 2026-08-25 evening (paste each into its session)

The four prompts Oskar held from the old handoff were pre-sweep and are superseded:
BRAGE's and Spatial's asks are already DONE, Avatar's would re-run a builder that
contains a regression, Platform's misses a review it owes. These versions are grounded
in the verified fleet state (docs/FLEET-STATE-2026-08-25.md). MIMER + Essence keep
their SESSION-GOALS.md texts unchanged.

## → BRAGE
STATE: your three-house presentation is FINISHED and published (artifact
"Tre hus för Svärtinge 54:28", d795ea4f — verified current). All three houses have
equal 6-drawing sets; B Vinkelhuset carries your recommendation. Both your commits are
pushed. GOAL: (1) stand by for Oskar's winner call — your recommendation stands;
(2) the moment the winner is called, build what your own footer promises: the winner's
full ritningsuppsättning (four facades, details, materialspecifikation) → hand geometry
to Essence's floorplan→dollhouse pipeline and to Spatial's design-selector mount
(spec: your geometry/house-v0.2-geometry-spec.json already covers all three);
(3) while waiting: draw House A's missing undervåning plan — the only gap in the set.
After Svärtinge: the 10-type Swedish classics library. Commit every block; Oskar pushes.
Re-read this goal every resume.

## → Avatar Factory
⛔ DO NOT re-run the proxy builder — your last commit (7f72563, pushed) claims "twins
already ≥G2 skipped" but actually DOWNGRADED 11 twins that had richer geometry:
9 material-cued IKEA GLBs (LISTERBY, POÄNG, KIVIK among them) + NORR11 FAVE and
Wendelbo ATLI native GLBs, replaced with generic category-colour proxies. The richer
files still sit in data/geometry/avatars/. GOAL: (1) fix-forward in one commit —
re-point the 11 twin JSONs to their richer GLBs, fix the skip logic in
scripts/build-all-proxies.mjs to detect existing material-cued/native geometry, make
avatar-index.json counts derived; (2) pre-wire Adtraction tracked-link wrapping in
scripts/backfill-commerce.mjs behind a config flag (affiliate_link is hardcoded null
at line 49 — approval day must equal backfill day) and backfill EANs from the IKEA
feed rows you already hold (ean is 2/203); (3) then resume the factory toward 500+,
measured in avatars/day. Full mandate: your pinned CURRENT MANDATE 2026-08-25 in
docs/handoffs/AVATAR-FACTORY-CLAUDE.md. Never build app surfaces. Commit every batch;
Oskar pushes. Re-read this goal every resume.

## → Platform & 3D Engine
STATE: 341 checks re-proven green 2026-08-25; perf work verified real. NEW ITEM YOU
DON'T KNOW ABOUT: Spatial Studio drafted docs/DESIGN-SELECTOR-MOUNT-CONTRACT.md
(branch agent/spatial-studio-claude, "Status: DRAFT for Platform review") and is
blocked on your review — BRAGE's three-house geometry spec already exists, so your
freeze is the only thing between the designs and the land. GOAL, in order:
(1) review + freeze the mount contract (~1 hour); (2) consume the avatar twin library —
glTF/GLB loader + SYSTEMS profile so data/twins records render as contract-valid scene
elements, retiring the legacy showroom viewer; (3) absorb the Site Intelligence page
pattern (on main) as the standard template; (4) make the integration gate's hard-coded
"expected 9 stale blockers" derived (grep fix already on branch fix/gate-grep-fallback).
Then your deferred list. Pinned mandate: docs/handoffs/PLATFORM-ENGINE.md. One command
from scene to published page. Commit every block; Oskar pushes. Re-read every resume.

## → Spatial Studio
STATE: COMPARE is built and on origin; your handoff session entry was committed by
Brain and pushed — do not re-write it. The untracked empty package-lock.json in your
worktree is noise; delete it. GOAL: (1) the BRAGE mount — Platform has been mandated
to review/freeze your DESIGN-SELECTOR-MOUNT-CONTRACT.md; implement
mountDesign()/clearDesign() the moment it's frozen and mount all three Svärtinge
designs (spec: BRAGE's geometry/house-v0.2-geometry-spec.json) so buyers compare real
designs on the land. If Platform hasn't reviewed within one work block, flag Brain.
(2) fold COMPARE + OpenAI's Site Intelligence rebuild into ONE canonical experience —
no forked looks; (3) every pixel honest. You win when a visitor explores 5 minutes and
believes everything. Commit every block; Oskar pushes. Re-read every resume.
