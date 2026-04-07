import React from "react";
import {
  LayoutDashboard,
  TicketIcon,
  ListChecks,
} from "lucide-react";


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
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 900;
          display: flex;
          align-items: center;
          gap: 4px;
          background: #0D518C;
          border: 1.5px solid rgba(255,255,255,0.15);
          box-shadow: 0 4px 24px rgba(0,0,0,0.25), 0 1px 6px rgba(0,0,0,0.15);
          border-radius: 999px;
          padding: 6px 8px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 1px 6px rgba(0,0,0,0.06);
          font-family: 'Poppins', sans-serif;
          width: max-content;
          max-width: calc(100vw - 32px);
        }

        .ubnav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 8px 16px 7px;
          border-radius: 999px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.18s, color 0.18s;
          min-width: 78px;
          font-family: 'Poppins', sans-serif;
          color: rgba(255,255,255,0.55);
        }

        .ubnav-item:hover:not(.ubnav-active) {
          background: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.85);
        }

        .ubnav-item.ubnav-active {
          background: #ffffff;
          color: #0D518C;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
        }

        .ubnav-label {
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }

        @media (max-width: 520px) {
          .ubnav-item {
            padding: 7px 8px 6px;
            min-width: 58px;
          }
          .ubnav-label {
            font-size: 8.5px;
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
              onClick={() => onNavigate(label)}
              title={label}
              type="button"
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? "#0D518C" : "rgba(255,255,255,0.55)"}
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