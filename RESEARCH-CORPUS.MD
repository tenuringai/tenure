## How To Read This File

This file is the **base research ledger** for Tenure.

It is intentionally broader than the current OSS wedge because the links, issues, papers, and adjacent references are all valuable research inputs. Nothing below should be treated as deprecated merely because the current wedge is narrower.

Use this file with the following interpretation:

- `README.md` explains the current public wedge
- `RESEARCH-SETUP.md` is the current source of truth for research direction
- `tenure-deep-research-brief.md` is the execution-focused research prompt
- this file is the raw evidence base those docs draw from

In other words:

- the root docs are the **current doctrine**
- this file is the **research corpus**

## Current Wedge Lens

The current root-doc wedge is:

- prove OpenClaw adapter correctness
- prove every call goes through the SER router
- prove execution lands on the Temporal timeline
- prove replay does not duplicate side effects
- prove cron survives Worker death

That means the most important entries in this file, for the current phase, are the ones that strengthen:

- the OpenClaw persistence insufficiency case
- the strong execution boundary
- the router-to-timeline architecture
- the read -> write -> cron proof ladder
- the eventual Issue `#10164` proof story

## Priority Reading Order

If using this file to drive the current wedge, read it in this order:

1. OpenClaw core engine repos
2. Temporal reference repos
3. OpenClaw durability and persistence issues
4. OpenClaw security/reliability papers
5. agentskills/spec references for the `execution:` contract
6. observability repos and docs
7. broader marketplace, ecosystem, and competitor references

## Contract Interpretation

This file predates some of the tighter contract language now used in the root docs. When reading references here, interpret them through the current root model:

- `execution:` is the author-facing execution contract
- `TAXONOMY.md` provides defaults when a skill declares nothing
- runtime inference is the fallback
- SER is the enforcement layer
- the Temporal timeline is the proof surface

So references to skills, metadata, taxonomy, retry, observability, and monetization should all be understood through that normalized contract model.

## Why Nothing Here Should Be Deleted

Some links below are not first-order inputs for the current wedge, but they still matter because they help with:

- future product breadth
- standards adoption
- marketplace design
- observability design
- competitive positioning
- later certification and scanner work

This file should therefore remain a superset ledger, not a narrowly pruned implementation brief.

---

**Repos — Core Engine**

```
git clone https://github.com/openclaw/openclaw.git                    # The agent runtime you build on
git clone https://github.com/temporal-community/temporal-ai-agent.git # Reference: agent-as-workflow pattern
git clone https://github.com/bead-ai/zeitlich.git                    # Reference: ThreadOps, SandboxOps, skills, subagents
git clone https://github.com/encoredev/encore.git                    # Reference: DX patterns, local dashboard, type-safe services
```

**Repos — Observability**

```
git clone https://github.com/lmnr-ai/lmnr.git                       # Default OSS observability backend (Rust, YC S24)
git clone https://github.com/Arize-ai/phoenix.git                    # Eval-focused observability, embedding drift
git clone https://github.com/braintrustdata/braintrust-sdk.git       # Cloud observability, prompt versioning, Temporal plugin
```

**Repos — Skill Ecosystem**

```
git clone https://github.com/anthropics/skills.git                   # Anthropic's official skill-creator + spec
git clone https://github.com/agentskills/agentskills.git             # The agentskills.io specification repo
git clone https://github.com/VoltAgent/awesome-openclaw-skills.git   # Community catalog, 5,400+ skills, your CI test source
git clone https://github.com/alirezarezvani/claude-skills.git        # 232+ skills, 11 platforms, 5,200+ stars
git clone https://github.com/heilcheng/awesome-agent-skills.git      # Curated tutorials and directories
git clone https://github.com/PipedreamHQ/awesome-mcp-servers.git     # MCP server catalog, 3,600+ stars
git clone https://github.com/wong2/awesome-mcp-servers.git           # Alternative MCP server catalog
git clone https://github.com/appcypher/awesome-mcp-servers.git       # Another MCP server catalog
git clone https://github.com/pedrojaques99/popular-mcp-servers.git   # Popular MCP servers by Smithery usage data
```

**Repos — Competitors & Adjacent**

```
git clone https://github.com/RasaHQ/rasa.git                        # CALM architecture: LLM understands, flows enforce
git clone https://github.com/gitroomhq/postiz-app.git                # Your launch scheduling tool (self-host via Docker)
```

**Repos — Semantic Classification Reference**

```
git clone https://github.com/aurelio-labs/semantic-router.git         # Phase 5: embedding-based skill classification pattern
```

---

**Research Papers — OpenClaw Security (cite in scanner + TAXONOMY.md)**

