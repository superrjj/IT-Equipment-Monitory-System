import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart2,
  TrendingUp,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  Loader,
  ChevronDown,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

const brandBlue = "#0D518C";

function hashDeptColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 48%)`;
}

const ISSUE_DONUT_COLORS: Record<string, string> = {
  Hardware: brandBlue,
  Software: "#0891b2",
  Internet: "#16a34a",
  "Network / Internet": "#16a34a",
};

const raStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

  .ra-root {
    font-family: 'Poppins', sans-serif;
    color: #0f172a;
    padding-top: 2rem;
  }

  .ra-stat-card {
    background: #ffffff;
    border-radius: 18px;
    padding: 1.25rem 1.4rem;
    border: 1px solid #e8edf2;
    box-shadow: 0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .ra-panel {
    background: #ffffff;
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    border: 1px solid #e8edf2;
    box-shadow: 0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04);
  }

  .ra-panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ra-bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
  }
  .ra-bar-label {
    font-size: 12px;
    color: #475569;
    font-weight: 500;
    width: 140px;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ra-bar-track {
    flex: 1;
    height: 10px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
  }
  .ra-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
  }
  .ra-bar-value {
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  .ra-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Period Dropdown */
  .ra-period-dropdown {
    position: relative;
    display: inline-block;
  }
  .ra-period-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.42rem 0.9rem;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: #ffffff;
    font-family: 'Poppins', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.16s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    white-space: nowrap;
    min-width: 150px;
    justify-content: space-between;
  }
  .ra-period-btn:hover {
    border-color: ${brandBlue};
    color: ${brandBlue};
    background: #f0f6ff;
  }
  .ra-period-btn.open {
    border-color: ${brandBlue};
    color: ${brandBlue};
    background: #f0f6ff;
    box-shadow: 0 0 0 3px rgba(13,81,140,0.08);
  }
  .ra-period-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 220px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(10,76,134,0.13), 0 2px 8px rgba(0,0,0,0.06);
    z-index: 100;
    overflow: hidden;
    padding: 0.3rem;
  }
  .ra-period-group-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #94a3b8;
    padding: 0.5rem 0.75rem 0.25rem;
    font-family: 'Poppins', sans-serif;
  }
  .ra-period-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.42rem 0.75rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    font-family: 'Poppins', sans-serif;
    font-size: 12.5px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, color 0.12s;
    gap: 0.5rem;
  }
  .ra-period-option:hover {
    background: #f0f6ff;
    color: ${brandBlue};
  }
  .ra-period-option.selected {
    background: rgba(13,81,140,0.08);
    color: ${brandBlue};
    font-weight: 600;
  }
  .ra-period-option .ra-period-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${brandBlue};
    opacity: 0;
    flex-shrink: 0;
  }
  .ra-period-option.selected .ra-period-dot {
    opacity: 1;
  }
  .ra-period-divider {
    height: 1px;
    background: #f1f5f9;
    margin: 0.3rem 0.5rem;
  }

  .ra-export-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.42rem 0.9rem;
    border-radius: 8px;
    border: 1.5px solid ${brandBlue};
    background: transparent;
    color: ${brandBlue};
    font-family: 'Poppins', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.12s;
  }
  .ra-export-btn:hover {
    background: ${brandBlue};
    color: #ffffff;
  }

  .ra-table-card {
    background: #fff;
    border-radius: 18px;
    border: 1px solid #e8edf2;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04);
  }
  .ra-table-toolbar {
    padding: 0.9rem 1.2rem;
    border-bottom: 1px solid #e8edf2;
    background: #fafcff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }

  .ra-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ra-table thead tr {
    background: #f0f5fb;
    border-bottom: 1px solid #dde6f0;
  }
  .ra-table th {
    text-align: left;
    padding: 0.5rem 1.2rem;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .ra-table td {
    padding: 0.6rem 1.2rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: middle;
  }
  .ra-table tr:last-child td { border-bottom: none; }
  .ra-table tr:hover td { background: #f9fafb; }

  .ra-donut-legend {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .ra-donut-legend-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }
  .ra-donut-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
    flex-shrink: 0;
  }

  @media (max-width: 1024px) {
    .ra-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .ra-middle-row { grid-template-columns: 1fr !important; }
    .ra-bar-label { width: 100px; font-size: 11px; }
  }
  @media (max-width: 640px) {
    .ra-top-bar { flex-direction: column; align-items: flex-start !important; }
    .ra-tabs-wrap { flex-wrap: wrap; }
  }
  @media (max-width: 480px) {
    .ra-stat-grid { grid-template-columns: 1fr !important; }
    .ra-bar-label { width: 80px; font-size: 10px; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
`;

