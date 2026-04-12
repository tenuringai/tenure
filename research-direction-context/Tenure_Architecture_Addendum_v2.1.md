# Tenure — Architecture Addendum v2.1

### Semantic Execution Routing & Multi-Year Agent Durability

**Date:** April 12, 2026  
**Status:** Architecture Decision Record — supersedes relevant sections of PRD v2.0 Section 4  
**Trigger:** Discovery that the semantic execution router is the core moat, not the Temporal wrapper or the capability marketplace

---

## 1. The Three-Layer Product Stack

Previous PRD versions described the architecture as "three repos, three moats" (`tenure-core`, `tenure-cloud`, `tenure-capabilities`). That framing remains valid for repo structure but obscures the actual product stack. The correct mental model is three **layers**, each with a distinct job:


| Layer                                  | What Users See                                                      | What It Does                                                                                                                                                                                                                                                                                 | Where It Lives                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Shift Calendar UI** (top)            | Visual Mon–Fri 9–5 schedule, timezone picker, sleeping-agent states | Controls *when* an agent is alive. Shift-start triggers workflow execution; shift-end triggers state snapshot. Users interact here.                                                                                                                                                          | `tenure-cloud` (Roster)                                                                               |
| **Semantic Execution Router** (middle) | Nothing — invisible to users                                        | Classifies every incoming tool call by execution semantics (idempotent read, side-effecting mutation, stateful session, critical transaction, long-running process, human-interactive) and routes it to the correct Temporal primitive with appropriate retry/compensation/heartbeat config. | `tenure-core` (static taxonomy: open source) + `tenure-cloud` (runtime inference engine: proprietary) |
| **Temporal Primitives** (bottom)       | Nothing — invisible to users                                        | Activities, child workflows, durable timers, signals, sagas, `continueAsNew`. The raw execution substrate.                                                                                                                                                                                   | Temporal (managed in cloud, self-hosted in OSS)                                                       |


**Key insight:** The Shift Calendar is what makes it *feel* like an employee. The Temporal primitives are what makes it *reliable*. The Semantic Execution Router is what makes multi-year permanence *architecturally possible*. The router is the moat. Nobody else is building it.

---

## 2. The Semantic Execution Router (SER) — Moat Definition

### 2.1 What SER Is

SER sits between the agent runtime (OpenClaw/LangGraph/Hermes) and the Temporal execution engine. When an agent decides to invoke a tool, SER:

1. **Classifies** the tool call's execution semantics
2. **Selects** the appropriate Temporal primitive (activity, child workflow, signal gate, etc.)
3. **Configures** retry policy, heartbeat interval, compensation actions, and `continueAsNew` thresholds

### 2.2 The Six Execution Types


| Execution Type              | Example Skills                               | Primary Primitive              | Retry               | Compensation            |
| --------------------------- | -------------------------------------------- | ------------------------------ | ------------------- | ----------------------- |
| **Idempotent Read**         | Web Search, File Read, Grep, LSP             | Activity (aggressive cache)    | 5x, 1s backoff      | None                    |
| **Side-Effecting Mutation** | File Write, Git Commit, Slack Send           | Activity (idempotency key)     | 3x, exponential     | Reverse operation       |
| **Stateful Session**        | Playwright, Puppeteer, Browserbase           | Child Workflow (heartbeat)     | 2x, session restore | Session cleanup         |
| **Critical Transaction**    | Stripe Payment, Terraform Apply, K8s Deploy  | Activity (exactly-once) + Saga | 1x, manual review   | Full compensation chain |
| **Long-Running Process**    | Subagent Spawn, CI Pipeline, Remotion Render | Child Workflow                 | Inherited           | Cancel + cleanup        |
| **Human-Interactive**       | Approval Request, Clarification Question     | Signal / waitForEvent          | None (human-driven) | Timeout fallback        |


### 2.3 Static vs. Dynamic Classification

