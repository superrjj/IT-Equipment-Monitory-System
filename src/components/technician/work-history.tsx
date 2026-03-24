import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Eye, Search, X, Clock, Loader,
  BadgeAlert, User, CheckCircle2,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string;
  status: string;
  employee_name: string;
  department_id: string;
  issue_type: string;
  date_submitted: string;
  assigned_to: string[];
  action_taken: string;
  started_at: string | null;
  completed_at: string | null;
};

type DeptMap = Record<string, string>;

const BRAND = "#0a4c86";

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "—";

const WorkHistory: React.FC = () => {
  const userId = getSessionUserId();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [depts, setDepts] = useState<DeptMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: tix, error }, { data: dlist }] = await Promise.all([
      supabase
        .from("file_reports")
        .select("id, ticket_number, title, description, status, employee_name, department_id, issue_type, date_submitted, assigned_to, action_taken, started_at, completed_at")
        .contains("assigned_to", [userId])
        .eq("status", "Resolved")
        .order("completed_at", { ascending: false }),
      supabase.from("departments").select("id, name"),
    ]);
    if (error) { showToast(error.message, "error"); setRows([]); }
    else {
      setRows((tix ?? []).map((r: any) => ({
        ...r,
        assigned_to: Array.isArray(r.assigned_to) ? r.assigned_to : [],
      })));
    }
    const dm: DeptMap = {};
    (dlist ?? []).forEach((d: { id: string; name: string }) => { dm[d.id] = d.name; });
    setDepts(dm);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.title, r.description, r.employee_name, r.ticket_number ?? "", r.issue_type]
        .join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    background: "#f8fafc",
    boxSizing: "border-box",
  };

  if (!userId) return <div style={{ padding: 24, color: "#94a3b8" }}>Session missing.</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .wh-row:hover { background: #f8fafc !important; }
      `}</style>
      <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            padding: "0.65rem 1.1rem", borderRadius: 10, fontSize: 13,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color: toast.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={20} color="#10b981" /> Work History
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            All tickets you have resolved — read-only record of completed work.
          </p>
        </div>

        {/* Search */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: "0.9rem 1rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resolved tickets…"
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ID", "Title", "Requester", "Office", "Resolved On", "Actions"].map(h => (
                  <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    <Loader size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    No resolved tickets yet.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="wh-row" style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND }}>
                      {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{r.title}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.employee_name}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>{depts[r.department_id] ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#10b981", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {fmtDate(r.completed_at)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button
                        type="button"
                        title="View"
                        onClick={() => setSelected(r)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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

        {/* View Modal */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 18, padding: "1.5rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selected.title}</h3>
                <button type="button" onClick={() => setSelected(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 10 }}>
                <div><User size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />{selected.employee_name} · {depts[selected.department_id]}</div>
                <div><BadgeAlert size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />{selected.issue_type}</div>
                <div><Clock size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />Submitted: {fmtDate(selected.date_submitted)}</div>
                <div><CheckCircle2 size={12} color="#10b981" style={{ marginRight: 6, verticalAlign: "middle" }} />Resolved: {fmtDate(selected.completed_at)}</div>

                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                  {selected.description || "—"}
                </div>

                {/* Resolution badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.10)", color: "#10b981" }}>
                    ✓ Resolved
                  </span>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: "uppercase", marginTop: 4 }}>Action taken</div>
                <div style={{ fontSize: 13, background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                  {selected.action_taken || "—"}
                </div>

                <div style={{ display: "flex", gap: "1rem", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  <span>Start: <strong style={{ color: "#0f172a" }}>{fmtDate(selected.started_at)}</strong></span>
                  <span>End: <strong style={{ color: "#10b981" }}>{fmtDate(selected.completed_at)}</strong></span>
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