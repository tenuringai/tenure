# Tenure Architecture: Execution + Observability Stack

### How temporal-ai-agent, zeitlich, braintrust, laminar, and phoenix merge into one system

---

## What Each Project Contributes


| Project               | Layer                     | What tenure takes from it                                                                                                                                                                                       |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **temporal-ai-agent** | Execution pattern         | One agent = one multi-turn Temporal workflow. Activities per tool call. The simplest correct pattern for durable agent loops.                                                                                   |
| **zeitlich**          | Execution framework       | ThreadOps (conversation persistence), SandboxOps (filesystem isolation), agentskills.io progressive disclosure, subagents as child workflows, lifecycle hooks (pre/post tool execution).                        |
| **Braintrust**        | Cloud observability       | LLM call tracing with full context, prompt versioning and A/B testing, offline evals, cost/latency metrics. The `BraintrustPlugin` for Temporal Workers is the reference integration pattern.                   |
| **Laminar (lmnr)**    | OSS observability         | Self-hostable tracing, browser session replay synced with agent traces, semantic event detection, SQL access to all trace data, custom dashboards, dataset creation from traces. Built in Rust for performance. |
| **Phoenix (Arize)**   | OSS observability + evals | Tracing, embedding drift detection, eval harnesses, experiment tracking. Strongest on the eval/experimentation axis.                                                                                            |


---

