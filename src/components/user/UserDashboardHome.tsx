import React, { useEffect, useState } from "react";
import { Ticket, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { ShimmerKeyframes, Skeleton } from "@/components/ui/skeleton";

const BRAND = "#0D518C";

type Props = {
  onNavigateSubmit: () => void;
  onNavigateMyTickets: () => void;
};

type TicketStatus = "Pending" | "In Progress" | "Resolved";
type RecentTicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: TicketStatus;
  date_submitted: string;
};

const UserDashboardHome: React.FC<Props> = ({
  onNavigateSubmit,
  onNavigateMyTickets,
}) => {
  const fullName = localStorage.getItem("session_user_full_name") || "Employee";
  const userId = localStorage.getItem("session_user_id") || "";
  const nowPH = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  const phHour = nowPH.getHours();
  const greeting =
    phHour < 12 ? "Good Morning" : phHour < 18 ? "Good Afternoon" : "Good Evening";

  const [openCount, setOpenCount] = useState<number | null>(null);
  const [awaitingCount, setAwaitingCount] = useState<number | null>(null);
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);
  const [departmentName, setDepartmentName] = useState<string>("");
  const [recent, setRecent] = useState<RecentTicketRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setOpenCount(0);
        setAwaitingCount(0);
        setResolvedCount(0);
        setDepartmentName("");
        setRecent([]);
        return;
      }
      const { data: userData, error: userErr } = await supabase
        .from("user_accounts")
        .select("department_id")
        .eq("id", userId)
        .single();
      if (userErr) {
        if (!cancelled) {
          setOpenCount(0);
          setAwaitingCount(0);
          setResolvedCount(0);
          setDepartmentName("");
          setRecent([]);
        }
        return;
      }
      const departmentId = userData?.department_id ?? "";
      if (!departmentId) {
        if (!cancelled) {
          setOpenCount(0);
          setAwaitingCount(0);
          setResolvedCount(0);
          setDepartmentName("");
          setRecent([]);
        }
        return;
      }

      const [{ data: rows, error }, { data: deptData }, { data: recentRows }] =
        await Promise.all([
          supabase
            .from("file_reports")
            .select("status")
            .eq("employee_name", fullName)
            .eq("department_id", departmentId),
          supabase.from("departments").select("name").eq("id", departmentId).single(),
          supabase
            .from("file_reports")
            .select("id, ticket_number, title, status, date_submitted")
            .eq("employee_name", fullName)
            .eq("department_id", departmentId)
            .order("date_submitted", { ascending: false })
            .limit(5),
        ]);

      if (cancelled) return;
      if (error || !rows) {
        setOpenCount(0);
        setAwaitingCount(0);
        setResolvedCount(0);
        setDepartmentName(deptData?.name ?? "");
        setRecent((recentRows as RecentTicketRow[] | null) ?? []);
        return;
      }

      let open = 0;
      let awaiting = 0;
      let resolved = 0;
      for (const r of rows as { status: TicketStatus }[]) {
        const s = r.status;
        if (s === "Pending") awaiting += 1;
        else if (s === "In Progress") open += 1;
        else if (s === "Resolved") resolved += 1;
      }
      setOpenCount(open);
      setAwaitingCount(awaiting);
      setResolvedCount(resolved);
      setDepartmentName(deptData?.name ?? "");
      setRecent((recentRows as RecentTicketRow[] | null) ?? []);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, fullName]);

  const fmt = (n: number | null) => (n === null ? "—" : String(n));
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    });

  const kpiLoading = openCount === null;

  if (kpiLoading) {
    return (
      <>
        <ShimmerKeyframes />
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .udh-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .udh-root, .udh-root * { font-family: 'Poppins', sans-serif !important; }
        .udh-grid-kpi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; }
        .udh-kpi-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1rem 1.1rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(15,23,42,0.05);
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .udh-section {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          padding: 1.1rem 1.2rem;
          box-shadow: 0 1px 4px rgba(15,23,42,0.04);
        }
        .udh-skel-quick {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }
        .udh-skel-recent { display: flex; flex-direction: column; gap: 10px; }
        @media (max-width: 960px) {
          .udh-grid-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .udh-grid-kpi { grid-template-columns: minmax(0,1fr); }
          .udh-skel-quick { grid-template-columns: minmax(0,1fr); }
        }
      `}</style>
        <div className="udh-root">
          <div style={{ marginBottom: "1rem" }}>
            <Skeleton width={280} height={22} radius={8} />
            <Skeleton width={320} height={13} radius={4} style={{ marginTop: 10 }} />
          </div>
          <div className="udh-grid-kpi" style={{ marginBottom: "1rem" }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="udh-kpi-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Skeleton width={30} height={30} radius={9} />
                </div>
                <Skeleton width="45%" height={26} radius={6} />
                <Skeleton width="55%" height={10} radius={4} />
                <Skeleton width="85%" height={10} radius={4} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "0.9rem", marginBottom: "0.8rem" }}>
            <div className="udh-section">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Skeleton width={30} height={30} radius={9} />
                <Skeleton width={120} height={14} radius={5} />
              </div>
              <Skeleton width="70%" height={11} radius={4} style={{ marginBottom: 12 }} />
              <div className="udh-skel-quick">
                <Skeleton width="100%" height={56} radius={14} />
                <Skeleton width="100%" height={56} radius={14} />
              </div>
            </div>
            <div className="udh-section">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Skeleton width={30} height={30} radius={9} />
                <Skeleton width={140} height={14} radius={5} />
              </div>
              <div className="udh-skel-recent">
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <Skeleton width="90%" height={12} radius={4} style={{ marginBottom: 6 }} />
                      <Skeleton width="55%" height={10} radius={4} />
                    </div>
                    <Skeleton width={78} height={22} radius={999} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="udh-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <Skeleton width={200} height={14} radius={5} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={10} radius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={10} radius={4} />
              </div>
              <Skeleton width={130} height={34} radius={999} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .udh-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .udh-root, .udh-root * { font-family: 'Poppins', sans-serif !important; }
        .udh-grid-kpi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; }
        .udh-kpi-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 1rem 1.1rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(15,23,42,0.05);
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
          font-variant-numeric: tabular-nums;
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
          box-shadow: 0 1px 4px rgba(15,23,42,0.04);
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
          box-shadow: 0 4px 14px rgba(15,23,42,0.08);
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
        .udh-recent-item {
          width: 100%;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 0.75rem 0.8rem;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.12s;
          text-align: left;
        }
        .udh-recent-item:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          box-shadow: 0 4px 14px rgba(15,23,42,0.06);
          transform: translateY(-1px);
        }
        .udh-recent-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.25;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .udh-recent-meta {
          margin-top: 4px;
          font-size: 11px;
          color: #64748b;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .udh-badge {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
        }
        .udh-badge.pending { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.28); color: #92400e; }
        .udh-badge.progress { background: rgba(59,130,246,0.10); border-color: rgba(59,130,246,0.22); color: #1d4ed8; }
        .udh-badge.resolved { background: rgba(22,163,74,0.10); border-color: rgba(22,163,74,0.20); color: #15803d; }
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
            {greeting},{" "}
            <span style={{ color: BRAND }}>{fullName}</span>
          </div>
          <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
            This is your home page for IT support requests{departmentName ? ` — ${departmentName}` : ""}.
          </p>
        </div>

        <div className="udh-grid-kpi" style={{ marginBottom: "1rem" }}>
          <div className="udh-kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${BRAND}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ticket size={15} color={BRAND} />
              </div>
            </div>
            <div className="udh-kpi-value">{fmt(openCount)}</div>
            <div className="udh-kpi-label">In progress</div>
            <div className="udh-kpi-sub">Currently being handled by IT</div>
          </div>
          <div className="udh-kpi-card">
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "#f59e0b15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={15} color="#b45309" />
            </div>
            <div className="udh-kpi-value">{fmt(awaitingCount)}</div>
            <div className="udh-kpi-label">Pending</div>
            <div className="udh-kpi-sub">Waiting in the queue for assignment</div>
          </div>
          <div className="udh-kpi-card">
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "#16a34a15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={15} color="#15803d" />
            </div>
            <div className="udh-kpi-value">{fmt(resolvedCount)}</div>
            <div className="udh-kpi-label">Resolved</div>
            <div className="udh-kpi-sub">Completed requests</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "0.9rem", marginBottom: "0.8rem" }}>
          <div className="udh-section">
            <div className="udh-section-title">
              <Ticket size={16} color={BRAND} />
              What would you like to do?
            </div>
            <div className="udh-section-sub">
              Common actions for employees.
            </div>
            <div className="udh-quick-row" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <button type="button" className="udh-quick" onClick={onNavigateSubmit}>
                <span className="udh-quick-label" style={{color: BRAND}}>Submit a new ticket</span>
                <span className="udh-quick-desc">Report a problem or request assistance.</span>
              </button>
              <button type="button" className="udh-quick" onClick={onNavigateMyTickets}>
                <span className="udh-quick-label"style={{color: BRAND}}>View my tickets</span>
                <span className="udh-quick-desc">Track status, notes, and resolution.</span>
              </button>
            </div>
          </div>

          <div className="udh-section">
            <div className="udh-section-title">
              <Clock size={16} color={BRAND} />
              Recent requests
            </div>
            <div className="udh-section-sub">
              Your latest submitted tickets.
            </div>
            {recent.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "0.35rem 0" }}>
                No tickets yet. You can submit one anytime.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recent.slice(0, 3).map(t => {
                  const badgeClass =
                    t.status === "Pending"
                      ? "pending"
                      : t.status === "In Progress"
                        ? "progress"
                        : "resolved";
                  const ticketNo = t.ticket_number?.trim() || `TKT-${t.id.slice(0, 8).toUpperCase()}`;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="udh-recent-item"
                      onClick={onNavigateMyTickets}
                      title="Open My Tickets"
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="udh-recent-title">{t.title}</div>
                        <div className="udh-recent-meta">
                          <span style={{ fontWeight: 700, color: BRAND }}>{ticketNo}</span>
                          <span>{fmtDate(t.date_submitted)}</span>
                        </div>
                      </div>
                      <span className={`udh-badge ${badgeClass}`}>{t.status}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onNavigateMyTickets}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    padding: "0.55rem 0.75rem",
                    fontSize: 12,
                    fontWeight: 700,
                    color: BRAND,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                >
                  View all tickets
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="udh-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div className="udh-section-title" style={{ marginBottom: 2 }}>
                Before submitting again
              </div>
              <div className="udh-section-sub" style={{ marginBottom: 0 }}>
                Check <strong>My Tickets</strong> first to see technician updates and avoid duplicate requests for the same issue.
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
