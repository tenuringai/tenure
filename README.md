# tenure

<p align="center">
  <img src="./assets/tenure-hero.svg" alt="tenure — Semantic Execution Router" width="800" />
</p>

<p align="center">
  <strong>tenure</strong>
</p>

<h3 align="center">A web search and a Stripe charge should not have the same retry policy.</h3>

<p align="center">
  Semantic Execution Router for AI agent skills.<br/>
  Classifies every tool call by what it actually does — then runs it with exactly the right durability guarantees.
</p>

<p align="center">
  <a href="https://tenur.ing">Website</a> · <a href="https://tenur.ing/docs">Docs</a> · <a href="./TAXONOMY.md">Taxonomy</a> · <a href="./docs/research/semantic-execution-routing.md">Research</a> · <a href="https://discord.gg/tenuringai">Discord</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="pre-alpha" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
</p>

---

## The Problem

800,000 agent skills exist across ClawHub, Claude Code, Codex, and the SKILL.md ecosystem. Not a single one declares whether it's safe to retry.

Tool calls fail 3–15% of the time in production. A 10-step agent at 95% per-step accuracy succeeds only 60% end-to-end. Every production team independently rebuilds the same five workarounds — hard timeouts, session pruning, model routing, minimal cron triggers, and compaction pinning. No framework ships these as primitives.

26% of community-contributed skills contain security vulnerabilities. The SKILL.md spec describes what a skill can do. It says nothing about how it should execute safely.

I was tired of crashes and token burn. I built the hard limits.

## What Tenure Does

`tenure` is a Semantic Execution Router. It sits between your agent runtime and a durable execution engine. When your agent invokes a tool, `tenure`:

1. **Classifies** the call — is this a safe read, a side-effecting write, a financial transaction, a long-running browser session, or a request for human approval?
2. **Routes** the call to the correct execution primitive — cached retry for reads, idempotency-keyed retry for writes, saga with exactly-once for payments, heartbeat-monitored child workflow for browser sessions, zero-compute signal for human approvals.
3. **Meters** the call — tracks inference tokens consumed (thinking time), not idle time.

The result: your agent survives crashes, never duplicates a write, never sends the same email twice, never double-charges a credit card, and never burns $560 on a runaway loop.

## Quickstart

> ⚠️ Pre-alpha. Not yet functional. Star the repo and join Discord for updates.

```bash
npx tenure connect openclaw    # wire OpenClaw workspace to durable execution
npx tenure scan ./skills       # classify skills by execution type, flag dangerous ones
npx tenure spawn my-agent      # start agent in probationary mode
npx tenure dashboard           # local UI at localhost:4747
```

## The Six Execution Types

Every skill is classified into one of six types. Each type maps to a different execution primitive with different retry, compensation, and approval behavior.

| Type | Examples | What Happens |
|------|----------|-------------|
| **Idempotent Read** | Web search, file read, grep | Cached, retried aggressively, zero risk |
| **Side-Effect Mutation** | File write, git commit, Slack send | Idempotency key, dedup guard, reversible |
| **Stateful Session** | Playwright, Browserbase | Child workflow, heartbeat every 30s, resume after crash |
| **Critical Transaction** | Stripe charge, Terraform apply | Saga, exactly-once, human approval gate |
| **Long-Running Process** | Subagent spawn, video render | Child workflow, own event history budget |
| **Human-Interactive** | Approval request, clarification | Signal, zero compute while waiting |

## The Taxonomy

[`TAXONOMY.md`](./TAXONOMY.md) contains execution classifications for the top 50 agent skills. Each entry specifies execution type, Temporal primitive, retry policy, compensation action, HITL requirement, and thinking-cost tier.

