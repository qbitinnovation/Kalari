import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";
import {
  BOOKING_HOLD_DURATION_MS,
  BOOKING_HOLD_MINUTES,
  createBookingReference,
  createTicketCodes,
  getRecordId,
  isActiveBookingReservation,
  isShowBookableAt,
  parseSeatCodes,
} from "@/lib/booking";
import { createNotification } from "@/lib/notificationStore";
import { calculateEventCommission, getCommissionPeriodKey } from "@/lib/agentCommission";

type HoldAction = "CONFIRM" | "RELEASE";

const nowIso = () => new Date().toISOString();
const recordId = (record: any) => String(getRecordId(record));
const holdExpiry = () => new Date(Date.now() + BOOKING_HOLD_DURATION_MS).toISOString();
const holdToken = () => crypto.randomUUID();
const holdIdFilter = (token: string) => ({ hold_token: token, status: "HELD" });

const findDocument = async (Model: any, id: string) => {
  const byPublicId = await Model.findOne({ id }).lean();
  if (byPublicId) return byPublicId;
  if (mongoose.Types.ObjectId.isValid(id)) return Model.findById(id).lean();
  return null;
};

const bookingSeats = (booking: any) => parseSeatCodes(booking?.seat_code);
const hasValidRazorpaySignature = (orderId: string, paymentId: string, signature: string) => {
  if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return false;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
const activeInventory = (bookings: any[], excludeId = "") =>
  bookings.filter((booking) => recordId(booking) !== excludeId && isActiveBookingReservation(booking));

const rejectInventoryConflict = (show: any, seatCodes: string[], bookings: any[], layout?: any) => {
  const inventory = activeInventory(bookings);
  if (show.type === "EVENT") {
    const used = inventory.reduce((count, booking) => count + bookingSeats(booking).length, 0);
    const capacity = Number(show.capacity || 0);
    if (capacity > 0 && used + seatCodes.length > capacity) {
      return `Only ${Math.max(0, capacity - used)} tickets remain for this event.`;
    }
    return "";
  }

  const blockedSeats = new Set(layout?.structure?.blockedSeats || show.layout?.structure?.blockedSeats || []);
  const takenSeats = new Set(inventory.flatMap(bookingSeats));
  const unavailable = seatCodes.filter((seatCode) => blockedSeats.has(seatCode) || takenSeats.has(seatCode));
  return unavailable.length ? `These seats are no longer available: ${unavailable.join(", ")}.` : "";
};

const ensureMongoCustomer = async (Customer: any, form: any) => {
  const phone = String(form?.phone || "").trim();
  const name = String(form?.name || "").trim();
  const email = String(form?.email || "").trim();
  if (!name || !/^[0-9+\s-]{10,}$/.test(phone)) throw new Error("Guest name and a valid phone number are required.");

  const existing = await Customer.findOne({ phone }).lean();
  if (existing) {
    if ((!existing.name || existing.name === "Walk-in Customer") && name) {
      await Customer.updateOne({ _id: existing._id }, { $set: { name, email: email || existing.email, updated_at: nowIso() } });
    }
    return existing;
  }

  return Customer.create({ name, phone, email, created_at: nowIso(), updated_at: nowIso() });
};

const ensureLocalCustomer = (store: any, form: any) => {
  const phone = String(form?.phone || "").trim();
  const name = String(form?.name || "").trim();
  const email = String(form?.email || "").trim();
  if (!name || !/^[0-9+\s-]{10,}$/.test(phone)) throw new Error("Guest name and a valid phone number are required.");

  store.customers = store.customers || [];
  const existing = store.customers.find((customer: any) => customer.phone === phone);
  if (existing) {
    if ((!existing.name || existing.name === "Walk-in Customer") && name) {
      existing.name = name;
      existing.email = email || existing.email;
      existing.updated_at = nowIso();
    }
    return existing;
  }

  const customer = {
    id: `customers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    phone,
    email,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  store.customers.push(customer);
  return customer;
};

const buildHold = ({ show, seatCodes, customer, form, commissionAmount = 0, commissionPercentage = 0, commissionPeriodKey = null }: { show: any; seatCodes: string[]; customer: any; form: any; commissionAmount?: number; commissionPercentage?: number; commissionPeriodKey?: string | null }) => {
  const now = nowIso();
  return {
    booking_reference: createBookingReference(new Date(now)),
    show_id: recordId(show),
    seat_code: JSON.stringify(seatCodes),
    booked_by: String(form.name).trim(),
    customer_id: recordId(customer),
    payment_method: "RAZORPAY",
    payment_status: "PAYMENT_PENDING",
    total_amount: Number(show.price || 0) * seatCodes.length,
    agent_id: show.type === "EVENT" ? show.agent_id || null : null,
    agent_commission_percentage: commissionPercentage,
    commission_amount: commissionAmount,
    commission_status: commissionAmount > 0 ? "UNPAID" : "PAID",
    commission_period_key: commissionPeriodKey,
    booking_time: now,
    status: "HELD",
    hold_token: holdToken(),
    hold_expires_at: holdExpiry(),
    cancellation_status: "NONE",
    created_at: now,
  };
};

const expireMongoHolds = async (Booking: any) => {
  await Booking.updateMany(
    { status: "HELD", hold_expires_at: { $lte: nowIso() } },
    { $set: { status: "EXPIRED", payment_status: "FAILED", updated_at: nowIso() } }
  );
};

const expireLocalHolds = (store: any) => {
  store.bookings = (store.bookings || []).map((booking: any) =>
    booking.status === "HELD" && !isActiveBookingReservation(booking)
      ? { ...booking, status: "EXPIRED", payment_status: "FAILED", updated_at: nowIso() }
      : booking
  );
};

const holdPayload = (booking: any) => ({
  bookingId: recordId(booking),
  booking_reference: booking.booking_reference,
  hold_token: booking.hold_token,
  hold_expires_at: booking.hold_expires_at,
  hold_minutes: BOOKING_HOLD_MINUTES,
});

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const showId = String(body?.showId || "");
    const form = body?.form || {};
    const requestedSeats = Array.isArray(body?.seatCodes) ? body.seatCodes.map(String).filter(Boolean) : [];
    const ticketCount = Math.max(0, Number(body?.ticketCount || 0));
    if (!showId) return NextResponse.json({ error: "Show is required." }, { status: 400 });

    await connectDB();
    const Show = getGenericModel("shows") as any;
    const Booking = getGenericModel("bookings") as any;
    const Customer = getGenericModel("customers") as any;
    const Layout = getGenericModel("layouts") as any;
    const Agent = getGenericModel("agents") as any;
    await expireMongoHolds(Booking);

    const show = await findDocument(Show, showId);
    if (!show || show.status !== "ACTIVE") return NextResponse.json({ error: "This show is not open for booking." }, { status: 400 });
    if (!isShowBookableAt(show)) return NextResponse.json({ error: "Booking is closed because this show time has passed." }, { status: 400 });

    const seatCodes = show.type === "EVENT"
      ? Array.from({ length: ticketCount }).map(() => "GENERAL")
      : requestedSeats;
    if (!seatCodes.length) return NextResponse.json({ error: "Select at least one seat or ticket." }, { status: 400 });

    const layout = show.layout_id ? await findDocument(Layout, String(show.layout_id)) : null;
    const showBookings = await Booking.find({ show_id: recordId(show), status: { $in: ["CONFIRMED", "HELD"] } }).lean();
    const conflict = rejectInventoryConflict(show, seatCodes, showBookings, layout);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const customer = await ensureMongoCustomer(Customer, form);
    const linkedAgent = show.type === "EVENT" && show.agent_id ? await findDocument(Agent, String(show.agent_id)) : null;
    const commissionPercentage = show.type === "EVENT" && show.agent_id ? Number(show.agent_commission_percentage || 0) : 0;
    const commissionAmount = linkedAgent || show.agent_id
      ? calculateEventCommission(Number(show.price || 0) * seatCodes.length, commissionPercentage)
      : 0;
    const commissionPeriodKey = commissionAmount > 0 ? getCommissionPeriodKey(new Date(), linkedAgent?.payout_frequency || "DAILY") : null;
    const booking = await Booking.create(buildHold({ show, seatCodes, customer, form, commissionAmount, commissionPercentage, commissionPeriodKey }));
    return NextResponse.json({ data: holdPayload(booking) }, { status: 201 });
  } catch (error: any) {
    const showId = String(body?.showId || "");
    const form = body?.form || {};
    const requestedSeats = Array.isArray(body?.seatCodes) ? body.seatCodes.map(String).filter(Boolean) : [];
    const ticketCount = Math.max(0, Number(body?.ticketCount || 0));
    if (!showId) return NextResponse.json({ error: "Show is required." }, { status: 400 });

    try {
      const store = await readStore();
      expireLocalHolds(store);
      const show = (store.shows || []).find((row: any) => recordId(row) === showId);
      if (!show || show.status !== "ACTIVE") return NextResponse.json({ error: "This show is not open for booking." }, { status: 400 });
      if (!isShowBookableAt(show)) return NextResponse.json({ error: "Booking is closed because this show time has passed." }, { status: 400 });
      const seatCodes = show.type === "EVENT"
        ? Array.from({ length: ticketCount }).map(() => "GENERAL")
        : requestedSeats;
      if (!seatCodes.length) return NextResponse.json({ error: "Select at least one seat or ticket." }, { status: 400 });
      const layout = (store.layouts || []).find((row: any) => recordId(row) === String(show.layout_id));
      const conflict = rejectInventoryConflict(
        show,
        seatCodes,
        (store.bookings || []).filter((booking: any) => booking.show_id === recordId(show)),
        layout
      );
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
      const customer = ensureLocalCustomer(store, form);
      const linkedAgent = show.type === "EVENT" && show.agent_id
        ? (store.agents || []).find((agent: any) => recordId(agent) === String(show.agent_id))
        : null;
      const commissionPercentage = show.type === "EVENT" && show.agent_id ? Number(show.agent_commission_percentage || 0) : 0;
      const commissionAmount = linkedAgent || show.agent_id
        ? calculateEventCommission(Number(show.price || 0) * seatCodes.length, commissionPercentage)
        : 0;
      const commissionPeriodKey = commissionAmount > 0 ? getCommissionPeriodKey(new Date(), linkedAgent?.payout_frequency || "DAILY") : null;
      const booking = {
        id: `bookings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...buildHold({ show, seatCodes, customer, form, commissionAmount, commissionPercentage, commissionPeriodKey }),
      };
      store.bookings = store.bookings || [];
      store.bookings.push(booking);
      await writeStore(store);
      return NextResponse.json({ data: holdPayload(booking), fallback: true }, { status: 201 });
    } catch (fallbackError: any) {
      return NextResponse.json({ error: fallbackError.message || error.message || "Could not hold booking inventory." }, { status: 500 });
    }
  }
}

