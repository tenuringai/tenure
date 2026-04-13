import { useState, useEffect, useRef } from "react";

const roles = [
  { slug: "sdr", title: "SDR", desc: "Prospect, qualify, and book meetings autonomously", skills: ["Exa Search", "AgentMail", "Sixtyfour", "Mem0"], shift: "Mon–Fri 8AM–6PM", color: "#22c55e" },
  { slug: "devops", title: "DevOps Engineer", desc: "Monitor, deploy, and remediate infrastructure 24/7", skills: ["Kubernetes", "Terraform", "PagerDuty", "Sentry"], shift: "24/7 On-Call", color: "#3b82f6" },
  { slug: "content", title: "Content Producer", desc: "Research, write, render, and publish at scale", skills: ["Firecrawl", "Remotion", "ElevenLabs", "YouTube API"], shift: "Mon–Fri 6AM–2PM", color: "#f59e0b" },
  { slug: "researcher", title: "Research Analyst", desc: "Deep-dive markets, competitors, and trends", skills: ["Exa Search", "Browserbase", "Mem0", "Notion"], shift: "Mon–Fri 9AM–5PM", color: "#8b5cf6" },
  { slug: "support", title: "Support Agent", desc: "Triage tickets, resolve issues, escalate edge cases", skills: ["AgentMail", "Slack", "Composio", "Mem0"], shift: "Mon–Sun 6AM–10PM", color: "#ec4899" },
  { slug: "bookkeeper", title: "Bookkeeper", desc: "Reconcile transactions, categorize expenses, flag anomalies", skills: ["Stripe", "Composio", "Google Sheets", "AgentMail"], shift: "Mon–Fri 7AM–3PM", color: "#14b8a6" },
];

const stackLayers = [
  { name: "Shift Calendar", desc: "When your agent works", position: "top", bg: "rgba(255,255,255,0.08)" },
  { name: "Semantic Execution Router", desc: "How each tool call runs durably", position: "mid", bg: "rgba(255,255,255,0.05)" },
  { name: "Temporal Primitives", desc: "Crash-proof execution substrate", position: "bot", bg: "rgba(255,255,255,0.03)" },
];

const words = ["bot", "script", "cron job", "workflow"];

