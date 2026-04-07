import React, { useEffect, useMemo, useState } from "react";
import { Ticket, Search, Eye, X, Clock, Star, MessageSquare } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const BRAND = "#0a4c86";

type TicketStatus = "Pending" | "In Progress" | "Resolved";
type TicketRow = {
  id: string;
  ticket_number?: string | null;
  title: string;
  issue_type: string;
  status: TicketStatus;
  date_submitted: string;
  action_taken: string;
  started_at: string | null;
  completed_at: string | null;
  department_id: string;
  feedback_rating?: number | null;
  feedback_comment?: string | null;
};

const statusStyle: Record<TicketStatus, { bg: string; color: string }> = {
  Pending:       { bg: "rgba(59,130,246,0.10)",  color: "#475569" },
  "In Progress": { bg: "rgba(234,179,8,0.12)",   color: "#a16207" },
  Resolved:      { bg: "rgba(22,163,74,0.10)",   color: "#15803d" },
};

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila",
      })
    : "—";

const statusSteps: TicketStatus[] = ["Pending", "In Progress", "Resolved"];
const stepIndex = (status: TicketStatus) => statusSteps.indexOf(status);

// ── Feedback modal ────────────────────────────────────────────────────────────
const FeedbackModal: React.FC<{
  ticket: TicketRow;
  onClose: () => void;
  onSaved: () => void;
}> = ({ ticket, onClose, onSaved }) => {
  const [rating, setRating]   = useState(ticket.feedback_rating ?? 0);
  const [comment, setComment] = useState(ticket.feedback_comment ?? "");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const save = async () => {
    if (rating < 1) { setErr("Please choose a star rating."); return; }
    if (comment.trim().length < 5) { setErr("Please write at least 5 characters."); return; }
    setSaving(true);

    const { error } = await supabase
      .from("ticket_feedback")
      .upsert(
        {
          report_id:     ticket.id,
          employee_name: localStorage.getItem("session_user_full_name") || "",
          department_id: ticket.department_id,
          rating,
          comment:       comment.trim(),
          submitted_at:  new Date().toISOString(),
        },
        { onConflict: "report_id" }
      );

    if (error) { setErr(error.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420,
          padding: "1.4rem 1.5rem", boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Feedback
          </div>
          <button
            type="button" onClick={onClose}
            style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>
        <h3 style={{ margin: "0 0 1rem", fontSize: 15, color: "#0f172a" }}>{ticket.title}</h3>

        {/* Stars */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
          How satisfied are you?
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n} type="button"
              onClick={() => { setRating(n); setErr(null); }}
              style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}
            >
              <Star
                size={28}
                fill={n <= rating ? "#f59e0b" : "none"}
                color={n <= rating ? "#f59e0b" : "#cbd5e1"}
                strokeWidth={n <= rating ? 0 : 2}
              />
            </button>
          ))}
          {rating > 0 && (
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, alignSelf: "center" }}>
              {rating}/5
            </span>
          )}
        </div>

        {/* Comment */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
          Comments for IT
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What went well? What could be improved?"
          maxLength={2000}
          style={{
            width: "100%", boxSizing: "border-box", borderRadius: 10,
            border: "1.5px solid #e2e8f0", background: "#f8fafc",
            padding: "0.5rem 0.75rem", fontSize: 13,
            fontFamily: "'Poppins', sans-serif", minHeight: 90,
            resize: "vertical", outline: "none",
            color: "#0f172a",
          }}
        />

        {err && (
          <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{err}</div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: "1rem", justifyContent: "flex-end" }}>
          <button
            type="button" onClick={onClose}
            style={{
              padding: "0.5rem 1rem", borderRadius: 10, border: "1.5px solid #e2e8f0",
              background: "#f8fafc", color: "#475569", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Poppins', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={() => void save()} disabled={saving}
            style={{
              padding: "0.5rem 1.1rem", borderRadius: 10, border: "none",
              background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Poppins', sans-serif",
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? "Saving…" : "Save feedback"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const MyTicketsUser: React.FC = () => {
  const [rows, setRows]           = useState<TicketRow[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<TicketRow | null>(null);
  const [fbTicket, setFbTicket]   = useState<TicketRow | null>(null);
  const [deptMap, setDeptMap]     = useState<Record<string, string>>({});

  const userId   = localStorage.getItem("session_user_id")        || "";
  const fullName = localStorage.getItem("session_user_full_name") || "";

  const fetchTickets = async () => {
    if (!userId) { setLoading(false); setRows([]); return; }
    setLoading(true);

    const { data: userData } = await supabase
      .from("user_accounts").select("department_id").eq("id", userId).single();
    const departmentId = userData?.department_id ?? "";

    const [{ data: reports, error }, { data: depts }, { data: feedbacks }] =
      await Promise.all([
        supabase
          .from("file_reports")
          .select(
            "id,ticket_number,title,issue_type,status,date_submitted," +
            "action_taken,started_at,completed_at,department_id,employee_name"
          )
          .eq("employee_name", fullName)
          .eq("department_id", departmentId)
          .order("created_at", { ascending: false }),
        supabase.from("departments").select("id,name"),
        supabase
          .from("ticket_feedback")
          .select("report_id,rating,comment")
          .eq("employee_name", fullName)
          .eq("department_id", departmentId),
      ]);

    if (!error) {
      const fbMap: Record<string, { rating: number; comment: string }> = {};
      (feedbacks ?? []).forEach(
        (f: { report_id: string; rating: number; comment: string }) => {
          fbMap[f.report_id] = { rating: f.rating, comment: f.comment };
        }
      );
      const merged = (reports ?? []).map((r: any) => ({
        ...r,
        feedback_rating:  fbMap[r.id]?.rating  ?? null,
        feedback_comment: fbMap[r.id]?.comment ?? null,
      }));
      setRows(merged as TicketRow[]);
    } else {
      setRows([]);
    }

    const nextMap: Record<string, string> = {};
    (depts ?? []).forEach((d: { id: string; name: string }) => {
      nextMap[d.id] = d.name;
    });
    setDeptMap(nextMap);
    setLoading(false);
  };

  useEffect(() => { void fetchTickets(); }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`employee_my_tickets_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" },
        () => { void fetchTickets(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_feedback" },
        () => { void fetchTickets(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.title, r.issue_type, r.status, r.ticket_number ?? ""]
        .join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .mtu-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .mtu-root input, .mtu-root button, .mtu-root h2, .mtu-root h3,
        .mtu-modal-panel { font-family: 'Poppins', sans-serif; }
        .mtu-shell { width: 100%; }
        .mtu-topbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 1rem; }
        .mtu-search-wrap { position: relative; max-width: 360px; width: 100%; }
        .mtu-ticket-card { border-radius: 14px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 1px 4px rgba(15,23,42,0.05); overflow: hidden; transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; }
        .mtu-ticket-card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15,23,42,0.08); border-color: #cbd5e1; }
        .mtu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.75rem; }
        .mtu-action-btn { border-radius: 9px; border: 1px solid #e2e8f0; background: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; padding: 0.42rem 0.65rem; font-size: 11.5px; font-weight: 600; transition: background 0.15s, border-color 0.15s; font-family: 'Poppins', sans-serif; }
        .mtu-action-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .mtu-tracker-line { position: absolute; left: 11px; top: 12px; bottom: 12px; width: 2px; background: #e2e8f0; }
        @media (max-width: 860px) { .mtu-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); } }
        @media (max-width: 640px)  { .mtu-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="mtu-root mtu-shell">
        {/* Top bar */}
        <div className="mtu-topbar">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <Ticket size={20} color={BRAND} /> My tickets
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              A history of all the requests you've filed.
            </p>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 999, padding: "0.35rem 0.7rem", fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f8fafc" }}>
            {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Card wrapper */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Search */}
          <div style={{ padding: "1.1rem 1.2rem", borderBottom: "1px solid #f1f5f9" }}>
            <div className="mtu-search-wrap">
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search my tickets..."
                style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc", padding: "0.5rem 0.75rem 0.5rem 2rem", fontSize: 13, outline: "none", color: "#0f172a" }}
              />
            </div>
          </div>

          {/* Grid */}
          <div style={{ padding: "1.1rem 1.2rem" }}>
            {loading ? (
              <div style={{ padding: "1.3rem 0.2rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                Loading tickets...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "1.3rem 0.2rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No submitted tickets found.
              </div>
            ) : (
              <div className="mtu-grid">
                {filtered.map(r => (
                  <div key={r.id} className="mtu-ticket-card">
                    {/* Card header */}
                    <div style={{
                      padding: "0.65rem 0.8rem", background: "#f8fafc",
                      borderBottom: "1px solid #eef2f7",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: BRAND, textTransform: "uppercase" }}>
                        {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      <span style={{
                        borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                        background: statusStyle[r.status].bg, color: statusStyle[r.status].color,
                      }}>
                        {r.status}
                      </span>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "0.8rem" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
                        {r.title}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 999, padding: "3px 9px" }}>
                          {r.issue_type}
                        </span>
                        <span style={{ fontSize: 11.5, color: "#64748b" }}>
                          {fmtDate(r.date_submitted)}
                        </span>
                      </div>

                      {/* Star preview if already rated */}
                      {r.feedback_rating && (
                        <div style={{ marginTop: 8, display: "flex", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star
                              key={n} size={13}
                              fill={n <= r.feedback_rating! ? "#f59e0b" : "none"}
                              color={n <= r.feedback_rating! ? "#f59e0b" : "#cbd5e1"}
                              strokeWidth={n <= r.feedback_rating! ? 0 : 2}
                            />
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {r.status !== "Resolved" ? (
                          <button
                            type="button" onClick={() => setSelected(r)}
                            className="mtu-action-btn" style={{ color: BRAND }}
                          >
                            <Eye size={13} /> Track
                          </button>
                        ) : (
                          <button
                            type="button" onClick={() => setFbTicket(r)}
                            className="mtu-action-btn"
                            style={{
                              color: BRAND,
                              borderColor: "rgba(10,76,134,0.3)",
                              background: r.feedback_rating
                                ? "rgba(10,76,134,0.08)"
                                : "rgba(10,76,134,0.04)",
                              fontWeight: 700,
                            }}
                          >
                            <MessageSquare size={13} color={BRAND} />
                            {r.feedback_rating ? "Feedback ✓" : "Feedback"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Track modal */}
        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          >
            <div
              className="mtu-modal-panel"
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.20)" }}
            >
              <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Ticket tracking
                  </div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 15 }}>{selected.title}</h3>
                </div>
                <button type="button" onClick={() => setSelected(null)} style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div><strong>Ticket #:</strong> {selected.ticket_number?.trim() || `TKT-${selected.id.slice(0, 8).toUpperCase()}`}</div>
                <div><strong>Status:</strong> {selected.status}</div>
                <div><strong>Issue type:</strong> {selected.issue_type}</div>
                <div><strong>Department:</strong> {deptMap[selected.department_id] ?? "—"}</div>
                <div><strong>Submitted:</strong> {fmtDate(selected.date_submitted)}</div>
                <div><strong>Start date:</strong> {fmtDate(selected.started_at)}</div>
                <div><strong>End date:</strong> {fmtDate(selected.completed_at)}</div>

                {/* Status tracker */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>Application Status</strong>
                  <div style={{ position: "relative", paddingLeft: 30 }}>
                    <div className="mtu-tracker-line" />
                    {statusSteps.map((step, idx) => {
                      const active    = idx <= stepIndex(selected.status);
                      const isCurrent = step === selected.status;
                      return (
                        <div key={step} style={{ position: "relative", paddingBottom: idx === statusSteps.length - 1 ? 0 : 12 }}>
                          <div style={{
                            position: "absolute", left: -30, top: 1,
                            width: 22, height: 22, borderRadius: "50%",
                            background: active ? "#10b981" : "#cbd5e1",
                            color: "#fff", fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? "#0f172a" : "#64748b" }}>
                            {step}
                          </div>
                          {isCurrent && (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                              Current stage of your ticket.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Technician update */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                  <strong style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Clock size={13} color={BRAND} /> Technician update
                  </strong>
                  <div style={{ marginTop: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", color: "#475569", lineHeight: 1.6 }}>
                    {selected.action_taken?.trim() || "No update yet."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback modal */}
        {fbTicket && (
          <FeedbackModal
            ticket={fbTicket}
            onClose={() => setFbTicket(null)}
            onSaved={() => void fetchTickets()}
          />
        )}
      </div>
    </>
  );
};

export default MyTicketsUser;