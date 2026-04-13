import { Client, Connection } from '@temporalio/client';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

// Runtime imports (resolved from compiled dist)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { agentSessionWorkflow, dispatchToolUpdate, shutdownSignal, sessionStatsQuery } =
  require('../src/temporal/workflows/agent-session') as typeof import('../src/temporal/workflows/agent-session');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerTool } = require('../src/adapter/tool-registry') as typeof import('../src/adapter/tool-registry');

/**
 * End-to-end verification of the Tenure adapter.
 *
 * Proof: a mock tool that writes a file is wrapped by the adapter pattern.
 * The tool call is dispatched through Temporal via a Workflow Update.
 * The Activity runs the mock tool, writes the file, returns a hash.
 * The result flows back to the caller via the Update response.
 *
 * Prerequisites:
 *   temporal server start-dev    (in a separate terminal)
 *   npm run build                (compile TypeScript)
 *   npm run worker               (in a separate terminal — with tools registered)
 *   npm run verify               (this script)
 */

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

interface VerifyResult {
  passed: boolean;
  workflowId: string;
  toolCallId: string;
  fileWritten: boolean;
  hashMatch: boolean;
  expectedHash: string;
  actualHash: string;
  durationMs: number;
  activityCompletedCount: number;
}

async function verifyAdapterRoundTrip(): Promise<VerifyResult> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  const sessionId = `adapter-verify-${Date.now()}`;
  const workflowId = `tenure-${sessionId}`;
  const toolCallId = `tc-${Date.now()}`;
  const filePath = path.join(os.tmpdir(), `tenure-adapter-verify-${Date.now()}.txt`);
  const content = `tenure adapter proof — session ${sessionId}`;
  const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

  console.log(`\n--- Tenure Adapter Round-Trip Verification ---`);
  console.log(`Workflow ID:   ${workflowId}`);
  console.log(`Tool call ID:  ${toolCallId}`);
  console.log(`File path:     ${filePath}`);
  console.log(`Expected hash: ${expectedHash}`);

  // Register the mock tool in the local process registry.
  // In production, tenureConnect() does this before starting the Worker.
  // For this test, we register directly so the Activity (running in Worker process)
  // can look up the function.
  // NOTE: This only works if the Worker process shares the same module instance.
  // For a cross-process Worker, use the worker.ts registration pattern.
  registerTool('mock-file-write', async (_toolCallId, params) => {
    const p = params as { filePath: string; content: string };
    await fs.writeFile(p.filePath, p.content, 'utf-8');
    const hash = crypto.createHash('sha256').update(p.content).digest('hex');
    return {
      content: [{ type: 'text', text: `Written: ${p.filePath} (sha256: ${hash})` }],
      details: { filePath: p.filePath, hash },
    };
  });

  // Start the session Workflow.
  console.log(`\nStarting session Workflow...`);
  const handle = await client.workflow.start(agentSessionWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [{ sessionId }],
  });
  console.log(`Workflow started: ${workflowId}`);

  // Dispatch the tool call via Update — this is the adapter hook pattern.
  // The Update blocks until the Activity completes and returns the result.
  console.log(`Dispatching tool call via Update (adapter pattern)...`);
  const startMs = Date.now();

  const response = await handle.executeUpdate(dispatchToolUpdate, {
    args: [{
      toolCallId,
      toolName: 'mock-file-write',
      params: { filePath, content },
    }],
  });

  const roundTripMs = Date.now() - startMs;
  console.log(`Update returned in ${roundTripMs}ms`);
  console.log(`Activity duration: ${response.durationMs}ms`);

  // Verify file was written.
  let fileWritten = false;
  let actualHash = '';
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    fileWritten = true;
    actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch {
    fileWritten = false;
  }

  const hashMatch = actualHash === expectedHash;

  // Check Activity completed count in history.
  const history = await handle.fetchHistory();
  const activityCompletedCount =
    history.events?.filter((e) => {
      const t = e.eventType as unknown;
      if (typeof t === 'string') return (t as string).includes('ACTIVITY_TASK_COMPLETED');
      if (typeof t === 'number') return t === 12;
      return false;
    }).length ?? 0;

  // Check session stats via Query.
  const stats = await handle.query(sessionStatsQuery);
  console.log(`\nSession stats: ${JSON.stringify(stats, null, 2)}`);

  // Shutdown the Workflow.
  await handle.signal(shutdownSignal);

  return {
    passed: fileWritten && hashMatch && activityCompletedCount >= 1,
    workflowId,
    toolCallId,
    fileWritten,
    hashMatch,
    expectedHash,
    actualHash,
    durationMs: roundTripMs,
    activityCompletedCount,
  };
}

async function main(): Promise<void> {
  let result: VerifyResult;

  try {
    result = await verifyAdapterRoundTrip();
  } catch (err) {
    const error = err as Error;
    console.error(`\n[FAIL] Verification error: ${error.message}`);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error(`\nIs Temporal dev server running?\n  temporal server start-dev`);
    } else if (error.message.includes('timed out') || error.message.includes('no poller')) {
      console.error(`\nIs the Worker running?\n  npm run build && npm run worker`);
    } else if (error.message.includes('ToolRegistry')) {
      console.error(`\nTool not registered. The Worker process must register tools before dispatching.`);
    }
    process.exit(1);
  }

  console.log(`\n--- Adapter Verification Results ---`);
  console.log(`File written:              ${result.fileWritten ? 'YES ✓' : 'NO ✗'}`);
  console.log(`Hash match:`);
  console.log(`  Expected: ${result.expectedHash}`);
  console.log(`  Actual:   ${result.actualHash}`);
  console.log(`  Match:    ${result.hashMatch ? 'YES ✓' : 'NO ✗'}`);
  console.log(`Activity completed events: ${result.activityCompletedCount} ✓`);
  console.log(`Round-trip latency:        ${result.durationMs}ms`);

  console.log(`\n${result.passed ? '✓ PASS' : '✗ FAIL'} — Adapter Round-Trip`);

  if (result.passed) {
    console.log(`\nProof:`);
    console.log(`  Tool call dispatched via Workflow Update`);
    console.log(`  Activity executed the mock tool in the Worker process`);
    console.log(`  File written, hash verified`);
    console.log(`  Result returned to caller via Update response`);
    console.log(`\nEvery tool call is now on the Temporal timeline.`);
    console.log(`Crash recovery, no-duplicate replay, and budget enforcement follow.`);
  } else {
    process.exit(1);
  }
}

main();
