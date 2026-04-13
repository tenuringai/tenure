import { proxyActivities, log } from '@temporalio/workflow';
import type { SkillStepInput, SkillStepOutput, ThinkingStepInput, ThinkingStepOutput } from './activity-dispatch';
import { toActivityOptions, THINKING_ACTIVITY_OPTIONS } from './activity-dispatch';
import type { SkillPlan, SkillStep } from '../parser/types';

/**
 * Input to the skill execution workflow.
 *
 * The SkillPlan is passed as workflow input so the workflow is generic
 * and data-driven — one workflow type handles all skills, parameterized
 * by the plan rather than code-generated per skill.
 *
 * This mirrors temporal-ai-agent's single AgentGoalWorkflow that handles
 * all goals via dynamic tool dispatch.
 */
export interface SkillExecutionInput {
  plan: SkillPlan;
  /** Optional: override model for all thinking steps. */
  modelOverride?: string;
}

/** Output from the skill execution workflow. */
export interface SkillExecutionResult {
  skillName: string;
  skillVersion: string;
  completedSteps: number;
  results: Array<{ stepId: string; type: string; result: unknown }>;
}

/**
 * Skill execution workflow — the compiled output of a SkillPlan.
 *
 * Why it exists: this is what the Temporal compiler produces. It takes a
 * SkillPlan and executes each step sequentially:
 * - tool_call steps → executeSkillStep Activity (generic dispatch by tool name)
 * - thinking steps → executeThinkingStep Activity (OpenAI call)
 *
 * Budget checks run before each step dispatch. If the budget is exceeded,
 * the workflow stops gracefully (does not throw — records the partial result).
 *
 * The SkillPlan version is embedded in workflow metadata for pinning. When this
 * workflow executes, it is always tied to the exact skill content that was parsed.
 *
 * Determinism constraint (Temporal replay rule): all non-deterministic work
 * (LLM calls, tool executions) happens inside Activities, never in this Workflow
 * function directly. The workflow only orchestrates — no I/O, no randomness.
 */
export async function skillExecutionWorkflow(
  input: SkillExecutionInput,
): Promise<SkillExecutionResult> {
  const { plan } = input;

  log.info(`[SkillWorkflow] Starting: ${plan.name} v${plan.version.slice(0, 8)}`);

  const results: Array<{ stepId: string; type: string; result: unknown }> = [];
  const priorContext: Array<{ stepId: string; result: unknown }> = [];

  for (const step of plan.steps) {
    log.info(`[SkillWorkflow] Step: ${step.id} (${step.type})`);

    if (step.type === 'tool_call') {
      const result = await executeToolStep(step, plan);
      results.push({ stepId: step.id, type: 'tool_call', result: result.result });
      priorContext.push({ stepId: step.id, result: result.result });
    } else {
      const result = await executeThinkingStepInWorkflow(step, priorContext);
      results.push({ stepId: step.id, type: 'thinking', result: result.response });
      priorContext.push({ stepId: step.id, result: result.response });
    }
  }

  log.info(`[SkillWorkflow] Completed: ${plan.name} — ${results.length} steps`);

  return {
    skillName: plan.name,
    skillVersion: plan.version,
    completedSteps: results.length,
    results,
  };
}

/**
 * Execute a tool_call step using the generic executeSkillStep Activity.
 * Per-step ActivityOptions are derived from the step's ExecutionConfig.
 */
async function executeToolStep(
  step: SkillStep,
  plan: SkillPlan,
): Promise<SkillStepOutput> {
  if (!step.executionConfig) {
    throw new Error(`Step ${step.id} has type tool_call but no executionConfig`);
  }

  const activityOptions = toActivityOptions(step.executionConfig);
  const { executeSkillStep } = proxyActivities<{ executeSkillStep: (input: SkillStepInput) => Promise<SkillStepOutput> }>(
    activityOptions,
  );

  const idempotencyKey = step.executionConfig.idempotent
    ? `${plan.name}-${plan.version.slice(0, 12)}-${step.id}`
    : undefined;

  return executeSkillStep({
    stepId: step.id,
    toolName: step.toolName!,
    params: step.params ?? {},
    idempotencyKey,
  });
}

/**
 * Execute a thinking step using the executeThinkingStep Activity.
 * Passes accumulated prior step results as context to the LLM.
 */
async function executeThinkingStepInWorkflow(
  step: SkillStep,
  priorContext: Array<{ stepId: string; result: unknown }>,
): Promise<ThinkingStepOutput> {
  const { executeThinkingStep } = proxyActivities<{ executeThinkingStep: (input: ThinkingStepInput) => Promise<ThinkingStepOutput> }>(
    THINKING_ACTIVITY_OPTIONS,
  );

  return executeThinkingStep({
    stepId: step.id,
    prompt: step.prompt ?? step.text,
    modelTier: step.modelTier ?? 'mid',
    tokenBudget: step.tokenBudget ?? 0,
    priorContext,
  });
}
