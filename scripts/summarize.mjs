import fs from "node:fs/promises";
async function read(p,fallback={}){try{return JSON.parse(await fs.readFile(p,"utf8"));}catch{return fallback;}}
const discovery=await read("data/metrics/shopify-discovery-latest.json");
const coverage=await read("data/coverage/summary.json");
const offers=await read("data/metrics/shopify-offer-resolution-latest.json");
const carts=await read("data/metrics/cart-test-latest.json");
const checkouts=await read("data/metrics/checkout-quote-latest.json");
const test=await read("data/tests/results/whole-building-10.latest.json");
console.log(`Live Shopify discovery: ${discovery.unique_candidate_count??0} unique candidates across ${discovery.query_count??0} searches`);
console.log(`Taxonomy live coverage: ${coverage.categories_with_live_discovery??0}/${coverage.category_count??0} categories`);
console.log(`Whole-building slots with live discovery: ${offers.slots_with_discovery??0}`);
console.log(`Slots with postcode-deliverable offer: ${offers.slots_with_postcode_deliverable_offer??0}`);
console.log(`Merchant carts created: ${carts.carts_created??0}`);
console.log(`Authoritative checkout shipping quotes: ${checkouts.authoritative_shipping_quotes??0}`);
console.log(`Procurement-ready test slots: ${test.summary?.procurement_ready??0}`);
console.log("Storage policy: Shopify catalog payloads are ephemeral and are not committed to the repository.");
