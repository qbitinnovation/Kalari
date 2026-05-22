import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { createNotification, type NotificationRole } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";

const allowedRoles = new Set<NotificationRole>(["admin", "staff", "agent"]);
const recordId = (record: any) => String(record?.id || record?._id || "");
const normalizeRole = (role: string) => allowedRoles.has(role as NotificationRole) ? role as NotificationRole : null;

export async function GET(req: NextRequest) {
  const role = normalizeRole(String(req.nextUrl.searchParams.get("role") || ""));
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 12)));
  if (!role) return NextResponse.json({ error: "A valid role is required." }, { status: 400 });

  try {
    await connectDB();
    const Notification = getGenericModel("notifications") as any;
    const rows = await Notification.find({ target_roles: role }).sort({ created_at: -1 }).limit(limit).lean();
    return NextResponse.json({ data: rows });
  } catch {
    const store = await readStore();
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