**Static rules** (open source): For all managed capabilities in the Tenure catalog (AgentMail, Browserbase, Kapso, Stripe, etc.), the classification is known at build time. Ship as a declarative config file per capability. This becomes the community standard that developers contribute to.

**LLM-inferred classification** (proprietary): For the 13,729+ ClawHub community skills and arbitrary MCP servers where execution semantics are unknown, the runtime router uses embedding-based intent classification (~~100ms) to match tool descriptions to execution type clusters. Fallback to LLM classification (~~5,000ms) for ambiguous cases.

### 2.4 Why This Is the Moat

Zeitlich treats every tool call identically. `temporal-ai-agent` does too. OpenClaw has zero awareness of execution semantics. No one in the ecosystem distinguishes between a web search (safe to retry 100 times) and a Stripe charge (must execute exactly once with saga compensation). SER is the missing type system for agent tool calls.

---

## 3. Multi-Year Agent Durability via `continueAsNew`

### 3.1 The Constraint

Temporal's event history caps at **50MB per workflow execution**. A continuously running agent accumulates events with every tool call, signal, and timer. At production load, this limit is reachable within weeks or months.

### 3.2 The Solution: Chained Executions

A "years-long agent" is never literally one workflow execution. It is a **chain** of workflow executions that present as one continuous agent.

**Same workflow ID. Same task queue. Same agent identity. Same OpenClaw workspace.**

The only thing that resets is the internal event history ledger. The Temporal UI shows it as one continuous chain — pages in the same book.

### 3.3 The Pattern

1. Agent workflow runs normally, accumulating events
2. At a threshold (every N tool calls, every X hours, or at shift boundaries), a **summarization activity** fires
3. The summarization activity compresses current state into a compact JSON blob: agent identity, Mem0 memory references, pending task queue, conversation context
4. Workflow calls `continueAsNew` with the snapshot as starting input
5. Fresh execution begins with clean event history, full state continuity

### 3.4 Natural `continueAsNew` Boundaries

The shift calendar provides the cleanest seam. When a shift ends:

- State snapshots to object storage
- Workflow completes cleanly
- Next shift start triggers new execution from snapshot
- Years of operation with zero history bloat

**The metaphor:** A human employee doesn't carry every email they've ever sent in working memory. They have long-term memory (Mem0), a current task list, and institutional knowledge. `continueAsNew` is the agent sleeping and waking up — same person, fresh working memory.

### 3.5 Activity vs. Child Workflow Decision

Not every tool call needs to be a child workflow. The rule:

- **Stay as Activity:** API calls, database queries, sending messages, single-shot tool calls. Short, bounded, no internal state.
- **Promote to Child Workflow:** Browser sessions, multi-step renders, payment flows with HITL approval, any tool call that could run longer than the heartbeat timeout or has its own branching logic.

**Maximum nesting: two levels deep.** Agent workflow → child workflow for complex tasks. Three levels is a code smell. Each child has its own 50MB event history budget, so the ceiling effectively multiplies.

The SER router makes this decision automatically based on the skill's execution type classification.

---

## 4. Open Source vs. Proprietary — The Exact Line

### 4.1 Open Source (`tenure-core`, MIT)


| Component                              | What It Is                                                                      | Why Open                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill-to-Primitive Taxonomy**        | Static config mapping skill types → execution primitives                        | Community standard. Developers star, fork, contribute mappings. Your name is on the spec. Docker published the container spec openly — the spec became the standard. |
| **Decision Tree Schema**               | The declarative format for expressing execution routing rules                   | Enables community skills to self-classify. Becomes the lingua franca for durable agent tools.                                                                        |
| **OpenClaw/LangGraph/Hermes Adapters** | `@tenure/openclaw`, `@tenure/langgraph`, `@tenure/hermes`                       | Adoption surface. "Change one line, get durability."                                                                                                                 |
| **Temporal Bridge**                    | Workflow types, activity wrappers, event schema                                 | Core engine. Must work fully without cloud.                                                                                                                          |
| **Local Dev Dashboard**                | Browser UI at `localhost:4000` showing live tool calls, workflow state, retries | Developer experience. First touch.                                                                                                                                   |


