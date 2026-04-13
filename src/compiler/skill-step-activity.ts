import { activityInfo } from '@temporalio/activity';
import type { SkillStepInput, SkillStepOutput } from './activity-dispatch';

/**
 * Generic skill step Activity — executes a tool_call step by dispatching to a
 * registered handler or falling back to a logged no-op.
 *
 * Why it exists: the SKILL.md compiler generates one workflow type that handles
 * all skills, dispatching steps by tool name at runtime. This mirrors
 * temporal-ai-agent's dynamic_tool_activity pattern: one Activity handles many
 * tool types by dispatching via the tool name string, rather than generating
 * per-tool Activity classes.
 *
 * In Phase 1, this Activity logs the dispatch and returns a structured result.
 * In Phase 2, it will look up the actual tool handler from a registry (MCP tools,
 * local tools, browser tools, etc.) — the same tool registry pattern as the
 * OpenClaw adapter but generalized across all platforms.
 *
 * The tool name is in the input, not in the Activity type name — so we use a
 * single Activity type registered as "executeSkillStep". This is different from
 * temporal-ai-agent's approach (which uses dynamic Activity type names) because
 * TypeScript's Temporal SDK handles dynamic activities differently than Python's.
 */
export async function executeSkillStep(input: SkillStepInput): Promise<SkillStepOutput> {
  const startMs = Date.now();
  const info = activityInfo();

  info.logger?.info(
    `[SkillStep] stepId=${input.stepId} tool=${input.toolName} ` +
    (input.idempotencyKey ? `idempotencyKey=${input.idempotencyKey}` : ''),
  );

  // Phase 1: Log the dispatch and return a structured result.
  // Phase 2: Look up the tool handler from a cross-platform registry.
  const result = {
    dispatched: true,
    toolName: input.toolName,
    params: input.params,
    note: 'Phase 1: tool dispatch logged. Tool handler registry in Phase 2.',
  };

  const durationMs = Date.now() - startMs;

  info.logger?.info(`[SkillStep] stepId=${input.stepId} done — ${durationMs}ms`);

  return {
    stepId: input.stepId,
    toolName: input.toolName,
    result,
    durationMs,
  };
}
