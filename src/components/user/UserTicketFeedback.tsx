import React, { useEffect, useMemo, useState } from "react";
import {
  MessageSquare, Star, Send, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";
import { supabase } from "../../lib/supabaseClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BRAND = "#0a4c86";

type Row = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: string;
  feedback_rating: number | null;
  feedback_comment: string | null;
};

const UserTicketFeedback: React.FC = () => {
  const userId = getSessionUserId() || "";
  const fullName = localStorage.getItem("session_user_full_name") || "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketId, setTicketId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!userId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data: userData } = await supabase
      .from("user_accounts").select("department_id").eq("id", userId).single();
    const departmentId = userData?.department_id ?? "";
    const { data, error: qErr } = await supabase
      .from("file_reports")
      .select("id,ticket_number,title,status,feedback_rating,feedback_comment")
      .eq("employee_name", fullName)
      .eq("department_id", departmentId)
      .eq("status", "Resolved")           // ← only Resolved
      .order("created_at", { ascending: false });
    if (!qErr) setRows((data ?? []) as Row[]);
    else setRows([]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId, fullName]);

  const selected = useMemo(() => rows.find(r => r.id === ticketId) ?? null, [rows, ticketId]);

  // Pre-fill if already rated
  useEffect(() => {
    if (selected) {
      setRating(selected.feedback_rating ?? 0);
      setComment(selected.feedback_comment ?? "");
    } else {
      setRating(0);
      setComment("");
    }
  }, [selected]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!userId || !selected) { setError("Pick a ticket to rate."); return; }
    if (rating < 1 || rating > 5) { setError("Choose a star rating from 1 to 5."); return; }
    const note = comment.trim();
    if (note.length < 5) { setError("Please write at least 5 characters."); return; }
    setSubmitting(true);

    const { error: updErr } = await supabase
      .from("file_reports")
      .update({
        feedback_rating: rating,
        feedback_comment: note,
        feedback_submitted_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (updErr) {
      setError(updErr.message || "Could not save feedback.");
      setSubmitting(false);
      return;
    }
    setSuccess("Thank you — your feedback was saved!");
    setTicketId("");
    setRating(0);
    setComment("");
    setSubmitting(false);
    void load();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .utf-root { font-family: 'Poppins', sans-serif; color: #0f172a; width: 100%; }
        .utf-card {
          background: #fff; border-radius: 18px; border: 1px solid #e2e8f0;
          padding: 1.15rem 1.25rem; box-shadow: 0 1px 4px rgba(15,23,42,0.05); max-width: 520px;
        }
        .utf-label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block; }
        .utf-select, .utf-textarea {
          width: 100%; box-sizing: border-box; border-radius: 10px; border: 1.5px solid #e2e8f0;
          background: #f8fafc; padding: 0.5rem 0.75rem; font-size: 13px;
          font-family: 'Poppins', sans-serif; outline: none; color: #0f172a;
        }
        .utf-textarea { min-height: 100px; resize: vertical; }
        .utf-btn {
          display: inline-flex; align-items: center; gap: 8px; padding: 0.55rem 1.15rem;
          border-radius: 12px; border: none; background: ${BRAND}; color: #fff;
          font-size: 13px; font-weight: 600; font-family: 'Poppins', sans-serif; cursor: pointer;
        }
        .utf-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .utf-stars { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .utf-star-btn { border: none; background: none; cursor: pointer; padding: 4px; line-height: 0; border-radius: 8px; transition: background 0.15s; }
        .utf-star-btn:hover { background: #f1f5f9; }
        .utf-already-rated {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; color: #15803d;
          background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.2);
          border-radius: 999px; padding: 2px 10px; margin-left: 8px;
        }
      `}</style>

      <div className="utf-root">
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <MessageSquare size={20} color={BRAND} />
            Feedback
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 520 }}>
            Rate how IT handled your resolved tickets. Your comments help improve service.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "0.75rem", maxWidth: 520 }}>
            <Alert variant="destructive">
              <AlertCircle size={16} aria-hidden />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}
        {success && (
          <div style={{ marginBottom: "0.75rem", maxWidth: 520 }}>
            <Alert>
              <CheckCircle2 size={16} aria-hidden />
              <AlertTitle>Sent</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          </div>
        )}

        <form className="utf-card" onSubmit={e => void submit(e)}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: "spin 0.9s linear infinite" }} />
              Loading your tickets…
            </div>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              No resolved tickets yet. Feedback is available once IT marks your ticket as Resolved.
            </p>
          ) : (
            <>
              <label className="utf-label" htmlFor="utf-ticket">Ticket</label>
              <select
                id="utf-ticket"
                className="utf-select"
                value={ticketId}
                onChange={e => { setTicketId(e.target.value); setError(null); setSuccess(null); }}
              >
                <option value="">Select a resolved ticket…</option>
                {rows.map(r => (
                  <option key={r.id} value={r.id}>
                    {(r.ticket_number?.trim() || r.id.slice(0, 8)) + " — " + r.title.slice(0, 55)}
                    {r.title.length > 55 ? "…" : ""}
                    {r.feedback_rating ? ` ★ ${r.feedback_rating}/5` : ""}
                  </option>
                ))}
              </select>

              {selected?.feedback_rating && (
                <div style={{ marginTop: 8 }}>
                  <span className="utf-already-rated">
                    <CheckCircle2 size={12} /> Already rated {selected.feedback_rating}/5 — you can update it
                  </span>
                </div>
              )}

              <div style={{ marginTop: "1rem" }}>
                <span className="utf-label">How satisfied are you with the resolution?</span>
                <div className="utf-stars" role="group" aria-label="Rating 1 to 5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n} type="button" className="utf-star-btn"
                      onClick={() => { setRating(n); setError(null); }}
                      aria-pressed={rating === n}
                      title={`${n} star${n === 1 ? "" : "s"}`}
                    >
                      <Star
                        size={26}
                        fill={n <= rating ? "#f59e0b" : "none"}
                        color={n <= rating ? "#f59e0b" : "#cbd5e1"}
                        strokeWidth={n <= rating ? 0 : 2}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{rating} / 5</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <label className="utf-label" htmlFor="utf-comment">Comments for IT</label>
                <textarea
                  id="utf-comment"
                  className="utf-textarea"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="What went well? What could be improved?"
                  maxLength={2000}
                />
              </div>

              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="utf-btn" disabled={submitting || !ticketId}>
                  {submitting ? (
                    <><Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} />Saving…</>
                  ) : (
                    <><Send size={15} />Save feedback</>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

export default UserTicketFeedback;