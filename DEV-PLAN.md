# Tenure — Dev Plan & Project Structure
### Engineering Blueprint for Side Door Launch
### Target: Issue #10164 comment with working proof

---

## Project Structure

```
tenure/
├── README.md                          # v0.5 (OpenClaw deep-dive, cron proof)
├── TAXONOMY.md                        # 30 skills classified, 6 execution types
├── CONTRIBUTING.md                    # How to add skills, submit PRs
├── SOUL.md                            # Researcher soul doc
├── CLAUDE.md                          # Claude Code orientation
├── .cursorrules                       # Cursor IDE context
├── PERSISTENCE-GAP.md                 # Why OpenClaw's persistence is insufficient
├── CONTRADICTIONS.md                  # Doctrine contradiction log
├── LICENSE                            # MIT
├── package.json                       # npm: "tenure"
├── tsconfig.json
│
├── src/
│   ├── cli/                           # CLI entry points
│   │   ├── index.ts                   # Main CLI router (connect | certify | scan | extend)
│   │   ├── connect.ts                 # `tenure connect openclaw`
│   │   ├── certify.ts                 # `tenure certify [--demo cron] [--ci]`
│   │   ├── scan.ts                    # `tenure scan ./skills`
│   │   └── extend.ts                  # `tenure extend ./skill/SKILL.md` (Phase 2)
│   │
│   ├── adapter/                       # OpenClaw adapter (Task 2 — the bottleneck)
│   │   ├── index.ts                   # Entry: patches OpenClaw's before_tool_call hook
│   │   ├── hook.ts                    # The before_tool_call interceptor
│   │   ├── session.ts                 # Maps OpenClaw session → Temporal Workflow ID
│   │   ├── skill-activation.ts        # Detects SKILL.md reads, opens Workflow per skill
│   │   └── state.ts                   # Captures OpenClaw state for Activity inputs
│   │
│   ├── router/                        # Semantic Execution Router (Task 3)
│   │   ├── index.ts                   # Entry: classify(toolName, params) → ExecutionConfig
│   │   ├── taxonomy.ts                # Loads TAXONOMY.md as JSON lookup
│   │   ├── classify.ts                # Static classification + conditional overrides
│   │   ├── types.ts                   # ExecutionType enum, ExecutionConfig interface
│   │   └── instrument.ts              # OTEL span emission with tenure.* attributes
│   │
│   ├── temporal/                      # Temporal primitives (Tasks 1, 4)
│   │   ├── worker.ts                  # Worker setup with task queue and activities
│   │   ├── client.ts                  # Client for starting workflows and signals
│   │   ├── workflows/
│   │   │   ├── agent-session.ts       # Main workflow: one OpenClaw session = one workflow
│   │   │   ├── tool-execution.ts      # Activity dispatch based on ExecutionConfig
│   │   │   └── cron-trigger.ts        # Cron-triggered workflow (Temporal Schedule target)
│   │   ├── activities/
│   │   │   ├── execute-tool.ts        # Wraps the actual tool call execution
│   │   │   ├── execute-with-idempotency.ts  # Side-effect mutations with dedup
│   │   │   ├── execute-with-saga.ts   # Critical transactions with compensation
│   │   │   └── heartbeat-session.ts   # Stateful sessions with heartbeat monitoring
│   │   └── schedules/
│   │       └── cron-schedule.ts       # Creates/manages Temporal Schedules for cron
│   │
│   ├── budget/                        # Budget enforcement (Task 6 adjacent)
│   │   ├── tracker.ts                 # Cumulative token counter per workflow
│   │   ├── enforcer.ts               # Check before each Activity dispatch, pause at cap
│   │   └── circuit-breaker.ts         # Count consecutive identical calls, break at threshold
│   │
│   ├── scanner/                       # Skill scanner (Task 7)
│   │   ├── index.ts                   # Entry: scan(directory) → ClassificationReport
│   │   ├── parse-skill.ts            # Read SKILL.md, extract YAML frontmatter
│   │   ├── classify-skill.ts         # Match against taxonomy, flag unknowns
│   │   └── report.ts                 # Format and output classification table
│   │
│   └── certify/                       # Certification suite (Tasks 5, 6)
│       ├── index.ts                   # Entry: certify(skillPath, options) → CertReport
│       ├── crash-recovery.test.ts     # SIGKILL → resume → verify continuity
│       ├── no-duplicate.test.ts       # 100 mutations → verify exactly 100 results
│       ├── cron-durability.test.ts    # 3 cycles → kill → 2 missed → restart → catch-up
│       ├── budget-compliance.test.ts  # Run to 100% → verify pause (Phase 2)
│       ├── hitl-compliance.test.ts    # Critical → verify approval gate (Phase 2)
│       ├── taxonomy-coverage.test.ts  # All skills classified → 0 unknowns (Phase 2)
│       └── demo/
│           └── cron-demo.ts           # The canonical cron demo for README and Issue comment
│
├── taxonomy/                          # Taxonomy data (consumed by router)
│   └── skills.json                    # TAXONOMY.md compiled to JSON for fast lookup
│
├── docs/
│   ├── research/
│   │   ├── RESEARCH-SETUP.md
│   │   ├── RESEARCH-BRIEF.md
│   │   ├── SESSION-1-FINDINGS.md
│   │   ├── SESSION-3-CRON-DURABILITY.md
│   │   └── RESEARCH-CORPUS.md
│   ├── reference/
│   │   ├── execution-block-schema.md  # The 63-field god block reference
│   │   └── examples-execution-blocks.md
│   ├── architecture/
│   │   ├── observability.md
│   │   └── repair-patterns.md         # Rasa-inspired, Phase 3
│   └── openclaw-deep-dive.md          # The v0.5 narrative for Issue #10164 audience
│
├── output/                            # Research artifacts
│   ├── crash-recovery-matrix.json
│   ├── skill-durability-mapping.json
│   └── community-evidence-validation.json
│
├── assets/
│   └── tenure-hero.svg
│
└── test/                              # Integration tests beyond certifications
    ├── adapter.test.ts                # Does the hook intercept correctly?
    ├── router.test.ts                 # Does classification match taxonomy?
    ├── replay.test.ts                 # Does Temporal replay produce identical results?
    └── fixtures/
        ├── mock-openclaw-session/     # Minimal OpenClaw session for testing
        └── sample-skills/             # SKILL.md files for scanner tests
```

