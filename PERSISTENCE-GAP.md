# Persistence Gap

## Purpose

This is the short reference for why Temporal Event History must be the source of truth for recovery in Tenure's current wedge.

Read this before making any architectural decision about:

- crash recovery
- replay
- checkpoint ownership
- SER boundary design
- certification scope

## Working Summary

OpenClaw persists some useful artifacts, but not enough authoritative execution state to recover a running agent correctly after interruption.

What OpenClaw persists:

- session transcripts to `.jsonl` via `SessionManager.open(sessionFile)` (`src/agents/pi-embedded-runner/run/attempt.ts:856`)
- cron job state to `jobs.json` via atomic write + rename (`src/cron/store.ts`)
- exec approvals to disk (`src/infra/exec-approvals.js` via `src/node-host/invoke.ts`)
- task registry snapshots to SQLite (`src/tasks/task-registry.store.sqlite.ts`)
- session store entries to JSON files (`src/config/sessions/`)

What remains only in memory:

- active embedded runs, snapshots, waiters — global singletons on `Symbol.for("openclaw.embeddedRunState")` (`src/agents/pi-embedded-runner/runs.ts`)
- pending tool results between execution and flush (`wait-for-idle-before-flush.ts`)
- cron timer handle (`setTimeout`), running state, active job IDs (`src/cron/service/timer.ts`, `src/cron/active-jobs.ts`)
- MCP bridge queue, pending waiters, pending approvals (`src/mcp/channel-bridge.ts`)
- plugin registry (`globalThis` via `src/plugins/runtime.ts`)
- session lifecycle and transcript listeners (`src/sessions/transcript-events.ts`, `session-lifecycle-events.ts`)
- web fetch cache (`src/agents/tools/web-fetch.ts` — in-memory `Map`)
- gateway health/presence cache (`src/gateway/server/health-state.ts`)
- session title field cache (`src/gateway/session-utils.fs.ts`)

The problem is not "OpenClaw saves nothing." The problem is:

- what is saved is a conversation log, not an execution record
- tool results sit in memory between execution and transcript flush
- the flush itself is best-effort with a 30-second timeout (`DEFAULT_WAIT_FOR_IDLE_TIMEOUT_MS`)
- if the process dies before flush, pending tool results are lost
- even if the transcript is intact, it cannot reconstruct which tool call was mid-execution, whether the side effect completed, or what the cached result should be on replay

## Why OpenClaw Persistence Is Insufficient

### 1. Tool Execution Has No Durability Boundary

**Source evidence (FACT):**

`tool.execute(id, arguments)` runs directly in-process. In `src/mcp/plugin-tools-serve.ts`, MCP tool calls use `tool.execute(\`mcp-${Date.now()}\`, arguments)` — a non-stable ID with no idempotency semantics. In `src/agents/tools/agent-step.ts`, agent steps use `crypto.randomUUID()` for idempotency keys, but these are generated per-invocation and not persisted before execution.

Tool results are held in memory by the SessionManager and flushed via `flushPendingToolResultsAfterIdle` (`src/agents/pi-embedded-runner/wait-for-idle-before-flush.ts`). This function waits up to 30 seconds for the agent to become idle, then either flushes or **clears** pending results (`clearPendingOnTimeout: true`).

The `tool_result_persist` hook (`openclaw.llm.txt:13361`) "synchronously transform[s] tool results before they are written to the session transcript" — confirming the transcript is the only persistence target and the write happens after execution, not before.

**Why this is insufficient:** There is no checkpoint between "tool executed" and "result durably recorded." If SIGKILL arrives in this window, the side effect happened but the result is lost. On restart, OpenClaw has no way to know the side effect completed, and re-execution would duplicate it.

### 2. Gateway State Loss

**Issue anchor:** `#62442`

**Source evidence (FACT):**

Per-connection state lives in process memory: `SessionHistorySseState` holds `sentHistory` and `rawTranscriptSeq` as instance fields (`src/gateway/session-history-state.ts`). Health/presence caching is module-level in `src/gateway/server/health-state.ts`. Session lifecycle event listeners are in-memory Sets (`src/sessions/session-lifecycle-events.ts`).

The official docs confirm: "Events are not replayed; clients must refresh on gaps" (`openclaw.llm.txt:13834`).

**Why this is insufficient:** Recovery from Gateway restart requires clients to refresh from scratch. There is no server-side replay of missed events. Any in-flight tool execution or pending result delivery at the time of Gateway death is lost without trace.

### 3. History Exists But Does Not Reload Reliably

**Issue anchor:** `#55343`

**Source evidence (FACT):**

