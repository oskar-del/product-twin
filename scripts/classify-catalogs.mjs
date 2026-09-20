// Category + attach-role mapping for the 6 CATALOG_ONLY catalogs. Zero-LLM.
//
// Two evidence tiers, recorded per twin (never blended):
//   REPORTED_TAXONOMY - the merchant's OWN category field (mjuk, lampemesteren,
//     lampan, golvpoolen, gripsholm all ship one). Stronger evidence.
//   DERIVED_TITLE - keyword inference from the title. Needed for kungsangen,
//     whose category field is empty on all 23,822 rows, and as fallback elsewhere.
//
// Usage: node scripts/classify-catalogs.mjs [--write] [--catalog mjuk]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const ci = process.argv.indexOf('--catalog');
const ONLY = ci !== -1 ? process.argv[ci + 1] : null;

const CATALOGS = {
  kungsangen: 'data/kungsangen/kungsangen-catalog.jsonl',
  mjuk: 'data/mjuk/mjuk-catalog.jsonl',
  lampemesteren: 'data/lampemesteren/lampemesteren-catalog.jsonl',
  lampan: 'data/lampan/lampan-catalog.jsonl',
  golvpoolen: 'data/golvpoolen/golvpoolen-catalog.jsonl',
  gripsholm: 'data/gripsholm/gripsholm-catalog.jsonl',
};