---

## Build Order — Critical Path

```
                    Task 1: Temporal setup
                         │ (1 hour)
                         ▼
                    Task 2: OpenClaw adapter ◄── BOTTLENECK
                         │ (2-3 days)
                         │
          ┌──────────────┼──────────────┬───────────────┐
          ▼              ▼              ▼               ▼
     Task 3:        Task 4:        Task 7:         Task 8:
     SER router     Cron replace   Scanner         CLI packaging
     (1 day)        (1 day)        (1 day)         (half day)
          │              │
          └──────┬───────┘
                 ▼
            Task 5: Cron demo + crash recovery test
                 │ (1 day)
                 ▼
            Task 6: No-duplicate test
                 │ (1 day)
                 ▼
            ═══════════════════
            SHIP. COMMENT. DONE.
            ═══════════════════
```

Tasks 3, 4, 7, 8 run in parallel after Task 2 completes.
Tasks 5 and 6 are sequential because they depend on both the adapter and the router.
Total calendar time with 10 agents: 5–6 days.

---

## Task Specifications

### Task 1: Temporal Local Setup (1 hour)

**Owner:** Any agent
**Input:** None
**Output:** Running Temporal dev server, TypeScript SDK connected

```bash
# Install Temporal CLI
curl -sSf https://temporal.download/cli.sh | sh

# Start dev server
temporal server start-dev

# Verify connection
npx ts-node src/temporal/client.ts  # should connect to localhost:7233
```

**Done when:** A hello-world Workflow executes, a hello-world Activity returns a value, replay after Worker restart returns the cached value.

---

### Task 2: OpenClaw Adapter (2–3 days) — BOTTLENECK

**Owner:** Best agent, your direct supervision
**Input:** OpenClaw source (src/agents/pi-embedded-subscribe/handlers/tools.ts)
**Output:** A working before_tool_call hook that routes every tool call through the SER router

**The three sub-tasks:**

**2a: Hook installation.** Find the tool dispatch path in OpenClaw. This is the function that receives a tool call from the LLM and dispatches it for execution. Insert a `before_tool_call` hook that intercepts the call before dispatch. The hook receives the tool name, parameters, and session context. It must be non-breaking — if the hook throws, the original dispatch path executes unchanged.

