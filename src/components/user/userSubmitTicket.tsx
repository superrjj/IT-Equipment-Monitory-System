import React, { useState } from "react";
import { Ticket, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";

const BRAND = "#0a4c86";

type Priority = "Low" | "Medium" | "High" | "Critical";

const priorities: { value: Priority; label: string; desc: string }[] = [
  { value: "Low",      label: "Low",      desc: "Minor inconvenience" },
  { value: "Medium",   label: "Medium",   desc: "Work slowed down" },
  { value: "High",     label: "High",     desc: "Unable to continue work" },
  { value: "Critical", label: "Critical", desc: "Urgent / affects many users" },
];

const UserSubmitTicket: React.FC = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !category.trim() || !details.trim()) {
      setError("Please fill in the required fields before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      // Backend wiring will be added later.
      await new Promise(resolve => setTimeout(resolve, 750));

      setTitle("");
      setCategory("");
      setPriority("Medium");
      setDetails("");
      setFiles(null);
      setSuccess("Your ticket has been recorded. IT will review it shortly.");
    } catch {
      setError("Something went wrong while submitting your ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .ust-root { font-family: 'Poppins', sans-serif; color: #0f172a; }
        .ust-label {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }
        .ust-required { color: #ef4444; margin-left: 2px; }
        .ust-input, .ust-textarea, .ust-select {
          width: 100%;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.6rem 0.75rem;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .ust-input:focus,
        .ust-textarea:focus,
        .ust-select:focus {
          border-color: ${BRAND};
          background: #ffffff;
          box-shadow: 0 0 0 3px ${BRAND}1f;
        }
        .ust-textarea {
          resize: vertical;
          min-height: 120px;
          line-height: 1.5;
        }
        .ust-priority-pill {
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          padding: 0.45rem 0.7rem;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          cursor: pointer;
          background: #ffffff;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .ust-priority-pill span {
          font-weight: 600;
        }
        .ust-priority-pill small {
          color: #6b7280;
        }
        .ust-priority-pill--active {
          border-color: ${BRAND};
          background: #eff6ff;
          box-shadow: 0 4px 14px rgba(15,23,42,0.08);
        }
      `}</style>

      <div className="ust-root">
        <div style={{ marginBottom: "1rem" }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: 0,
            }}
          >
            <Ticket size={20} color={BRAND} />
            Submit a ticket
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Tell us what&apos;s going on so IT can help you as quickly as possible.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "0.75rem",
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              padding: "0.55rem 0.75rem",
              fontSize: 12,
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: "0.75rem",
              borderRadius: 10,
              border: "1px solid #bbf7d0",
              background: "#dcfce7",
              padding: "0.55rem 0.75rem",
              fontSize: 12,
              color: "#166534",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} />
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            background: "#ffffff",
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            padding: "1rem 1.1rem 1.1rem",
            boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "0.8rem",
          }}
        >
          {/* Title */}
          <div>
            <label className="ust-label">
              Short title
              <span className="ust-required">*</span>
            </label>
            <input
              className="ust-input"
              type="text"
              placeholder="Example: Computer cannot connect to Wi‑Fi"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Category & priority */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.2fr)",
              gap: "0.8rem",
            }}
          >
            <div>
              <label className="ust-label">
                Category
                <span className="ust-required">*</span>
              </label>
              <select
                className="ust-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={submitting}
              >
                <option value="">Select a category…</option>
                <option value="Hardware">Hardware (desktop, laptop, printer, etc.)</option>
                <option value="Software">Software / application issue</option>
                <option value="Network">Network / Internet / Wi‑Fi</option>
                <option value="Account">Account / login / password</option>
                <option value="Request">Access / installation request</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="ust-label">Priority</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={
                      "ust-priority-pill" +
                      (priority === p.value ? " ust-priority-pill--active" : "")
                    }
                    onClick={() => setPriority(p.value)}
                    disabled={submitting}
                  >
                    <span>{p.label}</span>
                    <small>{p.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="ust-label">
              Details
              <span className="ust-required">*</span>
            </label>
            <textarea
              className="ust-textarea"
              placeholder="Describe the problem or request. Include any steps you already tried, specific error messages, or when it started."
              value={details}
              onChange={e => setDetails(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="ust-label">Attachments (optional)</label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 12,
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                padding: "0.6rem 0.75rem",
                fontSize: 12,
                color: "#64748b",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <Upload size={16} color={BRAND} />
              <span>
                Drag and drop screenshots or click to choose files (max 3, JPG/PNG/PDF).
              </span>
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.pdf"
                style={{ display: "none" }}
                onChange={e => setFiles(e.target.files)}
                disabled={submitting}
              />
            </label>
            {files && files.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                {Array.from(files)
                  .slice(0, 3)
                  .map(f => f.name)
                  .join(", ")}
                {files.length > 3 && ` (+${files.length - 3} more)`}
              </div>
            )}
          </div>

          {/* Submit */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "0.4rem",
            }}
          >
            <button
              type="submit"
              disabled={submitting}
              style={{
                borderRadius: 999,
                border: "none",
                background: `linear-gradient(120deg, ${BRAND}, #0b5fa5)`,
                color: "#ffffff",
                padding: "0.6rem 1.4rem",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: submitting ? "not-allowed" : "pointer",
                boxShadow: "0 10px 26px rgba(15,23,42,0.30)",
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Submit ticket"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default UserSubmitTicket;

