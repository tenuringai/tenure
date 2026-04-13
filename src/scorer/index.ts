import * as fs from 'fs/promises';
import * as path from 'path';
import { parseFrontmatter } from '../parser/frontmatter';
import { classify, resolveBridge, bridgeVersion as getBridgeVersion, bridgeSize } from '../router';
import { lookupSkill, knowledgeBaseSize } from './knowledge-base';
import { extractToolMentionsFromBody, inferExecutionFromBody, inferSkillMetadataFromBody } from './inference';
import { evaluate } from './evaluator';
import { renderScore, renderBatchSummary } from './renderer';
import type { ScoreResult, SkillAnalysis, ToolAnalysis, BatchSummary } from './types';
import { getDurabilityStatus } from './types';

export type { ScoreResult, BatchSummary };

/**
 * Scorer entry point — orchestrates the full scoring pipeline.
 *
 * Why it exists: this is the engine. A SKILL.md goes in, a durability score
 * comes out. The pipeline is: parse frontmatter → extract tools → classify via SER →
 * enrich from knowledge base → evaluate against Six-harness → render.
 *
 * Works for any SKILL.md, not just the 50 researched skills. Unknown skills
 * get scored via taxonomy + SAFE_DEFAULT with appropriate deductions.
 */

/**
 * Score a single SKILL.md file and render the result.
 */
export async function score(skillPath: string, options?: { silent?: boolean }): Promise<ScoreResult> {
  const resolvedPath = path.resolve(skillPath);
  const rawContent = await fs.readFile(resolvedPath, 'utf-8');
  const result = scoreFromContent(rawContent);

  if (!options?.silent) {
    const kbSize = knowledgeBaseSize();
    const kbStatus = result.analysis.knownInMapping ? `KNOWN (${kbSize}-skill mapping)` : `UNKNOWN (using taxonomy + defaults)`;
    console.log(`[tenure score] Analyzing: ${skillPath}`);
    console.log(`[tenure score] Skill: ${result.skillName}`);
    console.log(`[tenure score] Tools referenced: ${result.analysis.tools.length}${result.analysis.tools.length > 0 ? ' (' + result.analysis.tools.map(t => t.toolName).join(', ') + ')' : ''}`);
    console.log(`[tenure score] Knowledge base: ${kbStatus}`);
    if (result.analysis.bridgeResolved) {
      const bridgeTools = result.analysis.tools.filter(t => t.resolvedViaBridge);
      const resolvedStr = bridgeTools.map(t => `${t.bridgeSourceSkill} → ${t.toolName}`).join(', ');
      console.log(`[tenure score] Bridge: resolved ${resolvedStr} via bridge v${result.analysis.bridgeVersion} (${bridgeSize()} skills)`);
    }
    renderScore(result);
  }

  return result;
}

/**
 * Score a SKILL.md from raw content string (no disk read).
 * Used by tests and by batch mode internally.
 */
export function scoreFromContent(rawContent: string): ScoreResult {
  const content = rawContent.replace(/^\uFEFF/, '');
  const analysis = analyzeSkill(content);
  const { categories, findings, recommendations } = evaluate(analysis);

  const totalScore = categories.reduce((sum, c) => sum + c.points, 0);

  return {
    skillName: analysis.skillName,
    totalScore,
    maxScore: 100,
    status: getDurabilityStatus(totalScore),
    categories,
    findings,
    recommendations,
    analysis,
  };
}

/**
 * Score all SKILL.md files in a directory and render the batch summary.
 */
export async function scoreBatch(directory: string, options?: { silent?: boolean }): Promise<BatchSummary> {
  const resolvedDir = path.resolve(directory);
  const skillFiles = await findSkillFiles(resolvedDir);

  if (skillFiles.length === 0) {
    console.log(`[tenure score] No SKILL.md files found in ${resolvedDir}`);
    return {
      results: [],
      totalSkills: 0,
      averageScore: 0,
      durableCount: 0,
      partiallyDurableCount: 0,
      fragileCount: 0,
      topFinding: '',
    };
  }

  if (!options?.silent) {
    console.log(`[tenure score] Scanning ${skillFiles.length} skills...`);
  }

  const results: ScoreResult[] = [];
  const errors: string[] = [];

  for (const filePath of skillFiles) {
    try {
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const result = scoreFromContent(rawContent);
      results.push(result);
    } catch (err) {
      errors.push(`${path.basename(path.dirname(filePath))}: ${(err as Error).message}`);
    }
  }

  const totalSkills = results.length;
  const averageScore = totalSkills > 0 ? Math.round(results.reduce((s, r) => s + r.totalScore, 0) / totalSkills) : 0;

  const noExecutionBlock = results.filter(r => !r.analysis.hasExecutionBlock).length;
  const topFinding = noExecutionBlock > totalSkills * 0.5
    ? `${noExecutionBlock} of ${totalSkills} skills have NO execution contract. Every tool call gets the same retry policy. A web search and a Stripe charge should not have the same retry policy.`
    : '';

  const summary: BatchSummary = {
    results,
    totalSkills,
    averageScore,
    durableCount: results.filter(r => r.status === 'DURABLE').length,
    partiallyDurableCount: results.filter(r => r.status === 'PARTIALLY DURABLE').length,
    fragileCount: results.filter(r => r.status === 'FRAGILE').length,
    topFinding,
  };

  if (!options?.silent) {
    renderBatchSummary(summary);
    if (errors.length > 0) {
      console.log(`  Errors (${errors.length}):`);
      for (const e of errors.slice(0, 5)) {
        console.log(`    - ${e}`);
      }
    }
  }

  return summary;
}

