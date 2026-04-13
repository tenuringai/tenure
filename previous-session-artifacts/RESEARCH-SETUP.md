# Tenure Research Setup Guide

### Environment, Codebases, Execution Plan & Updated Research Brief

### April 12, 2026

---

## 1. Environment Decision

**Use Cursor IDE with Claude as the research agent.** Not a $100 deep research API call — a structured, multi-session research workflow where you control the depth at each step.

The reason is simple: this research requires reading source code, cross-referencing academic papers, and producing structured JSON that becomes test cases. A single-shot deep research prompt cannot iterate. Cursor with the full codebases loaded as context lets you ask follow-up questions, correct misclassifications, and validate edge cases interactively. You are the domain expert on the pain (you posted the Reddit thread). The AI is the systematic analyzer. The IDE is where those two meet.

**Alternative if you want the $100 single-shot approach:** Use Claude's deep research feature with the updated brief at the end of this document. The trade-off is less control over output quality but faster turnaround. You can do both — run the deep research for the broad sweep, then use Cursor for the detailed source-code-level validation.

---

## 2. Codebases to Download

Create a dedicated research workspace. Every codebase below serves a specific purpose in the research.

### 2.1 Primary: OpenClaw Runtime (the subject of the research)

```bash
mkdir ~/tenure-research && cd ~/tenure-research

# OpenClaw — the agent runtime you are building on
git clone https://github.com/openclaw/openclaw.git
```

**What to focus on in this codebase:**

The Agent Runtime loop lives in `src/agents/`. This is where tool calls are decided, dispatched, and results are processed. Every crash recovery test case maps to a specific function in this directory.

The Gateway lives in `src/gateway/`. This is the WebSocket control plane that brokers connections between the agent, the Node-Host, and channel adapters. Crash points involving reconnection and message routing are here.

The Node-Host lives in `src/node-host/`. This is the privileged execution process on the user's machine. The exec policy pipeline (allowlist evaluation, approval state, execution) is in `src/node-host/invoke.ts`. This is where the Texas A&M paper found the lexical parsing vulnerabilities.

The Plugins & Skills system lives in `src/plugins/`. This is where SKILL.md files are loaded into the agent's context. The progressive disclosure model (metadata first, full instructions on demand) is implemented here.

The Memory system manages conversation history and context compaction. Look for how session state is serialized and where it exists only in memory (these are your crash-recovery vulnerability points).

### 2.2 Secondary: Temporal Patterns (the execution model you are adopting)

```bash
# temporal-ai-agent — the reference pattern for agent-as-workflow
git clone https://github.com/temporal-community/temporal-ai-agent.git

# zeitlich — the most mature Temporal + AI agent framework
git clone https://github.com/bead-ai/zeitlich.git
```

**What to focus on in temporal-ai-agent:**

The workflow definition that maps one agent session to one Temporal workflow. The activity definitions that wrap individual tool calls. The signal handling for multi-turn conversations. This is the simplest correct implementation of the pattern you are building.

**What to focus on in zeitlich:**

ThreadOps (how conversation state is persisted to Redis across workflow replays). SandboxOps (how filesystem state is isolated per agent). The skills system and its agentskills.io integration. The subagent pattern (child workflows). Lifecycle hooks (onToolStart, onToolEnd). These are the patterns your adapter will implement.

### 2.3 Tertiary: Observability Backends (the telemetry consumers)

```bash
# Laminar — your default OSS observability backend
git clone https://github.com/lmnr-ai/lmnr.git

# Phoenix — eval-focused observability
git clone https://github.com/Arize-ai/phoenix.git
```

**What to focus on:** How each backend ingests OpenTelemetry spans. What span attributes they expect. How they render traces, dashboards, and alerts. This informs the `tenure.`* OTEL attribute schema you emit from the SER router.

### 2.4 Academic Papers (download PDFs into the workspace)

```bash
mkdir ~/tenure-research/papers

# You already have the Texas A&M paper (arXiv:2603.27517)
# Download the remaining five:
```


