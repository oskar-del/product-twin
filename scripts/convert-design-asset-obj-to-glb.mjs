import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const DEFAULT_INTAKE = 'data/metrics/sweet-home-3d-design-asset-intake-latest.json';
const DEFAULT_OUTPUT = 'data/metrics/sweet-home-3d-design-asset-conversion-latest.json';

const align4 = (value) => (value + 3) & ~3;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));

function parseIndex(token, length) {
  if (!token) return null;
  const value = Number(token);
  if (!Number.isInteger(value) || value === 0) return null;
  return value > 0 ? value - 1 : length + value;
}

export function parseObj(source) {
  const vertices = [];
  const texcoords = [];
  const normals = [];
  const faces = [];
  let material = 'default';
  for (const raw of String(source).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [keyword, ...rest] = line.split(/\s+/);
    if (keyword === 'v' && rest.length >= 3) vertices.push(rest.slice(0, 3).map(Number));
    else if (keyword === 'vt' && rest.length >= 2) texcoords.push(rest.slice(0, 2).map(Number));
    else if (keyword === 'vn' && rest.length >= 3) normals.push(rest.slice(0, 3).map(Number));
    else if (keyword === 'usemtl') material = rest.join(' ') || 'default';
    else if (keyword === 'f' && rest.length >= 3) {
      const corners = rest.map((item) => {
        const [v, vt, vn] = item.split('/');
        return {v: parseIndex(v, vertices.length), vt: parseIndex(vt, texcoords.length), vn: parseIndex(vn, normals.length)};
      });
      for (let index = 1; index < corners.length - 1; index += 1) faces.push({material, corners: [corners[0], corners[index], corners[index + 1]]});
    }
  }
  if (!vertices.length || !faces.length) throw new Error('OBJ contains no usable vertices/faces');
  if (vertices.some((vertex) => vertex.some((value) => !Number.isFinite(value)))) throw new Error('OBJ contains non-finite vertex data');
  if (faces.some((face) => face.corners.some((corner) => corner.v === null || !vertices[corner.v]))) throw new Error('OBJ face contains invalid vertex index');
  return {vertices, texcoords, normals, faces};
}

export function parseMtl(source) {
  const materials = new Map();
  let current = {name: 'default', color: [0.72, 0.72, 0.72], opacity: 1, roughness: 0.72, texture: null};
  materials.set(current.name, current);
  for (const raw of String(source).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [keyword, ...rest] = line.split(/\s+/);
    if (keyword === 'newmtl') {
      current = {name: rest.join(' ') || `material-${materials.size}`, color: [0.72, 0.72, 0.72], opacity: 1, roughness: 0.72, texture: null};
      materials.set(current.name, current);
    } else if (keyword === 'Kd' && rest.length >= 3) current.color = rest.slice(0, 3).map(clamp01);
    else if (keyword === 'd' && rest.length) current.opacity = clamp01(rest[0]);
    else if (keyword === 'Tr' && rest.length) current.opacity = 1 - clamp01(rest[0]);
    else if (keyword === 'Ns' && rest.length) current.roughness = Math.max(0.08, Math.min(1, 1 - Math.log10(Math.max(1, Number(rest[0]))) / 3));
    else if (/^map_Kd$/i.test(keyword)) {
      const joined = rest.join(' ').trim();
      current.texture = joined.match(/"([^"]+)"\s*$/)?.[1] ?? joined.split(/\s+/).at(-1) ?? null;
    }
  }
  return materials;
}

function bounds(vertices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const vertex of vertices) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  return {min, max, size: max.map((value, axis) => value - min[axis])};
}

function normalized(vector) {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map((value) => value / length) : [0, 1, 0];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function applyMatrix3(vector, matrix) {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ];
}

