import React from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  accent?: "blue" | "red" | "yellow" | "green";
};

const accentColorMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "#1a2e4a",
  red: "#dc2626",
  yellow: "#ca8a04",
  green: "#16a34a",
};

const cardShadow =
  "0 18px 45px rgba(15,23,42,0.20), 0 1px 4px rgba(15,23,42,0.18)";

const StatCard: React.FC<StatCardProps> = ({ label, value, accent = "blue" }) => {
  const color = accentColorMap[accent];

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1.25rem 1.4rem",
        boxShadow: cardShadow,
        border: "1px solid rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
      }}
    >
      <span
        style={{
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#64748b",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f4f5fb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 230,
          background: "#0f172a",
          color: "#e5e7eb",
          padding: "1.4rem 1.4rem 1.6rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, #38bdf8, #6366f1, #a855f7, #f97316)",
              marginBottom: 10,
            }}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            IT Monitoring
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 2,
            }}
          >
            Tarlac City Hall
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 13,
          }}
        >
          {[
            "Dashboard",
            "Equipment",
            "Departments",
            "Defective Reports",
            "Repairs",
            "Repair History",
            "Reports",
          ].map((item, index) => {
            const active = index === 0;
            return (
              <button
                key={item}
                style={{
                  textAlign: "left",
                  padding: "0.55rem 0.7rem",
                  borderRadius: 14,
                  border: "none",
                  background: active ? "#e5f2ff" : "transparent",
                  color: active ? "#0f172a" : "#cbd5f5",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {item}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div
        style={{
          flex: 1,
          padding: "1.4rem 1.8rem 1.8rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                marginBottom: 2,
              }}
            >
              Overview
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              IT equipment status and recent repair activity.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.9rem",
            }}
          >
            <button
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: "#ffffff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Today
            </button>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, #6366f1, #22c55e, #f97316)",
              }}
            />
          </div>
        </header>

        {/* Content grid */}
        <main
          style={{
            display: "grid",
            gridTemplateColumns: "2.1fr 1.2fr",
            gap: "1.2rem",
          }}
        >
          {/* Left column: stats + tables */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.2rem",
            }}
          >
            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "0.9rem",
              }}
            >
              <StatCard label="Total equipment" value={120} accent="blue" />
              <StatCard label="Defective devices" value={8} accent="red" />
              <StatCard label="Under repair" value={5} accent="yellow" />
              <StatCard label="Active equipment" value={107} accent="green" />
            </div>

            {/* Equipment per department */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 18,
                padding: "1.2rem 1.3rem",
                boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.8rem",
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Equipment per department
                </h2>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <th
                      style={{
                        padding: "0.55rem 0.35rem 0.55rem 0",
                        fontWeight: 500,
                        color: "#6b7280",
                      }}
                    >
                      Department
                    </th>
                    <th
                      style={{
                        padding: "0.55rem 0.35rem",
                        fontWeight: 500,
                        color: "#6b7280",
                      }}
                    >
                      Total
                    </th>
                    <th
                      style={{
                        padding: "0.55rem 0.35rem",
                        fontWeight: 500,
                        color: "#6b7280",
                      }}
                    >
                      Defective
                    </th>
                    <th
                      style={{
                        padding: "0.55rem 0 0.55rem 0.35rem",
                        fontWeight: 500,
                        color: "#6b7280",
                      }}
                    >
                      Under repair
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "IT Department", total: 40, defective: 3, repair: 2 },
                    { name: "HR Department", total: 18, defective: 1, repair: 0 },
                    { name: "Accounting", total: 22, defective: 2, repair: 1 },
                    { name: "Admin Office", total: 24, defective: 2, repair: 2 },
                  ].map((row) => (
                    <tr
                      key={row.name}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <td
                        style={{
                          padding: "0.55rem 0.35rem 0.55rem 0",
                          fontWeight: 500,
                        }}
                      >
                        {row.name}
                      </td>
                      <td style={{ padding: "0.55rem 0.35rem" }}>{row.total}</td>
                      <td
                        style={{
                          padding: "0.55rem 0.35rem",
                          color: "#f97316",
                          fontWeight: 500,
                        }}
                      >
                        {row.defective}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0 0.55rem 0.35rem",
                          color: "#eab308",
                          fontWeight: 500,
                        }}
                      >
                        {row.repair}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right column: summary cards + recent repairs */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.2rem",
            }}
          >
            {/* Small summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.9rem",
              }}
            >
              <div
                style={{
                  background: "#3b82f6",
                  borderRadius: 18,
                  padding: "1rem 1.1rem",
                  color: "#eff6ff",
                  boxShadow: "0 18px 40px rgba(37,99,235,0.35)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  Weather
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  29°C
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>Mostly sunny</div>
              </div>

              <div
                style={{
                  background: "#f97316",
                  borderRadius: 18,
                  padding: "1rem 1.1rem",
                  color: "#fff7ed",
                  boxShadow: "0 18px 40px rgba(249,115,22,0.35)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  Support
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  IT Help Desk
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Local 101 / it-support@tarlac.gov
                </div>
              </div>
            </div>

            {/* Recent repair activities */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 18,
                padding: "1.2rem 1.3rem",
                boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.8rem",
                }}
              >
                <h2
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Recent repair activities
                </h2>
              </div>

              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {[
                  {
                    equipment: "Printer – Admin Office",
                    detail: "Paper jam cleared, test print OK",
                    status: "Fixed",
                    date: "Mar 10",
                  },
                  {
                    equipment: "CPU – IT Dept",
                    detail: "Power supply replacement ongoing",
                    status: "Under Repair",
                    date: "Mar 09",
                  },
                  {
                    equipment: "Monitor – HR",
                    detail: "Intermittent flicker reported",
                    status: "Pending",
                    date: "Mar 09",
                  },
                  {
                    equipment: "Printer – Accounting",
                    detail: "Scheduled maintenance completed",
                    status: "Fixed",
                    date: "Mar 08",
                  },
                ].map((item) => (
                  <li
                    key={item.equipment + item.date}
                    style={{
                      padding: "0.65rem 0.7rem",
                      borderRadius: 12,
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {item.equipment}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                        }}
                      >
                        {item.date}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                      }}
                    >
                      {item.detail}
                    </span>
                    <span
                      style={{
                        marginTop: 4,
                        alignSelf: "flex-start",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background:
                          item.status === "Fixed"
                            ? "rgba(22,163,74,0.12)"
                            : item.status === "Under Repair"
                            ? "rgba(234,179,8,0.12)"
                            : "rgba(248,113,113,0.12)",
                        color:
                          item.status === "Fixed"
                            ? "#15803d"
                            : item.status === "Under Repair"
                            ? "#a16207"
                            : "#b91c1c",
                      }}
                    >
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