### 4.2 Proprietary (`tenure-cloud`)


| Component                                | What It Is                                                                                           | Why Closed                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Runtime Inference Engine**             | Embedding-based classifier + LLM fallback that classifies unknown skills at invocation time          | The moat. The taxonomy tells you what *should* happen. The router makes it *actually* happen for the 13,729 ClawHub skills. |
| **Automatic `continueAsNew` Management** | System that monitors event history growth and triggers snapshot + continuation at optimal boundaries | Self-hosters can do this manually. Cloud does it automatically.                                                             |
| **Sleeping-Agent State Snapshots**       | Managed object storage for shift-boundary state persistence                                          | Operational burden. Cloud handles lifecycle.                                                                                |
| **Production Dashboard**                 | Execution heatmap, replay, full audit trail                                                          | Premium observability.                                                                                                      |
| **HITL Approval Inbox**                  | Slack/mobile routing for risky agent actions                                                         | Enterprise feature.                                                                                                         |
| **Roster (Shift Calendar)**              | Visual schedule builder mapped to Temporal Schedule API                                              | Premium UX differentiator.                                                                                                  |
| **Capability Plane**                     | Managed AgentMail, Browserbase, Kapso, Mem0, Daytona provisioning                                    | Revenue layer. Wholesale vendor relationships.                                                                              |


### 4.3 The Logic

The open source repo gets adoption. The closed router gets revenue. The taxonomy without the runtime is a reference doc. The runtime without the taxonomy is a black box nobody trusts. Both are needed, split exactly at this line.

---

## 5. Updates to PRD v2.0

### 5.1 Section 4 — "Three Repos, Three Moats" → "Three Layers, One Moat"

The repo structure (core/cloud/capabilities) remains. But the moat narrative changes. The three repos are organizational. The **one moat** is the Semantic Execution Router — the layer that makes "tenure an agent" (verb) architecturally possible.

`tenure-core` is the distribution vehicle.  
`tenure-cloud` is the revenue vehicle.  
SER is the defensibility vehicle.

### 5.2 Section 5.1 — v0 Feature Table Update

Add to P0:


| Feature                               | Priority | Acceptance Criteria                                                                                                     |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| SER static taxonomy for top 50 skills | P0       | Declarative config file mapping all top 50 OpenClaw skills to execution primitives; ships as `@tenure/skill-taxonomy`   |
| `continueAsNew` at shift boundaries   | P0       | Agent workflow snapshots state and continues with clean history on every shift-end; verified over 7-day continuous test |


### 5.3 Section 5.2 — v1 Feature Table Update

Add to P1:


| Feature                                        | Priority | Acceptance Criteria                                                                                                                   |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SER runtime inference for unknown skills       | P1       | Embedding-based classifier routes uncatalogued ClawHub skills to correct primitive in <200ms; accuracy >85% vs. manual classification |
| Automatic `continueAsNew` threshold management | P1       | Cloud monitors event history size per workflow; triggers summarization + continuation before 40MB; zero user configuration required   |


### 5.4 Naming — Pending Decision

Domain candidate: `tenur.ing` — reads as the verb "tenuring," maps to the core product action. GitHub org, npm scope, and X handle to be registered simultaneously once confirmed. All docs should use placeholder `[PRODUCT_NAME]` until locked.

---

## 6. What This Changes About Competitive Positioning

Previous positioning: "Tenure is the Vercel for OpenClaw."

Updated positioning: **"Tenure is the only platform that understands what your agent's tools actually do — and runs each one with exactly the reliability it needs."**

Zeitlich wraps tools uniformly. Paperclip doesn't wrap them at all. Temporal is the substrate, not the product. The SER layer — the semantic understanding of tool execution types — is what no competitor has and what makes permanent, multi-year AI employees possible.

The shift calendar is how users experience it. The router is how it works. The taxonomy is how the community adopts it. All three are required. None is the product alone.