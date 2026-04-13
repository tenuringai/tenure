# Tenure Research Setup Guide

### SER-First OSS Wedge

### April 12, 2026

---

## 1. Source Of Truth

This document is the primary source of truth for Tenure's research direction.

The current wedge is not the full long-term platform. The wedge is:

- OpenClaw adapter correctness
- Semantic Execution Router taxonomy
- Certifications that prove the adapter actually works
- A public proof story that the OpenClaw community can verify quickly

Within that wedge, the `execution:` block belongs at the declaration layer, not the proof layer. It tells Tenure how a skill says it should execute safely. SER plus the Temporal timeline still enforce and verify that contract.

Everything else is downstream. If the adapter cannot route one OpenClaw tool call through the SER router into the correct Temporal primitive and recover after a crash without duplicating side effects, the rest of the product is fiction.

---

## 2. Core Thesis

OpenClaw is the brain. Tenure is the nervous system.

OpenClaw is still responsible for:

- LLM inference
- prompt assembly
- SKILL.md loading
- tool selection
- tool parameters
- agent UX

Tenure becomes responsible the moment a tool call crosses into execution:

- tool execution
- checkpointing
- retries
- compensation
- no-duplicate guarantees
- budget enforcement
- shift lifecycle
- crash recovery

The key architectural claim is:

**Temporal Event History becomes the authoritative record of execution. OpenClaw's own persisted session artifacts are secondary logs, not the recovery mechanism. Every call must pass through the SER router and land on the Temporal timeline via the primitive the router selects.**

That matters because the problem is not merely that OpenClaw saves too little. The harder problem is that OpenClaw saves some state, sometimes, but cannot reliably reconstruct a running agent from that state after a crash. The research program should assume that OpenClaw persistence is insufficient until proven otherwise.

---

## 3. What Must Be Proven

Tenure needs one stacked proof expressed at three zoom levels:

- `Demo`: a developer watches it and thinks "that works"
- `Certification`: they run it and think "that works for me"
- `Distribution`: they see the OpenClaw issue comment and think "someone finally built this"

These are not separate projects. They are the same proof packaged for three audiences.

### Proof Ladder

#### Proof 0: Replay Works At All

Start with an idempotent read.

Goal:

- prove that the adapter can survive a crash and replay a read result correctly from Temporal history
- detect fundamental replay bugs quickly, before debugging side effects

#### Proof 1: Canonical No-Duplicate Write

Use a deterministic file write through Node.js `fs`, not shell.

Goal:

- kill the Worker after the write completes but before the result is delivered to the next reasoning step
- on replay, return the cached execution result without re-running the side effect
- verify the file contents appear exactly once

#### Proof 2: Cron Durability

The public wedge proof should be cron durability, not only a manual one-off task.

Goal:

- replace fragile in-process cron with Temporal Schedule
- survive Worker death
- catch up missed triggers
- avoid duplicate writes

This maps directly to the founder pain: "tired of cron jobs crashes and fear of max token burn."

---

## 4. Canonical Public Proof

This is the main proof to optimize the research around.

### Cron Demo

1. Configure an agent with a cron-style schedule: every 60 seconds, append one timestamped line to `log.txt`
2. Let the system run for 3 successful cycles
3. SIGKILL the Worker process
4. Leave the Worker down long enough to miss 2 cycles
5. Start a new Worker
6. Temporal Schedule catches up according to the chosen overlap/catch-up policy
7. `log.txt` contains the expected lines with no gaps caused by process death and no duplicates caused by replay
8. The sequence number and file hash verify exactly-once behavior for each scheduled write

### Why This Demo Matters

It proves three things at once:

- crash recovery
- cron durability
- no-duplicate side effects

It is also the clearest possible answer to OpenClaw Issue `#10164`.

---

## 5. Research Priorities

Priority order is strict:

1. Prove OpenClaw adapter correctness
2. Convert the proof into a certification
3. Use that proof to validate the taxonomy and routing layer
4. Use the proof and certification in the public distribution story

If Priority 1 fails, do not hide it behind richer docs or broader positioning.

### Where `execution:` Fits

- `execution:` is the author-facing execution contract
- `TAXONOMY.md` provides the default contract when a skill declares nothing
- runtime inference handles unknown or ambiguous calls
- certifications prove that the declared or inferred contract actually holds under crash and replay

The wedge must work before `execution:` is widely adopted. After that, `execution:` becomes the clean way skill authors declare the contract the router already knows how to enforce.

---

## 6. Key Evidence To Validate

