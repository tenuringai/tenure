import { Client, Connection } from '@temporalio/client';
import type { SkillPlan } from '../parser/types';
import type { SkillExecutionInput, SkillExecutionResult } from './workflow-builder';
import { createCronSchedule } from './schedule-builder';
import type { ScheduleOptions, ScheduleResult } from './schedule-builder';

export type { SkillExecutionInput, SkillExecutionResult } from './workflow-builder';
export type { ScheduleOptions, ScheduleResult } from './schedule-builder';
export { skillExecutionWorkflow } from './workflow-builder';
export { executeSkillStep } from './skill-step-activity';
export { executeThinkingStep } from './thinking-activity';

const TASK_QUEUE = process.env.TENURE_TASK_QUEUE ?? 'tenure-task-queue';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

/**
 * Compiler options — controls how the SkillPlan is executed.
 */
export interface CompileOptions {
  /** Cron expression. If set, creates a Temporal Schedule instead of a one-shot Workflow. */
  cron?: string;
  /** Override Temporal server address. */
  temporalAddress?: string;
  /** Override task queue. */
  taskQueue?: string;
}

/**
 * Result of compile() — either a Workflow execution handle or a Schedule handle.
 */
export interface CompileResult {
  type: 'workflow' | 'schedule';
  workflowId?: string;
  scheduleId?: string;
  skillName: string;
  skillVersion: string;
}

/**
 * Temporal compiler — Stage 3 of the pipeline.
 *
 * Why it exists: the compiler takes a classified SkillPlan and executes it on a
 * Temporal timeline. For a one-shot execution it starts a Workflow. For a cron
 * execution it creates a Temporal Schedule.
 *
 * The pipeline is: SKILL.md → parse() → SkillPlan → compile() → Temporal Workflow
 *
 * Usage:
 *   const plan = await parse('./my-skill/SKILL.md');
 *   const result = await compile(plan);                       // one-shot
 *   const result = await compile(plan, { cron: '*/5 * * * *' }); // cron schedule
 *
 * The SkillPlan version hash is embedded in Workflow metadata. Temporal Workflows
 * reference this version — the execution is always tied to the exact skill content
 * that was parsed.
 */
export async function compile(
  plan: SkillPlan,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const address = options.temporalAddress ?? TEMPORAL_ADDRESS;
  const taskQueue = options.taskQueue ?? TASK_QUEUE;

  if (options.cron) {
    return compileCron(plan, options.cron, address, taskQueue);
  }

  return compileWorkflow(plan, address, taskQueue);
}

/**
 * Compile to a one-shot Temporal Workflow execution.
 */
async function compileWorkflow(
  plan: SkillPlan,
  address: string,
  taskQueue: string,
): Promise<CompileResult> {
  const connection = await Connection.connect({ address });
  const client = new Client({ connection });

  // Deterministic workflow ID: same skill + same version = same ID.
  const workflowId = `tenure-skill-${plan.name}-${plan.version.slice(0, 12)}`;

  const workflowInput: SkillExecutionInput = { plan };

  const handle = await client.workflow.start('skillExecutionWorkflow', {
    taskQueue,
    workflowId,
    args: [workflowInput],
    searchAttributes: {
      'tenure.skillName': [plan.name],
      'tenure.skillVersion': [plan.version],
    } as Record<string, unknown>,
  });

  console.log(`[Compiler] Workflow started: ${workflowId}`);
  console.log(`[Compiler] Skill: ${plan.name} v${plan.version.slice(0, 8)}`);
  console.log(`[Compiler] Steps: ${plan.steps.length} (${plan.steps.filter(s => s.type === 'tool_call').length} tool_call, ${plan.steps.filter(s => s.type === 'thinking').length} thinking)`);

  return {
    type: 'workflow',
    workflowId: handle.workflowId,
    skillName: plan.name,
    skillVersion: plan.version,
  };
}

/**
 * Compile to a Temporal Schedule (cron execution).
 */
async function compileCron(
  plan: SkillPlan,
  cronExpression: string,
  address: string,
  taskQueue: string,
): Promise<CompileResult> {
  const scheduleOptions: ScheduleOptions = { cronExpression, temporalAddress: address, taskQueue };
  const { scheduleId } = await createCronSchedule(plan, scheduleOptions);

  console.log(`[Compiler] Schedule created: ${scheduleId}`);
  console.log(`[Compiler] Cron: ${cronExpression}`);
  console.log(`[Compiler] Skill: ${plan.name} v${plan.version.slice(0, 8)}`);
  console.log(`[Compiler] Policy: catchupWindow=10m, overlap=SKIP`);

  return {
    type: 'schedule',
    scheduleId,
    skillName: plan.name,
    skillVersion: plan.version,
  };
}