// ─── Period config ────────────────────────────────────────────────────────────

type PeriodOption = {
  label: string;
  key: string;
  group: string;
};

const PERIOD_OPTIONS: PeriodOption[] = [
  // Current
  { key: "today", label: "Today", group: "Current" },
  { key: "this_week", label: "This Week", group: "Current" },
  { key: "this_month", label: "This Month", group: "Current" },
  { key: "this_quarter", label: "This Quarter", group: "Current" },
  { key: "this_year", label: "This Year", group: "Current" },
  // Past
  { key: "yesterday", label: "Yesterday", group: "Past" },
  { key: "last_7_days", label: "Last 7 Days", group: "Past" },
  { key: "last_30_days", label: "Last 30 Days", group: "Past" },
  { key: "last_90_days", label: "Last 90 Days", group: "Past" },
  { key: "last_month", label: "Last Month", group: "Past" },
  { key: "last_quarter", label: "Last Quarter", group: "Past" },
  { key: "last_year", label: "Last Year", group: "Past" },
  // All time
  { key: "all_time", label: "All Time", group: "All" },
];

function getPeriodRange(key: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();

  switch (key) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday": {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "this_week": {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "last_7_days":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_30_days":
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_90_days":
      start.setDate(now.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "this_month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_month": {
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // last day of previous month
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "this_quarter": {
      const q = Math.floor(start.getMonth() / 3);
      start.setMonth(q * 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "last_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const yr = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      start.setFullYear(yr, prevQ * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(yr, prevQ * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "this_year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_year":
      start.setFullYear(now.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "all_time":
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function toISO(d: Date): string {
  return d.toISOString();
}

type FileReportRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: string;
  department_id: string;
  issue_type: string | null;
  date_submitted: string;
  created_at: string;
};

function normalizeIssueCategory(raw: string | null): string {
  if (!raw) return "Others";
  if (raw === "Network / Internet") return "Internet";
  if (raw === "Hardware" || raw === "Software" || raw === "Internet") return raw;
  return "Others";
}

function fmtTableDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  } catch {
    return "—";
  }
}

const statusColors: Record<string, { bg: string; color: string }> = {
  Resolved: { bg: "rgba(22,163,74,0.12)", color: "#15803d" },
  "In Progress": { bg: "rgba(234,179,8,0.12)", color: "#a16207" },
  Pending: { bg: "rgba(59,130,246,0.10)", color: "#475569" },
};

function displayFileReportStatus(s: string): string {
  return s === "Pending" ? "Assigned" : s;
}

type DonutSeg = { label: string; value: number; color: string };

const DonutChart: React.FC<{ segments: DonutSeg[] }> = ({ segments }) => {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const cx = 60, cy = 60, r = 48, strokeW = 14;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#94a3b8" fontFamily="Poppins,sans-serif">
          No data
        </text>
      </svg>
    );
  }

  const circles = segments.map((seg, i) => {
    const dash = (seg.value / total) * circ;
    const gap = circ - dash;
    const offset = segments.slice(0, i).reduce((sum, s) => sum + (s.value / total) * circ + 1.5, 0);
    return (
      <circle
        key={seg.label + i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeW}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform="rotate(-90, 60, 60)"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.16,1,0.3,1)" }}
      />
    );
  });

  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
      {circles}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill="#111827" fontFamily="Poppins,sans-serif">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="Poppins,sans-serif" letterSpacing="0.08em">
        TOTAL
      </text>
    </svg>
  );
};

