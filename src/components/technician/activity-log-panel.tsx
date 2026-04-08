import React, { useState, useEffect} from "react";
import { getSessionUserId } from "../../lib/audit-notifications";
import { supabase } from "../../lib/supabaseClient";
import { ActivityIcon } from "lucide-react";

const BRAND = "#0D518C";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BUCKET = "profile-avatar";

const getAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${avatarUrl}`;
};

const avatarColor = (fullName: string | null | undefined): string => {
  if (!fullName?.trim()) return BRAND;
  const colors = ["#0a4c86","#1d6fa8","#2e7d32","#6a1b9a","#ad1457","#00838f","#e65100","#4527a0"];
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) hash += fullName.charCodeAt(i);
  return colors[hash % colors.length];
};

const getInitials = (fullName: string | null | undefined): string => {
  if (!fullName?.trim()) return "SY";
  return fullName.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
};

const UserAvatar: React.FC<{ fullName?: string | null; avatarUrl?: string | null }> = ({ fullName, avatarUrl }) => {
  const [imgError, setImgError] = useState(false);
  const url = getAvatarUrl(avatarUrl);
  const showImage = !!url && !imgError;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      overflow: "hidden",
      background: showImage ? "transparent" : avatarColor(fullName),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 600, color: "#fff", userSelect: "none",
      fontFamily: "'Poppins', sans-serif",
    }}>
      {showImage
        ? <img src={url!} alt={fullName ?? ""} onError={() => setImgError(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : getInitials(fullName)}
    </div>
  );
};

// SVG icons mapped to action types
const ACTION_ICONS: Record<string, { bg: string; icon: React.ReactNode }> = {
  ticket: {
    bg: "#1d6fa8",
    icon: (
      // Clipboard / ticket
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6M9 16h6M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>
        <rect x="7" y="2" width="10" height="4" rx="1"/>
      </svg>
    ),
  },
  repair: {
    bg: "#e65100",
    icon: (
      // Wrench
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  incoming: {
    bg: "#2e7d32",
    icon: (
      // Arrow down / receive
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v13M8 11l4 4 4-4"/>
        <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      </svg>
    ),
  },
  outgoing: {
    bg: "#00838f",
    icon: (
      // Arrow up / release
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V9M8 13l4-4 4 4"/>
        <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      </svg>
    ),
  },
  department: {
    bg: "#4527a0",
    icon: (
      // Building
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12"/>
      </svg>
    ),
  },
  user: {
    bg: "#6a1b9a",
    icon: (
      // Person
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
};

const DEFAULT_ICON = {
  bg: "#78909c",
  icon: (
    // Activity pulse
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
};

const ActionIcon: React.FC<{ action: string }> = ({ action }) => {
  const key = Object.keys(ACTION_ICONS).find((k) => action.includes(k));
  const { bg, icon } = key ? ACTION_ICONS[key] : DEFAULT_ICON;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, zIndex: 1, position: "relative",
    }}>
      {icon}
    </div>
  );
};

type Row = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string | null; avatar_url: string | null } | null;
  ticket?: { ticket_number: string | null } | null;
};

type Props = { isAdmin: boolean };

const ActivityLogPanel: React.FC<Props> = ({ isAdmin }) => {
  const userId = getSessionUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

const [period, setPeriod] = useState<string>("this_week");


const PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
];

function getPeriodRange(key: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date();
  switch (key) {
    case "today": start.setHours(0, 0, 0, 0); break;
    case "this_week": {
      const day = start.getDay();
      start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
      start.setHours(0, 0, 0, 0); break;
    }
    case "this_month": start.setDate(1); start.setHours(0, 0, 0, 0); break;
    case "last_7_days": start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0); break;
    case "last_30_days": start.setDate(now.getDate() - 29); start.setHours(0, 0, 0, 0); break;
    default: start.setDate(1); start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

  const prettyAction = (action: string) => {
    const map: Record<string, string> = {
      ticket_created: "Opened a ticket",
      ticket_updated: "Updated a ticket",
      ticket_technician_update: "Updated ticket progress",
      repair_created: "Logged a repair",
      repair_updated: "Updated a repair",
      repair_technician_update: "Updated repair progress",
      incoming_unit_created: "Received an incoming unit",
      incoming_unit_updated: "Updated an incoming unit",
      incoming_unit_deleted: "Removed an incoming unit",
      incoming_unit_archived: "Archived an incoming unit",
      outgoing_unit_created: "Released an outgoing unit",
      outgoing_unit_updated: "Updated an outgoing unit",
      outgoing_unit_deleted: "Removed an outgoing unit",
      outgoing_unit_archived: "Archived an outgoing unit",
      department_created: "Added a department",
      department_updated: "Updated a department",
      department_deleted: "Removed a department",
      department_archived: "Archived a department",
      user_account_created: "Created a user account",
      user_account_updated: "Updated a user account",
      user_account_deleted: "Deleted a user account",
      user_account_archived: "Archived a user account",
      user_account_status_changed: "Changed account status",
      user_account_approved: "Approved a signup request",
      user_account_rejected: "Rejected a signup request",
      user_password_changed: "Reset a user's password",
    };
    return map[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getSubtitle = (row: Row): string => {
    const meta = row.meta;
    const unitName = typeof meta.unit_name === "string" ? meta.unit_name : "";
    const departmentName = typeof meta.department_name === "string" ? meta.department_name : "";
    const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
    const username = typeof meta.username === "string" ? `@${meta.username}` : "";
    const status = typeof meta.status === "string" ? meta.status : "";
    const techStatus = typeof meta.new_status === "string" ? meta.new_status : status;

    if (row.ticket?.ticket_number) return row.ticket.ticket_number;
    if (typeof meta.ticket_number === "string" && meta.ticket_number) return meta.ticket_number;
    if (techStatus && row.action.includes("technician")) return `Status → ${techStatus}`;
    if (unitName) return unitName;
    if (departmentName) return departmentName;
    if (fullName || username) return [fullName, username].filter(Boolean).join(" ");
    if (status) return `Status set to "${status}"`;
    return "";
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { start, end } = getPeriodRange(period);
      let q = supabase
        .from("activity_log")
        .select(`id, action, entity_type, entity_id, meta, created_at,
          actor:user_accounts!activity_log_actor_user_id_fkey(full_name, avatar_url)`)
        .order("created_at", { ascending: false })
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .limit(isAdmin ? 50 : 25);

      if (!isAdmin && userId) {
        q = q.eq("actor_user_id", userId);
      } else if (!isAdmin && !userId) {
        setRows([]); setLoading(false); return;
      }

      const { data, error } = await q;
      if (error) { console.error(error); setRows([]); setLoading(false); return; }

      const rawRows = (data ?? []).map((r: any) => ({
        ...r,
        meta: (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>,
        ticket: null,
      }));

      const ticketIds = rawRows
        .filter((r: any) => ["ticket_created","ticket_updated","ticket_technician_update"].includes(r.action) && r.entity_id)
        .map((r: any) => r.entity_id as string);

      if (ticketIds.length > 0) {
        const { data: tickets } = await supabase.from("file_reports").select("id, ticket_number").in("id", ticketIds);
        const ticketMap: Record<string, string | null> = {};
        (tickets ?? []).forEach((t: any) => { ticketMap[t.id] = t.ticket_number ?? null; });
        setRows(rawRows.map((r: any) => ({
          ...r,
          ticket: ticketMap[r.entity_id] !== undefined ? { ticket_number: ticketMap[r.entity_id] } : null,
        })));
      } else {
        setRows(rawRows);
      }
      setLoading(false);
    };

    run();
    const channel = supabase
      .channel(`activity_log_sync_${isAdmin ? "admin" : userId ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => { void run(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, userId, period]);

  const grouped = rows.reduce<{ label: string; items: Row[] }[]>((acc, row) => {
    const d = new Date(row.created_at);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const datePart = d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    const suffix = d.toDateString() === today.toDateString()
      ? " — Today"
      : d.toDateString() === yesterday.toDateString()
      ? " — Yesterday"
      : "";
    const label = datePart + suffix;
    const existing = acc.find(g => g.label === label);
    if (existing) existing.items.push(row);
    else acc.push({ label, items: [row] });
    return acc;
  }, []);

  const poppins: React.CSSProperties = { fontFamily: "'Poppins', 'Inter', sans-serif" };

  return (
    <div style={{ ...poppins, color: "#0f172a", paddingTop: "1.2rem" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
       <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif", color: BRAND }}>
              <ActivityIcon size={20} color={BRAND} /> Activity Logs
        </h2>
        <p style={{ ...poppins, fontSize: 12, color: "#64748b", margin: 0 }}>
          {isAdmin
            ? "Keep tabs on all system activity — tickets, repairs, units, accounts, and more."
            : "Actions you performed while signed in."}
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            style={{
              padding: "0.3rem 0.85rem",
              borderRadius: 999,
              border: `1.5px solid ${period === opt.key ? BRAND : "#e2e8f0"}`,
              background: period === opt.key ? BRAND : "#fff",
              color: period === opt.key ? "#fff" : "#475569",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Poppins', sans-serif",
              transition: "all 0.15s",
              boxShadow: period === opt.key ? "0 2px 8px rgba(10,76,134,0.18)" : "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ ...poppins, color: "#94a3b8", fontSize: 12 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ ...poppins, color: "#94a3b8", fontSize: 12 }}>No activity recorded yet.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.label} style={{ marginBottom: "2rem" }}>
            <p style={{
              ...poppins,
              fontSize: 11, fontWeight: 600, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.05em",
              margin: "0 0 10px",
            }}>
              {group.label}
            </p>

            {group.items.map((row, idx) => {
              const isLast = idx === group.items.length - 1;
              const time = new Date(row.created_at).toLocaleTimeString("en-PH", {
                timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true,
              });
              const subtitle = getSubtitle(row);

              return (
                <div key={row.id} style={{ display: "flex", gap: 0 }}>

                  {/* Time — label + line only, no avatar */}
                  <div style={{
                    width: 68, flexShrink: 0,
                    display: "flex", flexDirection: "column", alignItems: "flex-end",
                  }}>
                    <span style={{
                      ...poppins,
                      fontSize: 10, color: "#94a3b8",
                      paddingRight: 10, paddingTop: 8,
                      whiteSpace: "nowrap",
                    }}>
                      {time}
                    </span>
                    {!isLast && (
                      <div style={{ flex: 1, width: 1.5, background: "#e2e8f0", marginRight: 10, marginTop: 3 }} />
                    )}
                  </div>

                  {/* Spine — SVG icon circle + connector line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <ActionIcon action={row.action} />
                    {!isLast && (
                      <div style={{ flex: 1, width: 1.5, background: "#e2e8f0", marginTop: 3 }} />
                    )}
                  </div>

                  {/* Card — avatar (photo or initials) + name + action text */}
                  <div style={{ flex: 1, paddingLeft: 10, paddingBottom: isLast ? 0 : 10 }}>
                    <div style={{
                      background: "#fff",
                      border: "1px solid #e8edf2",
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(10,76,134,0.07), 0 1px 2px rgba(0,0,0,0.04)",
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}>
                      <UserAvatar
                        fullName={row.actor?.full_name}
                        avatarUrl={row.actor?.avatar_url}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isAdmin && (
                          <p style={{ ...poppins, margin: "0 0 1px", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                            {row.actor?.full_name?.trim() || "System"}
                          </p>
                        )}
                        <p style={{ ...poppins, margin: 0, fontSize: 12, color: isAdmin ? "#475569" : "#0f172a", fontWeight: isAdmin ? 400 : 500 }}>
                          {prettyAction(row.action)}
                          {subtitle && (
                            <> &mdash; <span style={{ color: BRAND, fontWeight: 500 }}>{subtitle}</span></>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};

export default ActivityLogPanel;