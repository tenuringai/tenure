import { Worker, NativeConnection } from '@temporalio/worker';
import * as executeToolActivities from './activities/execute-tool';
import * as skillStepActivity from '../compiler/skill-step-activity';
import * as thinkingActivity from '../compiler/thinking-activity';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = process.env.TENURE_TASK_QUEUE ?? 'tenure-task-queue';

/**
 * Standalone Temporal Worker for Tenure.
 *
 * Registers two workflow types and their activities:
 *
 * 1. agentSessionWorkflow — original OpenClaw adapter workflow.
 *    Kept for backward compat with existing sessions and the demo proof.
 *
 * 2. skillExecutionWorkflow — the SKILL.md compiler's output.
 *    Generic, data-driven workflow that executes any SkillPlan.
 *    Dispatches tool_call steps via executeSkillStep and thinking steps
 *    via executeThinkingStep.
 *
 * The Worker's workflowsPath must include both workflow files.
 * We use the bundleWorkflowCode approach with multiple workflow paths.
 *
 * Activity registrations:
 * - dispatchToolActivity (OpenClaw adapter)
 * - executeSkillStep (generic tool dispatch for compiler)
 * - executeThinkingStep (OpenAI LLM dispatch for thinking steps)
 */
async function runWorker(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    // workflowsPath bundles only one entry point.
    // The skill-execution workflow imports workflow-builder, which uses proxyActivities.
    // We use the combined entry — both workflows re-exported from one file.
    workflowsPath: require.resolve('./workflows/all-workflows'),
    activities: {
      ...executeToolActivities,
      ...skillStepActivity,
      ...thinkingActivity,
    },
  });

  console.log(`[Worker] Tenure Worker started`);
  console.log(`[Worker] Temporal address: ${TEMPORAL_ADDRESS}`);
  console.log(`[Worker] Task queue: ${TASK_QUEUE}`);
  console.log(`[Worker] Workflows: agentSessionWorkflow, skillExecutionWorkflow`);
  console.log(`[Worker] Activities: dispatchToolActivity, executeSkillStep, executeThinkingStep`);
  console.log(`[Worker] Polling for tasks... (Ctrl+C to stop)`);

  await worker.run();
}

runWorker().catch((err: Error) => {
  console.error('[Worker] Fatal error:', err.message);
  process.exit(1);
});
