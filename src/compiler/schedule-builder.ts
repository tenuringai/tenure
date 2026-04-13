import { Client, Connection, ScheduleHandle } from '@temporalio/client';
import type { SkillPlan } from '../parser/types';
import type { SkillExecutionInput } from './workflow-builder';

const TASK_QUEUE = process.env.TENURE_TASK_QUEUE ?? 'tenure-task-queue';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

/**
 * Schedule builder — wraps a skill workflow in a Temporal Schedule for cron execution.
 *
 * Why it exists: `tenure run --cron "*/5 * * * *" ./skill/SKILL.md` compiles a skill
 * and then creates a Temporal Schedule that fires the compiled workflow on the given interval.
 *
 * Key settings:
 * - catchupWindow: '10m' — if the Worker was down, catch up missed triggers within 10 min
 * - overlap: 'SKIP' — don't stack executions if the previous run is still in progress
 * - The Schedule ID is deterministic: `tenure-cron-{skillName}-{versionPrefix}`
 *   so re-running `tenure run --cron` on the same skill is idempotent.
 */
export interface ScheduleOptions {
  /** Cron expression, e.g. "*/5 * * * *" */
  cronExpression: string;
  /** Temporal server address. Defaults to TEMPORAL_ADDRESS env or localhost:7233. */
  temporalAddress?: string;
  /** Task queue. Defaults to TENURE_TASK_QUEUE env or tenure-task-queue. */
  taskQueue?: string;
}

/** Result of creating a cron schedule. */
export interface ScheduleResult {
  scheduleId: string;
  handle: ScheduleHandle;
}

/**
 * Create a Temporal Schedule that fires the skill workflow on the given cron expression.
 */
export async function createCronSchedule(
  plan: SkillPlan,
  options: ScheduleOptions,
): Promise<ScheduleResult> {
  const address = options.temporalAddress ?? TEMPORAL_ADDRESS;
  const taskQueue = options.taskQueue ?? TASK_QUEUE;

  const connection = await Connection.connect({ address });
  const client = new Client({ connection });

  // Deterministic schedule ID: same skill + same cron = same schedule.
  // This makes `tenure run --cron` idempotent.
  const cronSlug = options.cronExpression.replace(/[^a-z0-9]/gi, '-');
  const scheduleId = `tenure-cron-${plan.name}-${plan.version.slice(0, 8)}-${cronSlug}`;

  const workflowInput: SkillExecutionInput = { plan };

  const handle = await client.schedule.create({
    scheduleId,
    spec: {
      cronExpressions: [options.cronExpression],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'skillExecutionWorkflow',
      args: [workflowInput],
      taskQueue,
      // Embed version in workflow search attributes for observability.
      searchAttributes: {
        'tenure.skillName': [plan.name],
        'tenure.skillVersion': [plan.version],
      } as Record<string, string[]>,
    },
    policies: {
      catchupWindow: '10m',
      overlap: 'Skip' as const,
    },
  });

  return { scheduleId, handle };
}
