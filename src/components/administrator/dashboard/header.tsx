import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Menu, Bell, Settings, ChevronDown, CheckCheck } from "lucide-react";
import { NOTIFICATIONS_CHANGED_EVENT } from "../../../lib/audit-notifications";
import {
  requestBrowserNotificationPermission,
  shouldShowBrowserPushForRole,
  showBrowserNotification,
} from "../../../lib/browser-notifications";
import { supabase } from "../../../lib/supabaseClient";

const brandBlue = "#0D518C";

const headerStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

  .hdr-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: hdrFadeIn 0.2s ease both;
  }
  @keyframes hdrFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .hdr-dialog {
    background: #ffffff;
    border-radius: 18px;
    padding: 2rem 2.25rem 1.75rem;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28), 0 2px 8px rgba(15,23,42,0.12);
    animation: hdrSlideUp 0.28s cubic-bezier(0.16,1,0.3,1) both;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    font-family: 'Poppins', sans-serif;
  }
  @keyframes hdrSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hdr-dialog-icon {
    width: 54px;
    height: 54px;
    border-radius: 14px;
    background: #fff1f2;
    border: 1.5px solid #fecdd3;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.1rem;
    color: #e11d48;
  }

  .hdr-dialog-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.4rem;
  }

  .hdr-dialog-desc {
    font-size: 0.82rem;
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 1.6rem;
  }

  .hdr-dialog-actions {
    display: flex;
    gap: 0.7rem;
    width: 100%;
  }

  .hdr-btn-cancel {
    flex: 1;
    padding: 0.65rem;
    border-radius: 9px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #475569;
    font-family: 'Poppins', sans-serif;
    font-size: 0.83rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s;
  }
  .hdr-btn-cancel:hover { background: #f1f5f9; border-color: #cbd5e1; }

  .hdr-btn-confirm {
    flex: 1;
    padding: 0.65rem;
    border-radius: 9px;
    border: none;
    background: linear-gradient(120deg, #e11d48, #be123c);
    color: #ffffff;
    font-family: 'Poppins', sans-serif;
    font-size: 0.83rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    box-shadow: 0 6px 18px rgba(225,29,72,0.3);
    transition: filter 0.18s, transform 0.12s;
  }
  .hdr-btn-confirm:hover  { filter: brightness(1.06); transform: translateY(-1px); }
  .hdr-btn-confirm:active { transform: translateY(0); filter: brightness(1); }

  .hdr-loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(10, 76, 134, 0.93);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    animation: hdrFadeIn 0.3s ease both;
    font-family: 'Poppins', sans-serif;
  }

  .hdr-loading-spinner {
    width: 52px;
    height: 52px;
    border: 4px solid rgba(255,255,255,0.25);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: hdrSpin 0.85s linear infinite;
  }
  @keyframes hdrSpin {
    to { transform: rotate(360deg); }
  }

  .hdr-loading-text {
    color: #ffffff;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    opacity: 0.92;
  }

  .hdr-loading-sub {
    color: rgba(255,255,255,0.55);
    font-size: 0.8rem;
    margin-top: -0.65rem;
  }

  .hdr-menu-btn {
    display: none;
    align-items: center; justify-content: center;
    width: 40px; height: 40px;
    border-radius: 10px; border: none;
    background: rgba(255,255,255,0.15); color: #ffffff;
    cursor: pointer; flex-shrink: 0;
  }
  @keyframes hdrMenuDrop {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .hdr-user-trigger {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.65rem 0.35rem 0.35rem;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    transition: background 0.15s ease;
  }
  .hdr-user-trigger:hover { background: rgba(255,255,255,0.15); }

  .hdr-user-name-text {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
  }
  .hdr-user-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    min-width: 0;
  }
  .hdr-user-role-text {
    font-size: 10px;
    font-weight: 700;
    color:rgba(255,255,255,0.7);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  /* Department / office (employees) — readable casing, not role chips */
  .hdr-user-dept-text {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    letter-spacing: 0.02em;
    text-transform: none;
    line-height: 1.25;
    max-width: 200px;
    white-space: normal;
  }
  .hdr-user-chevron {
    color: rgba(255,255,255,0.7);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  /* ── Custom scrollbar for notification panel ── */
  .notif-scroll::-webkit-scrollbar { width: 5px; }
  .notif-scroll::-webkit-scrollbar-track { background: transparent; margin: 6px 0; }
  .notif-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
  .notif-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* ── Notification item hover ── */
  .notif-item { transition: filter 0.15s, background 0.15s !important; }
  .notif-item:hover { filter: brightness(0.97); }

  /* ── Mark all read button ── */
  .mark-all-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #0a4c86;
    font-family: 'Poppins', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .mark-all-btn:hover { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  .mark-all-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  @media (max-width: 1024px) {
    .hdr-menu-btn { display: flex; }
    .hdr-user-meta { display: none; }
    .hdr-datetime { font-size: 14px; }
    .hdr-date { font-size: 12px; }
  }
  @media (max-width: 640px) {
    .hdr-main { flex-wrap: wrap; gap: 0.5rem; }
    .hdr-datetime { font-size: 13px; }
    .hdr-date { font-size: 11px; }
    .hdr-user-block { gap: 0.5rem; }
    .hdr-avatar { width: 36px; height: 36px; font-size: 14px; }
  }
`;

// ── Types ──────────────────────────────────────────────────────────────────────
type HeaderProps = {
  currentUserName: string;
  userRole: string;
  /** When set (e.g. employee office), shown under the name instead of `userRole`. Read-only. */
  subtitleOverride?: string | null;
  avatarUrl?: string;
  onMenuClick?: () => void;
  onNotificationNavigate?: (entityType: string, entityId: string | null) => void;
  onOpenProfile?: () => void;
};

type ActorRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: ActorRow | null;
};

// ── Actor Avatar (FB-style, left side of notification) ────────────────────────
const NotifAvatar: React.FC<{ actor: ActorRow | null }> = ({ actor }) => {
  const initials = actor
    ? actor.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const avatarUrl = actor?.avatar_url
    ? `${actor.avatar_url}?t=${encodeURIComponent(actor.updated_at ?? "")}`
    : "";

  return (
    <div style={{
      width: 42, height: 42, borderRadius: "50%",
      background: actor ? brandBlue : "#e2e8f0",
      overflow: "hidden", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, color: "#fff",
      border: `2px solid #fff`,
      boxShadow: "0 1px 4px rgba(10,76,134,0.15)",
    }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={actor?.full_name ?? ""}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : initials}
    </div>
  );
};

