/**
 * OS/browser notifications for new `app_notifications` rows (Web Notifications API).
 * Permission is requested when the user opens the bell (user gesture).
 */

export function shouldShowBrowserPushForRole(notificationType: string, userRole: string): boolean {
  const t = (notificationType ?? "").trim();
  if (!t) return false;

  if (userRole === "Administrator") {
    return (
      t === "employee_new_ticket" ||
      t === "admin_repair_assigned" ||
      t === "ticket_status_changed_admin" ||
      t === "repair_status_changed_admin" ||
      t === "signup_request" ||
      t === "ticket_assigned" ||
      t === "repair_assigned"
    );
  }

  if (userRole === "IT Technician") {
    return t === "ticket_assigned" || t === "repair_assigned";
  }

  if (userRole === "Employee") {
    return t === "ticket_status_requester";
  }

  return false;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserNotification(title: string, body: string, tag: string): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const safeTitle = title?.trim() || "Notification";
  const safeBody = body?.trim() ?? "";
  try {
    new Notification(safeTitle, {
      body: safeBody || undefined,
      tag,
    });
  } catch {
    /* ignore */
  }
}
