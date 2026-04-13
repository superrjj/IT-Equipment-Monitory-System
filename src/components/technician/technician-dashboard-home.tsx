import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { Plugin } from "chart.js";
import {
  Ticket, Clock, CheckCircle2, CircleDot,
  RefreshCw, ArrowUpRight, Trophy, Activity,
  TrendingUp, Zap, Star,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";
import { supabase } from "../../lib/supabaseClient";

const BRAND = "#0a4c86";

// ── Types ─────────────────────────────────────────────────────────────────────
type TechStat = {
  id: string;
  full_name: string;
  avatar_url: string;
  resolved: number;
  inProgress: number;
  assigned: number;
  avgRating: number;
  totalRatings: number;
};

// ── Skeleton primitives ───────────────────────────────────────────────────────
const Skeleton: React.FC<{
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = 14, radius = 6, style = {} }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "skShimmer 1.4s ease infinite",
      flexShrink: 0,
      ...style,
    }}
  />
);

// ── KPI Skeleton card ─────────────────────────────────────────────────────────
const KpiSkeleton: React.FC = () => (
  <div
    style={{
      background: "#fff",
      borderRadius: 16,
      padding: "1rem 1.1rem 0.9rem",
      border: "1px solid #e8edf2",
      boxShadow: "0 2px 8px rgba(10,76,134,0.07)",
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#e2e8f0", borderRadius: "16px 16px 0 0" }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
      <Skeleton width={30} height={30} radius={8} />
      <Skeleton width={13} height={13} radius={4} />
    </div>
    <Skeleton width="55%" height={32} radius={6} style={{ marginBottom: 8 }} />
    <Skeleton width="70%" height={10} radius={4} style={{ marginBottom: 4 }} />
    <Skeleton width="50%" height={10} radius={4} />
  </div>
);

// ── Panel skeleton (generic card shell) ───────────────────────────────────────
const PanelSkeleton: React.FC<{
  height?: number;
  style?: React.CSSProperties;
  lines?: number;
}> = ({ height = 200, style = {}, lines = 3 }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 16,
      padding: "1.1rem",
      border: "1px solid #e8edf2",
      boxShadow: "0 2px 8px rgba(10,76,134,0.07)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: height,
      ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Skeleton width={26} height={26} radius={7} />
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
  <div
    style={{
      border: "1px solid #e8edf2",
      borderRadius: 16,
      padding: "14px 16px",
      background: "#fff",
      boxShadow: "0 1px 6px rgba(10,76,134,0.04)",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
      <Skeleton width={28} height={18} radius={999} />
      <Skeleton width={22} height={22} radius={6} />
    </div>
    <Skeleton width={40} height={40} radius={999} style={{ marginBottom: 8 }} />
    <Skeleton width="75%" height={13} radius={5} style={{ marginBottom: 6 }} />
    <Skeleton width="50%" height={18} radius={999} style={{ marginBottom: 10 }} />
    <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
      {[0, 1, 2].map(i => (
        <Skeleton key={i} width="33%" height={42} radius={8} />
      ))}
    </div>
    <Skeleton width="90%" height={8} radius={4} style={{ marginBottom: 6 }} />
    <Skeleton width="100%" height={4} radius={999} style={{ marginBottom: 6 }} />
    <Skeleton width="35%" height={8} radius={4} style={{ marginLeft: "auto" }} />
  </div>
);

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

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_BG   = ["#fef9c3","#e0e7ff","#d1fae5","#fce7f3","#e0f2fe","#fce7f3","#e0e7ff"];
const AVATAR_TEXT = ["#92400e","#3730a3","#065f46","#9d174d","#0c4a6e","#9d174d","#3730a3"];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function getPerformanceBadge(avgRating: number, rank: number) {
  if (rank === 0 && avgRating > 0) return { label: "Top rated",        color: "#92400e", bg: "#fef9c3" };
  if (avgRating >= 4.5)            return { label: "Excellent",         color: "#065f46", bg: "#d1fae5" };
  if (avgRating >= 4.0)            return { label: "Great",             color: "#1e40af", bg: "#dbeafe" };
  if (avgRating >= 3.0)            return { label: "Good",              color: "#475569", bg: "#f1f5f9" };
  if (avgRating > 0)               return { label: "Needs improvement", color: "#92400e", bg: "#fef3c7" };
  return                                  { label: "No ratings yet",    color: "#94a3b8", bg: "#f8fafc" };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: number; sub: string;
  icon: React.ReactNode; accent: string;
  delay?: number; animKey?: number; onClick?: () => void;
}> = ({ label, value, sub, icon, accent, delay = 0, animKey = 0, onClick }) => {
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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff", borderRadius: 16,
        padding: "1rem 1.1rem 0.9rem",
        border: `1px solid ${hovered ? accent + "40" : "#e8edf2"}`,
        position: "relative", overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms, box-shadow 0.2s, border-color 0.2s`,
        boxShadow: hovered ? `0 4px 18px ${accent}14` : "0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "16px 16px 0 0" }} />
      <div style={{ position: "absolute", top: 10, right: 12, color: accent, opacity: hovered ? 0.12 : 0.06, transition: "opacity 0.2s", transform: "scale(2.2)", transformOrigin: "top right", pointerEvents: "none" }}>
        {icon}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}13`, display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>
          {icon}
        </div>
        <ArrowUpRight size={13} color={hovered ? accent : "#d1d5db"} style={{ transition: "color 0.2s, transform 0.2s", transform: hovered ? "translate(1px,-1px)" : "none" }} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-1px", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
        {displayed}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.09em" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
    </div>
  );
};

/** Mon–Thu only (excludes Fri–Sun). Segment colors aligned with Chart.js sample palettes. */
const WORKWEEK_LABELS = ["Mon", "Tue", "Wed", "Thu"];
const WORKWEEK_POLAR_BG = [
  "rgba(255, 99, 132, 0.55)",
  "rgba(255, 159, 64, 0.55)",
  "rgba(255, 205, 86, 0.55)",
  "rgba(75, 192, 192, 0.55)",
];
const WORKWEEK_POLAR_BORDER = [
  "rgb(255, 99, 132)",
  "rgb(255, 159, 64)",
  "rgb(255, 205, 86)",
  "rgb(75, 192, 192)",
];

/** Chart.js polar area — ticket count Mon–Thu (`date_submitted`, local calendar day). */
const WeeklyActivityPolarChart: React.FC<{ tickets: any[] }> = ({ tickets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);

  const dayCounts = useMemo(() => {
    const full = Array(7).fill(0) as number[];
    tickets.forEach((t: any) => {
      if (!t.date_submitted) return;
      full[new Date(t.date_submitted).getDay()]++;
    });
    return [full[1], full[2], full[3], full[4]];
  }, [tickets]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;

      chartRef.current = new Chart(canvasRef.current, {
        type: "polarArea",
        data: {
          labels: WORKWEEK_LABELS,
          datasets: [{
            label: "Tickets",
            data: dayCounts,
            backgroundColor: WORKWEEK_POLAR_BG,
            borderColor: WORKWEEK_POLAR_BORDER,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                padding: 10,
                font: { size: 10, family: "'DM Sans',sans-serif" },
                color: "#64748b",
              },
            },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#f8fafc",
              bodyColor: "#cbd5e1",
              padding: 8,
              cornerRadius: 8,
              callbacks: {
                label: (item) => ` ${item.raw} ticket${Number(item.raw) !== 1 ? "s" : ""}`,
              },
            },
          },
          scales: {
            r: {
              beginAtZero: true,
              angleLines: { color: "rgba(148, 163, 184, 0.25)" },
              grid: { color: "rgba(148, 163, 184, 0.2)" },
              pointLabels: {
                display: true,
                font: { size: 11, weight: "bold", family: "'DM Sans',sans-serif" },
                color: "#64748b",
              },
              ticks: {
                display: true,
                backdropColor: "transparent",
                font: { size: 9, family: "'DM Sans',sans-serif" },
                color: "#94a3b8",
                precision: 0,
              },
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
  }, [tickets, dayCounts]);

  return (
    <div style={{ position: "relative", width: "100%", height: 240 }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

const STATUS_COLORS = { assigned: "#f59e0b", inProg: "#3b82f6", resolved: "#10b981" };

/** Draws "NN%" on each non-zero pie slice (Chart.js plugin). */
const pieSlicePercentPlugin: Plugin<"pie"> = {
  id: "pieSlicePercentLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const ds = chart.data.datasets[0];
    const data = (ds?.data ?? []) as number[];
    const total = data.reduce((a, b) => a + (Number(b) || 0), 0);
    if (total <= 0) return;

    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((element: unknown, i: number) => {
      const raw = Number(data[i]) || 0;
      if (raw <= 0) return;
      const pct = Math.round((raw / total) * 100);
      const arc = element as { tooltipPosition?: () => { x: number; y: number } };
      if (typeof arc.tooltipPosition !== "function") return;
      const { x, y } = arc.tooltipPosition();
      const label = `${pct}%`;
      ctx.save();
      ctx.font = "bold 13px 'DM Sans', system-ui, sans-serif";
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

/** Chart.js pie — My Ticket Status with % on each slice. */
const TicketStatusPieChart: React.FC<{
  assigned: number; inProg: number; resolved: number;
}> = ({ assigned, inProg, resolved }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const total = assigned + inProg + resolved;
  const legendItems = [
    { label: "Assigned", value: assigned, color: STATUS_COLORS.assigned },
    { label: "In Progress", value: inProg, color: STATUS_COLORS.inProg },
    { label: "Resolved", value: resolved, color: STATUS_COLORS.resolved },
  ];

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      if (total === 0) return;

      chartRef.current = new Chart(canvasRef.current, {
        type: "pie",
        plugins: [pieSlicePercentPlugin],
        data: {
          labels: ["Assigned", "In Progress", "Resolved"],
          datasets: [{
            data: [assigned, inProg, resolved],
            backgroundColor: [STATUS_COLORS.assigned, STATUS_COLORS.inProg, STATUS_COLORS.resolved],
            borderWidth: 2,
            borderColor: "#fff",
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 4 },
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
                  const sum = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const p = sum > 0 ? Math.round((v / sum) * 100) : 0;
                  return ` ${v} (${p}%)`;
                },
              },
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
  }, [assigned, inProg, resolved, total]);

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "1.2rem 0", color: "#94a3b8", fontSize: 12 }}>No tickets assigned yet.</div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr)", gap: 12, alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", height: 230, minHeight: 230 }}>
        <canvas ref={canvasRef} />
      </div>
      <div>
        <div style={{ display: "grid", gap: 8 }}>
          {legendItems.map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                  {item.value} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#94a3b8" }}>
          Total: <strong style={{ color: "#0f172a" }}>{total}</strong>
        </div>
      </div>
    </div>
  );
};

/** Chart.js pie — Breakdown (same three slices). */
const BreakdownPieChart: React.FC<{
  assigned: number; inProg: number; resolved: number;
}> = ({ assigned, inProg, resolved }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const total = assigned + inProg + resolved;

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      if (total === 0) return;

      chartRef.current = new Chart(canvasRef.current, {
        type: "pie",
        plugins: [pieSlicePercentPlugin],
        data: {
          labels: ["Assigned", "In Progress", "Resolved"],
          datasets: [{
            data: [assigned, inProg, resolved],
            backgroundColor: [STATUS_COLORS.assigned, STATUS_COLORS.inProg, STATUS_COLORS.resolved],
            borderWidth: 2,
            borderColor: "#fff",
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 6 },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                font: { family: "'DM Sans',sans-serif", size: 11 },
                color: "#475569",
                padding: 12,
                usePointStyle: true,
                generateLabels: (chart) => {
                  const labels = chart.data.labels ?? [];
                  const ds = chart.data.datasets?.[0];
                  const vals = (ds?.data ?? []) as number[];
                  const sum = vals.reduce((a, b) => a + (Number(b) || 0), 0);
                  return labels.map((raw, i) => {
                    const v = Number(vals[i]) || 0;
                    const p = sum > 0 ? Math.round((v / sum) * 100) : 0;
                    const color = Array.isArray(ds?.backgroundColor) ? String(ds.backgroundColor[i]) : String(ds?.backgroundColor ?? "#64748b");
                    return {
                      text: `${String(raw)}: ${v} (${p}%)`,
                      fillStyle: color,
                      strokeStyle: color,
                      pointStyle: "circle" as const,
                      hidden: false,
                      index: i,
                    };
                  });
                },
              },
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
                  const sum = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const pct = sum > 0 ? Math.round((v / sum) * 100) : 0;
                  return ` ${v} (${pct}%)`;
                },
              },
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
  }, [assigned, inProg, resolved, total]);

  if (total === 0) return null;

  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: 220, maxWidth: 320, margin: "0 auto" }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
        Total: <strong style={{ color: "#0f172a" }}>{total}</strong>
      </div>
    </div>
  );
};

// ── Leaderboard Cards ─────────────────────────────────────────────────────────
const LeaderboardCards: React.FC<{ techs: TechStat[]; currentUserId: string }> = ({ techs, currentUserId }) => {
  const medals = ["🥇", "🥈", "🥉"];

  if (techs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#94a3b8", fontSize: 13 }}>
        No technician data yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {techs.map((tech, i) => {
        const badge   = getPerformanceBadge(tech.avgRating, i);
        const isFirst = i === 0;
        const isMe    = tech.id === currentUserId;
        const total   = tech.resolved + tech.inProgress + tech.assigned;
        const bg      = AVATAR_BG[i]   ?? "#f1f5f9";
        const textCol = AVATAR_TEXT[i] ?? "#475569";

        return (
          <div
            key={tech.id}
            style={{
              border: isMe
                ? `1.5px solid ${BRAND}50`
                : `1px solid ${isFirst ? "#fde68a" : "#e8edf5"}`,
              borderRadius: 14,
              padding: "16px 18px",
              background: isMe ? `${BRAND}05` : isFirst ? "#fffbeb" : "#ffffff",
              position: "relative",
              boxShadow: isFirst
                ? "0 2px 12px rgba(251,191,36,0.14)"
                : isMe
                ? `0 2px 12px ${BRAND}10`
                : "0 2px 12px rgba(10,76,134,0.06)",
            }}
          >
            {/* Rank medal + ME badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, minHeight: 24 }}>
              {isMe ? (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: BRAND, color: "#fff", letterSpacing: "0.10em" }}>ME</span>
              ) : (
                <span />
              )}
              <span style={{ fontSize: i < 3 ? 18 : 12, fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}>
                {medals[i] ?? `#${i + 1}`}
              </span>
            </div>

            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: bg, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: textCol,
              border: isFirst ? "2px solid #fbbf24" : isMe ? `2px solid ${BRAND}` : "1.5px solid rgba(0,0,0,0.06)",
              marginBottom: 10,
            }}>
              {tech.avatar_url ? (
                <img
                  src={tech.avatar_url}
                  alt={tech.full_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : getInitials(tech.full_name)}
            </div>

            {/* Name */}
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {tech.full_name}
            </div>

            {/* Performance badge */}
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color: badge.color, background: badge.bg, display: "inline-block", marginBottom: 12 }}>
              {badge.label}
            </span>

            {/* Stat trio */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { num: tech.resolved,   lbl: "Resolved", col: "#065f46", bg: "#d1fae5" },
                { num: tech.inProgress, lbl: "Active",   col: "#1e40af", bg: "#dbeafe" },
                { num: tech.assigned,    lbl: "Assigned",  col: "#92400e", bg: "#fef3c7" },
              ].map(s => (
                <div key={s.lbl} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: "7px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: s.col, marginTop: 3, opacity: 0.75 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* User feedback section */}
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
                    <div style={{
                      height: "100%",
                      width: `${(tech.avgRating / 5) * 100}%`,
                      background: isFirst
                        ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                        : isMe
                        ? `linear-gradient(90deg,${BRAND},#3b82f6)`
                        : "linear-gradient(90deg,#7c3aed,#a78bfa)",
                      borderRadius: 99,
                      transition: "width 0.6s ease",
                    }} />
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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Chart.js line — ticket count per calendar month for selected year (by `date_submitted`). */
const MonthlyVolumeLineChart: React.FC<{ tickets: any[] }> = ({ tickets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const currentY = new Date().getFullYear();
  const [year, setYear] = useState(currentY);

  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    tickets.forEach((t: any) => {
      if (!t.date_submitted) return;
      const d = new Date(t.date_submitted);
      if (d.getFullYear() !== year) return;
      counts[d.getMonth()]++;
    });
    return counts;
  }, [tickets, year]);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentY);
    ys.add(currentY - 1);
    ys.add(currentY - 2);
    tickets.forEach((t: any) => {
      if (!t.date_submitted) return;
      ys.add(new Date(t.date_submitted).getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [tickets, currentY]);

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
          labels: MONTH_SHORT,
          datasets: [{
            label: "Tickets",
            data: monthCounts,
            borderColor: BRAND,
            backgroundColor: "rgba(10,76,134,0.08)",
            pointBackgroundColor: BRAND,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.35,
            borderWidth: 2,
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
              padding: 8,
              cornerRadius: 8,
              callbacks: {
                title: (items) => {
                  const i = items[0]?.dataIndex ?? 0;
                  return `${MONTH_SHORT[i]} ${year}`;
                },
                label: (item) => ` ${item.raw} ticket${Number(item.raw) !== 1 ? "s" : ""}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { font: { size: 10, family: "'DM Sans',sans-serif" }, color: "#94a3b8", maxRotation: 0 },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#f1f5f9" },
              border: { display: false },
              ticks: { font: { size: 10, family: "'DM Sans',sans-serif" }, color: "#94a3b8", precision: 0, stepSize: 1 },
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
  }, [tickets, year, monthCounts]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }} htmlFor="tdb-volume-year">Year</label>
        <select
          id="tdb-volume-year"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#0f172a",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            fontFamily: "'DM Sans',sans-serif",
            cursor: "pointer",
          }}
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const TechnicianDashboardHome: React.FC = () => {
  const userId = getSessionUserId();

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [animKey, setAnimKey]         = useState(0);
  const [myTickets, setMyTickets]     = useState<any[]>([]);
  const [tickets, setTickets]         = useState({ total: 0, assigned: 0, inProg: 0, resolved: 0 });
  const [leaderboard, setLeaderboard] = useState<TechStat[]>([]);

  const stampAvatar = (t: any) => ({
    ...t,
    avatar_url: t.avatar_url
      ? `${t.avatar_url}?t=${encodeURIComponent(String(t.updated_at ?? ""))}`
      : "",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) { setLoading(false); return; }
    if (isRefresh) setTickets({ total: 0, assigned: 0, inProg: 0, resolved: 0 });

    try {
      const [
        { data: myTix,     error: e1 },
        { data: allTix,    error: e2 },
        { data: techs,     error: e3 },
        { data: feedbacks, error: e4 },
      ] = await Promise.all([
        supabase.from("file_reports").select("id, status, date_submitted").contains("assigned_to", [userId]),
        supabase.from("file_reports").select("id, status, assigned_to, date_submitted"),
        supabase.from("user_accounts")
          .select("id, full_name, avatar_url, updated_at")
          .eq("role", "IT Technician")
          .eq("is_active", true)
          .eq("is_archived", false)
          .order("full_name"),
        supabase.from("ticket_feedback").select("report_id, rating"),
      ]);

      if (e1) console.error("myTix query error:", e1);
      if (e2) console.error("allTix query error:", e2);
      if (e3) console.error("techs query error:", e3);
      if (e4) console.error("feedbacks query error:", e4);

      const feedbackList      = feedbacks ?? [];

      const t = myTix ?? [];
      setMyTickets(t);
      setTickets({
        total:    t.length,
        assigned: t.filter((x: any) => x.status === "Assigned").length,
        inProg:   t.filter((x: any) => x.status === "In Progress").length,
        resolved: t.filter((x: any) => x.status === "Resolved").length,
      });

      const techRatingsMap: Record<string, number[]> = {};
      feedbackList.forEach((fb: any) => {
        const ticket = (allTix ?? []).find((tk: any) => String(tk.id) === String(fb.report_id));
        if (!ticket) return;
        const assigned: string[] = Array.isArray(ticket.assigned_to)
          ? ticket.assigned_to.map(String)
          : ticket.assigned_to ? [String(ticket.assigned_to)] : [];
        assigned.forEach(techId => {
          if (!techRatingsMap[techId]) techRatingsMap[techId] = [];
          techRatingsMap[techId].push(Number(fb.rating));
        });
      });

      const isAssigned = (assignedTo: any, techId: string) => {
        if (!assignedTo) return false;
        if (Array.isArray(assignedTo)) return assignedTo.map(String).includes(techId);
        return String(assignedTo) === techId;
      };

      const board: TechStat[] = (techs ?? [])
        .map(stampAvatar)
        .map((tech: any) => {
          const techTickets = (allTix ?? []).filter((x: any) => isAssigned(x.assigned_to, String(tech.id)));
          const ratings     = techRatingsMap[String(tech.id)] ?? [];
          const avgRating   = ratings.length > 0
            ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
            : 0;
          return {
            id:           tech.id,
            full_name:    tech.full_name,
            avatar_url:   tech.avatar_url ?? "",
            resolved:     techTickets.filter((x: any) => x.status === "Resolved").length,
            inProgress:   techTickets.filter((x: any) => x.status === "In Progress").length,
            assigned:     techTickets.filter((x: any) => x.status === "Assigned").length,
            avgRating:    Math.round(avgRating * 10) / 10,
            totalRatings: ratings.length,
          };
        })
        .sort((a: TechStat, b: TechStat) => b.avgRating - a.avgRating || b.resolved - a.resolved);

      setLeaderboard(board);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`technician_dashboard_v2_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" },    () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_accounts" },   () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_feedback" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(id);
  }, [load]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setAnimKey(k => k + 1);
    await load(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const resolveRate = tickets.total > 0 ? Math.round((tickets.resolved / tickets.total) * 100) : 0;
  const myRank      = leaderboard.findIndex(t => t.id === userId);

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
        @keyframes skShimmer  { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
        .tdb2-in { animation: tdb2-up 0.35s ease both; }
        .tdb2-refresh:hover { background: #f1f5f9 !important; }
        @media(max-width:900px){
          .tdb2-mid { grid-template-columns: 1fr !important; }
          .tdb2-bot { grid-template-columns: 1fr !important; }
        }
        @media(max-width:640px){
          .tdb2-kpi { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media(max-width:400px){
          .tdb2-kpi { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="tdb2" style={{ fontFamily: "'DM Sans', sans-serif", color: "#0f172a", paddingRight: 4, paddingTop: "1.2rem" }}>

        {/* Refresh button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button
            className="tdb2-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0.45rem 0.9rem", borderRadius: 10,
              border: "1px solid #e8edf2", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              fontSize: 12, fontWeight: 600, color: "#475569",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              transition: "background 0.15s",
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "tdb2-spin 0.6s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* ══════════════ SKELETON STATE ══════════════ */}
        {loading ? (
          <>
            <div
              className="tdb2-kpi"
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.7rem", marginBottom: "0.85rem" }}
            >
              {[0, 1, 2, 3].map(d => <KpiSkeleton key={d} />)}
            </div>

            <div
              className="tdb2-mid"
              style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.85rem", marginBottom: "0.85rem" }}
            >
              <PanelSkeleton height={200} lines={3} />
              <PanelSkeleton height={200} lines={2} />
            </div>

            <div
              className="tdb2-bot"
              style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.85rem", marginBottom: "0.85rem" }}
            >
              <PanelSkeleton height={220} lines={2} />
              <PanelSkeleton height={220} lines={4} />
            </div>

            <div style={{
              background: "#fff", borderRadius: 16, padding: "1.1rem",
              border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(10,76,134,0.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
                <Skeleton width={26} height={26} radius={7} />
                <Skeleton width="30%" height={14} radius={5} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {[0, 1, 2, 3, 4].map(d => <LeaderboardCardSkeleton key={d} />)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ══════════════ KPI Row ══════════════ */}
            <div
              className="tdb2-in tdb2-kpi"
              style={{ animationDelay: "50ms", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.7rem", marginBottom: "0.85rem" }}
            >
              <KpiCard label="My Tickets"  value={tickets.total}    sub="Assigned to you"  icon={<Ticket size={15} />}       accent={BRAND}   delay={0}   animKey={animKey} />
              <KpiCard label="Assigned"     value={tickets.assigned}  sub="Awaiting action"  icon={<Clock size={15} />}         accent="#f59e0b" delay={50}  animKey={animKey} />
              <KpiCard label="In Progress" value={tickets.inProg}   sub="Currently active" icon={<CircleDot size={15} />}     accent="#3b82f6" delay={100} animKey={animKey} />
              <KpiCard label="Resolved"    value={tickets.resolved} sub="Closed tickets"   icon={<CheckCircle2 size={15} />}  accent="#10b981" delay={150} animKey={animKey} />
            </div>

            {/* ══════════════ Mid row ══════════════ */}
            <div
              className="tdb2-in tdb2-mid"
              style={{ animationDelay: "100ms", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.85rem", marginBottom: "0.85rem" }}
            >
              <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem", border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "1rem" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${BRAND}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={13} color={BRAND} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>My Ticket Status</span>
                </div>
                <TicketStatusPieChart assigned={tickets.assigned} inProg={tickets.inProg} resolved={tickets.resolved} />
              </div>

              <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem", border: "1px solid #e8edf5", boxShadow: "0 2px 10px rgba(10,76,134,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#f59e0b12", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={13} color="#f59e0b" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Activity by Day of Week</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Mon – Thu</span>
                </div>
                <WeeklyActivityPolarChart tickets={myTickets} />
              </div>
            </div>

            {/* ══════════════ Bottom row ══════════════ */}
            <div
              className="tdb2-in tdb2-bot"
              style={{ animationDelay: "140ms", display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.85rem", marginBottom: "0.85rem" }}
            >
              <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem", border: "1px solid #e8edf5", boxShadow: "0 2px 10px rgba(10,76,134,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#10b98112", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TrendingUp size={13} color="#10b981" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Ticket Volume</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>By month · year</span>
                </div>
                <MonthlyVolumeLineChart tickets={myTickets} />
              </div>

              <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem", border: "1px solid #e8edf5", boxShadow: "0 2px 10px rgba(10,76,134,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `${BRAND}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Ticket size={13} color={BRAND} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Breakdown</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                    color:      resolveRate >= 70 ? "#10b981" : resolveRate >= 40 ? "#d97706" : "#ef4444",
                    background: resolveRate >= 70 ? "rgba(16,185,129,0.08)" : resolveRate >= 40 ? "rgba(217,119,6,0.08)" : "rgba(239,68,68,0.08)",
                  }}>
                    {resolveRate}% resolved
                  </span>
                </div>

                {tickets.total > 0 ? (
                  <>
                    <div style={{ marginBottom: "0.85rem" }}>
                      <BreakdownPieChart assigned={tickets.assigned} inProg={tickets.inProg} resolved={tickets.resolved} />
                    </div>
                    <div style={{ display: "flex", gap: "1.2rem", paddingTop: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
                      {[
                        { label: "Total",    value: tickets.total,                    color: BRAND     },
                        { label: "Open",     value: tickets.assigned + tickets.inProg, color: "#f59e0b" },
                        { label: "Resolved", value: tickets.resolved,                 color: "#10b981" },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 1 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "1.2rem 0", color: "#94a3b8", fontSize: 12 }}>No tickets assigned yet.</div>
                )}
              </div>
            </div>

            {/* ══════════════ Leaderboard ══════════════ */}
            <div
              className="tdb2-in"
              style={{ animationDelay: "180ms", background: "#fff", borderRadius: 16, padding: "1.1rem", border: "1px solid #e8edf5", boxShadow: "0 2px 10px rgba(10,76,134,0.04)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "#f59e0b12", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trophy size={13} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>IT Technician Leaderboard</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Ranked by avg. rating · resolved tickets</div>
                  </div>
                </div>
                {myRank >= 0 && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999,
                    background: `${BRAND}10`, color: BRAND, border: `1px solid ${BRAND}25`,
                  }}>
                    Your rank: #{myRank + 1}
                  </div>
                )}
              </div>
              <LeaderboardCards techs={leaderboard} currentUserId={userId} />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default TechnicianDashboardHome;