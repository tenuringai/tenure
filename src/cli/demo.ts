import { Client, Connection } from '@temporalio/client';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as appendLineActivities from '../temporal/activities/append-line';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ScheduleOverlapPolicy } from '@temporalio/client';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TASK_QUEUE = 'tenure-standalone-demo';
const SCHEDULE_ID = 'tenure-standalone-proof';
const INTERVAL_SEC = 10;
const CYCLES_BEFORE_KILL = 3;
const MISSED_CYCLES = 2;
const MIN_EXPECTED = CYCLES_BEFORE_KILL + MISSED_CYCLES;

/**
 * Result of the standalone cron-durability proof.
 *
 * The invariants that matter:
 * - totalLines >= minExpected (catch-up recovered the missed triggers)
 * - gaps must be 0 (no lost triggers in the sequence)
 * - dupes must be 0 (no replayed side effects)
 * - sequential must be true (1,2,3,...,N — no disorder)
 */
export interface DemoResult {
  totalLines: number;
  minExpected: number;
  gaps: number;
  dupes: number;
  sequential: boolean;
  passed: boolean;
  logFile: string;
}

/**
 * Verify the proof log: sequential numbers, no gaps, no duplicates.
 */
function verifyProof(lines: string[]): Omit<DemoResult, 'logFile'> {
  const sequences = lines
    .filter(l => l.trim().length > 0)
    .map(l => {
      const parts = l.split('|');
      return parseInt(parts[0], 10);
    });

  const sorted = [...sequences].sort((a, b) => a - b);
  const uniqueSet = new Set(sequences);

  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      gaps += sorted[i] - sorted[i - 1] - 1;
    }
  }

  const dupes = sequences.length - uniqueSet.size;
  const sequential = sequences.every((seq, i) => seq === i + 1);

  return {
    totalLines: sequences.length,
    minExpected: MIN_EXPECTED,
    gaps,
    dupes,
    sequential,
    passed: sequences.length >= MIN_EXPECTED && gaps === 0 && dupes === 0 && sequential,
  };
}

/**
 * Sleep utility with countdown logging.
 */
async function sleepWithLog(ms: number, label: string): Promise<void> {
  const seconds = Math.ceil(ms / 1000);
  console.log(`[tenure] ${label} (${seconds}s)...`);
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start an inline Worker (same process, for tool registry / activity access).
 * Returns the Worker instance so we can shut it down.
 */
async function startWorker(): Promise<Worker> {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('../temporal/workflows/append-line'),
    activities: appendLineActivities,
  });
  return worker;
}

/**
 * Run the standalone cron-durability proof.
 *
 * Why it exists: proves Temporal's Schedule + Activity durability without
 * any OpenClaw dependency. If the OpenClaw adapter is flaky at launch,
 * this standalone demo still proves Tenure's core value proposition.
 *
 * The proof:
 * 1. Create a Temporal Schedule (every 10s)
 * 2. Run Worker → 3 cycles fire → 3 lines in proof.log
 * 3. Stop Worker (simulates crash)
 * 4. Wait 20s (2 missed cycles)
 * 5. Restart Worker → catchupWindow causes missed triggers to fire
 * 6. Verify: 5 lines, sequential, 0 gaps, 0 dupes
 */
