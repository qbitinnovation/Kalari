import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import {
  buildAgentLookupMap,
  collectDueCommissionBookings,
  findAgentByReference,
  getAgentDisplayName,
  isBookingCommissionDue,
  isShowBooking,
} from "@/lib/agentCommission";
import { buildShowLookupMap, isBookingSettleable } from "@/lib/bookingPayoutLifecycle";
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

async function loadShowsForBookings(bookings: any[]) {
  const showIds = Array.from(
    new Set(bookings.map((booking) => String(booking?.show_id || "")).filter(Boolean)),
  );
  if (!showIds.length) return [];

  try {
    await connectDB();
    const Show = getGenericModel("shows") as any;
    const objectIds = toObjectIds(showIds);
    const filter = objectIds.length
      ? { $or: [{ _id: { $in: objectIds } }, { id: { $in: showIds } }] }
      : { id: { $in: showIds } };
    return Show.find(filter).lean();
  } catch {
    const store = await readStore();
    return (store.shows || []).filter((show: any) => showIds.includes(getRecordId(show)) || showIds.includes(String(show.id)));
  }
}

async function assertCommissionBookingsPayable(bookingIds: string[]) {
  const ids = normalizeBookingIds(bookingIds);
  const { agents, bookings: allBookings } = await loadAgentsAndCommissionBookings();
  const targets = allBookings.filter((booking: any) => ids.includes(getRecordId(booking)));
  if (targets.length !== ids.length) {
    throw new Error("One or more bookings are not eligible for agent commission payout.");
  }
  const shows = await loadShowsForBookings(targets);
  const showById = buildShowLookupMap(shows);
  const agentById = buildAgentLookupMap(agents);
  const today = new Date();

  targets.forEach((booking: any) => {
    if (!isBookingSettleable(booking)) {
      throw new Error(`Booking ${booking.booking_reference || getRecordId(booking)} is not confirmed.`);
    }
    const agent = findAgentByReference(agentById, String(booking.agent_id || ""));
    const show = showById.get(String(booking.show_id || "")) || null;
    if (!agent || !isBookingCommissionDue(booking, agent, today, show)) {
      throw new Error(
        `Booking ${booking.booking_reference || getRecordId(booking)} is not due for commission payout yet.`,
      );
    }
  });
}

export async function markCommissionBookingsPaid(
  bookingIds: string[],
  paidBy: string
): Promise<MarkCommissionPaidResult> {
  const ids = normalizeBookingIds(bookingIds);
  if (!ids.length) {
    throw new Error("No bookings selected for payout.");
  }

  await assertCommissionBookingsPayable(ids);

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
          status: "CONFIRMED",
          commission_status: { $ne: "PAID" },
          commission_amount: { $gt: 0 },
        }
      : {
          id: { $in: ids },
          status: "CONFIRMED",
          commission_status: { $ne: "PAID" },
          commission_amount: { $gt: 0 },
        };
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
      if (
        !ids.includes(id) ||
        booking.commission_status === "PAID" ||
        booking.status !== "CONFIRMED" ||
        Number(booking.commission_amount || 0) <= 0
      ) {
        return booking;
      }
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

async function loadAgentsAndCommissionBookings() {
  try {
    await connectDB();
    const Agent = getGenericModel("agents") as any;
    const Booking = getGenericModel("bookings") as any;
    const [agents, bookings] = await Promise.all([
      Agent.find({}).lean(),
      Booking.find({
        status: "CONFIRMED",
        commission_status: { $ne: "PAID" },
        commission_amount: { $gt: 0 },
        $or: [{ booking_type: "SHOW" }, { show_id: { $exists: true, $ne: null }, activity_id: { $exists: false } }],
      }).lean(),
    ]);
    return { agents, bookings: bookings.filter(isShowBooking) };
  } catch {
    const store = await readStore();
    return {
      agents: store.agents || [],
      bookings: (store.bookings || []).filter(
        (booking: any) =>
          isShowBooking(booking) &&
          booking.status === "CONFIRMED" &&
          booking.commission_status !== "PAID" &&
          Number(booking.commission_amount || 0) > 0,
      ),
    };
  }
}

const matchesAgentReference = (agentById: Map<string, any>, agentId: string, booking: any) => {
  const agent = findAgentByReference(agentById, String(booking.agent_id || ""));
  const routeAgentId = agent ? getRecordId(agent) : String(booking.agent_id || "");
  return routeAgentId === agentId || String(booking.agent_id || "") === agentId;
};

export async function settleDueCommissionsForAgent(
  agentId: string,
  paidBy: string,
  periodKey?: string,
): Promise<SettleDueCommissionsResult & { agentId: string }> {
  const normalizedAgentId = String(agentId || "").trim();
  if (!normalizedAgentId) {
    throw new Error("Agent is required.");
  }

  const { agents, bookings } = await loadAgentsAndCommissionBookings();
  const shows = await loadShowsForBookings(bookings);
  const agentById = buildAgentLookupMap(agents);
  const agent = findAgentByReference(agentById, normalizedAgentId);
  if (!agent) {
    throw new Error("Agent not found.");
  }

  const { bookings: dueBookings } = collectDueCommissionBookings(agents, bookings, new Date(), shows);
  const agentDueBookings = dueBookings.filter((booking) => {
    if (!matchesAgentReference(agentById, normalizedAgentId, booking)) return false;
    if (periodKey && String(booking.commission_period_key || "") !== periodKey) return false;
    return true;
  });

  if (!agentDueBookings.length) {
    throw new Error(
      periodKey
        ? "No commissions are due for this agent in the selected period."
        : "No commissions are due for this agent right now.",
    );
  }

  const bookingIds = agentDueBookings.map((booking) => getRecordId(booking)).filter(Boolean);
  const totalAmount = agentDueBookings.reduce(
    (sum, booking) => sum + Number(booking.commission_amount || 0),
    0,
  );
  const periodKeys = Array.from(
    new Set(agentDueBookings.map((booking) => String(booking.commission_period_key || "")).filter(Boolean)),
  );
  const result = await markCommissionBookingsPaid(bookingIds, paidBy);
  const agentName = getAgentDisplayName(agent);
  const amountLabel = `Rs. ${Number(totalAmount || 0).toLocaleString("en-IN")}`;
  const bookingsLabel =
    agentDueBookings.length === 1 ? "1 booking" : `${agentDueBookings.length} bookings`;

  await createNotification({
    type: "AGENT_PAYOUT_PAID",
    module: "AGENTS",
    title: "Agent commission settled",
    message: `${amountLabel} settled for ${agentName} (${bookingsLabel}).`,
    severity: "SUCCESS",
    action_url: `/admin/agents/${normalizedAgentId}`,
    metadata: {
      settle_agent_due: true,
      agent_id: normalizedAgentId,
      period_key: periodKey || null,
      period_keys: periodKeys,
      booking_count: agentDueBookings.length,
      amount: totalAmount,
      booking_ids: result.bookingIds,
    },
  }).catch(() => null);

  return {
    ...result,
    agentId: normalizedAgentId,
    agentCount: 1,
    bookingCount: agentDueBookings.length,
    totalAmount,
  };
}

export async function settleDueCommissions(paidBy: string): Promise<SettleDueCommissionsResult> {
  const { agents, bookings } = await loadAgentsAndCommissionBookings();
  const shows = await loadShowsForBookings(bookings);
  const { bookings: dueBookings, summary } = collectDueCommissionBookings(agents, bookings, new Date(), shows);
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