| Paper                                   | arXiv ID   | Local filename       |
| --------------------------------------- | ---------- | -------------------- |
| Texas A&M Taxonomy (190 advisories)     | 2603.27517 | `tamu-190.pdf`       |
| Taming OpenClaw (26% malicious)         | 2603.11619 | `taming-26.pdf`      |
| Your Agent Their Asset (CIK taxonomy)   | 2604.04759 | `cik-taxonomy.pdf`   |
| Systematic Evaluation (6 Claw variants) | 2604.03131 | `claw-6-eval.pdf`    |
| Don't Let the Claw Grip (MITRE mapping) | 2603.10387 | `grip-mitre.pdf`     |
| FASA Architecture (ClawGuard)           | 2603.12644 | `fasa-clawguard.pdf` |


### 2.5 Community Evidence (save locally for reference)

```bash
mkdir ~/tenure-research/community
```

Save the following as markdown files in this directory:

- Your Reddit thread ("Tired of cron jobs crashes and fear of max token burn") — full text with all comments
- The deep research output you already have ("AI agents retry everything the same way") — the community evidence document
- OpenClaw Issue #10164 — full text with all comments
- LangGraph RFC #6617 — full text
- Pydantic AI Issue #83 — full text with the closure comment

---

## 3. Cursor IDE Setup

### 3.1 Workspace Structure

Open Cursor with the entire `~/tenure-research` directory as the workspace root:

```
tenure-research/
├── openclaw/                    # OpenClaw source code
├── temporal-ai-agent/           # Temporal reference pattern
├── zeitlich/                    # Zeitlich framework
├── lmnr/                       # Laminar observability
├── phoenix/                    # Phoenix observability
├── papers/                     # 6 PDF papers
│   ├── tamu-190.pdf
│   ├── taming-26.pdf
│   ├── cik-taxonomy.pdf
│   ├── claw-6-eval.pdf
│   ├── grip-mitre.pdf
│   └── fasa-clawguard.pdf
├── community/                  # Community evidence
│   ├── reddit-token-burn.md
│   ├── community-research.md
│   ├── issue-10164.md
│   ├── langgraph-rfc-6617.md
│   └── pydantic-issue-83.md
├── output/                     # Research outputs go here
│   ├── crash-recovery-matrix.json
│   ├── skill-durability-mapping.json
│   └── community-evidence-validation.json
└── RESEARCH-BRIEF.md           # The research instructions (this document's brief section)
```

### 3.2 Cursor Rules File

Create a `.cursorrules` file at the workspace root that gives Claude the research context:

```markdown
# Tenure Research Context

You are conducting research for Tenure, a durable skill development platform for OpenClaw.

## Your Role
You are a senior distributed systems engineer analyzing OpenClaw's source code to produce
structured data that ships directly into the tenure codebase as test cases, classification
rules, and cited documentation.

## Key Concepts
- Semantic Execution Router (SER): classifies every tool call by execution type and routes
  to the correct Temporal primitive
- Six execution types: idempotent_read, side_effect_mutation, stateful_session,
  critical_transaction, long_running_process, human_interactive
- Thinking-time billing: only LLM inference tokens are billable; idle/sleeping = free
- SKILL.md execution: block: tenure's proposed extension to agentskills.io metadata

## Codebases in This Workspace
- openclaw/ — the agent runtime being analyzed (focus: src/agents/, src/gateway/,
  src/node-host/, src/plugins/)
- temporal-ai-agent/ — reference pattern for agent-as-workflow
- zeitlich/ — ThreadOps, SandboxOps, skills, subagents patterns
- lmnr/ — Laminar observability (OTEL span ingestion)
- phoenix/ — Phoenix observability (evals, experiments)

## Papers Available
- tamu-190.pdf: 190 advisories, architectural layers, trust boundaries
- taming-26.pdf: 26% malicious skills, multi-stage threats
- cik-taxonomy.pdf: CIK (Capability/Identity/Knowledge) attack taxonomy
- claw-6-eval.pdf: 205 test cases across 6 Claw variants
- grip-mitre.pdf: 47 adversarial scenarios, MITRE mapping
- fasa-clawguard.pdf: FASA architecture, SSH-stealing malware in 1,184 packages

## Community Evidence
- reddit-token-burn.md: founder's own thread on r/openclaw
- community-research.md: "AI agents retry everything the same way"
- issue-10164.md: OpenClaw Temporal feature request (13 upvotes, unresponded)
- langgraph-rfc-6617.md: five proposed reliability primitives, none shipped
- pydantic-issue-83.md: read/write distinction proposed, closed as docs question

## Output Format
All research output must be structured JSON per the schemas in RESEARCH-BRIEF.md.
Every claim must cite a specific source: paper key, source file path, or community URL.
The output goes in the output/ directory.
```

