import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Eye, Search, X, AlertTriangle, Pencil, Ticket,
  Clock, Loader, Building2, User, CheckCircle2, Timer,
} from "lucide-react";
import {
  getSessionUserId,
  insertActivityLog,
  notifyAdminsTicketStatusChanged,
} from "../../lib/audit-notifications";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

type Status = "In Progress" | "Resolved";

type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: Status;
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

// Returns today's date as YYYY-MM-DD in Asia/Manila timezone
function todayPH(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function sanitize(val: string): string {
  return val
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
    .trim();
}

function validateTechUpdate(form: {
  status: Status;
  action_taken: string;
  started_at: string;
  completed_at: string;
}): string {
  const today = todayPH();
  if (!["In Progress", "Resolved"].includes(form.status)) return "Invalid status.";
  if (!form.started_at.trim()) return "Start date is required.";
  if (form.started_at < today) return "Start date cannot be in the past.";
  if (form.status === "Resolved") {
    if (!form.completed_at.trim()) return "End date is required.";
    if (!form.action_taken.trim()) return "Action taken is required.";
    if (form.action_taken.trim().length > 2000) return "Action taken must be 2000 characters or less.";
    if (form.completed_at < today) return "End date cannot be in the past.";
    if (new Date(form.completed_at) < new Date(form.started_at))
      return "End date cannot be before start date.";
  }
  return "";
}

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila",
      })
    : "—";

const statusStyle: Record<string, { bg: string; color: string; dot: string }> = {
  Pending:       { bg: "rgba(59,130,246,0.08)",  color: "#3b5bdb", dot: "#3b82f6" },
  "In Progress": { bg: "rgba(234,179,8,0.10)",   color: "#a16207", dot: "#eab308" },
  Resolved:      { bg: "rgba(22,163,74,0.10)",   color: "#15803d", dot: "#22c55e" },
};

