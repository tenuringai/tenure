# Contradictions

Use this file whenever new research contradicts a current root-doc assumption.

Do not bury contradictions in ad hoc notes, transcripts, or side comments. Record them here so the next researcher cannot miss them.

Template:

```markdown
## [YYYY-MM-DD] [Researcher] [Session]
**Assumption:** [the doctrine assumption]
**Contradiction:** [what was found]
**Evidence:** [source file, issue, paper, or corpus reference]
**Impact:** [which proof step, document, or research output is affected]
**Resolution:** [pending | doctrine updated | assumption holds]
```

---

## [2026-04-12] [Session 1] Non-Determinism Inventory

These are not contradictions to the doctrine — they confirm it. Recorded here because the SOUL mandates: "Every `Math.random()`, every `Date.now()`, every direct HTTP call that is not wrapped in an Activity is a replay bomb. Find them. Document them."

### ND-1: `crypto.randomUUID()` for tool call IDs
**Location:** `src/agents/tools/agent-step.ts` (idempotencyKey), `src/agents/tools/sessions-send-tool.ts` (run IDs), `src/agents/pi-embedded-runner/run.ts` (pendingToolCalls)
**Replay risk:** If these UUIDs are generated inside what would become workflow code, replay would generate different UUIDs and idempotency dedup would fail. Tenure must ensure UUID generation happens inside Activities or is deterministic from workflow state.
**Impact:** Proof 1 (no-duplicate write), SER router design
**Resolution:** Not a contradiction. Confirms the need for the Temporal boundary — UUIDs must be generated inside Activities, not workflow functions.

### ND-2: `Date.now()` pervasive in control flow
**Location:** `src/agents/pi-embedded-runner/run.ts` (durations), `src/agents/pi-embedded-runner/replay-history.ts` (model snapshot timestamp), `src/agents/tools/web-fetch.ts` / `web-shared.ts` (cache TTL), `src/agents/pi-embedded-runner/run/helpers.ts` (compaction diagnostic ID), `src/mcp/plugin-tools-serve.ts` (tool call ID: `mcp-${Date.now()}`)
**Replay risk:** `Date.now()` in workflow-level logic would break Temporal determinism. The `mcp-${Date.now()}` pattern as a tool call ID is especially dangerous — replay at a different time produces a different ID.
**Impact:** All proof ladder steps. Every Temporal workflow function must use `workflow.now()` instead of `Date.now()`.
**Resolution:** Not a contradiction. Confirms the adapter must translate all clock reads to Temporal's deterministic clock.

### ND-3: `randomBytes(5)` for synthetic tool call IDs
**Location:** `src/agents/pi-embedded-runner/run.ts:1772-1778`
**Replay risk:** Same as ND-1. Random bytes in workflow code would produce different IDs on replay.
**Impact:** Proof 1 (no-duplicate write)
**Resolution:** Not a contradiction. Must be generated inside Activities.

### ND-4: Direct `fetch()` in non-Activity context
**Location:** `src/agents/pi-embedded-runner/openrouter-model-capabilities.ts` — `globalThis.fetch` to `https://openrouter.ai/api/v1/models`
**Replay risk:** Network call in what could become workflow code. On replay, would re-fetch and potentially get different results, causing workflow divergence.
**Impact:** Adapter boundary design — must identify all direct network calls and wrap them in Activities.
**Resolution:** Not a contradiction. This is a concrete example of why every call must go through SER.

### ND-5: OpenClaw cron catch-up re-executes from scratch
**Location:** `src/cron/service/timer.ts` — `runMissedJobs` / `planStartupCatchup`, `src/cron/service/ops.ts:107-134`
**Replay risk:** Not a replay risk per se, but a duplication risk. Catch-up creates new job runs without checking whether the interrupted run's side effects completed.
**Impact:** Proof 2 (cron durability). This is the core gap Temporal Schedule solves — catch-up is policy-driven and completion-aware.
**Resolution:** Not a contradiction. Confirms the cron durability proof is targeting the right gap.

### ND-6: Best-effort patterns suppress failures silently
**Locations:**
- `replay-history.ts`: `createProviderReplaySessionState` catches and ignores persistence failures
- `attempt.subscription-cleanup.ts`: empty catch blocks with `/* best-effort */`
- `node-host/invoke.ts`: `sendInvokeResult` / `sendNodeEvent` errors ignored
- `mcp/channel-bridge.ts`: `close().catch(() => undefined)`, `sendNotification` errors suppressed
- `plugins/tools.ts`: factory failures logged and skipped
- `tasks/task-registry.ts`: restore failure warn-only
- `tasks/task-flow-registry.ts`: observer errors swallowed (empty catch)

**Replay risk:** These are not replay bombs directly, but they mask failures that would matter in a durable execution context. A tool that silently fails to persist its result looks like a tool that never executed.
**Impact:** All proof steps. Tenure must treat every tool result as authoritative from Temporal history, not from OpenClaw's best-effort flush.
**Resolution:** Not a contradiction. Confirms the strong boundary: Temporal history is authority, OpenClaw artifacts are secondary logs.
