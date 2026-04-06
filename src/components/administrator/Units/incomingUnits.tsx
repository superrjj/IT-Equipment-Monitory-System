import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Pencil, Trash2, Eye, Search,
  ChevronUp, ChevronDown, X, AlertTriangle,
  ChevronLeft, ChevronRight, Package,
  Clock, User, Users, Inbox, Building2,
  FileSpreadsheet, FileText, Loader, Calendar, Archive
} from "lucide-react";
import { getSessionUserId, insertActivityLog } from "../../../lib/audit-notifications";
import {
  exportIncomingUnitsToExcel,
  exportIncomingUnitsToWord,
} from "../../../utils/exportIncomingUnits";
import { supabase } from "../../../lib/supabaseClient";

type SortField = "date_received" | "unit_name" | "reported_by";
type SortDir   = "asc" | "desc";
type ModalMode = "add" | "edit" | "view" | null;

type IncomingUnitRow = {
  id: string;
  date_received: string;
  unit_name: string;
  unit_cable: string | null;
  reported_by: string;
  received_by_user_id: string | null;
  issue_description: string;
  department_id: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
};

type EnrichedRow = IncomingUnitRow & {
  receiver_name: string;
  department_name: string;
};

type UserOption       = { id: string; full_name: string; role: string };
type DepartmentOption = { id: string; name: string };

type FormState = {
  date_received: string;
  unit_name: string;
  reported_by: string;
  received_by_user_id: string;
  issue_description: string;
  department_id: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const BRAND     = "#0a4c86";
const GREEN     = "#16a34a";
const PAGE_SIZE = 10;

function sanitize(val: string): string {
  return val
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
    .trim();
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.date_received) {
    errors.date_received = "Date received is required.";
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (form.date_received !== today)
      errors.date_received = "Date received must be today's date.";
  }

  const unit = form.unit_name.trim();
  if (!unit)                errors.unit_name = "Unit name is required.";
  else if (unit.length < 2)    errors.unit_name = "Unit name must be at least 2 characters.";
  else if (unit.length > 200)  errors.unit_name = "Unit name must be 200 characters or less.";

  const reporter = form.reported_by.trim();
  if (!reporter)                errors.reported_by = "Employee name is required.";
  else if (reporter.length > 100) errors.reported_by = "Must be 100 characters or less.";

  if (!form.department_id.trim())
    errors.department_id = "Office / Department is required.";

  if (!form.received_by_user_id.trim())
    errors.received_by_user_id = "Please select the IT Technician member who received the unit.";

  const desc = form.issue_description.trim();
  if (!desc)                errors.issue_description = "Issue description is required.";
  else if (desc.length < 10)   errors.issue_description = "Must be at least 10 characters.";
  else if (desc.length > 2000) errors.issue_description = "Must be 2000 characters or less.";

  return errors;
}

function friendlyError(msg: string): string {
  if (msg.includes("foreign key"))                           return "Cannot complete — a referenced record no longer exists.";
  if (msg.includes("not-null") || msg.includes("null value")) return "A required field is missing.";
  if (msg.includes("unique"))                                return "A duplicate record already exists.";
  return msg;
}

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "—";

const emptyForm = (): FormState => ({
  date_received:       new Date().toISOString().slice(0, 10),
  unit_name:           "",
  reported_by:         "",
  received_by_user_id: "",
  issue_description:   "",
  department_id:       "",
});

const buildMonthOptions = (rows: IncomingUnitRow[]): string[] => {
  const set = new Set<string>();
  rows.forEach(r => { if (r.date_received) set.add(r.date_received.slice(0, 7)); });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
};

const fmtMonthLabel = (ym: string): string => {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    year: "numeric", month: "long",
  });
};

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

