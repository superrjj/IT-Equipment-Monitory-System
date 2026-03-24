import React, { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  X, Camera, KeyRound, Save, UserRound,
  Eye, EyeOff, Check, AlertCircle, Loader2,
} from "lucide-react";
import { getSessionUserId, insertActivityLog } from "../../../lib/audit-notifications";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const BUCKET = "profile-avatar";

type ProfileRow = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  updated_at?: string | null;
  is_active: boolean;
};

type Tab = "account" | "password";

type Props = {
  open: boolean;
  onClose: () => void;
  onAvatarChange?: (url: string) => void;
};

/* ─── helpers ─── */
function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateUsername(u: string): string {
  const v = u.trim();
  if (v.length < 3) return "Username must be at least 3 characters.";
  if (v.length > 32) return "Username must be 32 characters or less.";
  if (!/^[A-Za-z0-9_]+$/.test(v)) return "Username may contain only letters, numbers, and underscores.";
  return "";
}
function validatePassword(pw: string): string {
  if (pw.length < 8) return "At least 8 characters required.";
  if (pw.length > 72) return "Max 72 characters.";
  const checks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw));
  if (checks.length < 2) return "Use at least 2 of: uppercase, lowercase, number, symbol.";
  return "";
}

/* ─── styles ─── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

.pm-overlay {
  position: fixed; inset: 0; z-index: 1400;
  background: rgba(10, 20, 40, 0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
  animation: pmFade .2s ease both;
}
@keyframes pmFade { from { opacity: 0; } to { opacity: 1; } }

.pm-modal {
  background: #fff;
  border-radius: 24px;
  width: 100%; max-width: 620px;
  max-height: calc(100vh - 32px);
  overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(10,20,40,0.28), 0 2px 8px rgba(10,20,40,0.1);
  animation: pmSlide .28s cubic-bezier(.16,1,.3,1) both;
  font-family: 'Poppins', sans-serif;
}
@keyframes pmSlide {
  from { opacity: 0; transform: translateY(24px) scale(.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

.pm-header {
  padding: 1.5rem 1.5rem 0;
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-shrink: 0;
}

.pm-close {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1.5px solid #e8ecf4; background: #f8fafc;
  color: #94a3b8; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s, color .15s, border-color .15s;
  flex-shrink: 0;
}
.pm-close:hover { background: #fee2e2; border-color: #fecaca; color: #dc2626; }

.pm-tabs {
  display: flex; gap: 4px;
  padding: 1rem 1.5rem 0;
  flex-shrink: 0;
}
.pm-tab {
  flex: 1; padding: .55rem .5rem;
  border-radius: 10px; border: 1.5px solid transparent;
  background: transparent; cursor: pointer;
  font-family: 'Poppins', sans-serif;
  font-size: 12.5px; font-weight: 600; color: #94a3b8;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .18s;
}
.pm-tab:hover:not(.pm-tab--active) { background: #f1f5f9; color: #475569; }
.pm-tab--active {
  background: #eef4fc; border-color: #c2d8f0;
  color: #0a4c86;
}

.pm-body {
  padding: 1.1rem 1.5rem 1.35rem;
  overflow-y: auto; flex: 1;
  scrollbar-width: none; /* Firefox: hide scrollbar */
}
.pm-body::-webkit-scrollbar { width: 0; height: 0; } /* Chrome/Safari: hide scrollbar */

.pm-label {
  display: block;
  font-size: 11px; font-weight: 700;
  color: #94a3b8; letter-spacing: .07em; text-transform: uppercase;
  margin-bottom: 5px;
  text-align: left;
}

.pm-input {
  width: 100%; padding: .6rem .85rem;
  border-radius: 10px; border: 1.5px solid #e8ecf4;
  background: #f8fafc; font-family: 'Poppins', sans-serif;
  font-size: 13px; color: #0f172a; outline: none;
  transition: border-color .18s, box-shadow .18s, background .18s;
  box-sizing: border-box;
  min-height: 42px;
}
.pm-input:focus { border-color: #0a4c86; background: #fff; box-shadow: 0 0 0 3px rgba(10,76,134,.08); }
.pm-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
.pm-input--pw { padding-right: 2.6rem; }

.pm-pw-wrap { position: relative; }
.pm-pw-eye {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #94a3b8;
  display: flex; align-items: center; padding: 4px;
  transition: color .15s;
}
.pm-pw-eye:hover { color: #475569; }

.pm-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: .62rem 1.1rem; border-radius: 10px; border: none;
  background: #0a4c86; color: #fff;
  font-family: 'Poppins', sans-serif; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: filter .15s, transform .12s;
  width: 100%; justify-content: center; margin-top: 1.1rem;
}
.pm-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.pm-btn:active:not(:disabled) { transform: translateY(0); }
.pm-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; filter: none; }