function transformMesh(parsed, declaredMm, sourceTransform = {}) {
  const matrix = sourceTransform.model_rotation?.matrix3_row_major ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (!Array.isArray(matrix) || matrix.length !== 9 || matrix.some((value) => !Number.isFinite(value))) throw new Error('source model rotation must be a finite 3x3 row-major matrix');
  const orientedVertices = parsed.vertices.map((vertex) => applyMatrix3(vertex, matrix));
  const raw = bounds(orientedVertices);
  if (raw.size.some((value) => !(value > 1e-9))) throw new Error('OBJ has a degenerate axis and cannot be dimension-normalized');
  const target = [declaredMm.width, declaredMm.height, declaredMm.depth].map((value) => value / 1000);
  const scale = target.map((value, axis) => value / raw.size[axis]);
  const centerX = (raw.min[0] + raw.max[0]) / 2;
  const centerZ = (raw.min[2] + raw.max[2]) / 2;
  const transformed = orientedVertices.map((vertex) => [
    (vertex[0] - centerX) * scale[0],
    (vertex[1] - raw.min[1]) * scale[1],
    (vertex[2] - centerZ) * scale[2],
  ]);
  const normals = parsed.normals.map((normal) => normalized(applyMatrix3(normal, matrix).map((value, axis) => value / scale[axis])));
  return {
    vertices: transformed,
    normals,
    scale,
    source_orientation_matrix3_row_major: matrix,
    source_bounds_after_orientation: raw,
    measured_bounds: bounds(transformed),
    normalization: {
      kind: 'DECLARED_ENVELOPE_NON_UNIFORM',
      target_dimensions_mm: declaredMm,
      scale_xyz: scale,
      source_scale_independently_verified: false,
    },
  };
}

function componentMinMax(values, stride) {
  const min = Array(stride).fill(Infinity);
  const max = Array(stride).fill(-Infinity);
  for (let index = 0; index < values.length; index += stride) {
    for (let axis = 0; axis < stride; axis += 1) {
      min[axis] = Math.min(min[axis], values[index + axis]);
      max[axis] = Math.max(max[axis], values[index + axis]);
    }
  }
  return {min, max};
}

function mimeForTexture(filePath, bytes) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png' || bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (['.jpg', '.jpeg'].includes(extension) || bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'image/jpeg';
  return null;
}

function encodeGlb({parsed, transformed, materials, textures, metadata, doubleSided}) {
  const document = {
    asset: {version: '2.0', generator: 'Product Twin Design Asset Factory 0.1', extras: metadata},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{name: metadata.design_asset_id, mesh: 0}],
    meshes: [{name: metadata.source_model_name, primitives: []}],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [{byteLength: 0}],
    samplers: [{magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497}],
  };
  const chunks = [];
  let offset = 0;
  const append = (buffer, target = undefined) => {
    const padding = align4(offset) - offset;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    const view = {buffer: 0, byteOffset: offset, byteLength: buffer.length};
    if (target) view.target = target;
    const index = document.bufferViews.push(view) - 1;
    chunks.push(buffer);
    offset += buffer.length;
    return index;
  };
  const accessor = (values, type, componentType, target) => {
    const typed = componentType === 5126 ? Float32Array.from(values) : Uint32Array.from(values);
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const bufferView = append(bytes, target);
    const stride = ({SCALAR: 1, VEC2: 2, VEC3: 3})[type];
    const mm = componentMinMax(values, stride);
    return document.accessors.push({bufferView, componentType, count: values.length / stride, type, min: mm.min, max: mm.max}) - 1;
  };

  const textureIndexByMaterial = new Map();
  for (const [name, texture] of textures) {
    const mimeType = mimeForTexture(texture.path, texture.bytes);
    if (!mimeType) continue;
    const bufferView = append(texture.bytes);
    document.images ??= [];
    document.textures ??= [];
    const imageIndex = document.images.push({bufferView, mimeType, name: path.basename(texture.path)}) - 1;
    const textureIndex = document.textures.push({sampler: 0, source: imageIndex}) - 1;
    textureIndexByMaterial.set(name, textureIndex);
  }

  const facesByMaterial = new Map();
  for (const face of parsed.faces) {
    if (!facesByMaterial.has(face.material)) facesByMaterial.set(face.material, []);
    facesByMaterial.get(face.material).push(face);
  }
  for (const [materialName, faces] of facesByMaterial) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const vertexMap = new Map();
    let hasAllUvs = true;
    let hasAllNormals = true;
    for (const face of faces) {
      const points = face.corners.map((corner) => transformed.vertices[corner.v]);
      const faceNormal = normalized(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
      for (const corner of face.corners) {
        const key = `${corner.v}/${corner.vt ?? ''}/${corner.vn ?? ''}`;
        let index = vertexMap.get(key);
        if (index === undefined) {
          index = vertexMap.size;
          vertexMap.set(key, index);
          positions.push(...transformed.vertices[corner.v]);
          if (corner.vn !== null && parsed.normals[corner.vn]) {
            normals.push(...transformed.normals[corner.vn]);
          } else {
            normals.push(...faceNormal);
            hasAllNormals = false;
          }
          if (corner.vt !== null && parsed.texcoords[corner.vt]) uvs.push(parsed.texcoords[corner.vt][0], 1 - parsed.texcoords[corner.vt][1]);
          else {
            uvs.push(0, 0);
            hasAllUvs = false;
          }
        }
        indices.push(index);
      }
    }
    const sourceMaterial = materials.get(materialName) ?? materials.get('default') ?? {color: [0.72, 0.72, 0.72], opacity: 1, roughness: 0.72};
    const material = {
      name: materialName,
      pbrMetallicRoughness: {
        baseColorFactor: [...sourceMaterial.color, sourceMaterial.opacity],
        metallicFactor: 0,
        roughnessFactor: sourceMaterial.roughness,
      },
      doubleSided,
    };
    if (sourceMaterial.opacity < 1) material.alphaMode = 'BLEND';
    if (hasAllUvs && textureIndexByMaterial.has(materialName)) material.pbrMetallicRoughness.baseColorTexture = {index: textureIndexByMaterial.get(materialName)};
    const materialIndex = document.materials.push(material) - 1;
    const attributes = {
      POSITION: accessor(positions, 'VEC3', 5126, 34962),
      NORMAL: accessor(normals, 'VEC3', 5126, 34962),
    };
    if (hasAllUvs) attributes.TEXCOORD_0 = accessor(uvs, 'VEC2', 5126, 34962);
    document.meshes[0].primitives.push({attributes, indices: accessor(indices, 'SCALAR', 5125, 34963), material: materialIndex, mode: 4, extras: {source_normals_complete: hasAllNormals}});
  }
  document.buffers[0].byteLength = align4(offset);
  if (offset < document.buffers[0].byteLength) chunks.push(Buffer.alloc(document.buffers[0].byteLength - offset));
  const binary = Buffer.concat(chunks);
  let json = Buffer.from(JSON.stringify(document));
  const jsonPadding = align4(json.length) - json.length;
  if (jsonPadding) json = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const totalLength = 12 + 8 + json.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, binary]);
}