const StaffSinglePicker: React.FC<{
  users: UserOption[];
  selectedId: string;
  onChange: (id: string) => void;
  hasError: boolean;
}> = ({ users, selectedId, onChange, hasError }) => (
  <div style={{
    border: `1px solid ${hasError ? "#fca5a5" : "#e2e8f0"}`,
    borderRadius: 8, background: hasError ? "#fff8f8" : "#f8fafc",
    maxHeight: 160, overflowY: "auto",
    padding: "0.4rem", display: "flex", flexDirection: "column", gap: 2,
  }}>
    {users.length === 0 ? (
      <div style={{ padding: "0.5rem", fontSize: 12, color: "#94a3b8" }}>No active IT Technician found.</div>
    ) : (
      users.map(u => {
        const active = selectedId === u.id;
        return (
          <button key={u.id} type="button" onClick={() => onChange(u.id)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "0.45rem 0.6rem", borderRadius: 6, border: "none",
            background: active ? `${BRAND}10` : "transparent",
            cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.12s",
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
              border: `1.5px solid ${active ? BRAND : "#cbd5e1"}`,
              background: active ? BRAND : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? BRAND : "#374151", fontFamily: "'Poppins', sans-serif" }}>
              {u.full_name}
            </span>
            <span style={{ fontSize: 11, color: "#0a4c86", marginLeft: "auto", fontFamily: "'Poppins', sans-serif", letterSpacing: 0.50, fontWeight: 500 }}>{u.role}</span>
          </button>
        );
      })
    )}
  </div>
);

