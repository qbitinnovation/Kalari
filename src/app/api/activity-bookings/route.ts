import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { createBookingReference, createTicketCodes, parseSeatCodes } from "@/lib/booking";
import { readStore, writeStore } from "@/lib/localStore";
import { createNotification } from "@/lib/notificationStore";
import { isActivityBookingDateAllowed, isActivityPubliclyBookable } from "@/lib/activityAvailability";
import { calculateEventCommission, getCommissionPeriodKey } from "@/lib/agentCommission";
import {
  getBookingCustomerErrors,
  getBookingEmailError,
  hasBookingCustomerErrors,
  normalizeBookingPhone,
} from "@/lib/bookingCustomer";
import { isValidIndianMobileDigits } from "@/lib/indianPhone";

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
  return String(phone || "").replace(/[^\d+]/g, "").trim();
};

const validateCustomerInput = (customerInput: any) => {
  const errors = getBookingCustomerErrors({
    name: String(customerInput?.name || ""),
    phone: String(customerInput?.phone || ""),
    email: String(customerInput?.email || ""),
  });
  if (hasBookingCustomerErrors(errors)) {
    return errors.name || errors.phone || errors.email || "Customer name and mobile number are required.";
  }
  return "";
};

const validateExistingCustomer = (customer: any) => {
  const name = String(customer?.name || "").trim();
  const phone = normalizePhone(customer?.phone || "");
  if (!name || name.toLowerCase() === "guest customer") {
    return "Customer name is required.";
  }
  if (!phone || !isValidIndianMobileDigits(phone)) {
    return "Valid customer mobile number is required.";
  }
  const emailError = getBookingEmailError(String(customer?.email || ""));
  if (emailError) return emailError;
  return "";
};

const getActivityPrice = (activity: any) => Number(activity?.booking_price || activity?.price || 0);
const getActivityCapacity = (activity: any) => Number(activity?.daily_capacity || 20);
const isActivityActive = (activity: any) =>
  String(activity?.status || "ACTIVE").toUpperCase() === "ACTIVE";

const findLocalAgent = (store: any, agentId: string) =>
  (store.agents || []).find((agent: any) => recordId(agent) === agentId);

async function findAgent(agentId: string) {
  if (!agentId) return null;
  try {
    await connectDB();
    const Agent = getGenericModel("agents") as any;
    const or: any[] = [{ id: agentId }];
    if (isObjectId(agentId)) or.push({ _id: new mongoose.Types.ObjectId(agentId) });
    return Agent.findOne({ $or: or }).lean();
  } catch {
    const store = await readStore();
    return findLocalAgent(store, agentId);
  }
}

const buildCommissionFields = async (activity: any, totalAmount: number, bookingTime: Date) => {
  const agentId = String(activity?.agent_id || "");
  const commissionPercentage = agentId ? Number(activity?.agent_commission_percentage || 0) : 0;
  const commissionAmount = agentId
    ? calculateEventCommission(totalAmount, commissionPercentage)
    : 0;
  const agent = commissionAmount > 0 ? await findAgent(agentId) : null;
  return {
    agent_id: agentId || null,
    agent_commission_percentage: commissionPercentage,
    commission_amount: commissionAmount,
    commission_status: commissionAmount > 0 ? "UNPAID" : "PAID",
    commission_period_key:
      commissionAmount > 0
        ? getCommissionPeriodKey(bookingTime, agent?.payout_frequency || "DAILY")
        : null,
  };
};

const buildLocalCommissionFields = (store: any, activity: any, totalAmount: number, bookingTime: Date) => {
  const agentId = String(activity?.agent_id || "");
  const commissionPercentage = agentId ? Number(activity?.agent_commission_percentage || 0) : 0;
  const commissionAmount = agentId
    ? calculateEventCommission(totalAmount, commissionPercentage)
    : 0;
  const agent = commissionAmount > 0 ? findLocalAgent(store, agentId) : null;
  return {
    agent_id: agentId || null,
    agent_commission_percentage: commissionPercentage,
    commission_amount: commissionAmount,
    commission_status: commissionAmount > 0 ? "UNPAID" : "PAID",
    commission_period_key:
      commissionAmount > 0
        ? getCommissionPeriodKey(bookingTime, agent?.payout_frequency || "DAILY")
        : null,
  };
};

const countActivityTickets = (bookings: any[]) =>
  bookings
    .filter((booking) => booking.status === "CONFIRMED")
    .reduce((total, booking) => total + parseSeatCodes(booking.seat_code).length, 0);

