/**
 * Dimension-tier disagreements, per build.
 *
 * The room compilers defer to Avatar's stamp even where their own evidence
 * argues for a better tier — deferring is right, because promoting a tier on
 * local inference is exactly the overclaim the tier contract removed. But a
 * deferral that leaves no trace is indistinguishable from agreement, and the
 * disagreements are a real signal for Avatar: they mark rows whose feed states
 * dimensions the twin does not carry.
 *
 * So every build writes them down. Each entry says what the scene used, what
 * Avatar stamped, and which way the difference runs.
 *
 *   node scripts/dimension-disagreements.mjs            # write + print summary
 *   node scripts/dimension-disagreements.mjs --check    # exit 1 if the file is stale
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_RANK, resolveDimensionTier, dimensionsFromTitle } from "../engine/compile/catalog-row.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR = path.resolve(root, "../repo-avatar-factory");
const OUT = path.join(root, "data/scenes/dimension-disagreements.json");

const SCENES = [
  ["newport-living", "data/scenes/shoppable-room-newport-living/scene-v0.1.json"],
  ["vidaxl-terrace", "data/scenes/shoppable-terrace-vidaxl/scene-v0.1.json"],
  ["bedroom", "data/scenes/shoppable-bedroom/scene-v0.1.json"],
  ["glanrummet", "data/scenes/room-glanrummet-newport/scene-v0.1.json"]
];

const TWIN_PREFIX = {
  newport: "PT_NEWPORT",
  vidaxl: "PT_VIDAXL-OUTDOOR",
  kungsangen: "PT_KUNGSANGEN",
  lampemesteren: "PT_LAMPEMESTEREN"
};

function twinFor(channel, sku) {
  const prefix = TWIN_PREFIX[channel];
  if (!prefix) return null;
  const file = path.join(AVATAR, "data/twins", `${prefix}_${sku}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

export function collect() {
  const entries = [];

  for (const [buildName, rel] of SCENES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const scene = JSON.parse(fs.readFileSync(file, "utf8"));

    for (const el of scene.elements) {
      const c = el.commerce;
      if (!c) continue;

      const twin = twinFor(c.channel, c.sku);
      const stamped = twin ? resolveDimensionTier(twin) : null;
      const used = c.dimension_tier ?? "NONE";

      // What the feed itself states, independent of either side.
      const titleDims = dimensionsFromTitle(c.product_name ?? "");
      const feedStatesAllAxes = Boolean(titleDims && titleDims.axes === 3);

      if (stamped === null) {
        // No twin to disagree with; record only when the feed states more than
        // the absence of a twin would suggest.
        if (feedStatesAllAxes && used !== "SOURCE") {
          entries.push({
            build: buildName, element: el.id, channel: c.channel, sku: c.sku,
            used_tier: used, stamped_tier: null, twin: "MISSING",
            feed_states_all_axes: true,
            direction: "NO_TWIN_BUT_FEED_STATES_SIZE",
            note: "No twin exists, and the product title states all three axes."
          });
        }
        continue;
      }

      if (stamped !== used) {
        entries.push({
          build: buildName, element: el.id, channel: c.channel, sku: c.sku,
          used_tier: used, stamped_tier: stamped, twin: "PRESENT",
          feed_states_all_axes: feedStatesAllAxes,
          direction: (TIER_RANK[used] ?? 3) < (TIER_RANK[stamped] ?? 3) ? "SCENE_HIGHER" : "STAMP_HIGHER",
          note: "Scene and stamp disagree — the stamp governs the chip."
        });
      } else if (feedStatesAllAxes && stamped !== "SOURCE") {
        // Agreement, but the feed says more than the stamp does. This is the
        // signal worth sending upstream: the row is probably under-stamped.
        entries.push({
          build: buildName, element: el.id, channel: c.channel, sku: c.sku,
          used_tier: used, stamped_tier: stamped, twin: "PRESENT",
          feed_states_all_axes: true,
          direction: "FEED_STATES_MORE_THAN_STAMP",
          note: `Title states all three axes (${titleDims.size.map(v => v === null ? "?" : Math.round(v * 100)).join("x")} cm) but the twin is stamped ${stamped}.`
        });
      }
    }
  }
  return entries;
}

export function buildReport() {
  const disagreements = collect();
  const byDirection = {};
  const byChannel = {};
  for (const d of disagreements) {
    byDirection[d.direction] = (byDirection[d.direction] ?? 0) + 1;
    byChannel[d.channel] = (byChannel[d.channel] ?? 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    rule: "The room compilers defer to Avatar's stamp. These are the places where deferring cost information — each one is a candidate for re-stamping upstream, not a licence to promote the tier locally.",
    summary: { total: disagreements.length, by_direction: byDirection, by_channel: byChannel },
    disagreements
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const report = buildReport();

  if (process.argv.includes("--check")) {
    if (!fs.existsSync(OUT)) {
      console.error("data/scenes/dimension-disagreements.json is missing — run scripts/dimension-disagreements.mjs");
      process.exit(1);
    }
    const onDisk = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const a = JSON.stringify(onDisk.disagreements);
    const b = JSON.stringify(report.disagreements);
    if (a !== b) {
      console.error("dimension-disagreements.json is stale — the scenes changed since it was written");
      process.exit(1);
    }
    console.log(`dimension disagreements OK · ${report.summary.total} recorded`);
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`wrote ${path.relative(root, OUT)}`);
    console.log(`  ${report.summary.total} disagreement(s)`);
    for (const [k, v] of Object.entries(report.summary.by_direction)) console.log(`    ${String(v).padStart(3)}  ${k}`);
    for (const [k, v] of Object.entries(report.summary.by_channel)) console.log(`    ${String(v).padStart(3)}  channel ${k}`);
  }
}
