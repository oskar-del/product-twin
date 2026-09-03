// Fetches REAL documented variant options (color/material/finish, as published by the
// manufacturer's own Shopify store) for twins that have a merchant_product_gid, and
// writes them into data/geometry/native-3d-showcase-manifest.json as `material_cues`.
// No guessing: only what the storefront itself reports as the selected variant's
// option values is recorded; twins with no option data are marked "undocumented".
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const UA = 'product-twin-native-3d-showcase-resolver/0.1';
const MANIFEST_PATH = path.join(ROOT, 'data/geometry/native-3d-showcase-manifest.json');

const QUERY = `query($id: ID!) {
  product(id: $id) {
    title
    options { name values }
    variants(first: 5) { nodes { title selectedOptions { name value } } }
  }
}`;

async function post(endpoint, body, attempt = 0) {
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify(body) });
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise((x) => setTimeout(x, 400 * 2 ** attempt)); return post(endpoint, body, attempt + 1); }
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
  } catch (e) { if (attempt < 4) { await new Promise((x) => setTimeout(x, 400 * 2 ** attempt)); return post(endpoint, body, attempt + 1); } return { ok: false, error: String(e?.message ?? e) }; }
}

async function readJson(p) { return JSON.parse(await fs.readFile(p, 'utf8')); }

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  const twinsDir = path.join(ROOT, 'data/twins');
  let documented = 0, undocumented = 0;

  for (const entry of manifest.entries) {
    if (!entry.resolved || !entry.merchant_product_gid) { entry.material_cues = { state: 'undocumented', reason: 'not resolved / no gid' }; undocumented++; continue; }
    const twin = await readJson(path.join(twinsDir, `${entry.twin_id}.json`)).catch(() => null);
    const ext = (twin?.external_identities ?? []).find((e) => e.source_id === 'shopify_merchant_storefront');
    const origin = ext?.merchant_origin;
    if (!origin) { entry.material_cues = { state: 'undocumented', reason: 'no merchant origin on twin' }; undocumented++; continue; }

    const endpoint = `${origin}/api/2026-07/graphql.json`;
    const res = await post(endpoint, { query: QUERY, variables: { id: entry.merchant_product_gid } });
    const p = res.json?.data?.product;
    const opts = (p?.options ?? []).filter((o) => /colou?r|finish|fabric|material|leather|frame|upholstery/i.test(o.name));
    if (opts.length) {
      entry.material_cues = { state: 'documented', source: 'shopify_storefront_product_options', options: opts };
      documented++;
    } else {
      entry.material_cues = { state: 'undocumented', reason: p ? 'no color/material/finish option on this product' : 'query failed', options_seen: (p?.options ?? []).map((o) => o.name) };
      undocumented++;
    }
    console.error(`${entry.twin_id}: ${entry.material_cues.state} ${JSON.stringify(opts.map(o=>o.name))}`);
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ total: manifest.entries.length, documented, undocumented }, null, 2));
}

await main();
