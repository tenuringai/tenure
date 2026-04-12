# Tenure — Product Requirements Document v3.0

### Durable Skill Development Platform

### April 12, 2026

> *"800,000 skills exist. None declare execution semantics. None are tested for crash recovery. None are metered by thinking time. None are monetizable by their authors. Tenure is where all of that happens."*

**Domain:** tenur.ing  
**GitHub:** github.com/tenured/tenure  
**npm:** tenure  
**CLI:** `npx tenure`  
**Status:** Pre-Seed · Pre-Launch  
**Category:** Durable Skill Development Platform for OpenClaw

---

## Version History


| Version  | Date         | Title                                                     | Focus                                                                                                                                                                                             |
| -------- | ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0     | Mar 2026     | CrewOS PRD — Durable Execution & Managed Capability Cloud | Original vision: execution cloud + 14 capability vendors + shift scheduling                                                                                                                       |
| v2.0     | Apr 2026     | Tenure PRD — Product-Market Fit Edition                   | PMF refinement: four directions (dev tool, workforce platform, RaaS, privacy cloud), competitive map, pricing tiers, GTM sequence                                                                 |
| **v3.0** | **Apr 2026** | **Tenure PRD — Durable Skill Development Platform**       | **Category redefinition: from execution cloud to skill development platform. Introduces SER, thinking-time billing, marketplace, certifications, agent lifecycle, SKILL.md execution extension.** |


### What v3.0 Supersedes

v3.0 replaces the product positioning, architecture, and pricing model from v2.0. It does **not** replace the competitive map (v2.0 Section 2), the four customer archetypes (v2.0 Section 3.1), or the risk matrix (v2.0 Section 10). Those remain valid and are referenced where relevant.

### What Changed and Why

Three discoveries during development invalidated v2.0's framing:

1. **The Semantic Execution Router is the moat, not the Temporal wrapper.** No agent framework distinguishes between a web search and a Stripe charge at the execution level. The router that classifies tool calls by execution semantics and routes them to the correct primitive is the product — not a feature of the product.
2. **The SKILL.md `execution:` block is the standard, not a config file.** The agentskills.io format is becoming the lingua franca for 800,000+ skills. Tenure's contribution is the missing `execution:` frontmatter that declares retry policy, idempotency, compensation, and HITL requirements per skill. This is the standard nobody has shipped.
3. **Thinking-time billing is the pricing innovation, not agent-hours.** v2.0 used "agent-hours" (time on shift) as the billing unit. v3.0 uses "thinking time" (actual inference tokens consumed). Agents that spend 5 hours waiting for human approvals via Temporal Signals cost almost nothing — because waiting is not thinking. No competing platform makes this distinction.

---

## 2. The Problem — Restated for v3.0

### 2.1 The Skill Durability Gap

OpenClaw's ClawHub hosts 13,729 skills. The awesome-openclaw-skills repo catalogs the community's best. SkillsMP indexes 800,000+ skills across Claude Code, Codex, and ChatGPT. The agentskills.io specification defines how skills are authored, discovered, and loaded via progressive disclosure.

None of these skills declare execution semantics. The SKILL.md YAML frontmatter contains `name`, `description`, and `allowed-tools`. It contains no fields for:

- Whether the skill is safe to retry (idempotent read vs. irreversible write)
- What retry policy to apply (5x with backoff vs. never retry)
- Whether compensation actions exist (refund on failure, rollback on partial completion)
- Whether human approval is required before execution
- What model tier is appropriate (frontier for complex reasoning, cheap for summarization)
- How much inference the skill typically consumes (thinking cost tier)

This means every skill runs with identical execution guarantees regardless of what it actually does. A web search retries the same way as a payment. A file read has the same crash recovery as a Terraform deploy. The community knows this is broken — every production team independently builds the same five reliability workarounds (hard timeouts, session pruning, model routing, minimal cron triggers, compaction pinning). No framework ships these as primitives.

### 2.2 The Pain — In the Community's Own Words

From r/openclaw, posted April 12, 2026 (509 views, 4 comments within 3 hours):