export function inspectGlb(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'glTF' || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error('generated GLB is invalid');
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

async function loadMaterials(asset, root) {
  const materials = new Map([['default', {name: 'default', color: [0.72, 0.72, 0.72], opacity: 1, roughness: 0.72, texture: null}]]);
  const textures = new Map();
  const required = (asset.model.dependencies ?? []).filter((dependency) => dependency.required !== false);
  const unresolved = required.filter((dependency) => dependency.state !== 'RESOLVED' || !dependency.runtime_path);
  if (unresolved.length) throw new Error(`required model dependencies unresolved: ${unresolved.map((item) => item.entry ?? item.reference).join(', ')}`);
  for (const dependency of asset.model.dependencies ?? []) {
    if (dependency.type !== 'material') continue;
    const mtlPath = path.resolve(root, dependency.runtime_path);
    const parsed = parseMtl(await fsp.readFile(mtlPath, 'utf8'));
    for (const [name, material] of parsed) {
      materials.set(name, material);
      if (!material.texture) continue;
      const textureDependency = required.find((item) => item.type === 'texture'
        && item.parent_entry === dependency.entry
        && (item.reference === material.texture || path.basename(item.entry) === path.basename(material.texture)));
      if (!textureDependency) throw new Error(`MTL texture has no intake dependency record: ${dependency.entry} -> ${material.texture}`);
      const texturePath = path.resolve(root, textureDependency.runtime_path);
      const bytes = await fsp.readFile(texturePath);
      if (!mimeForTexture(texturePath, bytes)) throw new Error(`unsupported required texture encoding: ${textureDependency.entry}`);
      textures.set(name, {path: texturePath, bytes});
    }
  }
  return {materials, textures};
}

export async function convertDesignAssets({root = process.cwd(), env = process.env} = {}) {
  const intakePath = path.resolve(root, env.DESIGN_ASSET_INTAKE?.trim() || DEFAULT_INTAKE);
  const intake = JSON.parse(await fsp.readFile(intakePath, 'utf8'));
  const requested = env.DESIGN_ASSET_ID?.trim();
  const eligible = (intake.assets ?? []).filter((asset) => asset.intake_state === 'DOWNLOADED_UNVERIFIED_CONVERSION_REQUIRED' && (!requested || asset.design_asset_id === requested));
  if (requested && !eligible.length) throw new Error(`eligible design asset not found: ${requested}`);
  const results = [];
  for (const asset of eligible) {
    const declared = asset.source_dimensions?.derived_mm;
    if (!declared) {
      results.push({design_asset_id: asset.design_asset_id, status: 'BLOCKED_NO_DECLARED_DIMENSIONS'});
      continue;
    }
    let parsed;
    let transformed;
    let materials;
    let textures;
    try {
      const modelPath = path.resolve(root, asset.model.runtime_path);
      parsed = parseObj(await fsp.readFile(modelPath, 'utf8'));
      transformed = transformMesh(parsed, declared, asset.source_transform);
      ({materials, textures} = await loadMaterials(asset, root));
    } catch (error) {
      results.push({design_asset_id: asset.design_asset_id, status: 'BLOCKED_CONVERSION_INPUT_INVALID', blockers: [error.message]});
      continue;
    }
    const metadata = {
      design_asset_id: asset.design_asset_id,
      source_model_name: asset.source_model_name,
      identity_scope: 'GENERIC_DESIGN_ASSET',
      not_a_product_twin: true,
      maximum_geometry_level: 'G2',
      license: asset.license ?? asset.licence,
      attribution: asset.attribution ?? null,
      source_transform: asset.source_transform ?? null,
      physical_scale_basis: 'Sweet Home 3D library-declared target envelope applied by non-uniform normalization; this is not independent source-scale verification',
      independent_scale_qa_passed: false,
    };
    const glb = encodeGlb({parsed, transformed, materials, textures, metadata, doubleSided: asset.source_transform?.back_face_shown === true});
    const runtimeDir = path.resolve(root, '.runtime/design-assets/converted');
    const glbPath = path.join(runtimeDir, `${asset.design_asset_id.toLowerCase()}.glb`);
    await fsp.mkdir(runtimeDir, {recursive: true});
    await fsp.writeFile(glbPath, glb);
    const document = inspectGlb(glb);
    const measuredMm = {
      width: transformed.measured_bounds.size[0] * 1000,
      height: transformed.measured_bounds.size[1] * 1000,
      depth: transformed.measured_bounds.size[2] * 1000,
    };
    const relativeErrors = Object.keys(declared).map((key) => Math.abs(measuredMm[key] - declared[key]) / declared[key]);
    results.push({
      design_asset_id: asset.design_asset_id,
      source_model_name: asset.source_model_name,
      status: 'GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED',
      current_geometry_level: 'G1',
      maximum_after_visual_and_scale_qa: 'G2',
      exact_product_claim_allowed: false,
      independent_scale_qa_passed: false,
      runtime_glb_path: path.relative(root, glbPath),
      bytes: glb.length,
      sha256: crypto.createHash('sha256').update(glb).digest('hex'),
      declared_mm: declared,
      measured_mm: measuredMm,
      envelope_normalization_error_max: Math.max(...relativeErrors),
      source_geometry_bounds_after_orientation: transformed.source_bounds_after_orientation,
      normalization: transformed.normalization,
      source_transform: asset.source_transform ?? null,
      mesh: {source_vertices: parsed.vertices.length, source_triangles: parsed.faces.length, primitives: document.meshes[0].primitives.length},
      materials: {count: document.materials.length, embedded_textures: document.textures?.length ?? 0, source_mtl_materials: materials.size},
      attribution: asset.attribution ?? null,
      remaining_gates: ['independently verify physical scale', 'render from canonical views', 'confirm material/texture appearance', 'confirm floor contact and orientation', 'retain visible attribution', 'match to local Product Twins before procurement'],
    });
  }
  const output = {
    generated_at: new Date().toISOString(),
    status: results.length ? 'CONVERSION_PASS_COMPLETE_VISUAL_QA_REQUIRED' : 'NO_ELIGIBLE_ASSETS',
    policy: 'Converted assets remain generic Design Assets. Applying a library-declared target envelope produces G1 only and is not independent scale verification. G2 requires independent scale and visual QA. Product identity and commerce fields remain forbidden.',
    summary: {
      eligible_assets: eligible.length,
      converted: results.filter((item) => item.status === 'GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED').length,
      blocked_or_failed: results.filter((item) => item.status !== 'GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED').length,
    },
    assets: results,
  };
  const outputPath = path.resolve(root, env.DESIGN_ASSET_CONVERSION_METRIC?.trim() || DEFAULT_OUTPUT);
  const metricsRoot = path.resolve(root, 'data/metrics');
  if (!(outputPath === metricsRoot || outputPath.startsWith(`${metricsRoot}${path.sep}`))) throw new Error('conversion metric must remain under data/metrics');
  await fsp.mkdir(path.dirname(outputPath), {recursive: true});
  await fsp.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await convertDesignAssets(), null, 2));
