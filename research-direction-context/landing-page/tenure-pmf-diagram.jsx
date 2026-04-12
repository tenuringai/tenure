import { useState } from "react";

const phases = [
  {
    id: "taxonomy",
    label: "Open Taxonomy",
    detail: "50 skills with execution: metadata in TAXONOMY.md",
    metric: "50 skills classified",
    gate: "Day 1",
    color: "#22c55e",
    x: 400, y: 60,
  },
  {
    id: "scan",
    label: "Skill Scanner",
    detail: "tenure scan classifies + flags dangerous skills",
    metric: "15% malicious caught",
    gate: "Week 1",
    color: "#22c55e",
    x: 700, y: 160,
  },
  {
    id: "crash",
    label: "Crash Recovery",
    detail: "SIGKILL → resume from exact checkpoint",
    metric: "99% pass rate",
    gate: "Week 2",
    color: "#ef4444",
    x: 700, y: 320,
  },
  {
    id: "community",
    label: "Community PRs",
    detail: "Skill authors add execution: blocks upstream",
    metric: "50+ skills with metadata",
    gate: "Day 60",
    color: "#f59e0b",
    x: 400, y: 420,
  },
  {
    id: "standard",
    label: "De Facto Standard",
    detail: "tenure.* metadata adopted across SKILL.md ecosystem",
    metric: "Standard play validated",
    gate: "Day 60 PMF Gate",
    color: "#f59e0b",
    x: 100, y: 320,
  },
  {
    id: "cloud",
    label: "Hosted Platform",
    detail: "Roster + HITL + budget enforcement + dashboard",
    metric: "15% OSS → Cloud conversion",
    gate: "Month 3",
    color: "#3b82f6",
    x: 100, y: 160,
  },
];

const arrows = [
  { from: "taxonomy", to: "scan", label: "enables" },
  { from: "scan", to: "crash", label: "protects" },
  { from: "crash", to: "community", label: "proves value" },
  { from: "community", to: "standard", label: "compounds" },
  { from: "standard", to: "cloud", label: "converts" },
  { from: "cloud", to: "taxonomy", label: "funds growth" },
];

const flywheel = [
  { label: "More skills classified", icon: "📋" },
  { label: "More developers trust it", icon: "🛡️" },
  { label: "More PRs with execution: blocks", icon: "🔀" },
  { label: "Taxonomy becomes standard", icon: "📐" },
  { label: "Cloud converts self-hosters", icon: "☁️" },
  { label: "Revenue funds more classification", icon: "💰" },
];

const pmfGates = [
  { gate: "Gate 1", metric: "Crash recovery ≥ 99%", deadline: "Day 30", status: "foundation" },
  { gate: "Gate 2", metric: "50+ skills with execution: blocks", deadline: "Day 60", status: "standard" },
  { gate: "Gate 3", metric: "Thinking-time billing reduces surprise costs ≥ 60%", deadline: "Day 90", status: "revenue" },
];

