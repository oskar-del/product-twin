// Deterministic gate for the Kator/Legaz Design Asset rights review.
// Asserts: every pilot candidate has a review claim; each rights_review carries
// a verified licence + attribution; forbidden product claims are declared; and
// NO claim is publishable unless BOTH rights_review and geometry_review are
// COMPLETE. Exit non-zero on any violation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const REQUIRED_FORBIDDEN = [
  'exact retail product', 'manufacturer-authoritative likeness', 'purchasable offer',
  'current price or stock', 'destination delivery', 'engineering or fabrication geometry',
];

export function evaluate(pilot, review) {
  const pilotIds = new Set((pilot.candidates ?? []).map((c) => c.design_asset_id));
  const claims = review.claims ?? [];
  const claimIds = new Set(claims.map((c) => c.design_asset_id));
  const violations = [];

  for (const id of pilotIds) if (!claimIds.has(id)) violations.push(`pilot asset missing review claim: ${id}`);
  for (const id of claimIds) if (!pilotIds.has(id)) violations.push(`review claim for unknown asset: ${id}`);

  for (const c of claims) {
    const rr = c.rights_review ?? {};
    const gr = c.geometry_review ?? {};
    if (rr.state === 'COMPLETE') {
      if (!rr.license_verified) violations.push(`${c.design_asset_id}: rights COMPLETE but license_verified not true`);
      if (!(typeof rr.attribution_text === 'string' && rr.attribution_text.trim())) violations.push(`${c.design_asset_id}: missing attribution_text`);
      if (!Array.isArray(rr.license_evidence) || !rr.license_evidence.some((e) => typeof e === 'string' && e.trim())) violations.push(`${c.design_asset_id}: no license_evidence`);
      if (rr.attribution_required !== true) violations.push(`${c.design_asset_id}: attribution_required must be true for CC BY`);
    } else if (rr.state !== 'BLOCKED' && rr.state !== 'PENDING') {
      violations.push(`${c.design_asset_id}: unexpected rights_review.state ${rr.state}`);
    }
    for (const f of REQUIRED_FORBIDDEN) if (!(c.forbidden_claims ?? []).includes(f)) violations.push(`${c.design_asset_id}: forbidden_claims missing "${f}"`);
    // The core safety invariant: publishable requires BOTH reviews complete.
    const bothComplete = rr.state === 'COMPLETE' && gr.state === 'COMPLETE';
    if (c.publishable === true && !bothComplete) violations.push(`${c.design_asset_id}: publishable=true but reviews not both COMPLETE (rights=${rr.state}, geometry=${gr.state})`);
    if (c.publishable !== true && bothComplete) violations.push(`${c.design_asset_id}: both reviews COMPLETE but publishable not set true`);
  }

  const rightsComplete = claims.filter((c) => c.rights_review?.state === 'COMPLETE').length;
  const geometryComplete = claims.filter((c) => c.geometry_review?.state === 'COMPLETE').length;
  const publishable = claims.filter((c) => c.publishable === true).length;
  return {
    status: violations.length ? 'BLOCKED' : 'PASS',
    assets_total: claims.length,
    rights_review_complete: rightsComplete,
    geometry_review_complete: geometryComplete,
    publishable,
    violations,
  };
}

async function main() {
  const pilot = JSON.parse(await fs.readFile(path.join(ROOT, 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json'), 'utf8'));
  const review = JSON.parse(await fs.readFile(path.join(ROOT, 'data/rights/sweet-home-3d-kator-legaz-design-asset-review.json'), 'utf8'));
  const result = evaluate(pilot, review);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