.pm-error {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 10px; padding: .6rem .75rem;
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
  font-size: 12px; color: #b91c1c; font-weight: 500; line-height: 1.5;
}

.pm-avatar-wrap {
  display: flex; flex-direction: column; align-items: center;
  gap: .85rem; padding: 1.05rem 0 1.35rem;
}

.pm-avatar-ring {
  width: 150px; height: 150px; border-radius: 999px;
  border: 3px solid #e8ecf4;
  overflow: hidden; display: flex;
  align-items: center; justify-content: center;
  background: #f8fafc; position: relative;
  transition: border-color .18s;
  cursor: pointer;
}
.pm-avatar-ring:hover { border-color: #0a4c86; }
.pm-avatar-overlay {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(10,76,134,.55);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; opacity: 0; transition: opacity .2s;
  color: #fff; font-size: 10px; font-weight: 700;
  font-family: 'Poppins', sans-serif; letter-spacing: .05em;
}
.pm-avatar-ring:hover .pm-avatar-overlay { opacity: 1; }

.pm-uploading-ring {
  border-color: #0a4c86 !important;
  animation: pmPulse 1s ease infinite;
}
@keyframes pmPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(10,76,134,.25); }
  50%       { box-shadow: 0 0 0 6px rgba(10,76,134,0); }
}

.pm-divider {
  height: 1px; background: #f1f5f9; margin: 1.1rem 0;
}

.pm-field-group {
  display: flex; flex-direction: column; gap: 12px;
  width: 100%;
}
.pm-field-group > div { width: 100%; }

.pm-account-lines {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-account-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  align-items: stretch;
}
.pm-account-cell { width: 100%; }

.pm-readonly {
  width: 100%;
  padding: .6rem .85rem;
  border-radius: 10px;
  border: 1.5px solid #e8ecf4;
  background: #f8fafc;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  color: #0f172a;
  outline: none;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 42px;
  display: flex;
  align-items: center;
}

@media (max-width: 520px) {
  .pm-account-row { grid-template-columns: 1fr; }
}

.pm-toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 1600;
  display: flex; align-items: center; gap: 8px;
  padding: .7rem 1.1rem; border-radius: 12px;
  font-size: 13px; font-family: 'Poppins', sans-serif; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
  animation: pmToastIn .25s cubic-bezier(.16,1,.3,1) both;
}
@keyframes pmToastIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

