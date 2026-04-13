import type { ExecutionConfig } from '../router/types';

/**
 * Parser types — the IR (intermediate representation) that bridges
 * a SKILL.md file and the Temporal compiler.
 *
 * Why it exists: the parser reads a SKILL.md file, classifies each step
 * through the SER router, and produces a SkillPlan. The compiler then
 * takes that plan and generates a running Temporal Workflow. Keeping these
 * types separate means the parser and compiler can evolve independently.
 */

/** Model tier for thinking steps — controls which OpenAI model is used. */
export type ModelTier = 'frontier' | 'mid' | 'cheap';

/** Model tier to OpenAI model name mapping. */
export const MODEL_TIER_MAP: Record<ModelTier, string> = {
  frontier: 'gpt-4o',
  mid: 'gpt-4o-mini',
  cheap: 'gpt-3.5-turbo',
};

/**
 * A single classified step in a SkillPlan.
 *
 * Why it exists: each numbered item in a SKILL.md body becomes either a
 * tool_call step (classified by the SER router) or a thinking step
 * (classified as LLM work with a model tier and token budget).
 */
export interface SkillStep {
  /** Stable ID derived from step position: step-1, step-2, ... */
  id: string;
  /** How the step was identified. */
  type: 'tool_call' | 'thinking';
  /** The raw markdown text of this step. */
  text: string;

  // For tool_call steps:
  /** Normalized tool name from allowed-tools or taxonomy match. */
  toolName?: string;
  /** Parameters extracted from step text (best-effort). */
  params?: Record<string, unknown>;
  /** SER router output for this tool call. */
  executionConfig?: ExecutionConfig;

  // For thinking steps:
  /** The full text to use as the LLM thinking prompt. */
  prompt?: string;
  /** Model tier — defaults to 'mid' if not specified in execution block. */
  modelTier?: ModelTier;
  /** Max tokens for this thinking step — 0 means no limit. */
  tokenBudget?: number;
}

/**
 * The execution block from SKILL.md frontmatter.
 *
 * This is the author's explicit contract — overrides taxonomy defaults
 * for any field that is present. Parsed from either the `execution:` YAML
 * block or `metadata: tenure.*` key-value pairs.
 */
export interface ExecutionBlock {
  /** Execution type override. */
  type?: string;
  /** Retry count override. */
  retry?: number;
  /** Idempotency configuration. */
  idempotency?: {
    key?: string;
  };
  /** HITL requirement override. */
  hitl?: string;
  /** Compensation handler name. */
  compensation?: string;
  /** Cache TTL in seconds. */
  cacheTtl?: number;
  /** Heartbeat interval in seconds. */
  heartbeatInterval?: number;
  /** Default model tier for thinking steps. */
  modelTier?: ModelTier;
  /** Default token budget for thinking steps. */
  tokenBudget?: number;
  /** Thinking cost tier. */
  thinkingCost?: string;
}

/**
 * A fully parsed and classified skill — the output of parse() and the
 * input to compile(). Deterministic: the same SKILL.md always produces
 * the same SkillPlan.
 *
 * Why it exists: this is the IR. The parser produces it. The compiler
 * consumes it. No network calls or timestamps inside — everything here
 * is derived purely from the SKILL.md file content.
 */
export interface SkillPlan {
  /** Skill name from frontmatter. */
  name: string;
  /** Skill description from frontmatter. */
  description: string;
  /** Ordered list of classified steps. */
  steps: SkillStep[];
  /** Author's execution block from frontmatter — may be null. */
  execution: ExecutionBlock | null;
  /**
   * SHA-256 hash of the raw SKILL.md file content.
   * This is the pin: when a skill is "tenured", it is frozen at this hash.
   * Temporal Workflows reference this version for replay correctness.
   */
  version: string;
  /** Allowed tools declared in frontmatter. */
  allowedTools: string[];
}
