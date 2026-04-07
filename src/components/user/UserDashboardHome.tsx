import React from "react";
import { Ticket, Clock, CheckCircle2, Bell, ArrowRight } from "lucide-react";

const BRAND = "#0a4c86";

type Props = {
  onNavigateSubmit: () => void;
  onNavigateMyTickets: () => void;
  onNavigateNotifications: () => void;
};

const UserDashboardHome: React.FC<Props> = ({
  onNavigateSubmit,
  onNavigateMyTickets,
  onNavigateNotifications,
}) => {
  const fullName = localStorage.getItem("session_user_full_name") || "Employee";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .udh-root { font-family: 'DM Sans', sans-serif; color: #0f172a; }
        .udh-grid-kpi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; }
        .udh-kpi-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1rem 1.1rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 10px rgba(15,23,42,0.05);
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .udh-kpi-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          font-weight: 600;
        }
        .udh-kpi-value {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }
        .udh-kpi-sub {
          font-size: 11px;
          color: #94a3b8;
        }
        .udh-section {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          padding: 1.1rem 1.2rem;
          box-shadow: 0 2px 10px rgba(15,23,42,0.04);
        }
        .udh-section-title {
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 0.4rem;
        }
        .udh-section-sub {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 0.8rem;
        }
        .udh-quick-row {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 0.6rem;
        }
        .udh-quick {
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #f9fafb;
          padding: 0.7rem 0.75rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.12s;
        }
        .udh-quick:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          box-shadow: 0 6px 18px rgba(15,23,42,0.12);
          transform: translateY(-1px);
        }
        .udh-quick-label {
          font-size: 12px;
          font-weight: 600;
        }
        .udh-quick-desc {
          font-size: 11px;
          color: #6b7280;
        }
        @media (max-width: 960px) {
          .udh-grid-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .udh-grid-kpi { grid-template-columns: minmax(0,1fr); }
          .udh-quick-row { grid-template-columns: minmax(0,1fr); }
        }
      `}</style>

      <div className="udh-root">
        {/* Welcome */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>
            Welcome back,{" "}
            <span style={{ color: BRAND }}>{fullName.split(" ")[0] || fullName}</span>
          </div>
          <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
            Quickly see what&apos;s happening with your IT helpdesk requests.
          </p>
        </div>

        {/* Top KPIs – placeholders for now */}
        <div className="udh-grid-kpi" style={{ marginBottom: "1rem" }}>
          <div className="udh-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${BRAND}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ticket size={15} color={BRAND} />
              </div>
            </div>
            <div className="udh-kpi-value">—</div>
            <div className="udh-kpi-label">Open Requests</div>
            <div className="udh-kpi-sub">Tickets still being worked on</div>
          </div>
          <div className="udh-kpi-card">
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "#f59e0b15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={15} color="#b45309" />
            </div>
            <div className="udh-kpi-value">—</div>
            <div className="udh-kpi-label">Awaiting Response</div>
            <div className="udh-kpi-sub">Tickets waiting for your reply</div>
          </div>
          <div className="udh-kpi-card">
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "#16a34a15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={15} color="#15803d" />
            </div>
            <div className="udh-kpi-value">—</div>
            <div className="udh-kpi-label">Resolved</div>
            <div className="udh-kpi-sub">Tickets successfully closed</div>
          </div>
        </div>

        {/* Shortcuts & recent activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "0.9rem", marginBottom: "0.8rem" }}>
          {/* Quick actions */}
          <div className="udh-section">
            <div className="udh-section-title">
              <Ticket size={16} color={BRAND} />
              Quick actions
            </div>
            <div className="udh-section-sub">
              Common things you&apos;ll do most of the time.
            </div>
            <div className="udh-quick-row">
              <button type="button" className="udh-quick" onClick={onNavigateSubmit}>
                <span className="udh-quick-label">Submit a new ticket</span>
                <span className="udh-quick-desc">Report an issue or request support.</span>
              </button>
              <button type="button" className="udh-quick" onClick={onNavigateMyTickets}>
                <span className="udh-quick-label">View my tickets</span>
                <span className="udh-quick-desc">Track status and re-open if needed.</span>
              </button>
              <button type="button" className="udh-quick" onClick={onNavigateNotifications}>
                <span className="udh-quick-label">Check notifications</span>
                <span className="udh-quick-desc">See recent updates in one place.</span>
              </button>
            </div>
          </div>

          {/* Notifications teaser */}
          <div className="udh-section">
            <div className="udh-section-title">
              <Bell size={16} color={BRAND} />
              Recent alerts
            </div>
            <div className="udh-section-sub">
              A quick peek at the latest updates from IT.
            </div>
            <div
              style={{
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px dashed #d1d5db",
                padding: "0.8rem 0.85rem",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Live notifications will appear here once wired to the backend.
              For now, you can open the full{" "}
              <button
                type="button"
                onClick={onNavigateNotifications}
                style={{
                  border: "none",
                  background: "none",
                  color: BRAND,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                notifications page
              </button>{" "}
              to see all updates.
            </div>
          </div>
        </div>

        {/* Helpful info */}
        <div className="udh-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div className="udh-section-title" style={{ marginBottom: 2 }}>
                Need help with your ticket?
              </div>
              <div className="udh-section-sub" style={{ marginBottom: 0 }}>
                You can always reply to an existing ticket instead of creating a new one
                if your concern is related to the same issue.
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateMyTickets}
              style={{
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                padding: "0.45rem 0.9rem",
                fontSize: 12,
                fontWeight: 600,
                color: BRAND,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              Go to My Tickets
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserDashboardHome;

