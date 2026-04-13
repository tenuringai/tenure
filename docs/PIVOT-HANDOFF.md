# Tenure — Pivot Handoff: SKILL.md-to-Temporal Compiler

**Date:** April 13, 2026  
**From:** Product / Strategy  
**To:** Implementing engineer  
**Status:** Active pivot. Old adapter plan is deprecated. This is the new build plan.

---

## What changed and why

The original dev plan centered on Task 2: an OpenClaw adapter that monkey-patches `before_tool_call` inside OpenClaw's tool dispatch path (`src/agents/pi-embedded-subscribe/handlers/tools.ts`). That approach had a critical fragility — it depended on OpenClaw's internal code structure remaining stable. One upstream refactor breaks the entire product.

The new approach: **Tenure is a SKILL.md-to-Temporal compiler.** It reads an agentskills.io-format SKILL.md, classifies each step through the SER router, and compiles the result into a Temporal Workflow. No hook into anyone else's source code. No upstream dependency. The skill is the portable unit, not the agent session.

The product verb is "tenure" — as in "I tenured this skill." It means: the skill was classified, pinned, and committed to durable execution. Before tenure: mutable, inspectable, adjustable. After tenure: pinned, running, guaranteed.

---

## What's already done

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Temporal Foundation | **DONE** | Dev server, SDK connected, hello-world Workflow + Activity verified |
| Task 2: OpenClaw Adapter | **DONE — DEMOTED** | Working but no longer on the critical path. Keep under `src/adapter/openclaw/`. It becomes an optional integration later. |
| Task 2.5: Standalone Proof | **DONE — PROMOTED** | `npx tenure demo --standalone` passes. This is now the primary proof mode, not a fallback. |
| Task 3: SER Router | **DONE** | 120/120 tests passing. Interface is clean and decoupled: |

```typescript
classify(toolName: string, params: Record<string, unknown>): ClassifyResult
```

The router takes a tool name and params, returns an ExecutionConfig with type, retry policy, timeout, idempotency key, compensation, HITL requirements, and cache settings. It does not know or care where the call came from. This is the core of the pipeline and it needs zero changes.

---

## The three-stage compiler pipeline

This is the product architecture. Every command flows through these stages.

### Stage 1 — Ingest

Input: anything — a raw prompt, a cron config, a bash script, an existing SKILL.md.

If the input is already a SKILL.md, skip to Stage 2. If not, use Anthropic's skill-creator (an LLM call) to convert it into a well-structured SKILL.md with proper frontmatter, step-by-step instructions, and tool declarations.

**This stage is deferred to post-launch.** The `tenure create` command lives here. For launch, we require an existing SKILL.md as input.

### Stage 2 — Classify

The SKILL.md parser reads the file, extracts the step structure, and calls the SER router for each step:

- Tool call steps → `classify(toolName, params)` → ExecutionConfig
- Reasoning gaps between steps → classified as `thinking` Activities with model tier and token budget
- The `execution:` block in frontmatter provides author overrides; taxonomy provides defaults for everything else

Output: a `SkillPlan` — an ordered list of classified steps ready for compilation.

### Stage 3 — Compile

The Temporal compiler takes the SkillPlan and generates:

- Each tool step → a Temporal Activity with the ExecutionConfig (retry policy, timeout, idempotency key, etc.)
- Each thinking step → a Temporal Activity that calls an LLM
- The full sequence → a Temporal Workflow
- If `--cron` flag present → a Temporal Schedule wrapping the Workflow

Output: a running, durable execution on the Temporal timeline.

---

## New tasks to build

### Task 4A: SKILL.md Parser (1-2 days) — NEW BOTTLENECK

**This is the critical path item. Everything else is blocked on or parallel to this.**

**Input:** Path to a SKILL.md file  
**Output:** A `SkillPlan` data structure

