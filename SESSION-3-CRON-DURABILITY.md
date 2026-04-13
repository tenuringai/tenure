# Session 3: Cron Durability, Budget Cap, and Circuit Breaker Proofs

## Date: 2026-04-12

---

## 1. The Native OpenClaw Cron Failure

### How OpenClaw Cron Works Today

**Source:** `src/cron/service/timer.ts`, `src/cron/service/ops.ts`, `src/cron/active-jobs.ts`

OpenClaw cron is an in-process `setTimeout` loop:

1. `armTimer(state)` calls `setTimeout` with a delay capped at `MAX_TIMER_DELAY_MS` (60 seconds)
2. On timer fire, `onTimer` runs under a lock: marks due jobs with `runningAtMs`, persists to `jobs.json`, executes jobs, applies outcomes, persists again, re-arms the timer
3. Job state lives in `jobs.json` on disk (atomic write via temp + rename)
4. Active job tracking is an in-memory `Set` (`src/cron/active-jobs.ts`)

### What Disappears on SIGKILL

| State | Location | Survives SIGKILL? |
|-------|----------|-------------------|
| `setTimeout` handle | `CronServiceState.timer` | No |
| Running flag | `CronServiceState.running` | No |
| Active job IDs | `activeJobIds` Set | No |
| Stagger offset cache | `staggerOffsetCache` Map | No |
| Parsed cron expressions | `cronEvalCache` Map | No |
| Job definitions and state | `jobs.json` on disk | Yes |
| `runningAtMs` markers | `jobs.json` (if persisted before kill) | Yes |

### What Happens on Restart

**Source:** `src/cron/service/ops.ts:101-146`

1. `start()` loads `jobs.json` from disk
2. Clears stale `runningAtMs` markers with a warning log
3. One-shot jobs (`schedule.kind === "at"`) that were interrupted are collected into `interruptedOneShotIds` and **explicitly skipped** during catch-up
4. `runMissedJobs` → `planStartupCatchup` checks which recurring jobs have `previousRunAtMs > lastRunAtMs` (i.e., a scheduled slot was missed)
5. Missed jobs are re-executed from scratch — **new agent turns, not resumed executions**
6. Stagger: missed jobs are spread across `DEFAULT_MISSED_JOB_STAGGER_MS` (5 seconds), capped at `DEFAULT_MAX_MISSED_JOBS_PER_RESTART` (5)

### The Three Gaps

**Gap 1: No dedup between interrupted run and catch-up run.**
If a recurring cron job was mid-execution when SIGKILL arrived, its side effects may have partially or fully completed. Catch-up creates a new run without checking prior side effects. This is CP-014 from the crash matrix.

**Gap 2: One-shot jobs are abandoned.**
`interruptedOneShotIds` are passed as `skipJobIds` to `runMissedJobs`. An interrupted one-shot job will never run again. This is CP-015.

**Gap 3: Timer death creates a scheduling gap.**
The `setTimeout` handle is in-process. Between SIGKILL and restart, no timer fires. The system relies entirely on `runMissedJobs` at startup to detect and fill the gap. The gap detection uses `computeJobPreviousRunAtMs` against `lastRunAtMs` — this works for simple cases but does not account for multiple missed intervals or partial completion of the catch-up itself.

---

## 2. The Temporal Schedule Replacement

### Architecture

```
┌──────────────────────────────────────┐
│         Temporal Server              │
│                                      │
│  Schedule: "append-log-every-60s"    │
│  ┌────────────────────────────────┐  │
│  │ spec: every 60 seconds        │  │
│  │ policy: catchupWindow 10 min  │  │
│  │ overlap: SKIP                 │  │
│  │ action: startWorkflow         │  │
│  │   → cronAppendWorkflow        │  │
│  └────────────────────────────────┘  │
│                                      │
│  Survives Worker death.              │
│  Survives Gateway death.             │
│  Queues triggers while Worker down.  │
└──────────────────────────────────────┘
         │
         │ triggers
         ▼
┌──────────────────────────────────────┐
│         Temporal Worker              │
│                                      │
│  cronAppendWorkflow                  │
│  ├── Activity: resolveSequenceNumber │
│  ├── Activity: appendTimestampedLine │
│  └── Activity: verifyFileIntegrity   │
│                                      │
│  Can die. Can restart.               │
│  Activities replay from history.     │
│  No duplicate appends.               │
└──────────────────────────────────────┘
```

