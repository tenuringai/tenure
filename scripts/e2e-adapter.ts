import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Client, Connection } from '@temporalio/client';
import { Worker, NativeConnection } from '@temporalio/worker';
import { registerTool } from '../src/adapter/tool-registry';
import * as activities from '../src/temporal/activities/execute-tool';

// Runtime imports for Workflow definitions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { agentSessionWorkflow, dispatchToolUpdate, shutdownSignal, sessionStatsQuery } =
  require('../src/temporal/workflows/agent-session') as typeof import('../src/temporal/workflows/agent-session');

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-e2e-test-queue';

/**
 * End-to-end integration test for the Tenure adapter.
 *
 * Runs everything in one process:
 * 1. Registers a mock tool in the tool registry
 * 2. Starts an inline Temporal Worker with the dispatchToolActivity
 * 3. Starts a session Workflow
 * 4. Dispatches a tool call via Update
 * 5. Verifies the Activity ran, the file was written, and the hash matches
 * 6. Shuts down cleanly
 *
 * Prerequisites: temporal server start-dev (localhost:7233)
 */
async function runE2ETest(): Promise<void> {
  console.log(`\n=== Tenure Adapter End-to-End Test ===`);

  const sessionId = `e2e-${Date.now()}`;
  const workflowId = `tenure-${sessionId}`;
  const filePath = path.join(os.tmpdir(), `tenure-e2e-${Date.now()}.txt`);
  const content = `e2e test content — ${sessionId}`;
  const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

  console.log(`Session ID:    ${sessionId}`);
  console.log(`File path:     ${filePath}`);
  console.log(`Expected hash: ${expectedHash}`);

  // 1. Register mock tool BEFORE starting the Worker (so Activity can find it).
  console.log(`\n[1] Registering mock tool...`);
  registerTool('mock-file-write', async (_toolCallId, params) => {
    const p = params as { filePath: string; content: string };
    await fs.writeFile(p.filePath, p.content, 'utf-8');
    const hash = crypto.createHash('sha256').update(p.content).digest('hex');
    console.log(`  [MockTool] Written ${p.filePath}, sha256: ${hash}`);
    return {
      content: [{ type: 'text', text: `Written: ${p.filePath}` }],
      details: { filePath: p.filePath, hash },
    };
  });
  console.log(`  Registered: mock-file-write`);

  // 2. Start Worker inline (shares process with test, so registry is accessible).
  console.log(`\n[2] Starting inline Worker...`);
  const workerConnection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  const worker = await Worker.create({
    connection: workerConnection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('../src/temporal/workflows/agent-session'),
    activities,
  });

  let workerStopped = false;
  // Run the Worker in background (don't await — it polls indefinitely).
  const workerPromise = worker.run().then(() => { workerStopped = true; });

  // 3. Connect client.
  console.log(`\n[3] Connecting Temporal client...`);
  const clientConnection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection: clientConnection });

  try {
    // 4. Start session Workflow.
    console.log(`\n[4] Starting session Workflow: ${workflowId}`);
    const handle = await client.workflow.start(agentSessionWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [{ sessionId }],
    });
    console.log(`  Workflow started`);

    // 5. Dispatch tool call via Update — blocks until Activity completes.
    console.log(`\n[5] Dispatching tool call via Update...`);
    const startMs = Date.now();

    const response = await handle.executeUpdate(dispatchToolUpdate, {
      args: [{
        toolCallId: `tc-${Date.now()}`,
        toolName: 'mock-file-write',
        params: { filePath, content },
      }],
    });

    const roundTripMs = Date.now() - startMs;
    console.log(`  Update returned in ${roundTripMs}ms`);
    console.log(`  Activity duration: ${response.durationMs}ms`);
    console.log(`  Result: ${JSON.stringify(response.result.content)}`);

    // 6. Verify assertions.
    console.log(`\n[6] Verifying results...`);

    // Check file was written.
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    const hashMatch = actualHash === expectedHash;

    console.log(`  File exists:   YES`);
    console.log(`  Hash match:    ${hashMatch ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Expected:      ${expectedHash}`);
    console.log(`  Actual:        ${actualHash}`);

    // Check session stats.
    const stats = await handle.query(sessionStatsQuery);
    console.log(`  Completed calls: ${stats.completedToolCalls}`);
    console.log(`  Failed calls:    ${stats.failedToolCalls}`);

    // Check history for Activity completion.
    const history = await handle.fetchHistory();
    const activityCount = history.events?.filter((e) => {
      const t = e.eventType as unknown;
      if (typeof t === 'string') return (t as string).includes('ACTIVITY_TASK_COMPLETED');
      if (typeof t === 'number') return t === 12;
      return false;
    }).length ?? 0;
    console.log(`  Activity completed events: ${activityCount}`);

    // 7. Shutdown Workflow.
    console.log(`\n[7] Shutting down session...`);
    await handle.signal(shutdownSignal);

    // Wait for Workflow to complete.
    await handle.result();
    console.log(`  Workflow completed`);

    // 8. Final assertions.
    const allPassed = hashMatch && stats.completedToolCalls === 1 && activityCount >= 1;

    console.log(`\n=== Results ===`);
    console.log(`Hash match:               ${hashMatch ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`Tool calls completed:     ${stats.completedToolCalls === 1 ? 'PASS ✓' : 'FAIL ✗'} (expected 1, got ${stats.completedToolCalls})`);
    console.log(`Activity in history:      ${activityCount >= 1 ? 'PASS ✓' : 'FAIL ✗'} (count: ${activityCount})`);
    console.log(`Round-trip latency:       ${roundTripMs}ms`);
    console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

    if (!allPassed) {
      process.exit(1);
    }

  } finally {
    // Shutdown Worker cleanly.
    worker.shutdown();
    await workerPromise.catch(() => {}); // ignore shutdown errors
    if (!workerStopped) {
      console.log(`  Worker stopped`);
    }
  }
}

runE2ETest().catch((err: Error) => {
  console.error(`\n[FATAL] ${err.message}`);
  if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
    console.error(`\nIs Temporal dev server running?`);
    console.error(`  temporal server start-dev`);
  }
  process.exit(1);
});
