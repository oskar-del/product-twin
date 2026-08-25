import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildCompactHouseRouteBaseline, HOUSE_FILES} from './build-compact-house-route-baseline.mjs';
import {validateJsonSchema} from './validate-project-procurement-plan.mjs';

const ROOT = process.cwd();
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function findMutablePayloads(value, valuePath = '$', matches = []) {
  if (typeof value === 'string' && /gid:\/\/shopify\/(Cart|Checkout|Order)\//i.test(value)) {
    matches.push(valuePath);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findMutablePayloads(item, `${valuePath}[${index}]`, matches));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'mutable_checkout_payloads_embedded' && /(checkout|cart|order).*(payload|token|session|id)/i.test(key)) matches.push(`${valuePath}.${key}`);
      findMutablePayloads(child, `${valuePath}.${key}`, matches);
    }
  }
  return matches;
}

export function validateCompactHouseRouteBaseline(manifest, schema, sources) {
  const errors = validateJsonSchema(manifest, schema);
  if (errors.length) return errors;
  if (!sources) {
    errors.push('Deterministic compact-house validation requires every canonical source file');
    return errors;
  }
  const generatedAt = new Date(manifest.generated_at);
  if (Number.isNaN(generatedAt.valueOf())) {
    errors.push('generated_at must be a valid date-time');
    return errors;
  }
  let expected;
  try {
    expected = buildCompactHouseRouteBaseline(sources, generatedAt);
  } catch (error) {
    errors.push(`Canonical source compilation failed: ${error.message}`);
    return errors;
  }
  if (!sameJson(manifest, expected)) errors.push('Compact-house baseline must exactly match the canonical source hashes, package mapping, line derivations, gates, risks and fail-closed states');
  const mutablePaths = findMutablePayloads(manifest);
  if (mutablePaths.length) errors.push(`Mutable checkout/cart/order fields are forbidden: ${mutablePaths.join(', ')}`);
  const lineIds = manifest.line_items.map((line) => line.line_item_id);
  if (new Set(lineIds).size !== lineIds.length) errors.push('Compact-house line IDs must be unique');
  const packagedIds = manifest.packages.flatMap((pkg) => pkg.pilot_line_item_ids);
  if (new Set(packagedIds).size !== packagedIds.length || !sameJson([...packagedIds].sort(), [...lineIds].sort())) errors.push('Every pilot line must occur in exactly one canonical construction package');
  if (manifest.line_items.some((line) => line.supply_class !== 'UNVERIFIED' || line.readiness.purchase_ready)) errors.push('Pilot discovery lines cannot claim verified supply or purchase readiness');
  if (manifest.line_items.some((line) => line.discovery_evidence.evidence_state !== 'HISTORICAL_UNDATED_AGGREGATE')) errors.push('Pilot discovery counts must remain quarantined as historical aggregate evidence');
  if (manifest.procurement_readiness.purchase_ready || manifest.consumer_contract.executable_procurement_plan) errors.push('A pre-BoM route baseline cannot be executable or purchase-ready');
  return errors;
}

async function readSources() {
  const entries = await Promise.all(Object.entries(HOUSE_FILES).filter(([key]) => !['schema', 'output'].includes(key)).map(async ([key, file]) => [key, JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'))]));
  return Object.fromEntries(entries);
}

async function main() {
  const [schema, manifest, sources] = await Promise.all([
    fs.readFile(path.join(ROOT, HOUSE_FILES.schema), 'utf8').then(JSON.parse),
    fs.readFile(path.join(ROOT, HOUSE_FILES.output), 'utf8').then(JSON.parse),
    readSources()
  ]);
  const errors = validateCompactHouseRouteBaseline(manifest, schema, sources);
  console.log(JSON.stringify({status: errors.length ? 'COMPACT_HOUSE_ROUTE_BASELINE_BLOCKED' : 'COMPACT_HOUSE_ROUTE_BASELINE_PASS', schema: HOUSE_FILES.schema, manifest: HOUSE_FILES.output, errors}, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
