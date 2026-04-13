import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/execute-tool';
import * as path from 'path';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

/**
 * Starts the Temporal Worker for Tenure.
 *
 * The Worker has two registrations:
 * - workflowsPath: points to the compiled Workflow bundle, which runs in an isolated
 *   V8 sandbox via Node worker_threads. No Node APIs (fs, net, crypto) available inside.
 * - activities: registered directly in the main process with full Node API access.
 *   This is where file writes, HTTP calls, and all side-effecting tool calls happen.
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
    // Must include .js extension since Node doesn't auto-resolve it at runtime.
    workflowsPath: path.resolve(__dirname, 'workflows', 'agent-session.js'),
    // Activities run in the main process — imported and passed as an object.
    activities,
  });

  console.log(`[Worker] Tenure Worker started`);
  console.log(`[Worker] Temporal address: ${TEMPORAL_ADDRESS}`);
  console.log(`[Worker] Task queue: ${TASK_QUEUE}`);
  console.log(`[Worker] Polling for tasks... (Ctrl+C to stop)`);

  await worker.run();
}

runWorker().catch((err: Error) => {
  console.error('[Worker] Fatal error:', err.message);
  process.exit(1);
});
