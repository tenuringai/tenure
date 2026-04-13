# Tenure Deep Research Brief

### SER-First OSS Wedge

### Budget: $100 equivalent research effort · Output: three machine-readable artifacts plus one canonical proof story

---

## Context For The Research Agent

Tenure is not trying to prove the whole long-term platform in this research pass.

This brief is for proving one narrow but foundational claim:

**OpenClaw can keep reasoning while Tenure takes ownership of execution through the SER router, with Temporal Event History becoming the source of truth for crash recovery.**

The hard boundary is:

- OpenClaw owns thinking
- Tenure owns execution
- Temporal owns the timeline

Every tool call must:

1. pass through the SER router
2. be classified by execution type
3. be routed into the correct Temporal primitive
4. land on the Temporal execution timeline

If a call bypasses the router and executes as a raw in-memory function call, it becomes uncounted, untyped, unreplayable, and unrevocable. One leaked call breaks the taming promise.

This brief therefore optimizes for adapter correctness first, taxonomy second, and market/story validation third.

Within that model, the `execution:` block is the declaration layer. It declares the contract a skill author wants enforced. SER plus the Temporal timeline are still the enforcement layer.

---

## What Must Be Proven First

The proof ladder is:

### Proof 0: Read Replay

Goal:

- prove that replay works at all
- use an idempotent read so failure means a fundamental adapter problem, not a side-effect bug

### Proof 1: No-Duplicate Deterministic Write

Goal:

- use a deterministic file write through Node.js `fs`
- kill the Worker after the write completes but before result delivery
- prove replay returns the cached execution result without writing twice

### Proof 2: Cron Durability

Goal:

- replace fragile in-process cron with Temporal Schedule
- kill the Worker
- miss scheduled intervals
- restart the Worker
- prove catch-up occurs according to policy without duplicates

That final proof is the public wedge because it maps directly to the founder pain: cron crashes and token burn.

---

## Canonical Public Proof

The canonical public demo is:

1. configure an agent to append one timestamped line to `log.txt` every 60 seconds
2. let it run for 3 successful cycles
3. SIGKILL the Worker
4. leave it down long enough to miss 2 cycles
5. restart the Worker
6. Temporal Schedule catches up according to policy
7. verify `log.txt` contains the expected lines with no process-death gaps and no replay duplicates
8. verify sequence number and file hash

This one proof should be packaged three ways:

- `demo`: what a developer watches
- `certification`: what they run themselves
- `distribution`: what gets posted in OpenClaw Issue `#10164`

---

## Research Priorities

Strict priority order:

1. prove OpenClaw adapter correctness
2. convert the proof into a certification
3. validate the taxonomy and routing model against the proven boundary
4. validate community claims and package the public story

If priority 1 fails, do not paper over it with broader positioning.

---

## Artifact 1: Crash Recovery Determinism Matrix

**File:** `output/crash-recovery-matrix.json`

This is the most important artifact.

### What This Artifact Must Answer

For each crash point in the OpenClaw execution loop:

- what did OpenClaw persist before the crash?
- why is that persisted state insufficient for correct recovery?
- what state still existed only in memory?
- what must Tenure capture at the execution boundary chosen by the router?
- what Temporal primitive should own the checkpoint?
- is replay safe, and under what condition?

The goal is not just to list crash points. The goal is to prove why OpenClaw's own persistence cannot be the recovery mechanism and why the authoritative recovery path must be Temporal history.

### Required Coverage

Cover at least these categories:

1. mid-LLM inference
2. tool decision emitted, execution not started
3. mid-tool execution
4. tool complete, result not yet delivered
5. context compaction
6. SKILL.md loading
7. cron trigger processing
8. multi-agent communication
9. Gateway reconnect
10. sandbox/container execution

Sub-variants should be split when the recovery semantics differ.

Expected output: 15–25 entries.

### Required Schema

```json
{
  "crash_point_id": "CP-004",
  "crash_point_name": "Tool complete, result not yet delivered",
  "openclaw_component": "Agent Runtime -> Local Execution",
  "source_files": [
    "src/agents/pi-embedded-subscribe/handlers/tools.ts",
    "src/node-host/invoke.ts"
  ],
  "openclaw_persisted_before_crash": [
    "Prior transcript entries on disk"
  ],
  "why_openclaw_persistence_is_insufficient": [
    "The completed tool result is not yet represented in a replay-safe execution record",
    "Disk history alone cannot authoritatively reconstruct the interrupted execution step"
  ],
  "state_in_memory_only": [
    "Completed tool result buffer",
    "Pending delivery state"
  ],
  "tenure_checkpoint_required": [
    "Tool call ID",
    "Tool parameters",
    "Serialized execution result"
  ],
  "temporal_primitive": "Activity",
  "replay_safe": true,
  "replay_safe_reason": "Temporal replays the completed execution result from history instead of re-running the side effect",
  "side_effects_possible": true,
  "idempotency_required": true,
  "test_case": {
    "description": "Deterministic file write completes, Worker dies before result delivery, replay resumes without rewriting file",
    "setup": "Run a file-write execution, SIGKILL the Worker after completion and before next-step delivery",
    "assertion": "File hash unchanged, result delivered once, workflow continues"
  },
  "paper_references": ["[TAMU-190]"],
  "community_references": ["[ISSUE-10164]"],
  "severity": "critical"
}
```

### Additional Requirements