// [category_id, role, regex] - ordered, first match wins, specific before generic.
const RULES = [
  // --- lighting ---
  ['ELECTRICAL.LUMINAIRES.PENDANT',  'base', /takpendel|pendel|taklamp|hänglamp/i],
  ['ELECTRICAL.LUMINAIRES.CEILING',  'base', /plafond/i],
  ['ELECTRICAL.LUMINAIRES.SPOT',     'base', /spotlight|spotlights|\bspot\b|downlight|skenor/i],
  ['ELECTRICAL.LUMINAIRES.TABLE',    'attach', /bordslamp|bordsbelysning/i],
  ['ELECTRICAL.LUMINAIRES.FLOOR',    'base', /golvlamp/i],
  ['ELECTRICAL.LUMINAIRES.WALL',     'attach', /vägglamp|väggbelysning|vägglykta|applik/i],
  ['ELECTRICAL.LUMINAIRES.BATHROOM', 'base', /badrumslamp|badrumsbelysning/i],
  ['ELECTRICAL.LUMINAIRES.OUTDOOR',  'base', /utebelysning|fasadbelysning|utomhusbelysning|markspot|pollare|trädgårdsbelysning/i],
  ['ELECTRICAL.BULBS',               'free', /ljuskäll|glödlamp|lyskäll|\bled\b.*lampa|\bbulb/i],
  ['ELECTRICAL.LUMINAIRES.ACCESSORY','free', /lampskärm|sladdställ|upphäng|tillbehör.*lamp|lamp.*tillbehör|dimmer|transformator/i],
  ['ELECTRICAL.LUMINAIRES.DECORATIVE','attach', /ljusslinga|dekorationsbelysning|julbelysning/i],

  // --- bedroom (kungsangen) ---
  ['FFE.BEDROOM.HEADBOARD', 'attach', /sänggavel|gavel\b/i],
  ['FFE.BEDROOM.BED_FRAME', 'base',   /\bsäng\b|sängpaket|kontinentalsäng|ramsäng|ställbar säng|\bsängar\b/i],
  ['OTHER.PROTECTOR',       'free',   /madrasskydd|kuddskydd|överdrag|skydd\b/i],
  ['FFE.BEDROOM.MATTRESS',  'attach', /bäddmadrass|madrass/i],
  ['FFE.BEDROOM.BED_LEGS',  'free',   /sängben|stödben/i],
  ['FFE.TEXTILES.BEDDING',  'attach', /örngott|påslakan|underlakan|täcke|duntäcke|dubbeltäcke|fibertäcke|sängkläder|bedding|blankets/i],
  ['FFE.TEXTILES.PILLOW',   'attach', /\bkudde\b|kuddar|hotellkudde|fiberkudde|dunkudde/i],
  ['OTHER.SAMPLE',          'free',   /tygprov|prov\b/i],

  // --- bathroom / surfaces FIRST: these leaves contain words that the generic
  // furniture/textile rules below would otherwise steal. Two real mis-files this
  // ordering fixes: 15,170 bathroom vanities ('...-och-kommod') were landing in
  // FFE.STORAGE.DRESSER, and 2,771 heated towel rails ('handdukstork') in
  // FFE.TEXTILES.TOWEL. Verified by counting before/after. ---
  ['FFE.BATHROOM.VANITY',       'base', /tvattstall|tvättställ|kommod|vanity/i],
  ['FFE.BATHROOM.SHOWER',       'base', /dusch/i],
  ['FFE.BATHROOM.TUB',          'base', /badkar|spabad|bathtub/i],
  ['FFE.BATHROOM.TAP',          'attach', /blandare|kran\b|tapware/i],
  ['FFE.BATHROOM.TOWEL_WARMER', 'base', /handdukstork/i],
  ['FFE.BATHROOM.WC',           'base', /\bwc\b|toalett/i],
  ['FFE.BATHROOM.ACCESSORY',    'attach', /badrumstillbehor|badrumstillbehör|hallare|hållare|krok\b/i],
  ['FFE.SURFACE.WALLPAPER',     'attach', /tapet/i],
  ['FFE.SURFACE.FLOORING',      'free',   /\bgolv\b|klinker|kakel|laminat|parkett|vinylgolv/i],
  ['FFE.BATHROOM',              'base',   /badrum/i],

  // --- textiles / decor ---
  ['FFE.TEXTILES.RUG',      'attach', /\bmatta\b|mattor|bath mats|rugs/i],
  ['FFE.TEXTILES.CUSHION',  'attach', /sittdyna|prydnadskudde|chair & sofa cushions|\bdyna\b|dynor/i],
  ['FFE.TEXTILES.THROW',    'attach', /\bpläd\b|filt\b|throw/i],
  ['FFE.TEXTILES.TOWEL',    'attach', /(?!.*handdukstork)handduk|towels|washcloth/i],
  ['FFE.TEXTILES.TABLE_LINEN','attach',/tablecloth|table linens|duk\b|löpare/i],
  ['FFE.TEXTILES.CURTAIN',  'attach', /gardin|curtain/i],
  ['FFE.DECOR.MIRROR',      'attach', /spegel|mirror/i],
  ['FFE.DECOR.VASE',        'attach', /\bvas\b|vaser/i],
  ['FFE.DECOR.CANDLE',      'attach', /ljusstake|lykta|candle/i],

  // --- seating ---
  ['FFE.SEATING.SOFA',      'base', /\bsoffa\b|soffor|sitssoffa|\d-sits|hörnsoffa|bäddsoffa/i],
  ['FFE.SEATING.ARMCHAIR',  'base', /fåtölj|armchair|loungestol/i],
  ['FFE.SEATING.DINING_CHAIR','base', /matstol|karmstol|köksstol/i],
  ['FFE.SEATING.BAR_STOOL', 'base', /barstol|barpall/i],
  ['FFE.SEATING.BENCH',     'base', /\bbänk(ar)?\b|sittbänk/i],
  ['FFE.SEATING.STOOL',     'base', /\bpall(ar)?\b|sittpuff|puff(ar)?\b/i],
  ['FFE.SEATING.CHAIR',     'base', /\bstol\b|stolar/i],

  // --- tables ---
  ['FFE.TABLE.DINING',      'base', /matbord|köksbord/i],
  ['FFE.TABLE.COFFEE',      'base', /soffbord/i],
  ['FFE.TABLE.SIDE',        'base', /sidobord|lampbord|avlastningsbord|sängbord|nattduksbord/i],
  ['FFE.TABLE.DESK',        'base', /skrivbord/i],
  ['FFE.TABLE',             'base', /\bbord\b/i],

  // --- storage ---
  ['FFE.STORAGE.BOOKCASE',  'base', /bokhyll/i],
  ['FFE.STORAGE.SHELVING',  'base', /\bhylla\b|hyllor|vägghylla/i],
  ['FFE.STORAGE.DRESSER',   'base', /byrå|kommod/i],
  ['FFE.STORAGE.WARDROBE',  'base', /garderob|klädskåp/i],
  ['FFE.STORAGE.TV_BENCH',  'base', /tv-bänk|mediabänk/i],
  ['FFE.STORAGE',           'base', /\bskåp\b|förvaring|vitrin/i],

];

