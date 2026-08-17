import {createHash} from 'node:crypto';

const LEVELS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];
const FORBIDDEN_DESIGN_ASSET_KEYS = new Set([
  'sku', 'gtin', 'ean', 'upc', 'price', 'unitprice', 'msrp', 'rrp', 'stock',
  'availability', 'offer', 'offers', 'merchant', 'seller', 'supplier', 'vendor',
  'commerce', 'delivery', 'shipping', 'checkout', 'cart', 'procurement',
  'logistics', 'leadtime', 'landedcost', 'quantity', 'qty', 'cost',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const stableId = (value) => isString(value) && /^[A-Z][A-Z0-9_:-]{2,127}$/.test(value);
const sha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const fullCommit = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const cloneSorted = (value) => {
  if (Array.isArray(value)) return value.map(cloneSorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, cloneSorted(value[key])]));
};
const canonicalJson = (value) => JSON.stringify(cloneSorted(value));
const digest = (value) => createHash('sha256').update(value).digest('hex');

function validUri(value) {
  if (!isString(value) || value.includes('\\') || value.split('/').includes('..')) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return ['https:', 'repo:', 'urn:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function vec(value, size, {positive = false, nonNegative = false} = {}) {
  return Array.isArray(value)
    && value.length === size
    && value.every((item) => isFiniteNumber(item) && (!positive || item > 0) && (!nonNegative || item >= 0));
}

function sameArray(a, b, tolerance = 1e-9) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((value, index) => isFiniteNumber(value) && isFiniteNumber(b[index]) && Math.abs(value - b[index]) <= tolerance);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function findForbiddenKeys(value, path, findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (!isObject(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalized = normalizeKey(key);
    if ([...FORBIDDEN_DESIGN_ASSET_KEYS].some((token) => normalized === token || normalized.startsWith(token) || normalized.endsWith(token))) findings.push(childPath);
    findForbiddenKeys(child, childPath, findings);
  }
  return findings;
}

function transformEqual(a, b) {
  return isObject(a) && isObject(b)
    && sameArray(a.position_m, b.position_m)
    && sameArray(a.rotation_deg, b.rotation_deg);
}

function obbForPlacement(placement) {
  const envelope = placement.collision_envelope_m;
  const clearance = placement.functional_clearance_m;
  const yaw = placement.transform.rotation_deg[1] * Math.PI / 180;
  const localOffsetX = (clearance.right - clearance.left) / 2;
  const localOffsetZ = (clearance.front - clearance.back) / 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    center: [
      placement.transform.position_m[0] + localOffsetX * cos + localOffsetZ * sin,
      placement.transform.position_m[2] - localOffsetX * sin + localOffsetZ * cos,
    ],
    half: [
      (envelope.width + clearance.left + clearance.right) / 2,
      (envelope.depth + clearance.front + clearance.back) / 2,
    ],
    axes: [[cos, -sin], [sin, cos]],
  };
}

function obbForBounds(bounds) {
  return {
    center: [(bounds.min_m[0] + bounds.max_m[0]) / 2, (bounds.min_m[2] + bounds.max_m[2]) / 2],
    half: [(bounds.max_m[0] - bounds.min_m[0]) / 2, (bounds.max_m[2] - bounds.min_m[2]) / 2],
    axes: [[1, 0], [0, 1]],
  };
}

function projectionRadius(box, axis) {
  return box.half[0] * Math.abs(box.axes[0][0] * axis[0] + box.axes[0][1] * axis[1])
    + box.half[1] * Math.abs(box.axes[1][0] * axis[0] + box.axes[1][1] * axis[1]);
}

function obbIntersects(a, b, tolerance = 1e-9) {
  const delta = [b.center[0] - a.center[0], b.center[1] - a.center[1]];
  for (const axis of [...a.axes, ...b.axes]) {
    const distance = Math.abs(delta[0] * axis[0] + delta[1] * axis[1]);
    if (distance >= projectionRadius(a, axis) + projectionRadius(b, axis) - tolerance) return false;
  }
  return true;
}

function obbInsideBounds(box, bounds, tolerance = 1e-9) {
  const aabbHalfX = Math.abs(box.axes[0][0]) * box.half[0] + Math.abs(box.axes[1][0]) * box.half[1];
  const aabbHalfZ = Math.abs(box.axes[0][1]) * box.half[0] + Math.abs(box.axes[1][1]) * box.half[1];
  return box.center[0] - aabbHalfX >= bounds.min_m[0] - tolerance
    && box.center[0] + aabbHalfX <= bounds.max_m[0] + tolerance
    && box.center[1] - aabbHalfZ >= bounds.min_m[2] - tolerance
    && box.center[1] + aabbHalfZ <= bounds.max_m[2] + tolerance;
}

export function deriveAvatarAssetSetHash(assets) {
  if (!Array.isArray(assets)) return null;
  return digest(assets
    .map((asset) => `${asset.asset_id}:${asset.asset_sha256}`)
    .sort()
    .join('\n'));
}

export function deriveRoomGeometryHash(room) {
  return digest(canonicalJson(room));
}

export function validateRoomAlphaRelease(candidate, inputs = {}, options = {}) {
  const nowMs = options.now ? Date.parse(options.now) : Date.now();
  const issues = [];
  const publicIssues = [];
  const freshness = [];
  let checksTotal = 0;

  const check = (condition, code, path, message, target = issues) => {
    checksTotal += 1;
    if (!condition) target.push({code, path, message});
    return condition;
  };
  const strict = (value, path, required, allowed = required) => {
    if (!check(isObject(value), 'OBJECT_REQUIRED', path, 'must be an object')) return false;
    required.forEach((key) => check(Object.hasOwn(value, key), 'REQUIRED_FIELD_MISSING', `${path}.${key}`, 'required field is missing'));
    Object.keys(value).forEach((key) => check(allowed.includes(key), 'UNKNOWN_FIELD', `${path}.${key}`, 'field is outside the Room Alpha contract'));
    return true;
  };
  const stringValue = (value, code, path) => check(isString(value), code, path, 'must be a non-empty string');
  const enumValue = (value, values, code, path) => check(values.includes(value), code, path, `must be one of ${values.join(', ')}`);
  const boolValue = (value, code, path) => check(typeof value === 'boolean', code, path, 'must be boolean');
  const idValue = (value, code, path) => check(stableId(value), code, path, 'must be a stable uppercase identifier');
  const hashValue = (value, code, path) => check(sha256(value), code, path, 'must be a lowercase SHA-256 digest');
  const timestamp = (value, code, path, futureAllowed = false) => {
    const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
    const valid = check(Number.isFinite(parsed), code, path, 'must be an RFC 3339 timestamp');
    if (valid && !futureAllowed) check(parsed <= nowMs + 300_000, 'EVIDENCE_OBSERVED_IN_FUTURE', path, 'timestamp cannot be in the future');
    return parsed;
  };
  const destination = (value, path) => {
    if (!strict(value, path, ['country', 'region', 'postal_code'])) return false;
    check(['ES', 'SE', 'GB', 'US'].includes(value.country), 'DESTINATION_COUNTRY_INVALID', `${path}.country`, 'country must be ES, SE, GB or US');
    check(value.region === null || isString(value.region), 'DESTINATION_REGION_INVALID', `${path}.region`, 'must be null or non-empty');
    stringValue(value.postal_code, 'DESTINATION_POSTAL_CODE_REQUIRED', `${path}.postal_code`);
    return true;
  };
  const sameDestination = (a, b) => isObject(a) && isObject(b)
    && a.country === b.country && a.region === b.region && a.postal_code === b.postal_code;
  const evidence = (value, path, expected = {}) => {
    const fields = ['evidence_id', 'source_uri', 'observed_at', 'content_sha256', 'freshness_state', 'valid_until', 'market', 'destination'];
    if (!strict(value, path, fields)) return;
    idValue(value.evidence_id, 'EVIDENCE_ID_INVALID', `${path}.evidence_id`);
    check(validUri(value.source_uri), 'EVIDENCE_URI_INVALID', `${path}.source_uri`, 'must be an HTTPS, repo, or root-relative URI');
    hashValue(value.content_sha256, 'EVIDENCE_HASH_INVALID', `${path}.content_sha256`);
    const observed = timestamp(value.observed_at, 'EVIDENCE_OBSERVED_AT_INVALID', `${path}.observed_at`);
    enumValue(value.freshness_state, ['SNAPSHOT', 'CURRENT', 'STALE', 'RECHECK_REQUIRED'], 'EVIDENCE_FRESHNESS_INVALID', `${path}.freshness_state`);
    let validUntil = null;
    if (value.freshness_state === 'CURRENT') {
      validUntil = timestamp(value.valid_until, 'CURRENT_EVIDENCE_VALID_UNTIL_REQUIRED', `${path}.valid_until`, true);
      if (Number.isFinite(validUntil)) check(validUntil >= nowMs, 'CURRENT_EVIDENCE_EXPIRED', `${path}.valid_until`, 'current evidence has expired');
    } else {
      check(value.valid_until === null, 'STATIC_EVIDENCE_EXPIRY_FORBIDDEN', `${path}.valid_until`, 'non-current evidence must use null validity');
    }
    if (expected.market === undefined) check(value.market === null, 'STATIC_EVIDENCE_MARKET_FORBIDDEN', `${path}.market`, 'static evidence cannot carry a market');
    else check(value.market === expected.market, 'CROSS_MARKET_EVIDENCE_LEAK', `${path}.market`, 'evidence market differs from its manifest');
    if (expected.destination === undefined) check(value.destination === null, 'STATIC_EVIDENCE_DESTINATION_FORBIDDEN', `${path}.destination`, 'static evidence cannot carry a destination');
    else {
      destination(value.destination, `${path}.destination`);
      check(sameDestination(value.destination, expected.destination), 'CROSS_DESTINATION_EVIDENCE_LEAK', `${path}.destination`, 'evidence destination differs from its manifest');
    }
    freshness.push({evidence_id: value.evidence_id, freshness_state: value.freshness_state, observed_at: value.observed_at, valid_until: value.valid_until});
    return {observed, validUntil};
  };

  const validateEvidenceArray = (values, path, expected) => {
    if (!check(Array.isArray(values) && values.length > 0, 'EVIDENCE_ARRAY_REQUIRED', path, 'at least one evidence record is required')) return;
    const ids = values.map((item) => item?.evidence_id);
    check(unique(ids), 'DUPLICATE_EVIDENCE_ID', path, 'evidence IDs must be unique');
    values.forEach((item, index) => evidence(item, `${path}[${index}]`, expected));
  };

  const validateCheckRecord = (value, path, code, {testCounts = false} = {}) => {
    const fields = testCounts ? ['state', 'passed', 'total', 'evidence'] : ['state', 'evidence'];
    if (!strict(value, path, fields)) return;
    enumValue(value.state, ['PASS', 'FAIL', 'REPORTED', 'MISSING'], 'CHECK_STATE_INVALID', `${path}.state`);
    if (testCounts) {
      check(Number.isInteger(value.passed) && value.passed >= 0, 'TEST_PASS_COUNT_INVALID', `${path}.passed`, 'must be a non-negative integer');
      check(Number.isInteger(value.total) && value.total > 0, 'TEST_TOTAL_COUNT_INVALID', `${path}.total`, 'must be a positive integer');
      if (Number.isInteger(value.passed) && Number.isInteger(value.total)) check(value.passed <= value.total, 'TEST_COUNT_IMPOSSIBLE', path, 'passed cannot exceed total');
    }
    if (value.state === 'PASS') {
      validateEvidenceArray(value.evidence, `${path}.evidence`);
      if (testCounts) check(value.passed === value.total, 'DETERMINISTIC_TESTS_INCOMPLETE', path, 'all deterministic tests must pass');
    } else {
      check(Array.isArray(value.evidence), 'CHECK_EVIDENCE_ARRAY_REQUIRED', `${path}.evidence`, 'evidence must be an array');
      check(false, code, path, 'reported, missing, or failed checks do not satisfy independent verification');
    }
  };

  const candidateFields = ['schema_version', 'candidate_id', 'evaluated_at', 'publication_target', 'room_source', 'manifest_refs', 'checks'];
  if (!strict(candidate, 'candidate', candidateFields)) {
    return {status: 'BLOCK', checks_total: checksTotal, checks_passed: 0, failed_gates: issues, public_failed_gates: issues, evidence_files_inspected: inputs.evidenceFiles ?? [], evidence_freshness: freshness};
  }
  check(candidate.schema_version === '0.1', 'CANDIDATE_SCHEMA_VERSION_UNSUPPORTED', 'candidate.schema_version', 'only schema 0.1 is supported');
  idValue(candidate.candidate_id, 'CANDIDATE_ID_INVALID', 'candidate.candidate_id');
  timestamp(candidate.evaluated_at, 'CANDIDATE_EVALUATED_AT_INVALID', 'candidate.evaluated_at');
  enumValue(candidate.publication_target, ['INTEGRATION_TEST', 'PUBLIC'], 'PUBLICATION_TARGET_INVALID', 'candidate.publication_target');

  const sourceFields = [
    'branch', 'commit_sha', 'sites_project_id', 'sites_version_id', 'sites_version_number',
    'sites_archive_sha256', 'sites_archive_file_count', 'saved', 'deployed',
    'public_version_number', 'public_deployment_qa_state', 'source_evidence',
  ];
  if (strict(candidate.room_source, 'candidate.room_source', sourceFields)) {
    check(candidate.room_source.branch === 'agent/room-lab-commerce-showroom', 'ROOM_SOURCE_BRANCH_INVALID', 'candidate.room_source.branch', 'Room Lab branch must be explicit');
    check(fullCommit(candidate.room_source.commit_sha), 'ROOM_SOURCE_COMMIT_INVALID', 'candidate.room_source.commit_sha', 'must be a full commit SHA');
    stringValue(candidate.room_source.sites_project_id, 'SITES_PROJECT_ID_REQUIRED', 'candidate.room_source.sites_project_id');
    stringValue(candidate.room_source.sites_version_id, 'SITES_VERSION_ID_REQUIRED', 'candidate.room_source.sites_version_id');
    check(Number.isInteger(candidate.room_source.sites_version_number) && candidate.room_source.sites_version_number > 0, 'SITES_VERSION_NUMBER_INVALID', 'candidate.room_source.sites_version_number', 'must be positive');
    hashValue(candidate.room_source.sites_archive_sha256, 'SITES_ARCHIVE_HASH_INVALID', 'candidate.room_source.sites_archive_sha256');
    check(Number.isInteger(candidate.room_source.sites_archive_file_count) && candidate.room_source.sites_archive_file_count > 0, 'SITES_ARCHIVE_FILE_COUNT_INVALID', 'candidate.room_source.sites_archive_file_count', 'must be positive');
    boolValue(candidate.room_source.saved, 'SITES_SAVED_FLAG_INVALID', 'candidate.room_source.saved');
    boolValue(candidate.room_source.deployed, 'SITES_DEPLOYED_FLAG_INVALID', 'candidate.room_source.deployed');
    check(Number.isInteger(candidate.room_source.public_version_number) && candidate.room_source.public_version_number > 0, 'PUBLIC_VERSION_NUMBER_INVALID', 'candidate.room_source.public_version_number', 'must be positive');
    enumValue(candidate.room_source.public_deployment_qa_state, ['VERIFIED', 'REPORTED', 'UNVERIFIED'], 'PUBLIC_DEPLOYMENT_QA_STATE_INVALID', 'candidate.room_source.public_deployment_qa_state');
    evidence(candidate.room_source.source_evidence, 'candidate.room_source.source_evidence');
    check(options.gitCommitReachable === true, 'ROOM_SOURCE_COMMIT_UNREACHABLE', 'candidate.room_source.commit_sha', 'source commit must be independently reachable in the repository');
  }

  if (strict(candidate.manifest_refs, 'candidate.manifest_refs', ['scene', 'furniture_avatar', 'supply'])) {
    for (const [name, code] of [['scene', 'ROOM_SCENE_MANIFEST_MISSING'], ['furniture_avatar', 'AVATAR_MANIFEST_MISSING']]) {
      const ref = candidate.manifest_refs[name];
      if (ref === null) {
        check(false, code, `candidate.manifest_refs.${name}`, 'required manifest reference is missing');
      } else if (strict(ref, `candidate.manifest_refs.${name}`, ['path', 'sha256'])) {
        check(isString(ref.path) && !ref.path.startsWith('/') && !ref.path.split('/').includes('..'), 'MANIFEST_PATH_INVALID', `candidate.manifest_refs.${name}.path`, 'must be a safe repository-relative path');
        hashValue(ref.sha256, 'MANIFEST_HASH_INVALID', `candidate.manifest_refs.${name}.sha256`);
      }
    }
    const supplyRef = candidate.manifest_refs.supply;
    if (supplyRef !== null && strict(supplyRef, 'candidate.manifest_refs.supply', ['path', 'sha256'])) {
      check(isString(supplyRef.path) && !supplyRef.path.startsWith('/') && !supplyRef.path.split('/').includes('..'), 'MANIFEST_PATH_INVALID', 'candidate.manifest_refs.supply.path', 'must be a safe repository-relative path');
      hashValue(supplyRef.sha256, 'MANIFEST_HASH_INVALID', 'candidate.manifest_refs.supply.sha256');
    }
  }

  if (strict(candidate.checks, 'candidate.checks', ['build', 'lint', 'artifact_validation', 'deterministic_tests', 'browser_manual_interaction_qa'])) {
    validateCheckRecord(candidate.checks.build, 'candidate.checks.build', 'BUILD_CHECK_UNVERIFIED');
    validateCheckRecord(candidate.checks.lint, 'candidate.checks.lint', 'LINT_CHECK_UNVERIFIED');
    validateCheckRecord(candidate.checks.artifact_validation, 'candidate.checks.artifact_validation', 'ARTIFACT_CHECK_UNVERIFIED');
    validateCheckRecord(candidate.checks.deterministic_tests, 'candidate.checks.deterministic_tests', 'DETERMINISTIC_TESTS_UNVERIFIED', {testCounts: true});
    const browser = candidate.checks.browser_manual_interaction_qa;
    if (strict(browser, 'candidate.checks.browser_manual_interaction_qa', ['state', 'evidence'])) {
      enumValue(browser.state, ['PASS', 'FAIL', 'REPORTED', 'MISSING'], 'CHECK_STATE_INVALID', 'candidate.checks.browser_manual_interaction_qa.state');
      if (browser.state === 'PASS') validateEvidenceArray(browser.evidence, 'candidate.checks.browser_manual_interaction_qa.evidence');
      else check(false, 'PUBLIC_BROWSER_MANUAL_QA_REQUIRED', 'candidate.checks.browser_manual_interaction_qa', 'public deployment requires browser/manual interaction QA', publicIssues);
    }
  }

  const avatar = inputs.avatarManifest;
  const avatarById = new Map();
  if (avatar) {
    const fields = ['schema_version', 'manifest_id', 'generated_at', 'source', 'asset_set_sha256', 'assets'];
    if (strict(avatar, 'avatar_manifest', fields)) {
      check(avatar.schema_version === '0.1', 'AVATAR_SCHEMA_VERSION_UNSUPPORTED', 'avatar_manifest.schema_version', 'only schema 0.1 is supported');
      idValue(avatar.manifest_id, 'AVATAR_MANIFEST_ID_INVALID', 'avatar_manifest.manifest_id');
      timestamp(avatar.generated_at, 'AVATAR_MANIFEST_GENERATED_AT_INVALID', 'avatar_manifest.generated_at');
      if (strict(avatar.source, 'avatar_manifest.source', ['workstream', 'branch', 'commit_sha', 'pipeline_version'])) {
        check(avatar.source.workstream === 'AVATAR_FACTORY', 'AVATAR_WORKSTREAM_INVALID', 'avatar_manifest.source.workstream', 'must be AVATAR_FACTORY');
        check(avatar.source.branch === 'agent/avatar-factory-source-graph', 'AVATAR_SOURCE_BRANCH_INVALID', 'avatar_manifest.source.branch', 'must name the Avatar Factory branch');
        check(fullCommit(avatar.source.commit_sha), 'AVATAR_SOURCE_COMMIT_INVALID', 'avatar_manifest.source.commit_sha', 'must be a full commit SHA');
        stringValue(avatar.source.pipeline_version, 'AVATAR_PIPELINE_VERSION_REQUIRED', 'avatar_manifest.source.pipeline_version');
      }
      hashValue(avatar.asset_set_sha256, 'AVATAR_ASSET_SET_HASH_INVALID', 'avatar_manifest.asset_set_sha256');
      check(Array.isArray(avatar.assets) && avatar.assets.length > 0, 'AVATAR_ASSETS_REQUIRED', 'avatar_manifest.assets', 'at least one avatar is required');
      if (Array.isArray(avatar.assets)) {
        check(unique(avatar.assets.map((asset) => asset?.asset_id)), 'DUPLICATE_AVATAR_ID', 'avatar_manifest.assets', 'avatar IDs must be unique');
        check(avatar.asset_set_sha256 === deriveAvatarAssetSetHash(avatar.assets), 'AVATAR_ASSET_SET_HASH_MISMATCH', 'avatar_manifest.asset_set_sha256', 'asset-set hash must bind sorted asset IDs and hashes');
        avatar.assets.forEach((asset, index) => {
          const path = `avatar_manifest.assets[${index}]`;
          const assetFields = ['asset_id', 'source_lane', 'asset_uri', 'asset_sha256', 'identity', 'geometry', 'appearance', 'rights', 'attribution', 'spatial_semantics', 'qa_records', 'publication'];
          if (!strict(asset, path, assetFields)) return;
          idValue(asset.asset_id, 'AVATAR_ID_INVALID', `${path}.asset_id`);
          enumValue(asset.source_lane, ['PRODUCT_TWIN', 'DESIGN_ASSET'], 'AVATAR_SOURCE_LANE_INVALID', `${path}.source_lane`);
          check(validUri(asset.asset_uri), 'AVATAR_ASSET_URI_INVALID', `${path}.asset_uri`, 'must be an HTTPS, repo, or root-relative URI');
          hashValue(asset.asset_sha256, 'AVATAR_ASSET_HASH_INVALID', `${path}.asset_sha256`);
          avatarById.set(asset.asset_id, asset);
          if (asset.source_lane === 'DESIGN_ASSET') {
            const leaks = findForbiddenKeys(asset, path);
            check(leaks.length === 0, 'DESIGN_ASSET_COMMERCE_LEAK', path, `forbidden commerce fields: ${leaks.join(', ')}`);
          }

          if (strict(asset.identity, `${path}.identity`, ['state', 'canonical_id', 'evidence'])) {
            enumValue(asset.identity.state, ['VERIFIED_PRODUCT', 'GENERIC', 'UNVERIFIED'], 'AVATAR_IDENTITY_STATE_INVALID', `${path}.identity.state`);
            if (asset.source_lane === 'PRODUCT_TWIN') {
              check(asset.identity.state === 'VERIFIED_PRODUCT', 'PRODUCT_TWIN_IDENTITY_UNVERIFIED', `${path}.identity.state`, 'Product Twin identity must be verified');
              idValue(asset.identity.canonical_id, 'PRODUCT_TWIN_CANONICAL_ID_REQUIRED', `${path}.identity.canonical_id`);
              validateEvidenceArray(asset.identity.evidence, `${path}.identity.evidence`);
            } else {
              check(asset.identity.state === 'GENERIC', 'DESIGN_ASSET_IDENTITY_INVALID', `${path}.identity.state`, 'Design Asset identity must remain generic');
              check(asset.identity.canonical_id === null, 'DESIGN_ASSET_CANONICAL_ID_FORBIDDEN', `${path}.identity.canonical_id`, 'Design Asset cannot claim canonical product identity');
              check(Array.isArray(asset.identity.evidence), 'IDENTITY_EVIDENCE_ARRAY_REQUIRED', `${path}.identity.evidence`, 'must be an array');
            }
          }

          const geometryFields = ['claimed_level', 'verified_level', 'dimensions_m', 'orientation', 'floor_anchor', 'confidence', 'evidence_flags', 'evidence'];
          if (strict(asset.geometry, `${path}.geometry`, geometryFields)) {
            const claimedOk = enumValue(asset.geometry.claimed_level, LEVELS, 'GEOMETRY_CLAIMED_LEVEL_INVALID', `${path}.geometry.claimed_level`);
            const verifiedOk = enumValue(asset.geometry.verified_level, LEVELS, 'GEOMETRY_VERIFIED_LEVEL_INVALID', `${path}.geometry.verified_level`);
            check(vec(asset.geometry.dimensions_m, 3, {positive: true}), 'GEOMETRY_DIMENSIONS_INVALID', `${path}.geometry.dimensions_m`, 'dimensions must be three positive finite metres');
            check(isFiniteNumber(asset.geometry.confidence) && asset.geometry.confidence >= 0 && asset.geometry.confidence <= 1, 'GEOMETRY_CONFIDENCE_INVALID', `${path}.geometry.confidence`, 'must be between 0 and 1');
            if (strict(asset.geometry.orientation, `${path}.geometry.orientation`, ['up_axis', 'forward_axis'])) {
              enumValue(asset.geometry.orientation.up_axis, ['+Y'], 'GEOMETRY_UP_AXIS_INVALID', `${path}.geometry.orientation.up_axis`);
              enumValue(asset.geometry.orientation.forward_axis, ['+Z', '-Z', '+X', '-X'], 'GEOMETRY_FORWARD_AXIS_INVALID', `${path}.geometry.orientation.forward_axis`);
            }
            if (strict(asset.geometry.floor_anchor, `${path}.geometry.floor_anchor`, ['type', 'local_point_m', 'surface_normal'])) {
              check(asset.geometry.floor_anchor.type === 'FLOOR', 'FLOOR_ANCHOR_TYPE_INVALID', `${path}.geometry.floor_anchor.type`, 'furniture must use a floor anchor');
              check(vec(asset.geometry.floor_anchor.local_point_m, 3), 'FLOOR_ANCHOR_POINT_INVALID', `${path}.geometry.floor_anchor.local_point_m`, 'must be a finite 3-vector');
              check(sameArray(asset.geometry.floor_anchor.surface_normal, [0, 1, 0]), 'FLOOR_ANCHOR_NORMAL_INVALID', `${path}.geometry.floor_anchor.surface_normal`, 'must use +Y floor normal');
              if (vec(asset.geometry.dimensions_m, 3, {positive: true}) && vec(asset.geometry.floor_anchor.local_point_m, 3)) {
                check(Math.abs(asset.geometry.floor_anchor.local_point_m[1] + asset.geometry.dimensions_m[1] / 2) <= 1e-6, 'FLOOR_ANCHOR_NOT_AT_BASE', `${path}.geometry.floor_anchor.local_point_m`, 'anchor Y must be at the geometry base');
              }
            }
            const flagNames = ['dimensions_verified', 'units_verified', 'orientation_verified', 'floor_anchor_verified', 'clearance_verified', 'anchor_pivot_verified', 'recognizable_form_verified', 'independent_scale_verified', 'proxy_disclosed', 'exact_form_verified', 'technical_interfaces_verified', 'manufacturing_authority_verified'];
            if (strict(asset.geometry.evidence_flags, `${path}.geometry.evidence_flags`, flagNames)) {
              flagNames.forEach((name) => boolValue(asset.geometry.evidence_flags[name], 'GEOMETRY_EVIDENCE_FLAG_INVALID', `${path}.geometry.evidence_flags.${name}`));
              if (claimedOk && verifiedOk) {
                const claimed = LEVELS.indexOf(asset.geometry.claimed_level);
                const verified = LEVELS.indexOf(asset.geometry.verified_level);
                check(claimed <= verified, 'FALSE_G_LEVEL_PROMOTION', `${path}.geometry`, 'claimed G-level cannot exceed independently verified level');
                const f = asset.geometry.evidence_flags;
                if (verified >= 1) ['dimensions_verified', 'units_verified', 'orientation_verified', 'floor_anchor_verified', 'clearance_verified', 'anchor_pivot_verified'].forEach((name) => check(f[name] === true, 'G1_EVIDENCE_REQUIRED', `${path}.geometry.evidence_flags.${name}`, 'G1 requires verified envelope, orientation, floor, clearance and anchor evidence'));
                if (verified >= 2) ['recognizable_form_verified', 'independent_scale_verified', 'proxy_disclosed'].forEach((name) => check(f[name] === true, 'G2_EVIDENCE_REQUIRED', `${path}.geometry.evidence_flags.${name}`, 'G2 requires recognizable form, independent scale and proxy disclosure'));
                if (verified >= 3) check(f.exact_form_verified === true, 'G3_EXACT_FORM_EVIDENCE_REQUIRED', `${path}.geometry.evidence_flags.exact_form_verified`, 'G3 requires exact-form evidence');
                if (verified >= 4) check(f.technical_interfaces_verified === true, 'G4_TECHNICAL_EVIDENCE_REQUIRED', `${path}.geometry.evidence_flags.technical_interfaces_verified`, 'G4 requires technical interfaces');
                if (verified >= 5) check(f.manufacturing_authority_verified === true, 'G5_AUTHORITY_EVIDENCE_REQUIRED', `${path}.geometry.evidence_flags.manufacturing_authority_verified`, 'G5 requires authoritative manufacturer/configurator evidence');
              }
            }
            validateEvidenceArray(asset.geometry.evidence, `${path}.geometry.evidence`);
          }

          if (strict(asset.appearance, `${path}.appearance`, ['state', 'confidence', 'evidence'])) {
            enumValue(asset.appearance.state, ['UNVERIFIED', 'APPROXIMATE', 'EXACT_VERIFIED'], 'APPEARANCE_STATE_INVALID', `${path}.appearance.state`);
            check(isFiniteNumber(asset.appearance.confidence) && asset.appearance.confidence >= 0 && asset.appearance.confidence <= 1, 'APPEARANCE_CONFIDENCE_INVALID', `${path}.appearance.confidence`, 'must be between 0 and 1');
            check(Array.isArray(asset.appearance.evidence), 'APPEARANCE_EVIDENCE_ARRAY_REQUIRED', `${path}.appearance.evidence`, 'must be an array');
            if (asset.geometry?.verified_level && LEVELS.indexOf(asset.geometry.verified_level) >= 3) {
              check(asset.appearance.state === 'EXACT_VERIFIED', 'G3_APPEARANCE_EVIDENCE_REQUIRED', `${path}.appearance.state`, 'G3+ requires exact appearance evidence');
              validateEvidenceArray(asset.appearance.evidence, `${path}.appearance.evidence`);
            }
          }

          if (strict(asset.rights, `${path}.rights`, ['state', 'display_allowed', 'derivatives_allowed', 'redistribution_allowed', 'attribution_required', 'evidence'])) {
            enumValue(asset.rights.state, ['CLEARED', 'UNRESOLVED', 'RESTRICTED'], 'RIGHTS_STATE_INVALID', `${path}.rights.state`);
            ['display_allowed', 'derivatives_allowed', 'redistribution_allowed', 'attribution_required'].forEach((name) => boolValue(asset.rights[name], 'RIGHTS_FLAG_INVALID', `${path}.rights.${name}`));
            check(Array.isArray(asset.rights.evidence), 'RIGHTS_EVIDENCE_ARRAY_REQUIRED', `${path}.rights.evidence`, 'must be an array');
            if (asset.rights.state === 'CLEARED') validateEvidenceArray(asset.rights.evidence, `${path}.rights.evidence`);
          }

          if (strict(asset.attribution, `${path}.attribution`, ['required', 'creator', 'license_id', 'source_uri', 'display_text'])) {
            boolValue(asset.attribution.required, 'ATTRIBUTION_REQUIRED_FLAG_INVALID', `${path}.attribution.required`);
            if (asset.rights?.attribution_required === true) {
              check(asset.attribution.required === true, 'ATTRIBUTION_REQUIREMENT_REMOVED', `${path}.attribution.required`, 'rights-required attribution cannot be removed');
              stringValue(asset.attribution.creator, 'ATTRIBUTION_CREATOR_REQUIRED', `${path}.attribution.creator`);
              stringValue(asset.attribution.license_id, 'ATTRIBUTION_LICENSE_REQUIRED', `${path}.attribution.license_id`);
              check(validUri(asset.attribution.source_uri), 'ATTRIBUTION_SOURCE_URI_REQUIRED', `${path}.attribution.source_uri`, 'attribution needs a valid source URI');
              stringValue(asset.attribution.display_text, 'ATTRIBUTION_DISPLAY_TEXT_REQUIRED', `${path}.attribution.display_text`);
            }
          }

          if (strict(asset.spatial_semantics, `${path}.spatial_semantics`, ['footprint_m', 'collision_envelope_m', 'functional_clearance_m', 'anchors', 'unknown_product_fallback'])) {
            check(vec(asset.spatial_semantics.footprint_m, 2, {positive: true}), 'AVATAR_FOOTPRINT_INVALID', `${path}.spatial_semantics.footprint_m`, 'must be positive width/depth');
            const envelope = asset.spatial_semantics.collision_envelope_m;
            if (strict(envelope, `${path}.spatial_semantics.collision_envelope_m`, ['width', 'height', 'depth'])) ['width', 'height', 'depth'].forEach((name) => check(isFiniteNumber(envelope[name]) && envelope[name] > 0, 'COLLISION_ENVELOPE_INVALID', `${path}.spatial_semantics.collision_envelope_m.${name}`, 'must be positive and finite'));
            const clearance = asset.spatial_semantics.functional_clearance_m;
            if (strict(clearance, `${path}.spatial_semantics.functional_clearance_m`, ['front', 'back', 'left', 'right'])) ['front', 'back', 'left', 'right'].forEach((name) => check(isFiniteNumber(clearance[name]) && clearance[name] >= 0, 'FUNCTIONAL_CLEARANCE_INVALID', `${path}.spatial_semantics.functional_clearance_m.${name}`, 'must be finite and non-negative'));
            check(Array.isArray(asset.spatial_semantics.anchors) && asset.spatial_semantics.anchors.length > 0, 'SPATIAL_ANCHORS_REQUIRED', `${path}.spatial_semantics.anchors`, 'at least one anchor is required');
            if (Array.isArray(asset.spatial_semantics.anchors)) {
              check(unique(asset.spatial_semantics.anchors.map((anchor) => anchor?.anchor_id)), 'DUPLICATE_SPATIAL_ANCHOR_ID', `${path}.spatial_semantics.anchors`, 'anchor IDs must be unique');
              asset.spatial_semantics.anchors.forEach((anchor, anchorIndex) => {
                const anchorPath = `${path}.spatial_semantics.anchors[${anchorIndex}]`;
                if (!strict(anchor, anchorPath, ['anchor_id', 'type', 'local_point_m'])) return;
                idValue(anchor.anchor_id, 'SPATIAL_ANCHOR_ID_INVALID', `${anchorPath}.anchor_id`);
                enumValue(anchor.type, ['FLOOR', 'WALL', 'CEILING'], 'SPATIAL_ANCHOR_TYPE_INVALID', `${anchorPath}.type`);
                check(vec(anchor.local_point_m, 3), 'SPATIAL_ANCHOR_POINT_INVALID', `${anchorPath}.local_point_m`, 'must be a finite 3-vector');
              });
            }
            const fallback = asset.spatial_semantics.unknown_product_fallback;
            if (strict(fallback, `${path}.spatial_semantics.unknown_product_fallback`, ['policy', 'dimensions_m', 'clearance_m', 'public_allowed'])) {
              enumValue(fallback.policy, ['REJECT', 'CONSERVATIVE_BOX'], 'UNKNOWN_PRODUCT_POLICY_UNSAFE', `${path}.spatial_semantics.unknown_product_fallback.policy`);
              check(vec(fallback.dimensions_m, 3, {positive: true}), 'UNKNOWN_PRODUCT_DIMENSIONS_INVALID', `${path}.spatial_semantics.unknown_product_fallback.dimensions_m`, 'fallback dimensions must be positive and finite');
              check(isFiniteNumber(fallback.clearance_m) && fallback.clearance_m >= 0.3, 'UNKNOWN_PRODUCT_CLEARANCE_UNSAFE', `${path}.spatial_semantics.unknown_product_fallback.clearance_m`, 'fallback clearance must be at least 0.3m');
              check(fallback.public_allowed === false, 'UNKNOWN_PRODUCT_PUBLICATION_UNSAFE', `${path}.spatial_semantics.unknown_product_fallback.public_allowed`, 'unknown-product fallback cannot be public');
            }
          }

          check(Array.isArray(asset.qa_records), 'AVATAR_QA_RECORDS_REQUIRED', `${path}.qa_records`, 'must be an array');
          if (Array.isArray(asset.qa_records)) {
            check(unique(asset.qa_records.map((record) => record?.qa_id)), 'DUPLICATE_AVATAR_QA_ID', `${path}.qa_records`, 'QA IDs must be unique');
            asset.qa_records.forEach((record, qaIndex) => {
              const qaPath = `${path}.qa_records[${qaIndex}]`;
              if (!strict(record, qaPath, ['qa_id', 'type', 'state', 'observed_at', 'evidence'])) return;
              idValue(record.qa_id, 'AVATAR_QA_ID_INVALID', `${qaPath}.qa_id`);
              enumValue(record.type, ['VISUAL', 'ORIENTATION', 'FLOOR_ANCHOR'], 'AVATAR_QA_TYPE_INVALID', `${qaPath}.type`);
              enumValue(record.state, ['PASS', 'FAIL'], 'AVATAR_QA_STATE_INVALID', `${qaPath}.state`);
              timestamp(record.observed_at, 'AVATAR_QA_OBSERVED_AT_INVALID', `${qaPath}.observed_at`);
              validateEvidenceArray(record.evidence, `${qaPath}.evidence`);
            });
          }

          if (strict(asset.publication, `${path}.publication`, ['promoted', 'public_allowed'])) {
            boolValue(asset.publication.promoted, 'AVATAR_PROMOTED_FLAG_INVALID', `${path}.publication.promoted`);
            boolValue(asset.publication.public_allowed, 'AVATAR_PUBLIC_ALLOWED_FLAG_INVALID', `${path}.publication.public_allowed`);
            if (asset.publication.promoted) {
              for (const type of ['VISUAL', 'ORIENTATION', 'FLOOR_ANCHOR']) {
                check(asset.qa_records?.some((record) => record.type === type && record.state === 'PASS'), 'PROMOTED_AVATAR_QA_REQUIRED', `${path}.qa_records`, `promoted avatar requires passing ${type} QA`);
              }
              check(inputs.assetDigests?.[asset.asset_id] === asset.asset_sha256, 'PROMOTED_AVATAR_BINARY_HASH_UNVERIFIED', `${path}.asset_sha256`, 'promoted avatar binary must be independently hash-bound');
            }
            if (asset.publication.public_allowed) {
              check(asset.rights?.state === 'CLEARED' && asset.rights?.display_allowed === true, 'PUBLIC_AVATAR_RIGHTS_UNRESOLVED', `${path}.rights`, 'public avatar requires cleared display rights');
              check(asset.publication.promoted === true, 'PUBLIC_AVATAR_NOT_PROMOTED', `${path}.publication.promoted`, 'public avatar must be promoted through QA');
              if (asset.rights?.attribution_required) check(asset.attribution?.required === true, 'PUBLIC_AVATAR_ATTRIBUTION_MISSING', `${path}.attribution`, 'public avatar must preserve attribution');
            }
          }
        });
      }
    }
  }

  const scene = inputs.sceneManifest;
  if (scene) {
    const fields = ['schema_version', 'manifest_id', 'scene_id', 'profile_id', 'generated_at', 'source', 'avatar_manifest_id', 'avatar_manifest_sha256', 'room_geometry_sha256', 'room', 'constraints', 'placements', 'candidate_generation', 'ranking', 'interaction_policy', 'unknown_product_fallback', 'rejected_candidates'];
    if (strict(scene, 'scene_manifest', fields)) {
      check(scene.schema_version === '0.1', 'SCENE_SCHEMA_VERSION_UNSUPPORTED', 'scene_manifest.schema_version', 'only schema 0.1 is supported');
      idValue(scene.manifest_id, 'SCENE_MANIFEST_ID_INVALID', 'scene_manifest.manifest_id');
      idValue(scene.scene_id, 'SCENE_ID_INVALID', 'scene_manifest.scene_id');
      idValue(scene.profile_id, 'PROFILE_ID_INVALID', 'scene_manifest.profile_id');
      timestamp(scene.generated_at, 'SCENE_GENERATED_AT_INVALID', 'scene_manifest.generated_at');
      if (strict(scene.source, 'scene_manifest.source', ['workstream', 'branch', 'commit_sha', 'pipeline_version'])) {
        check(scene.source.workstream === 'ROOM_LAB', 'SCENE_WORKSTREAM_INVALID', 'scene_manifest.source.workstream', 'must be ROOM_LAB');
        check(scene.source.branch === candidate.room_source?.branch, 'SCENE_SOURCE_BRANCH_MISMATCH', 'scene_manifest.source.branch', 'scene branch must match candidate');
        check(scene.source.commit_sha === candidate.room_source?.commit_sha, 'SCENE_SOURCE_COMMIT_MISMATCH', 'scene_manifest.source.commit_sha', 'scene commit must match candidate');
        stringValue(scene.source.pipeline_version, 'SCENE_PIPELINE_VERSION_REQUIRED', 'scene_manifest.source.pipeline_version');
      }
      if (avatar) {
        check(scene.avatar_manifest_id === avatar.manifest_id, 'SCENE_AVATAR_MANIFEST_ID_MISMATCH', 'scene_manifest.avatar_manifest_id', 'scene must bind the loaded avatar manifest');
        check(scene.avatar_manifest_sha256 === inputs.avatarManifestSha256, 'SCENE_AVATAR_MANIFEST_HASH_MISMATCH', 'scene_manifest.avatar_manifest_sha256', 'scene must bind the exact avatar manifest bytes');
      }
      hashValue(scene.room_geometry_sha256, 'ROOM_GEOMETRY_HASH_INVALID', 'scene_manifest.room_geometry_sha256');
      check(scene.room_geometry_sha256 === deriveRoomGeometryHash(scene.room), 'ROOM_GEOMETRY_HASH_MISMATCH', 'scene_manifest.room_geometry_sha256', 'room hash must bind room bounds, surfaces, openings and paths');

      const room = scene.room;
      const surfaceById = new Map();
      if (strict(room, 'scene_manifest.room', ['bounds', 'surfaces', 'openings', 'protected_paths'])) {
        if (strict(room.bounds, 'scene_manifest.room.bounds', ['min_m', 'max_m'])) {
          check(vec(room.bounds.min_m, 3) && vec(room.bounds.max_m, 3), 'ROOM_BOUNDS_INVALID', 'scene_manifest.room.bounds', 'bounds must contain finite 3-vectors');
          if (vec(room.bounds.min_m, 3) && vec(room.bounds.max_m, 3)) check(room.bounds.min_m.every((value, index) => value < room.bounds.max_m[index]), 'ROOM_BOUNDS_INVERTED', 'scene_manifest.room.bounds', 'room min must be below max on every axis');
        }
        check(Array.isArray(room.surfaces) && room.surfaces.length >= 2, 'ROOM_SURFACES_REQUIRED', 'scene_manifest.room.surfaces', 'floor and wall surfaces are required');
        if (Array.isArray(room.surfaces)) {
          check(unique(room.surfaces.map((surface) => surface?.surface_id)), 'DUPLICATE_SURFACE_ID', 'scene_manifest.room.surfaces', 'surface IDs must be unique');
          room.surfaces.forEach((surface, index) => {
            const path = `scene_manifest.room.surfaces[${index}]`;
            if (!strict(surface, path, ['surface_id', 'type', 'bounds'])) return;
            idValue(surface.surface_id, 'SURFACE_ID_INVALID', `${path}.surface_id`);
            enumValue(surface.type, ['FLOOR', 'WALL', 'CEILING'], 'SURFACE_TYPE_INVALID', `${path}.type`);
            if (strict(surface.bounds, `${path}.bounds`, ['min_m', 'max_m'])) check(vec(surface.bounds.min_m, 3) && vec(surface.bounds.max_m, 3), 'SURFACE_BOUNDS_INVALID', `${path}.bounds`, 'surface bounds must be finite');
            surfaceById.set(surface.surface_id, surface);
          });
          check(room.surfaces.some((surface) => surface.type === 'FLOOR'), 'FLOOR_SURFACE_REQUIRED', 'scene_manifest.room.surfaces', 'a floor surface is required');
          check(room.surfaces.some((surface) => surface.type === 'WALL'), 'WALL_SURFACE_REQUIRED', 'scene_manifest.room.surfaces', 'at least one wall surface is required');
        }
        check(Array.isArray(room.openings), 'ROOM_OPENINGS_ARRAY_REQUIRED', 'scene_manifest.room.openings', 'must be an array');
        if (Array.isArray(room.openings)) {
          check(unique(room.openings.map((opening) => opening?.opening_id)), 'DUPLICATE_OPENING_ID', 'scene_manifest.room.openings', 'opening IDs must be unique');
          room.openings.forEach((opening, index) => {
            const path = `scene_manifest.room.openings[${index}]`;
            if (!strict(opening, path, ['opening_id', 'surface_id', 'clearance_bounds'])) return;
            idValue(opening.opening_id, 'OPENING_ID_INVALID', `${path}.opening_id`);
            check(surfaceById.has(opening.surface_id), 'OPENING_SURFACE_UNKNOWN', `${path}.surface_id`, 'opening must reference a room surface');
            if (strict(opening.clearance_bounds, `${path}.clearance_bounds`, ['min_m', 'max_m'])) check(vec(opening.clearance_bounds.min_m, 3) && vec(opening.clearance_bounds.max_m, 3), 'OPENING_CLEARANCE_BOUNDS_INVALID', `${path}.clearance_bounds`, 'must contain finite bounds');
          });
        }
        check(Array.isArray(room.protected_paths), 'PROTECTED_PATHS_ARRAY_REQUIRED', 'scene_manifest.room.protected_paths', 'must be an array');
        if (Array.isArray(room.protected_paths)) {
          check(unique(room.protected_paths.map((item) => item?.path_id)), 'DUPLICATE_PROTECTED_PATH_ID', 'scene_manifest.room.protected_paths', 'path IDs must be unique');
          room.protected_paths.forEach((protectedPath, index) => {
            const path = `scene_manifest.room.protected_paths[${index}]`;
            if (!strict(protectedPath, path, ['path_id', 'bounds', 'minimum_width_m'])) return;
            idValue(protectedPath.path_id, 'PROTECTED_PATH_ID_INVALID', `${path}.path_id`);
            check(isFiniteNumber(protectedPath.minimum_width_m) && protectedPath.minimum_width_m >= 0.8, 'PROTECTED_PATH_WIDTH_UNSAFE', `${path}.minimum_width_m`, 'protected path must be at least 0.8m wide');
            if (strict(protectedPath.bounds, `${path}.bounds`, ['min_m', 'max_m'])) {
              check(vec(protectedPath.bounds.min_m, 3) && vec(protectedPath.bounds.max_m, 3), 'PROTECTED_PATH_BOUNDS_INVALID', `${path}.bounds`, 'must contain finite bounds');
              if (vec(protectedPath.bounds.min_m, 3) && vec(protectedPath.bounds.max_m, 3)) check(protectedPath.bounds.min_m.every((value, axis) => value <= protectedPath.bounds.max_m[axis]), 'PROTECTED_PATH_BOUNDS_INVERTED', `${path}.bounds`, 'path bounds cannot be inverted');
            }
          });
        }
      }

      if (strict(scene.constraints, 'scene_manifest.constraints', ['hard', 'soft'])) {
        check(Array.isArray(scene.constraints.hard) && scene.constraints.hard.length > 0, 'HARD_CONSTRAINTS_REQUIRED', 'scene_manifest.constraints.hard', 'hard constraints are required');
        check(Array.isArray(scene.constraints.soft), 'SOFT_PREFERENCES_ARRAY_REQUIRED', 'scene_manifest.constraints.soft', 'soft preferences must be an array');
        const hardIds = [];
        if (Array.isArray(scene.constraints.hard)) scene.constraints.hard.forEach((constraint, index) => {
          const path = `scene_manifest.constraints.hard[${index}]`;
          if (!strict(constraint, path, ['constraint_id', 'type'])) return;
          idValue(constraint.constraint_id, 'HARD_CONSTRAINT_ID_INVALID', `${path}.constraint_id`);
          stringValue(constraint.type, 'HARD_CONSTRAINT_TYPE_REQUIRED', `${path}.type`);
          hardIds.push(constraint.constraint_id);
        });
        const softIds = [];
        if (Array.isArray(scene.constraints.soft)) scene.constraints.soft.forEach((preference, index) => {
          const path = `scene_manifest.constraints.soft[${index}]`;
          if (!strict(preference, path, ['preference_id', 'type', 'weight'])) return;
          idValue(preference.preference_id, 'SOFT_PREFERENCE_ID_INVALID', `${path}.preference_id`);
          stringValue(preference.type, 'SOFT_PREFERENCE_TYPE_REQUIRED', `${path}.type`);
          check(isFiniteNumber(preference.weight) && preference.weight >= 0 && preference.weight <= 1, 'SOFT_PREFERENCE_WEIGHT_INVALID', `${path}.weight`, 'weight must be 0..1');
          softIds.push(preference.preference_id);
        });
        check(unique(hardIds), 'DUPLICATE_HARD_CONSTRAINT_ID', 'scene_manifest.constraints.hard', 'hard constraint IDs must be unique');
        check(unique(softIds), 'DUPLICATE_SOFT_PREFERENCE_ID', 'scene_manifest.constraints.soft', 'soft preference IDs must be unique');
        check(hardIds.every((id) => !softIds.includes(id)), 'HARD_SOFT_CONSTRAINT_MIXED', 'scene_manifest.constraints', 'hard constraints and soft preferences must remain separate');
      }

      const placements = Array.isArray(scene.placements) ? scene.placements : [];
      check(Array.isArray(scene.placements), 'PLACEMENTS_ARRAY_REQUIRED', 'scene_manifest.placements', 'must be an array');
      check(unique(placements.map((placement) => placement?.placement_id)), 'DUPLICATE_PLACEMENT_ID', 'scene_manifest.placements', 'placement IDs must be unique');
      placements.forEach((placement, index) => {
        const path = `scene_manifest.placements[${index}]`;
        const placementFields = ['placement_id', 'scene_id', 'profile_id', 'asset_id', 'transform', 'floor_anchor', 'collision_envelope_m', 'functional_clearance_m', 'source_candidate_id'];
        if (!strict(placement, path, placementFields)) return;
        idValue(placement.placement_id, 'PLACEMENT_ID_INVALID', `${path}.placement_id`);
        check(placement.scene_id === scene.scene_id, 'PLACEMENT_SCENE_ISOLATION_FAILURE', `${path}.scene_id`, 'placement cannot inherit another scene');
        check(placement.profile_id === scene.profile_id, 'PLACEMENT_PROFILE_ISOLATION_FAILURE', `${path}.profile_id`, 'placement cannot inherit another profile');
        check(avatarById.has(placement.asset_id), 'PLACEMENT_AVATAR_UNKNOWN', `${path}.asset_id`, 'placement must reference the loaded avatar manifest');
        if (strict(placement.transform, `${path}.transform`, ['position_m', 'rotation_deg'])) {
          check(vec(placement.transform.position_m, 3), 'PLACEMENT_POSITION_NONFINITE', `${path}.transform.position_m`, 'position must contain finite metres');
          check(vec(placement.transform.rotation_deg, 3), 'PLACEMENT_ROTATION_NONFINITE', `${path}.transform.rotation_deg`, 'rotation must contain finite degrees');
          if (vec(placement.transform.rotation_deg, 3)) check(Math.abs(placement.transform.rotation_deg[0]) <= 1e-6 && Math.abs(placement.transform.rotation_deg[2]) <= 1e-6, 'FLOOR_PLACEMENT_TILT_FORBIDDEN', `${path}.transform.rotation_deg`, 'floor furniture can rotate only around Y');
        }
        if (strict(placement.floor_anchor, `${path}.floor_anchor`, ['surface_id', 'world_point_m'])) {
          const floor = surfaceById.get(placement.floor_anchor.surface_id);
          check(floor?.type === 'FLOOR', 'PLACEMENT_FLOOR_SURFACE_INVALID', `${path}.floor_anchor.surface_id`, 'floor anchor must reference a floor surface');
          check(vec(placement.floor_anchor.world_point_m, 3), 'PLACEMENT_FLOOR_ANCHOR_INVALID', `${path}.floor_anchor.world_point_m`, 'world anchor must be finite');
          if (vec(placement.transform?.position_m, 3) && vec(placement.floor_anchor.world_point_m, 3) && floor) {
            const expected = [placement.transform.position_m[0], floor.bounds.min_m[1], placement.transform.position_m[2]];
            check(sameArray(placement.floor_anchor.world_point_m, expected), 'PLACEMENT_FLOOR_ANCHOR_MISMATCH', `${path}.floor_anchor.world_point_m`, 'anchor must match placement and floor elevation');
            check(Math.abs(placement.transform.position_m[1] - floor.bounds.min_m[1]) <= 1e-6, 'PLACEMENT_NOT_ON_FLOOR', `${path}.transform.position_m[1]`, 'placement origin must sit on its floor');
          }
        }
        const avatarAsset = avatarById.get(placement.asset_id);
        const envelope = placement.collision_envelope_m;
        if (strict(envelope, `${path}.collision_envelope_m`, ['width', 'height', 'depth'])) {
          ['width', 'height', 'depth'].forEach((name) => check(isFiniteNumber(envelope[name]) && envelope[name] > 0, 'PLACEMENT_COLLISION_ENVELOPE_INVALID', `${path}.collision_envelope_m.${name}`, 'must be positive and finite'));
          if (avatarAsset) check(canonicalJson(envelope) === canonicalJson(avatarAsset.spatial_semantics.collision_envelope_m), 'PLACEMENT_COLLISION_ENVELOPE_DRIFT', `${path}.collision_envelope_m`, 'scene collision envelope must match avatar manifest');
        }
        const clearance = placement.functional_clearance_m;
        if (strict(clearance, `${path}.functional_clearance_m`, ['front', 'back', 'left', 'right'])) {
          ['front', 'back', 'left', 'right'].forEach((name) => check(isFiniteNumber(clearance[name]) && clearance[name] >= 0, 'PLACEMENT_FUNCTIONAL_CLEARANCE_INVALID', `${path}.functional_clearance_m.${name}`, 'must be finite and non-negative'));
          if (avatarAsset) check(canonicalJson(clearance) === canonicalJson(avatarAsset.spatial_semantics.functional_clearance_m), 'PLACEMENT_FUNCTIONAL_CLEARANCE_DRIFT', `${path}.functional_clearance_m`, 'scene clearance must match avatar manifest');
        }
        if (vec(placement.transform?.position_m, 3) && vec(placement.transform?.rotation_deg, 3) && room?.bounds && isObject(envelope) && isObject(clearance)) {
          const box = obbForPlacement(placement);
          check(obbInsideBounds(box, room.bounds), 'PLACEMENT_OUTSIDE_ROOM', path, 'rotated collision and clearance envelope must remain within room bounds');
          for (const opening of room.openings ?? []) check(!obbIntersects(box, obbForBounds(opening.clearance_bounds)), 'PLACEMENT_BLOCKS_OPENING', path, `placement blocks opening ${opening.opening_id}`);
          for (const protectedPath of room.protected_paths ?? []) check(!obbIntersects(box, obbForBounds(protectedPath.bounds)), 'PLACEMENT_BLOCKS_PROTECTED_PATH', path, `placement blocks protected path ${protectedPath.path_id}`);
        }
      });
      for (let left = 0; left < placements.length; left += 1) {
        for (let right = left + 1; right < placements.length; right += 1) {
          const a = placements[left];
          const b = placements[right];
          if (vec(a.transform?.position_m, 3) && vec(a.transform?.rotation_deg, 3) && vec(b.transform?.position_m, 3) && vec(b.transform?.rotation_deg, 3)) {
            check(!obbIntersects(obbForPlacement(a), obbForPlacement(b)), 'PLACEMENT_COLLISION', `scene_manifest.placements[${left}]`, `rotated envelope collides with ${b.placement_id}`);
          }
        }
      }

      const candidates = scene.candidate_generation?.candidates;
      if (strict(scene.candidate_generation, 'scene_manifest.candidate_generation', ['algorithm', 'algorithm_version', 'seed', 'deterministic', 'candidates'])) {
        stringValue(scene.candidate_generation.algorithm, 'CANDIDATE_ALGORITHM_REQUIRED', 'scene_manifest.candidate_generation.algorithm');
        stringValue(scene.candidate_generation.algorithm_version, 'CANDIDATE_ALGORITHM_VERSION_REQUIRED', 'scene_manifest.candidate_generation.algorithm_version');
        check(Number.isInteger(scene.candidate_generation.seed), 'CANDIDATE_SEED_INVALID', 'scene_manifest.candidate_generation.seed', 'deterministic generation requires an integer seed');
        check(scene.candidate_generation.deterministic === true, 'CANDIDATE_GENERATION_NONDETERMINISTIC', 'scene_manifest.candidate_generation.deterministic', 'candidate generation must be deterministic');
        check(Array.isArray(candidates) && candidates.length > 0, 'CANDIDATES_REQUIRED', 'scene_manifest.candidate_generation.candidates', 'at least one candidate is required');
        if (Array.isArray(candidates)) {
          check(unique(candidates.map((candidateItem) => candidateItem?.candidate_id)), 'DUPLICATE_CANDIDATE_ID', 'scene_manifest.candidate_generation.candidates', 'candidate IDs must be unique');
          candidates.forEach((candidateItem, index) => {
            const path = `scene_manifest.candidate_generation.candidates[${index}]`;
            if (!strict(candidateItem, path, ['candidate_id', 'placement_id', 'transform', 'hard_constraints_passed', 'hard_failure_reasons', 'soft_score'])) return;
            idValue(candidateItem.candidate_id, 'CANDIDATE_ID_INVALID', `${path}.candidate_id`);
            idValue(candidateItem.placement_id, 'CANDIDATE_PLACEMENT_ID_INVALID', `${path}.placement_id`);
            if (strict(candidateItem.transform, `${path}.transform`, ['position_m', 'rotation_deg'])) {
              check(vec(candidateItem.transform.position_m, 3), 'CANDIDATE_POSITION_INVALID', `${path}.transform.position_m`, 'must be finite');
              check(vec(candidateItem.transform.rotation_deg, 3), 'CANDIDATE_ROTATION_INVALID', `${path}.transform.rotation_deg`, 'must be finite');
            }
            boolValue(candidateItem.hard_constraints_passed, 'CANDIDATE_HARD_RESULT_INVALID', `${path}.hard_constraints_passed`);
            check(Array.isArray(candidateItem.hard_failure_reasons), 'CANDIDATE_REASONS_ARRAY_REQUIRED', `${path}.hard_failure_reasons`, 'must be an array');
            if (candidateItem.hard_constraints_passed) check(candidateItem.hard_failure_reasons?.length === 0, 'VALID_CANDIDATE_HAS_REJECTION_REASONS', path, 'valid candidate cannot carry rejection reasons');
            else check(candidateItem.hard_failure_reasons?.length > 0, 'INVALID_CANDIDATE_REASONS_REQUIRED', path, 'invalid candidate must explain rejection');
            check(isFiniteNumber(candidateItem.soft_score), 'CANDIDATE_SOFT_SCORE_INVALID', `${path}.soft_score`, 'soft score must be finite');
          });
        }
      }

      if (strict(scene.ranking, 'scene_manifest.ranking', ['algorithm_version', 'deterministic', 'tie_break', 'ranked_candidate_ids'])) {
        stringValue(scene.ranking.algorithm_version, 'RANKING_ALGORITHM_VERSION_REQUIRED', 'scene_manifest.ranking.algorithm_version');
        check(scene.ranking.deterministic === true, 'RANKING_NONDETERMINISTIC', 'scene_manifest.ranking.deterministic', 'ranking must be deterministic');
        check(scene.ranking.tie_break === 'CANDIDATE_ID_ASC', 'RANKING_TIE_BREAK_INVALID', 'scene_manifest.ranking.tie_break', 'tie break must be stable candidate ID ordering');
        check(Array.isArray(scene.ranking.ranked_candidate_ids), 'RANKED_CANDIDATES_ARRAY_REQUIRED', 'scene_manifest.ranking.ranked_candidate_ids', 'must be an array');
        if (Array.isArray(candidates) && Array.isArray(scene.ranking.ranked_candidate_ids)) {
          const expected = candidates
            .filter((item) => item.hard_constraints_passed === true)
            .sort((a, b) => b.soft_score - a.soft_score || a.candidate_id.localeCompare(b.candidate_id))
            .map((item) => item.candidate_id);
          check(JSON.stringify(scene.ranking.ranked_candidate_ids) === JSON.stringify(expected), 'RANKING_NOT_DETERMINISTIC', 'scene_manifest.ranking.ranked_candidate_ids', 'ranked IDs must reproduce score and stable tie-break ordering');
        }
      }

      if (Array.isArray(candidates)) {
        placements.forEach((placement, index) => {
          const source = candidates.find((candidateItem) => candidateItem.candidate_id === placement.source_candidate_id);
          check(Boolean(source), 'PLACEMENT_SOURCE_CANDIDATE_UNKNOWN', `scene_manifest.placements[${index}].source_candidate_id`, 'placement must reference a generated candidate');
          if (source) {
            check(source.hard_constraints_passed === true, 'INVALID_CANDIDATE_PLACED', `scene_manifest.placements[${index}]`, 'rejected candidate cannot become a placement');
            check(source.placement_id === placement.placement_id, 'PLACEMENT_CANDIDATE_IDENTITY_MISMATCH', `scene_manifest.placements[${index}]`, 'candidate must target this placement');
            check(transformEqual(source.transform, placement.transform), 'PLACEMENT_CANDIDATE_TRANSFORM_MISMATCH', `scene_manifest.placements[${index}]`, 'placement transform must match selected candidate');
          }
        });
      }

      check(Array.isArray(scene.rejected_candidates), 'REJECTED_CANDIDATES_ARRAY_REQUIRED', 'scene_manifest.rejected_candidates', 'must be an array');
      if (Array.isArray(scene.rejected_candidates) && Array.isArray(candidates)) {
        check(unique(scene.rejected_candidates.map((item) => item?.candidate_id)), 'DUPLICATE_REJECTED_CANDIDATE_ID', 'scene_manifest.rejected_candidates', 'rejected IDs must be unique');
        scene.rejected_candidates.forEach((rejected, index) => {
          const path = `scene_manifest.rejected_candidates[${index}]`;
          if (!strict(rejected, path, ['candidate_id', 'reasons'])) return;
          idValue(rejected.candidate_id, 'REJECTED_CANDIDATE_ID_INVALID', `${path}.candidate_id`);
          check(Array.isArray(rejected.reasons) && rejected.reasons.length > 0, 'REJECTED_CANDIDATE_REASONS_REQUIRED', `${path}.reasons`, 'rejection reasons are required');
        });
        const expectedRejected = candidates.filter((item) => !item.hard_constraints_passed).map((item) => item.candidate_id).sort();
        const actualRejected = scene.rejected_candidates.map((item) => item.candidate_id).sort();
        check(JSON.stringify(actualRejected) === JSON.stringify(expectedRejected), 'REJECTED_CANDIDATE_SET_MISMATCH', 'scene_manifest.rejected_candidates', 'every invalid candidate must be explicitly rejected');
      }

      if (strict(scene.interaction_policy, 'scene_manifest.interaction_policy', ['drag', 'pickup', 'nudge', 'rotation'])) {
        for (const operation of ['drag', 'pickup', 'nudge', 'rotation']) {
          const path = `scene_manifest.interaction_policy.${operation}`;
          if (!strict(scene.interaction_policy[operation], path, ['boundary_enforced', 'collision_enforced'])) continue;
          check(scene.interaction_policy[operation].boundary_enforced === true, 'INTERACTION_BOUNDARY_ENFORCEMENT_REQUIRED', `${path}.boundary_enforced`, `${operation} must enforce room boundaries`);
          check(scene.interaction_policy[operation].collision_enforced === true, 'INTERACTION_COLLISION_ENFORCEMENT_REQUIRED', `${path}.collision_enforced`, `${operation} must enforce collisions`);
        }
      }
      if (strict(scene.unknown_product_fallback, 'scene_manifest.unknown_product_fallback', ['policy', 'dimensions_m', 'clearance_m', 'public_allowed'])) {
        enumValue(scene.unknown_product_fallback.policy, ['REJECT', 'CONSERVATIVE_BOX'], 'SCENE_UNKNOWN_PRODUCT_POLICY_UNSAFE', 'scene_manifest.unknown_product_fallback.policy');
        check(vec(scene.unknown_product_fallback.dimensions_m, 3, {positive: true}), 'SCENE_UNKNOWN_PRODUCT_DIMENSIONS_INVALID', 'scene_manifest.unknown_product_fallback.dimensions_m', 'must be positive and finite');
        check(isFiniteNumber(scene.unknown_product_fallback.clearance_m) && scene.unknown_product_fallback.clearance_m >= 0.3, 'SCENE_UNKNOWN_PRODUCT_CLEARANCE_UNSAFE', 'scene_manifest.unknown_product_fallback.clearance_m', 'must be at least 0.3m');
        check(scene.unknown_product_fallback.public_allowed === false, 'SCENE_UNKNOWN_PRODUCT_PUBLICATION_UNSAFE', 'scene_manifest.unknown_product_fallback.public_allowed', 'unknown-product fallback cannot be public');
      }
    }
  }

  const supply = inputs.supplyManifest;
  if (supply) {
    const fields = ['schema_version', 'manifest_id', 'generated_at', 'market', 'destination', 'offers'];
    if (strict(supply, 'supply_manifest', fields)) {
      check(supply.schema_version === '0.1', 'SUPPLY_SCHEMA_VERSION_UNSUPPORTED', 'supply_manifest.schema_version', 'only schema 0.1 is supported');
      idValue(supply.manifest_id, 'SUPPLY_MANIFEST_ID_INVALID', 'supply_manifest.manifest_id');
      timestamp(supply.generated_at, 'SUPPLY_GENERATED_AT_INVALID', 'supply_manifest.generated_at');
      check(['ES', 'SE', 'GB', 'US'].includes(supply.market), 'SUPPLY_MARKET_INVALID', 'supply_manifest.market', 'market must be ES, SE, GB or US');
      destination(supply.destination, 'supply_manifest.destination');
      check(supply.market === supply.destination?.country, 'SUPPLY_MARKET_DESTINATION_MISMATCH', 'supply_manifest', 'market must match destination country');
      check(Array.isArray(supply.offers), 'SUPPLY_OFFERS_ARRAY_REQUIRED', 'supply_manifest.offers', 'must be an array');
      if (Array.isArray(supply.offers)) {
        check(unique(supply.offers.map((offer) => offer?.offer_id)), 'DUPLICATE_SUPPLY_OFFER_ID', 'supply_manifest.offers', 'offer IDs must be unique');
        supply.offers.forEach((offer, index) => {
          const path = `supply_manifest.offers[${index}]`;
          if (!strict(offer, path, ['offer_id', 'product_twin_id', 'market', 'destination', 'price', 'currency', 'stock_state', 'delivery_state', 'merchant', 'evidence'])) return;
          idValue(offer.offer_id, 'SUPPLY_OFFER_ID_INVALID', `${path}.offer_id`);
          idValue(offer.product_twin_id, 'SUPPLY_PRODUCT_TWIN_ID_INVALID', `${path}.product_twin_id`);
          check(offer.market === supply.market, 'CROSS_MARKET_OFFER_LEAK', `${path}.market`, 'offer market must match manifest');
          destination(offer.destination, `${path}.destination`);
          check(sameDestination(offer.destination, supply.destination), 'CROSS_DESTINATION_OFFER_LEAK', `${path}.destination`, 'offer destination must match manifest');
          check(isFiniteNumber(offer.price) && offer.price >= 0, 'SUPPLY_PRICE_INVALID', `${path}.price`, 'price must be finite and non-negative');
          stringValue(offer.currency, 'SUPPLY_CURRENCY_REQUIRED', `${path}.currency`);
          enumValue(offer.stock_state, ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'], 'SUPPLY_STOCK_STATE_INVALID', `${path}.stock_state`);
          enumValue(offer.delivery_state, ['CONFIRMED', 'UNCONFIRMED', 'UNAVAILABLE'], 'SUPPLY_DELIVERY_STATE_INVALID', `${path}.delivery_state`);
          stringValue(offer.merchant, 'SUPPLY_MERCHANT_REQUIRED', `${path}.merchant`);
          validateEvidenceArray(offer.evidence, `${path}.evidence`, {market: supply.market, destination: supply.destination});
          const avatarAsset = avatarById.get(offer.product_twin_id);
          check(avatarAsset?.source_lane === 'PRODUCT_TWIN', 'SUPPLY_DESIGN_ASSET_REFERENCE_FORBIDDEN', `${path}.product_twin_id`, 'supply offers may reference Product Twins only');
        });
      }
    }
  }

  const manifestRefs = candidate.manifest_refs ?? {};
  if (manifestRefs.furniture_avatar && inputs.avatarManifestSha256) check(manifestRefs.furniture_avatar.sha256 === inputs.avatarManifestSha256, 'AVATAR_MANIFEST_CONTENT_HASH_MISMATCH', 'candidate.manifest_refs.furniture_avatar.sha256', 'reference must match inspected file bytes');
  if (manifestRefs.scene && inputs.sceneManifestSha256) check(manifestRefs.scene.sha256 === inputs.sceneManifestSha256, 'SCENE_MANIFEST_CONTENT_HASH_MISMATCH', 'candidate.manifest_refs.scene.sha256', 'reference must match inspected file bytes');
  if (manifestRefs.supply && inputs.supplyManifestSha256) check(manifestRefs.supply.sha256 === inputs.supplyManifestSha256, 'SUPPLY_MANIFEST_CONTENT_HASH_MISMATCH', 'candidate.manifest_refs.supply.sha256', 'reference must match inspected file bytes');

  const baseFailed = [...new Map(issues.map((issue) => [`${issue.code}:${issue.path}`, issue])).values()];
  const publicFailed = [...new Map([...issues, ...publicIssues].map((issue) => [`${issue.code}:${issue.path}`, issue])).values()];
  const integrationStatus = baseFailed.length === 0 ? 'PASS' : 'BLOCK';
  const publicStatus = publicFailed.length === 0 ? 'PASS' : 'BLOCK';
  const status = candidate.publication_target === 'PUBLIC' ? publicStatus : integrationStatus;
  const failedGates = candidate.publication_target === 'PUBLIC' ? publicFailed : baseFailed;
  return {
    status,
    candidate_id: candidate.candidate_id,
    publication_target: candidate.publication_target,
    eligibility: {integration_testing: integrationStatus, public_deployment: publicStatus},
    checks_total: checksTotal,
    checks_passed: checksTotal - publicFailed.length,
    failed_gates: failedGates,
    public_failed_gates: publicFailed,
    evidence_files_inspected: inputs.evidenceFiles ?? [],
    evidence_freshness: freshness,
    reproduction_commands: [
      'npm run room:alpha:validate',
      'npm run room:alpha:test',
      'npm run room:alpha:gate',
    ],
  };
}

export const roomAlphaGateConstants = {
  LEVELS,
  FORBIDDEN_DESIGN_ASSET_KEYS: [...FORBIDDEN_DESIGN_ASSET_KEYS],
};
