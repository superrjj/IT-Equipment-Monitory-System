import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Ticket, Clock, CheckCircle2, CircleDot,
  RefreshCw, ArrowUpRight,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const BRAND = "#0a4c86";

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * ease));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent: string;
  delay?: number;
  animKey?: number;
}> = ({ label, value, sub, icon, accent, delay = 0, animKey = 0 }) => {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay, animKey]);

  const displayed = useCountUp(visible ? value : 0);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "1rem 1.1rem 0.9rem",
        border: "1px solid #e8edf5",
        position: "relative",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms, box-shadow 0.2s`,
        boxShadow: hovered ? "0 4px 18px rgba(10,76,134,0.08)" : "none",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: "14px 14px 0 0",
      }} />
      <div style={{
        position: "absolute", top: 10, right: 12,
        color: accent, opacity: hovered ? 0.15 : 0.07,
        transition: "opacity 0.2s",
        transform: "scale(2)",
        transformOrigin: "top right",
        pointerEvents: "none",
      }}>
        {icon}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${accent}13`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent,
        }}>
          {icon}
        </div>
        <ArrowUpRight
          size={13}
          color={hovered ? accent : "#d1d5db"}
          style={{ transition: "color 0.2s, transform 0.2s", transform: hovered ? "translate(1px,-1px)" : "none" }}
        />
      </div>
      <div style={{
        fontSize: 32, fontWeight: 800, color: "#0f172a",
        lineHeight: 1, letterSpacing: "-1px",
        fontFamily: "'DM Sans', sans-serif",
        marginBottom: 4,
      }}>
        {displayed}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.09em",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
    </div>
  );
};

