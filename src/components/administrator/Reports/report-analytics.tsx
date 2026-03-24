import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart2,
  TrendingUp,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  Loader,
} from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const brandBlue = "#0a4c86";

const DEPT_BAR_COLORS = [
  brandBlue,
  "#0369a1",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#dc2626",
  "#64748b",
];

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
  }

  .ra-stat-card {
    background: #ffffff;
    border-radius: 18px;
    padding: 1.25rem 1.4rem;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .ra-panel {
    background: #ffffff;
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    border: 1px solid #e2e8f0;
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

  .ra-tab {
    padding: 0.38rem 0.85rem;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: transparent;
    font-family: 'Poppins', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.16s;
  }
  .ra-tab:hover { background: #f8fafc; }
  .ra-tab.active {
    background: ${brandBlue};
    border-color: ${brandBlue};
    color: #ffffff;
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
    transition: background 0.16s, color 0.16s;
  }
  .ra-export-btn:hover {
    background: ${brandBlue};
    color: #ffffff;
  }

  .ra-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ra-table th {
    text-align: left;
    padding: 0.5rem 0.5rem;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    border-bottom: 1px solid #e5e7eb;
  }
  .ra-table td {
    padding: 0.6rem 0.5rem;
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
`;

type PeriodTab = "This Week" | "This Month" | "This Quarter" | "This Year";

function getPeriodRange(tab: PeriodTab): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();

  if (tab === "This Week") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
  } else if (tab === "This Month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (tab === "This Quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
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
  description: string | null;
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
  Pending: { bg: "rgba(220,38,38,0.12)", color: "#b91c1c" },
};

type DonutSeg = { label: string; value: number; color: string };

const DonutChart: React.FC<{ segments: DonutSeg[] }> = ({ segments }) => {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const cx = 60,
    cy = 60,
    r = 48,
    strokeW = 14;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={12}
          fill="#94a3b8"
          fontFamily="Poppins,sans-serif"
        >
          No data
        </text>
      </svg>
    );
  }

  const circles = segments.map((seg, i) => {
    const dash = (seg.value / total) * circ;
    const gap = circ - dash;
    const offset =
      segments.slice(0, i).reduce((sum, s) => sum + (s.value / total) * circ + 1.5, 0);
    return (
      <circle
        key={seg.label + i}
        cx={cx}
        cy={cy}
        r={r}
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
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight={700}
        fill="#111827"
        fontFamily="Poppins,sans-serif"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fontSize={9}
        fill="#94a3b8"
        fontFamily="Poppins,sans-serif"
        letterSpacing="0.08em"
      >
        TOTAL
      </text>
    </svg>
  );
};

const ReportAnalytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PeriodTab>("This Month");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<FileReportRow[]>([]);
  const [deptNameById, setDeptNameById] = useState<Record<string, string>>({});

  const tabs: PeriodTab[] = ["This Week", "This Month", "This Quarter", "This Year"];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { start, end } = getPeriodRange(activeTab);
    const startISO = toISO(start);
    const endISO = toISO(end);

    const [{ data: depts, error: deptErr }, { data: reports, error: repErr }] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase
        .from("file_reports")
        .select(
          "id, ticket_number, title, description, status, department_id, issue_type, date_submitted, created_at"
        )
        .gte("date_submitted", startISO)
        .lte("date_submitted", endISO)
        .order("date_submitted", { ascending: false }),
    ]);

    if (deptErr) {
      setLoadError(deptErr.message);
      setTickets([]);
      setLoading(false);
      return;
    }
    if (repErr) {
      setLoadError(repErr.message);
      setTickets([]);
      setLoading(false);
      return;
    }

    const map: Record<string, string> = {};
    (depts ?? []).forEach((d: { id: string; name: string }) => {
      map[d.id] = d.name;
    });
    setDeptNameById(map);
    setTickets((reports ?? []) as FileReportRow[]);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`report_analytics_sync_${activeTab.replace(/\s+/g, "_").toLowerCase()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void fetchData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => { void fetchData(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeTab, fetchData]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === "Resolved").length;
    const pending = tickets.filter(t => t.status === "Pending").length;
    const inProgress = tickets.filter(t => t.status === "In Progress").length;
    const resolutionPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, pending, inProgress, resolutionPct };
  }, [tickets]);

  const statCards = useMemo(
    () => [
      {
        label: "Total Tickets",
        value: stats.total,
        accent: brandBlue,
        icon: BarChart2,
        delta: `In ${activeTab.toLowerCase()}`,
      },
      {
        label: "Resolved",
        value: stats.resolved,
        accent: "#16a34a",
        icon: CheckCircle2,
        delta: stats.total > 0 ? `${stats.resolutionPct}% resolution rate` : "No tickets in period",
      },
      {
        label: "Pending",
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
    [stats, activeTab]
  );

  const deptTickets = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const id = t.department_id || "unknown";
      counts[id] = (counts[id] ?? 0) + 1;
    });
    const rows = Object.entries(counts)
      .map(([id, count]) => ({
        id,
        name: deptNameById[id] ?? (id === "unknown" ? "Unassigned" : "Unknown dept"),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    return rows.map((row, i) => ({
      name: row.name,
      count: row.count,
      color: DEPT_BAR_COLORS[i % DEPT_BAR_COLORS.length],
    }));
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
      .map(label => ({
        label,
        value: bucket[label],
        color: ISSUE_DONUT_COLORS[label] ?? "#ca8a04",
      }))
      .filter(s => s.value > 0);
  }, [tickets]);

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const recentTickets = useMemo(() => {
    return tickets.slice(0, 8).map(t => ({
      rowId: t.id,
      id: t.ticket_number?.trim() || `TKT-${t.id.slice(0, 8).toUpperCase()}`,
      title: t.title,
      dept: deptNameById[t.department_id] ?? "—",
      issue: (t.description ?? "").trim() || "—",
      status: t.status,
      date: fmtTableDate(t.date_submitted),
    }));
  }, [tickets, deptNameById]);

  return (
    <>
      <style>{raStyles}</style>
      <div
        className="ra-root"
        style={{ display: "flex", flexDirection: "column", gap: "1.2rem", paddingRight: "1rem" }}
      >
        <div
          className="ra-top-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: 2 }}>
              Reports & Analytics
            </h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0", fontWeight: 400 }}>
              IT Helpdesk ticket metrics by period (live data).
            </p>
          </div>

          <div className="ra-tabs-wrap" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {tabs.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`ra-tab${activeTab === t ? " active" : ""}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <button type="button" className="ra-export-btn">
              <Download size={13} strokeWidth={2.2} />
              Export PDF
            </button>
          </div>
        </div>

        {loadError && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            Could not load reports: {loadError}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "3rem",
              color: "#94a3b8",
              fontSize: 14,
            }}
          >
            <Loader size={22} className="ra-spin" style={{ animation: "spin 0.9s linear infinite" }} />
            Loading analytics…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            <div
              className="ra-stat-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "0.9rem" }}
            >
              {statCards.map(({ label, value, accent, icon: Icon, delta }) => (
                <div key={label} className="ra-stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </span>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: `${accent}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={15} strokeWidth={2} color={accent} />
                    </div>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{delta}</span>
                </div>
              ))}
            </div>

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
                        <div
                          className="ra-bar-fill"
                          style={{
                            width: `${(dept.count / maxDept) * 100}%`,
                            background: dept.color,
                          }}
                        />
                      </div>
                      <span className="ra-bar-value">{dept.count}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="ra-panel" style={{ display: "flex", flexDirection: "column" }}>
                <div className="ra-panel-title">
                  <BarChart2 size={15} color={brandBlue} strokeWidth={2.2} />
                  Issue type
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
                            {" "}
                            ({Math.round((seg.value / donutTotal) * 100)}%)
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="ra-panel">
              <div className="ra-panel-title" style={{ marginBottom: "0.5rem" }}>
                <Calendar size={15} color={brandBlue} strokeWidth={2.2} />
                Recent Tickets
              </div>
              <table className="ra-table">
                <thead>
                  <tr>
                    {["Ticket ID", "Title", "Department", "Description", "Status", "Date"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: "#94a3b8", textAlign: "center", padding: "1.5rem" }}>
                        No tickets in this period.
                      </td>
                    </tr>
                  ) : (
                    recentTickets.map(t => {
                      const { bg, color } = statusColors[t.status] ?? {
                        bg: "#f1f5f9",
                        color: "#64748b",
                      };
                      return (
                        <tr key={t.rowId}>
                          <td style={{ fontWeight: 600, color: brandBlue }}>{t.id}</td>
                          <td style={{ maxWidth: 160 }}>{t.title}</td>
                          <td style={{ color: "#6b7280" }}>{t.dept}</td>
                          <td style={{ color: "#4b5563", maxWidth: 220, wordBreak: "break-word" }}>
                            {t.issue.length > 120 ? `${t.issue.slice(0, 120)}…` : t.issue}
                          </td>
                          <td>
                            <span className="ra-badge" style={{ background: bg, color }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ color: "#94a3b8", fontSize: 12 }}>{t.date}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ReportAnalytics;