- cite concrete OpenClaw source files and functions
- cross-reference the Texas A&M taxonomy where relevant
- identify blockers where OpenClaw introduces non-determinism that cannot be tolerated at the workflow layer
- explicitly call out known or suspected issue links when they support the crash point

---

## Artifact 2: Skill-To-Durability Mapping

**File:** `output/skill-durability-mapping.json`

This artifact is downstream of the adapter proof.

It must also define the bridge between:

- author-declared `execution:` blocks
- taxonomy defaults
- runtime inference for unknown calls

### What This Artifact Must Do

For the top 30 OpenClaw skills:

- identify the primary execution type
- identify at least two edge cases when classification changes or retry semantics must change
- provide runtime-detectable signals
- define the router override or routing tree
- indicate whether static classification is sufficient

### Important Framing

Do not treat the taxonomy as an abstract standard disconnected from execution.

The classification matters only because the router uses it to choose the Temporal primitive that lands on the execution timeline. The question is not just "what is this skill?" It is "what primitive must own this call if we want replay, no-duplicate semantics, and taming to hold?"

The same classification should be expressible three ways:

- directly by the skill author via `execution:`
- indirectly through `TAXONOMY.md`
- dynamically through runtime inference

### Required Schema

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
      "detection_signal": "Presence of waitForReply in skill config or metadata",
      "why_primary_is_wrong": "The call must block on external human response instead of behaving like a fire-and-forget mutation",
      "temporal_primitive_override": "Signal / wait",
      "thinking_cost_override": "Zero while waiting"
    }
  ],
  "conditional_classification_tree": {
    "default": "side_effect_mutation -> keyed execution",
    "if waitForReply": "human_interactive -> signal / wait"
  },
  "static_classification_sufficient": false,
  "runtime_inference_required": true,
  "runtime_inference_signals": [
    "Presence of waitForReply in skill config"
  ],
  "agentskills_metadata": {
    "tenure.execution_type": "side_effect_mutation",
    "tenure.retry": "3",
    "tenure.compensation": "none",
    "tenure.hitl": "none",
    "tenure.thinking_cost": "low"
  },
  "execution_block": {
    "type": "side_effect_mutation",
    "retry": 3,
    "compensation": "none",
    "hitl": "none",
    "thinkingCost": "low"
  }
}
```

### Additional Requirements

- edge-case signals must be observable from parameters, metadata, or execution history available to the router
- identify any skill that truly requires per-invocation classification instead of per-skill classification
- explain what extra information is needed when confidence is low
- cross-reference `cik-taxonomy.pdf` and `taming-26.pdf` where relevant
- treat `execution:` as the preferred author-facing contract, with metadata as a compatible encoding that normalizes to the same router input

---

## Artifact 3: Community Evidence Validation

**File:** `output/community-evidence-validation.json`

This artifact supports the public wedge story.

### Section 3a: Seven Gaps Closure Matrix

For each missing capability identified in the community research:

- say what the community thinks is missing
- identify which Tenure primitive or mechanism addresses it
- say whether the gap is actually closed
- name any remaining risk

### Section 3b: Framework Failure-Mode Test Cases

For each documented framework failure:

- define the failure mode clearly
- define the Tenure test case that proves the failure does not recur
- map the test to the relevant certification where possible

Minimum frameworks:

- LangChain
- LangGraph
- CrewAI
- AutoGen
- Google ADK
- Pydantic AI

### Section 3c: Quantitative Claims Verification

For each numerical claim:

- trace the source
- mark whether the primary source is verified
- rate the reliability honestly
- say how Tenure's architecture changes the situation, if at all

### Required Framing

This artifact must not become vague market copy. It should help make the README, demo, and Issue `#10164` comment more credible by grounding them in community evidence.

---

## Output Format

Deliver three JSON files:

1. `crash-recovery-matrix.json`
2. `skill-durability-mapping.json`
3. `community-evidence-validation.json`

Plus a concise narrative summary covering:

- the three most dangerous crash points
- the single strongest adapter-boundary insight
- the five most surprising taxonomy edge cases
- any blockers that prevent the adapter from shipping
- how the canonical cron proof should be described publicly

---

## How This Research Becomes Code

`crash-recovery-matrix.json`

- becomes crash-recovery certification tests
- defines the adapter checkpoint contract
- provides the strongest OSS wedge evidence

`skill-durability-mapping.json`

- becomes taxonomy rows and router rules
- sharpens static classification vs runtime inference

`community-evidence-validation.json`

- becomes README proof support, docs citations, and Issue `#10164` material

---

## Sources To Consult

Primary code:

- OpenClaw source code, especially `src/agents/`, `src/gateway/`, `src/node-host/`, `src/plugins/`

Research and security context:

- Texas A&M OpenClaw vulnerability taxonomy
- Taming OpenClaw
- CIK taxonomy paper
- Claw-6 evaluation
- GRIP
- FASA

Execution-model references:

- Temporal docs on replay determinism, Activities, child workflows, signals, and schedules
- `temporal-ai-agent`
- `zeitlich`

Community evidence:

- founder Reddit thread
- community reliability research
- OpenClaw Issue `#10164`
- validated OpenClaw persistence/restart issues
- LangGraph RFC `#6617`
- Pydantic AI Issue `#83`

---

## Success Condition

This research pass is successful when:

- the adapter boundary is clear
- the authoritative recovery mechanism is clearly Temporal history, not OpenClaw session files
- the read -> write -> cron proof ladder is reflected across all artifacts
- the resulting evidence is strong enough to anchor both `README.md` and the eventual Issue `#10164` comment