The research should explicitly validate the claim that OpenClaw persistence is not sufficient for recovery on its own.

Primary evidence buckets:

- OpenClaw source code in `src/agents/`, `src/gateway/`, `src/node-host/`, and `src/plugins/`
- academic papers, especially the Texas A&M taxonomy
- community evidence from the founder thread and framework discussions
- OpenClaw persistence and restart bugs identified during research

Current issue references to validate during the research pass:

- Issue `#10164` — durable execution request
- Issue `#62442` — Gateway restart state loss
- Issue `#55343` — history exists but does not reload correctly

These issue numbers should be treated as research inputs to verify and cite accurately, not as assumptions to repeat blindly.

---

## 7. Codebases To Download

Create a dedicated research workspace:

```bash
mkdir ~/tenure-research && cd ~/tenure-research
git clone https://github.com/openclaw/openclaw.git
git clone https://github.com/temporal-community/temporal-ai-agent.git
git clone https://github.com/bead-ai/zeitlich.git
git clone https://github.com/lmnr-ai/lmnr.git
git clone https://github.com/Arize-ai/phoenix.git
```

### Why Each Repo Exists

`openclaw/`

- primary subject of study
- identify exact crash points, in-memory state, and persistence gaps
- inspect how tool calls are chosen and executed today

`temporal-ai-agent/`

- minimal reference for agent-as-workflow
- good source for single-session workflow/activity patterns

`zeitlich/`

- richer reference for workflow-owned state, subagents, and isolated execution
- useful patterns for session restoration and long-running execution

`lmnr/` and `phoenix/`

- observability consumers for the future `tenure.*` OTEL attributes
- not the wedge proof, but useful to shape the event schema correctly

---

## 8. Papers And Community Evidence

### Papers

```bash
mkdir ~/tenure-research/papers
```

| Paper                                   | arXiv ID   | Local filename       |
| --------------------------------------- | ---------- | -------------------- |
| Texas A&M Taxonomy (190 advisories)     | 2603.27517 | `tamu-190.pdf`       |
| Taming OpenClaw (26% malicious)         | 2603.11619 | `taming-26.pdf`      |
| Your Agent Their Asset (CIK taxonomy)   | 2604.04759 | `cik-taxonomy.pdf`   |
| Systematic Evaluation (6 Claw variants) | 2604.03131 | `claw-6-eval.pdf`    |
| Don't Let the Claw Grip (MITRE mapping) | 2603.10387 | `grip-mitre.pdf`     |
| FASA Architecture (ClawGuard)           | 2603.12644 | `fasa-clawguard.pdf` |

### Community Evidence

```bash
mkdir ~/tenure-research/community
```

Save:

- founder Reddit thread on cron crashes and token burn
- existing community research doc
- OpenClaw Issue `#10164`
- LangGraph RFC `#6617`
- Pydantic AI Issue `#83`
- any validated OpenClaw persistence/restart issues used in the proof story

---

## 9. Workspace Structure

Open Cursor with `~/tenure-research` as the workspace root:

```text
tenure-research/
├── openclaw/
├── temporal-ai-agent/
├── zeitlich/
├── lmnr/
├── phoenix/
├── papers/
├── community/
├── output/
│   ├── crash-recovery-matrix.json
│   ├── skill-durability-mapping.json
│   └── community-evidence-validation.json
└── RESEARCH-BRIEF.md
```

---

## 10. Cursor Rules Context

Use a workspace rule file that keeps the research narrow:

```markdown
# Tenure Research Context

You are conducting research for Tenure's SER-first OSS wedge.

## What Must Be Proven First
- The OpenClaw adapter can route a tool call through the SER router into a Temporal primitive recorded on the execution timeline
- Temporal Event History can recover execution after a SIGKILL
- Replay does not duplicate side effects
- Temporal Schedule can replace fragile in-process cron

## Ownership Boundary
- OpenClaw owns thinking
- Tenure owns execution
- Temporal Event History is the source of truth for recovery
- OpenClaw persistence is a secondary artifact, not the recovery mechanism

## Research Priority
1. Read replay proof
2. File write no-duplicate proof
3. Cron durability proof
4. Artifact generation from the proven adapter boundary

## Output Discipline
- Every claim must cite a source file, paper key, or issue/thread reference
- Separate "what the research proves now" from "near-term roadmap"
- Do not broaden into marketplace/cloud/capability-plane strategy unless needed as future context
```

---

## 11. Research Execution Sequence

