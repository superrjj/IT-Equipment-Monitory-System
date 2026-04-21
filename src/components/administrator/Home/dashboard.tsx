import React, { useEffect, useState, useCallback, useRef } from "react";
import type { Plugin } from "chart.js";
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
  Wifi, KeyRound, HardDrive, Wrench, Users,
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
  activeAccounts:    number;
  incomingByMonth:   number[];
  outgoingByMonth:   number[];
  accountsByMonth:   number[];
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
}> = ({ label, value, sub, accent, delay = 0, onClick }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      onClick={onClick}
      style={{
        ...CARD,
        background: "#ffffff",
        border: "1px solid #edf2f7",
        display: "flex", flexDirection: "column", gap: "0.7rem",
        position: "relative", overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
        boxShadow: "0 1px 6px rgba(15,23,42,0.05)",
        cursor: onClick ? "pointer" : "default",
        padding: "1.15rem 1.15rem 1rem",
        borderRadius: 12,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {label}
        </div>
        {onClick && (
          <ArrowUpRight size={14} color="#cbd5e1" />
        )}
      </div>
      <div>
        <div style={{ fontSize: 42, fontWeight: 800, color: "#0a3f74", lineHeight: 1, letterSpacing: "-1.2px", fontFamily: "'DM Sans', sans-serif" }}>
          {visible ? value : typeof value === "number" ? 0 : "—"}
        </div>
        {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, fontWeight: 600 }}>{sub}</div>}
        <div style={{ marginTop: 10, width: "52%", height: 4, borderRadius: 999, background: `${accent}33` }} />
      </div>
    </div>
  );
};

/** Draws "NN%" on each non-zero pie slice (same pattern as technician dashboard). */
const pieSlicePercentPlugin: Plugin<"pie"> = {
  id: "pieSlicePercentLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const datasetValues = (dataset?.data ?? []) as number[];
    const total = datasetValues.reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total <= 0) return;
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((element: unknown, i: number) => {
      const sliceValue = Number(datasetValues[i]) || 0;
      if (sliceValue <= 0) return;
      const percent = Math.round((sliceValue / total) * 100);
      const arcElement = element as { tooltipPosition?: () => { x: number; y: number } };
      if (typeof arcElement.tooltipPosition !== "function") return;
      const { x, y } = arcElement.tooltipPosition();
      const label = `${percent}%`;
      ctx.save();
      ctx.font = "bold 12px 'DM Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(15,23,42,0.35)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
      ctx.restore();
    });
  },
};

const PIE_ANIMATION = {
  duration: 850,
  easing: "easeOutCubic" as const,
};

const PIE_ANIMATIONS = {
  radius: { from: 0, duration: 850, easing: "easeOutCubic" as const },
  rotation: { from: -0.5 * Math.PI, duration: 850, easing: "easeOutCubic" as const },
};


// ── Tickets This Week (Mixed Chart.js: bar + line) ───────────────────────────
const WeeklyMixedChart: React.FC<{ weeklyTickets: number[] }> = ({ weeklyTickets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<{ destroy: () => void; update: () => void } | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const bars = weeklyTickets.length === 7
        ? weeklyTickets
        : [...weeklyTickets, ...Array(Math.max(0, 7 - weeklyTickets.length)).fill(0)].slice(0, 7);
      const cumulative = bars.map((_, i) => bars.slice(0, i + 1).reduce((a, b) => a + b, 0));
      chartRef.current = new Chart(canvasRef.current, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Tickets",
              data: bars,
              backgroundColor: "rgba(10,76,134,0.22)",
              borderColor: "#0a4c86",
              borderWidth: 1.5,
              borderRadius: 7,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "Cumulative",
              data: cumulative,
              borderColor: "#f59e0b",
              backgroundColor: "#f59e0b",
              pointRadius: 3.5,
              pointHoverRadius: 6,
              tension: 0.35,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#64748b",
                font: { family: "'DM Sans', sans-serif", size: 11 },
                usePointStyle: true,
              },
            },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#f8fafc",
              bodyColor: "#cbd5e1",
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: "#94a3b8", font: { family: "'DM Sans', sans-serif", size: 10 } },
            },
            y: {
              beginAtZero: true,
              position: "left",
              grid: { color: "#f1f5f9" },
              border: { display: false },
              ticks: { color: "#94a3b8", precision: 0, stepSize: 1 },
            },
            y1: {
              beginAtZero: true,
              position: "right",
              grid: { drawOnChartArea: false },
              border: { display: false },
              ticks: { color: "#f59e0b", precision: 0, stepSize: 1 },
            },
          },
        },
      });
    });
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [weeklyTickets]);
  return <div style={{ position: "relative", width: "100%", height: 220 }}><canvas ref={canvasRef} /></div>;
};

