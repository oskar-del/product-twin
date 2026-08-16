import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE = process.env.UCP_AGENT_PROFILE ||
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

const cfg = JSON.parse(await fs.readFile(path.join(ROOT, "config/searches.json"), "utf8"));
const now = new Date().toISOString();
const runStamp = now.replace(/[:.]/g, "-");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callMcp(toolName, catalog, attempt=1) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {"content-type": "application/json", "user-agent": "product-twin-github-ingestor/0.1"},
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: {
          meta: {"ucp-agent": {profile: PROFILE}},
          catalog
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (attempt < 4 && [429,500,502,503,504].includes(response.status)) {
      await sleep(800 * attempt * attempt);
      return callMcp(toolName, catalog, attempt + 1);
    }
    throw new Error(`Shopify MCP ${response.status}: ${text}`);
  }

  const json = await response.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.structuredContent ?? json.result;
}

function firstOffer(product) {
  return [...(product.variants ?? [])]
    .filter(v => v.price?.amount != null)
    .sort((a,b) => Number(a.price.amount) - Number(b.price.amount))[0] ?? null;
}

function candidate(product, query) {
  const offer = firstOffer(product);
  const identity = String(product.id ?? product.url ?? `${product.title}|${query.key}`);
  return {
    candidate_id: `SHOPIFY_${crypto.createHash("sha1").update(identity).digest("hex").slice(0,16)}`,
    source: "shopify_global_catalog",
    discovered: {query_key: query.key, query: query.query, fetched_at: now},
    identity: {
      shopify_id: product.id ?? null,
      title: product.title ?? null,
      url: product.url ?? null
    },
    product: {
      title: product.title ?? null,
      description: product.description ?? null,
      categories: product.categories ?? [],
      media: product.media ?? [],
      metadata: product.metadata ?? {},
      variant_count: (product.variants ?? []).length
    },
    best_offer: offer ? {
      variant_id: offer.id ?? null,
      sku: offer.sku ?? null,
      seller: offer.seller ?? null,
      price_minor: offer.price?.amount ?? null,
      currency: offer.price?.currency ?? product.price_range?.min?.currency ?? null,
      available: offer.availability?.available ?? null,
      stock_status: offer.availability?.status ?? null,
      checkout_url: offer.checkout_url ?? null,
      attributed_url: offer.url ?? null,
      placement: offer.placement ?? null
    } : null,
    readiness: {
      identity: "candidate",
      commerce: offer ? "ready" : "candidate",
      dimensions: "missing",
      geometry: "missing",
      rights: "missing",
      render: "missing",
      specification: "candidate"
    }
  };
}

const rawRuns = [];
const deduped = new Map();
const stats = [];

for (const query of cfg.queries) {
  let cursor;
  let count = 0;

  for (let page=1; page <= (cfg.pages_per_query ?? 1); page++) {
    console.log(`Shopify: ${query.key}, page ${page}`);
    const result = await callMcp("search_catalog", {
      query: query.query,
      filters: {ships_to: {country: cfg.country}, available: true},
      context: {address_country: cfg.country, currency: cfg.currency, intent: cfg.intent},
      pagination: {limit: Math.min(cfg.page_size ?? 50, 50), ...(cursor ? {cursor} : {})}
    });

    const products = result?.products ?? [];
    count += products.length;
    rawRuns.push({query_key: query.key, query: query.query, page, result});

    for (const p of products) {
      const c = candidate(p, query);
      if (!deduped.has(c.candidate_id)) deduped.set(c.candidate_id, c);
    }

    cursor = result?.pagination?.next_cursor ?? result?.next_cursor ?? result?.cursor?.next ?? undefined;
    if (!cursor || products.length === 0) break;
  }
  stats.push({query_key: query.key, returned: count});
}

const candidates = [...deduped.values()];
await fs.mkdir(path.join(ROOT, "data/shopify/raw"), {recursive: true});
await fs.mkdir(path.join(ROOT, "data/shopify/candidates"), {recursive: true});
await fs.mkdir(path.join(ROOT, "data/shopify/snapshots"), {recursive: true});

await fs.writeFile(path.join(ROOT, `data/shopify/raw/${runStamp}.json`), JSON.stringify(rawRuns, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/candidates/latest.json"), JSON.stringify(candidates, null, 2));
await fs.writeFile(path.join(ROOT, `data/shopify/snapshots/${runStamp}.json`), JSON.stringify(candidates, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/latest-run.json"), JSON.stringify({fetched_at: now, candidate_count: candidates.length, query_stats: stats}, null, 2));

console.log(`Done: ${candidates.length} unique Twin Candidates`);
