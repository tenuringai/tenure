# Session 1 Findings: Adapter Boundary and Replay Proof

## Date: 2026-04-12

## Method

Source-level analysis of the OpenClaw repository (`openclaw/openclaw`, cloned 2026-04-12, `--depth 1`). Three parallel exploration passes covering:

1. Agent runner, tools, helpers (`src/agents/pi-embedded-runner/`, `src/agents/tools/`, `src/agents/pi-embedded-helpers/`)
2. Node host, gateway, sessions, cron (`src/node-host/`, `src/gateway/`, `src/sessions/`, `src/cron/`)
3. MCP, plugins, flows, tasks, memory (`src/mcp/`, `src/plugins/`, `src/flows/`, `src/tasks/`, `src/memory-host-sdk/`)

Cross-referenced with `openclaw.llm.txt` corpus for behavioral documentation.

---

## Execution Boundary Trace

The minimal end-to-end tool call path in OpenClaw:

```
User input
  → runEmbeddedPiAgent (src/agents/pi-embedded-runner/run.ts)
    → runEmbeddedAttemptWithBackend (run/backend.ts)
      → runEmbeddedAttempt (run/attempt.ts)
        → SessionManager.open(sessionFile) — opens .jsonl transcript
        → createAgentSession — builds agent with tools
        → activeSession.prompt(...) — runs LLM inference
          → LLM emits tool_use decision
          → tool.execute(id, arguments) — IN-PROCESS, NO CHECKPOINT
          → tool result held in memory (SessionManager pending buffer)
          → flushPendingToolResults — best-effort write to .jsonl
          → result delivered to next reasoning step
```

**The critical observation:** There is no durability boundary between "tool executed" and "result recorded." The entire path from tool dispatch through side-effect execution through result delivery runs in a single Node.js process with no checkpoint.

---

## Read-Proof Hypothesis

**Claim:** An idempotent read (e.g., `web_search`, `file_read`, `grep`) that completes in OpenClaw and is killed before the result reaches the next reasoning step will be lost. On restart, OpenClaw will re-run the entire agent turn from scratch, re-executing the read. This is harmless for idempotent reads but demonstrates the fundamental replay gap.

**Evidence:**

- `tool.execute(id, arguments)` runs in-process with no pre-execution checkpoint (`src/mcp/plugin-tools-serve.ts`, `src/agents/tools/common.ts`)
- Tool results sit in memory until `flushPendingToolResultsAfterIdle` runs, with a 30-second timeout (`src/agents/pi-embedded-runner/wait-for-idle-before-flush.ts:10`)
- If process dies before flush, pending results are gone — there is no recovery path for in-flight tool results
- On restart, OpenClaw loads the `.jsonl` transcript and starts a new agent turn. It does not resume mid-tool-call.

**What Tenure would do differently:**

- Wrap the read in a Temporal Activity
- Activity executes the read and records the result in Temporal Event History
- If the Worker dies after the Activity completes, replay returns the cached result from history
- The LLM reasoning step receives the same result without re-executing the read
- Net effect: one network call, zero re-execution, deterministic replay

**Proof test shape:**

1. Start a Tenure workflow that executes a web search Activity
2. Activity completes and result is recorded in Temporal history
3. SIGKILL the Worker before the workflow delivers the result to the next step
4. Start a new Worker
5. Temporal replays the workflow; the search Activity returns its cached result
6. Assert: no second HTTP request was made; result matches original

---

## Write-Proof Hypothesis

**Claim:** A file write (e.g., `fs.writeFile`) that completes in OpenClaw and is killed before the result is flushed to the `.jsonl` transcript will leave the file written but the execution unrecorded. On restart, OpenClaw will start a new agent turn. If the LLM decides to write the same file again, the write happens twice. OpenClaw has no mechanism to detect that the first write already completed.

**Evidence:**

- File writes execute via `src/node-host/invoke.ts` → `handleInvoke` → `runCommand` (child_process.spawn) or via direct `fs` operations in tool implementations
- `sendInvokeResult` / `sendNodeEvent` deliver results to Gateway with errors **ignored** (`src/node-host/invoke.ts`)
- Tool call IDs use `crypto.randomUUID()` (`src/agents/tools/agent-step.ts`) or `mcp-${Date.now()}` (`src/mcp/plugin-tools-serve.ts`) — neither is persisted before execution, neither survives restart
- The `tool_result_persist` hook transforms results "before they are written to the session transcript" — confirming the transcript is the only persistence target and writing happens after execution, not before

**The critical kill point:**

