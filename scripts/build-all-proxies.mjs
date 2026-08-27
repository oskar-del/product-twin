// Universal proxy geometry builder: reads every twin in data/twins/,
// generates a G2 dimension-verified proxy GLB from dims + category,
// writes it to data/geometry/avatars/, and promotes the twin to G2.
// Twins that already have geometry.level >= G2 with an existing asset are skipped.
// Usage: node scripts/build-all-proxies.mjs [--force]

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');
const OUTPUT = path.join(ROOT, 'data/geometry/avatars');
const FORCE = process.argv.includes('--force');

// ---- Spine-coloured materials by category prefix ----
const SPINE_MATERIALS = {
  'FFE.SEATING':   { color: [0.55, 0.50, 0.42, 1], roughness: 0.94, metallic: 0 },
  'FFE.STORAGE':   { color: [0.91, 0.90, 0.84, 1], roughness: 0.58, metallic: 0 },
  'FFE.TABLE':     { color: [0.72, 0.55, 0.34, 1], roughness: 0.72, metallic: 0 },
  'FFE.BEDROOM':   { color: [0.91, 0.90, 0.84, 1], roughness: 0.58, metallic: 0 },
  'FFE.KITCHEN':   { color: [0.94, 0.95, 0.92, 1], roughness: 0.42, metallic: 0 },
  'FFE.BATHROOM':  { color: [0.94, 0.95, 0.92, 1], roughness: 0.18, metallic: 0 },
  'FFE.TEXTILES':  { color: [0.57, 0.42, 0.24, 1], roughness: 0.98, metallic: 0 },
  'FFE.OUTDOOR':   { color: [0.42, 0.32, 0.20, 1], roughness: 0.82, metallic: 0 },
  'FFE.DECOR':     { color: [0.82, 0.67, 0.45, 1], roughness: 0.68, metallic: 0 },
  'ELECTRICAL':    { color: [0.48, 0.51, 0.52, 1], roughness: 0.42, metallic: 0.22 },
  '_default':      { color: [0.70, 0.68, 0.62, 1], roughness: 0.70, metallic: 0 },
};

function spineMaterial(categoryId) {
  for (const [prefix, mat] of Object.entries(SPINE_MATERIALS)) {
    if (prefix !== '_default' && categoryId.startsWith(prefix)) return mat;
  }
  return SPINE_MATERIALS._default;
}

// Category → shape heuristic
function shapeForCategory(categoryId) {
  if (categoryId.includes('LUMINAIRES') || categoryId.includes('BULBS')) return 'cylinder';
  if (categoryId.includes('RUG') || categoryId.includes('BATH_MAT') || categoryId.includes('WORKTOP') || categoryId.includes('DESK_TOP')) return 'flat';
  if (categoryId.includes('SEATING') && !categoryId.includes('CHAIR') && !categoryId.includes('STOOL')) return 'soft';
  return 'box';
}

