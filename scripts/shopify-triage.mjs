import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const inputPath = path.join(ROOT, "data/shopify/candidates/latest.json");
const candidates = JSON.parse(await fs.readFile(inputPath, "utf8"));

const ROOM_WEIGHTS = {
  sofas: 1.00,
  lounge_chairs: 0.98,
  coffee_tables: 0.94,
  side_tables: 0.90,
  pendants: 0.88,
  floor_lamps: 0.84,
  rugs: 0.90,
  dining_chairs: 0.45,
  outdoor_chairs: 0.25,
  outdoor_sofas: 0.25
};

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
  const desc = c.product?.description ?? "";
  let s = 0;
  if (title.length >= 5) s += 0.45;
  if (desc.length >= 40) s += 0.25;
  if ((c.product?.categories ?? []).length) s += 0.15;
  if ((c.product?.variant_count ?? 0) > 0) s += 0.15;
  return Math.min(1, s);
}

function priceSignal(c) {
  const p = Number(c.best_offer?.price_minor);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return 1;
}

function triage(c) {
  const queryKey = c.discovered?.query_key ?? "unknown";
  const scores = {
    identity: identityScore(c),
    commerce: offerScore(c),
    media: mediaScore(c),
    text: textQuality(c),
    price: priceSignal(c),
    room_relevance: ROOM_WEIGHTS[queryKey] ?? 0.5
  };

  // This is intentionally NOT a render-readiness score.
  // Geometry, scale and rights are separate downstream gates.
  const candidate_quality =
    scores.identity * 0.20 +
    scores.commerce * 0.30 +
    scores.media * 0.18 +
    scores.text * 0.12 +
    scores.price * 0.08 +
    scores.room_relevance * 0.12;

  const holds = [];
  if (scores.identity < 0.65) holds.push("identity_enrichment");
  if (scores.commerce < 0.55) holds.push("commerce_enrichment");
  if (scores.media < 0.25) holds.push("media_enrichment");

  return {
    ...c,
    triage: {
      candidate_quality: Number(candidate_quality.toFixed(4)),
      scores,
      holds,
      next_gate: "identity_dimensions_geometry_rights",
      render_ready: false
    }
  };
}

const triaged = candidates.map(triage).sort((a,b) => b.triage.candidate_quality - a.triage.candidate_quality);

const byQuery = new Map();
for (const c of triaged) {
  const key = c.discovered?.query_key ?? "unknown";
  const arr = byQuery.get(key) ?? [];
  arr.push(c);
  byQuery.set(key, arr);
}

const shortlist = [];
for (const [key, rows] of byQuery) {
  const max = ["sofas","lounge_chairs","coffee_tables","side_tables","pendants","floor_lamps","rugs"].includes(key) ? 8 : 3;
  shortlist.push(...rows.slice(0, max));
}
shortlist.sort((a,b) => b.triage.candidate_quality - a.triage.candidate_quality);

const livingRoom = shortlist.filter(c => [
  "sofas","lounge_chairs","coffee_tables","side_tables","pendants","floor_lamps","rugs"
].includes(c.discovered?.query_key));

const analytics = {
  generated_at: new Date().toISOString(),
  input_candidates: candidates.length,
  triaged_candidates: triaged.length,
  shortlist_candidates: shortlist.length,
  living_room_candidates: livingRoom.length,
  by_query: Object.fromEntries([...byQuery].map(([k,v]) => [k, {
    count: v.length,
    top_quality: v[0]?.triage?.candidate_quality ?? null,
    average_quality: Number((v.reduce((a,x) => a + x.triage.candidate_quality, 0) / Math.max(1,v.length)).toFixed(4))
  }])),
  disclaimer: "Triage measures catalogue/commercial completeness, not geometry, rights, physical scale, or render readiness."
};

await fs.mkdir(path.join(ROOT, "data/shopify/triage"), {recursive:true});
await fs.writeFile(path.join(ROOT, "data/shopify/triage/latest.json"), JSON.stringify(triaged, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/shortlist.json"), JSON.stringify(shortlist, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/living-room.json"), JSON.stringify(livingRoom, null, 2));
await fs.writeFile(path.join(ROOT, "data/shopify/triage/analytics.json"), JSON.stringify(analytics, null, 2));

console.log(`Triaged ${triaged.length} candidates`);
console.log(`Shortlist: ${shortlist.length}`);
console.log(`Living-room set: ${livingRoom.length}`);