The official docs state: "The full conversation history stays on disk. Compaction only changes what the model sees on the next turn" (`openclaw.llm.txt:13866`). But `session-manager-init.ts` (`prepareSessionManagerForRun`) may **empty-write** the session file and reset in-memory `fileEntries` when a pre-existing session file has a header but no assistant message.

The `replay-history.ts` module's `createProviderReplaySessionState` **catches and ignores persistence failures** with the comment `// ignore persistence failures`.

**Why this is insufficient:** History on disk is a conversation log, not an execution record. It records what was said, not what was done. Even when intact, it cannot answer: "did the file write on line 247 of the last tool call actually complete before the process died?"

### 4. Cron Uses In-Process setTimeout

**Source evidence (FACT):**

Cron scheduling is driven by `setTimeout` in `armTimer` (`src/cron/service/timer.ts`), capped at `MAX_TIMER_DELAY_MS` (60 seconds). The timer handle, running state, and active job IDs are all in-memory (`CronServiceState.timer`, `src/cron/active-jobs.ts` global `Set`).

On restart, `ops.start` clears stale `runningAtMs` markers and calls `runMissedJobs` → `planStartupCatchup`. But one-shot jobs interrupted mid-execution are explicitly **not retried** — they are collected into `interruptedOneShotIds` and passed as `skipJobIds` (`src/cron/service/ops.ts:107-134`).

Catch-up for recurring cron jobs uses `allowCronMissedRunByLastRun` which replays missed cron slots based on persisted `lastRunAtMs` / `nextRunAtMs`. But catch-up runs the job again from scratch — it does not replay from a durable execution checkpoint.

**Why this is insufficient:** Timer death kills the schedule. Restart catch-up is best-effort and re-executes jobs from scratch rather than resuming from a checkpoint. One-shot interrupted jobs are abandoned. There is no guarantee against duplicate execution for recurring jobs because catch-up creates new runs without checking whether the interrupted run's side effects completed.

### 5. Tool Result Flush Is Best-Effort

**Source evidence (FACT):**

Cleanup in `attempt.subscription-cleanup.ts` (`cleanupEmbeddedAttemptResources`) runs `flushPendingToolResultsAfterIdle` with `clearPendingOnTimeout: true`, meaning if the agent doesn't become idle within 30 seconds, pending tool results are **discarded**, not persisted. Multiple cleanup steps use **empty catch blocks** with `/* best-effort */` comments.

Hook runner errors (`hookRunner.runLlmInput().catch`, `hookRunner.runLlmOutput().catch`) are caught and only warn-logged (`src/agents/pi-embedded-runner/run/attempt.ts`).

Node-host invoke results (`sendInvokeResult`, `sendNodeEvent`) catch errors and **ignore** them — best-effort delivery to gateway (`src/node-host/invoke.ts`).

**Why this is insufficient:** The system is designed for best-effort delivery in the happy path. Every error path silently drops data. This is acceptable for a conversational agent where the user can retry. It is not acceptable for an execution engine where a dropped tool result means a lost or duplicated side effect.

## Architectural Consequence

The current wedge therefore assumes:

- OpenClaw thinks
- Tenure executes
- Temporal owns the timeline

And specifically:

- OpenClaw's `.jsonl` transcripts are conversation logs, not execution records
- Temporal Event History is the authoritative recovery surface
- execution checkpoints must be owned at the router/primitive boundary, before the tool executes
- tool results must be recorded in Temporal history before being delivered to the next reasoning step

## What Tenure Must Own Instead

At minimum, the workflow-owned execution layer must be able to recover:

- which call was being executed (tool call ID, tool name)
- what parameters were used (serialized arguments)
- what result completed (serialized Activity result in Temporal history)
- whether the side effect already happened (Activity completion status)
- which primitive owned the step (execution type → Temporal primitive mapping)
- whether replay should return a cached result or re-dispatch (Temporal's deterministic replay)

## Relationship To Proof Ladder

This file exists to support the current proof ladder:

1. read replay
2. deterministic write replay without duplication
3. cron survival
4. budget cap enforcement
5. circuit breaker trip

Every one of those proofs depends on the same prior claim:

**OpenClaw's own persisted artifacts are not enough. The workflow-owned timeline must be the recovery authority.**

## Status

Session 1 research complete. All claims above cite specific source files and line references from the OpenClaw repository cloned 2026-04-12. Working interpretations from issue anchors (#62442, #55343, #21382) are now supplemented with direct source evidence.

Next steps:

- Session 2: expand crash points into a 15-25 entry matrix with code evidence
- Session 3: define cron durability proof with Temporal Schedule replacement
