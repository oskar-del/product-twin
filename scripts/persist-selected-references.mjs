import fs from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,".runtime/shopify");
const test=JSON.parse(await fs.readFile(path.join(ROOT,"data/tests/whole-building-10.json"),"utf8"));
let offers={slots:[]};
try { offers=JSON.parse(await fs.readFile(path.join(RUNTIME,"offers.json"),"utf8")); } catch {}

const offersBySlot=new Map((offers.slots??[]).map(x=>[x.slot_id,x]));
const previousPath=path.join(ROOT,"data/references",`${test.project_id.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.shopify.json`);
let previous={selections:[]};
try { previous=JSON.parse(await fs.readFile(previousPath,"utf8")); } catch {}
const previousBySlot=new Map((previous.selections??[]).map(x=>[x.slot_id,x]));

const selections=[];
for(const requirement of test.requirements){
  const live=offersBySlot.get(requirement.slot_id);
  const best=live?.best_offer??null;
  const old=previousBySlot.get(requirement.slot_id)??null;

  if(best?.shopify_id && best?.ships_to_project){
    const same=old?.external_reference?.external_id===best.shopify_id &&
      old?.external_reference?.variant_id===best.variant_id;
    selections.push({
      slot_id:requirement.slot_id,
      category_id:requirement.category_id,
      selection_mode:"auto_hypothesis_test",
      selected_at:same?(old.selected_at??new Date().toISOString()):new Date().toISOString(),
      last_confirmed_live_at:new Date().toISOString(),
      external_reference:{
        source_id:"shopify_global_catalog",
        reference_type:"catalog_product",
        external_id:best.shopify_id,
        variant_id:best.variant_id??null,
        role:"commerce_lookup",
        refresh_policy:"live_required",
        persisted_fields_policy:"reference_only"
      },
      verification:{
        identity_state:"unresolved_canonical_identity",
        technical_state:"unverified",
        destination_state:"confirmed_for_test_postcode_at_selection_time"
      }
    });
  } else if(old) {
    selections.push({
      ...old,
      last_confirmed_live_at:null,
      current_live_state:"not_reconfirmed_in_latest_run"
    });
  } else {
    selections.push({
      slot_id:requirement.slot_id,
      category_id:requirement.category_id,
      selection_mode:"auto_hypothesis_test",
      external_reference:null,
      verification:{
        identity_state:"no_selected_reference",
        technical_state:"unverified",
        destination_state:"unresolved"
      }
    });
  }
}

const output={
  version:"0.1",
  project_id:test.project_id,
  source_policy:"Reference-only persistence. Mutable Shopify catalog fields are resolved live and are not stored here.",
  generated_at:new Date().toISOString(),
  selections
};
await fs.mkdir(path.dirname(previousPath),{recursive:true});
await fs.writeFile(previousPath,JSON.stringify(output,null,2));
console.log(JSON.stringify({project_id:test.project_id,slots:selections.length,selected_references:selections.filter(x=>x.external_reference).length},null,2));
