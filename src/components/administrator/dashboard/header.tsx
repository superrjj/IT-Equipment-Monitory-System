import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { LogOut, Menu, Bell, ChevronDown, User } from "lucide-react";
import { NOTIFICATIONS_CHANGED_EVENT } from "../../../lib/audit-notifications";

const brandBlue = "#0a4c86";

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

  /* ── Notifications panel scrollbar — matches sidebar style ── */
  .hdr-notif-panel::-webkit-scrollbar {
    width: 5px;
  }
  .hdr-notif-panel::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 999px;
  }
  .hdr-notif-panel::-webkit-scrollbar-thumb {
    background: #0a4c8655;
    border-radius: 999px;
  }
  .hdr-notif-panel::-webkit-scrollbar-thumb:hover {
    background: #0a4c86;
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
    background: #f1f5f9; color: #475569;
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
  .hdr-user-trigger:hover {
    background: #f1f5f9;
  }

  .hdr-user-name-text {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
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
    color: #64748b;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hdr-user-chevron {
    color: #64748b;
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  @keyframes hdrAvatarPop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.12); }
    100% { transform: scale(1); }
  }
  .hdr-avatar-updated {
    animation: hdrAvatarPop 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }

  .hdr-mark-all-btn {
    border: none;
    background: none;
    color: ${brandBlue};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    padding: 2px 6px;
    border-radius: 6px;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: opacity 0.15s;
  }
  .hdr-mark-all-btn:hover { opacity: 0.7; }

  /* ── Notification item hover ── */
  .hdr-notif-item {
    width: 100%;
    text-align: left;
    border: none;
    border-radius: 10px;
    padding: 0.75rem;
    margin-bottom: 6px;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .hdr-notif-item:hover { filter: brightness(0.96); }

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

// ── Actor info component ───────────────────────────────────────────────────────
type ActorInfo = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

// ── Types ─────────────────────────────────────────────────────────────────────
type HeaderProps = {
  currentUserName: string;
  userRole: string;
  avatarUrl?: string;
  onMenuClick?: () => void;
  onNotificationNavigate?: (entityType: string, entityId: string | null) => void;
  onOpenProfile?: () => void;
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
  actor_user_id: string | null; // ← NEW
};

const PROFILE_TABLE   = "user_accounts";
const FIELD_FULL_NAME  = "full_name";
const FIELD_ROLE       = "role";
const FIELD_AVATAR_URL = "avatar_url";

type ProfileState = {
  name: string;
  role: string;
  avatarUrl: string;
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ── Main component ────────────────────────────────────────────────────────────
const Header: React.FC<HeaderProps> = ({
  currentUserName,
  userRole,
  avatarUrl = "",
  onMenuClick,
  onNotificationNavigate,
  onOpenProfile,
}) => {
  const navigate = useNavigate();
  const [now, setNow]                 = useState(new Date());
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifLoading, setNotifLoading]     = useState(false);
  const [markingAll, setMarkingAll]         = useState(false);
  const [notifs, setNotifs]                 = useState<NotificationRow[]>([]);
  const [actorMap, setActorMap]             = useState<Record<string, ActorInfo>>({}); // ← NEW
  const [showUserMenu, setShowUserMenu]     = useState(false);
  const notifPanelRef  = useRef<HTMLDivElement | null>(null);
  const notifBtnRef    = useRef<HTMLButtonElement | null>(null);
  const userMenuRef    = useRef<HTMLDivElement | null>(null);
  const userTriggerRef = useRef<HTMLButtonElement | null>(null);
  const prevUnreadRef  = useRef<number>(0);
  const avatarRef      = useRef<HTMLDivElement | null>(null);

  // ── Live profile state ───────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileState>({
    name: currentUserName,
    role: userRole,
    avatarUrl: avatarUrl,
  });

  const profileRef = useRef<ProfileState>(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    setProfile((prev) => ({
      name: currentUserName || prev.name,
      role: userRole || prev.role,
      avatarUrl: avatarUrl || prev.avatarUrl,
    }));
  }, [currentUserName, userRole, avatarUrl]);

  // ── Fetch latest profile from DB on mount ────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) return;
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select(`${FIELD_FULL_NAME}, ${FIELD_ROLE}, ${FIELD_AVATAR_URL}`)
      .eq("id", uid)
      .single();
    if (error || !data) return;
    setProfile({
      name: (data as any)[FIELD_FULL_NAME] ?? currentUserName,
      role: (data as any)[FIELD_ROLE] ?? userRole,
      avatarUrl: (data as any)[FIELD_AVATAR_URL] ?? avatarUrl,
    });
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Avatar updated event ─────────────────────────────────────────────────
  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const freshUrl = (e as CustomEvent<{ url: string }>).detail?.url;
      if (!freshUrl) return;
      setProfile((p) => ({ ...p, avatarUrl: freshUrl }));
      if (avatarRef.current) {
        avatarRef.current.classList.remove("hdr-avatar-updated");
        void avatarRef.current.offsetWidth;
        avatarRef.current.classList.add("hdr-avatar-updated");
      }
    };
    window.addEventListener("avatar-updated", handleAvatarUpdated);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdated);
  }, []);

  // ── Realtime: profile row changes ────────────────────────────────────────
  useEffect(() => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) return;
    const channel = supabase
      .channel("header-profile-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: PROFILE_TABLE, filter: `id=eq.${uid}` },
        (payload) => {
          const row = payload.new as any;
          const current = profileRef.current;
          const nextName = row[FIELD_FULL_NAME] ?? current.name;
          const nextRole = row[FIELD_ROLE]       ?? current.role;
          const rawAvatarUrl = row[FIELD_AVATAR_URL];
          let nextAvatarUrl = current.avatarUrl;
          if (rawAvatarUrl && rawAvatarUrl !== current.avatarUrl.split("?")[0]) {
            nextAvatarUrl = `${rawAvatarUrl}?t=${Date.now()}`;
            if (avatarRef.current) {
              avatarRef.current.classList.remove("hdr-avatar-updated");
              void avatarRef.current.offsetWidth;
              avatarRef.current.classList.add("hdr-avatar-updated");
            }
          }
          setProfile({ name: nextName, role: nextRole, avatarUrl: nextAvatarUrl });
          if (nextName) localStorage.setItem("session_user_full_name", nextName);
          if (nextRole) localStorage.setItem("session_user_role", nextRole);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Derived initials ─────────────────────────────────────────────────────
  const initials = profile.name
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  // ── Notification sound ───────────────────────────────────────────────────
  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as
      | (new () => AudioContext)
      | undefined;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
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

  // ── Unread count ─────────────────────────────────────────────────────────
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
    const uid = localStorage.getItem("session_user_id");
    const channel = supabase
      .channel("notif-badge-header")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${uid}` }, () => { refreshUnread(); })
      .subscribe();
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvt);
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [refreshUnread]);

  // ── Fetch notifications list + actor info ─────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) { setNotifs([]); return; }
    setNotifLoading(true);

    const { data } = await supabase
      .from("app_notifications")
      .select("id, type, title, body, entity_type, entity_id, read_at, created_at, actor_user_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(40);

    const rows = (data ?? []) as NotificationRow[];
    setNotifs(rows);

    // ── Fetch unique actor profiles ──────────────────────────────────────
    const actorIds = [
      ...new Set(rows.map((r) => r.actor_user_id).filter(Boolean)),
    ] as string[];

    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from("user_accounts")
        .select("id, full_name, avatar_url")
        .in("id", actorIds);
      const map: Record<string, ActorInfo> = {};
      for (const a of (actors ?? []) as ActorInfo[]) map[a.id] = a;
      setActorMap(map);
    } else {
      setActorMap({});
    }

    setNotifLoading(false);
  }, []);

  useEffect(() => {
    if (!showNotifPanel) return;
    fetchNotifications();
  }, [showNotifPanel, fetchNotifications]);

  // ── Mark ALL as read ─────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const uid = localStorage.getItem("session_user_id");
    if (!uid) return;
    setMarkingAll(true);
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);
    await fetchNotifications();
    refreshUnread();
    setMarkingAll(false);
  }, [fetchNotifications, refreshUnread]);

  // ── Close panels on outside click ────────────────────────────────────────
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

  useEffect(() => {
    const showBell = !!onNotificationNavigate;
    if (!showBell) { prevUnreadRef.current = unreadNotifications; return; }
    const prev = prevUnreadRef.current;
    if (prev === 0 && unreadNotifications > 0) playNotificationSound();
    prevUnreadRef.current = unreadNotifications;
  }, [onNotificationNavigate, unreadNotifications, playNotificationSound]);

  // ── Mark single as read ──────────────────────────────────────────────────
  const markNotifRead = useCallback(async (id: string) => {
    await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    refreshUnread();
  }, [refreshUnread]);

  const openNotification = useCallback(async (row: NotificationRow) => {
    if (!row.read_at) await markNotifRead(row.id);
    setShowNotifPanel(false);
    onNotificationNavigate?.(row.entity_type ?? "", row.entity_id ?? null);
  }, [markNotifRead, onNotificationNavigate]);

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // ── Logout ───────────────────────────────────────────────────────────────
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

  const hasUnread = notifs.some((n) => !n.read_at);

  // ── Notification item renderer ───────────────────────────────────────────
  const renderNotifItem = (n: NotificationRow) => {
    const isUnread = !n.read_at;
    const actor = n.actor_user_id ? actorMap[String(n.actor_user_id)] : undefined;

    const initials = actor?.full_name
      .split(" ")
      .map((p) => p[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") ?? "?";

    const timeAgo = (() => {
      const diff = Date.now() - new Date(n.created_at).getTime();
      const m = Math.floor(diff / 60000);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) return `${d}d ago`;
      if (h > 0) return `${h}h ago`;
      if (m > 0) return `${m}m ago`;
      return "Just now";
    })();

    // Map notification type to an icon background color + emoji-like SVG badge
    const typeColor: Record<string, string> = {
      ticket_assigned: "#1877f2",
      repair_assigned: "#1877f2",
      ticket_status_changed_admin: "#e67e22",
      repair_status_changed_admin: "#e67e22",
      signup_request: "#42b883",
    };
    const badgeBg = typeColor[n.type] ?? "#1877f2";

    return (
      <button
        key={n.id}
        type="button"
        onClick={() => { void openNotification(n); }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 10px",
          marginBottom: 4,
          borderRadius: 10,
          border: "none",
          background: isUnread ? "#e7f0fd" : "transparent",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s",
          position: "relative",
          fontFamily: "'Poppins', sans-serif",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isUnread ? "#dce8fc" : "#f2f2f2")}
        onMouseLeave={e => (e.currentTarget.style.background = isUnread ? "#e7f0fd" : "transparent")}
      >
        {/* Avatar with badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#d0e4ff",
            border: "1px solid #c8d8f0",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#1877f2",
            fontFamily: "'Poppins', sans-serif",
          }}>
            {actor?.avatar_url ? (
              <img src={actor.avatar_url} alt={actor.full_name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials}
          </div>
          {/* Type badge icon */}
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: 22, height: 22, borderRadius: "50%",
            background: badgeBg,
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              {n.type.includes("signup") ? (
                <path d="M8 2a3 3 0 100 6 3 3 0 000-6zM3 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              ) : n.type.includes("status") ? (
                <path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm0 0l6 5 6-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </div>
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5,
            fontWeight: isUnread ? 700 : 500,
            color: "#050505",
            lineHeight: 1.35,
            marginBottom: 3,
            fontFamily: "'Poppins', sans-serif",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {actor?.full_name && (
              <span style={{ fontWeight: 700 }}>{actor.full_name} </span>
            )}
            <span style={{ fontWeight: isUnread ? 600 : 400 }}>{n.title}</span>
          </div>
          {n.body && (
            <div style={{
              fontSize: 12,
              color: "#65676b",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              fontFamily: "'Poppins', sans-serif",
            }}>
              {n.body}
            </div>
          )}
          <div style={{
            fontSize: 12,
            fontWeight: isUnread ? 700 : 400,
            color: isUnread ? "#1877f2" : "#65676b",
            marginTop: 4,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {timeAgo}
          </div>
        </div>

        {/* Unread blue dot */}
        {isUnread && (
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#1877f2", flexShrink: 0,
          }} />
        )}
      </button>
    );
  };
  return (
    <>
      <style>{headerStyles}</style>

      {/* ── Confirm logout dialog ── */}
      {showConfirm && !loggingOut && (
        <div className="hdr-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="hdr-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <div className="hdr-dialog-icon"><LogOut size={24} strokeWidth={2} /></div>
            <p className="hdr-dialog-title" id="logout-title">Sign out?</p>
            <p className="hdr-dialog-desc">
              You're about to sign out of the IT Helpdesk Ticketing system. Any unsaved changes will be lost.
            </p>
            <div className="hdr-dialog-actions">
              <button className="hdr-btn-cancel" onClick={() => setShowConfirm(false)} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600 }}>Stay</button>
              <button className="hdr-btn-confirm" onClick={confirmLogout} style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: 13 }}>
                <LogOut size={13} strokeWidth={2.2} /> SIGN OUT
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Poppins', sans-serif",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: "1 1 auto" }}>
          {onMenuClick && (
            <button type="button" className="hdr-menu-btn" onClick={onMenuClick} aria-label="Open menu" style={{ width: 40, height: 40 }}>
              <Menu size={20} strokeWidth={2} />
            </button>
          )}
          <div className="hdr-datetime">
            <div style={{ fontSize: 20, fontWeight: 700, color: brandBlue, letterSpacing: "0.02em" }}>{timeStr}</div>
            <div className="hdr-date" style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>{dateStr}</div>
          </div>
        </div>

        {/* ── Right side ── */}
        <div className="hdr-user-block" style={{ display: "flex", alignItems: "center", gap: "0.5rem", position: "relative" }}>

          {/* ── Bell button ── */}
          {onNotificationNavigate && (
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => setShowNotifPanel((v) => !v)}
              title="Notifications"
              style={{
                position: "relative", width: 40, height: 40,
                borderRadius: 12, border: "none", background: "transparent",
                color: brandBlue, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Bell size={20} strokeWidth={2.2} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  minWidth: 14, height: 14, padding: "0 4px",
                  borderRadius: 999, background: "#dc2626", color: "#fff",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
          )}

          {/* ── Notifications panel ── */}
          {onNotificationNavigate && showNotifPanel && (
            <div
              ref={notifPanelRef}
              className="hdr-notif-panel"
              style={{
                position: "absolute", top: 52, right: 0,
                width: 440, maxHeight: 520, overflowY: "scroll",
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 14, boxShadow: "0 18px 36px rgba(15,23,42,0.18)",
                zIndex: 1200, padding: "0.75rem",
                scrollbarWidth: "thin",
                scrollbarColor: "#0a4c8655 #f1f5f9",
              }}
            >
              {/* ── Panel header ── */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: "1px solid #f1f5f9",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Poppins', sans-serif" }}>
                  Notifications
                </div>
                {hasUnread && (
                  <button
                    type="button"
                    className="hdr-mark-all-btn"
                    disabled={markingAll}
                    onClick={() => { void markAllAsRead(); }}
                    style={{ opacity: markingAll ? 0.5 : 1, cursor: markingAll ? "not-allowed" : "pointer" }}
                  >
                    {markingAll ? "Marking…" : "Mark all as read"}
                  </button>
                )}
              </div>

              {notifLoading ? (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "1rem 0.5rem", fontFamily: "'Poppins', sans-serif" }}>
                  Loading...
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "1rem 0.5rem", fontFamily: "'Poppins', sans-serif" }}>
                  No notifications.
                </div>
              ) : (
                <>
                  {/* ── Unread ── */}
                  {notifs.some((n) => !n.read_at) && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#64748b",
                      margin: "0.25rem 0.25rem 0.3rem",
                      fontFamily: "'Poppins', sans-serif",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                    }}>
                      New
                    </div>
                  )}
                  {notifs.filter((n) => !n.read_at).map(renderNotifItem)}

                  {/* ── Read / Earlier ── */}
                  {notifs.some((n) => !!n.read_at) && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#64748b",
                      margin: "0.75rem 0.25rem 0.4rem",
                      fontFamily: "'Poppins', sans-serif",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                    }}>
                      Earlier
                    </div>
                  )}
                  {notifs.filter((n) => !!n.read_at).map(renderNotifItem)}
                </>
              )}
            </div>
          )}

          {/* ── User trigger: avatar + name ── */}
          <button
            ref={userTriggerRef}
            type="button"
            className="hdr-user-trigger"
            aria-label="Open user menu"
            onClick={() => setShowUserMenu((v) => !v)}
          >
            <div
              ref={avatarRef}
              className="hdr-avatar"
              style={{
                width: 40, height: 40, borderRadius: "999px",
                background: "#ffffff", border: "1.5px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: brandBlue, fontSize: 16, fontWeight: 600,
                flexShrink: 0, overflow: "hidden",
              }}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", borderRadius: "999px", objectFit: "cover" }} />
              ) : (
                initials
              )}
            </div>
            <div className="hdr-user-meta">
              <span className="hdr-user-name-text">{profile.name}</span>
              <span className="hdr-user-role-text">{profile.role}</span>
            </div>
            <ChevronDown
              size={15}
              strokeWidth={2.4}
              className="hdr-user-chevron"
              style={{ transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {/* ── User dropdown menu ── */}
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{profile.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{profile.role}</div>
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
                <User size={15} /> My Profile
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