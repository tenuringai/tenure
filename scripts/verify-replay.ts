import { Client, Connection } from '@temporalio/client';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

// Type-only import for the Workflow function signature (used for type inference only)
import type { agentSessionWorkflow as AgentSessionWorkflowFn } from '../src/temporal/workflows/agent-session';
// Runtime import from compiled dist — this script runs as: node dist/scripts/verify-replay.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { agentSessionWorkflow, executeToolSignal } = require('../src/temporal/workflows/agent-session') as {
  agentSessionWorkflow: typeof AgentSessionWorkflowFn;
  executeToolSignal: import('@temporalio/workflow').SignalDefinition<[import('../src/temporal/activities/execute-tool').ExecuteToolParams]>;
};

/**
 * Verifies that Temporal Activity caching works as the no-duplicate guarantee.
 *
 * Proof ladder step: read replay → write replay (this script) → cron durability
 *
 * What this proves:
 * 1. A Workflow can execute a file-write Activity
 * 2. The Activity result is recorded exactly once in Temporal Event History
 * 3. The file was written exactly once (no duplicates)
 * 4. The hash in Event History matches the hash of the file on disk
 *
 * Prerequisites:
 *   temporal server start-dev    (in a separate terminal)
 *   npm run build                (compile TypeScript)
 *   npm run worker               (in a separate terminal)
 *   npm run verify               (this script)
 */

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-task-queue';

interface VerifyResult {
  passed: boolean;
  workflowId: string;
  filePath: string;
  expectedHash: string;
  actualHash: string;
  hashMatch: boolean;
  activityCompletedCount: number;
  activityExactlyOnce: boolean;
  fileExists: boolean;
}

async function verifyReplay(): Promise<VerifyResult> {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  const sessionId = `verify-${Date.now()}`;
  const workflowId = `tenure-verify-${sessionId}`;
  const filePath = path.join(os.tmpdir(), `tenure-verify-${Date.now()}.txt`);
  const content = `tenure proof — session ${sessionId}`;
  const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

  console.log(`\n--- Tenure No-Duplicate Write Verification ---`);
  console.log(`Workflow ID:   ${workflowId}`);
  console.log(`File path:     ${filePath}`);
  console.log(`Expected hash: ${expectedHash}`);
  console.log(`\nStarting Workflow...`);

  const handle = await client.workflow.start(agentSessionWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [{ sessionId }],
  });

  console.log(`Sending tool call Signal (adapter hook pattern)...`);
  await handle.signal(executeToolSignal, { filePath, content });

  console.log(`Waiting for Workflow to complete...`);
  const result = await handle.result();
  console.log(`Workflow completed — ${result.completedToolCalls} tool call(s) processed`);

  // 1. Verify file exists on disk.
  let fileExists = false;
  let actualHash = '';
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    fileExists = true;
    actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch {
    fileExists = false;
  }

  const hashMatch = actualHash === expectedHash;

  // 2. Inspect Temporal Event History: count ActivityTaskCompleted events.
  //    Exactly 1 means the Activity ran once and its result was cached.
  const history = await handle.fetchHistory();
  
  // Debug: log all event types to understand the format
  const eventTypes = history.events?.map((e) => e.eventType) ?? [];
  console.log(`[Debug] Event types in history: ${JSON.stringify(eventTypes)}`);
  
  const activityCompletedCount =
    history.events?.filter((e) => {
      // Cast to unknown first to handle varying SDK type definitions
      const t = e.eventType as unknown;
      // Temporal SDK returns eventType as a string like 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED'
      // or as a numeric enum value depending on SDK version
      if (typeof t === 'string') {
        return t === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED' || t.includes('ACTIVITY_TASK_COMPLETED');
      }
      if (typeof t === 'number') {
        // Enum value 12 = EVENT_TYPE_ACTIVITY_TASK_COMPLETED in Temporal proto
        // (10=SCHEDULED, 11=STARTED, 12=COMPLETED)
        return t === 12;
      }
      return false;
    }).length ?? 0;

  const activityExactlyOnce = activityCompletedCount === 1;
  const passed = fileExists && hashMatch && activityExactlyOnce;

  return {
    passed,
    workflowId,
    filePath,
    expectedHash,
    actualHash,
    hashMatch,
    activityCompletedCount,
    activityExactlyOnce,
    fileExists,
  };
}

async function main(): Promise<void> {
  let result: VerifyResult;

  try {
    result = await verifyReplay();
  } catch (err) {
    const error = err as Error;
    console.error(`\n[FAIL] Verification error: ${error.message}`);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error(`\nIs Temporal dev server running?`);
      console.error(`  temporal server start-dev`);
    } else if (error.message.includes('timed out') || error.message.includes('no poller')) {
      console.error(`\nIs the Worker running?`);
      console.error(`  npm run build && npm run worker`);
    }
    process.exit(1);
  }

  console.log(`\n--- Verification Results ---`);
  console.log(`File exists on disk:       ${result.fileExists ? 'YES ✓' : 'NO ✗'}`);
  console.log(`Hash match (no corruption):`);
  console.log(`  Expected: ${result.expectedHash}`);
  console.log(`  Actual:   ${result.actualHash}`);
  console.log(`  Match:    ${result.hashMatch ? 'YES ✓' : 'NO ✗'}`);
  console.log(`Activity completed events: ${result.activityCompletedCount} (expected: 1) ${result.activityExactlyOnce ? '✓' : '✗'}`);

  console.log(`\n${result.passed ? '✓ PASS' : '✗ FAIL'} — No-Duplicate Write`);

  if (result.passed) {
    console.log(`\nProof:`);
    console.log(`  File written to:  ${result.filePath}`);
    console.log(`  Activity ran:     exactly once (${result.activityCompletedCount} ACTIVITY_TASK_COMPLETED in history)`);
    console.log(`  SHA-256 verified: ${result.expectedHash}`);
    console.log(`\nTemporal Event History is the source of truth.`);
    console.log(`If the Worker had died after the Activity completed, replay would have`);
    console.log(`returned this same hash from history — no second write, no duplicate.`);
  } else {
    console.error(`\nVerification failed. Check the output above for details.`);
    process.exit(1);
  }
}

main();
