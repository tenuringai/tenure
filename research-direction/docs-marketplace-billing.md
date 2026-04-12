# Tenure Marketplace & Billing Architecture

### Development Documentation · v0.5

---

## Overview

Tenure's billing system serves three participants: the **platform** (tenure), the **operator** (the person running agents), and the **builder** (the person who authored the agent template or skill). Every billable event passes through the Semantic Execution Router, which already classifies and meters every tool call for safety and durability. The billing layer is a second function of the same checkpoint — not a separate system.

This document defines the billing primitives, the SKILL.md pricing extension, the metering architecture, and the marketplace mechanics for builder payouts.

---

## Part 1: Thinking-Time Billing

### The Core Distinction

An agent exists in one of three states at any given moment. **Thinking** means the agent is actively consuming LLM inference tokens — reasoning, generating tool call parameters, processing tool results, or compacting context. **Waiting** means the agent is alive but not consuming inference — paused on a Temporal Signal for human approval, polling for an external event via heartbeat, or waiting for a long-running child workflow to complete. **Sleeping** means the agent is off-shift, its state snapshot persisted to storage, its workflow paused via `continueAsNew`, consuming zero compute.

Only thinking is billable. Waiting and sleeping cost the operator nothing. This is the fundamental pricing innovation: the operator pays for inference, not uptime.

### Why This Matters

Under current agent platform billing models, an agent on a 24/7 shift that spends 18 hours per day waiting for inbound emails to process is billed the same as an agent that reasons continuously for 24 hours. The operator pays for idle time they cannot control. Under thinking-time billing, the email-monitoring agent costs a fraction of the continuously reasoning agent, because waiting for a Temporal Signal consumes zero tokens.

The practical impact: an SDR agent on a Mon–Fri 8AM–6PM shift that processes 50 leads per day might consume 300K–500K tokens per shift. At current April 2026 pricing (Sonnet at $3/$15 per million tokens, Haiku at $0.80/$4 per million tokens), that translates to $2–$8 per shift depending on model routing. The operator knows this number before the shift starts because the budget cap enforces it. There are no surprise bills.

### Thinking-Time Metering

Every LLM inference call that passes through the SER router records a metering event with the following fields:

```json
{
  "agent_id": "atlas-sdr",
  "shift_id": "shift-2026-04-12-08",
  "timestamp": "2026-04-12T14:23:07Z",
  "model": "claude-sonnet-4-20250514",
  "model_tier": "mid",
  "input_tokens": 2847,
  "output_tokens": 412,
  "thinking_tokens": 0,
  "tool_call": "exa_search",
  "execution_type": "idempotent_read",
  "cached": false,
  "cost_usd": 0.0147,
  "cumulative_shift_tokens": 127340,
  "budget_remaining_tokens": 372660,
  "budget_remaining_usd": 8.16
}
```

The `model_tier` field reflects the SER router's model routing decision. Frontier models (Opus, GPT-5) are used for complex reasoning. Mid-tier models (Sonnet, GPT-4o) handle standard tool call orchestration. Cheap models (Haiku, Flash) handle summarization, compaction, and ambient tasks. The router makes this decision per tool call based on the execution type classification — not globally per agent.

### Budget Enforcement

Each agent has a per-shift thinking-time budget expressed in both tokens and dollars. The budget is configured in `tenure.config.json` or via the CLI:

```bash
tenure budget atlas-sdr 500000        # 500K tokens per shift
tenure cap atlas-sdr 10               # hard cap at $10 per shift
```

Enforcement happens at three thresholds. At 80% consumption, a soft warning event is emitted to the dashboard and any configured notification channels (Slack, webhook). At 100% consumption, the agent auto-pauses — the Temporal workflow enters a Signal-waiting state until the operator manually resumes it or the next shift begins. The operator can override the pause via the dashboard or CLI (`tenure resume atlas-sdr --override-budget`), which logs the override for audit purposes.

### Model Routing Cost Attribution

The thinking-time dashboard breaks down cost per model tier per shift:

```
┌──────────────────────────────────────────┐
│ Atlas (SDR) · Shift Cost Breakdown       │
│                                          │
│ Opus    — 4 calls   — $1.22  (28%)      │
│ Sonnet  — 31 calls  — $2.68  (62%)      │
│ Haiku   — 12 calls  — $0.42  (10%)      │
│                                          │
│ Total:    47 calls  — $4.32              │
│ Idle time excluded:  3h 12m              │
│ Effective cost/hour: $0.89              │
└──────────────────────────────────────────┘
```

