import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { createNotification } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: unknown) => String(value || "").trim();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const message = clean(body.message);

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    phone,
    message,
    source: "WEBSITE_CONTACT",
    status: "NEW",
    created_at: now,
    updated_at: now,
  };

  try {
    await connectDB();
    const ContactMessage = getGenericModel("contact_messages") as any;
    const doc = await ContactMessage.create(row);
    await createNotification({
      type: "CONTACT_MESSAGE",
      module: "MESSAGES",
      title: "New website message",
      message: `${name} sent a message from the Contact page.`,
      target_roles: ["admin", "staff"],
      entity_type: "contact_message",
      entity_id: String(doc.id || doc._id || row.id),
      action_url: "/admin/messages",
      severity: "INFO",
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch {
    const store = await readStore();
    store.contact_messages = store.contact_messages || [];
    store.contact_messages.unshift(row);
    store.notifications = store.notifications || [];
    store.notifications.unshift({
      id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "CONTACT_MESSAGE",
      module: "MESSAGES",
      title: "New website message",
      message: `${name} sent a message from the Contact page.`,
      target_roles: ["admin", "staff"],
      read_by: [],
      entity_type: "contact_message",
      entity_id: row.id,
      action_url: "/admin/messages",
      severity: "INFO",
      created_at: now,
    });
    await writeStore(store);
    return NextResponse.json({ data: row, fallback: true }, { status: 201 });
  }
}
