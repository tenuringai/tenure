import matter from 'gray-matter';
import type { ExecutionBlock, ModelTier } from './types';

/**
 * Frontmatter parser for SKILL.md files.
 *
 * Why it exists: SKILL.md files use YAML frontmatter to declare skill metadata
 * and optional execution contracts. This module extracts that data and normalizes
 * two supported formats into a single ExecutionBlock:
 *
 * Format 1 — structured `execution:` block (preferred):
 *   execution:
 *     type: critical_transaction
 *     retry: 1
 *     hitl: required
 *
 * Format 2 — flat `metadata: tenure.*` keys (agentskills.io compat):
 *   metadata:
 *     tenure.execution_type: critical_transaction
 *     tenure.retry: "1"
 *     tenure.hitl: required
 *
 * If both are present, `execution:` takes precedence.
 * If neither is present, execution is null and the router uses taxonomy defaults.
 */

export interface ParsedFrontmatter {
  name: string;
  description: string;
  allowedTools: string[];
  execution: ExecutionBlock | null;
}

/**
 * Parse SKILL.md raw content and extract frontmatter fields.
 *
 * Throws if name or description are missing — both are required by the
 * agentskills.io spec and by Tenure's compiler (the name becomes the
 * Workflow type, the description is embedded in metadata).
 */
export function parseFrontmatter(rawContent: string): ParsedFrontmatter {
  const { data } = matter(rawContent);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error("SKILL.md frontmatter must include a 'name' field");
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error("SKILL.md frontmatter must include a 'description' field");
  }

  const allowedTools = parseAllowedTools(data['allowed-tools'] ?? data.allowedTools);
  const execution = parseExecutionBlock(data);

  return {
    name: String(data.name).trim(),
    description: String(data.description).trim(),
    allowedTools,
    execution,
  };
}

/**
 * Parse the `allowed-tools` field.
 * Supports: array (YAML list), or space-delimited string.
 */
function parseAllowedTools(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[\s,]+/).filter(Boolean);
  return [];
}

/**
 * Extract execution contract from frontmatter data.
 * Tries `execution:` block first, then `metadata: tenure.*` flat keys.
 */
function parseExecutionBlock(data: Record<string, unknown>): ExecutionBlock | null {
  // Format 1: structured `execution:` block
  if (data.execution && typeof data.execution === 'object' && !Array.isArray(data.execution)) {
    return normalizeExecutionBlock(data.execution as Record<string, unknown>);
  }

  // Format 2: flat `metadata: tenure.*` keys
  if (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)) {
    return normalizeMetadataBlock(data.metadata as Record<string, string>);
  }

  return null;
}

/**
 * Normalize the structured `execution:` block.
 * Maps YAML field names to ExecutionBlock fields.
 */
function normalizeExecutionBlock(raw: Record<string, unknown>): ExecutionBlock {
  const block: ExecutionBlock = {};

  if (typeof raw.type === 'string') block.type = raw.type;
  if (typeof raw.retry === 'number') block.retry = raw.retry;
  if (typeof raw.hitl === 'string') block.hitl = raw.hitl;
  if (typeof raw.compensation === 'string') block.compensation = raw.compensation;
  if (typeof raw.thinking_cost === 'string') block.thinkingCost = raw.thinking_cost;
  if (typeof raw.thinkingCost === 'string') block.thinkingCost = raw.thinkingCost;
  if (typeof raw.model_tier === 'string') block.modelTier = raw.model_tier as ModelTier;
  if (typeof raw.modelTier === 'string') block.modelTier = raw.modelTier as ModelTier;
  if (typeof raw.token_budget === 'number') block.tokenBudget = raw.token_budget;
  if (typeof raw.tokenBudget === 'number') block.tokenBudget = raw.tokenBudget;

  // heartbeat_interval
  if (typeof raw.heartbeat_interval === 'number') block.heartbeatInterval = raw.heartbeat_interval;
  if (typeof raw.heartbeatInterval === 'number') block.heartbeatInterval = raw.heartbeatInterval;

  // cache TTL
  if (raw.cache && typeof raw.cache === 'object' && !Array.isArray(raw.cache)) {
    const cache = raw.cache as Record<string, unknown>;
    if (typeof cache.ttl === 'number') block.cacheTtl = cache.ttl;
  }
  if (typeof raw.cacheTtl === 'number') block.cacheTtl = raw.cacheTtl;

  // idempotency block
  if (raw.idempotency && typeof raw.idempotency === 'object' && !Array.isArray(raw.idempotency)) {
    const idempotency = raw.idempotency as Record<string, unknown>;
    block.idempotency = {};
    if (typeof idempotency.key === 'string') block.idempotency.key = idempotency.key;
  }

  return block;
}

/**
 * Normalize the flat `metadata: tenure.*` encoding.
 * Maps `tenure.execution_type`, `tenure.retry`, etc. to ExecutionBlock fields.
 */
function normalizeMetadataBlock(raw: Record<string, string>): ExecutionBlock | null {
  const hasTenureKeys = Object.keys(raw).some(k => k.startsWith('tenure.'));
  if (!hasTenureKeys) return null;

  const block: ExecutionBlock = {};

  if (raw['tenure.execution_type']) block.type = raw['tenure.execution_type'];
  if (raw['tenure.retry']) block.retry = parseInt(raw['tenure.retry'], 10);
  if (raw['tenure.hitl']) block.hitl = raw['tenure.hitl'];
  if (raw['tenure.compensation']) block.compensation = raw['tenure.compensation'];
  if (raw['tenure.thinking_cost']) block.thinkingCost = raw['tenure.thinking_cost'];
  if (raw['tenure.model_tier']) block.modelTier = raw['tenure.model_tier'] as ModelTier;
  if (raw['tenure.token_budget']) block.tokenBudget = parseInt(raw['tenure.token_budget'], 10);
  if (raw['tenure.heartbeat_interval']) block.heartbeatInterval = parseInt(raw['tenure.heartbeat_interval'], 10);
  if (raw['tenure.cache_ttl']) block.cacheTtl = parseInt(raw['tenure.cache_ttl'], 10);
  if (raw['tenure.idempotent'] && raw['tenure.idempotency_key']) {
    block.idempotency = { key: raw['tenure.idempotency_key'] };
  }

  return block;
}
