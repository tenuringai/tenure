# tenure extend

This document defines the **full normalized execution contract** that `tenure extend` should understand and generate from.

It exists because the root docs now make a strict distinction:

- `execution:` is the **author-facing contract**
- `TAXONOMY.md` provides **defaults by execution type**
- runtime inference is the **fallback**
- SER plus the Temporal timeline are the **enforcement and proof layer**

So this file is not "the ultimate metadata block." It is the superset schema the router can normalize to internally, regardless of whether the contract came from:

- an author-written `execution:` block
- taxonomy defaults
- a compatibility `metadata.tenure.*` encoding
- runtime inference

---

## Why This Exists

Skill authors should not have to hand-author a 60-field block just to say "this is a Stripe charge."

`tenure extend` exists to ask a small number of questions, infer the rest from the execution type, and emit the smallest possible contract that still preserves:

- replay safety
- no-duplicate behavior
- correct primitive selection
- budget tracking
- observability
- future certification coverage

The full schema lives here so the generator, scanner, and router all normalize to the same contract.

---

## Author-Facing Shape

Preferred skill syntax:

```yaml
---
name: stripe-charge
description: Process a payment via Stripe
execution:
  type: critical_transaction
  compensation: StripeRefund
  hitl: required
  idempotencyKey: charge_id
  exactlyOnce: true
  thinkingCost: medium
  approvalDisplayFields:
    - amount
    - currency
    - customer_email
---
```

This is what skill authors should see and edit.

The router then normalizes that into the internal execution contract below.

---

## Compatibility Shape

When compatibility with the existing metadata encoding is needed, the same contract can be expressed as:

```yaml
---
name: stripe-charge
description: Process a payment via Stripe
metadata:
  tenure.execution_type: critical_transaction
  tenure.compensation: StripeRefund
  tenure.hitl: required
  tenure.idempotency_key: charge_id
  tenure.exactly_once: "true"
  tenure.thinking_cost: medium
  tenure.approval_display_fields: amount,currency,customer_email
---
```

This is a transport encoding, not the preferred mental model.

---

## Normalized Internal Contract

This is the superset schema that Tenure should normalize to internally.

```yaml
execution:
  type: critical_transaction
  classification:
    confidence: 0.85
    conditionalOverrides:
      - when: TerraformPlan
        type: idempotent_read
      - when: TerraformState
        type: idempotent_read

  retry:
    maxAttempts: 1
    backoff: none
    delay: 2s
    maxDelay: 60s
    jitter: true
    errorStrategy:
      permanent: fail
      rate_limit: backoff
      transient: retry
      unknown: escalate
    circuitBreaker:
      threshold: 3
      action: pause_and_alert

  idempotency:
    enabled: true
    key: charge_id
    dedupGuard: true
    dedupWindow: 3600
    exactlyOnce: true

  compensation:
    enabled: true
    tool: StripeRefund
    idempotent: true
    timeout: 120s
    sagaOrder: 1

  hitl:
    mode: required
    channels:
      - dashboard
      - slack
      - mobile
    timeout: 86400
    timeoutAction: cancel
    preview: true
    displayFields:
      - amount
      - currency
      - customer_email

  cache:
    enabled: false
    ttl: 300
    key: all
    staleOnError: true
    maxSize: 1048576

  temporal:
    childWorkflow: false
    parentClosePolicy: terminate
    heartbeatInterval: 30
    heartbeatPayload: progress_pct
    timeout: 120s
    queueTimeout: 30s
    asyncCompletion: false
    signalBased: false
    zeroCompute: false
    continueAsNewThreshold: 1000

  cost:
    thinkingCost: medium
    modelTier: mid
    invocationBudget: 0
    budgetTracked: true

  security:
    permission: admin
    networkAccess: true
    filesystemAccess: false
    sandboxed: false
    allowedDomains:
      - api.stripe.com
    subprocess: false
    riskTier: critical

  observability:
    spanName: stripe-charge
    customAttributes:
      payment.provider: stripe
      payment.type: charge
    traceIO: false
    captureForTraining: true
    alertOnFailure: true
    alertThreshold: 1

  marketplace:
    pricingModel: per_invocation
    pricingCost: 0.002
    revenueSplit: 80
    freeTier: 100
    outcomeField: charge_id
    outcomeValue: non_null
    monthlyPrice: 0
    builderId: "@stripe-skill-author"
    minVersion: 0.5.0
```

---

## Minimal Real-World Examples

The normalized contract is a schema reference, not what real skills should type by hand.

Most real skills declare only the fields that differ from the defaults for their execution type.

### Idempotent Read

```yaml
execution:
  type: idempotent_read
  cache:
    enabled: true
  cost:
    thinkingCost: low
```

Everything else inherits from the `idempotent_read` defaults in `TAXONOMY.md`.

### Critical Transaction

```yaml
execution:
  type: critical_transaction
  compensation:
    tool: StripeRefund
  hitl:
    mode: required
    displayFields:
      - amount
      - currency
      - customer_email
  idempotency:
    key: charge_id
    exactlyOnce: true
  cost:
    thinkingCost: medium
```

Everything else inherits from the `critical_transaction` defaults in `TAXONOMY.md`.

---

## Normalization Rules

`tenure extend` should normalize in this order:

1. start from execution-type defaults in `TAXONOMY.md`
2. apply author-declared `execution:` values if present
3. apply compatible `metadata.tenure.*` values if that encoding was supplied
4. fill any remaining gaps from runtime inference only when needed
5. emit the minimal author-facing `execution:` block by default

That means:

- taxonomy is the default contract
- `execution:` is the declared override
- metadata is a compatibility layer
- normalized execution contract is what the router actually consumes

---

## Generator Behavior

`tenure extend` should:

- ask only the questions needed to determine execution type and material overrides
- avoid exposing the full superset schema unless the user explicitly asks for advanced fields
- generate `execution:` by default
- optionally export `metadata.tenure.*` when compatibility mode is requested
- explain which fields were inherited from `TAXONOMY.md`
- warn when the declared contract appears inconsistent with the selected execution type

The tool should optimize for minimal declaration, not maximal verbosity.

---

## Scan And Certification Relationship

`tenure scan` validates the declared contract.

`tenure certify` validates the runtime behavior.

That distinction matters:

- `execution:` says what the skill claims
- taxonomy says what the platform assumes by default
- certification says whether the claim actually survives crashes, replay, retries, and scheduling

The declaration is never the proof.

---

## Notes

- This file is aligned to the root wedge docs: `README.md`, `RESEARCH-SETUP.md`, `tenure-deep-research-brief.md`, and `TAXONOMY.md`
- It intentionally treats `execution:` as the primary author-facing syntax
- It intentionally keeps `metadata.tenure.*` as a compatible encoding, not the primary interface