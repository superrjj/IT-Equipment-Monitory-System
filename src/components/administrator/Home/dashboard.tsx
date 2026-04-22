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
  Ticket,
  CircleArrowDown,
  CircleArrowUp,
  TrendingUp,
  Activity,
  BarChart3,
  AlertTriangle,
  Trophy,
  Star,
  Wifi,
  KeyRound,
  HardDrive,
  Wrench,
  Users,
  Timer,
  CheckCircle2,
  Clock,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  CheckCheck,
  ChevronDown,
  X,
} from "lucide-react";

// ── Shared card style ─────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e8edf5",
  boxShadow:
    "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.05), 0 0 0 1px rgba(10,76,134,0.04)",
  padding: "1.3rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type IssueCount = { type: string; count: number };
type DeptRow = { name: string; tickets: number };
type TechStat = {
  id: string;
  full_name: string;
  avatar_url: string;
  resolved: number;
  inProgress: number;
  pending: number;
  avgRating: number;
  totalRatings: number;
};
// ── Activity Log Row (from activity_log table) ────────────────────────────────
type ActivityLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string | null; avatar_url: string | null } | null;
  ticket?: { ticket_number: string | null } | null;
};

type DashData = {
  totalTickets: number;
  pendingTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  incomingUnits: number;
  outgoingUnits: number;
  activeAccounts: number;
  avgFeedbackRating: number;
  totalFeedbacks: number;
  issueBreakdown: IssueCount[];
  deptRows: DeptRow[];
  weeklyTickets: number[];
  techLeaderboard: TechStat[];
  avgResponseTimeHours: number;
  avgResponseTimeTrend: number;
  firstContactResolutionPct: number;
  firstContactResolutionTrend: number;
  ticketsClosedThisWeek: number;
  ticketsClosedTrend: number;
  reopenedTickets: number;
  reopenedTrend: number;
  slaCompliancePct: number;
  slaComplianceTrend: number;
};

function isAssigned(assignedTo: unknown, techId: string): boolean {
  if (!assignedTo) return false;
  if (Array.isArray(assignedTo))
    return (assignedTo as unknown[]).map(String).includes(String(techId));
  return String(assignedTo) === String(techId);
}

const KPI_LINK_COLOR = "#2563eb";

// ── Dropdown Filter ───────────────────────────────────────────────────────────
type DropdownOption = { label: string; value: string };

