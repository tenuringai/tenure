import { useState, useEffect, useRef } from "react";

const roles = [
  { slug: "sdr", title: "SDR", desc: "Prospect, qualify, and book meetings autonomously", skills: ["Exa Search", "AgentMail", "Sixtyfour", "Mem0"], shift: "Mon–Fri 8AM–6PM", color: "#22c55e", failScenario: "Sends the same cold email twice to your hottest lead" },
  { slug: "devops", title: "DevOps Engineer", desc: "Monitor, deploy, and remediate infrastructure 24/7", skills: ["Kubernetes", "Terraform", "PagerDuty", "Sentry"], shift: "24/7 On-Call", color: "#3b82f6", failScenario: "Applies the same Terraform change twice, spinning up duplicate infra" },
  { slug: "content", title: "Content Producer", desc: "Research, write, render, and publish at scale", skills: ["Firecrawl", "Remotion", "ElevenLabs", "YouTube API"], shift: "Mon–Fri 6AM–2PM", color: "#f59e0b", failScenario: "Publishes duplicate videos after a render crash mid-upload" },
  { slug: "researcher", title: "Research Analyst", desc: "Deep-dive markets, competitors, and trends", skills: ["Exa Search", "Browserbase", "Mem0", "Notion"], shift: "Mon–Fri 9AM–5PM", color: "#8b5cf6", failScenario: "Loses 3 hours of research context when the browser session dies" },
  { slug: "support", title: "Support Agent", desc: "Triage tickets, resolve issues, escalate edge cases", skills: ["AgentMail", "Slack", "Composio", "Mem0"], shift: "Mon–Sun 6AM–10PM", color: "#ec4899", failScenario: "Silently drops a critical ticket — no alert, no retry, system looks green" },
  { slug: "bookkeeper", title: "Bookkeeper", desc: "Reconcile transactions, categorize expenses, flag anomalies", skills: ["Stripe", "Composio", "Google Sheets", "AgentMail"], shift: "Mon–Fri 7AM–3PM", color: "#14b8a6", failScenario: "Processes the same payment twice — the idempotency paradox in action" },
];

const stackLayers = [
  { name: "Shift Calendar", desc: "When your agent works", tag: "WHAT YOU SEE" },
  { name: "Semantic Execution Router", desc: "How each tool call runs durably", tag: "THE MOAT" },
  { name: "Temporal Primitives", desc: "Crash-proof execution substrate", tag: "THE SUBSTRATE" },
];

const words = ["bot", "script", "cron job", "workflow"];

const painStats = [
  { num: "3–15%", label: "tool call failure rate in production", src: "measured" },
  { num: "60%", label: "end-to-end success for a 10-step agent at 95% per-step", src: "compounding" },
  { num: "5", label: "reliability features every production team rebuilds from scratch", src: "community" },
];

const horrorStories = [
  { icon: "↻", title: "50,000 API calls", desc: "Agent stuck in a loop. Production down. Nobody could tell what it was doing or why.", color: "#ef4444" },
  { icon: "⊘", title: "Silent skip", desc: "Background agent silently dropped a tool call. No alert, no retry. System looked green. Downstream data was wrong.", color: "#f59e0b" },
  { icon: "◇◇", title: "Duplicate everything", desc: "Calendar events, emails, database rows — all created twice with the first run's data only.", color: "#8b5cf6" },
];

