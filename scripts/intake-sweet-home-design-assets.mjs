import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PILOT = 'config/geometry/sweet-home-3d-design-asset-pilot-v0.1.json';
const DEFAULT_METRIC = 'data/metrics/sweet-home-3d-design-asset-intake-latest.json';
const MAX_ARCHIVE_BYTES = 250_000_000;
const MAX_ARCHIVE_ENTRIES = 20_000;
const MAX_ENTRY_BYTES = 150_000_000;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    const maxBytes = options.maxBytes ?? MAX_ENTRY_BYTES;
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxBytes) {
        child.kill('SIGKILL');
        reject(new Error(`${command} output exceeded ${maxBytes} bytes`));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

export function safeZipEntry(entry) {
  const value = String(entry).replaceAll('\\', '/');
  if (!value || value.includes('\u0000') || value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return false;
  const parts = value.split('/');
  return !parts.some((part) => part === '..');
}

export function parseJavaProperties(source) {
  const physical = String(source).replace(/\r\n?/g, '\n').split('\n');
  const logical = [];
  let current = '';
  for (const line of physical) {
    current += current ? line.replace(/^\s+/, '') : line;
    const trailing = current.match(/\\+$/)?.[0].length ?? 0;
    if (trailing % 2 === 1) {
      current = current.slice(0, -1);
      continue;
    }
    logical.push(current);
    current = '';
  }
  if (current) logical.push(current);

  const unescape = (value) => value.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_, unicode, escaped) => {
    if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
    return ({ t: '\t', n: '\n', r: '\r', f: '\f' })[escaped] ?? escaped;
  });
  const result = {};
  for (const raw of logical) {
    const line = raw.trimStart();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    let split = -1;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (!escaped && (character === '=' || character === ':' || /\s/.test(character))) {
        split = index;
        break;
      }
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
    }
    const key = split < 0 ? line : line.slice(0, split);
    const value = split < 0 ? '' : line.slice(split).replace(/^[\s:=]+/, '');
    result[unescape(key)] = unescape(value);
  }
  return result;
}

export function indexedFurniture(properties) {
  const records = new Map();
  for (const [key, value] of Object.entries(properties)) {
    const match = key.match(/^(.+)#(\d+)$/);
    if (!match) continue;
    const [, field, index] = match;
    if (!records.has(index)) records.set(index, { library_index: Number(index) });
    records.get(index)[field] = value;
  }
  return [...records.values()].filter((record) => record.name && record.model);
}

function normalizedName(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function archiveModelPath(value) {
  const stripped = String(value).replace(/^jar:/i, '').replace(/^file:/i, '').replace(/^\/+/, '');
  try {
    return decodeURIComponent(stripped);
  } catch {
    return stripped;
  }
}

function resolveArchiveReference(baseEntry, reference) {
  const cleaned = archiveModelPath(reference).replace(/^\.\//, '');
  return path.posix.normalize(path.posix.join(path.posix.dirname(baseEntry), cleaned));
}

function mtllibReferences(objText) {
  return [...String(objText).matchAll(/^\s*mtllib\s+(.+)$/gim)].map((match) => match[1].trim().replace(/^"|"$/g, ''));
}

function textureReferences(mtlText) {
  const references = [];
  for (const line of String(mtlText).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:map_(?:Ka|Kd|Ks|Ke|Ns|d|bump)|bump|disp|decal|norm)\s+(.+)$/i);
    if (!match) continue;
    const raw = match[1].trim();
    const quoted = raw.match(/"([^"]+)"\s*$/)?.[1];
    references.push(quoted ?? raw.split(/\s+/).at(-1));
  }
  return references;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject));
  return hash.digest('hex');
}

async function listEntries(archivePath) {
  const output = await run('unzip', ['-Z1', archivePath], { maxBytes: 20_000_000 });
  const entries = output.toString('utf8').split(/\r?\n/).filter(Boolean);
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error(`archive has more than ${MAX_ARCHIVE_ENTRIES} entries`);
  const unsafe = entries.find((entry) => !safeZipEntry(entry));
  if (unsafe) throw new Error(`archive contains unsafe path: ${unsafe}`);
  return entries;
}

async function extractEntry(archivePath, entry, destination) {
  if (!safeZipEntry(entry)) throw new Error(`unsafe archive entry: ${entry}`);
  const bytes = await run('unzip', ['-p', archivePath, entry]);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.writeFile(destination, bytes);
  return bytes;
}