const FilterDropdown: React.FC<{
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (val: string) => void;
}> = ({ label: _label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6b7280",
          background: open ? "#e5e7eb" : "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: 999,
          padding: "2px 9px",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          transition: "background 0.15s",
        }}
      >
        {selected?.label ?? "Filter"}
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 100,
            minWidth: 150,
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: opt.value === value ? 700 : 500,
                color: opt.value === value ? "#0a4c86" : "#374151",
                background: opt.value === value ? "#eff6ff" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
              onMouseLeave={(e) => { if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Full Leaderboard Modal ────────────────────────────────────────────────────
const AVATAR_BG = ["#fef9c3", "#e0e7ff", "#d1fae5", "#fce7f3", "#e0f2fe", "#fce7f3", "#e0e7ff"];
const AVATAR_TEXT = ["#92400e", "#3730a3", "#065f46", "#9d174d", "#0c4a6e", "#9d174d", "#3730a3"];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const TechAvatar: React.FC<{ tech: TechStat; index: number; size?: number; fontSize?: number }> = ({
  tech, index, size = 38, fontSize = 12,
}) => {
  const bg = AVATAR_BG[index % AVATAR_BG.length] ?? "#f1f5f9";
  const text = AVATAR_TEXT[index % AVATAR_TEXT.length] ?? "#475569";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bg, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 700, color: text, border: "1.5px solid rgba(0,0,0,0.06)" }}>
      {tech.avatar_url ? (
        <img src={tech.avatar_url} alt={tech.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : getInitials(tech.full_name)}
    </div>
  );
};

const FullLeaderboardModal: React.FC<{ technicians: TechStat[]; onClose: () => void }> = ({ technicians, onClose }) => {
  const MEDAL = ["🥇", "🥈", "🥉"];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640,
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.3rem 1.5rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fef3c715", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={16} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Technician Leaderboard</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>Ranked by rating &amp; resolved tickets</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Column headers */}
        <div style={{ padding: "0.6rem 1.5rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 60px 70px", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {["#", "Technician", "Resolved", "Active", "Pending", "Rating"].map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h === "Technician" ? "left" : "center" }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0.75rem 1rem" }}>
          {technicians.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "2rem 0" }}>No technician data yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {technicians.map((tech, i) => (
                <div
                  key={tech.id}
                  style={{
                    display: "grid", gridTemplateColumns: "32px 1fr 60px 60px 60px 70px", gap: 10,
                    alignItems: "center", padding: "10px 12px", borderRadius: 12,
                    background: i === 0 ? "#fafbff" : i < 3 ? "#fdfeff" : "#fff",
                    border: `1px solid ${i === 0 ? "#dbeafe" : "#f1f5f9"}`,
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ textAlign: "center", fontSize: i < 3 ? 18 : 13, fontWeight: 700, color: "#94a3b8" }}>
                    {i < 3 ? MEDAL[i] : `${i + 1}`}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <TechAvatar tech={tech} index={i} size={36} fontSize={12} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0a4c86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tech.full_name}</div>
                      <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} size={9} fill={n <= Math.round(tech.avgRating) ? "#f59e0b" : "none"} color={n <= Math.round(tech.avgRating) ? "#f59e0b" : "#cbd5e1"} strokeWidth={n <= Math.round(tech.avgRating) ? 0 : 2} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {[
                    { num: tech.resolved,   col: "#059669" },
                    { num: tech.inProgress, col: "#1e40af" },
                    { num: tech.pending,    col: "#475569" },
                  ].map((s, si) => (
                    <div key={si} style={{ textAlign: "center", fontSize: 16, fontWeight: 800, color: s.col }}>{s.num}</div>
                  ))}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{tech.avgRating > 0 ? tech.avgRating.toFixed(1) : "—"}</div>
                    {tech.totalRatings > 0 && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{tech.totalRatings} review{tech.totalRatings !== 1 ? "s" : ""}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI: React.FC<{
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  delay?: number;
  linkText?: string;
  onClick?: () => void;
}> = ({ label, value, sub, icon, iconBg, iconColor, delay = 0, linkText, onClick }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const showLink = Boolean(linkText && onClick);
  const displayValue = visible ? value : typeof value === "number" ? 0 : "—";

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: sub ? 8 : 4 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: iconBg, color: iconColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", lineHeight: 1.3 }}>{label}</div>
          <div
            style={{
              fontSize: 26, fontWeight: 700, color: "#111827", lineHeight: 1.15,
              letterSpacing: "-0.5px", fontFamily: "'DM Sans', sans-serif", marginTop: 2,
            }}
          >
            {displayValue}
          </div>
        </div>
      </div>
      {sub ? (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12, lineHeight: 1.4 }}>{sub}</div>
      ) : (
        <div style={{ marginBottom: 12 }} />
      )}
      {showLink && (
        <>
          <div style={{ height: 1, background: "#f3f4f6", marginBottom: 10 }} />
          <button
            type="button"
            onClick={onClick}
            style={{
              alignSelf: "flex-start", border: "none", background: "none", padding: 0, margin: 0,
              fontSize: 13, fontWeight: 600, color: KPI_LINK_COLOR, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            {linkText}
            <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span>
          </button>
        </>
      )}
    </div>
  );
};

// ── Pie/Donut percent label plugin ────────────────────────────────────────────
const pieSlicePercentPlugin = {
  id: "pieSlicePercentLabels",
  afterDatasetsDraw(chart: import("chart.js").Chart) {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const vals = (dataset?.data ?? []) as number[];
    const total = vals.reduce((s, v) => s + (Number(v) || 0), 0);
    if (total <= 0) return;
    chart.getDatasetMeta(0).data.forEach((el, i) => {
      const v = Number(vals[i]) || 0;
      if (v <= 0) return;
      const pct = Math.round((v / total) * 100);
      const arc = el as unknown as { tooltipPosition?: () => { x: number; y: number } };
      if (typeof arc.tooltipPosition !== "function") return;
      const { x, y } = arc.tooltipPosition();
      ctx.save();
      ctx.font = "bold 12px 'DM Sans', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(15,23,42,0.35)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(`${pct}%`, x, y);
      ctx.fillText(`${pct}%`, x, y);
      ctx.restore();
    });
  },
};

const PIE_ANIMATION = { duration: 850, easing: "easeOutCubic" as const };
const PIE_ANIMATIONS = {
  radius: { from: 0, duration: 850, easing: "easeOutCubic" as const },
  rotation: { from: -0.5 * Math.PI, duration: 850, easing: "easeOutCubic" as const },
};

// ── Section Header ────────────────────────────────────────────────────────────
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

// ── Recent Activity Panel (activity_log style) ────────────────────────────────
const SUPABASE_URL_ACT = import.meta.env.VITE_SUPABASE_URL as string;
const BUCKET_ACT = "profile-avatar";

function getActAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${SUPABASE_URL_ACT}/storage/v1/object/public/${BUCKET_ACT}/${avatarUrl}`;
}

const ACT_AVATAR_COLORS = ["#0a4c86","#1d6fa8","#2e7d32","#6a1b9a","#ad1457","#00838f","#e65100","#4527a0"];
function actAvatarColor(name: string | null | undefined): string {
  if (!name?.trim()) return "#0a4c86";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return ACT_AVATAR_COLORS[hash % ACT_AVATAR_COLORS.length];
}
function actInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "SY";
  return name.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const ActUserAvatar: React.FC<{ fullName?: string | null; avatarUrl?: string | null }> = ({ fullName, avatarUrl }) => {
  const [imgErr, setImgErr] = useState(false);
  const url = getActAvatarUrl(avatarUrl);
  const show = !!url && !imgErr;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: show ? "transparent" : actAvatarColor(fullName),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "#fff", userSelect: "none",
    }}>
      {show
        ? <img src={url!} alt={fullName ?? ""} onError={() => setImgErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : actInitials(fullName)}
    </div>
  );
};

const ACT_ACTION_ICONS: Record<string, { bg: string; icon: React.ReactNode }> = {
  ticket: {
    bg: "#1d6fa8",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6M9 16h6M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>
        <rect x="7" y="2" width="10" height="4" rx="1"/>
      </svg>
    ),
  },
  repair: {
    bg: "#e65100",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  incoming: {
    bg: "#2e7d32",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v13M8 11l4 4 4-4"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      </svg>
    ),
  },
  outgoing: {
    bg: "#00838f",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V9M8 13l4-4 4 4"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      </svg>
    ),
  },
  department: {
    bg: "#4527a0",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12"/>
      </svg>
    ),
  },
  user: {
    bg: "#6a1b9a",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
};
const ACT_DEFAULT_ICON = {
  bg: "#78909c",
  icon: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
};

const ActActionIcon: React.FC<{ action: string }> = ({ action }) => {
  const key = Object.keys(ACT_ACTION_ICONS).find((k) => action.includes(k));
  const { bg, icon } = key ? ACT_ACTION_ICONS[key] : ACT_DEFAULT_ICON;
  return (
    <div style={{ width: 26, height: 26, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1, position: "relative" }}>
      {icon}
    </div>
  );
};

const ACT_PRETTY: Record<string, string> = {
  ticket_created: "Opened a ticket",
  ticket_updated: "Updated a ticket",
  ticket_technician_update: "Updated ticket progress",
  repair_created: "Logged a repair",
  repair_updated: "Updated a repair",
  repair_technician_update: "Updated repair progress",
  incoming_unit_created: "Received an incoming unit",
  incoming_unit_updated: "Updated an incoming unit",
  incoming_unit_deleted: "Removed an incoming unit",
  incoming_unit_archived: "Archived an incoming unit",
  outgoing_unit_created: "Released an outgoing unit",
  outgoing_unit_updated: "Updated an outgoing unit",
  outgoing_unit_deleted: "Removed an outgoing unit",
  outgoing_unit_archived: "Archived an outgoing unit",
  department_created: "Added a department",
  department_updated: "Updated a department",
  department_deleted: "Removed a department",
  department_archived: "Archived a department",
  user_account_created: "Created a user account",
  user_account_updated: "Updated a user account",
  user_account_deleted: "Deleted a user account",
  user_account_archived: "Archived a user account",
  user_account_status_changed: "Changed account status",
  user_account_approved: "Approved a signup request",
  user_account_rejected: "Rejected a signup request",
  user_password_changed: "Reset a user's password",
};

function actPretty(action: string): string {
  return ACT_PRETTY[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function actSubtitle(row: ActivityLogRow): string {
  const m = row.meta;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (row.ticket?.ticket_number) return row.ticket.ticket_number;
  if (str(m.ticket_number)) return str(m.ticket_number);
  const techStatus = str(m.new_status) || str(m.status);
  if (techStatus && row.action.includes("technician")) return `Status → ${techStatus}`;
  if (str(m.unit_name)) return str(m.unit_name);
  if (str(m.department_name)) return str(m.department_name);
  const fullName = str(m.full_name);
  const username = str(m.username) ? `@${str(m.username)}` : "";
  if (fullName || username) return [fullName, username].filter(Boolean).join(" ");
  if (techStatus) return `Status set to "${techStatus}"`;
  return "";
}

const ActRowSkeleton: React.FC<{ isLast?: boolean }> = ({ isLast = false }) => (
  <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: 2 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
      {!isLast && <div style={{ flex: 1, width: 1.5, background: "#e2e8f0", marginTop: 3, minHeight: 28 }} />}
    </div>
    <div style={{ flex: 1, paddingLeft: 9, paddingBottom: isLast ? 0 : 10 }}>
      <div style={{ background: "#fff", border: "1px solid #e8edf2", borderRadius: 8, padding: "7px 10px", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: "55%", height: 10, borderRadius: 4, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "skShimmer 1.4s ease infinite", marginBottom: 5 }} />
          <div style={{ width: "80%", height: 10, borderRadius: 4, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "skShimmer 1.4s ease infinite" }} />
        </div>
      </div>
    </div>
  </div>
);

// ── FIXED: RecentActivityPanel — shows 10 items, proper real-time updates ─────
const RecentActivityPanel: React.FC<{ onViewAll?: () => void }> = ({ onViewAll }) => {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [actLoading, setActLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    const { data, error } = await supabase
      .from("activity_log")
      .select(`id, action, entity_type, entity_id, meta, created_at,
        actor:user_accounts!activity_log_actor_user_id_fkey(full_name, avatar_url)`)
      .order("created_at", { ascending: false })
      .limit(5); 

    if (error) {
      setActLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRows: ActivityLogRow[] = (data ?? []).map((r: any) => ({
      ...r,
      meta: (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>,
      ticket: null,
    }));

    const ticketIds = rawRows
      .filter((r) => ["ticket_created", "ticket_updated", "ticket_technician_update"].includes(r.action) && r.entity_id)
      .map((r) => r.entity_id as string);

    if (ticketIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tickets } = await supabase.from("file_reports").select("id, ticket_number").in("id", ticketIds);
      const ticketMap: Record<string, string | null> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tickets ?? []).forEach((t: any) => { ticketMap[t.id] = t.ticket_number ?? null; });
      setRows(rawRows.map((r) => ({
        ...r,
        ticket: ticketMap[r.entity_id ?? ""] !== undefined ? { ticket_number: ticketMap[r.entity_id ?? ""] } : null,
      })));
    } else {
      setRows(rawRows);
    }

    setActLoading(false);
  }, []);

  useEffect(() => {
    setActLoading(true);
    void fetchActivity();

    // ── FIXED: unique channel name + proper real-time subscription ──────────
    const channelName = `recent_activity_panel_${Date.now()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        () => { void fetchActivity(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activity_log" },
        () => { void fetchActivity(); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activity_log" },
        () => { void fetchActivity(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [fetchActivity]);

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <SectionHeader
        icon={<Activity size={14} color="#2563eb" />}
        iconBg="#eff6ff"
        title="Recent Activity"
        right={
          onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              style={{ border: "none", background: "none", padding: 0, fontSize: 12, fontWeight: 600, color: KPI_LINK_COLOR, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              View all
            </button>
          ) : undefined
        }
      />
      {actLoading ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[0, 1, 2, 3, 4].map((i) => <ActRowSkeleton key={i} isLast={i === 4} />)}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No recent activity.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            const subtitle = actSubtitle(row);
            const time = relativeTime(row.created_at);
            return (
              <div key={row.id} style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
                {/* Spine: icon + connector line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: 2 }}>
                  <ActActionIcon action={row.action} />
                  {!isLast && <div style={{ flex: 1, width: 1.5, background: "#e2e8f0", marginTop: 3, minHeight: 28 }} />}
                </div>
                {/* Card */}
                <div style={{ flex: 1, paddingLeft: 9, paddingBottom: isLast ? 0 : 10 }}>
                  <div style={{
                    background: "#fff", border: "1px solid #e8edf2", borderRadius: 8,
                    boxShadow: "0 1px 4px rgba(10,76,134,0.06)",
                    padding: "7px 10px", display: "flex", alignItems: "center", gap: 9,
                  }}>
                    <ActUserAvatar fullName={row.actor?.full_name} avatarUrl={row.actor?.avatar_url} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 1px", fontSize: 12, fontWeight: 600, color: "#0f172a", lineHeight: 1.35, fontFamily: "'DM Sans', sans-serif" }}>
                        {row.actor?.full_name?.trim() || "System"}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.35, fontFamily: "'DM Sans', sans-serif" }}>
                        {actPretty(row.action)}
                        {subtitle && (
                          <> &mdash; <span style={{ color: "#0a4c86", fontWeight: 600 }}>{subtitle}</span></>
                        )}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}>
                      {time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Weekly Mixed Chart ────────────────────────────────────────────────────────
const WeeklyMixedChart: React.FC<{ weeklyTickets: number[] }> = ({ weeklyTickets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);

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
            { type: "bar", label: "Tickets", data: bars, backgroundColor: "rgba(10,76,134,0.22)", borderColor: "#0a4c86", borderWidth: 1.5, borderRadius: 7, yAxisID: "y" },
            { type: "line", label: "Cumulative", data: cumulative, borderColor: "#f59e0b", backgroundColor: "#f59e0b", pointRadius: 3.5, pointHoverRadius: 6, tension: 0.35, yAxisID: "y1" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { color: "#64748b", font: { family: "'DM Sans', sans-serif", size: 11 }, usePointStyle: true } },
            tooltip: { backgroundColor: "#0f172a", titleColor: "#f8fafc", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8 },
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: "#94a3b8", font: { family: "'DM Sans', sans-serif", size: 10 } } },
            y: { beginAtZero: true, position: "left", grid: { color: "#f1f5f9" }, border: { display: false }, ticks: { color: "#94a3b8", precision: 0, stepSize: 1 } },
            y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, border: { display: false }, ticks: { color: "#f59e0b", precision: 0, stepSize: 1 } },
          },
        },
      });
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  }, [weeklyTickets]);

  return <div style={{ position: "relative", width: "100%", height: 220 }}><canvas ref={canvasRef} /></div>;
};

