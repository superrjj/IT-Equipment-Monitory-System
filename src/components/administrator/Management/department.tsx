import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Pencil, Trash2, Eye, Search, ChevronUp, ChevronDown,
  X, AlertTriangle, ChevronLeft, ChevronRight, Building2,
  Ticket, Clock, CheckCircle2, CircleDot, Hash, Archive
} from "lucide-react";
import { getSessionUserId, insertActivityLog } from "../../../lib/audit-notifications";
import { supabase } from "../../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
type Department = {
  id: string;
  name: string;
  description: string;
  location: string;
  created_at: string;
  ticket_count?: number;
  is_archived: boolean;
};

type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  employee_name: string;
  issue_type: string;
  status: string;
  date_submitted: string;
};

type SortField = "name" | "created_at";
type SortDir = "asc" | "desc";
type ModalMode = "add" | "edit" | "view" | null;

// Per-field form errors for the add/edit modal
type DeptFormErrors = {
  name?: string;
  description?: string;
  location?: string;
};

const brandBlue = "#0D518C";
const PAGE_SIZE = 8;

// ── Status badge ───────────────────────────────────────────────────────────────
const TicketStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    "Pending":     { bg: "rgba(234,179,8,0.12)",   color: "#a16207", icon: <Clock size={10} /> },
    "In Progress": { bg: "rgba(10,76,134,0.10)",   color: "#0a4c86", icon: <CircleDot size={10} /> },
    "Resolved":    { bg: "rgba(22,163,74,0.12)",   color: "#15803d", icon: <CheckCircle2 size={10} /> },
  };
  const s = map[status] ?? { bg: "rgba(100,116,139,0.12)", color: "#475569", icon: null };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 999, fontSize: 11,
      fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
      background: s.bg, color: s.color,
    }}>
      {s.icon} {status === "Pending" ? "Assigned" : status}
    </span>
  );
};

// ── Issue type badge ───────────────────────────────────────────────────────────
const IssueTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const map: Record<string, { bg: string; color: string }> = {
    Hardware: { bg: "rgba(124,58,237,0.10)", color: "#6d28d9" },
    Software: { bg: "rgba(14,165,233,0.10)", color: "#0369a1" },
    Internet: { bg: "rgba(249,115,22,0.10)", color: "#c2410c" },
  };
  const s = map[type] ?? { bg: "rgba(100,116,139,0.12)", color: "#475569" };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: 10,
      fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      background: s.bg, color: s.color,
    }}>
      {type}
    </span>
  );
};

// ── Friendly error mapper ──────────────────────────────────────────────────────
function friendlyError(msg: string): string {
  if (msg.includes("departments_name_key") || msg.includes("unique constraint"))
    return "A department with that name already exists. Please use a different name.";
  if (msg.includes("foreign key"))
    return "Cannot delete — this department has tickets linked to it. Reassign or remove the tickets first.";
  if (msg.includes("not-null") || msg.includes("null value"))
    return "A required field is missing. Please fill in all required fields.";
  return msg;
}