Do not try to produce all artifacts in one pass.

### Session 1: Adapter Boundary And Replay Proof

Goal:

- prove that replay works for an idempotent read
- prove that a deterministic file write does not duplicate after crash/replay

Focus files:

- `openclaw/src/agents/`
- `openclaw/src/node-host/`
- any source files that define tool invocation, result delivery, and persistence

Questions to answer:

- what does OpenClaw persist before the crash?
- why is that persisted state insufficient for recovery?
- what additional state must Tenure capture at the execution boundary chosen by the router?
- where must the authoritative checkpoint live in Temporal history?

#### Session 1 Checklist

1. Prepare the research workspace.
   Confirm `openclaw/`, `temporal-ai-agent/`, `zeitlich/`, `papers/`, and `community/` are present in `~/tenure-research`.

2. Open the first-pass OpenClaw files.
   Start with the current equivalents of:
   - `openclaw/src/agents/pi-embedded-runner/run.ts`
   - `openclaw/src/agents/pi-embedded-subscribe/handlers/tools.ts`
   - `openclaw/src/node-host/invoke.ts`
   If those exact paths have moved, find the current files that own agent-loop execution, tool dispatch, and privileged local execution.

3. Draw the minimal execution boundary.
   Trace one end-to-end path:
   - user input received
   - model/tool decision emitted
   - tool execution started
   - tool result returned
   - result delivered back into the next reasoning step

4. Run the read-proof pass first.
   Pick one idempotent read-shaped tool path and answer:
   - where is the call issued?
   - what is persisted before execution?
   - what is still only in memory?
   - if the Worker dies here, can replay reconstruct the step without touching side effects?

5. Run the deterministic write-proof pass second.
   Model a file-write-shaped execution and identify the critical kill point:
   - after the write completes
   - before the result is delivered to the next reasoning step
   Capture what Tenure would need so replay returns the cached execution result instead of rewriting the file.

6. Capture the persistence-gap record for every step you inspect.
   For each candidate crash point, write down:
   - what OpenClaw persisted
   - why that persisted state is insufficient
   - what remained only in memory
   - what Tenure checkpoint data would be required
   - which Temporal primitive should own the step

7. Record non-determinism and shared-ownership risks immediately.
   Flag any behavior that would break replay or blur the boundary, especially:
   - random values generated in workflow-owned logic
   - clock/time reads inside replay-sensitive logic
   - execution state that only OpenClaw can reconstruct
   - any path where a tool call could bypass SER

8. Keep the session narrow.
   Do not broaden into marketplace, hosted cloud, capability plane, or the full top-30 taxonomy. Session 1 is only about adapter correctness and the first two proofs in the ladder.

9. End the session only when these outputs exist.
   You should leave Session 1 with:
   - one written read-proof hypothesis
   - one written deterministic write-proof hypothesis
   - a list of inspected crash points with persistence-gap notes
   - a short blocker list, if any
   - a clear statement of where the authoritative checkpoint must live in Temporal history

10. Use this done definition.
   Session 1 is complete when you can say:
   "I know which OpenClaw state is insufficient, which execution boundary Tenure must own, and what minimal checkpoint is required for read replay and no-duplicate file write replay."

### Session 2: Crash Recovery Matrix

Goal:

- expand from the initial proof into a full crash-point map
- record where OpenClaw persistence breaks down and what the adapter must own

#### Session 2 Checklist

1. Start from the Session 1 boundary notes.
   Do not restart from scratch. Use the read-proof and deterministic write-proof findings as the baseline for the matrix.

2. Enumerate the crash-point categories before filling entries.
   Cover at least:
   - mid-LLM inference
   - decision emitted, execution not started
   - mid-tool execution
   - tool complete, result not delivered
   - compaction
   - SKILL.md loading
   - cron trigger processing
   - multi-agent communication
   - Gateway reconnect
   - sandbox/container execution

3. Split sub-variants when recovery semantics differ.
   If "mid-tool execution" behaves differently for file write, API call, browser session, or sandbox execution, break them into separate entries instead of forcing them into one generic row.

4. Fill the matrix through the persistence-gap lens.
   For every entry, capture:
   - what OpenClaw persisted
   - why that persisted state is insufficient
   - what remained only in memory
   - what Tenure checkpoint data would be required
   - which Temporal primitive should own the step

5. Attach real code evidence.
   Every entry should point to concrete OpenClaw source files and, where possible, the exact function or logical execution point involved.

