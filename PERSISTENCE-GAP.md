# Persistence Gap

## Purpose

This is the short reference for why Temporal Event History must be the source of truth for recovery in Tenure's current wedge.

Read this before making any architectural decision about:

- crash recovery
- replay
- checkpoint ownership
- SER boundary design
- certification scope

## Working Summary

OpenClaw persists some useful artifacts, but not enough authoritative execution state to recover a running agent correctly after interruption.

Current working model:

- session transcripts are written to `.jsonl`
- memory and summaries may be written to markdown-style artifacts
- conversation/session coordination depends in part on Gateway-managed state

The problem is not "OpenClaw saves nothing."

The problem is:

- some data is saved
- some critical state remains in memory
- the saved data is not sufficient to reconstruct interrupted execution correctly

That is why Tenure's wedge does **not** treat OpenClaw persistence as the recovery authority.

## Why OpenClaw Persistence Is Insufficient

### 1. Gateway State Loss

Issue anchor:

- `#62442`

Working interpretation:

- critical session state appears to live in Gateway/runtime memory
- process death can drop state that is necessary to continue the interrupted execution path

Why this matters:

- if recovery depends on reconstructing this state from OpenClaw alone, the boundary is shared and brittle
- Tenure therefore needs workflow-owned execution state outside the Gateway process

### 2. History Exists But Does Not Reload Reliably

Issue anchor:

- `#55343`

Working interpretation:

- history may be persisted to disk
- but persisted history alone does not guarantee correct reloading or correct continuation of a running session

Why this matters:

- durable storage is not the same thing as durable recovery
- Tenure must own a replay-safe execution record, not just rely on saved conversation artifacts

### 3. Memory Flush Does Not Always Happen Before Reset

Issue anchor:

- `#21382`

Working interpretation:

- memory/summarization artifacts may fail to flush before a reset or interruption
- critical context can be lost precisely when the system needs it most

Why this matters:

- end-of-step persistence cannot be treated as guaranteed
- workflow checkpoints must exist before relying on post-step flush behavior

## Architectural Consequence

The current wedge therefore assumes:

- OpenClaw thinks
- Tenure executes
- Temporal owns the timeline

And specifically:

- OpenClaw artifacts are secondary logs
- Temporal Event History is the authoritative recovery surface
- execution checkpoints must be owned at the router/primitive boundary

## What Tenure Must Own Instead

At minimum, the workflow-owned execution layer must be able to recover:

- which call was being executed
- what parameters were used
- what result completed
- whether the side effect already happened
- which primitive owned the step
- whether replay should return a cached result or re-dispatch

## Relationship To Proof Ladder

This file exists to support the current proof ladder:

1. read replay
2. deterministic write replay without duplication
3. cron survival
4. budget cap enforcement
5. circuit breaker trip

Every one of those proofs depends on the same prior claim:

**OpenClaw's own persisted artifacts are not enough. The workflow-owned timeline must be the recovery authority.**

## Status

This is a working research summary, not a final paper.

As Session 1 research progresses:

- refine claims with source evidence
- add precise code references
- keep the document short enough to read in 2 minutes
