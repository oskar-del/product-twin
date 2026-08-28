// Build G2 proxy geometry for Newport FURNITURE twins.
// Parses dimensions from desc when present, falls back to category defaults.
// Usage: node scripts/build-newport-proxies.mjs [--force]
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TWINS_DIR = path.join(ROOT, 'data/twins');
const OUTPUT = path.join(ROOT, 'data/geometry/avatars');
const FORCE = process.argv.includes('--force');

// Category defaults (W x D x H in mm) — industry-standard furniture envelopes
const CATEGORY_DEFAULTS = {
  'FFE.SEATING.ARMCHAIR':      { w: 750, d: 800, h: 850, shape: 'soft' },
  'FFE.SEATING.SOFA':          { w: 2000, d: 900, h: 850, shape: 'soft' },
  'FFE.SEATING.CHAIR':         { w: 450, d: 500, h: 850, shape: 'box' },
  'FFE.SEATING.DINING_CHAIR':  { w: 450, d: 530, h: 850, shape: 'box' },
  'FFE.SEATING.BAR_STOOL':     { w: 400, d: 400, h: 1050, shape: 'cylinder' },
  'FFE.SEATING.BENCH':         { w: 1200, d: 400, h: 450, shape: 'box' },
  'FFE.TABLE.COFFEE':          { w: 1200, d: 600, h: 400, shape: 'box' },
  'FFE.TABLE.SIDE':            { w: 500, d: 500, h: 550, shape: 'box' },
  'FFE.TABLE.DINING':          { w: 1800, d: 900, h: 750, shape: 'box' },
  'FFE.TABLE.CONSOLE':         { w: 1200, d: 350, h: 800, shape: 'box' },
  'FFE.TABLE.BEDSIDE':         { w: 450, d: 400, h: 550, shape: 'box' },
  'FFE.TABLE':                 { w: 1000, d: 600, h: 500, shape: 'box' },
  'FFE.BEDROOM.BED':           { w: 1800, d: 2100, h: 1000, shape: 'box' },
  'FFE.STORAGE':               { w: 800, d: 400, h: 800, shape: 'box' },
  'FFE.STORAGE.SHELF':         { w: 800, d: 300, h: 1800, shape: 'box' },
  'FFE.STORAGE.CABINET':       { w: 800, d: 450, h: 1200, shape: 'box' },
  'FFE.STORAGE.DRESSER':       { w: 900, d: 450, h: 800, shape: 'box' },
  'FFE.TEXTILES.RUG':          { w: 1700, d: 2400, h: 12, shape: 'flat' },
  'FFE.OUTDOOR':               { w: 800, d: 800, h: 750, shape: 'box' },
  'FFE.OUTDOOR.SEATING':       { w: 750, d: 800, h: 800, shape: 'soft' },
  'FFE.OUTDOOR.SOFA':          { w: 2000, d: 900, h: 800, shape: 'soft' },
  'FFE.OUTDOOR.TABLE':         { w: 1500, d: 800, h: 750, shape: 'box' },
  'ELECTRICAL.LUMINAIRES.TABLE': { w: 300, d: 300, h: 500, shape: 'cylinder' },
  'ELECTRICAL.LUMINAIRES.FLOOR': { w: 400, d: 400, h: 1500, shape: 'cylinder' },
  'ELECTRICAL.LUMINAIRES':     { w: 350, d: 350, h: 400, shape: 'cylinder' },
  '_default':                  { w: 600, d: 400, h: 600, shape: 'box' },
};

function getDims(twin) {
  if (twin.physical?.dimensions_mm?.width) return twin.physical.dimensions_mm;
  const cat = twin.category_id || '';
  const def = CATEGORY_DEFAULTS[cat] || CATEGORY_DEFAULTS[cat.split('.').slice(0, 3).join('.')] || CATEGORY_DEFAULTS[cat.split('.').slice(0, 2).join('.')] || CATEGORY_DEFAULTS._default;
  return { width: def.w, depth: def.d, height: def.h };
}

function getShape(cat) {
  const entry = CATEGORY_DEFAULTS[cat] || CATEGORY_DEFAULTS[cat.split('.').slice(0, 3).join('.')] || CATEGORY_DEFAULTS[cat.split('.').slice(0, 2).join('.')] || CATEGORY_DEFAULTS._default;
  return entry.shape;
}

// Newport spine colours — warm New England palette
const SPINE_MATERIALS = {
  'FFE.SEATING':   { color: [0.72, 0.68, 0.62, 1], roughness: 0.92, metallic: 0 },
  'FFE.STORAGE':   { color: [0.88, 0.86, 0.82, 1], roughness: 0.60, metallic: 0 },
  'FFE.TABLE':     { color: [0.65, 0.52, 0.35, 1], roughness: 0.70, metallic: 0 },
  'FFE.BEDROOM':   { color: [0.85, 0.83, 0.78, 1], roughness: 0.58, metallic: 0 },
  'FFE.TEXTILES':  { color: [0.78, 0.72, 0.62, 1], roughness: 0.96, metallic: 0 },
  'FFE.OUTDOOR':   { color: [0.60, 0.55, 0.45, 1], roughness: 0.80, metallic: 0 },
  'FFE.DECOR':     { color: [0.82, 0.78, 0.70, 1], roughness: 0.70, metallic: 0 },
  'ELECTRICAL':    { color: [0.55, 0.55, 0.52, 1], roughness: 0.45, metallic: 0.15 },
  '_default':      { color: [0.75, 0.72, 0.68, 1], roughness: 0.70, metallic: 0 },
};

function spineMaterial(categoryId) {
  for (const [prefix, mat] of Object.entries(SPINE_MATERIALS)) {
    if (prefix !== '_default' && categoryId.startsWith(prefix)) return mat;
  }
  return SPINE_MATERIALS._default;
}

// Try to parse dimensions from description text
function parseDimsFromDesc(desc) {
  if (!desc) return null;
  // Match patterns like "130 x 60 x 75" or "180 x 210 cm"
  const m = desc.match(/(\d{2,4})\s*x\s*(\d{2,4})(?:\s*x\s*(\d{2,4}))?\s*(cm|mm)?/i);
  if (!m) return null;
  const unit = (m[4] || 'cm').toLowerCase();
  const scale = unit === 'mm' ? 1 : 10;
  const v1 = parseInt(m[1]) * scale;
  const v2 = parseInt(m[2]) * scale;
  const v3 = m[3] ? parseInt(m[3]) * scale : null;
  if (v3) return { width: v1, depth: v2, height: v3 };
  return { width: v1, depth: v2, height: null };
}

// ---- Geometry generators (same as build-all-proxies.mjs) ----
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

function pad4(buffer, byte=0){const padding=(4-buffer.length%4)%4;return padding?Buffer.concat([buffer,Buffer.alloc(padding,byte)]):buffer;}
function minMax(values){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i+=3)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],values[i+axis]);max[axis]=Math.max(max[axis],values[i+axis]);}return {min,max};}

