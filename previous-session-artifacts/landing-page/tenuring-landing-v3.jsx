import { useState, useEffect, useRef } from "react";

const words = ["bot", "script", "cron job", "workflow"];

const redditPains = [
  {
    quote: "Agent got stuck in a loop and fired off 50,000 API requests before anyone noticed. Production was down. The bill was ugly.",
    detail: "No circuit breaker. No loop detection. Every framework lets this happen.",
    color: "#ef4444",
  },
  {
    quote: "Background agent silently skipped a tool call. No alert, no retry. The system looked green. Downstream data was wrong.",
    detail: "Silence isn't neutral in production. It's dangerous.",
    color: "#f59e0b",
  },
  {
    quote: "The smarter the agent, the more likely it is to accidentally drain a user's wallet.",
    detail: "Language models are probabilistic. Payment ledgers are deterministic. Connect them without guardrails and you get the Idempotency Paradox.",
    color: "#8b5cf6",
  },
];

const communityStats = [
  { num: "3–15%", label: "tool call failure rate in production", note: "measured across real deployments" },
  { num: "60%", label: "end-to-end success rate", note: "for a 10-step agent at 95% per-step accuracy" },
  { num: "89%", label: "of production LangChain apps", note: "ignore the official patterns entirely" },
];

const roles = [
  { slug: "sdr", title: "SDR", desc: "Prospects, qualifies leads, and books meetings while you sleep", shift: "Mon–Fri 8AM–6PM", color: "#22c55e", without: "Sends the same cold email twice to your hottest lead", with: "Every outbound gets a dedup guard. Replies route back as durable signals." },
  { slug: "devops", title: "DevOps Engineer", desc: "Monitors, deploys, and remediates infrastructure around the clock", shift: "24/7 On-Call", color: "#3b82f6", without: "Applies Terraform twice after a timeout, spinning up duplicate infra", with: "Infrastructure mutations run exactly-once with full rollback compensation." },
  { slug: "content", title: "Content Producer", desc: "Researches, writes, renders video, and publishes at scale", shift: "Mon–Fri 6AM–2PM", color: "#f59e0b", without: "3-hour render crashes at hour two. Entire job restarts from zero.", with: "Renders checkpoint every step. Crash at hour two resumes at hour two." },
  { slug: "support", title: "Support Agent", desc: "Triages tickets, resolves issues, and escalates edge cases", shift: "Mon–Sun 6AM–10PM", color: "#ec4899", without: "Silently drops a critical ticket. No alert. System looks green.", with: "Every ticket action is a durable step. Dropped calls surface immediately." },
  { slug: "researcher", title: "Research Analyst", desc: "Deep-dives markets, competitors, and emerging trends", shift: "Mon–Fri 9AM–5PM", color: "#8b5cf6", without: "Browser session dies mid-crawl. Three hours of research context gone.", with: "Browser sessions heartbeat every 30s. Crash restores from last page." },
  { slug: "bookkeeper", title: "Bookkeeper", desc: "Reconciles transactions and flags anomalies automatically", shift: "Mon–Fri 7AM–3PM", color: "#14b8a6", without: "Processes the same Stripe charge twice. You find out from the customer.", with: "Financial operations run as sagas with exactly-once guarantees and HITL gates." },
];

const fiveThings = [
  { thing: "Circuit breakers", desc: "3 identical calls → force reset", icon: "⊘" },
  { thing: "Idempotency keys", desc: "Never duplicate a write", icon: "◈" },
  { thing: "Read/write routing", desc: "Different retry for search vs. payment", icon: "⇌" },
  { thing: "Error classification", desc: "Transient vs. permanent vs. rate-limit", icon: "◇" },
  { thing: "Human-in-the-loop", desc: "Pause for approval on risky actions", icon: "⏸" },
];