The "idle time excluded" line is the key differentiator from competing platforms. It shows the operator exactly how much time the agent spent waiting (on Signals, heartbeats, or external events) and confirms that none of it was billed.

---

## Part 2: SKILL.md Pricing Extension

### The agentskills.io Base

The agentskills.io specification defines skills as SKILL.md files with YAML frontmatter containing `name`, `description`, and optional metadata. Tenure extends this frontmatter with an `execution:` block (for durability routing) and a `pricing:` block (for marketplace monetization). Both blocks are optional. Skills without them work unmodified — they receive default execution routing from the taxonomy and are free to use.

### The Pricing Block Schema

```yaml
---
name: premium-lead-scorer
author: "@builder-handle"
description: Score inbound leads using proprietary qualification signals
version: 1.2.0
execution:
  type: idempotent_read
  retry: 3
  cache: true
  thinkingCost: low
pricing:
  model: per_invocation      # per_invocation | per_outcome | subscription | free
  cost: 0.002                # USD per invocation (for per_invocation model)
  currency: USD
  revenueSplit: 80            # builder receives 80%, tenure receives 20%
  freeTier: 100               # first 100 invocations per month are free
  outcome:                    # only used when model: per_outcome
    successField: "qualified" # field in tool response that indicates success
    successValue: true        # value that triggers billing
    cost: 0.50                # USD per successful outcome
  subscription:               # only used when model: subscription
    monthly: 9.00             # USD per month
    invocationLimit: null     # null = unlimited
---
```

### The Four Pricing Models

**Free** is the default. The skill is MIT-licensed, appears in the open taxonomy, and earns the builder distribution and reputation through the badge wall and marketplace listing. Most skills in the ecosystem will be free — this is by design, because free skills drive platform adoption.

**Per-invocation** charges a fraction of a cent per tool call. The SER router meters the call, records the billing event, and attributes the charge to the operator's invoice. The builder receives their revenue split at the end of each billing cycle. This model works best for utility skills that are called frequently — search, enrichment, classification, scoring.

**Per-outcome** charges only when the skill produces a verified result. The `outcome` block in the frontmatter defines which field in the tool response constitutes success. A lead scoring skill that charges $0.50 per qualified lead only bills when the response contains `"qualified": true`. The SER router inspects the tool response against the outcome definition before recording a billing event. This model aligns builder and operator incentives perfectly — the builder earns nothing if the skill produces no value.

**Subscription** unlocks the skill for unlimited (or capped) invocations at a flat monthly rate. The operator subscribes through the marketplace, and the SER router checks subscription status before allowing execution. This model works for skills that are high-value but hard to meter per-call — a proprietary knowledge base, a fine-tuned classifier, or a curated data feed.

### Pricing Validation

The `tenure scan` command validates pricing blocks alongside execution blocks:

```
┌─────────────────────────────────────────────────┐
│ Skill Scan Report · ./skills (8 skills found)   │
│                                                  │
│ ✓ exa-search          Free         Idempotent   │
│ ✓ lead-scorer-pro     $0.002/call  Idempotent   │
│ ✓ stripe-charge       Free         Critical     │
│ ✓ terraform-apply     Free         Critical     │
│ ✓ intent-classifier   $9/mo sub    Idempotent   │
│ ✓ deal-qualifier      $0.50/outcome Idempotent  │
│ ✗ shady-enrichment    $0.10/call   UNKNOWN      │
│   → blocked: execution type unclassified         │
│   → pricing requires classified execution type   │
│                                                  │
│ 7 valid · 1 blocked                             │
└─────────────────────────────────────────────────┘
```

A skill cannot have a `pricing:` block without a valid `execution:` block. This is enforced because the SER router is the metering checkpoint — if the router cannot classify the skill's execution type, it cannot safely meter or bill for it. This prevents unclassified, potentially dangerous skills from being monetized.

---

## Part 3: Agent Template Marketplace

### Templates vs. Skills

A **skill** is a single tool — one SKILL.md file that performs one function (search, score, send, charge). A **template** is a fully configured agent — a SOUL.md behavioral definition, a set of skills, a shift schedule, a thinking-time budget, and an A2A agent card, packaged as a deployable unit.

