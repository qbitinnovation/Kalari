import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { createNotification, type NotificationRole } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";
import { getAgentDisplayName, getCommissionPeriodKey, normalizePayoutFrequency } from "@/lib/agentCommission";

const allowedRoles = new Set<NotificationRole>(["admin", "staff", "agent"]);
const recordId = (record: any) => String(record?.id || record?._id || "");
const normalizeRole = (role: string) => allowedRoles.has(role as NotificationRole) ? role as NotificationRole : null;

const previousDay = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
};

const getDuePeriodKeys = (frequency: unknown) => {
  const normalized = normalizePayoutFrequency(frequency);
  if (normalized === "DAILY") return [getCommissionPeriodKey(new Date(), normalized), getCommissionPeriodKey(previousDay(), normalized)];
  if (normalized === "WEEKLY") {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return [getCommissionPeriodKey(date, normalized)];
  }
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return [getCommissionPeriodKey(date, normalized)];
};

async function ensureMongoPayoutNotifications() {
  const Agent = getGenericModel("agents") as any;
  const Booking = getGenericModel("bookings") as any;
  const Notification = getGenericModel("notifications") as any;
  const agents = await Agent.find({ active: { $ne: false } }).lean();

  for (const agent of agents) {
    const agentId = recordId(agent);
    const dueKeys = getDuePeriodKeys(agent.payout_frequency);
    if (!agentId || dueKeys.length === 0) continue;

    const bookings = await Booking.find({
      agent_id: agentId,
      status: "CONFIRMED",
      commission_status: { $ne: "PAID" },
      commission_period_key: { $in: dueKeys },
    }).lean();
    const total = bookings.reduce((sum: number, booking: any) => sum + Number(booking.commission_amount || 0), 0);
    if (total <= 0) continue;

    const reminderKey = `agent-payout:${agentId}:${dueKeys.join("|")}`;
    const exists = await Notification.findOne({ "metadata.payout_reminder_key": reminderKey }).lean();
    if (exists) continue;

    await createNotification({
      type: "AGENT_PAYOUT_DUE",
      module: "AGENTS",
      title: "Agent payout due",
      message: `${getAgentDisplayName(agent)} has Rs. ${total.toLocaleString("en-IN")} unpaid commission due today.`,
      target_roles: ["admin", "staff"],
      entity_type: "agent",
      entity_id: agentId,
      action_url: `/admin/agents/${agentId}`,
      severity: "WARNING",
      metadata: { payout_reminder_key: reminderKey, agent_id: agentId, period_keys: dueKeys, amount: total },
    });
  }
}

async function ensureLocalPayoutNotifications(store: any) {
  store.notifications = store.notifications || [];
  const agents = (store.agents || []).filter((agent: any) => agent.active !== false);
  for (const agent of agents) {
    const agentId = recordId(agent);
    const dueKeys = getDuePeriodKeys(agent.payout_frequency);
    const bookings = (store.bookings || []).filter((booking: any) =>
      booking.agent_id === agentId &&
      booking.status === "CONFIRMED" &&
      booking.commission_status !== "PAID" &&
      dueKeys.includes(booking.commission_period_key)
    );
    const total = bookings.reduce((sum: number, booking: any) => sum + Number(booking.commission_amount || 0), 0);
    if (total <= 0) continue;

    const reminderKey = `agent-payout:${agentId}:${dueKeys.join("|")}`;
    const exists = store.notifications.some((notification: any) => notification.metadata?.payout_reminder_key === reminderKey);
    if (exists) continue;

    store.notifications.unshift({
      id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "AGENT_PAYOUT_DUE",
      module: "AGENTS",
      title: "Agent payout due",
      message: `${getAgentDisplayName(agent)} has Rs. ${total.toLocaleString("en-IN")} unpaid commission due today.`,
      target_roles: ["admin", "staff"],
      read_by: [],
      entity_type: "agent",
      entity_id: agentId,
      action_url: `/admin/agents/${agentId}`,
      severity: "WARNING",
      metadata: { payout_reminder_key: reminderKey, agent_id: agentId, period_keys: dueKeys, amount: total },
      created_at: new Date().toISOString(),
    });
  }
}

export async function GET(req: NextRequest) {
  const role = normalizeRole(String(req.nextUrl.searchParams.get("role") || ""));
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 12)));
  if (!role) return NextResponse.json({ error: "A valid role is required." }, { status: 400 });

  try {
    await connectDB();
    if (role === "admin" || role === "staff") await ensureMongoPayoutNotifications();
    const Notification = getGenericModel("notifications") as any;
    const rows = await Notification.find({ target_roles: role }).sort({ created_at: -1 }).limit(limit).lean();
    return NextResponse.json({ data: rows });
  } catch {
    const store = await readStore();
    if (role === "admin" || role === "staff") await ensureLocalPayoutNotifications(store);
    await writeStore(store);
    const rows = (store.notifications || [])
      .filter((notification: any) => (notification.target_roles || []).includes(role))
      .sort((left: any, right: any) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, limit);
    return NextResponse.json({ data: rows, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || "").trim();
  const module = String(body?.module || "").trim();
  const title = String(body?.title || "").trim();
  const message = String(body?.message || "").trim();
  const targetRoles = Array.isArray(body?.target_roles)
    ? body.target_roles.map((role: unknown) => normalizeRole(String(role))).filter(Boolean)
    : undefined;
  if (!type || !module || !title || !message) {
    return NextResponse.json({ error: "Notification type, module, title, and message are required." }, { status: 400 });
  }

  const row = await createNotification({
    type,
    module,
    title,
    message,
    target_roles: targetRoles as NotificationRole[] | undefined,
    entity_type: body?.entity_type ? String(body.entity_type) : undefined,
    entity_id: body?.entity_id ? String(body.entity_id) : undefined,
    action_url: body?.action_url ? String(body.action_url) : undefined,
    severity: body?.severity,
    metadata: body?.metadata,
  });
  return NextResponse.json({ data: row }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const notificationId = String(body?.notificationId || "");
  const userId = String(body?.userId || "");
  if (!notificationId || !userId) {
    return NextResponse.json({ error: "Notification and user are required." }, { status: 400 });
  }

  try {
    await connectDB();
    const Notification = getGenericModel("notifications") as any;
    const filter = mongoose.Types.ObjectId.isValid(notificationId)
      ? { $or: [{ id: notificationId }, { _id: new mongoose.Types.ObjectId(notificationId) }] }
      : { id: notificationId };
    await Notification.updateOne(filter, { $addToSet: { read_by: userId }, $set: { updated_at: new Date().toISOString() } });
    return NextResponse.json({ data: { success: true } });
  } catch {
    const store = await readStore();
    store.notifications = (store.notifications || []).map((notification: any) =>
      recordId(notification) === notificationId
        ? {
            ...notification,
            read_by: Array.from(new Set([...(notification.read_by || []), userId])),
            updated_at: new Date().toISOString(),
          }
        : notification
    );
    await writeStore(store);
    return NextResponse.json({ data: { success: true }, fallback: true });
  }
}
