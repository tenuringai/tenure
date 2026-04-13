# tenure

<p align="center">
  <img src="./assets/tenure-hero.svg" alt="tenure" width="800" />
</p>

<h3 align="center">Durable execution for OpenClaw.</h3>

<p align="center">
  Your crons survive crashes. Your writes don't duplicate. Your budget doesn't runaway.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="pre-alpha" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/skills_classified-30-green" alt="30 skills classified" />
</p>

---

## The Problem You Already Know

You configured a cron. The agent ran three times. The process died. When it came back, the missed runs were gone. Nobody told you. The log has a gap where Tuesday afternoon used to be.

Or worse — it retried, and now there are two Slack messages, two git commits, two Stripe charges.

OpenClaw is excellent at reasoning. It picks the right tool, assembles the right prompt, manages the conversation. But when the process dies mid-execution, the state that was in memory is gone. The recovery path doesn't know what already happened. And every tool call — whether it's a harmless web search or an irreversible payment — gets the same retry policy: none, or hope.

A web search and a Stripe charge should not have the same retry policy.

That's what Tenure fixes.

---

## Not Just Us

This isn't a theoretical problem. It's reported, measured, and unresolved:

- **[OpenClaw #10164](https://github.com/openclaw/openclaw/issues/10164)** — "Native Temporal integration for durable workflows and scheduling." 13 upvotes. Open since February 2026. No maintainer response.
- **[OpenClaw #62442](https://github.com/openclaw/openclaw/issues/62442)** — Gateway restart drops all session state. In-memory, not persisted.
- **[OpenClaw #55343](https://github.com/openclaw/openclaw/issues/55343)** — History saves to disk but doesn't reload. Data exists. Recovery doesn't.
- **[Vercel AI SDK #7261](https://github.com/vercel/ai/issues/7261)** — 3–5% duplicate tool call rate. Different tool call IDs each time.
- **[LangGraph RFC #6617](https://github.com/langchain-ai/langgraph)** — Five production reliability primitives proposed. None shipped.
- **[Pydantic AI #83](https://github.com/pydantic/pydantic-ai/issues/83)** — Read/write tool distinction proposed by Samuel Colvin. Closed as a docs question.

Six papers from March–April 2026 found [190 security advisories](https://arxiv.org/abs/2603.27517) across OpenClaw's architecture and [26% of community skills containing vulnerabilities](https://arxiv.org/abs/2603.11619). The execution boundary is the most underprotected layer.

---

## What It Does

Tenure sits between OpenClaw and execution. Every tool call passes through a router that classifies it, chooses the right [Temporal](https://temporal.io) primitive, and lands it on a durable timeline.

That means:

**Crashes don't lose work.** Temporal Event History records every completed execution. When a Worker restarts, it replays from history — not from OpenClaw's in-memory state.

**Retries don't duplicate side effects.** A file write that already completed doesn't run again on replay. An idempotency key prevents the second Stripe charge. A dedup guard catches the duplicate Slack message.

**Crons don't die with the process.** Temporal Schedules replace in-process `setTimeout`. If the Worker is down for an hour, missed runs catch up when it returns. No gaps. No silent failures.

**Budgets don't runaway.** Token spend is tracked at the execution boundary. When the cap is hit, the workflow stops — before the next call, not after.

---

## Quick Start

```bash
npx tenure connect openclaw
```

That's it. Tenure wraps your existing OpenClaw agent. No changes to your agent code, your skills, or your prompts. OpenClaw keeps thinking. Tenure starts executing.

---

## See It Survive

Here's what the canonical proof looks like. An agent is configured to append one timestamped line to `log.txt` every 60 seconds.

<!-- TODO: Replace with actual demo GIF/video -->
<!-- <p align="center">
  <img src="./assets/cron-durability-demo.gif" alt="Cron durability demo" width="700" />
</p> -->

```
✓  Cycle 1  — 2026-04-12T10:00:00Z — line written
✓  Cycle 2  — 2026-04-12T10:01:00Z — line written
✓  Cycle 3  — 2026-04-12T10:02:00Z — line written
✗  Worker killed (SIGKILL)
✗  Cycle 4  — missed (Worker down)
✗  Cycle 5  — missed (Worker down)
↻  Worker restarted
✓  Cycle 4  — 2026-04-12T10:05:12Z — caught up by Temporal Schedule
✓  Cycle 5  — 2026-04-12T10:05:13Z — caught up by Temporal Schedule
✓  Cycle 6  — 2026-04-12T10:06:00Z — resumed on schedule

log.txt: 6 lines. 6 sequence numbers. 0 gaps. 0 duplicates.
SHA-256 verified.
```

Three things proven at once: crash recovery, cron durability, and no-duplicate side effects.

---

## Verify It Yourself

Don't take our word for it. Run the certification on your own machine:

```bash
npx tenure certify --ci
```

The certifier runs the proof ladder — read replay, write replay, cron durability, budget cap, circuit breaker — and reports pass/fail with sequence verification and file hash. If it passes, the guarantee holds on your infrastructure, not just ours.

```bash
npx tenure scan ./skills
```

Scan classifies every skill in your workspace against the execution taxonomy. You'll see which calls are cached reads, which need idempotency keys, and which require human approval before they fire.

---

## How Tenure Routes

Not all tool calls are the same. Tenure classifies each one and picks the Temporal primitive that fits.

| Type | What It Covers | What Tenure Does |
|------|---------------|-----------------|
| **Idempotent Read** | Web search, file read, grep, `git log` | Cache and retry freely |
| **Side-Effect Mutation** | File write, `git commit`, Slack message | Idempotency key, dedup guard |
| **Stateful Session** | Playwright, Browserbase | Heartbeat-managed child workflow |
| **Critical Transaction** | Stripe charge, Terraform apply, `git push --force main` | Exactly-once, human-in-the-loop |
| **Long-Running Process** | Subagent spawn, video render | Child workflow with its own budget |
| **Human-Interactive** | Approval request, clarification prompt | Signal/wait with zero compute while blocked |

The router doesn't guess. It uses a taxonomy of 30 classified skills with conditional routing — a `git status` is a cached read, but a `git push --force main` is a critical transaction that requires approval. A PostgreSQL `SELECT` is a read, but a `DROP TABLE` is a saga with a human gate.

Full taxonomy: [`TAXONOMY.md`](./TAXONOMY.md)

---

## The Boundary

OpenClaw is the brain. Tenure is the nervous system.

OpenClaw owns reasoning — LLM inference, prompt assembly, tool selection, agent UX. None of that changes. Tenure owns what happens after the tool call is emitted — execution, retries, compensation, budget enforcement, crash recovery.

The line is clean: **OpenClaw decides what to do. Tenure makes sure it happens exactly once, survives failure, and stays within budget.**

Every call goes through the router. The router chooses the Temporal primitive. The execution lands on the timeline. That makes every action countable, typed, replayable, and revocable. If a call bypasses the router, it becomes invisible — uncounted, unrecoverable, untamed.

---

## Why This Exists

OpenClaw [Issue #10164](https://github.com/openclaw/openclaw/issues/10164) asked for Temporal-backed durable execution in February. Thirteen people upvoted it. No maintainer responded.

The pain behind that issue is simple: cron jobs crash and nobody knows, retries duplicate side effects, and there's no way to set a budget cap that actually stops execution before the money is gone.

Tenure exists because that issue deserved an answer. Not a PR that waits for upstream review — an external execution layer that works today, wraps your existing agents, and proves the guarantee on your machine.

<!-- TODO: Add founder video -->
<!-- ### Hear the story
<p align="center">
  <a href="https://youtube.com/watch?v=XXXXXX">
    <img src="./assets/founder-video-thumb.png" alt="Why I built Tenure" width="500" />
  </a>
</p> -->

---

## Roadmap

**Phase 1** (now): OpenClaw adapter, SER router, taxonomy-backed routing, crash-recovery and no-duplicate certification.

**Phase 2**: Community standard for `execution:` blocks in SKILL.md frontmatter. Skill authors declare their execution contract; the taxonomy provides defaults for everything else.

**Phase 3+**: Broader platform surfaces — only after the OSS wedge is proven and the community trusts the guarantee.

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

This isn't a criticism of these frameworks — they're reasoning engines, not execution engines. Tenure doesn't replace them. It sits underneath, the same way Tenure sits underneath OpenClaw.

---

## Research

The architecture is grounded in source-level analysis of the OpenClaw codebase, six academic papers on agent security and reliability, and community evidence from GitHub issues, Reddit, and framework RFCs.

| Source | What It Proved |
|--------|---------------|
| OpenClaw source (`src/cron/`, `src/gateway/`, `src/agents/`) | In-process `setTimeout` cron, best-effort tool result flush, in-memory dedupe Map |
| [TAMU-190](https://arxiv.org/abs/2603.27517) | 190 security advisories across 10 architectural layers |
| [TAMING-26](https://arxiv.org/abs/2603.11619) | 26% of community skills contain vulnerabilities |
| [Vercel AI SDK #7261](https://github.com/vercel/ai/issues/7261) | 3–5% duplicate tool call rate in production |
| 21-entry crash matrix | Every crash point mapped with source files, persistence gaps, and test cases |

Full proof chain: [Research Setup](./RESEARCH-SETUP.md) · [Persistence Gap](./PERSISTENCE-GAP.md) · [Session 1 Findings](./SESSION-1-FINDINGS.md) · [Crash Matrix](./output/crash-recovery-matrix.json) · [Cron Durability Proof](./SESSION-3-CRON-DURABILITY.md)

---

## Contributing

The highest-leverage contributions right now are crash-point mapping, deterministic replay test cases, and taxonomy refinement for the top skills. If you contribute, optimize for the wedge. Breadth comes later.

---

## License

MIT

---

<p align="center">
  <strong>OpenClaw thinks. Tenure executes. <a href="https://temporal.io">Temporal</a> owns the timeline.</strong>
</p>
