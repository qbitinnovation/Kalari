import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { createBookingReference, createTicketCodes, parseSeatCodes } from "@/lib/booking";
import { readStore, writeStore } from "@/lib/localStore";
import { createNotification } from "@/lib/notificationStore";

const recordId = (record: any) => String(record?.id || record?._id || "");
const todayValue = () => new Date().toISOString().slice(0, 10);
const isObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

const findActivity = async (Model: any, identifier: string) => {
  const or: any[] = [{ id: identifier }, { slug: identifier }];
  if (isObjectId(identifier)) or.push({ _id: new mongoose.Types.ObjectId(identifier) });
  return Model.findOne({ $or: or }).lean();
};

const findLocalActivity = (store: any, identifier: string) =>
  (store.activities || []).find((row: any) => recordId(row) === identifier || row.slug === identifier);

const normalizePhone = (phone: string) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return String(phone || "").trim();
};

const getActivityPrice = (activity: any) => Number(activity?.booking_price || activity?.price || 0);
const getActivityCapacity = (activity: any) => Number(activity?.daily_capacity || 20);
const isActivityActive = (activity: any) => !activity?.status || String(activity.status).toUpperCase() === "ACTIVE";

const countActivityTickets = (bookings: any[]) =>
  bookings
    .filter((booking) => booking.status === "CONFIRMED")
    .reduce((total, booking) => total + parseSeatCodes(booking.seat_code).length, 0);