// ── Donut Chart (Chart.js, non-redundant legend with counts) ─────────────────
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void; update: () => void } | null>(null);
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  const legendItems = data.map((item) => ({
    ...item,
    pct: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }));

  useEffect(() => {
    if (!canvasRef.current || total === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        plugins: [pieSlicePercentPlugin],
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            data: data.map(d => d.value),
            backgroundColor: data.map(d => d.color),
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: PIE_ANIMATION,
          animations: PIE_ANIMATIONS,
          cutout: "72%",
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#f8fafc",
              bodyColor: "#cbd5e1",
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.raw) || 0;
                  const p = total > 0 ? Math.round((v / total) * 100) : 0;
                  return ` ${v} (${p}%)`;
                },
              },
            },
          },
        },
      });
      chartRef.current.update();
    });
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, total]);

  if (total === 0) {
    return <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No ticket status data yet.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 1fr) minmax(180px, 1fr)", gap: 16, alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", height: 220, minHeight: 220 }}>
        <canvas ref={canvasRef} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 38, lineHeight: 1, fontWeight: 800, color: "#0a4c86" }}>
              {total > 0 ? Math.round(((legendItems.find(i => i.label === "Resolved")?.value ?? 0) / total) * 100) : 0}%
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
              Uptime
            </div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: "grid", gap: 8 }}>
          {legendItems.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                {item.value} ({item.pct}%)
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          Total: <strong style={{ color: "#0f172a" }}>{total}</strong>
        </div>
      </div>
    </div>
  );
};