export default function PMFDiagram() {
  const [hoveredPhase, setHoveredPhase] = useState(null);
  const [activeView, setActiveView] = useState("flywheel");

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "#09090b",
      color: "#fafafa",
      minHeight: "100vh",
      padding: "40px 24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .tab { padding: 10px 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: transparent; color: #a1a1aa; cursor: pointer; font-family: inherit; font-size: 13px; transition: all 0.2s; }
        .tab:hover { border-color: rgba(255,255,255,0.2); color: #fafafa; }
        .tab-active { background: rgba(255,255,255,0.08); color: #fafafa; border-color: rgba(255,255,255,0.2); }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p className="mono" style={{ fontSize: 11, letterSpacing: "0.15em", color: "#52525b", marginBottom: 8 }}>
          TENURE v3.0
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Product-Market Fit Diagram
        </h1>
        <p style={{ color: "#71717a", fontSize: 15, marginBottom: 32 }}>
          Durable Skill Development Platform for OpenClaw
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
          {[
            { id: "flywheel", label: "PMF Flywheel" },
            { id: "gates", label: "PMF Gates" },
            { id: "layers", label: "Value Stack" },
            { id: "timeline", label: "Ship Timeline" },
          ].map(t => (
            <button
              key={t.id}
              className={`tab ${activeView === t.id ? "tab-active" : ""}`}
              onClick={() => setActiveView(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* FLYWHEEL VIEW */}
        {activeView === "flywheel" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, letterSpacing: "-0.01em" }}>
              The Compounding Flywheel
            </h2>

            <div style={{ position: "relative", width: "100%", maxWidth: 600, margin: "0 auto", aspectRatio: "1" }}>
              {/* Center label */}
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                textAlign: "center", zIndex: 10,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>PMF</div>
                <div style={{ fontSize: 11, color: "#52525b" }}>FLYWHEEL</div>
              </div>

              {/* Flywheel nodes in a circle */}
              {flywheel.map((item, i) => {
                const angle = (i / flywheel.length) * 2 * Math.PI - Math.PI / 2;
                const radius = 42;
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                const isHovered = hoveredPhase === i;

                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredPhase(i)}
                    onMouseLeave={() => setHoveredPhase(null)}
                    style={{
                      position: "absolute",
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                      background: isHovered ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isHovered ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                      width: 160,
                      textAlign: "center",
                      cursor: "default",
                      transition: "all 0.2s",
                      zIndex: isHovered ? 20 : 1,
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{item.label}</div>
                  </div>
                );
              })}

              {/* Circular arrow hints */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
                {/* Arrow arcs */}
                {flywheel.map((_, i) => {
                  const a1 = (i / flywheel.length) * 360 - 90 + 15;
                  const a2 = ((i + 1) / flywheel.length) * 360 - 90 - 15;
                  const r = 30;
                  const x1 = 50 + r * Math.cos(a1 * Math.PI / 180);
                  const y1 = 50 + r * Math.sin(a1 * Math.PI / 180);
                  const x2 = 50 + r * Math.cos(a2 * Math.PI / 180);
                  const y2 = 50 + r * Math.sin(a2 * Math.PI / 180);
                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="rgba(255,255,255,0.08)" strokeWidth="0.2"
                      markerEnd="url(#arrowhead)" />
                  );
                })}
                <defs>
                  <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.15)" />
                  </marker>
                </defs>
              </svg>
            </div>

            <div style={{
              marginTop: 40, padding: 20, background: "rgba(34,197,94,0.05)",
              border: "1px solid rgba(34,197,94,0.12)", borderRadius: 10, textAlign: "center",
            }}>
              <p style={{ fontSize: 14, color: "#22c55e" }}>
                Each revolution makes the taxonomy more complete, the scanner more accurate, the marketplace more valuable, and the router more reliable. Features don't compound. Standards do.
              </p>
            </div>
          </div>
        )}

        {/* GATES VIEW */}
        {activeView === "gates" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>
              PMF Gates
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 32 }}>
              If any gate is below threshold at its deadline, stop and diagnose before adding features.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pmfGates.map((g, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "stretch", gap: 0,
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden",
                }}>
                  <div style={{
                    width: 100, background: i === 0 ? "rgba(239,68,68,0.1)" : i === 1 ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: 16, borderRight: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#3b82f6" }}>{g.gate}</div>
                    <div className="mono" style={{ fontSize: 11, color: "#52525b", marginTop: 4 }}>{g.deadline}</div>
                  </div>
                  <div style={{ flex: 1, padding: "16px 20px", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{g.metric}</div>
                    <div style={{ fontSize: 12, color: "#52525b" }}>
                      {i === 0 && "The foundational promise. If crash recovery doesn't work, nothing else matters."}
                      {i === 1 && "Community adoption of the standard. If authors don't use execution: blocks, the standard play fails."}
                      {i === 2 && "Revenue validation. Operators must report predictable, lower costs vs raw per-token billing."}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 32, padding: 20, background: "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10,
            }}>
              <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 500, marginBottom: 4 }}>Single Eval Focus</p>
              <p style={{ fontSize: 13, color: "#71717a" }}>
                Gate 1 (crash recovery) is the only metric that matters at launch. Gates 2 and 3 are meaningless if the agent can't survive a SIGKILL.
              </p>
            </div>
          </div>
        )}

        {/* VALUE STACK VIEW */}
        {activeView === "layers" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>
              Value Stack — What You Give vs. What You Charge For
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 32 }}>
              Open layers drive adoption. Closed layers drive revenue. The standard is the bridge.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { layer: "Marketplace", desc: "Skill monetization, template publishing, builder payouts", license: "CLOSED", color: "#3b82f6", revenue: "20% commission" },
                { layer: "Cloud Platform", desc: "Roster, HITL inbox, budget enforcement, managed observability", license: "CLOSED", color: "#3b82f6", revenue: "$15–199/mo" },
                { layer: "Runtime Inference", desc: "AI classification for unknown skills at invocation time", license: "CLOSED", color: "#3b82f6", revenue: "Cloud-only feature" },
                { layer: "Thinking-Time Billing", desc: "Per-shift metering, model routing cost attribution", license: "CLOSED", color: "#3b82f6", revenue: "Billing infrastructure" },
                { layer: "THE STANDARD LINE", desc: "", license: "", color: "#f59e0b", revenue: "" },
                { layer: "Certifications", desc: "crash-recovery, no-duplicate, budget-compliance, hitl-compliance, taxonomy-coverage, perf-baseline", license: "MIT", color: "#22c55e", revenue: "Free" },
                { layer: "Skill Scanner", desc: "Execution type classification + security audit", license: "MIT", color: "#22c55e", revenue: "Free" },
                { layer: "SER Router (static)", desc: "TAXONOMY.md lookup → Temporal primitive selection", license: "MIT", color: "#22c55e", revenue: "Free" },
                { layer: "OpenClaw Adapter", desc: "tenure connect openclaw → one line config change", license: "MIT", color: "#22c55e", revenue: "Free" },
                { layer: "TAXONOMY.md", desc: "50 skills with execution type, primitive, retry, compensation, HITL, thinking cost", license: "MIT", color: "#22c55e", revenue: "Free — THE STANDARD" },
              ].map((l, i) => {
                if (l.layer === "THE STANDARD LINE") {
                  return (
                    <div key={i} style={{
                      padding: "8px 20px", background: "rgba(245,158,11,0.1)",
                      borderRadius: 4, textAlign: "center",
                      border: "1px dashed rgba(245,158,11,0.3)",
                    }}>
                      <span className="mono" style={{ fontSize: 11, color: "#f59e0b", letterSpacing: "0.1em" }}>
                        ▲ CLOSED — REVENUE &nbsp;&nbsp;│&nbsp;&nbsp; OPEN — ADOPTION ▼
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", padding: "14px 20px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: i === 0 ? "12px 12px 4px 4px" : i === 9 ? "4px 4px 12px 12px" : 4,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{l.layer}</div>
                      <div style={{ fontSize: 12, color: "#52525b" }}>{l.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="mono" style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: l.license === "MIT" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                        color: l.license === "MIT" ? "#22c55e" : "#3b82f6",
                      }}>
                        {l.license}
                      </span>
                      <span style={{ fontSize: 12, color: "#71717a", minWidth: 120, textAlign: "right" }}>{l.revenue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {activeView === "timeline" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>
              Ship Timeline
            </h2>
            <p style={{ color: "#71717a", fontSize: 14, marginBottom: 32 }}>
              Bottom up. Narrow first. Broaden from community trust.
            </p>

            <div style={{ position: "relative", paddingLeft: 40 }}>
              {/* Vertical line */}
              <div style={{
                position: "absolute", left: 15, top: 0, bottom: 0, width: 2,
                background: "linear-gradient(180deg, #22c55e, #f59e0b, #3b82f6, #8b5cf6)",
              }} />

              {[
                { phase: "Phase 1", time: "Weeks 1–4", title: "OSS Wedge", items: ["Ship tenure CLI + OpenClaw adapter", "TAXONOMY.md with 50 skills", "Crash recovery certification", "tenure scan + tenure test + tenure certify", "Comment on Issue #10164"], color: "#22c55e" },
                { phase: "Phase 2", time: "Weeks 5–8", title: "Community Standard", items: ["10 upstream PRs with tenure.* metadata", "Badge wall on README", "awesome-openclaw-skills CI integration", "tenure eval (performance reviews)"], color: "#f59e0b" },
                { phase: "Phase 3", time: "Month 3–4", title: "Hosted Platform", items: ["tenur.ing cloud launch", "Roster shift calendar", "Thinking-time billing", "HITL approval inbox", "Budget enforcement + alerts"], color: "#3b82f6" },
                { phase: "Phase 4", time: "Month 5–6", title: "Marketplace", items: ["pricing: block activation", "Skill marketplace on tenur.ing", "Agent template publishing", "Builder payouts (80/20 split)"], color: "#8b5cf6" },
                { phase: "Phase 5", time: "Month 6+", title: "Capabilities", items: ["Managed Inbox, Browser, Memory, Compute, Voice", "SER runtime inference for unknown skills", "Automatic continueAsNew"], color: "#ec4899" },
              ].map((p, i) => (
                <div key={i} style={{ marginBottom: 32, position: "relative" }}>
                  {/* Dot */}
                  <div style={{
                    position: "absolute", left: -33, top: 4, width: 12, height: 12,
                    borderRadius: "50%", background: p.color, border: "2px solid #09090b",
                  }} />

                  <div style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12, padding: "18px 20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span className="mono" style={{ fontSize: 11, color: p.color, fontWeight: 500 }}>{p.phase}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</span>
                      <span className="mono" style={{ fontSize: 11, color: "#3f3f46", marginLeft: "auto" }}>{p.time}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {p.items.map((item, j) => (
                        <span key={j} style={{
                          fontSize: 12, color: "#a1a1aa", background: "rgba(255,255,255,0.04)",
                          padding: "4px 10px", borderRadius: 6,
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