const IncomingUnits: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [rows, setRows]               = useState<IncomingUnitRow[]>([]);
  const [itStaff, setItStaff]         = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [sortField, setSortField]     = useState<SortField>("date_received");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [page, setPage]               = useState(1);
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selected, setSelected]       = useState<IncomingUnitRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomingUnitRow | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting]   = useState(false);
  const [exporting, setExporting]     = useState<"excel" | "word" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>("");
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);

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

  const userMap = useMemo(() => {
    const m: Record<string, UserOption> = {};
    itStaff.forEach(u => { m[u.id] = u; });
    return m;
  }, [itStaff]);

  const deptStrMap = useMemo(() => {
    const m: Record<string, string> = {};
    departments.forEach(d => { m[d.id] = d.name; });
    return m;
  }, [departments]);

  const userStrMap = useMemo(() => {
    const m: Record<string, string> = {};
    itStaff.forEach(u => { m[u.id] = u.full_name; });
    return m;
  }, [itStaff]);

  const deptMap = useMemo(() => {
    const m: Record<string, DepartmentOption> = {};
    departments.forEach(d => { m[d.id] = d; });
    return m;
  }, [departments]);

  const monthOptions = useMemo(() => buildMonthOptions(rows), [rows]);

  const fetchAll = async () => {
    setLoading(true);
    const [
      { data: unitData, error: unitError },
      { data: staff },
      { data: depts },
    ] = await Promise.all([
      supabase.from("incoming_units").select("*").order(sortField, { ascending: sortDir === "asc" }).eq("is_archived", false),
      supabase
        .from("user_accounts")
        .select("id, full_name, role")
        .eq("is_active", true)
        .eq("is_archived", false)
        .eq("role", "IT Technician")
        .order("full_name"),
      supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    ]);
    setItStaff((staff ?? []) as UserOption[]);
    setDepartments((depts ?? []) as DepartmentOption[]);
    if (unitError) { showToast(friendlyError(unitError.message), "error"); setRows([]); }
    else setRows((unitData ?? []) as IncomingUnitRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [sortField, sortDir]);

  useEffect(() => {
    const channel = supabase
      .channel("incoming_units_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incoming_units" }, (payload) => {
        const newRow = payload.new as IncomingUnitRow;
        if (newRow.is_archived) return;
        setRows(prev => prev.some(r => r.id === newRow.id) ? prev : [newRow, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "incoming_units" }, (payload) => {
        const updated = payload.new as IncomingUnitRow;
        if (updated.is_archived) {
          setRows(prev => prev.filter(r => r.id !== updated.id));
          setSelected(prev => prev?.id === updated.id ? null : prev);
          return;
        }
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(prev => prev?.id === updated.id ? updated : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selected && (modalMode === "view" || modalMode === "edit")) {
      setModalMode(null);
      setForm(emptyForm());
      setFieldErrors({});
    }
  }, [selected]);

  const rowsEnriched = useMemo((): EnrichedRow[] =>
    rows.map(r => ({
      ...r,
      receiver_name:   r.received_by_user_id ? (userMap[r.received_by_user_id]?.full_name ?? "—") : "—",
      department_name: r.department_id       ? (deptMap[r.department_id]?.name            ?? "—") : "—",
    })),
    [rows, userMap, deptMap]
  );

  const rowsSorted = useMemo((): EnrichedRow[] =>
    [...rowsEnriched].sort((a, b) => {
      const aVal = (a[sortField] as string) ?? "";
      const bVal = (b[sortField] as string) ?? "";
      const cmp  = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    }),
    [rowsEnriched, sortField, sortDir]
  );

  const filtered = useMemo((): EnrichedRow[] => {
    const q = search.trim().toLowerCase();
    return rowsSorted.filter(r => {
      if (!q) return true;
      return [r.unit_name, r.reported_by, r.issue_description, r.receiver_name, r.department_name]
        .join(" ").toLowerCase().includes(q);
    });
  }, [rowsSorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, verticalAlign: "middle" }}>
      <ChevronUp   size={10} color={sortField === field && sortDir === "asc"  ? BRAND : "#cbd5e1"} />
      <ChevronDown size={10} color={sortField === field && sortDir === "desc" ? BRAND : "#cbd5e1"} />
    </span>
  );

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setForm(emptyForm());
    setFieldErrors({});
    setSubmitting(false);
  };

  const openAdd = () => { closeModal(); setModalMode("add"); };

  const openEdit = (enriched: EnrichedRow) => {
    const base = rows.find(r => r.id === enriched.id) ?? enriched;
    closeModal();
    setSelected(base);
    setForm({
      date_received:       base.date_received.slice(0, 10),
      unit_name:           base.unit_name,
      reported_by:         base.reported_by,
      received_by_user_id: base.received_by_user_id ?? "",
      issue_description:   base.issue_description,
      department_id:       base.department_id ?? "",
    });
    setModalMode("edit");
  };

  const openView = (enriched: EnrichedRow) => {
    const base = rows.find(r => r.id === enriched.id) ?? enriched;
    setSelected(base);
    setModalMode("view");
  };

  const clearError = (field: keyof FormState) =>
    setFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setSubmitting(true);

    const basePayload = {
      date_received:       new Date(form.date_received).toISOString(),
      unit_name:           sanitize(form.unit_name),
      unit_cable:          null,
      reported_by:         sanitize(form.reported_by),
      received_by_user_id: form.received_by_user_id || null,
      issue_description:   sanitize(form.issue_description),
      department_id:       form.department_id || null,
    };

    if (modalMode === "add") {
      const { data: inserted, error } = await supabase
        .from("incoming_units").insert(basePayload).select("id").single();
      if (error) { setFieldErrors({ unit_name: friendlyError(error.message) }); setSubmitting(false); return; }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "incoming_unit_created",
        entityType: "incoming_unit",
        entityId: inserted?.id ?? null,
        meta: { unit_name: basePayload.unit_name, reported_by: basePayload.reported_by },
      });
      showToast("Incoming unit recorded successfully.", "success");
    } else if (modalMode === "edit" && selected) {
      const { error } = await supabase.from("incoming_units")
        .update({ ...basePayload, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) { setFieldErrors({ unit_name: friendlyError(error.message) }); setSubmitting(false); return; }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "incoming_unit_updated",
        entityType: "incoming_unit",
        entityId: selected.id,
        meta: { unit_name: basePayload.unit_name, reported_by: basePayload.reported_by },
      });
      showToast("Record updated successfully.", "success");
    }

    setSubmitting(false);
    closeModal();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const removedName = deleteTarget.unit_name;
    const removedId   = deleteTarget.id;
    const { error } = await supabase.from("incoming_units").update({ is_archived: true }).eq("id", deleteTarget.id);
    if (error) showToast(friendlyError(error.message), "error");
    else {
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "incoming_unit_archived",
        entityType: "incoming_unit",
        entityId: removedId,
        meta: { unit_name: removedName },
      });
      showToast(`"${removedName}" has been archived.`, "success");
    }
    setDeleteTarget(null);
  };

  const resolvedMonthFilter = exportMonth || null;

  const handleExportExcel = () => {
    setExportMenuOpen(false);
    if (rows.length === 0) { showToast("No records to export.", "error"); return; }
    setExporting("excel");
    try {
      exportIncomingUnitsToExcel(rows, deptStrMap, userStrMap, resolvedMonthFilter);
      showToast(
        resolvedMonthFilter
          ? `Excel exported for ${fmtMonthLabel(resolvedMonthFilter)}.`
          : "Excel file downloaded.",
        "success"
      );
    } catch {
      showToast("Failed to export Excel.", "error");
    } finally {
      setExporting(null);
    }
  };

  const handleExportWord = async () => {
    setExportMenuOpen(false);
    if (rows.length === 0) { showToast("No records to export.", "error"); return; }
    setExporting("word");
    try {
      await exportIncomingUnitsToWord(rows, deptStrMap, userStrMap, resolvedMonthFilter);
      showToast(
        resolvedMonthFilter
          ? `Word document exported for ${fmtMonthLabel(resolvedMonthFilter)}.`
          : "Word document downloaded.",
        "success"
      );
    } catch {
      showToast("Failed to export Word document.", "error");
    } finally {
      setExporting(null);
    }
  };

  const inputStyle = (hasErr?: boolean): React.CSSProperties => ({
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: `1px solid ${hasErr ? "#fca5a5" : "#e2e8f0"}`,
    fontSize: 13, fontFamily: "'Poppins', sans-serif",
    outline: "none", color: "#0f172a",
    background: hasErr ? "#fff8f8" : "#f8fafc",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .iu-root, .iu-root * { box-sizing: border-box; }
        .iu-row:hover          { background: #f8fafc !important; }
        .icon-btn-iu:hover     { background: #f1f5f9 !important; }
        .iu-export-item:hover  { background: #f1f5f9 !important; }
        .modal-overlay-iu      { animation: iuFadeIn 0.15s ease; }
        @keyframes iuFadeIn    { from { opacity: 0 } to { opacity: 1 } }
        .modal-box-iu          { animation: iuSlideUp 0.18s ease; }
        @keyframes iuSlideUp   { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .iu-detail-row         { display: flex; gap: 8px; font-size: 13px; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
        .iu-detail-row:last-child { border-bottom: none; }
        .iu-detail-label       { font-size: 12px; font-weight: 600; color: #64748b; min-width: 160px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
        @keyframes spin        { to { transform: rotate(360deg); } }
        .iu-month-select:focus { outline: 2px solid #16a34a30; border-color: #16a34a !important; }
        .iu-export-btn:hover:not(:disabled) { background: #15803d !important; border-color: #15803d !important; }
      `}</style>

      <div className="iu-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            padding: "0.65rem 1.1rem", borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color:      toast.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)", maxWidth: 380,
          }}>{toast.msg}</div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: BRAND }}>
              <Inbox size={20} color={BRAND} /> Incoming Units
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
              {readOnly
                ? "View-only list of units received by IT (you cannot add or change records)."
                : "Log equipment received by the IT office for repair or service."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Export dropdown */}
            <div ref={exportRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="iu-export-btn"
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
                  transition: "background 0.15s, opacity 0.15s",
                }}
              >
                {exporting
                  ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
                  : <FileSpreadsheet size={14} />
                }
                Export
                <ChevronDown size={14} />
              </button>

              {exportMenuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                  boxShadow: "0 8px 28px rgba(15,23,42,0.13)", zIndex: 200,
                  minWidth: 248, overflow: "hidden",
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
                      className="iu-month-select"
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
                      {monthOptions.map(ym => (
                        <option key={ym} value={ym}>
                          {fmtMonthLabel(ym)} ({rows.filter(r => r.date_received?.slice(0, 7) === ym).length})
                        </option>
                      ))}
                    </select>
                    {exportMonth && (
                      <div style={{ marginTop: 5, fontSize: 11, color: GREEN, fontWeight: 500 }}>
                        {rows.filter(r => r.date_received?.slice(0, 7) === exportMonth).length} record(s) will be exported
                      </div>
                    )}
                  </div>

                  <button type="button" className="iu-export-item" onClick={handleExportExcel}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                    <FileSpreadsheet size={16} color="#16a34a" />
                    Export to Excel (.xlsx)
                  </button>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  <button type="button" className="iu-export-item" onClick={handleExportWord}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                    <FileText size={16} color="#2563eb" />
                    Export to Word (.docx)
                  </button>
                </div>
              )}
            </div>

            {!readOnly && (
              <button onClick={openAdd} style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.5rem 1rem", borderRadius: 10, border: "none",
                background: BRAND, color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
              }}>
                <Plus size={15} /> LOG INCOMING UNIT
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {[
            { label: "Total logged",         value: rows.length,     color: BRAND,     icon: <Package size={16} /> },
            { label: "This list (filtered)", value: filtered.length, color: "#475569", icon: <Search  size={16} /> },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "0.9rem 1rem", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search unit, employee, office…"
                style={{ ...inputStyle(), paddingLeft: 32 }}
              />
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              Page {page}/{totalPages}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {([
                    { label: "Date",             field: "date_received" as SortField },
                    { label: "Unit",             field: "unit_name"     as SortField },
                    { label: "Name of Employee", field: "reported_by"   as SortField },
                    { label: "Office",           field: null },
                    { label: "Person In Charge", field: null },
                    { label: "Problem",          field: null },
                    { label: "Actions",          field: null },
                  ] as { label: string; field: SortField | null }[]).map(col => (
                    <th key={col.label} onClick={() => col.field && toggleSort(col.field)}
                      style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: col.field ? "pointer" : "default", userSelect: "none" }}>
                      {col.label}{col.field && <SortIcon field={col.field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>No incoming units found.</td></tr>
                ) : paginated.map(r => (
                  <tr key={r.id} className="iu-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(r.date_received)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.unit_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.reported_by}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>{r.department_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.receiver_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.issue_description}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(readOnly
                          ? [{ icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),                                        color: BRAND }]
                          : [
                              { icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),                                        color: BRAND },
                              { icon: <Pencil size={14} />, title: "Edit",   fn: () => openEdit(r),                                        color: BRAND },
                              { icon: <Trash2 size={14} />, title: "Delete", fn: () => setDeleteTarget(rows.find(b => b.id === r.id) ?? r), color: "#dc2626" },
                            ]
                        ).map((btn, i) => (
                          <button key={i} title={btn.title} className="icon-btn-iu" onClick={btn.fn}
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

        {/* Add / Edit Modal */}
        {!readOnly && (modalMode === "add" || modalMode === "edit") && (
          <div className="modal-overlay-iu" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-iu" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 580, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif", letterSpacing: 1, color: BRAND }}>
                  {modalMode === "add" ? "Log incoming unit" : "Edit incoming unit"}
                </h2>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.9rem" }}>
                {/* Date */}
                <div>
                  <label style={labelStyle}>Date <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    type="date"
                    value={form.date_received}
                    min={today}
                    max={today}
                    onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    onChange={e => { setForm(f => ({ ...f, date_received: e.target.value })); clearError("date_received"); }}
                    style={{ ...inputStyle(!!fieldErrors.date_received), cursor: "pointer" }}
                  />
                  <FieldError msg={fieldErrors.date_received} />
                </div>

                {/* Unit */}
                <div>
                  <label style={labelStyle}>Unit <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.unit_name}
                    onChange={e => { setForm(f => ({ ...f, unit_name: e.target.value })); clearError("unit_name"); }}
                    placeholder="e.g. EPSON L3210" maxLength={200}
                    style={inputStyle(!!fieldErrors.unit_name)} />
                  <FieldError msg={fieldErrors.unit_name} />
                </div>

                {/* Employee */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Name of Employee <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.reported_by}
                    onChange={e => { setForm(f => ({ ...f, reported_by: e.target.value })); clearError("reported_by"); }}
                    placeholder="Employee who brought or reported the unit" maxLength={100}
                    style={inputStyle(!!fieldErrors.reported_by)} />
                  <FieldError msg={fieldErrors.reported_by} />
                </div>

                {/* Department */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={13} color="#475569" /> Office / Department <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select value={form.department_id}
                    onChange={e => { setForm(f => ({ ...f, department_id: e.target.value })); clearError("department_id"); }}
                    style={{ ...inputStyle(!!fieldErrors.department_id), cursor: "pointer" }}>
                    <option value="">— Select department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <FieldError msg={fieldErrors.department_id} />
                </div>

                {/* Received by */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={13} color="#475569" /> Received by (IT Technician) <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <StaffSinglePicker
                    users={itStaff}
                    selectedId={form.received_by_user_id}
                    onChange={id => { setForm(f => ({ ...f, received_by_user_id: id })); clearError("received_by_user_id"); }}
                    hasError={!!fieldErrors.received_by_user_id}
                  />
                  <FieldError msg={fieldErrors.received_by_user_id} />
                </div>

                {/* Issue description */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Problem <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea value={form.issue_description}
                    onChange={e => { setForm(f => ({ ...f, issue_description: e.target.value })); clearError("issue_description"); }}
                    placeholder="Describe the problem or service requested…" rows={4} maxLength={2000}
                    style={{ ...inputStyle(!!fieldErrors.issue_description), resize: "vertical", lineHeight: 1.6 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <FieldError msg={fieldErrors.issue_description} />
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto", paddingTop: 3 }}>
                      {form.issue_description.length}/2000
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button onClick={closeModal} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'Poppins', sans-serif", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Saving…" : modalMode === "add" ? "Save record" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay-iu" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-iu" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 520, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8 }}>{selected.unit_name}</h2>
                  <span style={{ fontSize: 11, fontWeight: 600, color: BRAND, background: `${BRAND}12`, padding: "2px 10px", borderRadius: 999 }}>Incoming unit</span>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0 }}><X size={18} /></button>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND, marginBottom: 4 }}>Receipt details</div>
              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1rem" }}>
                {([
                  { label: "Date received",      value: fmtDate(selected.date_received),                                                               icon: <Clock     size={12} /> },
                  { label: "Name of Employee",    value: selected.reported_by,                                                                          icon: <User      size={12} /> },
                  { label: "Office / Department", value: selected.department_id ? (deptMap[selected.department_id]?.name ?? "—") : "—",                 icon: <Building2 size={12} /> },
                  { label: "Received by",         value: selected.received_by_user_id ? (userMap[selected.received_by_user_id]?.full_name ?? "—") : "—", icon: <Users     size={12} /> },
                ] as { label: string; value: string; icon: React.ReactNode }[]).map(row => (
                  <div key={row.label} className="iu-detail-row">
                    <span className="iu-detail-label">{row.icon} {row.label}</span>
                    <span style={{ color: "#0f172a", flex: 1 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Issue description</div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem", lineHeight: 1.7, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, marginBottom: "1rem" }}>
                {selected.issue_description}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                {!readOnly && (
                  <button
                    onClick={() => {
                      const enriched = rowsEnriched.find(e => e.id === selected.id);
                      if (enriched) { closeModal(); openEdit(enriched); }
                    }}
                    style={{ padding: "0.5rem 1rem", borderRadius: 8, border: `1.5px solid ${BRAND}`, background: "#fff", color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button onClick={closeModal} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {!readOnly && deleteTarget && (
          <div className="modal-overlay-iu" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box-iu" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(15,23,42,0.2)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <Archive size={22} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, fontFamily: "'Poppins', sans-serif" }}>Archive record?</h2>
              <p style={{ fontSize: 13, color: "#475569", marginBottom: "1.4rem" }}>
                Archive <strong>&quot;{deleteTarget.unit_name}&quot;</strong>? This record will be permanently removed from the list and cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)} style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
                <button onClick={confirmDelete} style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>Archive</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default IncomingUnits;