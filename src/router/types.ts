/**
 * Semantic Execution Router — type definitions.
 *
 * Why it exists: every tool call that passes through Tenure is classified
 * into one of six execution types. The type determines the Temporal primitive,
 * retry policy, timeout, idempotency strategy, and human-in-the-loop requirement.
 * Without these types, every call gets the same retry policy — which is wrong
 * for both idempotent reads (under-retried) and critical transactions (over-retried).
 */

/** Six execution semantics that cover all agent tool calls. */
export type ExecutionType =
  | 'idempotent_read'
  | 'side_effect_mutation'
  | 'stateful_session'
  | 'critical_transaction'
  | 'long_running_process'
  | 'human_interactive';

/** Retry policy applied to a Temporal Activity dispatch. */
export interface RetryPolicy {
  maximumAttempts: number;
  initialIntervalMs: number;
  backoffCoefficient: number;
  maximumIntervalMs: number;
}

/** Human-in-the-loop requirement level. */
export type HitlLevel = 'required' | 'recommended' | 'optional' | 'none';

/** Thinking cost tier — used for budget routing decisions. */
export type ThinkingCost = 'low' | 'medium' | 'high' | 'variable';

/**
 * Full execution configuration for a classified tool call.
 *
 * This is the contract the router hands to the Workflow dispatcher.
 * The dispatcher uses it to configure the Activity proxy (retry policy,
 * timeout), decide whether to generate an idempotency key, and whether
 * to pause for human approval before executing.
 */
export interface ExecutionConfig {
  type: ExecutionType;
  retryPolicy: RetryPolicy;
  /** Start-to-close timeout in milliseconds. */
  timeoutMs: number;
  /** Whether to cache the Activity result for identical inputs. */
  cache: boolean;
  /** Cache TTL in milliseconds (only relevant when cache: true). */
  cacheTtlMs?: number;
  /** Whether to generate and attach an idempotency key. */
  idempotent: boolean;
  /** Field name in tool params to use as idempotency key (auto-UUID if absent). */
  idempotencyKeyField?: string;
  /** Tool name to call on rollback if downstream steps fail. */
  compensation?: string;
  hitl: HitlLevel;
  thinkingCost: ThinkingCost;
  /** Heartbeat interval in ms — only used for stateful_session type. */
  heartbeatIntervalMs?: number;
}

/**
 * Result of classify() — wraps the ExecutionConfig with provenance info
 * so callers can log how the classification was reached.
 */
export interface ClassifyResult {
  toolName: string;
  config: ExecutionConfig;
  /** How the classification was determined. */
  source: 'conditional' | 'taxonomy' | 'bridge' | 'default';
  /** Human-readable reason string for debugging/observability. */
  reason: string;
}

/** A single entry in the taxonomy JSON — one row from TAXONOMY.md. */
export interface TaxonomyEntry {
  /** Canonical normalized tool name (lowercase, hyphens). */
  name: string;
  /** Alternative names / aliases that map to this entry. */
  aliases: string[];
  category: string;
  config: ExecutionConfig;
}
