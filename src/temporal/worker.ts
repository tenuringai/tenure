import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/execute-tool';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

/**
 * Standalone Temporal Worker for Tenure.
 *
 * For production use, call tenureConnect() instead — it creates the Worker after
 * registering all tools in the tool registry so the dispatchToolActivity can find them.
 *
 * This standalone worker is for development and testing purposes.
 * It registers the dispatchToolActivity but without any tools pre-registered,
 * so tool calls will fail unless tools are registered separately.
 *
 * The Worker has two registrations:
 * - workflowsPath: points to the compiled Workflow file, which runs in an isolated
 *   V8 sandbox via Node worker_threads. No Node APIs (fs, net, crypto) available inside.
 * - activities: registered directly in the main process with full Node API access.
 *   This is where the original tool.execute functions are called.
 */
async function runWorker(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    // Workflows run in an isolated sandbox — referenced by file path, not imported.
    workflowsPath: require.resolve('./workflows/agent-session'),
    // Activities run in the main process — imported and passed as an object.
    activities,
  });

  console.log(`[Worker] Tenure Worker started`);
  console.log(`[Worker] Temporal address: ${TEMPORAL_ADDRESS}`);
  console.log(`[Worker] Task queue: ${TASK_QUEUE}`);
  console.log(`[Worker] Activity: dispatchToolActivity (tool registry empty — use tenureConnect() for production)`);
  console.log(`[Worker] Polling for tasks... (Ctrl+C to stop)`);

  await worker.run();
}

runWorker().catch((err: Error) => {
  console.error('[Worker] Fatal error:', err.message);
  process.exit(1);
});
