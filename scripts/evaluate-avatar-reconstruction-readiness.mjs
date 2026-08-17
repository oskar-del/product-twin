import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const DEFAULTS = {
  contract: 'config/geometry/avatar-reconstruction-readiness-contract-v0.1.json',
  review: 'config/geometry/shopify-seating-reconstruction-evidence-v0.1.json',
  media: 'data/metrics/shopify-design-public-product-media-latest.json',
  focusedInspection: 'data/metrics/shopify-design-public-model3d-inspection-latest.json',
  broadInspection: 'data/metrics/shopify-furniture-model3d-inspection-latest.json',
  output: 'data/metrics/avatar-reconstruction-readiness-latest.json',
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

function materialHasNormalMap(materials) {
  return (materials?.materials ?? []).some((material) => material.normal_texture_present === true);
}

function scoreViewCoverage(observedViews, weights) {
  const unique = new Set(observedViews ?? []);
  return clamp([...unique].reduce((sum, view) => sum + (weights[view] ?? 0), 0));
}

function scoreImageQuality(media, review, weights) {
  const unique = media?.image_evidence?.unique_binary_images ?? 0;
  const reconstructionResolution = media?.image_evidence?.reconstruction_resolution_images ?? 0;
  const highResolution = media?.image_evidence?.images_1600px_or_larger ?? 0;
  const volume = Math.min(weights.volume_max, unique / 10 * weights.volume_max);
  const reconstructionRatio = unique > 0 ? Math.min(1, reconstructionResolution / unique) : 0;
  return clamp(volume + reconstructionRatio * weights.reconstruction_resolution_max + (highResolution > 0 ? weights.high_resolution_bonus : 0) + (review.isolated_background ? weights.isolated_background_bonus : 0));
}

function scoreMaterialEvidence(media, review, inspection, weights) {
  let score = 0;
  if ((review.observed_views ?? []).includes('detail')) score += weights.detail_view;
  if (review.variant_visual_binding_state === 'exact_visible_variant_bound') score += weights.exact_visible_variant_bound;
  else if ((media?.image_evidence?.images_with_variant_binding ?? 0) > 0) score += weights.variant_image_present_unresolved;
  if ((inspection?.materials?.texture_count ?? 0) > 0) score += weights.embedded_pbr_texture;
  if (materialHasNormalMap(inspection?.materials)) score += weights.embedded_normal_map;
  return clamp(score);
}

function scoreGeometryPrior(media, inspection, weights) {
  let score = 0;
  if ((media?.media_counts?.MODEL_3D ?? 0) > 0) score += weights.native_model_present;
  if (inspection?.geometry?.scale_qa?.pass === true) score += weights.manufacturer_scale_qa_pass;
  if ((inspection?.materials?.texture_count ?? 0) > 0) score += weights.embedded_texture;
  if (materialHasNormalMap(inspection?.materials)) score += weights.embedded_normal_map;
  return clamp(score);
}

function scoreRights(rights, weights) {
  let score = 0;
  score += rights.reconstruction_allowed === 'yes' ? weights.reconstruction_yes : rights.reconstruction_allowed === 'review' ? weights.reconstruction_review : 0;
  score += rights.render_allowed === 'yes' ? weights.render_yes : rights.render_allowed === 'review' ? weights.render_review : 0;
  if (rights.redistribution_allowed === 'yes') score += weights.redistribution_yes;
  return clamp(score);
}

function meetsBand(scores, band) {
  return scores.identity >= band.identity_min && scores.dimensions >= band.dimensions_min && scores.view_coverage >= band.view_coverage_min && scores.image_quality >= band.image_quality_min;
}

export function evaluateReconstructionKit({contract, reviewSet, mediaMetric, inspections}) {
  const mediaById = new Map((mediaMetric.products ?? []).map((item) => [item.candidate_id, item]));
  const inspectionById = new Map(inspections.map((item) => [item.candidate_id, item]));
  const axes = contract.axes;
  const kits = [];

  for (const review of reviewSet.products ?? []) {
    const media = mediaById.get(review.candidate_id);
    const inspection = inspectionById.get(review.candidate_id);
    const rights = review.rights ?? reviewSet.rights ?? {reconstruction_allowed: 'review', render_allowed: 'review', redistribution_allowed: 'no'};
    const scores = {
      identity: media?.status === 'LIVE_MEDIA_AUDITED' ? axes.identity.verified_product : axes.identity.unresolved,
      dimensions: axes.dimensions[review.dimension_evidence_state] ?? axes.dimensions.unknown,
      view_coverage: scoreViewCoverage(review.observed_views, axes.view_coverage_weights),
      image_quality: scoreImageQuality(media, review, axes.image_quality),
      material_evidence: scoreMaterialEvidence(media, review, inspection, axes.material_evidence),
      geometry_prior: scoreGeometryPrior(media, inspection, axes.geometry_prior),
      rights: scoreRights(rights, axes.rights),
    };

    const strongP2 = meetsBand(scores, contract.input_bands.strong_p2);
    const usableP2 = strongP2 || meetsBand(scores, contract.input_bands.usable_p2_with_limits);
    const photoInputBand = strongP2 ? 'STRONG_P2_MULTI_VIEW_INPUT' : usableP2 ? 'USABLE_P2_INPUT_WITH_LIMITS' : scores.identity >= 60 && scores.image_quality >= 35 ? 'P1_VISUAL_REFERENCE_ONLY' : 'INSUFFICIENT_INPUT';
    const generationRightsPass = rights.reconstruction_allowed === 'yes';
    const publicRenderRightsPass = rights.render_allowed === 'yes';
    const nativeModelPresent = (media?.media_counts?.MODEL_3D ?? 0) > 0;
    const route = nativeModelPresent ? 'NATIVE_MODEL_QA_AND_PHOTO_MATERIAL_ENRICHMENT_FIRST' : strongP2 ? 'MULTI_IMAGE_AI_TO_G2_CANDIDATE' : usableP2 ? 'MULTI_IMAGE_AI_WITH_ADDITIONAL_EVIDENCE_REQUEST' : 'G1_PROXY_OR_MORE_EVIDENCE';
    const queueState = !generationRightsPass ? 'NOT_QUEUED_RECONSTRUCTION_RIGHTS_REVIEW' : !publicRenderRightsPass ? 'INTERNAL_RECONSTRUCTION_ONLY' : strongP2 ? 'READY_FOR_G2_GENERATION_PREFLIGHT' : usableP2 ? 'READY_WITH_LIMITS_EVIDENCE_REVIEW' : 'HOLD_FOR_MORE_EVIDENCE';
    const blockers = [
      ...(generationRightsPass ? [] : ['reconstruction rights are not cleared']),
      ...(publicRenderRightsPass ? [] : ['public render rights are not cleared']),
      ...(scores.dimensions >= 75 ? [] : ['complete authoritative width/depth/height missing']),
      ...(scores.view_coverage >= 70 ? [] : ['multi-view coverage below strong P2 threshold']),
      ...(review.variant_visual_binding_state === 'exact_visible_variant_bound' ? [] : ['exact visible material/colour is not bound to the selected variant']),
      ['P1_VISUAL_REFERENCE_ONLY', 'INSUFFICIENT_INPUT'].includes(photoInputBand) ? 'image evidence is below P2 reconstruction threshold' : null,
    ].filter(Boolean);

    kits.push({
      candidate_id: review.candidate_id,
      identity: media?.identity ?? null,
      photo_input_band: photoInputBand,
      route,
      queue_state: queueState,
      scorecard: scores,
      observed_views: review.observed_views ?? [],
      evidence: {
        unique_images: media?.image_evidence?.unique_binary_images ?? 0,
        reconstruction_resolution_images: media?.image_evidence?.reconstruction_resolution_images ?? 0,
        images_1600px_or_larger: media?.image_evidence?.images_1600px_or_larger ?? 0,
        native_model_present: nativeModelPresent,
        manufacturer_scale_qa_pass: inspection?.geometry?.scale_qa?.pass === true,
        embedded_texture_count: inspection?.materials?.texture_count ?? 0,
        embedded_normal_map_present: materialHasNormalMap(inspection?.materials),
        dimension_evidence_state: review.dimension_evidence_state,
        variant_visual_binding_state: review.variant_visual_binding_state,
        rights,
      },
      presentation: {
        current_state: 'NO_NEW_PHOTO_RECONSTRUCTION_OUTPUT_YET',
        maximum_claim_before_generation_qa: contract.policy.maximum_photo_reconstruction_claim_before_qa,
        maximum_claim_after_v0_qa: contract.policy.maximum_photo_reconstruction_claim_after_v0_qa,
        public_presentation_allowed: false,
        disclosure: 'Input readiness is not output fidelity. Public presentation requires a generated asset, source-view rerender QA, physical-scale QA and cleared render rights.',
      },
      blockers,
      notes: review.notes ?? [],
    });
  }

  return {
    summary: {
      generated_at: new Date().toISOString(),
      contract_id: contract.contract_id,
      kits_evaluated: kits.length,
      strong_p2_inputs: kits.filter((kit) => kit.photo_input_band === 'STRONG_P2_MULTI_VIEW_INPUT').length,
      usable_p2_inputs_with_limits: kits.filter((kit) => kit.photo_input_band === 'USABLE_P2_INPUT_WITH_LIMITS').length,
      p1_visual_reference_only: kits.filter((kit) => kit.photo_input_band === 'P1_VISUAL_REFERENCE_ONLY').length,
      insufficient_inputs: kits.filter((kit) => kit.photo_input_band === 'INSUFFICIENT_INPUT').length,
      ready_for_g2_generation_preflight: kits.filter((kit) => kit.queue_state === 'READY_FOR_G2_GENERATION_PREFLIGHT').length,
      blocked_by_reconstruction_rights_review: kits.filter((kit) => kit.queue_state === 'NOT_QUEUED_RECONSTRUCTION_RIGHTS_REVIEW').length,
      public_presentation_allowed: 0,
      scoring_policy: 'Separate axis scores only; no global confidence score. Input readiness never substitutes for post-generation fidelity QA.',
    },
    kits,
  };
}

async function main() {
  const root = process.cwd();
  const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8').then(JSON.parse);
  const [contract, reviewSet, mediaMetric, focused, broad] = await Promise.all([
    read(DEFAULTS.contract), read(DEFAULTS.review), read(DEFAULTS.media), read(DEFAULTS.focusedInspection), read(DEFAULTS.broadInspection),
  ]);
  const result = evaluateReconstructionKit({contract, reviewSet, mediaMetric, inspections: [...(focused.inspections ?? []), ...(broad.inspections ?? [])]});
  await fs.writeFile(path.join(root, DEFAULTS.output), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({summary: result.summary, kits: result.kits.map((kit) => ({candidate_id: kit.candidate_id, title: kit.identity?.product_title, photo_input_band: kit.photo_input_band, route: kit.route, queue_state: kit.queue_state, scorecard: kit.scorecard, blockers: kit.blockers}))}, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
