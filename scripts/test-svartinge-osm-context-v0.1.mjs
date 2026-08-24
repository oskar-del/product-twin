import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validateOsmContext} from "./validate-svartinge-osm-context-v0.1.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const original=JSON.parse(fs.readFileSync(path.join(root,"data/sites/sweden/saterdalsvagen-14/osm-context-v0.1.json"),"utf8"));
const clone=value=>structuredClone(value);
const attacks=[
  ["source promoted to official",value=>value.source.official_source=true,/source identity promoted/],
  ["licence removed",value=>value.source.license="NONE",/ODbL attribution/],
  ["attribution hidden",value=>value.evidence_policy.required_attribution_visible=false,/promoted or mixed/],
  ["raw hash edited",value=>value.source.raw_sha256="0".repeat(64),/runtime OpenStreetMap hash mismatch|derived context content hash mismatch|timestamps drift/],
  ["context radius changed",value=>value.subject.context_radius_m=200,/radius or halo/],
  ["clip bounds expanded",value=>value.transform.clip_bounds_xz_m[2]=5000,/transform contract/],
  ["road point moved outside cell",value=>value.compiled.roads[0].points_xz[0][0]=1200,/road context incomplete/],
  ["ten-street context removed",value=>{for(const road of value.compiled.roads)road.name=null;},/ten-street recognizable/],
  ["building source height fabricated",value=>value.compiled.buildings[0].source_height_m=7,/building footprints/],
  ["building height method promoted",value=>value.compiled.buildings[0].height_method="SURVEYED",/building footprints/],
  ["building footprint removed",value=>value.compiled.buildings.splice(0,300),/building footprints/],
  ["feature ID duplicated",value=>value.compiled.roads[1].feature_id=value.compiled.roads[0].feature_id,/feature IDs/],
  ["derived hash forged",value=>value.derived_content_sha256="0".repeat(64),/content hash/],
  ["official gate closed",value=>value.evidence_policy.official_geometry_gates_closed=true,/promoted or mixed/],
  ["market data ingested",value=>value.evidence_policy.market_data_included=true,/promoted or mixed/],
  ["personal data ingested",value=>value.evidence_policy.personal_data_included=true,/promoted or mixed/],
  ["credential persisted",value=>value.source.credentials_persisted=true,/credential state/],
  ["unknown field added",value=>value.invented_geometry=true,/unknown or missing fields/]
];

let rejected=0;const failures=[];
for(const [name,mutate,pattern] of attacks){const value=clone(original);mutate(value);const result=validateOsmContext(value,{requireRuntime:name==="raw hash edited"});if(!result.ok&&pattern.test(result.errors.join("\n")))rejected++;else failures.push(`${name}: ${result.errors.join(" | ")||"accepted"}`);}
if(failures.length){console.error(`SVÄRTINGE OSM CONTEXT MUTATIONS: FAIL\n- ${failures.join("\n- ")}`);process.exit(1);}
console.log(`SVÄRTINGE OSM CONTEXT MUTATIONS: PASS (${rejected}/${attacks.length} attacks rejected)`);
