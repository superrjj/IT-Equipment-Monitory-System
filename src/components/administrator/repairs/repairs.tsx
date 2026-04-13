import React, { useState, useEffect, useMemo } from "react";
import {
  notifyRepairAssignees,
  notifyAdminsRepairAssignment,
  diffNewAssignees,
  insertActivityLog,
  getSessionUserId,
  dispatchNavBadgesChanged,
} from "../../../lib/audit-notifications";
import {
  Plus, Pencil, Trash2, Eye, Search,
  ChevronUp, ChevronDown, X, AlertTriangle,
  ChevronLeft, ChevronRight, Wrench,
  ClipboardList, Loader, CheckCircle, Users,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";

type RepairStatus = "Pending" | "In Progress" | "Completed";
type SortField    = "status" | "created_at" | "started_at" | "completed_at";
type SortDir      = "asc" | "desc";
type ModalMode    = "add" | "edit" | "view" | null;

type Repair = {
  id:             string;
  file_report_id: string | null;
  assigned_to:    string[];           // array of user UUIDs
  problem:        string | null;
  action_taken:   string;
  status:         RepairStatus;
  started_at:     string | null;
  completed_at:   string | null;
  created_at:     string;
  updated_at:     string;
  // resolved client-side
  technician_names?: string[];
  ticket_number?:    string;
  ticket_title?:     string;
};

type TicketOption = { id: string; ticket_number: string; title: string; status: string; is_archived: boolean };
type UserOption   = { id: string; full_name: string; role: string };

type FormState = {
  file_report_id: string;
  assigned_to:    string[];
  problem:        string;
  action_taken:   string;
  status:         RepairStatus;
  started_at:     string;
  completed_at:   string;
};

const BRAND     = "#0a4c86";
const PAGE_SIZE = 10;
const REPAIR_STATUSES: RepairStatus[] = ["Pending", "In Progress", "Completed"];

// UI requirement: Admin "Pending" == "Assigned" stage (techs are already chosen).
const repairStatusLabel = (status: RepairStatus): string =>
  status === "Pending" ? "Assigned" : status;

function sanitize(val: string): string {
  return val
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;").trim();
}

function validateForm(form: FormState): string {
  if (!form.file_report_id)          return "Please select a ticket.";
  if (form.assigned_to.length === 0) return "Please assign at least one technician.";
  if (!REPAIR_STATUSES.includes(form.status)) return "Invalid status selected.";
  if (form.action_taken.trim().length > 2000) return "Action taken must be 2000 characters or less.";
  if (form.problem.trim().length > 500)       return "Problem must be 500 characters or less.";
  if (form.started_at && form.completed_at) {
    if (new Date(form.completed_at) < new Date(form.started_at))
      return "End date cannot be before the start date.";
  }
  if (form.status === "Completed" && !form.completed_at)
    return "Please set an end date for Completed repairs.";
  if ((form.status === "In Progress" || form.status === "Completed") && !form.started_at)
    return "Please set a start date for In Progress / Completed repairs.";
  return "";
}

const emptyForm = (): FormState => ({
  file_report_id: "",
  assigned_to:    [],
  problem:        "",
  action_taken:   "",
  // Default stage after assignment is "Assigned" (stored as Pending in repairs table)
  status:         "Pending",
  started_at:     "",
  completed_at:   "",
});

function friendlyError(msg: string): string {
  if (msg.includes("foreign key")) return "Cannot complete — a referenced record no longer exists.";
  if (msg.includes("not-null") || msg.includes("null value")) return "A required field is missing.";
  if (msg.includes("unique")) return "A duplicate record already exists.";
  return msg;
}

const statusMeta: Record<RepairStatus, { bg: string; color: string; dot: string }> = {
  "Pending":     { bg: "rgba(100,116,139,0.10)", color: "#475569", dot: "#94a3b8" },
  "In Progress": { bg: "rgba(234,179,8,0.12)",   color: "#a16207", dot: "#eab308" },
  "Completed":   { bg: "rgba(22,163,74,0.10)",   color: "#15803d", dot: "#16a34a" },
};

const RepairStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = statusMeta[status as RepairStatus] ?? statusMeta["Pending"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status === "Pending" ? "Assigned" : status}
    </span>
  );
};

