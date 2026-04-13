# Tenure Insights

## Core Invariants

- OpenClaw thinks. Tenure executes.
- Every call must pass through the SER router.
- The router chooses the Temporal primitive.
- The resulting execution lands on the Temporal timeline.
- Temporal Event History is the source of truth for recovery.
- OpenClaw persistence is a secondary artifact, not the recovery mechanism.

## Contract Model

- `execution:` is the author-facing execution contract.
- `TAXONOMY.md` provides defaults when a skill declares nothing.
- Runtime inference is the fallback for unknown or ambiguous calls.
- `metadata.tenure.*` is a compatible encoding of the same contract.
- SER enforces the contract.
- Certification proves the contract holds at runtime.

## Proof Ladder

1. Read replay works at all.
2. Deterministic file write replays without duplication.
3. Cron-triggered writes survive Worker death and catch up correctly.

## Canonical Public Proof

The public wedge proof is cron durability:

- scheduled append to `log.txt`
- Worker dies
- scheduled intervals are missed
- Worker restarts
- Temporal Schedule catches up
- no gaps caused by process death
- no duplicates caused by replay

## Why The Taxonomy Exists

The taxonomy is not just a label table. It exists to answer:

> What Temporal-owned execution path must this call take so replay, no-duplicate behavior, and taming still hold?

## Why `tenure extend` Exists

The full execution contract is large.

Real skills should not hand-author the superset schema. `tenure extend` should:

- infer defaults from execution type
- ask only for material overrides
- emit minimal `execution:` blocks
- optionally export compatibility metadata

## Curated Insights

- Real skills declare only the fields that differ from the defaults for their execution type.
- `execution:` is where a skill declares intent. SER is where Tenure enforces it.
- A taxonomy row is not a label. It is a default execution contract.
- The router is not just a classifier. It is the checkpoint gate.
- Every call that bypasses the router breaks the taming promise a little.
- OpenClaw session files are evidence. Temporal history is authority.
- Replay is not a recovery feature layered on top later. Replay is the architecture.
- The first proof is not "can Tenure do everything?" It is "can one call survive death correctly?"
- A read proves replay works. A write proves replay is safe. A cron run proves the product matters.
- Cron durability is the shortest path from architecture truth to user belief.
- `execution:` should stay small because taxonomy should carry the defaults.
- The more a skill author has to hand-configure, the less the standard will spread.
- Runtime inference is a fallback for ambiguity, not a substitute for a good contract.
- Certification is where declared semantics stop being theory and start being credible.
- The timeline is what makes execution countable, typed, replayable, and revocable.
- Tenure does not make OpenClaw think better. It makes OpenClaw's actions survivable.
- If OpenClaw someday fixes persistence perfectly, Tenure still wins on routing, policy, and proof.
- The wedge is not "durable agents" in the abstract. The wedge is "this exact call survived this exact crash."