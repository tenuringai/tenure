The six from the taxonomy. One harness per execution type. Each harness tests the specific failure mode that execution type must survive.

**Harness 1: Idempotent Read** (20 points of the score)

Tests: replay returns cached result without re-executing the call. Run the Activity, record the result in Event History, kill the Worker, restart, verify the replayed result is identical and the underlying function was NOT called again. The mock is a counter — if the function executes twice, the counter increments and the test fails.

Skills tested by this harness: web search, file read, grep, git log, database SELECT, vector search, documentation lookup.

**Harness 2: Side-Effect Mutation** (20 points of the score)

Tests: kill after write completes, replay produces zero duplicates. Run 100 sequential writes with idempotency keys, SIGKILL at a random point, restart Worker, verify exactly 100 outputs exist — not 99 (gap) and not 101 (duplicate). The mock is a file write with a sequence number.

Skills tested by this harness: file write, git commit, Slack send, Notion create, email send, calendar event create.

**Harness 3: Stateful Session** (scored within crash recovery, 20 points shared)

Tests: heartbeat timeout detects a hung session, session restores from last checkpoint on crash rather than replaying from the beginning. Start a mock session that heartbeats every 30 seconds with a progress payload, stop heartbeating (simulating a hang), verify the Workflow detects the timeout within the configured window, verify the session restarts from the last heartbeat state.

Skills tested by this harness: Playwright browser, Browserbase, Puppeteer, any long-lived connection-based tool.

**Harness 4: Critical Transaction** (15 points HITL + 20 points crash recovery shared)

Tests two things. First, the HITL gate fires — the Workflow pauses on a Signal before executing the Activity, and does not proceed until approval is received. Second, the saga compensation fires — the Activity executes, a downstream step fails, and the compensation action (e.g., refund) executes automatically. Mock: a charge function that records its call count, a refund function that records its call count. Verify charge called exactly once, verify refund called exactly once after downstream failure.

Skills tested by this harness: Stripe charge, Terraform apply, Kubernetes deploy, git push to main, database DROP/DELETE.

**Harness 5: Long-Running Process** (scored within crash recovery + budget, shared points)

Tests: child Workflow runs independently of parent, parent death does not kill child (ParentClosePolicy ABANDON), child has its own budget tracked separately. Start a parent Workflow that spawns a child, kill the parent, verify the child continues executing. Also verify the child's token spend is attributed to the child's budget, not the parent's.

Skills tested by this harness: subagent spawn, video render, batch processing, long-running research tasks.

**Harness 6: Human-Interactive** (15 points HITL compliance)

Tests: zero compute while waiting. Start a Workflow that reaches a Signal wait (approval request), measure resource consumption during the wait period, verify no LLM calls are made, no Activities are dispatched, and no tokens are consumed until the Signal arrives. The mock sends the approval Signal after a 10-second delay. Verify the Workflow resumes correctly and the 10 seconds of waiting cost nothing.

Skills tested by this harness: approval gates, clarification requests, feedback collection, any skill with `waitForReply`.

**How the score computes:**

Each of the 50 skills maps to one harness (or two for conditional overrides). The harness runs. Pass or fail. The points from each category sum to 100.

```
Crash Recovery     (Harnesses 1-5)     20 points
No-Duplicate       (Harness 2)         20 points
Budget Compliance  (Harness 5+6)       15 points
HITL Compliance    (Harness 4+6)       15 points
Taxonomy Coverage  (all harnesses)     10 points
Perf Baseline      (historical)        20 points
─────────────────────────────────────────────────
Total                                 100 points
```

A skill that passes all six harnesses but has no performance history scores 80. The last 20 points require 5+ successful runs over time — proof that the skill is not just durable in a test but durable in production. That is why the score is a gradient, not a binary. Durability is earned, not declared.

Six harnesses. One score. Every skill in the ecosystem measured on the same scale. That is the product.