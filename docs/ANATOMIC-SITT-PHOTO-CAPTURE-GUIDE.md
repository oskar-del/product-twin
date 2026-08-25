# Anatomic SITT → Product Twin · photo capture & run guide

**Goal:** turn one owned Anatomic SITT (Zitzi) product into a scale-verified 3D avatar. This is the permission-light, zero-external-dependency route (audit priority #1). Anatomic SITT is Oskar's family firm, so reconstruction/render rights clear with one signed internal authorization — no manufacturer cold-outreach.

Everything in the repo is already built. To run, you supply exactly three things:

1. **Photos** of the real product (5 required views + extra orbit frames).
2. **Measurements** — width, depth, height in millimetres, with a photo of the tape.
3. **`MESHY_API_KEY`** as an environment variable.

Pre-QA ceiling is **G2** (visual + scale). G3 (exact-product claim) needs the multi-view QA pass + confirmed exact SKU + signed rights scope. Photo capture never grants engineering-interface (G4) authority.

---

## Step 0 — pick the subject

The controlled-capture contract wants *one stationary opaque product with distinct features and no dominant transparent/reflective surface*. Zitzi Delfi Pro is adjustable foam/fabric/straps — usable, but for the **first** reconstruction prefer a rigid, matte, camera-friendly subject:

- ✅ good first subjects: a rigid moulded seat shell in a **frozen** configuration, a tray/table accessory, a rigid headrest, a rigid base/frame.
- ❌ avoid for the first run: glossy or transparent dominant surfaces, loose straps hanging mid-air, and **changing any adjustment during the photo orbit**.

Freeze every adjustment before you start. The object must be identical in all photos.

## Step 1 — capture the photos

Setup:
- **Background:** plain, non-reflective, visually distinct from the object (a matte wall / seamless sheet).
- **Lighting:** soft, even, fixed. No moving shadows between shots. Turn off anything that flickers.
- **Camera:** fixed focal length if possible; keep the *whole* object in frame every shot; don't zoom between shots.

Shoot these **5 required views** (the pipeline blocks without all five):

| view | where you stand |
|---|---|
| `front` | directly in front |
| `rear` | directly behind |
| `left` | directly to its left |
| `right` | directly to its right |
| `three_quarter` | 45° corner, showing front + one side + top |

Then shoot **8–16 extra orbit frames** all the way around (and a few higher/lower angles). More overlap = better reconstruction. These extras are for QA and reconstruction quality even though the Meshy request itself uses at most 4 inputs.

## Step 2 — measure

With a tape, measure the **overall bounding box** in millimetres:
- **width** (left→right), **depth** (front→back), **height** (floor→top).

Photograph the tape against each axis. Registry "internal width" is **not** the full envelope — measure the real object.

## Step 3 — clear the rights (one-time)

Anatomic SITT is the family firm, so this is a signature, not a negotiation.

1. Open `docs/legal/anatomic-sitt-reconstruction-authorization.md`.
2. Have an authorised signatory at Anatomic SITT AB (org 556411-7348) sign it. **No supplier email goes out without Oskar's explicit go.**
3. Save the signed copy (PDF/scan) and reference it in the job's `rights.evidence_refs`.

Until a signed authorization exists, keep `redistribution_allowed: "review"` and the generated GLB stays runtime-only.

## Step 4 — host the images at temporary HTTPS URLs

The reconstruction service reads images by URL, so each of the 5 cleared views needs a **temporary `https://` URL** it can fetch. Source images are **not** copied into the repo. Use any private temporary host you control (expiring links preferred). Delete the links after the run.

## Step 5 — fill the job file

1. Copy the template into the gitignored runtime folder:
   ```bash
   mkdir -p .runtime/avatars
   cp config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json .runtime/avatars/zitzi-delfi-pro.json
   ```
2. Edit `.runtime/avatars/zitzi-delfi-pro.json` and fill every `<<FILL ...>>`:
   - `job_id`, exact `model` + `sku`
   - the 5 image `source_uri_or_reference` HTTPS URLs
   - `rights.evidence_refs` → the signed authorization reference
   - `dimensions.width_mm / depth_mm / height_mm` as **numbers** (no quotes) + `evidence_ref`
3. **Do not** put the Meshy key in this file.

## Step 6 — preflight (no key, no cost)

```bash
export AVATAR_JOB=.runtime/avatars/zitzi-delfi-pro.json
npm run avatar:photo:preflight
```
This must print `"status": "PASS"` (13 checks). If it prints `BLOCKED`, `blocked_check_ids` tells you exactly what is missing (missing view, non-HTTPS URL, unmeasured scale, missing rights evidence, etc.). Fix and re-run. Costs nothing.

## Step 7 — generate (needs the key)

```bash
export MESHY_API_KEY=...        # environment only, never in a file or chat
npm run avatar:photo:run
```
Output: `SUCCEEDED_REQUIRES_QA`, GLB written to `.runtime/avatars/<job_id>/model.glb`. Source images are never copied into the repo; only minimal status/QA metrics persist. Max claim before QA is **G1/G2**.

## Step 8 — QA & human acceptance

Re-render the GLB from each captured view and fill a QA report (see `config/geometry/qa-evidence-templates/` for the shape), then:
```bash
export PHOTO_AVATAR_QA=.runtime/avatars/<job_id>-qa.json
npm run avatar:photo:qa
```
Thresholds (`config/geometry/photo-avatar-qa-contract.json`): all 5 views compared; ≤12% per-view / ≤8% mean silhouette error; ≤15% per-view / ≤10% mean landmark error; **each axis ≤3% off measured scale**; ≥70% observed surface; ≤10% unresolved; coverage sums to 100; explicit render rights; human acceptance. A PASS means the **visual + scale** experiment passed at G2 — it does **not** establish exact manufacturer or engineering geometry.

## Step 9 — promotion to G3 (separate, deliberate)

G3 exact-product claim additionally requires: `identity_state=verified` (exact SKU of the captured unit confirmed) and recorded written render/derivative/storage scope from the signed authorization. Promotion is a human decision, never automatic.

---

## What is already built (so you only bring photos + measurements + key)

| piece | file |
|---|---|
| target definition | `config/geometry/anatomic-sitt-zitzi-delfi-pro-target.json` |
| runtime job template | `config/geometry/intake/anatomic-sitt-photo-avatar-job.template.json` |
| capture contract | `config/geometry/photo-avatar-controlled-capture.json` |
| job schema | `config/geometry/photo-avatar-job.schema.json` |
| preflight gate | `npm run avatar:photo:preflight` |
| generation | `npm run avatar:photo:run` |
| QA gate | `npm run avatar:photo:qa` + `config/geometry/photo-avatar-qa-contract.json` |
| rights authorization template | `docs/legal/anatomic-sitt-reconstruction-authorization.md` |

Verified wiring proof (synthetic job, no real photos/key): see `docs/handoffs/AVATAR-FACTORY-CLAUDE.md` → "P1 end-to-end proof".