async function ensureMongoCustomer(customerInput: any) {
  const Customer = getGenericModel("customers") as any;
  const phone = normalizePhone(customerInput?.phone || "");
  if (!phone) return null;
  const existing = await Customer.findOne({ phone }).lean();
  if (existing) return existing;
  return Customer.create({
    name: customerInput?.name || "Guest Customer",
    email: customerInput?.email || "",
    phone,
    phone_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

function ensureLocalCustomer(store: any, customerInput: any) {
  const phone = normalizePhone(customerInput?.phone || "");
  if (!phone) return null;
  store.customers = store.customers || [];
  const existing = store.customers.find((customer: any) => customer.phone === phone);
  if (existing) return existing;
  const customer = {
    id: `customers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: customerInput?.name || "Guest Customer",
    email: customerInput?.email || "",
    phone,
    phone_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.customers.push(customer);
  return customer;
}

export async function GET(req: NextRequest) {
  const activityId = String(req.nextUrl.searchParams.get("activityId") || "");
  const date = String(req.nextUrl.searchParams.get("date") || todayValue());
  if (!activityId) return NextResponse.json({ error: "Activity is required." }, { status: 400 });

  try {
    await connectDB();
    const Activity = getGenericModel("activities") as any;
    const Booking = getGenericModel("bookings") as any;
    const activity = await findActivity(Activity, activityId);
    if (!activity) throw new Error("Activity not found in primary store.");
    const bookings = await Booking.find({ activity_id: recordId(activity), booking_date: date, booking_type: "ACTIVITY", status: "CONFIRMED" }).lean();
    const booked = countActivityTickets(bookings);
    const capacity = getActivityCapacity(activity);
    return NextResponse.json({ data: { activity, date, capacity, booked, remaining: Math.max(0, capacity - booked) } });
  } catch {
    const store = await readStore();
    const activity = findLocalActivity(store, activityId);
    if (!activity) return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    const bookings = (store.bookings || []).filter((booking: any) =>
      booking.activity_id === recordId(activity) &&
      booking.booking_date === date &&
      booking.booking_type === "ACTIVITY" &&
      booking.status === "CONFIRMED"
    );
    const booked = countActivityTickets(bookings);
    const capacity = getActivityCapacity(activity);
    return NextResponse.json({ data: { activity, date, capacity, booked, remaining: Math.max(0, capacity - booked) }, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const activityId = String(body.activityId || "");
  const date = String(body.date || "");
  const ticketCount = Math.max(0, Number(body.ticketCount || 0));
  const paymentMethod = String(body.paymentMethod || "COD");

  if (!activityId || !date || ticketCount < 1) {
    return NextResponse.json({ error: "Activity, date, and ticket quantity are required." }, { status: 400 });
  }
  if (date < todayValue()) {
    return NextResponse.json({ error: "Past date activity bookings are closed." }, { status: 400 });
  }

  try {
    await connectDB();
    const Activity = getGenericModel("activities") as any;
    const Booking = getGenericModel("bookings") as any;
    const Ticket = getGenericModel("tickets") as any;
    const activity = await findActivity(Activity, activityId);
    if (!activity) throw new Error("Activity not found in primary store.");
    if (!isActivityActive(activity)) return NextResponse.json({ error: "Activity is not available." }, { status: 404 });
    if (activity.booking_status === "PAUSED") return NextResponse.json({ error: "Activity booking is paused." }, { status: 409 });

    const activityRecordId = recordId(activity);
    const bookings = await Booking.find({ activity_id: activityRecordId, booking_date: date, booking_type: "ACTIVITY", status: "CONFIRMED" }).lean();
    const capacity = getActivityCapacity(activity);
    const remaining = Math.max(0, capacity - countActivityTickets(bookings));
    if (capacity <= 0 || ticketCount > remaining) {
      return NextResponse.json({ error: `Only ${remaining} ticket(s) available for this activity date.` }, { status: 409 });
    }

    const customer = await ensureMongoCustomer(body.customer || {});
    const now = new Date();
    const bookingReference = createBookingReference(now);
    const bookedBy = customer?.name || body.customer?.name || "Walk-in customer";
    const seatCodes = Array.from({ length: ticketCount }, () => "GENERAL");
    const totalAmount = getActivityPrice(activity) * ticketCount;

    const [booking] = await Booking.insertMany([{
      booking_reference: bookingReference,
      booking_type: "ACTIVITY",
      activity_id: activityRecordId,
      booking_date: date,
      customer_id: customer ? recordId(customer) : null,
      booked_by: bookedBy,
      seat_code: JSON.stringify(seatCodes),
      booking_time: now.toISOString(),
      status: "CONFIRMED",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "COD" ? "COD_PENDING" : "PAID",
      total_amount: totalAmount,
      cancellation_status: "NONE",
    }]);
    const ticketCodes = createTicketCodes(ticketCount, now);
    const tickets = await Ticket.insertMany(seatCodes.map((seatCode, index) => ({
      booking_id: recordId(booking),
      booking_type: "ACTIVITY",
      activity_id: activityRecordId,
      seat_code: seatCode,
      ticket_code: ticketCodes[index],
      price: getActivityPrice(activity),
      generated_by: bookedBy,
      generated_at: now.toISOString(),
      status: "ACTIVE",
    })));
    await createNotification({
      type: "NEW_BOOKING",
      module: "BOOKING",
      title: "New activity booking",
      message: `${bookingReference} was booked for ${activity.title}.`,
      severity: "SUCCESS",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: bookingReference, activity_id: activityRecordId },
    });
    return NextResponse.json({ data: { booking, tickets, remaining: remaining - ticketCount } }, { status: 201 });
  } catch (error: any) {
    const store = await readStore();
    const activity = findLocalActivity(store, activityId);
    if (!activity || !isActivityActive(activity)) return NextResponse.json({ error: "Activity is not available." }, { status: 404 });
    if (activity.booking_status === "PAUSED") return NextResponse.json({ error: "Activity booking is paused." }, { status: 409 });

    const bookings = (store.bookings || []).filter((booking: any) =>
      booking.activity_id === recordId(activity) &&
      booking.booking_date === date &&
      booking.booking_type === "ACTIVITY" &&
      booking.status === "CONFIRMED"
    );
    const capacity = getActivityCapacity(activity);
    const remaining = Math.max(0, capacity - countActivityTickets(bookings));
    if (capacity <= 0 || ticketCount > remaining) {
      return NextResponse.json({ error: `Only ${remaining} ticket(s) available for this activity date.` }, { status: 409 });
    }

    const customer = ensureLocalCustomer(store, body.customer || {});
    const now = new Date();
    const bookingReference = createBookingReference(now);
    const bookedBy = customer?.name || body.customer?.name || "Walk-in customer";
    const seatCodes = Array.from({ length: ticketCount }, () => "GENERAL");
    const booking = {
      id: `bookings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      booking_reference: bookingReference,
      booking_type: "ACTIVITY",
      activity_id: recordId(activity),
      booking_date: date,
      customer_id: customer ? recordId(customer) : null,
      booked_by: bookedBy,
      seat_code: JSON.stringify(seatCodes),
      booking_time: now.toISOString(),
      status: "CONFIRMED",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "COD" ? "COD_PENDING" : "PAID",
      total_amount: getActivityPrice(activity) * ticketCount,
      cancellation_status: "NONE",
    };
    const ticketCodes = createTicketCodes(ticketCount, now);
    const tickets = seatCodes.map((seatCode, index) => ({
      id: `tickets-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      booking_id: recordId(booking),
      booking_type: "ACTIVITY",
      activity_id: recordId(activity),
      seat_code: seatCode,
      ticket_code: ticketCodes[index],
      price: getActivityPrice(activity),
      generated_by: bookedBy,
      generated_at: now.toISOString(),
      status: "ACTIVE",
    }));
    store.bookings = store.bookings || [];
    store.tickets = store.tickets || [];
    store.bookings.push(booking);
    store.tickets.push(...tickets);
    await writeStore(store);
    await createNotification({
      type: "NEW_BOOKING",
      module: "BOOKING",
      title: "New activity booking",
      message: `${bookingReference} was booked for ${activity.title}.`,
      severity: "SUCCESS",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: bookingReference, activity_id: recordId(activity) },
    }).catch(() => null);
    return NextResponse.json({ data: { booking, tickets, remaining: remaining - ticketCount }, fallback: true }, { status: 201 });
  }
}
