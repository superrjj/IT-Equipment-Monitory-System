import React from "react";
import { User, Mail, Lock } from "lucide-react";

const BRAND = "#0a4c86";

const UserProfile: React.FC = () => {
  const fullName = localStorage.getItem("session_user_full_name") || "";
  const username = ""; // can be wired later
  const email = ""; // can be wired later

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .upro-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .upro-label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }
        .upro-input {
          width: 100%;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.55rem 0.7rem;
          font-size: 13px;
          outline: none;
        }
      `}</style>

      <div className="upro-root">
        <div style={{ marginBottom: "1rem" }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: 0,
            }}
          >
            <User size={20} color={BRAND} />
            My profile
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            View your account information. Editing and password changes can be
            enabled here later.
          </p>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            padding: "1rem 1.1rem",
            boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gap: "0.75rem",
            maxWidth: 520,
          }}
        >
          <div>
            <label className="upro-label">Full name</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <User size={14} color={BRAND} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fullName || "—"}</span>
            </div>
          </div>

          <div>
            <label className="upro-label">Username</label>
            <input
              className="upro-input"
              value={username}
              placeholder="Will be shown here once linked"
              readOnly
            />
          </div>

          <div>
            <label className="upro-label">Email</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Mail size={14} color={BRAND} />
              <span style={{ fontSize: 13, color: "#4b5563" }}>{email || "—"}</span>
            </div>
          </div>

          <div>
            <label className="upro-label">Password &amp; notifications</label>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} color={BRAND} />
              Contact your IT administrator if you need to change your password or
              notification settings. This page is ready for a self-service flow later.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserProfile;

