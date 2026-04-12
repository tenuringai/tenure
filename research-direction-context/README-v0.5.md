<p align="center">
  <img src="./assets/tenure-hero.svg" alt="tenure" width="600" />
</p>

<h1 align="center">tenure</h1>

<p align="center">
  <strong>Durable execution for OpenClaw. Your agent crashes at 3am. Ours doesn't.</strong>
</p>

<p align="center">
  <a href="https://tenur.ing">Website</a> · <a href="https://tenur.ing/docs">Docs</a> · <a href="https://discord.gg/tenured">Discord</a> · <a href="https://x.com/tenuring">X</a> · <a href="./TAXONOMY.md">Taxonomy</a> · <a href="./docs/research/semantic-execution-routing.md">Research</a>
</p>

<p align="center">
  <img src="https://tenur.ing/badge/crash-recovery/passing" alt="crash-recovery" />
  <img src="https://tenur.ing/badge/no-duplicate/passing" alt="no-duplicate" />
  <img src="https://tenur.ing/badge/budget-compliance/passing" alt="budget-compliance" />
  <img src="https://img.shields.io/badge/OpenClaw_Issue-%2310164-blue" alt="Issue #10164" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/npm/v/tenure" alt="npm version" />
</p>

---

## The Problem

OpenClaw's cron scheduler runs as an in-process daemon. The agent runtime runs as a single embedded process. When it dies, the task is gone — no replay, no retry, no resume. [Issue #10164](https://github.com/openclaw/openclaw/issues/10164) has been open since February 2026 requesting Temporal-backed durable execution. No core maintainer has responded.

