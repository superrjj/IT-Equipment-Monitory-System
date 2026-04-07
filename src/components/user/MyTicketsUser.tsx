import React from "react";
import { Ticket, Clock } from "lucide-react";

const BRAND = "#0a4c86";

const MyTicketsUser: React.FC = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .mtu-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
      `}</style>

      <div className="mtu-root">
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
            <Ticket size={20} color={BRAND} />
            My tickets
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            A history of all the requests you&apos;ve filed. Re-open a ticket if the
            issue comes back.
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
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Clock size={18} color={BRAND} />
          Ticket history will be displayed here once it&apos;s connected to the
          backend. For now this page is ready for wiring.
        </div>
      </div>
    </>
  );
};

export default MyTicketsUser;