## The Merge Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TENURE CLI                                │
│          tenure connect · spawn · eval · certify · scan          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              OPENCLAW ADAPTER (@tenured/openclaw)          │  │
│  │                                                            │  │
│  │  Injects tenure execution backend into openclaw.json.     │  │
│  │  Bridges OpenClaw's agent loop → Temporal workflow.        │  │
│  │  Pattern from: temporal-ai-agent (session = workflow)      │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │              AGENT SESSION MODEL                           │  │
│  │                                                            │  │
│  │  From zeitlich:                                           │  │
│  │    ThreadOps — conversation stored in Redis/SQLite        │  │
│  │    SandboxOps — filesystem isolation per agent             │  │
│  │    Lifecycle hooks — onToolStart, onToolEnd,              │  │
│  │                      onShiftStart, onShiftEnd             │  │
│  │    Subagents — child workflows with ParentClosePolicy     │  │
│  │                                                            │  │
│  │  From agentskills.io:                                     │  │
│  │    SKILL.md with execution: block (tenure extension)      │  │
│  │    Progressive disclosure (metadata → full instructions)   │  │
│  │    pricing: block (tenure marketplace extension)          │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │         SEMANTIC EXECUTION ROUTER (SER)                    │  │
│  │                                                            │  │
│  │  Classifies tool call → selects Temporal primitive         │  │
│  │  Meters thinking time → records billing event              │  │
│  │  Checks budget → pauses if exceeded                       │  │
│  │                                                            │  │
│  │  ╔═══════════════════════════════════════════════════════╗ │  │
│  │  ║  INSTRUMENTATION POINT                                ║ │  │
│  │  ║                                                        ║ │  │
│  │  ║  Every tool call emits an OpenTelemetry span with:    ║ │  │
│  │  ║    span.name = skill name                              ║ │  │
│  │  ║    span.attributes:                                    ║ │  │
│  │  ║      tenure.execution_type = "critical_transaction"    ║ │  │
│  │  ║      tenure.primitive = "saga"                         ║ │  │
│  │  ║      tenure.model = "claude-sonnet-4"                  ║ │  │
│  │  ║      tenure.model_tier = "mid"                         ║ │  │
│  │  ║      tenure.input_tokens = 2847                        ║ │  │
│  │  ║      tenure.output_tokens = 412                        ║ │  │
│  │  ║      tenure.cost_usd = 0.0147                          ║ │  │
│  │  ║      tenure.cached = false                             ║ │  │
│  │  ║      tenure.retry_count = 0                            ║ │  │
│  │  ║      tenure.shift_id = "shift-2026-04-12-08"           ║ │  │
│  │  ║      tenure.budget_pct = 25.4                          ║ │  │
│  │  ║                                                        ║ │  │
│  │  ║  This is the SINGLE instrumentation point.             ║ │  │
│  │  ║  All observability backends consume these same spans.  ║ │  │
│  │  ╚═══════════════════════════════════════════════════════╝ │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │              TEMPORAL EXECUTION LAYER                      │  │
│  │                                                            │  │
│  │  From temporal-ai-agent:                                  │  │
│  │    Workflow = agent session                                │  │
│  │    Activity = tool call execution                         │  │
│  │    Signal = HITL approval gate                            │  │
│  │    Timer = shift sleep                                    │  │
│  │    ContinueAsNew = shift boundary + history reset         │  │
│  │    Child Workflow = subagent or complex task               │  │
│  │                                                            │  │
│  │  From zeitlich:                                           │  │
│  │    AsyncActivityCompletion for long-running tasks          │  │
│  │    Heartbeat monitoring for stateful sessions              │  │
│  │    Thread persistence across workflow replays              │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │              OBSERVABILITY BACKENDS (pluggable)            │  │
│  │                                                            │  │
│  │  All backends consume the same OTEL spans from the SER    │  │
│  │  router. The user picks one (or multiple). Tenure does    │  │
│  │  not own an observability backend — it emits the data.    │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │  LAMINAR    │  │  BRAINTRUST │  │  PHOENIX         │  │  │
│  │  │  (OSS)      │  │  (Cloud)    │  │  (OSS)           │  │  │
│  │  │             │  │             │  │                   │  │  │
│  │  │ Self-host   │  │ Managed     │  │ Self-host         │  │  │
│  │  │ Rust perf   │  │ Prompt mgmt │  │ Eval-first        │  │  │
│  │  │ SQL access  │  │ A/B testing │  │ Embedding drift   │  │  │
│  │  │ Browser     │  │ Offline     │  │ Experiment        │  │  │
│  │  │   replay    │  │   evals     │  │   tracking        │  │  │
│  │  │ Semantic    │  │ Cost/latency│  │ Dataset           │  │  │
│  │  │   events    │  │   metrics   │  │   management      │  │  │
│  │  │ Dashboards  │  │ Prompt      │  │                   │  │  │
│  │  │             │  │   versions  │  │                   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  │                                                            │  │
│  │  Default: Laminar (OSS, self-hostable, matches tenure's   │  │
│  │  open-core model). Braintrust for teams that want managed │  │
│  │  prompt versioning. Phoenix for eval-heavy workflows.     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     TENURE DASHBOARD                             │
│                                                                  │
│  Local (localhost:4747):                                        │
│    Consumes OTEL spans directly or via Laminar self-hosted      │
│    Shows: execution trace, thinking time, budget, shift status  │
│                                                                  │
│  Cloud (tenur.ing/dashboard):                                   │
│    Consumes OTEL spans via managed Laminar or Braintrust        │
│    Adds: Roster calendar, HITL inbox, marketplace, billing      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why OpenTelemetry Is the Glue

The critical design decision: tenure does **not** build a proprietary observability backend. It emits OpenTelemetry spans with tenure-specific attributes (execution type, primitive, model tier, cost, budget percentage) and lets the user route those spans to any OTEL-compatible backend.

This works because all three observability projects already speak OTEL:

- **Laminar** is built on OTEL. Its `@observe()` decorator creates OTEL spans. Its Python SDK instruments OpenAI/Anthropic calls via OTEL auto-instrumentation.
- **Braintrust** ships a `BraintrustPlugin` for Temporal that creates OTEL-compatible spans. Every Temporal Workflow and Activity becomes a Braintrust span automatically.
- **Phoenix** uses OTEL as its trace ingestion format. Its `arize-phoenix-otel` package exports traces in OTEL format.

Tenure's SER router adds tenure-specific span attributes (the `tenure.`* namespace) that carry execution routing metadata, thinking-time metering, and billing data. Any OTEL backend can store and query these attributes. Laminar's SQL editor can query `WHERE tenure.execution_type = 'critical_transaction'`. Phoenix can filter experiments by `tenure.model_tier`. Braintrust can correlate prompt versions with `tenure.cost_usd`.