### 3.3 Research Execution Sequence

Do not try to produce all three artifacts in one session. Break the research into focused sessions, each producing one artifact.

**Session 1: Crash Recovery Matrix (2–3 hours)**

Open `openclaw/src/agents/` and `openclaw/src/node-host/` in Cursor. Tell Claude to read the agent runtime loop and identify every point where a SIGKILL would result in state loss. Work through each crash point interactively — ask Claude to find the specific function, identify what state is in memory only, and propose the recovery strategy. Cross-reference with `tamu-190.pdf` for known vulnerabilities at each crash point. Output each entry as JSON into `output/crash-recovery-matrix.json`.

Start with this prompt:

```
Read openclaw/src/agents/pi-embedded-runner/run.ts and 
openclaw/src/agents/pi-embedded-subscribe/handlers/tools.ts.

Map the complete agent execution loop — from receiving a user message 
through LLM inference, tool call decision, tool call execution, result 
processing, and context update.

For each step in this loop, identify: what state exists only in memory, 
what has been persisted, and what happens if the process receives SIGKILL 
at that exact moment.

Output as structured JSON per the crash point schema in RESEARCH-BRIEF.md.
Start with crash points CP-001 through CP-005.
```

**Session 2: Skill Durability Mapping (2–3 hours)**

Open `openclaw/src/plugins/` and the SKILL.md files from ClawHub. Tell Claude to classify each of the top 30 skills by reading its actual implementation (not just its description). For each skill, ask Claude to identify edge cases where the primary classification would be wrong. Cross-reference with `cik-taxonomy.pdf` for attack patterns that affect each skill type.

Start with this prompt:

```
Read the SKILL.md specification at agentskills.io/specification and 
the skill loading code in openclaw/src/plugins/.

For each of the following skills, classify by execution type and 
identify at minimum two edge cases where the classification changes 
based on parameters or context:

Skills 1-10: Sequential Thinking, Shell/Bash, File Read, File Write, 
File Edit, GitHub API, Web Search, Web Fetch, Grep, Glob.

For each skill, read the actual implementation or tool handler in 
openclaw/src/agents/pi-embedded-subscribe/handlers/tools.ts to verify 
the classification.

Output as structured JSON per the skill schema in RESEARCH-BRIEF.md.
```

**Session 3: Community Evidence Validation (1–2 hours)**

Open `community/community-research.md` in Cursor. Tell Claude to cross-reference every claim against the academic papers and OpenClaw source code. For each of the seven gaps, verify whether tenure's architecture closes it. For each framework failure mode, produce a test case.

Start with this prompt:

```
Read community/community-research.md — the full community evidence 
document on agent tool reliability.

For each of the seven gaps in the "What's missing" column of the 
competitive gap table, verify whether tenure's Semantic Execution 
Router architecture addresses the gap. Produce a closure entry per 
the schema in RESEARCH-BRIEF.md.

Then for each framework-specific failure mode (LangChain node-level 
retry, LangGraph HITL resume bug, CrewAI false completion, AutoGen 
conversational retry, Google ADK uniform retry, Pydantic AI tool 
retry limitation), produce a test case that verifies tenure does 
not exhibit the same failure.
```

---

## 4. Updated Research Brief (All Three Artifacts)

This is the complete, self-contained research brief. Use it either as context for Cursor sessions or as a single-shot deep research prompt.

---

### RESEARCH BRIEF: Tenure Durable Skill Development Platform

**Budget:** $100 (if using deep research) or 6–8 hours of Cursor sessions
**Output:** Three JSON files that ship directly into the codebase

**Context:** Tenure wraps OpenClaw agent sessions in Temporal workflows. Every tool call passes through a Semantic Execution Router that classifies the call by execution type and routes it to the correct Temporal primitive. The founder posted the Reddit thread "Tired of cron jobs crashes and fear of max token burn" — this is not hypothetical research; the founder has the problem.

