import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { NAV_BADGES_CHANGED_EVENT } from "../../../lib/audit-notifications";
import BottomNav from "../dashboard/BottomNav";
import Header from "../dashboard/header";
import ProfileModal from "../Management/my-profiles";
import Departments from "../Management/department";
import FileReports from "../Ticket & Repairs/submitTicket";
import ReportAnalytics from "../Reports/report-analytics";
import UserAccounts from "../Management/user-accounts";
import IncomingUnits from "../Units/incomingUnits";
import OutgoingUnits from "../Units/outgoingUnits";
import Repairs from "../repairs/repairs";
import TechnicianDashboardHome from "../../technician/technician-dashboard-home";
import MyTickets from "../../technician/my-tickets";
import ActivityLogPanel from "../../technician/activity-log-panel";
import UserShell from "../../user/UserShell.tsx";
import WorkHistory from "../../technician/work-history";
import {
  Ticket, Clock, CircleArrowDown,
  CircleArrowUp, TrendingUp, Activity,
  BarChart3, AlertTriangle, RefreshCw, ArrowUpRight, Trophy, Star,
} from "lucide-react";

// ── Shared card style — matches header exactly ────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e8edf5",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05), 0 0 0 1px rgba(10,76,134,0.04)",
  padding: "1.3rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type IssueCount = { type: string; count: number };
type DeptRow    = { name: string; tickets: number; repairs: number };
type TechStat   = {
  id:           string;
  full_name:    string;
  avatar_url:   string;
  resolved:     number;
  inProgress:   number;
  pending:      number;
  avgRating:    number;
  totalRatings: number;
};
type DashData = {
  totalTickets:      number;
  pendingTickets:    number;
  inProgressTickets: number;
  resolvedTickets:   number;
  incomingUnits:     number;
  outgoingUnits:     number;
  avgFeedbackRating: number;
  totalFeedbacks:    number;
  issueBreakdown:    IssueCount[];
  deptRows:          DeptRow[];
  weeklyTickets:     number[];
  techLeaderboard:   TechStat[];
};