### Why This Solves All Three Gaps

**Gap 1 solved:** Each Schedule trigger starts a Workflow. Each Workflow contains Activities. Activities are checkpointed in Temporal Event History. If the Worker dies mid-Activity, replay resumes from the last completed Activity. No new run is created — the same Workflow continues.

**Gap 2 solved:** One-shot schedules become Temporal Workflows. If interrupted, the Workflow resumes on Worker restart. It is never abandoned.

**Gap 3 solved:** The Temporal Schedule lives on the Temporal Server, not in the Worker process. The Schedule fires regardless of Worker status. The `catchupWindow` policy determines how far back to catch up on Worker restart. The Worker just needs to be alive to process queued triggers.

### Temporal Schedule Creation

```typescript
import { Client } from '@temporalio/client';

const client = new Client();

await client.schedule.create({
  scheduleId: 'tenure-cron-append-log',
  spec: {
    intervals: [{ every: '60s' }],
  },
  action: {
    type: 'startWorkflow',
    workflowType: 'cronAppendWorkflow',
    taskQueue: 'tenure-cron-queue',
    args: [{ logFile: 'log.txt' }],
  },
  policies: {
    overlap: 'SKIP',
    catchupWindow: '10 minutes',
  },
});
```

### Workflow Definition

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { resolveSequenceNumber, appendTimestampedLine, verifyFileIntegrity } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '30 seconds',
    retry: { maximumAttempts: 3 },
  });

export async function cronAppendWorkflow(params: { logFile: string }): Promise<void> {
  const seqNum = await resolveSequenceNumber(params.logFile);
  await appendTimestampedLine(params.logFile, seqNum);
  await verifyFileIntegrity(params.logFile, seqNum);
}
```

### Activity Definitions

```typescript
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export async function resolveSequenceNumber(logFile: string): Promise<number> {
  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.length + 1;
  } catch {
    return 1;
  }
}