`;

export const ProfileModal: React.FC<Props> = ({ open, onClose, onAvatarChange }) => {
  const userId = getSessionUserId();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>("account");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState({ username: "", full_name: "", email: "" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [pwError, setPwError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── load profile ── */
  const loadProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_accounts")
      .select("id, username, full_name, email, role, avatar_url, updated_at, is_active")
      .eq("id", userId)
      .single();
    if (error || !data) { showToast("Unable to load profile.", "error"); setLoading(false); return; }
    const row = data as ProfileRow;
    setProfile(row);
    setForm({
      username: row.username ?? "",
      full_name: row.full_name ?? "",
      email: row.email ?? "",
    });
    setAvatarUrl(row.avatar_url ? `${row.avatar_url}?t=${encodeURIComponent(row.updated_at ?? "")}` : "");
    localStorage.removeItem("session_user_avatar");
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (open) { loadProfile(); setTab("account"); setProfileError(""); setPwError(""); }
  }, [open, loadProfile]);

  /* ── close on overlay click / Escape ── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ── avatar upload ── */
  const handleAvatarFile = async (file: File) => {
    if (!userId) {
      showToast("No active session. Please sign in again.", "error");
      return;
    }
    const looksLikeImage =
      file.type.startsWith("image/")
      || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
    if (!looksLikeImage) {
      setProfileError("Please upload a valid image file (PNG, JPG, GIF, WEBP).");
      showToast("Invalid image file.", "error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) { setProfileError("Image must be 25 MB or smaller."); return; }
    setProfileError("");

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || "image/*" });
      if (upErr) {
        setProfileError(`Upload failed: ${upErr.message}`);
        showToast("Upload failed.", "error");
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const avatar_url = urlData.publicUrl;
      const updated_at = new Date().toISOString();

      const { error: dbErr } = await supabase
        .from("user_accounts")
        .update({ avatar_url, updated_at })
        .eq("id", userId);
      if (dbErr) {
        setProfileError(`Failed to save avatar: ${dbErr.message}`);
        showToast("Failed to save avatar.", "error");
        return;
      }

      const fresh = `${avatar_url}?t=${encodeURIComponent(updated_at)}`;
      setAvatarUrl(fresh);
      setProfile((p) => (p ? { ...p, avatar_url, updated_at } : p));
      onAvatarChange?.(fresh);
      showToast("Profile picture updated.", "success");
    } finally {
      setUploadingAvatar(false);
    }
  };

  /* ── save profile ── */
  const saveProfile = async () => {
    if (!profile || !userId) return;
    setProfileError("");
    const username = form.username.trim();
    const full_name = form.full_name.trim();
    const email = form.email.trim();

    const uErr = validateUsername(username);
    if (uErr) { setProfileError(uErr); return; }
    if (!full_name) { setProfileError("Full name is required."); return; }
    if (!email) { setProfileError("Email is required."); return; }
    if (!validateEmail(email)) { setProfileError("Invalid email address."); return; }

    setSavingProfile(true);
    const [{ data: dupeEmail }, { data: dupeUser }] = await Promise.all([
      supabase.from("user_accounts").select("id").ilike("email", email).neq("id", userId).limit(1),
      supabase.from("user_accounts").select("id").ilike("username", username).neq("id", userId).limit(1),
    ]);
    if (dupeEmail && dupeEmail.length > 0) {
      setProfileError("Email is already used by another account.");
      setSavingProfile(false);
      return;
    }
    if (dupeUser && dupeUser.length > 0) {
      setProfileError("Username is already used by another account.");
      setSavingProfile(false);
      return;
    }

    const updatePayload: { email: string; username: string; full_name: string; updated_at: string } = {
      email,
      username,
      full_name,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_accounts")
      .update(updatePayload)
      .eq("id", userId);
    if (error) { setProfileError(error.message); setSavingProfile(false); return; }
    // If RLS blocks or id doesn't match, update may affect 0 rows with no error.
    // Re-fetch the row to confirm persistence and to get latest updated_at/avatar_url.
    const { data: refreshed, error: refErr } = await supabase
      .from("user_accounts")
      .select("id, full_name, email, role, username, avatar_url, updated_at")
      .eq("id", userId)
      .single();
    if (refErr || !refreshed) {
      setProfileError("Profile save failed. Please check permissions / RLS.");
      setSavingProfile(false);
      return;
    }

    await insertActivityLog(supabase, {
      actorUserId: userId, action: "user_profile_updated",
      entityType: "user_account", entityId: userId,
      meta: { email, username, full_name },
    });
    localStorage.removeItem("session_user_avatar");
    showToast("Profile saved.", "success");
    setSavingProfile(false);
  };

  /* ── save password ── */
  const savePassword = async () => {
    if (!profile || !userId) return;
    setPwError("");
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwError("Fill in all password fields."); return; }
    const ruleErr = validatePassword(pwForm.next);
    if (ruleErr) { setPwError(ruleErr); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match."); return; }
    if (pwForm.current === pwForm.next) { setPwError("New password must differ from current."); return; }

    setSavingPassword(true);
    const { data: authRow, error: authErr } = await supabase
      .from("user_accounts").select("password_hash").eq("id", userId).single();
    if (authErr || !authRow?.password_hash) {
      setPwError("Unable to verify current password."); setSavingPassword(false); return;
    }
    const ok = await bcrypt.compare(pwForm.current, String(authRow.password_hash));
    if (!ok) { setPwError("Current password is incorrect."); setSavingPassword(false); return; }

    const password_hash = await bcrypt.hash(pwForm.next, 10);
    const { error } = await supabase
      .from("user_accounts")
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) { setPwError(error.message); setSavingPassword(false); return; }

    await insertActivityLog(supabase, {
      actorUserId: userId, action: "user_password_changed",
      entityType: "user_account", entityId: userId, meta: {},
    });
    setPwForm({ current: "", next: "", confirm: "" });
    showToast("Password updated.", "success");
    setSavingPassword(false);
  };

  if (!open) return null;

  const profileDirty = !!profile && (
    form.username.trim() !== (profile.username ?? "") ||
    form.full_name.trim() !== (profile.full_name ?? "") ||
    form.email.trim() !== (profile.email ?? "")
  );

  const pwRuleErr = pwForm.next ? validatePassword(pwForm.next) : "";
  const pwValid =
    !!pwForm.current &&
    !!pwForm.next &&
    !!pwForm.confirm &&
    !pwRuleErr &&
    pwForm.next === pwForm.confirm &&
    pwForm.current !== pwForm.next;

  return (
    <>
      <style>{css}</style>

      {/* Toast */}
      {toast && (
        <div className="pm-toast" style={{
          background: toast.type === "success" ? "#ecfdf5" : "#fef2f2",
          color: toast.type === "success" ? "#15803d" : "#b91c1c",
          border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          {toast.type === "success" ? <Check size={14} strokeWidth={2.5} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Overlay */}
      <div
        ref={overlayRef}
        className="pm-overlay"
        onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div className="pm-modal" role="dialog" aria-modal="true" aria-label="My Profile">

          {/* Header */}
          <div className="pm-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                My Profile
              </h2>
            </div>
            <button className="pm-close" onClick={onClose} aria-label="Close">
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          {/* Tabs */}
          <div className="pm-tabs">
            <button
              className={`pm-tab${tab === "account" ? " pm-tab--active" : ""}`}
              onClick={() => setTab("account")}
            >
              <UserRound size={14} />
              Account Info
            </button>
            <button
              className={`pm-tab${tab === "password" ? " pm-tab--active" : ""}`}
              onClick={() => setTab("password")}
            >
              <KeyRound size={14} />
              Password
            </button>
          </div>

          {/* Body */}
          <div className="pm-body">
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                Loading…
              </div>
            ) : tab === "account" ? (
              <>
                {/* Avatar */}
                <div className="pm-avatar-wrap">
                  <label style={{ cursor: "pointer" }}>
                    <div className={`pm-avatar-ring${uploadingAvatar ? " pm-uploading-ring" : ""}`}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={() => {
                            setAvatarUrl("");
                            showToast("Avatar failed to load. Please try saving again.", "error");
                          }}
                        />
                      ) : (
                        <UserRound size={42} color="#cbd5e1" />
                      )}
                      <div className="pm-avatar-overlay">
                        {uploadingAvatar
                          ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                          : <><Camera size={16} /><span>Change</span></>
                        }
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file" accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleAvatarFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                      {profile?.full_name || "User"}
                    </div>
                    <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8" }}>
                      Click avatar to change · JPG, PNG, GIF, WEBP · max 25 MB
                    </p>
                  </div>
                </div>

                <div className="pm-divider" />

                {/* Fields */}
                <div className="pm-account-lines">
                  {/* Row 1 */}
                  <div className="pm-account-row">
                    <div className="pm-account-cell">
                      <span className="pm-label">Username</span>
                      <input
                        className="pm-input"
                        value={form.username}
                        onChange={(e) => { setForm((p) => ({ ...p, username: e.target.value })); setProfileError(""); }}
                        placeholder="Username"
                      />
                    </div>
                    <div className="pm-account-cell">
                      <span className="pm-label">Role</span>
                      <input className="pm-input" value={profile?.role ?? ""} disabled />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="pm-account-row">
                    <div className="pm-account-cell">
                      <span className="pm-label">Full Name</span>
                      <input
                        className="pm-input"
                        value={form.full_name}
                        onChange={(e) => { setForm((p) => ({ ...p, full_name: e.target.value })); setProfileError(""); }}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="pm-account-cell">
                      <span className="pm-label">Email Address</span>
                      <input
                        className="pm-input"
                        value={form.email}
                        onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setProfileError(""); }}
                        placeholder="name@email.com"
                      />
                    </div>
                  </div>
                </div>

                {profileError && (
                  <div className="pm-error">
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    {profileError}
                  </div>
                )}

                <button
                  className="pm-btn"
                  onClick={() => void saveProfile()}
                  disabled={savingProfile || uploadingAvatar || !profileDirty}
                >
                  {savingProfile
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Save size={14} />
                  }
                  {savingProfile ? "Saving…" : "Save Profile"}
                </button>
              </>
            ) : (
              <>
                <div className="pm-field-group">
                  {(["current", "next", "confirm"] as const).map((field) => {
                    const labels = {
                      current: "Current Password",
                      next: "New Password",
                      confirm: "Confirm New Password",
                    };
                    return (
                      <div key={field}>
                        <span className="pm-label">{labels[field]}</span>
                        <div className="pm-pw-wrap">
                          <input
                            className="pm-input pm-input--pw"
                            type={showPw[field] ? "text" : "password"}
                            value={pwForm[field]}
                            onChange={(e) => { setPwForm((p) => ({ ...p, [field]: e.target.value })); setPwError(""); }}
                            placeholder={field === "current" ? "Enter current password" : field === "next" ? "Min 8 characters" : "Repeat new password"}
                          />
                          <button
                            type="button"
                            className="pm-pw-eye"
                            onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
                            tabIndex={-1}
                          >
                            {showPw[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pwError && (
                  <div className="pm-error">
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    {pwError}
                  </div>
                )}

                <button
                  className="pm-btn"
                  onClick={() => void savePassword()}
                  disabled={savingPassword || !pwValid}
                >
                  {savingPassword
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <KeyRound size={14} />
                  }
                  {savingPassword ? "Updating…" : "Update Password"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* inline spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

export default ProfileModal;