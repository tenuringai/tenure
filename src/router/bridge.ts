import * as path from 'path';
import { normalizeName } from './taxonomy';

/**
 * OpenClaw ecosystem bridge — resolves marketing/folder names to taxonomy tool tokens.
 *
 * Why it exists: OpenClaw skills have folder names like "wacli", "weather", "1password"
 * that are marketing identities, not execution identities. The taxonomy knows "exec",
 * "web_fetch", "web_search" — the actual tools. Without this bridge, classify("wacli")
 * hits SAFE_DEFAULT and the skill gets scored as if every call is a dangerous write.
 *
 * The bridge is versioned independently from the taxonomy. taxonomy/skills.json changes
 * when execution semantics change. taxonomy/openclaw-bridge.json changes when OpenClaw
 * adds or renames skills. Different cadence, different contributors, different review.
 */

interface BridgeData {
  version: string;
  description: string;
  skills: Record<string, { tools: string[] }>;
}

/**
 * Execution type risk ordering for picking the most conservative classification
 * when a bridge entry maps to multiple taxonomy tools.
 */
const TYPE_RISK: Record<string, number> = {
  idempotent_read: 0,
  stateful_session: 1,
  long_running_process: 2,
  human_interactive: 3,
  side_effect_mutation: 4,
  critical_transaction: 5,
};

let _bridgeMap: Map<string, string[]> | null = null;
let _bridgeVersion = '0.0.0';

function loadBridge(): Map<string, string[]> {
  if (_bridgeMap) return _bridgeMap;

  const bridgePath = (() => {
    const fromDist = path.join(__dirname, '..', '..', '..', 'taxonomy', 'openclaw-bridge.json');
    const fromSrc = path.join(__dirname, '..', '..', 'taxonomy', 'openclaw-bridge.json');
    try {
      require.resolve(fromDist);
      return fromDist;
    } catch {
      return fromSrc;
    }
  })();

  let data: BridgeData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    data = require(bridgePath) as BridgeData;
  } catch {
    _bridgeMap = new Map();
    return _bridgeMap;
  }

  _bridgeVersion = data.version;
  const map = new Map<string, string[]>();

  for (const [skillName, entry] of Object.entries(data.skills)) {
    map.set(normalizeName(skillName), entry.tools);
  }

  _bridgeMap = map;
  return _bridgeMap;
}

/**
 * Resolve a skill/marketing name to its underlying taxonomy tool tokens.
 * Returns null if the name is not in the bridge.
 */
export function resolveBridge(skillName: string): string[] | null {
  const map = loadBridge();
  return map.get(normalizeName(skillName)) ?? null;
}

/** Return the bridge file version string. */
export function bridgeVersion(): string {
  loadBridge();
  return _bridgeVersion;
}

/** Return the number of skill entries in the bridge. */
export function bridgeSize(): number {
  return loadBridge().size;
}

/**
 * Compute the risk level of an execution type.
 * Higher number = more conservative classification.
 */
export function typeRisk(type: string): number {
  return TYPE_RISK[type] ?? 4;
}

/** Reset the bridge cache (for testing). */
export function resetBridge(): void {
  _bridgeMap = null;
  _bridgeVersion = '0.0.0';
}