// ── Donut Chart (Ticket Status) — FIXED: cutout typed as any ─────────────────
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; animKey?: number }> = ({ data, animKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void; update: () => void } | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const legendItems = data.map((item) => ({ ...item, pct: total > 0 ? Math.round((item.value / total) * 100) : 0 }));

  useEffect(() => {
    if (!canvasRef.current || total === 0) return;
    let cancelled = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (cancelled || !canvasRef.current) return;
      chartRef.current?.destroy();
      chartRef.current = null;
      chartRef.current = new Chart(canvasRef.current, {
        type: "doughnut",
        plugins: [pieSlicePercentPlugin as import("chart.js").Plugin],
        data: {
          labels: data.map((d) => d.label),
          datasets: [{ data: data.map((d) => d.value), backgroundColor: data.map((d) => d.color), borderColor: "#fff", borderWidth: 2, hoverOffset: 8 }],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: PIE_ANIMATION,
          animations: PIE_ANIMATIONS,
          cutout: "72%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a", titleColor: "#f8fafc", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8,
              callbacks: { label: (ctx: any) => { const v = Number(ctx.raw) || 0; const p = total > 0 ? Math.round((v / total) * 100) : 0; return ` ${v} (${p}%)`; } },
            },
          },
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      chartRef.current.update();
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, total]);

  if (total === 0) return <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No ticket status data yet.</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(170px,1fr) minmax(180px,1fr)", gap: 16, alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", height: 220, minHeight: 220 }}>
        <canvas ref={canvasRef} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 38, lineHeight: 1, fontWeight: 800, color: "#0a4c86" }}>
              {total > 0 ? Math.round(((legendItems.find((i) => i.label === "Resolved")?.value ?? 0) / total) * 100) : 0}%
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Uptime</div>
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
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{item.value} ({item.pct}%)</span>
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