async function ensureMongoCustomer(customerInput: any) {
  const Customer = getGenericModel("customers") as any;
  const customerId = String(customerInput?.id || customerInput?.customerId || "");
  if (customerId) {
    const byId = await Customer.findOne(isObjectId(customerId) ? { $or: [{ id: customerId }, { _id: new mongoose.Types.ObjectId(customerId) }] } : { id: customerId }).lean();
    if (byId) {
      const existingError = validateExistingCustomer(byId);
      if (existingError) throw new Error(existingError);
      const name = String(customerInput?.name || byId.name || "").trim();
      const email = String(customerInput?.email ?? byId.email ?? "").trim();
      if (name !== byId.name || email !== (byId.email || "")) {
        await Customer.updateOne(
          { _id: byId._id },
          { $set: { name, email, updated_at: new Date().toISOString() } },
        );
        return { ...byId, name, email };
      }
      return byId;
    }
  }

  const inputError = validateCustomerInput(customerInput);
  if (inputError) throw new Error(inputError);

  const phone = normalizePhone(customerInput?.phone || "");
  const existing = await Customer.findOne({ phone }).lean();
  if (existing) {
    const name = String(customerInput?.name || existing.name || "").trim();
    const email = String(customerInput?.email ?? existing.email ?? "").trim();
    await Customer.updateOne(
      { _id: existing._id },
      { $set: { name, email, updated_at: new Date().toISOString() } },
    );
    return { ...existing, name, email };
  }

  return Customer.create({
    id: `customers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(customerInput?.name || "").trim(),
    email: String(customerInput?.email || "").trim(),
    phone,
    phone_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

function ensureLocalCustomer(store: any, customerInput: any) {
  const customerId = String(customerInput?.id || customerInput?.customerId || "");
  if (customerId) {
    const byId = (store.customers || []).find((customer: any) => recordId(customer) === customerId);
    if (byId) {
      const existingError = validateExistingCustomer(byId);
      if (existingError) throw new Error(existingError);
      const name = String(customerInput?.name || byId.name || "").trim();
      const email = String(customerInput?.email ?? byId.email ?? "").trim();
      byId.name = name;
      byId.email = email;
      byId.updated_at = new Date().toISOString();
      return byId;
    }
  }

  const inputError = validateCustomerInput(customerInput);
  if (inputError) throw new Error(inputError);

  const phone = normalizePhone(customerInput?.phone || "");
  store.customers = store.customers || [];
  const existing = store.customers.find((customer: any) => customer.phone === phone);
  if (existing) {
    existing.name = String(customerInput?.name || existing.name || "").trim();
    existing.email = String(customerInput?.email ?? existing.email ?? "").trim();
    existing.updated_at = new Date().toISOString();
    return existing;
  }

  const customer = {
    id: `customers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(customerInput?.name || "").trim(),
    email: String(customerInput?.email || "").trim(),
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
    if (!isActivityPubliclyBookable(activity)) {
      return NextResponse.json({ error: "Activity is not available for booking." }, { status: 404 });
    }
    if (activity.booking_status === "PAUSED") {
      return NextResponse.json({ error: "Activity booking is paused." }, { status: 409 });
    }
    if (!isActivityBookingDateAllowed(activity, date)) {
      return NextResponse.json({ error: "Selected date is outside this activity's booking window." }, { status: 409 });
    }

    const activityRecordId = recordId(activity);
    const bookings = await Booking.find({ activity_id: activityRecordId, booking_date: date, booking_type: "ACTIVITY", status: "CONFIRMED" }).lean();
    const capacity = getActivityCapacity(activity);
    const remaining = Math.max(0, capacity - countActivityTickets(bookings));
    if (capacity <= 0 || ticketCount > remaining) {
      return NextResponse.json({ error: `Only ${remaining} ticket(s) available for this activity date.` }, { status: 409 });
    }

    const customer = await ensureMongoCustomer({ ...(body.customer || {}), customerId: body.customerId });
    const now = new Date();
    const bookingReference = createBookingReference(now);
    const bookedBy = customer?.name || body.customer?.name || "Walk-in customer";
    const seatCodes = Array.from({ length: ticketCount }, () => "GENERAL");
    const totalAmount = getActivityPrice(activity) * ticketCount;
    const commissionFields = await buildCommissionFields(activity, totalAmount, now);

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
      ...commissionFields,
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
    if (!isActivityPubliclyBookable(activity)) {
      return NextResponse.json({ error: "Activity is not available for booking." }, { status: 404 });
    }
    if (activity.booking_status === "PAUSED") return NextResponse.json({ error: "Activity booking is paused." }, { status: 409 });
    if (!isActivityBookingDateAllowed(activity, date)) {
      return NextResponse.json({ error: "Selected date is outside this activity's booking window." }, { status: 409 });
    }

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

    const customer = ensureLocalCustomer(store, { ...(body.customer || {}), customerId: body.customerId });
    const now = new Date();
    const bookingReference = createBookingReference(now);
    const bookedBy = customer?.name || body.customer?.name || "Walk-in customer";
    const seatCodes = Array.from({ length: ticketCount }, () => "GENERAL");
    const totalAmount = getActivityPrice(activity) * ticketCount;
    const commissionFields = buildLocalCommissionFields(store, activity, totalAmount, now);
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
      total_amount: totalAmount,
      cancellation_status: "NONE",
      ...commissionFields,
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
