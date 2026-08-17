#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {
  FURNITURE_PACKAGE_2_COMMIT,
  createGitCommitSource,
  loadFurniturePackage2,
  verifyFurniturePackage2,
} from './lib/furniture-avatar-package-2-gate.mjs';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

export function runFurniturePackage2Gate({
  sourceCommit = FURNITURE_PACKAGE_2_COMMIT,
  evaluatedAt = new Date().toISOString(),
  cwd = process.cwd(),
} = {}) {
  const source = createGitCommitSource({commit: sourceCommit, cwd});
  const bundle = loadFurniturePackage2(source);
  return verifyFurniturePackage2(bundle, source, {evaluatedAt, sourceCommitDate: source.commitDate()});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runFurniturePackage2Gate({
      sourceCommit: argument('--source-commit', FURNITURE_PACKAGE_2_COMMIT),
      evaluatedAt: argument('--evaluated-at', new Date().toISOString()),
    });
    console.log(JSON.stringify(result, null, 2));
    if (process.argv.includes('--require-approve') && result.decision !== 'APPROVE') process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({decision: 'BLOCK', fatal_error: error.message}, null, 2));
    process.exitCode = 1;
  }
}