export async function PATCH(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const action = String(body?.action || "") as HoldAction;
    const token = String(body?.holdToken || "");
    if (!token || !["CONFIRM", "RELEASE"].includes(action)) {
      return NextResponse.json({ error: "Hold token and action are required." }, { status: 400 });
    }

    await connectDB();
    const Booking = getGenericModel("bookings") as any;
    const Ticket = getGenericModel("tickets") as any;
    const Show = getGenericModel("shows") as any;
    await expireMongoHolds(Booking);

    const hold = await Booking.findOne(holdIdFilter(token)).lean();
    if (!hold || !isActiveBookingReservation(hold)) {
      return NextResponse.json({ error: "This hold expired. Select seats again." }, { status: 409 });
    }

    if (action === "RELEASE") {
      await Booking.updateOne({ _id: hold._id }, { $set: { status: "EXPIRED", payment_status: "FAILED", updated_at: nowIso() } });
      return NextResponse.json({ data: { released: true } });
    }

    const show = await findDocument(Show, String(hold.show_id));
    if (!show) return NextResponse.json({ error: "Held show no longer exists." }, { status: 409 });
    if (!isShowBookableAt(show)) return NextResponse.json({ error: "Booking is closed because this show time has passed." }, { status: 409 });

    const seatCodes = bookingSeats(hold);
    const ticketCodes = createTicketCodes(seatCodes.length);
    const paymentId = String(body?.paymentId || "");
    const razorpayOrderId = String(body?.razorpayOrderId || "");
    const razorpaySignature = String(body?.razorpaySignature || "");
    if (!hasValidRazorpaySignature(razorpayOrderId, paymentId, razorpaySignature)) {
      return NextResponse.json({ error: "Verified Razorpay payment is required." }, { status: 400 });
    }

    await Booking.updateOne(
      { _id: hold._id, status: "HELD" },
      {
        $set: {
          status: "CONFIRMED",
          payment_id: paymentId,
          razorpay_payment_id: paymentId,
          razorpay_order_id: razorpayOrderId || hold.razorpay_order_id || null,
          payment_status: "PAID",
          confirmed_at: nowIso(),
          updated_at: nowIso(),
        },
      }
    );
    const tickets = await Ticket.insertMany(seatCodes.map((seatCode, index) => ({
      booking_id: recordId(hold),
      show_id: recordId(show),
      seat_code: seatCode,
      ticket_code: ticketCodes[index],
      price: Number(show.price || 0),
      generated_by: hold.booked_by,
      generated_at: nowIso(),
      status: "ACTIVE",
    })));
    await createNotification({
      type: "NEW_BOOKING",
      module: "BOOKING",
      title: "New website booking",
      message: `${hold.booking_reference} was booked for ${show.title}.`,
      severity: "SUCCESS",
      entity_type: "booking",
      entity_id: recordId(hold),
      action_url: "/admin/tickets",
      metadata: { booking_reference: hold.booking_reference, show_id: recordId(show) },
    });
    return NextResponse.json({ data: { booking: { ...hold, status: "CONFIRMED" }, tickets } });
  } catch (error: any) {
    const action = String(body?.action || "") as HoldAction;
    const token = String(body?.holdToken || "");
    if (!token || !["CONFIRM", "RELEASE"].includes(action)) {
      return NextResponse.json({ error: "Hold token and action are required." }, { status: 400 });
    }

    try {
      const store = await readStore();
      expireLocalHolds(store);
      store.tickets = store.tickets || [];
      const holdIndex = (store.bookings || []).findIndex((booking: any) => booking.hold_token === token && booking.status === "HELD");
      const hold = holdIndex >= 0 ? store.bookings[holdIndex] : null;
      if (!hold || !isActiveBookingReservation(hold)) return NextResponse.json({ error: "This hold expired. Select seats again." }, { status: 409 });
      if (action === "RELEASE") {
        store.bookings[holdIndex] = { ...hold, status: "EXPIRED", payment_status: "FAILED", updated_at: nowIso() };
        await writeStore(store);
        return NextResponse.json({ data: { released: true }, fallback: true });
      }

      const paymentId = String(body?.paymentId || "");
      const razorpayOrderId = String(body?.razorpayOrderId || "");
      const razorpaySignature = String(body?.razorpaySignature || "");
      if (!hasValidRazorpaySignature(razorpayOrderId, paymentId, razorpaySignature)) {
        return NextResponse.json({ error: "Verified Razorpay payment is required." }, { status: 400 });
      }
      const show = (store.shows || []).find((row: any) => recordId(row) === hold.show_id);
      if (!show) return NextResponse.json({ error: "Held show no longer exists." }, { status: 409 });
      if (!isShowBookableAt(show)) return NextResponse.json({ error: "Booking is closed because this show time has passed." }, { status: 409 });
      const seatCodes = bookingSeats(hold);
      const ticketCodes = createTicketCodes(seatCodes.length);
      store.bookings[holdIndex] = {
        ...hold,
        status: "CONFIRMED",
        payment_id: paymentId,
        razorpay_payment_id: paymentId,
        razorpay_order_id: razorpayOrderId || hold.razorpay_order_id || "",
        payment_status: "PAID",
        confirmed_at: nowIso(),
        updated_at: nowIso(),
      };
      const tickets = seatCodes.map((seatCode, index) => ({
        id: `tickets-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        booking_id: recordId(hold),
        show_id: recordId(show),
        seat_code: seatCode,
        ticket_code: ticketCodes[index],
        price: Number(show.price || 0),
        generated_by: hold.booked_by,
        generated_at: nowIso(),
        status: "ACTIVE",
      }));
      store.tickets.push(...tickets);
      await writeStore(store);
      await createNotification({
        type: "NEW_BOOKING",
        module: "BOOKING",
        title: "New website booking",
        message: `${hold.booking_reference} was booked for ${show.title}.`,
        severity: "SUCCESS",
        entity_type: "booking",
        entity_id: recordId(hold),
        action_url: "/admin/tickets",
        metadata: { booking_reference: hold.booking_reference, show_id: recordId(show) },
      });
      return NextResponse.json({ data: { booking: store.bookings[holdIndex], tickets }, fallback: true });
    } catch (fallbackError: any) {
      return NextResponse.json({ error: fallbackError.message || error.message || "Could not update booking hold." }, { status: 500 });
    }
  }
}
