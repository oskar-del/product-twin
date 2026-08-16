import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const projectPath=process.argv[2]||"data/projects/marbella-villa.example.json";
const project=JSON.parse(await fs.readFile(path.join(ROOT,projectPath),"utf8"));
const slug=(project.project_id||"project").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const solar=JSON.parse(await fs.readFile(path.join(ROOT,`data/energy/${slug}.pvgis.json`),"utf8"));
const seed=JSON.parse(await fs.readFile(path.join(ROOT,"config/climate/cte-db-he-partial.json"),"utf8"));

const province=project.location?.province??null;
const elevation=solar.location?.elevation_m;
if(!province||!Number.isFinite(elevation)) throw new Error("Province and verified site elevation are required for CTE climate-zone resolution.");

const rule=(seed.rules??[]).find(r=>r.province===province && elevation>=r.min_elevation_m && elevation<=r.max_elevation_m);
const output={
  generated_at:new Date().toISOString(),
  project_id:project.project_id,
  province,
  elevation_m:elevation,
  status:rule?"verified":"unresolved",
  cte_zone:rule?.cte_zone??null,
  winter_zone:rule?.cte_zone?.replace(/[0-9]/g,"")??null,
  summer_zone:rule?.cte_zone?.replace(/[^0-9]/g,"")??null,
  source:seed.source,
  evidence_note:rule?.evidence_note??"No verified rule is encoded for this province/elevation band; do not infer a CTE zone.",
  consequence:rule?"Project context may use this CTE zone for energy/envelope regulatory screening.":"Energy-code screening remains on HOLD until the applicable official CTE row/range is verified."
};
await fs.writeFile(path.join(ROOT,`data/energy/${slug}.cte-climate.json`),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
