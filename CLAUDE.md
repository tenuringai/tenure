# CLAUDE.md

## Project

Tenure — durable skill development platform for OpenClaw. Wraps agent tool calls in Temporal Activities with per-skill execution routing.

## Current Wedge

Prove adapter correctness. Every tool call through SER. Every execution on the Temporal timeline. No duplicate side effects on replay. Cron survives process death. Budget caps enforce. Circuit breakers trip.

## Architecture

OpenClaw thinks. Tenure executes. Temporal owns the timeline. If a call bypasses SER, the taming promise is broken.

## Read Order

1. `SOUL.md` — how to think
2. `RESEARCHER-HANDOFF.md` — what to do
3. `RESEARCH-SETUP.md` — how to set up
4. `TAXONOMY.md` — the classification reference
5. `PERSISTENCE-GAP.md` — why OpenClaw's persistence is insufficient

## Output

JSON per schemas in `RESEARCH-BRIEF.md`. Cite sources. Separate fact from inference. Record contradictions in `CONTRADICTIONS.md`.

## Bias

When uncertain, ask: does this help prove adapter correctness, no-duplicate replay, or cron durability? If no, it is not first-order work.
