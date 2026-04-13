# tenure

<p align="center">
  <img src="./assets/tenure-hero.svg" alt="tenure" width="800" />
</p>

<h3 align="center">Standardizing agentskill.io to durable workflows</h3>

<p align="center">
  <img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="pre-alpha" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/taxonomy_tools-50-green" alt="50 taxonomy tools" />
  <img src="https://img.shields.io/badge/openclaw_bridge-123-blue" alt="123 bridge entries" />
</p>

---

Run your skill on temporal:

```bash
npx tenure run ./your-skill/SKILL.md
```

A SKILL.md goes in. A running [Temporal](https://temporal.io) Workflow comes out — with every tool call classified by execution type, every mutation protected by an idempotency key, and every cron trigger outlasting process death.

```bash
npx tenure score ./skill/SKILL.md                              # Score before you run
npx tenure scan ./skills                                        # Classify a directory
npx tenure run --cron "*/60 * * * * *" ./your-skill/SKILL.md    # Durable cron
npx tenure certify --demo cron                                  # Prove it on your machine
```

---

## How It Works

Based on the research paper [Towards a Science of AI Agent Reliability](https://arxiv.org/abs/2602.16666)) (arXiv:2602.16666, February 2026) proposes twelve concrete metrics that decompose agent reliability along four key dimensions: consistency, robustness, predictability, and safety. 

The SER router classifies each tool call. Not all tool calls are the same.

| Type | Examples | Tenure Policy |
|------|----------|--------------|
| **Idempotent Read** | web search, file read, `git log` | Cache and retry freely |
| **Side-Effect Mutation** | file write, `git commit`, Slack post | Idempotency key, dedup guard |
| **Stateful Session** | Playwright, Browserbase | Heartbeat-managed child workflow |
| **Critical Transaction** | Stripe charge, `git push --force main` | Exactly-once, human-in-the-loop |
| **Long-Running Process** | subagent spawn, video render | Child workflow with own budget |
| **Human-Interactive** | approval request, clarification | Signal/wait, zero compute while blocked |

Resolution: `skill_name → bridge tool token → taxonomy entry → execution type`

50 taxonomy entries in [`taxonomy/skills.json`](./taxonomy/skills.json) · 123 OpenClaw bridge mappings in [`taxonomy/openclaw-bridge.json`](./taxonomy/openclaw-bridge.json) · Full reference: [`docs/TAXONOMY.md`](./docs/TAXONOMY.md)

```
SKILL.md  →  parse()  →  SkillPlan  →  compile()  →  Temporal Workflow
```
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

## Framework Comparison

| Framework | Crash Recovery | Execution Typing | Dedup on Retry | Budget Cap |
|-----------|---------------|-----------------|----------------|-----------|
| **OpenClaw** | `.jsonl` log + best-effort flush | None | In-memory Map (dies with process) | None |
| **LangChain** | None | None | None | None |
| **LangGraph** | Proposed in RFC #6617 | None | None | None |
| **CrewAI** | None | None | None | None |
| **AutoGen** | None | None | None | None |
| **Pydantic AI** | None | Proposed in #83, closed | None | None |
| **Tenure** | Temporal Event History | 6 types, taxonomy + bridge | Structural (replay) | Workflow-level enforcement |

These are reasoning engines, not execution engines. Tenure doesn't replace them. It compiles their skills into durable execution.

---

## Setup

**Prerequisites:** Node.js 20+ · [Temporal CLI](https://temporal.io/setup) (`brew install temporal`)

```bash
git clone https://github.com/tenuringai/tenure
cd tenure && npm install && npm run build
temporal server start-dev  # localhost:7233, UI at :8233
```

```bash
npm run worker  # Terminal 1 — start the Worker
npm test        # Terminal 2 — run tests
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

Full proof chain: [Research Setup](./docs/research/RESEARCH-SETUP.md) · [Persistence Gap](./docs/research/PERSISTENCE-GAP.md) · [Crash Matrix](./output/crash-recovery-matrix.json) · [Cron Durability Proof](./docs/research/SESSION-3-CRON-DURABILITY.md)

---

## Contributing

Highest-leverage contributions:

- Taxonomy refinement in [`taxonomy/skills.json`](./taxonomy/skills.json)
- OpenClaw bridge coverage in [`taxonomy/openclaw-bridge.json`](./taxonomy/openclaw-bridge.json)
- Skill-side `execution:` blocks so scores move from "explicitly classified" to "durably runnable"
- Platform adapters after the semantic layer is correct

If you disagree with how a skill resolves, send a PR against the bridge JSON or taxonomy JSON.

---

## License

MIT

---

<p align="center">
  <strong>Random skill in. Durable execution out. <a href="https://temporal.io">Temporal</a> owns the timeline.</strong>
</p>
