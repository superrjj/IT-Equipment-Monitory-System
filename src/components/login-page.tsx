import React, { useState, useEffect } from "react";
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
  Building2,
  ChevronDown,
  Check,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND = "#0a4c86";

// ── Password Requirements ─────────────────────────────────────────────────────
const PW_RULES = [
  { id: "len",   label: "At least 8 characters",           test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)",       test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter (a–z)",       test: (p: string) => /[a-z]/.test(p) },
  { id: "num",   label: "One number (0–9)",                 test: (p: string) => /[0-9]/.test(p) },
  { id: "sym",   label: "One special character (!@#$…)",    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Poppins:wght@400;500;600;700;800&display=swap');

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
    background: rgba(0,0,0,0.42); z-index: 1;
  }

  .lp-card {
    position: relative; z-index: 10;
    width: 100%; max-width: 460px; margin: 3rem;
    background: #ffffff; border-radius: 20px;
    padding: 2.5rem 2.75rem 2.25rem;
    box-shadow: 0 32px 80px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.15);
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
    padding: 0.62rem 0.75rem 0.62rem 2.25rem;
    outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; width: 100%;
  }
  .lp-input::placeholder { color: #b0b8c4; font-family: 'Poppins', sans-serif; font-size: 13px; }
  .lp-input:hover  { border-color: #b8c2ce; background: #f2f4f7; }
  .lp-input:focus  { border-color: #0a4c86 !important; background: #fff; box-shadow: 0 0 0 3px rgba(10,76,134,0.10) !important; outline: none; }
  .lp-input--error { border-color: #fca5a5 !important; background: #fff8f8 !important; }

  .lp-pw-row { display: flex; justify-content: space-between; align-items: center; }
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
    border: none; border-radius: 10px;
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
  .lp-loading-text { color: #ffffff; font-family: 'Poppins', sans-serif; font-size: 0.9rem; font-weight: 500; letter-spacing: 0.08em; opacity: 0.9; }
  .lp-loading-sub  { color: rgba(255,255,255,0.55); font-family: 'Poppins', sans-serif; font-size: 0.74rem; margin-top: -0.65rem; }

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
    background: #ffffff; border-radius: 16px;
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
  .lp-modal-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.1rem 1.3rem 1rem; border-bottom: 1px solid #f0f2f5; }
  .lp-modal-header-icon { width: 36px; height: 36px; border-radius: 9px; background: #eef3fa; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #0a4c86; }
  .lp-modal-header-text { display: flex; flex-direction: column; gap: 1px; }
  .lp-modal-title   { font-size: 0.88rem; font-weight: 700; color: #1a2e4a; line-height: 1.2; }
  .lp-modal-subtitle { font-size: 0.7rem; color: #94a3b8; font-weight: 400; }
  .lp-modal-close {
    position: absolute; top: 0.9rem; right: 0.9rem;
    background: #f2f4f7; border: none; border-radius: 50%;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7685; transition: background 0.2s, color 0.2s;
  }
  .lp-modal-close:hover { background: #e2e6ed; color: #1a2e4a; }
  .lp-modal-body   { padding: 1.15rem 1.3rem; }
  .lp-modal-footer { display: flex; align-items: center; justify-content: flex-end; gap: 0.55rem; padding: 0.85rem 1.3rem 1.1rem; border-top: 1px solid #f0f2f5; }
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

  .lp-keep-row   { display: flex; align-items: center; margin-bottom: 1rem; }
  .lp-keep-checkbox { display: flex; align-items: center; gap: 0.4rem; font-family: 'Poppins', sans-serif; font-size: 0.72rem; color: ; cursor: pointer; }
  .lp-keep-checkbox input { width: 13px; height: 13px; cursor: pointer; }
  .lp-create-link { font-family: 'Poppins', sans-serif; font-size: 0.72rem; color: #0b5fa5; background: none; border: none; cursor: pointer; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
  .lp-create-link:hover { color: #083766; }
  .lp-bottom-row { margin-top: 1rem; display: flex; justify-content: center; gap: 0.3rem; font-family: 'Poppins', sans-serif; font-size: 0.72rem; color: #6b7280; }

  /* ── Create Account Modal ── */
  .ua-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 16px;
    animation: fadeIn 0.15s ease;
  }
  .ua-modal-box {
    width: min(600px, calc(100vw - 32px));
    height: min(680px, calc(100vh - 32px));
    overflow: hidden;
    background: #fff; border-radius: 22px;
    box-shadow: 0 40px 100px rgba(10,20,60,0.28), 0 0 0 1px rgba(10,76,134,0.07);
    animation: slideUp 0.22s cubic-bezier(0.16,1,0.3,1);
    font-family: 'Poppins', sans-serif;
    display: flex; flex-direction: column;
  }
  .ua-modal-header {
    padding: 1.4rem 1.5rem 1.1rem;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(135deg, #f0f6ff 0%, #e8f0ff 100%);
    border-radius: 22px 22px 0 0;
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
  }
  .ua-modal-body {
    padding: 1.4rem 1.5rem;
    display: flex; flex-direction: column; gap: 0;
    flex: 1; overflow-y: auto; overflow-x: hidden;
  }
  .ua-modal-body::-webkit-scrollbar { width: 5px; }
  .ua-modal-body::-webkit-scrollbar-track { background: transparent; }
  .ua-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
  .ua-modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .ua-modal-footer {
    padding: 1rem 1.5rem 1.2rem;
    border-top: 1px solid #f1f5f9;
    background: #fafbfc;
    border-radius: 0 0 22px 22px;
    display: flex; justify-content: flex-end; gap: 10px;
    flex-shrink: 0;
  }

  .ua-grid       { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .ua-span2      { grid-column: span 2; }
  .ua-field      { display: flex; flex-direction: column; }

  .ua-field-label {
    font-size: 11px; font-weight: 700; color: #64748b;
    letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 5px; display: block;
  }
  .ua-input {
    width: 100%;
    padding: 0.62rem 0.75rem 0.62rem 2.25rem;
    border-radius: 10px; border: 1.5px solid #e2e8f0;
    background: #f8fafc; font-size: 13px; color: #0f172a;
    outline: none; box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .ua-input:hover  { border-color: #b8c2ce; background: #f2f4f7; }
  .ua-input:focus  { border-color: #0a4c86 !important; box-shadow: 0 0 0 3px rgba(10,76,134,0.10) !important; background: #fff; outline: none; }
  .ua-input--error { border-color: #fca5a5 !important; background: #fff8f8 !important; }

  /* Password requirements checklist */
  .pw-req-box {
    background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 10px; padding: 0.7rem 0.85rem;
    display: flex; flex-direction: column; gap: 5px;
    margin-top: 4px;
  }
  .pw-req-title {
    font-size: 10px; font-weight: 700; color: #64748b;
    letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 3px;
  }
  .pw-req-item {
    display: flex; align-items: center; gap: 6px;
    font-size: 11.5px; font-weight: 500;
    transition: color 0.2s;
  }
  .pw-req-item.met   { color: #16a34a; }
  .pw-req-item.unmet { color: #94a3b8; }
  .pw-req-icon {
    width: 15px; height: 15px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 9px; font-weight: 800;
    transition: background 0.2s, color 0.2s;
  }
  .pw-req-item.met   .pw-req-icon { background: #dcfce7; color: #16a34a; }
  .pw-req-item.unmet .pw-req-icon { background: #f1f5f9; color: #94a3b8; }

  /* Select dropdown styled */
  .ua-select {
    width: 100%;
    padding: 0.62rem 2rem 0.62rem 2.25rem;
    border-radius: 10px; border: 1.5px solid #e2e8f0;
    background: #f8fafc; font-size: 13px; color: #0f172a;
    outline: none; box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    appearance: none; -webkit-appearance: none; cursor: pointer;
  }
  .ua-select:hover  { border-color: #b8c2ce; background: #f2f4f7; }
  .ua-select:focus  { border-color: #0a4c86 !important; box-shadow: 0 0 0 3px rgba(10,76,134,0.10) !important; background: #fff; outline: none; }
  .ua-select--error { border-color: #fca5a5 !important; background: #fff8f8 !important; }
  .ua-select-chevron { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; display: flex; }

  .ua-btn-close:hover  { background: #f1f5f9 !important; }
  .ua-btn-cancel:hover { background: #f0f4f8 !important; }
  .ua-btn-save:hover   { filter: brightness(1.07); transform: translateY(-1px); }

  /* Success state */
  .ua-success-box {
    text-align: center; padding: 2rem 1rem;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  .ua-success-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: #dcfce7; display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }

  .ua-field-error {
    min-height: 17px; margin-top: 2px; font-size: 11px; font-weight: 500;
    color: #dc2626; display: flex; align-items: center; gap: 4px;
    visibility: visible;
  }
  .ua-field-error--hidden { visibility: hidden; }

  /* Live check status badge */
  .live-status {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600; margin-top: 3px; min-height: 17px;
  }
  .live-status.checking { color: #94a3b8; }
  .live-status.available { color: #16a34a; }
  .live-status.taken { color: #dc2626; }

  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

  @media (max-width: 680px) {
    .ua-grid  { grid-template-columns: 1fr; }
    .ua-span2 { grid-column: span 1; }
  }
  @media (max-width: 600px) {
    .lp-card      { margin: 1rem; padding: 2rem 1.5rem 1.75rem; }
    .lp-city-logo { width: 180px; }
    .ua-modal-box { border-radius: 18px; }
  }
`;

// ── Small helpers ─────────────────────────────────────────────────────────────
const FieldError = ({ msg }: { msg?: string }) => (
  <div className={`ua-field-error${msg ? "" : " ua-field-error--hidden"}`}
    style={{ minHeight: 17, marginTop: 2, fontSize: 11, fontWeight: 500, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
    {msg && <><AlertTriangle size={10} />{msg}</>}
    {!msg && <span style={{ opacity: 0 }}>x</span>}
  </div>
);

type LiveStatusType = "idle" | "checking" | "taken" | "available";
const LiveStatus = ({ status, error, label = "field" }: { status: LiveStatusType; error?: string; label?: string }) => {
  // If there's a form-submit error, show that instead
  if (error) return (
    <div style={{ minHeight: 17, marginTop: 3, fontSize: 11, fontWeight: 500, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
      <AlertTriangle size={10} />{error}
    </div>
  );
  if (status === "idle") return <div style={{ minHeight: 17, marginTop: 3 }} />;
  if (status === "checking") return (
    <div className="live-status checking">
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ animation: "spin 0.8s linear infinite" }}>
        <circle cx="5" cy="5" r="4" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="18" strokeDashoffset="6" />
      </svg>
      Checking availability…
    </div>
  );
  if (status === "available") return (
    <div className="live-status available">
      <Check size={11} strokeWidth={3} /> {label} is available
    </div>
  );
  return (
    <div className="live-status taken">
      <X size={11} strokeWidth={3} /> {label} is already taken
    </div>
  );
};

const LoginFieldError = ({ msg }: { msg?: string }) => (
  <div style={{
    minHeight: 18, marginTop: 1, fontSize: 11, fontWeight: 500,
    color: "#dc2626", display: "flex", alignItems: "center", gap: 4,
    visibility: msg ? "visible" : "hidden",
  }}>
    <AlertTriangle size={10} />
    {msg ?? "placeholder"}
  </div>
);

function UAField({
  label, icon, required, error, children, className,
}: {
  label: string; icon?: React.ReactNode; required?: boolean;
  error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`ua-field${className ? " " + className : ""}`}>
      <label className="ua-field-label">
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
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
      <FieldError msg={error} />
    </div>
  );
}

// ── Password Requirements Component ──────────────────────────────────────────
const PasswordRequirements = ({ password }: { password: string }) => {
  if (!password) return null;
  return (
    <div className="pw-req-box">
      <div className="pw-req-title">Password Requirements</div>
      {PW_RULES.map(rule => {
        const met = rule.test(password);
        return (
          <div key={rule.id} className={`pw-req-item ${met ? "met" : "unmet"}`}>
            <span className="pw-req-icon">
              {met ? <Check size={9} strokeWidth={3.5} /> : <X size={9} strokeWidth={3.5} />}
            </span>
            {rule.label}
          </div>
        );
      })}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [identifier,   setIdentifier]   = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot,   setShowForgot]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showCreate,   setShowCreate]   = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [createDone,   setCreateDone]   = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [departments,  setDepartments]  = useState<{ id: string; name: string }[]>([]);

  const navigate = useNavigate();

  const [loginErrors, setLoginErrors] = useState<{
    identifier?: string; password?: string; general?: string;
  }>({});

  const [createErrors, setCreateErrors] = useState<{
    full_name?: string; username?: string; email?: string;
    password?: string; confirmPassword?: string; department_id?: string;
  }>({});

  const [showCreatePassword,  setShowCreatePassword]  = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [create, setCreate] = useState({
    full_name: "", username: "", email: "",
    password: "", confirmPassword: "", department_id: "",
  });

  // live uniqueness: "idle" | "checking" | "taken" | "available"
  const [usernameStatus, setUsernameStatus] = useState<"idle"|"checking"|"taken"|"available">("idle");
  const [emailStatus,    setEmailStatus]    = useState<"idle"|"checking"|"taken"|"available">("idle");
  const usernameTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer    = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = (val: string) => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const u = val.trim();
    if (!u || u.length < 3 || !/^[A-Za-z0-9_]+$/.test(u)) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    usernameTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("user_accounts").select("id").ilike("username", u).limit(1);
      setUsernameStatus(data && data.length > 0 ? "taken" : "available");
    }, 500);
  };

  const checkEmail = (val: string) => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    const e = val.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmailStatus("idle"); return; }
    setEmailStatus("checking");
    emailTimer.current = setTimeout(async () => {
      const { data } = await supabase.from("user_accounts").select("id").ilike("email", e).limit(1);
      setEmailStatus(data && data.length > 0 ? "taken" : "available");
    }, 500);
  };

  // ── Fetch departments on mount ────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_archived", false)
      .order("name")
      .then(({ data }) => { if (data) setDepartments(data); });
  }, []);

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
      localStorage.setItem("session_token",          crypto.randomUUID());
      localStorage.setItem("session_user_id",        user.id);
      localStorage.setItem("session_user_full_name", user.full_name);
      localStorage.setItem("session_user_role",      user.role);
      localStorage.setItem("session_expires_at",     expiresAt);
      setTimeout(() => { navigate("/dashboard", { replace: true }); }, 3000);
    } catch {
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
      setCreateDone(false);
      setCreating(false);
      setCreateErrors({});
      setShowCreatePassword(false);
      setShowConfirmPassword(false);
      setUsernameStatus("idle");
      setEmailStatus("idle");
      setCreate({ full_name: "", username: "", email: "", password: "", confirmPassword: "", department_id: "" });
    }, 300);
  };

  // ── Create account ────────────────────────────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof createErrors = {};

    const fn = create.full_name.trim();
    if (!fn)                                   errors.full_name = "Full name is required.";
    else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/.test(fn)) errors.full_name = "Full name must contain letters only.";

    const u = create.username.trim();
    if (!u)                               errors.username = "Username is required.";
    else if (u.length < 3)               errors.username = "Must be at least 3 characters.";
    else if (u.length > 32)              errors.username = "Must be 32 characters or less.";
    else if (!/^[A-Za-z0-9_]+$/.test(u)) errors.username = "Letters, numbers, and underscore only.";
    else if (usernameStatus === "taken")  errors.username = "Username is already taken.";
    else if (usernameStatus === "checking") errors.username = "Still checking username availability…";

    const email = create.email.trim();
    if (!email)                                          errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    else if (emailStatus === "taken")    errors.email = "Email address is already taken.";
    else if (emailStatus === "checking") errors.email = "Still checking email availability…";

    if (!create.department_id) errors.department_id = "Please select your department.";

    if (!create.password)                errors.password = "Password is required.";
    else if (create.password.length < 8) errors.password = "Must be at least 8 characters.";
    else if (create.password.length > 72) errors.password = "Password is too long (max 72 chars).";
    else if (!PW_RULES.every(r => r.test(create.password)))
      errors.password = "Password does not meet all requirements.";

    if (!create.confirmPassword)
      errors.confirmPassword = "Please confirm your password.";
    else if (create.password !== create.confirmPassword)
      errors.confirmPassword = "Passwords do not match.";

    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return; }

    setCreating(true);
    setCreateErrors({});

    try {
      const password_hash = await bcrypt.hash(create.password, 10);

      const { error: insertError } = await supabase.from("user_accounts").insert({
        full_name:     fn,
        username:      u,
        email,
        password_hash,
        role:          "Employee",
        department_id: create.department_id,
        is_active:     true,
      });

      if (insertError) throw new Error(insertError.message);

      setCreateDone(true);

    } catch (ex: any) {
      const msg = (ex?.message ?? "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        setCreateErrors({ username: "That username or email is already in use." });
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setCreateErrors({ full_name: "Network error. Check your connection and try again." });
      } else {
        setCreateErrors({ full_name: "Something went wrong. Please try again." });
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
              <LoginFieldError msg={loginErrors.identifier} />
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
              <LoginFieldError msg={loginErrors.password} />
            </div>

            {/* General error */}
            {loginErrors.general && (
              <div style={{
                padding: "0.5rem 0.75rem", borderRadius: 8, marginTop: 4,
                backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                color: "#b91c1c", fontFamily: "'Poppins', sans-serif", fontSize: "0.71rem",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <AlertTriangle size={11} /> {loginErrors.general}
              </div>
            )}

            <div className="lp-keep-row" style={{ marginTop: "0.5rem" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: BRAND,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(10,76,134,0.3)",
                  }}>
                    <UserPlus size={18} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>Create an Account</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Fill in your details to get started</div>
                  </div>
                </div>
                <button
                  className="ua-btn-close"
                  onClick={closeCreate}
                  aria-label="Close"
                  style={{
                    border: "1.5px solid #e2e8f0", background: "#fff", borderRadius: 10,
                    width: 34, height: 34, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#94a3b8", flexShrink: 0, transition: "background 0.15s",
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* ── State: success ── */}
              {createDone && (
                <>
                  <div className="ua-modal-body">
                    <div className="ua-success-box">
                      <div className="ua-success-icon">
                        <CheckCircle2 size={34} color="#16a34a" />
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#166534" }}>Account Created!</div>
                      <div style={{ fontSize: 12.5, color: "#4b5563", maxWidth: 300, lineHeight: 1.65, textAlign: "center" }}>
                        Your account has been successfully created. You can now sign in with your username and password.
                      </div>
                    </div>
                  </div>
                  <div className="ua-modal-footer" style={{ justifyContent: "center" }}>
                    <button
                      type="button" onClick={closeCreate}
                      style={{
                        border: "none", background: BRAND, color: "#fff",
                        borderRadius: 10, padding: "0.6rem 1.6rem", cursor: "pointer",
                        fontWeight: 800, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                        boxShadow: "0 4px 16px rgba(10,76,134,0.3)",
                      }}
                    >
                      Sign in now
                    </button>
                  </div>
                </>
              )}

              {/* ── State: form ── */}
              {!createDone && (
                <>
                  <div className="ua-modal-body">
                    <div className="ua-grid">

                      {/* Full Name – full width */}
                      <UAField label="Full Name" icon={<User size={13} />} required error={createErrors.full_name} className="ua-span2">
                        <input
                          className={`ua-input${createErrors.full_name ? " ua-input--error" : ""}`}
                          type="text" placeholder="e.g. Juan Dela Cruz"
                          value={create.full_name}
                          onChange={e => {
                            const val = e.target.value;
                            // Allow only letters, spaces, hyphens, apostrophes
                            if (val && !/^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]*$/.test(val)) return;
                            setCreate(c => ({ ...c, full_name: val }));
                            setCreateErrors(p => ({ ...p, full_name: undefined }));
                          }}
                        />
                      </UAField>

                      {/* Username */}
                      <div className="ua-field">
                        <label className="ua-field-label">Username<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span></label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", display: "flex", zIndex: 1 }}><AtSign size={13} /></span>
                          <input
                            className={`ua-input${(createErrors.username || usernameStatus === "taken") ? " ua-input--error" : usernameStatus === "available" ? " ua-input--ok" : ""}`}
                            style={{ borderColor: usernameStatus === "available" && !createErrors.username ? "#86efac" : undefined }}
                            type="text" placeholder="e.g. juan_dc"
                            value={create.username}
                            onChange={e => {
                              const val = e.target.value;
                              setCreate(c => ({ ...c, username: val }));
                              setCreateErrors(p => ({ ...p, username: undefined }));
                              setUsernameStatus("idle");
                              checkUsername(val);
                            }}
                          />
                        </div>
                        <LiveStatus status={usernameStatus} error={createErrors.username} label="Username" />
                      </div>

                      {/* Email */}
                      <div className="ua-field">
                        <label className="ua-field-label">Email Address<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span></label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", display: "flex", zIndex: 1 }}><Mail size={13} /></span>
                          <input
                            className={`ua-input${(createErrors.email || emailStatus === "taken") ? " ua-input--error" : ""}`}
                            style={{ borderColor: emailStatus === "available" && !createErrors.email ? "#86efac" : undefined }}
                            type="email" placeholder="you@example.com"
                            value={create.email}
                            onChange={e => {
                              const val = e.target.value;
                              setCreate(c => ({ ...c, email: val }));
                              setCreateErrors(p => ({ ...p, email: undefined }));
                              setEmailStatus("idle");
                              checkEmail(val);
                            }}
                          />
                        </div>
                        <LiveStatus status={emailStatus} error={createErrors.email} label="Email address" />
                      </div>

                      {/* Department – full width */}
                      <UAField label="Department" icon={<Building2 size={13} />} required error={createErrors.department_id} className="ua-span2">
                        <select
                          className={`ua-select${createErrors.department_id ? " ua-select--error" : ""}`}
                          value={create.department_id}
                          onChange={e => { setCreate(c => ({ ...c, department_id: e.target.value })); setCreateErrors(p => ({ ...p, department_id: undefined })); }}
                        >
                          <option value="">Select your department…</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <span className="ua-select-chevron"><ChevronDown size={13} /></span>
                      </UAField>

                      {/* Password */}
                      <div className="ua-field ua-span2">
                        <label className="ua-field-label">
                          Password<span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>
                        </label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none", display: "flex", zIndex: 1 }}>
                            <Lock size={13} />
                          </span>
                          <input
                            className={`ua-input${createErrors.password ? " ua-input--error" : ""}`}
                            type={showCreatePassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            style={{ paddingRight: "2.4rem" }}
                            value={create.password}
                            onChange={e => { setCreate(c => ({ ...c, password: e.target.value })); setCreateErrors(p => ({ ...p, password: undefined })); }}
                          />
                          <button
                            type="button"
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", padding: 0 }}
                            onClick={() => setShowCreatePassword(v => !v)}
                          >
                            {showCreatePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {/* Requirements – shown while typing */}
                        {create.password && <PasswordRequirements password={create.password} />}
                        <FieldError msg={createErrors.password} />
                      </div>

                      {/* Confirm Password */}
                      <UAField label="Confirm Password" icon={<Lock size={13} />} required error={createErrors.confirmPassword} className="ua-span2">
                        <input
                          className={`ua-input${createErrors.confirmPassword ? " ua-input--error" : ""}`}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repeat your password"
                          style={{ paddingRight: "2.4rem" }}
                          value={create.confirmPassword}
                          onChange={e => { setCreate(c => ({ ...c, confirmPassword: e.target.value })); setCreateErrors(p => ({ ...p, confirmPassword: undefined })); }}
                        />
                        <button
                          type="button"
                          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", padding: 0 }}
                          onClick={() => setShowConfirmPassword(v => !v)}
                        >
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </UAField>

                    </div>
                  </div>

                  <div className="ua-modal-footer">
                    <button
                      className="ua-btn-cancel" type="button" onClick={closeCreate}
                      style={{
                        border: "1.5px solid #e2e8f0", background: "#fff", borderRadius: 10,
                        padding: "0.58rem 1.1rem", cursor: "pointer", fontWeight: 700,
                        fontSize: 13, color: "#475569", fontFamily: "'Poppins', sans-serif",
                        transition: "background 0.15s",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="ua-btn-save" type="button"
                      disabled={creating}
                      onClick={handleCreateAccount as any}
                      style={{
                        border: "none",
                        background: creating ? "#94a3b8" : BRAND,
                        color: "#fff", borderRadius: 10, padding: "0.58rem 1.3rem",
                        cursor: creating ? "not-allowed" : "pointer",
                        fontWeight: 800, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                        boxShadow: creating ? "none" : "0 4px 16px rgba(10,76,134,0.3)",
                        transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {creating ? "Creating account…" : "Create Account"}
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