// ── Recurring Issue List ──────────────────────────────────────────────────────
const ISSUE_PERIOD_OPTIONS: DropdownOption[] = [
  { label: "All time",   value: "all" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month",  value: "month" },
];

const RecurringIssueList: React.FC<{ issueBreakdown: IssueCount[]; period: string }> = ({ issueBreakdown, period: _period }) => {
  const items = issueBreakdown.slice(0, 3);
  const total = items.reduce((s, i) => s + i.count, 0);
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
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                  {pct}% &nbsp;<span style={{ fontWeight: 400, color: "#9ca3af" }}>{item.count} ticket{item.count !== 1 ? "s" : ""}</span>
                </span>
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

// ── Top Departments Donut — FIXED: cutout typed as any ────────────────────────
const DEPT_PALETTE = ["#f59e0b", "#0a4c86", "#7c3aed", "#0891b2", "#10b981", "#ef4444", "#f97316", "#8b5cf6", "#06b6d4", "#84cc16"];
function getDeptColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_PALETTE[Math.abs(hash) % DEPT_PALETTE.length];
}

const DEPT_PERIOD_OPTIONS: DropdownOption[] = [
  { label: "All time",    value: "all" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month",  value: "month" },
];

const DeptDonutChart: React.FC<{ deptRows: DeptRow[]; animKey?: number }> = ({ deptRows, animKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void; update: () => void } | null>(null);
  const totalTickets = deptRows.reduce((s, d) => s + d.tickets, 0);
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
        type: "doughnut",
        data: {
          labels: deptRows.map((d) => d.name),
          datasets: [{ data: deptRows.map((d) => d.tickets), backgroundColor: deptRows.map((d) => getDeptColor(d.name)), borderColor: "#fff", borderWidth: 2, hoverOffset: 8 }],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: PIE_ANIMATION,
          animations: PIE_ANIMATIONS,
          cutout: "65%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a", titleColor: "#f8fafc", bodyColor: "#94a3b8", padding: 10, cornerRadius: 8,
              callbacks: { label: (item: any) => { const raw = Number(item.raw) || 0; const pct = totalTickets > 0 ? Math.round((raw / totalTickets) * 100) : 0; return ` ${raw} (${pct}%)`; } },
            },
          },
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      chartRef.current.update();
    });
    return () => { cancelled = true; chartRef.current?.destroy(); chartRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, totalTickets]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,1fr) minmax(160px,1fr)", gap: 12, alignItems: "center" }}>
      <div style={{ position: "relative", width: "100%", height: 200, minHeight: 200 }}>
        <canvas ref={canvasRef} />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: "#f59e0b" }}>{totalTickets}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Total</div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: "grid", gap: 8 }}>
          {legendItems.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{item.value} ({item.pct}%)</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#94a3b8" }}>
          Total: <strong style={{ color: "#0f172a" }}>{deptRows.length} department{deptRows.length !== 1 ? "s" : ""}</strong>
        </div>
      </div>
    </div>
  );
};

// ── Technician Leaderboard List ───────────────────────────────────────────────
const LEADERBOARD_PERIOD_OPTIONS: DropdownOption[] = [
  { label: "All time",    value: "all" },
  { label: "This week",   value: "week" },
  { label: "This month",  value: "month" },
  { label: "Last 30 days", value: "30d" },
];

