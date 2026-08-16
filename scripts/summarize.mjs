import fs from "node:fs/promises";

const candidates = JSON.parse(await fs.readFile("data/shopify/triage/latest.json", "utf8"));
const coverage = JSON.parse(await fs.readFile("data/coverage/summary.json", "utf8"));
const categories = new Map();

for (const c of candidates) {
  const key = c.taxonomy?.canonical_category_id ?? "UNCLASSIFIED";
  categories.set(key, (categories.get(key) ?? 0) + 1);
}

console.log(`Twin candidates: ${candidates.length}`);
console.log(`Canonical categories with candidates: ${coverage.categories_with_candidates}/${coverage.category_count}`);
console.log(`Categories with commerce candidates: ${coverage.categories_with_commerce}`);
console.log(`Categories with renderable supply: ${coverage.categories_with_renderable_supply}`);
console.log("\nCandidate count by provisional canonical category:");
for (const [key,count] of [...categories.entries()].sort((a,b)=>b[1]-a[1])) {
  console.log(`${key}: ${count}`);
}