### Configuration

```json
// tenure.config.json
{
  "observability": {
    "backend": "laminar",           // "laminar" | "braintrust" | "phoenix" | "otel"
    "laminar": {
      "projectApiKey": "lmnr_...",
      "endpoint": "https://api.laminar.sh"   // or self-hosted URL
    },
    "braintrust": {
      "apiKey": "bt_...",
      "project": "my-agent"
    },
    "phoenix": {
      "endpoint": "http://localhost:6006"
    },
    "otel": {
      "endpoint": "http://localhost:4318"     // any OTEL collector
    }
  }
}
```

Setting `backend: "otel"` exports raw OTEL spans to any collector — Jaeger, Grafana Tempo, Datadog, Honeycomb. This is the escape hatch for teams with existing observability infrastructure.

---

## What Each Backend Gives Tenure

### Laminar — Default for self-hosted (OSS ↔ OSS alignment)

Laminar is the recommended default because it matches tenure's open-core model: self-hostable, MIT-friendly, and built for agent-specific observability. The integration provides:

**Trace replay.** An agent that failed at step 47 of a 60-step workflow can be replayed from any point in Laminar's trace UI. Combined with Temporal's event history replay, this gives two complementary views: Temporal shows the durable execution state (which Activities completed, which retried), Laminar shows the LLM reasoning state (what the model was thinking, what tokens it consumed, what tool call it decided on).

**Browser session replay.** Laminar captures screen recordings from browser agents (Playwright, Browserbase, Stagehand) and syncs them with agent traces. When the SER router classifies a tool call as a Stateful Session and wraps it in a heartbeated child workflow, Laminar's browser replay shows exactly what the agent was seeing on screen at each heartbeat. This is the observability layer that makes the "resume after crash" promise verifiable — you can watch the agent's browser session, see the crash point, and verify that the resumed session picks up from the correct page.

**Semantic events.** Laminar lets you define events with natural language descriptions ("agent attempted to access unauthorized resource", "agent produced contradictory outputs in consecutive calls"). These events are extracted from traces automatically. For tenure, semantic events map to auto-revoke triggers: if Laminar detects the semantic event "agent produced duplicate tool call output", tenure's lifecycle manager can receive that signal and trigger a revoke back to probationary mode.

**SQL access.** All trace data is queryable via SQL. This powers tenure's `eval` command — performance reviews are SQL queries against Laminar's trace store:

```sql
SELECT
  shift_id,
  COUNT(*) as total_calls,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as successful,
  SUM(tenure_cost_usd) as total_cost,
  AVG(duration_ms) as avg_latency
FROM spans
WHERE agent_id = 'atlas-sdr'
  AND shift_id LIKE 'shift-2026-04-%'
GROUP BY shift_id
ORDER BY shift_id
```

### Braintrust — Default for cloud teams wanting prompt management

Braintrust adds capabilities that Laminar does not have: prompt versioning, offline evals, and A/B testing of prompt variants. The integration uses the `BraintrustPlugin` pattern from the Temporal blog post, extended with tenure's SER attributes.

**Prompt versioning.** The SER router's model routing decision (frontier/mid/cheap) determines which model handles a tool call. But the prompt that drives the model's reasoning is equally important. Braintrust lets tenure operators version their agent's SOUL.md system prompt, test variants against historical traces, and deploy new versions without code changes. The `tenure eval` command can pull Braintrust's eval scores alongside Laminar's trace data to produce a performance review that includes both execution metrics and prompt quality metrics.

**Offline evals.** Braintrust's eval harness runs saved traces through new prompt versions to measure regression. For tenure, this means: after a shift, export the trace to Braintrust, test a new SOUL.md prompt against the same tool calls, and measure whether task completion would have improved. This is the quality improvement loop that makes the `grant` → `tenured` → `eval` lifecycle data-driven rather than vibes-based.

**Cost attribution by prompt version.** Braintrust tracks cost per prompt version. Combined with tenure's thinking-time metering, operators can answer: "Did the new system prompt increase task completion enough to justify the 15% increase in thinking-time cost?"