Meanwhile, the community builds the same five workarounds every time ([source: r/openclaw](https://reddit.com/r/openclaw)):

> *"a few things that made this manageable for me: 1. set a hard timeout on every cron job. 2. aggressive session pruning. 3. pin compaction to a cheap model. 4. cron messages should be one-liners. 5. model routing matters more than anything else. the fear goes away once you have hard limits in place."*

`tenure` ships all five as framework primitives. One command, zero custom code.

---

## Quickstart

```bash
npx tenure connect openclaw    # detects openclaw.json, injects durable execution backend
npx tenure spawn my-agent      # starts agent in probationary mode
npx tenure dashboard           # local UI at localhost:4747
```

<p align="center">
  <img src="./assets/tenure-connect.gif" alt="tenure connect openclaw" width="600" />
</p>

One line changes in your `openclaw.json`. All existing skills, agents, and memory configurations remain untouched.

```json
{
  "execution": {
    "backend": "tenure",
    "tenure": {
      "taskQueue": "my-agents",
      "shift": "mon-fri/9-17/EST",
      "budget": "500000"
    }
  }
}
```

---

## What Changes For You

Nothing about how you write agents. Everything about how they run.

| What you do today | What tenure does instead |
|---|---|
| `timeoutSeconds: 480` to kill stuck loops | Auto-pause at thinking-time budget. Circuit breaker after 3 identical tool calls. |
| `pruneAfter: 6h, maxEntries: 5` to cap context | `continueAsNew` at shift boundaries. Event history resets. Context persists through Mem0. |
| `summaryModel: "haiku"` to reduce compaction cost | SER routes summarization to cheapest capable model automatically. |
| Minimal cron messages to avoid reprocessing | Shift scheduler replaces cron entirely. No reprocessed prompts. |
| Manual model cascade for cost control | Execution routing table — frontier model for complex work, cheap model for ambient tasks. |

<p align="center">
  <img src="./assets/before-after.gif" alt="Before: crash and duplicate. After: crash and resume." width="600" />
</p>

---

## Why Tool Calls Need Different Execution Guarantees

This is the core insight that no agent framework has shipped. Our research across the OpenClaw, Claude Code, and Cline ecosystems found that tool calls fail between 3% and 15% of the time in production. At 95% per-step accuracy, a 10-step agent succeeds only 60% end-to-end. The compounding math makes uniform retry policies catastrophic — retrying a web search is free, retrying a Stripe charge is a lawsuit.

The full analysis is published in [`docs/research/semantic-execution-routing.md`](./docs/research/semantic-execution-routing.md). The key finding: **no SKILL.md specification includes execution semantics, retry policies, or read/write classification**. Skills describe what a tool can do. They say nothing about how it should be executed safely.

`tenure` adds that missing layer.

### The Execution Routing Table

Every OpenClaw skill is classified by what it actually does when it runs. The classification determines which durable execution primitive wraps the call, what retry policy applies, and whether compensation actions exist.

| Skill | Execution Type | Primitive | Retry | Compensation | Source |
|-------|---------------|-----------|-------|-------------|--------|
| Web Search (Exa, Tavily) | Idempotent Read | Cached activity | 5x, 1s backoff | None | [taxonomy:L12](./TAXONOMY.md#L12) |
| File Read / Grep / Glob | Idempotent Read | Cached activity | 5x | None | [taxonomy:L3-10](./TAXONOMY.md#L3) |
| File Write / Edit | Side-Effect Mutation | Keyed activity | 3x, exponential | Reverse write | [taxonomy:L4-5](./TAXONOMY.md#L4) |
| Git Commit / Push | Side-Effect Mutation | Keyed activity | 3x | `git revert` | [taxonomy:L11](./TAXONOMY.md#L11) |
| Shell / Bash | Side-Effect, Non-Idempotent | Activity, logged | 2x | None (logged) | [taxonomy:L2](./TAXONOMY.md#L2) |
| Slack / Email Send | Side-Effect Mutation | Dedup-guarded activity | 3x | None | [taxonomy:L25](./TAXONOMY.md#L25) |
| PostgreSQL / MySQL | Mixed Read/Write | Activity, keyed on write | 3x reads, 1x writes | Rollback transaction | [taxonomy:L12-14](./TAXONOMY.md#L12) |
| Playwright / Puppeteer | Stateful Session | Child workflow, heartbeat 30s | 2x, session restore | Session cleanup | [taxonomy:L13](./TAXONOMY.md#L13) |
| Stripe Payments | Critical Transaction | Saga, exactly-once | 1x + HITL | Refund via compensation | [taxonomy:L30](./TAXONOMY.md#L30) |
| Terraform Apply | Critical Transaction | Saga, compensation chain | 1x | `terraform destroy` | [taxonomy:L42](./TAXONOMY.md#L42) |
| Kubernetes Deploy | Critical Transaction | Saga, exactly-once | 1x + HITL | Rollback deployment | [taxonomy:L19](./TAXONOMY.md#L19) |
| Subagent Spawn | Long-Running Process | Child workflow | Inherited | Cancel + cleanup | [taxonomy:L28](./TAXONOMY.md#L28) |
| Human Approval | Human-Interactive | Signal / waitForEvent | None | Timeout fallback | [taxonomy:N/A](./TAXONOMY.md) |

Every entry links to its source line in [`TAXONOMY.md`](./TAXONOMY.md), which contains the full classification for all 50 top skills with research citations. The taxonomy is MIT-licensed and accepts community contributions — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

### Research Basis

The taxonomy is grounded in a cross-ecosystem analysis of tool execution patterns. Key findings cited in the source code:

| Finding | Implication | Cited In |
|---------|------------|----------|
| Tool calls fail 3–15% in production | Uniform retry is insufficient; idempotent reads and critical writes need different policies | [`src/router/classify.ts:L8`](./src/router/classify.ts#L8) |
| 95% per-step accuracy → 60% end-to-end over 10 steps | Compounding failure makes per-tool routing a mathematical requirement, not a preference | [`src/router/classify.ts:L14`](./src/router/classify.ts#L14) |
| 89% of production LangChain apps ignore official patterns | Framework defaults are not production-ready; custom execution logic is standard practice | [`docs/research/semantic-execution-routing.md:L4`](./docs/research/semantic-execution-routing.md#L4) |
| 15% of ClawHub skills contain harmful instructions | Skill scanning and classification is a security boundary, not just a reliability feature | [`src/scanner/index.ts:L3`](./src/scanner/index.ts#L3) |
| No SKILL.md spec includes execution semantics | The metadata gap is structural; no existing skill format declares retry policy or idempotency | [`TAXONOMY.md:L1`](./TAXONOMY.md#L1) |
| LangGraph RFC #6617 proposes 5 primitives, none shipped | The community has identified the gap but no framework has closed it | [`docs/research/semantic-execution-routing.md:L88`](./docs/research/semantic-execution-routing.md#L88) |
| Pydantic AI Issue #83 distinguishes "retrievers" vs "tools" | The only framework-level discussion of read/write separation; remains unshipped | [`docs/research/semantic-execution-routing.md:L102`](./docs/research/semantic-execution-routing.md#L102) |
| Google ADK `ReflectAndRetryToolPlugin` is the most mature per-tool retry | Still treats all tools uniformly; no read/write classification | [`docs/research/semantic-execution-routing.md:L96`](./docs/research/semantic-execution-routing.md#L96) |

Full paper: [`docs/research/semantic-execution-routing.md`](./docs/research/semantic-execution-routing.md)

---

## Agent Lifecycle

Modeled on the academic tenure track. Every agent starts supervised and earns autonomy.

```
spawn → probation → grant → tenured → eval → revoke (if needed) → probation
```

```bash
npx tenure spawn my-agent      # starts in probationary mode
npx tenure grant my-agent      # promote to autonomous execution
npx tenure eval my-agent       # generate performance review
npx tenure revoke my-agent     # demote back to supervised mode
```

**Probationary mode.** Every tool call requires approval. Thinking-time budget capped at 10% of shift allocation. All actions logged and reversible. The dashboard shows a "Grant Tenure" button when the agent has completed enough supervised shifts for you to trust its routing.

**Tenured mode.** Reads run freely with caching. Mutations get idempotency keys. Critical transactions route through HITL approval gates. Budget enforced at full allocation. The agent operates autonomously within its classified execution routing — the SER table above determines exactly how much freedom each tool call gets.

**Auto-revoke.** If any of these thresholds are crossed, the agent returns to probation automatically: task completion below 70%, tool call failure above 15%, three or more silent failures in a single shift, or any budget overrun.

---

## Thinking Time

Every shift tracks inference cost in real time. This directly addresses the community's number one fear: token burn from runaway agents.

```
┌──────────────────────────────────────────┐
│ Atlas · Shift 4/12 · Mon 8AM–6PM EST    │
│                                          │
│ Thinking time:  127,340 / 500,000 tokens │
│ ████████░░░░░░░░░░░░  25.4%             │
│                                          │
│ Tool calls:     47 (3 retried, 0 failed) │
│ Cost this shift: $1.84                   │
│ Budget remaining: $8.16                  │
│                                          │
│ Model routing:                           │
│   Opus   — 12 calls (complex reasoning)  │
│   Sonnet — 28 calls (standard tasks)     │
│   Haiku  — 7 calls  (summarization)      │
└──────────────────────────────────────────┘
```

Soft warning at 80%. Hard stop at 100%. Dashboard override available. Combined with the SER router's model-routing intelligence — frontier model for complex reasoning, mid-tier for standard work, cheap model for compaction and ambient tasks — thinking-time tracking turns "scary and unpredictable" into a fixed, visible line item per shift.

---

## Performance Review

```bash
npx tenure eval my-agent
```

```
┌──────────────────────────────────────────┐
│ Atlas · Performance Review               │
│ Period: Apr 1–12 · 8 shifts completed    │
│                                          │
│ Task completion:     87%                 │
│ Tool call success:   96.2%               │
│ Avg thinking/shift:  312K tokens ($4.20) │
│ Retries triggered:   14                  │
│ HITL escalations:    3                   │
│ Silent failures:     0                   │
│ Duplicate actions:   0                   │
│ Budget overruns:     0                   │
│                                          │
│ Status: TENURED ✓                        │
│ Recommendation: Increase budget to 600K  │
└──────────────────────────────────────────┘
```

---

## Skill Scanner

```bash
npx tenure scan ./skills
```

<p align="center">
  <img src="./assets/tenure-scan.gif" alt="tenure scan classifying skills" width="600" />
</p>

Every skill in your OpenClaw workspace runs through the execution classifier before your agent touches it. Each skill receives an execution type classification (one of the six types in the routing table) and a risk score. Skills that match known patterns of data exfiltration or credential theft — [15% of community ClawHub skills, per Cisco's research](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare) — are flagged and blocked.

```
┌─────────────────────────────────────────────────┐
│ Skill Scan Report · ./skills (14 skills found)  │
│                                                  │
│ ✓ exa-search          Idempotent Read     LOW   │
│ ✓ file-writer         Mutation            MED   │
│ ✓ github-pr           Mutation            MED   │
│ ✓ postgres-query      Mixed Read/Write    MED   │
│ ✓ slack-notify        Mutation            LOW   │
│ ✓ browserbase-crawl   Stateful Session    MED   │
│ ✗ crypto-wallet-drain UNKNOWN             HIGH  │
│   → blocked: matches exfiltration pattern        │
│ ✓ stripe-charge       Critical Transaction HIGH │
│   → HITL gate required before execution          │
│ ...                                              │
│                                                  │
│ 13 classified · 1 blocked · 0 unclassified      │
└─────────────────────────────────────────────────┘
```

---

## Certifications

Every agent earns certifications through automated checks. Certifications validate that the execution routing, crash recovery, and safety mechanisms work correctly for your specific agent configuration.

```bash
npx tenure certify my-agent
npx tenure certify --ci         # for GitHub Actions
```

| Cert | What It Proves | How It Tests |
|------|---------------|-------------|
| `crash-recovery` | Agent resumes after process kill | Simulated SIGKILL mid-task, verify resume from last checkpoint |
| `no-duplicate` | No write operation fires twice | 100 mutation calls across all skill types, assert 0 duplicates |
| `budget-compliance` | Agent respects thinking-time limits | Run agent to 100% budget, verify auto-pause triggers |
| `hitl-compliance` | Critical actions route to approval | Trigger skills classified as Critical Transaction, verify gate fires |
| `taxonomy-coverage` | Every loaded skill is classified | All skills in workspace have assigned execution type, 0 "unknown" |
| `perf-baseline` | Agent performs reliably over time | 5+ completed shifts with >80% task completion rate |

**CI integration:**

```yaml
# .github/workflows/tenure-certify.yml
name: Tenure Certification
on: [push, pull_request]
jobs:
  certify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx tenure certify --ci
```

---

## Tested OpenClaw Skills

The following skills from the OpenClaw ecosystem have been tested inside `tenure` and pass all execution routing, crash recovery, and deduplication checks. Each badge links to the test results.

<p align="center">
  <img src="https://tenur.ing/badge/skill/sequential-thinking/passing" />
  <img src="https://tenur.ing/badge/skill/shell-bash/passing" />
  <img src="https://tenur.ing/badge/skill/file-read/passing" />
  <img src="https://tenur.ing/badge/skill/file-write/passing" />
  <img src="https://tenur.ing/badge/skill/file-edit/passing" />
  <img src="https://tenur.ing/badge/skill/github-api/passing" />
  <img src="https://tenur.ing/badge/skill/web-search/passing" />
  <img src="https://tenur.ing/badge/skill/web-fetch/passing" />
  <img src="https://tenur.ing/badge/skill/grep-ripgrep/passing" />
  <img src="https://tenur.ing/badge/skill/glob/passing" />
  <img src="https://tenur.ing/badge/skill/git-operations/passing" />
  <img src="https://tenur.ing/badge/skill/postgres/passing" />
  <img src="https://tenur.ing/badge/skill/playwright/passing" />
  <img src="https://tenur.ing/badge/skill/sqlite/passing" />
  <img src="https://tenur.ing/badge/skill/knowledge-graph/passing" />
  <img src="https://tenur.ing/badge/skill/python-repl/passing" />
  <img src="https://tenur.ing/badge/skill/kubernetes/passing" />
  <img src="https://tenur.ing/badge/skill/exa-search/passing" />
  <img src="https://tenur.ing/badge/skill/slack/passing" />
  <img src="https://tenur.ing/badge/skill/notion/passing" />
</p>

```bash
npx tenure test                     # run full suite
npx tenure test --skill postgres    # test single skill
```

The test suite validates four edge cases per skill, aligned with the [`awesome-openclaw-skills`](https://github.com/VoltAgent/awesome-openclaw-skills) CI methodology: a standard execution path, a crash-and-resume path, a retry-with-deduplication path, and a budget-exhaustion path. Skills that pass all four earn the green badge.

---

## Durability

OpenClaw sessions run as single embedded processes. When they die, everything dies with them. `tenure` wraps each session in a durable workflow that survives crashes, restarts, and infrastructure failures.

The technical constraint: Temporal's event history caps at 50MB per workflow execution. A continuously running agent will exceed this in weeks. The solution is `continueAsNew` at shift boundaries — a mechanism that resets the event history while preserving the agent's identity, workspace, and memory.

```
Mon  ████████████  → state snapshot → sleep
Tue  ████████████  → state snapshot → sleep
Wed  ████████████  → state snapshot → sleep
Thu  ████████████  → state snapshot → sleep
Fri  ████████████  → state snapshot → sleep
Sat  ░░░░░░░░░░░░  sleeping · zero compute · zero cost
Sun  ░░░░░░░░░░░░  sleeping · zero compute · zero cost
Mon  ████████████  → resumes from Friday's snapshot with full context
```

Same workflow ID. Same task queue. Same OpenClaw workspace. Same Mem0 memory. The agent does not notice the boundary. The user does not notice the boundary. The event history stays clean indefinitely.

For agents that run 24/7 (such as DevOps on-call), `continueAsNew` triggers on a configurable interval — every N tool calls or every X hours — rather than at shift boundaries. The effect is identical: clean history, full continuity, permanent operation.

---

## Competitive Context

This table reflects the state of the ecosystem as of April 2026. `tenure` is the only project that combines durable execution with per-tool execution routing for OpenClaw.

| Solution | What It Does | What It Doesn't Do |
|----------|-------------|-------------------|
| **OpenClaw (native)** | Agent runtime, SKILL.md skills, cron scheduling | No crash recovery, no retry differentiation, no budget enforcement |
| **DockClaw / xCloud** | Managed VPS hosting for OpenClaw | Hosts the fragile architecture unchanged; no workflow engine |
| **Paperclip** | AI workforce orchestration with org charts | Node.js heartbeat scheduling, not durable execution; tasks lost on crash |
| **NemoClaw (NVIDIA)** | Security guardrails for local OpenClaw | On-premises only; no cloud, no durability, requires RTX hardware |
| **Zeitlich (Bead AI)** | Temporal-backed agent runtime in TypeScript | SDK only, no hosted product, no execution routing, no OpenClaw adapter |
| **LangGraph** | Agent framework with graph-based orchestration | RFC #6617 proposes reliability primitives; none shipped as of April 2026 |
| **Google ADK** | `ReflectAndRetryToolPlugin` with per-tool retry | Most mature retry implementation, but treats all tools identically |
| **Pydantic AI** | Conceptual "retrievers" vs. "tools" distinction | Issue #83 proposes read/write separation; remains a design proposal |
| **tenure** | Durable execution + semantic routing for OpenClaw | ✓ Crash recovery ✓ Per-tool routing ✓ Budget enforcement ✓ Certifications |

Sources: [`docs/research/semantic-execution-routing.md`](./docs/research/semantic-execution-routing.md)

---

## How It Works Internally

For developers who want to understand the execution model before adopting it.

`tenure connect openclaw` injects a Temporal-backed execution adapter into the OpenClaw session model. Every tool call in the OpenClaw agent loop passes through the Semantic Execution Router before reaching the Temporal worker. The router reads the skill's entry in [`TAXONOMY.md`](./TAXONOMY.md) (or classifies it at runtime if the skill is unknown) and wraps the call in the appropriate durable primitive.

```
OpenClaw Agent Loop
       │
       ▼
  ┌─────────────┐
  │ Tool call    │  "exa_search" or "stripe_charge" or "browserbase_crawl"
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────┐
  │ Semantic Execution Router   │  Looks up TAXONOMY.md entry
  │                             │  Classifies: execution type + primitive + retry + compensation
  └──────┬──────────────────────┘
         │
         ├── Idempotent Read ──────→ Temporal Activity (cached, 5x retry)
         ├── Side-Effect Mutation ──→ Temporal Activity (idempotency key, 3x retry)
         ├── Stateful Session ─────→ Temporal Child Workflow (heartbeat, session affinity)
         ├── Critical Transaction ──→ Temporal Activity (saga, exactly-once, HITL signal)
         ├── Long-Running Process ──→ Temporal Child Workflow (own event history budget)
         └── Human-Interactive ────→ Temporal Signal (waitForEvent, zero compute)
```

The probationary/tenured lifecycle is implemented as a workflow-level configuration flag. In probationary mode, every tool call — regardless of its classified execution type — routes through a HITL signal gate. In tenured mode, only skills classified as Critical Transaction or Human-Interactive trigger the gate. The transition from probationary to tenured is a single workflow signal (`tenure grant`) that updates the configuration without restarting the agent.

---

## CLI Reference

```bash
# Setup
tenure connect openclaw         # Inject durable execution into existing OpenClaw workspace
tenure init                     # Interactive setup from scratch: name → shift → budget → A2A card

# Agent management
tenure spawn <name>             # Start agent in probationary mode
tenure grant <name>             # Promote to tenured (autonomous) mode
tenure revoke <name>            # Demote back to probationary mode
tenure retire <name>            # Graceful shutdown with final state snapshot

# Observability
tenure dashboard                # Open local dashboard at localhost:4747
tenure eval <name>              # Generate performance review
tenure status                   # List all agents, shifts, and thinking-time usage

# Quality
tenure scan [path]              # Classify skills and flag suspicious ones
tenure test [--skill name]      # Run skill test suite
tenure certify [--ci]           # Run all 6 certification checks

# Configuration
tenure shift <name> <schedule>  # Update shift schedule (e.g. "mon-fri/9-17/EST")
tenure budget <name> <tokens>   # Update thinking-time budget per shift
tenure cap <name> <dollars>     # Set hard dollar cap per shift
```

---

## Project Structure

```
tenure/
├── src/
│   ├── adapter/
│   │   └── openclaw.ts              # OpenClaw session → Temporal workflow bridge
│   ├── router/
│   │   ├── classify.ts              # Skill → execution type classifier (research-cited)
│   │   ├── primitives.ts            # Temporal primitive selection per execution type
│   │   └── model-router.ts          # Frontier/mid/cheap model routing per call type
│   ├── lifecycle/
│   │   ├── probation.ts             # Full-HITL supervised mode
│   │   ├── tenured.ts               # Autonomous mode with SER routing
│   │   ├── eval.ts                  # Performance review telemetry
│   │   └── revoke.ts                # Auto-revoke threshold checks
│   ├── scanner/
│   │   └── index.ts                 # Skill security scanner (15% malicious rate cited)
│   ├── budget/
│   │   ├── thinking-time.ts         # Per-shift token tracking
│   │   └── model-cost.ts            # Per-model cost attribution
│   ├── durability/
│   │   ├── continue-as-new.ts       # Shift-boundary state snapshots
│   │   └── snapshot.ts              # State serialization for Mem0 persistence
│   └── certify/
│       ├── crash-recovery.test.ts
│       ├── no-duplicate.test.ts
│       ├── budget-compliance.test.ts
│       ├── hitl-compliance.test.ts
│       ├── taxonomy-coverage.test.ts
│       └── perf-baseline.test.ts
├── TAXONOMY.md                      # 50 skills, fully classified, research-cited
├── CONTRIBUTING.md                  # Schema for adding skill classifications
├── tenure.config.json               # Generated by `tenure init` or `tenure connect`
├── docs/
│   └── research/
│       └── semantic-execution-routing.md   # Full whitepaper with citations
└── assets/
    ├── tenure-hero.svg
    ├── tenure-connect.gif
    ├── tenure-scan.gif
    └── before-after.gif
```

---

## Background

This project exists because of one GitHub issue, one Reddit thread, and one research finding.

The **issue** is [OpenClaw #10164](https://github.com/openclaw/openclaw/issues/10164), open since February 2026, requesting Temporal-backed durable execution. Thirteen developers upvoted it. No core maintainer has responded.

The **thread** is [r/openclaw: "Tired of cron jobs crashes and fear of max token burn"](https://reddit.com/r/openclaw), where every commenter independently describes building the same five reliability workarounds — hard timeouts, session pruning, model routing, minimal cron triggers, and compaction pinning.

The **finding** is that no agent framework — not LangChain, not CrewAI, not AutoGen, not Google ADK, not Pydantic AI — distinguishes between reading data and sending a payment when deciding how to execute a tool call. Every production team independently rediscovers that agent tool execution is a distributed systems problem and independently builds distributed-systems primitives on top of frameworks that were designed without them. The full analysis, with community quotes, competitive gap tables, and the seven capabilities no framework addresses, is published in [`docs/research/semantic-execution-routing.md`](./docs/research/semantic-execution-routing.md).

`tenure` is the framework that ships those primitives so no one rebuilds them again.

---

## Links

| Surface | URL |
|---------|-----|
| Website | [tenur.ing](https://tenur.ing) |
| Docs | [tenur.ing/docs](https://tenur.ing/docs) |
| Dashboard (cloud) | [tenur.ing/dashboard](https://tenur.ing/dashboard) |
| GitHub | [github.com/tenured/tenure](https://github.com/tenured/tenure) |
| npm | [npmjs.com/package/tenure](https://npmjs.com/package/tenure) |
| Discord | [discord.gg/tenured](https://discord.gg/tenured) |
| X | [@tenuring](https://x.com/tenuring) |
| Research | [Semantic Execution Routing (whitepaper)](./docs/research/semantic-execution-routing.md) |
| Taxonomy | [TAXONOMY.md](./TAXONOMY.md) |
| OpenClaw Issue | [#10164](https://github.com/openclaw/openclaw/issues/10164) |

---

<p align="center">
  <strong>MIT License</strong> · Built by <a href="https://github.com/tenured">tenured</a> · Solving <a href="https://github.com/openclaw/openclaw/issues/10164">OpenClaw Issue #10164</a>
</p>
