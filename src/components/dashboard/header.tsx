import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

const brandBlue = "#0a4c86";

type HeaderProps = {
  currentUserName: string;
};

const Header: React.FC<HeaderProps> = ({ currentUserName }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initials = currentUserName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleLogout = () => {
    localStorage.removeItem("session_token");
    localStorage.removeItem("session_user_id");
    localStorage.removeItem("session_user_full_name");
    localStorage.removeItem("session_user_role");
    navigate("/");
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Date & Time */}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: brandBlue, letterSpacing: "0.02em" }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>
            {dateStr}
          </div>
        </div>

        {/* User + Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              background: "#0a4c86",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>

          <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
            {currentUserName}
          </span>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: `1.5px solid ${brandBlue}`,
              background: "transparent",
              color: brandBlue,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Poppins', sans-serif",
              transition: "background 0.18s, color 0.18s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = brandBlue;
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = brandBlue;
            }}
          >
            <LogOut size={13} strokeWidth={2.2} />
            Logout
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;