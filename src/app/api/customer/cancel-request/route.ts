import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";
import mongoose from "mongoose";
import { createNotification } from "@/lib/notificationStore";

const recordId = (record: any) => String(record?.id || record?._id || "");

const canRequestCancellation = (booking: any) => {
  if (!booking || booking.status !== "CONFIRMED") return false;
  if (booking.cancellation_status === "PENDING") return false;
  return true;
};

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const bookingId = String(body?.bookingId || "");
    const customerId = String(body?.customerId || "");
    const reason = String(body?.reason || "").trim();
    if (!bookingId || !reason) {
      return NextResponse.json({ error: "Booking and reason are required" }, { status: 400 });
    }

    await connectDB();
    const Booking = getGenericModel("bookings") as any;
    const idQuery = mongoose.Types.ObjectId.isValid(bookingId)
      ? { $or: [{ id: bookingId }, { _id: new mongoose.Types.ObjectId(bookingId) }, { booking_reference: bookingId }] }
      : { $or: [{ id: bookingId }, { booking_reference: bookingId }] };
    const booking = await Booking.findOne(idQuery).lean();
    if (!canRequestCancellation(booking)) {
      return NextResponse.json({ error: "This booking cannot receive a cancellation request" }, { status: 400 });
    }
    if (customerId && String(booking.customer_id) !== customerId) {
      return NextResponse.json({ error: "Booking does not belong to this customer" }, { status: 403 });
    }

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          cancellation_requested: true,
          cancellation_reason: reason,
          cancellation_requested_at: new Date().toISOString(),
          cancellation_status: "PENDING",
        },
      }
    );
    await createNotification({
      type: "CANCELLATION_REQUEST",
      module: "CANCELLATION",
      title: "Cancellation request received",
      message: `Booking ${booking.booking_reference || recordId(booking)} has a customer cancellation request.`,
      severity: "WARNING",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: booking.booking_reference, reason },
    });

    return NextResponse.json({ data: { success: true } });
  } catch {
    const bookingId = String(body?.bookingId || "");
    const customerId = String(body?.customerId || "");
    const reason = String(body?.reason || "").trim();
    if (!bookingId || !reason) {
      return NextResponse.json({ error: "Booking and reason are required" }, { status: 400 });
    }

    const store = await readStore();
    store.bookings = store.bookings || [];
    const bookingIndex = store.bookings.findIndex((booking: any) => recordId(booking) === bookingId || booking.booking_reference === bookingId);
    const booking = bookingIndex >= 0 ? store.bookings[bookingIndex] : null;
    if (!canRequestCancellation(booking)) {
      return NextResponse.json({ error: "This booking cannot receive a cancellation request" }, { status: 400 });
    }
    if (customerId && String(booking.customer_id) !== customerId) {
      return NextResponse.json({ error: "Booking does not belong to this customer" }, { status: 403 });
    }

    store.bookings[bookingIndex] = {
      ...booking,
      cancellation_requested: true,
      cancellation_reason: reason,
      cancellation_requested_at: new Date().toISOString(),
      cancellation_status: "PENDING",
    };
    await writeStore(store);
    await createNotification({
      type: "CANCELLATION_REQUEST",
      module: "CANCELLATION",
      title: "Cancellation request received",
      message: `Booking ${booking.booking_reference || recordId(booking)} has a customer cancellation request.`,
      severity: "WARNING",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: booking.booking_reference, reason },
    });

    return NextResponse.json({ data: { success: true }, fallback: true });
  }
}