```typescript
// src/parser/types.ts

interface SkillStep {
  id: string;
  type: 'tool_call' | 'thinking';
  // For tool_call:
  toolName?: string;
  params?: Record<string, unknown>;
  // For thinking:
  prompt?: string;
  modelTier?: 'frontier' | 'mid' | 'cheap';
  tokenBudget?: number;
  // From SER classification:
  executionConfig?: ExecutionConfig;
}

interface SkillPlan {
  name: string;
  description: string;
  steps: SkillStep[];
  execution?: ExecutionBlock;    // from frontmatter if present
  version: string;               // hash of the SKILL.md content at parse time
}
```

**What the parser does:**

1. Read the SKILL.md file
2. Extract YAML frontmatter (name, description, allowed-tools, and `execution:` block if present)
3. Walk the markdown body and identify the step structure:
   - Lines that reference tool names from the `allowed-tools` list or match known tool patterns → `tool_call` steps
   - Workflow instructions that require reasoning, decision-making, or interpretation → `thinking` steps
   - Sequential ordering preserved from the document structure
4. For each `tool_call` step, call `classify(toolName, params)` to get the ExecutionConfig
5. For each `thinking` step, assign model tier and token budget from the `execution:` block defaults or taxonomy defaults
6. Return the SkillPlan

**Key design decisions:**

- The parser is deterministic for a given SKILL.md. Same file always produces the same SkillPlan. This is critical for Temporal replay correctness.
- If a tool is not in the taxonomy and has no `execution:` metadata, the router already handles this — it returns `side_effect_mutation` with conservative defaults (1 retry, no auto-retry). No changes needed.
- The `version` field is a content hash. This is the pin mechanism. When the user "tenures" a skill, the SkillPlan is frozen at this hash. Temporal Workflows reference this version.

**Test expectations:**

- Parse the sample skills in `test/fixtures/sample-skills/`
- Verify step extraction from at least 5 SKILL.md files with varying complexity
- Verify the SER router is called correctly for each tool step
- Verify that re-parsing the same file produces an identical SkillPlan (determinism)

**File location:** `src/parser/`

```
src/parser/
├── index.ts            # Entry: parse(skillPath) → SkillPlan
├── frontmatter.ts      # Extract YAML frontmatter
├── steps.ts            # Walk markdown body, extract step structure
├── types.ts            # SkillStep, SkillPlan interfaces
└── version.ts          # Content hash for pinning
```

---

### Task 4B: Temporal Compiler (1 day)

**Depends on:** Task 4A  
**Input:** A classified SkillPlan  
**Output:** A Temporal Workflow definition that executes the skill

```typescript
// src/compiler/index.ts
// Entry: compile(plan: SkillPlan, options?: CompileOptions) → WorkflowHandle

interface CompileOptions {
  cron?: string;           // Cron expression for scheduled execution
  budget?: {
    maxTokens?: number;
    maxDollars?: number;
  };
}
```

**What the compiler does:**

1. Take the SkillPlan's steps array
2. For each `tool_call` step:
   - Create a Temporal Activity dispatch with the step's ExecutionConfig
   - Apply retry policy, timeout, idempotency key from the config
   - Wire compensation handler if the config declares one
3. For each `thinking` step:
   - Create a Temporal Activity that calls the configured LLM provider
   - The Activity receives the thinking prompt plus the results of previous steps as context
   - Apply model tier selection, token budget, and timeout
4. Wire steps into a sequential Temporal Workflow (Phase 1 is sequential only — branching/parallel is Phase 2)
5. If `cron` option is present:
   - Create a Temporal Schedule with the specified interval
   - Set `catchupWindow: '10m'` and `overlap: 'SKIP'`
   - The Schedule triggers the compiled Workflow
6. Start the Workflow or Schedule and return the handle

**Important constraints:**

- The Workflow definition must be deterministic. All non-deterministic work (LLM calls, tool executions) happens inside Activities, never in Workflow code directly.
- The SkillPlan version hash is embedded in the Workflow metadata. This is how we track which pinned version of the skill is running.
- Budget enforcement hooks into the existing `src/budget/` code — check before each Activity dispatch.