```
                    ┌─────────────────────────────────────┐
                    │         CRASH WINDOW                │
Tool dispatched     │  File write    Result in   Flush to │  Result in
to node-host   ──→  │  completes     memory      .jsonl   │  next step
                    │  (side effect  (pending    (best-    │
                    │   happened)     buffer)     effort)  │
                    └─────────────────────────────────────┘
                          ↑ SIGKILL anywhere in this window
                          = side effect done, result lost
```

**What Tenure would do differently:**

- Wrap the file write in a Temporal Activity with an idempotency key derived from (tool_call_id, file_path, content_hash)
- Activity executes the write and records the result in Temporal Event History
- If the Worker dies after the Activity completes but before result delivery, replay returns the cached result
- The idempotency key ensures that even if the Activity is re-dispatched, the dedup guard prevents a second write
- Net effect: file written exactly once, result delivered exactly once, deterministic replay

**Proof test shape:**

1. Start a Tenure workflow that executes a file-write Activity
2. Activity writes `test.txt` with content "hello" and records result in Temporal history
3. SIGKILL the Worker after Activity completion but before workflow advances
4. Start a new Worker
5. Temporal replays the workflow; the file-write Activity returns its cached result from history
6. Assert: `test.txt` contains "hello" exactly once; file hash unchanged; workflow continues

---

## Inspected Crash Points

Initial 10 crash points from Session 1, expanded to 21 in Session 2.

| ID | Crash Point | Replay Safe? | Severity |
|----|------------|-------------|----------|
| CP-01 | Mid-LLM inference | N/A (no side effect) | Low |
| CP-02 | Tool decision emitted, execution not started | No | Medium |
| CP-03 | Mid-tool execution (read) | Safe (idempotent) | Low |
| CP-04 | Mid-tool execution (write) | **No — no checkpoint** | Critical |
| CP-05 | Tool complete, result not delivered | **No — duplicate risk** | Critical |
| CP-06 | Result delivered, not flushed to `.jsonl` | No | High |
| CP-07 | Compaction mid-rewrite | Depends | High |
| CP-08 | Cron timer fires, not started | Partial | High |
| CP-09 | Cron job mid-execution | **No — re-executes from scratch** | Critical |
| CP-10 | MCP bridge mid-tool-call | No | High |

Full 21-entry matrix with sub-variants, source evidence, and test cases: `output/crash-recovery-matrix.json`

---

## Blockers

### B-1: `@mariozechner/pi-coding-agent` is an external package

The `SessionManager` class comes from `@mariozechner/pi-coding-agent` (imported in `src/agents/pi-embedded-runner/run/attempt.ts:7`). The tool result buffering, flush logic, and transcript format are defined in this external package. Tenure's adapter must intercept tool calls before they reach this package, not after.

**Impact:** The SER router must sit between the LLM's tool_use decision and the tool.execute() call. It cannot retrofit durability into the existing SessionManager.

### B-2: Compaction is non-deterministic

`compact.ts` imports from `../../gateway/session-compaction-checkpoints.js`. Compaction depends on the model's summarization output, which varies between calls. If compaction runs inside what would become a Temporal workflow, replay would produce a different summary and the workflow would diverge.

**Impact:** Compaction must be treated as a side-effecting Activity, not workflow logic. Its output must be recorded in Temporal history so replay returns the same summary.

---

## Where the Authoritative Checkpoint Must Live

**Statement:** The authoritative checkpoint for every tool execution must live in Temporal Event History, recorded as a completed Activity result.

The checkpoint must contain:

- tool call ID (deterministic, not UUID — derived from workflow state)
- tool name
- serialized parameters
- serialized result
- completion timestamp (from Temporal, not `Date.now()`)
- idempotency key (for side-effecting tools)

This checkpoint must be recorded **before** the result is delivered to the next reasoning step in the workflow. The workflow function must await the Activity result and receive it from Temporal history, not from in-process memory.

OpenClaw's `.jsonl` transcript becomes a secondary log — useful for UI display and debugging, but not the recovery authority.

---

## Session 1 Done Definition

> "I know which OpenClaw state is insufficient, which execution boundary Tenure must own, what minimal checkpoint is required for read replay and no-duplicate file write replay, and I have recorded the persistence gap in `PERSISTENCE-GAP.md`."

**Status: Met.**

- Insufficient state: documented in `PERSISTENCE-GAP.md` with source references
- Execution boundary: the SER router must intercept between LLM tool_use decision and tool.execute()
- Read replay checkpoint: Temporal Activity result in Event History
- Write replay checkpoint: Temporal Activity result with idempotency key
- Non-determinism inventory: 6 entries in `CONTRADICTIONS.md`
- Crash points: 10 entries with severity ratings
- Blockers: 2 identified (external SessionManager package, non-deterministic compaction)
