# Tenure Deep Research Brief

### Crash Recovery Determinism & Skill-to-Durability Mapping

### Budget: $100 · Output: Two machine-readable artifacts for direct codebase integration

---

## Context for the Research Agent

Tenure is a durable skill development platform for OpenClaw. It wraps OpenClaw agent sessions in Temporal workflows so that every tool call survives crashes, retries with the correct policy, and never duplicates a side-effecting operation. The core promise is: kill the agent process at any point, and it resumes from the exact tool call that was interrupted with zero data loss and zero duplicate actions.

This promise depends on two things being correct: (1) the crash recovery mechanism must handle every possible crash point in the OpenClaw agent loop, and (2) every skill must be classified with the correct execution semantics so the Temporal primitive wrapping it behaves appropriately on replay.

This research produces the engineering specifications for both. The output is not a narrative paper — it is structured data that ships directly into the codebase as test cases and classification rules.

---

## Artifact 1: Crash Recovery Determinism Matrix

### What This Is

A systematic analysis of every point in the OpenClaw agent runtime where a process termination (SIGKILL, OOM, container eviction, network partition, power loss) results in state loss, and for each point, the precise recovery strategy required.

### Why This Matters

Temporal's replay model requires deterministic workflow code. On crash, a new Worker replays the Event History to reconstruct the workflow's state up to the failure point, then continues execution. If any step in the OpenClaw agent loop introduces non-determinism (clock reads, random values, direct API calls outside Activities, mutable global state), replay diverges and recovery fails silently or catastrophically.

OpenClaw's architecture has seven interacting components (as documented in the Texas A&M security taxonomy, arXiv:2603.27517v1): Channel System, Gateway, Plug-ins & Skills System, Agent Runtime, Memory & Knowledge System, LLM Provider, and Local Execution. Each component holds different state in memory, persists different state to disk, and fails differently under process termination. The crash recovery matrix must map every component.

### Research Instructions

Analyze the OpenClaw source code (github.com/openclaw/openclaw) and its runtime architecture. For each of the following crash points, produce a structured entry:

**Crash Point Categories to Investigate:**

1. Mid-LLM-inference — the model is generating tokens when the process dies. The partial response exists only in the streaming buffer. What is lost? Can the inference be restarted from scratch safely, or does the prior context need reconstruction?
2. Between tool call decision and tool call execution — the LLM has emitted a tool call (e.g., `{"tool": "send_email", "params": {...}}`) but the tool has not yet been invoked. The tool call decision is in the agent's message history but no side effect has occurred.
3. Mid-tool-call execution — the tool is executing (e.g., a Playwright browser session navigating a page, an HTTP request in flight to Stripe, a file write partially completed). The tool may have produced partial side effects.
4. Between tool call completion and result delivery to LLM — the tool has returned a result but the result has not yet been appended to the conversation history for the next LLM turn.
5. During context compaction — OpenClaw's memory system is compressing conversation history (summarizing prior turns to reduce token count). The compacted summary exists only in memory.
6. During SKILL.md loading — a skill is being loaded from ClawHub or the local plugin directory into the agent's context window. The skill instructions are partially loaded.
7. During cron trigger processing — the cron scheduler is firing a periodic task. The cron message has been generated but the agent session has not yet received it.
8. During multi-agent communication — in a multi-agent deployment, one agent is sending a message to a peer agent via the Gateway's inter-agent messaging. The message is in transit.
9. During Gateway WebSocket reconnection — the connection between the Agent Runtime and the Local Execution Node-Host has dropped and is reconnecting. Commands are queued but not dispatched.
10. During Docker sandbox execution — a tool call is executing inside a Docker container via `docker exec`. The container may have produced partial output.

### Required Output Schema (JSON)

For each crash point, produce:

```json
{
  "crash_point_id": "CP-003",
  "crash_point_name": "Mid-tool-call execution",
  "openclaw_component": "Agent Runtime → Local Execution",
  "source_files": [
    "src/agents/pi-embedded-subscribe/handlers/tools.ts",
    "src/node-host/invoke.ts"
  ],
  "state_in_memory_only": [
    "Tool execution progress (e.g., bytes written to file, HTTP request in flight)",
    "Partial tool result buffer"
  ],
  "state_persisted_before_crash": [
    "Tool call decision in conversation history",
    "Temporal Activity scheduled event in Event History"
  ],
  "side_effects_possible": true,
  "side_effects_description": "The tool may have partially completed: email sent, file partially written, API request received by remote server but acknowledgment not received by agent",
  "recovery_strategy": "Activity retry with idempotency key. The Temporal Activity wrapping this tool call will be retried on a new Worker. If the tool is idempotent (reads), retry is safe. If the tool is side-effecting (writes), the retry must use an idempotency key to prevent duplicate execution.",
  "replay_safe": false,
  "replay_safe_reason": "Side-effecting tools may have completed on the remote server. Replaying without idempotency key causes duplicate.",
  "idempotency_required": true,
  "compensation_required": "Only if downstream steps fail after this tool succeeded",
  "minimum_checkpoint_data": [
    "Tool call ID (for idempotency key)",
    "Tool name and parameters",
    "Temporal Activity task token"
  ],
  "temporal_primitive": "Activity with StartToCloseTimeout and HeartbeatTimeout",
  "test_case": {
    "description": "SIGKILL during HTTP POST to Stripe API. Verify: charge created exactly once, agent resumes with charge result, next tool call executes correctly.",
    "setup": "Start agent with Stripe skill, trigger charge tool call, send SIGKILL after HTTP request sent but before response received",
    "assertion": "Stripe dashboard shows exactly 1 charge. Agent conversation history contains charge result. Next tool call in sequence executes without re-triggering charge."
  },
  "non_determinism_risks": [
    "If tool call generates a random request ID inside workflow code instead of inside the Activity, replay produces a different ID and idempotency check fails",
    "If tool call reads system clock inside workflow code for timeout calculation, replay may compute a different timeout"
  ],
  "severity": "critical",
  "notes": "This is the highest-risk crash point because partial side effects are possible and the recovery strategy depends entirely on correct idempotency key propagation."
}
```

### Deliver All Crash Points

Produce the above schema for all 10 crash point categories. Where a category has multiple sub-variants (e.g., "mid-tool-call" varies by tool type — file write vs. API call vs. browser session), enumerate the sub-variants as separate entries with the same crash_point_id prefix (CP-003a, CP-003b, CP-003c).

Expected output: 15–25 crash point entries covering the full OpenClaw agent loop.

### Additional Requirements for Artifact 1

Cross-reference the Texas A&M security taxonomy (arXiv:2603.27517v1) for any crash points that also constitute security vulnerabilities. The paper identifies 190 advisories across 10 architectural layers — note where crash recovery gaps overlap with known security issues.

For each crash point, cite the specific OpenClaw source file and function where the vulnerable state exists. Use the current main branch of the OpenClaw repository.

