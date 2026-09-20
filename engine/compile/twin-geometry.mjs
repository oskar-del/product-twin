/**
 * Twin-backed geometry resolver.
 *
 * For feeds that ship no 3D proxy, the twin record is the only source of size —
 * and, since Avatar's tier stamp lives there too, the only honest source of how
 * much of that size is real. One resolver so every catalog answers the same way.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveDimensionTier, isNativeMesh } from "./catalog-row.mjs";

/**
 * @param {object} opts
 * @param {string} opts.avatarRepo   path to repo-avatar-factory
 * @param {string} opts.prefix       twin id prefix, e.g. "PT_KUNGSANGEN"
 * @param {string} [opts.localRoot]  fallback checkout for the GLB
 */
export function twinResolver({ avatarRepo, prefix, localRoot }) {
  const cache = new Map();

  return function resolve(row) {
    if (cache.has(row.id)) return cache.get(row.id);

    const twinFile = path.join(avatarRepo, "data/twins", `${prefix}_${row.id}.json`);
    let out = null;

    if (fs.existsSync(twinFile)) {
      const twin = JSON.parse(fs.readFileSync(twinFile, "utf8"));
      const d = twin.physical?.dimensions_mm;
      const tier = resolveDimensionTier(twin, { hasSize: Boolean(d) });

      if (d) {
        const assetPath = twin.geometry?.asset_path ?? null;
        const glbHere = assetPath && [avatarRepo, localRoot].filter(Boolean)
          .map(r => path.join(r, assetPath)).find(f => fs.existsSync(f));

        out = {
          // No proxy for these feeds: the element becomes a labelled box at the
          // twin's stated size, which is what the evidence actually supports.
          assetPath: glbHere ? assetPath : null,
          bounds: { size: [d.width / 1000, d.height / 1000, d.depth / 1000] },
          dimension_source: twin.physical?.dimensions_source ?? "TWIN_RECORD",
          dimension_tier: tier,
          native_mesh: isNativeMesh(twin, assetPath ?? "")
        };
      }
    }

    cache.set(row.id, out);
    return out;
  };
}