**File location:** `src/compiler/`

```
src/compiler/
├── index.ts                # Entry: compile(plan, options) → WorkflowHandle
├── workflow-builder.ts     # Generates the Workflow function from steps
├── activity-dispatch.ts    # Maps ExecutionConfig → Activity options
└── schedule-builder.ts     # Wraps Workflow in Temporal Schedule for cron
```

---

### Task 8 (revised): CLI Packaging (half day)

The CLI surface changes to reflect the new product:

```typescript
// src/cli/index.ts
const command = process.argv[2];
switch (command) {
  case 'run':      return run(process.argv.slice(3));      // parse + compile + execute
  case 'scan':     return scan(process.argv.slice(3));     // classify existing skills
  case 'certify':  return certify(process.argv.slice(3));  // prove guarantees
  case 'create':   return create(process.argv.slice(3));   // LLM ingest (POST-LAUNCH)
  default:         return printHelp();
}
```

**The `run` command flow:**

```
npx tenure run ./my-skill/SKILL.md
npx tenure run --cron "*/5 * * * *" ./my-skill/SKILL.md
```

1. Call parser: `parse('./my-skill/SKILL.md')` → SkillPlan
2. Call compiler: `compile(plan, { cron })` → WorkflowHandle
3. Output: Workflow ID, Schedule ID if cron, link to Temporal Web UI

**The `scan` command is unchanged** from the old plan. It classifies skills and outputs the table. No compilation, no execution.

**The `certify` command is reframed:**

```
npx tenure certify --demo cron      # the 6-line cron proof
npx tenure certify --ci             # crash-recovery + no-duplicate tests
```

The demo now runs a SKILL.md on a Temporal Schedule (not an OpenClaw session). Same proof, cleaner setup.

---

## Revised build order

```
DONE:
  ✓ Task 1: Temporal setup
  ✓ Task 2: OpenClaw adapter (demoted, keep in src/adapter/openclaw/)
  ✓ Task 2.5: Standalone proof (promoted to primary)
  ✓ Task 3: SER router (120/120 tests)

NOW (parallel):
  ▶ Task 4A: SKILL.md parser           (1-2 days) ← CRITICAL PATH
  ▶ Task 7:  Scanner (minor reframe)   (1 day)
  ▶ Task 8:  CLI packaging (new cmds)  (half day)

THEN (depends on 4A):
  ▶ Task 4B: Temporal compiler          (1 day)

THEN (depends on 4A + 4B):
  ▶ Task 5: Cron demo + crash recovery  (1 day, uses SKILL.md not OpenClaw)
  ▶ Task 6: No-duplicate test           (1 day, unchanged)

DEFERRED:
  Task 4C: tenure create (LLM ingest)  (post-launch)

THEN:
  ═══════════════════
  SHIP. COMMENT. DONE.
  ═══════════════════
```

**Estimated calendar time from now: 4-5 days.**

---

## The demo skill for certification

The cron demo needs a SKILL.md to run against. Create this as `test/fixtures/cron-log-skill/SKILL.md`:

```yaml
---
name: cron-log-writer
description: Appends a timestamped line to log.txt. Used for cron durability certification.
allowed-tools:
  - write
execution:
  type: side_effect_mutation
  retry: 3
  idempotency:
    key: "timestamp+sequence"
---
# Cron log writer

## Workflow

1. Read the current sequence number from log.txt (or start at 1 if the file doesn't exist)
2. Generate a timestamped line: `{sequence} | {ISO timestamp} | OK`
3. Append the line to log.txt
4. Increment the sequence number
```

This is the skill that `npx tenure certify --demo cron` runs. The proof sequence:

1. `tenure run --cron "*/60 * * * * *" ./test/fixtures/cron-log-skill/SKILL.md`
2. Let it run 3 cycles (3 lines written)
3. SIGKILL the Worker
4. Wait 120 seconds (2 missed cycles)
5. Start a new Worker
6. Temporal Schedule catches up
7. Verify: log.txt has correct lines, sequential numbers, 0 gaps, 0 dupes

---

## What the Issue #10164 comment says

Old framing: "Tenure wraps your OpenClaw agent transparently."

New framing:

> Your cron job crashes because it runs inside the agent process. Process dies, cron dies, state is lost.
>
> `tenure run --cron` runs your skill on Temporal instead. Here's a skill that appends a timestamped line every 60 seconds:
>
> [show SKILL.md]
>
> Here's what happens when the Worker is killed and restarted:
>
> [show 6-line proof — sequential timestamps, gap during downtime, catch-up after restart, zero duplicates]
>
> Every tool call is classified by execution type. Reads are cached and retry-safe. Mutations get idempotency keys. Critical transactions require approval. The skill author controls the contract through the `execution:` block in SKILL.md frontmatter.
>
> Point it at any agentskills.io-compatible SKILL.md. MIT licensed.
>
> `npx tenure run --cron "*/60 * * * * *" ./your-skill/SKILL.md`

---

## Files to create / modify

### New files:
```
src/parser/index.ts
src/parser/frontmatter.ts
src/parser/steps.ts
src/parser/types.ts
src/parser/version.ts
src/compiler/index.ts
src/compiler/workflow-builder.ts
src/compiler/activity-dispatch.ts
src/compiler/schedule-builder.ts
test/fixtures/cron-log-skill/SKILL.md
test/parser.test.ts
test/compiler.test.ts
```

### Modified files:
```
src/cli/index.ts                    # New command surface (run, scan, certify, create)
src/certify/cron-durability.test.ts # Reframe: uses SKILL.md, not OpenClaw session
src/certify/demo/cron-demo.ts       # Reframe: parse + compile + schedule
package.json                        # bin entry, any new deps
```

### Unchanged files:
```
src/router/*                        # 120/120 tests, decoupled, no changes needed
src/temporal/*                      # Worker, client, workflows, activities — all reusable
src/budget/*                        # Tracker, enforcer, circuit-breaker — called from compiler
src/scanner/*                       # Reframed but minimal code changes
src/certify/crash-recovery.test.ts  # Same proof, different trigger
src/certify/no-duplicate.test.ts    # Same proof, different trigger
```

### Demoted (keep, don't delete):
```
src/adapter/openclaw/*              # Working code, future optional integration
```

---

## Definition of done — revised ship checklist

- [ ] `npx tenure run ./test/fixtures/cron-log-skill/SKILL.md` parses, classifies, compiles, and executes
- [ ] `npx tenure run --cron "*/60 * * * * *" ./test/fixtures/cron-log-skill/SKILL.md` creates a Temporal Schedule
- [ ] `npx tenure certify --demo cron` produces the 6-line proof, passing
- [ ] `npx tenure certify --ci` passes crash-recovery and no-duplicate tests
- [ ] `npx tenure scan ./skills` classifies sample skills correctly
- [ ] Parser produces identical SkillPlan for identical SKILL.md input (determinism verified)
- [ ] SkillPlan version hash is embedded in Workflow metadata
- [ ] npm package published as `tenure@0.1.0`
- [ ] README (v0.5) is updated with new framing and cron proof
- [ ] TAXONOMY.md has 30 classified skills
- [ ] MIT LICENSE file present
- [ ] Repo is public

**Not required for launch:**
- [ ] `tenure create` command (LLM-powered ingest — post-launch)
- [ ] Parallel/branching step execution (Phase 2)
- [ ] `execution:` block upstream PR campaign (Phase 2)
- [ ] Badge hosting at tenur.ing (Phase 3)
- [ ] Thinking-time billing enforcement (Phase 3)
- [ ] Marketplace (Phase 4)
- [ ] HolaOS harness integration (Phase 2/3 — design for it, don't build it yet)