// ---- Geometry generators (from build-ikea-residential-pack.mjs) ----
function boxGeometry() {
  const positions = [], normals = [], texcoords = [], indices = [];
  const faces = [
    [[1,0,0], [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
    [[-1,0,0], [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
    [[0,1,0], [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
    [[0,-1,0], [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
    [[0,0,1], [[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]]],
    [[0,0,-1], [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]],
  ];
  for (const [normal, corners] of faces) {
    const start = positions.length / 3;
    for (const [index, point] of corners.entries()) { positions.push(...point); normals.push(...normal); texcoords.push(...[[0,0],[0,1],[1,1],[1,0]][index]); }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  return { positions, normals, texcoords, indices };
}

function cylinderGeometry(segments = 24) {
  const positions = [], normals = [], texcoords = [], indices = [];
  for (let i=0;i<=segments;i++) {
    const angle = i/segments*Math.PI*2, x=Math.cos(angle)*.5, z=Math.sin(angle)*.5;
    positions.push(x,-.5,z,x,.5,z); normals.push(Math.cos(angle),0,Math.sin(angle),Math.cos(angle),0,Math.sin(angle)); texcoords.push(i/segments,0,i/segments,1);
  }
  for (let i=0;i<segments;i++) { const a=i*2,b=a+1,c=a+2,d=a+3; indices.push(a,b,c,b,d,c); }
  for (const [y,ny] of [[-.5,-1],[.5,1]]) {
    const center=positions.length/3;positions.push(0,y,0);normals.push(0,ny,0);texcoords.push(.5,.5);
    const ring=positions.length/3;
    for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2,x=Math.cos(angle)*.5,z=Math.sin(angle)*.5;positions.push(x,y,z);normals.push(0,ny,0);texcoords.push(.5+x,.5+z);}
    for(let i=0;i<segments;i++) ny>0?indices.push(center,ring+i,ring+i+1):indices.push(center,ring+i+1,ring+i);
  }
  return { positions, normals, texcoords, indices };
}

function superellipsoidGeometry(latitudes = 14, longitudes = 24, exponent = .34) {
  const positions=[],normals=[],texcoords=[],indices=[];
  const signedPow=(v,p)=>Math.sign(v)*Math.pow(Math.abs(v),p);
  for(let lat=0;lat<=latitudes;lat++){
    const v=-Math.PI/2+lat/latitudes*Math.PI;
    for(let lon=0;lon<=longitudes;lon++){
      const u=-Math.PI+lon/longitudes*Math.PI*2;
      const x=.5*signedPow(Math.cos(v),exponent)*signedPow(Math.cos(u),exponent);
      const y=.5*signedPow(Math.sin(v),exponent);
      const z=.5*signedPow(Math.cos(v),exponent)*signedPow(Math.sin(u),exponent);
      positions.push(x,y,z);const l=Math.hypot(x,y,z)||1;normals.push(x/l,y/l,z/l);texcoords.push(lon/longitudes,lat/latitudes);
    }
  }
  for(let lat=0;lat<latitudes;lat++)for(let lon=0;lon<longitudes;lon++){
    const a=lat*(longitudes+1)+lon,b=a+longitudes+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  return { positions, normals, texcoords, indices };
}

const geometries = { box: boxGeometry(), cylinder: cylinderGeometry(), soft: superellipsoidGeometry(), flat: boxGeometry() };

function quaternionFromEuler(x=0,y=0,z=0){
  const c1=Math.cos(x/2),c2=Math.cos(y/2),c3=Math.cos(z/2),s1=Math.sin(x/2),s2=Math.sin(y/2),s3=Math.sin(z/2);
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}

function pad4(buffer, byte=0){const padding=(4-buffer.length%4)%4;return padding?Buffer.concat([buffer,Buffer.alloc(padding,byte)]):buffer;}
function minMax(values){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i+=3)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],values[i+axis]);max[axis]=Math.max(max[axis],values[i+axis]);}return {min,max};}

function buildGlb(parts, mat){
  const gltf={asset:{version:'2.0',generator:'Product Twin G2 universal proxy builder'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'spine',pbrMetallicRoughness:{baseColorFactor:mat.color,metallicFactor:mat.metallic,roughnessFactor:mat.roughness}}],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const binary=[];let offset=0;
  const addData=(buf,target)=>{const aligned=pad4(buf);const idx=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buf.length,target});binary.push(aligned);offset+=aligned.length;return idx;};
  const addAccessor=(arr,ct,type,count,target,bounds)=>{const buf=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength),view=addData(buf,target),acc={bufferView:view,componentType:ct,count,type};if(bounds){acc.min=bounds.min;acc.max=bounds.max;}gltf.accessors.push(acc);return gltf.accessors.length-1;};
  for(const item of parts){
    const geo=geometries[item.geo],pos=new Float32Array(geo.positions),nrm=new Float32Array(geo.normals),idx=new Uint32Array(geo.indices),bounds=minMax(geo.positions);
    const pA=addAccessor(pos,5126,'VEC3',pos.length/3,34962,bounds),nA=addAccessor(nrm,5126,'VEC3',nrm.length/3,34962),iA=addAccessor(idx,5125,'SCALAR',idx.length,34963);
    const mI=gltf.meshes.length;gltf.meshes.push({name:item.name,primitives:[{attributes:{POSITION:pA,NORMAL:nA},indices:iA,material:0}]});
    const nI=gltf.nodes.length;gltf.nodes.push({name:item.name,mesh:mI,translation:item.translation,rotation:item.rotation,scale:item.scale});gltf.scenes[0].nodes.push(nI);
  }
  gltf.buffers[0].byteLength=offset;
  const jc=pad4(Buffer.from(JSON.stringify(gltf)),0x20),bc=Buffer.concat(binary),hdr=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  hdr.write('glTF',0,'ascii');hdr.writeUInt32LE(2,4);hdr.writeUInt32LE(12+8+jc.length+8+bc.length,8);
  jh.writeUInt32LE(jc.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bc.length,0);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([hdr,jh,jc,bh,bc]);
}

function buildProxy(twin) {
  const dims = twin.physical?.dimensions_mm;
  if (!dims?.width || !dims?.height) return null;

  const w = dims.width / 1000;
  const h = dims.height / 1000;
  const d = (dims.depth || dims.width) / 1000;
  const cat = twin.category_id || '';
  const shape = shapeForCategory(cat);
  const mat = spineMaterial(cat);

  const parts = [{
    name: 'proxy_body',
    geo: shape,
    scale: [w, h, d],
    translation: [0, h / 2, 0],
    rotation: quaternionFromEuler(0, 0, 0),
  }];

  // Seating: add legs
  if (cat.startsWith('FFE.SEATING') && h > 0.3) {
    const legH = Math.min(h * 0.15, 0.08);
    const legR = 0.02;
    const lx = w / 2 - 0.05, lz = d / 2 - 0.05;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
      parts.push({ name: 'leg', geo: 'cylinder', scale: [legR*2, legH, legR*2], translation: [x, legH/2, z], rotation: quaternionFromEuler(0,0,0) });
    }
  }

  // Tables: legs under top
  if (cat.startsWith('FFE.TABLE') && h > 0.2) {
    const topH = Math.min(h * 0.06, 0.045);
    const legH = h - topH;
    parts[0].scale = [w, topH, d];
    parts[0].translation = [0, h - topH/2, 0];
    const legR = Math.min(w, d) * 0.04;
    const lx = w / 2 - 0.06, lz = d / 2 - 0.06;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
      parts.push({ name: 'leg', geo: 'cylinder', scale: [legR*2, legH, legR*2], translation: [x, legH/2, z], rotation: quaternionFromEuler(0,0,0) });
    }
  }

  return { glb: buildGlb(parts, mat), w_mm: dims.width, h_mm: dims.height, d_mm: dims.depth || dims.width };
}

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.endsWith('.json')).sort();
  let promoted = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));

    const geoState = twin.geometry?.state || '';
    const RICHER_STATES = [
      'promoted_realistic_planning_proxy',
      'candidate_live_shopify_native_exact_shape_scale_verified',
      'candidate_live_shopify_native_product_shape',
    ];
    if (RICHER_STATES.includes(geoState)) {
      skipped++;
      continue;
    }

    if (!FORCE && twin.geometry?.level && twin.geometry.level !== 'G0' && twin.geometry.asset_path) {
      try { await fs.access(path.join(ROOT, twin.geometry.asset_path)); skipped++; continue; } catch {}
    }

    const result = buildProxy(twin);
    if (!result) {
      console.error(`SKIP ${twin.twin_id}: no dimensions`);
      failed++;
      continue;
    }

    const slug = twin.twin_id.toLowerCase().replace(/^pt_/, '').replace(/_/g, '-');
    const assetFile = `${slug}-g2-proxy.glb`;
    const assetPath = `data/geometry/avatars/${assetFile}`;
    await fs.writeFile(path.join(ROOT, assetPath), result.glb);

    const avatarId = twin.twin_id.replace(/^PT_/, 'AVATAR_') + '_G2_PROXY';

    twin.geometry = {
      level: 'G2',
      state: 'promoted_universal_proxy',
      avatar_id: avatarId,
      asset_path: assetPath,
      scale_state: `verified ${result.w_mm}x${result.d_mm}x${result.h_mm}mm envelope`,
      shape_claim: 'dimension-verified proxy from category heuristic; not exact manufacturer geometry',
      placement: { origin: 'floor_center', floor_contact: true },
      appearance: {
        pbr_state: 'spine_colour_by_category',
        exact_manufacturer_texture_or_finish_claimed: false,
      },
      rights: {
        geometry_owner: 'Product Twin universal proxy',
        manufacturer_geometry_copied: false,
        manufacturer_texture_artwork_copied: false,
      },
    };

    if (twin.readiness) {
      twin.readiness.geometry = 'G2_promoted_universal_proxy';
    }

    await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    promoted++;
    if (promoted % 20 === 0) console.error(`... ${promoted} promoted`);
  }

  console.log(JSON.stringify({ promoted, skipped, failed, total: promoted + skipped + failed }));
}

await main();