// ── Resolution bar ────────────────────────────────────────────────────────────
const ResolutionBar: React.FC<{
  label: string;
  value: number;
  total: number;
  color: string;
  delay?: number;
  animKey?: number;
}> = ({ label, value, total, color, delay = 0, animKey = 0 }) => {
  const [width, setWidth] = useState(0);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  useEffect(() => {
    setWidth(0);
    const t = setTimeout(() => setWidth(pct), delay + 250);
    return () => clearTimeout(t);
  }, [pct, delay, animKey]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{value}</span>
          <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 30, textAlign: "right" }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 5, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${width}%`,
          background: color, borderRadius: 999,
          transition: "width 0.65s cubic-bezier(.22,.68,0,1.2)",
        }} />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const TechnicianDashboardHome: React.FC = () => {
  const userId = getSessionUserId();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animKey, setAnimKey]       = useState(0);
  const [tickets, setTickets]       = useState({ total: 0, pending: 0, inProg: 0, resolved: 0 });

  const load = async (isRefresh = false) => {
    if (!userId) { setLoading(false); return; }

    if (isRefresh) {
      setTickets({ total: 0, pending: 0, inProg: 0, resolved: 0 });
    }

    const { data: tix } = await supabase
      .from("file_reports")
      .select("id, status")
      .contains("assigned_to", [userId]);

    const t = tix ?? [];
    setTickets({
      total:    t.length,
      pending:  t.filter((x: any) => x.status === "Pending").length,
      inProg:   t.filter((x: any) => x.status === "In Progress").length,
      resolved: t.filter((x: any) => x.status === "Resolved").length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`technician_dashboard_sync_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void load(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setAnimKey(k => k + 1);
    await load(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const resolveRate = tickets.total > 0
    ? Math.round((tickets.resolved / tickets.total) * 100)
    : 0;

  if (!userId) {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", color: "#94a3b8" }}>
        Session missing. Please sign in again.
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .tdb2 *, .tdb2 *::before, .tdb2 *::after { box-sizing: border-box; }
        @keyframes tdb2-spin  { to { transform: rotate(360deg); } }
        @keyframes tdb2-pulse { 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
        @keyframes tdb2-up    { from{ opacity:0; transform:translateY(12px) } to{ opacity:1; transform:translateY(0) } }
        .tdb2-in { animation: tdb2-up 0.35s ease both; }
        .tdb2-refresh:hover { background: #f1f5f9 !important; }
        @media(max-width:640px){
          .tdb2-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media(max-width:400px){
          .tdb2-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="tdb2" style={{ fontFamily: "'DM Sans', sans-serif", color: "#0f172a" }}>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button
            className="tdb2-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0.45rem 0.9rem", borderRadius: 10,
              border: "1px solid #e2e8f0", background: "#fff",
              fontSize: 12, fontWeight: 600, color: "#475569",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s",
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: refreshing ? "tdb2-spin 0.6s linear infinite" : "none" }}
            />
            Refresh
          </button>
        </div>

        {/* ── Skeleton ── */}
        {loading ? (
          <div className="tdb2-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.7rem" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 14, height: 120,
                border: "1px solid #e8edf5",
                animation: `tdb2-pulse 1.4s ease infinite`,
                animationDelay: `${i * 80}ms`,
              }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Row 1: 3 cards ── */}
            <div
              className="tdb2-in tdb2-grid"
              style={{ animationDelay: "50ms", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.7rem", marginBottom: "0.7rem" }}
            >
              <KpiCard label="My Tickets"  value={tickets.total}   sub="Assigned to you"  icon={<Ticket size={15} />}      accent={BRAND}   delay={0}   animKey={animKey} />
              <KpiCard label="Pending"     value={tickets.pending} sub="Awaiting action"  icon={<Clock size={15} />}        accent="#f59e0b" delay={50}  animKey={animKey} />
              <KpiCard label="In Progress" value={tickets.inProg}  sub="Currently active" icon={<CircleDot size={15} />}    accent="#3b82f6" delay={100} animKey={animKey} />
            </div>

            {/* ── Row 2: 1 card ── */}
            <div
              className="tdb2-in tdb2-grid"
              style={{ animationDelay: "100ms", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.7rem", marginBottom: "1rem" }}
            >
              <KpiCard label="Resolved" value={tickets.resolved} sub="Closed tickets" icon={<CheckCircle2 size={15} />} accent="#10b981" delay={150} animKey={animKey} />
            </div>

            {/* ── Breakdown panel ── */}
            {tickets.total > 0 && (
              <div
                className="tdb2-in"
                style={{
                  animationDelay: "180ms",
                  background: "#fff", borderRadius: 14,
                  border: "1px solid #e8edf5",
                  padding: "1rem 1.1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: `${BRAND}12`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Ticket size={13} color={BRAND} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Ticket Breakdown</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                    color:      resolveRate >= 70 ? "#10b981" : resolveRate >= 40 ? "#d97706" : "#ef4444",
                    background: resolveRate >= 70 ? "rgba(16,185,129,0.08)" : resolveRate >= 40 ? "rgba(217,119,6,0.08)" : "rgba(239,68,68,0.08)",
                  }}>
                    {resolveRate}% resolved
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <ResolutionBar label="Pending"     value={tickets.pending}  total={tickets.total} color="#f59e0b" delay={0}   animKey={animKey} />
                  <ResolutionBar label="In Progress" value={tickets.inProg}   total={tickets.total} color="#3b82f6" delay={70}  animKey={animKey} />
                  <ResolutionBar label="Resolved"    value={tickets.resolved} total={tickets.total} color="#10b981" delay={140} animKey={animKey} />
                </div>

                <div style={{
                  display: "flex", gap: "1.5rem",
                  marginTop: "0.85rem", paddingTop: "0.85rem",
                  borderTop: "1px solid #f1f5f9",
                }}>
                  {[
                    { label: "Total Assigned", value: tickets.total,                    color: BRAND     },
                    { label: "Open",           value: tickets.pending + tickets.inProg, color: "#f59e0b" },
                    { label: "Resolved",       value: tickets.resolved,                 color: "#10b981" },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 1 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {tickets.total === 0 && (
              <div
                className="tdb2-in"
                style={{
                  animationDelay: "180ms",
                  background: "#fff", borderRadius: 14,
                  border: "1px solid #e8edf5",
                  padding: "1.8rem", textAlign: "center",
                }}
              >
                <CheckCircle2 size={24} color="#10b981" style={{ marginBottom: 8, opacity: 0.7 }} />
                <div style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>All caught up!</div>
                <div style={{ marginTop: 3, fontSize: 12, color: "#94a3b8" }}>No active assignments right now.</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default TechnicianDashboardHome;