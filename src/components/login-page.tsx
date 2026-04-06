import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabaseClient";
import {
  Key,
  ShieldAlert,
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  AtSign,
  X,
  CheckCircle2,
  Clock,  
} from "lucide-react";
import { notifyAdminsSignupRequest } from "../lib/audit-notifications";

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTDOWN_KEY      = "signup_countdown_until";
const PENDING_USER_KEY   = "signup_pending_username";
const COUNTDOWN_SECS     = 120;
const BRAND              = "#0a4c86";

// ── Helpers ───────────────────────────────────────────────────────────────────
const getSecondsLeft = () => {
  const until = Number(localStorage.getItem(COUNTDOWN_KEY) ?? 0);
  return Math.max(0, Math.round((until - Date.now()) / 1000));
};

const fmtTime = (s: number) => {
  const m   = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Poppins:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .lp-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }

  .lp-bg {
    position: fixed; inset: 0;
    background: url('./Tarlac_City_Hall.jpg') center/cover no-repeat;
    z-index: 0;
  }
  .lp-bg-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.38); z-index: 1;
  }

  .lp-card {
    position: relative; z-index: 10;
    width: 100%; max-width: 460px; margin: 3rem;
    background: #ffffff; border-radius: 16px;
    padding: 2.5rem 2.75rem 2.25rem;
    box-shadow: 0 24px 64px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15);
    animation: cardIn 0.65s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .lp-brand { text-align: center; margin-bottom: 1.75rem; }
  .lp-city-logo { width: 220px; height: auto; display: block; margin: 0 auto 1rem; object-fit: contain; }
  .lp-subtitle {
    font-family: 'Poppins', sans-serif;
    font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: #8a95a3; margin-top: 0.3rem; font-weight: 500;
  }

  .lp-form { display: flex; flex-direction: column; gap: 0; }
  .lp-field { display: flex; flex-direction: column; gap: 0.35rem; }

  .lp-label {
    font-family: 'Poppins', sans-serif;
    font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: #4a5568; font-weight: 600; text-align: left;
  }

  .lp-input {
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px;
    color: #0f172a; font-family: 'Poppins', sans-serif;
    font-size: 13px; font-weight: 400;
    padding: 0.6rem 0.75rem 0.6rem 2.25rem;
    outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; width: 100%;
  }
  .lp-input::placeholder {
    color: #b0b8c4;
    font-family: 'Poppins', sans-serif;
    font-size: 13px;
  }
  .lp-input:hover  { border-color: #b8c2ce; background: #f2f4f7; }
  .lp-input:focus  { border-color: #0a4c86 !important; background: #fff; box-shadow: 0 0 0 3px rgba(10,76,134,0.10) !important; outline: none; }
  .lp-input--error { border-color: #fca5a5 !important; background: #fff8f8 !important; }

  .lp-pw-row {
    display: flex; justify-content: space-between; align-items: center;
  }
  .lp-forgot {
    font-family: 'Poppins', sans-serif;
    font-size: 0.7rem; color: #0a4c86; background: none; border: none;
    cursor: pointer; font-weight: 500; padding: 0; transition: color 0.2s;
  }
  .lp-forgot:hover { color: #1a2e4a; }

  .lp-toggle {
    position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #94a3b8;
    display: flex; align-items: center; padding: 0; transition: color 0.2s;
  }
  .lp-toggle:hover { color: #1a2e4a; }

  .lp-btn {
    margin-top: 0.25rem; padding: 0.78rem;
    border: none; border-radius: 8px;
    background: linear-gradient(120deg, #0b5fa5, #0a4c86); color: #fff;
    font-family: 'Poppins', sans-serif; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer;
    transition: filter 0.18s, transform 0.12s, box-shadow 0.18s;
    box-shadow: 0 12px 28px rgba(15,23,42,0.3);
  }
  .lp-btn:hover  { filter: brightness(1.05); transform: translateY(-1px); }
  .lp-btn:active { transform: translateY(0); filter: brightness(1); }
  .lp-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; filter: none; }

  /* Loading overlay */
  .lp-loading-overlay {
    position: fixed; inset: 0; z-index: 999;
    background: rgba(10,76,134,0.92);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 1.25rem;
    animation: fadeInOverlay 0.3s ease both;
  }
  @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
  .lp-loading-spinner {
    width: 46px; height: 46px;
    border: 3px solid rgba(255,255,255,0.25);
    border-top-color: #ffffff; border-radius: 50%;
    animation: spin 0.85s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .lp-loading-text {
    color: #ffffff; font-family: 'Poppins', sans-serif;
    font-size: 0.9rem; font-weight: 500; letter-spacing: 0.08em; opacity: 0.9;
  }
  .lp-loading-sub {
    color: rgba(255,255,255,0.55); font-family: 'Poppins', sans-serif;
    font-size: 0.74rem; margin-top: -0.65rem;
  }

  /* ── UA-style Modal ── */
  .ua-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 16px;
    animation: fadeIn 0.15s ease;
  }
  .ua-modal-box {
    width: min(580px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto; overflow-x: hidden;
    background: #fff; border-radius: 20px;
    box-shadow: 0 32px 80px rgba(10,20,60,0.22), 0 0 0 1px rgba(10,76,134,0.07);
    animation: slideUp 0.2s ease;
    font-family: 'Poppins', sans-serif;
  }
  .ua-modal-header {
    padding: 1.3rem 1.4rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(135deg, #f8faff 0%, #eef4ff 100%);
    border-radius: 20px 20px 0 0;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .ua-modal-body {
    padding: 1.2rem 1.4rem;
    display: flex; flex-direction: column; gap: 14px;
  }
  .ua-modal-footer {
    padding: 1rem 1.4rem;
    border-top: 1px solid #f1f5f9;
    background: #fafbfc;
    border-radius: 0 0 20px 20px;
    display: flex; justify-content: flex-end; gap: 10px;
  }
  .ua-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ua-span2 { grid-column: span 2; }

  .ua-field-label {
    font-size: 11px; font-weight: 700; color: #64748b;
    letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 5px; display: block;
  }
  .ua-input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.25rem;
    border-radius: 10px; border: 1.5px solid #e2e8f0;
    background: #f8fafc; font-size: 13px; color: #0f172a;
    outline: none; box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .ua-input:focus {
    border-color: #0a4c86 !important;
    box-shadow: 0 0 0 3px rgba(10,76,134,0.10) !important;
    outline: none;
  }
  .ua-input--error { border-color: #fca5a5 !important; background: #fff8f8 !important; }

  .ua-btn-close:hover  { background: #f1f5f9 !important; }
  .ua-btn-cancel:hover { background: #f8fafc !important; }
  .ua-btn-save:hover   { opacity: 0.92; }

  /* Forgot modal */
  .lp-modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem;
    animation: modalOverlayIn 0.2s ease both;
  }
  @keyframes modalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
  .lp-modal {
    background: #ffffff; border-radius: 14px;
    width: 100%; max-width: 420px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08);
    position: relative;
    animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1) both;
    font-family: 'Poppins', sans-serif;
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .lp-modal-header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 1.1rem 1.3rem 1rem;
    border-bottom: 1px solid #f0f2f5;
  }
  .lp-modal-header-icon {
    width: 36px; height: 36px; border-radius: 9px;
    background: #eef3fa;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #0a4c86;
  }
  .lp-modal-header-text { display: flex; flex-direction: column; gap: 1px; }
  .lp-modal-title   { font-size: 0.88rem; font-weight: 700; color: #1a2e4a; line-height: 1.2; }
  .lp-modal-subtitle { font-size: 0.7rem; color: #94a3b8; font-weight: 400; }
  .lp-modal-close {
    position: absolute; top: 0.9rem; right: 0.9rem;
    background: #f2f4f7; border: none; border-radius: 50%;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7685;
    transition: background 0.2s, color 0.2s;
  }
  .lp-modal-close:hover { background: #e2e6ed; color: #1a2e4a; }
  .lp-modal-body   { padding: 1.15rem 1.3rem; }
  .lp-modal-footer {
    display: flex; align-items: center; justify-content: flex-end;
    gap: 0.55rem; padding: 0.85rem 1.3rem 1.1rem;
    border-top: 1px solid #f0f2f5;
  }
  .lp-modal-btn-submit {
    padding: 0.48rem 1.2rem; border-radius: 7px; border: none;
    background: #0a4c86; color: #fff;
    font-family: 'Poppins', sans-serif; font-size: 0.76rem; font-weight: 600;
    cursor: pointer; transition: background 0.15s, transform 0.12s;
    box-shadow: 0 3px 10px rgba(10,76,134,0.25);
  }
  .lp-modal-btn-submit:hover    { background: #083d6e; transform: translateY(-1px); }
  .lp-modal-btn-submit:active   { transform: translateY(0); }
  .lp-modal-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .lp-admin-notice {
    display: flex; gap: 0.7rem; align-items: flex-start;
    background: #f0f6ff; border: 1px solid #bfdbfe;
    border-radius: 9px; padding: 0.9rem 1rem;
  }
  .lp-admin-notice-icon  { flex-shrink: 0; margin-top: 1px; color: #0a4c86; }
  .lp-admin-notice-text  { display: flex; flex-direction: column; gap: 0.2rem; }
  .lp-admin-notice-title { font-size: 0.78rem; font-weight: 700; color: #1a2e4a; }
  .lp-admin-notice-desc  { font-size: 0.72rem; color: #4a5568; line-height: 1.55; }

  .lp-keep-row {
    display: flex; align-items: center; margin-bottom: 1rem;
  }
  .lp-keep-checkbox {
    display: flex; align-items: center; gap: 0.4rem;
    font-family: 'Poppins', sans-serif; font-size: 0.72rem; color: #4a5568;
    cursor: pointer;
  }
  .lp-keep-checkbox input { width: 13px; height: 13px; cursor: pointer; }
  .lp-create-link {
    font-family: 'Poppins', sans-serif;
    font-size: 0.72rem; color: #0b5fa5; background: none; border: none;
    cursor: pointer; font-weight: 600; text-decoration: underline;
    text-underline-offset: 3px;
  }
  .lp-create-link:hover { color: #083766; }
  .lp-bottom-row {
    margin-top: 1rem; display: flex; justify-content: center;
    gap: 0.3rem; font-family: 'Poppins', sans-serif;
    font-size: 0.72rem; color: #6b7280;
  }

  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }

  @media (max-width: 680px) {
    .ua-grid  { grid-template-columns: 1fr; }
    .ua-span2 { grid-column: span 1; }
  }
  @media (max-width: 600px) {
    .lp-card      { margin: 1rem; padding: 2rem 1.5rem 1.75rem; }
    .lp-city-logo { width: 180px; }
    .ua-modal-box { border-radius: 16px; }
  }
`;

// ── Field error components ────────────────────────────────────────────────────
const UAFieldError = ({ msg }: { msg?: string }) => (
  <div style={{
    minHeight: 18, marginTop: 1, fontSize: 11, fontWeight: 500,
    color: "#dc2626", display: "flex", alignItems: "center", gap: 4,
    visibility: msg ? "visible" : "hidden",
  }}>
    <AlertTriangle size={10} />
    {msg ?? "placeholder"}
  </div>
);

function UAInputField({
  label, icon, required, error, children,
}: {
  label: string; icon?: React.ReactNode; required?: boolean;
  error?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label className="ua-field-label">
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {icon && (
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "#94a3b8", pointerEvents: "none", display: "flex", zIndex: 1,
          }}>
            {icon}
          </span>
        )}
        {children}
      </div>
      <UAFieldError msg={error} />
    </div>
  );
}

const FieldError = ({ msg }: { msg?: string }) => (
  <div style={{
    minHeight: 18, marginTop: 1, fontSize: 11, fontWeight: 500,
    color: "#dc2626", display: "flex", alignItems: "center", gap: 4,
    visibility: msg ? "visible" : "hidden",
  }}>
    <AlertTriangle size={10} />
    {msg ?? "placeholder"}
  </div>
);

// ── Countdown ring ────────────────────────────────────────────────────────────
const CountdownRing: React.FC<{ seconds: number }> = ({ seconds }) => {
  const r         = 34;
  const circ      = 2 * Math.PI * r;
  const pct       = seconds / COUNTDOWN_SECS;
  const dashOffset = circ * (1 - pct);
  const ringColor  = seconds > 30 ? "#0a4c86" : seconds > 10 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 12px" }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={ringColor} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${dashOffset}`}
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 800, color: ringColor,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {fmtTime(seconds)}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [identifier,    setIdentifier]    = useState("");
  const [password,      setPassword]      = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [showForgot,    setShowForgot]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [showCreate,    setShowCreate]    = useState(false);
  const [creating,      setCreating]      = useState(false);
  const [createSent,    setCreateSent]    = useState(false);
  const [keepSignedIn,  setKeepSignedIn]  = useState(true);
  const [secondsLeft,   setSecondsLeft]   = useState(getSecondsLeft);
  const [approved,      setApproved]      = useState(false);

  const navigate = useNavigate();

  const [loginErrors, setLoginErrors] = useState<{
    identifier?: string; password?: string; general?: string;
  }>({});

  const [createErrors, setCreateErrors] = useState<{
    full_name?: string; username?: string; email?: string;
    password?: string; confirmPassword?: string;
  }>({});

  const [create, setCreate] = useState({
    full_name: "", username: "", email: "", password: "", confirmPassword: "",
  });

  // ── Restore pending state on mount (survives page refresh) ────────────────
  useEffect(() => {
    if (getSecondsLeft() > 0) {
      setCreateSent(true);
      setShowCreate(true);
    }
  }, []);

  // ── Countdown tick + approval polling ────────────────────────────────────
  useEffect(() => {
    if (!createSent || approved) return;

    const tick = setInterval(async () => {
      setSecondsLeft(getSecondsLeft());

      const pending = localStorage.getItem(PENDING_USER_KEY);
      if (!pending) return;

      const { data } = await supabase
        .from("signup_requests")
        .select("status")
        .ilike("username", pending)
        .single();

      if (data?.status === "approved") {
        setApproved(true);
        localStorage.removeItem(COUNTDOWN_KEY);
        localStorage.removeItem(PENDING_USER_KEY);
        clearInterval(tick);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [createSent, approved]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const performLogin = async () => {
    const errors: typeof loginErrors = {};
    const ident = identifier.trim();
    if (!ident)    errors.identifier = "Email or username is required.";
    if (!password) errors.password   = "Password is required.";
    if (Object.keys(errors).length > 0) { setLoginErrors(errors); return; }

    setLoginErrors({});
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("user_accounts")
        .select("id, username, full_name, email, role, is_active, password_hash")
        .or(`username.ilike.${ident},email.ilike.${ident}`)
        .limit(1);
      if (qErr) throw new Error(qErr.message);

      const user = (data ?? [])[0] as any | undefined;
      if (!user) {
        setLoginErrors({ identifier: "No account found with that username or email." });
        setLoading(false);
        return;
      }
      if (!user.is_active) {
        setLoginErrors({ general: "Account is inactive. Please contact the admin." });
        setLoading(false);
        return;
      }
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        setLoginErrors({ password: "Incorrect password." });
        setLoading(false);
        return;
      }
      const ttlMs     = keepSignedIn ? 7 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      localStorage.setItem("session_token",           crypto.randomUUID());
      localStorage.setItem("session_user_id",         user.id);
      localStorage.setItem("session_user_full_name",  user.full_name);
      localStorage.setItem("session_user_role",       user.role);
      localStorage.setItem("session_expires_at",      expiresAt);
      setTimeout(() => { navigate("/dashboard", { replace: true }); }, 3000);
    } catch (ex: any) {
      setLoginErrors({ general: "Something went wrong. Please try again." });
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => { e.preventDefault(); await performLogin(); };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const closeForgot = () => setShowForgot(false);

  const closeCreate = () => {
    setShowCreate(false);
    setTimeout(() => {
      setCreating(false);
      if (approved) {
        setCreateSent(false);
        setApproved(false);
        localStorage.removeItem(COUNTDOWN_KEY);
        localStorage.removeItem(PENDING_USER_KEY);
      }
      setCreateErrors({});
      setCreate({ full_name: "", username: "", email: "", password: "", confirmPassword: "" });
    }, 300);
  };

  // ── Create account ────────────────────────────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof createErrors = {};

    if (!create.full_name.trim()) errors.full_name = "Full name is required.";

    const u = create.username.trim();
    if (!u)                                errors.username = "Username is required.";
    else if (u.length < 3)                 errors.username = "Must be at least 3 characters.";
    else if (u.length > 32)                errors.username = "Must be 32 characters or less.";
    else if (!/^[A-Za-z0-9_]+$/.test(u))  errors.username = "Letters, numbers, and underscore only.";

    const email = create.email.trim();
    if (!email)                                          errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

    if (!create.password)                errors.password = "Password is required.";
    else if (create.password.length < 8) errors.password = "Must be at least 8 characters.";
    else if (create.password.length > 72) errors.password = "Password is too long (max 72 chars).";

    if (!create.confirmPassword)
      errors.confirmPassword = "Please confirm your password.";
    else if (create.password !== create.confirmPassword)
      errors.confirmPassword = "Passwords do not match.";

    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return; }

    setCreating(true);
    setCreateErrors({});

    const { data: uData } = await supabase
      .from("user_accounts").select("id").ilike("username", u).limit(1);
    if (uData && uData.length > 0) {
      setCreateErrors({ username: "That username is already taken." });
      setCreating(false);
      return;
    }

    const { data: eData } = await supabase
      .from("user_accounts").select("id").ilike("email", email).limit(1);
    if (eData && eData.length > 0) {
      setCreateErrors({ email: "An account with this email already exists." });
      setCreating(false);
      return;
    }

    const { data: reqU } = await supabase
      .from("signup_requests").select("id").ilike("username", u).eq("status", "pending").limit(1);
    if (reqU && reqU.length > 0) {
      setCreateErrors({ username: "A pending request already exists for this username." });
      setCreating(false);
      return;
    }

    const { data: reqE } = await supabase
      .from("signup_requests").select("id").ilike("email", email).eq("status", "pending").limit(1);
    if (reqE && reqE.length > 0) {
      setCreateErrors({ email: "A pending request already exists for this email." });
      setCreating(false);
      return;
    }

    try {
      const password_hash = await bcrypt.hash(create.password, 10);
      const { error: insertError } = await supabase.from("signup_requests").insert({
        full_name: create.full_name.trim(),
        username: u,
        email,
        password_hash,
      });
      if (insertError) throw new Error(insertError.message);

      // Fetch the new request id to link the notification
      const { data: newReq } = await supabase
        .from("signup_requests")
        .select("id")
        .ilike("username", u)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (newReq?.id) {
        await notifyAdminsSignupRequest(supabase, {
          requestId: newReq.id,
          fullName:  create.full_name.trim(),
          username:  u,
          actorUserId: null,
        });
      }

      // Persist countdown across page refreshes
      localStorage.setItem(COUNTDOWN_KEY,    String(Date.now() + COUNTDOWN_SECS * 1000));
      localStorage.setItem(PENDING_USER_KEY, u);
      setSecondsLeft(COUNTDOWN_SECS);
      setCreateSent(true);

    } catch (ex: any) {
      const msg = (ex?.message ?? "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        setCreateErrors({ username: "That username or email is already in use." });
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setCreateErrors({ full_name: "Network error. Please check your connection and try again." });
      } else {
        setCreateErrors({ full_name: "Something went wrong. Please try again in a moment." });
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>

      {loading && (
        <div className="lp-loading-overlay">
          <div className="lp-loading-spinner" />
          <p className="lp-loading-text">Signing in…</p>
          <p className="lp-loading-sub">Please wait a moment</p>
        </div>
      )}

      <div className="lp-root">
        <div className="lp-bg" />
        <div className="lp-bg-overlay" />

        {/* ── Login Card ── */}
        <div className="lp-card">
          <div className="lp-brand">
            <img src="./tarlac-city-logo-masaya.png" alt="Masaya sa Tarlac City" className="lp-city-logo" />
            <p className="lp-subtitle">IT Helpdesk Ticketing System</p>
          </div>

          <form className="lp-form" onSubmit={handleLogin}>
            {/* Identifier */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="identifier">Email or Username</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#b0b8c4", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                  <Mail size={13} strokeWidth={2} />
                </span>
                <input
                  id="identifier"
                  className={`lp-input${loginErrors.identifier ? " lp-input--error" : ""}`}
                  type="text"
                  placeholder="you@example.com"
                  autoComplete="username"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setLoginErrors(prev => ({ ...prev, identifier: undefined })); }}
                  disabled={loading}
                />
              </div>
              <FieldError msg={loginErrors.identifier} />
            </div>

            {/* Password */}
            <div className="lp-field">
              <div className="lp-pw-row">
                <label className="lp-label" htmlFor="password">Password</label>
                <button type="button" className="lp-forgot" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#b0b8c4", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                  <Lock size={13} strokeWidth={2} />
                </span>
                <input
                  id="password"
                  className={`lp-input${loginErrors.password ? " lp-input--error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginErrors(prev => ({ ...prev, password: undefined })); }}
                  style={{ paddingRight: "2.5rem" }}
                  disabled={loading}
                />
                <button type="button" className="lp-toggle" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                </button>
              </div>
              <FieldError msg={loginErrors.password} />
            </div>

            {/* General error */}
            {loginErrors.general && (
              <div style={{
                padding: "0.5rem 0.75rem", borderRadius: 7, marginTop: 4,
                backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                color: "#b91c1c", fontFamily: "'Poppins', sans-serif", fontSize: "0.71rem",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <AlertTriangle size={11} /> {loginErrors.general}
              </div>
            )}

            <div className="lp-keep-row">
              <label className="lp-keep-checkbox">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={e => setKeepSignedIn(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button className="lp-btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="lp-bottom-row">
            <span>Don&apos;t have an account?</span>
            <button type="button" className="lp-create-link" onClick={() => setShowCreate(true)}>
              Create one
            </button>
          </div>
        </div>

        {/* ══ Forgot Password Modal ══ */}
        {showForgot && (
          <div className="lp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}>
            <div className="lp-modal" role="dialog" aria-modal="true">
              <button className="lp-modal-close" onClick={closeForgot} aria-label="Close">
                <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>✕</span>
              </button>
              <div className="lp-modal-header">
                <div className="lp-modal-header-icon"><Key size={16} strokeWidth={2} /></div>
                <div className="lp-modal-header-text">
                  <span className="lp-modal-title">Forgot Password</span>
                  <span className="lp-modal-subtitle">Account recovery assistance</span>
                </div>
              </div>
              <div className="lp-modal-body">
                <div className="lp-admin-notice">
                  <span className="lp-admin-notice-icon"><ShieldAlert size={16} strokeWidth={2} /></span>
                  <div className="lp-admin-notice-text">
                    <span className="lp-admin-notice-title">Contact your Administrator</span>
                    <span className="lp-admin-notice-desc">
                      Password resets are managed by your system administrator.
                      Please approach or message your IT Administrator directly
                      to have your password reset.
                    </span>
                  </div>
                </div>
              </div>
              <div className="lp-modal-footer">
                <button className="lp-modal-btn-submit" type="button" onClick={closeForgot}>Got it</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ Create Account Modal ══ */}
        {showCreate && (
          <div className="ua-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeCreate(); }}>
            <div className="ua-modal-box" role="dialog" aria-modal="true">

              {/* Header */}
              <div className="ua-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: BRAND,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <UserPlus size={17} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>Request an Account</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Requires admin approval</div>
                  </div>
                </div>
                <button
                  className="ua-btn-close"
                  onClick={closeCreate}
                  aria-label="Close"
                  style={{
                    border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10,
                    width: 32, height: 32, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#94a3b8", flexShrink: 0, transition: "background 0.15s",
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* ── State: form ── */}
              {!createSent && (
                <>
                  <div className="ua-modal-body">
                    <div className="ua-grid">
                      <div className="ua-span2">
                        <UAInputField label="Full Name" icon={<User size={13} />} required error={createErrors.full_name}>
                          <input
                            className={`ua-input${createErrors.full_name ? " ua-input--error" : ""}`}
                            type="text" placeholder="e.g. Juan Dela Cruz"
                            value={create.full_name}
                            onChange={e => { setCreate(c => ({ ...c, full_name: e.target.value })); setCreateErrors(p => ({ ...p, full_name: undefined })); }}
                          />
                        </UAInputField>
                      </div>

                      <UAInputField label="Username" icon={<AtSign size={13} />} required error={createErrors.username}>
                        <input
                          className={`ua-input${createErrors.username ? " ua-input--error" : ""}`}
                          type="text" placeholder="e.g. juan_dc"
                          value={create.username}
                          onChange={e => { setCreate(c => ({ ...c, username: e.target.value })); setCreateErrors(p => ({ ...p, username: undefined })); }}
                        />
                      </UAInputField>

                      <UAInputField label="Email Address" icon={<Mail size={13} />} required error={createErrors.email}>
                        <input
                          className={`ua-input${createErrors.email ? " ua-input--error" : ""}`}
                          type="email" placeholder="you@example.com"
                          value={create.email}
                          onChange={e => { setCreate(c => ({ ...c, email: e.target.value })); setCreateErrors(p => ({ ...p, email: undefined })); }}
                        />
                      </UAInputField>

                      <UAInputField label="Password" icon={<Lock size={13} />} required error={createErrors.password}>
                        <input
                          className={`ua-input${createErrors.password ? " ua-input--error" : ""}`}
                          type="password" placeholder="Min. 8 characters"
                          value={create.password}
                          onChange={e => { setCreate(c => ({ ...c, password: e.target.value })); setCreateErrors(p => ({ ...p, password: undefined })); }}
                        />
                      </UAInputField>

                      <UAInputField label="Confirm Password" icon={<Lock size={13} />} required error={createErrors.confirmPassword}>
                        <input
                          className={`ua-input${createErrors.confirmPassword ? " ua-input--error" : ""}`}
                          type="password" placeholder="Repeat password"
                          value={create.confirmPassword}
                          onChange={e => { setCreate(c => ({ ...c, confirmPassword: e.target.value })); setCreateErrors(p => ({ ...p, confirmPassword: undefined })); }}
                        />
                      </UAInputField>
                    </div>
                  </div>
                  <div className="ua-modal-footer">
                    <button
                      className="ua-btn-cancel" type="button" onClick={closeCreate}
                      style={{
                        border: "1.5px solid #e2e8f0", background: "#fff", borderRadius: 10,
                        padding: "0.55rem 1rem", cursor: "pointer", fontWeight: 700,
                        fontSize: 13, color: "#475569", fontFamily: "'Poppins', sans-serif",
                        transition: "background 0.15s",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="ua-btn-save" type="button" disabled={creating}
                      onClick={handleCreateAccount as any}
                      style={{
                        border: "none", background: creating ? "#94a3b8" : BRAND,
                        color: "#fff", borderRadius: 10, padding: "0.55rem 1.2rem",
                        cursor: creating ? "not-allowed" : "pointer",
                        fontWeight: 800, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                        boxShadow: creating ? "none" : "0 4px 14px rgba(10,76,134,0.28)",
                        transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {creating ? "Checking…" : "Submit Request"}
                    </button>
                  </div>
                </>
              )}

              {/* ── State: approved ── */}
              {createSent && approved && (
                <>
                  <div className="ua-modal-body">
                    <div style={{
                      textAlign: "center", padding: "1.5rem 1rem",
                      background: "#f0fdf4", border: "1px solid #86efac",
                      borderRadius: 12, fontFamily: "'Poppins', sans-serif",
                    }}>
                      <CheckCircle2 size={40} color="#16a34a" style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
                        Account approved!
                      </div>
                      <div style={{ fontSize: 12, color: "#4ade80" }}>
                        You can now sign in with your credentials.
                      </div>
                    </div>
                  </div>
                  <div className="ua-modal-footer">
                    <button
                      type="button" onClick={closeCreate}
                      style={{
                        border: "none", background: BRAND, color: "#fff",
                        borderRadius: 10, padding: "0.55rem 1.2rem", cursor: "pointer",
                        fontWeight: 800, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                        boxShadow: "0 4px 14px rgba(10,76,134,0.28)",
                      }}
                    >
                      Sign in now
                    </button>
                  </div>
                </>
              )}

              {/* ── State: waiting (countdown) ── */}
              {createSent && !approved && (
                <>
                  <div className="ua-modal-body">
                    <div style={{
                      textAlign: "center", padding: "1.5rem 1rem",
                      background: "#f8faff", border: "1px solid #bfdbfe",
                      borderRadius: 12, fontFamily: "'Poppins', sans-serif",
                    }}>
                      <Clock size={36} color="#3b82f6" style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>
                        Request submitted!
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                        Waiting for admin approval…
                      </div>

                      <CountdownRing seconds={secondsLeft} />

                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                        {secondsLeft > 0
                          ? "Estimated wait time"
                          : "Still waiting… the admin will approve shortly."}
                      </div>
                      <div style={{
                        marginTop: 14, padding: "0.6rem 0.8rem",
                        background: "#eff6ff", borderRadius: 8,
                        fontSize: 11, color: "#3b82f6", lineHeight: 1.6,
                      }}>
                        You can close this window — your request is saved.<br />
                        This page will update automatically when approved.
                      </div>
                    </div>
                  </div>
                  <div className="ua-modal-footer" style={{ justifyContent: "center" }}>
                    <button
                      type="button" onClick={closeCreate}
                      style={{
                        border: "1.5px solid #e2e8f0", background: "#fff", borderRadius: 10,
                        padding: "0.55rem 1.1rem", cursor: "pointer", fontWeight: 600,
                        fontSize: 13, color: "#475569", fontFamily: "'Poppins', sans-serif",
                        transition: "background 0.15s",
                      }}
                    >
                      Close for now
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}