**2b: Session-to-Workflow mapping.** Each OpenClaw session maps to one Temporal Workflow. When a session starts (or when the first tool call is intercepted), start a Workflow. The Workflow ID is derived from the OpenClaw session ID for deterministic mapping. Subsequent tool calls in the same session route to the same Workflow as Activities.

**2c: Activity wrapping.** The hook takes the intercepted tool call, consults the SER router for execution type, and dispatches the call as a Temporal Activity with the appropriate configuration (retry policy, timeout, idempotency key). The Activity executes the original tool call function and returns the result. The hook returns the Activity result to OpenClaw as if the tool call happened normally.

**Key risk:** OpenClaw's tool dispatch may not have a clean interception point. The research identified `src/agents/pi-embedded-subscribe/handlers/tools.ts` as the likely location but the exact hook mechanism depends on the code structure. If no clean hook exists, the adapter may need to monkey-patch the dispatch function.

**Done when:** An OpenClaw agent runs with the adapter. Every tool call appears in Temporal's Web UI as an Activity. The agent's behavior is identical to without the adapter.

---

### Task 3: SER Router with Static Taxonomy (1 day)

**Owner:** Any agent, parallelizable
**Input:** TAXONOMY.md (30 skills), types.ts (execution type definitions)
**Output:** classify(toolName, params) → ExecutionConfig

```typescript
// src/router/types.ts
type ExecutionType =
  | 'idempotent_read'
  | 'side_effect_mutation'
  | 'stateful_session'
  | 'critical_transaction'
  | 'long_running_process'
  | 'human_interactive';

interface ExecutionConfig {
  type: ExecutionType;
  retryPolicy: RetryPolicy;
  timeout: Duration;
  idempotencyKey?: string;
  compensation?: string;
  hitl: 'required' | 'recommended' | 'optional' | 'none';
  cache: boolean;
  cacheTtl?: number;
}
```

**Conditional overrides:** The router checks tool name AND parameters. `git status` → idempotent_read. `git push --force main` → critical_transaction. The conditionals are hardcoded switch cases for Phase 1 — not a rules engine.

**Unknown tools:** If a tool is not in the taxonomy and has no `tenure.*` metadata, the router returns a default classification of `side_effect_mutation` with conservative retry (1 attempt, no auto-retry). This is the safest default — it won't cache (might be a write) and won't retry aggressively (might duplicate).

**Done when:** Unit tests verify all 30 taxonomy entries classify correctly. Conditional overrides for git, postgres, slack, and terraform work. Unknown tools get the safe default.

---

### Task 4: Cron Replacement (1 day)

**Owner:** Any agent, parallelizable
**Input:** OpenClaw's cron configuration format
**Output:** Temporal Schedule that replaces in-process setTimeout

**The adapter does not modify OpenClaw's cron config format.** It reads the same `cron:` block from the agent config and creates a Temporal Schedule with the equivalent interval. The Schedule triggers a Workflow execution that sends the cron message to the agent session.

```typescript
// src/temporal/schedules/cron-schedule.ts
const schedule = await client.schedule.create({
  scheduleId: `cron-${agentId}-${taskId}`,
  spec: { intervals: [{ every: parseCronInterval(config.cron) }] },
  action: {
    type: 'startWorkflow',
    workflowType: cronTriggerWorkflow,
    args: [{ agentId, message: config.message }],
    taskQueue: TASK_QUEUE,
  },
  policies: {
    catchupWindow: '10m',  // catch up missed triggers within 10 min
    overlap: 'SKIP',        // don't stack if previous run still going
  },
});
```

**Done when:** A cron configured in OpenClaw fires via Temporal Schedule instead of setTimeout. Killing the Worker and restarting results in missed triggers catching up.

---

### Task 5: Cron Demo + Crash Recovery Test (1 day)

**Owner:** Depends on Tasks 2 + 4
**Input:** Working adapter + working cron Schedule
**Output:** The canonical 6-line proof

```typescript
// src/certify/demo/cron-demo.ts
// 1. Configure agent: every 60s, append timestamped line to log.txt
// 2. Run 3 cycles (3 lines written)
// 3. SIGKILL the Worker process (process.kill(worker.pid, 'SIGKILL'))
// 4. Wait 120 seconds (2 missed cycles)
// 5. Start a new Worker
// 6. Verify: log.txt has 6 lines, sequential numbers, 0 gaps, 0 dupes
// 7. Verify: SHA-256 of log.txt matches expected
```

