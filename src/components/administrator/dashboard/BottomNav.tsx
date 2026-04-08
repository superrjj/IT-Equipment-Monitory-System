import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Building2, BarChart2, User,
  CircleArrowDown, CircleArrowUp, TicketIcon,
  ScrollText, CheckCircle2, ChevronUp, X, Wrench,
} from "lucide-react";

const baseBlue = "#0a4c86";

type MenuItem = { label: string; icon: React.ElementType };
type MenuSection = { heading?: string; items: MenuItem[] };

const adminMenuSections: MenuSection[] = [
  { items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Tickets & Repairs",
    items: [
      { label: "Submit Ticket",    icon: TicketIcon   },
      { label: "Assign Job",       icon: Wrench       },
      { label: "Resolved Tickets", icon: CheckCircle2 },
    ],
  },
  {
    heading: "Units",
    items: [
      { label: "Incoming Units", icon: CircleArrowDown },
      { label: "Outgoing Units", icon: CircleArrowUp  },
    ],
  },
  {
    heading: "Management",
    items: [
      { label: "Departments",   icon: Building2 },
      { label: "User Accounts", icon: User      },
    ],
  },
  {
    heading: "Reports",
    items: [{ label: "Reports & Analytics", icon: BarChart2 }],
  },
  {
    heading: "Workspace",
    items: [{ label: "Activity Log", icon: ScrollText }],
  },
];

const technicianMenuSections: MenuSection[] = [
  { items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Tickets",
    items: [
      { label: "My Tickets",   icon: TicketIcon },
      { label: "Work History", icon: ScrollText },
    ],
  },
  {
    heading: "Units",
    items: [
      { label: "Incoming Units", icon: CircleArrowDown },
      { label: "Outgoing Units", icon: CircleArrowUp  },
    ],
  },
  {
    heading: "Workspace",
    items: [{ label: "Activity Log", icon: ScrollText }],
  },
];

// Default 4 menus (plus "More"): Dashboard, Submit Ticket, Assign, Resolved Tickets
const adminPrimaryLabels      = ["Dashboard", "Submit Ticket", "Assign Job", "Resolved Tickets", "More"];
const technicianPrimaryLabels = ["Dashboard", "My Tickets",    "Incoming Units", "Outgoing Units", "More"];

type BottomNavProps = {
  activeLabel: string;
  onNavigate: (label: string) => void;
  userRole: string;
};

