import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRoomAlphaRelease} from './lib/room-alpha-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const candidateArg = process.argv.slice(2).find((value) => value.endsWith('.json'));
const candidatePath = path.resolve(root, candidateArg ?? 'data/releases/room-alpha-candidate-v0.1.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function safePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.startsWith('/') || relativePath.split('/').includes('..')) throw new Error(`MANIFEST_PATH_INVALID:${relativePath}`);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`MANIFEST_PATH_INVALID:${relativePath}`);
  return resolved;
}

async function readJson(relativePath, kind, evidenceFiles) {
  const resolved = safePath(relativePath);
  const bytes = await fsp.readFile(resolved);
  let json;
  try {
    json = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${kind}_JSON_INVALID:${relativePath}:${error.message}`);
  }
  const sha256 = hash(bytes);
  evidenceFiles.push({path: relativePath, sha256, state: 'INSPECTED'});
  return {json, sha256};
}

function commitReachable(commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

try {
  const candidateBytes = await fsp.readFile(candidatePath);
  const candidate = JSON.parse(candidateBytes.toString('utf8'));
  const evidenceFiles = [{path: path.relative(root, candidatePath), sha256: hash(candidateBytes), state: 'INSPECTED'}];
  const loaded = {};
  const refs = candidate.manifest_refs ?? {};
  for (const [name, inputName, shaName] of [
    ['furniture_avatar', 'avatarManifest', 'avatarManifestSha256'],
    ['scene', 'sceneManifest', 'sceneManifestSha256'],
    ['supply', 'supplyManifest', 'supplyManifestSha256'],
  ]) {
    if (refs[name]?.path) {
      const artifact = await readJson(refs[name].path, name.toUpperCase(), evidenceFiles);
      loaded[inputName] = artifact.json;
      loaded[shaName] = artifact.sha256;
    }
  }

  const assetDigests = {};
  for (const asset of loaded.avatarManifest?.assets ?? []) {
    if (typeof asset.asset_uri === 'string' && asset.asset_uri.startsWith('repo://')) {
      const relativePath = asset.asset_uri.slice('repo://'.length);
      const resolved = safePath(relativePath);
      const bytes = await fsp.readFile(resolved);
      assetDigests[asset.asset_id] = hash(bytes);
      evidenceFiles.push({path: relativePath, sha256: assetDigests[asset.asset_id], state: 'INSPECTED'});
    }
  }

  const result = validateRoomAlphaRelease(candidate, {...loaded, assetDigests, evidenceFiles}, {
    gitCommitReachable: commitReachable(candidate.room_source?.commit_sha),
  });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  console.log(output.trimEnd());
  if (args.has('--write-result')) await fsp.writeFile(path.join(root, 'data/releases/room-alpha-verification-result-latest.json'), output);
  if (args.has('--require-pass') && result.status !== 'PASS') process.exitCode = 2;
  else if (!['PASS', 'BLOCK'].includes(result.status)) process.exitCode = 1;
} catch (error) {
  const result = {
    status: 'BLOCK',
    checks_total: 0,
    checks_passed: 0,
    failed_gates: [{code: String(error.message).split(':')[0], path: 'room_alpha_gate', message: error.message}],
    evidence_files_inspected: [],
    evidence_freshness: [],
    reproduction_commands: ['npm run room:alpha:validate', 'npm run room:alpha:test', 'npm run room:alpha:gate'],
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = args.has('--require-pass') ? 2 : 1;
}
