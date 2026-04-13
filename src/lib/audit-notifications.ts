export const NOTIFICATIONS_CHANGED_EVENT = "itdesk-notifications-changed";
/** Fired after ticket assignment flows so the admin bottom bar can refresh pending counts. */
export const NAV_BADGES_CHANGED_EVENT = "itdesk-nav-badges-changed";

/** Untyped client — matches createClient() from @supabase/supabase-js */
type Db = { from: (t: string) => any };

export function dispatchNotificationsChanged(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

export function dispatchNavBadgesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAV_BADGES_CHANGED_EVENT));
}

async function fetchActiveAdminIds(supabase: Db): Promise<string[]> {
  const { data } = await supabase
    .from("user_accounts")
    .select("id")
    .eq("is_active", true)
    .eq("role", "Administrator");
  return (data ?? [])
    .map((r: any) => (r?.id ? String(r.id) : null))
    .filter(Boolean) as string[];
}

export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("session_user_id");
  return id && id.trim() ? id.trim() : null;
}

function clip(s: string, max: number): string {
  const t = s.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  return t.length <= max ? t : t.slice(0, max);
}

export async function insertActivityLog(
  supabase: Db,
  row: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  const action = clip(row.action, 120);
  const entityType = clip(row.entityType, 80);
  if (!action || !entityType) return;
  await supabase.from("activity_log").insert({
    actor_user_id: row.actorUserId,
    action,
    entity_type: entityType,
    entity_id: row.entityId ?? null,
    meta: row.meta && typeof row.meta === "object" ? row.meta : {},
  });
}

export async function insertNotification(
  supabase: Db,
  row: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    entityType?: string | null;
    entityId?: string | null;
    actorUserId?: string | null;
  }
): Promise<void> {
  const title = clip(row.title, 200);
  const body = clip(row.body ?? "", 2000);
  const type = clip(row.type, 80);
  if (!row.userId || !title || !type) return;
  await supabase.from("app_notifications").insert({
    user_id: row.userId,
    type,
    title,
    body,
    entity_type: row.entityType ? clip(row.entityType, 80) : null,
    entity_id: row.entityId ?? null,
    actor_user_id: row.actorUserId ?? null,
  });
}

