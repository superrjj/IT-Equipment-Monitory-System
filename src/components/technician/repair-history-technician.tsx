import React, { useState, useEffect, useMemo } from "react";
import { Search, ClipboardList, Loader, CheckCircle } from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";
import { supabase } from "../../lib/supabaseClient";

const BRAND = "#0a4c86";

type Row = {
  id: string;
  problem: string | null;
  action_taken: string;
  completed_at: string | null;
  started_at: string | null;
  ticket_number?: string | null;
  ticket_title?: string | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : "—";

const RepairHistoryTechnician: React.FC = () => {
  const userId = getSessionUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadRepairHistory = async () => {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("repairs")
        .select(
          `id, problem, action_taken, completed_at, started_at,
           file_reports ( ticket_number, title )`
        )
        .contains("assigned_to", [userId])
        .eq("status", "Completed")
        .order("completed_at", { ascending: false });

      if (error) setRows([]);
      else {
        setRows(
          (data ?? []).map((repairRow: any) => ({
            id: repairRow.id,
            problem: repairRow.problem,
            action_taken: repairRow.action_taken,
            completed_at: repairRow.completed_at,
            started_at: repairRow.started_at,
            ticket_number: repairRow.file_reports?.ticket_number ?? null,
            ticket_title: repairRow.file_reports?.title ?? null,
          }))
        );
      }
      setLoading(false);
    };
    loadRepairHistory();
  }, [userId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(repairRow =>
      [repairRow.ticket_number, repairRow.ticket_title, repairRow.problem, repairRow.action_taken]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 360,
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    background: "#f8fafc",
  };

  if (!userId) {
    return <div style={{ padding: 24, color: "#94a3b8", fontFamily: "'Poppins', sans-serif" }}>Session missing.</div>;
  }

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={20} color={BRAND} /> Repair History
        </h2>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>Your completed repair jobs (read only).</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: "0.9rem 1rem", marginBottom: "1rem" }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Ticket", "Problem", "Completed", "Outcome"].map(h => (
                <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  <Loader size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  No completed repairs yet.
                </td>
              </tr>
            ) : (
              filtered.map(repairRow => (
                <tr key={repairRow.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND }}>
                    {repairRow.ticket_number ?? "—"}
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>{repairRow.ticket_title}</div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{repairRow.problem ?? "—"}</td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap", color: "#64748b" }}>
                    <CheckCircle size={14} color="#16a34a" style={{ verticalAlign: "middle", marginRight: 6 }} />
                    {fmtDate(repairRow.completed_at)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#374151", maxWidth: 280 }}>{repairRow.action_taken || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RepairHistoryTechnician;
