// Stamps dimensions_mm + dimensions_source on every twin. Zero-LLM, deterministic.
// Cascade (first hit wins): GLB bounds > Shopify options > description regex > title regex.
//
// Honesty rules baked in:
//  * We record ONLY axes the source actually states. A 2-number "80x200" is a
//    footprint (W x D); we do NOT invent the height to make a row look placeable.
//  * `dimensions_axes` says which axes are real ("WDH" | "WD" | "D" | "H").
//  * `placeable` (W+D+H all known) is therefore always a floor, never inflated.
//  * Unitless 2/3-number patterns are read as cm: in these Swedish feeds "80x200"
//    on a bed or "50x60" on a pillowcase is cm by market convention (mm would be
//    absurd at these magnitudes). The source string records the assumption.
// Usage: node scripts/extract-dimensions.mjs [--write] [--catalog kungsangen]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const ci = process.argv.indexOf('--catalog');
const ONLY = ci !== -1 ? process.argv[ci + 1] : null;

const CATALOGS = {
  newport: 'data/newport/newport-catalog.jsonl',
  kungsangen: 'data/kungsangen/kungsangen-catalog.jsonl',
  mjuk: 'data/mjuk/mjuk-catalog.jsonl',
  lampemesteren: 'data/lampemesteren/lampemesteren-catalog.jsonl',
  lampan: 'data/lampan/lampan-catalog.jsonl',
  golvpoolen: 'data/golvpoolen/golvpoolen-catalog.jsonl',
  gripsholm: 'data/gripsholm/gripsholm-catalog.jsonl',
  'vidaxl-outdoor': 'data/vidaxl-outdoor/vidaxl-outdoor-catalog.jsonl',
};

const num = (s) => parseFloat(String(s).replace(',', '.'));
const toMm = (v, unit) => Math.round(unit === 'mm' ? v : v * 10);