function isAssigned(assignedTo: any, techId: string): boolean {
  if (!assignedTo) return false;
  if (Array.isArray(assignedTo)) return assignedTo.map(String).includes(String(techId));
  return String(assignedTo) === String(techId);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI: React.FC<{
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  delay?: number;
  onClick?: () => void;
}> = ({ label, value, sub, icon, accent, delay = 0, onClick }) => {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...CARD,
        background: hovered ? "#fafbff" : "#ffffff",
        border: `1px solid ${hovered ? accent + "40" : "#e8edf5"}`,
        display: "flex", flexDirection: "column", gap: "0.7rem",
        position: "relative", overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms, border-color 0.2s, background 0.2s, box-shadow 0.2s`,
        boxShadow: hovered ? `0 4px 20px ${accent}18` : "0 2px 12px rgba(10,76,134,0.06)",
        cursor: onClick ? "pointer" : "default",
        padding: "1.3rem 1.4rem",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "18px 18px 0 0" }} />
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: accent, opacity: hovered ? 0.1 : 0.06, transition: "opacity 0.2s" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>
          {icon}
        </div>
        {onClick && (
          <ArrowUpRight size={14} color={hovered ? accent : "#cbd5e1"} style={{ transition: "color 0.2s", transform: hovered ? "translate(2px, -2px)" : "none", transitionProperty: "color, transform" }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-1px", fontFamily: "'DM Sans', sans-serif" }}>
          {visible ? value : typeof value === "number" ? 0 : "—"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data }) => {
  const days      = ["Mon", "Tue", "Wed", "Thu"];
  const sliced    = data.slice(0, 4);
  const max       = Math.max(...sliced, 1);
  const dayColors = ["#0a4c86", "#7c3aed", "#0891b2", "#f59e0b"];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 56 }}>
      {sliced.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: `${Math.max((v / max) * 44, 4)}px`, background: dayColors[i], borderRadius: 4 }} />
          <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
};

// ── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52, cx = 64, cy = 64, stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {total > 0 && data.map((d, i) => {
          const pct  = d.value / total;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el   = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ + circ / 4}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={22} fontWeight={800} fill="#0f172a" fontFamily="'DM Sans', sans-serif">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9}  fill="#94a3b8" fontWeight={600} letterSpacing="1">TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginLeft: "auto" }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Issue Types Line Chart ────────────────────────────────────────────────────
const IssueLineChart: React.FC<{ issueBreakdown: IssueCount[] }> = ({ issueBreakdown }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);
  useEffect(() => {
    if (!canvasRef.current || issueBreakdown.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      const sliced      = issueBreakdown.slice(0, 6);
      const pointColors = ["#0a4c86", "#7c3aed", "#0891b2", "#f59e0b", "#ef4444", "#10b981"];
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: sliced.map(i => i.type),
          datasets: [{
            label: "Tickets", data: sliced.map(i => i.count),
            borderColor: "#0a4c86", backgroundColor: "rgba(10,76,134,0.07)",
            pointBackgroundColor: sliced.map((_, i) => pointColors[i] ?? "#0a4c86"),
            pointBorderColor: "#fff", pointBorderWidth: 2,
            pointRadius: 6, pointHoverRadius: 9,
            fill: true, tension: 0.4, borderWidth: 2,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0f172a", titleColor: "#f8fafc", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8, callbacks: { title: (items) => items[0]?.label ?? "", label: (item) => ` ${item.raw} ticket${Number(item.raw) !== 1 ? "s" : ""}` } },
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, family: "'DM Sans', sans-serif" }, color: "#94a3b8", maxRotation: 25, autoSkip: false } },
            y: { beginAtZero: true, grid: { color: "#f1f5f9" }, border: { display: false }, ticks: { font: { size: 11, family: "'DM Sans', sans-serif" }, color: "#94a3b8", stepSize: 1, precision: 0 } },
          },
        },
      });
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [issueBreakdown]);
  return <div style={{ position: "relative", width: "100%", height: 190 }}><canvas ref={canvasRef} /></div>;
};

// ── Skeleton primitive ────────────────────────────────────────────────────────
const Skeleton: React.FC<{
  width?: string | number; height?: number; radius?: number;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = 14, radius = 6, style = {} }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
    backgroundSize: "200% 100%",
    animation: "skShimmer 1.4s ease infinite",
    flexShrink: 0, ...style,
  }} />
);

// ── KPI skeleton ──────────────────────────────────────────────────────────────
const KpiSkeleton: React.FC = () => (
  <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "0.7rem", position: "relative", overflow: "hidden", padding: "1.3rem 1.4rem" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#e2e8f0", borderRadius: "18px 18px 0 0" }} />
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Skeleton width={38} height={38} radius={12} />
      <Skeleton width={14} height={14} radius={4} />
    </div>
    <Skeleton width="55%" height={32} radius={6} />
    <Skeleton width="70%" height={10} radius={4} />
    <Skeleton width="50%" height={10} radius={4} />
  </div>
);

// ── Panel skeleton ────────────────────────────────────────────────────────────
const PanelSkeleton: React.FC<{ height?: number; lines?: number }> = ({ height = 200, lines = 3 }) => (
  <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12, minHeight: height }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Skeleton width={30} height={30} radius={9} />
      <Skeleton width="40%" height={14} radius={5} />
    </div>
    <Skeleton width="100%" height={height * 0.38} radius={8} />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} width={`${75 - i * 12}%`} height={10} radius={4} />
    ))}
  </div>
);

// ── Leaderboard card skeleton ─────────────────────────────────────────────────
const LeaderboardCardSkeleton: React.FC = () => (
  <div style={{ border: "1px solid #e8edf5", borderRadius: 14, padding: "16px 18px", background: "#fff" }}>
    <Skeleton width={28} height={18} radius={999} style={{ marginBottom: 10 }} />
    <Skeleton width={42} height={42} radius={999} style={{ marginBottom: 10 }} />
    <Skeleton width="75%" height={13} radius={5} style={{ marginBottom: 6 }} />
    <Skeleton width="50%" height={18} radius={999} style={{ marginBottom: 12 }} />
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {[0, 1, 2].map(i => <Skeleton key={i} width="33%" height={42} radius={8} />)}
    </div>
    <Skeleton width="100%" height={4} radius={999} style={{ marginBottom: 6 }} />
    <Skeleton width="35%" height={8} radius={4} style={{ marginLeft: "auto" }} />
  </div>
);

// ── Department Horizontal Bar Chart ──────────────────────────────────────────
const DEPT_PALETTE = ["#0a4c86","#7c3aed","#0891b2","#f59e0b","#10b981","#ef4444","#f97316","#8b5cf6","#06b6d4","#84cc16","#e11d48","#14b8a6"];
function getDeptColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_PALETTE[Math.abs(hash) % DEPT_PALETTE.length];
}
const DeptBarChart: React.FC<{ deptRows: DeptRow[] }> = ({ deptRows }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);
  useEffect(() => {
    if (!canvasRef.current || deptRows.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: deptRows.map(d => d.name),
          datasets: [{ data: deptRows.map(d => d.tickets), backgroundColor: deptRows.map(d => getDeptColor(d.name)), borderRadius: 8, borderSkipped: false, barThickness: 26 }],
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0f172a", titleColor: "#f8fafc", bodyColor: "#94a3b8", padding: 10, cornerRadius: 8, callbacks: { title: (items) => items[0]?.label ?? "", label: (item) => ` ${item.raw} ticket${Number(item.raw) !== 1 ? "s" : ""}` } } },
          scales: {
            x: { grid: { color: "rgba(148,163,184,0.12)" }, border: { display: false }, ticks: { font: { size: 11, family: "'DM Sans', sans-serif" }, color: "#94a3b8", precision: 0 } },
            y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12, family: "'DM Sans', sans-serif", weight: 500 }, color: "#475569", padding: 4 } },
          },
          layout: { padding: { right: 8 } },
        },
      });
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [deptRows]);
  return <div style={{ position: "relative", width: "100%", height: `${Math.max(deptRows.length * 52 + 32, 160)}px` }}><canvas ref={canvasRef} /></div>;
};

// ── Leaderboard helpers ───────────────────────────────────────────────────────
const AVATAR_BG   = ["#fef9c3","#e0e7ff","#d1fae5","#fce7f3","#e0f2fe","#fce7f3","#e0e7ff"];
const AVATAR_TEXT = ["#92400e","#3730a3","#065f46","#9d174d","#0c4a6e","#9d174d","#3730a3"];
function getInitials(name: string): string { return name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase(); }
function getPerformanceBadge(avgRating: number, rank: number) {
  if (rank === 0 && avgRating > 0) return { label: "Top rated",        color: "#92400e", bg: "#fef9c3" };
  if (avgRating >= 4.5)            return { label: "Excellent",         color: "#065f46", bg: "#d1fae5" };
  if (avgRating >= 4.0)            return { label: "Great",             color: "#1e40af", bg: "#dbeafe" };
  if (avgRating >= 3.0)            return { label: "Good",              color: "#475569", bg: "#f1f5f9" };
  if (avgRating > 0)               return { label: "Needs improvement", color: "#92400e", bg: "#fef3c7" };
  return                                  { label: "No ratings yet",    color: "#94a3b8", bg: "#f8fafc" };
}

const TechAvatar: React.FC<{ tech: TechStat; index: number; size?: number; fontSize?: number; borderColor?: string }> = ({ tech, index, size = 38, fontSize = 12, borderColor }) => {
  const bg   = AVATAR_BG[index]   ?? "#f1f5f9";
  const text = AVATAR_TEXT[index] ?? "#475569";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bg, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 700, color: text, border: borderColor ? `2px solid ${borderColor}` : "1.5px solid rgba(0,0,0,0.06)" }}>
      {tech.avatar_url
        ? <img src={tech.avatar_url} alt={tech.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : getInitials(tech.full_name)}
    </div>
  );
};

// ── Leaderboard Cards ─────────────────────────────────────────────────────────
const CardsView: React.FC<{ techs: TechStat[] }> = ({ techs }) => {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {techs.map((tech, i) => {
        const badge   = getPerformanceBadge(tech.avgRating, i);
        const isFirst = i === 0;
        const total   = tech.resolved + tech.inProgress + tech.pending;
        return (
          <div key={tech.id} style={{
            border: `1px solid ${isFirst ? "#fde68a" : "#e8edf5"}`,
            borderRadius: 14,
            padding: "16px 18px",
            background: isFirst ? "#fffbeb" : "#ffffff",
            position: "relative",
            boxShadow: isFirst
              ? "0 2px 12px rgba(251,191,36,0.14)"
              : "0 2px 12px rgba(10,76,134,0.06)",
          }}>
            <div style={{ position: "absolute", top: 14, right: 16, fontSize: i < 3 ? 18 : 12, fontWeight: 700, color: "#94a3b8" }}>
              {medals[i] ?? `#${i + 1}`}
            </div>

            <TechAvatar tech={tech} index={i} size={42} fontSize={13} borderColor={isFirst ? "#fbbf24" : undefined} />

            <div style={{ marginTop: 10, marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#0f172a", paddingRight: 24, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {tech.full_name}
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color: badge.color, background: badge.bg, display: "inline-block", marginBottom: 12 }}>
              {badge.label}
            </span>

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { num: tech.resolved,   lbl: "Resolved", col: "#065f46", bg: "#d1fae5" },
                { num: tech.inProgress, lbl: "Active",   col: "#1e40af", bg: "#dbeafe" },
                { num: tech.pending,    lbl: "Pending",  col: "#92400e", bg: "#fef3c7" },
              ].map(s => (
                <div key={s.lbl} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: "7px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: s.col, marginTop: 3, opacity: 0.75 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  User feedback
                </span>
                {tech.totalRatings > 0 && (
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                    {tech.avgRating.toFixed(1)} / 5 ({tech.totalRatings})
                  </span>
                )}
              </div>

              {tech.totalRatings > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n} size={15}
                        fill={n <= Math.round(tech.avgRating) ? "#f59e0b" : "none"}
                        color={n <= Math.round(tech.avgRating) ? "#f59e0b" : "#cbd5e1"}
                        strokeWidth={n <= Math.round(tech.avgRating) ? 0 : 2}
                      />
                    ))}
                  </div>
                  <div style={{ height: 4, background: "rgba(148,163,184,0.2)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(tech.avgRating / 5) * 100}%`, background: isFirst ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#0a4c86,#3b82f6)", borderRadius: 99, transition: "width 0.6s ease" }} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>No ratings yet</div>
              )}

              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>
                {total} total assigned
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const stampAvatar = (t: any) => ({
  ...t,
  avatar_url: t.avatar_url ? `${t.avatar_url}?t=${encodeURIComponent(String(t.updated_at ?? ""))}` : "",
});