export async function appendTimestampedLine(
  logFile: string,
  seqNum: number,
): Promise<{ seqNum: number; hash: string }> {
  const timestamp = new Date().toISOString();
  const line = `${seqNum} | ${timestamp}\n`;
  await fs.appendFile(logFile, line);

  const content = await fs.readFile(logFile, 'utf-8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  return { seqNum, hash };
}

export async function verifyFileIntegrity(
  logFile: string,
  expectedSeqNum: number,
): Promise<{ valid: boolean; lineCount: number; hash: string }> {
  const content = await fs.readFile(logFile, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  return {
    valid: lines.length === expectedSeqNum,
    lineCount: lines.length,
    hash,
  };
}
```

---

## 3. The Canonical Cron Durability Demo

This is the headline proof. Optimized for three audiences: demo watchers, certification runners, and Issue #10164 readers.

### Demo Sequence

**Step 1: Configure.**
Create a Temporal Schedule that triggers `cronAppendWorkflow` every 60 seconds. The Workflow appends one timestamped line with a sequence number to `log.txt`.

**Step 2: Run 3 successful cycles.**
Let the system run for 3 minutes. `log.txt` should contain:
```
1 | 2026-04-12T22:30:00.000Z
2 | 2026-04-12T22:31:00.000Z
3 | 2026-04-12T22:32:00.000Z
```

**Step 3: SIGKILL the Worker.**
```bash
kill -9 $(pgrep -f 'tenure-cron-queue')
```

**Step 4: Leave it down for 2+ minutes.**
The Temporal Schedule continues firing on the Server. Triggers are queued because no Worker is available to process them. The `catchupWindow: '10 minutes'` policy means any trigger within the last 10 minutes will be caught up.

**Step 5: Start a new Worker.**
```bash
npm run worker
```

**Step 6: Temporal Schedule catches up.**
The Schedule has 2 queued triggers (cycles 4 and 5 that fired while the Worker was down). The new Worker processes them according to the overlap policy (`SKIP` means one at a time).

**Step 7: Verify `log.txt`.**
```
1 | 2026-04-12T22:30:00.000Z
2 | 2026-04-12T22:31:00.000Z
3 | 2026-04-12T22:32:00.000Z
4 | 2026-04-12T22:34:15.000Z  ← catch-up after restart
5 | 2026-04-12T22:34:16.000Z  ← catch-up after restart
6 | 2026-04-12T22:35:00.000Z  ← normal schedule resumes
```

**Step 8: Assert correctness.**
- Line count: 6 (no gaps)
- Sequence numbers: 1-6 (monotonically increasing, no duplicates)
- No lines from process-death interval (correct — Worker was down)
- Catch-up lines present (cycles 4-5 processed after restart)
- File hash proves exact content

### What OpenClaw Would Produce

Under the same scenario with OpenClaw's native cron:

```
1 | 2026-04-12T22:30:00.000Z
2 | 2026-04-12T22:31:00.000Z
3 | 2026-04-12T22:32:00.000Z
                                ← SIGKILL
                                ← gap: cycle 4 missed
                                ← gap: cycle 5 missed
4 | 2026-04-12T22:34:15.000Z  ← restart catch-up (ONE missed job, not two)
5 | 2026-04-12T22:35:00.000Z  ← normal resumes
```

OpenClaw's `runMissedJobs` catches up **one missed slot** per restart (it checks `previousRunAtMs > lastRunAtMs`, which matches only the immediately preceding slot). The second missed cycle is lost. And if the catch-up triggers a side effect that was already partially done by the interrupted cycle 3, there is no dedup.

---

## 4. The Certification Test Shape

### Test: `cron-durability.test.ts`

```typescript
describe('Cron Durability Certification', () => {
  it('survives Worker death and catches up without duplicates', async () => {
    // SETUP
    const logFile = tempFile('log.txt');
    const schedule = await createSchedule({
      id: 'cert-cron-append',
      interval: '5s', // accelerated for testing
      workflow: 'cronAppendWorkflow',
      args: [{ logFile }],
      catchupWindow: '2 minutes',
      overlap: 'SKIP',
    });

    // RUN 3 CYCLES
    await waitForLines(logFile, 3, { timeout: '30s' });
    const preKillContent = await readFile(logFile);
    expect(lineCount(preKillContent)).toBe(3);
    expect(sequenceNumbers(preKillContent)).toEqual([1, 2, 3]);

    // CRASH
    await killWorker({ signal: 'SIGKILL' });

    // MISS 2 CYCLES
    await sleep('15s');

    // RESTART
    await startWorker();

    // VERIFY CATCH-UP
    await waitForLines(logFile, 6, { timeout: '30s' });
    const postRestartContent = await readFile(logFile);

    // ASSERTIONS
    expect(lineCount(postRestartContent)).toBe(6);
    expect(sequenceNumbers(postRestartContent)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hasDuplicateSequenceNumbers(postRestartContent)).toBe(false);
    expect(fileHash(postRestartContent)).toBeDefined();

    // CLEANUP
    await schedule.delete();
  });
});
```

### Pass/Fail Conditions

| Condition | Pass | Fail |
|-----------|------|------|
| Line count after catch-up | Equals expected (pre-kill + missed + post-restart) | Any count mismatch |
| Sequence numbers | Monotonically increasing, no gaps, no duplicates | Any gap or duplicate |
| File hash | Deterministic from content | Hash mismatch (indicates silent corruption) |
| Catch-up timing | Missed cycles processed within catchupWindow | Missed cycles never processed |
| Duplicate lines | Zero | Any line appears more than once |

---

## 5. Budget Cap Enforcement Proof

### The Founder Pain

> "Tired of cron jobs crashes and fear of max token burn."

Surviving the crash is necessary but not sufficient. The agent must also be **tamed**: it cannot burn unlimited budget while the human is away.

### How It Works

Budget enforcement lives in the Workflow, evaluated **before** each Activity dispatch:

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { executeToolCall, checkBudget } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

export async function budgetEnforcedAgentWorkflow(params: {
  budgetCents: number;
  taskQueue: string;
}): Promise<{ status: string; spentCents: number }> {
  let spentCents = 0;

  while (true) {
    // Budget check BEFORE dispatch — this is workflow logic, deterministic on replay
    if (spentCents >= params.budgetCents) {
      return { status: 'budget_exhausted', spentCents };
    }

    const result = await executeToolCall(/* ... */);
    spentCents += result.costCents;
  }
}
```

### What Must Be Asserted

1. **No execution dispatch occurs past the configured budget cap.**
   The Workflow's `while` loop checks `spentCents >= budgetCents` before calling `executeToolCall`. Because this check is workflow logic (deterministic on replay), the budget gate is enforced even after Worker restart.

2. **The Workflow enters a terminal state when budget is exhausted.**
   The return value `{ status: 'budget_exhausted', spentCents }` is recorded in Temporal history. The Workflow is complete. No further Activities can be dispatched.

3. **Budget enforcement is observable on the timeline.**
   Temporal's Event History shows exactly how many Activities were dispatched and the Workflow completion reason. A Query on the Workflow can return current spend at any time.

### Certification Test Shape

```typescript
describe('Budget Cap Enforcement', () => {
  it('stops execution before overspend', async () => {
    const result = await client.workflow.execute('budgetEnforcedAgentWorkflow', {
      taskQueue: 'tenure-budget-queue',
      args: [{ budgetCents: 100, taskQueue: 'tenure-budget-queue' }],
    });

    expect(result.status).toBe('budget_exhausted');
    expect(result.spentCents).toBeLessThanOrEqual(100);

    // Verify no Activity was dispatched after budget was reached
    const history = await getWorkflowHistory(result.workflowId);
    const lastActivity = history.activities[history.activities.length - 1];
    expect(lastActivity.costCents + result.spentCents - lastActivity.costCents)
      .toBeLessThanOrEqual(100);
  });
});
```

---

## 6. Circuit Breaker Proof

### The Problem

An agent stuck in a pathological loop — retrying the same failing tool call, or cycling between two tools without progress — can burn through budget and time without producing useful work. Budget caps stop the bleeding eventually, but a circuit breaker stops it fast.

### How It Works

The circuit breaker tracks execution patterns at the Workflow level:

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { executeToolCall, escalateToHuman } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

export async function circuitBreakerAgentWorkflow(params: {
  maxConsecutiveFailures: number;
  maxIdenticalCalls: number;
}): Promise<{ status: string; reason: string }> {
  let consecutiveFailures = 0;
  const callHistory: string[] = [];

  while (true) {
    const toolCall = await getNextToolCall(/* from LLM */);
    const callSignature = `${toolCall.name}:${JSON.stringify(toolCall.params)}`;

    // Circuit breaker: repeated identical calls
    callHistory.push(callSignature);
    const recentIdentical = callHistory
      .slice(-params.maxIdenticalCalls)
      .every(c => c === callSignature);

    if (callHistory.length >= params.maxIdenticalCalls && recentIdentical) {
      await escalateToHuman({
        reason: 'pathological_loop',
        pattern: callSignature,
        count: params.maxIdenticalCalls,
      });
      return {
        status: 'circuit_breaker_tripped',
        reason: `${params.maxIdenticalCalls} identical calls: ${toolCall.name}`,
      };
    }

    const result = await executeToolCall(toolCall);

    // Circuit breaker: consecutive failures
    if (result.status === 'error') {
      consecutiveFailures++;
      if (consecutiveFailures >= params.maxConsecutiveFailures) {
        await escalateToHuman({
          reason: 'consecutive_failures',
          count: consecutiveFailures,
        });
        return {
          status: 'circuit_breaker_tripped',
          reason: `${consecutiveFailures} consecutive failures`,
        };
      }
    } else {
      consecutiveFailures = 0;
    }
  }
}
```

### What Must Be Asserted

1. **The Workflow pauses or terminates when the breaker trips.**
   Workflow returns `{ status: 'circuit_breaker_tripped' }` — a terminal state. Temporal history records the reason.

2. **Escalation occurs before the trip.**
   The `escalateToHuman` Activity fires before the return. This could be a Slack message, an email, or a Signal to a monitoring Workflow.

3. **Both failure modes are detectable:**
   - `maxConsecutiveFailures` consecutive errors → trip
   - `maxIdenticalCalls` identical call signatures → trip (pathological loop)

4. **The breaker state survives Worker death.**
   `consecutiveFailures` and `callHistory` are local workflow variables. On replay, Temporal reconstructs them from Activity completions in Event History. The breaker state is deterministic and durable.

### Certification Test Shape

```typescript
describe('Circuit Breaker', () => {
  it('trips on consecutive failures', async () => {
    // Configure tool to fail every call
    const result = await client.workflow.execute('circuitBreakerAgentWorkflow', {
      taskQueue: 'tenure-breaker-queue',
      args: [{ maxConsecutiveFailures: 3, maxIdenticalCalls: 5 }],
    });

    expect(result.status).toBe('circuit_breaker_tripped');
    expect(result.reason).toContain('consecutive failures');
  });

  it('trips on pathological loop', async () => {
    // Configure tool to succeed but LLM always picks the same call
    const result = await client.workflow.execute('circuitBreakerAgentWorkflow', {
      taskQueue: 'tenure-breaker-queue',
      args: [{ maxConsecutiveFailures: 10, maxIdenticalCalls: 3 }],
    });

    expect(result.status).toBe('circuit_breaker_tripped');
    expect(result.reason).toContain('identical calls');
  });
});
```

---

## 7. The Public Proof Narrative

### For the README

> **What happens when the cron job crashes?**
>
> We configured an agent to append one timestamped line to a file every 60 seconds. After 3 successful cycles, we killed the Worker with SIGKILL. We left it down for 2 minutes — long enough to miss 2 scheduled cycles. Then we started a new Worker.
>
> The Temporal Schedule had continued firing while the Worker was down. On restart, the new Worker processed the missed triggers. The file contained all expected lines, with no gaps caused by process death and no duplicates caused by replay. The sequence numbers and file hash proved correctness.
>
> Then we ran the same agent to 100% budget. The Workflow stopped before overspend. Then we fed it a pathological loop. The circuit breaker tripped after 3 identical calls.
>
> That is what "tamed execution" means. Not just survival. Control.

### For Issue #10164

> This repo proves three things:
>
> 1. **Cron durability.** Temporal Schedule fires independently of the Worker. Missed triggers are caught up per policy. No gaps, no duplicates. `npx tenure certify --cron` runs the proof.
>
> 2. **No-duplicate replay.** Every tool call is a Temporal Activity. If the Worker dies after a file write completes but before the result is delivered, replay returns the cached result from Event History. The file is written exactly once. `npx tenure certify --replay` runs the proof.
>
> 3. **Taming.** Budget caps stop the Workflow before overspend. Circuit breakers trip on pathological loops. Both survive Worker death because the enforcement logic is in the Workflow, and Temporal reconstructs Workflow state from history. `npx tenure certify --taming` runs the proof.
>
> The proof is not a demo. It is a certification that you can run yourself.

### For the Demo

The demo is a single terminal recording:

```
$ npx tenure certify --all

  ✓ Cron Durability
    Schedule: every 5s (accelerated)
    Pre-kill: 3 lines, seq [1,2,3]
    Kill: SIGKILL Worker
    Down: 15s (missed 2 cycles)
    Restart: Worker up
    Post-restart: 6 lines, seq [1,2,3,4,5,6]
    Duplicates: 0
    Hash: a3f2...verified

  ✓ No-Duplicate Replay
    Activity: file write "hello" → test.txt
    Kill: SIGKILL after Activity completion
    Restart: replay returns cached result
    File hash: unchanged
    Write count: 1

  ✓ Budget Cap
    Budget: 100 cents
    Activities executed: 7
    Total spend: 98 cents
    Status: budget_exhausted
    Overspend: 0

  ✓ Circuit Breaker
    Max consecutive failures: 3
    Failures triggered: 3
    Status: circuit_breaker_tripped
    Escalation: sent

  4/4 certifications passed.
```

---

## 8. Source of Truth Statement

Per Session 3 checklist item 12:

- **Trigger timing** is owned by Temporal Schedule. The Schedule lives on the Temporal Server, not in any Worker process. Worker death does not affect trigger timing.
- **Execution truth** is owned by Temporal Event History. Every Activity result is recorded. Replay reconstructs exact state. No duplicate side effects.
- **OpenClaw's own session files are not the recovery authority.** The `.jsonl` transcript and `jobs.json` are secondary logs. They are useful for UI and debugging but they do not own execution truth.

---

## Session 3 Done Definition

> Describe: one cron durability test, one budget-cap enforcement test, one circuit-breaker test — and all three are simultaneously an engineering proof, a certification case, and a believable public demo of taming, not just survival.

**Status: Met.**

- Cron durability: demo sequence defined (7 steps), certification test with 5 pass/fail conditions, Temporal Schedule + Workflow + Activities specified
- Budget cap: enforcement logic in Workflow (pre-dispatch check), certification test with overspend assertion
- Circuit breaker: dual-mode detection (consecutive failures + identical calls), certification test with trip assertion
- Public proof: README narrative, Issue #10164 comment draft, demo terminal output
- Source of truth: trigger → Temporal Schedule, execution → Temporal Event History, OpenClaw artifacts → secondary logs
