import React, { useState, useEffect, useMemo } from "react";
import {
  Eye, Search, X, AlertTriangle, Ticket,
  Clock, Loader, Building2, User, CheckCircle2, Timer,
  ClipboardList,
} from "lucide-react";
import {
  getSessionUserId,
  insertActivityLog,
  notifyAdminsTicketStatusChanged,
  notifyTicketRequesterStatusChanged,
  dispatchNavBadgesChanged,
} from "../../lib/audit-notifications";
import { supabase } from "../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";
import { ShimmerKeyframes, Skeleton } from "@/components/ui/skeleton";

type Status = "In Progress" | "Resolved";

type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  /** From DB (`Pending` / `Assigned` / `In Progress` / …); not resolved rows only. */
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

type FormErrors = {
  status?: string;
  started_at?: string;
  completed_at?: string;
  action_taken?: string;
  general?: string;
};

const BRAND = "#0a4c86";

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
}): FormErrors {
  const today = todayPH();
  const errors: FormErrors = {};

  if (!["In Progress", "Resolved"].includes(form.status)) {
    errors.status = "Invalid status.";
  }

  if (!form.started_at.trim()) {
    errors.started_at = "Start date is required.";
  }

  if (form.status === "Resolved") {
    if (!form.completed_at.trim()) {
      errors.completed_at = "End date is required.";
    } else if (form.completed_at < today) {
      errors.completed_at = "End date cannot be in the past.";
    } else if (new Date(form.completed_at) < new Date(form.started_at)) {
      errors.completed_at = "End date cannot be before start date.";
    }

    if (!form.action_taken.trim()) {
      errors.action_taken = "Action taken is required.";
    } else if (form.action_taken.trim().length > 2000) {
      errors.action_taken = "Action taken must be 2000 characters or less.";
    }
  }

  return errors;
}

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila",
      })
    : "—";

const statusStyle: Record<string, { bg: string; color: string; dot: string }> = {
  Pending:       { bg: "rgba(59,130,246,0.08)",  color: "#3b5bdb", dot: "#3b82f6" },
  Assigned:      { bg: "rgba(59,130,246,0.08)",  color: "#3b5bdb", dot: "#3b82f6" },
  "In Progress": { bg: "rgba(234,179,8,0.10)",   color: "#a16207", dot: "#eab308" },
  Resolved:      { bg: "rgba(22,163,74,0.10)",   color: "#15803d", dot: "#22c55e" },
};

/** DB value stays `Pending`; label shown as **Assigned**. */
function displayTicketStatus(s: string): string {
  return s === "Pending" ? "Assigned" : s;
}

const FieldError: React.FC<{ msg?: string }> = ({ msg }) => (
  <div style={{
    minHeight: 18, marginTop: 1, fontSize: 11, fontWeight: 500,
    color: "#dc2626", display: "flex", alignItems: "center", gap: 4,
    visibility: msg ? "visible" : "hidden",
  }}>
    <AlertTriangle size={10} />
    {msg ?? "placeholder"}
  </div>
);

