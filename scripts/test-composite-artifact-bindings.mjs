import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  deriveAvatarFactoryBinding,
  deriveCanopusBinding,
  readGitJsonArtifact,
  validateCompositeArtifactBindings,
} from './lib/composite-artifact-bindings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'data/releases/composite-release-manifest-v0.1.json');
const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
const clone = (value) => structuredClone(value);
const checkpoint = (branch) => {
  const match = manifest.checkpoints.find((item) => item.branch === branch);
  if (!match) throw new Error(`CHECKPOINT_MISSING:${branch}`);
  return match.commit_sha;
};

const avatarCommit = checkpoint('agent/avatar-factory-source-graph');
const canopusCommit = checkpoint('agent/plot-to-project-spatial-studio');
const baselineArtifacts = {
  indexArtifact: readGitJsonArtifact({root, commit: avatarCommit, path: 'data/metrics/design-asset-index-latest.json'}),
  conversionArtifact: readGitJsonArtifact({root, commit: avatarCommit, path: 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'}),
  sourcesArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/evidence-sources-v0.1.json'}),
  projectArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/project-v0.1.json'}),
  siteArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/site-twin-v0.1.json'}),
  scenarioArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json'}),
};

function mutatedArtifact(artifact, mutate) {
  const json = clone(artifact.json);
  mutate(json);
  const bytes = Buffer.from(`${JSON.stringify(json, null, 2)}\n`);
  return {
    ...artifact,
    json,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function derive(artifacts = baselineArtifacts) {
  return {
    avatarBinding: deriveAvatarFactoryBinding({
      indexArtifact: artifacts.indexArtifact,
      conversionArtifact: artifacts.conversionArtifact,
    }),
    canopusBinding: deriveCanopusBinding({
      sourcesArtifact: artifacts.sourcesArtifact,
      projectArtifact: artifacts.projectArtifact,
      siteArtifact: artifacts.siteArtifact,
      scenarioArtifact: artifacts.scenarioArtifact,
    }),
  };
}

function removeFirstAssertion(value) {
  if (Array.isArray(value)) {
    for (const item of value) if (removeFirstAssertion(item)) return true;
    return false;
  }
  if (value === null || typeof value !== 'object') return false;
  if (Object.hasOwn(value, 'evidence_class') && Object.hasOwn(value, 'source') && Object.hasOwn(value, 'verification')) {
    delete value.verification;
    return true;
  }
  for (const item of Object.values(value)) if (removeFirstAssertion(item)) return true;
  return false;
}

const baselineBindings = derive();
const baselineResult = validateCompositeArtifactBindings({manifest, ...baselineBindings});
assert.equal(baselineResult.status, 'PASS');

const mutations = [
  {
    name: 'Avatar source lane poisoned',
    expected: 'AVATAR_INDEX_LANE_INVALID',
    artifacts: () => ({...baselineArtifacts, indexArtifact: mutatedArtifact(baselineArtifacts.indexArtifact, (json) => { json.record_lane = 'PRODUCT_TWIN'; })}),
  },
  {
    name: 'Avatar index count forged',
    expected: 'AVATAR_INDEX_COUNT_MISMATCH',
    artifacts: () => ({...baselineArtifacts, indexArtifact: mutatedArtifact(baselineArtifacts.indexArtifact, (json) => { json.summary.assets += 1; })}),
  },
  {
    name: 'Avatar index duplicate identity',
    expected: 'AVATAR_INDEX_DUPLICATE_ID',
    artifacts: () => ({...baselineArtifacts, indexArtifact: mutatedArtifact(baselineArtifacts.indexArtifact, (json) => { json.assets[1].design_asset_id = json.assets[0].design_asset_id; })}),
  },
  {
    name: 'Avatar conversion identity drift',
    expected: 'AVATAR_INDEX_CONVERSION_ID_MISMATCH',
    artifacts: () => ({...baselineArtifacts, conversionArtifact: mutatedArtifact(baselineArtifacts.conversionArtifact, (json) => { json.assets[0].design_asset_id = 'DA_POISONED_ID'; })}),
  },
  {
    name: 'Avatar publication allowed while gates fail',
    expected: 'AVATAR_PUBLICATION_GATE_DECISION_MISMATCH',
    artifacts: () => ({...baselineArtifacts, indexArtifact: mutatedArtifact(baselineArtifacts.indexArtifact, (json) => {
      json.assets[0].publication_allowed = true;
      json.summary.publishable = 1;
      json.summary.runtime_only_or_unpublished = 11;
    })}),
  },
  {
    name: 'Avatar required publication gate removed',
    expected: 'AVATAR_PUBLICATION_GATE_SET_INVALID',
    artifacts: () => ({...baselineArtifacts, indexArtifact: mutatedArtifact(baselineArtifacts.indexArtifact, (json) => { json.publication_gates.pop(); })}),
  },
  {
    name: 'Avatar manifest inventory diverges from source',
    expected: 'AVATAR_MANIFEST_COUNT_MISMATCH',
    manifest: (candidate) => { candidate.asset_records[0].inventory.record_count = 13; },
  },
  {
    name: 'Avatar manifest evidence hash diverges from source',
    expected: 'AVATAR_INDEX_HASH_MISMATCH',
    manifest: (candidate) => { candidate.asset_records[0].identity.evidence.content_sha256 = '0'.repeat(64); },
  },
  {
    name: 'CANOPUS source count forged',
    expected: 'CANOPUS_MANIFEST_SOURCE_COUNT_MISMATCH',
    artifacts: () => ({...baselineArtifacts, sourcesArtifact: mutatedArtifact(baselineArtifacts.sourcesArtifact, (json) => { json.documents.pop(); })}),
  },
  {
    name: 'CANOPUS hard gate silently closed',
    expected: 'CANOPUS_GATE_NOT_OPEN_HARD',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => { json.hard_gates[0].status = 'CLOSED'; })}),
  },
  {
    name: 'CANOPUS unknown hard gate inserted',
    expected: 'CANOPUS_GATE_UNKNOWN',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => { json.hard_gates[0].gate_id = 'GATE_UNMAPPED_POISON'; })}),
  },
  {
    name: 'CANOPUS parcel geometry fabricated under open gate',
    expected: 'CANOPUS_BOUNDARY_PRESENT_WITH_GATE_OPEN',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => {
      json.spatial.boundary.raw_artifact = 'poisoned-boundary.gml';
      json.spatial.boundary.geometry = {type: 'Polygon', coordinates: []};
    })}),
  },
  {
    name: 'CANOPUS terrain fabricated under open gate',
    expected: 'CANOPUS_TERRAIN_PRESENT_WITH_GATE_OPEN',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => {
      json.spatial.terrain.raw_dem = 'poisoned-dem.tif';
      json.spatial.terrain.terrain_mesh = 'poisoned-terrain.glb';
      json.spatial.terrain.vertical_datum = 'UNVERIFIED_DATUM';
    })}),
  },
  {
    name: 'CANOPUS entitlement fabricated under open gate',
    expected: 'CANOPUS_ENTITLEMENT_PRESENT_WITH_GATE_OPEN',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => {
      json.planning.entitlement = {status: 'POISONED_ENTITLED'};
      json.planning.buildable_envelope = {status: 'POISONED_ENVELOPE'};
    })}),
  },
  {
    name: 'CANOPUS legal access fabricated under open gate',
    expected: 'CANOPUS_ACCESS_PRESENT_WITH_GATE_OPEN',
    artifacts: () => ({...baselineArtifacts, siteArtifact: mutatedArtifact(baselineArtifacts.siteArtifact, (json) => {
      json.access.permitted_access_point = {status: 'POISONED_ACCESS'};
    })}),
  },
  {
    name: 'CANOPUS assertion silently removed',
    expected: 'CANOPUS_MANIFEST_ASSERTION_COUNT_MISMATCH',
    artifacts: () => ({...baselineArtifacts, projectArtifact: mutatedArtifact(baselineArtifacts.projectArtifact, (json) => {
      assert.equal(removeFirstAssertion(json), true);
    })}),
  },
  {
    name: 'CANOPUS manifest artifact-set hash diverges from source',
    expected: 'CANOPUS_ARTIFACT_SET_HASH_MISMATCH',
    manifest: (candidate) => { candidate.site_evidence.evidence.content_sha256 = 'f'.repeat(64); },
  },
];

for (const mutation of mutations) {
  const candidateManifest = clone(manifest);
  if (mutation.manifest) mutation.manifest(candidateManifest);
  let emitted = [];
  try {
    const bindings = derive(mutation.artifacts ? mutation.artifacts() : baselineArtifacts);
    const result = validateCompositeArtifactBindings({manifest: candidateManifest, ...bindings});
    emitted = result.issues.map((issue) => issue.code);
  } catch (error) {
    emitted = [String(error.message).split(':')[0]];
  }
  assert.ok(emitted.includes(mutation.expected), `${mutation.name} should emit ${mutation.expected}; emitted ${emitted.join(', ')}`);
}

console.log(JSON.stringify({
  status: 'PASS',
  baseline_checks: baselineResult.checks_total,
  mutation_scenarios: mutations.length,
}, null, 2));
