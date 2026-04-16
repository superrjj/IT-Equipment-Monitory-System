import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Pencil, Trash2, Eye, Search,
  ChevronUp, ChevronDown, X, AlertTriangle,
  ChevronLeft, ChevronRight, Package,
  Clock, User, CircleArrowUp, Building2,
  FileSpreadsheet, FileText, Loader, Calendar,
  Archive,
} from "lucide-react";
import { getSessionUserId, insertActivityLog } from "../../../lib/audit-notifications";
import { supabase } from "../../../lib/supabaseClient";
import { CrudAlertToast } from "@/components/ui/crud-alert-toast";

import {
  exportOutgoingUnitsToExcel,
  exportOutgoingUnitsToWord,
} from "../../../utils/exportOutgoingUnits";

type SortField = "date_released" | "unit_name" | "collected_by";
type SortDir = "asc" | "desc";
type ModalMode = "add" | "edit" | "view" | null;

type OutgoingUnitRow = {
  id: string;
  date_released: string;
  unit_name: string;
  collected_by: string;
  released_by_user_id: string | null;
  release_notes: string;
  department_id: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
};

type UserOption = { id: string; full_name: string; role: string };
type DepartmentOption = { id: string; name: string; parent_id?: string | null };
type IncomingSourceOption = {
  id: string;
  unit_name: string;
  reported_by: string;
  department_id: string | null;
  is_archived?: boolean;
};

type FormState = {
  date_released: string;
  unit_name: string;
  collected_by: string;
  released_by_user_id: string;
  release_notes: string;
  department_id: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const BRAND = "#0D518C";
const GREEN = "#16a34a";
const PAGE_SIZE = 10;
const EMPLOYEE_NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/;

function makeOutgoingMatchKey(unitName: string, departmentId?: string | null): string {
  return `${unitName.trim().toLowerCase()}::${(departmentId ?? "").trim().toLowerCase()}`;
}

function sanitize(val: string): string {
  return val
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
    .trim();
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.date_released) {
    errors.date_released = "Release date is required.";
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (form.date_released !== today)
      errors.date_released = "Release date must be today or earlier.";
  }

  const unit = form.unit_name.trim();
  if (!unit) errors.unit_name = "Unit is required.";
  else if (unit.length < 2) errors.unit_name = "Unit must be at least 2 characters.";
  else if (unit.length > 200) errors.unit_name = "Unit must be 200 characters or less.";

  const collector = form.collected_by.trim();
  if (!collector) errors.collected_by = "Employee name is required.";
  else if (!EMPLOYEE_NAME_REGEX.test(collector)) errors.collected_by = "Employee name must contain letters only.";
  else if (collector.length > 100) errors.collected_by = "Must be 100 characters or less.";

  if (!form.department_id.trim())
    errors.department_id = "Office / Department is required.";

  const notes = form.release_notes.trim();
  if (!notes) errors.release_notes = "Release notes are required.";
  else if (notes.length < 10) errors.release_notes = "Must be at least 10 characters.";
  else if (notes.length > 2000) errors.release_notes = "Must be 2000 characters or less.";

  return errors;
}

function friendlyError(msg: string): string {
  if (msg.includes("foreign key")) return "Cannot complete — a referenced record no longer exists.";
  if (msg.includes("not-null") || msg.includes("null value")) return "A required field is missing.";
  if (msg.includes("unique")) return "A duplicate record already exists.";
  return msg;
}

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "—";

const emptyForm = (): FormState => ({
  date_released: new Date().toISOString().slice(0, 10),
  unit_name: "",
  collected_by: "",
  released_by_user_id: "",
  release_notes: "",
  department_id: "",
});