// ── Friendly notification label ───────────────────────────────────────────────
function formatNotifType(type: string): string {
  const map: Record<string, string> = {
    ticket_assigned:              "Ticket Assigned",
    employee_new_ticket:          "New Ticket",
    ticket_status_changed_admin:  "Status Updated",
    ticket_status_requester:      "Your Ticket",
    repair_assigned:              "Repair Assigned",
    admin_repair_assigned:        "Repair Assigned",
    repair_status_changed_admin:  "Repair Status Updated",
    signup_request:               "Account Request",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
}

// ── Single notification item ───────────────────────────────────────────────────
const NotifItem: React.FC<{
  n: NotificationRow;
  onOpen: (n: NotificationRow) => void;
}> = ({ n, onOpen }) => {
  const isUnread = !n.read_at;

  return (
    <button
      type="button"
      className="notif-item"
      onClick={() => onOpen(n)}
      style={{
        width: "100%", textAlign: "left", border: "none",
        background: isUnread ? "#eff6ff" : "#fafafa",
        borderRadius: 12, padding: "10px 12px",
        marginBottom: 5, cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 10,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* Left: actor avatar */}
      <NotifAvatar actor={n.actor} />

      {/* Right: content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Type label */}
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: isUnread ? brandBlue : "#94a3b8",
          textTransform: "uppercase", letterSpacing: "0.07em",
          marginBottom: 2,
        }}>
          {formatNotifType(n.type)}
        </div>

        {/* Actor name + title */}
        <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: "#0f172a", lineHeight: 1.4 }}>
          {n.actor?.full_name && (
            <span style={{ color: brandBlue, fontWeight: 700 }}>
              {n.actor.full_name}{" "}
            </span>
          )}
          <span style={{ color: isUnread ? "#0f172a" : "#475569" }}>
            {n.title}
          </span>
        </div>

        {/* Body */}
        {n.body && (
          <div style={{
            fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.5,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          }}>
            {n.body}
          </div>
        )}

        {/* Timestamp */}
        <div style={{
          fontSize: 11, marginTop: 5, fontWeight: 600,
          color: isUnread ? "#3b82f6" : "#94a3b8",
        }}>
          {relativeTime(n.created_at)}
        </div>
      </div>

      {/* Unread blue dot */}
      {isUnread && (
        <div style={{
          width: 9, height: 9, borderRadius: "50%",
          background: "#3b82f6", flexShrink: 0, marginTop: 5,
        }} />
      )}
    </button>
  );
};

