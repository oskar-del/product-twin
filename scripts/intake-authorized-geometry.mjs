import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function signatureState(extension, header) {
  const bytes = Buffer.from(header);
  const hex = bytes.subarray(0, 24).toString('hex').toLowerCase();
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const ole = hex.startsWith('d0cf11e0a1b11ae1');
  const zip = hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708');
  const obj = /(^|\r?\n)\s*(?:#|o\s|g\s|v\s|vt\s|vn\s|mtllib\s|usemtl\s)/m.test(text);
  const ifc = /^ISO-10303-21;/i.test(text.trimStart());
  const dwg = /^AC10\d{2}/.test(text);
  const dxf = /(^|\r?\n)\s*0\s*\r?\n\s*SECTION\s*(\r?\n|$)/i.test(text);
  const sat = /ACIS/i.test(text) || /^\d+\s+\d+\s+\d+\s+/m.test(text);
  const fbxBinary = bytes.subarray(0, 18).toString('ascii') === 'Kaydara FBX Binary';
  const fbxAscii = /^\s*;\s*FBX/i.test(text);
  if (['.rfa', '.rvt'].includes(extension)) return { valid: ole, signature: ole ? 'OLE_COMPOUND_FILE' : 'UNEXPECTED' };
  if (extension === '.zip') return { valid: zip, signature: zip ? 'ZIP' : 'UNEXPECTED' };
  if (extension === '.gsm') return { valid: Buffer.from(header).some((byte) => byte !== 0), signature: 'GSM_BINARY_NONEMPTY_HEADER' };
  if (extension === '.obj') return { valid: obj, signature: obj ? 'WAVEFRONT_OBJ_TEXT' : 'UNEXPECTED' };
  if (extension === '.ifc') return { valid: ifc, signature: ifc ? 'IFC_STEP_TEXT' : 'UNEXPECTED' };
  if (extension === '.dwg') return { valid: dwg, signature: dwg ? 'AUTOCAD_DWG' : 'UNEXPECTED' };
  if (extension === '.dxf') return { valid: dxf, signature: dxf ? 'AUTOCAD_DXF_TEXT' : 'UNEXPECTED' };
  if (extension === '.sat') return { valid: sat, signature: sat ? 'ACIS_SAT_TEXT' : 'UNEXPECTED' };
  if (extension === '.fbx') return { valid: fbxBinary || fbxAscii, signature: fbxBinary ? 'FBX_BINARY' : fbxAscii ? 'FBX_ASCII' : 'UNEXPECTED' };
  return { valid: false, signature: 'UNSUPPORTED' };
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject));
  return hash.digest('hex');
}

function requireEnv(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function intakeAuthorizedGeometry({ root = process.cwd(), env = process.env } = {}) {
  const manifestPath = path.resolve(root, requireEnv('GEOMETRY_INTAKE_MANIFEST', env));
  const sourcePath = path.resolve(root, requireEnv('GEOMETRY_FILE', env));
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const accessBasis = requireEnv('GEOMETRY_ACCESS_BASIS', env);
  const termsRef = requireEnv('GEOMETRY_TERMS_REF', env);
  const projectRef = requireEnv('GEOMETRY_PROJECT_REF', env);
  const confirmedIdentity = requireEnv('GEOMETRY_CONFIRMED_IDENTITY', env);
  const sourceUrl = env.GEOMETRY_SOURCE_URL?.trim() || manifest.official_source_urls?.[0];

  if (!manifest.allowed_access_bases?.includes(accessBasis)) throw new Error(`GEOMETRY_ACCESS_BASIS must be one of: ${manifest.allowed_access_bases?.join(', ')}`);
  if (!manifest.expected_identity_values?.includes(confirmedIdentity)) throw new Error(`GEOMETRY_CONFIRMED_IDENTITY must be one of: ${manifest.expected_identity_values?.join(', ')}`);
  if (!manifest.official_source_urls?.includes(sourceUrl)) throw new Error('GEOMETRY_SOURCE_URL is not an approved official source in the intake manifest');

  const relativeToRoot = path.relative(root, sourcePath);
  const sourceInsideRepo = !relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot);
  if (sourceInsideRepo && !(relativeToRoot === '.runtime' || relativeToRoot.startsWith(`.runtime${path.sep}`))) {
    throw new Error('Manufacturer binary must stay outside the repository or under gitignored .runtime');
  }

  const stat = await fsp.stat(sourcePath);
  if (!stat.isFile()) throw new Error('GEOMETRY_FILE must identify one file');
  if (stat.size < Number(manifest.minimum_bytes ?? 1)) throw new Error(`geometry file is smaller than minimum_bytes (${manifest.minimum_bytes})`);

  const extension = path.extname(sourcePath).toLowerCase();
  if (!manifest.allowed_extensions?.includes(extension)) throw new Error(`unsupported geometry extension ${extension}`);
  const handle = await fsp.open(sourcePath, 'r');
  const header = Buffer.alloc(4096);
  await handle.read(header, 0, header.length, 0);
  await handle.close();
  const signature = signatureState(extension, header);
  if (!signature.valid) throw new Error(`file signature does not match ${extension}: ${signature.signature}`);

  const metricRelative = manifest.metric_path;
  const metricPath = path.resolve(root, metricRelative);
  const metricRoot = path.resolve(root, 'data/metrics');
  if (!(metricPath === metricRoot || metricPath.startsWith(`${metricRoot}${path.sep}`))) throw new Error('metric_path must remain under data/metrics');

  const metric = {
    generated_at: new Date().toISOString(),
    intake_id: manifest.intake_id,
    target_id: manifest.target_id,
    status: 'AUTHORIZED_CAPTURE_INTAKE_RECORDED_CONVERSION_QA_REQUIRED',
    identity: {
      confirmed_value: confirmedIdentity,
      confirmation_state: 'USER_CONFIRMED_REQUIRES_INTERNAL_BIM_METADATA_QA',
    },
    source: {
      official_url: sourceUrl,
      file_name: path.basename(sourcePath),
      extension,
      bytes: stat.size,
      sha256: await sha256(sourcePath),
      signature: signature.signature,
    },
    authorization: {
      access_basis: accessBasis,
      terms_reference: termsRef,
      project_reference: projectRef,
      declaration: 'Operator states that the file was obtained through the intended authorized project/professional interface.',
    },
    persistence: {
      manufacturer_binary_committed: false,
      manufacturer_binary_copied_by_intake: false,
      persisted_fields: ['identity confirmation', 'official URL', 'file name', 'format', 'byte count', 'SHA-256', 'signature class', 'authorization evidence', 'project reference'],
    },
    expected_scale_mm: manifest.expected_scale_mm,
    remaining_gates: manifest.post_intake_gates,
  };

  await fsp.mkdir(path.dirname(metricPath), { recursive: true });
  await fsp.writeFile(metricPath, JSON.stringify(metric, null, 2) + '\n');
  return metric;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await intakeAuthorizedGeometry(), null, 2));
}
