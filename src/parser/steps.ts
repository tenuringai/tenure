import { classify, lookupTaxonomy, normalizeName } from '../router';
import type { SkillStep, ExecutionBlock, ModelTier } from './types';

/**
 * Step classifier for SKILL.md markdown bodies.
 *
 * Why it exists: the body of a SKILL.md file contains numbered workflow steps.
 * Each step is either a tool_call (references a tool from allowed-tools or the
 * taxonomy) or a thinking step (reasoning, decision-making, interpretation).
 *
 * Identification heuristic (locked decision):
 *   If a step text references a tool from allowed-tools OR matches a tool name
 *   in the taxonomy → tool_call.
 *   Everything else → thinking.
 *
 * This heuristic is deterministic — same SKILL.md always produces the same
 * step classification. The router classifies each tool_call step. Thinking steps
 * receive model tier and token budget from the execution block defaults.
 */

const DEFAULT_MODEL_TIER: ModelTier = 'mid';
const DEFAULT_TOKEN_BUDGET = 0; // 0 = no limit

/**
 * Walk the markdown body and extract classified SkillSteps.
 *
 * Processes numbered list items (1. 2. 3. ...) as steps.
 * Non-numbered content (headers, paragraphs) is ignored.
 */
export function extractSteps(
  body: string,
  allowedTools: string[],
  execution: ExecutionBlock | null,
): SkillStep[] {
  const lines = body.split(/\r?\n/);
  const stepLines: string[] = [];

  for (const line of lines) {
    // Match numbered list items: "1. text", "2. text", etc.
    if (/^\d+\.\s+.+/.test(line.trim())) {
      stepLines.push(line.trim());
    }
  }

  return stepLines.map((line, idx) => classifyStep(line, idx + 1, allowedTools, execution));
}

/**
 * Classify a single step line into a SkillStep.
 */
function classifyStep(
  line: string,
  stepNumber: number,
  allowedTools: string[],
  execution: ExecutionBlock | null,
): SkillStep {
  const id = `step-${stepNumber}`;
  // Strip the leading "N. " prefix to get the step text.
  const text = line.replace(/^\d+\.\s+/, '').trim();

  // Try to identify a tool reference in this step.
  const toolName = findToolReference(text, allowedTools);

  if (toolName) {
    // tool_call step: classify through SER router.
    const classifyResult = classify(toolName, {});
    return {
      id,
      type: 'tool_call',
      text,
      toolName,
      params: {},
      executionConfig: classifyResult.config,
    };
  }

  // thinking step: assign model tier and token budget from execution block.
  const modelTier: ModelTier =
    (execution?.modelTier as ModelTier | undefined) ?? DEFAULT_MODEL_TIER;
  const tokenBudget: number = execution?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  return {
    id,
    type: 'thinking',
    text,
    prompt: text,
    modelTier,
    tokenBudget,
  };
}

/**
 * Find a tool reference in a step text.
 *
 * Search order (first match wins):
 * 1. Exact match against allowed-tools list (case-insensitive)
 * 2. Substring match against allowed-tools list (tool name appears in text)
 * 3. Exact match against taxonomy lookup (normalized name)
 * 4. Substring match against taxonomy (a taxonomy tool name appears in text)
 *
 * Returns the canonical tool name if found, null otherwise.
 */
function findToolReference(text: string, allowedTools: string[]): string | null {
  const lowerText = text.toLowerCase();

  // 1 & 2: Check allowed-tools list.
  for (const tool of allowedTools) {
    const lowerTool = tool.toLowerCase();
    // Word-boundary-aware check: the tool name appears as a recognizable token
    if (lowerText === lowerTool || containsToolName(lowerText, lowerTool)) {
      return tool;
    }
  }

  // 3 & 4: Check taxonomy.
  // Walk common separators to extract potential tool names from text.
  const tokens = extractTokens(lowerText);
  for (const token of tokens) {
    const entry = lookupTaxonomy(token);
    if (entry) {
      return entry.name;
    }
    // Also try normalizeName on the token.
    const normalized = normalizeName(token);
    const entryNorm = lookupTaxonomy(normalized);
    if (entryNorm) {
      return entryNorm.name;
    }
  }

  return null;
}

/**
 * Check if text contains a tool name as a recognizable word/phrase.
 * Avoids matching partial words (e.g. "read" should not match "thread").
 */
function containsToolName(text: string, toolName: string): boolean {
  // Use word-boundary-aware check: tool name surrounded by non-alphanumeric or start/end
  const escaped = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|[\\s\\-_"'\`()])${escaped}(?:[\\s\\-_"'\`)]|$)`, 'i');
  return pattern.test(text);
}

/**
 * Extract candidate token strings from step text for taxonomy lookup.
 * Handles backtick-quoted tool names (common in SKILL.md), snake_case, and hyphenated names.
 */
function extractTokens(text: string): string[] {
  const tokens: string[] = [];

  // Backtick-quoted tokens: `tool_name`
  const backtickMatches = text.matchAll(/`([^`]+)`/g);
  for (const m of backtickMatches) {
    tokens.push(m[1]);
  }

  // Words and hyphenated/underscored names
  const wordMatches = text.matchAll(/[\w][\w\-_]*/g);
  for (const m of wordMatches) {
    if (m[0].length > 2) {
      tokens.push(m[0]);
    }
  }

  return tokens;
}
