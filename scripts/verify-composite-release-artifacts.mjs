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

try {
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const checkpoint = (branch) => {
    const match = manifest.checkpoints.find((item) => item.branch === branch);
    if (!match) throw new Error(`CHECKPOINT_MISSING:${branch}`);
    return match.commit_sha;
  };

  const avatarCommit = checkpoint('agent/avatar-factory-source-graph');
  const canopusCommit = checkpoint('agent/plot-to-project-spatial-studio');
  const avatarBinding = deriveAvatarFactoryBinding({
    indexArtifact: readGitJsonArtifact({root, commit: avatarCommit, path: 'data/metrics/design-asset-index-latest.json'}),
    conversionArtifact: readGitJsonArtifact({root, commit: avatarCommit, path: 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json'}),
  });
  const canopusBinding = deriveCanopusBinding({
    sourcesArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/evidence-sources-v0.1.json'}),
    projectArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/project-v0.1.json'}),
    siteArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/site-twin-v0.1.json'}),
    scenarioArtifact: readGitJsonArtifact({root, commit: canopusCommit, path: 'data/sites/canopus/design-scenarios/la-concha-gardens-v0.1.json'}),
  });
  const result = validateCompositeArtifactBindings({manifest, avatarBinding, canopusBinding});
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    status: 'FAIL',
    checks_total: 0,
    checks_passed: 0,
    issues: [{code: String(error.message).split(':')[0], path: 'artifact_binding', message: error.message}],
  }, null, 2));
  process.exitCode = 1;
}
