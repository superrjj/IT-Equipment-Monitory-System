import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, Pencil, Trash2, Eye, Search,
  ChevronUp, ChevronDown, X, AlertTriangle,
  ChevronLeft, ChevronRight, ShieldAlert,
  Monitor, Cpu, Wifi, Plug, HelpCircle, Building2,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";

// ── Supabase client ────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ── Types ──────────────────────────────────────────────────────────────────────
type Category    = "Hardware" | "Software" | "Network / Internet" | "Peripheral" | "Other";
type ReportType   = "Incoming" | "Outgoing";
type SortField   = "title" | "category" | "report_type" | "reported_date";
type SortDir     = "asc" | "desc";
type ModalMode   = "add" | "edit" | "view" | null;

type FileReport = {
  id:                    string;
  equipment_name:        string;
  reported_by_name:      string;
  reported_by_department: string;
  category:              Category;
  title:                 string;
  description:           string;
  report_type:           ReportType;
  reported_date:         string;
  resolved_at:           string | null;
  created_at:            string;
  updated_at:            string;
};

type Department = { id: string; name: string };

type FormState = {
  equipment_name:        string;
  reported_by_name:      string;
  reported_by_department: string;
  category:              Category;
  title:                 string;
  description:           string;
  report_type:           ReportType;
  reported_date:         string;
  resolved_at:           string;
};

const BRAND     = "#0a4c86";
const PAGE_SIZE = 10;

const CATEGORIES: Category[] = [
  "Hardware", "Software", "Network / Internet", "Peripheral", "Other",
];

const REPORT_TYPES: ReportType[] = ["Incoming", "Outgoing"];

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<Category, {
  icon: React.ReactNode;
  bg: string;
  activeBg: string;
  color: string;
  border: string;
}> = {
  "Hardware":          { icon: <Cpu size={14} />,      bg: "#f8fafc", activeBg: "rgba(10,76,134,0.08)",   color: "#0a4c86", border: "#0a4c86" },
  "Software":          { icon: <Monitor size={14} />,  bg: "#f8fafc", activeBg: "rgba(124,58,237,0.08)",  color: "#7c3aed", border: "#7c3aed" },
  "Network / Internet":{ icon: <Wifi size={14} />,     bg: "#f8fafc", activeBg: "rgba(6,182,212,0.08)",   color: "#0891b2", border: "#0891b2" },
  "Peripheral":        { icon: <Plug size={14} />,     bg: "#f8fafc", activeBg: "rgba(234,179,8,0.10)",   color: "#a16207", border: "#ca8a04" },
  "Other":             { icon: <HelpCircle size={14}/>, bg: "#f8fafc", activeBg: "rgba(100,116,139,0.08)", color: "#475569", border: "#64748b" },
};

const CATEGORY_BADGE_CONFIG: Record<Category, { icon: React.ReactNode; bg: string; color: string }> = {
  "Hardware":          { icon: <Cpu size={11} />,      bg: "rgba(10,76,134,0.09)",   color: "#0a4c86" },
  "Software":          { icon: <Monitor size={11} />,  bg: "rgba(124,58,237,0.09)",  color: "#7c3aed" },
  "Network / Internet":{ icon: <Wifi size={11} />,     bg: "rgba(6,182,212,0.09)",   color: "#0891b2" },
  "Peripheral":        { icon: <Plug size={11} />,     bg: "rgba(234,179,8,0.11)",   color: "#a16207" },
  "Other":             { icon: <HelpCircle size={11}/>, bg: "rgba(100,116,139,0.09)", color: "#475569" },
};