// ── Inline field error ─────────────────────────────────────────────────────────
const FieldError = ({ msg }: { msg?: string }) => {
  if (!msg) return null;
  return (
   <div style={{
       minHeight: 18,
       marginTop: 1,
       fontSize: 11,
       fontWeight: 500,
       color: "#dc2626",
       display: "flex",
       alignItems: "center",
       gap: 4,
       visibility: msg ? "visible" : "hidden",
     }}>
       <AlertTriangle size={10} />
       {msg ?? "placeholder"}
     </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const Departments: React.FC = () => {
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [tickets, setTickets]           = useState<TicketRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [search, setSearch]             = useState("");
  const [sortField, setSortField]       = useState<SortField>("name");
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  const [page, setPage]                 = useState(1);
  const [modalMode, setModalMode]       = useState<ModalMode>(null);
  const [selected, setSelected]         = useState<Department | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm]                 = useState({ name: "", description: "", location: "" });
  // ── Per-field errors (replaces single formError string) ─────────────────────
  const [formErrors, setFormErrors]     = useState<DeptFormErrors>({});
  const [submitting, setSubmitting]     = useState(false);

  // ── Fetch departments with ticket count ──────────────────────────────────────
  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("departments")
      .select(`id, name, description, location, created_at, file_reports(count)`)
      .eq("is_archived", false)  
      .order(sortField, { ascending: sortDir === "asc" });

    if (error) { showToast(friendlyError(error.message), "error"); setLoading(false); return; }

    const mapped: Department[] = (data ?? []).map((d: any) => ({
      ...d,
      ticket_count: d.file_reports?.[0]?.count ?? 0,
    }));
    setDepartments(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchDepartments(); }, [sortField, sortDir]);

  useEffect(() => {
    const channel = supabase
      .channel(`departments_sync_${sortField}_${sortDir}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Department;
            if (updated.is_archived) {
              setDepartments(prev => prev.filter(d => d.id !== updated.id));
              return;
            }
          }
          void fetchDepartments();
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => { void fetchDepartments(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sortField, sortDir]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Filtered + paginated ─────────────────────────────────────────────────────
  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase()) ||
    d.location?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Sort toggle ──────────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  // ── Open modals ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ name: "", description: "", location: "" });
    setFormErrors({});
    setModalMode("add");
  };

  const openEdit = (d: Department) => {
    setSelected(d);
    setForm({ name: d.name, description: d.description ?? "", location: d.location ?? "" });
    setFormErrors({});
    setModalMode("edit");
  };

  const openView = async (d: Department) => {
    setSelected(d);
    setModalMode("view");
    setTicketLoading(true);
    const { data, error } = await supabase
      .from("file_reports")
      .select("id, ticket_number, title, employee_name, issue_type, status, date_submitted")
      .eq("department_id", d.id)
      .order("date_submitted", { ascending: false });
    if (error) showToast(friendlyError(error.message), "error");
    setTickets((data ?? []) as TicketRow[]);
    setTicketLoading(false);
  };

  const closeModal = () => { setModalMode(null); setSelected(null); setTickets([]); };

  // ── Submit add/edit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Per-field validation
    const errors: DeptFormErrors = {};
    if (!form.name.trim()) {
      errors.name = "Department name is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Uniqueness check — report on the name field
    const dupQuery = supabase.from("departments").select("id").ilike("name", form.name.trim());
    if (modalMode === "edit" && selected) dupQuery.neq("id", selected.id);
    const { data: dup } = await dupQuery;
    if (dup && dup.length > 0) {
      setFormErrors({ name: "Please use a different department name." });
      return;
    }

    setSubmitting(true);
    if (modalMode === "add") {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
      };
      const { data: inserted, error } = await supabase.from("departments").insert(payload).select("id").single();
      if (error) {
        setFormErrors({ name: friendlyError(error.message) });
        setSubmitting(false);
        return;
      }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "department_created",
        entityType: "department",
        entityId: inserted?.id ?? null,
        meta: { department_name: payload.name },
      });
      showToast(`Department "${form.name.trim()}" added successfully.`, "success");
    } else if (modalMode === "edit" && selected) {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
      };
      const { error } = await supabase.from("departments").update(payload).eq("id", selected.id);
      if (error) {
        setFormErrors({ name: friendlyError(error.message) });
        setSubmitting(false);
        return;
      }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "department_updated",
        entityType: "department",
        entityId: selected.id,
        meta: { department_name: payload.name },
      });
      showToast(`Department "${form.name.trim()}" updated successfully.`, "success");
    }
    setSubmitting(false);
    closeModal();
    fetchDepartments();
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (d: Department) => {
    setDeleteTarget(d);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const removedName = deleteTarget.name;
    const removedId = deleteTarget.id;
    const { error } = await supabase.from("departments").update({ is_archived: true }).eq("id", deleteTarget.id);
    if (error) showToast(friendlyError(error.message), "error");
    else {
       await insertActivityLog(supabase, {
          actorUserId: getSessionUserId(),
          action: "department_archived",
          entityType: "department",
          entityId: removedId,
          meta: { department_name: removedName },
        });
        showToast(`Department "${removedName}" archived.`, "success");
        }
    setDeleteTarget(null);
    fetchDepartments();
  };

  // ── Ticket summary counts for view modal ─────────────────────────────────────
  const ticketSummary = useMemo(() => ({
    total:      tickets.length,
    pending:    tickets.filter(t => t.status === "Pending").length,
    inProgress: tickets.filter(t => t.status === "In Progress").length,
    resolved:   tickets.filter(t => t.status === "Resolved").length,
  }), [tickets]);

  // ── Sort icon ────────────────────────────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortField }) => (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, verticalAlign: "middle" }}>
      <ChevronUp   size={10} color={sortField === field && sortDir === "asc"  ? brandBlue : "#cbd5e1"} />
      <ChevronDown size={10} color={sortField === field && sortDir === "desc" ? brandBlue : "#cbd5e1"} />
    </span>
  );

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "'Poppins', sans-serif",
    outline: "none", color: "#0f172a", background: "#f8fafc", boxSizing: "border-box",
  };

  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: "#fca5a5",
    background: "#fff8f8",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block",
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila",
    });

    // ── Skeleton ──────────────────────────────────────────────────────────────────
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

const TableRowSkeleton: React.FC = () => (
  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="70%" height={13} radius={5} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="85%" height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="60%" height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width={50} height={22} radius={999} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width={90} height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={30} height={30} radius={8} />
      </div>
    </td>
  </tr>
);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .departments-root, .departments-root * { box-sizing: border-box; }
        .dept-row:hover { background: #f8fafc !important; }
        .icon-btn:hover { background: #f1f5f9 !important; }
        .icon-btn-ou { transition: box-shadow 0.15s, transform 0.12s !important; }
        .icon-btn-ou:hover { background: #f1f5f9 !important; box-shadow: 0 3px 8px rgba(0,0,0,0.10) !important; transform: translateY(-1px) !important; }
        .modal-overlay { animation: fadeIn 0.15s ease; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .modal-box { animation: slideUp 0.18s ease; }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .ticket-row-view:hover { background: #f8fafc !important; }
        @media (max-width: 640px) {
          .dept-header-row { flex-direction: column; align-items: flex-start !important; }
        }
        @keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>

      <div className="departments-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a", paddingTop: "2rem" }}>

        <CrudAlertToast toast={toast} />

        {/* ── Header row ── */}
        <div className="dept-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: brandBlue}}>
              <Building2 size={20} color={brandBlue} /> Departments
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>Manage office departments and view their support tickets.</p>
          </div>
          <button
            onClick={openAdd}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 1rem", borderRadius: 10, border: "none",
              background: brandBlue, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(10,76,134,0.28)", transition: "filter 0.15s, transform 0.12s",
            }}
          >
            <Plus size={15} /> ADD DEPARTMENT
          </button>
        </div>

        {/* ── Table card ── */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e8edf2", overflow: "hidden", boxShadow: "0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)" }}>

          {/* Search bar */}
          <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid #e8edf2", background: "#fafcff" }}>
            <div style={{ position: "relative", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search departments…"
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f0f5fb", borderBottom: "1px solid #dde6f0" }}>
                  {[
                    { label: "Department Name", field: "name" as SortField },
                    { label: "Description",     field: null },
                    { label: "Location",        field: null },
                    { label: "Tickets",         field: null },
                    { label: "Created",         field: "created_at" as SortField },
                    { label: "Actions",         field: null },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={() => col.field && toggleSort(col.field)}
                      style={{
                        padding: "0.7rem 1rem", textAlign: "left", fontWeight: 600,
                        color: "#475569", fontSize: 12, letterSpacing: "0.04em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                        cursor: col.field ? "pointer" : "default", userSelect: "none",
                      }}
                    >
                      {col.label}
                      {col.field && <SortIcon field={col.field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   Array.from({ length: PAGE_SIZE }).map((_, i) => <TableRowSkeleton key={i} />)
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No departments found.</td></tr>
                ) : paginated.map(d => (
                  <tr key={d.id} className="dept-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0f172a" }}>{d.name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.description || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                      {d.location || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: "rgba(10,76,134,0.08)", color: brandBlue,
                      }}>
                        <Ticket size={11} /> {d.ticket_count ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {fmtDate(d.created_at)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { icon: <Eye size={14} />,    title: "View tickets",  fn: () => openView(d),     color: brandBlue  },
                          { icon: <Pencil size={14} />, title: "Edit",          fn: () => openEdit(d),     color: brandBlue  },
                          { icon: <Trash2 size={14} />, title: "Delete",        fn: () => handleDelete(d), color: "#dc2626" },
                        ].map((btn, i) => (
                          <button key={i} title={btn.title} className="icon-btn icon-btn-ou" onClick={btn.fn}
                            style={{
                              width: 30, height: 30, borderRadius: 8, border: "1px solid #e8edf2",
                              background: "#fff", cursor: "pointer", display: "flex",
                              alignItems: "center", justifyContent: "center", color: btn.color,
                              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                            }}>
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
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e8edf2", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: page === 1 ? "#cbd5e1" : "#475569" }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e8edf2", background: n === page ? brandBlue : "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", color: n === page ? "#fff" : "#475569", fontWeight: n === page ? 600 : 400, cursor: "pointer", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e8edf2", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: page === totalPages ? "#cbd5e1" : "#475569" }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Add / Edit Modal ── */}
        {(modalMode === "add" || modalMode === "edit") && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: brandBlue }}>
                  {modalMode === "add" ? "Add Department" : "Edit Department"}
                </h2>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Department Name — with per-field error */}
                <div>
                  <label style={labelStyle}>Department Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    value={form.name}
                    onChange={e => {
                      setForm(f => ({ ...f, name: e.target.value }));
                      setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. CENRO"
                    style={formErrors.name ? inputErrorStyle : inputStyle}
                  />
                  <FieldError msg={formErrors.name} />
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => {
                      setForm(f => ({ ...f, description: e.target.value }));
                      setFormErrors(prev => ({ ...prev, description: undefined }));
                    }}
                    placeholder="Brief description of the department…"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, borderColor: formErrors.description ? "#fca5a5" : "#e2e8f0", background: formErrors.description ? "#fff8f8" : "#f8fafc" }}
                  />
                  <FieldError msg={formErrors.description} />
                </div>

                {/* Location */}
                <div>
                  <label style={labelStyle}>Location <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    value={form.location}
                    onChange={e => {
                      setForm(f => ({ ...f, location: e.target.value }));
                      setFormErrors(prev => ({ ...prev, location: undefined }));
                    }}
                    placeholder="e.g. 2nd Floor, Room 201"
                    style={formErrors.location ? inputErrorStyle : inputStyle}
                  />
                  <FieldError msg={formErrors.location} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button onClick={closeModal}
                  style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "none", background: brandBlue, color: "#fff", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Poppins', sans-serif", opacity: submitting ? 0.7 : 1, boxShadow: "0 4px 12px rgba(10,76,134,0.25)" }}>
                  {submitting ? "Saving…" : modalMode === "add" ? "Add Department" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── View Tickets Modal ── */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 760, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}>

              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8, color: brandBlue, letterSpacing: 1, fontFamily: "'Poppins', sans-serif" }}>{selected.name}</h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>Support tickets from this department</p>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={18} />
                </button>
              </div>

              {/* Ticket summary cards */}
              {!ticketLoading && tickets.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem", marginBottom: "1rem" }}>
                  {[
                    { label: "Total",       value: ticketSummary.total,      color: brandBlue,  bg: "rgba(10,76,134,0.08)"   },
                    { label: "Assigned",     value: ticketSummary.pending,    color: "#a16207",  bg: "rgba(234,179,8,0.10)"   },
                    { label: "In Progress", value: ticketSummary.inProgress, color: "#0369a1",  bg: "rgba(14,165,233,0.10)"  },
                    { label: "Resolved",    value: ticketSummary.resolved,   color: "#15803d",  bg: "rgba(22,163,74,0.10)"   },
                  ].map(c => (
                    <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: "0.65rem 0.8rem" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: c.color, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tickets table */}
              <div style={{ overflowY: "auto", flex: 1, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                {ticketLoading ? (
                  <p style={{ textAlign: "center", color: "#94a3b8", padding: "2rem", fontSize: 14 }}>Loading tickets…</p>
                ) : tickets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2.5rem", color: "#94a3b8" }}>
                    <Ticket size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>No tickets filed from this department yet.</p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {["Ticket #", "Title", "Employee", "Type", "Status", "Date Filed"].map(h => (
                          <th key={h} style={{ padding: "0.6rem 0.9rem", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map(t => (
                        <tr key={t.id} className="ticket-row-view" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.12s" }}>
                          <td style={{ padding: "0.65rem 0.9rem" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: brandBlue, background: "rgba(10,76,134,0.08)", padding: "2px 7px", borderRadius: 6 }}>
                              <Hash size={10} />{t.ticket_number ?? "—"}
                            </span>
                          </td>
                          <td style={{ padding: "0.65rem 0.9rem", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</td>
                          <td style={{ padding: "0.65rem 0.9rem", color: "#475569" }}>{t.employee_name}</td>
                          <td style={{ padding: "0.65rem 0.9rem" }}><IssueTypeBadge type={t.issue_type} /></td>
                          <td style={{ padding: "0.65rem 0.9rem" }}><TicketStatusBadge status={t.status} /></td>
                          <td style={{ padding: "0.65rem 0.9rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(t.date_submitted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirm Modal ── */}
        {deleteTarget && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <Archive size={22} color="#dc2626" />
              </div>
             <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, fontFamily: "'Poppins', sans-serif" }}>Archive Department?</h2>
              <p style={{ fontSize: 13, color: "#475569", marginBottom: "1.4rem" }}>
                Archive <strong>{deleteTarget.name}</strong>? This department will be permanently removed from the list and cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Departments;