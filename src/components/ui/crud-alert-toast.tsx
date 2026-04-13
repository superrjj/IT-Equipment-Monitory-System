import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type CrudToastState = { msg: string; type: "success" | "error" } | null;

type Props = {
  toast: CrudToastState;
};

/**
 * Upper-right feedback aligned with `userSubmitTicket.tsx`: Poppins, label/body sizes * and colors (12px/600 #475569 title line, 13px/500 body), white card and `.ust-modal`-style shadow/radius.
 */
export function CrudAlertToast({ toast }: Props) {
  if (!toast) return null;
  const ok = toast.type === "success";
  const titleColor = ok ? "#475569" : "#dc2626";
  const bodyColor = ok ? "#0f172a" : "#dc2626";
  const iconColor = ok ? "#0f172a" : "#dc2626";

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 20,
        right: 24,
        zIndex: 10000,
        maxWidth: "min(26rem, calc(100vw - 2rem))",
        boxShadow: "0 8px 24px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)",
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontFamily: "'Poppins', system-ui, sans-serif",
        animation: "crudToastIn 0.22s ease both",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @keyframes crudToastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <span style={{ flexShrink: 0, marginTop: 2, color: iconColor }} aria-hidden>
        {ok ? (
          <CheckCircle2 size={16} strokeWidth={2} color={iconColor} />
        ) : (
          <AlertCircle size={16} strokeWidth={2} color={iconColor} />
        )}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: titleColor,
            lineHeight: 1.35,
            marginBottom: 6,
          }}
        >
          {ok ? "Success" : "Error"}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: bodyColor,
            lineHeight: 1.45,
            wordBreak: "break-word",
          }}
        >
          {toast.msg}
        </div>
      </div>
    </div>
  );
}
