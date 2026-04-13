import type { ExecutionConfig, ClassifyResult } from '../router/types';

/**
 * Scorer types — the interfaces for Tenure's Skill Durability Score engine.
 *
 * Why it exists: the scorer evaluates a SKILL.md against the Six-harness
 * framework and produces a 0-100 durability score. These types define the
 * contract between the evaluator (which computes points per category),
 * the knowledge base (which enriches with research data), and the renderer
 * (which outputs the CLI display).
 */

/** Durability status labels based on score thresholds. */
export type DurabilityStatus = 'DURABLE' | 'PARTIALLY DURABLE' | 'FRAGILE';

/** The six scoring categories from Six-harness.md. */
export type ScoreCategory =
  | 'crashRecovery'
  | 'noDuplicate'
  | 'budgetCompliance'
  | 'hitlCompliance'
  | 'taxonomyCoverage'
  | 'perfBaseline';

/** Human-readable category labels for display. */
export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  crashRecovery: 'Crash Recovery',
  noDuplicate: 'No-Duplicate',
  budgetCompliance: 'Budget Compliance',
  hitlCompliance: 'HITL Compliance',
  taxonomyCoverage: 'Taxonomy Coverage',
  perfBaseline: 'Perf Baseline',
};

/** Maximum points per category from Six-harness.md. */
export const CATEGORY_MAX_POINTS: Record<ScoreCategory, number> = {
  crashRecovery: 20,
  noDuplicate: 20,
  budgetCompliance: 15,
  hitlCompliance: 15,
  taxonomyCoverage: 10,
  perfBaseline: 20,
};

/** A scored finding — something the evaluator observed, positive or negative. */
export interface Finding {
  category: ScoreCategory;
  /** Positive points awarded, or negative points deducted. */
  points: number;
  message: string;
}

/** A recommendation for improving the score. */
export interface Recommendation {
  category: ScoreCategory;
  message: string;
  /** How many points this recommendation could recover. */
  potentialPoints: number;
}

/** Score for a single category. */
export interface CategoryScore {
  category: ScoreCategory;
  label: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  findings: Finding[];
}

/**
 * Analysis of a single tool within the skill.
 * Combines SER router output with knowledge base enrichment.
 */
export interface ToolAnalysis {
  toolName: string;
  classifyResult: ClassifyResult;
  /** Whether this tool was found in the knowledge base (skill-durability-mapping.json). */
  knownInMapping: boolean;
  /** Classification confidence from the mapping (0-1), or null if unknown. */
  classificationConfidence: number | null;
  /** Whether static classification is sufficient, or runtime inference is needed. */
  staticSufficient: boolean | null;
  /** Whether runtime inference signals are documented for this tool. */
  runtimeInferenceRequired: boolean | null;
  /** Edge cases from the mapping, if any. */
  edgeCaseCount: number;
  /** Whether a conditional classification tree exists. */
  hasConditionalTree: boolean;
  /** Whether this tool name was resolved from a skill name via the ecosystem bridge. */
  resolvedViaBridge: boolean;
  /** The original skill name that resolved to this tool, if bridge-resolved. */
  bridgeSourceSkill?: string;
  /** Whether scorer-only body heuristics refined this tool's execution semantics. */
  inferredFromBody: boolean;
  /** Human-readable explanation of the body-derived inference. */
  inferenceReason?: string;
}

/**
 * Full analysis of a skill — the intermediate result before scoring.
 * Contains all data the evaluator needs to compute per-category points.
 */
export interface SkillAnalysis {
  skillName: string;
  description: string;
  /** Whether the skill was found in the knowledge base. */
  knownInMapping: boolean;
  /** Tools referenced in the skill (from allowed-tools and body scan). */
  tools: ToolAnalysis[];
  /** Whether the skill has an explicit execution block in frontmatter. */
  hasExecutionBlock: boolean;
  /** The execution block if present. */
  executionBlock: Record<string, unknown> | null;
  /** Whether any tool names were resolved via the ecosystem bridge. */
  bridgeResolved: boolean;
  /** Bridge version used for resolution (e.g. "0.1.0"). */
  bridgeVersion?: string;
  /** Whether name/description were recovered from body text instead of frontmatter. */
  frontmatterInferred: boolean;
}

/**
 * The complete score result — output of score().
 * Contains the total score, per-category breakdown, findings, and recommendations.
 */
export interface ScoreResult {
  skillName: string;
  totalScore: number;
  maxScore: 100;
  status: DurabilityStatus;
  categories: CategoryScore[];
  findings: Finding[];
  recommendations: Recommendation[];
  analysis: SkillAnalysis;
}

/** Summary for batch mode — aggregate stats across many skills. */
export interface BatchSummary {
  results: ScoreResult[];
  totalSkills: number;
  averageScore: number;
  durableCount: number;
  partiallyDurableCount: number;
  fragileCount: number;
  topFinding: string;
}

/** Compute durability status from total score. */
export function getDurabilityStatus(score: number): DurabilityStatus {
  if (score >= 80) return 'DURABLE';
  if (score >= 50) return 'PARTIALLY DURABLE';
  return 'FRAGILE';
}