// ── Main Header Component ─────────────────────────────────────────────────────
const Header: React.FC<HeaderProps> = ({
  currentUserName,
  userRole,
  subtitleOverride = null,
  avatarUrl = "",
  onMenuClick,
  onNotificationNavigate,
  onOpenProfile,
}) => {
  const navigate = useNavigate();
  const [now, setNow]                   = useState(new Date());
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loggingOut, setLoggingOut]     = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifPanel, setShowNotifPanel]           = useState(false);
  const [notifLoading, setNotifLoading]               = useState(false);
  const [markingAll, setMarkingAll]                   = useState(false);
  const [notifs, setNotifs]             = useState<NotificationRow[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifPanelRef  = useRef<HTMLDivElement | null>(null);
  const notifBtnRef    = useRef<HTMLButtonElement | null>(null);
  const userMenuRef    = useRef<HTMLDivElement | null>(null);
  const userTriggerRef = useRef<HTMLButtonElement | null>(null);
  const prevUnreadRef  = useRef<number>(0);

  // ── Sound ──────────────────────────────────────────────────────────────────
  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as
      | (new () => AudioContext) | undefined;
    if (!AudioCtx) return;
    try {
      const ctx  = new AudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.2);
      setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 300);
    } catch { /* ignore */ }
  }, []);

  // ── Unread count ───────────────────────────────────────────────────────────
  const refreshUnread = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) { setUnreadNotifications(0); return; }
    const { count, error } = await supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("read_at", null);
    if (error) setUnreadNotifications(0);
    else if (count !== null) setUnreadNotifications(count);
  }, []);

  useEffect(() => {
    refreshUnread();
    const onEvt = () => refreshUnread();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvt);
    const t = setInterval(refreshUnread, 30000);
    const uid = localStorage.getItem("session_user_id")?.trim();
    const channel = uid
      ? supabase
          .channel("notif-badge-header")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "app_notifications",
              filter: `user_id=eq.${uid}`,
            },
            () => {
              refreshUnread();
            }
          )
          .subscribe()
      : null;
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvt);
      clearInterval(t);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshUnread]);

  // ── Browser / OS push for new in-app notification rows ───────────────────────
  useEffect(() => {
    if (!onNotificationNavigate) return;
    const uid = localStorage.getItem("session_user_id")?.trim();
    if (!uid) return;

    const channel = supabase
      .channel(`browser_push_${uid}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row || typeof row !== "object") return;
          const type = typeof row.type === "string" ? row.type : "";
          if (!shouldShowBrowserPushForRole(type, userRole)) return;
          const title = typeof row.title === "string" ? row.title : "Notification";
          const body = typeof row.body === "string" ? row.body : "";
          const tag = typeof row.id === "string" ? row.id : `n-${Date.now()}`;
          showBrowserNotification(title, body, tag);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onNotificationNavigate, userRole]);

  // ── Fetch notifications (with actor join) ──────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id")?.trim();
    if (!uid) {
      setNotifs([]);
      return;
    }
    setNotifLoading(true);
    const withActor = `
      id, type, title, body, entity_type, entity_id, read_at, created_at,
      actor:user_accounts!app_notifications_actor_user_id_fkey (
        id, full_name, avatar_url, updated_at
      )
    `;
    const withActorRes = await supabase
      .from("app_notifications")
      .select(withActor)
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(40);
    const data = withActorRes.error
      ? (
          await supabase
            .from("app_notifications")
            .select(
              "id, type, title, body, entity_type, entity_id, read_at, created_at"
            )
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(40)
        ).data
      : withActorRes.data;
    const normalized: NotificationRow[] = (data ?? []).map((row: any) => ({
      ...row,
      actor: row.actor
        ? Array.isArray(row.actor)
          ? row.actor[0] ?? null
          : row.actor
        : null,
    }));
    setNotifs(normalized);
    setNotifLoading(false);
  }, []);

  useEffect(() => {
    if (!showNotifPanel) return;
    fetchNotifications();
  }, [showNotifPanel, fetchNotifications]);

  // ── Close panels on outside click ─────────────────────────────────────────
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifPanelRef.current?.contains(t)) return;
      if (notifBtnRef.current?.contains(t)) return;
      setShowNotifPanel(false);
    };
    if (showNotifPanel) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showNotifPanel]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userMenuRef.current?.contains(t)) return;
      if (userTriggerRef.current?.contains(t)) return;
      setShowUserMenu(false);
    };
    if (showUserMenu) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showUserMenu]);

  // ── Play sound on new unread ───────────────────────────────────────────────
  useEffect(() => {
    const showBell = !!onNotificationNavigate;
    if (!showBell) { prevUnreadRef.current = unreadNotifications; return; }
    const prev = prevUnreadRef.current;
    if (prev === 0 && unreadNotifications > 0) playNotificationSound();
    prevUnreadRef.current = unreadNotifications;
  }, [onNotificationNavigate, unreadNotifications, playNotificationSound]);

  // ── Mark read / mark all ───────────────────────────────────────────────────
  const markNotifRead = useCallback(async (id: string) => {
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    refreshUnread();
  }, [refreshUnread]);

  const markAllAsRead = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) return;
    setMarkingAll(true);
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);
    setNotifs(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
    setUnreadNotifications(0);
    setMarkingAll(false);
  }, []);

  const openNotification = useCallback(async (row: NotificationRow) => {
    if (!row.read_at) await markNotifRead(row.id);
    setShowNotifPanel(false);
    onNotificationNavigate?.(row.entity_type ?? "", row.entity_id ?? null);
  }, [markNotifRead, onNotificationNavigate]);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const subtitleLine =
    subtitleOverride != null && String(subtitleOverride).trim() !== ""
      ? String(subtitleOverride).trim()
      : userRole;

  const initials = currentUserName
    .split(" ").map(p => p[0]?.toUpperCase()).join("").slice(0, 2);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const confirmLogout = () => {
    setShowConfirm(false);
    setLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem("session_token");
      localStorage.removeItem("session_user_id");
      localStorage.removeItem("session_user_full_name");
      localStorage.removeItem("session_user_role");
      localStorage.removeItem("session_expires_at");
      navigate("/", { replace: true });
    }, 3000);
  };

  const hasUnread  = notifs.some(n => !n.read_at);
  const unreadList = notifs.filter(n => !n.read_at);
  const readList   = notifs.filter(n => !!n.read_at);

  return (
    <>
      <style>{headerStyles}</style>

      {/* ── Confirm logout dialog ── */}
      {showConfirm && !loggingOut && (
        <div className="hdr-overlay" onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="hdr-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <div className="hdr-dialog-icon"><LogOut size={24} strokeWidth={2} /></div>
            <p className="hdr-dialog-title" id="logout-title">Sign out?</p>
            <p className="hdr-dialog-desc">
              You're about to sign out of the IT Equipment Monitoring system. Any unsaved changes will be lost.
            </p>
            <div className="hdr-dialog-actions">
              <button className="hdr-btn-cancel" onClick={() => setShowConfirm(false)}>Stay</button>
              <button className="hdr-btn-confirm" onClick={confirmLogout}>
                <LogOut size={13} strokeWidth={2.2} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logging-out overlay ── */}
      {loggingOut && (
        <div className="hdr-loading-overlay">
          <div className="hdr-loading-spinner" />
          <p className="hdr-loading-text">Signing out…</p>
          <p className="hdr-loading-sub">Please wait a moment</p>
        </div>
      )}

      <header
        className="hdr-main"
        style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Poppins', sans-serif",
          flexWrap: "wrap", gap: "0.75rem",
          padding: "1rem 2rem",          // add padding here instead of wrapper
          minHeight: "60px",             // increase height
          background: "#0D518C",
        }}
      >
        {/* Left: logo + clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1 1 auto" }}>
          {onMenuClick && (
            <button type="button" className="hdr-menu-btn" onClick={onMenuClick} aria-label="Open menu">
              <Menu size={20} strokeWidth={2} />
            </button>
          )}
          
          {/* ── City Logo ── */}
          <img
            src="/masaya-sa-tarlac-city-logo.png"
            alt="Masaya sa Tarlac City"
            style={{ height: 64, width: "auto", objectFit: "contain", flexShrink: 0 }}
          />

          {/* Divider */}
          <div style={{ width: 1, height: 60, background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />

          {/* Clock */}
          <div className="hdr-datetime">
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>{timeStr}</div>
            <div className="hdr-date" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{dateStr}</div>
          </div>
        </div>
        {/* Right: bell + user */}
        <div className="hdr-user-block" style={{ display: "flex", alignItems: "center", gap: "0.5rem", position: "relative" }}>

          {/* ── Bell button ── */}
          {onNotificationNavigate && (
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => {
                void requestBrowserNotificationPermission();
                setShowNotifPanel(v => !v);
              }}
              title="Notifications"
              style={{
                position: "relative", width: 40, height: 40,
                borderRadius: 12, border: "none",
                background: showNotifPanel ? "rgba(255,255,255,0.18)" : "transparent",
                color: "#ffffff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              <Bell size={20} strokeWidth={2.2} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 999, background: "#dc2626", color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
          )}

          {/* ── Notifications panel ── */}
          {onNotificationNavigate && showNotifPanel && (
            <div ref={notifPanelRef} style={{
              position: "absolute", top: 52, right: 0,
              width: 390,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.06)",
              zIndex: 1200,
              overflow: "hidden",
              animation: "hdrMenuDrop 0.18s ease both",
            }}>

              {/* Panel header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px 12px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fff",
                position: "sticky", top: 0, zIndex: 1,
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Notifications
                </span>
                <button
                  className="mark-all-btn"
                  onClick={() => { void markAllAsRead(); }}
                  disabled={!hasUnread || markingAll}
                  title="Mark all as read"
                >
                  <CheckCheck size={13} strokeWidth={2.2} />
                  {markingAll ? "Marking…" : "Mark all as read"}
                </button>
              </div>

              {/* Scrollable list */}
              <div className="notif-scroll" style={{ maxHeight: 480, overflowY: "auto", padding: "10px 10px" }}>

                {notifLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 0", gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: brandBlue, animation: "hdrSpin 0.7s linear infinite" }} />
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>Loading…</span>
                  </div>

                ) : notifs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                      <Bell size={22} color="#cbd5e1" />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>No notifications</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>You're all caught up!</div>
                  </div>

                ) : (
                  <>
                    {/* ── Unread ── */}
                    {unreadList.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 6px 8px" }}>
                          New · {unreadList.length}
                        </div>
                        {unreadList.map(n => (
                          <NotifItem key={n.id} n={n} onOpen={openNotification} />
                        ))}
                      </>
                    )}

                    {/* ── Read ── */}
                    {readList.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 6px 8px" }}>
                          Earlier
                        </div>
                        {readList.map(n => (
                          <NotifItem key={n.id} n={n} onOpen={openNotification} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── User trigger ── */}
          <button
            ref={userTriggerRef}
            type="button"
            className="hdr-user-trigger"
            aria-label="Open user menu"
            onClick={() => setShowUserMenu(v => !v)}
          >
            <div
              className="hdr-avatar"
              style={{
                width: 38, height: 38, borderRadius: "999px",
                background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: brandBlue, fontSize: 15, fontWeight: 700,
                flexShrink: 0, overflow: "hidden",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" }} />
              ) : initials}
            </div>
            <div className="hdr-user-meta">
              <span className="hdr-user-name-text">{currentUserName}</span>
              <span
                className={
                  subtitleOverride != null && String(subtitleOverride).trim() !== ""
                    ? "hdr-user-dept-text"
                    : "hdr-user-role-text"
                }
              >
                {subtitleLine}
              </span>
            </div>
            <ChevronDown
              size={15} strokeWidth={2.4}
              className="hdr-user-chevron"
              style={{ transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {/* ── User dropdown ── */}
          {showUserMenu && (
            <div
              ref={userMenuRef}
              style={{
                position: "absolute", top: 52, right: 0,
                width: 220, background: "#fff",
                border: "1px solid #e2e8f0", borderRadius: 14,
                boxShadow: "0 18px 36px rgba(15,23,42,0.18)",
                zIndex: 1200, padding: "0.5rem",
                animation: "hdrMenuDrop 0.18s ease both",
              }}
            >
              <div style={{ padding: "0.5rem 0.7rem 0.65rem", borderBottom: "1px solid #f1f5f9", marginBottom: "0.35rem" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{currentUserName}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginTop: 2,
                    textTransform: subtitleOverride != null && String(subtitleOverride).trim() !== "" ? "none" : "uppercase",
                    letterSpacing: subtitleOverride != null && String(subtitleOverride).trim() !== "" ? "0.02em" : "0.06em",
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  {subtitleLine}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); if (onOpenProfile) onOpenProfile(); }}
                style={{
                  width: "100%", textAlign: "left", border: "none", background: "#fff",
                  borderRadius: 10, padding: "0.65rem 0.7rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, color: "#0f172a", fontWeight: 600,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <Settings size={15} /> My Profile
              </button>
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); setShowConfirm(true); }}
                style={{
                  width: "100%", textAlign: "left", border: "none", background: "#fff",
                  borderRadius: 10, padding: "0.65rem 0.7rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, color: "#dc2626", fontWeight: 700,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;