> *"The only reason I am not running my content pipelines every day non stop is I fear token burn and tired of crashes or infinite loops the openclaw agent might get stuck into!"*

From community workarounds in the same thread:

> *"set a hard timeout on every cron job. aggressive session pruning. pin compaction to a cheap model. cron messages should be one-liners. model routing matters more than anything else. the fear goes away once you have hard limits in place."*

From the research paper (docs/research/semantic-execution-routing.md):

- Tool calls fail 3–15% in production
- A 10-step agent at 95% per-step accuracy succeeds only 60% end-to-end
- 89% of production LangChain apps ignore official patterns and build custom execution logic
- 15% of ClawHub skills contain harmful instructions (Cisco research)
- LangGraph RFC #6617 proposes five reliability primitives; none have shipped
- Pydantic AI Issue #83 proposes read/write tool distinction; remains unshipped
- Google ADK's ReflectAndRetryPlugin is the most mature per-tool retry — still treats all tools identically

### 2.3 The Gap — Stated as a Category

The market has skill discovery (SkillsMP, ClawHub), skill authoring (agentskills.io), skill hosting (DockClaw, xCloud), and agent orchestration (LangGraph, CrewAI, Paperclip). Nobody has **skill durability** — the layer where a skill declares how it should execute safely, gets tested for crash recovery, runs with the correct Temporal primitive, meters its thinking-time cost, and is monetizable by its author.

Tenure is the durable skill development platform. Author skills with execution semantics. Test them with certifications. Run them crash-proof. Bill by thinking time. Sell them on the marketplace.

---

## 3. Product Definition

### 3.1 What Tenure Is

A platform where OpenClaw developers:

1. **Author** skills with the `execution:` block — declaring retry policy, idempotency, compensation, HITL requirements, and thinking cost per skill
2. **Scan** skills for security risks and execution type classification via `tenure scan`
3. **Test** skills against crash recovery, deduplication, and budget compliance via `tenure test` and `tenure certify`
4. **Run** skills durably — each tool call routed to the correct Temporal primitive by the Semantic Execution Router
5. **Monitor** skills via OpenTelemetry spans consumed by Laminar (self-hosted), Braintrust (cloud), or Phoenix (evals)
6. **Bill** by thinking time — only inference tokens consumed, not idle time or sleeping time
7. **Sell** skills and agent templates on the marketplace with per-invocation, per-outcome, or subscription pricing

### 3.2 What Tenure Is Not

- Not an agent framework (use OpenClaw, LangGraph, or Hermes — "keep your framework, switch the execution plane")
- Not a VPS host (DockClaw hosts the fragile architecture unchanged; Tenure replaces the execution model)
- Not an observability tool (Laminar, Braintrust, and Phoenix handle storage/querying/visualization; Tenure emits OTEL spans)
- Not a capability vendor (AgentMail, Browserbase, and Composio remain in the supply chain; Tenure orchestrates them durably in the cloud tier)

### 3.3 The Naming System


| Surface            | Name                  | Purpose                                          |
| ------------------ | --------------------- | ------------------------------------------------ |
| Platform / website | tenur.ing             | Landing page, role marketplace, hire flows, docs |
| GitHub org         | tenured               | The state your agents achieve                    |
| npm package / CLI  | tenure                | The verb — the command you run                   |
| Agent roles (web)  | tenur.ing/{role}/hire | Buyer conversion pages                           |
| Agent roles (CLI)  | `tenure spawn {role}` | Developer spawn command                          |


---

## 4. Architecture

### 4.1 The Three-Layer Stack


| Layer                                  | What Users See                                          | What It Does                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shift Calendar** (top)               | Visual schedule, timezone picker, sleeping-agent states | Controls when the agent is alive. Shift-start triggers workflow. Shift-end triggers snapshot + `continueAsNew`.                                                                  |
| **Semantic Execution Router** (middle) | Nothing — invisible                                     | Classifies every tool call by execution semantics, routes to correct Temporal primitive, meters thinking time, checks budget, records billing event, emits OTEL spans. The moat. |
| **Temporal Primitives** (bottom)       | Nothing — invisible                                     | Activities, child workflows, durable timers, signals, sagas, `continueAsNew`, heartbeating. The substrate.                                                                       |