Templates are the higher-value marketplace item. A builder who publishes a "Senior SDR" template has configured the role prompt, selected and tuned five premium skills, calibrated the shift schedule for optimal lead coverage, and tested the budget allocation across dozens of shifts. The operator hires the template and gets a working agent without configuring anything.

### Template Pricing

Templates use a thinking-time markup model. The builder sets a percentage surcharge on the base thinking-time cost. When the operator runs the template, every metering event includes the markup:

```json
{
  "agent_id": "atlas-sdr",
  "template_id": "senior-sdr-pro",
  "template_author": "@top-builder",
  "base_cost_usd": 0.0147,
  "markup_pct": 20,
  "markup_usd": 0.00294,
  "total_cost_usd": 0.01764,
  "builder_payout_usd": 0.00294
}
```

The operator sees the total cost per shift in the dashboard. The builder earns proportionally to how much the agent thinks — which means builders are incentivized to create agents that are efficient (operators keep them running longer) rather than agents that burn tokens (operators shut them down quickly).

### Template Publishing

```bash
tenure publish ./my-sdr-template --price markup:20
```

This packages the SOUL.md, skill set, shift config, budget defaults, and A2A card into a publishable template. The template is listed on `tenur.ing/marketplace/senior-sdr-pro` with the builder's profile, pricing, performance metrics from test shifts, and certification badges.

### Template Forking

Operators can fork a published template to customize it. The forked version disconnects from the builder's pricing — the operator now owns the configuration and pays only base thinking-time costs. This prevents vendor lock-in and encourages builders to continuously improve their templates to retain subscribers.

---

## Part 4: Metering Architecture

### The SER Router as Billing Checkpoint

The Semantic Execution Router already intercepts every tool call to classify its execution type and select the correct Temporal primitive. The billing layer adds three operations to this checkpoint: record the metering event, check the operator's budget against the cumulative shift cost, and check the skill's pricing model to determine builder attribution.

This is architecturally efficient because no additional interception point is needed. The router is the single checkpoint for safety (execution routing), durability (primitive selection), and billing (metering). Adding a separate billing middleware would create a second interception point with its own failure modes and latency cost.

### Metering Event Flow

```
Tool call arrives at SER Router
       │
       ├── 1. Classify execution type (existing)
       ├── 2. Select Temporal primitive (existing)
       ├── 3. Check operator budget → pause if exceeded
       ├── 4. Record metering event with model/tokens/cost
       ├── 5. Check skill pricing model → record builder attribution
       │
       └── Execute via Temporal primitive
              │
              └── On completion:
                    ├── 6. Record actual tokens consumed (may differ from estimate)
                    ├── 7. If per_outcome: inspect response for success field
                    └── 8. Update cumulative shift totals
```

Steps 1 and 2 are the existing SER router logic. Steps 3–8 are the billing extension. In the self-hosted OSS version, steps 3–4 run locally and produce metering data that the operator can inspect via the dashboard. Steps 5–8 are cloud-only because they require the marketplace payment infrastructure.

### Billing Records

At the end of each shift, a billing Activity runs as part of the `continueAsNew` process. It aggregates all metering events from the shift into a single billing record:

```json
{
  "shift_id": "shift-2026-04-12-08",
  "agent_id": "atlas-sdr",
  "operator_id": "org-123",
  "shift_start": "2026-04-12T08:00:00-05:00",
  "shift_end": "2026-04-12T18:00:00-05:00",
  "duration_hours": 10,
  "thinking_hours": 6.8,
  "idle_hours": 3.2,
  "total_tokens": 487230,
  "tokens_by_tier": {
    "frontier": 42100,
    "mid": 389400,
    "cheap": 55730
  },
  "total_tool_calls": 47,
  "retries": 3,
  "cached_calls": 12,
  "base_cost_usd": 4.32,
  "template_markup_usd": 0.86,
  "skill_charges": [
    { "skill": "lead-scorer-pro", "model": "per_invocation", "calls": 31, "cost": 0.062, "builder": "@top-builder" },
    { "skill": "deal-qualifier", "model": "per_outcome", "outcomes": 4, "cost": 2.00, "builder": "@deal-ai" }
  ],
  "total_operator_charge_usd": 7.24,
  "builder_payouts": [
    { "builder": "@top-builder", "amount": 0.91 },
    { "builder": "@deal-ai", "amount": 1.60 }
  ]
}
```

