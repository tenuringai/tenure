import * as path from 'path';
import { normalizeName } from '../router';

/**
 * Knowledge base — loads and indexes skill-durability-mapping.json.
 *
 * Why it exists: the 50-skill research data in output/skill-durability-mapping.json
 * contains rich per-skill information that the SER router and taxonomy alone cannot
 * provide: classification confidence, edge cases, conditional classification trees,
 * and whether runtime inference is required.
 *
 * For known skills, the scorer uses this data to produce a more accurate durability
 * score. For unknown skills, the scorer falls back to taxonomy + SAFE_DEFAULT.
 */

/** Shape of a single entry in skill-durability-mapping.json. */
export interface SkillMappingEntry {
  skill_name: string;
  skill_rank: number;
  source: string;
  openclaw_tool_name: string;
  primary_execution_type: string;
  primary_classification_confidence: number;
  edge_cases: Array<{
    condition: string;
    actual_execution_type: string;
    detection_signal: string;
    why_primary_is_wrong: string;
    temporal_primitive_override: string;
    thinking_cost_override: string;
  }>;
  conditional_classification_tree: Record<string, string>;
  static_classification_sufficient: boolean;
  runtime_inference_required: boolean;
  runtime_inference_signals: string[];
  execution_block: Record<string, unknown>;
}

let _index: Map<string, SkillMappingEntry> | null = null;

/**
 * Load the knowledge base from disk and build the lookup index.
 * Indexes by normalized skill_name and normalized openclaw_tool_name.
 */
function loadIndex(): Map<string, SkillMappingEntry> {
  if (_index) return _index;

  const mappingPath = (() => {
    const fromDist = path.join(__dirname, '..', '..', '..', 'output', 'skill-durability-mapping.json');
    const fromSrc = path.join(__dirname, '..', '..', 'output', 'skill-durability-mapping.json');
    try {
      require.resolve(fromDist);
      return fromDist;
    } catch {
      try {
        require.resolve(fromSrc);
        return fromSrc;
      } catch {
        return fromSrc;
      }
    }
  })();

  let entries: SkillMappingEntry[];
  try {
    entries = require(mappingPath) as SkillMappingEntry[];
  } catch {
    _index = new Map();
    return _index;
  }

  const map = new Map<string, SkillMappingEntry>();

  for (const entry of entries) {
    map.set(normalizeName(entry.skill_name), entry);
    if (entry.openclaw_tool_name && entry.openclaw_tool_name !== 'N/A — internal reasoning, not a dispatched tool') {
      const toolNames = entry.openclaw_tool_name.split(/[,/]/).map(s => s.trim()).filter(Boolean);
      for (const tn of toolNames) {
        if (!tn.startsWith('varies') && !tn.startsWith('N/A')) {
          map.set(normalizeName(tn), entry);
        }
      }
    }
  }

  _index = map;
  return _index;
}

/**
 * Look up a skill or tool name in the knowledge base.
 * Returns the enrichment entry if found, null otherwise.
 */
export function lookupSkill(nameOrTool: string): SkillMappingEntry | null {
  const index = loadIndex();
  return index.get(normalizeName(nameOrTool)) ?? null;
}

/** Return the total number of skills in the knowledge base. */
export function knowledgeBaseSize(): number {
  const index = loadIndex();
  const uniqueNames = new Set<string>();
  for (const entry of index.values()) {
    uniqueNames.add(entry.skill_name);
  }
  return uniqueNames.size;
}

/** Reset the index (for testing). */
export function resetKnowledgeBase(): void {
  _index = null;
}