// ── Skeletons (matches admin dashboard shimmer) ───────────────────────────────
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

const KpiSkel: React.FC = () => (
  <div style={{
    background: "#ffffff",
    borderRadius: 14,
    padding: "0.9rem 1rem",
    border: "1px solid #e8edf2",
    boxShadow: "0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: "0.55rem",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Skeleton width={36} height={36} radius={10} />
      <Skeleton width={38} height={24} radius={6} />
    </div>
    <Skeleton width={78} height={10} radius={4} />
  </div>
);

const RepairsPageSkeleton: React.FC = () => (
  <>
    <style>{`@keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }`}</style>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
      <div>
        <Skeleton width={140} height={22} radius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={240} height={12} radius={4} />
      </div>
      <Skeleton width={120} height={36} radius={10} />
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
      {[0, 1, 2, 3].map(i => <KpiSkel key={i} />)}
    </div>

    <div style={{
      background: "#ffffff",
      borderRadius: 18,
      border: "1px solid #e8edf2",
      overflow: "hidden",
      boxShadow: "0 6px 22px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={260} height={36} radius={10} />
        <Skeleton width={140} height={32} radius={8} />
        <Skeleton width={92} height={14} radius={6} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ padding: "0.8rem 1.2rem" }}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "140px 1fr 180px 120px 120px 120px 120px 90px", gap: 10, padding: "0.7rem 0", borderBottom: idx === 5 ? "none" : "1px solid #f1f5f9", alignItems: "center" }}>
            <Skeleton width={120} height={14} radius={6} />
            <Skeleton width="95%" height={14} radius={6} />
            <Skeleton width={160} height={14} radius={6} />
            <Skeleton width={86} height={22} radius={999} />
            <Skeleton width={92} height={12} radius={6} />
            <Skeleton width={92} height={12} radius={6} />
            <Skeleton width={92} height={12} radius={6} />
            <Skeleton width={74} height={30} radius={8} />
          </div>
        ))}
      </div>
    </div>
  </>
);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

