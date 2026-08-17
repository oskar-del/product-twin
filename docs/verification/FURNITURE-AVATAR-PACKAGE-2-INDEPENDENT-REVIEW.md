# Furniture Avatar Manifest v0.1 — independent Package #2 review

## Release vote

`BLOCK`

- Package acceptance: `BLOCK`
- Manifest-Driven Room Alpha promotion: `BLOCK`
- Public publication: `BLOCK`
- Source reviewed: `agent/avatar-factory-source-graph` at `c6b227654f312561415388efb0fe06d1401f8b86`
- Package reviewed: `data/verification/packages/furniture-avatar-manifest-v0.1-package-2.json`
- Machine result: `data/verification/reports/furniture-avatar-manifest-v0.1-package-2-independent-result.json`

This vote does not reject the four committed GLBs. It rejects the current evidence and promotion contract. All four primary GLBs pass independent hash, byte-count, transformed-world-bounds, floor-contact, and centred-pivot checks. Those technical passes cannot waive schema, provenance, orientation, functional-clearance, rights, attribution, or visual-assessment failures.

## Observed evidence

The following is directly reproduced from the exact source commit:

| Evidence | Independent result |
| --- | --- |
| Package artifact hashes | 46/46 pass |
| Primary GLB manifest-to-binary binding | 4/4 pass |
| Independent transformed GLB dimensions | 4/4 pass within 0.1% |
| Floor contact and X/Z floor pivot | 4/4 pass |
| Canonical view hashes | 28/28 pass |
| Contact-sheet hashes | 5/5 pass |
| Producer Package #2 tests | 3/3 pass |
| Deterministic QA re-render | byte-clean |
| Config/data JSON parsing | 240/240 pass |
| Producer branch test files | 22 pass; 1 cannot reproduce without absent gitignored Design Asset runtime input |
| Independent mutation attacks | 22/22 rejected |

The four primary records remain Product Twins, not Design Assets. They contain verified exact IKEA article identities coupled to explicitly non-exact project-authored planning proxies. No price, stock, supplier, delivery, procurement, destination, or market record is present in the furniture manifest. No Spanish supply observation is inherited by Sweden, Great Britain, or the United States.

The Arper Ply 3853 record remains correctly blocked: no persistent runtime binary, approved public rendering/redistribution right, approved finish, verified functional clearance, or authorized attribution display exists.

## Deterministic blockers

### 1. The manifest is invalid against its own strict schema

The schema requires `placement`, `dimensional_confidence`, `appearance`, `provenance`, `rights`, `attribution`, `publication`, and `verification_required`, but accidentally nests their schemas beneath `functional_clearance` instead of `$defs.asset.properties`. Because the asset has `additionalProperties: false`, every one of those required fields is simultaneously forbidden. This produces 40 `UNKNOWN_FIELD` failures plus `MANIFEST_SCHEMA_ASSET_PROPERTIES_MISNESTED`.

The producer test calls its handwritten semantic validator; it never validates the manifest against the published JSON Schema. A producer test pass is therefore not evidence that the declared schema contract passes.

### 2. Package identity and evidence freshness are not bound

The package has no `source_commit`, `generated_at`/`observed_at`, or `freshness_state`. Its strict schema also has no place for those fields. The verifier could fetch the Brain-specified commit, but the package cannot prove that it refers to that commit.

The Product Twin records cite official product URLs and dimensions but do not bind an observation time and freshness state into the dimensional-evidence record. The repository starter pack has an `observed_at` date, but it is not part of the manifest provenance chain. Therefore G2 is not being accepted merely because the generated binary matches a declared envelope.

### 3. Directional canonical views are reversed and under-specified

For the sofa and lounge chair, the manifest declares front as `[0, 0, -1]`. The furniture renderer negates that vector and passes `[0, 0, +1]` as the camera side. The shared renderer then places the eye on that side. The result is labelled `front`, even though it observes the opposite side.

The visual evidence confirms the defect: the KIVIK sheet labels the smooth sofa back as `front` and the cushion side as `rear`. The QA metric also omits a `camera_side_vector`, so a consumer cannot deterministically prove which side each image observes. Both directional assets fail `CANONICAL_FRONT_REAR_LABEL_REVERSED` and `ORIENTATION_VIEW_CAMERA_EVIDENCE_MISSING`.