### 4.2 The Six Execution Types


| Type                 | Example Skills                     | Primitive                     | Retry               | Compensation            |
| -------------------- | ---------------------------------- | ----------------------------- | ------------------- | ----------------------- |
| Idempotent Read      | Web Search, File Read, Grep        | Cached activity               | 5x, 1s backoff      | None                    |
| Side-Effect Mutation | File Write, Git Commit, Slack Send | Keyed activity                | 3x, exponential     | Reverse operation       |
| Stateful Session     | Playwright, Browserbase            | Child workflow, heartbeat 30s | 2x, session restore | Session cleanup         |
| Critical Transaction | Stripe, Terraform, K8s             | Saga, exactly-once            | 1x + HITL           | Full compensation chain |
| Long-Running Process | Subagent, Remotion Render          | Child workflow                | Inherited           | Cancel + cleanup        |
| Human-Interactive    | Approval, Clarification            | Signal / waitForEvent         | None                | Timeout fallback        |


### 4.3 The SKILL.md Extension

Tenure extends the agentskills.io SKILL.md YAML frontmatter with two optional blocks: `execution:` (durability routing) and `pricing:` (marketplace monetization). Skills without these blocks work unmodified with default classification from TAXONOMY.md.

```yaml
---
name: stripe-charge
description: Process a payment via Stripe
allowed-tools: CreateCharge RefundCharge
execution:
  type: critical_transaction
  retry: 1
  idempotent: true
  idempotencyKey: charge_id
  compensation: RefundCharge
  hitl: required
  thinkingCost: medium
pricing:
  model: per_invocation
  cost: 0.002
  revenueSplit: 80
  freeTier: 100
---
```

### 4.4 Shift Boundary Operation

When a shift ends:

1. **Drain** — SER stops accepting new tool calls. In-flight activities complete. Long-running child workflows receive cancellation signal and snapshot.
2. **Snapshot** — Summarization activity compresses state: Mem0 references, pending tasks, conversation context, unresolved signal IDs.
3. **Billing** — Shift-end billing activity aggregates all metering events into a single billing record.
4. **ContinueAsNew** — Workflow resets event history. Carries snapshot as input. Same workflow ID.

When a shift starts:

1. **Wake** — Temporal Schedule triggers the workflow.
2. **Rehydrate** — Load snapshot, restore Mem0 pointers, re-queue pending tasks, reconnect unresolved signals, reset thinking-time counter.
3. **Route** — SER begins accepting tool calls. Agent is live.

### 4.5 Observability (Pluggable via OTEL)

The SER router emits OpenTelemetry spans with `tenure.`* attributes on every tool call. Three backends are supported:


| Backend         | Type               | Best For                                                           |
| --------------- | ------------------ | ------------------------------------------------------------------ |
| Laminar (lmnr)  | OSS, self-hostable | Default. Browser replay, semantic events, SQL queries, dashboards. |
| Braintrust      | Cloud              | Prompt versioning, A/B testing, offline evals.                     |
| Phoenix (Arize) | OSS                | Eval harnesses, embedding drift, experiment tracking.              |


Tenure does not build an observability backend. It emits telemetry and lets purpose-built tools handle it.

---

## 5. Agent Lifecycle

Modeled on the academic tenure track.

```
spawn → probation → grant → tenured → eval → revoke (if needed) → probation
```


| Command             | State        | Behavior                                                                                       |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `tenure spawn sdr`  | Probationary | Every tool call requires approval. Budget capped at 10%. All actions reversible.               |
| `tenure grant sdr`  | Tenured      | Reads run freely. Mutations get idempotency keys. Critical transactions get HITL. Full budget. |
| `tenure eval sdr`   | Any          | Generates performance review from shift telemetry.                                             |
| `tenure revoke sdr` | Probationary | Manual demotion. Full HITL resumes.                                                            |
| `tenure retire sdr` | Retired      | Final snapshot. Workflow completed. Agent card archived.                                       |


**Auto-revoke triggers:** task completion < 70%, tool failure > 15%, 3+ silent failures per shift, budget overrun.