// ─── Period Dropdown ──────────────────────────────────────────────────────────

const PeriodDropdown: React.FC<{
  value: string;
  onChange: (key: string) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = PERIOD_OPTIONS.find(o => o.key === value);
  const groups = Array.from(new Set(PERIOD_OPTIONS.map(o => o.group)));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="ra-period-dropdown" ref={ref}>
      <button
        type="button"
        className={`ra-period-btn${open ? " open" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Calendar size={12} strokeWidth={2.2} />
          {selected?.label ?? "Select period"}
        </span>
        <ChevronDown size={13} strokeWidth={2.2} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="ra-period-menu">
          {groups.map((group, gi) => (
            <div key={group}>
              {gi > 0 && <div className="ra-period-divider" />}
              <div className="ra-period-group-label">{group}</div>
              {PERIOD_OPTIONS.filter(o => o.group === group).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  className={`ra-period-option${value === opt.key ? " selected" : ""}`}
                  onClick={() => { onChange(opt.key); setOpen(false); }}
                >
                  <span className="ra-period-dot" />
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ReportAnalytics: React.FC = () => {
  const [activePeriod, setActivePeriod] = useState<string>("this_month");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<FileReportRow[]>([]);
  const [deptNameById, setDeptNameById] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { start, end } = getPeriodRange(activePeriod);

    const isAllTime = activePeriod === "all_time";

    const reportsQuery = supabase
      .from("file_reports")
      .select("id, ticket_number, title, status, department_id, issue_type, date_submitted, created_at")
      .order("date_submitted", { ascending: false });

    if (!isAllTime) {
      reportsQuery
        .gte("date_submitted", toISO(start))
        .lte("date_submitted", toISO(end));
    }

    const [{ data: depts, error: deptErr }, { data: reports, error: repErr }] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      reportsQuery,
    ]);

    if (deptErr) { setLoadError(deptErr.message); setTickets([]); setLoading(false); return; }
    if (repErr) { setLoadError(repErr.message); setTickets([]); setLoading(false); return; }

    const map: Record<string, string> = {};
    (depts ?? []).forEach((d: { id: string; name: string }) => { map[d.id] = d.name; });
    setDeptNameById(map);
    setTickets((reports ?? []) as FileReportRow[]);
    setLoading(false);
  }, [activePeriod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`report_analytics_sync_${activePeriod}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => { void fetchData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activePeriod, fetchData]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === "Resolved").length;
    const pending = tickets.filter(t => t.status === "Pending").length;
    const inProgress = tickets.filter(t => t.status === "In Progress").length;
    const resolutionPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, pending, inProgress, resolutionPct };
  }, [tickets]);

  const selectedLabel = PERIOD_OPTIONS.find(o => o.key === activePeriod)?.label ?? "Period";

  const statCards = useMemo(
    () => [
      {
        label: "Total Tickets",
        value: stats.total,
        accent: brandBlue,
        icon: BarChart2,
        delta: `In ${selectedLabel.toLowerCase()}`,
      },
      {
        label: "Resolved",
        value: stats.resolved,
        accent: "#16a34a",
        icon: CheckCircle2,
        delta: stats.total > 0 ? `${stats.resolutionPct}% resolution rate` : "No tickets in period",
      },
      {
        label: "Assigned",
        value: stats.pending,
        accent: "#ca8a04",
        icon: Clock,
        delta: stats.total > 0 ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : "—",
      },
      {
        label: "In Progress",
        value: stats.inProgress,
        accent: "#0369a1",
        icon: Loader,
        delta: "Actively assigned",
      },
    ],
    [stats, selectedLabel]
  );

  const deptTickets = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const id = t.department_id || "unknown";
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, count]) => ({
        id,
        name: deptNameById[id] ?? (id === "unknown" ? "Unassigned" : "Unknown dept"),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(row => ({ name: row.name, count: row.count, color: hashDeptColor(row.name) }));
  }, [tickets, deptNameById]);

  const maxDept = Math.max(1, ...deptTickets.map(d => d.count));

  const donutData = useMemo(() => {
    const bucket: Record<string, number> = { Hardware: 0, Software: 0, Internet: 0, Others: 0 };
    tickets.forEach(t => {
      const cat = normalizeIssueCategory(t.issue_type);
      if (cat in bucket) bucket[cat] += 1;
      else bucket.Others += 1;
    });
    return (["Hardware", "Software", "Internet", "Others"] as const)
      .map(label => ({ label, value: bucket[label], color: ISSUE_DONUT_COLORS[label] ?? "#ca8a04" }))
      .filter(s => s.value > 0);
  }, [tickets]);

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const recentTickets = useMemo(() => {
    return tickets.slice(0, 8).map(t => ({
      rowId: t.id,
      id: t.ticket_number?.trim() || `TKT-${t.id.slice(0, 8).toUpperCase()}`,
      title: t.title,
      dept: deptNameById[t.department_id] ?? "—",
      status: t.status,
      date: fmtTableDate(t.date_submitted),
    }));
  }, [tickets, deptNameById]);

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