### Phoenix — Default for eval-heavy research workflows

Phoenix is strongest on the experimentation axis. For tenure's Direction 4 (Privacy-Routed ML Research Cloud), Phoenix provides:

**Embedding drift detection.** When an agent's Mem0 memory grows over months of shifts, the semantic distribution of its memory can drift. Phoenix detects this drift and surfaces it as an alert — the agent's "knowledge" is changing in ways that may not be intentional.

**Experiment tracking.** Phoenix tracks experiments across agent configurations: different SOUL.md prompts, different skill sets, different SER routing parameters. For researchers running multiple agent variants in parallel, Phoenix provides the comparison framework.

**Dataset management.** Phoenix creates annotated datasets from production traces. For tenure, this means: traces from high-performing shifts can be exported as training datasets for fine-tuning the SER router's classification model (the runtime inference engine that classifies unknown skills).

---

## Integration Points in Code

### SER Router Span Emission

```typescript
// src/router/instrument.ts
import { trace, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('tenure-ser-router');

export function instrumentToolCall(
  skillName: string,
  classification: ExecutionClassification,
  meterEvent: MeterEvent
) {
  return tracer.startSpan(skillName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      // Tenure-specific attributes
      'tenure.execution_type': classification.type,
      'tenure.primitive': classification.primitive,
      'tenure.retry_policy': JSON.stringify(classification.retryPolicy),
      'tenure.compensation': classification.compensation || 'none',
      'tenure.hitl_required': classification.hitlRequired,

      // Thinking-time metering
      'tenure.model': meterEvent.model,
      'tenure.model_tier': meterEvent.modelTier,
      'tenure.input_tokens': meterEvent.inputTokens,
      'tenure.output_tokens': meterEvent.outputTokens,
      'tenure.cost_usd': meterEvent.costUsd,
      'tenure.cached': meterEvent.cached,

      // Shift context
      'tenure.agent_id': meterEvent.agentId,
      'tenure.shift_id': meterEvent.shiftId,
      'tenure.budget_pct': meterEvent.budgetPct,

      // Marketplace (if applicable)
      'tenure.skill_pricing_model': meterEvent.pricingModel || 'free',
      'tenure.builder_id': meterEvent.builderId || null,
      'tenure.builder_charge_usd': meterEvent.builderChargeUsd || 0,
    }
  });
}
```

### Temporal Worker with Observability Plugin

```typescript
// src/worker.ts
import { Worker } from '@temporalio/worker';
import { getObservabilityPlugin } from './observability';
import { loadConfig } from './config';

const config = loadConfig();

// Returns BraintrustPlugin, LaminarPlugin, or OTELPlugin
// based on tenure.config.json
const obsPlugin = getObservabilityPlugin(config.observability);

const worker = await Worker.create({
  taskQueue: config.taskQueue,
  workflows: [agentWorkflow],
  activities: allActivities,
  sinks: obsPlugin.sinks,           // Temporal-native sink for workflow-level events
  interceptors: obsPlugin.interceptors,  // Activity-level span creation
});
```

### Laminar Integration (self-hosted default)

```typescript
// src/observability/laminar.ts
import { Laminar } from '@lmnr-ai/lmnr';

export function createLaminarPlugin(config: LaminarConfig) {
  Laminar.initialize({
    projectApiKey: config.projectApiKey,
    baseUrl: config.endpoint,          // self-hosted or cloud
    instrumentModules: {
      openAI: true,
      anthropic: true,
    }
  });

  return {
    sinks: {},
    interceptors: {
      activityInbound: [(ctx) => ({
        async execute(input) {
          // Laminar auto-instruments LLM calls within this activity
          // SER router's OTEL spans are captured automatically
          return ctx.next.execute(input);
        }
      })]
    }
  };
}
```

### Braintrust Integration (cloud option)

