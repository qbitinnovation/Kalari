import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";
import { createNotification } from "@/lib/notificationStore";
import { buildCancellationPayoutUpdates } from "@/lib/bookingPayoutLifecycle";
import { logBookingCancellationServer } from "@/utils/activityLogger.server";

type ReviewAction = "APPROVE" | "REJECT";

const recordId = (record: any) => String(record?.id || record?._id || "");
const canReview = (role?: string) => role === "admin" || role === "staff";
const isReviewAction = (action: string): action is ReviewAction => action === "APPROVE" || action === "REJECT";

const bookingQuery = (bookingId: string) =>
  mongoose.Types.ObjectId.isValid(bookingId)
    ? { $or: [{ id: bookingId }, { _id: new mongoose.Types.ObjectId(bookingId) }, { booking_reference: bookingId }] }
    : { $or: [{ id: bookingId }, { booking_reference: bookingId }] };

const rejectUnavailableReview = (booking: any) => {
  if (!booking) return "Cancellation request not found.";
  if (booking.cancellation_status !== "PENDING") return "Only pending cancellation requests can be reviewed.";
  return "";
};

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const bookingId = String(body?.bookingId || "");
    const action = String(body?.action || "");
    const reviewerRole = String(body?.reviewerRole || "");
    const reviewerId = String(body?.reviewerId || "");
    if (!bookingId || !isReviewAction(action)) {
      return NextResponse.json({ error: "Booking and review action are required." }, { status: 400 });
    }
    if (!canReview(reviewerRole)) {
      return NextResponse.json({ error: "Only admin or staff can review cancellation requests." }, { status: 403 });
    }

    await connectDB();
    const Booking = getGenericModel("bookings") as any;
    const Ticket = getGenericModel("tickets") as any;
    const booking = await Booking.findOne(bookingQuery(bookingId)).lean();
    const unavailable = rejectUnavailableReview(booking);
    if (unavailable) return NextResponse.json({ error: unavailable }, { status: 400 });

    const now = new Date().toISOString();
    if (action === "APPROVE") {
      const payoutUpdates = buildCancellationPayoutUpdates(booking, now);
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            status: "CANCELLED",
            cancellation_status: "APPROVED",
            cancellation_reviewed_at: now,
            cancellation_reviewed_by: reviewerId || reviewerRole,
            ...payoutUpdates,
          },
        }
      );
      await Ticket.updateMany(
        { booking_id: recordId(booking), status: { $in: ["ACTIVE"] } },
        { $set: { status: "REVOKED", revoked_at: now } }
      );
    } else {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            cancellation_status: "REJECTED",
            cancellation_reviewed_at: now,
            cancellation_reviewed_by: reviewerId || reviewerRole,
          },
        }
      );
    }
    await createNotification({
      type: "CANCELLATION_REVIEW",
      module: "CANCELLATION",
      title: action === "APPROVE" ? "Cancellation approved" : "Cancellation rejected",
      message: `Booking ${booking.booking_reference || recordId(booking)} cancellation request was ${action === "APPROVE" ? "approved" : "rejected"}.`,
      severity: action === "APPROVE" ? "WARNING" : "INFO",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: booking.booking_reference, action },
    });

    if (action === "APPROVE") {
      const payoutUpdates = buildCancellationPayoutUpdates(booking, now);
      await logBookingCancellationServer(
        recordId(booking),
        booking.booking_reference || "Booking",
        reviewerId || reviewerRole || "admin",
        {
          cancellation_reason: booking.cancellation_reason,
          commission_clawback_required: payoutUpdates.commission_clawback_required,
          vendor_payout_clawback_required: payoutUpdates.vendor_payout_clawback_required,
        },
      );
      if (payoutUpdates.commission_clawback_required || payoutUpdates.vendor_payout_clawback_required) {
        await createNotification({
          type: "PAYOUT_CLAWBACK_REQUIRED",
          module: "CANCELLATION",
          title: "Payout clawback may be required",
          message: `Booking ${booking.booking_reference || recordId(booking)} was cancelled after a payout was already marked paid. Review agent/vendor settlements.`,
          severity: "WARNING",
          entity_type: "booking",
          entity_id: recordId(booking),
          action_url: "/admin/tickets",
          metadata: {
            commission_clawback_required: payoutUpdates.commission_clawback_required,
            vendor_payout_clawback_required: payoutUpdates.vendor_payout_clawback_required,
            commission_amount_at_cancel: payoutUpdates.commission_amount_at_cancel,
            vendor_payout_amount_at_cancel: payoutUpdates.vendor_payout_amount_at_cancel,
          },
        });
      }
    }

    return NextResponse.json({ data: { success: true, action } });
  } catch {
    const bookingId = String(body?.bookingId || "");
    const action = String(body?.action || "");
    const reviewerRole = String(body?.reviewerRole || "");
    const reviewerId = String(body?.reviewerId || "");
    if (!bookingId || !isReviewAction(action)) {
      return NextResponse.json({ error: "Booking and review action are required." }, { status: 400 });
    }
    if (!canReview(reviewerRole)) {
      return NextResponse.json({ error: "Only admin or staff can review cancellation requests." }, { status: 403 });
    }

    const store = await readStore();
    store.bookings = store.bookings || [];
    store.tickets = store.tickets || [];
    const bookingIndex = store.bookings.findIndex((booking: any) =>
      recordId(booking) === bookingId || booking.booking_reference === bookingId
    );
    const booking = bookingIndex >= 0 ? store.bookings[bookingIndex] : null;
    const unavailable = rejectUnavailableReview(booking);
    if (unavailable) return NextResponse.json({ error: unavailable }, { status: 400 });

    const now = new Date().toISOString();
    const payoutUpdates = action === "APPROVE" ? buildCancellationPayoutUpdates(booking, now) : null;
    store.bookings[bookingIndex] = {
      ...booking,
      ...(action === "APPROVE" ? { status: "CANCELLED", ...payoutUpdates } : {}),
      cancellation_status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      cancellation_reviewed_at: now,
      cancellation_reviewed_by: reviewerId || reviewerRole,
    };

    if (action === "APPROVE") {
      const reviewedBookingId = recordId(booking);
      store.tickets = store.tickets.map((ticket: any) =>
        ticket.booking_id === reviewedBookingId && ticket.status === "ACTIVE"
          ? { ...ticket, status: "REVOKED", revoked_at: now }
          : ticket
      );
    }
    await writeStore(store);
    await createNotification({
      type: "CANCELLATION_REVIEW",
      module: "CANCELLATION",
      title: action === "APPROVE" ? "Cancellation approved" : "Cancellation rejected",
      message: `Booking ${booking.booking_reference || recordId(booking)} cancellation request was ${action === "APPROVE" ? "approved" : "rejected"}.`,
      severity: action === "APPROVE" ? "WARNING" : "INFO",
      entity_type: "booking",
      entity_id: recordId(booking),
      action_url: "/admin/tickets",
      metadata: { booking_reference: booking.booking_reference, action },
    });

    if (action === "APPROVE") {
      const localPayoutUpdates = buildCancellationPayoutUpdates(booking, now);
      await logBookingCancellationServer(
        recordId(booking),
        booking.booking_reference || "Booking",
        reviewerId || reviewerRole || "admin",
        {
          cancellation_reason: booking.cancellation_reason,
          commission_clawback_required: localPayoutUpdates.commission_clawback_required,
          vendor_payout_clawback_required: localPayoutUpdates.vendor_payout_clawback_required,
        },
      );
      if (localPayoutUpdates.commission_clawback_required || localPayoutUpdates.vendor_payout_clawback_required) {
        await createNotification({
          type: "PAYOUT_CLAWBACK_REQUIRED",
          module: "CANCELLATION",
          title: "Payout clawback may be required",
          message: `Booking ${booking.booking_reference || recordId(booking)} was cancelled after a payout was already marked paid. Review agent/vendor settlements.`,
          severity: "WARNING",
          entity_type: "booking",
          entity_id: recordId(booking),
          action_url: "/admin/tickets",
          metadata: {
            commission_clawback_required: localPayoutUpdates.commission_clawback_required,
            vendor_payout_clawback_required: localPayoutUpdates.vendor_payout_clawback_required,
          },
        });
      }
    }

    return NextResponse.json({ data: { success: true, action }, fallback: true });
  }
}