// ── Build Dashboard Data ──────────────────────────────────────────────────────
function buildDashData(
  tickets:   any[],
  incoming:  any[],
  outgoing:  any[],
  depts:     any[],
  techs:     any[],
  feedbacks: any[],
): DashData {
  const today = new Date();
  const weeklyTickets = Array(7).fill(0);
  tickets.forEach(t => {
    const submitted     = new Date(t.date_submitted);
    const todayMonBased = (today.getDay() + 6) % 7;
    const startOfWeek   = new Date(today);
    startOfWeek.setDate(today.getDate() - todayMonBased);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    if (submitted >= startOfWeek && submitted < endOfWeek)
      weeklyTickets[(submitted.getDay() + 6) % 7]++;
  });

  const typeCounts: Record<string, number> = {};
  tickets.forEach(t => {
    const k = t.issue_type === "Network / Internet" ? "Internet" : (t.issue_type ?? "Other");
    typeCounts[k] = (typeCounts[k] ?? 0) + 1;
  });
  const issueBreakdown: IssueCount[] = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const deptRows: DeptRow[] = (depts ?? [])
    .map((dept: any) => ({ name: dept.name, tickets: tickets.filter(t => t.department_id === dept.id).length, repairs: 0 }))
    .filter((d: DeptRow) => d.tickets > 0)
    .sort((a: DeptRow, b: DeptRow) => b.tickets - a.tickets)
    .slice(0, 5);

  // ── Per-technician feedback ───────────────────────────────────────────────
  const techRatingsMap: Record<string, number[]> = {};
  feedbacks.forEach((fb: any) => {
    const ticket = tickets.find(t => String(t.id) === String(fb.report_id));
    if (!ticket) return;
    const assigned: string[] = Array.isArray(ticket.assigned_to)
      ? ticket.assigned_to.map(String)
      : ticket.assigned_to ? [String(ticket.assigned_to)] : [];
    assigned.forEach(techId => {
      if (!techRatingsMap[techId]) techRatingsMap[techId] = [];
      techRatingsMap[techId].push(Number(fb.rating));
    });
  });

  const techLeaderboard: TechStat[] = (techs ?? [])
    .map((tech: any) => {
      const techIdStr = String(tech.id);
      const ratings   = techRatingsMap[techIdStr] ?? [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      return {
        id:           tech.id,
        full_name:    tech.full_name,
        avatar_url:   tech.avatar_url ?? "",
        resolved:     tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "Resolved").length,
        inProgress:   tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "In Progress").length,
        pending:      tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "Pending").length,
        avgRating:    Math.round(avgRating * 10) / 10,
        totalRatings: ratings.length,
      };
    })
    .sort((a: TechStat, b: TechStat) => b.avgRating - a.avgRating || b.resolved - a.resolved);

  const totalFeedbacks    = feedbacks.length;
  const avgFeedbackRating = totalFeedbacks > 0
    ? Math.round((feedbacks.reduce((s: number, f: any) => s + Number(f.rating), 0) / totalFeedbacks) * 10) / 10
    : 0;

  return {
    totalTickets:      tickets.length,
    pendingTickets:    tickets.filter(t => t.status === "Pending").length,
    resolvedTickets:   tickets.filter(t => t.status === "Resolved").length,
    inProgressTickets: tickets.filter(t => t.status === "In Progress").length,
    incomingUnits:     incoming.length,
    outgoingUnits:     outgoing.length,
    avgFeedbackRating,
    totalFeedbacks,
    issueBreakdown,
    deptRows,
    weeklyTickets,
    techLeaderboard,
  };
}

