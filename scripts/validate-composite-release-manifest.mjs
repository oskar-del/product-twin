import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCompositeReleaseManifest} from './lib/composite-release-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const requireReady = args.includes('--require-ready');
const manifestArgument = args.find((argument) => argument !== '--require-ready');
const manifestPath = path.resolve(root, manifestArgument || 'data/releases/composite-release-manifest-v0.1.json');

const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
const result = validateCompositeReleaseManifest(manifest);
const output = {
  ...result,
  manifest_path: path.relative(root, manifestPath),
  ready_required: requireReady,
};

console.log(JSON.stringify(output, null, 2));

if (result.status !== 'PASS') process.exitCode = 1;
else if (requireReady && result.release_decision !== 'READY') process.exitCode = 2;