const BottomNav: React.FC<BottomNavProps> = ({ activeLabel, onNavigate, userRole }) => {
  const isTechnician = userRole === "IT Technician";

  const menuSections = useMemo(
    () => (isTechnician ? technicianMenuSections : adminMenuSections),
    [isTechnician]
  );

  const primaryLabels = isTechnician ? technicianPrimaryLabels : adminPrimaryLabels;

  const allItems = useMemo(
    () => menuSections.flatMap(s => s.items),
    [menuSections]
  );

  const drawerSections = useMemo(
    () => menuSections
      .map(s => ({
        ...s,
        items: s.items.filter(item => !primaryLabels.slice(0, 4).includes(item.label)),
      }))
      .filter(s => s.items.length > 0),
    [menuSections, primaryLabels]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  const handleNav = (label: string) => {
    onNavigate(label);
    setDrawerOpen(false);
  };

  const primaryItems = primaryLabels.slice(0, 4).map(label => {
    const found = allItems.find(i => i.label === label);
    return found ?? { label, icon: LayoutDashboard };
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        .bnav-bar {
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

        .bnav-item {
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

        .bnav-item:focus-visible {
          outline: 3px solid ${baseBlue};
          outline-offset: 2px;
        }

        .bnav-item:hover:not(.bnav-active) {
          background: #f1f5f9;
          color: #0f172a;
        }

        .bnav-item.bnav-active {
          background: ${baseBlue};
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(10,76,134,0.35);
          border-color: ${baseBlue};
        }

        .bnav-label {
          font-size: 12px;
          font-weight: 700;
          line-height: 1.15;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }

        .bnav-more {
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
          transition: background 0.18s, color 0.18s;
          min-width: 80px;
          min-height: 52px;
          font-family: 'Poppins', sans-serif;
          color: #334155;
          -webkit-tap-highlight-color: transparent;
        }

        .bnav-more:focus-visible {
          outline: 3px solid ${baseBlue};
          outline-offset: 2px;
        }

        .bnav-more:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .bnav-more.bnav-more-open {
          background: #f1f5f9;
          color: ${baseBlue};
        }

        .bnav-drawer {
          position: fixed;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          z-index: 901;
          background: #ffffff;
          border: 2px solid #cbd5e1;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(10,76,134,0.18), 0 4px 16px rgba(0,0,0,0.08);
          padding: 14px;
          min-width: 300px;
          max-width: min(380px, calc(100vw - 24px));
          font-family: 'Poppins', sans-serif;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .bnav-drawer.bnav-drawer-open {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(-50%) translateY(0);
        }

        .bnav-drawer-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 14px 14px;
          border-radius: 12px;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
          text-align: left;
          transition: background 0.15s, color 0.15s;
          min-height: 48px;
          -webkit-tap-highlight-color: transparent;
        }

        .bnav-drawer-item:focus-visible {
          outline: 3px solid ${baseBlue};
          outline-offset: 1px;
        }

        .bnav-drawer-item:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .bnav-drawer-item.bnav-drawer-active {
          background: rgba(10,76,134,0.12);
          color: ${baseBlue};
          font-weight: 700;
          border-color: rgba(10,76,134,0.25);
        }

        .bnav-drawer-heading {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 10px 14px 6px;
          font-family: 'Poppins', sans-serif;
        }

        .bnav-drawer-divider {
          height: 1px;
          background: #f1f5f9;
          margin: 6px 4px;
        }

        .bnav-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 899;
        }
        .bnav-overlay.bnav-overlay-open {
          display: block;
        }
      `}</style>

      {/* Overlay */}
      <div
        className={`bnav-overlay${drawerOpen ? " bnav-overlay-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* More drawer */}
      <div
        ref={drawerRef}
        className={`bnav-drawer${drawerOpen ? " bnav-drawer-open" : ""}`}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 12px 12px", borderBottom: "2px solid #e2e8f0", marginBottom: 8,
        }}>
          <span style={{
            fontSize: 16, fontWeight: 700, color: "#0f172a",
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "0.01em",
          }}>
            More options
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 44, height: 44, borderRadius: 10, border: "2px solid #e2e8f0",
              background: "#f8fafc", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#334155",
            }}
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        {drawerSections.map((section, idx) => (
          <div key={idx}>
            {section.heading && (
              <div className="bnav-drawer-heading">{section.heading}</div>
            )}
            {section.items.map(({ label, icon: Icon }) => {
              const active = label === activeLabel;
              return (
                <button
                  type="button"
                  key={label}
                  className={`bnav-drawer-item${active ? " bnav-drawer-active" : ""}`}
                  onClick={() => handleNav(label)}
                >
                  <Icon size={20} strokeWidth={active ? 2.25 : 2} color={active ? baseBlue : "#334155"} />
                  {label}
                </button>
              );
            })}
            {idx < drawerSections.length - 1 && <div className="bnav-drawer-divider" />}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <nav className="bnav-bar" role="navigation" aria-label="Main navigation">
        {primaryItems.map(({ label, icon: Icon }) => {
          const active = label === activeLabel;
          return (
            <button
              key={label}
              type="button"
              className={`bnav-item${active ? " bnav-active" : ""}`}
              onClick={() => handleNav(label)}
              title={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.35 : 2.1}
                color={active ? "#ffffff" : "#334155"}
              />
              <span className="bnav-label">{label}</span>
            </button>
          );
        })}

        {/* More button */}
        <button
          type="button"
          className={`bnav-more${drawerOpen ? " bnav-more-open" : ""}`}
          onClick={() => setDrawerOpen(v => !v)}
          title="More"
          aria-expanded={drawerOpen}
          aria-haspopup="true"
        >
          <ChevronUp
            size={20}
            strokeWidth={2.1}
            color={drawerOpen ? baseBlue : "#334155"}
            style={{
              transform: drawerOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
          <span className="bnav-label">More</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;