// ── Section header helper ─────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ icon, iconBg, title, subtitle, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    {right}
  </div>
);

// ── Dashboard Home ────────────────────────────────────────────────────────────
const DashboardHome: React.FC<{ onNavigate: (label: string) => void }> = ({ onNavigate }) => {
  const [data, setData]           = useState<DashData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshed, setRefreshed] = useState(false);

  const ticketsRef   = useRef<any[]>([]);
  const incomingRef  = useRef<any[]>([]);
  const outgoingRef  = useRef<any[]>([]);
  const deptsRef     = useRef<any[]>([]);
  const techsRef     = useRef<any[]>([]);
  const feedbacksRef = useRef<any[]>([]);

  const recomputeRef = useRef<() => void>(() => {});
  recomputeRef.current = () =>
    setData(buildDashData(
      ticketsRef.current, incomingRef.current, outgoingRef.current,
      deptsRef.current, techsRef.current, feedbacksRef.current,
    ));

  const upsertById = useCallback((rows: any[], next: any) => {
    const exists = rows.some(r => r.id === next.id);
    if (!exists) return [...rows, next];
    return rows.map(r => r.id === next.id ? { ...r, ...next } : r);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: tickets },
      { data: incoming },
      { data: outgoing },
      { data: depts },
      { data: techs },
      { data: feedbacks },
    ] = await Promise.all([
      supabase.from("file_reports").select("status, issue_type, date_submitted, department_id, id, assigned_to"),
      supabase.from("incoming_units").select("id"),
      supabase.from("outgoing_units").select("id"),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("user_accounts").select("id, full_name, avatar_url, updated_at").eq("role", "IT Technician").eq("is_active", true).eq("is_archived", false).order("full_name"),
      supabase.from("ticket_feedback").select("id, report_id, rating"),
    ]);
    ticketsRef.current   = tickets   ?? [];
    incomingRef.current  = incoming  ?? [];
    outgoingRef.current  = outgoing  ?? [];
    deptsRef.current     = depts     ?? [];
    techsRef.current     = (techs ?? []).map(stampAvatar);
    feedbacksRef.current = feedbacks ?? [];
    recomputeRef.current();
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel(`dashboard_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "file_reports" },
        ({ new: n }) => { ticketsRef.current = upsertById(ticketsRef.current, n); recomputeRef.current(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "file_reports" },
        ({ new: n }) => { ticketsRef.current = upsertById(ticketsRef.current, n); recomputeRef.current(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "file_reports" },
        ({ old: o }) => { ticketsRef.current = ticketsRef.current.filter(r => r.id !== (o as any).id); recomputeRef.current(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_feedback" },
        () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [upsertById, load]);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshed(true);
    await load();
    setTimeout(() => setRefreshed(false), 600);
  };

  if (loading) return (
  <>
    <style>{`@keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }`}</style>
    <div className="dash-new" style={{ color: "#0f172a", paddingRight: 8 }}>
      {/* Refresh button placeholder */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <Skeleton width={90} height={34} radius={10} />
      </div>

      {/* KPI grid skeleton */}
      <div className="dash-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.85rem", marginBottom: "1.2rem" }}>
        {[0,1,2,3,4,5].map(i => <KpiSkeleton key={i} />)}
      </div>

      {/* Mid row skeleton */}
      <div className="dash-mid-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1rem", marginBottom: "1rem" }}>
        <PanelSkeleton height={220} lines={3} />
        <PanelSkeleton height={220} lines={2} />
      </div>

      {/* Bottom row skeleton */}
      <div className="dash-bot-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <PanelSkeleton height={260} lines={2} />
        <PanelSkeleton height={260} lines={2} />
      </div>

      {/* Leaderboard skeleton */}
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
          <Skeleton width={30} height={30} radius={9} />
          <div>
            <Skeleton width={200} height={14} radius={5} style={{ marginBottom: 5 }} />
            <Skeleton width={160} height={10} radius={4} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {[0,1,2,3,4].map(i => <LeaderboardCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  </>
);

  if (!data) return null;

  const donutData = [
    { label: "Pending",     value: data.pendingTickets,    color: "#f59e0b" },
    { label: "In Progress", value: data.inProgressTickets, color: "#3b82f6" },
    { label: "Resolved",    value: data.resolvedTickets,   color: "#10b981" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .dash-new *, .dash-new { box-sizing: border-box; }
        .dash-new { font-family: 'DM Sans', sans-serif; }
        .refresh-btn:hover { background: #f1f5f9 !important; }
        @media (max-width: 1100px) {
          .dash-kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
          .dash-mid-grid { grid-template-columns: 1fr !important; }
          .dash-bot-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 580px) { .dash-kpi-grid { grid-template-columns: 1fr !important; } }
        @keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>

      <div className="dash-new" style={{ color: "#0f172a", paddingRight: 8 }}>

        {/* ── Refresh ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            style={{
              ...CARD,
              padding: "0.45rem 0.9rem",
              borderRadius: 10,
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: "#475569",
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s",
              border: "1px solid #e8edf5",
            }}
          >
            <RefreshCw size={13} style={{ transform: refreshed ? "rotate(360deg)" : "rotate(0deg)", transition: "transform 0.5s ease" }} />
            Refresh
          </button>
        </div>

        {/* ── KPI Grid ── */}
        <div className="dash-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.85rem", marginBottom: "1.2rem" }}>
          <KPI label="Total Tickets"      value={data.totalTickets}      icon={<Ticket size={17} />}          accent="#0a4c86" delay={0}   sub="All time submissions" onClick={() => onNavigate("Submit Ticket")} />
          <KPI label="Pending"            value={data.pendingTickets}    icon={<Clock size={17} />}           accent="#f59e0b" delay={60}  sub="Awaiting action"      onClick={() => onNavigate("Submit Ticket")} />
          <KPI label="In Progress"        value={data.inProgressTickets} icon={<Activity size={17} />}        accent="#3b82f6" delay={120} sub="Being handled"        onClick={() => onNavigate("Submit Ticket")} />
          <KPI
            label="Avg Feedback Rating"
            value={data.totalFeedbacks > 0 ? `${data.avgFeedbackRating} ★` : "—"}
            icon={<Star size={17} />}
            accent="#f59e0b"
            delay={180}
            sub={`From ${data.totalFeedbacks} review${data.totalFeedbacks !== 1 ? "s" : ""}`}
          />
          <KPI label="Incoming Units"     value={data.incomingUnits}     icon={<CircleArrowDown size={17} />} accent="#8b5cf6" delay={240} sub="Logged for repair"    onClick={() => onNavigate("Incoming Units")} />
          <KPI label="Outgoing Units"     value={data.outgoingUnits}     icon={<CircleArrowUp size={17} />}   accent="#10b981" delay={300} sub="Returned to users"    onClick={() => onNavigate("Outgoing Units")} />
        </div>

        {/* ── Mid row ── */}
        <div className="dash-mid-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1rem", marginBottom: "1rem" }}>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<BarChart3 size={14} color="#0a4c86" />}
              iconBg="#0a4c8615"
              title="Ticket Status"
            />
            <DonutChart data={donutData} />
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<Activity size={14} color="#0a4c86" />}
              iconBg="#0a4c8615"
              title="Tickets This Week"
              right={<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Last 7 days</span>}
            />
            <Sparkline data={data.weeklyTickets} color="#0a4c86" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid #f1f5f9" }}>
              {[
                { label: "Total this week", value: data.weeklyTickets.reduce((a, b) => a + b, 0), color: "#0a4c86" },
                { label: "Daily avg",       value: (data.weeklyTickets.reduce((a, b) => a + b, 0) / 7).toFixed(1), color: "#64748b" },
                { label: "Peak day",        value: Math.max(...data.weeklyTickets), color: "#f59e0b" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="dash-bot-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<AlertTriangle size={14} color="#ef4444" />}
              iconBg="#ef444415"
              title="Recurring Issue Types"
            />
            {data.issueBreakdown.length === 0
              ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No issue data yet.</p>
              : <IssueLineChart issueBreakdown={data.issueBreakdown} />}
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<TrendingUp size={14} color="#8b5cf6" />}
              iconBg="#8b5cf615"
              title="Top Departments by Tickets"
              subtitle="Top 5 most active"
            />
            {data.deptRows.length === 0
              ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No department data yet.</p>
              : <DeptBarChart deptRows={data.deptRows} />}
          </div>
        </div>

        {/* ── Leaderboard ── */}
        <div style={{ ...CARD }}>
          <SectionHeader
            icon={<Trophy size={14} color="#f59e0b" />}
            iconBg="#f59e0b15"
            title="IT Technician Leaderboard"
            subtitle="Ranked by user feedback rating"
          />
          {data.techLeaderboard.length === 0
            ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No technician data yet.</p>
            : <CardsView techs={data.techLeaderboard} />}
        </div>

      </div>
    </>
  );
};

// ── Dashboard Shell ───────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [activeLabel, setActiveLabel]           = useState("Dashboard");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [headerAvatarUrl, setHeaderAvatarUrl]   = useState("");
  const [assignJobBadgeCount, setAssignJobBadgeCount] = useState(0);

  const navigate = useNavigate();

  const currentUserName = localStorage.getItem("session_user_full_name") || "User";
  const userRole        = localStorage.getItem("session_user_role")      || "";
  const userId          = localStorage.getItem("session_user_id")        || "";
  const isAdmin         = userRole === "Administrator";
  const isTechnician    = userRole === "IT Technician";
  const isEmployee      = userRole === "Employee";

  const refreshAssignJobPendingBadge = useCallback(async () => {
    if (userRole !== "Administrator") {
      setAssignJobBadgeCount(0);
      return;
    }
    const { data, error } = await supabase
      .from("file_reports")
      .select("assigned_to")
      .eq("status", "Pending")
      .eq("is_archived", false);
    if (error) return;
    const n = (data ?? []).filter((row: { assigned_to: unknown }) => {
      const a = row.assigned_to;
      const arr = Array.isArray(a) ? a : [];
      return arr.length === 0;
    }).length;
    setAssignJobBadgeCount(n);
  }, [userRole]);

  useEffect(() => {
    void refreshAssignJobPendingBadge();
  }, [refreshAssignJobPendingBadge]);

  useEffect(() => {
    if (userRole !== "Administrator") return;
    const ch = supabase
      .channel(`adm_nav_badges_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_reports" },
        () => { void refreshAssignJobPendingBadge(); }
      )
      .subscribe();
    const onEvt = () => { void refreshAssignJobPendingBadge(); };
    window.addEventListener(NAV_BADGES_CHANGED_EVENT, onEvt);
    return () => {
      window.removeEventListener(NAV_BADGES_CHANGED_EVENT, onEvt);
      void supabase.removeChannel(ch);
    };
  }, [userRole, refreshAssignJobPendingBadge]);

  useEffect(() => {
    const token  = localStorage.getItem("session_token");
    const role   = localStorage.getItem("session_user_role") || "";
    const roleOk = role === "Administrator" || role === "IT Technician" || role === "Employee";
    if (!token || !roleOk) {
      ["session_token","session_user_id","session_user_full_name","session_user_role","session_expires_at"]
        .forEach(k => localStorage.removeItem(k));
      navigate("/");
    }
  }, [navigate, userRole]);

  useEffect(() => {
    const loadHeaderAvatar = async () => {
      if (!userId) { setHeaderAvatarUrl(""); return; }
      const { data } = await supabase.from("user_accounts").select("avatar_url, updated_at").eq("id", userId).single();
      setHeaderAvatarUrl(data?.avatar_url ? `${data.avatar_url}?t=${encodeURIComponent(String(data.updated_at ?? ""))}` : "");
    };
    void loadHeaderAvatar();
  }, [userId]);

  if (isEmployee) return <UserShell />;

  const dashHomeNode = useRef<React.ReactNode>(
    isTechnician ? <TechnicianDashboardHome /> : <DashboardHome onNavigate={setActiveLabel} />
  );

  const getPage = (label: string): React.ReactNode => {
    const adminOnlyLabels = new Set(["Submit Ticket", "Assign Job", "Resolved Tickets", "Departments", "User Accounts", "Reports & Analytics"]);
    if (!isAdmin && adminOnlyLabels.has(label)) return dashHomeNode.current;
    switch (label) {
      case "Dashboard":           return dashHomeNode.current;
      case "Submit Ticket":       return <FileReports />;
      case "Assign Job":          return <Repairs />;
      case "My Tickets":          return <MyTickets />;
      case "Work History":        return <WorkHistory />;
      case "Resolved Tickets":    return <WorkHistory />;
      case "Incoming Units":      return <IncomingUnits readOnly={isTechnician} />;
      case "Outgoing Units":      return <OutgoingUnits readOnly={isTechnician} />;
      case "Departments":         return <Departments />;
      case "User Accounts":       return isAdmin ? <UserAccounts /> : dashHomeNode.current;
      case "Reports & Analytics": return isAdmin ? <ReportAnalytics /> : dashHomeNode.current;
      case "Activity Log":        return <ActivityLogPanel isAdmin={isAdmin} />;
      default:                    return dashHomeNode.current;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .adm-scroll-area::-webkit-scrollbar             { width: 8px; height: 8px; }
        .adm-scroll-area::-webkit-scrollbar-track       { background: transparent; }
        .adm-scroll-area::-webkit-scrollbar-thumb       { background: #cbd5e1; border-radius: 4px; }
        .adm-scroll-area::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div style={{ height: "100vh", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f0f2f5", fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, background: "#ffffff", borderBottom: "1px solid #e8edf5", boxShadow: "0 2px 12px rgba(10,76,134,0.06)" }}>
          <Header
            currentUserName={currentUserName}
            userRole={userRole}
            avatarUrl={headerAvatarUrl}
            onNotificationNavigate={(entityType, entityId) => {
              if (isAdmin) {
                if (entityType === "file_report") { if (entityId) localStorage.setItem("focus_ticket_id", entityId); setActiveLabel("Submit Ticket"); }
                else if (entityType === "repair")          setActiveLabel("Assign Job");
                else if (entityType === "signup_request")  setActiveLabel("User Accounts");
              } else if (isTechnician) {
                if (entityType === "file_report") { if (entityId) localStorage.setItem("focus_ticket_id", entityId); setActiveLabel("My Tickets"); }
              }
            }}
            onOpenProfile={() => setShowProfileModal(true)}
          />
        </div>

        <div className="adm-scroll-area" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "1.4rem 8% 100px" }}>
          {getPage(activeLabel)}
        </div>

        <BottomNav
          activeLabel={activeLabel}
          onNavigate={setActiveLabel}
          userRole={userRole}
          badgeByLabel={isAdmin ? { "Assign Job": assignJobBadgeCount } : undefined}
        />
      </div>

      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onAvatarChange={url => setHeaderAvatarUrl(url)}
      />
    </>
  );
};

export default Dashboard;