function requireRuntimeOrExternal(root, sourcePath) {
  const relative = path.relative(root, sourcePath);
  const inside = !relative.startsWith('..') && !path.isAbsolute(relative);
  if (inside && !(relative === '.runtime' || relative.startsWith(`.runtime${path.sep}`))) {
    throw new Error('SH3D archive must stay outside the repository or under gitignored .runtime');
  }
}

function relativeMetricPath(root, requested) {
  const metric = path.resolve(root, requested);
  const metricRoot = path.resolve(root, 'data/metrics');
  if (!(metric === metricRoot || metric.startsWith(`${metricRoot}${path.sep}`))) throw new Error('metric path must remain under data/metrics');
  return metric;
}

function sourceDimensions(record) {
  const width = Number(record.width);
  const depth = Number(record.depth);
  const height = Number(record.height);
  if (![width, depth, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  return {
    source_unit: 'centimetres_as_declared_by_sweet_home_3d_library',
    width_cm: width,
    depth_cm: depth,
    height_cm: height,
    derived_mm: { width: width * 10, depth: depth * 10, height: height * 10 },
    verification_state: 'LIBRARY_AUTHORED_DECLARATION_REQUIRES_MESH_BOUNDS_QA',
  };
}

export async function intakeSweetHomeDesignAssets({ root = process.cwd(), env = process.env } = {}) {
  const pilotPath = path.resolve(root, env.SH3D_PILOT_CONFIG?.trim() || DEFAULT_PILOT);
  const sourcePath = path.resolve(root, env.SH3D_ARCHIVE?.trim() || '');
  if (!env.SH3D_ARCHIVE?.trim()) throw new Error('SH3D_ARCHIVE is required');
  requireRuntimeOrExternal(root, sourcePath);
  const stat = await fsp.stat(sourcePath);
  if (!stat.isFile() || stat.size < 22 || stat.size > MAX_ARCHIVE_BYTES) throw new Error(`SH3D_ARCHIVE must be a ZIP/SH3F file between 22 and ${MAX_ARCHIVE_BYTES} bytes`);

  const pilot = JSON.parse(await fsp.readFile(pilotPath, 'utf8'));
  const sourceHash = await sha256File(sourcePath);
  const intakeRoot = path.resolve(root, '.runtime/design-assets/sweet-home-3d', sourceHash.slice(0, 16));
  await fsp.mkdir(intakeRoot, { recursive: true });

  let libraryPath = sourcePath;
  let libraryFileName = path.basename(sourcePath);
  let outerEntry = null;
  const outerEntries = await listEntries(sourcePath);
  if (path.extname(sourcePath).toLowerCase() !== '.sh3f') {
    const requested = env.SH3D_LIBRARY_FILE?.trim();
    const libraries = outerEntries.filter((entry) => entry.toLowerCase().endsWith('.sh3f'));
    outerEntry = requested
      ? libraries.find((entry) => entry === requested || path.basename(entry) === requested)
      : libraries[0];
    if (!outerEntry) throw new Error('outer archive does not contain an SH3F library');
    libraryFileName = path.basename(outerEntry);
    libraryPath = path.join(intakeRoot, libraryFileName);
    await extractEntry(sourcePath, outerEntry, libraryPath);
  }

  const libraryEntries = await listEntries(libraryPath);
  const entrySet = new Set(libraryEntries);
  const propertyEntry = libraryEntries.find((entry) => /(?:^|\/)PluginFurnitureCatalog\.properties$/i.test(entry))
    ?? libraryEntries.find((entry) => /(?:^|\/)FurnitureLibrary\.properties$/i.test(entry));
  if (!propertyEntry) throw new Error('SH3F does not contain PluginFurnitureCatalog.properties or FurnitureLibrary.properties');
  const propertiesBuffer = await run('unzip', ['-p', libraryPath, propertyEntry], { maxBytes: 10_000_000 });
  const properties = parseJavaProperties(propertiesBuffer.toString('latin1'));
  const furniture = indexedFurniture(properties);

  const matched = [];
  for (const candidate of pilot.candidates ?? []) {
    const record = furniture.find((item) => normalizedName(item.name) === normalizedName(candidate.source_model_name));
    if (!record) {
      matched.push({
        design_asset_id: candidate.design_asset_id,
        source_model_name: candidate.source_model_name,
        intake_state: 'NOT_FOUND_IN_LIBRARY_PROPERTIES',
      });
      continue;
    }
    const modelEntry = archiveModelPath(record.model);
    if (!safeZipEntry(modelEntry) || !entrySet.has(modelEntry)) {
      matched.push({
        design_asset_id: candidate.design_asset_id,
        source_model_name: candidate.source_model_name,
        library_name: record.name,
        intake_state: 'MODEL_ENTRY_MISSING',
        declared_model_entry: modelEntry,
      });
      continue;
    }

    const assetRoot = path.join(intakeRoot, candidate.design_asset_id);
    const modelDestination = path.join(assetRoot, ...modelEntry.split('/'));
    const objBytes = await extractEntry(libraryPath, modelEntry, modelDestination);
    const dependencies = [];
    if (path.extname(modelEntry).toLowerCase() === '.obj') {
      for (const reference of mtllibReferences(objBytes.toString('utf8'))) {
        const mtlEntry = resolveArchiveReference(modelEntry, reference);
        if (!safeZipEntry(mtlEntry) || !entrySet.has(mtlEntry)) continue;
        const mtlDestination = path.join(assetRoot, ...mtlEntry.split('/'));
        const mtlBytes = await extractEntry(libraryPath, mtlEntry, mtlDestination);
        dependencies.push({ type: 'material', entry: mtlEntry, bytes: mtlBytes.length });
        for (const texture of textureReferences(mtlBytes.toString('utf8'))) {
          const textureEntry = resolveArchiveReference(mtlEntry, texture);
          if (!safeZipEntry(textureEntry) || !entrySet.has(textureEntry)) continue;
          const textureBytes = await extractEntry(libraryPath, textureEntry, path.join(assetRoot, ...textureEntry.split('/')));
          dependencies.push({ type: 'texture', entry: textureEntry, bytes: textureBytes.length });
        }
      }
    }
    matched.push({
      design_asset_id: candidate.design_asset_id,
      source_model_name: candidate.source_model_name,
      category_id: candidate.category_id,
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      intake_state: 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED',
      library_index: record.library_index,
      library_name: record.name,
      library_category: record.category ?? null,
      library_creator: record.creator ?? null,
      source_dimensions: sourceDimensions(record),
      model: {
        source_entry: modelEntry,
        runtime_path: path.relative(root, modelDestination),
        bytes: objBytes.length,
        sha256: crypto.createHash('sha256').update(objBytes).digest('hex'),
        dependencies,
      },
      licence: candidate.license,
      promotion: {
        current_level: 'G0',
        maximum_after_conversion: 'G2',
        required_gates: pilot.intake_rules?.required_conversion_checks ?? [],
      },
    });
  }

  const found = matched.filter((item) => item.intake_state === 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED').length;
  const metric = {
    generated_at: new Date().toISOString(),
    status: found ? 'DESIGN_ASSET_INTAKE_COMPLETE_CONVERSION_QA_REQUIRED' : 'NO_PILOT_ASSETS_MATCHED',
    source: {
      source_id: pilot.source?.source_id,
      archive_file: path.basename(sourcePath),
      archive_bytes: stat.size,
      archive_sha256: sourceHash,
      outer_library_entry: outerEntry,
      library_file: libraryFileName,
      library_property_entry: propertyEntry,
      library_entry_count: libraryEntries.length,
      furniture_record_count: furniture.length,
      raw_binary_persisted_in_repository: false,
    },
    policy: {
      identity_scope: 'GENERIC_DESIGN_ASSET',
      maximum_geometry_level: 'G2',
      exact_product_claim_allowed: false,
      commerce_fields_allowed: false,
      benchmark_markets: pilot.intake_rules?.benchmark_markets ?? [],
    },
    summary: {
      requested_candidates: pilot.candidates?.length ?? 0,
      matched_candidates: found,
      unmatched_candidates: matched.length - found,
      extracted_runtime_files: matched.reduce((sum, item) => sum + (item.model ? 1 + item.model.dependencies.length : 0), 0),
    },
    assets: matched,
  };
  const metricPath = relativeMetricPath(root, env.SH3D_INTAKE_METRIC?.trim() || DEFAULT_METRIC);
  await fsp.mkdir(path.dirname(metricPath), { recursive: true });
  await fsp.writeFile(metricPath, `${JSON.stringify(metric, null, 2)}\n`);
  return metric;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await intakeSweetHomeDesignAssets(), null, 2));
}
