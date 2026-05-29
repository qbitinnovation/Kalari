import connectDB, { getGenericModel } from "@/lib/db";
import { collectDueCommissionBookings } from "@/lib/agentCommission";
import { createNotification, type NotificationInput } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";

export type ReminderSlot = "morning" | "evening";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const recordId = (record: any) => String(record?.id || record?._id || "");
const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export function getIstParts(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    dateKey: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    hour: ist.getUTCHours(),
  };
}

export function getIstDateKey(now = new Date()) {
  return getIstParts(now).dateKey;
}

export function getReminderSlot(now = new Date()): ReminderSlot | null {
  const { hour } = getIstParts(now);
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 17 && hour < 21) return "evening";
  return null;
}

export type DueCommissionSummary = {
  agentCount: number;
  totalAmount: number;
  agentIds: string[];
  periodKeys: string[];
};

export function collectDueCommissionSummary(agents: any[], bookings: any[]): DueCommissionSummary {
  const { summary } = collectDueCommissionBookings(agents, bookings);
  return {
    agentCount: summary.agentCount,
    totalAmount: summary.totalAmount,
    agentIds: summary.agentIds,
    periodKeys: summary.periodKeys,
  };
}

export function getReminderDedupKey(slot: ReminderSlot, dateKey: string) {
  return `commission-due-summary:${slot}:${dateKey}`;
}

export function buildReminderNotification(slot: ReminderSlot, summary: DueCommissionSummary, dateKey: string): NotificationInput {
  const { agentCount, totalAmount } = summary;
  const amountLabel = rupees(totalAmount);
  const agentsLabel = agentCount === 1 ? "1 agent has" : `${agentCount} agents have`;
  const dedupKey = getReminderDedupKey(slot, dateKey);

  if (slot === "morning") {
    return {
      type: "AGENT_PAYOUT_DUE",
      module: "AGENTS",
      title: "Commission payouts due today",
      message: `${agentsLabel} ${amountLabel} in commission due today. Review and pay on the Commissions page.`,
      target_roles: ["admin", "staff"],
      action_url: "/admin/commissions?status=DUE",
      severity: "WARNING",
      metadata: {
        payout_reminder_key: dedupKey,
        reminder_slot: slot,
        reminder_date: dateKey,
        agent_count: agentCount,
        amount: totalAmount,
        agent_ids: summary.agentIds,
        period_keys: summary.periodKeys,
      },
    };
  }

  return {
    type: "AGENT_PAYOUT_DUE",
    module: "AGENTS",
    title: "Commission payout reminder",
    message: `${amountLabel} in agent commission is still unpaid today (${agentCount} ${agentCount === 1 ? "agent" : "agents"}). Please complete payouts before end of day.`,
    target_roles: ["admin", "staff"],
    action_url: "/admin/commissions?status=DUE",
    severity: "WARNING",
    metadata: {
      payout_reminder_key: dedupKey,
      reminder_slot: slot,
      reminder_date: dateKey,
      agent_count: agentCount,
      amount: totalAmount,
      agent_ids: summary.agentIds,
      period_keys: summary.periodKeys,
    },
  };
}

async function notificationExistsMongo(dedupKey: string) {
  const Notification = getGenericModel("notifications") as any;
  return !!(await Notification.findOne({ "metadata.payout_reminder_key": dedupKey }).lean());
}

function notificationExistsLocal(store: any, dedupKey: string) {
  return (store.notifications || []).some((notification: any) => notification.metadata?.payout_reminder_key === dedupKey);
}

async function ensureMongoCommissionDueReminders(slot: ReminderSlot, dateKey: string) {
  const Agent = getGenericModel("agents") as any;
  const Booking = getGenericModel("bookings") as any;
  const [agents, bookings] = await Promise.all([
    Agent.find({}).lean(),
    Booking.find({
      status: "CONFIRMED",
      commission_status: { $ne: "PAID" },
      commission_amount: { $gt: 0 },
    }).lean(),
  ]);

  const summary = collectDueCommissionSummary(agents, bookings);
  if (summary.agentCount === 0 || summary.totalAmount <= 0) {
    return { created: false, reason: "nothing_due" as const };
  }

  const dedupKey = getReminderDedupKey(slot, dateKey);
  if (await notificationExistsMongo(dedupKey)) {
    return { created: false, reason: "already_sent" as const, slot, dateKey };
  }

  await createNotification(buildReminderNotification(slot, summary, dateKey));
  return { created: true, slot, dateKey, summary };
}

async function ensureLocalCommissionDueReminders(store: any, slot: ReminderSlot, dateKey: string) {
  store.notifications = store.notifications || [];
  const summary = collectDueCommissionSummary(store.agents || [], store.bookings || []);
  if (summary.agentCount === 0 || summary.totalAmount <= 0) {
    return { created: false, reason: "nothing_due" as const };
  }

  const dedupKey = getReminderDedupKey(slot, dateKey);
  if (notificationExistsLocal(store, dedupKey)) {
    return { created: false, reason: "already_sent" as const, slot, dateKey };
  }

  const payload = buildReminderNotification(slot, summary, dateKey);
  store.notifications.unshift({
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    read_by: [],
    created_at: new Date().toISOString(),
  });
  return { created: true, slot, dateKey, summary };
}

export async function ensureCommissionDueReminders(options: { slot?: ReminderSlot; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const dateKey = getIstDateKey(now);
  const slot = options.slot ?? getReminderSlot(now);
  if (!slot) return { created: false, reason: "outside_window" as const };

  try {
    await connectDB();
    return await ensureMongoCommissionDueReminders(slot, dateKey);
  } catch {
    const store = await readStore();
    const result = await ensureLocalCommissionDueReminders(store, slot, dateKey);
    await writeStore(store);
    return result;
  }
}
