import fsp from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertGenericDesignAsset} from './lib/design-asset-truth.mjs';
import {REQUIRED_PUBLICATION_GATES, validatePublicationContract} from './lib/design-asset-publication.mjs';
import {loadTaxonomyResolver} from './lib/taxonomy-aliases.mjs';

export {REQUIRED_PUBLICATION_GATES, validatePublicationContract};

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fsp.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function buildDesignAssetIndex({root = process.cwd(), env = process.env} = {}) {
  const [pilot, intake, conversion, promotion, contract, resolveCategory] = await Promise.all([
    readJson(path.join(root, env.DESIGN_ASSET_PILOT ?? 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'), {candidates: []}),
    readJson(path.join(root, env.DESIGN_ASSET_INTAKE ?? 'data/metrics/sweet-home-3d-design-asset-intake-latest.json'), {assets: []}),
    readJson(path.join(root, env.DESIGN_ASSET_CONVERSION ?? 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'), {assets: []}),
    readJson(path.join(root, env.DESIGN_ASSET_PROMOTION_METRIC ?? 'data/metrics/design-asset-promotion-latest.json'), {assets: []}),
    readJson(path.join(root, env.DESIGN_ASSET_PUBLICATION_CONTRACT ?? 'config/geometry/design-asset-publication-contract-v0.1.json'), {}),
    loadTaxonomyResolver(root),
  ]);
  const publicationGates = validatePublicationContract(contract);
  const intakeById = new Map((intake.assets ?? []).map((item) => [item.design_asset_id, item]));
  const conversionById = new Map((conversion.assets ?? []).map((item) => [item.design_asset_id, item]));
  const promotionById = new Map((promotion.assets ?? []).map((item) => [item.design_asset_id, item]));
  const assets = (pilot.candidates ?? []).map((candidate) => {
    const ingested = intakeById.get(candidate.design_asset_id);
    const converted = conversionById.get(candidate.design_asset_id);
    const decision = promotionById.get(candidate.design_asset_id);
    if (!decision) throw new Error(`${candidate.design_asset_id}: computed promotion decision is required`);
    if (converted && decision.geometry_sha256 !== converted.sha256) throw new Error(`${candidate.design_asset_id}: promotion decision does not match converted GLB hash`);
    const attribution = ingested?.attribution ?? {
      creator: pilot.source?.creators?.join(' & ') ?? null,
      text: candidate.license?.attribution_text ?? null,
      license_id: candidate.license?.spdx_like ?? null,
      source_url: candidate.license?.source_reference ?? null,
      display_required: candidate.license?.attribution_required === true,
    };
    const gates = decision.gates;
    if (!gates || publicationGates.some((gate) => typeof gates[gate] !== 'boolean')) throw new Error(`${candidate.design_asset_id}: promotion decision must compute all publication gates`);
    const publicationAllowed = publicationGates.every((gate) => gates[gate] === true)
      && typeof decision.public_asset_reference === 'string';
    if (publicationAllowed !== decision.publication_allowed) throw new Error(`${candidate.design_asset_id}: promotion publication decision is inconsistent with the nine gate set`);
    const asset = {
      design_asset_id: candidate.design_asset_id,
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      source_model_name: candidate.source_model_name,
      category_id: resolveCategory(candidate.category_id),
      geometry_state: decision.geometry_state,
      publication_state: decision.publication_state,
      publication_allowed: publicationAllowed,
      public_asset_reference: publicationAllowed ? decision.public_asset_reference : null,
      attribution,
      gates,
      promotion_evidence_state: decision.evidence_claim_status,
      promotion_blockers: decision.blockers,
      runtime_binary_retained_outside_repository: Boolean(converted?.runtime_glb_path),
    };
    return assertGenericDesignAsset(asset, `design_asset_index.${candidate.design_asset_id}`);
  });
  const index = {
    generated_at: new Date().toISOString(),
    record_lane: 'GENERIC_DESIGN_ASSET',
    visible_attribution_contract: contract.visible_attribution,
    publication_gates: publicationGates,
    summary: {assets: assets.length, publishable: assets.filter((item) => item.publication_allowed).length, runtime_only_or_unpublished: assets.filter((item) => !item.publication_allowed).length},
    assets,
  };
  const outputPath = path.resolve(root, env.DESIGN_ASSET_INDEX ?? 'data/metrics/design-asset-index-latest.json');
  const metricRoot = path.resolve(root, 'data/metrics');
  if (!(outputPath === metricRoot || outputPath.startsWith(`${metricRoot}${path.sep}`))) throw new Error('Design Asset index must remain under data/metrics');
  await fsp.mkdir(path.dirname(outputPath), {recursive: true});
  await fsp.writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await buildDesignAssetIndex(), null, 2));
