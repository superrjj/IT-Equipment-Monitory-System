import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

export type CrudToastState = { msg: string; type: "success" | "error" } | null;

type Props = {
  toast: CrudToastState;
  /** Default matches most admin pages; profile modal previously used bottom-right. */
  placement?: "top" | "bottom";
};

export function CrudAlertToast({ toast, placement = "top" }: Props) {
  if (!toast) return null;
  const ok = toast.type === "success";
  const pos: React.CSSProperties =
    placement === "bottom"
      ? { position: "fixed", bottom: 24, right: 24, zIndex: 1600 }
      : { position: "fixed", top: 20, right: 24, zIndex: 9999 };

  return (
    <div
      style={{
        ...pos,
        maxWidth: "min(28rem, calc(100vw - 2rem))",
        boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
        animation: "crudToastIn 0.22s ease both",
      }}
    >
      <style>{`
        @keyframes crudToastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Alert variant={ok ? "default" : "destructive"}>
        {ok ? (
          <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
        ) : (
          <AlertCircle size={16} strokeWidth={2} aria-hidden />
        )}
        <AlertTitle>{ok ? "Success" : "Error"}</AlertTitle>
        <AlertDescription>{toast.msg}</AlertDescription>
      </Alert>
    </div>
  );
}