/** Notify users newly added to assigned_to (ticket). */
export async function notifyTicketAssignees(
  supabase: Db,
  assigneeIds: string[],
  ctx: {
    ticketId: string;
    ticketTitle: string;
    ticketNumber?: string | null;
    actorUserId?: string | null;
  }
): Promise<void> {
  const label = ctx.ticketNumber?.trim() || "Ticket";
  const uniqueAssignees = Array.from(new Set(assigneeIds.filter(Boolean)));
  for (const uid of uniqueAssignees) {
    if (!uid) continue;
    await insertNotification(supabase, {
      userId: uid,
      type: "ticket_assigned",
      title: "New ticket assigned to you",
      body: `${label}: ${clip(ctx.ticketTitle, 180)}`,
      entityType: "file_report",
      entityId: ctx.ticketId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

/** Notify users newly added to assigned_to (repair job). */
export async function notifyRepairAssignees(
  supabase: Db,
  assigneeIds: string[],
  ctx: {
    repairId: string;
    summary: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const uniqueAssignees = Array.from(new Set(assigneeIds.filter(Boolean)));
  for (const uid of uniqueAssignees) {
    if (!uid) continue;
    await insertNotification(supabase, {
      userId: uid,
      type: "repair_assigned",
      title: "New repair job assigned to you",
      body: clip(ctx.summary, 2000),
      entityType: "repair",
      entityId: ctx.repairId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

/** Notify all active admins when a repair job is assigned to technicians (oversight / in-app list). */
export async function notifyAdminsRepairAssignment(
  supabase: Db,
  ctx: {
    repairId: string;
    summary: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const adminIds = await fetchActiveAdminIds(supabase);
  for (const uid of adminIds) {
    await insertNotification(supabase, {
      userId: uid,
      type: "admin_repair_assigned",
      title: "Repair job assigned",
      body: clip(ctx.summary, 2000),
      entityType: "repair",
      entityId: ctx.repairId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

/** Notify all active admins when an employee submits a new ticket (actor = employee). Optional if DB trigger handles inserts. */
export async function notifyAdminsNewEmployeeTicket(
  supabase: Db,
  ctx: {
    ticketId: string;
    ticketTitle: string;
    ticketNumber?: string | null;
    actorUserId?: string | null;
  }
): Promise<void> {
  const label = ctx.ticketNumber?.trim() || "Ticket";
  const adminIds = await fetchActiveAdminIds(supabase);
  for (const uid of adminIds) {
    await insertNotification(supabase, {
      userId: uid,
      type: "employee_new_ticket",
      title: "New ticket submitted",
      body: `${label}: ${clip(ctx.ticketTitle, 180)}`,
      entityType: "file_report",
      entityId: ctx.ticketId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

export async function notifyAdminsTicketStatusChanged(
  supabase: Db,
  ctx: {
    ticketId: string;
    ticketTitle: string;
    ticketNumber?: string | null;
    status: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const label = ctx.ticketNumber?.trim() || "Ticket";
  const adminIds = await fetchActiveAdminIds(supabase);
  for (const uid of adminIds) {
    await insertNotification(supabase, {
      userId: uid,
      type: "ticket_status_changed_admin",
      title: "Ticket status updated",
      body: `${label}: ${clip(ctx.ticketTitle, 180)} → ${clip(ctx.status, 80)}`,
      entityType: "file_report",
      entityId: ctx.ticketId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

/** Notify the employee who submitted the ticket when IT updates status. */
export async function notifyTicketRequesterStatusChanged(
  supabase: Db,
  ctx: {
    ticketId: string;
    ticketTitle: string;
    ticketNumber?: string | null;
    status: string;
    employeeName: string;
    departmentId: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const name = ctx.employeeName?.trim();
  const dept = ctx.departmentId?.trim();
  if (!name || !dept) return;
  const { data: requester } = await supabase
    .from("user_accounts")
    .select("id")
    .eq("full_name", name)
    .eq("department_id", dept)
    .eq("role", "Employee")
    .maybeSingle();
  const requesterId = requester?.id ? String(requester.id) : null;
  if (!requesterId) return;
  if (ctx.actorUserId && requesterId === ctx.actorUserId) return;
  const label = ctx.ticketNumber?.trim() || "Ticket";
  await insertNotification(supabase, {
    userId: requesterId,
    type: "ticket_status_requester",
    title: "Your ticket was updated",
    body: `${label}: ${clip(ctx.ticketTitle, 180)} → ${clip(ctx.status, 80)}`,
    entityType: "file_report",
    entityId: ctx.ticketId,
    actorUserId: ctx.actorUserId ?? null,
  });
  dispatchNotificationsChanged();
}

export async function notifyAdminsRepairStatusChanged(
  supabase: Db,
  ctx: {
    repairId: string;
    summary: string;
    status: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const adminIds = await fetchActiveAdminIds(supabase);
  for (const uid of adminIds) {
    await insertNotification(supabase, {
      userId: uid,
      type: "repair_status_changed_admin",
      title: "Repair status updated",
      body: `${clip(ctx.summary, 2000)} → ${clip(ctx.status, 80)}`,
      entityType: "repair",
      entityId: ctx.repairId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}

export function diffNewAssignees(prev: string[], next: string[]): string[] {
  const p = new Set(prev);
  return next.filter(id => id && !p.has(id));
}

/** Notify all active admins that a new signup request needs approval. */
export async function notifyAdminsSignupRequest(
  supabase: Db,
  ctx: {
    requestId: string;
    fullName: string;
    username: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const adminIds = await fetchActiveAdminIds(supabase);
  for (const uid of adminIds) {
    await insertNotification(supabase, {
      userId: uid,
      type: "signup_request",
      title: "New account request pending approval",
      body: `${clip(ctx.fullName, 120)} (@${clip(ctx.username, 80)}) has requested an account.`,
      entityType: "signup_request",
      entityId: ctx.requestId,
      actorUserId: ctx.actorUserId ?? null,
    });
  }
  dispatchNotificationsChanged();
}