**This is the screenshot that goes in the Issue comment.** The output must be clean, deterministic, and copy-pasteable.

**Done when:** `npx tenure certify --demo cron` produces the 6-line proof with passing verification.

---

### Task 6: No-Duplicate Test (1 day)

**Owner:** Depends on Tasks 2 + 3
**Input:** Working adapter + working router
**Output:** 100-mutation certification test

```typescript
// src/certify/no-duplicate.test.ts
// 1. Configure 100 sequential file write Activities
// 2. Each writes a unique file: write-001.txt through write-100.txt
// 3. At random point (e.g., write 47), SIGKILL the Worker
// 4. Start new Worker, replay resumes
// 5. Verify: exactly 100 files exist, each with correct content
// 6. Verify: write-047.txt exists exactly once (not duplicated on replay)
// 7. Verify: no files beyond write-100.txt exist
```

**Done when:** `npx tenure certify --ci` runs crash-recovery and no-duplicate tests, both pass.

---

### Task 7: Scanner (1 day)

**Owner:** Any agent, parallelizable
**Input:** TAXONOMY.md compiled as JSON, target skills directory
**Output:** Classification table

```bash
$ npx tenure scan ./skills

  Skill                  Type                    Metadata    Status
  ─────────────────────────────────────────────────────────────────
  exa-search             idempotent_read         ✓ tenure.*  tenured
  file-writer            side_effect_mutation     ✓ tenure.*  tenured
  stripe-payments        critical_transaction    ✓ tenure.*  tenured
  playwright-browser     stateful_session        ✗ default   classified
  custom-tool            unknown                 ✗ none      unclassified

  5 skills scanned · 3 tenured · 1 classified · 1 unclassified
```

**The scanner does four things:**
1. Recursively find all SKILL.md files in the directory
2. Parse YAML frontmatter, extract `tenure.*` metadata if present
3. If metadata exists, validate against schema
4. If no metadata, look up skill name in taxonomy JSON
5. Output the table

**Done when:** `npx tenure scan ./test/fixtures/sample-skills` produces a correct classification table for 5 sample skills with mixed metadata/taxonomy/unknown states.

---

### Task 8: CLI Packaging (half day)

**Owner:** Any agent, parallelizable
**Input:** All commands working individually
**Output:** `npx tenure <command>` works from npm

```json
// package.json
{
  "name": "tenure",
  "version": "0.1.0",
  "bin": {
    "tenure": "./dist/cli/index.js"
  },
  "files": ["dist/", "taxonomy/"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

```typescript
// src/cli/index.ts
const command = process.argv[2];
switch (command) {
  case 'connect': return connect(process.argv.slice(3));
  case 'certify': return certify(process.argv.slice(3));
  case 'scan':    return scan(process.argv.slice(3));
  case 'extend':  return extend(process.argv.slice(3));  // Phase 2
  default:        return printHelp();
}
```

**Done when:** `npm publish` succeeds. `npx tenure connect openclaw`, `npx tenure certify --demo cron`, and `npx tenure scan ./skills` all work from a fresh install.

---

## Definition of Done — Side Door Launch

All of these must be true before you post the Issue #10164 comment:

- [ ] `npx tenure connect openclaw` installs the hook on a real OpenClaw instance
- [ ] Agent runs identically with adapter — no behavior change
- [ ] Every tool call appears as a Temporal Activity in the Temporal Web UI
- [ ] `npx tenure certify --demo cron` produces the 6-line proof, passing
- [ ] `npx tenure certify --ci` passes crash-recovery and no-duplicate
- [ ] `npx tenure scan ./skills` classifies sample skills correctly
- [ ] npm package published as `tenure@0.1.0`
- [ ] README (v0.5) is in the repo with cron proof, issue citations, research links
- [ ] TAXONOMY.md has 30 classified skills
- [ ] MIT LICENSE file present
- [ ] Repo is public at github.com/tenured/tenure

**Not required for side door:**
- [ ] `tenure extend` (Phase 2)
- [ ] Badge hosting at tenur.ing (Phase 3)
- [ ] Thinking-time billing enforcement (Phase 3)
- [ ] Marketplace (Phase 4)
- [ ] Laminar/Braintrust/Phoenix integration (Phase 3)
- [ ] Full 6-certification suite (4 of 6 can be "pending")

---