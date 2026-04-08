import React, { useEffect, useState } from "react";
import {
  Ticket,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  Cpu,
  Monitor,
  Wifi,
  ListOrdered,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShimmerKeyframes, Skeleton } from "@/components/ui/skeleton";

const BRAND = "#0a4c86";

type IssueType = "Hardware" | "Software" | "Internet";
type ProfileInfo = {
  full_name: string;
  department_id: string;
};

const ISSUE_TYPES: IssueType[] = ["Hardware", "Software", "Internet"];

const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  { icon: React.ReactNode; activeClass: string }
> = {
  Hardware: { icon: <Cpu size={14} />, activeClass: "ust-pill--hw" },
  Software: { icon: <Monitor size={14} />, activeClass: "ust-pill--sw" },
  Internet: { icon: <Wifi size={14} />, activeClass: "ust-pill--net" },
};

const UserSubmitTicket: React.FC = () => {
  const [title, setTitle] = useState("");
  const [issueType, setIssueType] = useState<IssueType>("Hardware");
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const userId = localStorage.getItem("session_user_id");
      if (!userId) {
        setError("Session missing. Please sign in again.");
        setLoadingProfile(false);
        return;
      }

      const { data, error: userErr } = await supabase
        .from("user_accounts")
        .select("full_name, department_id")
        .eq("id", userId)
        .single();

      if (userErr || !data) {
        setError("Unable to load your account details. Please try again.");
        setLoadingProfile(false);
        return;
      }

      setProfile({
        full_name: data.full_name,
        department_id: data.department_id,
      });

      if (data.department_id) {
        const { data: dept } = await supabase
          .from("departments")
          .select("name")
          .eq("id", data.department_id)
          .single();
        setDepartmentName(dept?.name ?? "");
      }

      setLoadingProfile(false);
    };

    void loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profile?.full_name || !profile.department_id) {
      setError("Your account is missing employee or department information.");
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter the issue/problem before submitting.");
      return;
    }
    if (cleanTitle.length < 5 || cleanTitle.length > 150) {
      setError("Problem must be 5 to 150 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        employee_name: profile.full_name,
        department_id: profile.department_id,
        issue_type: issueType,
        title: cleanTitle,
        status: "Pending",
        date_submitted: new Date().toISOString(),
        assigned_to: [] as string[],
      };

      const { error: insertError } = await supabase
        .from("file_reports")
        .insert(payload);

      if (insertError) throw insertError;

      setTitle("");
      setIssueType("Hardware");
      setSuccess("Your ticket has been recorded. IT will review it shortly.");
    } catch {
      setError("Something went wrong while submitting your ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 4,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    outline: "none",
    color: "#0f172a",
    background: "#f8fafc",
    boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .ust-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .ust-page {
          min-height: min(70vh, 640px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 0 0 1rem;
        }
        .ust-backdrop {
          width: 100%;
          max-width: 980px;
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(10,76,134,0.06) 0%, rgba(15,23,42,0.04) 100%);
          padding: 1rem;
          box-sizing: border-box;
        }
        .ust-modal {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 24px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04);
          overflow: hidden;
          display: flex;
          flex-wrap: wrap;
          animation: ustModalIn 0.22s ease both;
        }
        @keyframes ustModalIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ust-modal-left {
          flex: 1 1 420px;
          min-width: 0;
          padding: 1.5rem 1.6rem 1.4rem;
          border-right: 1px solid #f1f5f9;
        }
        .ust-modal-right {
          flex: 0 1 300px;
          min-width: 260px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 1.5rem 1.35rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .ust-modal-head {
          margin-bottom: 1.15rem;
        }
        .ust-modal-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.06em;
          color: ${BRAND};
          text-transform: uppercase;
        }
        .ust-modal-sub {
          font-size: 12px;
          color: #64748b;
          margin: 6px 0 0;
          line-height: 1.5;
        }
        .ust-issue-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ust-issue-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          font-size: 12px;
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          color: #64748b;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .ust-issue-pill:hover {
          border-color: #94a3b8;
          background: #f1f5f9;
        }
        .ust-pill--hw.ust-issue-pill--active {
          border-color: #0a4c86;
          background: rgba(10,76,134,0.08);
          color: #0a4c86;
        }
        .ust-pill--sw.ust-issue-pill--active {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.08);
          color: #7c3aed;
        }
        .ust-pill--net.ust-issue-pill--active {
          border-color: #0891b2;
          background: rgba(6,182,212,0.08);
          color: #0891b2;
        }
        .ust-readonly {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f1f5f9;
          font-size: 13px;
          color: #475569;
        }
        .ust-footer {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 1.15rem;
          padding-top: 1rem;
          border-top: 1px solid #f1f5f9;
          flex-wrap: wrap;
        }
        .ust-btn-secondary {
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
        }
        .ust-btn-primary {
          padding: 0.5rem 1.2rem;
          border-radius: 8px;
          border: none;
          background: ${BRAND};
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
          opacity: 1;
        }
        .ust-btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .ust-right-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          padding: 1rem;
          box-shadow: 0 2px 10px rgba(15,23,42,0.04);
        }
        .ust-right-title {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .ust-step {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 12px;
          color: #475569;
          line-height: 1.45;
        }
        .ust-step-num {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${BRAND};
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ust-tip {
          font-size: 11px;
          color: #64748b;
          line-height: 1.55;
          padding-left: 2px;
        }
        @media (max-width: 860px) {
          .ust-modal-left {
            border-right: none;
            border-bottom: 1px solid #f1f5f9;
          }
          .ust-modal-right {
            flex: 1 1 100%;
            min-width: 0;
          }
        }
      `}</style>

      <div className="ust-root">
        {loadingProfile ? (
          <>
            <ShimmerKeyframes />
            <div className="ust-page">
              <div className="ust-backdrop">
                <div className="ust-modal">
                  <div className="ust-modal-left">
                    <div className="ust-modal-head">
                      <Skeleton width={200} height={16} radius={6} />
                      <Skeleton width="100%" height={12} radius={4} style={{ marginTop: 10 }} />
                      <Skeleton width="88%" height={12} radius={4} style={{ marginTop: 8 }} />
                    </div>
                    <div style={{ marginBottom: "0.85rem" }}>
                      <Skeleton width={72} height={12} radius={4} style={{ marginBottom: 8 }} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Skeleton width={108} height={38} radius={999} />
                        <Skeleton width={108} height={38} radius={999} />
                        <Skeleton width={108} height={38} radius={999} />
                      </div>
                    </div>
                    <div style={{ marginBottom: "0.85rem" }}>
                      <Skeleton width={64} height={12} radius={4} style={{ marginBottom: 8 }} />
                      <Skeleton width="100%" height={40} radius={8} />
                      <Skeleton width={48} height={10} radius={4} style={{ marginTop: 8, marginLeft: "auto" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.9rem" }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <Skeleton width={96} height={12} radius={4} style={{ marginBottom: 8 }} />
                        <Skeleton width="100%" height={40} radius={8} />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <Skeleton width={120} height={12} radius={4} style={{ marginBottom: 8 }} />
                        <Skeleton width="100%" height={40} radius={8} />
                      </div>
                    </div>
                    <div className="ust-footer">
                      <Skeleton width={72} height={36} radius={8} />
                      <Skeleton width={110} height={36} radius={8} />
                    </div>
                  </div>
                  <aside className="ust-modal-right" aria-hidden>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Skeleton width={36} height={36} radius={12} />
                      <div>
                        <Skeleton width={100} height={14} radius={4} style={{ marginBottom: 6 }} />
                        <Skeleton width={72} height={11} radius={4} />
                      </div>
                    </div>
                    <div className="ust-right-card">
                      <Skeleton width={140} height={13} radius={4} style={{ marginBottom: 12 }} />
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                          <Skeleton width={22} height={22} radius={11} />
                          <Skeleton width="100%" height={36} radius={4} />
                        </div>
                      ))}
                    </div>
                    <div className="ust-right-card">
                      <Skeleton width={160} height={13} radius={4} style={{ marginBottom: 10 }} />
                      <Skeleton width="100%" height={40} radius={8} />
                    </div>
                    <Skeleton width="100%" height={72} radius={12} />
                  </aside>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {error && (
              <div style={{ marginBottom: "0.75rem", maxWidth: "28rem" }}>
                <Alert variant="destructive">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            {success && (
              <div style={{ marginBottom: "0.75rem", maxWidth: "28rem" }}>
                <Alert>
                  <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="ust-page">
              <div className="ust-backdrop">
                <div className="ust-modal">
              <div className="ust-modal-left">
                <div className="ust-modal-head">
                  <h2 className="ust-modal-title">Submit New Ticket</h2>
                  <p className="ust-modal-sub">
                    Same flow as IT admin — pick issue type, describe the problem. Your name and
                    office are filled from your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: "0.85rem" }}>
                    <label style={labelStyle}>
                      Issue type <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <div className="ust-issue-pills">
                      {ISSUE_TYPES.map(type => {
                        const cfg = ISSUE_TYPE_CONFIG[type];
                        const active = issueType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            className={`ust-issue-pill ${cfg.activeClass}${active ? " ust-issue-pill--active" : ""}`}
                            onClick={() => setIssueType(type)}
                            disabled={submitting}
                          >
                            {cfg.icon}
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.85rem" }}>
                    <label style={labelStyle}>
                      Problem <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      maxLength={150}
                      disabled={submitting}
                      style={{
                        ...inputStyle,
                        borderColor: error && error.includes("Problem") ? "#fca5a5" : "#e2e8f0",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{title.length}/150</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0 0.9rem",
                    }}
                  >
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Employee name</label>
                      <div className="ust-readonly">
                        <User size={14} color={BRAND} />
                        {profile?.full_name || "—"}
                      </div>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>Department / Office</label>
                      <div className="ust-readonly">
                        <Building2 size={14} color={BRAND} />
                        {departmentName || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="ust-footer">
                    <button
                      type="button"
                      className="ust-btn-secondary"
                      onClick={() => {
                        setTitle("");
                        setIssueType("Hardware");
                        setError(null);
                        setSuccess(null);
                      }}
                      disabled={submitting}
                    >
                      Clear
                    </button>
                    <button type="submit" className="ust-btn-primary" disabled={submitting}>
                      {submitting ? "Saving…" : "Submit Ticket"}
                    </button>
                  </div>
                </form>
              </div>

              <aside className="ust-modal-right" aria-label="Help and next steps">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: `${BRAND}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: BRAND,
                    }}
                  >
                    <Ticket size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                      IT Helpdesk
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>City Government</div>
                  </div>
                </div>

                <div className="ust-right-card">
                  <div className="ust-right-title">
                    <ListOrdered size={15} color={BRAND} />
                    What happens next
                  </div>
                  <div className="ust-step">
                    <span className="ust-step-num">1</span>
                    <span>
                      Your request is <strong>queued</strong> as <em>Pending</em>. You’ll get a
                      ticket number after submit.
                    </span>
                  </div>
                  <div className="ust-step">
                    <span className="ust-step-num">2</span>
                    <span>
                      IT may set the ticket to <strong>In Progress</strong> and add notes in{" "}
                      <em>Technician update</em>.
                    </span>
                  </div>
                  <div className="ust-step" style={{ marginBottom: 0 }}>
                    <span className="ust-step-num">3</span>
                    <span>
                      When resolved, status becomes <strong>Resolved</strong>. Track everything
                      under <em>My tickets</em>.
                    </span>
                  </div>
                </div>

                <div className="ust-right-card">
                  <div className="ust-right-title">
                    <Lightbulb size={15} color="#d97706" />
                    Tips for faster help
                  </div>
                  <p className="ust-tip">
                    Include the exact error text, when it started, and what you already tried
                    (restart, another PC, etc.).
                  </p>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    padding: "0.75rem",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(10,76,134,0.08) 0%, rgba(11,95,165,0.06) 100%)",
                    border: `1px solid ${BRAND}22`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={18} color={BRAND} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.55 }}>
                    <strong style={{ color: "#0f172a" }}>Privacy</strong>
                    <br />
                    Only use this form for official work issues. Do not share passwords in the
                    description — IT will contact you securely if needed.
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </>
  );
};

export default UserSubmitTicket;
