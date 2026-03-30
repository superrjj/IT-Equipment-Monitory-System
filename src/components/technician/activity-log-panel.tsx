import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ScrollText, Loader } from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const BRAND = "#0a4c86";

type Row = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string | null } | null;
  ticket?: { ticket_number: string | null } | null;
};

type Props = { isAdmin: boolean };

const ActivityLogPanel: React.FC<Props> = ({ isAdmin }) => {
  const userId = getSessionUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const prettyAction = (action: string) => {
    const map: Record<string, string> = {
      ticket_created: "Opened a ticket",
      ticket_updated: "Updated a ticket",
      ticket_technician_update: "Updated ticket progress",
      repair_created: "Logged a repair",
      repair_updated: "Updated a repair",
      repair_technician_update: "Updated repair progress",
      incoming_unit_created: "Received an incoming unit",
      incoming_unit_updated: "Updated an incoming unit",
      incoming_unit_deleted: "Removed an incoming unit",
      incoming_unit_archived: "Archived an incoming unit",
      outgoing_unit_created: "Released an outgoing unit",
      outgoing_unit_updated: "Updated an outgoing unit",
      outgoing_unit_deleted: "Removed an outgoing unit",
      outgoing_unit_archived: "Archived an outgoing unit",
      department_created: "Added a department",
      department_updated: "Updated a department",
      department_deleted: "Removed a department",
      department_archived: "Archived a department",
      user_account_created: "Created a user account",
      user_account_updated: "Updated a user account",
      user_account_deleted: "Deleted a user account",
      user_account_archived: "Archived a user account",
      user_account_status_changed: "Changed account status",
      user_account_approved: "Approved a signup request",
      user_account_rejected: "Rejected a signup request",
      user_password_changed: "Reset a user's password",
    };
    return map[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const prettyEntity = (entityType: string) => {
    if (entityType === "file_report") return "Ticket Module";
    if (entityType === "repair") return "Repair Module";
    if (entityType === "incoming_unit") return "Incoming Units";
    if (entityType === "outgoing_unit") return "Outgoing Units";
    if (entityType === "department") return "Departments";
    if (entityType === "user_account") return "User Accounts";
    return entityType;
  };

  const safeDetails = (row: Row): React.ReactNode => {
    const meta = row.meta as Record<string, unknown>;
    const status = typeof meta.status === "string" ? meta.status : "";
    const unitName = typeof meta.unit_name === "string" ? meta.unit_name : "";
    const departmentName = typeof meta.department_name === "string" ? meta.department_name : "";
    const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
    const username = typeof meta.username === "string" ? meta.username : "";
    const isActive = typeof meta.is_active === "boolean" ? meta.is_active : null;
    const changedFields = Array.isArray(meta.changed_fields)
      ? (meta.changed_fields as string[])
      : null;

    const labelMap: Record<string, string> = {
      full_name: "name",
      email: "email address",
      password_hash: "password",
      username: "username",
      role: "role",
      is_active: "account status",
    };

    const usernameSpan = username ? <span style={{ color: "#475569" }}>@{username}</span> : null;
    const BrandValue = ({ value }: { value: string }) => (
      <span style={{ color: BRAND, fontWeight: 800, letterSpacing: 0.2 }}>{value}</span>
    );
    const fullNameSpan = <BrandValue value={fullName || "User"} />;

    switch (row.action) {
          case "ticket_created": {
            const ticketNum =
              row.ticket?.ticket_number ||
              (typeof meta.ticket_number === "string" && meta.ticket_number) ||
              (typeof meta.title === "string" && meta.title) ||
              "—";
            return (
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                Added the ticket <BrandValue value={ticketNum} />
                {typeof meta.employee_name === "string" && meta.employee_name.trim() ? (
                  <span style={{ color: "#475569" }}>· {meta.employee_name}</span>
                ) : null}
              </span>
            );
          }

          case "ticket_updated": {
            const ticketNum =
              row.ticket?.ticket_number ||
              (typeof meta.ticket_number === "string" && meta.ticket_number) ||
              (typeof meta.title === "string" && meta.title) ||
              "—";
            const assignees = typeof meta.new_assignees === "number" ? meta.new_assignees : null;
            return (
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                Updated the ticket <BrandValue value={ticketNum} />
                {assignees !== null && assignees > 0 ? (
                  <span style={{ color: "#475569" }}>+{assignees} assignee(s)</span>
                ) : null}
              </span>
            );
          }

          case "ticket_technician_update": {
            const ticketNum =
              row.ticket?.ticket_number ||
              (typeof meta.ticket_number === "string" && meta.ticket_number) ||
              (typeof meta.title === "string" && meta.title) ||
              "—";
            const techStatus =
              (typeof meta.status === "string" && meta.status) ||
              (typeof meta.new_status === "string" && meta.new_status) ||
              "";
            const statusColor =
              techStatus === "Resolved"    ? "#15803d" :
              techStatus === "In Progress" ? "#a16207" :
              "#475569";
            const statusBg =
              techStatus === "Resolved"    ? "rgba(22,163,74,0.10)" :
              techStatus === "In Progress" ? "rgba(234,179,8,0.11)" :
              "rgba(100,116,139,0.09)";
            return (
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                Updated ticket <BrandValue value={ticketNum} />
                {techStatus ? (
                  <span style={{
                    color: statusColor,
                    fontWeight: 600,
                    background: statusBg,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                  }}>
                    → {techStatus}
                  </span>
                ) : null}
              </span>
            );
          }
      case "repair_created":
        return "A new repair job was logged.";
      case "repair_updated":
        return status ? `Repair status set to "${status}".` : "Repair details were updated.";
      case "repair_technician_update":
        return status ? `Repair marked as "${status}".` : "Repair was updated by technician.";
      case "incoming_unit_created":
        return unitName ? (
          <span>
            Added the incoming unit <BrandValue value={unitName} />
          </span>
        ) : (
          "A new unit was received."
        );
      case "incoming_unit_updated":
        return unitName ? (
          <span>
            Updated the incoming unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An incoming unit was updated."
        );
      case "incoming_unit_archived":
        return unitName ? (
          <span>
            Archived the incoming unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An incoming unit was archived."
        );
      case "incoming_unit_deleted":
        return unitName ? (
          <span>
            Removed the incoming unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An incoming unit was removed."
        );
      case "outgoing_unit_created":
        return unitName ? (
          <span>
            Released the outgoing unit <BrandValue value={unitName} />
          </span>
        ) : (
          "A unit was released."
        );
      case "outgoing_unit_updated":
        return unitName ? (
          <span>
            Updated the outgoing unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An outgoing unit was updated."
        );
      case "outgoing_unit_archived":
        return unitName ? (
          <span>
            Archived the outgoing unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An outgoing unit was archived."
        );
      case "outgoing_unit_deleted":
        return unitName ? (
          <span>
            Removed the outgoing unit <BrandValue value={unitName} />
          </span>
        ) : (
          "An outgoing unit was removed."
        );
      case "department_created":
        return departmentName ? (
          <span>
            Added the department <BrandValue value={departmentName} />
          </span>
        ) : (
          "A new department was added."
        );
      case "department_updated":
        return departmentName ? (
          <span>
            Updated the department <BrandValue value={departmentName} />
          </span>
        ) : (
          "A department was updated."
        );
      case "department_deleted":
        return departmentName ? (
          <span>
            Removed the department <BrandValue value={departmentName} />
          </span>
        ) : (
          "A department was deleted."
        );
      case "department_archived":
        return departmentName ? (
          <span>
            Archived the department <BrandValue value={departmentName} />
          </span>
        ) : (
          "A department was archived."
        );
      case "user_account_created":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Added the account {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_account_updated":
        if (changedFields && changedFields.length > 0) {
          const labels = changedFields.map(f => labelMap[f] ?? f).join(", ");
          return (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span>Updated the account {fullNameSpan} {usernameSpan}</span>
              <span style={{ color: "#475569" }}>{labels}</span>
            </span>
          );
        }
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Updated the account {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_password_changed":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Reset password for {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_account_deleted":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Deleted account {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_account_archived":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Archived account {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_account_status_changed":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Changed status for {fullNameSpan} {usernameSpan}</span>
            <span style={{ color: "#475569" }}>{isActive ? "activated" : "deactivated"}</span>
          </span>
        );
      case "user_account_approved":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Approved signup for {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      case "user_account_rejected":
        return (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span>Rejected signup for {fullNameSpan} {usernameSpan}</span>
          </span>
        );
      default:
        return "Action was recorded.";
    }
  };

  useEffect(() => {
  const run = async () => {
    setLoading(true);
    let q = supabase
      .from("activity_log")
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        meta,
        created_at,
        actor:user_accounts!activity_log_actor_user_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(isAdmin ? 400 : 200);

    if (!isAdmin && userId) {
      q = q.eq("actor_user_id", userId);
    } else if (!isAdmin && !userId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await q;
    if (error) {
      console.error("activity_log error:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const rawRows = (data ?? []).map((r: any) => ({
      ...r,
      meta: (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>,
      ticket: null,
    }));

    // Collect all entity_ids for ticket-related rows
    const ticketEntityIds = rawRows
      .filter((r: any) =>
        ["ticket_created", "ticket_updated", "ticket_technician_update"].includes(r.action) &&
        r.entity_id
      )
      .map((r: any) => r.entity_id as string);

    // Fetch ticket numbers in one batch query
    if (ticketEntityIds.length > 0) {
      const { data: tickets } = await supabase
        .from("file_reports")
        .select("id, ticket_number")
        .in("id", ticketEntityIds);

      const ticketMap: Record<string, string | null> = {};
      (tickets ?? []).forEach((t: any) => {
        ticketMap[t.id] = t.ticket_number ?? null;
      });

      const enriched = rawRows.map((r: any) => ({
        ...r,
        ticket: ticketMap[r.entity_id] !== undefined
          ? { ticket_number: ticketMap[r.entity_id] }
          : null,
      }));

      setRows(enriched);
    } else {
      setRows(rawRows);
    }

    setLoading(false);
  };

  run();

  const channel = supabase
    .channel(`activity_log_sync_${isAdmin ? "admin" : userId ?? "guest"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => { void run(); })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [isAdmin, userId]);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
        <ScrollText size={22} color={BRAND} />
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'Poppins', sans-serif", letterSpacing: 1  }}>Activity Log</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            {isAdmin ? "Recent actions across the system." : "Actions you performed while signed in."}
          </p>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {(isAdmin
                ? ["By", "When", "Action", "Entity", "Details"]
                : ["When", "Action", "Entity", "Details"]
              ).map(h => (
                <th
                  key={h}
                  style={{
                    padding: "0.65rem 1rem",
                    textAlign: "left",
                    fontSize: 11,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  <Loader size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {isAdmin && (
                    <td style={{ padding: "0.75rem 1rem", color: "#0f172a", fontSize: 12, fontWeight: 600 }}>
                      {r.actor?.full_name?.trim() || "System"}
                    </td>
                  )}
                  <td style={{ padding: "0.75rem 1rem", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                    {prettyAction(r.action)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>
                    {prettyEntity(r.entity_type)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: 12, color: "#475569", maxWidth: 320, wordBreak: "break-word" }}>
                    {safeDetails(r)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLogPanel;