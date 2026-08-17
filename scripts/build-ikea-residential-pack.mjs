import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { inspectGlb } from './validate-authorized-geometry-qa.mjs';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config/geometry/ikea-residential-starter-pack-v0.1.json');
const OUTPUT = path.join(ROOT, 'data/geometry/avatars');
const METRICS = path.join(ROOT, 'data/metrics');
const requestedArticles = new Set(process.argv.slice(2));

const materials = {
  beigeFabric: { color: [0.55, 0.50, 0.42, 1], roughness: 0.94, metallic: 0, texture: 'fabric', normal: true },
  lightBeigeFabric: { color: [0.76, 0.70, 0.60, 1], roughness: 0.96, metallic: 0, texture: 'fabric', normal: true },
  darkFoot: { color: [0.08, 0.09, 0.08, 1], roughness: 0.76, metallic: 0.06 },
  ash: { color: [0.72, 0.55, 0.34, 1], roughness: 0.72, metallic: 0, texture: 'wood', normal: true },
  ashLight: { color: [0.82, 0.67, 0.45, 1], roughness: 0.68, metallic: 0, texture: 'wood', normal: true },
  whiteLaminate: { color: [0.91, 0.90, 0.84, 1], roughness: 0.58, metallic: 0 },
  whiteShadow: { color: [0.66, 0.67, 0.63, 1], roughness: 0.74, metallic: 0 },
  galvanized: { color: [0.48, 0.51, 0.52, 1], roughness: 0.42, metallic: 0.72 },
  oakLaminate: { color: [0.61, 0.40, 0.22, 1], roughness: 0.66, metallic: 0, texture: 'wood', normal: true },
  oakGrain: { color: [0.34, 0.20, 0.11, 1], roughness: 0.74, metallic: 0, texture: 'wood', normal: true },
  ceramic: { color: [0.94, 0.95, 0.92, 1], roughness: 0.18, metallic: 0 },
  drainMetal: { color: [0.55, 0.57, 0.56, 1], roughness: 0.30, metallic: 0.84 },
  jute: { color: [0.57, 0.42, 0.24, 1], roughness: 0.98, metallic: 0, texture: 'jute', normal: true },
  juteLight: { color: [0.68, 0.52, 0.31, 1], roughness: 0.98, metallic: 0, texture: 'jute', normal: true },
  darkGreyGreen: { color: [0.12, 0.17, 0.14, 1], roughness: 0.43, metallic: 0.22, texture: 'powder', normal: true },
  whiteTextile: { color: [0.91, 0.90, 0.84, 1], roughness: 0.94, metallic: 0, texture: 'textile', normal: true },
};

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
  for (let i=0;i<=segments;i+=1) {
    const angle = i/segments*Math.PI*2, x=Math.cos(angle)*.5, z=Math.sin(angle)*.5;
    positions.push(x,-.5,z,x,.5,z); normals.push(Math.cos(angle),0,Math.sin(angle),Math.cos(angle),0,Math.sin(angle)); texcoords.push(i/segments,0,i/segments,1);
  }
  for (let i=0;i<segments;i+=1) { const a=i*2,b=a+1,c=a+2,d=a+3; indices.push(a,b,c,b,d,c); }
  for (const [y,ny] of [[-.5,-1],[.5,1]]) {
    const center=positions.length/3;positions.push(0,y,0);normals.push(0,ny,0);texcoords.push(.5,.5);
    const ring=positions.length/3;
    for(let i=0;i<=segments;i+=1){const angle=i/segments*Math.PI*2,x=Math.cos(angle)*.5,z=Math.sin(angle)*.5;positions.push(x,y,z);normals.push(0,ny,0);texcoords.push(.5+x,.5+z);}
    for(let i=0;i<segments;i+=1) ny>0?indices.push(center,ring+i,ring+i+1):indices.push(center,ring+i+1,ring+i);
  }
  return { positions, normals, texcoords, indices };
}

function superellipsoidGeometry(latitudes = 14, longitudes = 24, exponent = .34) {
  const positions=[],normals=[],texcoords=[],indices=[];
  const signedPow=(value,power)=>Math.sign(value)*Math.pow(Math.abs(value),power);
  for(let latitude=0;latitude<=latitudes;latitude+=1){
    const v=-Math.PI/2+latitude/latitudes*Math.PI;
    for(let longitude=0;longitude<=longitudes;longitude+=1){
      const u=-Math.PI+longitude/longitudes*Math.PI*2;
      const x=.5*signedPow(Math.cos(v),exponent)*signedPow(Math.cos(u),exponent);
      const y=.5*signedPow(Math.sin(v),exponent);
      const z=.5*signedPow(Math.cos(v),exponent)*signedPow(Math.sin(u),exponent);
      positions.push(x,y,z);const length=Math.hypot(x,y,z)||1;normals.push(x/length,y/length,z/length);texcoords.push(longitude/longitudes,latitude/latitudes);
    }
  }
  for(let latitude=0;latitude<latitudes;latitude+=1)for(let longitude=0;longitude<longitudes;longitude+=1){
    const a=latitude*(longitudes+1)+longitude,b=a+longitudes+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  return { positions, normals, texcoords, indices };
}

const geometries = { box: boxGeometry(), cylinder: cylinderGeometry(), soft: superellipsoidGeometry() };

function quaternionFromEuler(x=0,y=0,z=0){
  const c1=Math.cos(x/2),c2=Math.cos(y/2),c3=Math.cos(z/2),s1=Math.sin(x/2),s2=Math.sin(y/2),s3=Math.sin(z/2);
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}

function part(name,geometry,material,scale,translation,rotation=[0,0,0]) { return { name, geometry, material, scale, translation, rotation: quaternionFromEuler(...rotation) }; }

function pad4(buffer, byte=0){const padding=(4-buffer.length%4)%4;return padding?Buffer.concat([buffer,Buffer.alloc(padding,byte)]):buffer;}
function minMax(values){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i+=3)for(let axis=0;axis<3;axis+=1){min[axis]=Math.min(min[axis],values[i+axis]);max[axis]=Math.max(max[axis],values[i+axis]);}return {min,max};}

function buildGlb(parts){
  const materialNames=[...new Set(parts.map(item=>item.material))];
  const gltf={asset:{version:'2.0',generator:'Product Twin verified G2 builder'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:materialNames.map(name=>({name,pbrMetallicRoughness:{baseColorFactor:materials[name].color,metallicFactor:materials[name].metallic,roughnessFactor:materials[name].roughness}})),accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const binary=[];let offset=0;
  const addData=(buffer,target)=>{const aligned=pad4(buffer);const index=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length,target});binary.push(aligned);offset+=aligned.length;return index;};
  const addAccessor=(array,componentType,type,count,target,bounds)=>{const buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=addData(buffer,target),accessor={bufferView:view,componentType,count,type};if(bounds){accessor.min=bounds.min;accessor.max=bounds.max;}gltf.accessors.push(accessor);return gltf.accessors.length-1;};
  for(const item of parts){
    const geometry=geometries[item.geometry],positions=new Float32Array(geometry.positions),normals=new Float32Array(geometry.normals),indices=new Uint32Array(geometry.indices),bounds=minMax(geometry.positions);
    const positionAccessor=addAccessor(positions,5126,'VEC3',positions.length/3,34962,bounds),normalAccessor=addAccessor(normals,5126,'VEC3',normals.length/3,34962),indexAccessor=addAccessor(indices,5125,'SCALAR',indices.length,34963);
    const meshIndex=gltf.meshes.length;gltf.meshes.push({name:item.name,primitives:[{attributes:{POSITION:positionAccessor,NORMAL:normalAccessor},indices:indexAccessor,material:materialNames.indexOf(item.material)}]});
    const nodeIndex=gltf.nodes.length;gltf.nodes.push({name:item.name,mesh:meshIndex,translation:item.translation,rotation:item.rotation,scale:item.scale});gltf.scenes[0].nodes.push(nodeIndex);
  }
  gltf.buffers[0].byteLength=offset;
  const jsonChunk=pad4(Buffer.from(JSON.stringify(gltf)),0x20),binChunk=Buffer.concat(binary),header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
  header.write('glTF',0,'ascii');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+binChunk.length,8);
  jsonHeader.writeUInt32LE(jsonChunk.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(binChunk.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jsonHeader,jsonChunk,binHeader,binChunk]);
}

function furnitureParts(article){
  switch(article){
    case '494.405.97': return [
      part('sofa_base','box','beigeFabric',[2.12,.28,.90],[0,.20,0]),part('back_frame','box','beigeFabric',[1.80,.58,.16],[0,.50,.375]),
      part('left_arm','soft','beigeFabric',[.24,.64,.95],[-1.02,.42,0]),part('right_arm','soft','beigeFabric',[.24,.64,.95],[1.02,.42,0]),
      ...[-.60,0,.60].map((x,i)=>part(`seat_cushion_${i+1}`,'soft','lightBeigeFabric',[.57,.15,.60],[x,.47,-.08])),
      ...[-.60,0,.60].map((x,i)=>part(`back_cushion_${i+1}`,'soft','beigeFabric',[.57,.36,.23],[x,.65,.25])),
      ...[-.96,.96].flatMap((x)=>[-.38,.38].map((z)=>part('low_foot','cylinder','darkFoot',[.07,.06,.07],[x,.03,z]))),
    ];
    case '392.407.87': return [
      part('seat_cushion','soft','lightBeigeFabric',[.56,.16,.50],[0,.43,-.05]),part('back_cushion','soft','lightBeigeFabric',[.56,.58,.14],[0,.71,.20]),
      ...[-.29,.29].flatMap((x)=>[
        part('front_frame','box','ashLight',[.055,.055,.82],[x,.18,0]),part('back_frame','box','ashLight',[.055,.72,.055],[x,.64,.22]),
        part('arm','box','ashLight',[.055,.055,.66],[x,.54,-.01]),part('floor_leg','box','ashLight',[.055,.36,.055],[x,.18,-.38]),
      ]),
      part('front_crossbar','cylinder','ashLight',[.055,.68,.055],[0,.18,-.3825],[0,0,Math.PI/2]),part('rear_crossbar','cylinder','ashLight',[.055,.68,.055],[0,.18,.3825],[0,0,Math.PI/2]),
    ];
    case '702.943.39': return [
      part('table_top','box','ashLight',[1.40,.045,.78],[0,.7175,0]),
      ...[-.62,.62].flatMap((x)=>[-.31,.31].map((z)=>part('tapered_leg','cylinder','ash',[.065,.695,.065],[x,.3475,z],[z>0?.05:-.05,0,x>0?-.05:.05]))),
    ];
    case '004.572.35': return [
      part('seat','soft','ashLight',[.46,.055,.39],[0,.4475,-.03]),part('back','soft','ashLight',[.44,.20,.055],[0,.69,.205],[-.10,0,0]),
      ...[-.19,.19].flatMap((x)=>[-.235,.235].map((z)=>part('chair_leg','cylinder','ash',[.045,.445,.045],[x,.2225,z]))),
      ...[-.19,.19].map((x)=>part('back_upright','cylinder','ash',[.045,.38,.045],[x,.61,.235])),
    ];
    case '099.293.73': return [
      part('headboard','box','whiteLaminate',[1.76,1.0,.045],[0,.50,1.0225]),part('footboard','box','whiteLaminate',[1.76,.38,.045],[0,.19,-1.0225]),
      ...[-.855,.855].map((x)=>part('side_rail','box','whiteLaminate',[.05,.22,2.045],[x,.30,-.0125])),
      part('centre_beam','box','galvanized',[.045,.055,1.98],[0,.34,-.015]),
      ...Array.from({length:14},(_,i)=>part(`slat_${i+1}`,'box','ashLight',[1.60,.018,.065],[0,.39,-.91+i*.14])),
    ];
    case '002.638.50': return [
      part('left_side','box','whiteLaminate',[.03,2.02,.28],[-.385,1.01,0]),part('right_side','box','whiteLaminate',[.03,2.02,.28],[.385,1.01,0]),
      part('top','box','whiteLaminate',[.77,.03,.28],[0,2.005,0]),part('bottom','box','whiteLaminate',[.77,.03,.28],[0,.015,0]),part('back','box','whiteShadow',[.74,1.96,.012],[0,1.01,.134]),
      ...[.20,.55,.90,1.25,1.60,1.93].map((y,i)=>part(`shelf_${i+1}`,'box','whiteLaminate',[.74,.025,.26],[0,y,0])),
    ];
    case '893.306.91': return [
      part('cabinet','box','whiteLaminate',[1.80,.38,.40],[0,.19,.01]),part('front_shadow','box','whiteShadow',[1.74,.32,.010],[0,.19,-.195]),
      ...[-.59,0,.59].map((x,i)=>part(`front_${i+1}`,'box','whiteLaminate',[.56,.30,.014],[x,.19,-.203])),
      ...[-.84,.84].flatMap((x)=>[-.16,.16].map((z)=>part('foot','cylinder','darkFoot',[.035,.035,.035],[x,.0175,z]))),
    ];
    case '604.391.73': {
      const grain=Array.from({length:22},(_,i)=>{
        const z=-.29+i*.027, length=.65+(i%5)*.24, x=((i*37)%11-5)*.035;
        return part(`oak_grain_${i+1}`,'box','oakGrain',[Math.min(length,1.84-2*Math.abs(x)),.0006,.0028],[x,.0377,z]);
      });
      return [part('countertop_slab','box','oakLaminate',[1.86,.0374,.635],[0,.0187,0]),...grain];
    }
    case '305.139.04': return [
      part('table_top','box','ashLight',[1.40,.045,.60],[0,.3475,0]),
      ...[-.64,.64].flatMap((x)=>[-.24,.24].map((z)=>part('solid_oak_leg','box','ash',[.065,.325,.065],[x,.1625,z]))),
      ...Array.from({length:13},(_,i)=>part(`slatted_shelf_${i+1}`,'box','ash',[1.24,.022,.024],[0,.135,-.252+i*.042])),
      part('front_rail','box','ash',[1.28,.11,.035],[0,.285,-.265]),part('rear_rail','box','ash',[1.28,.11,.035],[0,.285,.265]),
    ];
    case '206.280.38': return [
      part('table_top','box','ashLight',[1.18,.040,.72],[0,.480,0]),
      ...[-.52,.52].flatMap((x)=>[-.29,.29].map((z)=>part('solid_oak_leg','box','ash',[.060,.460,.060],[x,.230,z]))),
      part('lower_shelf','box','ashLight',[1.04,.024,.58],[0,.145,0]),
      part('front_apron','box','ash',[1.06,.100,.030],[0,.410,-.330]),
      part('rear_apron','box','ash',[1.06,.100,.030],[0,.410,.330]),
    ];
    case '305.112.88': return [
      part('jute_base','box','jute',[1.33,.012,1.95],[0,.006,0]),
      ...Array.from({length:43},(_,i)=>part(`weft_cue_${i+1}`,'box',i%3===0?'juteLight':'jute',[1.33,.001,.006],[0,.0125,-.945+i*.045])),
      ...Array.from({length:29},(_,i)=>part(`warp_cue_${i+1}`,'box',i%4===0?'juteLight':'jute',[.006,.001,1.95],[-.64+i*.046,.0125,0])),
    ];
    case '705.784.51': return [
      part('removable_tray','cylinder','darkGreyGreen',[.45,.030,.45],[0,.515,0]),
      part('lower_ring','cylinder','darkGreyGreen',[.37,.018,.37],[0,.105,0]),
      ...[-.17,.17].flatMap((x)=>[-.17,.17].map((z)=>part('slender_leg','cylinder','darkGreyGreen',[.018,.50,.018],[x,.25,z]))),
    ];
    case '304.050.42': return [
      part('shade','cylinder','whiteTextile',[.37,.40,.37],[0,1.31,0]),
      part('centre_post','cylinder','ashLight',[.038,.76,.038],[0,.83,0]),
      part('left_leg','box','ashLight',[.055,.91,.055],[-.130,.455,0],[0,0,-.300]),
      part('right_leg','box','ashLight',[.055,.91,.055],[.130,.455,0],[0,0,.300]),
      part('rear_leg','box','ashLight',[.055,.91,.055],[0,.455,.130],[.300,0,0]),
      part('front_foot_envelope','box','ashLight',[.040,.025,.620],[0,.0125,0]),
      part('side_foot_envelope','box','ashLight',[.620,.025,.040],[0,.0125,0]),
    ];
    default: throw new Error(`No furniture builder for ${article}`);
  }
}

