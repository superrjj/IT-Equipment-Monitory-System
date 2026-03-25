import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Eye, Search, X, Clock, Loader,
  BadgeAlert, User, CheckCircle2, FileSpreadsheet, FileText, ChevronDown,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";
import {
  exportToExcel,
  exportToWord,
  fmtDate,
  getMonthYear,
  monthSortKey,
  type TicketRow,
  type DeptMap,
} from "../../utils/exportWorkHistory";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const BRAND = "#0a4c86";

// ─── WorkHistory Component ────────────────────────────────────────────────────
const WorkHistory: React.FC = () => {
  const userId   = getSessionUserId();
  const userRole = localStorage.getItem("session_user_role") || "";
  const isAdmin  = userRole === "Administrator";

  const [rows, setRows]                     = useState<TicketRow[]>([]);
  const [depts, setDepts]                   = useState<DeptMap>({});
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [selected, setSelected]             = useState<TicketRow | null>(null);
  const [selectedMonth, setSelectedMonth]   = useState("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting]           = useState<"excel" | "word" | null>(null);
  const [toast, setToast]                   = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    let query = supabase
      .from("file_reports")
      .select("id, ticket_number, title, description, status, employee_name, department_id, issue_type, date_submitted, assigned_to, action_taken, started_at, completed_at")
      .eq("status", "Resolved")
      .order("completed_at", { ascending: false });

    if (!isAdmin) {
      if (!userId) { setRows([]); setLoading(false); return; }
      query = query.contains("assigned_to", [userId]);
    }

    const [{ data: tix, error }, { data: dlist }] = await Promise.all([
      query,
      supabase.from("departments").select("id, name"),
    ]);

    if (error) { showToast(error.message, "error"); setRows([]); }
    else setRows((tix ?? []).map((r: any) => ({
      ...r,
      assigned_to: Array.isArray(r.assigned_to) ? r.assigned_to : [],
    })));

    const dm: DeptMap = {};
    (dlist ?? []).forEach((d: any) => { dm[d.id] = d.name; });
    setDepts(dm);
    setLoading(false);
  };

  useEffect(() => { void fetchAll(); }, [userId, isAdmin]);

  useEffect(() => {
    const key = isAdmin ? "work_history_admin" : `work_history_${userId}`;
    const ch  = supabase.channel(key)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" },  () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" },   () => void fetchAll())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, isAdmin]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(getMonthYear(r.completed_at)));
    return ["All", ...Array.from(set).sort((a, b) => monthSortKey(b) - monthSortKey(a))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchSearch = !q || [r.title, r.description, r.employee_name, r.ticket_number ?? "", r.issue_type]
        .join(" ").toLowerCase().includes(q);
      const matchMonth = selectedMonth === "All" || getMonthYear(r.completed_at) === selectedMonth;
      return matchSearch && matchMonth;
    });
  }, [rows, search, selectedMonth]);

  const exportRows = useMemo(() =>
    selectedMonth === "All"
      ? rows
      : rows.filter((r) => getMonthYear(r.completed_at) === selectedMonth),
    [rows, selectedMonth]
  );

  // ── Export handlers ─────────────────────────────────────────────────────────
  const handleExcelExport = () => {
    setExportMenuOpen(false);
    setExporting("excel");
    try {
      exportToExcel(exportRows, depts, selectedMonth);
      showToast("Excel file downloaded!", "success");
    } catch {
      showToast("Failed to export Excel.", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleWordExport = async () => {
    setExportMenuOpen(false);
    setExporting("word");
    try {
      await exportToWord(exportRows, depts, selectedMonth);
      showToast("Word document downloaded!", "success");
    } catch {
      showToast("Failed to export Word document.", "error");
    } finally {
      setExporting(null);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13,
    fontFamily: "'Poppins', sans-serif", background: "#f8fafc",
    boxSizing: "border-box",
  };

  if (!isAdmin && !userId)
    return <div style={{ padding: 24, color: "#94a3b8" }}>Session missing.</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .wh-row:hover          { background: #f0f7ff !important; }
        .wh-export-item:hover  { background: #f1f5f9 !important; }
        @keyframes spin        { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            padding: "0.65rem 1.1rem", borderRadius: 10, fontSize: 13,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color:      toast.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}>{toast.msg}</div>
        )}

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, letterSpacing: 1 }}>
              <CheckCircle2 size={20} color="#10b981" />
              {isAdmin ? "All Resolved Tickets" : "Work History"}
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
              {isAdmin
                ? "Complete record of all resolved tickets — export to Excel or Word by month."
                : "All tickets you have resolved — read-only record of completed work."}
            </p>
          </div>

          {/* Export dropdown */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={!!exporting}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.5rem 1rem", borderRadius: 10,
                border: `1px solid ${BRAND}`, background: BRAND,
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: exporting ? "not-allowed" : "pointer",
                fontFamily: "'Poppins', sans-serif",
                opacity: exporting ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {exporting && (
                <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
              )}
              Export
              <ChevronDown size={14} />
            </button>

            {exportMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                boxShadow: "0 8px 28px rgba(15,23,42,0.13)", zIndex: 200,
                minWidth: 218, overflow: "hidden",
              }}>
                <div style={{
                  padding: "0.5rem 1rem", background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0", fontSize: 11,
                  color: "#64748b", fontWeight: 600,
                }}>
                  Scope: {selectedMonth === "All" ? "All months" : selectedMonth}
                </div>

                <button type="button" className="wh-export-item" onClick={handleExcelExport}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                  <FileSpreadsheet size={16} color="#16a34a" />
                  Export to Excel (.xlsx)
                </button>

                <div style={{ height: 1, background: "#f1f5f9" }} />

                <button type="button" className="wh-export-item" onClick={handleWordExport}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                  <FileText size={16} color="#2563eb" />
                  Export to Word (.docx)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: "0.9rem 1rem", marginBottom: "1rem", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resolved tickets…"
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ ...inputStyle, width: "auto", paddingRight: "1.5rem", cursor: "pointer" }}
            >
              {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "4px 12px", borderRadius: 999, fontWeight: 600, whiteSpace: "nowrap" }}>
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ID", "Title", "Requester", "Office", "Issue Type", "Resolved On", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    <Loader size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    No resolved tickets found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="wh-row" style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND, whiteSpace: "nowrap" }}>
                      {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{r.title}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.employee_name}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>{depts[r.department_id] ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: 12, color: "#475569" }}>{r.issue_type}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#059669", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {fmtDate(r.completed_at)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button type="button" title="View details" onClick={() => setSelected(r)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Eye size={14} color={BRAND} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* View modal */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 18, padding: "1.5rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selected.title}</h3>
                <button type="button" onClick={() => setSelected(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <User size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {selected.employee_name} · {depts[selected.department_id] ?? "—"}
                </div>
                <div>
                  <BadgeAlert size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {selected.issue_type}
                </div>
                <div>
                  <Clock size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Submitted: {fmtDate(selected.date_submitted)}
                </div>
                <div>
                  <CheckCircle2 size={12} color="#10b981" style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Resolved: {fmtDate(selected.completed_at)}
                </div>

                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                  {selected.description || "—"}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.10)", color: "#10b981" }}>
                    ✓ Resolved
                  </span>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: "uppercase", marginTop: 4 }}>
                  Action Taken
                </div>
                <div style={{ fontSize: 13, background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                  {selected.action_taken || "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WorkHistory;