const TechLeaderboardList: React.FC<{ technicians: TechStat[] }> = ({ technicians }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {technicians.slice(0, 5).map((tech, i) => (
      <div key={tech.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #f1f5f9", borderRadius: 12, background: i === 0 ? "#fafbff" : "#ffffff" }}>
        <TechAvatar tech={tech} index={i} size={42} fontSize={13} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a4c86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tech.full_name}</div>
          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={11} fill={n <= Math.round(tech.avgRating || 0) ? "#f59e0b" : "none"} color={n <= Math.round(tech.avgRating || 0) ? "#f59e0b" : "#cbd5e1"} strokeWidth={n <= Math.round(tech.avgRating || 0) ? 0 : 2} />
            ))}
          </div>
        </div>
        {[
          { num: tech.resolved,   lbl: "Resolved", col: "#065f46" },
          { num: tech.inProgress, lbl: "Active",   col: "#1e40af" },
          { num: tech.pending,    lbl: "Pending",  col: "#475569" },
        ].map((s) => (
          <div key={s.lbl} style={{ textAlign: "center", minWidth: 44 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.col, lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", marginTop: 2, textTransform: "uppercase" }}>{s.lbl}</div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }> = ({
  width = "100%", height = 14, radius = 6, style = {},
}) => (
  <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "skShimmer 1.4s ease infinite", flexShrink: 0, ...style }} />
);

const KpiSkeleton: React.FC = () => (
  <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
      <Skeleton width={40} height={40} radius={10} />
      <div style={{ flex: 1 }}>
        <Skeleton width="70%" height={12} radius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="45%" height={26} radius={6} />
      </div>
    </div>
    <Skeleton width="85%" height={10} radius={4} style={{ marginBottom: 12 }} />
    <div style={{ height: 1, background: "#f3f4f6", marginBottom: 10 }} />
    <Skeleton width={110} height={12} radius={4} />
  </div>
);

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

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const stampAvatar = (t: Record<string, unknown>): Record<string, unknown> => ({
  ...t,
  avatar_url: t.avatar_url ? `${String(t.avatar_url)}?t=${encodeURIComponent(String(t.updated_at ?? ""))}` : "",
});

// ── Filter helpers ────────────────────────────────────────────────────────────
function filterTicketsByPeriod(tickets: Record<string, unknown>[], period: string): Record<string, unknown>[] {
  if (period === "all") return tickets;
  const now = new Date();
  const cutoff = new Date();
  if (period === "7d") cutoff.setDate(now.getDate() - 7);
  else if (period === "30d") cutoff.setDate(now.getDate() - 30);
  else if (period === "month") { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0); }
  else if (period === "week") {
    cutoff.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    cutoff.setHours(0, 0, 0, 0);
  }
  return tickets.filter((t) => {
    const d = new Date(String(t.date_submitted ?? ""));
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}

// ── Build dashboard data ──────────────────────────────────────────────────────
function buildDashData(
  tickets: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
  outgoing: Record<string, unknown>[],
  accounts: Record<string, unknown>[],
  departments: Record<string, unknown>[],
  technicians: Record<string, unknown>[],
  ticketFeedbacks: Record<string, unknown>[]
): DashData {
  const today = new Date();

  const weeklyTickets = Array(7).fill(0);
  tickets.forEach((t) => {
    const submitted = new Date(String(t.date_submitted ?? ""));
    if (isNaN(submitted.getTime())) return;
    const todayMonBased = (today.getDay() + 6) % 7;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - todayMonBased);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    if (submitted >= startOfWeek && submitted < endOfWeek)
      weeklyTickets[(submitted.getDay() + 6) % 7]++;
  });

  const typeCounts: Record<string, number> = {};
  tickets.forEach((t) => {
    const k = t.issue_type === "Network / Internet" ? "Internet" : String(t.issue_type ?? "Other");
    typeCounts[k] = (typeCounts[k] ?? 0) + 1;
  });
  const issueBreakdown: IssueCount[] = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const deptRows: DeptRow[] = (departments ?? [])
    .map((dept) => ({ name: String(dept.name ?? ""), tickets: tickets.filter((t) => String(t.department_id) === String(dept.id)).length }))
    .filter((d) => d.tickets > 0)
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, 5);

  const techRatingsMap: Record<string, number[]> = {};
  ticketFeedbacks.forEach((fb) => {
    const ticket = tickets.find((t) => String(t.id) === String(fb.report_id));
    if (!ticket) return;
    const assigned: string[] = Array.isArray(ticket.assigned_to)
      ? (ticket.assigned_to as unknown[]).map(String)
      : ticket.assigned_to ? [String(ticket.assigned_to)] : [];
    assigned.forEach((techId) => {
      if (!techRatingsMap[techId]) techRatingsMap[techId] = [];
      techRatingsMap[techId].push(Number(fb.rating));
    });
  });

  const techLeaderboard: TechStat[] = (technicians ?? [])
    .map((technician) => {
      const id = String(technician.id);
      const ratings = techRatingsMap[id] ?? [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return {
        id,
        full_name: String(technician.full_name ?? ""),
        avatar_url: String(technician.avatar_url ?? ""),
        resolved:   tickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "Resolved").length,
        inProgress: tickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "In Progress").length,
        pending:    tickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "Pending").length,
        avgRating:  Math.round(avgRating * 10) / 10,
        totalRatings: ratings.length,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.resolved - a.resolved);

  const totalFeedbacks = ticketFeedbacks.length;
  const avgFeedbackRating = totalFeedbacks > 0
    ? Math.round((ticketFeedbacks.reduce((s, fb) => s + Number(fb.rating), 0) / totalFeedbacks) * 10) / 10
    : 0;

  const resolvedTickets = tickets.filter((t) => t.status === "Resolved");
  const responseTimes: number[] = resolvedTickets
    .filter((t) => t.date_submitted && t.updated_at)
    .map((t) => (new Date(String(t.updated_at)).getTime() - new Date(String(t.date_submitted)).getTime()) / 3600000);
  const avgResponseTimeHours = responseTimes.length > 0
    ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
    : 0;

  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const ticketsClosedThisWeek = tickets.filter((t) => t.status === "Resolved" && t.updated_at && new Date(String(t.updated_at)) >= startOfThisWeek).length;
  const ticketsClosedLastWeek = tickets.filter((t) => t.status === "Resolved" && t.updated_at && new Date(String(t.updated_at)) >= startOfLastWeek && new Date(String(t.updated_at)) < startOfThisWeek).length;
  const ticketsClosedTrend = ticketsClosedLastWeek > 0
    ? Math.round(((ticketsClosedThisWeek - ticketsClosedLastWeek) / ticketsClosedLastWeek) * 100)
    : ticketsClosedThisWeek > 0 ? 100 : 0;

  const firstContactResolutionPct = tickets.length > 0 ? Math.round((resolvedTickets.length / tickets.length) * 100) : 0;
  const slaCompliancePct = responseTimes.length > 0
    ? Math.round((responseTimes.filter((h) => h <= 48).length / responseTimes.length) * 100)
    : 100;

  return {
    totalTickets:      tickets.length,
    pendingTickets:    tickets.filter((t) => t.status === "Pending").length,
    resolvedTickets:   tickets.filter((t) => t.status === "Resolved").length,
    inProgressTickets: tickets.filter((t) => t.status === "In Progress").length,
    incomingUnits:     incoming.length,
    outgoingUnits:     outgoing.length,
    activeAccounts:    accounts.filter((a) => a.is_active === true).length,
    avgFeedbackRating,
    totalFeedbacks,
    issueBreakdown,
    deptRows,
    weeklyTickets,
    techLeaderboard,
    avgResponseTimeHours,
    avgResponseTimeTrend: -12,
    firstContactResolutionPct,
    firstContactResolutionTrend: 8,
    ticketsClosedThisWeek,
    ticketsClosedTrend,
    reopenedTickets: 0,
    reopenedTrend: 0,
    slaCompliancePct,
    slaComplianceTrend: 5,
  };
}

// ── Dashboard Home ────────────────────────────────────────────────────────────
const DashboardHome: React.FC<{ onNavigate: (label: string) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pieAnimKey, setPieAnimKey] = useState(0);

  // Filter states
  const [issuePeriod, setIssuePeriod] = useState("all");
  const [deptPeriod, setDeptPeriod] = useState("all");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState("all");
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  const ticketsRef          = useRef<Record<string, unknown>[]>([]);
  const incomingUnitsRef    = useRef<Record<string, unknown>[]>([]);
  const outgoingUnitsRef    = useRef<Record<string, unknown>[]>([]);
  const userAccountsRef     = useRef<Record<string, unknown>[]>([]);
  const departmentsRef      = useRef<Record<string, unknown>[]>([]);
  const techniciansRef      = useRef<Record<string, unknown>[]>([]);
  const ticketFeedbacksRef  = useRef<Record<string, unknown>[]>([]);

  const recomputeRef = useRef<() => void>(() => {});
  recomputeRef.current = () =>
    setData(buildDashData(
      ticketsRef.current, incomingUnitsRef.current, outgoingUnitsRef.current,
      userAccountsRef.current, departmentsRef.current, techniciansRef.current, ticketFeedbacksRef.current,
    ));

  const upsertById = useCallback((rows: Record<string, unknown>[], next: Record<string, unknown>) => {
    const exists = rows.some((r) => r.id === next.id);
    if (!exists) return [...rows, next];
    return rows.map((r) => (r.id === next.id ? { ...r, ...next } : r));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: tickets }, { data: incoming }, { data: outgoing },
      { data: accounts }, { data: departments }, { data: technicians }, { data: ticketFeedbacks },
    ] = await Promise.all([
      supabase.from("file_reports").select("status, issue_type, date_submitted, department_id, id, assigned_to, updated_at"),
      supabase.from("incoming_units").select("id, date_received"),
      supabase.from("outgoing_units").select("id, date_released"),
      supabase.from("user_accounts").select("id, created_at, is_active").eq("is_archived", false),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("user_accounts").select("id, full_name, avatar_url, updated_at").eq("role", "IT Technician").eq("is_active", true).eq("is_archived", false).order("full_name"),
      supabase.from("ticket_feedback").select("id, report_id, rating"),
    ]);
    ticketsRef.current         = (tickets ?? []) as Record<string, unknown>[];
    incomingUnitsRef.current   = (incoming ?? []) as Record<string, unknown>[];
    outgoingUnitsRef.current   = (outgoing ?? []) as Record<string, unknown>[];
    userAccountsRef.current    = (accounts ?? []) as Record<string, unknown>[];
    departmentsRef.current     = (departments ?? []) as Record<string, unknown>[];
    techniciansRef.current     = ((technicians ?? []) as Record<string, unknown>[]).map(stampAvatar);
    ticketFeedbacksRef.current = (ticketFeedbacks ?? []) as Record<string, unknown>[];
    recomputeRef.current();
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`dashboard_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "file_reports" },
        ({ new: n }) => { ticketsRef.current = upsertById(ticketsRef.current, n as Record<string, unknown>); recomputeRef.current(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "file_reports" },
        ({ new: n }) => { ticketsRef.current = upsertById(ticketsRef.current, n as Record<string, unknown>); recomputeRef.current(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "file_reports" },
        ({ old: o }) => { ticketsRef.current = ticketsRef.current.filter((r) => r.id !== (o as Record<string, unknown>).id); recomputeRef.current(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_feedback" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [upsertById, load]);

  // Recompute pie animation key when period filter changes
  useEffect(() => { setPieAnimKey((k) => k + 1); }, [issuePeriod, deptPeriod]);

  if (loading) {
    return (
      <>
        <style>{`@keyframes skShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div className="dash-new" style={{ color: "#0f172a", paddingRight: 8 }}>
          <div className="dash-kpi-primary" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.85rem", marginBottom: "0.85rem" }}>
            {[0,1,2,3,4].map((i) => <KpiSkeleton key={i} />)}
          </div>
          <div className="dash-kpi-units" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "0.85rem", marginBottom: "1.2rem" }}>
            {[0,1].map((i) => <KpiSkeleton key={i} />)}
          </div>
          <div className="dash-mid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <PanelSkeleton height={280} lines={3} /><PanelSkeleton height={280} lines={2} /><PanelSkeleton height={280} lines={4} />
          </div>
          <div className="dash-bot" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <PanelSkeleton height={260} lines={2} /><PanelSkeleton height={260} lines={2} /><PanelSkeleton height={260} lines={3} />
          </div>
          <div className="dash-sla" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
            {[0,1,2,3,4].map((i) => <PanelSkeleton key={i} height={80} lines={0} />)}
          </div>
        </div>
      </>
    );
  }

  if (!data) return null;

  const resolutionRatePct = data.totalTickets > 0 ? Math.round((data.resolvedTickets / data.totalTickets) * 100) : 0;
  const satisfactionPct = data.totalFeedbacks > 0 ? Math.round((data.avgFeedbackRating / 5) * 100) : null;

  const donutData = [
    { label: "Assigned",    value: data.pendingTickets,    color: "#f59e0b" },
    { label: "In Progress", value: data.inProgressTickets, color: "#3b82f6" },
    { label: "Resolved",    value: data.resolvedTickets,   color: "#10b981" },
  ];

  // Filtered issue breakdown
  const filteredIssueTickets = filterTicketsByPeriod(ticketsRef.current, issuePeriod);
  const filteredIssueCounts: Record<string, number> = {};
  filteredIssueTickets.forEach((t) => {
    const k = t.issue_type === "Network / Internet" ? "Internet" : String(t.issue_type ?? "Other");
    filteredIssueCounts[k] = (filteredIssueCounts[k] ?? 0) + 1;
  });
  const filteredIssueBreakdown: IssueCount[] = Object.entries(filteredIssueCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Filtered dept rows
  const filteredDeptTickets = filterTicketsByPeriod(ticketsRef.current, deptPeriod);
  const filteredDeptRows: DeptRow[] = (departmentsRef.current ?? [])
    .map((dept) => ({ name: String(dept.name ?? ""), tickets: filteredDeptTickets.filter((t) => String(t.department_id) === String(dept.id)).length }))
    .filter((d) => d.tickets > 0)
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, 5);

  // Filtered leaderboard
  const filteredLbTickets = filterTicketsByPeriod(ticketsRef.current, leaderboardPeriod);
  const filteredTechLeaderboard: TechStat[] = (techniciansRef.current ?? [])
    .map((technician) => {
      const id = String(technician.id);
      const ratings = ticketFeedbacksRef.current
        .filter((fb) => {
          const ticket = filteredLbTickets.find((t) => String(t.id) === String(fb.report_id));
          if (!ticket) return false;
          return isAssigned(ticket.assigned_to, id);
        })
        .map((fb) => Number(fb.rating));
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return {
        id,
        full_name: String(technician.full_name ?? ""),
        avatar_url: String(technician.avatar_url ?? ""),
        resolved:   filteredLbTickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "Resolved").length,
        inProgress: filteredLbTickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "In Progress").length,
        pending:    filteredLbTickets.filter((t) => isAssigned(t.assigned_to, id) && t.status === "Pending").length,
        avgRating:  Math.round(avgRating * 10) / 10,
        totalRatings: ratings.length,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating || b.resolved - a.resolved);

  const slaItems = [
    { icon: <Clock size={18} color="#f59e0b" />,      iconBg: "#fef3c7", label: "Avg Response Time",        value: `${data.avgResponseTimeHours}h`,      trend: data.avgResponseTimeTrend,         positiveIsGood: false },
    { icon: <PhoneCall size={18} color="#10b981" />,   iconBg: "#d1fae5", label: "First Contact Resolution", value: `${data.firstContactResolutionPct}%`, trend: data.firstContactResolutionTrend,  positiveIsGood: true  },
    { icon: <CheckCheck size={18} color="#2563eb" />,  iconBg: "#dbeafe", label: "Tickets Closed",           value: data.ticketsClosedThisWeek,           trend: data.ticketsClosedTrend,           positiveIsGood: true  },
    { icon: <RotateCcw size={18} color="#ef4444" />,   iconBg: "#fee2e2", label: "Reopened Tickets",         value: data.reopenedTickets,                 trend: data.reopenedTrend,                positiveIsGood: false },
    { icon: <ShieldCheck size={18} color="#7c3aed" />, iconBg: "#ede9fe", label: "SLA Compliance",           value: `${data.slaCompliancePct}%`,          trend: data.slaComplianceTrend,           positiveIsGood: true  },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .dash-new*,.dash-new{box-sizing:border-box;}
        .dash-new{font-family:'DM Sans',sans-serif;}
        @media(max-width:1280px){
          .dash-kpi-primary{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
          .dash-mid{grid-template-columns:1fr 1.4fr!important;}
          .dash-mid>*:last-child{grid-column:1/-1;}
          .dash-bot{grid-template-columns:1fr 1fr!important;}
          .dash-bot>*:last-child{grid-column:1/-1;}
          .dash-sla{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
        }
        @media(max-width:1100px){
          .dash-kpi-primary{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
          .dash-kpi-units{grid-template-columns:1fr!important;}
          .dash-mid{grid-template-columns:1fr!important;}
          .dash-mid>*:last-child{grid-column:auto;}
          .dash-bot{grid-template-columns:1fr!important;}
          .dash-bot>*:last-child{grid-column:auto;}
          .dash-sla{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
        }
        @media(max-width:580px){
          .dash-kpi-primary{grid-template-columns:1fr!important;}
          .dash-sla{grid-template-columns:1fr!important;}
        }
        @keyframes skShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>

      <div className="dash-new" style={{ color: "#0f172a", paddingRight: 8 }}>

        {/* KPI — 5 ticket cards */}
        <div className="dash-kpi-primary" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.85rem", marginBottom: "0.85rem" }}>
          <KPI label="Total Tickets"  value={data.totalTickets}  sub="All time submissions"                                                              icon={<Ticket       size={18} strokeWidth={2} />} iconBg="#eff6ff" iconColor="#1d4ed8" delay={0}   linkText="View all tickets"  onClick={() => onNavigate("Submit Ticket")}       />
          <KPI label="Assigned"       value={data.pendingTickets} sub={`${data.pendingTickets} Pending Pickup`}                                           icon={<Users        size={18} strokeWidth={2} />} iconBg="#f0fdf4" iconColor="#15803d" delay={60}  linkText="View assigned"     onClick={() => onNavigate("Submit Ticket")}       />
          <KPI label="In Progress"    value={data.inProgressTickets} sub="Currently active"                                                              icon={<Timer        size={18} strokeWidth={2} />} iconBg="#fff7ed" iconColor="#c2410c" delay={120} linkText="View in progress"  onClick={() => onNavigate("Submit Ticket")}       />
          <KPI label="Resolved"       value={data.resolvedTickets}   sub={`${resolutionRatePct}% resolution rate`}                                       icon={<CheckCircle2 size={18} strokeWidth={2} />} iconBg="#ecfdf5" iconColor="#15803d" delay={180} linkText="View resolved"     onClick={() => onNavigate("Work History")}        />
          <KPI label="Satisfaction"   value={satisfactionPct !== null ? `${satisfactionPct}%` : "—"} sub={data.totalFeedbacks > 0 ? "Average feedback rating" : "No feedback submitted yet"} icon={<Star size={18} strokeWidth={2} />} iconBg="#f5f3ff" iconColor="#6d28d9" delay={240} linkText="View feedback" onClick={() => onNavigate("Reports & Analytics")} />
        </div>

        {/* KPI — 2 unit cards */}
        <div className="dash-kpi-units" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "0.85rem", marginBottom: "1.2rem" }}>
          <KPI label="Incoming Units" value={data.incomingUnits} sub="New hardware batch"      icon={<CircleArrowDown size={18} strokeWidth={2} />} iconBg="#f1f5f9" iconColor="#475569" delay={300} linkText="View incoming" onClick={() => onNavigate("Incoming Units")} />
          <KPI label="Outgoing Units" value={data.outgoingUnits} sub="Released after service"  icon={<CircleArrowUp   size={18} strokeWidth={2} />} iconBg="#fef2f2" iconColor="#b91c1c" delay={360} linkText="View outgoing" onClick={() => onNavigate("Outgoing Units")} />
        </div>

        {/* Mid row — Status | Weekly | Recent Activity */}
        <div className="dash-mid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

          <div style={{ ...CARD }}>
            <SectionHeader icon={<BarChart3 size={14} color="#0a4c86" />} iconBg="#0a4c8615" title="Ticket Status Overview" />
            <DonutChart data={donutData} animKey={pieAnimKey} />
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader icon={<Activity size={14} color="#0a4c86" />} iconBg="#0a4c8615" title="Tickets This Week" right={<span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 9px" }}>Last 7 days</span>} />
            <WeeklyMixedChart weeklyTickets={data.weeklyTickets} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid #f1f5f9" }}>
              {[
                { label: "Total This Week", value: data.weeklyTickets.reduce((a, b) => a + b, 0), color: "#0a4c86" },
                { label: "Daily Average",   value: (data.weeklyTickets.reduce((a, b) => a + b, 0) / 7).toFixed(1), color: "#64748b" },
                { label: "Peak Day",        value: Math.max(...data.weeklyTickets), color: "#f59e0b" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: "-0.5px" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <RecentActivityPanel onViewAll={() => onNavigate("Activity Log")} />
        </div>

        {/* Bottom row — Issues | Departments | Leaderboard */}
        <div className="dash-bot" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<AlertTriangle size={14} color="#ef4444" />}
              iconBg="#ef444415"
              title="Top Issue Types"
              right={
                <FilterDropdown
                  label="Period"
                  options={ISSUE_PERIOD_OPTIONS}
                  value={issuePeriod}
                  onChange={setIssuePeriod}
                />
              }
            />
            {filteredIssueBreakdown.length === 0
              ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No issue data for this period.</p>
              : <RecurringIssueList issueBreakdown={filteredIssueBreakdown} period={issuePeriod} />}
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<TrendingUp size={14} color="#8b5cf6" />}
              iconBg="#8b5cf615"
              title="Top Departments"
              subtitle="Top 5 most active"
              right={
                <FilterDropdown
                  label="Period"
                  options={DEPT_PERIOD_OPTIONS}
                  value={deptPeriod}
                  onChange={setDeptPeriod}
                />
              }
            />
            {filteredDeptRows.length === 0
              ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No department data for this period.</p>
              : <DeptDonutChart deptRows={filteredDeptRows} animKey={pieAnimKey} />}
          </div>

          <div style={{ ...CARD }}>
            <SectionHeader
              icon={<Trophy size={14} color="#f59e0b" />}
              iconBg="#f59e0b15"
              title="Technician Leaderboard"
              right={
                <FilterDropdown
                  label="Period"
                  options={LEADERBOARD_PERIOD_OPTIONS}
                  value={leaderboardPeriod}
                  onChange={setLeaderboardPeriod}
                />
              }
            />
            {filteredTechLeaderboard.length === 0
              ? <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "1.5rem 0" }}>No technician data yet.</p>
              : (
                <>
                  <TechLeaderboardList technicians={filteredTechLeaderboard} />
                  <button
                    type="button"
                    onClick={() => setShowLeaderboardModal(true)}
                    style={{ marginTop: 14, width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafbff", fontSize: 13, fontWeight: 600, color: KPI_LINK_COLOR, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    View full leaderboard →
                  </button>
                </>
              )}
          </div>
        </div>

        {/* SLA KPI strip */}
        <div className="dash-sla" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
          {slaItems.map((item) => {
            const isGood = item.positiveIsGood ? item.trend >= 0 : item.trend <= 0;
            return (
              <div key={item.label} style={{ ...CARD, padding: "1rem 1.1rem", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.5px", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{item.value}</div>
                  {item.trend !== 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3, color: isGood ? "#059669" : "#dc2626", display: "flex", alignItems: "center", gap: 2 }}>
                      {item.trend > 0 ? "↑" : "↓"} {Math.abs(item.trend)}% vs last week
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Full Leaderboard Modal */}
      {showLeaderboardModal && (
        <FullLeaderboardModal
          technicians={filteredTechLeaderboard}
          onClose={() => setShowLeaderboardModal(false)}
        />
      )}
    </>
  );
};

// ── Dashboard Shell ───────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [activeLabel, setActiveLabel] = useState("Dashboard");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState("");
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
    if (userRole !== "Administrator") { setAssignJobBadgeCount(0); return; }
    const { data, error } = await supabase.from("file_reports").select("assigned_to").eq("status", "Pending").eq("is_archived", false);
    if (error) return;
    const count = (data ?? []).filter((row: { assigned_to: unknown }) => (Array.isArray(row.assigned_to) ? row.assigned_to : []).length === 0).length;
    setAssignJobBadgeCount(count);
  }, [userRole]);

  const refreshMyTicketsBadge = useCallback(async () => {
    if (userRole !== "IT Technician" || !userId) { setMyTicketsBadgeCount(0); return; }
    const { count, error } = await supabase.from("file_reports").select("id", { count: "exact", head: true }).contains("assigned_to", [userId]).not("status", "eq", "Resolved");
    if (error) return;
    setMyTicketsBadgeCount(count ?? 0);
  }, [userRole, userId]);

  useEffect(() => { void refreshAssignJobPendingBadge(); }, [refreshAssignJobPendingBadge]);
  useEffect(() => { void refreshMyTicketsBadge(); }, [refreshMyTicketsBadge]);

  useEffect(() => {
    if (userRole !== "Administrator" && userRole !== "IT Technician") return;
    const ch = supabase.channel(`adm_nav_badges_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => {
        void refreshAssignJobPendingBadge();
        void refreshMyTicketsBadge();
      })
      .subscribe();
    const handler = () => { void refreshAssignJobPendingBadge(); void refreshMyTicketsBadge(); };
    window.addEventListener(NAV_BADGES_CHANGED_EVENT, handler);
    return () => { window.removeEventListener(NAV_BADGES_CHANGED_EVENT, handler); void supabase.removeChannel(ch); };
  }, [userRole, refreshAssignJobPendingBadge, refreshMyTicketsBadge]);

  useEffect(() => {
    const sessionToken = localStorage.getItem("session_token");
    const sessionRole  = localStorage.getItem("session_user_role") || "";
    const allowed = sessionRole === "Administrator" || sessionRole === "IT Technician" || sessionRole === "Employee";
    if (!sessionToken || !allowed) {
      ["session_token","session_user_id","session_user_full_name","session_user_role","session_expires_at"].forEach((k) => localStorage.removeItem(k));
      navigate("/");
    }
  }, [navigate, userRole]);

  useEffect(() => {
    const load = async () => {
      if (!userId) { setHeaderAvatarUrl(""); return; }
      const { data } = await supabase.from("user_accounts").select("avatar_url, updated_at").eq("id", userId).single();
      setHeaderAvatarUrl(data?.avatar_url ? `${String(data.avatar_url)}?t=${encodeURIComponent(String(data.updated_at ?? ""))}` : "");
    };
    void load();
  }, [userId]);

  if (isEmployee) return <UserShell />;

  const dashHomeNode = useRef<React.ReactNode>(
    isTechnician ? <TechnicianDashboardHome /> : <DashboardHome onNavigate={setActiveLabel} />
  );

  const getPage = (label: string): React.ReactNode => {
    const adminOnly = new Set(["Submit Ticket", "Assign Job", "Resolved Tickets", "Departments", "User Accounts", "Reports & Analytics"]);
    if (!isAdmin && adminOnly.has(label)) return dashHomeNode.current;
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
      case "Users":               return isAdmin ? <UserAccounts /> : dashHomeNode.current;
      case "Reports & Analytics": return isAdmin ? <ReportAnalytics /> : dashHomeNode.current;
      case "Activity Log":        return <ActivityLogPanel isAdmin={isAdmin} />;
      default:                    return dashHomeNode.current;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .adm-scroll-area::-webkit-scrollbar{width:8px;height:8px;}
        .adm-scroll-area::-webkit-scrollbar-track{background:transparent;}
        .adm-scroll-area::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
        .adm-scroll-area::-webkit-scrollbar-thumb:hover{background:#94a3b8;}
      `}</style>

      <div style={{ height: "100vh", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f0f2f5", fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>
        <div style={{ flexShrink: 0, background: "#ffffff", borderBottom: "1px solid #e8edf5", boxShadow: "0 2px 12px rgba(10,76,134,0.06)" }}>
          <Header
            currentUserName={currentUserName}
            userRole={userRole}
            avatarUrl={headerAvatarUrl}
            onNotificationNavigate={(entityType, entityId) => {
              if (isAdmin) {
                if (entityType === "file_report") { if (entityId) localStorage.setItem("focus_ticket_id", entityId); setActiveLabel("Submit Ticket"); }
                else if (entityType === "repair")         setActiveLabel("Assign Job");
                else if (entityType === "signup_request") setActiveLabel("User Accounts");
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
            isAdmin      ? { "Assign Job":  assignJobBadgeCount } :
            isTechnician ? { "My Tickets":  myTicketsBadgeCount } :
            undefined
          }
        />
      </div>

      <ProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} onAvatarChange={(url) => setHeaderAvatarUrl(url)} />
    </>
  );
};

export default Dashboard;