const buildMonthOptions = (rows: OutgoingUnitRow[]): string[] => {
  const set = new Set<string>();
  rows.forEach(r => { if (r.date_released) set.add(r.date_released.slice(0, 7)); });
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


const OutgoingUnits: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const [rows, setRows]               = useState<OutgoingUnitRow[]>([]);
  const [itStaff, setItStaff]         = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [incomingSources, setIncomingSources] = useState<IncomingSourceOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [sortField, setSortField]     = useState<SortField>("date_released");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [page, setPage]               = useState(1);
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selected, setSelected]       = useState<OutgoingUnitRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OutgoingUnitRow | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting]   = useState(false);
  const [exporting, setExporting]     = useState<"excel" | "word" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>("");
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selectedIncomingId, setSelectedIncomingId] = useState<string>("");

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

  const deptMap = useMemo(() => {
    const m: Record<string, DepartmentOption> = {};
    departments.forEach(d => { m[d.id] = d; });
    return m;
  }, [departments]);

  const deptDisplayMap = useMemo(() => {
    const m: Record<string, string> = {};
    departments.forEach((d) => {
      const parentName = d.parent_id ? (deptMap[d.parent_id]?.name ?? "") : "";
      m[d.id] = parentName ? `${parentName} - ${d.name}` : d.name;
    });
    return m;
  }, [departments, deptMap]);

  const monthOptions        = useMemo(() => buildMonthOptions(rows), [rows]);
  const resolvedMonthFilter = exportMonth || null;
  const outgoingKeys = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const key = makeOutgoingMatchKey(r.unit_name, r.department_id);
      s.add(key);
    });
    return s;
  }, [rows]);

  const availableIncomingSources = useMemo(() => {
    return incomingSources.filter((src) => {
      const key = makeOutgoingMatchKey(src.unit_name, src.department_id);
      const isCurrentEditSelection =
        modalMode === "edit" &&
        !!selected &&
        src.unit_name === selected.unit_name &&
        (src.department_id ?? "") === (selected.department_id ?? "");
      return isCurrentEditSelection || !outgoingKeys.has(key);
    });
  }, [incomingSources, outgoingKeys, modalMode, selected]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: unitData, error: unitError }, { data: staff }, { data: depts }, { data: incoming }] = await Promise.all([
      supabase.from("outgoing_units").select("*").order(sortField, { ascending: sortDir === "asc" }).eq("is_archived", false),
      supabase
        .from("user_accounts")
        .select("id, full_name, role")
        .eq("is_active", true)
        .eq("is_archived", false)
        .eq("role", "IT Technician")
        .order("full_name"),
      supabase.from("departments").select("id, name, parent_id").eq("is_archived", false).order("name"),
      supabase.from("incoming_units").select("id, unit_name, reported_by, department_id, is_archived").eq("is_archived", false).order("date_received", { ascending: false }),
    ]);
    setItStaff((staff ?? []) as UserOption[]);
    setDepartments((depts ?? []) as DepartmentOption[]);
    setIncomingSources((incoming ?? []) as IncomingSourceOption[]);
    if (unitError) { showToast(friendlyError(unitError.message), "error"); setRows([]); }
    else setRows((unitData ?? []) as OutgoingUnitRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [sortField, sortDir]);

  useEffect(() => {
    const channel = supabase
      .channel("outgoing_units_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "outgoing_units" }, (payload) => {
        const newRow = payload.new as OutgoingUnitRow;
        if (newRow.is_archived) return;
        setRows(prev => prev.some(r => r.id === newRow.id) ? prev : [newRow, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "outgoing_units" }, (payload) => {
        const updated = payload.new as OutgoingUnitRow;
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

  const rowsEnriched = useMemo(
    () => rows.map(r => ({
      ...r,
      releaser_name:   r.released_by_user_id ? (userMap[r.released_by_user_id]?.full_name ?? "—") : "—",
      department_name: r.department_id        ? (deptDisplayMap[r.department_id]            ?? "—") : "—",
    })),
    [rows, userMap, deptDisplayMap]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsEnriched.filter(r => {
      if (!q) return true;
      return [r.unit_name, r.collected_by, r.release_notes, r.releaser_name, r.department_name]
        .join(" ").toLowerCase().includes(q);
    });
  }, [rowsEnriched, search]);

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
    setSelectedIncomingId("");
    setFieldErrors({});
    setSubmitting(false);
  };

  const openAdd = () => { closeModal(); setModalMode("add"); };

  const openEdit = (r: OutgoingUnitRow) => {
    closeModal();
    setSelected(r);
    setForm({
      date_released:       r.date_released.slice(0, 10),
      unit_name:           r.unit_name,
      collected_by:        r.collected_by,
      released_by_user_id: r.released_by_user_id ?? "",
      release_notes:       r.release_notes,
      department_id:       r.department_id ?? "",
    });
    const match = incomingSources.find(
      src =>
        makeOutgoingMatchKey(src.unit_name, src.department_id) ===
        makeOutgoingMatchKey(r.unit_name, r.department_id)
    );
    setSelectedIncomingId(match?.id ?? "");
    setModalMode("edit");
  };

  const openView = (r: OutgoingUnitRow) => { setSelected(r); setModalMode("view"); };

  const clearError = (field: keyof FormState) =>
    setFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });

  const handleSubmit = async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setSubmitting(true);

    const basePayload = {
      date_released:       new Date(form.date_released).toISOString(),
      unit_name:           sanitize(form.unit_name),
      collected_by:        sanitize(form.collected_by),
      release_notes:       sanitize(form.release_notes),
      department_id:       form.department_id || null,
    };

    if (modalMode === "add") {
      const { data: inserted, error } = await supabase.from("outgoing_units").insert(basePayload).select("id").single();
      if (error) { setFieldErrors({ unit_name: friendlyError(error.message) }); setSubmitting(false); return; }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "outgoing_unit_created",
        entityType: "outgoing_unit",
        entityId: inserted?.id ?? null,
        meta: { unit_name: basePayload.unit_name, collected_by: basePayload.collected_by },
      });
      showToast("Outgoing unit recorded successfully.", "success");
    } else if (modalMode === "edit" && selected) {
      const { error } = await supabase.from("outgoing_units")
        .update({ ...basePayload, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) { setFieldErrors({ unit_name: friendlyError(error.message) }); setSubmitting(false); return; }
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "outgoing_unit_updated",
        entityType: "outgoing_unit",
        entityId: selected.id,
        meta: { unit_name: basePayload.unit_name, collected_by: basePayload.collected_by },
      });
      showToast("Record updated successfully.", "success");
    }

    setSubmitting(false);
    closeModal();
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const removedName = deleteTarget.unit_name;
    const removedId   = deleteTarget.id;
    const { error } = await supabase.from("outgoing_units").update({ is_archived: true }).eq("id", deleteTarget.id);
    if (error) showToast(friendlyError(error.message), "error");
    else {
      await insertActivityLog(supabase, {
        actorUserId: getSessionUserId(),
        action: "outgoing_unit_archived",
        entityType: "outgoing_unit",
        entityId: removedId,
        meta: { unit_name: removedName },
      });
      showToast(`"${removedName}" has been archived.`, "success");
    }
    setDeleteTarget(null);
    fetchAll();
  };

  const handleExportExcel = () => {
    setExportMenuOpen(false);
    if (rows.length === 0) { showToast("No records to export.", "error"); return; }
    setExporting("excel");
    try {
      exportOutgoingUnitsToExcel(rows, deptDisplayMap, resolvedMonthFilter);
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
      await exportOutgoingUnitsToWord(rows, deptDisplayMap, resolvedMonthFilter);
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
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: `1px solid ${hasErr ? "#fca5a5" : "#e2e8f0"}`,
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    color: "#0f172a",
    background: hasErr ? "#fff8f8" : "#f8fafc",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 4,
    display: "block",
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

const StatCardSkeletonIU: React.FC = () => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "0.9rem 1rem", border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(10,76,134,0.07)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Skeleton width={36} height={36} radius={10} />
      <Skeleton width="50%" height={24} radius={6} />
    </div>
    <Skeleton width="65%" height={10} radius={4} />
  </div>
);

const OutgoingRowSkeleton: React.FC = () => (
  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width={100} height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="75%" height={13} radius={5} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="80%" height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="70%" height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="65%" height={12} radius={4} /></td>
    <td style={{ padding: "0.75rem 1rem" }}><Skeleton width="85%" height={12} radius={4} /></td>
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
        .ou-root, .ou-root * { box-sizing: border-box; }
        .icon-btn-ou { transition: box-shadow 0.15s, transform 0.12s !important; }
        .icon-btn-ou:hover { background: #f1f5f9 !important; box-shadow: 0 3px 8px rgba(0,0,0,0.10) !important; transform: translateY(-1px); }
        .ou-row:hover          { background: #f8fafc !important; }
        .icon-btn-ou:hover     { background: #f1f5f9 !important; }
        .ou-export-item:hover  { background: #f1f5f9 !important; }
        .modal-overlay-ou      { animation: ouFadeIn 0.15s ease; }
        @keyframes ouFadeIn    { from { opacity: 0 } to { opacity: 1 } }
        .modal-box-ou          { animation: ouSlideUp 0.18s ease; }
        @keyframes ouSlideUp   { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .ou-detail-row         { display: flex; gap: 8px; font-size: 13px; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
        .ou-detail-row:last-child { border-bottom: none; }
        .ou-detail-label       { font-size: 12px; font-weight: 600; color: #64748b; min-width: 160px; flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
        @keyframes spin        { to { transform: rotate(360deg); } }
        .ou-month-select:focus { outline: 2px solid #16a34a30; border-color: #16a34a !important; }
        .ou-export-btn:hover:not(:disabled) { background: #15803d !important; border-color: #15803d !important; }
        @keyframes skShimmer { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
      `}</style>

      <div className="ou-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a", paddingTop: "2rem"}}>

        <CrudAlertToast toast={toast} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: BRAND }}>
              <CircleArrowUp size={20} color={BRAND} /> Outgoing Units
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
              {readOnly
                ? "View-only list of units released from IT (you cannot add or change records)."
                : "Log equipment released from the IT office after repair or service."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Export dropdown */}
            <div ref={exportRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="ou-export-btn"
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

              {exportMenuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(10,76,134,0.13), 0 2px 8px rgba(0,0,0,0.06)", zIndex: 200,
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
                      className="ou-month-select"
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
                          {fmtMonthLabel(ym)} ({rows.filter(r => r.date_released?.slice(0, 7) === ym).length})
                        </option>
                      ))}
                    </select>
                    {exportMonth && (
                      <div style={{ marginTop: 5, fontSize: 11, color: GREEN, fontWeight: 500 }}>
                        {rows.filter(r => r.date_released?.slice(0, 7) === exportMonth).length} record(s) will be exported
                      </div>
                    )}
                  </div>

                  <button type="button" className="ou-export-item" onClick={handleExportExcel}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                    <FileSpreadsheet size={16} color={GREEN} />
                    Export to Excel (.xlsx)
                  </button>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  <button type="button" className="ou-export-item" onClick={handleExportWord}
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
                <Plus size={15} /> LOG OUTGOING UNIT
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {loading ? (
          [0,1].map(i => <StatCardSkeletonIU key={i} />)
        ) : (
          [
            { label: "Total logged",         value: rows.length,     color: BRAND,     icon: <Package size={16} /> },
            { label: "This list (filtered)", value: filtered.length, color: "#475569", icon: <Search  size={16} /> },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "0.9rem 1rem", border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.label}</div>
            </div>
          )))}
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e8edf2", overflow: "hidden", boxShadow: "0 4px 16px rgba(10,76,134,0.08), 0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #e8edf2", background: "#fafcff", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search unit, employee, office, notes…"
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
                <tr style={{ background: "#f0f5fb", borderBottom: "1px solid #dde6f0" }}>
                  {([
                    { label: "Date released",    field: "date_released" as SortField },
                    { label: "Unit",             field: "unit_name"     as SortField },
                    { label: "Name of Employee", field: "collected_by"  as SortField },
                    { label: "Office",           field: null },
                    { label: "Solution",         field: null },
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
                  Array.from({ length: PAGE_SIZE }).map((_, i) => <OutgoingRowSkeleton key={i} />)
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No outgoing units found.</td></tr>
                ) : paginated.map(r => (
                  <tr key={r.id} className="ou-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(r.date_released)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.unit_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.collected_by}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>{r.department_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.release_notes}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(readOnly
                          ? [{ icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),          color: BRAND     }]
                          : [
                              { icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),          color: BRAND     },
                              { icon: <Pencil size={14} />, title: "Edit",   fn: () => openEdit(r),          color: BRAND     },
                              { icon: <Trash2 size={14} />, title: "Delete", fn: () => setDeleteTarget(r),   color: "#dc2626" },
                            ]
                        ).map((btn, i) => (
                          <button key={i} title={btn.title} className="icon-btn-ou" onClick={btn.fn}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e8edf2", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: btn.color, transition: "background 0.15s" }}>
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
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: n === page ? BRAND : "#fff", color: n === page ? "#fff" : "#475569", fontWeight: n === page ? 600 : 400, cursor: "pointer", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
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

        {/* Add / Edit Modal */}
        {!readOnly && (modalMode === "add" || modalMode === "edit") && (
          <div className="modal-overlay-ou" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-ou" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 620, maxHeight: "calc(100vh - 32px)", overflowY: "auto",boxShadow: "0 24px 60px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif", letterSpacing: 1, color: BRAND }}>
                  {modalMode === "add" ? "Log outgoing unit" : "Edit outgoing unit"}
                </h2>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.9rem" }}>

                {/* Date */}
                <div>
                  <label style={labelStyle}>Date released <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    type="date"
                    value={form.date_released}
                    min={today}
                    max={today}
                    onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    onChange={e => { setForm(f => ({ ...f, date_released: e.target.value })); clearError("date_released"); }}
                    style={{ ...inputStyle(!!fieldErrors.date_released), cursor: "pointer" }}
                  />
                  <FieldError msg={fieldErrors.date_released} />
                </div>

                {/* Unit */}
                <div>
                  <label style={labelStyle}>Unit name <span style={{ color: "#dc2626" }}>*</span></label>
                  <select
                    value={selectedIncomingId}
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedIncomingId(id);
                      const picked = incomingSources.find(src => src.id === id);
                      if (!picked) {
                        setForm(f => ({ ...f, unit_name: "", collected_by: "", department_id: "" }));
                      } else {
                        setForm(f => ({
                          ...f,
                          unit_name: picked.unit_name,
                          collected_by: picked.reported_by,
                          department_id: picked.department_id ?? "",
                        }));
                      }
                      clearError("unit_name");
                      clearError("collected_by");
                      clearError("department_id");
                    }}
                    style={{ ...inputStyle(!!fieldErrors.unit_name), cursor: "pointer" }}
                  >
                    <option value="">— Select from incoming units —</option>
                    {availableIncomingSources.map(src => (
                      <option key={src.id} value={src.id}>
                        {src.unit_name} - {src.reported_by}
                      </option>
                    ))}
                  </select>
                  <FieldError msg={fieldErrors.unit_name} />
                </div>

                {/* Employee */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Name of Employee <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.collected_by}
                    onChange={e => { setForm(f => ({ ...f, collected_by: e.target.value })); clearError("collected_by"); }}
                    placeholder="Employee who picked up the unit" maxLength={100}
                    style={inputStyle(!!fieldErrors.collected_by)} />
                  <FieldError msg={fieldErrors.collected_by} />
                </div>

                {/* Department */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={13} color="#475569" /> Office / Department <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    value={form.department_id ? (deptDisplayMap[form.department_id] ?? "—") : ""}
                    readOnly
                    placeholder="Auto-filled from selected incoming unit"
                    style={{
                      ...inputStyle(!!fieldErrors.department_id),
                      background: "#f1f5f9",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }}
                  />
                  <FieldError msg={fieldErrors.department_id} />
                </div>

                {/* Release Notes */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Solution <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea value={form.release_notes}
                    onChange={e => { setForm(f => ({ ...f, release_notes: e.target.value })); clearError("release_notes"); }}
                    placeholder="Work performed, condition on release, or other handover details…" rows={4} maxLength={2000}
                    style={{ ...inputStyle(!!fieldErrors.release_notes), resize: "vertical", lineHeight: 1.6 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <FieldError msg={fieldErrors.release_notes} />
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto", paddingTop: 3 }}>
                      {form.release_notes.length}/2000
                    </span>
                  </div>
                </div>

              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                <button onClick={closeModal} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", transition: "filter 0.15s, transform 0.12s", opacity: submitting ? 0.7 : 1, boxShadow: "0 4px 12px rgba(10,76,134,0.25)" }}>
                  {submitting ? "Saving…" : modalMode === "add" ? "Save record" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay-ou" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-ou" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 560, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8, color: BRAND, letterSpacing: 1, fontFamily: "'Poppins', sans-serif"}}>{selected.unit_name}</h2>
                  <span style={{ fontSize: 11, fontWeight: 600, color: BRAND, background: `${BRAND}12`, padding: "2px 10px", borderRadius: 999 }}>Outgoing unit</span>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0 }}><X size={18} /></button>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND, marginBottom: 4 }}>Release details</div>
              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1rem" }}>
                {([
                  { label: "Date released",      value: fmtDate(selected.date_released),                                                               icon: <Clock     size={12} /> },
                  { label: "Name of Employee",    value: selected.collected_by,                                                                         icon: <User      size={12} /> },
                  { label: "Office / Department", value: selected.department_id ? (deptDisplayMap[selected.department_id] ?? "—") : "—",                 icon: <Building2 size={12} /> },
                ] as { label: string; value: string; icon: React.ReactNode }[]).map(row => (
                  <div key={row.label} className="ou-detail-row">
                    <span className="ou-detail-label">{row.icon} {row.label}</span>
                    <span style={{ color: "#0f172a", flex: 1 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Solution</div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem", lineHeight: 1.7, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, marginBottom: "1rem" }}>
                {selected.release_notes}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.4rem" }}>
                {!readOnly && (
                  <button onClick={() => { closeModal(); openEdit(selected); }}
                    style={{ padding: "0.5rem 1rem", borderRadius: 8, border: `1.5px solid ${BRAND}`, background: "#fff", color: BRAND, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
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
          <div className="modal-overlay-ou" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box-ou" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(15,23,42,0.2)", textAlign: "center" }}>
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

export default OutgoingUnits;