---

## 6. Thinking-Time Billing

### 6.1 The Core Distinction


| State    | Billable | Example                                                              |
| -------- | -------- | -------------------------------------------------------------------- |
| Thinking | Yes      | LLM inference, tool call reasoning, context compaction               |
| Waiting  | No       | Paused on HITL signal, polling heartbeat, waiting for child workflow |
| Sleeping | No       | Off-shift, state snapshot persisted, zero compute                    |


Only inference tokens are billed. Waiting and sleeping cost the operator nothing.

### 6.2 Budget Enforcement

Per-shift budget in tokens and dollars. Soft warning at 80%. Hard stop at 100%. Dashboard override available.

### 6.3 Model Routing Cost Attribution

The SER router decides which model tier handles each call: frontier (complex reasoning), mid (standard orchestration), cheap (summarization, compaction, ambient). The dashboard breaks down cost per tier per shift.

### 6.4 Pricing Tiers (Updated from v2.0)


| Tier       | Price   | Thinking Time     | Agents    | Target                              |
| ---------- | ------- | ----------------- | --------- | ----------------------------------- |
| Free / Dev | $0      | Unlimited (local) | Unlimited | OSS users, self-hosted              |
| Solo       | $15/mo  | 1M tokens/mo      | 1         | Solo dev needing hosted reliability |
| Starter    | $29/mo  | 5M tokens/mo      | 3         | Small projects                      |
| Team       | $79/mo  | 20M tokens/mo     | 10        | Startups, small teams               |
| Pro        | $199/mo | 100M tokens/mo    | Unlimited | Agencies, power users               |
| Enterprise | Custom  | Custom            | Unlimited | Privacy-first enterprise            |


Billing unit is thinking tokens consumed, not hours on shift. Overage billed at tier rate. Unused tokens do not roll over.

---

## 7. Marketplace

### 7.1 Skill Monetization

Four pricing models in the `pricing:` block:


| Model          | How It Works                    | Best For                                                |
| -------------- | ------------------------------- | ------------------------------------------------------- |
| Free           | MIT, open taxonomy              | Community adoption, reputation                          |
| Per-invocation | Fraction of cent per call       | Utility skills (search, scoring, enrichment)            |
| Per-outcome    | Charge only on verified success | Results-based skills (lead qualification, deal scoring) |
| Subscription   | Flat monthly for unlimited use  | Proprietary knowledge bases, curated data feeds         |


Default revenue split: 80% builder / 20% tenure.

### 7.2 Agent Template Monetization

Builders publish fully configured agent templates (SOUL.md + skills + shift + budget + A2A card). Template pricing is a percentage markup on thinking-time cost. Builder earns proportionally to how much the agent thinks — incentivizing efficient agents.

### 7.3 The SER Router as Billing Checkpoint

Billing, safety, and durability are the same checkpoint. The SER router classifies the tool call (safety), selects the Temporal primitive (durability), meters the tokens (billing), and checks the pricing model (marketplace) in one interception point. No competing platform combines these four functions.

---

## 8. Certifications

Six automated checks that validate an agent's execution routing, crash recovery, and safety.


| Cert                | What It Proves                  | Test                                             |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| `crash-recovery`    | Resumes after process kill      | Simulated SIGKILL, verify resume from checkpoint |
| `no-duplicate`      | No write fires twice            | 100 mutations, assert 0 duplicates               |
| `budget-compliance` | Respects thinking-time limits   | Run to 100%, verify auto-pause                   |
| `hitl-compliance`   | Critical actions route to human | Trigger saga skills, verify approval gate        |
| `taxonomy-coverage` | Every skill classified          | 0 "unknown" execution types                      |
| `perf-baseline`     | Reliable over time              | 5+ shifts with >80% task completion              |


`crash-recovery` is the foundational certification. If it doesn't pass at 100%, nothing else matters.

CI integration:

```yaml
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

## 9. Competitive Map (Updated from v2.0)


| Competitor            | Category                | What They Have                                 | What They Don't Have                                                       |
| --------------------- | ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| **ClawHub**           | Skill marketplace       | 13,729 skills, community contributions         | No execution semantics, no durability, 15% malicious rate, no monetization |
| **SkillsMP**          | Skill directory         | 800,000+ skills, SKILL.md standard             | No execution routing, no testing, no marketplace                           |
| **agentskills.io**    | Skill spec              | Progressive disclosure, YAML frontmatter       | No `execution:` block, no `pricing:` block                                 |
| **Zeitlich**          | OSS runtime             | Temporal + skills + sandboxes + subagents      | No execution routing per skill, no marketplace, no hosted product          |
| **Paperclip**         | Workforce orchestration | UX, narrative, org charts                      | Node.js heartbeats, not durable execution, no skill-level routing          |
| **DockClaw / xCloud** | Managed hosting         | Quick deploy, 24/7 uptime                      | Hosts fragile architecture unchanged                                       |
| **LangGraph**         | Agent framework         | Graph orchestration, v1.0 durable execution    | RFC #6617 proposes skill reliability; none shipped                         |
| **Google ADK**        | Agent framework         | ReflectAndRetryPlugin (best per-tool retry)    | Treats all tools identically, no read/write classification                 |
| **Pydantic AI**       | Agent framework         | Conceptual "retrievers" vs "tools" distinction | Issue #83 remains unshipped design proposal                                |
| **Soul.Markets**      | Agent payments          | soul.md monetization, USDC payouts             | No execution routing, no durability, no metering                           |
| **Nevermined**        | Agent payments          | Agent wallets, usage billing, A2A identity     | No skill classification, no safety layer                                   |
| **Laminar**           | Observability           | OSS tracing, browser replay, semantic events   | Observability only — no execution or marketplace                           |
| **Braintrust**        | Observability           | Prompt versioning, evals, Temporal plugin      | Observability only — no execution or marketplace                           |


**Tenure's unique position:** the only platform that combines skill authoring (execution semantics), skill testing (certifications), skill execution (SER + Temporal), skill metering (thinking-time billing), and skill monetization (marketplace) in one system.

---

## 10. Target Users (Refined from v2.0)

### 10.1 Primary: The OpenClaw Skill Author (v0 target)

Building skills for their own agents or for the community. Frustrated by crashes, duplicate actions, and unpredictable token costs. Currently builds five workarounds by hand. Wants a framework that ships them as primitives.

**Entry:** `npx tenure connect openclaw`  
**Conversion:** crash recovery saves their first task → adopts shift scheduling → moves to hosted for dashboard and budget enforcement

### 10.2 Secondary: The Skill Publisher (v1 target)

Has built a high-quality skill that others want. Currently distributes via ClawHub with no monetization path. Wants to charge per-invocation or per-outcome. Needs the `pricing:` block and the marketplace.

**Entry:** adds `execution:` and `pricing:` blocks to their SKILL.md  
**Conversion:** first payout → publishes more skills → builds agent templates

### 10.3 Tertiary: The Agent Operator (v1 target)

Runs multiple agents for a business or agency. Needs the Roster shift calendar, thinking-time budgets, HITL approval inbox, and the performance review system. This is v2.0's "Serious Vibe Coder" and "Small Agency" archetypes.

**Entry:** tenur.ing/{role}/hire  
**Conversion:** hires first pre-built role → customizes → hires more → moves to Team/Pro tier

### 10.4 Enterprise (v2+ target)

Privacy-first teams needing NemoClaw-grade security with developer-grade UX. Same as v2.0 Archetype 4. Deferred to v2+.

---

## 11. PMF Gates (Updated from v2.0)

Tenure has PMF when three indicators converge:

1. **Crash recovery pass rate ≥ 99%** — the `crash-recovery` certification passes on every tested skill configuration. This is the foundational promise.
2. **Skill authors add `execution:` blocks ≥ 50 skills** — community adoption of the SKILL.md extension validates the standard. If authors don't use it, the taxonomy remains tenure-internal and the standard play fails.
3. **Thinking-time billing reduces surprise costs by ≥ 60%** — operators on tenure report predictable, lower costs compared to raw per-token billing without budget enforcement. Measured via dashboard cost comparisons.

If any gate is below threshold at day 60, stop and diagnose.

---

## 12. GTM Sequence (Refined from v2.0)

### Phase 1: OSS Wedge (Weeks 1–4)

Ship `tenure` CLI with OpenClaw adapter. Pass crash-recovery certification on top 20 skills. Ship TAXONOMY.md with 50 classified skills. Ship `execution:` block spec. Comment on OpenClaw Issue #10164 with working repo. Laminar self-hosted as default observability.

### Phase 2: Community Standard (Weeks 5–8)

Outreach to top `awesome-openclaw-skills` maintainers: "Your skill is classified and tested in our taxonomy. Want to add an `execution:` block?" Ship `tenure scan` and `tenure certify` as CI actions. Badge wall on README. Community PRs adding skill classifications.

### Phase 3: Hosted Platform (Months 3–4)

tenur.ing cloud: Roster shift calendar, HITL inbox, production dashboard, budget enforcement, managed Laminar. Thinking-time billing goes live. Solo tier at $15/mo.

### Phase 4: Marketplace (Months 5–6)

`pricing:` block activation. Skill marketplace on tenur.ing. Agent template publishing. Builder payouts. Braintrust integration for prompt versioning.

### Phase 5: Capabilities (Month 6+)

Managed capability plane: Inbox (AgentMail), Browser (Browserbase), Memory (Mem0), Compute (Daytona), Voice (ElevenLabs). Each capability is a managed skill with pre-configured `execution:` and `pricing:` blocks.

---

## 13. Feature Requirements by Phase

### Phase 1 Features (P0)


| Feature                               | Acceptance Criteria                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tenure connect openclaw`             | Injects durable execution backend with one command; zero agent code changes                 |
| SER router with static taxonomy       | All 50 skills from TAXONOMY.md classified and routed correctly                              |
| Crash recovery                        | Agent resumes after SIGKILL from exact tool call checkpoint; 100% pass rate                 |
| `tenure spawn` with probationary mode | Every tool call requires approval; budget capped at 10%                                     |
| `tenure grant` and `tenure revoke`    | Lifecycle transitions work; auto-revoke triggers fire correctly                             |
| `tenure scan`                         | Classifies skills by execution type; flags suspicious skills; validates `execution:` blocks |
| `tenure test`                         | Runs four-path test per skill: standard, crash-resume, dedup, budget-exhaustion             |
| `tenure certify`                      | Six certifications run; CI-compatible with `--ci` flag                                      |
| Thinking-time metering                | Every LLM call records tokens, model, cost; cumulative per shift                            |
| Budget enforcement (local)            | Soft warning at 80%; hard stop at 100%                                                      |
| `tenure dashboard` (local)            | Local UI showing execution trace, thinking time, shift status                               |
| TAXONOMY.md                           | 50 skills with execution type, primitive, retry, compensation, thinking cost                |
| OTEL span emission                    | `tenure.`* attributes on every span; Laminar integration working                            |