| Key | Title | arXiv | Date | Core Finding |
|-----|-------|-------|------|-------------|
| `[TAMU-190]` | A Systematic Taxonomy of Security Vulnerabilities in the OpenClaw AI Agent Framework | 2603.27517 | Mar 2026 | 190 advisories, 10 architectural layers, per-layer trust enforcement, skill supply chain as attack vector |
| `[TAMING-26]` | Taming OpenClaw: Security Analysis and Mitigation of Autonomous LLM Agent Threats | 2603.11619 | Mar 2026 | 26% of community skills contain vulnerabilities, multi-stage threat chains |
| `[CIK-TAX]` | Your Agent, Their Asset: A Real-World Safety Analysis of OpenClaw | 2604.04759 | Apr 2026 | CIK taxonomy (Capability/Identity/Knowledge), poisoning single dimension raises attack success from 24.6% to 64–74% |
| `[CLAW-6]` | A Systematic Security Evaluation of OpenClaw and Its Variants | 2604.03131 | Apr 2026 | 205 test cases across 6 Claw-series frameworks, agentized systems riskier than models in isolation |
| `[GRIP]` | Don't Let the Claw Grip Your Hand: A Security Analysis and Defense Framework | 2603.10387 | Mar 2026 | 47 adversarial scenarios, MITRE ATLAS/ATT&CK mapping, no built-in security constraints |
| `[FASA]` | Uncovering Security Threats and Architecting Defenses in Autonomous Agents | 2603.12644 | Mar 2026 | FASA architecture proposal, ClawGuard platform, top skill was SSH-stealing malware in 1,184 packages |

---

**Community Evidence (save as markdown in /community/)**

| Key | Source | URL | Relevance |
|-----|--------|-----|-----------|
| `[REDDIT-BURN]` | r/openclaw: "Tired of cron jobs crashes and fear of max token burn" | Your thread, Apr 12, 2026 | Founder's own pain validation, 509 views, 4 comments with workarounds |
| `[ISSUE-10164]` | OpenClaw Issue #10164: Native Temporal integration | github.com/openclaw/openclaw/issues/10164 | 13 upvotes, open since Feb 2026, no maintainer response |
| `[ISSUE-62442]` | OpenClaw Issue #62442: Gateway restart causes session state loss | github.com/openclaw/openclaw/issues/62442 | Apr 7, 2026, confirms session state is in-memory, not persisted |
| `[ISSUE-55343]` | OpenClaw Issue #55343: Agent loses conversation history between sessions | github.com/openclaw/openclaw/issues/55343 | History saves to disk but doesn't load — data exists, recovery broken |
| `[ISSUE-21382]` | OpenClaw Issue #21382: Session memory markdown not flushed before reset | github.com/openclaw/openclaw/issues/21382 | Critical context lost because save doesn't happen before death |
| `[LANGGRAPH-6617]` | LangGraph RFC #6617: Production reliability primitives | github.com/langchain-ai/langgraph | Five primitives proposed, none shipped as of Apr 2026 |
| `[PYDANTIC-83]` | Pydantic AI Issue #83: Tools that "do something" | github.com/pydantic/pydantic-ai/issues/83 | Read/write distinction proposed by Samuel Colvin, closed as docs question |
| `[VERCEL-7261]` | Vercel AI SDK Issue #7261: Duplicate tool calls | github.com/vercel/ai/issues/7261 | 3–5% duplicate rate, different tool call IDs |
| `[COMMUNITY-RESEARCH]` | "AI agents retry everything the same way" | Your deep research document | Seven-gap table, framework comparison, community workarounds |

---

**Documentation & Specs**

| Source | URL | Relevance |
|--------|-----|-----------|
| agentskills.io specification | agentskills.io/specification | The SKILL.md format, metadata field, progressive disclosure |
| Temporal docs — Activity execution | docs.temporal.io/activity-execution | Retry, heartbeat, timeout primitives |
| Temporal docs — continueAsNew | docs.temporal.io/workflows#continue-as-new | The shift boundary primitive |
| Temporal docs — Child Workflows | docs.temporal.io/child-workflows | Subagent pattern, ParentClosePolicy |
| Temporal blog — Braintrust integration | temporal.io/blog/building-observable-ai-agents | BraintrustPlugin pattern, OTEL spans |
| Temporal docs — Braintrust Python | docs.temporal.io/develop/python/integrations/braintrust | Python integration reference |
| OpenClaw session management | docs.openclaw.ai/reference/session-management-compaction | Compaction, memory flush, session persistence |
| Microsoft Agent Skills | learn.microsoft.com/en-us/agent-framework/agents/skills | Microsoft's SkillsProvider implementation |
| OpenAI Codex Skills | developers.openai.com/codex/skills | Codex SKILL.md adoption |
| VS Code Agent Skills | code.visualstudio.com/docs/copilot/customization/agent-skills | GitHub Copilot SKILL.md adoption |

---

**Marketplace & Monetization References**

| Platform | URL | Relevance |
|----------|-----|-----------|
| Soul.Markets | ClawHub skill: soul-markets | Agent monetization via soul.md, USDC payouts |
| Nevermined | nevermined.ai | Agent wallets, usage-based billing, A2A identity |
| Paid.ai | paid.ai | LLM cost analytics and billing models |
| SkillsMP | skillsmp.com | 800,000+ skill directory, SKILL.md standard |
| Cyrus AI | atcyrus.com/skills | Curated skills marketplace |
| Agensi | agensi.io | Skill discovery, security scanning, comparison guides |
