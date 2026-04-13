import { lookupTaxonomy, normalizeName } from '../router';
import type { ClassifyResult, ExecutionConfig, ExecutionType } from '../router/types';

/**
 * Fallback metadata inferred from a malformed SKILL.md body.
 *
 * Why it exists: some upstream skills do not ship valid YAML frontmatter.
 * The scorer still needs a stable skill identity so the bridge can resolve
 * the skill name and avoid collapsing the score to SAFE_DEFAULT.
 */
export interface InferredSkillMetadata {
  name: string;
  description: string;
}

/**
 * A body-derived execution refinement for generic wrappers like shell/message.
 *
 * Why it exists: the bridge can resolve marketing names to a generic tool
 * family, but shell-style wrappers still need a second layer of semantics.
 * This refinement lets the scorer distinguish read-only wrappers from
 * mutating or interactive wrappers without editing upstream skills.
 */
export interface InferredExecution {
  config: ExecutionConfig;
  reason: string;
}

const READ_ONLY_HINTS = [
  'list',
  'read',
  'view',
  'show',
  'search',
  'find',
  'fetch',
  'get',
  'query',
  'monitor',
  'summarize',
  'extract',
  'transcribe',
  'diagnose',
  'inspect',
  'history',
  'status',
];

const MUTATION_HINTS = [
  'create',
  'add',
  'edit',
  'delete',
  'remove',
  'send',
  'reply',
  'forward',
  'post',
  'start',
  'call',
  'write',
  'update',
  'manage',
  'control',
  'configure',
  'harden',
  'group',
  'grouping',
  'volume',
  'playback',
  'move',
  'export',
  'complete',
];

const SESSION_HINTS = [
  'interactive',
  'session',
  'send keystrokes',
  'pane output',
  'remote-control',
  'remote control',
];

/**
 * Infer a skill name + description from body text when frontmatter is missing.
 */
export function inferSkillMetadataFromBody(content: string): InferredSkillMetadata | null {
  const lines = content.split(/\r?\n/).map(line => line.trim());
  const heading = lines.find(line => /^#\s+/.test(line));
  const paragraph = lines.find(
    line =>
      line.length > 0 &&
      !line.startsWith('#') &&
      !line.startsWith('---') &&
      !line.startsWith('```'),
  );

  if (!heading || !paragraph) {
    return null;
  }

  const rawName = heading.replace(/^#\s+/, '').replace(/\bskill\b/i, '').trim();
  if (!rawName) {
    return null;
  }

  return {
    name: normalizeName(rawName),
    description: paragraph,
  };
}

/**
 * Extract explicit tool mentions from prose when `allowed-tools` is absent.
 *
 * Why it exists: many upstream skills mention tools in prose like `Use the
 * message tool` but do not declare `allowed-tools`. This keeps the scoring
 * pipeline deterministic while still recovering those explicit mentions.
 */
export function extractToolMentionsFromBody(content: string): string[] {
  const tokens = new Set<string>();
  const patterns = [
    /use the `([a-zA-Z0-9_-]+)` tool/gi,
    /use `([a-zA-Z0-9_-]+)` to/gi,
    /via the `([a-zA-Z0-9_-]+)` tool/gi,
    /no provider-specific `([a-zA-Z0-9_-]+)` tool/gi,
    /calls go through the generic `([a-zA-Z0-9_-]+)` tool/gi,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      tokens.add(match[1]);
    }
  }

  const found = new Set<string>();

  for (const token of tokens) {
    if (lookupTaxonomy(token)) {
      found.add(token);
    }
  }

  return [...found];
}

/**
 * Refine a generic wrapper classification using deterministic body heuristics.
 */
export function inferExecutionFromBody(
  toolName: string,
  current: ClassifyResult,
  description: string,
  content: string,
): InferredExecution | null {
  const normalized = normalizeName(toolName);
  const corpus = `${description}\n${content}`.toLowerCase();

  if (!isGenericWrapper(normalized, current)) {
    return null;
  }

  if (hasAnyHint(corpus, SESSION_HINTS)) {
    return {
      config: makeConfig('stateful_session'),
      reason: 'body inference: interactive/session language detected',
    };
  }

  const readHits = countHints(corpus, READ_ONLY_HINTS);
  const mutationHits = countHints(corpus, MUTATION_HINTS);

  if (readHits >= 2 && mutationHits === 0) {
    return {
      config: makeConfig('idempotent_read'),
      reason: 'body inference: read-only language detected',
    };
  }

  return null;
}

/**
 * Detect wrapper tools where the generic taxonomy entry is not semantically precise enough.
 */
function isGenericWrapper(normalizedToolName: string, current: ClassifyResult): boolean {
  return (
    normalizedToolName === 'shell' ||
    normalizedToolName === 'exec' ||
    normalizedToolName === 'message' ||
    (current.source === 'default' && normalizedToolName !== 'unknown')
  );
}

/**
 * Count how many hints from a vocabulary appear in a text corpus.
 */
function countHints(corpus: string, hints: string[]): number {
  return hints.filter(hint => corpus.includes(hint)).length;
}

/**
 * Check whether any hint from a vocabulary appears in a text corpus.
 */
function hasAnyHint(corpus: string, hints: string[]): boolean {
  return hints.some(hint => corpus.includes(hint));
}

/**
 * Build a conservative scorer-side config for an inferred execution type.
 *
 * Why scorer-side: this affects durability scoring only. It does not mutate
 * the router's runtime contract for real execution.
 */
function makeConfig(type: ExecutionType): ExecutionConfig {
  if (type === 'idempotent_read') {
    return {
      type,
      retryPolicy: { maximumAttempts: 5, initialIntervalMs: 1000, backoffCoefficient: 2, maximumIntervalMs: 10000 },
      timeoutMs: 60000,
      cache: true,
      cacheTtlMs: 300000,
      idempotent: true,
      compensation: undefined,
      hitl: 'none',
      thinkingCost: 'low',
    };
  }

  return {
    type: 'stateful_session',
    retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
    timeoutMs: 1800000,
    cache: false,
    idempotent: false,
    compensation: 'close-session',
    hitl: 'none',
    thinkingCost: 'medium',
    heartbeatIntervalMs: 30000,
  };
}
