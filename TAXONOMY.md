# TAXONOMY.md

### Execution Semantics For The Top 50 Agent Skills

### Version 0.1.0 · MIT License

> Every entry maps a skill to its execution type, Temporal primitive, retry policy, compensation action, HITL requirement, and thinking-cost tier. These classifications are used by the Semantic Execution Router to route each call into the correct Temporal primitive so the execution lands on the durable timeline.
>
> The taxonomy is not a detached labeling exercise. It exists to answer one execution question: if this call happens inside OpenClaw, what Temporal-owned path must Tenure use so replay, no-duplicate behavior, and taming still hold?
>
> `execution:` is the preferred author-facing contract. `TAXONOMY.md` is the default when a skill declares nothing. `tenure.*` metadata is a compatible encoding of that same contract.

---

## How To Read This Table

| Column             | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| **Skill**          | Tool name as it appears in the agent runtime           |
| **Category**       | Functional grouping                                    |
| **Execution Type** | One of six execution semantics                         |
| **Primitive**      | Temporal primitive the SER router selects              |
| **Retry**          | Retry policy applied on failure                        |
| **Compensation**   | Rollback action if downstream steps fail               |
| **HITL**           | Whether human approval is required                     |
| **Thinking Cost**  | Typical inference token consumption per invocation     |

## The Six Execution Types

| Type                 | Code | Description                                                                                     |
| -------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| Idempotent Read      | `IR` | Safe to retry indefinitely. No side effects. Cacheable.                                         |
| Side-Effect Mutation | `SM` | Produces external side effects. Requires idempotency key or dedup guard.                        |
| Stateful Session     | `SS` | Maintains session state across multiple interactions. Requires heartbeat monitoring.            |
| Critical Transaction | `CT` | Irreversible or financially significant. Requires exactly-once semantics and/or human approval. |
| Long-Running Process | `LR` | Runs for minutes to hours. Needs its own event history budget.                                  |
| Human-Interactive    | `HI` | Requires human input to proceed. Zero compute while waiting.                                    |

---

## Routing Invariant

Every call that Tenure can reason about must:

1. pass through the SER router
2. be classified by execution type
3. be routed into the correct Temporal primitive
4. land on the Temporal execution timeline

If a call bypasses the router and executes as a raw in-memory function call, it becomes uncounted, untyped, unreplayable, and unrevocable. This taxonomy exists to prevent that leak.

---

## The Taxonomy

### 1-10: Core Agent Primitives

| #   | Skill                             | Category        | Type | Primitive                 | Retry           | Compensation               | HITL     | Cost   |
| --- | --------------------------------- | --------------- | ---- | ------------------------- | --------------- | -------------------------- | -------- | ------ |
| 1   | Sequential Thinking               | Reasoning       | `IR` | Activity, cached          | 3x, 1s backoff  | None                       | None     | Low    |
| 2   | Shell / Bash Execution            | System          | `SM` | Activity, logged          | 2x, 2s backoff  | None (logged for audit)    | Optional | Medium |
| 3   | File Read                         | Filesystem      | `IR` | Activity, cached          | 5x, 1s backoff  | None                       | None     | Low    |
| 4   | File Write / Create               | Filesystem      | `SM` | Activity, idempotency key | 3x, exponential | Delete created file        | None     | Low    |
| 5   | File Edit (targeted patch)        | Filesystem      | `SM` | Activity, idempotency key | 3x, exponential | Revert to pre-edit content | None     | Low    |
| 6   | GitHub API (repos, PRs, issues)   | Version Control | `SM` | Activity, idempotency key | 3x, exponential | Close PR / delete branch   | Optional | Low    |
| 7   | Web Search (Brave/Tavily/DDG/Exa) | Research        | `IR` | Activity, cached          | 5x, 1s backoff  | None                       | None     | Low    |
| 8   | Web Fetch / URL Retrieval         | Research        | `IR` | Activity, cached          | 5x, 2s backoff  | None                       | None     | Low    |
| 9   | Grep / Ripgrep (code search)      | Code Analysis   | `IR` | Activity, cached          | 5x, 1s backoff  | None                       | None     | Low    |
| 10  | Glob (file pattern matching)      | Filesystem      | `IR` | Activity, cached          | 5x, 1s backoff  | None                       | None     | Low    |

### 11-20: Development & Infrastructure