function classify(text) {
  if (!text) return null;
  for (const [cat, role, rx] of RULES) if (rx.test(text)) return { cat, role };
  return null;
}

const idx = fs.readFileSync(path.join(ROOT, '.runtime/twin-index.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);
const byCatalog = new Map();
for (const r of idx) {
  if (!byCatalog.has(r.src)) byCatalog.set(r.src, []);
  byCatalog.get(r.src).push(r);
}

const report = {};
for (const [cat, file] of Object.entries(CATALOGS)) {
  if (ONLY && cat !== ONLY) continue;
  const rows = byCatalog.get(cat) || [];
  const feed = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    if (line.trim()) { const r = JSON.parse(line); feed.set(String(r.id).replace(/[^A-Za-z0-9_.-]/g, '-'), r); }
  }

  const st = { twins: rows.length, from_taxonomy: 0, from_title: 0, unmatched: 0,
               already: 0, by_cat: {}, by_role: {} };

  for (const r of rows) {
    if (r.cat && r.cat !== 'CATALOG_ONLY') { st.already++; continue; }
    const raw = feed.get(String(r.art).replace(/[^A-Za-z0-9_.-]/g, '-'));
    if (!raw) { st.unmatched++; continue; }

    const taxonomy = (raw.category || '').replace(/&gt;/g, '>');
    // Match the LEAF first. Matching the whole path let a parent segment win over
    // the actual product type ("Taklampor > Spotlights" was classified PENDANT by
    // the parent "Taklampor" instead of SPOT by the leaf).
    const leaf = taxonomy.split('>').pop().trim();
    let hit = classify(leaf) || classify(taxonomy), evidence = 'REPORTED_TAXONOMY';
    if (!hit) { hit = classify(raw.title || ''); evidence = 'DERIVED_TITLE'; }
    if (!hit) { st.unmatched++; continue; }

    if (evidence === 'REPORTED_TAXONOMY') st.from_taxonomy++; else st.from_title++;
    st.by_cat[hit.cat] = (st.by_cat[hit.cat] || 0) + 1;
    st.by_role[hit.role] = (st.by_role[hit.role] || 0) + 1;

    if (WRITE) {
      const p = path.join(ROOT, 'data/twins', `${r.id}.json`);
      const twin = JSON.parse(fs.readFileSync(p, 'utf8'));
      twin.category_id = hit.cat;
      twin.attach = twin.attach || {};
      twin.attach.role = hit.role;
      twin.classification = {
        method: evidence === 'REPORTED_TAXONOMY' ? 'MERCHANT_TAXONOMY_KEYWORD' : 'DETERMINISTIC_TITLE_KEYWORD',
        source: 'scripts/classify-catalogs.mjs',
        evidence_class: evidence === 'REPORTED_TAXONOMY' ? 'REPORTED' : 'DERIVED',
        matched_text: evidence === 'REPORTED_TAXONOMY' ? taxonomy : (raw.title || ''),
        limitation: evidence === 'REPORTED_TAXONOMY'
          ? 'Leaf mapped from the merchant\'s own category string, not an industry taxonomy.'
          : 'Category inferred from merchant title text; feed ships no category field.',
      };
      fs.writeFileSync(p, JSON.stringify(twin, null, 2) + '\n');
    }
  }
  report[cat] = st;
}
console.log(JSON.stringify(report, null, 2));
