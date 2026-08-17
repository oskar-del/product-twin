import fs from 'node:fs/promises';
import path from 'node:path';
import {inspectGlb} from './validate-authorized-geometry-qa.mjs';

function glbJson(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error('asset is not GLB');
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    offset += 8 + length;
  }
  throw new Error('GLB JSON chunk missing');
}

function summarizeMaterial(material, index) {
  return {
    index,
    name: material.name ?? null,
    base_color_factor: material.pbrMetallicRoughness?.baseColorFactor ?? null,
    base_color_texture: Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index),
    metallic_factor: material.pbrMetallicRoughness?.metallicFactor ?? null,
    roughness_factor: material.pbrMetallicRoughness?.roughnessFactor ?? null,
    normal_texture: Number.isInteger(material.normalTexture?.index),
  };
}

if (!process.argv.slice(2).length) throw new Error('Pass one or more GLB paths');

const results = [];
for (const inputPath of process.argv.slice(2)) {
  const filePath = path.resolve(process.cwd(), inputPath);
  const buffer = await fs.readFile(filePath);
  const document = glbJson(buffer);
  const inspection = inspectGlb(buffer);
  results.push({
    path: path.relative(process.cwd(), filePath),
    bytes: buffer.length,
    dimensions_mm: inspection.dimensions_mm,
    material_count: document.materials?.length ?? 0,
    texture_count: document.textures?.length ?? 0,
    image_count: document.images?.length ?? 0,
    materials: (document.materials ?? []).map(summarizeMaterial),
  });
}

console.log(JSON.stringify(results, null, 2));
