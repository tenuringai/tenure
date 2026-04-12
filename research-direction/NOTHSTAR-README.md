# tenure

**Your agent just earned tenure. Permanent. Crash-proof. Unfirable.**

[Website](https://tenur.ing) · [Docs](https://tenur.ing/docs) · [Discord](https://discord.gg/tenured) · [X](https://x.com/tenaborting) · [Taxonomy](https://github.com/tenured/tenure/blob/main/TAXONOMY.md) · [Contributing](https://github.com/tenured/tenure/blob/main/CONTRIBUTING.md)

---

**Tenure** /ˈten.jər/ — *a position that survives failures, remembers everything, and cannot be dismissed without cause.*

`tenure` gives every AI agent what academics spend six years earning — in one command. Your agent crashes at 3am. The task is gone. The email sends twice on restart. The API bill hits $560 from a runaway loop. You find out Monday morning.

With `tenure`, the agent resumes from the exact step that failed. Writes never duplicate. Loops never run away. Budgets never overrun. Every tool call gets exactly the execution guarantees it needs — not because you built five custom workarounds, but because the framework ships them as primitives.

---

## Quickstart

```bash
npx tenure init            # interactive: name → role → framework → shift → budget → capabilities → A2A card
npx tenure spawn sdr       # starts in probationary mode
npx tenure dashboard       # local UI at localhost:4747
```

`tenure init` generates two files: `tenure.config.json` (execution config) and `.well-known/agent.json` (A2A agent card). Your agent is discoverable, configurable, and durable from minute one.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         tenur.ing (website)                         │
│              Buyer-facing: role pages, hire flows, docs              │
│         tenur.ing/sdr/hire · tenur.ing/devops/hire · ...            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    SHIFT CALENDAR (Roster)                      │ │
│  │         When your agent works · Mon–Fri 9–5 · 24/7 · Custom    │ │
│  │    Shift-start triggers spawn · Shift-end triggers snapshot     │ │
│  │              Thinking-time budget tracked per shift              │ │
│  │                                                                  │ │
│  │              [ tenur.ing cloud: Roster UI ]                     │ │
│  │              [ self-hosted: tenure.config.json ]                │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                              │                                       │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │              SEMANTIC EXECUTION ROUTER (SER)                    │ │
│  │                                                                  │ │
│  │    Classifies every tool call by execution semantics:           │ │
│  │                                                                  │ │
│  │    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │ │
│  │    │ Idempotent   │  │ Side-Effect  │  │ Stateful         │    │ │
│  │    │ Read         │  │ Mutation     │  │ Session          │    │ │
│  │    │              │  │              │  │                  │    │ │
│  │    │ Web Search   │  │ File Write   │  │ Browserbase      │    │ │
│  │    │ Grep, LSP    │  │ Git Commit   │  │ Playwright       │    │ │
│  │    │ File Read    │  │ Slack Send   │  │ Puppeteer        │    │ │
│  │    │              │  │              │  │                  │    │ │
│  │    │ → Cached     │  │ → Idempotent │  │ → Child Workflow │    │ │
│  │    │ → 5x retry   │  │ → Keyed      │  │ → Heartbeat 30s  │    │ │
│  │    └──────────────┘  └──────────────┘  └──────────────────┘    │ │
│  │                                                                  │ │
│  │    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │ │
│  │    │ Critical     │  │ Long-Running │  │ Human-           │    │ │
│  │    │ Transaction  │  │ Process      │  │ Interactive      │    │ │
│  │    │              │  │              │  │                  │    │ │
│  │    │ Stripe       │  │ Subagent     │  │ Approval         │    │ │
│  │    │ Terraform    │  │ CI Pipeline  │  │ Clarification    │    │ │
│  │    │ K8s Deploy   │  │ Remotion     │  │ Escalation       │    │ │
│  │    │              │  │              │  │                  │    │ │
│  │    │ → Saga       │  │ → Child WF   │  │ → Signal         │    │ │
│  │    │ → Exactly-1  │  │ → ContinueAs │  │ → No compute     │    │ │
│  │    │ → HITL gate  │  │    New       │  │ → Wait forever   │    │ │
│  │    └──────────────┘  └──────────────┘  └──────────────────┘    │ │
│  │                                                                  │ │
│  │    Static taxonomy (OSS) → known skills from TAXONOMY.md       │ │
│  │    Runtime inference (cloud) → unknown ClawHub/MCP skills      │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                              │                                       │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │                   TEMPORAL PRIMITIVES                           │ │
│  │                                                                  │ │
│  │    Activities · Child Workflows · Durable Timers · Signals      │ │
│  │    Sagas · continueAsNew · Heartbeating · Fan-Out/Fan-In        │ │
│  │                                                                  │ │
│  │    Event history capped at 50MB per execution.                  │ │
│  │    continueAsNew at shift boundaries resets history cleanly.    │ │
│  │    Same workflow ID. Same agent. Same workspace. Years.         │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                              │                                       │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │                 CAPABILITY PLANE (cloud only)                   │ │
│  │                                                                  │ │
│  │    Inbox        AgentMail / Stalwart        ┌──────────────┐   │ │
│  │    Phone        AgentPhone / Fonoster       │              │   │ │
│  │    WhatsApp     Kapso                       │  All caps    │   │ │
│  │    Browser      Browserbase / Hyperbrowser  │  scoped per  │   │ │
│  │    Compute      Daytona / E2B               │  agent with  │   │ │
│  │    Memory       Mem0 / Graphiti             │  HITL gates  │   │ │
│  │    Voice        ElevenLabs / Vapi           │  and crash   │   │ │
│  │    Payments     Kite / Sponge               │  recovery    │   │ │
│  │    SaaS         Composio                    │              │   │ │
│  │    APIs         Orthogonal                  └──────────────┘   │ │
│  │    Search       Exa                                            │ │
│  │    People       Sixtyfour                                      │ │
│  │    Social       monid.ai                                       │ │
│  │    Web Crawl    Firecrawl                                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                        FRAMEWORK ADAPTERS                            │
│                                                                      │
│    @tenured/openclaw     @tenured/langgraph     @tenured/hermes     │
│                                                                      │
│    "Keep your framework, switch the execution plane."               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Agent Lifecycle

Every agent follows the same lifecycle — modeled on the academic tenure track.

```
spawn → probation → grant → tenured → eval → revoke (if needed) → probation
```

```bash
npx tenure spawn sdr       # hire — starts in probationary mode
npx tenure grant sdr       # tenure — promote to full autonomy
npx tenure eval sdr        # review — generate performance report
npx tenure revoke sdr      # PIP — demote back to supervised mode
```

**Probationary mode** — every tool call requires approval, thinking-time budget capped at 10% of shift allocation, all actions logged and reversible, dashboard shows "Grant Tenure" button when ready.

**Tenured mode** — reads run freely with caching, writes get idempotency keys, critical transactions get HITL approval gates, budget enforced at full allocation. The agent operates autonomously within its classified execution routing.

**Auto-revoke triggers** — if metrics cross thresholds, the agent returns to probation automatically: task completion drops below 70%, tool call failure exceeds 15%, 3 or more silent failures in a single shift, or any budget overrun.

---

## Before / After


| Without tenure                | With tenure                       |
| ----------------------------- | --------------------------------- |
| Agent crashes mid-task        | Resumes from exact step           |
| Email sends twice on restart  | Dedup guard prevents duplicate    |
| Runaway loop burns $560       | Budget cap pauses at your limit   |
| You find out Monday morning   | Dashboard alerts immediately      |
| No idea what failed or why    | Full execution trace per shift    |
| 5 custom workarounds per team | Framework primitives, zero config |


---

## What You Stop Building By Hand

The [r/openclaw community](https://reddit.com/r/openclaw) independently converges on the same five workarounds for every production deployment. `tenure` ships all five as framework primitives.


| Your workaround               | What you configure today        | What tenure does                                                      |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| Hard timeouts on cron jobs    | `timeoutSeconds: 480`           | Auto-pause at thinking-time budget limit per shift                    |
| Aggressive session pruning    | `pruneAfter: 6h, maxEntries: 5` | `continueAsNew` at every shift boundary — clean history, full context |
| Pin compaction to cheap model | `summaryModel: "haiku"`         | SER routes summarization to cheapest capable model automatically      |
| Minimal cron messages         | Manual discipline               | Shift scheduler replaces cron entirely — no reprocessed prompts       |
| Model routing for cost        | Manual cascade configuration    | Execution routing table — expensive model for work, cheap for ambient |


The fear goes away once you have hard limits in place. `tenure` is the hard limits.

---

## Thinking Time

Every shift tracks inference cost in real time.

```
┌──────────────────────────────────────────┐
│ Atlas (SDR) · Shift 4/12 · Mon 8AM–6PM  │
│                                          │
│ Thinking time:  127,340 / 500,000 tokens │
│ ████████░░░░░░░░░░░░  25.4%             │
│                                          │
│ Tool calls:     47 (3 retried, 0 failed) │
│ Cost this shift: $1.84                   │
│ Budget remaining: $8.16                  │
└──────────────────────────────────────────┘
```

Soft warning at 80%. Hard stop at 100%. Dashboard override available. No runaway loops. No surprise bills.

---

## Performance Review

```bash
npx tenure eval sdr
```

```
┌──────────────────────────────────────────┐
│ Atlas (SDR) · Performance Review         │
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

## Roles

Every role ships pre-configured with execution routing, shift schedule, thinking-time budget, and a generated A2A agent card.


| Role       | Command                   | Hosted                                                         | Shift        | Budget            |
| ---------- | ------------------------- | -------------------------------------------------------------- | ------------ | ----------------- |
| SDR        | `tenure spawn sdr`        | [tenur.ing/sdr/hire](https://tenur.ing/sdr/hire)               | Mon–Fri 8–6  | 500K tokens/shift |
| DevOps     | `tenure spawn devops`     | [tenur.ing/devops/hire](https://tenur.ing/devops/hire)         | 24/7         | 2M tokens/shift   |
| Content    | `tenure spawn content`    | [tenur.ing/content/hire](https://tenur.ing/content/hire)       | Mon–Fri 6–2  | 1M tokens/shift   |
| Support    | `tenure spawn support`    | [tenur.ing/support/hire](https://tenur.ing/support/hire)       | Mon–Sun 6–10 | 800K tokens/shift |
| Researcher | `tenure spawn researcher` | [tenur.ing/researcher/hire](https://tenur.ing/researcher/hire) | Mon–Fri 9–5  | 1.5M tokens/shift |
| Bookkeeper | `tenure spawn bookkeeper` | [tenur.ing/bookkeeper/hire](https://tenur.ing/bookkeeper/hire) | Mon–Fri 7–3  | 300K tokens/shift |


Custom roles: run `tenure init` and select "Custom" to define your own role, skills, shift, and budget.

---

## Skill Scanner

```bash
npx tenure scan ./skills
```

Every skill runs through the execution classifier before your agent touches it. 15% of community ClawHub skills contain harmful instructions — `tenure scan` catches them. Each skill receives an execution type classification and a risk score.

---

## Execution Routing

A web search and a Stripe charge should not have the same retry policy. `tenure` classifies every tool call automatically based on the [Semantic Execution Routing taxonomy](./TAXONOMY.md).


| Skill           | Type                 | Primitive                     | Retry                | Compensation      | Thinking Cost                   |
| --------------- | -------------------- | ----------------------------- | -------------------- | ----------------- | ------------------------------- |
| Web Search      | Idempotent Read      | Cached activity               | 5x, 1s backoff       | None              | Low — cached after first        |
| File Write      | Side-Effect Mutation | Keyed activity                | 3x, exponential      | Reverse operation | Low                             |
| Stripe Charge   | Critical Transaction | Saga, exactly-once            | 1x + HITL approval   | Refund            | Medium — waits for human        |
| Browser Session | Stateful Session     | Child workflow, heartbeat 30s | 2x, session restore  | Session cleanup   | High — continuous reasoning     |
| Send Email      | Side-Effect Mutation | Dedup-guarded activity        | 3x                   | None              | Low                             |
| Terraform Apply | Critical Transaction | Saga, compensation chain      | 1x                   | Full rollback     | Medium                          |
| Subagent Spawn  | Long-Running Process | Child workflow                | Inherited from child | Cancel + cleanup  | Tracked per child               |
| Human Approval  | Human-Interactive    | Signal / waitForEvent         | None                 | Timeout fallback  | Zero — no compute while waiting |


Full taxonomy of 50 classified skills → `[TAXONOMY.md](./TAXONOMY.md)`

---

## Certifications

Every agent earns certifications through automated checks. Certifications appear on the A2A agent card and the tenur.ing hosted profile.

```bash
npx tenure certify sdr
```

```
┌──────────────────────────────────────────┐
│ Atlas (SDR) · Certification Report       │
│                                          │
│ ✓ crash-recovery     Resumed after kill  │
│ ✓ no-duplicate       100 writes, 0 dupes │
│ ✓ budget-compliance  Never exceeded cap  │
│ ✓ hitl-compliance    Critical actions    │
│                      routed to approval  │
│ ✓ taxonomy-coverage  All skills typed    │
│ ✗ perf-baseline      < 5 shifts done     │
│                                          │
│ Certified: 5/6 · Retake after 3 shifts   │
└──────────────────────────────────────────┘
```

**The six certifications:**


| Cert                | What it proves                           | How it tests                                                    |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `crash-recovery`    | Agent resumes after process kill         | Simulated SIGKILL mid-task, verify resume from checkpoint       |
| `no-duplicate`      | No write operation ever fires twice      | 100 mutation calls across all skill types, assert 0 duplicates  |
| `budget-compliance` | Agent respects thinking-time limits      | Run agent to 100% budget threshold, verify auto-pause           |
| `hitl-compliance`   | Critical actions route to human approval | Trigger Stripe/Terraform/K8s skills, verify approval gate fires |
| `taxonomy-coverage` | Every loaded skill has an execution type | All skills in workspace classified with no "unknown" entries    |
| `perf-baseline`     | Agent performs reliably over time        | 5+ shifts completed with >80% task completion rate              |


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

**Badges for your repo README:**

```markdown
![crash-recovery](https://tenur.ing/badge/crash-recovery/passing)
![no-duplicate](https://tenur.ing/badge/no-duplicate/passing)
![budget-compliance](https://tenur.ing/badge/budget-compliance/passing)
![hitl-compliance](https://tenur.ing/badge/hitl-compliance/passing)
![taxonomy-coverage](https://tenur.ing/badge/taxonomy-coverage/passing)
![perf-baseline](https://tenur.ing/badge/perf-baseline/passing)
```

---

## Tested Skills

All 50 top OpenClaw skills, tested and passing inside `tenure`. Every badge is a skill that runs durably with the correct execution routing.

```bash
npx tenure test            # run full skill test suite locally
npx tenure test --skill stripe   # test a single skill
```

---

## Durability

Your agent runs for years, not hours.

Shift boundaries are natural checkpoints. At the end of every shift, the agent's state snapshots to storage and the event history resets cleanly via `continueAsNew`. At the start of the next shift, the agent resumes with full context from the snapshot. Same workflow ID, same agent identity, same OpenClaw workspace — indefinitely.

```
Mon  ████████████  → snapshot → sleep
Tue  ████████████  → snapshot → sleep
Wed  ████████████  → snapshot → sleep
Thu  ████████████  → snapshot → sleep
Fri  ████████████  → snapshot → sleep
Sat  ░░░░░░░░░░░░  sleeping (zero compute)
Sun  ░░░░░░░░░░░░  sleeping (zero compute)
Mon  ████████████  → resumes with full context from Friday's snapshot
```

Temporal's event history caps at 50MB per workflow execution. `continueAsNew` at shift boundaries means your agent never approaches that limit — each shift starts clean while memory persists through Mem0.

---

## Self-Hosted vs. Cloud


|                              | `tenure` (free, MIT) | [tenur.ing cloud](https://tenur.ing) |
| ---------------------------- | -------------------- | ------------------------------------ |
| Crash recovery               | ✓                    | ✓                                    |
| Skill taxonomy               | ✓                    | ✓                                    |
| Framework adapters           | ✓                    | ✓                                    |
| Local dashboard              | ✓                    | ✓                                    |
| Thinking-time tracking       | ✓                    | ✓                                    |
| Certifications               | ✓                    | ✓                                    |
| Skill scanner                | ✓                    | ✓                                    |
| Test suite                   | ✓                    | ✓                                    |
| Unknown skill inference (AI) | —                    | ✓                                    |
| Automatic continueAsNew      | —                    | ✓                                    |
| Shift calendar UI (Roster)   | —                    | ✓                                    |
| HITL approval inbox          | —                    | ✓                                    |
| Budget enforcement + alerts  | —                    | ✓                                    |
| Per-shift cost dashboards    | —                    | ✓                                    |
| Managed capabilities         | —                    | ✓                                    |
| Hosted certification badges  | —                    | ✓                                    |
| Performance review history   | —                    | ✓                                    |
| A2A agent card hosting       | —                    | ✓                                    |


---

## Platform & Links


| Surface        | URL                                                            | Purpose                                            |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| **Website**    | [tenur.ing](https://tenur.ing)                                 | Landing page, role marketplace, hire flows         |
| **Docs**       | [tenur.ing/docs](https://tenur.ing/docs)                       | Full documentation, guides, API reference          |
| **Dashboard**  | [tenur.ing/dashboard](https://tenur.ing/dashboard)             | Cloud execution heatmap, shift calendar, approvals |
| **SDR**        | [tenur.ing/sdr/hire](https://tenur.ing/sdr/hire)               | Hire a Sales Development Rep agent                 |
| **DevOps**     | [tenur.ing/devops/hire](https://tenur.ing/devops/hire)         | Hire a DevOps Engineer agent                       |
| **Content**    | [tenur.ing/content/hire](https://tenur.ing/content/hire)       | Hire a Content Producer agent                      |
| **Support**    | [tenur.ing/support/hire](https://tenur.ing/support/hire)       | Hire a Support Agent                               |
| **Researcher** | [tenur.ing/researcher/hire](https://tenur.ing/researcher/hire) | Hire a Research Analyst agent                      |
| **Bookkeeper** | [tenur.ing/bookkeeper/hire](https://tenur.ing/bookkeeper/hire) | Hire a Bookkeeper agent                            |
| **Scanner**    | [tenur.ing/scanner](https://tenur.ing/scanner)                 | Online skill security scanner                      |
| **Taxonomy**   | [TAXONOMY.md](./TAXONOMY.md)                                   | Full skill → primitive mapping (50 skills)         |
| **Research**   | [docs/research/](./docs/research/)                             | Semantic Execution Routing whitepaper              |
| **GitHub**     | [github.com/tenured/tenure](https://github.com/tenured/tenure) | Source code, issues, PRs                           |
| **npm**        | [npmjs.com/package/tenure](https://npmjs.com/package/tenure)   | CLI package                                        |
| **Discord**    | [discord.gg/tenured](https://discord.gg/tenured)               | Community                                          |
| **X**          | [@tenuring](https://x.com/tenuring)                            | Updates                                            |


---

## Packages


| Package              | Description                                             | Install                    |
| -------------------- | ------------------------------------------------------- | -------------------------- |
| `tenure`             | CLI — init, spawn, scan, test, eval, certify, dashboard | `npm i -g tenure`          |
| `@tenured/openclaw`  | OpenClaw framework adapter                              | `npm i @tenured/openclaw`  |
| `@tenured/langgraph` | LangGraph framework adapter                             | `npm i @tenured/langgraph` |
| `@tenured/hermes`    | Hermes framework adapter                                | `npm i @tenured/hermes`    |
| `@tenured/taxonomy`  | Skill → primitive classification data                   | `npm i @tenured/taxonomy`  |
| `@tenured/dashboard` | Local web dashboard UI                                  | Bundled with `tenure`      |


---

## CLI Reference

```bash
# Setup
tenure init                    # Interactive workspace setup → config + A2A card
tenure connect openclaw        # Wire existing OpenClaw workspace

# Agent management
tenure spawn <role|name>       # Start agent in probationary mode
tenure grant <name>            # Promote to tenured (autonomous) mode
tenure revoke <name>           # Demote back to probationary mode
tenure retire <name>           # Graceful shutdown with final state snapshot

# Observability
tenure dashboard               # Open local dashboard at localhost:4747
tenure eval <name>             # Generate performance review
tenure status                  # List all agents, shifts, and thinking-time usage

# Quality
tenure scan [path]             # Classify skills, flag suspicious ones
tenure test [--skill name]     # Run skill test suite
tenure certify [--ci]          # Run all 6 certification checks

# Configuration
tenure shift <name> <schedule> # Update shift schedule
tenure budget <name> <tokens>  # Update thinking-time budget per shift
tenure cap <name> <dollars>    # Set hard dollar cap per shift
```

---

## Contributing

Add a skill classification to the taxonomy. Every PR makes every agent on the platform more reliable.

The taxonomy lives in `[TAXONOMY.md](./TAXONOMY.md)`. Each entry specifies: skill name, source registry, execution type, recommended primitive, retry policy, heartbeat interval, compensation action, and a confidence field. See `[CONTRIBUTING.md](./CONTRIBUTING.md)` for the full schema and submission guidelines.

We also welcome framework adapter contributions, certification test improvements, and role template proposals.

---

## Background

This project exists because of [OpenClaw Issue #10164](https://github.com/openclaw/openclaw/issues/10164) — a request for Temporal-backed durable execution that no core maintainer has implemented. Every week, the [r/openclaw](https://reddit.com/r/openclaw) community surfaces the same pain: crashes that lose hours of work, runaway loops that burn hundreds of dollars, and duplicate actions that erode trust in agent reliability. Every production team independently rebuilds the same five workarounds — timeouts, session pruning, model routing, minimal cron triggers, and compaction pinning. `tenure` is those five workarounds, plus the execution routing layer that makes permanent agents architecturally possible, shipped as a single framework.

For the full technical rationale, see [Semantic Execution Routing: Mapping Agent Skills to Durable Workflow Primitives](./docs/research/semantic-execution-routing.md).

---

**MIT License** · Built by the [tenured](https://github.com/tenured) team · Solving [OpenClaw Issue #10164](https://github.com/openclaw/openclaw/issues/10164)