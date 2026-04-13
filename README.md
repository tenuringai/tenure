# tenure

<p align="center">
  <img src="./assets/tenure-hero.svg" alt="tenure" width="800" />
</p>

<h3 align="center">SKILL.md-to-Temporal compiler.</h3>

<p align="center">
  Point it at any agentskills.io-compatible SKILL.md. Get a durable, classified, crash-proof Workflow.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="pre-alpha" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/skills_classified-30-green" alt="30 skills classified" />
</p>

---

## The Verb

I built a compiler that turns SKILL.md files into crash-proof Temporal workflows

Tenure is the execution environment for durable skills. It gives every skill a structured contract made of execution type, retry policy, compensation chain, budget cap, and certification proof — so skills can run continuously, survive crashes, and stay inspectable across every invocation instead of resetting to hope-and-retry.

an agentskills.io-to-Temporal compiler where tool calls become Activities and reasoning gaps become thinking Activities, all on one durable timeline.

Tenure reads a SKILL.md. It classifies each step by execution type. Tool calls become Temporal Activities. Reasoning gaps become thinking Activities. The whole thing runs on a durable timeline that survives crashes, catches up missed schedules, and never duplicates a side effect. The skill author controls the execution contract through the execution: block. If they don't declare one, the taxonomy provides safe defaults.

Take the skill your cron job runs. Tenure it. It now survives crashes, catches up missed triggers, and never duplicates a side effect.

```bash
npx tenure run ./your-skill/SKILL.md
```

