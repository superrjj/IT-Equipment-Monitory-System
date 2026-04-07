import React from "react";
import { Bell } from "lucide-react";

const BRAND = "#0a4c86";

const UserNotifications: React.FC = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .un-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
      `}</style>

      <div className="un-root">
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
            <Bell size={20} color={BRAND} />
            Notifications
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            All alerts related to your tickets and announcements will appear here.
          </p>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            padding: "1rem 1.1rem",
            boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
            fontSize: 13,
            color: "#4b5563",
          }}
        >
          This page is ready to connect to the shared notification system used in the header.
          For now, open the bell icon in the header to see your latest alerts.
        </div>
      </div>
    </>
  );
};

export default UserNotifications;