| #   | Skill                                 | Category        | Type      | Primitive                                | Retry               | Compensation                          | HITL        | Cost   |
| --- | ------------------------------------- | --------------- | --------- | ---------------------------------------- | ------------------- | ------------------------------------- | ----------- | ------ |
| 11  | Git Operations (commit, branch, diff) | Version Control | `SM`      | Activity, idempotency key                | 3x, exponential     | `git revert` / `git branch -D`        | None        | Low    |
| 12  | PostgreSQL Query                      | Database        | `IR`/`SM` | Activity; keyed on write, cached on read | 3x reads, 1x writes | Rollback transaction                  | None        | Low    |
| 13  | Playwright Browser Automation         | Web             | `SS`      | Child workflow, heartbeat 30s            | 2x, session restore | Session cleanup, close browser        | None        | High   |
| 14  | SQLite Operations                     | Database        | `IR`/`SM` | Activity; keyed on write, cached on read | 3x reads, 1x writes | Rollback transaction                  | None        | Low    |
| 15  | Knowledge Graph / Memory (Mem0)       | Memory          | `SM`      | Activity, idempotency key                | 3x, exponential     | Delete created memory entry           | None        | Low    |
| 16  | Context7 (documentation search)       | Code Analysis   | `IR`      | Activity, cached                         | 5x, 1s backoff      | None                                  | None        | Low    |
| 17  | Python REPL / Code Interpreter        | Execution       | `SM`      | Activity, logged                         | 2x, 2s backoff      | None (sandboxed)                      | Optional    | Medium |
| 18  | Desktop Commander (terminal + files)  | System          | `SM`      | Activity, logged                         | 2x, 2s backoff      | None (logged for audit)               | Optional    | Medium |
| 19  | Kubernetes Management                 | Infrastructure  | `CT`      | Saga, exactly-once                       | 1x + HITL optional  | Rollback deployment / delete resource | Recommended | Medium |
| 20  | LSP (jump-to-def, references, types)  | Code Analysis   | `IR`      | Activity, cached                         | 5x, 1s backoff      | None                                  | None        | Low    |

### 21-30: Research, Communication & Finance

| #   | Skill                       | Category       | Type      | Primitive                                   | Retry                | Compensation                | HITL     | Cost      |
| --- | --------------------------- | -------------- | --------- | ------------------------------------------- | -------------------- | --------------------------- | -------- | --------- |
| 21  | Exa Semantic Search         | Research       | `IR`      | Activity, cached                            | 5x, 1s backoff       | None                        | None     | Low       |
| 22  | MySQL Operations            | Database       | `IR`/`SM` | Activity; keyed on write, cached on read    | 3x reads, 1x writes  | Rollback transaction        | None     | Low       |
| 23  | Docker Container Management | Infrastructure | `SM`      | Activity, idempotency key                   | 2x, exponential      | `docker rm` / `docker stop` | Optional | Low       |
| 24  | MongoDB Operations          | Database       | `IR`/`SM` | Activity; keyed on write, cached on read    | 3x reads, 1x writes  | Rollback transaction        | None     | Low       |
| 25  | Slack Messaging             | Communication  | `SM`      | Activity, dedup guard                       | 3x, exponential      | None (message sent is sent) | None     | Low       |
| 26  | Notion Read/Write           | Productivity   | `IR`/`SM` | Activity; cached on read, keyed on write    | 3x reads, 2x writes  | Delete created page/block   | None     | Low       |
| 27  | Obsidian Vault Reader       | Productivity   | `IR`      | Activity, cached                            | 5x, 1s backoff       | None                        | None     | Low       |
| 28  | Agent / Subagent Spawning   | Orchestration  | `LR`      | Child workflow (ParentClosePolicy: ABANDON) | Inherited from child | Cancel child + cleanup      | None     | Per child |
| 29  | Sentry Error Tracking       | Observability  | `IR`      | Activity, cached                            | 5x, 2s backoff       | None                        | None     | Low       |
| 30  | Stripe Payment Operations   | Finance        | `CT`      | Saga, exactly-once                          | 1x + HITL required   | Refund via `RefundCharge`   | Required | Medium    |

### 31-40: Cloud, Productivity & Automation

