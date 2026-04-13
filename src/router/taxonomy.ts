import * as path from 'path';
import type { TaxonomyEntry } from './types';

/**
 * Taxonomy loader — reads skills.json and builds a fast lookup map.
 *
 * Why it exists: the classify() function needs O(1) lookup by tool name.
 * The taxonomy JSON is loaded once at module init and stored in a Map keyed
 * by every alias and canonical name. This means "brave_search", "tavily", and
 * "web-search" all hit the same entry without any fuzzy matching at call time.
 *
 * Path resolution: __dirname is dist/src/router/ after compilation, so we
 * walk up three levels to reach the project root, then into taxonomy/.
 * The skills.json is copied to dist/taxonomy/ during build (copyfiles script).
 */

// Resolved from dist/src/router/ → project root → taxonomy/skills.json
// When running via vitest (no compilation), __dirname is src/router/, so we try
// both paths and use whichever exists.
const TAXONOMY_PATH = (() => {
  const fromDist = path.join(__dirname, '..', '..', '..', 'taxonomy', 'skills.json');
  const fromSrc = path.join(__dirname, '..', '..', 'taxonomy', 'skills.json');
  try {
    require.resolve(fromDist);
    return fromDist;
  } catch {
    return fromSrc;
  }
})();

/** Normalize a tool name for consistent lookup: lowercase, replace spaces/underscores with hyphens. */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[\s_]+/g, '-');
}

let _lookupMap: Map<string, TaxonomyEntry> | null = null;

function buildLookupMap(): Map<string, TaxonomyEntry> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const entries: TaxonomyEntry[] = require(TAXONOMY_PATH) as TaxonomyEntry[];
  const map = new Map<string, TaxonomyEntry>();

  for (const entry of entries) {
    // Index by canonical name.
    map.set(normalizeName(entry.name), entry);
    // Index by every alias.
    for (const alias of entry.aliases) {
      map.set(normalizeName(alias), entry);
    }
  }

  return map;
}

function getLookupMap(): Map<string, TaxonomyEntry> {
  if (!_lookupMap) {
    _lookupMap = buildLookupMap();
  }
  return _lookupMap;
}

/**
 * Look up a tool name in the taxonomy.
 *
 * Returns the TaxonomyEntry if found, or null if the tool is unknown.
 * The lookup is case-insensitive and normalizes underscores to hyphens.
 */
export function lookupTaxonomy(toolName: string): TaxonomyEntry | null {
  const map = getLookupMap();
  const normalized = normalizeName(toolName);
  return map.get(normalized) ?? null;
}

/** Return the total number of entries loaded from the taxonomy. */
export function taxonomySize(): number {
  return new Set(
    (require(TAXONOMY_PATH) as TaxonomyEntry[]).map(e => e.name)
  ).size;
}