A SKILL.md goes in. A running [Temporal](https://temporal.io) Workflow comes out — with every tool call classified by execution type, every mutation protected by an idempotency key, and every cron trigger outlasting process death.

No other tool in the ecosystem does this. SkillsMP indexes skills. ClawHub hosts skills. skill-creator authors skills. **Tenure runs skills** — durably, with classified execution semantics, on a real Temporal timeline.

---

## Quick Start

```bash
# One-shot execution
npx tenure run ./your-skill/SKILL.md

# Cron schedule — fires on Temporal, survives Worker crashes
npx tenure run --cron "*/60 * * * * *" ./your-skill/SKILL.md

# Classify all skills in a directory
npx tenure scan ./skills

# Prove the guarantees on your machine
npx tenure certify --demo cron
```

**Don't have a SKILL.md yet?** Run the standalone proof first:

```bash
npx tenure demo --standalone
```

Proves crash recovery, cron durability, and no-duplicate side effects in ~90 seconds without any agent dependency.

---

## See It Survive

```bash
npx tenure demo --standalone
```

```
[tenure] ══════════════════════════════════════════
[tenure]  STANDALONE CRON-DURABILITY PROOF
[tenure] ══════════════════════════════════════════
[tenure] Interval:     10s
[tenure] Cycles:       3 before kill + 2 missed
[tenure] Min expected: 5 lines (≥), sequential, 0 gaps, 0 dupes

[tenure] Phase 1: Starting Worker and Schedule...
[tenure] Schedule created: tenure-standalone-proof (every 10s)
[tenure] Waiting for 3 cycles (35s)...
[Activity] appendLine — seq: 1
[Activity] appendLine — seq: 2
[Activity] appendLine — seq: 3
[tenure] Baseline: 3 lines

[tenure] Phase 2: Killing Worker (simulating crash)...
[tenure] Worker stopped
[tenure] Waiting 2 missed cycles (no Worker running) (20s)...

[tenure] Phase 3: Restarting Worker (catch-up)...
[tenure] Worker restarted
[tenure] Waiting for catch-up (35s)...
[Activity] appendLine — seq: 4   ← caught up
[Activity] appendLine — seq: 5   ← caught up
[Activity] appendLine — seq: 6
[Activity] appendLine — seq: 7
[Activity] appendLine — seq: 8

[tenure] ══════════════════════════════════════════
[tenure]  ✓ CRON DURABILITY PROOF — PASSED
[tenure] ══════════════════════════════════════════
[tenure]  Lines:      8 (min 5)
[tenure]  Gaps:       0
[tenure]  Dupes:      0
[tenure]  Sequential: YES
[tenure] ══════════════════════════════════════════
```

Three things proven at once: crash recovery, cron durability, and no-duplicate side effects.

---

## The Pipeline

Three stages. One verb.

```
SKILL.md  →  parse()  →  SkillPlan  →  compile()  →  Temporal Workflow
```

**Stage 1 — Ingest:** Read the SKILL.md file. Extract frontmatter (name, description, allowed-tools, execution contract). Hash the content for pinning.

**Stage 2 — Classify:** Walk the markdown body. Each numbered step is classified:
- Steps that reference a tool from `allowed-tools` or match the taxonomy → `tool_call` step, classified by the SER router into one of 6 execution types
- Everything else → `thinking` step, routed to an LLM Activity with model tier and token budget

**Stage 3 — Compile:** Generate a sequential Temporal Workflow from the classified SkillPlan. Each step becomes an Activity with the correct retry policy, timeout, and idempotency configuration from its execution type.

---

## How Tenure Classifies

Not all tool calls are the same. The SER router classifies each one and the Temporal compiler picks the right primitive.

| Type | What It Covers | What Tenure Does |
|------|---------------|-----------------|
| **Idempotent Read** | Web search, file read, grep, `git log` | Cache and retry freely |
| **Side-Effect Mutation** | File write, `git commit`, Slack message | Idempotency key, dedup guard |
| **Stateful Session** | Playwright, Browserbase | Heartbeat-managed child workflow |
| **Critical Transaction** | Stripe charge, Terraform apply, `git push --force main` | Exactly-once, human-in-the-loop |
| **Long-Running Process** | Subagent spawn, video render | Child workflow with its own budget |
| **Human-Interactive** | Approval request, clarification prompt | Signal/wait with zero compute while blocked |

The router uses a taxonomy of 30 classified skills with conditional routing. The skill author can override any field through the `execution:` block in SKILL.md frontmatter.

Full taxonomy: [`TAXONOMY.md`](./TAXONOMY.md)

---

## The Engine

The parser is the front door. It reads the skill. The router classifies. The compiler emits the Workflow. Random skill in, durable execution out.

Every platform produces SKILL.md files: OpenClaw, Claude Code, Cursor, skill-creator, HolaOS. Tenure is platform-agnostic — it operates on the portable skill unit, not on any agent's internals. One adapter per platform, one engine for all of them.

---

## The Problem

You configured a cron. The agent ran three times. The process died. When it came back, the missed runs were gone. Nobody told you. The log has a gap where Tuesday afternoon used to be.

Or worse — it retried, and now there are two Slack messages, two git commits, two Stripe charges.

Agent frameworks are excellent at reasoning. They pick the right tool, assemble the right prompt, manage the conversation. But when the process dies mid-execution, the state that was in memory is gone. The recovery path doesn't know what already happened. And every tool call — whether it's a harmless web search or an irreversible payment — gets the same retry policy: none, or hope.

A web search and a Stripe charge should not have the same retry policy.

---

## Not Just Us

This isn't theoretical. It's reported, measured, and unresolved:

- **[OpenClaw #10164](https://github.com/openclaw/openclaw/issues/10164)** — "Native Temporal integration for durable workflows and scheduling." 13 upvotes. Open since February 2026. No maintainer response.
- **[OpenClaw #62442](https://github.com/openclaw/openclaw/issues/62442)** — Gateway restart drops all session state. In-memory, not persisted.
- **[OpenClaw #55343](https://github.com/openclaw/openclaw/issues/55343)** — History saves to disk but doesn't reload. Data exists. Recovery doesn't.
- **[Vercel AI SDK #7261](https://github.com/vercel/ai/issues/7261)** — 3–5% duplicate tool call rate. Different tool call IDs each time.
- **[LangGraph RFC #6617](https://github.com/langchain-ai/langgraph)** — Five production reliability primitives proposed. None shipped.
- **[Pydantic AI #83](https://github.com/pydantic/pydantic-ai/issues/83)** — Read/write tool distinction proposed by Samuel Colvin. Closed as a docs question.

---

## How Other Frameworks Handle This

They don't — or they proposed it and didn't ship it.

| Framework | Crash Recovery | Execution Typing | Dedup on Retry | Budget Cap |
|-----------|---------------|-----------------|----------------|-----------|
| **OpenClaw** | `.jsonl` log + best-effort flush | None | In-memory Map (dies with process) | None |
| **LangChain** | None | None | None | None |
| **LangGraph** | Proposed in RFC #6617 | None | None | None |
| **CrewAI** | None | None | None | None |
| **AutoGen** | None | None | None | None |
| **Pydantic AI** | None | Proposed in #83, closed | None | None |
| **Tenure** | Temporal Event History | 6 types, 30 skills | Structural (replay) | Workflow-level enforcement |

This isn't a criticism of these frameworks — they're reasoning engines, not execution engines. Tenure doesn't replace them. It compiles their skills into durable execution.

---

## OpenClaw Integration

Tenure also includes an OpenClaw adapter for transparent integration — the original adapter lives at `src/adapter/openclaw/` and is one optional integration among many.

```bash
# Connect Tenure to an OpenClaw session (transparent wrap)
npx tenure connect openclaw
```

The adapter wraps every tool's `execute` function to route through Temporal. OpenClaw sees no difference. Every tool call appears on the Temporal timeline as a classified Activity.

The adapter is not Tenure's identity — it's one platform integration. The identity is `tenure run`.

---

## Certify

Run the certification on your own machine:

```bash
npx tenure certify --demo cron
```

The cron proof: starts a SKILL.md on a Temporal Schedule, kills the Worker, waits for missed cycles, restarts, verifies catch-up. 0 gaps, 0 dupes.

```bash
npx tenure certify --ci
```

Runs the full certification suite: cron durability + crash recovery + no-duplicate. Reports pass/fail with sequence verification.

```bash
npx tenure scan ./skills
```

Classifies every SKILL.md in your workspace. Shows which calls are cached reads, which need idempotency keys, which require human approval.

---

## Prerequisites

- **Node.js 20+**
- **Temporal CLI**

```bash
# macOS
brew install temporal

# Or download from https://temporal.io/setup
```

```bash
temporal server start-dev
# Temporal server running on localhost:7233
# Web UI available at localhost:8233
```

---

## Development

```bash
git clone https://github.com/tenuringai/tenure
cd tenure
npm install
npm run build
```

In one terminal, start the Worker:

```bash
npm run worker
# [Worker] Tenure Worker started
# [Worker] Workflows: agentSessionWorkflow, skillExecutionWorkflow
# [Worker] Activities: dispatchToolActivity, executeSkillStep, executeThinkingStep
# [Worker] Polling for tasks... (Ctrl+C to stop)
```

In a second terminal, run a skill:

```bash
npm run build && node dist/src/cli/index.js run ./test/fixtures/sample-skills/cron-log-skill/SKILL.md
# [tenure] Parsing: .../cron-log-skill/SKILL.md
# [tenure] Skill: cron-log-writer
# [tenure] Version: a3f7b2e1c4d5...
# [tenure] Steps: 4 (4 tool_call, 0 thinking)
# [tenure] ✓ Workflow started
#           ID: tenure-skill-cron-log-writer-a3f7b2e1c4d5
```

Or run the standalone proof:

```bash
npm run demo
# [tenure]  ✓ CRON DURABILITY PROOF — PASSED
```

Run tests:

```bash
npm test
# ✓ test/parser.test.ts (20 tests)
# ✓ test/compiler.test.ts (14 tests)
```

---

## Research

The architecture is grounded in source-level analysis of agent frameworks, six academic papers on agent security and reliability, and community evidence from GitHub issues, Reddit, and framework RFCs.

| Source | What It Proved |
|--------|---------------|
| OpenClaw source (`src/cron/`, `src/gateway/`, `src/agents/`) | In-process `setTimeout` cron, best-effort tool result flush, in-memory dedupe Map |
| [TAMU-190](https://arxiv.org/abs/2603.27517) | 190 security advisories across 10 architectural layers |
| [TAMING-26](https://arxiv.org/abs/2603.11619) | 26% of community skills contain vulnerabilities |
| [Vercel AI SDK #7261](https://github.com/vercel/ai/issues/7261) | 3–5% duplicate tool call rate in production |
| 21-entry crash matrix | Every crash point mapped with source files, persistence gaps, and test cases |

Full proof chain: [Research Setup](./RESEARCH-SETUP.md) · [Persistence Gap](./PERSISTENCE-GAP.md) · [Crash Matrix](./output/crash-recovery-matrix.json) · [Cron Durability Proof](./SESSION-3-CRON-DURABILITY.md)

---

## Roadmap


---

## Contributing

The highest-leverage contributions right now are skill classification, taxonomy refinement, and platform adapter implementations. If you contribute, optimize for the wedge. Breadth comes later.

---

## License

MIT

---

<p align="center">
  <strong>Random skill in. Durable execution out. <a href="https://temporal.io">Temporal</a> owns the timeline.</strong>
</p>