The taxonomy is open source (MIT). It uses the `metadata` field from the [agentskills.io specification](https://agentskills.io/specification) — no spec changes required.

```yaml
---
name: stripe-charge
description: Process a payment via Stripe
metadata:
  tenure.execution_type: critical_transaction
  tenure.retry: "1"
  tenure.compensation: RefundCharge
  tenure.hitl: required
  tenure.thinking_cost: medium
---
```

Skills with `tenure.*` metadata get precise routing. Skills without it fall back to TAXONOMY.md defaults. Unknown skills are classified at runtime (cloud only).

## Agent Lifecycle

Every agent follows the academic tenure track.

```
spawn → probation → grant → tenured → eval → revoke (if needed)
```

| Command | What It Does |
|---------|-------------|
| `tenure spawn my-agent` | Starts in probationary mode. Every tool call requires approval. Budget capped at 10%. |
| `tenure grant my-agent` | Promotes to tenured. Reads run freely. Writes get idempotency keys. Critical transactions get HITL. |
| `tenure eval my-agent` | Generates performance review from shift telemetry. |
| `tenure revoke my-agent` | Demotes back to probation. Auto-triggers on: task completion <70%, tool failure >15%, 3+ silent failures, budget overrun. |

## Thinking Time

Only inference tokens are billed. Waiting for human approval costs nothing. Sleeping between shifts costs nothing.

```
┌──────────────────────────────────────────┐
│ Atlas · Shift 4/12 · Mon 8AM–6PM EST    │
│                                          │
│ Thinking time:  127,340 / 500,000 tokens │
│ ████████░░░░░░░░░░░░  25.4%             │
│                                          │
│ Tool calls:     47 (3 retried, 0 failed) │
│ Cost this shift: $1.84                   │
└──────────────────────────────────────────┘
```

Budget cap per shift. Soft warning at 80%. Hard stop at 100%. No runaway loops. No surprise bills.

## Certifications

Automated checks that validate your agent actually works safely.

| Cert | What It Proves |
|------|---------------|
| `crash-recovery` | Agent resumes after SIGKILL from exact checkpoint |
| `no-duplicate` | No write operation ever fires twice |
| `budget-compliance` | Agent respects thinking-time limits |
| `hitl-compliance` | Critical transactions route to human approval |
| `taxonomy-coverage` | Every loaded skill has an execution type |
| `perf-baseline` | 5+ shifts completed with >80% task completion |

```bash
npx tenure certify --ci
```

## Research

This project is grounded in six academic papers analyzing OpenClaw security and agent reliability, plus primary community research from r/openclaw.

| Key | Paper | Finding |
|-----|-------|---------|
| `[TAMU-190]` | Systematic Taxonomy of OpenClaw Vulnerabilities | 190 advisories, per-layer trust enforcement, skill supply chain as attack vector |
| `[TAMING-26]` | Taming OpenClaw | 26% of community skills contain vulnerabilities |
| `[CIK-TAX]` | Your Agent, Their Asset | Poisoning one CIK dimension raises attack success from 24.6% to 64–74% |
| `[CLAW-6]` | Systematic Evaluation of Claw Variants | All 6 frameworks exhibit substantial vulnerabilities |
| `[GRIP]` | Don't Let the Claw Grip Your Hand | 47 adversarial scenarios across MITRE ATT&CK |
| `[FASA]` | Uncovering Security Threats | Top ClawHub skill was SSH-stealing malware in 1,184 packages |

Full paper: [`docs/research/semantic-execution-routing.md`](./docs/research/semantic-execution-routing.md)

## Why This Exists

OpenClaw Issue [#10164](https://github.com/openclaw/openclaw/issues/10164) has been open since February 2026 requesting durable execution. 13 upvotes. No response from core maintainers.

On r/openclaw, I [posted](https://reddit.com/r/openclaw): *"Tired of cron jobs crashes and fear of max token burn."* Every reply described the same five workarounds everyone builds by hand. So I built them as framework primitives.

No framework — not LangChain, not CrewAI, not AutoGen, not Google ADK — distinguishes between reading data and sending a payment when deciding how to execute a tool call. `tenure` does.

## Roadmap

- [ ] **Phase 1** — SER router with static taxonomy, OpenClaw adapter, crash-recovery certification, `tenure scan`, `tenure certify` (in progress)
- [ ] **Phase 2** — Community standard: upstream PRs adding `tenure.*` metadata to top skills, badge wall, awesome-openclaw-skills CI
- [ ] **Phase 3** — Hosted platform: shift calendar, HITL inbox, thinking-time billing, budget enforcement
- [ ] **Phase 4** — Marketplace: skill monetization, agent templates, builder payouts
- [ ] **Phase 5** — Managed capabilities: inbox, browser, memory, compute, voice

## Contributing

The taxonomy is the most impactful place to contribute. Every skill classification added to [`TAXONOMY.md`](./TAXONOMY.md) makes every agent on the platform more reliable.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the schema.

## License

MIT

---

<p align="center">
  <a href="https://tenur.ing">tenur.ing</a> · <a href="https://discord.gg/tenuringai">Discord</a> · <a href="https://x.com/tenuringai">X</a>
  <br/><br/>
  Solving <a href="https://github.com/openclaw/openclaw/issues/10164">OpenClaw Issue #10164</a>
</p>