// ── Recurring Issue List ───────────────────────────────────────────────────────
const RecurringIssueList: React.FC<{ issueBreakdown: IssueCount[] }> = ({ issueBreakdown }) => {
  const items = issueBreakdown.slice(0, 3);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const iconFor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("network") || t.includes("internet")) return <Wifi size={18} color="#0a4c86" />;
    if (t.includes("password")) return <KeyRound size={18} color="#0a4c86" />;
    if (t.includes("hardware")) return <HardDrive size={18} color="#0a4c86" />;
    return <Wrench size={18} color="#0a4c86" />;
  };
  const barColors = ["#0a4c86", "#8bb8ff", "#7b8396"];
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((item, idx) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <div key={item.type} style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: 12, alignItems: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 9, background: "#f0f7ff", display: "grid", placeItems: "center" }}>
              {iconFor(item.type)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 14, color: "#1f2937", fontWeight: 700 }}>{item.type}</span>
                <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 700 }}>{pct}% Frequency</span>
              </div>
              <div style={{ marginTop: 7, height: 7, borderRadius: 999, background: "#edf2f7", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: barColors[idx] ?? "#0a4c86" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SingleMetricLineChart: React.FC<{ label: string; monthlyValues: number[]; color: string }> = ({ label, monthlyValues, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels: MONTH_LABELS,
          datasets: [{
            label,
            data: monthlyValues,
            backgroundColor: `${color}1f`,
            borderColor: color,
            borderWidth: 2.2,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#f8fafc",
              bodyColor: "#cbd5e1",
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: "#64748b", font: { family: "'DM Sans', sans-serif", size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#f1f5f9" },
              border: { display: false },
              ticks: { color: "#94a3b8", precision: 0, stepSize: 1 },
              suggestedMax: Math.max(5, Math.max(...monthlyValues, 0) + 2),
            },
          },
        },
      });
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [label, monthlyValues, color]);

  return <div style={{ position: "relative", width: "100%", height: 170 }}><canvas ref={canvasRef} /></div>;
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

// ── Top Departments Pie Chart (Chart.js) ─────────────────────────────────────
const DEPT_PALETTE = ["#0a4c86","#7c3aed","#0891b2","#f59e0b","#10b981","#ef4444","#f97316","#8b5cf6","#06b6d4","#84cc16","#e11d48","#14b8a6"];
function getDeptColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_PALETTE[Math.abs(hash) % DEPT_PALETTE.length];
}
const DeptPieChart: React.FC<{ deptRows: DeptRow[] }> = ({ deptRows }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<{ destroy: () => void; update: () => void } | null>(null);
  const totalTickets = deptRows.reduce((sum, dept) => sum + dept.tickets, 0);
  const legendItems = deptRows.map((row) => ({
    label: row.name,
    value: row.tickets,
    color: getDeptColor(row.name),
    pct: totalTickets > 0 ? Math.round((row.tickets / totalTickets) * 100) : 0,
  }));
  useEffect(() => {
    if (!canvasRef.current || deptRows.length === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      chartRef.current = new Chart(canvasRef.current, {
        type: "pie",
        plugins: [pieSlicePercentPlugin],
        data: {
          labels: deptRows.map(d => d.name),
          datasets: [{
            data: deptRows.map(d => d.tickets),
            backgroundColor: deptRows.map(d => getDeptColor(d.name)),
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: PIE_ANIMATION,
          animations: PIE_ANIMATIONS,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#f8fafc",
              bodyColor: "#94a3b8",
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (item) => {
                  const raw = Number(item.raw) || 0;
                  const pct = totalTickets > 0 ? Math.round((raw / totalTickets) * 100) : 0;
                  return ` ${raw} (${pct}%)`;
                },
              },
            },
          },
        },
      });
      chartRef.current.update();
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [deptRows, totalTickets]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr)", gap: 12, alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", height: 240, minHeight: 240 }}><canvas ref={canvasRef} /></div>
      <div>
        <div style={{ display: "grid", gap: 8 }}>
          {legendItems.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                {item.value} ({item.pct}%)
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          Total: <strong style={{ color: "#0f172a" }}>{totalTickets}</strong>
        </div>
      </div>
    </div>
  );
};

