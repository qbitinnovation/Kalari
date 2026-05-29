import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";

export type NotificationRole = "admin" | "staff" | "agent";

export type NotificationInput = {
  type: string;
  module: string;
  title: string;
  message: string;
  target_roles?: NotificationRole[];
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  metadata?: Record<string, any>;
};

export const DEFAULT_NOTIFICATION_ROLES: NotificationRole[] = ["admin", "staff"];

export async function createNotification(input: NotificationInput) {
  const notification = {
    ...input,
    target_roles: input.target_roles?.length ? input.target_roles : DEFAULT_NOTIFICATION_ROLES,
    severity: input.severity || "INFO",
    read_by: [],
    toast_shown_by: [],
    created_at: new Date().toISOString(),
  };

  try {
    await connectDB();
    const Notification = getGenericModel("notifications") as any;
    return await Notification.create(notification);
  } catch {
    const store = await readStore();
    store.notifications = store.notifications || [];
    const row = {
      id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...notification,
    };
    store.notifications.unshift(row);
    await writeStore(store);
    return row;
  }
}