---

#### Artifact 1: Crash Recovery Determinism Matrix

**File:** `output/crash-recovery-matrix.json`

Analyze the OpenClaw source code (focus: `src/agents/`, `src/gateway/`, `src/node-host/`, `src/plugins/`) and identify every point in the agent execution loop where a SIGKILL results in state loss.

For each crash point, produce:

```json
{
  "crash_point_id": "CP-003",
  "crash_point_name": "Mid-tool-call execution",
  "openclaw_component": "Agent Runtime → Local Execution",
  "source_files": ["src/agents/pi-embedded-subscribe/handlers/tools.ts", "src/node-host/invoke.ts"],
  "state_in_memory_only": ["Tool execution progress", "Partial tool result buffer"],
  "state_persisted_before_crash": ["Tool call decision in conversation history"],
  "side_effects_possible": true,
  "side_effects_description": "Email sent, file partially written, API request received by remote server",
  "recovery_strategy": "Activity retry with idempotency key",
  "replay_safe": false,
  "replay_safe_reason": "Side-effecting tools may have completed on remote server",
  "idempotency_required": true,
  "compensation_required": "Only if downstream steps fail",
  "minimum_checkpoint_data": ["Tool call ID", "Tool name and parameters", "Temporal Activity task token"],
  "temporal_primitive": "Activity with StartToCloseTimeout and HeartbeatTimeout",
  "test_case": {
    "description": "SIGKILL during HTTP POST to Stripe API",
    "setup": "Start agent with Stripe skill, trigger charge, SIGKILL after request sent before response",
    "assertion": "Exactly 1 charge in Stripe. Agent resumes with charge result. Next tool call executes."
  },
  "non_determinism_risks": ["Random request ID generated inside workflow code instead of Activity"],
  "paper_references": ["[TAMU-190] exec policy bypass", "[CIK-TAX] Capability poisoning"],
  "severity": "critical"
}
```

Produce 15–25 entries covering: mid-inference, between decision and execution, mid-tool-call (sub-variants by tool type), post-completion pre-delivery, during compaction, during skill loading, during cron trigger, during multi-agent communication, during WebSocket reconnection, during Docker sandbox execution.

Cross-reference each crash point against `tamu-190.pdf` for overlapping security vulnerabilities.

---

#### Artifact 2: Skill-to-Durability Mapping with Edge Cases

**File:** `output/skill-durability-mapping.json`

