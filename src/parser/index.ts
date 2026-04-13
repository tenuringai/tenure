import * as fs from 'fs/promises';
import { parseFrontmatter } from './frontmatter';
import { extractSteps } from './steps';
import { hashSkillContent } from './version';
import type { SkillPlan } from './types';

export type { SkillPlan, SkillStep, ExecutionBlock, ModelTier, MODEL_TIER_MAP } from './types';

/**
 * SKILL.md parser — Stage 1 of the compiler pipeline.
 *
 * Why it exists: the parser is the front door of Tenure's engine. It reads a
 * SKILL.md file, extracts the frontmatter contract, classifies each step through
 * the SER router, and produces a deterministic SkillPlan. The compiler then takes
 * that plan and generates a running Temporal Workflow.
 *
 * Guarantees:
 * - Deterministic: same SKILL.md file always produces the same SkillPlan.
 *   No network calls, timestamps, or randomness. Critical for Temporal replay.
 * - Pure: does not write files, start Workflows, or call LLMs.
 * - Versioned: the SkillPlan.version is the SHA-256 hash of the raw file content.
 *   This is the pin — Temporal Workflows embed this hash in their metadata.
 *
 * Usage:
 *   const plan = await parse('./my-skill/SKILL.md');
 *   // plan.steps[0].type === 'tool_call' | 'thinking'
 *   // plan.version === 'sha256:...'
 */
export async function parse(skillPath: string): Promise<SkillPlan> {
  const rawContent = await fs.readFile(skillPath, 'utf-8');
  return parseString(rawContent);
}

/**
 * Parse SKILL.md content from a raw string.
 * Used internally and by tests that don't need to read from disk.
 */
export function parseString(rawContent: string): SkillPlan {
  // Strip BOM if present (mirrors zeitlich's parseSkillFile).
  const content = rawContent.replace(/^\uFEFF/, '');

  // Extract frontmatter.
  const frontmatter = parseFrontmatter(content);

  // Extract and separate the markdown body from frontmatter.
  const body = extractBody(content);

  // Classify steps.
  const steps = extractSteps(body, frontmatter.allowedTools, frontmatter.execution);

  // Content hash for pinning.
  const version = hashSkillContent(content);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    steps,
    execution: frontmatter.execution,
    version,
    allowedTools: frontmatter.allowedTools,
  };
}

/**
 * Extract the markdown body — everything after the closing `---` frontmatter delimiter.
 */
function extractBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\r?\n?([\s\S]*)$/);
  if (!match) return content;
  return match[1].trim();
}
