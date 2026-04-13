import { Client, Connection } from '@temporalio/client';
import { agentSessionWorkflow, dispatchToolUpdate, shutdownSignal } from './workflows/agent-session';
import * as os from 'os';
import * as path from 'path';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

/**
 * Demonstrates the Tenure execution model from the client side:
 * 1. Start a long-lived agent session Workflow
 * 2. Send a tool call via Update (the adapter hook pattern — blocks until Activity completes)
 * 3. Receive the Activity result via the Update response
 * 4. Send shutdown Signal to end the session
 *
 * This is a development/test client. In production, use tenureConnect() which
 * wraps tool.execute and manages this flow automatically.
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

  // Start the Workflow — it waits for tool call Updates before executing.
  const handle = await client.workflow.start(agentSessionWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [{ sessionId }],
  });

  console.log(`[Client] Workflow started — dispatching tool call via Update`);

  // Dispatch a tool call via Update — this is the adapter hook pattern.
  // The Update blocks until the Activity completes and returns the result.
  // Once Temporal Server acknowledges the Update, the call is on the durable timeline.
  const response = await handle.executeUpdate(dispatchToolUpdate, {
    args: [{
      toolCallId: `tc-${Date.now()}`,
      toolName: 'mock-file-write',
      params: { filePath, content: `hello from tenure — session ${sessionId}` },
    }],
  });

  console.log(`\n[Client] Tool call completed`);
  console.log(`[Client] Tool call ID:     ${response.toolCallId}`);
  console.log(`[Client] Duration:         ${response.durationMs}ms`);
  console.log(`[Client] Result content:   ${JSON.stringify(response.result.content)}`);
  console.log(`[Client] Result details:   ${JSON.stringify(response.result.details)}`);

  // Send shutdown Signal to end the session Workflow.
  await handle.signal(shutdownSignal);
  console.log(`[Client] Session shutdown signalled`);
}

run().catch((err: Error) => {
  console.error('[Client] Error:', err.message);
  process.exit(1);
});