| #   | Skill                         | Category       | Type      | Primitive                                | Retry               | Compensation                    | HITL        | Cost   |
| --- | ----------------------------- | -------------- | --------- | ---------------------------------------- | ------------------- | ------------------------------- | ----------- | ------ |
| 31  | AWS SDK (S3, Bedrock, ECS)    | Cloud          | `SM`      | Activity, idempotency key                | 3x, exponential     | Delete created resource         | Optional    | Low    |
| 32  | Jira / Atlassian Operations   | Productivity   | `IR`/`SM` | Activity; cached on read, keyed on write | 3x reads, 2x writes | Delete created ticket           | None        | Low    |
| 33  | Puppeteer Browser Automation  | Web            | `SS`      | Child workflow, heartbeat 30s            | 2x, session restore | Session cleanup, close browser  | None        | High   |
| 34  | Grafana Metrics / Dashboards  | Observability  | `IR`      | Activity, cached                         | 5x, 2s backoff      | None                            | None        | Low    |
| 35  | Task Manager (queue-based)    | Orchestration  | `SM`      | Activity, idempotency key                | 3x, exponential     | Dequeue / cancel task           | None        | Low    |
| 36  | Qdrant / Chroma Vector Search | Memory         | `IR`      | Activity, cached                         | 5x, 1s backoff      | None                            | None        | Low    |
| 37  | PDF Document Search (RAG)     | Documents      | `IR`      | Activity, cached                         | 5x, 1s backoff      | None                            | None        | Low    |
| 38  | Cloudflare Workers / KV / R2  | Cloud          | `SM`      | Activity, idempotency key                | 3x, exponential     | Delete deployed worker / KV key | Optional    | Low    |
| 39  | Markdownify (file conversion) | Documents      | `IR`      | Activity, cached                         | 5x, 1s backoff      | None                            | None        | Low    |
| 40  | Vercel Deployment Management  | Infrastructure | `CT`      | Saga, compensation chain                 | 1x + HITL optional  | Rollback deployment             | Recommended | Medium |

### 41-50: Infrastructure, AI/ML & Integration

| #   | Skill                                    | Category       | Type      | Primitive                                     | Retry                         | Compensation                                              | HITL      | Cost     |
| --- | ---------------------------------------- | -------------- | --------- | --------------------------------------------- | ----------------------------- | --------------------------------------------------------- | --------- | -------- |
| 41  | E2B Sandboxed Code Execution             | Execution      | `SM`      | Activity, isolated                            | 2x, exponential               | Destroy sandbox                                           | None      | Medium   |
| 42  | Terraform IaC Management                 | Infrastructure | `CT`      | Saga, compensation chain                      | 1x + HITL required            | `terraform destroy` on created resources                  | Required  | Medium   |
| 43  | PagerDuty Incident Management            | Observability  | `SM`      | Activity, idempotency key                     | 3x, exponential               | Resolve created incident                                  | Optional  | Low      |
| 44  | Linear / Project Management              | Productivity   | `IR`/`SM` | Activity; cached on read, keyed on write      | 3x reads, 2x writes           | Delete created issue                                      | None      | Low      |
| 45  | DALL-E Image Generation                  | AI/ML          | `SM`      | Activity, idempotency key                     | 2x, exponential               | None (generation is one-way)                              | None      | High     |
| 46  | Google Workspace (Gmail, Calendar, Docs) | Productivity   | `IR`/`SM` | Activity; cached on read, dedup on write      | 3x reads, 2x writes           | Delete created event/doc, unsend email (if within window) | Optional  | Low      |
| 47  | Cron / Scheduled Execution               | Orchestration  | `LR`      | Temporal Schedule (replaces native cron)      | N/A (schedule-level)          | Cancel schedule                                           | None      | N/A      |
| 48  | Firecrawl Web Scraping                   | Web            | `IR`      | Activity, cached                              | 5x, 2s backoff                | None                                                      | None      | Medium   |
| 49  | Composio SaaS Connectors (850+)          | Integration    | `SM`      | Activity, idempotency key                     | 3x, exponential               | Varies by connector (see connector-specific docs)         | Optional  | Low      |
| 50  | ClawHub Skill Executor                   | Orchestration  | Variable  | Classified at runtime by SER inference engine | Inherited from classification | Inherited from classification                             | Inherited | Variable |

---

## Execution Contract Format

The same routing contract can be expressed three ways:

- `execution:` block in the skill
- `TAXONOMY.md` default
- runtime inference when neither is sufficient

Preferred author-facing syntax:

```yaml
---
name: stripe-charge
description: Process a payment via Stripe
execution:
  type: critical_transaction
  retry: 1
  idempotent: true
  idempotencyKey: charge_id
  compensation: RefundCharge
  hitl: required
  thinkingCost: medium
---
```

At router time, this normalizes to the same internal contract as the taxonomy row for that skill.

### Compatible Metadata Encoding

When `execution:` is not available or when compatibility with the existing metadata shape is needed, the same contract can be encoded with `tenure.*` fields:

```yaml
---
name: your-skill-name
description: What this skill does
metadata:
  tenure.execution_type: critical_transaction
  tenure.retry: "1"
  tenure.compensation: RefundCharge
  tenure.hitl: required
  tenure.thinking_cost: medium
  tenure.idempotent: "true"
  tenure.idempotency_key: charge_id
  tenure.heartbeat_interval: "30"
---
```

### Field Reference

| Field                       | Values                                                                                                                             | Default (if absent)                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `tenure.execution_type`     | `idempotent_read`, `side_effect_mutation`, `stateful_session`, `critical_transaction`, `long_running_process`, `human_interactive` | Looked up from `TAXONOMY.md`; if not found, classified at runtime |
| `tenure.retry`              | Integer (max retry count)                                                                                                          | Determined by execution type                                    |
| `tenure.compensation`       | Tool name to call on rollback, or `none`                                                                                           | Determined by execution type                                    |
| `tenure.hitl`               | `required`, `recommended`, `optional`, `none`                                                                                      | Determined by execution type                                    |
| `tenure.thinking_cost`      | `low`, `medium`, `high`                                                                                                            | Determined by execution type                                    |
| `tenure.idempotent`         | `true`, `false`                                                                                                                    | Determined by execution type                                    |
| `tenure.idempotency_key`    | Field name in tool input used as dedup key                                                                                         | Auto-generated UUID if not specified                            |
| `tenure.heartbeat_interval` | Seconds between heartbeats (for stateful sessions)                                                                                 | `30`                                                            |
| `tenure.model_tier`         | `frontier`, `mid`, `cheap`, `any`                                                                                                  | `any` (router decides)                                          |
| `tenure.cache_ttl`          | Seconds to cache result (for idempotent reads)                                                                                     | `300`                                                           |

### Validation

```bash
npx tenure scan ./skills
```

Skills with invalid `execution:` or invalid `tenure.*` metadata should be flagged during scan. Skills with no declared contract fall back to `TAXONOMY.md` defaults. Skills not in `TAXONOMY.md` and without a declared contract are classified at runtime by the SER inference engine or flagged as `unknown` depending on the deployment mode.

---

## Edge Cases & Conditional Classification

Some skills change execution type based on context. These are documented here and handled by the SER router's conditional logic.

| Skill                  | Default Type           | Conditional Type         | Trigger                                                                                              |
| ---------------------- | ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| PostgreSQL (#12)       | `IR` (read)            | `SM` (write)             | SQL statement contains `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`                                 |
| Slack (#25)            | `SM` (send)            | `HI` (thread reply wait) | Skill config includes `waitForReply: true`                                                           |
| GitHub API (#6)        | `SM` (create PR)       | `CT` (merge PR)          | Action is `merge` on a PR targeting `main` or `production`                                           |
| Google Workspace (#46) | `IR` (read calendar)   | `SM` (send email)        | Tool name is `SendEmail` vs `ReadCalendar`                                                           |
| AWS SDK (#31)          | `SM` (create resource) | `CT` (delete resource)   | Action contains `Delete`, `Terminate`, or `Destroy`                                                  |
| Composio (#49)         | `SM` (default)         | Varies                   | Mapped per connector; top 20 Composio connectors have individual entries in a future taxonomy update |
| ClawHub Executor (#50) | Variable               | Variable                 | Runtime classification by SER inference engine; no static default                                    |

---

## Notes

- This root taxonomy is the editable version aligned to the repo's current wedge docs.
- The research/context copy remains in `research-direction-context/` as historical input.
- The taxonomy should evolve only in ways that preserve the router-to-timeline boundary described in `RESEARCH-SETUP.md` and `tenure-deep-research-brief.md`.

---

## Changelog

| Date       | Change                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| 2026-04-12 | v0.1.0 — Initial taxonomy with 50 skills, 6 execution types, edge case documentation |
