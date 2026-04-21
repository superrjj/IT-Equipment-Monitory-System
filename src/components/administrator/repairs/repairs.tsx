import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  notifyTicketAssignees,
  insertActivityLog,
  getSessionUserId,
  dispatchNavBadgesChanged,
} from "../../../lib/audit-notifications";
import {
  Eye, Search,
  ChevronUp, ChevronDown, X, AlertTriangle,
  ChevronLeft, ChevronRight, Wrench,
  ClipboardList, Loader, CheckCircle, Users,
  User, Building2, FileText,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";

type SortField = "status" | "date_submitted" | "created_at" | "title";
type SortDir = "asc" | "desc";
type ModalMode = "assign" | "bulk_assign" | "view" | null;

/** Open ticket row from `file_reports` (non-resolved, non-archived). */
type TicketRow = {
  id: string;
  ticket_number: string | null;
  employee_name: string;
  department_id: string;
  issue_type: string;
  title: string;
  status: string;
  date_submitted: string;
  assigned_to: string[];
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  technician_names?: string[];
};

type UserOption = { id: string; full_name: string; role: string; avatar_url?: string | null };
type DepartmentOption = { id: string; name: string };

const BRAND = "#0a4c86";
const PAGE_SIZE = 10;

const getAvatarUrl = (u: UserOption): string | null => {
  if (u.avatar_url) return u.avatar_url;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base}/storage/v1/object/public/profile-avatar/${u.id}/avatar.jpg`;
};

const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

function parseAssignedTo(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw == null || raw === "") return [];
  return [String(raw)];
}

function isUnassignedTicket(t: TicketRow): boolean {
  return parseAssignedTo(t.assigned_to).length === 0;
}

/** Shown in the Status column: unassigned tickets always read as Pending. */
function displayTicketRowStatus(t: TicketRow): string {
  if (isUnassignedTicket(t)) return "Pending";
  const s = String(t.status ?? "Pending");
  return s === "Pending" ? "Assigned" : s;
}

function friendlyError(msg: string): string {
  if (msg.includes("foreign key")) return "Cannot complete — a referenced record no longer exists.";
  if (msg.includes("not-null") || msg.includes("null value")) return "A required field is missing.";
  if (msg.includes("unique")) return "A duplicate record already exists.";
  return msg;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const statusMeta: Record<string, { bg: string; color: string; dot: string }> = {
  Pending:       { bg: "rgba(59,130,246,0.10)",  color: "#475569", dot: "#3b82f6" },
  Assigned:      { bg: "rgba(59,130,246,0.10)",  color: "#475569", dot: "#3b82f6" },
  "In Progress": { bg: "rgba(234,179,8,0.12)",   color: "#a16207", dot: "#eab308" },
  Resolved:      { bg: "rgba(22,163,74,0.10)",   color: "#15803d", dot: "#16a34a" },
};

const TicketStatusBadge: React.FC<{ label: string }> = ({ label }) => {
  const s = statusMeta[label] ?? statusMeta.Pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
};

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
        <Skeleton width={180} height={22} radius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={280} height={12} radius={4} />
      </div>
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
      </div>
      <div style={{ padding: "0.8rem 1.2rem" }}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px 1fr 140px 160px 100px 120px 100px", gap: 10, padding: "0.7rem 0", borderBottom: idx === 5 ? "none" : "1px solid #f1f5f9", alignItems: "center" }}>
            <Skeleton width={100} height={14} radius={6} />
            <Skeleton width="90%" height={14} radius={6} />
            <Skeleton width={120} height={14} radius={6} />
            <Skeleton width={140} height={14} radius={6} />
            <Skeleton width={86} height={22} radius={999} />
            <Skeleton width={92} height={12} radius={6} />
            <Skeleton width={74} height={30} radius={8} />
          </div>
        ))}
      </div>
    </div>
  </>
);

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
            <span
              title={u.full_name}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "1px solid #dbe3ef",
                background: "#dbeafe",
                color: BRAND,
                fontSize: 10,
                fontWeight: 700,
                overflow: "hidden",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {getAvatarUrl(u) ? (
                <img
                  src={getAvatarUrl(u) ?? ""}
                  alt={u.full_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const next = e.currentTarget.nextElementSibling as HTMLSpanElement | null;
                    if (next) next.style.display = "inline";
                  }}
                />
              ) : null}
              <span style={{ display: getAvatarUrl(u) ? "none" : "inline" }}>{initials(u.full_name)}</span>
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

const TechnicianAvatarStack: React.FC<{
  ids: string[];
  userMap: Record<string, UserOption>;
  compact?: boolean;
}> = ({ ids, userMap, compact = false }) => {
  if (!ids || ids.length === 0)
    return <span style={{ color: "#cbd5e1" }}>—</span>;

  const users = ids.map(id => userMap[id]).filter(Boolean) as UserOption[];
  const shown = users.slice(0, compact ? 3 : 5);
  const extra = users.length - shown.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: compact ? "nowrap" : "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", marginRight: 2 }}>
        {shown.map((u, i) => (
          <span
            key={u.id}
            title={u.full_name}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1.5px solid #fff",
              background: "#dbeafe",
              color: BRAND,
              fontSize: 10,
              fontWeight: 700,
              marginLeft: i === 0 ? 0 : -8,
              overflow: "hidden",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 1px #cbd5e1",
            }}
          >
            {getAvatarUrl(u) ? (
              <img
                src={getAvatarUrl(u) ?? ""}
                alt={u.full_name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLSpanElement | null;
                  if (next) next.style.display = "inline";
                }}
              />
            ) : null}
            <span style={{ display: getAvatarUrl(u) ? "none" : "inline" }}>{initials(u.full_name)}</span>
          </span>
        ))}
      </div>
      {shown[0] && (
        <span
          style={{
            fontSize: 12,
            color: "#334155",
            fontWeight: 600,
            maxWidth: compact ? 120 : "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={shown[0].full_name}
        >
          {shown[0].full_name}
        </span>
      )}
      {extra > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${BRAND}12`, color: BRAND }}>
          +{extra}
        </span>
      )}
    </div>
  );
};

