import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE = process.env.UCP_AGENT_PROFILE ||
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

const policy = JSON.parse(await fs.readFile(path.join(ROOT, "config/searches.json"), "utf8"));
const sourceMap = JSON.parse(await fs.readFile(path.join(ROOT, policy.source_mapping), "utf8"));
const now = new Date().toISOString();
const runStamp = now.replace(/[:.]/g, "-");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callMcp(toolName, catalog, attempt=1) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {"content-type": "application/json", "user-agent": "product-twin-github-ingestor/0.3"},
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
      await sleep(900 * attempt * attempt);
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

function discoveryHint(mapping, query) {
  return {
    canonical_category_id: mapping.category_id,
    source_fitness: mapping.fitness,
    query,
    fetched_at: now
  };
}

function candidate(product, mapping, query) {
  const offer = firstOffer(product);
  const identity = String(product.id ?? product.url ?? `${product.title}|${mapping.category_id}`);
  return {
    candidate_id: `SHOPIFY_${crypto.createHash("sha1").update(identity).digest("hex").slice(0,16)}`,
    source: "shopify_global_catalog",
    taxonomy: {
      canonical_category_id: null,
      canonical_category_confidence: null,
      canonical_category_hints: [discoveryHint(mapping, query)],
      source_categories: product.categories ?? []
    },
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

function mergeCandidate(existing, incoming) {
  const hints = [...(existing.taxonomy?.canonical_category_hints ?? [])];
  const keys = new Set(hints.map(h => `${h.canonical_category_id}|${h.query}`));
  for (const h of incoming.taxonomy?.canonical_category_hints ?? []) {
    const key = `${h.canonical_category_id}|${h.query}`;
    if (!keys.has(key)) {
      hints.push(h);
      keys.add(key);
    }
  }
  existing.taxonomy.canonical_category_hints = hints;
  return existing;
}

const rawRuns = [];
const deduped = new Map();
const stats = [];

const mappings = sourceMap.mappings.filter(m => policy.include_fitness.includes(m.fitness));
const queryPlan = mappings.flatMap(mapping =>
  (mapping.queries ?? []).map(query => ({mapping, query}))
);

console.log(`Discovery plan: ${queryPlan.length} taxonomy-mapped Shopify searches`);

for (const {mapping, query} of queryPlan) {
  let cursor;
  let count = 0;
  let pages = 0;
  let totalCountEstimate = null;
  const maxPages = Math.min(
    policy.crawl_pages_by_fitness?.[mapping.fitness] ?? 1,
    Math.ceil((policy.max_results_per_query ?? 1000) / (policy.page_size ?? 50))
  );

  for (let page=1; page <= maxPages; page++) {
    console.log(`Shopify: ${mapping.category_id} [${mapping.fitness}] :: ${query} :: page ${page}`);
    const result = await callMcp("search_catalog", {
      query,
      filters: {ships_to: {country: policy.country}, available: true},
      context: {address_country: policy.country, currency: policy.currency, intent: policy.intent},
      pagination: {limit: Math.min(policy.page_size ?? 50, 50), ...(cursor ? {cursor} : {})}
    });

    const products = result?.products ?? [];
    count += products.length;
    pages += 1;
    if (result?.total_count != null) totalCountEstimate = result.total_count;

    rawRuns.push({
      canonical_category_id: mapping.category_id,
      source_fitness: mapping.fitness,
      query,
      page,
      result
    });

    for (const p of products) {
      const c = candidate(p, mapping, query);
      const existing = deduped.get(c.candidate_id);
      deduped.set(c.candidate_id, existing ? mergeCandidate(existing, c) : c);
    }

    // Shopify Global Catalog returns the opaque next offset as pagination.cursor.
    cursor = result?.pagination?.cursor ?? undefined;
    const hasNext = result?.pagination?.has_next_page;
    if (!cursor || hasNext === false || products.length === 0) break;
  }

  stats.push({
    canonical_category_id: mapping.category_id,
    source_fitness: mapping.fitness,
    query,
    pages,
    returned: count,
    total_count_estimate: totalCountEstimate
  });
}

const candidates = [...deduped.values()];
await fs.mkdir(path.join(ROOT, "data/shopify/raw"), {recursive: true});
await fs.mkdir(path.join(ROOT, "data/shopify/candidates"), {recursive: true});
await fs.mkdir(path.join(ROOT, "data/shopify/snapshots"), {recursive: true});

await fs.writeFile(path.join(ROOT, `data/shopify/raw/${runStamp}.json`), JSON.stringify(rawRuns, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/candidates/latest.json"), JSON.stringify(candidates, null, 2));
await fs.writeFile(path.join(ROOT, `data/shopify/snapshots/${runStamp}.json`), JSON.stringify(candidates, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/latest-run.json"), JSON.stringify({
  fetched_at: now,
  source_id: sourceMap.source_id,
  query_count: queryPlan.length,
  candidate_count: candidates.length,
  query_stats: stats
}, null, 2));

console.log(`Done: ${candidates.length} unique Twin Candidates from ${queryPlan.length} taxonomy-mapped searches`);