```typescript
// src/observability/braintrust.ts
import { initLogger } from 'braintrust';
import { BraintrustPlugin } from 'braintrust/contrib/temporal';

export function createBraintrustPlugin(config: BraintrustConfig) {
  initLogger({ project: config.project, apiKey: config.apiKey });

  return {
    sinks: {},
    interceptors: new BraintrustPlugin().interceptors,
    // Braintrust plugin automatically creates spans for
    // every workflow execution and activity invocation
  };
}
```

### Phoenix Integration (eval workflows)

```typescript
// src/observability/phoenix.ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export function createPhoenixPlugin(config: PhoenixConfig) {
  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
  });

  return {
    sinks: {},
    interceptors: {
      activityInbound: [(ctx) => ({
        async execute(input) {
          // Phoenix receives OTEL spans with tenure.* attributes
          // via the standard OTEL export pipeline
          return ctx.next.execute(input);
        }
      })]
    },
    exporter,
  };
}
```

---

## How Observability Powers Tenure Features


| Tenure Feature                     | Data Source                                                | Observability Backend Used                             |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `tenure eval` (performance review) | Aggregated span metrics per shift                          | Laminar SQL or Braintrust metrics API                  |
| `tenure certify --crash-recovery`  | Span continuity across workflow replays                    | Temporal event history + Laminar trace replay          |
| `tenure certify --no-duplicate`    | Duplicate span detection across mutations                  | Laminar semantic events or custom OTEL query           |
| Auto-revoke triggers               | Anomaly detection on span patterns                         | Laminar semantic events → tenure lifecycle signal      |
| Thinking-time dashboard            | `tenure.cost_usd` and `tenure.*_tokens` attributes         | Any OTEL backend with attribute filtering              |
| Budget enforcement                 | Cumulative `tenure.cost_usd` per shift                     | SER router internal state (no external backend needed) |
| Browser crash replay               | Browser recording synced with trace                        | Laminar browser replay (unique to Laminar)             |
| Prompt A/B testing                 | Eval scores per prompt version                             | Braintrust (unique to Braintrust)                      |
| Embedding drift alerts             | Memory vector distribution over time                       | Phoenix (unique to Phoenix)                            |
| Builder skill analytics            | `tenure.builder_id` + `tenure.builder_charge_usd` per span | Any OTEL backend with aggregation                      |


---

## Recommended Stack by User Type


| User                               | Observability Stack                      | Why                                                                             |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Solo OpenClaw dev** (v0 target)  | Laminar self-hosted via `docker compose` | Free, local, matches OSS ethos, browser replay for debugging                    |
| **Small team on tenure cloud**     | Laminar managed (cloud)                  | Zero setup, SQL dashboards, semantic events for auto-revoke                     |
| **Team iterating on prompts**      | Braintrust + Laminar                     | Braintrust for prompt versioning + evals, Laminar for execution traces          |
| **ML research team**               | Phoenix + Laminar                        | Phoenix for experiment tracking + embedding drift, Laminar for agent traces     |
| **Enterprise with existing stack** | OTEL export to Datadog/Grafana           | Uses `backend: "otel"` escape hatch, tenure spans flow into existing dashboards |


---

## Implementation Priority

**v0.5:** SER router emits OTEL spans with `tenure.`* attributes. Laminar self-hosted integration via `docker compose` bundled with `tenure dashboard`. Basic trace viewing in local dashboard. No Braintrust or Phoenix integration yet.

**v1.0:** Braintrust plugin for cloud users. Laminar managed as default cloud backend. `tenure eval` queries Laminar SQL for performance reviews. Semantic events for auto-revoke triggers.

**v1.5:** Phoenix integration for eval workflows. Prompt A/B testing via Braintrust. Builder analytics dashboard powered by `tenure.builder_`* span attributes.

---

## Key Design Principle

Tenure is an **execution platform**, not an observability platform. It emits rich, structured telemetry from the SER router and lets purpose-built observability tools handle storage, querying, visualization, and alerting. The OTEL span with `tenure.`* attributes is the contract between tenure and the observability ecosystem. Any tool that reads OTEL spans can integrate with tenure. This prevents tenure from building a mediocre dashboard when Laminar, Braintrust, and Phoenix each build excellent ones for different use cases.