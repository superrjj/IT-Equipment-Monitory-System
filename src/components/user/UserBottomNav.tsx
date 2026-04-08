import React from "react";
import {
  LayoutDashboard,
  TicketIcon,
  ListChecks,
} from "lucide-react";

/** Matches administrator `BottomNav` (`baseBlue`). */
const baseBlue = "#0a4c86";

type UserNavLabel =
  | "Dashboard"
  | "Submit Ticket"
  | "My Tickets";

type BottomNavProps = {
  activeLabel: UserNavLabel;
  onNavigate: (label: UserNavLabel) => void;
};

const items: { label: UserNavLabel; icon: React.ElementType }[] = [
  { label: "Dashboard",      icon: LayoutDashboard },
  { label: "Submit Ticket",  icon: TicketIcon },
  { label: "My Tickets",     icon: ListChecks },
];

const UserBottomNav: React.FC<BottomNavProps> = ({ activeLabel, onNavigate }) => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        .ubnav-bar {
          position: fixed;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 900;
          display: flex;
          align-items: center;
          gap: 4px;
          background: #ffffff;
          border: 2px solid #cbd5e1;
          border-radius: 999px;
          padding: 8px 10px;
          box-shadow: 0 6px 28px rgba(15,23,42,0.12), 0 2px 8px rgba(0,0,0,0.08);
          font-family: 'Poppins', sans-serif;
          width: max-content;
          max-width: calc(100vw - 24px);
        }

        .ubnav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 10px 16px 9px;
          border-radius: 999px;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: background 0.18s, color 0.18s, border-color 0.18s;
          min-width: 96px;
          min-height: 52px;
          font-family: 'Poppins', sans-serif;
          color: #334155;
          -webkit-tap-highlight-color: transparent;
        }

        .ubnav-item:focus-visible {
          outline: 3px solid ${baseBlue};
          outline-offset: 2px;
        }

        .ubnav-item:hover:not(.ubnav-active) {
          background: #f1f5f9;
          color: #0f172a;
        }

        .ubnav-item.ubnav-active {
          background: ${baseBlue};
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(10,76,134,0.35);
          border-color: ${baseBlue};
        }

        .ubnav-label {
          font-size: 12px;
          font-weight: 700;
          line-height: 1.15;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }

        @media (max-width: 520px) {
          .ubnav-item {
            padding: 9px 12px 8px;
            min-width: 84px;
            min-height: 50px;
          }
          .ubnav-label {
            font-size: 11px;
            font-weight: 700;
          }
        }
      `}</style>

      <nav className="ubnav-bar" role="navigation" aria-label="User navigation">
        {items.map(({ label, icon: Icon }) => {
          const active = label === activeLabel;
          return (
            <button
              key={label}
              className={`ubnav-item${active ? " ubnav-active" : ""}`}
              onClick={() => {
                onNavigate(label);
              }}
              title={label}
              type="button"
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.35 : 2.1}
                color={active ? "#ffffff" : "#334155"}
              />
              <span className="ubnav-label">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export type { UserNavLabel };
export default UserBottomNav;