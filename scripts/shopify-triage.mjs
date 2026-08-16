import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const inputPath = path.join(ROOT, "data/shopify/candidates/latest.json");
const candidates = JSON.parse(await fs.readFile(inputPath, "utf8"));

const FITNESS_WEIGHT = {primary: 1.0, secondary: 0.75, experimental: 0.45};
const LIVING_ROOM_CATEGORIES = new Set([
  "FFE.SEATING.SOFA",
  "FFE.SEATING.LOUNGE",
  "FFE.TABLE.COFFEE",
  "FFE.TABLE.SIDE",
  "FFE.RUGS",
  "ELECTRICAL.LUMINAIRES.PENDANT",
  "ELECTRICAL.LUMINAIRES.FLOOR",
  "ELECTRICAL.LUMINAIRES.TABLE"
]);

function mediaScore(c) {
  const media = c.product?.media ?? [];
  if (!media.length) return 0;
  const imageCount = media.filter(m => m.type === "image" || m.mediaContentType === "IMAGE").length;
  return Math.min(1, imageCount / 3 || media.length / 3);
}

function offerScore(c) {
  const o = c.best_offer;
  if (!o) return 0;
  let s = 0;
  if (o.price_minor != null) s += 0.30;
  if (o.currency) s += 0.10;
  if (o.seller) s += 0.15;
  if (o.available !== false) s += 0.15;
  if (o.checkout_url) s += 0.15;
  if (o.attributed_url) s += 0.15;
  return Math.min(1, s);
}

function identityScore(c) {
  let s = 0;
  if (c.identity?.shopify_id) s += 0.35;
  if (c.identity?.title) s += 0.30;
  if (c.identity?.url) s += 0.20;
  if (c.best_offer?.sku) s += 0.15;
  return Math.min(1, s);
}

function textQuality(c) {
  const title = c.product?.title ?? c.identity?.title ?? "";
  const desc = typeof c.product?.description === "string"
    ? c.product.description
    : JSON.stringify(c.product?.description ?? "");
  let s = 0;
  if (title.length >= 5) s += 0.45;
  if (desc.length >= 40) s += 0.25;
  if ((c.product?.categories ?? []).length) s += 0.15;
  if ((c.product?.variant_count ?? 0) > 0) s += 0.15;
  return Math.min(1, s);
}

function provisionalCategory(c) {
  const hints = c.taxonomy?.canonical_category_hints ?? [];
  const scores = new Map();
  for (const h of hints) {
    const weight = FITNESS_WEIGHT[h.source_fitness] ?? 0.5;
    scores.set(h.canonical_category_id, (scores.get(h.canonical_category_id) ?? 0) + weight);
  }
  const ranked = [...scores.entries()].sort((a,b) => b[1] - a[1]);
  if (!ranked.length) return {id: null, confidence: 0, alternatives: []};
  const total = ranked.reduce((a,x) => a + x[1], 0);
  const confidence = total ? ranked[0][1] / total : 0;
  return {
    id: ranked[0][0],
    confidence: Number(confidence.toFixed(3)),
    alternatives: ranked.slice(1,4).map(([id,score]) => ({id, score:Number((score/total).toFixed(3))}))
  };
}

function triage(c) {
  const category = provisionalCategory(c);
  const scores = {
    identity: identityScore(c),
    commerce: offerScore(c),
    media: mediaScore(c),
    text: textQuality(c)
  };

  // Quality only measures whether this is a useful candidate record.
  // It does not imply physical/specification/render readiness.
  const candidate_quality =
    scores.identity * 0.27 +
    scores.commerce * 0.38 +
    scores.media * 0.22 +
    scores.text * 0.13;

  const holds = [];
  if (scores.identity < 0.65) holds.push("identity_enrichment");
  if (scores.commerce < 0.55) holds.push("commerce_enrichment");
  if (scores.media < 0.25) holds.push("media_enrichment");
  if (!category.id || category.confidence < 0.55) holds.push("taxonomy_review");

  return {
    ...c,
    taxonomy: {
      ...(c.taxonomy ?? {}),
      canonical_category_id: category.id,
      canonical_category_confidence: category.confidence,
      canonical_category_alternatives: category.alternatives,
      classification_status: category.confidence >= 0.75 ? "provisional_high" : "provisional_review"
    },
    triage: {
      candidate_quality: Number(candidate_quality.toFixed(4)),
      scores,
      holds,
      next_gate: "identity_dimensions_geometry_rights_specification",
      render_ready: false
    }
  };
}

const triaged = candidates.map(triage).sort((a,b) => b.triage.candidate_quality - a.triage.candidate_quality);

const byCategory = new Map();
for (const c of triaged) {
  const key = c.taxonomy?.canonical_category_id ?? "UNCLASSIFIED";
  const arr = byCategory.get(key) ?? [];
  arr.push(c);
  byCategory.set(key, arr);
}

const shortlist = [];
for (const [categoryId, rows] of byCategory) {
  const limit = LIVING_ROOM_CATEGORIES.has(categoryId) ? 12 : 5;
  shortlist.push(...rows.slice(0, limit));
}
shortlist.sort((a,b) => b.triage.candidate_quality - a.triage.candidate_quality);

const livingRoom = shortlist.filter(c => LIVING_ROOM_CATEGORIES.has(c.taxonomy?.canonical_category_id));

const analytics = {
  generated_at: new Date().toISOString(),
  input_candidates: candidates.length,
  triaged_candidates: triaged.length,
  shortlist_candidates: shortlist.length,
  living_room_candidates: livingRoom.length,
  classified_categories: byCategory.size,
  by_category: Object.fromEntries([...byCategory].map(([k,v]) => [k, {
    count: v.length,
    top_quality: v[0]?.triage?.candidate_quality ?? null,
    average_quality: Number((v.reduce((a,x) => a + x.triage.candidate_quality, 0) / Math.max(1,v.length)).toFixed(4))
  }])),
  disclaimer: "Category assignment is provisional from source/query evidence. Candidate triage does not imply dimensions, geometry, rights, specification or render readiness."
};

await fs.mkdir(path.join(ROOT, "data/shopify/triage"), {recursive:true});
await fs.writeFile(path.join(ROOT, "data/shopify/triage/latest.json"), JSON.stringify(triaged, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/shortlist.json"), JSON.stringify(shortlist, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/living-room.json"), JSON.stringify(livingRoom, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/analytics.json"), JSON.stringify(analytics, null, 2));

console.log(`Triaged ${triaged.length} candidates across ${byCategory.size} provisional canonical categories`);
console.log(`Shortlist: ${shortlist.length}`);
console.log(`Living-room set: ${livingRoom.length}`);