function rocaParts(){return [
  part('basin_base_proxy','box','ceramic',[.60,.010,.38],[0,.005,0]),part('rim_front','box','ceramic',[.60,.07,.028],[0,.035,-.176]),part('rim_back','box','ceramic',[.60,.07,.028],[0,.035,.176]),
  part('rim_left','box','ceramic',[.028,.07,.324],[-.286,.035,0]),part('rim_right','box','ceramic',[.028,.07,.324],[.286,.035,0]),part('drain_cue','cylinder','drainMetal',[.036,.006,.036],[0,.013,0]),
];}

await fs.mkdir(OUTPUT,{recursive:true});await fs.mkdir(METRICS,{recursive:true});
const config=JSON.parse(await fs.readFile(CONFIG_PATH,'utf8')),results=[];
const products=requestedArticles.size?config.products.filter((product)=>requestedArticles.has(product.article_no)):config.products;
if(requestedArticles.size&&products.length!==requestedArticles.size)throw new Error(`Requested ${requestedArticles.size} article(s), found ${products.length} in the pack config`);
for(const product of products){
  const glb=buildGlb(furnitureParts(product.article_no)),inspection=inspectGlb(glb),actual=inspection.dimensions_mm,expected=[product.dimensions_mm.width,product.dimensions_mm.height,product.dimensions_mm.depth],errors=expected.map((value,index)=>Math.abs(actual[index]-value)/value),status=Math.max(...errors)<=.02?'G2_REALISTIC_PROXY_SCALE_PASS':'SCALE_FAIL';
  const assetPath=path.join(OUTPUT,product.asset_file);await fs.writeFile(assetPath,glb);
  const metric={generated_at:new Date().toISOString(),avatar_id:product.avatar_id,status,promotion_level:status==='G2_REALISTIC_PROXY_SCALE_PASS'?'G2':'G0',asset_path:path.relative(ROOT,assetPath),asset_bytes:glb.length,identity:{merchant:config.merchant,product_family:product.product_family,article_no:product.article_no,official_url:product.official_url},expected_mm:product.dimensions_mm,measured_xyz_mm:{width:actual[0],height:actual[1],depth:actual[2]},relative_error_max:Math.max(...errors),material_cues:product.material_cues,placement:product.placement,disclosure:config.geometry_policy,commerce:product.commerce_evidence??{state:'OFFICIAL_PRODUCT_PAGE_VERIFIED_LIVE_AVAILABILITY_REFRESH_REQUIRED',observed_at:config.observed_at}};
  await fs.writeFile(path.join(METRICS,product.asset_file.replace('.glb','-latest.json')),JSON.stringify(metric,null,2)+'\n');results.push({article_no:product.article_no,status,dimensions_mm:actual.map(value=>Number(value.toFixed(2))),relative_error_max:metric.relative_error_max});
}
if(!requestedArticles.size){const rocaGlb=buildGlb(rocaParts());await fs.writeFile(path.join(OUTPUT,'roca-a32727500b-g2-basin-proxy.glb'),rocaGlb);}
console.log(JSON.stringify({status:results.every(result=>result.status==='G2_REALISTIC_PROXY_SCALE_PASS')?'PASS':'FAIL',products:results,roca_material_refresh:requestedArticles.size?'SKIPPED_FILTERED_BUILD':'PASS'},null,2));
if(results.some(result=>result.status!=='G2_REALISTIC_PROXY_SCALE_PASS'))process.exitCode=1;