const Repairs: React.FC = () => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField] = useState<SortField>("date_submitted");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const userMap = useMemo(() => {
    const m: Record<string, UserOption> = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    departments.forEach(d => { m[d.id] = d.name; });
    return m;
  }, [departments]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("file_reports")
      .select(`
        id, ticket_number, employee_name, department_id, issue_type, title, status,
        date_submitted, assigned_to, created_at, updated_at, is_archived
      `)
      .eq("is_archived", false)
      .neq("status", "Resolved")
      .order(sortField, { ascending: sortDir === "asc" });

    if (error) {
      showToast(friendlyError(error.message), "error");
      setTickets([]);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        assigned_to: parseAssignedTo(r.assigned_to),
      })) as TicketRow[];
      setTickets(mapped);
    }
    setLoading(false);
  }, [sortField, sortDir]);

  const fetchUsersAndDepts = useCallback(async () => {
    const [{ data: ua }, { data: depts }] = await Promise.all([
      supabase
        .from("user_accounts")
        .select("id, full_name, role, avatar_url")
        .eq("is_active", true)
        .eq("is_archived", false)
        .eq("role", "IT Technician")
        .order("full_name"),
      supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    ]);
    setUsers((ua ?? []) as UserOption[]);
    setDepartments((depts ?? []) as DepartmentOption[]);
  }, []);

  useEffect(() => { void fetchTickets(); }, [fetchTickets]);
  useEffect(() => { void fetchUsersAndDepts(); }, [fetchUsersAndDepts]);

  useEffect(() => {
    const channel = supabase
      .channel("repairs_file_reports_queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "file_reports" },
        () => { void fetchTickets(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchTickets]);

  const ticketsWithNames = useMemo(() =>
    tickets.map(t => ({
      ...t,
      technician_names: parseAssignedTo(t.assigned_to)
        .map(id => userMap[id]?.full_name)
        .filter(Boolean) as string[],
    })),
  [tickets, userMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ticketsWithNames.filter(t => {
      const displayStatus = displayTicketRowStatus(t);
      const matchSearch = !q || [
        t.ticket_number ?? "",
        t.title,
        t.employee_name,
        t.issue_type,
        ...(t.technician_names ?? []),
        deptMap[t.department_id] ?? "",
      ].some(v => String(v).toLowerCase().includes(q));

      const matchStatus =
        filterStatus === "All"
        || (filterStatus === "Unassigned" && isUnassignedTicket(t))
        || (filterStatus === "Assigned" && !isUnassignedTicket(t) && displayStatus === "Assigned")
        || (filterStatus === "In Progress" && !isUnassignedTicket(t) && displayStatus === "In Progress");

      return matchSearch && matchStatus;
    });
  }, [ticketsWithNames, search, filterStatus, deptMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    total:       tickets.length,
    unassigned:  tickets.filter(isUnassignedTicket).length,
    inProgress:  tickets.filter(t => !isUnassignedTicket(t) && t.status === "In Progress").length,
    withAssignee: tickets.filter(t => !isUnassignedTicket(t)).length,
  }), [tickets]);

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setAssignIds([]);
    setFormError("");
    setSubmitting(false);
  };

  const openView = (t: TicketRow) => {
    setSelected(t);
    setModalMode("view");
  };

  const openAssign = (t: TicketRow) => {
    if (!isUnassignedTicket(t)) return;
    setSelected(t);
    setAssignIds([]);
    setFormError("");
    setModalMode("assign");
  };

  const openBulkAssign = () => {
    const ids = selectedTicketIds.filter(id => {
      const found = tickets.find(t => t.id === id);
      return !!found && isUnassignedTicket(found);
    });
    if (ids.length === 0) {
      showToast("Select at least one unassigned ticket.", "error");
      return;
    }
    setSelected(null);
    setAssignIds([]);
    setFormError("");
    setModalMode("bulk_assign");
  };

  const handleAssignSubmit = async () => {
    const targets =
      modalMode === "bulk_assign"
        ? tickets.filter(t => selectedTicketIds.includes(t.id) && isUnassignedTicket(t))
        : selected
          ? [selected]
          : [];
    if (targets.length === 0) return;
    if (assignIds.length === 0) {
      setFormError("Please assign at least one technician.");
      return;
    }
    setFormError("");
    setSubmitting(true);

    const updateBuilder = supabase.from("file_reports").update({
      assigned_to: assignIds,
      status: "Assigned",
      updated_at: new Date().toISOString(),
    });
    const { error } =
      modalMode === "bulk_assign"
        ? await updateBuilder.in("id", targets.map(t => t.id))
        : await updateBuilder.eq("id", targets[0].id);

    if (error) {
      showToast(friendlyError(error.message), "error");
      setSubmitting(false);
      return;
    }

    await Promise.all(
      targets.map(async (t) => {
        await notifyTicketAssignees(supabase, assignIds, {
          ticketId: t.id,
          ticketTitle: t.title,
          ticketNumber: t.ticket_number ?? null,
          actorUserId: localStorage.getItem("session_user_id"),
        });
        await insertActivityLog(supabase, {
          actorUserId: getSessionUserId(),
          action: "ticket_updated",
          entityType: "file_report",
          entityId: t.id,
          meta: {
            source: modalMode === "bulk_assign" ? "assign_jobs_bulk" : "assign_jobs",
            ticket_number: t.ticket_number ?? null,
            assignees: assignIds.length,
          },
        });
      })
    );

    showToast(
      modalMode === "bulk_assign"
        ? `Assigned technicians to ${targets.length} tickets.`
        : "Technicians assigned successfully.",
      "success"
    );
    dispatchNavBadgesChanged();
    setSubmitting(false);
    if (modalMode === "bulk_assign") setSelectedTicketIds([]);
    closeModal();
    void fetchTickets();
  };

  const paginatedUnassignedIds = useMemo(
    () => paginated.filter(isUnassignedTicket).map(t => t.id),
    [paginated]
  );
  const allVisibleSelected =
    paginatedUnassignedIds.length > 0 &&
    paginatedUnassignedIds.every(id => selectedTicketIds.includes(id));

  const toggleSelectVisible = () => {
    setSelectedTicketIds(prev => {
      if (allVisibleSelected) return prev.filter(id => !paginatedUnassignedIds.includes(id));
      return Array.from(new Set([...prev, ...paginatedUnassignedIds]));
    });
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTicketIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "'Poppins', sans-serif",
    outline: "none", color: "#0f172a", background: "#f8fafc", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block",
  };

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

        <div className="rp-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 2, display: "flex", alignItems: "center", gap: 8, color: BRAND, fontFamily: "'Poppins', sans-serif" }}>
              <Wrench size={20} color={BRAND} /> Assign Jobs
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
              Track and manage repair tickets submitted by employees.
            </p>
          </div>
        </div>

        <div className="rp-stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {[
            { label: "Open tickets", value: counts.total,      color: BRAND,     icon: <ClipboardList size={16} /> },
            { label: "Unassigned",   value: counts.unassigned, color: "#475569", icon: <Users size={16} /> },
            { label: "Has assignee", value: counts.withAssignee, color: "#3b5bdb", icon: <CheckCircle size={16} /> },
            { label: "In progress",  value: counts.inProgress, color: "#a16207", icon: <Loader size={16} /> },
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

        <div style={{ background: "#ffffff", borderRadius: 18, border: "1px solid #e8edf2", overflow: "hidden", boxShadow: "0 6px 22px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)" }}>

          <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
                style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            <select className="rp-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="All">All</option>
              <option value="Unassigned">Unassigned</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
            </select>
            <button
              type="button"
              onClick={openBulkAssign}
              disabled={selectedTicketIds.length === 0}
              style={{
                padding: "0.45rem 0.8rem",
                borderRadius: 8,
                border: `1px solid ${BRAND}`,
                background: selectedTicketIds.length === 0 ? "#e2e8f0" : BRAND,
                color: selectedTicketIds.length === 0 ? "#64748b" : "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: selectedTicketIds.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Bulk assign ({selectedTicketIds.length})
            </button>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              Page {page}/{totalPages}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0.7rem 1rem", width: 38 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectVisible}
                      disabled={paginatedUnassignedIds.length === 0}
                      style={{ cursor: paginatedUnassignedIds.length === 0 ? "not-allowed" : "pointer" }}
                      title="Select all visible unassigned tickets"
                    />
                  </th>
                  {([
                    { label: "Ticket No.",     field: null },
                    { label: "Issue",          field: "title"          as SortField },
                    { label: "Employee",       field: null },
                    { label: "Department",     field: null },
                    { label: "Technician(s)",  field: null },
                    { label: "Status",         field: "status"         as SortField },
                    { label: "Submitted",      field: "date_submitted" as SortField },
                    { label: "Actions",        field: null },
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
                  <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>No tickets to assign.</td></tr>
                ) : paginated.map(t => {
                  const unassigned = isUnassignedTicket(t);
                  const statusLabel = displayTicketRowStatus(t);
                  const checked = selectedTicketIds.includes(t.id);
                  return (
                    <tr key={t.id} className="rp-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                      <td style={{ padding: "0.75rem 1rem", width: 38 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!unassigned}
                          onChange={() => toggleTicketSelection(t.id)}
                          style={{ cursor: unassigned ? "pointer" : "not-allowed" }}
                        />
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {t.ticket_number
                          ? <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, background: "rgba(10,76,134,0.07)", color: BRAND, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                              {t.ticket_number}
                            </span>
                          : <span style={{ color: "#cbd5e1" }}>—</span>
                        }
                      </td>
                      <td style={{ padding: "0.75rem 1rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                        {t.title}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{t.employee_name}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {deptMap[t.department_id] ?? "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>
                        <TechnicianAvatarStack ids={parseAssignedTo(t.assigned_to)} userMap={userMap} compact />
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <TicketStatusBadge label={statusLabel} />
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(t.date_submitted)}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            title="View"
                            className="icon-btn-rp"
                            type="button"
                            onClick={() => openView(t)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, transition: "background 0.15s" }}
                          >
                            <Eye size={14} />
                          </button>
                          {unassigned ? (
                            <button
                              type="button"
                              onClick={() => openAssign(t)}
                              style={{
                                padding: "0.35rem 0.75rem",
                                borderRadius: 8,
                                border: `1px solid ${BRAND}`,
                                background: BRAND,
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              Assign
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Already assigned"
                              aria-disabled
                              style={{
                                padding: "0.35rem 0.75rem",
                                borderRadius: 8,
                                border: `1px solid ${BRAND}`,
                                background: BRAND,
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "not-allowed",
                                fontFamily: "'Poppins', sans-serif",
                                opacity: 0.42,
                              }}
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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

        {/* Assign modal */}
        {(modalMode === "assign" || modalMode === "bulk_assign") && (selected || modalMode === "bulk_assign") && (
          <div className="modal-overlay-rp" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-rp" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 520, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif", color: BRAND, letterSpacing: 1 }}>
                  Assign technicians
                </h2>
                <button type="button" onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
              </div>

              {modalMode === "assign" && selected && (
                <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ticket</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {selected.ticket_number && (
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: BRAND, background: "rgba(10,76,134,0.08)", padding: "2px 8px", borderRadius: 6 }}>{selected.ticket_number}</span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{selected.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{selected.employee_name}</div>
                </div>
              )}
              {modalMode === "bulk_assign" && (
                <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Bulk assignment</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                    {selectedTicketIds.length} unassigned tickets selected
                  </div>
                </div>
              )}

              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={13} color="#475569" /> IT Technician(s) <span style={{ color: "#dc2626" }}>*</span>
                {assignIds.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: BRAND, background: `${BRAND}10`, padding: "1px 8px", borderRadius: 999 }}>
                    {assignIds.length} selected
                  </span>
                )}
              </label>
              <TechnicianPicker
                users={users}
                selected={assignIds}
                onChange={setAssignIds}
                hasError={!!formError && assignIds.length === 0}
              />

              {formError && (
                <div style={{ marginTop: "0.85rem", padding: "0.55rem 0.8rem", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} /> {formError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button type="button" onClick={closeModal} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Cancel
                </button>
                <button type="button" onClick={() => void handleAssignSubmit()} disabled={submitting} style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Poppins', sans-serif", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Saving…" : modalMode === "bulk_assign" ? "Assign selected tickets" : "Save assignment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View modal */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay-rp" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-rp" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 480, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 6 }}>{selected.title}</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <TicketStatusBadge label={displayTicketRowStatus(selected)} />
                    {selected.ticket_number && (
                      <span style={{ fontSize: 11, color: BRAND, fontFamily: "monospace", fontWeight: 700, background: "rgba(10,76,134,0.07)", padding: "2px 8px", borderRadius: 6 }}>
                        {selected.ticket_number}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0 }}><X size={18} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1rem" }}>
                <div className="rp-detail-row">
                  <span className="rp-detail-label"><User size={12} /> Employee</span>
                  <span style={{ color: "#0f172a" }}>{selected.employee_name}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label"><Building2 size={12} /> Department</span>
                  <span style={{ color: "#0f172a" }}>{deptMap[selected.department_id] ?? "—"}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label"><FileText size={12} /> Issue type</span>
                  <span style={{ color: "#0f172a" }}>{selected.issue_type}</span>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label"><Users size={12} /> Technicians</span>
                  <div style={{ flex: 1 }}>
                    <TechnicianAvatarStack ids={parseAssignedTo(selected.assigned_to)} userMap={userMap} />
                  </div>
                </div>
                <div className="rp-detail-row">
                  <span className="rp-detail-label">Submitted</span>
                  <span style={{ color: "#0f172a" }}>{fmtDate(selected.date_submitted)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                {isUnassignedTicket(selected) && (
                  <button type="button" onClick={() => { closeModal(); openAssign(selected); }}
                    style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                    Assign
                  </button>
                )}
                <button type="button" onClick={closeModal}
                  style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>
                  Close
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
