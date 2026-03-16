import { useState } from "react";
import { useNavigate } from "react-router-dom";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .lp-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  /* ── Background — static, no animation ── */
  .lp-bg {
    position: fixed;
    inset: 0;
    background: url('./Tarlac_City_Hall.jpg') center/cover no-repeat;
    z-index: 0;
  }
  .lp-bg-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.38);
    z-index: 1;
  }

  /* ── Card ── */
  .lp-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 500px;
    margin: 3rem;
    background: #ffffff;
    border-radius: 16px;
    padding: 2.75rem 3rem 2.5rem;
    box-shadow: 0 24px 64px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15);
    animation: cardIn 0.65s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* (Removed gold accent bar on top) */

  /* ── Brand ── */
  .lp-brand {
    text-align: center;
    margin-bottom: 2rem;
  }
  .lp-city-logo {
    width: 150px;
    height: auto;
    display: block;
    margin: 0 auto 1.25rem;
    object-fit: contain;
  }
  .lp-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.8rem;
    font-weight: 500;
    color: #1a2e4a;
    line-height: 1.25;
  }
  .lp-subtitle {
    font-size: 0.90rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #8a95a3;
    margin-top: 0.35rem;
    font-weight: 400;
  }

  /* ── Form ── */
  .lp-form { display: flex; flex-direction: column; gap: 1.15rem; }

  .lp-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .lp-label {
    font-size: 0.73rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a5568;
    font-weight: 500;
    text-align: left;
  }

  .lp-input {
    background: #f7f8fa;
    border: 1.5px solid #e2e6ed;
    border-radius: 9px;
    color: #1a2e4a;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.95rem;
    font-weight: 400;
    padding: 0.75rem 1rem;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    width: 100%;
  }
  .lp-input::placeholder { color: #b0b8c4; }
  .lp-input:hover  { border-color: #b8c2ce; background: #f2f4f7; }
  .lp-input:focus  { border-color: #1a2e4a; background: #fff; box-shadow: 0 0 0 3px rgba(26,46,74,0.09); }

  /* ── Password row ── */
  .lp-pw-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lp-forgot {
    font-size: 0.76rem;
    color: #c9a84c;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    padding: 0;
    transition: color 0.2s;
    font-family: 'DM Sans', sans-serif;
  }
  .lp-forgot:hover { color: #a8872e; }

  .lp-toggle {
    position: absolute; right: 0.8rem; top: 50%;
    transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: #8a95a3; font-size: 0.75rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    padding: 0; transition: color 0.2s;
  }
  .lp-toggle:hover { color: #1a2e4a; }

  /* ── Sign in button ── */
  .lp-btn {
    margin-top: 0.35rem;
    padding: 0.88rem;
    border: none;
    border-radius: 9px;
    /* Brand blue (matches logo text) */
    background: linear-gradient(120deg, #0b5fa5, #0a4c86);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: filter 0.18s, transform 0.12s, box-shadow 0.18s;
    box-shadow: 0 16px 35px rgba(15, 23, 42, 0.35);
  }
  .lp-btn:hover  { filter: brightness(1.04); box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45); transform: translateY(-1px); }
  .lp-btn:active { transform: translateY(0); filter: brightness(1); box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35); }

  /* ══════════════════════════════════
     FORGOT PASSWORD — RIGHT SIDE PANEL
  ══════════════════════════════════ */
  .lp-overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0, 0, 0, 0.38);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
    animation: overlayIn 0.25s ease both;
  }
  @keyframes overlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .lp-dialog {
    width: 100%;
    max-width: 420px;
    height: 100vh;
    background: #ffffff;
    padding: 0 2.75rem;
    box-shadow: -16px 0 56px rgba(0,0,0,0.22);
    animation: slideIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow-y: auto;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(80px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* Gold left border on dialog */
  .lp-dialog::before {
    content: '';
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #c9a84c, #e8c97a, #c9a84c);
  }

  .lp-dialog-close {
    position: absolute; top: 1.5rem; right: 1.5rem;
    background: #f2f4f7;
    border: none;
    border-radius: 50%;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7685;
    font-size: 0.9rem; line-height: 1;
    transition: background 0.2s, color 0.2s;
  }
  .lp-dialog-close:hover { background: #e2e6ed; color: #1a2e4a; }

  .lp-dialog-icon {
    width: 50px; height: 50px;
    border-radius: 13px;
    background: #f0f3f7;
    border: 1.5px solid #dde3ec;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 1.5rem;
    font-size: 1.5rem;
  }

  .lp-dialog-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.65rem;
    font-weight: 500;
    color: #1a2e4a;
    margin-bottom: 0.5rem;
  }
  .lp-dialog-desc {
    font-size: 0.84rem;
    color: #6b7685;
    line-height: 1.65;
    margin-bottom: 2rem;
  }

  .lp-dialog-field { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.25rem; }

  .lp-dialog-btn {
    width: 100%; padding: 0.88rem;
    border: none; border-radius: 9px;
    background: #1a2e4a;
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.88rem; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
    box-shadow: 0 5px 16px rgba(26,46,74,0.25);
  }
  .lp-dialog-btn:hover { background: #243d61; transform: translateY(-1px); }
  .lp-dialog-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

  .lp-success-msg {
    text-align: center; padding: 0.9rem;
    background: #f0faf5;
    border: 1.5px solid #86efac;
    border-radius: 9px;
    color: #166534;
    font-size: 0.82rem;
    line-height: 1.6;
    margin-top: 0.5rem;
  }

  .lp-back {
    display: block; text-align: center; margin-top: 1.25rem;
    font-size: 0.79rem; color: #8a95a3;
    background: none; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: color 0.2s;
  }
  .lp-back:hover { color: #1a2e4a; }
`;

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent]   = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Predefined demo account
    const demoUser = "admin";
    const demoPass = "admin123";

    if (identifier === demoUser && password === demoPass) {
      setError(null);
      navigate("/dashboard");
    } else {
      setError("Invalid credentials. Try admin / admin123.");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetting(true);
    await new Promise(r => setTimeout(r, 1400));
    setResetting(false);
    setResetSent(true);
  };

  const closeForgot = () => {
    setShowForgot(false);
    setTimeout(() => { setResetEmail(""); setResetSent(false); }, 300);
  };

  return (
    <>
      <style>{styles}</style>

      <div className="lp-root">
        {/* Static background — no animation */}
        <div className="lp-bg" />
        <div className="lp-bg-overlay" />

        {/* ── Login Card ── */}
        <div className="lp-card">
          <div className="lp-brand">
            <img
              src="./masaya-sa-tarlac-city.png"
              alt="Masaya sa Tarlac City"
              className="lp-city-logo"
            />
            <p className="lp-subtitle">IT Equipment Monitoring</p>
          </div>

          <form className="lp-form" onSubmit={handleLogin}>
            {/* Email / Username */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="identifier">Email or Username</label>
              <input
                id="identifier"
                className="lp-input"
                type="text"
                placeholder="you@example.com"
                autoComplete="username"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="lp-field">
              <div className="lp-pw-row">
                <label className="lp-label" htmlFor="password">Password</label>
                <button
                  type="button"
                  className="lp-forgot"
                  onClick={() => setShowForgot(true)}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  className="lp-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: "3.2rem" }}
                />
                <button
                  type="button"
                  className="lp-toggle"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: "0.25rem",
                  padding: "0.55rem 0.8rem",
                  borderRadius: 8,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: "0.78rem",
                }}
              >
                {error}
              </div>
            )}

            <button className="lp-btn" type="submit">Sign In</button>
          </form>
        </div>

        {/* ══ Forgot Password — slides in from RIGHT ══ */}
        {showForgot && (
          <div
            className="lp-overlay"
            onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}
          >
            <div className="lp-dialog" role="dialog" aria-modal="true">
              <button className="lp-dialog-close" onClick={closeForgot} aria-label="Close">✕</button>

              <div className="lp-dialog-icon">🔑</div>

              {!resetSent ? (
                <>
                  <h2 className="lp-dialog-title">Reset password</h2>
                  <p className="lp-dialog-desc">
                    Enter the email linked to your account and we'll send you a secure reset link.
                  </p>
                  <form onSubmit={handleReset}>
                    <div className="lp-dialog-field">
                      <label className="lp-label" htmlFor="reset-email">Email address</label>
                      <input
                        id="reset-email"
                        className="lp-input"
                        type="email"
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      className="lp-dialog-btn"
                      type="submit"
                      disabled={resetting || !resetEmail}
                    >
                      {resetting ? "Sending…" : "Send Reset Link"}
                    </button>
                  </form>
                  <button className="lp-back" onClick={closeForgot}>← Back to sign in</button>
                </>
              ) : (
                <>
                  <h2 className="lp-dialog-title">Check your email</h2>
                  <p className="lp-dialog-desc">
                    We've sent a reset link to your inbox. It expires in 15 minutes.
                  </p>
                  <div className="lp-success-msg">
                    📬 A reset link was sent to <strong>{resetEmail}</strong>.<br />
                    Didn't receive it? Check your spam folder.
                  </div>
                  <button className="lp-back" onClick={closeForgot}>← Back to sign in</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}