// ── Leaderboard helpers ───────────────────────────────────────────────────────
const AVATAR_BG   = ["#fef9c3","#e0e7ff","#d1fae5","#fce7f3","#e0f2fe","#fce7f3","#e0e7ff"];
const AVATAR_TEXT = ["#92400e","#3730a3","#065f46","#9d174d","#0c4a6e","#9d174d","#3730a3"];
function getInitials(name: string): string { return name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase(); }

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
const CardsView: React.FC<{ technicians: TechStat[] }> = ({ technicians }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {technicians.map((tech, i) => {
        const total = tech.resolved + tech.inProgress + tech.pending;
        return (
          <div key={tech.id} style={{
            border: "1px solid #edf2f7",
            borderRadius: 12,
            padding: "14px",
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <TechAvatar tech={tech} index={i} size={44} fontSize={13} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0a4c86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tech.full_name}
                </div>
                <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} size={14} fill={n <= Math.round(tech.avgRating || 0) ? "#f59e0b" : "none"} color={n <= Math.round(tech.avgRating || 0) ? "#f59e0b" : "#cbd5e1"} strokeWidth={n <= Math.round(tech.avgRating || 0) ? 0 : 2} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {[
                { num: tech.resolved,   lbl: "Resolved", col: "#065f46", bg: "#d1fae5" },
                { num: tech.inProgress, lbl: "Active",   col: "#1e40af", bg: "#dbeafe" },
                { num: tech.pending,    lbl: "Pending",  col: "#475569", bg: "#f8fafc" },
              ].map(s => (
                <div key={s.lbl} style={{ flex: 1, background: s.bg, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.col, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: s.col, marginTop: 4, textTransform: "uppercase" }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, textAlign: "right", fontWeight: 600 }}>
              {total} total assigned
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
  accounts:  any[],
  departments: any[],
  technicians: any[],
  ticketFeedbacks: any[],
): DashData {
  const nowYear = new Date().getFullYear();
  const monthlyCount = (rows: any[], key: string): number[] => {
    const counts = Array(12).fill(0);
    rows.forEach((row) => {
      const iso = row?.[key];
      if (!iso) return;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== nowYear) return;
      counts[d.getMonth()] += 1;
    });
    return counts;
  };

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

  const deptRows: DeptRow[] = (departments ?? [])
    .map((dept: any) => ({ name: dept.name, tickets: tickets.filter(t => t.department_id === dept.id).length, repairs: 0 }))
    .filter((d: DeptRow) => d.tickets > 0)
    .sort((a: DeptRow, b: DeptRow) => b.tickets - a.tickets)
    .slice(0, 5);

  // ── Per-technician feedback ───────────────────────────────────────────────
  const techRatingsMap: Record<string, number[]> = {};
  ticketFeedbacks.forEach((feedback: any) => {
    const ticket = tickets.find(t => String(t.id) === String(feedback.report_id));
    if (!ticket) return;
    const assigned: string[] = Array.isArray(ticket.assigned_to)
      ? ticket.assigned_to.map(String)
      : ticket.assigned_to ? [String(ticket.assigned_to)] : [];
    assigned.forEach(techId => {
      if (!techRatingsMap[techId]) techRatingsMap[techId] = [];
      techRatingsMap[techId].push(Number(feedback.rating));
    });
  });

  const techLeaderboard: TechStat[] = (technicians ?? [])
    .map((technician: any) => {
      const techIdStr = String(technician.id);
      const ratings   = techRatingsMap[techIdStr] ?? [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      return {
        id:           technician.id,
        full_name:    technician.full_name,
        avatar_url:   technician.avatar_url ?? "",
        resolved:     tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "Resolved").length,
        inProgress:   tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "In Progress").length,
        pending:      tickets.filter(t => isAssigned(t.assigned_to, techIdStr) && t.status === "Pending").length,
        avgRating:    Math.round(avgRating * 10) / 10,
        totalRatings: ratings.length,
      };
    })
    .sort((a: TechStat, b: TechStat) => b.avgRating - a.avgRating || b.resolved - a.resolved);

  const totalFeedbacks    = ticketFeedbacks.length;
  const avgFeedbackRating = totalFeedbacks > 0
    ? Math.round((ticketFeedbacks.reduce((sum: number, feedback: any) => sum + Number(feedback.rating), 0) / totalFeedbacks) * 10) / 10
    : 0;

  return {
    totalTickets:      tickets.length,
    pendingTickets:    tickets.filter(t => t.status === "Pending").length,
    resolvedTickets:   tickets.filter(t => t.status === "Resolved").length,
    inProgressTickets: tickets.filter(t => t.status === "In Progress").length,
    incomingUnits:     incoming.length,
    outgoingUnits:     outgoing.length,
    activeAccounts:    accounts.filter((a: any) => a.is_active === true).length,
    incomingByMonth:   monthlyCount(incoming, "date_received"),
    outgoingByMonth:   monthlyCount(outgoing, "date_released"),
    accountsByMonth:   monthlyCount(accounts, "created_at"),
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
  const [pieAnimKey, setPieAnimKey] = useState(0);

  const ticketsRef = useRef<any[]>([]);
  const incomingUnitsRef = useRef<any[]>([]);
  const outgoingUnitsRef = useRef<any[]>([]);
  const userAccountsRef = useRef<any[]>([]);
  const departmentsRef = useRef<any[]>([]);
  const techniciansRef = useRef<any[]>([]);
  const ticketFeedbacksRef = useRef<any[]>([]);

  const recomputeRef = useRef<() => void>(() => {});
  recomputeRef.current = () =>
    setData(buildDashData(
      ticketsRef.current,
      incomingUnitsRef.current,
      outgoingUnitsRef.current,
      userAccountsRef.current,
      departmentsRef.current,
      techniciansRef.current,
      ticketFeedbacksRef.current,
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
      { data: accounts },
      { data: departments },
      { data: technicians },
      { data: ticketFeedbacks },
    ] = await Promise.all([
      supabase.from("file_reports").select("status, issue_type, date_submitted, department_id, id, assigned_to"),
      supabase.from("incoming_units").select("id, date_received"),
      supabase.from("outgoing_units").select("id, date_released"),
      supabase.from("user_accounts").select("id, created_at, is_active").eq("is_archived", false),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("user_accounts").select("id, full_name, avatar_url, updated_at").eq("role", "IT Technician").eq("is_active", true).eq("is_archived", false).order("full_name"),
      supabase.from("ticket_feedback").select("id, report_id, rating"),
    ]);
    ticketsRef.current = tickets ?? [];
    incomingUnitsRef.current = incoming ?? [];
    outgoingUnitsRef.current = outgoing ?? [];
    userAccountsRef.current = accounts ?? [];
    departmentsRef.current = departments ?? [];
    techniciansRef.current = (technicians ?? []).map(stampAvatar);
    ticketFeedbacksRef.current = ticketFeedbacks ?? [];
    recomputeRef.current();
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const realtimeChannel = supabase.channel(`dashboard_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "file_reports" },
        ({ new: newRow }) => { ticketsRef.current = upsertById(ticketsRef.current, newRow); recomputeRef.current(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "file_reports" },
        ({ new: updatedRow }) => { ticketsRef.current = upsertById(ticketsRef.current, updatedRow); recomputeRef.current(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "file_reports" },
        ({ old: deletedRow }) => { ticketsRef.current = ticketsRef.current.filter(r => r.id !== (deletedRow as any).id); recomputeRef.current(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_feedback" },
        () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(realtimeChannel); };
  }, [upsertById, load]);

  const handleRefresh = async () => {
    setRefreshed(true);
    setPieAnimKey((k) => k + 1);
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
      <div className="dash-ua-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1rem" }}>
        {[0, 1, 2].map((i) => <PanelSkeleton key={i} height={210} lines={1} />)}
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
    { label: "Assigned",     value: data.pendingTickets,    color: "#f59e0b" },
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
          .dash-ua-grid { grid-template-columns: 1fr !important; }
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
          <KPI label="Assigned"            value={data.pendingTickets}    icon={<Clock size={17} />}           accent="#0a4c86" delay={60}  sub="38 Pending Pickup"      onClick={() => onNavigate("Submit Ticket")} />
          <KPI label="In Progress"        value={data.inProgressTickets} icon={<Activity size={17} />}        accent="#ffd7af" delay={120} sub="Current active"        onClick={() => onNavigate("Submit Ticket")} />
          <KPI
            label="Avg Feedback Rating"
            value={data.totalFeedbacks > 0 ? `${data.avgFeedbackRating} ★` : "—"}
            icon={<Star size={17} />}
            accent="#0a4c86"
            delay={180}
            sub="98% Satisfaction"
          />
          <KPI label="Incoming Units"     value={data.incomingUnits}     icon={<CircleArrowDown size={17} />} accent="#7b8396" delay={240} sub="New Hardware batch"    onClick={() => onNavigate("Incoming Units")} />
          <KPI label="Outgoing Units"     value={data.outgoingUnits}     icon={<CircleArrowUp size={17} />}   accent="#b91c1c" delay={300} sub="Decommissioned"    onClick={() => onNavigate("Outgoing Units")} />
        </div>

        {/* ── Leaderboard ── */}
        <div style={{ ...CARD, marginBottom: "1rem", paddingBottom: "2rem" }}>
          <SectionHeader
            icon={<Trophy size={14} color="#f59e0b" />}
            iconBg="#f59e0b15"
            title="Technician Leaderboard"
            right={<span style={{ fontSize: 12, fontWeight: 700, color: "#0a4c86", cursor: "pointer" }}>View All Performance</span>}
          />
          {data.techLeaderboard.length === 0
            ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No technician data yet.</p>
            : <CardsView technicians={data.techLeaderboard} />}
        </div>

        {/* ── Mid row ── */}
        <div className="dash-mid-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1rem", marginBottom: "1rem" }}>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<BarChart3 size={14} color="#0a4c86" />}
              iconBg="#0a4c8615"
              title="Ticket Status"
            />
            <DonutChart key={`admin-status-pie-${pieAnimKey}`} data={donutData} />
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<Activity size={14} color="#0a4c86" />}
              iconBg="#0a4c8615"
              title="Tickets This Week"
              right={<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Last 7 days</span>}
            />
            <WeeklyMixedChart weeklyTickets={data.weeklyTickets} />
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
              : <RecurringIssueList issueBreakdown={data.issueBreakdown} />}
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
              : <DeptPieChart key={`admin-dept-pie-${pieAnimKey}`} deptRows={data.deptRows} />}
          </div>
        </div>

        <div className="dash-ua-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ ...CARD }}>
            <SectionHeader icon={<CircleArrowDown size={14} color="#8b5cf6" />} iconBg="#8b5cf615" title="Incoming Units" />
            <SingleMetricLineChart label="Incoming Units" monthlyValues={data.incomingByMonth} color="#8b5cf6" />
          </div>
          <div style={{ ...CARD }}>
            <SectionHeader icon={<CircleArrowUp size={14} color="#10b981" />} iconBg="#10b98115" title="Outgoing Units" />
            <SingleMetricLineChart label="Outgoing Units" monthlyValues={data.outgoingByMonth} color="#10b981" />
          </div>
          <div style={{ ...CARD }}>
            <SectionHeader icon={<Users size={14} color="#0a4c86" />} iconBg="#0a4c8615" title="Accounts" subtitle="Active users" />
            <SingleMetricLineChart label="Accounts" monthlyValues={data.accountsByMonth} color="#0a4c86" />
          </div>
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
  const [myTicketsBadgeCount, setMyTicketsBadgeCount] = useState(0);

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
    const unassignedPendingCount = (data ?? []).filter((row: { assigned_to: unknown }) => {
      const a = row.assigned_to;
      const arr = Array.isArray(a) ? a : [];
      return arr.length === 0;
    }).length;
    setAssignJobBadgeCount(unassignedPendingCount);
  }, [userRole]);

  /** Open (non-resolved) tickets assigned to this technician — matches My Tickets list. */
  const refreshMyTicketsBadge = useCallback(async () => {
    if (userRole !== "IT Technician" || !userId) {
      setMyTicketsBadgeCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("file_reports")
      .select("id", { count: "exact", head: true })
      .contains("assigned_to", [userId])
      .not("status", "eq", "Resolved");
    if (error) return;
    setMyTicketsBadgeCount(count ?? 0);
  }, [userRole, userId]);

  useEffect(() => {
    void refreshAssignJobPendingBadge();
  }, [refreshAssignJobPendingBadge]);

  useEffect(() => {
    void refreshMyTicketsBadge();
  }, [refreshMyTicketsBadge]);

  useEffect(() => {
    if (userRole !== "Administrator" && userRole !== "IT Technician") return;
    const navBadgesChannel = supabase
      .channel(`adm_nav_badges_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_reports" },
        () => {
          void refreshAssignJobPendingBadge();
          void refreshMyTicketsBadge();
        }
      )
      .subscribe();
    const handleBadgesChangedEvent = () => {
      void refreshAssignJobPendingBadge();
      void refreshMyTicketsBadge();
    };
    window.addEventListener(NAV_BADGES_CHANGED_EVENT, handleBadgesChangedEvent);
    return () => {
      window.removeEventListener(NAV_BADGES_CHANGED_EVENT, handleBadgesChangedEvent);
      void supabase.removeChannel(navBadgesChannel);
    };
  }, [userRole, refreshAssignJobPendingBadge, refreshMyTicketsBadge]);

  useEffect(() => {
    const sessionToken  = localStorage.getItem("session_token");
    const sessionRole   = localStorage.getItem("session_user_role") || "";
    const isAllowedRole = sessionRole === "Administrator" || sessionRole === "IT Technician" || sessionRole === "Employee";
    if (!sessionToken || !isAllowedRole) {
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
      case "Users":       return isAdmin ? <UserAccounts /> : dashHomeNode.current;
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
          badgeByLabel={
            isAdmin
              ? { "Assign Job": assignJobBadgeCount }
              : isTechnician
                ? { "My Tickets": myTicketsBadgeCount }
                : undefined
          }
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