// ── Sanitize ──────────────────────────────────────────────────────────────────
function sanitize(val: string): string {
  return val
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
    .trim();
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateForm(form: FormState): string {
  const title = form.title.trim();
  if (!title)              return "Title is required.";
  if (title.length < 5)   return "Title must be at least 5 characters.";
  if (title.length > 150) return "Title must be 150 characters or less.";
  if (!form.equipment_name.trim()) return "Equipment name is required.";
  if (form.equipment_name.trim().length > 100) return "Equipment name must be 100 characters or less.";
  if (form.description.trim().length > 2000)
                           return "Description must be 2000 characters or less.";
  if (!form.reported_by_name.trim())      return "Reporter name is required.";
  if (!form.reported_by_department)       return "Reporter department is required.";
  if (!CATEGORIES.includes(form.category))  return "Invalid category selected.";
  if (!form.reported_date) return "Reported date is required.";
  if (form.report_type === "Outgoing" && !form.resolved_at)
    return "Please set a resolved date for Outgoing reports.";
  return "";
}

const emptyForm = (): FormState => ({
  equipment_name:        "",
  reported_by_name:      "",
  reported_by_department: "",
  category:              "Hardware",
  title:                 "",
  description:           "",
  report_type:           "Incoming",
  reported_date:         new Date().toISOString().slice(0, 10),
  resolved_at:           "",
});

function friendlyError(msg: string): string {
  if (msg.includes("foreign key"))  return "Cannot complete — a referenced record no longer exists.";
  if (msg.includes("not-null") || msg.includes("null value")) return "A required field is missing.";
  if (msg.includes("unique"))       return "A duplicate record already exists.";
  return msg;
}

// ── Badges ────────────────────────────────────────────────────────────────────
const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const cfg = CATEGORY_BADGE_CONFIG[category as Category]
    ?? { icon: <HelpCircle size={11} />, bg: "rgba(100,116,139,0.09)", color: "#475569" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, letterSpacing: "0.05em",
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.icon} {category}
    </span>
  );
};

const ReportTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const isIncoming = type === "Incoming";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      background: isIncoming ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)",
      color: isIncoming ? "#b91c1c" : "#15803d",
    }}>
      {isIncoming ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
      {type}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const FileReports: React.FC = () => {
  const [reports, setReports]         = useState<FileReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterType, setFilterType]         = useState("All");
  const [sortField, setSortField]     = useState<SortField>("reported_date");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [page, setPage]               = useState(1);
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selected, setSelected]       = useState<FileReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileReport | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm());
  const [formError, setFormError]     = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("file_reports")
      .select("*")
      .order(sortField, { ascending: sortDir === "asc" });

    if (error) {
      showToast(friendlyError(error.message), "error");
      setReports([]);
    } else {
      setReports(data ?? []);
    }
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");
    setDepartments((data ?? []) as Department[]);
  };

  useEffect(() => { fetchReports(); }, [sortField, sortDir]);
  useEffect(() => { fetchDepartments(); }, []);

  // ── Filter + paginate ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter(r => {
      const matchSearch = !q || [
        r.title, r.description, r.equipment_name,
        r.reported_by_name, r.reported_by_department, r.category,
      ].some(v => v.toLowerCase().includes(q));
      const matchCat    = filterCategory === "All" || r.category === filterCategory;
      const matchType   = filterType     === "All" || r.report_type === filterType;
      return matchSearch && matchCat && matchType;
    });
  }, [reports, search, filterCategory, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, filterCategory, filterType]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // ── Sort ───────────────────────────────────────────────────────────────────
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

  // ── Stat counts ────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total:    reports.length,
    incoming: reports.filter(r => r.report_type === "Incoming").length,
    outgoing: reports.filter(r => r.report_type === "Outgoing").length,
  }), [reports]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const closeModal = () => {
    setModalMode(null); setSelected(null);
    setForm(emptyForm()); setFormError(""); setSubmitting(false);
  };
  const openAdd  = () => { closeModal(); setModalMode("add"); };
  const openEdit = (r: FileReport) => {
    closeModal(); setSelected(r);
    setForm({
      equipment_name:        r.equipment_name,
      reported_by_name:      r.reported_by_name,
      reported_by_department: r.reported_by_department,
      category:              r.category,
      title:                 r.title,
      description:           r.description,
      report_type:           r.report_type,
      reported_date:         r.reported_date.slice(0, 10),
      resolved_at:           r.resolved_at ? r.resolved_at.slice(0, 10) : "",
    });
    setModalMode("edit");
  };
  const openView = (r: FileReport) => { setSelected(r); setModalMode("view"); };

  const handleCategoryChange = (cat: Category) => {
    setForm(f => ({ ...f, category: cat }));
    setFormError("");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    setSubmitting(true);

    const payload = {
      equipment_name:        sanitize(form.equipment_name),
      reported_by_name:      sanitize(form.reported_by_name),
      reported_by_department: form.reported_by_department,
      category:              form.category,
      title:                 sanitize(form.title),
      description:           sanitize(form.description),
      report_type:           form.report_type,
      reported_date:         new Date(form.reported_date).toISOString(),
      resolved_at:           form.report_type === "Outgoing" && form.resolved_at
                               ? new Date(form.resolved_at).toISOString() : null,
    };

    if (modalMode === "add") {
      const { error } = await supabase.from("file_reports").insert(payload);
      if (error) { setFormError(friendlyError(error.message)); setSubmitting(false); return; }
      showToast("Report filed successfully.", "success");
    } else if (modalMode === "edit" && selected) {
      const { error } = await supabase.from("file_reports").update(payload).eq("id", selected.id);
      if (error) { setFormError(friendlyError(error.message)); setSubmitting(false); return; }
      showToast("Report updated successfully.", "success");
    }

    setSubmitting(false);
    closeModal();
    fetchReports();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("file_reports").delete().eq("id", deleteTarget.id);
    if (error) showToast(friendlyError(error.message), "error");
    else showToast(`Report "${deleteTarget.title}" deleted.`, "success");
    setDeleteTarget(null);
    fetchReports();
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "'Poppins', sans-serif",
    outline: "none", color: "#0f172a", background: "#f8fafc", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

  // Get department name from ID
  const getDepartmentName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name ?? deptId;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .dr-root, .dr-root * { box-sizing: border-box; }
        .dr-row:hover { background: #f8fafc !important; }
        .icon-btn-dr:hover { background: #f1f5f9 !important; }
        .modal-overlay-dr { animation: drFadeIn 0.15s ease; }
        @keyframes drFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .modal-box-dr { animation: drSlideUp 0.18s ease; }
        @keyframes drSlideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .dr-filter { padding: 0.4rem 0.65rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; font-family: 'Poppins', sans-serif; color: #475569; outline: none; cursor: pointer; }
        .dr-filter:focus { border-color: #0a4c86; }

        .dr-cat-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .dr-cat-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 999px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          cursor: pointer; font-size: 12px; font-family: 'Poppins', sans-serif;
          font-weight: 600; color: #64748b; transition: all 0.15s;
          white-space: nowrap; user-select: none;
        }
        .dr-cat-pill:hover { border-color: #94a3b8; background: #f1f5f9; }
        .dr-cat-pill.active-hw  { border-color: #0a4c86; background: rgba(10,76,134,0.08);  color: #0a4c86; }
        .dr-cat-pill.active-sw  { border-color: #7c3aed; background: rgba(124,58,237,0.08); color: #7c3aed; }
        .dr-cat-pill.active-net { border-color: #0891b2; background: rgba(6,182,212,0.08);  color: #0891b2; }
        .dr-cat-pill.active-per { border-color: #ca8a04; background: rgba(234,179,8,0.10);  color: #a16207; }
        .dr-cat-pill.active-oth { border-color: #64748b; background: rgba(100,116,139,0.08);color: #475569; }

        .dr-detail-row { display: flex; gap: 8px; font-size: 13px; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
        .dr-detail-row:last-child { border-bottom: none; }
        .dr-detail-label { font-size: 12px; font-weight: 600; color: #64748b; min-width: 150px; flex-shrink: 0; }
      `}</style>

      <div className="dr-root" style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {/* ── Toast ── */}
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

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 2, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={20} color="#dc2626" /> File Reports
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "3px 0 0" }}>
              Track incoming and outgoing equipment reports.
            </p>
          </div>
          <button onClick={openAdd} style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.5rem 1rem", borderRadius: 10, border: "none",
            background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "'Poppins', sans-serif",
          }}>
            <Plus size={15} /> File Report
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
          {[
            { label: "Total Reports", value: counts.total,    color: BRAND,     icon: <ShieldAlert size={18} /> },
            { label: "Incoming",      value: counts.incoming, color: "#b91c1c", icon: <ArrowDownCircle size={18} /> },
            { label: "Outgoing",      value: counts.outgoing, color: "#15803d", icon: <ArrowUpCircle size={18} /> },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 14, padding: "1rem 1.2rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.05)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table card ── */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 4px 24px rgba(15,23,42,0.07)", overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "0.9rem 1.2rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 300 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
                style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            <select className="dr-filter" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="dr-filter" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="All">All Types</option>
              {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
                    { label: "Title",       field: "title"         as SortField },
                    { label: "Category",    field: "category"      as SortField },
                    { label: "Equipment",   field: null },
                    { label: "Reporter",    field: null },
                    { label: "Department",  field: null },
                    { label: "Type",        field: "report_type"   as SortField },
                    { label: "Reported",    field: "reported_date" as SortField },
                    { label: "Resolved",    field: null },
                    { label: "Actions",     field: null },
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
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>No reports found.</td></tr>
                ) : paginated.map(r => (
                  <tr key={r.id} className="dr-row" style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</td>
                    <td style={{ padding: "0.75rem 1rem" }}><CategoryBadge category={r.category} /></td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.equipment_name}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.reported_by_name}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0a4c86", background: "rgba(10,76,134,0.07)", padding: "2px 9px", borderRadius: 999 }}>
                        <Building2 size={11} /> {getDepartmentName(r.reported_by_department)}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}><ReportTypeBadge type={r.report_type} /></td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(r.reported_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { icon: <Eye size={14} />,    title: "View",   fn: () => openView(r),        color: BRAND },
                          { icon: <Pencil size={14} />, title: "Edit",   fn: () => openEdit(r),        color: BRAND },
                          { icon: <Trash2 size={14} />, title: "Delete", fn: () => setDeleteTarget(r), color: "#dc2626" },
                        ].map((btn, i) => (
                          <button key={i} title={btn.title} className="icon-btn-dr" onClick={btn.fn}
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
          <div className="modal-overlay-dr" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-dr" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 600, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {modalMode === "add" ? "File New Report" : "Edit Report"}
                </h2>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>

                {/* ── Category pills ── */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Category <span style={{ color: "#dc2626" }}>*</span></label>
                  <div className="dr-cat-pills">
                    {CATEGORIES.map(cat => {
                      const active = form.category === cat;
                      const activeClass =
                        cat === "Hardware"           ? "active-hw"  :
                        cat === "Software"           ? "active-sw"  :
                        cat === "Network / Internet" ? "active-net" :
                        cat === "Peripheral"         ? "active-per" : "active-oth";
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`dr-cat-pill${active ? ` ${activeClass}` : ""}`}
                          onClick={() => handleCategoryChange(cat)}
                        >
                          {CATEGORY_CONFIG[cat].icon}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Title <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.title}
                    onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormError(""); }}
                    placeholder="Brief description of the issue"
                    maxLength={150}
                    style={{ ...inputStyle, borderColor: formError && !form.title.trim() ? "#fca5a5" : "#e2e8f0" }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textAlign: "right" }}>{form.title.length}/150</div>
                </div>

                {/* Equipment Name */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>Equipment Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.equipment_name}
                    onChange={e => { setForm(f => ({ ...f, equipment_name: e.target.value })); setFormError(""); }}
                    placeholder="e.g. Epson Printer L3110"
                    maxLength={100}
                    style={{ ...inputStyle, borderColor: formError && !form.equipment_name.trim() ? "#fca5a5" : "#e2e8f0" }}
                  />
                </div>

                {/* Reporter Name */}
                <div>
                  <label style={labelStyle}>Reporter Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input value={form.reported_by_name}
                    onChange={e => { setForm(f => ({ ...f, reported_by_name: e.target.value })); setFormError(""); }}
                    placeholder="e.g. Juan Dela Cruz"
                    style={{ ...inputStyle, borderColor: formError && !form.reported_by_name.trim() ? "#fca5a5" : "#e2e8f0" }}
                  />
                </div>

                {/* Reporter Department */}
                <div>
                  <label style={labelStyle}>Reporter Department <span style={{ color: "#dc2626" }}>*</span></label>
                  <select value={form.reported_by_department}
                    onChange={e => { setForm(f => ({ ...f, reported_by_department: e.target.value })); setFormError(""); }}
                    style={{ ...selectStyle, borderColor: formError && !form.reported_by_department ? "#fca5a5" : "#e2e8f0" }}>
                    <option value="">— Select department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {/* Report Type */}
                <div>
                  <label style={labelStyle}>Report Type <span style={{ color: "#dc2626" }}>*</span></label>
                  <select value={form.report_type}
                    onChange={e => {
                      const t = e.target.value as ReportType;
                      setForm(f => ({ ...f, report_type: t, resolved_at: t === "Incoming" ? "" : f.resolved_at }));
                      setFormError("");
                    }}
                    style={selectStyle}>
                    {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
                    {form.report_type === "Incoming" ? "Unit coming in for repair" : "Unit resolved and going out"}
                  </div>
                </div>

                {/* Reported Date */}
                <div>
                  <label style={labelStyle}>Reported Date <span style={{ color: "#dc2626" }}>*</span></label>
                  <input type="date" value={form.reported_date}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => { setForm(f => ({ ...f, reported_date: e.target.value })); setFormError(""); }}
                    style={{ ...inputStyle, borderColor: formError && !form.reported_date ? "#fca5a5" : "#e2e8f0" }}
                  />
                </div>

                {/* Resolved date - only for Outgoing */}
                {form.report_type === "Outgoing" && (
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={labelStyle}>Resolved Date <span style={{ color: "#dc2626" }}>*</span></label>
                    <input type="date" value={form.resolved_at}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={e => { setForm(f => ({ ...f, resolved_at: e.target.value })); setFormError(""); }}
                      style={{ ...inputStyle, borderColor: formError && !form.resolved_at ? "#fca5a5" : "#e2e8f0" }}
                    />
                  </div>
                )}

                {/* Description */}
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelStyle}>
                    Description <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue or resolution details..."
                    rows={4} maxLength={2000}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textAlign: "right" }}>{form.description.length}/2000</div>
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
                  {submitting ? "Saving…" : modalMode === "add" ? "File Report" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ View Modal ══ */}
        {modalMode === "view" && selected && (
          <div className="modal-overlay-dr" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div className="modal-box-dr" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 540, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 8 }}>{selected.title}</h2>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <CategoryBadge category={selected.category} />
                    <ReportTypeBadge type={selected.report_type} />
                  </div>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", flexShrink: 0 }}><X size={18} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { label: "Equipment",   value: selected.equipment_name },
                  { label: "Reporter",    value: selected.reported_by_name },
                  { label: "Department",  value: getDepartmentName(selected.reported_by_department) },
                  { label: "Report Type", value: selected.report_type },
                  { label: "Reported",    value: new Date(selected.reported_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
                  { label: "Resolved",    value: selected.resolved_at ? new Date(selected.resolved_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—" },
                ].map(row => (
                  <div key={row.label} className="dr-detail-row">
                    <span className="dr-detail-label">{row.label}</span>
                    <span style={{ color: "#0f172a" }}>{row.value}</span>
                  </div>
                ))}

                {selected.description && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Description</div>
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem", lineHeight: 1.7, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>
                      {selected.description}
                    </div>
                  </div>
                )}
              </div>

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
          <div className="modal-overlay-dr" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-box-dr" style={{ background: "#fff", borderRadius: 18, padding: "1.6rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(15,23,42,0.2)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Delete Report?</h2>
              <p style={{ fontSize: 13, color: "#475569", marginBottom: "1.4rem" }}>
                Permanently delete <strong>"{deleteTarget.title}"</strong>? This cannot be undone.
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

export default FileReports;