// ─── Internal: skill analysis ────────────────────────────────────────────────

/**
 * Analyze a skill from its raw SKILL.md content.
 * Extracts tools, classifies each through SER, enriches from knowledge base.
 */
function analyzeSkill(content: string): SkillAnalysis {
  let name: string;
  let description: string;
  let allowedTools: string[];
  let executionBlock: Record<string, unknown> | null = null;
  let hasExecutionBlock = false;
  let frontmatterInferred = false;

  try {
    const frontmatter = parseFrontmatter(content);
    name = frontmatter.name;
    description = frontmatter.description;
    allowedTools = frontmatter.allowedTools;
    if (frontmatter.execution) {
      executionBlock = frontmatter.execution as unknown as Record<string, unknown>;
      hasExecutionBlock = true;
    }
  } catch {
    const inferred = inferSkillMetadataFromBody(content);
    name = inferred?.name ?? 'unknown';
    description = inferred?.description ?? '';
    allowedTools = extractToolMentionsFromBody(content);
    frontmatterInferred = inferred !== null;
  }

  // Also try to find the skill in the knowledge base by name.
  const kbEntry = lookupSkill(name);
  const knownInMapping = kbEntry !== null;

  // Build tool list: from allowed-tools, or from KB if the skill is known.
  const toolNames = new Set<string>();
  for (const t of allowedTools) {
    toolNames.add(t);
  }
  // If the skill is in the KB and has an openclaw_tool_name, add that too.
  if (kbEntry && kbEntry.openclaw_tool_name && !kbEntry.openclaw_tool_name.startsWith('N/A')) {
    const kbTools = kbEntry.openclaw_tool_name.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    for (const t of kbTools) {
      if (!t.startsWith('varies') && !t.startsWith('N/A')) {
        toolNames.add(t);
      }
    }
  }

  // If the skill body explicitly mentions known tools, count those too.
  if (toolNames.size === 0) {
    for (const t of extractToolMentionsFromBody(content)) {
      toolNames.add(t);
    }
  }

  // Bridge resolution: if no tools yet, resolve skill name via ecosystem bridge.
  let bridgeResolved = false;
  let bridgeVer: string | undefined;
  const bridgeSourceMap = new Map<string, string>();

  if (toolNames.size === 0) {
    const resolved = resolveBridge(name);
    if (resolved && resolved.length > 0) {
      bridgeResolved = true;
      bridgeVer = getBridgeVersion();
      for (const t of resolved) {
        toolNames.add(t);
        bridgeSourceMap.set(t, name);
      }
    }
  }

  // Last resort: use the skill name itself as the tool name.
  if (toolNames.size === 0) {
    toolNames.add(name);
  }

  // Classify each tool.
  const tools: ToolAnalysis[] = [];
  for (const toolName of toolNames) {
    let classifyResult = classify(toolName, {});
    const toolKb = lookupSkill(toolName);
    const isBridged = bridgeSourceMap.has(toolName);
    const inferred = inferExecutionFromBody(toolName, classifyResult, description, content);

    if (inferred) {
      classifyResult = {
        ...classifyResult,
        config: inferred.config,
        reason: `${classifyResult.reason}; ${inferred.reason}`,
      };
    }

    tools.push({
      toolName,
      classifyResult,
      knownInMapping: toolKb !== null,
      classificationConfidence: toolKb?.primary_classification_confidence ?? null,
      staticSufficient: toolKb?.static_classification_sufficient ?? null,
      runtimeInferenceRequired: toolKb?.runtime_inference_required ?? null,
      edgeCaseCount: toolKb?.edge_cases?.length ?? 0,
      hasConditionalTree: toolKb ? Object.keys(toolKb.conditional_classification_tree ?? {}).length > 1 : false,
      resolvedViaBridge: isBridged,
      bridgeSourceSkill: isBridged ? bridgeSourceMap.get(toolName) : undefined,
      inferredFromBody: inferred !== null,
      inferenceReason: inferred?.reason,
    });
  }

  // If the skill is in KB and has an execution_block, use it.
  if (kbEntry?.execution_block && !hasExecutionBlock) {
    executionBlock = kbEntry.execution_block;
  }

  return {
    skillName: name,
    description,
    knownInMapping,
    tools,
    hasExecutionBlock,
    executionBlock,
    bridgeResolved,
    bridgeVersion: bridgeVer,
    frontmatterInferred,
  };
}

// ─── Internal: file discovery ────────────────────────────────────────────────

async function findSkillFiles(directory: string): Promise<string[]> {
  const found: string[] = [];

  // Check if the path is a single file.
  try {
    const stat = await fs.stat(directory);
    if (stat.isFile() && directory.endsWith('SKILL.md')) {
      return [directory];
    }
  } catch {
    // Not a file — continue as directory.
  }

  async function walk(dir: string): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const name of names) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const fullPath = path.join(dir, name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) continue;

      if (stat.isDirectory()) {
        await walk(fullPath);
      } else if (stat.isFile() && name === 'SKILL.md') {
        found.push(fullPath);
      }
    }
  }

  await walk(directory);
  return found.sort();
}
