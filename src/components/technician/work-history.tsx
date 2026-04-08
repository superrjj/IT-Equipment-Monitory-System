import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Eye, Search, X, Clock, Loader, Calendar,
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
import { supabase } from "../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";
import { ShimmerKeyframes, Skeleton } from "@/components/ui/skeleton";

const BRAND = "#0D518C";
const GREEN = "#16a34a";

const WorkHistory: React.FC = () => {
  const userId   = getSessionUserId();
  const userRole = localStorage.getItem("session_user_role") || "";
  const isAdmin  = userRole === "Administrator";

  const [rows, setRows]               = useState<TicketRow[]>([]);
  const [depts, setDepts]             = useState<DeptMap>({});
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<TicketRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting]     = useState<"excel" | "word" | null>(null);
  const [exportMonth, setExportMonth] = useState<string>("");
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    let query = supabase
      .from("file_reports")
      .select("id, ticket_number, title, status, employee_name, department_id, issue_type, date_submitted, assigned_to, action_taken, started_at, completed_at")
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

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(getMonthYear(r.completed_at)));
    return Array.from(set).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [rows]);

  const resolvedMonthFilter = exportMonth || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q || [r.title, r.employee_name, r.ticket_number ?? "", r.issue_type]
        .join(" ").toLowerCase().includes(q);
      const matchMonth = selectedMonth === "All" || getMonthYear(r.completed_at) === selectedMonth;
      return matchSearch && matchMonth;
    });
  }, [rows, search, selectedMonth]);

  const handleExcelExport = () => {
    setExportMenuOpen(false);
    if (rows.length === 0) { showToast("No records to export.", "error"); return; }
    setExporting("excel");
    try {
      exportToExcel(rows, depts, resolvedMonthFilter ? [resolvedMonthFilter] : []);
      showToast(resolvedMonthFilter ? `Excel exported for ${resolvedMonthFilter}.` : "Excel file downloaded!", "success");
    } catch {
      showToast("Failed to export Excel.", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleWordExport = async () => {
    setExportMenuOpen(false);
    if (rows.length === 0) { showToast("No records to export.", "error"); return; }
    setExporting("word");
    try {
      await exportToWord(rows, depts, resolvedMonthFilter ? [resolvedMonthFilter] : []);
      showToast(resolvedMonthFilter ? `Word exported for ${resolvedMonthFilter}.` : "Word document downloaded!", "success");
    } catch {
      showToast("Failed to export Word document.", "error");
    } finally {
      setExporting(null);
    }
  };

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
      <ShimmerKeyframes />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .wh-root, .wh-root * { box-sizing: border-box; }
        .wh-row:hover           { background: #f8fafc !important; }
        .wh-export-item:hover   { background: #f1f5f9 !important; }
        .wh-month-select:focus  { outline: 2px solid #16a34a30; border-color: #16a34a !important; }
        .wh-export-btn:hover:not(:disabled) { background: #15803d !important; border-color: #15803d !important; }
        .icon-btn-wh            { transition: box-shadow 0.15s, transform 0.12s !important; }
        .icon-btn-wh:hover      { background: #f1f5f9 !important; box-shadow: 0 3px 8px rgba(0,0,0,0.10) !important; transform: translateY(-1px); }
        @keyframes spin         { to { transform: rotate(360deg); } }
      `}</style>

      {/* 1. paddingTop on root div */}
      <div className="wh-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a", paddingTop: "2rem" }}>

        <CrudAlertToast toast={toast} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", letterSpacing: 1, color: BRAND }}>
              <CheckCircle2 size={20} color="#10b981" />
              {isAdmin ? "All Resolved Tickets" : "Work History"}
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
              {isAdmin
                ? "Complete record of all resolved tickets — export to Excel or Word by month."
                : "All tickets you have resolved — read-only record of completed work."}
            </p>
          </div>

          {/* 2. Export button — added boxShadow + transform transition */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="wh-export-btn"
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={!!exporting || rows.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.5rem 1rem", borderRadius: 10,
                border: `1.5px solid ${GREEN}`,
                background: GREEN, color: "#fff",
                fontSize: 13, fontWeight: 600,
                cursor: exporting || rows.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "'Poppins', sans-serif",
                opacity: exporting || rows.length === 0 ? 0.6 : 1,
                // ↓ changed
                transition: "background 0.15s, opacity 0.15s, transform 0.12s",
                boxShadow: "0 4px 14px rgba(22,163,74,0.28)",
              }}
            >
              {exporting
                ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <FileSpreadsheet size={14} />
              }
              Export
              <ChevronDown size={14} />
            </button>

            {/* 3. Export dropdown — updated boxShadow */}
            {exportMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                // ↓ changed
                boxShadow: "0 8px 32px rgba(10,76,134,0.13), 0 2px 8px rgba(0,0,0,0.06)",
                zIndex: 200, minWidth: 248, overflow: "hidden",
              }}>
                <div style={{
                  padding: "0.5rem 1rem", background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: 11, color: "#64748b", fontWeight: 600,
                }}>
                  {rows.length} record{rows.length !== 1 ? "s" : ""} total
                </div>

                <div style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Calendar size={12} color={GREEN} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Filter by month</span>
                  </div>
                  <select
                    className="wh-month-select"
                    value={exportMonth}
                    onChange={e => setExportMonth(e.target.value)}
                    style={{
                      width: "100%", padding: "0.4rem 0.6rem",
                      borderRadius: 7, border: "1px solid #e2e8f0",
                      fontSize: 12, fontFamily: "'Poppins', sans-serif",
                      color: "#0f172a", background: "#f8fafc",
                      cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="">— All records —</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>
                        {m} ({rows.filter(r => getMonthYear(r.completed_at) === m).length})
                      </option>
                    ))}
                  </select>
                  {exportMonth && (
                    <div style={{ marginTop: 5, fontSize: 11, color: GREEN, fontWeight: 500 }}>
                      {rows.filter(r => getMonthYear(r.completed_at) === exportMonth).length} record(s) will be exported
                    </div>
                  )}
                </div>

                <button type="button" className="wh-export-item" onClick={handleExcelExport}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                  <FileSpreadsheet size={16} color={GREEN} />
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

        {/* 4. Filter bar — added boxShadow + deeper border */}
        <div style={{
          background: "#fff", borderRadius: 18,
          // ↓ changed
          border: "1px solid #e8edf2",
          boxShadow: "0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04)",
          padding: "0.9rem 1rem", marginBottom: "1rem",
          display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
        }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resolved tickets…"
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>Month:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ ...inputStyle, width: "auto", paddingRight: "1.5rem", cursor: "pointer" }}
            >
              <option value="All">All</option>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "4px 12px", borderRadius: 999, fontWeight: 600, whiteSpace: "nowrap" }}>
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* 5. Table card — added boxShadow + deeper border */}
        <div style={{
          background: "#fff", borderRadius: 18,
          // ↓ changed
          border: "1px solid #e8edf2",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        }}>

          {/* 6. Table toolbar */}
          <div style={{
            padding: "0.9rem 1.2rem",
            // ↓ changed
            borderBottom: "1px solid #e8edf2",
            background: "#fafcff",
            display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center",
          }}>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              {/* 7. thead — tinted header */}
              <thead>
                <tr style={{
                  // ↓ changed
                  background: "#f0f5fb",
                  borderBottom: "1px solid #dde6f0",
                }}>
                  {["ID", "Title", "Requester", "Office", "Issue Type", "Resolved On", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, rowIdx) => (
                    <tr key={rowIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      {[0, 1, 2, 3, 4, 5, 6].map(col => (
                        <td key={col} style={{ padding: "0.75rem 1rem" }}>
                          <Skeleton
                            height={12}
                            radius={4}
                            width={col === 0 ? 88 : col === 4 ? 72 : col === 5 ? 100 : "90%"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                      No resolved tickets found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => (
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
                        {/* 8. Action button — added class + boxShadow + deeper border */}
                        <button
                          type="button"
                          title="View details"
                          onClick={() => setSelected(r)}
                          className="icon-btn-wh"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            // ↓ changed
                            border: "1px solid #e8edf2",
                            background: "#fff",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Eye size={14} color={BRAND} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View modal — updated boxShadow */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{
              background: "#fff", borderRadius: 18, padding: "1.5rem",
              maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto",
              // ↓ changed
              boxShadow: "0 24px 60px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8, color: BRAND, letterSpacing: 1, fontFamily: "'Poppins', sans-serif" }}>{selected.title}</h2>
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