const StatCardSkeleton: React.FC = () => (
  <div className="ra-stat-card" style={{ position: "relative", overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
      <Skeleton width="55%" height={11} radius={4} />
      <Skeleton width={30} height={30} radius={8} />
    </div>
    <Skeleton width="45%" height={28} radius={6} style={{ marginBottom: 6 }} />
    <Skeleton width="70%" height={10} radius={4} />
  </div>
);

const PanelSkeletonRA: React.FC<{ height?: number }> = ({ height = 220 }) => (
  <div className="ra-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <Skeleton width={15} height={15} radius={4} />
      <Skeleton width="40%" height={14} radius={5} />
    </div>
    <Skeleton width="100%" height={height * 0.45} radius={8} />
    {[0,1,2].map(i => <Skeleton key={i} width={`${80 - i * 15}%`} height={10} radius={4} />)}
  </div>
);

const TableRowSkeletonRA: React.FC = () => (
  <tr>
    <td style={{ padding: "0.6rem 1.2rem" }}><Skeleton width={80} height={12} radius={4} /></td>
    <td style={{ padding: "0.6rem 1.2rem" }}><Skeleton width="85%" height={12} radius={4} /></td>
    <td style={{ padding: "0.6rem 1.2rem" }}><Skeleton width="70%" height={12} radius={4} /></td>
    <td style={{ padding: "0.6rem 1.2rem" }}><Skeleton width={70} height={22} radius={999} /></td>
    <td style={{ padding: "0.6rem 1.2rem" }}><Skeleton width={80} height={11} radius={4} /></td>
  </tr>
);

  return (
    <>
      <style>{raStyles}</style>
      <div className="ra-root" style={{ display: "flex", flexDirection: "column", gap: "1.2rem", paddingRight: "1rem" }}>
        {/* Top Bar */}
        <div
          className="ra-top-bar"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: brandBlue }}>
              <TrendingUp size={20} color={brandBlue} />
              Reports & Analytics
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0", fontWeight: 400 }}>
              IT Helpdesk ticket metrics by period (live data).
            </p>
          </div>

          <div className="ra-tabs-wrap" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <PeriodDropdown value={activePeriod} onChange={setActivePeriod} />
            <button type="button" className="ra-export-btn">
              <Download size={13} strokeWidth={2.2} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
            Could not load reports: {loadError}
          </div>
        )}

        {loading ? (
         <>
              {/* Stat cards skeleton */}
              <div className="ra-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "0.9rem" }}>
                {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
              </div>

              {/* Middle row skeleton */}
              <div className="ra-middle-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.1rem" }}>
                <PanelSkeletonRA height={240} />
                <PanelSkeletonRA height={240} />
              </div>

              {/* Table skeleton */}
              <div className="ra-table-card">
                <div className="ra-table-toolbar">
                  <Skeleton width={15} height={15} radius={4} />
                  <Skeleton width={140} height={14} radius={5} />
                </div>
                <table className="ra-table">
                  <thead>
                    <tr style={{ background: "#f0f5fb", borderBottom: "1px solid #dde6f0" }}>
                      {["Ticket ID","Title","Department","Status","Date"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => <TableRowSkeletonRA key={i} />)}
                  </tbody>
                </table>
              </div>
            </>
        ) : (
          <>
            {/* Stat Cards */}
            <div
              className="ra-stat-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "0.9rem" }}
            >
              {statCards.map(({ label, value, accent, icon: Icon, delta }) => (
                <div key={label} className="ra-stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                      {label}
                    </span>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={15} strokeWidth={2} color={accent} />
                    </div>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{delta}</span>
                </div>
              ))}
            </div>

            {/* Middle Row */}
            <div className="ra-middle-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.1rem" }}>
              <div className="ra-panel">
                <div className="ra-panel-title">
                  <TrendingUp size={15} color={brandBlue} strokeWidth={2.2} />
                  Tickets by Department
                </div>
                {deptTickets.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>No tickets in this period.</p>
                ) : (
                  deptTickets.map(dept => (
                    <div key={dept.name} className="ra-bar-row">
                      <span className="ra-bar-label">{dept.name}</span>
                      <div className="ra-bar-track">
                        <div className="ra-bar-fill" style={{ width: `${(dept.count / maxDept) * 100}%`, background: dept.color }} />
                      </div>
                      <span className="ra-bar-value">{dept.count}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="ra-panel" style={{ display: "flex", flexDirection: "column" }}>
                <div className="ra-panel-title">
                  <BarChart2 size={15} color={brandBlue} strokeWidth={2.2} />
                  Issue Type
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: "0.25rem" }}>
                  <DonutChart segments={donutData} />
                </div>
                <div className="ra-donut-legend">
                  {donutTotal === 0 ? (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>No tickets in this period.</span>
                  ) : (
                    donutData.map(seg => (
                      <div key={seg.label} className="ra-donut-legend-row">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span className="ra-donut-dot" style={{ background: seg.color }} />
                          <span style={{ color: "#475569", fontWeight: 500 }}>{seg.label}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {seg.value}
                          <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 11 }}>
                            {" "}({Math.round((seg.value / donutTotal) * 100)}%)
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Tickets Table */}
            <div className="ra-table-card">
              <div className="ra-table-toolbar">
                <Calendar size={15} color={brandBlue} strokeWidth={2.2} />
                Recent Tickets
              </div>
              <div style={{ padding: "0" }}>
                <table className="ra-table">
                  <thead>
                    <tr>
                      {["Ticket ID", "Title", "Department", "Status", "Date"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: "#94a3b8", textAlign: "center", padding: "1.5rem" }}>
                          No tickets in this period.
                        </td>
                      </tr>
                    ) : (
                      recentTickets.map(t => {
                        const { bg, color } = statusColors[t.status] ?? { bg: "#f1f5f9", color: "#64748b" };
                        return (
                          <tr key={t.rowId}>
                            <td style={{ fontWeight: 600, color: brandBlue }}>{t.id}</td>
                            <td style={{ maxWidth: 160 }}>{t.title}</td>
                            <td style={{ color: "#6b7280" }}>{t.dept}</td>
                            <td>
                              <span className="ra-badge" style={{ background: bg, color }}>{displayFileReportStatus(t.status)}</span>
                            </td>
                            <td style={{ color: "#94a3b8", fontSize: 12 }}>{t.date}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ReportAnalytics;