// ── Technician multi-select picker ─────────────────────────────────────────────
const TechnicianPicker: React.FC<{
  users: UserOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  hasError: boolean;
}> = ({ users, selected, onChange, hasError }) => {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div style={{
      border: `1px solid ${hasError ? "#fca5a5" : "#e2e8f0"}`,
      borderRadius: 8, background: "#f8fafc",
      maxHeight: 180, overflowY: "auto", padding: "0.4rem",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      {users.length === 0 ? (
        <div style={{ padding: "0.5rem", fontSize: 12, color: "#94a3b8" }}>No active technicians found.</div>
      ) : users.map(u => {
        const active = selected.includes(u.id);
        return (
          <button key={u.id} type="button" onClick={() => toggle(u.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "0.45rem 0.6rem", borderRadius: 6, border: "none",
              background: active ? `${BRAND}10` : "transparent",
              cursor: "pointer", textAlign: "left", width: "100%",
              transition: "background 0.12s",
            }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${active ? BRAND : "#cbd5e1"}`,
              background: active ? BRAND : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {active && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? BRAND : "#374151", fontFamily: "'Poppins', sans-serif" }}>
              {u.full_name}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{u.role}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── Technician name chips (display) ───────────────────────────────────────────
const TechnicianChips: React.FC<{ names: string[] }> = ({ names }) => {
  if (!names || names.length === 0)
    return <span style={{ color: "#cbd5e1" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {names.map((name, i) => (
        <span key={i} style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
          background: "rgba(10,76,134,0.07)", color: BRAND, whiteSpace: "nowrap",
        }}>
          {name}
        </span>
      ))}
    </div>
  );
};

const Repairs: React.FC = () => {
  const [repairs, setRepairs]           = useState<Repair[]>([]);
  const [tickets, setTickets]           = useState<TicketOption[]>([]);
  const [assignedTicketIds, setAssignedTicketIds] = useState<Set<string>>(new Set());
  const [users, setUsers]               = useState<UserOption[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField]       = useState<SortField>("created_at");
  const [sortDir, setSortDir]           = useState<SortDir>("desc");
  const [page, setPage]                 = useState(1);
  const [modalMode, setModalMode]       = useState<ModalMode>(null);
  const [selected, setSelected]         = useState<Repair | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Repair | null>(null);
  const [form, setForm]                 = useState<FormState>(emptyForm());
  const [formError, setFormError]       = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const userMap = useMemo(() => {
    const m: Record<string, UserOption> = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const fetchRepairs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("repairs")
      .select(`
        id, file_report_id, assigned_to,
        problem, action_taken, status,
        started_at, completed_at, created_at, updated_at,
        file_reports ( ticket_number, title )
      `)
      .order(sortField, { ascending: sortDir === "asc" });

    if (error) {
      showToast(friendlyError(error.message), "error");
      setRepairs([]);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        assigned_to:   Array.isArray(r.assigned_to) ? r.assigned_to : [],
        ticket_number: r.file_reports?.ticket_number ?? null,
        ticket_title:  r.file_reports?.title         ?? null,
      }));
      setRepairs(mapped);
      const ids = new Set<string>(
        mapped
          .filter((r: Repair) => r.file_report_id)
          .map((r: Repair) => r.file_report_id as string)
      );
      setAssignedTicketIds(ids);
    }
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    const [{ data: tix }, { data: ua }] = await Promise.all([
      // Only tickets that can still be worked on:
      // - exclude Resolved
      // - exclude archived
      supabase
        .from("file_reports")
        .select("id, ticket_number, title, status, is_archived")
        .neq("status", "Resolved")
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_accounts")
        .select("id, full_name, role")
        .eq("is_active", true)
        .eq("role", "IT Technician")
        .order("full_name"),
    ]);
    setTickets((tix ?? []) as TicketOption[]);
    setUsers((ua ?? []) as UserOption[]);
  };

  useEffect(() => { fetchRepairs(); }, [sortField, sortDir]);
  useEffect(() => { fetchDropdowns(); }, []);

  const repairsWithNames = useMemo(() =>
    repairs.map(r => ({
      ...r,
      technician_names: (r.assigned_to ?? [])
        .map(id => userMap[id]?.full_name)
        .filter(Boolean) as string[],
    })),
  [repairs, userMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repairsWithNames.filter(r => {
      const matchSearch = !q || [
        r.ticket_number ?? "", r.action_taken, r.problem ?? "", r.ticket_title ?? "",
        ...(r.technician_names ?? []),
      ].some(v => v.toLowerCase().includes(q));
      const matchStatus = filterStatus === "All" || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [repairsWithNames, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, filterStatus]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };
  const SortIcon = ({ field }: { field: SortField }) => (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, verticalAlign: "middle" }}>
      <ChevronUp   size={10} color={sortField === field && sortDir === "asc"  ? BRAND : "#cbd5e1"} />
      <ChevronDown size={10} color={sortField === field && sortDir === "desc" ? BRAND : "#cbd5e1"} />
    </span>
  );

  const counts = useMemo(() => ({
    total:      repairs.length,
    pending:    repairs.filter(r => r.status === "Pending").length,
    inProgress: repairs.filter(r => r.status === "In Progress").length,
    completed:  repairs.filter(r => r.status === "Completed").length,
  }), [repairs]);

  const closeModal = () => {
    setModalMode(null); setSelected(null);
    setForm(emptyForm()); setFormError(""); setSubmitting(false);
  };
  const openAdd  = () => { closeModal(); setModalMode("add"); };
  const openView = (r: Repair) => { setSelected(r); setModalMode("view"); };
  const openEdit = (r: Repair) => {
    closeModal(); setSelected(r);
    setForm({
      file_report_id: r.file_report_id ?? "",
      assigned_to:    Array.isArray(r.assigned_to) ? r.assigned_to : [],
      problem:        r.problem        ?? "",
      action_taken:   r.action_taken,
      status:         r.status,
      started_at:     r.started_at   ? r.started_at.slice(0, 10)   : "",
      completed_at:   r.completed_at ? r.completed_at.slice(0, 10) : "",
    });
    setModalMode("edit");
  };

  const availableTickets = useMemo(() => {
    return tickets.filter(t => {
      const isAssignedElsewhere = assignedTicketIds.has(t.id) && t.id !== selected?.file_report_id;
      // extra safety: never offer already resolved/archived tickets here
      const isClosed = t.status === "Resolved" || t.is_archived === true;
      return !isAssignedElsewhere && !isClosed;
    });
  }, [tickets, assignedTicketIds, selected]);

  const handleTicketChange = (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    setForm(f => ({
      ...f,
      file_report_id: ticketId,
      problem:        ticket ? ticket.title : f.problem,
    }));
    setFormError("");
  };

  const handleSubmit = async () => {
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    setSubmitting(true);

    const payload = {
      file_report_id: form.file_report_id || null,
      assigned_to:    form.assigned_to,
      problem:        sanitize(form.problem),
      action_taken:   sanitize(form.action_taken),
      status:         form.status,
      started_at:     form.started_at   ? new Date(form.started_at).toISOString()   : null,
      completed_at:   form.completed_at ? new Date(form.completed_at).toISOString() : null,
    };

    if (modalMode === "add") {
      const { data: row, error } = await supabase.from("repairs").insert(payload).select("id").single();
      if (error) {
        setFormError(friendlyError(error.message));
        setSubmitting(false);
        return;
      }

      if (form.file_report_id) {
        // FLOW RULE:
        // - Admin only assigns technicians (Assigned/Pending)
        // - Technician updates: In Progress / Resolved
        const nextTicketStatus = form.assigned_to.length > 0 ? "Assigned" : "Pending";

        const { error: ticketErr } = await supabase.from("file_reports").update({
          assigned_to: form.assigned_to,
          status: nextTicketStatus,
        }).eq("id", form.file_report_id);

        if (ticketErr) {
          showToast(friendlyError(ticketErr.message), "error");
        }
      }

      if (row?.id && form.assigned_to.length > 0) {
        const summary = [tickets.find(t => t.id === form.file_report_id)?.ticket_number, form.problem || payload.problem]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 200);
        await notifyRepairAssignees(supabase, form.assigned_to, {
          repairId: row.id,
          summary: summary || "New repair job",
          actorUserId: getSessionUserId(),
        });
        await notifyAdminsRepairAssignment(supabase, {
          repairId: row.id,
          summary: summary || "New repair job",
          actorUserId: getSessionUserId(),
        });
      }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "repair_created",
        entityType: "repair",
        entityId: row?.id ?? null,
        meta: { status: form.status },
      });
      showToast("Repair job created successfully.", "success");
    } else if (modalMode === "edit" && selected) {
      const prevAssigned = Array.isArray(selected.assigned_to) ? selected.assigned_to : [];
      const { error } = await supabase.from("repairs").update(payload).eq("id", selected.id);
      if (error) {
        setFormError(friendlyError(error.message));
        setSubmitting(false);
        return;
      }

      if (payload.file_report_id) {
        // FLOW RULE:
        // - Admin only assigns technicians (Assigned/Pending)
        // - Technician updates: In Progress / Resolved
        const nextTicketStatus = form.assigned_to.length > 0 ? "Assigned" : "Pending";

        const { error: ticketErr } = await supabase.from("file_reports").update({
          assigned_to: form.assigned_to,
          status: nextTicketStatus,
        }).eq("id", payload.file_report_id);

        if (ticketErr) {
          showToast(friendlyError(ticketErr.message), "error");
        }
      }

      const added = diffNewAssignees(prevAssigned, form.assigned_to);
      if (added.length > 0) {
        const summary = [selected.ticket_number, selected.problem].filter(Boolean).join(" — ").slice(0, 200);
        await notifyRepairAssignees(supabase, added, {
          repairId: selected.id,
          summary: summary || "Repair job reassigned",
          actorUserId: getSessionUserId(),
        });
        await notifyAdminsRepairAssignment(supabase, {
          repairId: selected.id,
          summary: summary || "Repair job reassigned",
          actorUserId: getSessionUserId(),
        });
      }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "repair_updated",
        entityType: "repair",
        entityId: selected.id,
        meta: { status: form.status },
      });
      showToast("Repair job updated successfully.", "success");
    }

    setSubmitting(false);
    closeModal();
    dispatchNavBadgesChanged();
    fetchRepairs();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("repairs").delete().eq("id", deleteTarget.id);
    if (error) showToast(friendlyError(error.message), "error");
    else showToast("Repair job deleted.", "success");
    setDeleteTarget(null);
    fetchRepairs();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "'Poppins', sans-serif",
    outline: "none", color: "#0f172a", background: "#f8fafc", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

  if (loading) {
    return (
      <>
        <CrudAlertToast toast={toast} />
        <div className="rp-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>
          <RepairsPageSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <CrudAlertToast toast={toast} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .rp-root, .rp-root * { box-sizing: border-box; }
        .rp-row:hover { background: #f8fafc !important; }
        .icon-btn-rp:hover { background: #f1f5f9 !important; }
        .modal-overlay-rp { animation: rpFadeIn 0.15s ease; }
        @keyframes rpFadeIn { from { opacity:0 } to { opacity:1 } }
        .modal-box-rp { animation: rpSlideUp 0.18s ease; }
        @keyframes rpSlideUp { from { transform:translateY(16px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .rp-filter { padding:0.4rem 0.65rem; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; font-size:12px; font-family:'Poppins',sans-serif; color:#475569; outline:none; cursor:pointer; }
        .rp-filter:focus { border-color:#0a4c86; }
        .rp-detail-row { display:flex; gap:8px; font-size:13px; padding:0.5rem 0; border-bottom:1px solid #f1f5f9; }
        .rp-detail-row:last-child { border-bottom:none; }
        .rp-detail-label { font-size:12px; font-weight:600; color:#64748b; min-width:130px; flex-shrink:0; }
        @media (max-width: 1024px) { .rp-stat-cards { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { .rp-stat-cards { grid-template-columns: 1fr !important; } .rp-header-row { flex-direction: column; align-items: flex-start !important; } }
      `}</style>

      <div className="rp-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a", paddingTop: "2rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 2, display: "flex", alignItems: "center", gap: 8, color: BRAND, fontFamily: "'Poppins', sans-serif" }}>
              <Wrench size={20} color={BRAND} /> Repairs
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>Track and manage equipment repair jobs.</p>
          </div>
          <button onClick={openAdd} style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.5rem 1rem", borderRadius: 10, border: "none",
            background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'Poppins', sans-serif",
          }}>
            <Plus size={15} /> New Repair
          </button>
        </div>

        {/* Stat cards */}
        <div className="rp-stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {[
            { label: "Total",       value: counts.total,      color: BRAND,     icon: <Wrench size={16} /> },
            { label: "Assigned",    value: counts.pending,    color: "#475569", icon: <ClipboardList size={16} /> },
            { label: "In Progress", value: counts.inProgress, color: "#a16207", icon: <Loader size={16} /> },
            { label: "Completed",   value: counts.completed,  color: "#15803d", icon: <CheckCircle size={16} /> },
          ].map(c => (
            <div
              key={c.label}
              style={{
                background: "#ffffff",
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
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                  {c.icon}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div style={{ background: "#ffffff", borderRadius: 18, border: "1px solid #e8edf2", overflow: "hidden", boxShadow: "0 6px 22px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)" }}>

          {/* Toolbar */}
          <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repairs…"
                style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            <select className="rp-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {REPAIR_STATUSES.map(s => <option key={s} value={s}>{repairStatusLabel(s)}</option>)}
            </select>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              Page {page}/{totalPages}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {([
                    { label: "Ticket No.",    field: null },
                    { label: "Problem",       field: null },
                    { label: "Technician(s)", field: null },
                    { label: "Status",        field: "status"       as SortField },
                    { label: "Start Date",    field: "started_at"   as SortField },
                    { label: "End Date",      field: "completed_at" as SortField },
                    { label: "Created",       field: "created_at"   as SortField },
                    { label: "Actions",       field: null },
                  ] as { label: string; field: SortField | null }[]).map(col => (
                    <th key={col.label}
                      onClick={() => col.field && toggleSort(col.field)}
                      style={{
                        padding: "0.7rem 1rem", textAlign: "left", fontWeight: 600,
                        color: "#475569", fontSize: 12, letterSpacing: "0.04em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                        cursor: col.field ? "pointer" : "default", userSelect: "none",
                      }}>
                      {col.label}{col.field && <SortIcon field={col.field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>No repair jobs found.</td></tr>
                ) : paginated.map(r => (
                  <tr key={r.id} className="rp-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {r.ticket_number
                        ? <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: "rgba(10,76,134,0.07)", color: BRAND, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                            {r.ticket_number}
                          </span>
                        : <span style={{ color: "#cbd5e1" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.problem
                        ? <span style={{ fontWeight: 500 }}>{r.problem}</span>
                        : <span style={{ color: "#cbd5e1" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 220 }}>
                      <div style={{ display: "flex", flexWrap: "nowrap", gap: 4, overflow: "hidden" }}>
                        {(r.technician_names ?? []).length === 0 ? (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        ) : (r.technician_names ?? []).length === 1 ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(10,76,134,0.07)", color: BRAND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                            {r.technician_names![0]}
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(10,76,134,0.07)", color: BRAND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                              {r.technician_names![0]}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${BRAND}18`, color: BRAND, whiteSpace: "nowrap", flexShrink: 0 }}>
                              +{(r.technician_names ?? []).length - 1}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}><RepairStatusBadge status={r.status} /></td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(r.started_at)}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(r.completed_at)}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),        color: BRAND },
                          { icon: <Pencil size={14} />, title: "Edit",   fn: () => openEdit(r),        color: BRAND },
                          { icon: <Trash2 size={14} />, title: "Delete", fn: () => setDeleteTarget(r), color: "#dc2626" },
                        ].map((btn, i) => (
                          <button key={i} title={btn.title} className="icon-btn-rp" onClick={btn.fn}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: btn.color, transition: "background 0.15s" }}>
                            {btn.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.2rem", borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: page === 1 ? "#cbd5e1" : "#475569" }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: n === page ? BRAND : "#fff", color: n === page ? "#fff" : "#475569", fontWeight: n === page ? 600 : 400, cursor: "pointer", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: page === totalPages ? "#cbd5e1" : "#475569" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ══ Add / Edit Modal ══ */}
        {(modalMode === "add" || modalMode === "edit") && (
          <div className="modal-overlay-rp" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-rp" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 520, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif", color: BRAND, letterSpacing: 1 }}>
                  {modalMode === "add" ? "New Repair Job" : "Edit Repair Job"}
                </h2>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>

                {/* Ticket selector */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Ticket No. <span style={{ color: "#dc2626" }}>*</span></label>
                  <select value={form.file_report_id} onChange={e => handleTicketChange(e.target.value)}
                    style={{ ...selectStyle, borderColor: formError && !form.file_report_id ? "#fca5a5" : "#e2e8f0" }}>
                    <option value="">— Select a ticket —</option>
                    {availableTickets.map(t => (
                      <option key={t.id} value={t.id}>{t.ticket_number} — {t.title}</option>
                    ))}
                  </select>
                  {form.file_report_id && (
                    <p style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                      Problem auto-filled from ticket title — you may edit it below.
                    </p>
                  )}
                </div>

                {/* Problem */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Problem <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.problem}
                    onChange={e => { setForm(f => ({ ...f, problem: e.target.value })); setFormError(""); }}
                    placeholder="Describe the problem…" maxLength={500}
                    style={{ ...inputStyle, borderColor: formError && !form.problem.trim() ? "#fca5a5" : "#e2e8f0" }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textAlign: "right" }}>{form.problem.length}/500</div>
                </div>

                {/* Technician multi-picker */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={13} color="#475569" /> Assigned Technician(s) <span style={{ color: "#dc2626" }}>*</span>
                    {form.assigned_to.length > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: BRAND, background: `${BRAND}10`, padding: "1px 8px", borderRadius: 999 }}>
                        {form.assigned_to.length} selected
                      </span>
                    )}
                  </label>
                  <TechnicianPicker
                    users={users}
                    selected={form.assigned_to}
                    onChange={ids => { setForm(f => ({ ...f, assigned_to: ids })); setFormError(""); }}
                    hasError={!!(formError && form.assigned_to.length === 0)}
                  />
                </div>

                {/* Status (Technician-owned workflow) */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Status</label>
                  <div style={{
                    ...inputStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f8fafc",
                    color: "#475569",
                    cursor: "not-allowed",
                  }}>
                    <span style={{ fontWeight: 600 }}>{repairStatusLabel("Pending")}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }} />
                  </div>
                </div>

                {/* Start/End dates are technician-owned and not set here */}

                {/* Action taken */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>
                    Action Taken <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea value={form.action_taken}
                    onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))}
                    placeholder="Describe what was done to fix the issue…"
                    rows={4} maxLength={2000}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textAlign: "right" }}>{form.action_taken.length}/2000</div>
                </div>
              </div>

              {formError && (
                <div style={{ marginTop: "0.85rem", padding: "0.55rem 0.8rem", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} /> {formError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button onClick={closeModal} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Poppins', sans-serif", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Saving…" : modalMode === "add" ? "Create Repair" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ View Modal ══ */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay-rp" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-rp" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 480, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 6 }}>
                    {selected.problem ?? "Repair Job"}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RepairStatusBadge status={selected.status} />
                    {selected.ticket_number && (
                      <span style={{ fontSize: 11, color: BRAND, fontFamily: "monospace", fontWeight: 700, background: "rgba(10,76,134,0.07)", padding: "2px 8px", borderRadius: 6 }}>
                        {selected.ticket_number}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0 }}><X size={18} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1rem" }}>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Ticket No.</span>
                  <span style={{ color: "#0f172a" }}>{selected.ticket_number ?? "—"}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Problem</span>
                  <span style={{ color: "#0f172a" }}>{selected.problem ?? "—"}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Technician(s)</span>
                  <div style={{ flex: 1 }}>
                    <TechnicianChips names={
                      (selected.assigned_to ?? [])
                        .map(id => userMap[id]?.full_name)
                        .filter(Boolean) as string[]
                    } />
                  </div>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Start Date</span>
                  <span style={{ color: "#0f172a" }}>{fmtDate(selected.started_at)}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">End Date</span>
                  <span style={{ color: "#0f172a" }}>{fmtDate(selected.completed_at)}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Created</span>
                  <span style={{ color: "#0f172a" }}>{fmtDate(selected.created_at)}</span>
                </div>
              </div>

              {selected.action_taken && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Action Taken</div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem", lineHeight: 1.7, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>
                    {selected.action_taken}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button onClick={() => { closeModal(); openEdit(selected); }}
                  style={{ padding: "0.5rem 1rem", borderRadius: 8, border: `1.5px solid ${BRAND}`, background: "#fff", color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={closeModal}
                  style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ Delete Confirm Modal ══ */}
        {deleteTarget && (
          <div className="modal-overlay-rp" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box-rp" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(15,23,42,0.2)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Repair Job?</h2>
              <p style={{ fontSize: 13, color: "#475569", marginBottom: "1.4rem" }}>
                This will permanently delete this repair job. This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Repairs;