function buildGlb(parts, mat){
  const gltf={asset:{version:'2.0',generator:'Product Twin Newport G2 proxy'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'spine',pbrMetallicRoughness:{baseColorFactor:mat.color,metallicFactor:mat.metallic,roughnessFactor:mat.roughness}}],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const binary=[];let offset=0;
  const addData=(buf,target)=>{const aligned=pad4(buf);const idx=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buf.length,target});binary.push(aligned);offset+=aligned.length;return idx;};
  const addAccessor=(arr,ct,type,count,target,bounds)=>{const buf=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength),view=addData(buf,target),acc={bufferView:view,componentType:ct,count,type};if(bounds){acc.min=bounds.min;acc.max=bounds.max;}gltf.accessors.push(acc);return gltf.accessors.length-1;};
  for(const item of parts){
    const geo=geometries[item.geo],pos=new Float32Array(geo.positions),nrm=new Float32Array(geo.normals),idx=new Uint32Array(geo.indices),bounds=minMax(geo.positions);
    const pA=addAccessor(pos,5126,'VEC3',pos.length/3,34962,bounds),nA=addAccessor(nrm,5126,'VEC3',nrm.length/3,34962),iA=addAccessor(idx,5125,'SCALAR',idx.length,34963);
    const mI=gltf.meshes.length;gltf.meshes.push({name:item.name,primitives:[{attributes:{POSITION:pA,NORMAL:nA},indices:iA,material:0}]});
    const nI=gltf.nodes.length;gltf.nodes.push({name:item.name,mesh:mI,translation:item.translation,scale:item.scale});gltf.scenes[0].nodes.push(nI);
  }
  gltf.buffers[0].byteLength=offset;
  const jc=pad4(Buffer.from(JSON.stringify(gltf)),0x20),bc=Buffer.concat(binary),hdr=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  hdr.write('glTF',0,'ascii');hdr.writeUInt32LE(2,4);hdr.writeUInt32LE(12+8+jc.length+8+bc.length,8);
  jh.writeUInt32LE(jc.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bc.length,0);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([hdr,jh,jc,bh,bc]);
}

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const files = (await fs.readdir(TWINS_DIR)).filter(f => f.startsWith('PT_NEWPORT_') && f.endsWith('.json')).sort();
  let promoted = 0, skipped = 0, catalogOnly = 0;

  for (const file of files) {
    const p = path.join(TWINS_DIR, file);
    const twin = JSON.parse(await fs.readFile(p, 'utf8'));

    if (twin.bucket !== 'FURNITURE') { catalogOnly++; continue; }

    if (!FORCE && twin.geometry?.level && twin.geometry.level !== 'G0') {
      skipped++; continue;
    }

    const cat = twin.category_id || '';
    const shape = getShape(cat);
    const mat = spineMaterial(cat);

    // Try to extract dims from desc
    const parsed = parseDimsFromDesc(twin.identity?.name + ' ' + (twin.appearance?.material || ''));
    const dims = getDims(twin);
    if (parsed) {
      if (parsed.width) dims.width = parsed.width;
      if (parsed.depth) dims.depth = parsed.depth;
      if (parsed.height) dims.height = parsed.height;
    }

    const w = dims.width / 1000;
    const h = dims.height / 1000;
    const d = (dims.depth || dims.width) / 1000;

    const parts = [{
      name: 'proxy_body',
      geo: shape,
      scale: [w, h, d],
      translation: [0, h / 2, 0],
    }];

    // Tables: legs
    if (cat.includes('TABLE') && h > 0.2) {
      const topH = Math.min(h * 0.06, 0.045);
      const legH = h - topH;
      parts[0].scale = [w, topH, d];
      parts[0].translation = [0, h - topH/2, 0];
      const legR = Math.min(w, d) * 0.04;
      const lx = w / 2 - 0.06, lz = d / 2 - 0.06;
      for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
        parts.push({ name: 'leg', geo: 'cylinder', scale: [legR*2, legH, legR*2], translation: [x, legH/2, z] });
      }
    }

    const glb = buildGlb(parts, mat);
    const slug = `newport-${twin.identity.article_no}`;
    const assetFile = `${slug}-g2-proxy.glb`;
    const assetPath = `data/geometry/avatars/${assetFile}`;
    await fs.writeFile(path.join(ROOT, assetPath), glb);

    twin.physical = twin.physical || {};
    twin.physical.dimensions_mm = dims;
    twin.geometry = {
      level: 'G2',
      state: 'promoted_universal_proxy',
      avatar_id: `AVATAR_NEWPORT_${twin.identity.article_no}_G2_PROXY`,
      asset_path: assetPath,
      scale_state: `category_default ${dims.width}x${dims.depth || dims.width}x${dims.height}mm`,
      shape_claim: 'category-default proxy; not manufacturer geometry',
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
    twin.readiness = twin.readiness || {};
    twin.readiness.geometry = 'G2_promoted_universal_proxy';

    await fs.writeFile(p, JSON.stringify(twin, null, 2) + '\n');
    promoted++;
    if (promoted % 500 === 0) process.stderr.write(`... ${promoted} furniture promoted\n`);
  }

  console.log(JSON.stringify({ promoted, skipped, catalogOnly, total: promoted + skipped + catalogOnly }));
}

await main();