// --- regex rules, ordered: most explicit first -------------------------------
function parseDims(text) {
  if (!text) return null;
  const t = String(text);

  // 1. Fully labelled: "B 150 x D 90 x H 74 cm" / "bredd 150 djup 90 höjd 74"
  const lab = {};
  const labRe = /\b(bredd|b|djup|d|höjd|h|längd|l)\s*[:.]?\s*(\d+(?:[,.]\d+)?)\s*(cm|mm)?/gi;
  let m;
  while ((m = labRe.exec(t)) !== null) {
    const key = m[1].toLowerCase()[0];
    const v = toMm(num(m[2]), (m[3] || 'cm').toLowerCase());
    if (key === 'b') lab.w ??= v;
    else if (key === 'd') lab.d ??= v;
    else if (key === 'h') lab.h ??= v;
    else if (key === 'l') lab.d ??= v;
  }
  if (lab.w && lab.d && lab.h) return { w: lab.w, d: lab.d, h: lab.h, axes: 'WDH', rule: 'labelled_wdh' };

  // 2. Triple "70x70x30 cm"
  const tri = t.match(/(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(cm|mm)?/i);
  if (tri) {
    const u = (tri[4] || 'cm').toLowerCase();
    return { w: toMm(num(tri[1]), u), d: toMm(num(tri[2]), u), h: toMm(num(tri[3]), u),
             axes: 'WDH', rule: tri[4] ? 'triple_wdh' : 'triple_wdh_cm_assumed' };
  }

  // 3. Double "249 x 338 cm" / "80x200" -> footprint only, height NOT invented
  const dbl = t.match(/(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(cm|mm)?/i);
  if (dbl) {
    const u = (dbl[3] || 'cm').toLowerCase();
    return { w: toMm(num(dbl[1]), u), d: toMm(num(dbl[2]), u), h: null,
             axes: 'WD', rule: dbl[3] ? 'double_wd' : 'double_wd_cm_assumed' };
  }

  // 4. Diameter "Ø12" / "Ø 40 cm" / "Ø550" -> round footprint (w = d = diameter)
  //    A BARE diameter switches unit by magnitude, and only here: measured across
  //    the two lighting feeds, bare Ø<100 is cm (4,575 rows, "Ø12" = 12 cm) while
  //    bare Ø>=100 is mm (314 rows, "Ø320" = 320 mm). Reading Ø550 as cm produced
  //    a 5.5-METRE pendant in the first hero build. This heuristic is NOT applied
  //    to the W x D patterns above, where "249 x 338" (a rug) is genuinely cm.
  const dia = t.match(/Ø\s*(\d+(?:[,.]\d+)?)\s*(cm|mm)?/i);
  if (dia) {
    const raw = num(dia[1]);
    const unit = dia[2] ? dia[2].toLowerCase() : (raw >= 100 ? 'mm' : 'cm');
    const v = toMm(raw, unit);
    return { w: v, d: v, h: null, axes: 'WD',
             rule: dia[2] ? 'diameter' : `diameter_bare_${unit}_by_magnitude` };
  }

  // 5. Single measure "20cm" / "763 mm" -> one axis only; ambiguous which, so we
  //    store it as height ONLY for lighting-style rows (handled by caller) and
  //    otherwise report it as unresolved rather than guessing an axis.
  const one = t.match(/(\d+(?:[,.]\d+)?)\s*(cm|mm)\b/i);
  if (one) return { single: toMm(num(one[1]), one[2].toLowerCase()), axes: 'ONE', rule: 'single_measure' };

  return null;
}

// --- load index --------------------------------------------------------------
const idx = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const byCatalog = new Map();
for (const r of idx) {
  if (!byCatalog.has(r.src)) byCatalog.set(r.src, []);
  byCatalog.get(r.src).push(r);
}

const report = {};
for (const [cat, file] of Object.entries(CATALOGS)) {
  if (ONLY && cat !== ONLY) continue;
  const rows = byCatalog.get(cat) || [];
  if (!rows.length) continue;

  // join raw feed by article id
  const feed = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    if (line.trim()) { const r = JSON.parse(line); feed.set(String(r.id).replace(/[^A-Za-z0-9_.-]/g, '-'), r); }
  }

  const st = { twins: rows.length, before_placeable: 0, after_placeable: 0, footprint_only: 0,
               single_only: 0, no_dims_in_text: 0, no_feed_row: 0, by_rule: {}, by_source: {} };

  for (const r of rows) {
    if (r.w && r.d && r.h) { st.before_placeable++; st.after_placeable++; continue; }
    const raw = feed.get(String(r.art).replace(/[^A-Za-z0-9_.-]/g, '-'));
    if (!raw) { st.no_feed_row++; continue; }

    // cascade: description first (richer), then title
    let got = parseDims(raw.desc), source = 'description_regex';
    if (!got || got.axes === 'ONE') {
      const fromTitle = parseDims(raw.title);
      if (fromTitle && (!got || fromTitle.axes === 'WDH' || (got.axes === 'ONE' && fromTitle.axes === 'WD'))) {
        got = fromTitle; source = 'title_regex';
      }
    }
    if (!got) { st.no_dims_in_text++; continue; }

    // A bare "AxB cm" on a LUMINAIRE is ambiguous: it is usually diameter x DROP
    // (e.g. "Pianopoli hanglampa 78x334 cm" = O78cm, 3.34m cable), not a W x D
    // footprint. Asserting a footprint here produced a "5-metre-wide pendant" in
    // the hero build. We record the numbers but refuse to call them a footprint.
    if (/^ELECTRICAL\.LUMINAIRES/.test(r.cat || '') && /^double_wd/.test(got.rule)) {
      got = { ...got, axes: 'AMBIGUOUS', rule: got.rule + '_luminaire_ambiguous' };
    }
    st.by_rule[got.rule] = (st.by_rule[got.rule] || 0) + 1;
    st.by_source[source] = (st.by_source[source] || 0) + 1;
    if (got.axes === 'WDH') st.after_placeable++;
    else if (got.axes === 'WD') st.footprint_only++;
    else if (got.axes === 'AMBIGUOUS') st.ambiguous = (st.ambiguous || 0) + 1;
    else st.single_only++;

    if (WRITE) {
      const p = path.join(ROOT, 'data/twins', `${r.id}.json`);
      const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
      twin.physical = twin.physical || {};
      const dims = {};
      if (got.axes === 'WDH') { dims.width = got.w; dims.depth = got.d; dims.height = got.h; }
      else if (got.axes === 'WD') { dims.width = got.w; dims.depth = got.d; dims.height = null; }
      else { dims.width = null; dims.depth = null; dims.height = null; }
      if (got.axes === 'AMBIGUOUS') {
        twin.physical.dimensions_mm = { width: null, depth: null, height: null };
        twin.physical.dimensions_ambiguous_mm = [got.w, got.d];
      } else if (got.axes !== 'ONE') twin.physical.dimensions_mm = dims;
      twin.physical.dimensions_source = `${source}:${got.rule}`;
      twin.physical.dimensions_axes = got.axes;
      if (got.axes === 'ONE') twin.physical.dimensions_single_mm = got.single;
      fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
    }
  }
  report[cat] = st;
}

console.log(JSON.stringify(report, null, 2));
