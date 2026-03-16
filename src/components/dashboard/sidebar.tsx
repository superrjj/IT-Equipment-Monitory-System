import React, { useState } from "react";
import {
  LayoutDashboard,
  Monitor,
  Building2,
  AlertTriangle,
  Wrench,
  ClipboardList,
  BarChart2,
} from "lucide-react";

const baseBlue = "#0a4c86";
const hoverBlue = "#0d5fa3";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Equipment", icon: Monitor },
  { label: "Departments", icon: Building2 },
  { label: "Defective Reports", icon: AlertTriangle },
  { label: "Repairs", icon: Wrench },
  { label: "Repair History", icon: ClipboardList },
  { label: "Reports", icon: BarChart2 },
];

const Sidebar: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');`}</style>
      <aside
        style={{
          width: 230,
          background: "#ffffff",
          color: "#1e293b",
          padding: "1.4rem 1.4rem 1.6rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          borderRight: "1px solid #e2e8f0",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <div>
          <img
            src="/masaya-sa-tarlac-city.png"
            alt="Masaya sa Tarlac City"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              marginBottom: 10,
            }}
          />
        </div>

        <nav
          style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}
        >
          {menuItems.map(({ label, icon: Icon }, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={label}
                onClick={() => setActiveIndex(index)}
                style={{
                  textAlign: "left",
                  padding: "0.55rem 0.7rem",
                  borderRadius: 14,
                  border: "none",
                  background: active ? baseBlue : "transparent",
                  color: active ? "#ffffff" : "#475569",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "background 0.18s, color 0.18s",
                  fontFamily: "'Poppins', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
                    (e.currentTarget as HTMLButtonElement).style.color = "#0f172a";
                  } else {
                    (e.currentTarget as HTMLButtonElement).style.background = hoverBlue;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = active ? baseBlue : "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = active ? "#ffffff" : "#475569";
                }}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;