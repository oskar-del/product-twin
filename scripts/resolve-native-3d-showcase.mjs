// Resolve native manufacturer 3D (glb/usdz) for the NORR11 + Wendelbo Product
// Twins that carry a live Shopify Model3D reference, so they can be shown in a
// real room. Reads each twin's merchant_product_gid, resolves the model sources
// via the token-less Storefront API (retry/backoff for intermittent media), and
// downloads the GLB into .runtime (gitignored) for local rendering. Commits a
// manifest of gid/format/sha/dimensions/offer only — never the binary, and never
// raw CDN URLs (rights_state = review; runtime-inspection only).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const UA = 'product-twin-native-3d-showcase-resolver/0.1';
const TWIN_GLOBS = ['PT_NORR11_', 'PT_WENDELBO_'];

async function readJson(p, fb = null) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fb; throw e; } }

async function post(endpoint, body, attempt = 0) {
  try {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify(body) });
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise((x) => setTimeout(x, 500 * 2 ** attempt)); return post(endpoint, body, attempt + 1); }
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
  } catch (e) { if (attempt < 5) { await new Promise((x) => setTimeout(x, 500 * 2 ** attempt)); return post(endpoint, body, attempt + 1); } return { ok: false, status: 0, error: String(e?.message ?? e) }; }
}

const MODEL_QUERY = `query($id: ID!) {
  product(id: $id) {
    title handle
    variants(first: 5) { nodes { availableForSale price { amount currencyCode } } }
    media(first: 50) { nodes { mediaContentType ... on Model3d { id sources { format url filesize } } } }
  }
}`;

// The Model3D media is intermittently empty on this storefront; retry the whole
// product query until a model appears or the attempt budget is exhausted.
async function resolveModel(endpoint, gid, tries = 6) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const res = await post(endpoint, { query: MODEL_QUERY, variables: { id: gid } });
    const p = res.json?.data?.product;
    if (p) {
      last = p;
      const models = (p.media?.nodes ?? []).filter((n) => n?.mediaContentType === 'MODEL_3D');
      if (models.length) return { product: p, models };
    }
    await new Promise((x) => setTimeout(x, 400 * (i + 1)));
  }
  return { product: last, models: [] };
}

async function download(url, destPath) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
  return { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

async function main() {
  const dir = path.join(ROOT, 'data/twins');
  const files = (await fs.readdir(dir)).filter((f) => TWIN_GLOBS.some((g) => f.startsWith(g)) && f.endsWith('.json')).sort();
  const runtimeDir = path.join(ROOT, '.runtime/showcase/native-3d');
  const generated_at = new Date().toISOString();
  const entries = [];

  for (const file of files) {
    const twin = await readJson(path.join(dir, file));
    const ext = (twin.external_identities ?? []).find((e) => e.source_id === 'shopify_merchant_storefront');
    const gid = ext?.merchant_product_gid;
    const origin = ext?.merchant_origin;
    const entry = { twin_id: twin.twin_id, category_id: twin.category_id, merchant_product_gid: gid ?? null, resolved: false, note: null };
    if (!gid || !origin) { entry.note = 'no shopify merchant gid'; entries.push(entry); continue; }
    const endpoint = `${origin}/api/2026-07/graphql.json`;
    const { product, models } = await resolveModel(endpoint, gid);
    if (!product) { entry.note = 'product not resolved'; entries.push(entry); continue; }
    entry.title = product.title;
    entry.handle = product.handle;
    const v = (product.variants?.nodes ?? [])[0];
    entry.offer = v ? { available: v.availableForSale, price: v.price ? { amount: v.price.amount, currency: v.price.currencyCode } : null } : null;
    if (!models.length) { entry.note = 'model3d not present after retries'; entries.push(entry); console.error(`${twin.twin_id}: no model3d`); continue; }
    const glb = models[0].sources.find((s) => String(s.format).toLowerCase() === 'glb');
    if (!glb?.url) { entry.note = 'no glb source url'; entries.push(entry); continue; }
    const local = path.join(runtimeDir, `${twin.twin_id}.glb`);
    try {
      const dl = await download(glb.url, local);
      entry.resolved = true;
      entry.glb = { format: 'glb', filesize: glb.filesize ?? dl.bytes, sha256: dl.sha256, runtime_path: path.relative(ROOT, local) };
      entry.rights_state = 'review';
      entry.note = 'native manufacturer GLB downloaded to gitignored .runtime (not committed)';
      console.error(`${twin.twin_id}: OK ${(dl.bytes / 1e6).toFixed(2)}MB ${product.title}`);
    } catch (e) { entry.note = `download failed: ${String(e?.message ?? e)}`; console.error(`${twin.twin_id}: ${entry.note}`); }
    entries.push(entry);
  }

  const resolved = entries.filter((e) => e.resolved);
  const manifest = {
    version: '0.1',
    generated_at,
    principle: 'Native manufacturer GLBs stay in gitignored .runtime (rights review). This manifest commits identity/format/sha/offer only, never the binary or raw CDN URL.',
    summary: { twins: entries.length, resolved: resolved.length, unresolved: entries.length - resolved.length },
    entries: entries.map(({ ...e }) => e),
  };
  await fs.mkdir(path.join(ROOT, 'data/geometry'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'data/geometry/native-3d-showcase-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  // A runtime-only sidecar keeps the resolved local paths for the viewer.
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(path.join(runtimeDir, 'index.json'), JSON.stringify({ generated_at, resolved: resolved.map((e) => ({ twin_id: e.twin_id, runtime_path: e.glb.runtime_path, title: e.title })) }, null, 2) + '\n');
  console.log(JSON.stringify(manifest.summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