Identify any crash points where Temporal's replay model is fundamentally incompatible with OpenClaw's architecture (e.g., if OpenClaw uses non-deterministic operations that cannot be wrapped in Activities without modifying OpenClaw's core code). These are blockers that must be resolved before the adapter can ship.

---

## Artifact 2: Skill-to-Durability Mapping with Edge Case Annotations

### What This Is

A structured classification of the top 30 most-adopted OpenClaw skills, with specific focus on edge cases where the obvious execution type classification is wrong or insufficient.

### Why This Matters

The TAXONOMY.md file classifies 50 skills into six execution types. This classification is correct for the common case but insufficient for production. A Slack "send message" skill looks like a simple side-effecting mutation, but if the skill opens a thread, waits for a reply, and routes the reply back to the agent, it is actually a human-interactive signal pattern. A PostgreSQL skill looks like a mixed read/write, but if it runs inside a transaction that spans multiple tool calls, it needs saga compensation across the transaction boundary.

These edge cases define the boundary between the open-source static taxonomy (which handles the common case) and the proprietary runtime inference engine (which handles the exceptions). The research must identify every edge case so the static taxonomy can document them and the inference engine can detect them.

### Research Instructions

For each of the top 30 OpenClaw skills (ranked by ClawHub installs, awesome-openclaw-skills inclusion, and cross-ecosystem adoption), produce:

```json
{
  "skill_name": "slack-messaging",
  "skill_rank": 25,
  "source": "ClawHub / built-in",
  "primary_execution_type": "side_effect_mutation",
  "primary_classification_confidence": 0.7,
  "edge_cases": [
    {
      "condition": "Skill config includes waitForReply: true",
      "actual_execution_type": "human_interactive",
      "detection_signal": "Presence of 'waitForReply', 'thread', or 'listen' in skill config or SKILL.md instructions",
      "why_primary_is_wrong": "The skill blocks on an external human response. Treating it as a fire-and-forget mutation means the workflow continues without the reply, producing incorrect downstream behavior. It must pause via a Temporal Signal and wait for the reply event.",
      "temporal_primitive_override": "Signal / waitForEvent instead of Activity",
      "thinking_cost_override": "Zero while waiting (no inference during human wait)"
    },
    {
      "condition": "Skill sends to a channel with rate limiting (e.g., Slack API 1 msg/sec)",
      "actual_execution_type": "side_effect_mutation (unchanged)",
      "detection_signal": "Target channel has > 10 pending messages in queue",
      "why_primary_is_wrong": "Primary classification is correct but retry policy must change. Default 3x exponential retry will violate rate limits. Needs rate-limit-aware backoff (respect Retry-After header).",
      "temporal_primitive_override": "Activity with custom retry policy reading Retry-After",
      "thinking_cost_override": "None"
    }
  ],
  "conditional_classification_tree": {
    "default": "side_effect_mutation → Activity, dedup guard, 3x retry",
    "if waitForReply": "human_interactive → Signal, zero compute",
    "if rate_limited": "side_effect_mutation → Activity, rate-limit-aware retry",
    "if thread_mode": "side_effect_mutation → Activity, idempotency key = thread_ts"
  },
  "static_classification_sufficient": false,
  "runtime_inference_required": true,
  "runtime_inference_signals": [
    "Presence of 'waitForReply' in skill config",
    "Presence of 'thread' or 'listen' keywords in SKILL.md instructions",
    "Slack API rate limit headers in recent responses"
  ],
  "agentskills_metadata": {
    "tenure.execution_type": "side_effect_mutation",
    "tenure.retry": "3",
    "tenure.compensation": "none",
    "tenure.hitl": "none",
    "tenure.thinking_cost": "low",
    "tenure.conditional_override": "waitForReply→human_interactive"
  }
}
```

### Required Coverage

Produce the above schema for all 30 skills. Prioritize skills where edge cases are most likely to cause production failures:

Skills 1–10: Core primitives (Sequential Thinking, Shell/Bash, File Read/Write/Edit, GitHub API, Web Search, Web Fetch, Grep, Glob)

Skills 11–20: Infrastructure and data (Git, PostgreSQL, Playwright, SQLite, Mem0, Context7, Python REPL, Desktop Commander, Kubernetes, LSP)

Skills 21–30: Communication, finance, and orchestration (Exa, MySQL, Docker, MongoDB, Slack, Notion, Obsidian, Subagent Spawn, Sentry, Stripe)

For each skill, identify a minimum of two edge cases. If a skill has no meaningful edge cases (e.g., a pure read with no conditional behavior), document why the static classification is sufficient and set `static_classification_sufficient: true`.

### Additional Requirements for Artifact 2

For each edge case, provide the specific detection signal that the SER router would use to identify the edge case at runtime. These signals must be observable from the tool call parameters, the SKILL.md metadata, or recent execution history — not from the tool's internal implementation (which the router cannot inspect).

For skills where the primary classification has confidence below 0.8, explain what additional information would be needed to raise confidence, and whether that information is available at classification time or only after execution.

Identify any skills where no single execution type is correct — where the skill genuinely operates in multiple modes and the classification must be determined per-invocation rather than per-skill. These skills are the strongest justification for the runtime inference engine.  
  
No. The deep research brief covers crash recovery determinism and skill-to-durability mapping, but it does not instruct the research agent to cross-reference this community evidence document. That is a gap. Here is what is missing and how to fix it.

The community research contains three categories of data that the $100 research should validate and extend.

**Category 1: The Seven Gaps Table.** The research document identifies seven capabilities no framework addresses — read/write classification, per-tool retry, idempotency keys, compensation/saga, exactly-once execution, circuit breakers, and error classification. The deep research brief asks for skill classification and crash recovery but does not ask the research agent to verify that tenure's architecture closes all seven gaps. It should. The research output should include a validation matrix: for each of the seven gaps, which tenure primitive addresses it, and is there any gap that remains open.

**Category 2: Framework-Specific Failure Modes.** The community document maps each framework's current state — LangChain's node-level retry that retries the entire node, CrewAI's lack of native per-tool retry, AutoGen's conversational retry that burns tokens, Google ADK's uniform ReflectAndRetryPlugin, Pydantic AI's unshipped Issue #83. The deep research brief does not ask the research agent to test whether tenure's SER router actually handles the specific failure modes these frameworks exhibit. For example: does tenure's Activity-level retry avoid LangChain's "retry the whole node" problem? Does tenure's signal-based HITL avoid LangGraph's "graph sometimes resumes from the wrong point" bug? These are concrete test cases the research should produce.

**Category 3: Quantitative Claims.** The community document cites specific numbers — 3–15% tool call failure rate, 95% per-step accuracy yielding 60% end-to-end success, 89% of production LangChain apps ignoring official patterns, 3–5% duplicate rate from Vercel AI SDK Issue #7261. The deep research brief does not ask the research agent to verify these numbers against primary sources or to measure tenure's improvement over them. The research output should include a "claims verification" section that traces each number to its original source and assesses its reliability.

Here is the addendum to append to the research brief.

---

**Artifact 3: Community Evidence Validation & Gap Closure Matrix**

Cross-reference the attached community research document ("AI agents retry everything the same way — and the community knows it's broken") against tenure's architecture. Produce three outputs.

**Output 3a: Seven Gaps Closure Matrix.** For each of the seven capabilities identified in the community research (read/write classification, per-tool retry, idempotency keys, compensation/saga, exactly-once execution, circuit breakers, error classification), document which tenure primitive addresses it, how it is configured, and whether any gap remains open. If a gap remains, propose the specific implementation needed to close it.

```json
{
  "gap": "read_write_classification",
  "community_status": "Pydantic AI conceptually distinguishes retrievers vs tools; no framework ships it",
  "tenure_primitive": "SER router execution type classification",
  "implementation": "TAXONOMY.md + tenure.execution_type metadata field",
  "gap_closed": true,
  "remaining_risk": "Unknown skills without metadata fall back to runtime inference (cloud only); self-hosted users get 'unknown' classification"
}

```

**Output 3b: Framework Failure Mode Test Cases.** For each framework-specific failure mode documented in the community research, produce a test case that verifies tenure does not exhibit the same failure. These test cases ship alongside the crash-recovery certification.

```json
{
  "framework": "LangChain/LangGraph",
  "failure_mode": "RetryPolicy operates at node level, not tool level. A node containing multiple tools retries the entire node.",
  "community_source": "LangGraph documentation + community reports",
  "tenure_test_case": {
    "description": "Trigger two tool calls in sequence within one workflow step: an idempotent read followed by a side-effecting write. Fail the write. Verify that only the write retries, not the read.",
    "assertion": "Read result is returned from Activity cache. Write retries with idempotency key. Read is not re-executed.",
    "certification": "no-duplicate"
  }
}

```

Produce test cases for at minimum: LangChain's node-level retry, LangGraph's HITL resume-from-wrong-point bug, CrewAI's false completion reporting, AutoGen's token-intensive conversational retry, Google ADK's uniform retry treating all tools identically, and Pydantic AI's inability to retry individual tools.

**Output 3c: Quantitative Claims Verification.** For each numerical claim in the community research, trace it to its primary source, assess reliability, and note whether tenure's architecture changes the number.

```json
{
  "claim": "Tool calls fail 3-15% of the time in production",
  "source": "Production practitioner report (cited in community research)",
  "primary_source_verified": false,
  "primary_source_url": null,
  "reliability_assessment": "Corroborated by Vercel AI SDK Issue #7261 (3-5% duplicate rate) and multiple independent Reddit reports. Range is plausible but not peer-reviewed.",
  "tenure_impact": "SER router's per-type retry policy reduces effective failure rate by retrying idempotent reads aggressively (lowering the 3-15% for reads) while preventing dangerous retries on writes (converting write failures into HITL escalations rather than silent retries)."
}

```

Verify at minimum: the 3–15% failure rate, the 95%/60% compounding math, the 89% LangChain pattern-ignoring claim, the 3–5% Vercel duplicate rate, and the "$3,600 monthly bill" OpenClaw cost report.

---

Add this as Artifact 3 to the research brief. The total output is now three JSON files: `crash-recovery-matrix.json`, `skill-durability-mapping.json`, and `community-evidence-validation.json`. Together they cover the engineering foundation (crash recovery), the classification system (skill mapping), and the market validation (community evidence). All three produce code — test cases, routing rules, and cited claims for the README.

---

## Output Format

Deliver two JSON files:

1. `crash-recovery-matrix.json` — array of 15–25 crash point entries per the schema in Artifact 1
2. `skill-durability-mapping.json` — array of 30 skill entries per the schema in Artifact 2

Plus a narrative summary (max 2,000 words) highlighting:

The three most dangerous crash points that are most likely to cause data loss or duplicate actions in production, and the specific Temporal configuration required to mitigate each.

The five skills with the most surprising edge cases — where the obvious classification would cause production failures — and how the static taxonomy should document the override.

Any blockers discovered — cases where Temporal's replay model is fundamentally incompatible with OpenClaw's architecture and the adapter cannot work without upstream OpenClaw changes.

---

## How This Research Becomes Code

`crash-recovery-matrix.json` → each entry's `test_case` field becomes a test in `src/certify/crash-recovery.test.ts`. The crash-recovery certification runs these tests. Every entry's `non_determinism_risks` field becomes a code comment in the OpenClaw adapter documenting what must not happen inside workflow code.

`skill-durability-mapping.json` → each entry's `agentskills_metadata` field becomes a row in TAXONOMY.md. Each entry's `conditional_classification_tree` becomes a routing rule in `src/router/classify.ts`. Each entry's `runtime_inference_signals` becomes a feature for the embedding-based classifier in the cloud product.

The narrative summary becomes the technical basis for the "Edge Cases & Conditional Classification" section of TAXONOMY.md and is cited in the research paper at `docs/research/semantic-execution-routing.md`.

---

## Sources to Consult

Primary: OpenClaw source code (github.com/openclaw/openclaw) — current main branch, focus on src/agents/, src/gateway/, src/node-host/, src/plugins/

Security context: "A Systematic Taxonomy of Security Vulnerabilities in the OpenClaw AI Agent Framework" (arXiv:2603.27517v1, Texas A&M, February 2026) — 190 advisories mapped to 10 architectural layers

Temporal documentation: docs.temporal.io — focus on Activity execution, replay determinism, heartbeating, continueAsNew, and the non-determinism constraints for workflow code

agentskills.io specification: agentskills.io/specification — the SKILL.md format, frontmatter fields, and metadata extensibility

Community data: r/openclaw threads on crash recovery, token burn, and production reliability — for real-world failure modes not documented in source code

Zeitlich source code: github.com/bead-ai/zeitlich — for the ThreadOps and SandboxOps patterns that inform how session state should be captured and restored

ClawHub registry and awesome-openclaw-skills: for skill popularity rankings and real-world usage patterns