const MyTickets: React.FC = () => {
  const userId = getSessionUserId();
  const today  = todayPH();

  // ── State ────────────────────────────────────────────────────────────────
  const [rows, setRows]                     = useState<TicketRow[]>([]);
  const [depts, setDepts]                   = useState<DeptMap>({});
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [selected, setSelected]             = useState<TicketRow | null>(null);
  const [focusedTicketId, setFocusedTicketId] = useState<string | null>(null);
  const [modal, setModal]                   = useState<"view" | "work" | null>(null);
  const [form, setForm]                     = useState({
    status: "In Progress" as Status,
    action_taken: "",
    started_at: "",
    completed_at: "",
  });
  const [formErrors, setFormErrors]         = useState<FormErrors>({});
  const [saving, setSaving]                 = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [savingQuickId, setSavingQuickId]   = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleClick = () => setOpenDropdownId(null);
    if (openDropdownId) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openDropdownId]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const clearFieldError = (field: keyof FormErrors) => {
    setFormErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
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
    dispatchNavBadgesChanged();
  };

  useEffect(() => { fetchAll(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`my_tickets_sync_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void fetchAll(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => { void fetchAll(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  // ── Notification focus: highlight row only, no modal ─────────────────────
  useEffect(() => {
    const targetId = localStorage.getItem("focus_ticket_id");
    if (!targetId || rows.length === 0) return;
    const target = rows.find(r => r.id === targetId);
    localStorage.removeItem("focus_ticket_id");
    if (!target) return;
    setFocusedTicketId(targetId);
    setTimeout(() => setFocusedTicketId(null), 3000);
  }, [rows]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.title, r.employee_name, r.ticket_number ?? "", r.issue_type, r.status]
        .join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const statCounts = useMemo(() => {
    let assigned = 0;
    let inProg = 0;
    for (const r of rows) {
      if (r.status === "In Progress") inProg += 1;
      else assigned += 1;
    }
    return { total: rows.length, assigned, inProg };
  }, [rows]);

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openView = (r: TicketRow) => {
    setFocusedTicketId(r.id); setSelected(r); setModal("view");
  };

  const openWork = (r: TicketRow) => {
    // ── BUG FIX: Block resolving if ticket is not yet In Progress ──
    if (r.status !== "In Progress") {
      showToast("Ticket must be In Progress before it can be marked as Resolved.", "error");
      return;
    }

    setFocusedTicketId(r.id);
    setSelected(r);
    const existingStarted =
      r.started_at
        ? r.started_at.slice(0, 10)
        : r.date_submitted
          ? r.date_submitted.slice(0, 10)
          : today;
    setForm({
      status:       "Resolved",
      action_taken: r.action_taken ?? "",
      started_at:   existingStarted,
      completed_at: today,
    });
    setFormErrors({});
    setModal("work");
  };

  const closeModal = () => {
    setModal(null); setSelected(null); setFormErrors({}); setSaving(false);
  };

  // ── Quick set In Progress (no modal) ─────────────────────────────────────
  const quickSetInProgress = async (r: TicketRow) => {
    if (!userId) return;
    setSavingQuickId(r.id);
    const payload = {
      status:     "In Progress" as Status,
      started_at: r.started_at ?? new Date(today).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("file_reports").update(payload).eq("id", r.id);
    if (error) { showToast(error.message, "error"); setSavingQuickId(null); return; }
    await insertActivityLog(supabase, {
      actorUserId: userId, action: "ticket_technician_update",
      entityType: "file_report", entityId: r.id,
      meta: { status: "In Progress", ticket_id: r.id, ticket_number: r.ticket_number ?? null, title: r.title },
    });
    await notifyAdminsTicketStatusChanged(supabase, {
      ticketId: r.id, ticketTitle: r.title,
      ticketNumber: r.ticket_number ?? null, status: "In Progress",
      actorUserId: localStorage.getItem("session_user_id"),
    });
    await notifyTicketRequesterStatusChanged(supabase, {
      ticketId: r.id,
      ticketTitle: r.title,
      ticketNumber: r.ticket_number ?? null,
      status: "In Progress",
      employeeName: r.employee_name,
      departmentId: r.department_id,
      actorUserId: localStorage.getItem("session_user_id"),
    });
    showToast("Ticket marked as In Progress.", "success");
    setSavingQuickId(null);
    fetchAll();
  };

  // ── Save resolved work ───────────────────────────────────────────────────
  const saveWork = async () => {
    if (!selected || !userId) return;
    if (!selected.assigned_to.includes(userId)) {
      setFormErrors({ general: "You are no longer assigned to this ticket." });
      return;
    }
    const errors = validateTechUpdate(form);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setSaving(true);
    const payload = {
      status:       form.status,
      action_taken: sanitize(form.action_taken),
      started_at:   form.started_at   ? new Date(form.started_at).toISOString()   : null,
      completed_at: form.completed_at ? new Date(form.completed_at).toISOString() : null,
      updated_at:   new Date().toISOString(),
    };
    const { error } = await supabase.from("file_reports").update(payload).eq("id", selected.id);
    if (error) { setFormErrors({ general: error.message }); setSaving(false); return; }
    await insertActivityLog(supabase, {
      actorUserId: userId, action: "ticket_technician_update",
      entityType: "file_report", entityId: selected.id,
      meta: { status: form.status, ticket_id: selected.id, ticket_number: selected.ticket_number ?? null, title: selected.title },
    });
    await notifyAdminsTicketStatusChanged(supabase, {
      ticketId: selected.id, ticketTitle: selected.title,
      ticketNumber: selected.ticket_number ?? null, status: form.status,
      actorUserId: localStorage.getItem("session_user_id"),
    });
    await notifyTicketRequesterStatusChanged(supabase, {
      ticketId: selected.id,
      ticketTitle: selected.title,
      ticketNumber: selected.ticket_number ?? null,
      status: form.status,
      employeeName: selected.employee_name,
      departmentId: selected.department_id,
      actorUserId: localStorage.getItem("session_user_id"),
    });
    showToast("Ticket updated successfully.", "success");
    setSaving(false);
    closeModal();
    setRows([]);
    fetchAll();
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const inputBase: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.8rem", borderRadius: 10,
    border: "1.5px solid #e2e8f0", fontSize: 13,
    fontFamily: "'Poppins', sans-serif", background: "#f8fafc",
    boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
    color: "#0f172a", cursor: "pointer",
  };
  const inputError: React.CSSProperties = {
    ...inputBase, border: "1.5px solid #fca5a5", background: "#fff5f5",
  };
  const readonlyInput: React.CSSProperties = {
    ...inputBase, background: "#f1f5f9", color: "#94a3b8",
    cursor: "not-allowed", border: "1.5px solid #e2e8f0",
  };

  if (!userId) {
    return (
      <div style={{ padding: 24, fontFamily: "'Poppins', sans-serif", color: "#94a3b8" }}>
        Session missing. Please sign in again.
      </div>
    );
  }

  const isResolved          = form.status === "Resolved";
  const isAlreadyInProgress = selected?.status === "In Progress";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <ShimmerKeyframes />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .mt-row:hover { background: #f8fafc !important; }
        .mt-row-focused { animation: mt-highlight-fade 3s ease forwards; }
        @keyframes mt-highlight-fade {
          0%   { background: rgba(10,76,134,0.10); }
          60%  { background: rgba(10,76,134,0.06); }
          100% { background: transparent; }
        }
        .mt-input:focus { border-color: ${BRAND} !important; box-shadow: 0 0 0 3px ${BRAND}18; }
        .mt-input-err:focus { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
        .mt-btn-cancel:hover { background: #f1f5f9 !important; }
        input[type="date"] { position: relative; cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute; left: 0; top: 0; width: 100%; height: 100%;
          background: transparent; color: transparent; cursor: pointer; opacity: 0;
        }
        .status-option {
          flex: 1; padding: 0.6rem 0.5rem; border-radius: 10px;
          border: 1.5px solid #e2e8f0; background: #f8fafc; cursor: pointer;
          font-size: 12px; font-weight: 600; font-family: 'Poppins', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.15s; color: #64748b;
        }
        .status-option:hover:not(:disabled) { border-color: #cbd5e1; background: #f1f5f9; }
        .status-option:disabled { opacity: 0.45; cursor: not-allowed; }
        .status-option.active-inprog   { border-color: #eab308; background: rgba(234,179,8,0.08); color: #a16207; }
        .status-option.active-resolved { border-color: #22c55e; background: rgba(22,163,74,0.08); color: #15803d; }
        .status-option.error-border    { border-color: #fca5a5 !important; }
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
          position: fixed; inset: 0; background: rgba(15,23,42,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
      `}</style>

      <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        <CrudAlertToast toast={toast} />

        {/* ── Page header ── */}
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: BRAND }}>
            <Ticket size={20} color={BRAND} /> My Tickets
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            Tickets assigned to you — update status, action taken, and dates.
          </p>
        </div>

        {/* ── Stat cards (same pattern as Repairs) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.2rem",
          }}
        >
          {[
            { label: "Total", value: statCounts.total, color: BRAND, icon: <Ticket size={16} /> },
            { label: "Assigned", value: statCounts.assigned, color: "#475569", icon: <ClipboardList size={16} /> },
            { label: "In Progress", value: statCounts.inProg, color: "#a16207", icon: <Loader size={16} /> },
          ].map(c => (
            <div
              key={c.label}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "0.9rem 1rem",
                border: "1px solid #e8edf2",
                boxShadow: "0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${c.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: c.color,
                  }}
                >
                  {c.icon}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#64748b",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {c.label}
              </div>
            </div>
          ))}
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
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "visible" }}>
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
                Array.from({ length: 7 }).map((_, rowIdx) => (
                  <tr key={rowIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {[0, 1, 2, 3, 4, 5, 6].map(col => (
                      <td key={col} style={{ padding: "0.75rem 1rem" }}>
                        <Skeleton
                          height={12}
                          radius={4}
                          width={col === 0 ? 88 : col === 4 ? 76 : col === 5 ? 96 : "90%"}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
                    No tickets assigned to you.
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const st = statusStyle[r.status] ?? statusStyle["In Progress"];
                  const isFocused = focusedTicketId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={`mt-row${isFocused ? " mt-row-focused" : ""}`}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 1.2s ease",
                      }}
                    >

                      {/* ID */}
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND }}>
                        {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                      </td>

                      {/* Title */}
                      <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{r.title}</td>

                      {/* Requester */}
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.employee_name}</td>

                      {/* Office */}
                      <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>{depts[r.department_id] ?? "—"}</td>

                      {/* Status badge */}
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.color,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
                          {displayTicketStatus(r.status)}
                        </span>
                      </td>

                      {/* Submitted */}
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {fmtDate(r.date_submitted)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>

                          {/* View button */}
                          <button type="button" title="View" onClick={() => openView(r)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Eye size={14} color={BRAND} />
                          </button>

                          {/* Status dropdown */}
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              disabled={savingQuickId === r.id}
                              onClick={e => {
                                e.stopPropagation();
                                setOpenDropdownId(prev => prev === r.id ? null : r.id);
                              }}
                              style={{
                                height: 32, padding: "0 10px 0 8px",
                                borderRadius: 8, border: "1px solid #e2e8f0",
                                background: "#fff",
                                cursor: savingQuickId === r.id ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 5,
                                fontSize: 11, fontWeight: 600,
                                color: r.status === "In Progress" ? "#a16207" : BRAND,
                                opacity: savingQuickId === r.id ? 0.6 : 1,
                                transition: "background 0.15s",
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              {savingQuickId === r.id ? (
                                <><Loader size={12} /> Updating…</>
                              ) : (
                                <>
                                  {r.status === "In Progress"
                                    ? <Timer size={12} color="#a16207" />
                                    : <Ticket size={12} color={BRAND} />
                                  }
                                  {r.status === "In Progress" ? "In Progress" : "Assigned"}
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1 }}>
                                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </>
                              )}
                            </button>

                            {/* Dropdown menu */}
                            {openDropdownId === r.id && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{
                                  position: "absolute", top: 36, right: 0,
                                  width: 180, background: "#fff",
                                  border: "1px solid #e2e8f0", borderRadius: 12,
                                  boxShadow: "0 8px 24px rgba(15,23,42,0.14)",
                                  zIndex: 999, padding: "0.4rem",
                                  animation: "slideDown 0.15s ease both",
                                  fontFamily: "'Poppins', sans-serif",
                                }}
                              >
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 8px 6px" }}>
                                  Set Status
                                </div>

                                {/* In Progress option */}
                                <button
                                  type="button"
                                  disabled={r.status === "In Progress"}
                                  onClick={() => { setOpenDropdownId(null); quickSetInProgress(r); }}
                                  style={{
                                    width: "100%", textAlign: "left", border: "none",
                                    borderRadius: 8, padding: "0.5rem 0.6rem",
                                    display: "flex", alignItems: "center", gap: 8,
                                    fontSize: 12, fontWeight: 600,
                                    background: r.status === "In Progress" ? "rgba(234,179,8,0.08)" : "transparent",
                                    color: r.status === "In Progress" ? "#a16207" : "#475569",
                                    cursor: r.status === "In Progress" ? "not-allowed" : "pointer",
                                    opacity: r.status === "In Progress" ? 0.6 : 1,
                                    fontFamily: "'Poppins', sans-serif",
                                  }}
                                >
                                  <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(234,179,8,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Timer size={11} color="#a16207" />
                                  </span>
                                  In Progress
                                  {r.status === "In Progress" && (
                                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#a16207" }}>● Current</span>
                                  )}
                                </button>

                                {/* Resolved option — disabled if not In Progress */}
                                <button
                                  type="button"
                                  disabled={r.status !== "In Progress"}
                                  onClick={() => { setOpenDropdownId(null); openWork(r); }}
                                  style={{
                                    width: "100%", textAlign: "left", border: "none",
                                    borderRadius: 8, padding: "0.5rem 0.6rem",
                                    display: "flex", alignItems: "center", gap: 8,
                                    fontSize: 12, fontWeight: 600,
                                    background: "transparent",
                                    color: r.status !== "In Progress" ? "#94a3b8" : "#475569",
                                    cursor: r.status !== "In Progress" ? "not-allowed" : "pointer",
                                    opacity: r.status !== "In Progress" ? 0.5 : 1,
                                    fontFamily: "'Poppins', sans-serif",
                                  }}
                                >
                                  <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(22,163,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <CheckCircle2 size={11} color={r.status !== "In Progress" ? "#94a3b8" : "#15803d"} />
                                  </span>
                                  Mark as Resolved
                                  {r.status !== "In Progress" && (
                                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}></span>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

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
                padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9",
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
                </div>
              )}

              {/* ── WORK body ── */}
              {modal === "work" && (
                <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                  {/* Status toggle */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 8 }}>
                      Status <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        disabled={isAlreadyInProgress}
                        className={["status-option", form.status === "In Progress" ? "active-inprog" : "", formErrors.status ? "error-border" : ""].join(" ")}
                        title={isAlreadyInProgress ? "Cannot revert to In Progress once saved" : undefined}
                        onClick={() => {
                          if (isAlreadyInProgress) return;
                          setForm(f => ({ ...f, status: "In Progress", completed_at: "", started_at: f.started_at || today }));
                          clearFieldError("status");
                        }}
                      >
                        <Timer size={13} /> In Progress
                      </button>
                      <button
                        type="button"
                        className={["status-option", form.status === "Resolved" ? "active-resolved" : "", formErrors.status ? "error-border" : ""].join(" ")}
                        onClick={() => {
                          setForm(f => ({ ...f, status: "Resolved", completed_at: f.completed_at || today, started_at: f.started_at || today }));
                          clearFieldError("status");
                        }}
                      >
                        <CheckCircle2 size={13} /> Resolved
                      </button>
                    </div>
                    <FieldError msg={formErrors.status} />
                    {isAlreadyInProgress && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={11} color="#eab308" />
                        This ticket is already In Progress — you can only mark it as Resolved.
                      </div>
                    )}
                  </div>

                  {/* Start date */}
                  <div className="field-appear">
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                      Start Date <span style={{ color: "#ef4444" }}>*</span>
                      {isResolved && <span style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8", marginLeft: 6 }}>(locked)</span>}
                    </label>
                    <input
                      type="date"
                      value={form.started_at}
                      readOnly={isResolved}
                      onChange={e => {
                        if (isResolved) return;
                        setForm(f => ({ ...f, started_at: e.target.value }));
                        clearFieldError("started_at");
                      }}
                      className={isResolved ? "" : formErrors.started_at ? "mt-input-err" : "mt-input"}
                      style={isResolved ? readonlyInput : formErrors.started_at ? inputError : inputBase}
                    />
                    <FieldError msg={formErrors.started_at} />
                  </div>

                  {/* End date — Resolved only */}
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
                          clearFieldError("completed_at");
                        }}
                        className={formErrors.completed_at ? "mt-input-err" : "mt-input"}
                        style={formErrors.completed_at ? inputError : inputBase}
                      />
                      <FieldError msg={formErrors.completed_at} />
                    </div>
                  )}

                  {/* Action taken — Resolved only */}
                  {isResolved && (
                    <div className="field-appear">
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                        Action Taken <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <textarea
                        value={form.action_taken}
                        onChange={e => {
                          setForm(f => ({ ...f, action_taken: e.target.value }));
                          clearFieldError("action_taken");
                        }}
                        rows={4}
                        maxLength={2000}
                        placeholder="Describe what was done to resolve this ticket…"
                        className={formErrors.action_taken ? "mt-input-err" : "mt-input"}
                        style={{ ...(formErrors.action_taken ? inputError : inputBase), resize: "vertical", lineHeight: 1.6, cursor: "text" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 1 }}>
                        <FieldError msg={formErrors.action_taken} />
                        <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>
                          {form.action_taken.length} / 2000
                        </span>
                      </div>
                    </div>
                  )}

                  {/* General error */}
                  {formErrors.general && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      color: "#b91c1c", fontSize: 12, fontWeight: 600,
                      background: "#fee2e2", padding: "0.6rem 0.85rem",
                      borderRadius: 10, border: "1px solid #fecaca",
                    }}>
                      <AlertTriangle size={14} /> {formErrors.general}
                    </div>
                  )}

                  {/* Footer */}
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