6. Attach proof logic, not just prose.
   Every entry should include a candidate test case with:
   - setup
   - crash point
   - expected replay behavior
   - no-duplicate or continuity assertion

7. Cross-reference security and issue evidence where it matters.
   For each serious crash point, ask:
   - does a paper cover a related vulnerability?
   - does an issue or community report confirm the persistence/restart problem?

8. Flag boundary-breaking paths separately.
   If any path appears to:
   - generate replay-sensitive randomness in the wrong place
   - read time in replay-sensitive logic
   - require OpenClaw-only reconstruction
   - bypass SER
   mark it as a blocker candidate, not just another row.

9. Keep the artifact useful for code generation later.
   Write entries so they can directly feed:
   - crash-recovery tests
   - adapter checkpoint requirements
   - code comments about non-determinism risk

10. Use this done definition.
   Session 2 is complete when you have a 15–25 entry crash matrix that explains not just where a crash can happen, but why OpenClaw cannot recover it alone and what Tenure must own instead.

### Session 3: Cron Durability Proof

Goal:

- model the cron-triggered proof with Temporal Schedule
- define the certification test shape and public demo steps

#### Session 3 Checklist

1. Treat cron as the canonical public proof, not a side example.
   This session exists to turn the architecture into something the OpenClaw community can believe quickly.

2. Define the native OpenClaw failure first.
   Write down:
   - how OpenClaw cron works today
   - what state disappears when the process dies
   - why missed triggers are not authoritatively recovered

3. Define the Temporal replacement path.
   Specify the intended model:
   - Temporal Schedule owns trigger timing
   - Worker process may die
   - schedule survives independently
   - catch-up behavior is determined by policy, not luck

4. Write the canonical demo sequence exactly.
   Include:
   - append one timestamped line to `log.txt` every 60 seconds
   - run 3 cycles
   - kill Worker
   - miss 2 cycles
   - restart Worker
   - verify catch-up
   - verify no duplicate lines

5. Decide what must be asserted mechanically.
   The proof should verify:
   - expected line count
   - correct sequence numbers
   - correct timestamps or interval markers
   - no duplicated lines
   - no missing lines caused by Worker death

6. Define the certification shape.
   Turn the demo into a repeatable test by specifying:
   - setup fixture
   - crash trigger
   - restart step
   - assertions
   - pass/fail conditions

7. Make the public proof legible.
   Write the explanation in a way that can later become:
   - README proof section
   - demo narration
   - Issue `#10164` comment

8. Keep the proof tied to the wedge.
   Do not broaden this session into:
   - full marketplace claims
   - hosted dashboard UX
   - broad lifecycle features
   - full certification suite design
   Focus only on cron durability as the strongest public answer to the founder pain.

9. Record the exact source of truth.
   End the session with a clear statement that:
   - trigger timing is owned by Temporal Schedule
   - execution truth is owned by Temporal history
   - OpenClaw's own session files are not the recovery authority

10. Use this done definition.
   Session 3 is complete when you can describe one cron durability test that is simultaneously:
   - an engineering proof
   - a certification case
   - a believable public demo

### Session 4: Skill Durability Mapping

Goal:

- classify the top 30 skills only after the adapter boundary is clear
- keep taxonomy work subordinate to execution correctness
- define how author-declared `execution:` blocks, taxonomy defaults, and runtime inference normalize into the same routing contract

### Session 5: Community Validation

Goal:

- show how Tenure closes the concrete failures the community already complains about
- make the README/demo/Issue `#10164` comment believable

---

## 12. Updated Research Brief

### RESEARCH BRIEF: Tenure SER-First OSS Wedge

**Budget:** $100 deep research equivalent or 6–8 hours of guided Cursor sessions  
**Primary output:** one proven execution wedge, expressed as three JSON artifacts plus one public proof story

### Framing

Tenure is not trying to prove the whole future platform in this research cycle.

This cycle proves:

- the OpenClaw adapter can own execution
- Temporal Event History can recover after process death
- one tool call can resume without duplicating
- cron-triggered runs can survive Worker death without gaps or duplicates

Everything else should be written as either:

- proved now
- or near-term roadmap

---

## 13. Artifact 1: Crash Recovery Determinism Matrix

**File:** `output/crash-recovery-matrix.json`

This is the most important artifact.

For each crash point, document:

- what OpenClaw persisted before the crash
- why that persisted state is insufficient for correct recovery
- what additional state Tenure must capture
- which Temporal primitive owns the checkpoint
- whether replay is safe
- what proof test should validate the recovery path

### Required Schema

