
/** Served from `public/masaya-sa-tarlac-city-logo.png` (Vite root URL). */
export const BROWSER_NOTIFICATION_ICON_PATH = "/masaya-sa-tarlac-city-logo.png";

function notificationIconAbsoluteUrl(): string {
  if (typeof window === "undefined") return "";
  return new URL(BROWSER_NOTIFICATION_ICON_PATH, window.location.origin).href;
}

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
  
export function isNotificationOwnedByUser(
  notificationUserId: unknown,
  currentUserId: string
): boolean {
  if (!currentUserId?.trim()) return false;
  if (typeof notificationUserId !== "string") return false;
  return notificationUserId.trim() === currentUserId.trim();
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
  const icon = notificationIconAbsoluteUrl();
  try {
    new Notification(safeTitle, {
      body: safeBody || undefined,
      tag,
      ...(icon ? { icon } : {}),
    });
  } catch {
    /* ignore */
  }
}