The furniture renderer imports `scripts/render-design-asset-qa-pack.py`, but Package #2 does not include that dependency in its artifact hashes. It therefore also fails `QA_RENDERER_DEPENDENCY_UNBOUND`.

### 4. The requested visual assessment is incomplete

The review records orientation, floor contact, dimensions, a combined material/texture statement, front/back, collision envelope, attribution, and rights. They do not provide the requested structured assessments for silhouette, colour, transparency, texture/UV quality, roughness, or visible defects. Six missing axes across four primary assets produce 24 `VISUAL_QA_AXIS_MISSING` failures.

This does not mean the images are unusable. It means the committed evidence does not support the claimed completed visual-assessment contract.

### 5. Functional-clearance distances are declarations, not envelopes

The four primary assets expose role/distance pairs such as `FRONT_APPROACH: 700 mm` or `CIRCULATION: 600 mm`. They do not define a shape, reference frame, anchor/direction, or a verified clearance state. Room Lab cannot deterministically turn those values into hard collision/functional constraints without inventing semantics.

All four assets therefore fail `FUNCTIONAL_CLEARANCE_UNVERIFIED`; the five declared zones fail `FUNCTIONAL_CLEARANCE_ENVELOPE_INCOMPLETE`.

### 6. Public rights and attribution remain blocked

All four project-authored proxies correctly set `public_allowed: false`. Independent public rights approval is absent, and attribution has not been verified on every required Room Lab surface. Public publication therefore remains blocked for all four. Internal-project proxy permission is not public rendering or redistribution permission.

## Asset decisions

| Asset | Binary geometry | Room Alpha promotion | Public |
| --- | --- | --- | --- |
| KIVIK sofa proxy | PASS | BLOCK | BLOCK |
| POÄNG lounge-chair proxy | PASS | BLOCK | BLOCK |
| LISTERBY coffee-table proxy | PASS | BLOCK | BLOCK |
| LAUTERS floor-lamp proxy | PASS | BLOCK | BLOCK |
| Arper Ply 3853 candidate | BLOCK — no persistent runtime binary | BLOCK | BLOCK |

No asset from Package #2 is eligible for manifest-driven Room Alpha promotion yet. The four primary binaries are suitable inputs for a corrected verification resubmission; this is not the same as promotion approval.

## Exact next Avatar Factory submission

The next package (Package #7 if that numbering remains assigned by the Brain chat) should contain:

1. A corrected, version-bumped manifest schema that actually permits every required asset field and rejects unknown fields.
2. Exact `source_commit`, package `generated_at`, evidence `observed_at`, and `freshness_state` fields in both schema and records.
3. Product Twin dimensional evidence records binding source URL, observation time, content hash, and freshness state; supply evidence must remain outside this manifest.
4. A hash for every renderer dependency, including `scripts/render-design-asset-qa-pack.py`.
5. Re-rendered directional canonical views with the camera placed on `front_vector`, plus explicit `camera_side_vector` metadata and a new independent visual review.
6. Structured scores/results for orientation, floor contact, silhouette, colour, transparency, texture/UV quality, roughness, and visible defects for each promoted avatar.
7. Verified functional-clearance envelopes with shape, reference frame, anchor/direction, and dimensions. Keep these separate from collision envelopes.
8. The four GLBs and their independent measurement metrics bound into the package artifact inventory.
9. Public state still set to blocked unless independent rights approval and attribution display on every required surface are separately evidenced.
10. A self-contained test invocation or an explicit fixture acquisition step for the currently missing gitignored Design Asset runtime input.

Room Lab should receive the corrected manifest, corrected QA metric/review, four exact GLB hashes, and clearance-envelope semantics. It should not receive or infer price, stock, supplier, delivery, procurement, or cross-market supply state from Avatar Factory.

## Reproduction

```sh
git fetch --no-tags origin c6b227654f312561415388efb0fe06d1401f8b86
npm run verification:avatar:package2
npm run verification:avatar:package2:test
npm run verification:avatar:package2:gate
git diff --check
```

The reporting command exits `0` while emitting the honest `BLOCK` result. The release-vote command exits `2` because approval is unavailable. No verifier, model, workstream, build pass, or prose judgement may waive that exit code.
