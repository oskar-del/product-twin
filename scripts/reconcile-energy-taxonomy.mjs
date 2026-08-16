import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const taxonomyPath=path.join(ROOT,'config','taxonomy.json');
const extensionPath=path.join(ROOT,'config','taxonomy-energy-extension.json');
const taxonomy=JSON.parse(await fs.readFile(taxonomyPath,'utf8'));
const extension=JSON.parse(await fs.readFile(extensionPath,'utf8'));

const idx=taxonomy.top_level.findIndex(x=>x.id==='ENERGY');
if(idx<0) throw new Error('Canonical taxonomy has no ENERGY group');
if(extension.top_level?.id!=='ENERGY') throw new Error('Energy extension does not define ENERGY');

const legacy=taxonomy.top_level[idx];
const preserved=(legacy.children??[]).filter(x=>['ENERGY.SOLAR_THERMAL','ENERGY.WATER_REUSE','ENERGY.RAINWATER'].includes(x.id));
const extensionChildren=extension.top_level.children??[];
const merged=[...extensionChildren];
for(const child of preserved)if(!merged.some(x=>x.id===child.id))merged.push(child);

taxonomy.top_level[idx]={
  id:'ENERGY',
  name:'Energy Generation, Storage & Sustainability',
  children:merged
};
taxonomy.version='0.2';
taxonomy.migrations=[...(taxonomy.migrations??[]),{
  id:'energy_taxonomy_v0_2',
  date:'2026-08-16',
  note:'Replace coarse ENERGY.PV with component-level solar categories from taxonomy-energy-extension; preserve solar thermal, water reuse and rainwater categories.',
  aliases:{'ENERGY.PV':'ENERGY.SOLAR.PANEL','ELECTRICAL.EV':'ENERGY.EV_CHARGER'}
}];

await fs.writeFile(taxonomyPath,JSON.stringify(taxonomy,null,2)+'\n');
console.log(JSON.stringify({version:taxonomy.version,energy_categories:merged.map(x=>x.id)},null,2));