For each of the top 30 OpenClaw skills, read the actual tool handler in the OpenClaw source code (not just the SKILL.md description) and produce:

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
      "detection_signal": "Presence of waitForReply in skill config",
      "why_primary_is_wrong": "Skill blocks on external human response",
      "temporal_primitive_override": "Signal / waitForEvent",
      "thinking_cost_override": "Zero while waiting"
    }
  ],
  "conditional_classification_tree": {
    "default": "side_effect_mutation → Activity, dedup guard, 3x retry",
    "if waitForReply": "human_interactive → Signal, zero compute"
  },
  "static_classification_sufficient": false,
  "runtime_inference_required": true,
  "runtime_inference_signals": ["Presence of waitForReply in skill config"],
  "agentskills_metadata": {
    "tenure.execution_type": "side_effect_mutation",
    "tenure.retry": "3",
    "tenure.compensation": "none",
    "tenure.hitl": "none",
    "tenure.thinking_cost": "low"
  },
  "paper_references": ["[CIK-TAX] Capability poisoning via messaging tools"],
  "community_references": ["[REDDIT-BURN] duplicate message workarounds"]
}
```

Skills 1–30 in priority order. Minimum two edge cases per skill. Cross-reference with `cik-taxonomy.pdf` for attack patterns and `taming-26.pdf` for known malicious skill patterns.

---

#### Artifact 3: Community Evidence Validation & Gap Closure

**File:** `output/community-evidence-validation.json`

Three sections in one file.

**Section 3a: Seven Gaps Closure Matrix.** For each of the seven capabilities from the community research document:

```json
{
  "gap": "read_write_classification",
  "community_status": "Pydantic AI conceptually distinguishes retrievers vs tools; no framework ships it",
  "tenure_primitive": "SER router execution type classification",
  "implementation": "TAXONOMY.md + tenure.execution_type metadata field",
  "gap_closed": true,
  "remaining_risk": "Unknown skills without metadata fall back to runtime inference (cloud only)"
}
```

**Section 3b: Framework Failure Mode Test Cases.** For each documented framework failure:

```json
{
  "framework": "LangChain/LangGraph",
  "failure_mode": "RetryPolicy operates at node level, not tool level",
  "community_source": "community-research.md, competitive gap table",
  "tenure_test_case": {
    "description": "Two tool calls in sequence: idempotent read then side-effecting write. Fail the write. Verify only write retries.",
    "assertion": "Read result from cache. Write retries with idempotency key. Read not re-executed.",
    "certification": "no-duplicate"
  }
}
```

Minimum six test cases: one per framework (LangChain, LangGraph, CrewAI, AutoGen, Google ADK, Pydantic AI).

**Section 3c: Quantitative Claims Verification.** For each number cited in the community research:

```json
{
  "claim": "Tool calls fail 3-15% of the time in production",
  "source_in_community_doc": "Deliverable 1, 'Tool calling fails 3-15%' section",
  "primary_source_url": null,
  "primary_source_verified": false,
  "corroborating_sources": ["Vercel AI SDK Issue #7261 (3-5% duplicate rate)"],
  "reliability_assessment": "Plausible range, not peer-reviewed, corroborated by multiple independent reports",
  "tenure_impact": "SER router reduces effective failure rate for reads (aggressive retry + cache) while converting write failures into HITL escalations"
}
```

Verify at minimum: 3–15% failure rate, 95%/60% compounding math, 89% LangChain pattern-ignoring claim, 3–5% Vercel duplicate rate, 26% malicious skill rate (from taming-26.pdf vs. Cisco's 15%), and $3,600 monthly bill report.

---

## 5. Validation Checklist

After all three artifacts are produced, verify:

**Crash Recovery Matrix:**

- Every crash point cites a specific OpenClaw source file and function
- Every crash point has a test case with setup, execution, and assertion
- Every crash point cross-references at least one academic paper
- Non-determinism risks are documented for each crash point
- Total coverage: 15–25 entries spanning the full agent loop

**Skill Durability Mapping:**

- All 30 skills classified with execution type and confidence score
- Every skill has minimum two edge cases (or documented reason why static classification is sufficient)
- Edge case detection signals are observable at classification time (not internal to tool implementation)
- Conditional classification trees are implementable as router rules
- agentskills_metadata fields are valid per the TAXONOMY.md schema

**Community Evidence Validation:**

- All seven gaps have closure entries with specific tenure primitives
- Six framework failure mode test cases produced (one per framework)
- All quantitative claims traced to primary or corroborating sources
- Reliability assessments are honest (mark unverifiable claims as such)

**Cross-Artifact Consistency:**

- Crash point severities align with skill classification edge cases (a critical crash point for a skill should be reflected in that skill's edge case documentation)
- Paper citations use consistent keys ([TAMU-190], [TAMING-26], [CIK-TAX], [CLAW-6], [GRIP], [FASA])
- Community citations use consistent keys ([REDDIT-BURN], [ISSUE-10164], [LANGGRAPH-6617], [PYDANTIC-83])

---

## 6. What Happens After Research

The three JSON files become code through the following pipeline:

`crash-recovery-matrix.json` → each `test_case` field becomes a test in `src/certify/crash-recovery.test.ts`. Each `non_determinism_risks` field becomes a code comment in the OpenClaw adapter. Each `minimum_checkpoint_data` field becomes the state that the adapter must capture before each Temporal Activity.

`skill-durability-mapping.json` → each `agentskills_metadata` field becomes a row in TAXONOMY.md. Each `conditional_classification_tree` becomes a routing rule in `src/router/classify.ts`. Each `runtime_inference_signals` field becomes a feature vector for the embedding-based classifier (cloud product).

`community-evidence-validation.json` → each gap closure entry becomes a line in the README's "What You Stop Building By Hand" section. Each framework test case becomes a test in `src/certify/`. Each verified claim becomes a cited number in the README and docs.

The research is complete when `npx tenure certify --ci` passes with all three artifact-derived test suites green.