This record is the source of truth for the operator's invoice, the builder's payout, and the platform's revenue. It is persisted as a Temporal Activity result, meaning it is durable — a platform crash during billing does not lose the record.

---

## Part 5: Revenue Split

### Platform Economics

Tenure operates as a three-sided marketplace with the following revenue streams:

**Thinking-time infrastructure margin.** The operator pays tenure for managed execution infrastructure. Tenure's cost is the underlying Temporal hosting, compute, and storage. The margin is the difference between what the operator pays per thinking-hour and what tenure pays to run the infrastructure. This is the baseline revenue that exists even when no premium skills or templates are used.

**Skill marketplace commission.** When an operator uses a premium skill, tenure takes a percentage of the per-invocation, per-outcome, or subscription fee. The default split is 80/20 (builder receives 80%, tenure receives 20%). High-volume builders can negotiate lower platform fees.

**Template marketplace commission.** When an operator runs a builder's template, tenure takes a percentage of the thinking-time markup. The default split is the same 80/20.

### Builder Payouts

Builders receive payouts on a monthly cycle. The payout is calculated from the sum of all billing records that reference the builder's skills or templates during the billing period. Minimum payout threshold is $25 to avoid micropayment processing costs. Balances below the threshold roll over to the next cycle.

### Operator Invoicing

Operators receive a monthly invoice that itemizes: base thinking-time cost per agent per shift, template markup charges, premium skill charges, and capability add-on charges (inbox, phone, browser, etc.). The invoice maps directly to the shift billing records, so the operator can drill down from the monthly total to any individual shift to any individual tool call.

---

## Part 6: Competitive Positioning

### What Exists Today

**Soul.Markets** allows agents to monetize through soul.md files and earn USDC. It handles payment rails but has no execution routing, no durability, and no metering infrastructure. The builder must handle reliability themselves.

**Nevermined** provides agent-to-agent autonomous payments with usage-based billing and unique agent wallets. It focuses on payment identity and settlement infrastructure but does not classify tool calls or enforce execution safety.

**Paid.ai** provides cost analytics and flexible billing models for LLM developers. It focuses on visibility into expenses but does not integrate with execution or skill marketplaces.

**SkillsMP** provides a discovery and install marketplace for 800,000+ SKILL.md-compatible skills. Monetization model for builders is unclear — it appears to be primarily a directory.

**ClawHub** hosts community skills but has no payment rails, no execution routing, and documented security issues (15% malicious skill rate per Cisco research).

### Tenure's Differentiation

Tenure is the only platform where billing, safety, and durability are the same checkpoint. The SER router classifies the tool call (safety), selects the Temporal primitive (durability), meters the tokens (billing), and checks the pricing model (marketplace) — all in one interception point. This architectural unification means that a premium skill cannot bypass safety checks, a billed invocation cannot lose its durability guarantees, and a free skill runs with the same execution routing as a paid one.

No competing platform combines these four functions in a single checkpoint. Soul.Markets handles payments without execution. Nevermined handles identity without classification. ClawHub handles distribution without safety. Tenure handles all four because they are architecturally the same operation: intercepting a tool call and deciding what to do with it.

---

## Part 7: Implementation Priority

For v0.5 (the OpenClaw deep-dive release), the billing system ships in a reduced form. The thinking-time metering is fully functional in the self-hosted CLI — every shift produces a billing record with token counts, cost attribution, and model routing breakdown. The operator can inspect their costs locally. Budget enforcement (soft warning at 80%, hard stop at 100%) is fully functional.

The marketplace features — premium skill pricing, template markup, builder payouts, and the `tenur.ing/marketplace` storefront — ship in the cloud product at v1. They depend on payment processing infrastructure, builder identity verification, and the hosted dashboard that does not exist yet.

The `pricing:` block in the SKILL.md frontmatter ships in v0.5 as a spec with validation in `tenure scan`. Builders can declare their pricing intent immediately. Metering against that pricing block activates when the cloud marketplace launches.

This sequencing ensures that the core product — crash recovery, execution routing, budget enforcement, and thinking-time visibility — ships without waiting for marketplace infrastructure. The marketplace is the monetization layer built on top of a product that already works.