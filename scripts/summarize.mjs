import fs from "node:fs/promises";

const candidates = JSON.parse(await fs.readFile("data/shopify/candidates/latest.json", "utf8"));
const categories = new Map();
for (const c of candidates) {
  const key = c.discovered?.query_key ?? "unknown";
  categories.set(key, (categories.get(key) ?? 0) + 1);
}
console.log(`Twin candidates: ${candidates.length}`);
for (const [key,count] of [...categories.entries()].sort()) console.log(`${key}: ${count}`);