export default function TenuringLanding() {
  const [crossedWord, setCrossedWord] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef({});

  useEffect(() => {
    const interval = setInterval(() => {
      setCrossedWord((p) => (p + 1) % words.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, entry.target.id]));
          }
        });
      },
      { threshold: 0.15 }
    );
    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, []);

  const registerRef = (id) => (el) => {
    sectionRefs.current[id] = el;
  };

  const isVisible = (id) => visibleSections.has(id);

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Satoshi', system-ui, sans-serif",
      background: "#09090b",
      color: "#fafafa",
      minHeight: "100vh",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @keyframes strikeIn {
          0% { width: 0; }
          100% { width: 105%; }
        }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        
        @keyframes slideRight {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .strike-word {
          position: relative;
          display: inline-block;
        }
        
        .strike-word::after {
          content: '';
          position: absolute;
          left: -2%;
          top: 52%;
          height: 4px;
          background: #ef4444;
          animation: strikeIn 0.4s ease-out forwards;
          border-radius: 2px;
        }
        
        .visible-section {
          animation: fadeUp 0.7s ease-out forwards;
        }
        
        .role-card {
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid rgba(255,255,255,0.06);
        }
        
        .role-card:hover {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-2px);
        }
        
        .nav-link {
          color: #a1a1aa;
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
          letter-spacing: 0.02em;
        }
        
        .nav-link:hover { color: #fafafa; }
        
        .hire-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: #fafafa;
          color: #09090b;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          letter-spacing: -0.01em;
        }
        
        .hire-btn:hover {
          background: #e4e4e7;
          transform: translateY(-1px);
        }
        
        .hire-btn-outline {
          background: transparent;
          color: #fafafa;
          border: 1px solid rgba(255,255,255,0.2);
        }
        
        .hire-btn-outline:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.3);
        }
        
        .mono {
          font-family: 'JetBrains Mono', monospace;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .glow-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }
        
        .stack-layer {
          transition: all 0.3s ease;
          cursor: default;
        }
        
        .stack-layer:hover {
          background: rgba(255,255,255,0.08) !important;
        }

        .skill-tag {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          letter-spacing: 0.03em;
        }

        .section-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #52525b;
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: scrollY > 50 ? "rgba(9,9,11,0.9)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px)" : "none",
        borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>tenur</span>
          <span style={{ fontSize: 20, fontWeight: 300, color: "#71717a" }}>.ing</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#roles" className="nav-link">Roles</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <a className="nav-link" style={{ color: "#fafafa", fontWeight: 500 }}>Docs</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "120px 24px 80px",
        position: "relative",
      }}>
        {/* Subtle grid background */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          opacity: 0.8,
        }} />
        
        {/* Radial glow */}
        <div style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(250,250,250,0.03) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="mono section-label" style={{ marginBottom: 24, color: "#52525b" }}>
            THE DURABLE EXECUTION CLOUD FOR AI AGENTS
          </p>
          
          <h1 style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            marginBottom: 24,
            maxWidth: 800,
          }}>
            <span className="gradient-text">Tenure your{" "}</span>
            <span className="strike-word" key={crossedWord} style={{ color: "#52525b" }}>
              {words[crossedWord]}
            </span>
            <span className="gradient-text">.</span>
          </h1>
          
          <h2 style={{
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 300,
            letterSpacing: "-0.02em",
            color: "#a1a1aa",
            marginBottom: 48,
          }}>
            Hire it now.
          </h2>

          <p style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: "#71717a",
            maxWidth: 520,
            marginBottom: 48,
          }}>
            One config line turns any OpenClaw agent into a permanent, crash-proof employee with a shift schedule, real-world capabilities, and years of durable memory.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="hire-btn">
              Browse roles →
            </button>
            <button className="hire-btn hire-btn-outline">
              <span className="mono" style={{ fontSize: 13 }}>npx tenuring init</span>
            </button>
          </div>

          {/* Terminal preview */}
          <div style={{
            marginTop: 64,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: "20px 28px",
            textAlign: "left",
            maxWidth: 520,
            width: "100%",
          }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3f3f46" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3f3f46" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3f3f46" }} />
            </div>
            <div className="mono" style={{ fontSize: 13, lineHeight: 2, color: "#a1a1aa" }}>
              <div><span style={{ color: "#22c55e" }}>$</span> npx tenuring connect openclaw</div>
              <div style={{ color: "#52525b" }}>✓ OpenClaw workspace detected</div>
              <div style={{ color: "#52525b" }}>✓ Semantic router initialized — 50 skills mapped</div>
              <div style={{ color: "#52525b" }}>✓ Shift schedule: Mon–Fri 9AM–5PM EST</div>
              <div style={{ color: "#22c55e" }}>⟐ Agent tenured. Workflow running.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ROLES MARKETPLACE */}
      <section
        id="roles"
        ref={registerRef("roles")}
        style={{
          padding: "120px 24px",
          maxWidth: 1100,
          margin: "0 auto",
          opacity: isVisible("roles") ? 1 : 0,
          transform: isVisible("roles") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>AGENT ROLES</p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 12,
        }}>
          Pick a role. Set the shift. Deploy.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 500 }}>
          Each role comes pre-configured with the right skills, execution routing, and shift schedule. Customize everything after hire.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}>
          {roles.map((role, i) => (
            <div
              key={role.slug}
              className="role-card"
              onClick={() => setSelectedRole(selectedRole === i ? null : i)}
              style={{
                background: selectedRole === i ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                borderRadius: 12,
                padding: 24,
                borderColor: selectedRole === i ? role.color + "44" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{role.title}</h3>
                <span className="mono" style={{
                  fontSize: 11,
                  color: role.color,
                  background: role.color + "15",
                  padding: "3px 8px",
                  borderRadius: 4,
                }}>
                  {role.shift}
                </span>
              </div>
              <p style={{ color: "#71717a", fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{role.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {role.skills.map((s) => (
                  <span key={s} className="skill-tag mono" style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "#a1a1aa",
                  }}>
                    {s}
                  </span>
                ))}
              </div>
              
              {selectedRole === i && (
                <div style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  animation: "fadeIn 0.3s ease-out",
                }}>
                  <div className="mono" style={{ fontSize: 12, color: "#52525b", marginBottom: 8 }}>
                    tenur.ing/{role.slug}/hire
                  </div>
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

      {/* THREE-LAYER ARCHITECTURE */}
      <section
        id="architecture"
        ref={registerRef("arch")}
        style={{
          padding: "120px 24px",
          maxWidth: 900,
          margin: "0 auto",
          opacity: isVisible("arch") ? 1 : 0,
          transform: isVisible("arch") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>ARCHITECTURE</p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 12,
        }}>
          Three layers. One permanent employee.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 540 }}>
          Every tool call is classified by what it actually does — then routed to exactly the right execution primitive. No more, no less.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {stackLayers.map((layer, i) => (
            <div
              key={layer.name}
              className="stack-layer"
              style={{
                background: layer.bg,
                borderRadius: i === 0 ? "12px 12px 4px 4px" : i === 2 ? "4px 4px 12px 12px" : 4,
                padding: "32px 28px",
                border: "1px solid rgba(255,255,255,0.04)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.01em" }}>{layer.name}</h3>
                <p style={{ color: "#71717a", fontSize: 14 }}>{layer.desc}</p>
              </div>
              <div style={{
                fontSize: 11,
                color: i === 1 ? "#22c55e" : "#3f3f46",
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                {i === 0 ? "WHAT YOU SEE" : i === 1 ? "THE MOAT" : "THE SUBSTRATE"}
              </div>
            </div>
          ))}
        </div>

        {/* SER breakdown */}
        <div style={{
          marginTop: 48,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: 28,
        }}>
          <p className="mono" style={{ fontSize: 12, color: "#22c55e", marginBottom: 20 }}>
            SEMANTIC EXECUTION ROUTER — WHAT MAKES PERMANENCE POSSIBLE
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {[
              { type: "Idempotent Read", ex: "Web Search, File Read", prim: "Activity · 5x retry", col: "#3b82f6" },
              { type: "Side-Effect Mutation", ex: "Git Commit, Slack Send", prim: "Activity · idempotency key", col: "#f59e0b" },
              { type: "Stateful Session", ex: "Playwright, Browserbase", prim: "Child Workflow · heartbeat", col: "#8b5cf6" },
              { type: "Critical Transaction", ex: "Stripe, Terraform", prim: "Saga · exactly-once", col: "#ef4444" },
              { type: "Long-Running", ex: "Subagent, CI Pipeline", prim: "Child Workflow · continueAsNew", col: "#14b8a6" },
              { type: "Human-Interactive", ex: "Approval, Clarification", prim: "Signal · waitForEvent", col: "#ec4899" },
            ].map((item) => (
              <div key={item.type} style={{
                padding: 16,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 8,
                borderLeft: `3px solid ${item.col}`,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.type}</p>
                <p style={{ fontSize: 12, color: "#52525b", marginBottom: 8 }}>{item.ex}</p>
                <p className="mono" style={{ fontSize: 11, color: item.col }}>{item.prim}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* DURABILITY SECTION */}
      <section
        ref={registerRef("durable")}
        style={{
          padding: "120px 24px",
          maxWidth: 700,
          margin: "0 auto",
          textAlign: "center",
          opacity: isVisible("durable") ? 1 : 0,
          transform: isVisible("durable") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>DURABILITY</p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 24,
        }}>
          Your agent doesn't crash.<br />
          <span style={{ color: "#52525b" }}>It sleeps. It wakes. It remembers.</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, lineHeight: 1.7, maxWidth: 500, margin: "0 auto 48px" }}>
          Shift boundaries are natural checkpoints. State snapshots to storage. Event history resets. Memory persists. Same agent, same ID, same workspace — for years.
        </p>

        {/* Timeline visual */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          maxWidth: 600,
          margin: "0 auto",
        }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
            const isWorkday = i < 5;
            return (
              <div key={day} style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}>
                <div style={{
                  width: "100%",
                  height: 40,
                  background: isWorkday
                    ? "linear-gradient(180deg, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 100%)"
                    : "rgba(255,255,255,0.02)",
                  borderRadius: i === 0 ? "6px 0 0 6px" : i === 6 ? "0 6px 6px 0" : 0,
                  borderRight: i < 6 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {isWorkday && (
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22c55e",
                      animation: "pulse 2s ease-in-out infinite",
                      animationDelay: `${i * 0.3}s`,
                    }} />
                  )}
                </div>
                <span className="mono" style={{ fontSize: 10, color: isWorkday ? "#71717a" : "#3f3f46" }}>
                  {day}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "#52525b", marginTop: 16 }}>
          ↑ continueAsNew at each shift boundary · event history stays clean forever
        </div>
      </section>

      <div className="glow-line" />

      {/* OPEN SOURCE */}
      <section
        ref={registerRef("oss")}
        style={{
          padding: "120px 24px",
          maxWidth: 800,
          margin: "0 auto",
          opacity: isVisible("oss") ? 1 : 0,
          transform: isVisible("oss") ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>OPEN CORE</p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 48,
        }}>
          The taxonomy is open.<br />
          <span style={{ color: "#52525b" }}>The router is ours.</span>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>◇</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring-core</span>
              <span className="mono" style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 6px", borderRadius: 3 }}>MIT</span>
            </div>
            {["Skill → primitive taxonomy", "Decision tree schema", "Framework adapters", "Temporal bridge", "Local dashboard"].map((item) => (
              <div key={item} style={{ fontSize: 13, color: "#a1a1aa", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {item}
              </div>
            ))}
          </div>

          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>◆</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring cloud</span>
              <span className="mono" style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: 3 }}>MANAGED</span>
            </div>
            {["Runtime inference engine", "Auto continueAsNew", "Roster shift calendar", "HITL approval inbox", "Capability plane"].map((item) => (
              <div key={item} style={{ fontSize: 13, color: "#a1a1aa", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* CTA */}
      <section style={{
        padding: "120px 24px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontSize: "clamp(32px, 5vw, 56px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 16,
        }}>
          Stop babysitting scripts.
        </h2>
        <p style={{
          fontSize: 20,
          color: "#71717a",
          fontWeight: 300,
          marginBottom: 48,
          letterSpacing: "-0.01em",
        }}>
          Hire agents that show up, survive crashes, and remember everything.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="hire-btn" style={{ fontSize: 17, padding: "16px 40px" }}>
            Hire your first agent →
          </button>
          <button className="hire-btn hire-btn-outline" style={{ fontSize: 17, padding: "16px 40px" }}>
            Read the docs
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "40px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 1100,
        margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em" }}>tenur</span>
          <span style={{ fontSize: 16, fontWeight: 300, color: "#71717a" }}>.ing</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <a className="nav-link" style={{ fontSize: 13 }}>GitHub</a>
          <a className="nav-link" style={{ fontSize: 13 }}>Docs</a>
          <a className="nav-link" style={{ fontSize: 13 }}>Discord</a>
          <a className="nav-link" style={{ fontSize: 13 }}>X</a>
        </div>
      </footer>
    </div>
  );
}
