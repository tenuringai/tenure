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

### Session 1

Adapter boundary and replay proof:

- prove read replay works
- model deterministic file write replay without duplication
- document what OpenClaw persists
- document why that state is insufficient
- identify what Tenure must checkpoint
- produce `PERSISTENCE-GAP.md`

### Session 2

Crash recovery matrix:

- expand to 15–25 crash points
- attach real code evidence
- write persistence-gap explanations
- identify blocker paths

### Session 3

Cron durability proof:

- replace fragile in-process cron conceptually with Temporal Schedule
- define the canonical demo
- define the certification shape
- define budget-cap enforcement proof
- define circuit-breaker proof

### Session 4

Skill durability mapping:

- only after the boundary is clear
- keep classification subordinate to execution correctness
- bridge `execution:` / taxonomy / inference

### Session 5

Community validation:

- connect the engineering proof to user belief
- strengthen README credibility
- prepare the future Issue `#10164` story

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