export default function TenuringLandingV3() {
  const [crossedWord, setCrossedWord] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [vis, setVis] = useState(new Set());
  const refs = useRef({});

  useEffect(() => {
    const i = setInterval(() => setCrossedWord((p) => (p + 1) % words.length), 2200);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setVis((p) => new Set([...p, e.target.id])); }),
      { threshold: 0.1 }
    );
    Object.values(refs.current).forEach((r) => { if (r) obs.observe(r); });
    return () => obs.disconnect();
  }, []);

  const r = (id) => (el) => { refs.current[id] = el; };
  const v = (id) => vis.has(id);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#09090b", color: "#fafafa", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=JetBrains+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes strikeIn { 0% { width: 0; } 100% { width: 105%; } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .strike-word { position: relative; display: inline-block; }
        .strike-word::after { content: ''; position: absolute; left: -2%; top: 52%; height: 4px; background: #ef4444; animation: strikeIn 0.4s ease-out forwards; border-radius: 2px; }
        .nav-link { color: #a1a1aa; text-decoration: none; font-size: 14px; transition: color 0.2s; }
        .nav-link:hover { color: #fafafa; }
        .hire-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: #fafafa; color: #09090b; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .hire-btn:hover { background: #d4d4d8; transform: translateY(-1px); }
        .hire-btn-outline { background: transparent; color: #fafafa; border: 1px solid rgba(255,255,255,0.2); }
        .hire-btn-outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.3); }
        .hire-btn-sm { padding: 10px 20px; font-size: 14px; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Instrument Serif', serif; }
        .glow-line { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); }
        .section-label { font-size: 11px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #52525b; }
        .role-card { cursor: pointer; transition: all 0.25s ease; border: 1px solid rgba(255,255,255,0.06); }
        .role-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
        .quote-card { border-left: 3px solid; padding: 20px 24px; background: rgba(255,255,255,0.02); border-radius: 0 10px 10px 0; }
        .gradient-text { background: linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
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
          <a href="#proof" className="nav-link">Why</a>
          <a href="#roles" className="nav-link">Roles</a>
          <a href="#how" className="nav-link">How It Works</a>
          <a className="nav-link" style={{ color: "#fafafa", fontWeight: 500 }}>Docs</a>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════ */}
      {/* HERO — OUTCOME FIRST, NO ARCHITECTURE            */}
      {/* ═══════════════════════════════════════════════ */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", textAlign: "center", padding: "140px 24px 80px", position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }} />
        <div style={{
          position: "absolute", top: "35%", left: "50%", transform: "translate(-50%, -50%)",
          width: 700, height: 700, background: "radial-gradient(circle, rgba(250,250,250,0.025) 0%, transparent 65%)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
          {/* Eyebrow — community proof, not product category */}
          <p className="mono" style={{ fontSize: 12, color: "#52525b", marginBottom: 28, letterSpacing: "0.08em" }}>
            EVERY PRODUCTION TEAM REBUILDS THE SAME 5 RELIABILITY FEATURES. WE BUILT THEM ONCE.
          </p>

          <h1 style={{
            fontSize: "clamp(44px, 7vw, 82px)", fontWeight: 700, lineHeight: 1.05,
            letterSpacing: "-0.04em", marginBottom: 20,
          }}>
            <span className="gradient-text">Stop tenuring{" "}</span>
            <span className="strike-word" key={crossedWord} style={{ color: "#52525b" }}>{words[crossedWord]}</span>
            <span className="gradient-text">s.</span>
          </h1>

          <h2 style={{
            fontSize: "clamp(24px, 3.5vw, 42px)", fontWeight: 300,
            letterSpacing: "-0.02em", color: "#a1a1aa", marginBottom: 20,
          }}>
            <span className="serif" style={{ fontStyle: "italic", color: "#fafafa" }}>Hire</span> agents that never crash, never duplicate, never silently fail.
          </h2>

          <p style={{ fontSize: 17, lineHeight: 1.75, color: "#71717a", marginBottom: 48, maxWidth: 540, margin: "0 auto 48px" }}>
            Tool calls fail 3–15% of the time in production. A 10-step agent at 95% per-step accuracy succeeds only 60% end-to-end. Your agent doesn't need more tools. It needs the right execution guarantees per tool.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="hire-btn">Hire your first agent →</button>
            <button className="hire-btn hire-btn-outline">
              <span className="mono" style={{ fontSize: 13 }}>npx tenureagent init</span>
            </button>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ═══════════════════════════════════════════════ */}
      {/* REDDIT PAIN — THE COMMUNITY ALREADY KNOWS       */}
      {/* ═══════════════════════════════════════════════ */}
      <section
        id="proof"
        ref={r("proof")}
        style={{
          padding: "100px 24px", maxWidth: 900, margin: "0 auto",
          opacity: v("proof") ? 1 : 0, transform: v("proof") ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>FROM THE COMMUNITY</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          These aren't edge cases.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 520 }}>
          They're fundamental reliability gaps that make agents unsuitable for production without significant custom work.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {redditPains.map((p, i) => (
            <div key={i} className="quote-card" style={{ borderLeftColor: p.color }}>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: "#e4e4e7", fontStyle: "italic", marginBottom: 10 }}>
                "{p.quote}"
              </p>
              <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.5 }}>{p.detail}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 64 }}>
          {communityStats.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "24px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", color: i === 0 ? "#ef4444" : i === 1 ? "#f59e0b" : "#fafafa" }}>{s.num}</div>
              <p style={{ color: "#a1a1aa", fontSize: 14, marginTop: 6 }}>{s.label}</p>
              <p className="mono" style={{ color: "#3f3f46", fontSize: 11, marginTop: 4 }}>{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="glow-line" />

      {/* ═══════════════════════════════════════════════ */}
      {/* THE 5 THINGS — WHAT EVERYONE REBUILDS            */}
      {/* ═══════════════════════════════════════════════ */}
      <section
        id="five"
        ref={r("five")}
        style={{
          padding: "100px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center",
          opacity: v("five") ? 1 : 0, transform: v("five") ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>THE PATTERN</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Every production team independently rebuilds<br />
          <span style={{ color: "#52525b" }}>the same five things.</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 480, margin: "0 auto 48px" }}>
          We built them once, as framework primitives, so you never write another custom retry wrapper again.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, textAlign: "left" }}>
          {fiveThings.map((t, i) => (
            <div key={i} style={{
              padding: "20px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, color: "#52525b" }}>{t.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.thing}</span>
              </div>
              <p style={{ fontSize: 13, color: "#71717a" }}>{t.desc}</p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40, padding: "16px 24px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)",
          borderRadius: 10, display: "inline-block",
        }}>
          <p className="mono" style={{ fontSize: 13, color: "#22c55e" }}>
            tenur.ing ships all five out of the box. Zero custom code required.
          </p>
        </div>
      </section>

      <div className="glow-line" />

      {/* ═══════════════════════════════════════════════ */}
      {/* ROLES MARKETPLACE — BEFORE/AFTER PER ROLE       */}
      {/* ═══════════════════════════════════════════════ */}
      <section
        id="roles"
        ref={r("roles")}
        style={{
          padding: "100px 24px", maxWidth: 1100, margin: "0 auto",
          opacity: v("roles") ? 1 : 0, transform: v("roles") ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>AGENT ROLES</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Pick a role. Set the shift. Hire.
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 520 }}>
          Each role ships pre-configured with the right execution guarantees per tool. Every failure mode from the community research is already handled.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {roles.map((role, i) => (
            <div
              key={role.slug}
              className="role-card"
              onClick={() => setSelectedRole(selectedRole === i ? null : i)}
              style={{
                background: selectedRole === i ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                borderRadius: 12, padding: 24,
                borderColor: selectedRole === i ? role.color + "44" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{role.title}</h3>
                <span className="mono" style={{ fontSize: 11, color: role.color, background: role.color + "15", padding: "3px 8px", borderRadius: 4 }}>{role.shift}</span>
              </div>
              <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{role.desc}</p>

              {/* Before/After inline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.06)",
                  padding: "8px 12px", borderRadius: 6, lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600 }}>Without:</span> {role.without}
                </div>
                <div style={{
                  fontSize: 12, color: "#22c55e", background: "rgba(34,197,94,0.06)",
                  padding: "8px 12px", borderRadius: 6, lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600 }}>With tenuring:</span> {role.with}
                </div>
              </div>

              {selectedRole === i && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeIn 0.3s ease-out" }}>
                  <div className="mono" style={{ fontSize: 12, color: "#52525b", marginBottom: 10 }}>tenur.ing/{role.slug}/hire</div>
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

      {/* ═══════════════════════════════════════════════ */}
      {/* HOW IT WORKS — ONE SENTENCE, THEN VISUAL        */}
      {/* ═══════════════════════════════════════════════ */}
      <section
        id="how"
        ref={r("how")}
        style={{
          padding: "100px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center",
          opacity: v("how") ? 1 : 0, transform: v("how") ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>HOW IT WORKS</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
          One line. Every tool call gets<br />
          <span style={{ color: "#52525b" }}>exactly the reliability it needs.</span>
        </h2>
        <p style={{ color: "#71717a", fontSize: 16, marginBottom: 48, maxWidth: 520, margin: "0 auto 48px" }}>
          Connect your OpenClaw workspace. Our router classifies every skill by what it actually does — reads get cached and retried aggressively, writes get idempotency keys, payments get exactly-once guarantees with human approval gates, and browser sessions get heartbeat monitoring. You configure nothing.
        </p>

        {/* Simple before/after */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, alignItems: "start", textAlign: "left" }}>
          <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.08)", borderRadius: 12, padding: 24 }}>
            <p className="mono" style={{ fontSize: 11, color: "#ef4444", marginBottom: 16 }}>EVERY OTHER FRAMEWORK</p>
            <div className="mono" style={{ fontSize: 12, lineHeight: 2.4, color: "#52525b" }}>
              <div>web_search → retry 3x</div>
              <div>stripe_charge → retry 3x</div>
              <div>send_email → retry 3x</div>
              <div>terraform_apply → retry 3x</div>
              <div>browser_crawl → retry 3x</div>
              <div>ask_human → retry 3x</div>
            </div>
            <p style={{ color: "#71717a", fontSize: 12, marginTop: 16, fontStyle: "italic" }}>Same treatment. Same failures.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#3f3f46", fontSize: 22 }}>→</div>

          <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.08)", borderRadius: 12, padding: 24 }}>
            <p className="mono" style={{ fontSize: 11, color: "#22c55e", marginBottom: 16 }}>TENURING</p>
            <div className="mono" style={{ fontSize: 12, lineHeight: 2.4 }}>
              <div><span style={{ color: "#3b82f6" }}>web_search</span> → cached · 5x retry</div>
              <div><span style={{ color: "#ef4444" }}>stripe_charge</span> → saga · exactly-once</div>
              <div><span style={{ color: "#f59e0b" }}>send_email</span> → dedup guard</div>
              <div><span style={{ color: "#ef4444" }}>terraform_apply</span> → compensation chain</div>
              <div><span style={{ color: "#8b5cf6" }}>browser_crawl</span> → heartbeat · resume</div>
              <div><span style={{ color: "#ec4899" }}>ask_human</span> → signal · no compute</div>
            </div>
            <p style={{ color: "#71717a", fontSize: 12, marginTop: 16, fontStyle: "italic" }}>Right guarantees. Zero config.</p>
          </div>
        </div>

        {/* Permanence */}
        <div style={{
          marginTop: 56, padding: 32, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>Your agent runs for years, not hours.</h3>
          <p style={{ color: "#71717a", fontSize: 15, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 28px" }}>
            Shift boundaries are natural checkpoints. State snapshots to storage. Memory persists. Same agent, same identity, same workspace — indefinitely.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, maxWidth: 500, margin: "0 auto" }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
              const on = i < 5;
              return (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: "100%", height: 32,
                    background: on ? "linear-gradient(180deg, rgba(34,197,94,0.3) 0%, rgba(34,197,94,0.05) 100%)" : "rgba(255,255,255,0.02)",
                    borderRadius: i === 0 ? "6px 0 0 6px" : i === 6 ? "0 6px 6px 0" : 0,
                    borderRight: i < 6 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {on && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease-in-out infinite", animationDelay: `${i * 0.3}s` }} />}
                  </div>
                  <span className="mono" style={{ fontSize: 9, color: on ? "#71717a" : "#3f3f46" }}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ═══════════════════════════════════════════════ */}
      {/* FOR DEVELOPERS — TECHNICAL DEPTH BELOW FOLD     */}
      {/* ═══════════════════════════════════════════════ */}
      <section
        ref={r("dev")}
        style={{
          padding: "100px 24px", maxWidth: 900, margin: "0 auto",
          opacity: v("dev") ? 1 : 0, transform: v("dev") ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s ease-out",
        }}
      >
        <p className="mono section-label" style={{ marginBottom: 12 }}>FOR DEVELOPERS</p>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>
          The taxonomy is open. The router is ours.
        </h2>
        <p style={{ color: "#71717a", fontSize: 15, marginBottom: 48, maxWidth: 540 }}>
          The open-source skill taxonomy maps every tool type to the right execution primitive. The proprietary runtime router classifies unknown tools at invocation time in under 100ms. Self-host the taxonomy. Let us run the router.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring-core</span>
              <span className="mono" style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 6px", borderRadius: 3 }}>MIT</span>
            </div>
            {["Skill → primitive taxonomy", "Framework adapters", "Temporal bridge", "Local dashboard", "Decision tree schema"].map((x) => (
              <div key={x} style={{ fontSize: 13, color: "#a1a1aa", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{x}</div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>tenuring cloud</span>
              <span className="mono" style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: 3 }}>MANAGED</span>
            </div>
            {["Runtime inference engine", "Auto continueAsNew", "Roster shift calendar", "HITL approval inbox", "Managed capabilities"].map((x) => (
              <div key={x} style={{ fontSize: 13, color: "#a1a1aa", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{x}</div>
            ))}
          </div>
        </div>

        {/* Terminal */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "18px 24px",
        }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "#3f3f46" }} />)}
          </div>
          <div className="mono" style={{ fontSize: 13, lineHeight: 2, color: "#a1a1aa" }}>
            <div><span style={{ color: "#22c55e" }}>$</span> npx tenureagent connect openclaw</div>
            <div style={{ color: "#52525b" }}>✓ OpenClaw workspace detected</div>
            <div style={{ color: "#52525b" }}>✓ 50 skills classified — reads cached, writes keyed, payments gated</div>
            <div style={{ color: "#52525b" }}>✓ Shift schedule: Mon–Fri 9AM–5PM EST</div>
            <div style={{ color: "#22c55e" }}>⟐ Agent tenured. Workflow running durably.</div>
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* ═══════════════════════════════════════════════ */}
      {/* FINAL CTA                                        */}
      {/* ═══════════════════════════════════════════════ */}
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#52525b", marginBottom: 16 }}>
          No framework has shipped these five primitives. We did.
        </p>
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Hire agents that actually work.
        </h2>
        <p style={{ fontSize: 17, color: "#71717a", fontWeight: 300, marginBottom: 48, maxWidth: 460, margin: "0 auto 48px" }}>
          No duplicate emails. No silent failures. No $50,000 API bills from runaway loops. Just agents that survive crashes and remember everything.
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
