#!/usr/bin/env bash
set -euo pipefail

node scripts/build-twin-engine-conformance-scene.mjs
node scripts/validate-twin-engine.mjs
node scripts/test-twin-engine.mjs
node scripts/test-twin-scene-compiler.mjs
node scripts/test-height-field.mjs
node scripts/test-twin-engine-studies.mjs
node scripts/test-osm-buildings.mjs
node scripts/test-twin-scene-bundle.mjs

node scripts/validate-plot-to-project-spatial-contract.mjs
node scripts/test-plot-to-project-spatial-contract.mjs
node scripts/validate-sweden-plot-intelligence.mjs
node scripts/test-sweden-plot-intelligence.mjs
node scripts/validate-saterdalsvagen14-plot-intelligence.mjs
node scripts/test-saterdalsvagen14-plot-intelligence.mjs
node scripts/build-svartinge-neighbourhood-twin-alpha.mjs
node scripts/validate-svartinge-neighbourhood-twin-alpha.mjs
node scripts/test-svartinge-neighbourhood-twin-alpha.mjs
node scripts/build-svartinge-neighbourhood-prototype-v0.2.mjs
node scripts/validate-svartinge-neighbourhood-prototype-v0.2.mjs
node scripts/test-svartinge-neighbourhood-prototype-v0.2.mjs
node scripts/test-svartinge-live-context-adapter.mjs
node scripts/test-svartinge-geographic-alignment.mjs

node scripts/build-svartinge-brage-integrated-scene.mjs
node scripts/test-svartinge-brage-integrated-scene.mjs
node scripts/validate-svartinge-glanrummet-visual-qa.mjs
node scripts/test-svartinge-glanrummet-visual-qa.mjs
node scripts/validate-design-asset-review.mjs
node scripts/validate-native-3d-showcase-runtime.mjs
node scripts/test-native-3d-showcase-runtime.mjs

node scripts/validate-room-commerce-procurement-manifest.mjs
node scripts/test-room-commerce-procurement-manifest.mjs
node scripts/validate-project-procurement-plan.mjs
node scripts/test-project-procurement-plan.mjs
node scripts/validate-compact-house-route-baseline.mjs
node scripts/test-compact-house-route-baseline.mjs

stale_result="$(mktemp)"
trap 'rm -f "$stale_result"' EXIT
if node scripts/validate-room-commerce-procurement-manifest.mjs --current >"$stale_result"; then
  echo "integration gate FAIL: stale commerce was accepted as current" >&2
  exit 1
fi
stale_count="$(rg -c 'stale at' "$stale_result")"
if [[ "$stale_count" -ne 9 ]]; then
  echo "integration gate FAIL: expected 9 stale offer blockers, found $stale_count" >&2
  cat "$stale_result" >&2
  exit 1
fi

git diff --check
echo "INTEGRATION SPRINT GATE PASS · current-commerce gate remains blocked by 9 stale observations"
