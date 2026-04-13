import { Client, Connection } from '@temporalio/client';
import { agentSessionWorkflow, executeToolSignal } from './workflows/agent-session';
import * as os from 'os';
import * as path from 'path';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

/**
 * Demonstrates the Tenure execution model from the client side:
 * 1. Start a long-lived agent session Workflow
 * 2. Send a tool call via Signal (the adapter hook pattern)
 * 3. Wait for the Workflow to complete and return the Activity result
 */
async function run(): Promise<void> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  const sessionId = `session-${Date.now()}`;
  const workflowId = `tenure-${sessionId}`;
  const filePath = path.join(os.tmpdir(), `tenure-proof-${Date.now()}.txt`);

  console.log(`[Client] Starting agent session Workflow`);
  console.log(`[Client] Workflow ID: ${workflowId}`);
  console.log(`[Client] Temporal address: ${TEMPORAL_ADDRESS}`);

  // Start the Workflow — it will wait for a tool call Signal before executing.
  // In Task 2, the adapter hook does this once per OpenClaw session, then
  // sends tool calls via Signal for each intercepted tool call.
  const handle = await client.workflow.start(agentSessionWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [{ sessionId }],
  });

  console.log(`[Client] Workflow started — sending tool call Signal`);

  // Send the tool call via Signal — this is the adapter hook pattern.
  // The moment Temporal acknowledges this Signal, the tool call is on the timeline.
  await handle.signal(executeToolSignal, {
    filePath,
    content: `hello from tenure — session ${sessionId}`,
  });

  console.log(`[Client] Signal sent — waiting for Workflow to complete`);

  // Wait for the Workflow result (blocks until Activity completes).
  const result = await handle.result();

  console.log(`\n[Client] Workflow completed`);
  console.log(`[Client] Session ID:        ${result.sessionId}`);
  console.log(`[Client] Tool calls:        ${result.completedToolCalls}`);
  console.log(`[Client] File written to:   ${result.lastResult?.filePath}`);
  console.log(`[Client] SHA-256:           ${result.lastResult?.hash}`);
  console.log(`[Client] Written:           ${result.lastResult?.written}`);
}

run().catch((err: Error) => {
  console.error('[Client] Error:', err.message);
  process.exit(1);
});
