import fsp from 'node:fs/promises';
import path from 'node:path';

export function collectCategoryIds(value, ids = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectCategoryIds(item, ids));
  else if (value && typeof value === 'object') {
    if (typeof value.id === 'string') ids.add(value.id);
    Object.values(value).forEach((item) => collectCategoryIds(item, ids));
  }
  return ids;
}

export function resolveCategoryAlias(categoryId, aliasDocument, canonicalIds) {
  const aliases = aliasDocument?.aliases ?? {};
  const target = aliases[categoryId] ?? categoryId;
  if (aliases[target]) throw new Error(`taxonomy alias chains are forbidden: ${categoryId} -> ${target}`);
  if (!canonicalIds.has(target)) throw new Error(`unknown canonical taxonomy category: ${target}`);
  return target;
}

export async function loadTaxonomyResolver(root = process.cwd()) {
  const [taxonomy, aliases] = await Promise.all([
    fsp.readFile(path.join(root, 'config/taxonomy.json'), 'utf8').then(JSON.parse),
    fsp.readFile(path.join(root, 'config/taxonomy-aliases.json'), 'utf8').then(JSON.parse),
  ]);
  const canonicalIds = collectCategoryIds(taxonomy);
  for (const [source, target] of Object.entries(aliases.aliases ?? {})) {
    if (canonicalIds.has(source)) throw new Error(`taxonomy alias source is already canonical: ${source}`);
    resolveCategoryAlias(source, aliases, canonicalIds);
    if (source === target) throw new Error(`taxonomy alias cannot target itself: ${source}`);
  }
  return (categoryId) => resolveCategoryAlias(categoryId, aliases, canonicalIds);
}