const MyTickets: React.FC = () => {
  const userId = getSessionUserId();
  const [rows, setRows]               = useState<TicketRow[]>([]);
  const [depts, setDepts]             = useState<DeptMap>({});
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<TicketRow | null>(null);
  const [focusedTicketId, setFocusedTicketId] = useState<string | null>(null);
  const [modal, setModal]             = useState<"view" | "work" | null>(null);
  const [form, setForm]               = useState({
    status: "In Progress" as Status,
    action_taken: "",
    started_at: "",
    completed_at: "",
  });
  const [formError, setFormError]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setRows([]);
    const [{ data: tix, error: e1 }, { data: dlist }] = await Promise.all([
      supabase
        .from("file_reports")
        .select("id, ticket_number, title, status, employee_name, department_id, issue_type, date_submitted, assigned_to, action_taken, started_at, completed_at")
        .contains("assigned_to", [userId])
        .not("status", "eq", "Resolved")
        .order("date_submitted", { ascending: false }),
      supabase.from("departments").select("id, name"),
    ]);
    if (e1) { showToast(e1.message, "error"); setRows([]); }
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

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`my_tickets_sync_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void fetchAll(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => { void fetchAll(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const targetId = localStorage.getItem("focus_ticket_id");
    if (!targetId || rows.length === 0) return;
    const target = rows.find(r => r.id === targetId);
    localStorage.removeItem("focus_ticket_id");
    if (!target) return;
    setFocusedTicketId(targetId);
    setSelected(target);
    setModal("view");
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.title, r.employee_name, r.ticket_number ?? "", r.issue_type, r.status]
        .join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openView = (r: TicketRow) => {
    setFocusedTicketId(r.id); setSelected(r); setModal("view");
  };

  const openWork = (r: TicketRow) => {
    setFocusedTicketId(r.id);
    setSelected(r);
    const today = todayPH();

    // If ticket was already set to In Progress before, keep that started_at; else default today
    const existingStarted = r.started_at ? r.started_at.slice(0, 10) : "";
    const existingCompleted = r.completed_at ? r.completed_at.slice(0, 10) : "";

    // Determine initial status: if ticket was already In Progress, force Resolved-only toggle
    // (can't go back to In Progress once saved as In Progress)
    const wasInProgress = r.status === "In Progress";
    const initialStatus: Status = wasInProgress ? "Resolved" : "In Progress";

    setForm({
      status: initialStatus,
      action_taken: r.action_taken ?? "",
      // If already in progress, lock start date to existing; else default today
      started_at: existingStarted || today,
      completed_at: existingCompleted || (initialStatus === "Resolved" ? today : ""),
    });
    setFormError("");
    setModal("work");
  };

  const closeModal = () => {
    setModal(null); setSelected(null); setFormError(""); setSaving(false);
  };

  // Whether the ticket has already been saved as "In Progress" (so can't go back)
  const isAlreadyInProgress = selected?.status === "In Progress";

  const saveWork = async () => {
    if (!selected || !userId) return;
    if (!selected.assigned_to.includes(userId)) {
      setFormError("You are no longer assigned to this ticket."); return;
    }
    const err = validateTechUpdate(form);
    if (err) { setFormError(err); return; }
    setSaving(true);
    const payload = {
      status:       form.status,
      action_taken: sanitize(form.action_taken),
      started_at:   form.started_at   ? new Date(form.started_at).toISOString()   : null,
      completed_at: form.completed_at ? new Date(form.completed_at).toISOString() : null,
      updated_at:   new Date().toISOString(),
    };
    const { error } = await supabase.from("file_reports").update(payload).eq("id", selected.id);
    if (error) { setFormError(error.message); setSaving(false); return; }
    await insertActivityLog(supabase, {
      actorUserId: userId, action: "ticket_technician_update",
      entityType: "file_report", entityId: selected.id,
      meta: { status: form.status, ticket_id: selected.id },
    });
    await notifyAdminsTicketStatusChanged(supabase, {
      ticketId: selected.id, ticketTitle: selected.title,
      ticketNumber: selected.ticket_number ?? null, status: form.status,
    });
    showToast("Ticket updated successfully.", "success");
    setSaving(false);
    closeModal();
    setRows([]);
    fetchAll();
  };

  const inputBase: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.8rem", borderRadius: 10,
    border: "1.5px solid #e2e8f0", fontSize: 13,
    fontFamily: "'Poppins', sans-serif", background: "#f8fafc",
    boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
    color: "#0f172a", cursor: "pointer",
  };

  const readonlyInput: React.CSSProperties = {
    ...inputBase,
    background: "#f1f5f9", color: "#94a3b8",
    cursor: "not-allowed", border: "1.5px solid #e2e8f0",
  };

  if (!userId) {
    return (
      <div style={{ padding: 24, fontFamily: "'Poppins', sans-serif", color: "#94a3b8" }}>
        Session missing. Please sign in again.
      </div>
    );
  }

  const isResolved = form.status === "Resolved";
  const today = todayPH();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .mt-row:hover { background: #f8fafc !important; }
        .mt-input:focus { border-color: ${BRAND} !important; box-shadow: 0 0 0 3px ${BRAND}18; }
        .mt-btn-cancel:hover { background: #f1f5f9 !important; }

        /* Make date input open calendar on full-field click */
        input[type="date"] {
          position: relative;
          cursor: pointer;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          color: transparent;
          cursor: pointer;
          opacity: 0;
        }

        .status-option {
          flex: 1; padding: 0.6rem 0.5rem;
          border-radius: 10px; border: 1.5px solid #e2e8f0;
          background: #f8fafc; cursor: pointer;
          font-size: 12px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.15s; color: #64748b;
        }
        .status-option:hover:not(:disabled) { border-color: #cbd5e1; background: #f1f5f9; }
        .status-option:disabled {
          opacity: 0.45; cursor: not-allowed;
        }
        .status-option.active-inprog {
          border-color: #eab308; background: rgba(234,179,8,0.08); color: #a16207;
        }
        .status-option.active-resolved {
          border-color: #22c55e; background: rgba(22,163,74,0.08); color: #15803d;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .field-appear { animation: slideDown 0.2s ease both; }
        .modal-card   { animation: modalIn 0.22s ease both; }

        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
      `}</style>

      <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            padding: "0.7rem 1.2rem", borderRadius: 12, fontSize: 13, fontWeight: 500,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color:      toast.type === "success" ? "#15803d" : "#b91c1c",
            border:     `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </div>
        )}

        {/* ── Page header ── */}
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Ticket size={20} color={BRAND} /> My Tickets
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            Tickets assigned to you — update status, action taken, and dates.
          </p>
        </div>

        {/* ── Search bar ── */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: "0.9rem 1rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              className="mt-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets…"
              style={{ ...inputBase, paddingLeft: 32 }}
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ID", "Title", "Requester", "Office", "Status", "Submitted", "Actions"].map(h => (
                  <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
                    <Loader size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
                    No tickets assigned to you.
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const st = statusStyle[r.status] ?? statusStyle["In Progress"];
                  return (
                    <tr key={r.id} className="mt-row" style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: focusedTicketId === r.id ? "rgba(10,76,134,0.06)" : "#fff",
                      transition: "background 0.15s",
                    }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND }}>
                        {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{r.title}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.employee_name}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>{depts[r.department_id] ?? "—"}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.color,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{fmtDate(r.date_submitted)}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" title="View" onClick={() => openView(r)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Eye size={14} color={BRAND} />
                          </button>
                          <button type="button" title="Update work" onClick={() => openWork(r)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Pencil size={14} color={BRAND} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Modal ── */}
        {modal && selected && (
          <div className="modal-backdrop" onClick={closeModal}>
            <div
              className="modal-card"
              onClick={e => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 20,
                width: "100%", maxWidth: modal === "work" ? 500 : 480,
                maxHeight: "90vh", overflowY: "auto",
                boxShadow: "0 32px 80px rgba(15,23,42,0.25)",
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #f1f5f9",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                position: "sticky", top: 0, background: "#fff",
                borderRadius: "20px 20px 0 0", zIndex: 1,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BRAND, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                    {modal === "work" ? "Update Work" : "Ticket Details"}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                    {selected.title}
                  </h3>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                    {selected.ticket_number?.trim() || `TKT-${selected.id.slice(0, 8).toUpperCase()}`}
                  </div>
                </div>
                <button type="button" onClick={closeModal} style={{
                  border: "none", background: "#f8fafc", cursor: "pointer",
                  width: 32, height: 32, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#94a3b8", flexShrink: 0, marginLeft: 12,
                }}>
                  <X size={16} />
                </button>
              </div>

              {/* ── VIEW body ── */}
              {modal === "view" && (
                <div style={{ padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#374151" }}>

                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.65rem 0.85rem", border: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Requester</div>
                      <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                        <User size={12} color={BRAND} /> {selected.employee_name}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.65rem 0.85rem", border: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Office</div>
                      <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                        <Building2 size={12} color={BRAND} /> {depts[selected.department_id] ?? "—"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.65rem 0.85rem", border: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Issue Type</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.issue_type}</div>
                      </div>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.65rem 0.85rem", border: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Submitted</div>
                        <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                          <Clock size={12} color={BRAND} /> {fmtDate(selected.date_submitted)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: BRAND, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Your Response</div>
                      <div style={{ background: `${BRAND}06`, padding: "0.85rem", borderRadius: 10, border: `1px solid ${BRAND}18`, fontSize: 13, lineHeight: 1.6 }}>
                        {selected.action_taken || "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={closeModal} className="mt-btn-cancel"
                      style={{ padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                      Close
                    </button>
                    <button type="button" onClick={() => openWork(selected)}
                      style={{ padding: "0.55rem 1.1rem", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                      <Pencil size={13} /> Update Work
                    </button>
                  </div>
                </div>
              )}

              {/* ── WORK body ── */}
              {modal === "work" && (
                <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                  {/* Status toggle */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 8 }}>
                      Status <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* In Progress button — disabled once ticket is already In Progress */}
                      <button
                        type="button"
                        disabled={isAlreadyInProgress}
                        className={`status-option ${form.status === "In Progress" ? "active-inprog" : ""}`}
                        title={isAlreadyInProgress ? "Cannot revert to In Progress once saved" : undefined}
                        onClick={() => {
                          if (isAlreadyInProgress) return;
                          setForm(f => ({
                            ...f,
                            status: "In Progress",
                            completed_at: "",
                            // Auto-fill today when switching to In Progress
                            started_at: f.started_at || today,
                          }));
                          setFormError("");
                        }}
                      >
                        <Timer size={13} /> In Progress
                      </button>

                      {/* Resolved button */}
                      <button
                        type="button"
                        className={`status-option ${form.status === "Resolved" ? "active-resolved" : ""}`}
                        onClick={() => {
                          setForm(f => ({
                            ...f,
                            status: "Resolved",
                            // Auto-fill today for end date when switching to Resolved
                            completed_at: f.completed_at || today,
                            // Keep or set start date
                            started_at: f.started_at || today,
                          }));
                          setFormError("");
                        }}
                      >
                        <CheckCircle2 size={13} /> Resolved
                      </button>
                    </div>

                    {/* Helper note when already In Progress */}
                    {isAlreadyInProgress && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={11} color="#eab308" />
                        This ticket is already In Progress — you can only mark it as Resolved.
                      </div>
                    )}
                  </div>

                  {/* Start date — always shown, locked when Resolved */}
                  <div className="field-appear">
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                      Start Date <span style={{ color: "#ef4444" }}>*</span>
                      {isResolved && (
                        <span style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8", marginLeft: 6 }}>(locked)</span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={form.started_at}
                      min={today}
                      readOnly={isResolved}
                      onChange={e => {
                        if (isResolved) return;
                        setForm(f => ({ ...f, started_at: e.target.value }));
                        setFormError("");
                      }}
                      className={isResolved ? "" : "mt-input"}
                      style={isResolved ? readonlyInput : inputBase}
                    />
                  </div>

                  {/* End date — only for Resolved */}
                  {isResolved && (
                    <div className="field-appear">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                        End Date <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={form.completed_at}
                        min={today}
                        onChange={e => {
                          setForm(f => ({ ...f, completed_at: e.target.value }));
                          setFormError("");
                        }}
                        className="mt-input"
                        style={inputBase}
                      />
                    </div>
                  )}

                  {/* Action taken — only for Resolved */}
                  {isResolved && (
                    <div className="field-appear">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                        Action Taken <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <textarea
                        value={form.action_taken}
                        onChange={e => {
                          setForm(f => ({ ...f, action_taken: e.target.value }));
                          setFormError("");
                        }}
                        rows={4}
                        maxLength={2000}
                        placeholder="Describe what was done to resolve this ticket…"
                        className="mt-input"
                        style={{ ...inputBase, resize: "vertical", lineHeight: 1.6, cursor: "text" }}
                      />
                      <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        {form.action_taken.length} / 2000
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {formError && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      color: "#b91c1c", fontSize: 12, fontWeight: 600,
                      background: "#fee2e2", padding: "0.6rem 0.85rem",
                      borderRadius: 10, border: "1px solid #fecaca",
                    }}>
                      <AlertTriangle size={14} /> {formError}
                    </div>
                  )}

                  {/* Footer buttons */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                    <button type="button" onClick={closeModal} className="mt-btn-cancel"
                      style={{ padding: "0.55rem 1rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
                      Cancel
                    </button>
                    <button type="button" onClick={saveWork} disabled={saving}
                      style={{
                        padding: "0.55rem 1.3rem", borderRadius: 10, border: "none",
                        background: isResolved ? "#15803d" : BRAND,
                        color: "#fff", fontWeight: 600,
                        cursor: saving ? "not-allowed" : "pointer",
                        opacity: saving ? 0.7 : 1, fontSize: 13,
                        fontFamily: "'Poppins', sans-serif",
                        display: "flex", alignItems: "center", gap: 6,
                        transition: "background 0.15s",
                      }}>
                      {saving
                        ? <><Loader size={13} /> Saving…</>
                        : isResolved
                          ? <><CheckCircle2 size={13} /> Mark Resolved</>
                          : <><Timer size={13} /> Save Progress</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MyTickets;