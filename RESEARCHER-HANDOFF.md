# Researcher Handoff

## Purpose

This document is for the next researcher working on Tenure's current wedge.

The goal is not to rediscover the whole product. The goal is to continue the current research program without drifting away from the root doctrine already established in this repo.

## Current Wedge

The active wedge is:

- prove OpenClaw adapter correctness
- prove every call goes through the SER router
- prove execution lands on the Temporal timeline
- prove replay does not duplicate side effects
- prove cron survives Worker death
- prove budget caps stop runaway spend
- prove circuit breakers stop pathological loops

Everything else is secondary until that works.

## Non-Negotiable Model

- OpenClaw thinks.
- Tenure executes.
- Temporal owns the timeline.
- `execution:` is the declaration layer.
- `TAXONOMY.md` is the default layer.
- Runtime inference is the fallback.
- SER is the enforcement mechanism.
- Certification is the proof mechanism.

If any tool call bypasses SER and executes as a raw in-memory call, the taming promise is broken.

## Read These First

Read these in order before doing new work:

1. `README.md`
2. `RESEARCH-SETUP.md`
3. `tenure-deep-research-brief.md`
4. `PERSISTENCE-GAP.md`
5. `TAXONOMY.md`
6. `tenure-extend.md`
7. `INSIGHTS.MD`
8. `RESEARCH-CORPUS.MD`
9. `CONTRADICTIONS.md`
10. `SESSION-1-FINDINGS.md` — source-verified adapter boundary and replay proof findings
11. `SESSION-3-CRON-DURABILITY.md` — cron durability, budget cap, and circuit breaker proofs
12. `output/crash-recovery-matrix.json` — 21-entry crash recovery matrix (Session 2 artifact)

Use `research-direction-context/` only as historical reference, not as the current source of truth.

## New Corpus: `openclaw.llm.txt`

There is now a large local corpus file:

- `openclaw.llm.txt`

It is approximately 100k lines and appears to be an extracted OpenClaw documentation/content dump.

Treat it as:

- a local research corpus
- a fast lookup surface for docs and reference text
- supporting evidence, not the source of truth for Tenure's wedge decisions

Do **not** read it top to bottom.

Preferred usage:

- use targeted search first
- read narrow sections around a relevant match
- extract only what helps with the current proof ladder

Best use cases:

- OpenClaw feature behavior lookup
- channel/plugin details
- session/persistence docs
- workflow or runtime references that are expensive to rediscover manually

Avoid:

- broad summarization passes
- pulling in unrelated product surfaces
- letting corpus breadth override the current wedge

## Available Research Tools

The researcher should assume access to:

- Context7 MCP for current library/framework docs
- Temporal-related documentation MCP access
- Temporal platform/docs research access
- local root docs in this repo
- `openclaw.llm.txt` as a local corpus

Use them this way:

- use local root docs first for doctrine
- use OpenClaw source and `openclaw.llm.txt` for OpenClaw-specific behavior
- use Temporal docs MCP when verifying replay, schedules, Activities, child workflows, signals, and heartbeats
- use Context7 for current tool/framework syntax only when local docs are not enough

## First Research Sequence

Follow the sequence already defined in `RESEARCH-SETUP.md`.

### Session 1 — COMPLETE (2026-04-12)

Adapter boundary and replay proof:

- ✓ proved read replay gap exists — tool results sit in memory with no checkpoint
- ✓ modeled deterministic file write crash window — side effect completes, result lost
- ✓ documented what OpenClaw persists (`.jsonl`, `jobs.json`, SQLite tasks, session store)
- ✓ documented why that state is insufficient (conversation log ≠ execution record)
- ✓ identified what Tenure must checkpoint (Activity result in Temporal Event History)
- ✓ produced `PERSISTENCE-GAP.md` with source-verified evidence
- ✓ identified 6 non-determinism risks (replay bombs) in `CONTRADICTIONS.md`
- ✓ identified 10 crash points with severity ratings
- ✓ identified 2 blockers (external SessionManager package, non-deterministic compaction)
- ✓ produced `SESSION-1-FINDINGS.md` with full findings

Research workspace: `~/tenure-research/` (openclaw, zeitlich, temporal-ai-agent cloned)

### Session 2 — COMPLETE (2026-04-12)

Crash recovery matrix:

- ✓ expanded to 21 crash points (target: 15-25)
- ✓ split sub-variants: file write, API call, browser session, sandbox, critical transaction
- ✓ every entry cites concrete source files and functions
- ✓ every entry has a candidate test case with setup, crash point, and assertion
- ✓ cross-referenced 6 papers and 8 community evidence entries where relevant
- ✓ 1 boundary-breaking path flagged: Gateway dedupe map (CP-020)
- ✓ severity breakdown: 6 critical, 9 high, 3 medium, 3 low
- ✓ produced `output/crash-recovery-matrix.json` per required schema