export default function TenuringLanding() {
  const [crossedWord, setCrossedWord] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef({});

  useEffect(() => {
    const interval = setInterval(() => setCrossedWord((p) => (p + 1) % words.length), 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) setVisibleSections((prev) => new Set([...prev, entry.target.id]));
      }),
      { threshold: 0.12 }
    );
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  const ref = (id) => (el) => { sectionRefs.current[id] = el; };
  const vis = (id) => visibleSections.has(id);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#09090b", color: "#fafafa", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes strikeIn { 0% { width: 0; } 100% { width: 105%; } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes countUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .strike-word { position: relative; display: inline-block; }
        .strike-word::after { content: ''; position: absolute; left: -2%; top: 52%; height: 4px; background: #ef4444; animation: strikeIn 0.4s ease-out forwards; border-radius: 2px; }
        .role-card { cursor: pointer; transition: all 0.25s ease; border: 1px solid rgba(255,255,255,0.06); }
        .role-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
        .nav-link { color: #a1a1aa; text-decoration: none; font-size: 14px; transition: color 0.2s; letter-spacing: 0.02em; }
        .nav-link:hover { color: #fafafa; }
        .hire-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: #fafafa; color: #09090b; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; letter-spacing: -0.01em; }
        .hire-btn:hover { background: #e4e4e7; transform: translateY(-1px); }
        .hire-btn-outline { background: transparent; color: #fafafa; border: 1px solid rgba(255,255,255,0.2); }
        .hire-btn-outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.3); }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .gradient-text { background: linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .glow-line { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent); }
        .stack-layer { transition: all 0.3s ease; }
        .stack-layer:hover { background: rgba(255,255,255,0.08) !important; }
        .section-label { font-size: 11px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #52525b; }
        .horror-card { border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 24px; background: rgba(255,255,255,0.02); }
        .stat-num { font-size: clamp(36px, 5vw, 56px); font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrollY > 50 ? "rgba(9,9,11,0.92)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
        borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>tenur</span>
          <span style={{ fontSize: 20, fontWeight: 300, color: "#71717a" }}>.ing</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#pain" className="nav-link">The Problem</a>
          <a href="#roles" className="nav-link">Roles</a>
          <a href="#architecture" className="nav-link">How It Works</a>
          <a className="nav-link" style={{ color: "#fafafa", fontWeight: 500 }}>Docs</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", textAlign: "center", padding: "120px 24px 60px", position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "64px 64px", opacity: 0.8,
        }} />
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
          width: 600, height: 600, background: "radial-gradient(circle, rgba(250,250,250,0.03) 0%, transparent 70%)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="mono section-label" style={{ marginBottom: 24 }}>THE DURABLE EXECUTION CLOUD FOR AI AGENTS</p>

          <h1 style={{
            fontSize: "clamp(40px, 7vw, 80px)", fontWeight: 700, lineHeight: 1.05,
            letterSpacing: "-0.04em", marginBottom: 24, maxWidth: 800,
          }}>
            <span className="gradient-text">Tenure your{" "}</span>
            <span className="strike-word" key={crossedWord} style={{ color: "#52525b" }}>{words[crossedWord]}</span>
            <span className="gradient-text">.</span>
          </h1>

          <h2 style={{
            fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 300, letterSpacing: "-0.02em",
            color: "#a1a1aa", marginBottom: 32,
          }}>
            Hire it now.
          </h2>

          {/* Pain-driven subhead */}
          <p style={{
            fontSize: 17, lineHeight: 1.7, color: "#71717a", maxWidth: 560, marginBottom: 48,
          }}>
            Your 10-step agent succeeds 60% of the time. Tool calls fail 3–15% in production. Every team rebuilds the same five reliability features from scratch. We built them once, correctly, so you never have to.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="hire-btn">Browse roles →</button>
            <button className="hire-btn hire-btn-outline">
              <span className="mono" style={{ fontSize: 13 }}>npx tenuring init</span>
            </button>
          </div>

          {/* Terminal */}
          <div style={{
            marginTop: 56, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "20px 28px", textAlign: "left", maxWidth: 520, width: "100%",
          }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3f3f46" }} />)}
            </div>
            <div className="mono" style={{ fontSize: 13, lineHeight: 2, color: "#a1a1aa" }}>
              <div><span style={{ color: "#22c55e" }}>$</span> npx tenuring connect openclaw</div>
              <div style={{ color: "#52525b" }}>✓ OpenClaw workspace detected</div>
              <div style={{ color: "#52525b" }}>✓ 50 skills classified — reads cached, writes idempotent-keyed</div>
              <div style={{ color: "#52525b" }}>✓ Stripe routed → saga compensation + exactly-once</div>
              <div style={{ color: "#52525b" }}>✓ Browserbase routed → child workflow + heartbeat</div>
              <div style={{ color: "#22c55e" }}>⟐ Agent tenured. Every tool call runs with the right guarantees.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* PAIN STATS */}
      <section
        id="pain"
        ref={ref("pain")}
        style={{
          padding: "100px 24px", maxWidth: 1000, margin: "0 auto",
          opacity: vis("pain") ? 1 : 0, transform: vis("pain") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, marginBottom: 80 }}>
          {painStats.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div className="stat-num" style={{ color: i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#fafafa" }}>{s.num}</div>
              <p style={{ color: "#71717a", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{s.label}</p>
            </div>
          ))}
        </div>

        <p className="mono section-label" style={{ marginBottom: 12 }}>WHAT'S ACTUALLY HAPPENING IN PRODUCTION</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          These aren't edge cases.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 40, maxWidth: 520 }}>
          They're fundamental reliability gaps that make agents unsuitable for production without significant custom work.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {horrorStories.map((s, i) => (
            <div key={i} className="horror-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{s.title}</span>
              </div>
              <p style={{ color: "#71717a", fontSize: 14, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40, padding: 20, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: 10, maxWidth: 600,
        }}>
          <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.7, fontStyle: "italic" }}>
            "The smarter the agent, the more likely it is to accidentally drain a user's wallet. Language models are probabilistic. Payment ledgers are deterministic. When you connect a stochastic agent to a deterministic bank, you get the Idempotency Paradox."
          </p>
        </div>
      </section>

      <div className="glow-line" />

      {/* THE FIX — BEFORE/AFTER */}
      <section
        id="fix"
        ref={ref("fix")}
        style={{
          padding: "100px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center",
          opacity: vis("fix") ? 1 : 0, transform: vis("fix") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>THE CORE PROBLEM</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
          A web search and a Stripe charge<br />
          <span style={{ color: "#52525b" }}>should not have the same retry policy.</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 540, margin: "0 auto 48px" }}>
          No agent framework distinguishes between reading data and sending a payment when deciding how to execute a tool call. We do.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, alignItems: "start" }}>
          {/* Before */}
          <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 12, padding: 24, textAlign: "left" }}>
            <p className="mono" style={{ fontSize: 11, color: "#ef4444", marginBottom: 16 }}>WITHOUT TENURING</p>
            <div className="mono" style={{ fontSize: 12, lineHeight: 2.2, color: "#71717a" }}>
              <div>web_search → <span style={{ color: "#52525b" }}>retry 3x</span></div>
              <div>file_write → <span style={{ color: "#52525b" }}>retry 3x</span></div>
              <div>stripe_charge → <span style={{ color: "#52525b" }}>retry 3x</span></div>
              <div>browser_session → <span style={{ color: "#52525b" }}>retry 3x</span></div>
              <div>send_email → <span style={{ color: "#52525b" }}>retry 3x</span></div>
              <div>terraform_apply → <span style={{ color: "#52525b" }}>retry 3x</span></div>
            </div>
            <p style={{ color: "#ef4444", fontSize: 12, marginTop: 16 }}>↑ identical treatment. identical failures.</p>
          </div>

          {/* Arrow */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#3f3f46", fontSize: 20 }}>→</div>

          {/* After */}
          <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 12, padding: 24, textAlign: "left" }}>
            <p className="mono" style={{ fontSize: 11, color: "#22c55e", marginBottom: 16 }}>WITH TENURING</p>
            <div className="mono" style={{ fontSize: 12, lineHeight: 2.2 }}>
              <div style={{ color: "#3b82f6" }}>web_search → <span>activity · 5x retry · cached</span></div>
              <div style={{ color: "#f59e0b" }}>file_write → <span>activity · idempotency key</span></div>
              <div style={{ color: "#ef4444" }}>stripe_charge → <span>saga · exactly-once · HITL</span></div>
              <div style={{ color: "#8b5cf6" }}>browser → <span>child workflow · heartbeat</span></div>
              <div style={{ color: "#f59e0b" }}>send_email → <span>activity · dedup guard</span></div>
              <div style={{ color: "#ef4444" }}>terraform → <span>saga · compensation chain</span></div>
            </div>
            <p style={{ color: "#22c55e", fontSize: 12, marginTop: 16 }}>↑ each tool gets exactly the guarantees it needs.</p>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ROLES MARKETPLACE */}
      <section
        id="roles"
        ref={ref("roles")}
        style={{
          padding: "100px 24px", maxWidth: 1100, margin: "0 auto",
          opacity: vis("roles") ? 1 : 0, transform: vis("roles") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>AGENT ROLES</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Pick a role. Set the shift. Deploy.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 520 }}>
          Each role ships pre-configured with the right skills, execution routing, and shift schedule. Every tool call routed to the correct durability primitive from day one.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {roles.map((role, i) => (
            <div
              key={role.slug}
              className="role-card"
              onClick={() => setSelectedRole(selectedRole === i ? null : i)}
              style={{
                background: selectedRole === i ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                borderRadius: 12, padding: 24,
                borderColor: selectedRole === i ? role.color + "44" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{role.title}</h3>
                <span className="mono" style={{ fontSize: 11, color: role.color, background: role.color + "15", padding: "3px 8px", borderRadius: 4 }}>
                  {role.shift}
                </span>
              </div>
              <p style={{ color: "#71717a", fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>{role.desc}</p>

              {/* Fail scenario */}
              <div style={{
                fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.06)",
                padding: "8px 12px", borderRadius: 6, marginBottom: 14, lineHeight: 1.5,
              }}>
                Without tenuring: {role.failScenario}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {role.skills.map((s) => (
                  <span key={s} className="mono" style={{ display: "inline-block", padding: "4px 10px", borderRadius: 4, fontSize: 12, background: "rgba(255,255,255,0.04)", color: "#a1a1aa" }}>
                    {s}
                  </span>
                ))}
              </div>

              {selectedRole === i && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="mono" style={{ fontSize: 12, color: "#52525b", marginBottom: 8 }}>tenur.ing/{role.slug}/hire</div>
                  <button className="hire-btn" style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "12px 24px" }}>
                    Hire this {role.title} →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="glow-line" />

      {/* ARCHITECTURE */}
      <section
        id="architecture"
        ref={ref("arch")}
        style={{
          padding: "100px 24px", maxWidth: 900, margin: "0 auto",
          opacity: vis("arch") ? 1 : 0, transform: vis("arch") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>HOW IT WORKS</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Three layers. One permanent employee.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 560 }}>
          The shift calendar makes it feel like an employee. The execution router makes permanence architecturally possible. Temporal makes it crash-proof.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {stackLayers.map((layer, i) => (
            <div key={layer.name} className="stack-layer" style={{
              background: i === 1 ? "rgba(34,197,94,0.04)" : "rgba(255,255,255," + (0.08 - i * 0.025) + ")",
              borderRadius: i === 0 ? "12px 12px 4px 4px" : i === 2 ? "4px 4px 12px 12px" : 4,
              padding: "32px 28px", border: i === 1 ? "1px solid rgba(34,197,94,0.12)" : "1px solid rgba(255,255,255,0.04)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.01em" }}>{layer.name}</h3>
                <p style={{ color: "#71717a", fontSize: 14 }}>{layer.desc}</p>
              </div>
              <div style={{
                fontSize: 11, color: i === 1 ? "#22c55e" : "#3f3f46", fontWeight: 500,
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>{layer.tag}</div>
            </div>
          ))}
        </div>

        {/* SER detail grid */}
        <div style={{ marginTop: 48, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 28 }}>
          <p className="mono" style={{ fontSize: 12, color: "#22c55e", marginBottom: 20 }}>
            SEMANTIC EXECUTION ROUTER — CLASSIFIES EVERY TOOL CALL AUTOMATICALLY
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {[
              { type: "Idempotent Read", ex: "Web Search, File Read, Grep", prim: "Activity · 5x retry · cached", col: "#3b82f6" },
              { type: "Side-Effect Mutation", ex: "File Write, Git Commit, Slack", prim: "Activity · idempotency key", col: "#f59e0b" },
              { type: "Stateful Session", ex: "Playwright, Browserbase", prim: "Child Workflow · heartbeat 30s", col: "#8b5cf6" },
              { type: "Critical Transaction", ex: "Stripe, Terraform, K8s", prim: "Saga · exactly-once · HITL gate", col: "#ef4444" },
              { type: "Long-Running", ex: "Subagent, Remotion Render", prim: "Child Workflow · continueAsNew", col: "#14b8a6" },
              { type: "Human-Interactive", ex: "Approval, Clarification", prim: "Signal · waitForEvent · no compute", col: "#ec4899" },
            ].map((item) => (
              <div key={item.type} style={{ padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 8, borderLeft: `3px solid ${item.col}` }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.type}</p>
                <p style={{ fontSize: 12, color: "#52525b", marginBottom: 8 }}>{item.ex}</p>
                <p className="mono" style={{ fontSize: 11, color: item.col }}>{item.prim}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* DURABILITY */}
      <section
        ref={ref("durable")}
        style={{
          padding: "100px 24px", maxWidth: 700, margin: "0 auto", textAlign: "center",
          opacity: vis("durable") ? 1 : 0, transform: vis("durable") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>PERMANENCE</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Your agent doesn't crash.<br />
          <span style={{ color: "#52525b" }}>It sleeps. It wakes. It remembers.</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, lineHeight: 1.7, maxWidth: 500, margin: "0 auto 48px" }}>
          Shift boundaries are natural checkpoints. State snapshots to storage. Event history resets. Memory persists through Mem0. Same agent, same workspace — for years.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, maxWidth: 600, margin: "0 auto" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
            const isWorkday = i < 5;
            return (
              <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: "100%", height: 40,
                  background: isWorkday ? "linear-gradient(180deg, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 100%)" : "rgba(255,255,255,0.02)",
                  borderRadius: i === 0 ? "6px 0 0 6px" : i === 6 ? "0 6px 6px 0" : 0,
                  borderRight: i < 6 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isWorkday && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease-in-out infinite", animationDelay: `${i * 0.3}s` }} />}
                </div>
                <span className="mono" style={{ fontSize: 10, color: isWorkday ? "#71717a" : "#3f3f46" }}>{day}</span>
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "#52525b", marginTop: 16 }}>
          ↑ continueAsNew at each shift boundary · event history stays clean forever
        </div>
      </section>

      <div className="glow-line" />

      {/* OPEN CORE */}
      <section
        ref={ref("oss")}
        style={{
          padding: "100px 24px", maxWidth: 800, margin: "0 auto",
          opacity: vis("oss") ? 1 : 0, transform: vis("oss") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>OPEN CORE</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 48 }}>
          The taxonomy is open.<br />
          <span style={{ color: "#52525b" }}>The router is ours.</span>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>◇</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring-core</span>
              <span className="mono" style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 6px", borderRadius: 3 }}>MIT</span>
            </div>
            {["Skill → primitive taxonomy", "Decision tree schema", "Framework adapters", "Temporal bridge", "Local dashboard"].map((item) => (
              <div key={item} style={{ fontSize: 13, color: "#a1a1aa", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{item}</div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>◆</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring cloud</span>
              <span className="mono" style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: 3 }}>MANAGED</span>
            </div>
            {["Runtime inference engine", "Auto continueAsNew", "Roster shift calendar", "HITL approval inbox", "Managed capabilities"].map((item) => (
              <div key={item} style={{ fontSize: 13, color: "#a1a1aa", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{item}</div>
            ))}
          </div>
        </div>

        {/* Capability plane teaser */}
        <div style={{
          marginTop: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "20px 28px",
        }}>
          <p className="mono" style={{ fontSize: 11, color: "#71717a", marginBottom: 12 }}>MANAGED CAPABILITIES — ONE TOGGLE, ONE BILL</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Inbox", "Phone", "WhatsApp", "Browser", "Compute", "Memory", "Voice", "Payments", "SaaS Tools", "Web Search", "People Search", "Social Listening"].map((cap) => (
              <span key={cap} className="mono" style={{
                fontSize: 11, padding: "5px 12px", borderRadius: 6,
                background: "rgba(255,255,255,0.04)", color: "#a1a1aa",
              }}>{cap}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* CTA */}
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Stop rebuilding retry logic.
        </h2>
        <p style={{ fontSize: 18, color: "#71717a", fontWeight: 300, marginBottom: 16, letterSpacing: "-0.01em" }}>
          Hire agents that show up, survive crashes, and never send duplicate payments.
        </p>
        <p className="mono" style={{ fontSize: 13, color: "#52525b", marginBottom: 48 }}>
          One config line. Every tool call gets exactly the reliability it needs.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="hire-btn" style={{ fontSize: 17, padding: "16px 40px" }}>Hire your first agent →</button>
          <button className="hire-btn hire-btn-outline" style={{ fontSize: 17, padding: "16px 40px" }}>Read the docs</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1100, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>tenur</span>
          <span style={{ fontSize: 16, fontWeight: 300, color: "#71717a" }}>.ing</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {["GitHub", "Docs", "Discord", "X"].map(l => <a key={l} className="nav-link" style={{ fontSize: 13 }}>{l}</a>)}
        </div>
      </footer>
    </div>
  );
}