export async function runStandaloneDemo(): Promise<DemoResult> {
  const logFile = path.join(os.tmpdir(), `tenure-proof-${Date.now()}.log`);

  console.log(`\n[tenure] ══════════════════════════════════════════`);
  console.log(`[tenure]  STANDALONE CRON-DURABILITY PROOF`);
  console.log(`[tenure] ══════════════════════════════════════════`);
  console.log(`[tenure] Log file:     ${logFile}`);
  console.log(`[tenure] Interval:     ${INTERVAL_SEC}s`);
  console.log(`[tenure] Cycles:       ${CYCLES_BEFORE_KILL} before kill + ${MISSED_CYCLES} missed`);
  console.log(`[tenure] Min expected: ${MIN_EXPECTED} lines (≥), sequential, 0 gaps, 0 dupes`);
  console.log(`[tenure] Temporal:     ${TEMPORAL_ADDRESS}`);
  console.log(`[tenure] Task queue:   ${TASK_QUEUE}`);
  console.log('');

  // Connect client.
  const clientConnection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection: clientConnection });

  // Clean up any leftover schedule from a previous run.
  try {
    const existing = client.schedule.getHandle(SCHEDULE_ID);
    await existing.delete();
    console.log(`[tenure] Cleaned up previous schedule: ${SCHEDULE_ID}`);
  } catch {
    // No previous schedule — expected on first run.
  }

  // Clean up any leftover log file.
  try { await fs.unlink(logFile); } catch { /* doesn't exist */ }

  // ── PHASE 1: Start Worker + Schedule, run 3 cycles ──────────────────

  console.log(`[tenure] Phase 1: Starting Worker and Schedule...`);
  const worker1 = await startWorker();
  const workerPromise1 = worker1.run();

  console.log(`[tenure] Worker started`);

  // Create the Schedule.
  await client.schedule.create({
    scheduleId: SCHEDULE_ID,
    spec: {
      intervals: [{ every: `${INTERVAL_SEC}s` }],
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'appendLineWorkflow',
      args: [{ logFile }],
      taskQueue: TASK_QUEUE,
    },
    policies: {
      catchupWindow: '5m',
      overlap: ScheduleOverlapPolicy.SKIP,
    },
  });

  console.log(`[tenure] Schedule created: ${SCHEDULE_ID} (every ${INTERVAL_SEC}s)`);

  // Wait for 3 cycles + buffer.
  const waitForCycles = INTERVAL_SEC * CYCLES_BEFORE_KILL * 1000 + 5000;
  await sleepWithLog(waitForCycles, `Waiting for ${CYCLES_BEFORE_KILL} cycles`);

  // Read baseline.
  let baseline = '';
  try { baseline = await fs.readFile(logFile, 'utf-8'); } catch { /* empty */ }
  const baselineLines = baseline.trim().split('\n').filter(l => l.length > 0);
  console.log(`[tenure] Baseline: ${baselineLines.length} lines`);

  if (baselineLines.length < CYCLES_BEFORE_KILL) {
    console.log(`[tenure] WARNING: expected ${CYCLES_BEFORE_KILL} lines, got ${baselineLines.length}`);
    console.log(`[tenure] Schedule may need more time. Waiting one more cycle...`);
    await sleepWithLog(INTERVAL_SEC * 1000 + 2000, 'Extra cycle buffer');
    try { baseline = await fs.readFile(logFile, 'utf-8'); } catch { /* empty */ }
    const retryLines = baseline.trim().split('\n').filter(l => l.length > 0);
    console.log(`[tenure] After buffer: ${retryLines.length} lines`);
  }

  // ── PHASE 2: Kill the Worker (simulate crash) ────────────────────────

  console.log(`\n[tenure] Phase 2: Killing Worker (simulating crash)...`);
  worker1.shutdown();
  await workerPromise1.catch(() => {});
  console.log(`[tenure] Worker stopped`);

  // Wait for missed cycles.
  const missedWait = INTERVAL_SEC * MISSED_CYCLES * 1000;
  await sleepWithLog(missedWait, `Waiting ${MISSED_CYCLES} missed cycles (no Worker running)`);

  // ── PHASE 3: Restart Worker, catch up ────────────────────────────────

  console.log(`\n[tenure] Phase 3: Restarting Worker (catch-up)...`);
  const worker2 = await startWorker();
  const workerPromise2 = worker2.run();
  console.log(`[tenure] Worker restarted`);

  // Wait for catch-up: the missed triggers should fire immediately + one extra buffer.
  await sleepWithLog((MISSED_CYCLES + 1) * INTERVAL_SEC * 1000 + 5000, 'Waiting for catch-up');

  // ── PHASE 4: Verify ──────────────────────────────────────────────────

  console.log(`\n[tenure] Phase 4: Verifying proof...`);

  const finalContent = await fs.readFile(logFile, 'utf-8');
  const finalLines = finalContent.trim().split('\n').filter(l => l.length > 0);
  const result = verifyProof(finalLines);

  console.log(`\n[tenure] ══════════════════════════════════════════`);
  if (result.passed) {
    console.log(`[tenure]  ✓ CRON DURABILITY PROOF — PASSED`);
  } else {
    console.log(`[tenure]  ✗ CRON DURABILITY PROOF — FAILED`);
  }
  console.log(`[tenure] ══════════════════════════════════════════`);
  console.log(`[tenure]  Lines:      ${result.totalLines} (min ${result.minExpected})`);
  console.log(`[tenure]  Gaps:       ${result.gaps}`);
  console.log(`[tenure]  Dupes:      ${result.dupes}`);
  console.log(`[tenure]  Sequential: ${result.sequential ? 'YES' : 'NO'}`);
  console.log(`[tenure]  Log file:   ${logFile}`);
  console.log(`[tenure] ══════════════════════════════════════════`);

  if (finalLines.length > 0) {
    console.log(`\n[tenure] Log contents:`);
    for (const line of finalLines) {
      console.log(`         ${line}`);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  console.log(`\n[tenure] Cleaning up...`);
  try {
    const handle = client.schedule.getHandle(SCHEDULE_ID);
    await handle.delete();
    console.log(`[tenure] Schedule deleted`);
  } catch { /* already gone */ }

  worker2.shutdown();
  await workerPromise2.catch(() => {});
  console.log(`[tenure] Worker stopped`);

  return { ...result, logFile };
}
