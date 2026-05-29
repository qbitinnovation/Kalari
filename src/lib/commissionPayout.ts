import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { collectDueCommissionBookings } from "@/lib/agentCommission";
import { getRecordId } from "@/lib/booking";
import { createNotification } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";

const recordId = (record: any) => String(record?.id || record?._id || "");

const normalizeBookingIds = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));

const toObjectIds = (ids: string[]) =>
  ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

export type MarkCommissionPaidResult = {
  bookingIds: string[];
  modifiedCount: number;
  paidAt: string;
  paidBy: string;
};

export async function markCommissionBookingsPaid(
  bookingIds: string[],
  paidBy: string
): Promise<MarkCommissionPaidResult> {
  const ids = normalizeBookingIds(bookingIds);
  if (!ids.length) {
    throw new Error("No bookings selected for payout.");
  }

  const paidAt = new Date().toISOString();
  const payload = {
    commission_status: "PAID",
    commission_paid_at: paidAt,
    commission_paid_by: paidBy,
    updated_at: paidAt,
  };

  try {
    await connectDB();
    const Booking = getGenericModel("bookings") as any;
    const objectIds = toObjectIds(ids);
    const filter = objectIds.length
      ? {
          $or: [{ _id: { $in: objectIds } }, { id: { $in: ids } }],
          commission_status: { $ne: "PAID" },
        }
      : { id: { $in: ids }, commission_status: { $ne: "PAID" } };
    const result = await Booking.updateMany(filter, { $set: payload });
    const modifiedCount = Number(result?.modifiedCount || 0);
    if (modifiedCount === 0) {
      throw new Error("Could not update any commission bookings.");
    }
    return { bookingIds: ids, modifiedCount, paidAt, paidBy };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Could not update") || error.message.startsWith("No bookings"))
    ) {
      throw error;
    }
    const store = await readStore();
    store.bookings = store.bookings || [];
    let modifiedCount = 0;
    store.bookings = store.bookings.map((booking: any) => {
      const id = recordId(booking);
      if (!ids.includes(id) || booking.commission_status === "PAID") return booking;
      modifiedCount += 1;
      return { ...booking, ...payload };
    });
    if (modifiedCount === 0) {
      throw new Error("Could not update any commission bookings.");
    }
    await writeStore(store);
    return { bookingIds: ids, modifiedCount, paidAt, paidBy };
  }
}

export type SettleDueCommissionsResult = MarkCommissionPaidResult & {
  agentCount: number;
  bookingCount: number;
  totalAmount: number;
};

export async function settleDueCommissions(paidBy: string): Promise<SettleDueCommissionsResult> {
  let agents: any[] = [];
  let bookings: any[] = [];

  try {
    await connectDB();
    const Agent = getGenericModel("agents") as any;
    const Booking = getGenericModel("bookings") as any;
    [agents, bookings] = await Promise.all([
      Agent.find({}).lean(),
      Booking.find({
        status: "CONFIRMED",
        commission_status: { $ne: "PAID" },
        commission_amount: { $gt: 0 },
      }).lean(),
    ]);
  } catch {
    const store = await readStore();
    agents = store.agents || [];
    bookings = (store.bookings || []).filter(
      (booking: any) =>
        booking.status === "CONFIRMED" &&
        booking.commission_status !== "PAID" &&
        Number(booking.commission_amount || 0) > 0
    );
  }

  const { bookings: dueBookings, summary } = collectDueCommissionBookings(agents, bookings);
  if (!dueBookings.length || summary.totalAmount <= 0) {
    throw new Error("No commissions are due right now.");
  }

  const bookingIds = dueBookings.map((booking) => getRecordId(booking)).filter(Boolean);
  const result = await markCommissionBookingsPaid(bookingIds, paidBy);

  const agentsLabel = summary.agentCount === 1 ? "1 agent" : `${summary.agentCount} agents`;
  const bookingsLabel = summary.bookingCount === 1 ? "1 booking" : `${summary.bookingCount} bookings`;
  const amountLabel = `Rs. ${Number(summary.totalAmount || 0).toLocaleString("en-IN")}`;

  await createNotification({
    type: "AGENT_PAYOUT_PAID",
    module: "AGENTS",
    title: "Due commissions settled",
    message: `${amountLabel} settled for ${agentsLabel} (${bookingsLabel}).`,
    severity: "SUCCESS",
    action_url: "/admin/commissions?status=PAID",
    metadata: {
      settle_all_due: true,
      agent_count: summary.agentCount,
      booking_count: summary.bookingCount,
      amount: summary.totalAmount,
      agent_ids: summary.agentIds,
      period_keys: summary.periodKeys,
      booking_ids: result.bookingIds,
    },
  }).catch(() => null);

  return {
    ...result,
    agentCount: summary.agentCount,
    bookingCount: summary.bookingCount,
    totalAmount: summary.totalAmount,
  };
}