### Phase 2 Features (P1)


| Feature                          | Acceptance Criteria                                             |
| -------------------------------- | --------------------------------------------------------------- |
| `tenure eval`                    | Generates performance review from Laminar SQL queries           |
| `tenure certify` badge wall      | Hosted badges at tenur.ing/badge/*                              |
| `awesome-openclaw-skills` CI     | Top 20 skills pass all four test paths on every PR              |
| Community `execution:` block PRs | CONTRIBUTING.md schema published; first 10 community PRs merged |


### Phase 3 Features (P1)


| Feature                    | Acceptance Criteria                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Roster shift calendar      | Visual Mon–Fri schedule; timezone support; maps to Temporal Schedule API                |
| Hosted dashboard           | Production execution heatmap, thinking-time per shift, cost attribution                 |
| HITL approval inbox        | Critical transactions surface to Slack/mobile; Signal-based, zero compute while waiting |
| Budget enforcement (cloud) | Alerts, overrides, per-agent caps, projected monthly cost                               |
| Thinking-time billing      | Invoicing based on tokens consumed, not time on shift                                   |


### Phase 4 Features (P2)


| Feature                     | Acceptance Criteria                                                          |
| --------------------------- | ---------------------------------------------------------------------------- |
| `pricing:` block activation | Marketplace metering against pricing declarations                            |
| Skill marketplace           | tenur.ing/marketplace with search, install, and pricing display              |
| Agent template publishing   | `tenure publish` packages SOUL.md + skills + config into deployable template |
| Builder payouts             | Monthly payout cycle; 80/20 split; $25 minimum threshold                     |
| Braintrust integration      | Prompt versioning and offline evals for cloud users                          |


### Phase 5 Features (P2)


| Feature                   | Acceptance Criteria                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Managed capabilities      | Inbox, Browser, Memory, Compute, Voice provisioned per agent with HITL gates         |
| SER runtime inference     | Embedding-based classifier for unknown ClawHub/MCP skills; <200ms per classification |
| Automatic `continueAsNew` | Cloud monitors event history size; triggers snapshot before 40MB                     |


---

## 14. Risks (Carried from v2.0 + New)


| Risk                                                       | Severity | Mitigation                                                                                                                                                |
| ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI ships durable execution natively in OpenClaw        | High     | Community standard play: if the `execution:` block is adopted by 50+ skills before OpenAI moves, tenure owns the spec regardless of who hosts the runtime |
| agentskills.io rejects or competes with `execution:` block | Medium   | Ship as tenure's extension; adoption through usage, not committee approval                                                                                |
| Zeitlich adds execution routing                            | Medium   | Zeitlich is SOX-vertical and SDK-only; tenure is horizontal and hosted; different markets                                                                 |
| LangGraph ships RFC #6617 primitives                       | Medium   | LangGraph makes the graph durable; tenure makes the skill durable; different layer                                                                        |
| Crash recovery < 99% at launch                             | High     | Single eval focus; do not ship Phase 2 until crash-recovery certification passes 100% on all 50 skills                                                    |
| Community doesn't adopt `execution:` block                 | High     | PMF gate: if < 50 skills have the block at day 60, the standard play is failing; pivot to proprietary taxonomy only                                       |
| Thinking-time billing confuses buyers                      | Low      | Dashboard makes it transparent; comparison widget shows "what you'd pay on DockClaw vs tenure"                                                            |


---

## 15. Success Metrics

### Day 30

- `tenure` repo has 500+ GitHub stars
- 20+ skills pass crash-recovery certification
- 3+ community PRs adding `execution:` blocks to skills
- Issue #10164 comment drives 50+ repo visits

### Day 60

- 50 skills fully classified in TAXONOMY.md
- 10+ community-contributed `execution:` blocks
- 5+ developers running `tenure connect openclaw` weekly
- Crash recovery pass rate: 99%+

### Day 90

- tenur.ing cloud waitlist: 200+ signups
- First 10 paying Solo tier users
- 3+ published agent templates
- Thinking-time billing beta live

### Day 180

- Marketplace live with 10+ premium skills
- First builder payout
- 1,000+ GitHub stars
- Monthly recurring revenue from hosted tiers

---

## 16. The One-Line Test (Updated from v2.0)

v2.0: *"If a developer's agent crashes at 3am and loses an hour of work, there are currently zero products that fix this problem."*

v3.0: **"If a developer authors a skill that can crash, duplicate, overcharge, or silently fail — and no framework tells them which of those risks apply or how to handle them — that is Tenure's market."**

---

## References

- v1.0: CrewOS_PRD___Durable_Execution___Managed_Capability_Cloud_for_OpenClaw.md
- v2.0: Tenure_PRD___Product-Market_Fit_Edition.md
- Architecture Addendum v2.1: Tenure_Architecture_Addendum_v2.1.md
- Research: docs/research/semantic-execution-routing.md
- Marketplace & Billing: docs/marketplace-billing.md
- Observability Architecture: docs/architecture-observability.md
- Reddit thread: r/openclaw "Tired of cron jobs crashes and fear of max token burn" (Apr 12, 2026)
- OpenClaw Issue #10164: github.com/openclaw/openclaw/issues/10164