### Session 3 — COMPLETE (2026-04-12)

Cron durability proof:

- ✓ defined native OpenClaw cron failure mode with source evidence (setTimeout, runMissedJobs, interruptedOneShotIds)
- ✓ defined Temporal Schedule replacement with catch-up policy, overlap: SKIP, catchupWindow: 10 min
- ✓ wrote canonical demo sequence: 7 steps from configure through verify, with exact expected output
- ✓ defined certification test shape: setup, crash (SIGKILL), restart, 5 pass/fail conditions
- ✓ defined budget-cap enforcement proof: pre-dispatch check in Workflow, budget_exhausted terminal state
- ✓ defined circuit-breaker proof: consecutive failures + identical calls detection, escalateToHuman Activity
- ✓ wrote public proof narrative for README, Issue #10164, and demo terminal
- ✓ stated source of truth: triggers → Temporal Schedule, execution → Event History, OpenClaw → secondary logs
- ✓ produced `SESSION-3-CRON-DURABILITY.md` with full findings, code examples, and certification shapes

### Session 4 — COMPLETE (2026-04-12)

Skill durability mapping:

- ✓ mapped 30 skills with execution types grounded in proven adapter boundary
- ✓ 60 edge cases total (2 per skill minimum) with runtime-detectable signals
- ✓ 18/30 skills require runtime inference (per-invocation classification)
- ✓ 12/30 skills have sufficient static classification
- ✓ type distribution: 16 IR, 10 SM, 1 SS, 2 CT, 1 LR
- ✓ bridged execution:/taxonomy/inference normalization into same routing contract
- ✓ cross-referenced OpenClaw tool inventory (30 actual tools mapped from source)
- ✓ produced `output/skill-durability-mapping.json` per required schema

### Session 5 — COMPLETE (2026-04-12)

Community validation:

- ✓ built seven-gap closure matrix: all 7 community complaints mapped to Tenure mechanisms and crash points
- ✓ mapped 6 framework failure modes (LangChain, LangGraph, CrewAI, AutoGen, Google ADK, Pydantic AI)
- ✓ verified 6 quantitative claims with source links and reliability ratings
- ✓ grounded draft-README.MD with community evidence: "Not Just Us" section, framework comparison table, research table
- ✓ produced `output/community-evidence-validation.json` per required schema
- ✓ produced `draft-README.MD` as the public-facing README with all claims source-backed

## What To Capture During Research

For each material finding, prefer notes in this shape:

- what OpenClaw does now
- what OpenClaw persists now
- why that persistence is insufficient
- what Tenure must own instead
- what Temporal primitive should own the step
- whether replay is safe
- what the certification or demo should prove

This keeps research directly usable for:

- crash-recovery tests
- router rules
- certification logic
- public proof narratives

## Evidence Priorities

Primary evidence:

- OpenClaw source code
- OpenClaw persistence/restart issues
- Temporal execution semantics
- `openclaw.llm.txt` excerpts that clarify OpenClaw behavior
- academic papers already listed in `RESEARCH-CORPUS.MD`

Secondary evidence:

- marketplace references
- broader skill ecosystem repos
- competitors and adjacent frameworks

Those secondary sources are valuable, but they should not distort the current wedge.

## Known Anchors

The current wedge is especially anchored on:

- OpenClaw Issue `#10164`
- OpenClaw Issue `#62442`
- OpenClaw Issue `#55343`
- the founder's cron-crash/token-burn pain
- the read -> write -> cron proof ladder

If new research contradicts these assumptions, record the contradiction explicitly rather than silently drifting the doctrine.
Record it in `CONTRADICTIONS.md` using the root template.

## Output Discipline

When producing new research output:

- separate "proved now" from "near-term roadmap"
- do not widen the wedge casually
- use repo-relative paths
- keep the contract model consistent:
  - `execution:` declares
  - taxonomy defaults
  - inference falls back
  - SER enforces
  - certification proves

## If You Are Unsure

When uncertain, bias toward these questions:

1. Does this help prove adapter correctness?
2. Does this help prove router-to-timeline ownership?
3. Does this help prove no-duplicate replay?
4. Does this help prove cron durability?

If the answer is no, it is probably not first-order work for the current phase.

## Expected Near-Term Deliverables

- improved Session 1 notes
- crash recovery matrix entries
- deterministic write replay proof logic
- cron durability certification design
- budget-cap enforcement proof logic
- circuit-breaker proof logic
- taxonomy rules that follow from proven execution behavior
- public-proof material that can later support README and Issue `#10164`

## Final Reminder

This repo already has a coherent doctrine.

Do not restart the framing from the PRD or the historical context folder unless there is a concrete contradiction in the current root docs. Continue the wedge from where it stands now.
