import fsp from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertGenericDesignAsset} from './lib/design-asset-truth.mjs';
import {loadTaxonomyResolver} from './lib/taxonomy-aliases.mjs';

export const REQUIRED_PUBLICATION_GATES = Object.freeze([
  'rights_source_verified',
  'redistribution_allowed',
  'all_model_dependencies_resolved',
  'source_orientation_applied',
  'back_face_policy_applied',
  'texture_embedding_verified',
  'canonical_view_visual_qa_passed',
  'independent_scale_qa_passed',
  'attribution_display_verified',
]);

export function validatePublicationContract(contract) {
  const gates = contract?.publication_gates;
  if (!Array.isArray(gates) || gates.length === 0) throw new Error('publication contract must declare the exact non-empty publication gate set');
  const unique = new Set(gates);
  const missing = REQUIRED_PUBLICATION_GATES.filter((gate) => !unique.has(gate));
  const unexpected = [...unique].filter((gate) => !REQUIRED_PUBLICATION_GATES.includes(gate));
  if (unique.size !== gates.length || missing.length || unexpected.length || gates.length !== REQUIRED_PUBLICATION_GATES.length) {
    throw new Error(`publication contract gate set mismatch; missing=[${missing.join(',')}], unexpected=[${unexpected.join(',')}], duplicates=${gates.length - unique.size}`);
  }
  return gates;
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await fsp.readFile(filePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function buildDesignAssetIndex({root = process.cwd(), env = process.env} = {}) {
  const [pilot, intake, conversion, contract, resolveCategory] = await Promise.all([
    readJson(path.join(root, env.DESIGN_ASSET_PILOT ?? 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'), {candidates: []}),
    readJson(path.join(root, env.DESIGN_ASSET_INTAKE ?? 'data/metrics/sweet-home-3d-design-asset-intake-latest.json'), {assets: []}),
    readJson(path.join(root, env.DESIGN_ASSET_CONVERSION ?? 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'), {assets: []}),
    readJson(path.join(root, env.DESIGN_ASSET_PUBLICATION_CONTRACT ?? 'config/geometry/design-asset-publication-contract-v0.1.json'), {}),
    loadTaxonomyResolver(root),
  ]);
  const publicationGates = validatePublicationContract(contract);
  const intakeById = new Map((intake.assets ?? []).map((item) => [item.design_asset_id, item]));
  const conversionById = new Map((conversion.assets ?? []).map((item) => [item.design_asset_id, item]));
  const assets = (pilot.candidates ?? []).map((candidate) => {
    const ingested = intakeById.get(candidate.design_asset_id);
    const converted = conversionById.get(candidate.design_asset_id);
    const attribution = ingested?.attribution ?? {
      creator: pilot.source?.creators?.join(' & ') ?? null,
      text: candidate.license?.attribution_text ?? null,
      license_id: candidate.license?.spdx_like ?? null,
      source_url: candidate.license?.source_reference ?? null,
      display_required: candidate.license?.attribution_required === true,
    };
    const gates = {
      rights_source_verified: false,
      redistribution_allowed: false,
      all_model_dependencies_resolved: ingested?.intake_state === 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED',
      source_orientation_applied: Boolean(converted?.source_transform),
      back_face_policy_applied: Boolean(converted?.source_transform),
      texture_embedding_verified: false,
      canonical_view_visual_qa_passed: false,
      independent_scale_qa_passed: converted?.independent_scale_qa_passed === true,
      attribution_display_verified: false,
    };
    const publicationAllowed = publicationGates.every((gate) => gates[gate] === true);
    const asset = {
      design_asset_id: candidate.design_asset_id,
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      source_model_name: candidate.source_model_name,
      category_id: resolveCategory(candidate.category_id),
      geometry_state: converted?.current_geometry_level ?? ingested?.intake_state ?? candidate.asset_state,
      publication_state: publicationAllowed ? 'PUBLISHABLE' : converted ? 'RUNTIME_ONLY_QA_REQUIRED' : 'NOT_PUBLISHED',
      publication_allowed: publicationAllowed,
      attribution,
      gates,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await buildDesignAssetIndex(), null, 2));