```json
{
  "crash_point_id": "CP-003",
  "crash_point_name": "Tool completed, result not yet delivered",
  "openclaw_component": "Agent Runtime -> Local Execution",
  "source_files": [
    "src/agents/pi-embedded-subscribe/handlers/tools.ts",
    "src/node-host/invoke.ts"
  ],
  "openclaw_persisted_before_crash": [
    ".jsonl transcript entry for prior turn"
  ],
  "why_openclaw_persistence_is_insufficient": [
    "Tool result is not yet represented in a replay-safe execution log",
    "History file exists on disk but cannot authoritatively reconstruct mid-task state"
  ],
  "state_in_memory_only": [
    "Tool result buffer",
    "Pending next-step delivery state"
  ],
  "tenure_checkpoint_required": [
    "Tool call ID",
    "Tool parameters",
    "Serialized Activity result"
  ],
  "temporal_primitive": "Activity",
  "replay_safe": true,
  "replay_safe_reason": "Temporal returns the completed Activity result from Event History instead of re-executing the tool",
  "side_effects_possible": true,
  "idempotency_required": true,
  "test_case": {
    "description": "File write completes, Worker dies before result delivery, replay resumes without rewriting file",
    "setup": "Run deterministic file write Activity and SIGKILL Worker after Activity completion",
    "assertion": "File hash unchanged, result delivered once, workflow continues"
  },
  "paper_references": ["[TAMU-190]"],
  "community_references": ["[ISSUE-10164]"],
  "severity": "critical"
}
```

### Coverage

Produce 15–25 entries spanning:

- mid-inference
- decision emitted but execution not started
- mid-tool-call
- tool complete but result not delivered
- compaction
- skill loading
- cron trigger
- Gateway reconnect
- multi-agent communication
- sandbox execution

But always interpret them through the stronger question:

**What did OpenClaw persist, why is that not enough, and what must Tenure own instead?**

---

## 14. Artifact 2: Skill-To-Durability Mapping

**File:** `output/skill-durability-mapping.json`

This artifact is important, but it is downstream of the adapter proof.

For each of the top 30 skills:

- classify the primary execution type
- identify at least two edge cases
- provide runtime-detectable signals
- specify the routing override needed
- state how the same rule would be expressed as an `execution:` block when authors declare it directly

The taxonomy work must assume:

- OpenClaw owns reasoning and tool choice
- Tenure owns execution once the call is emitted

---

## 15. Artifact 3: Community Evidence Validation

**File:** `output/community-evidence-validation.json`

This artifact exists to support the wedge story, not to replace it.

Three sections:

- seven-gap closure matrix
- framework failure-mode test cases
- quantitative claims verification

The key use of this artifact is to connect the engineering proof to public belief:

- README credibility
- demo captions
- Issue `#10164` comment

---

## 16. Validation Checklist

### Adapter Proof

- idempotent read replay works after SIGKILL
- deterministic file write does not duplicate after replay
- the recovery path depends on Temporal history, not OpenClaw session files

### Cron Proof

- Worker dies mid-schedule
- missed runs are caught up according to Temporal Schedule policy
- no duplicate writes appear
- line count, sequence number, and file hash prove correctness

### Artifact Quality

- every crash point cites concrete source files
- every crash point explains why OpenClaw persistence is insufficient
- every crash point defines the extra checkpoint data Tenure must own
- every skill edge case is observable at routing time
- every public claim is source-backed or honestly marked unverified

---

## 17. How The Research Becomes Product Proof

`crash-recovery-matrix.json`

- becomes `src/certify/crash-recovery.test.ts`
- defines the OpenClaw adapter checkpoint contract
- provides the strongest evidence for the OSS wedge

`skill-durability-mapping.json`

- becomes taxonomy rows and router rules
- expands safely only after execution correctness is proven

`community-evidence-validation.json`

- becomes README proof support, docs citations, and public comparison material

### Public Packaging Sequence

1. Build the cron durability demo
2. Wrap it in a repeatable certification
3. Post the proof in OpenClaw Issue `#10164`

That is one piece of work delivered as:

- engineering validation
- product proof
- community distribution

---

## 18. Completion Condition

This research cycle is complete when all of the following are true:

- the adapter proves replay on read
- the adapter proves no-duplicate replay on deterministic file write
- the cron durability demo works under Worker death
- the proof is packaged as a certification
- the result is strong enough to anchor the root `README.md` and the eventual Issue `#10164` comment https://github.com/openclaw/openclaw/issues/10164