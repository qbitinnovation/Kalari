import { NextRequest, NextResponse } from "next/server";
import { markCommissionBookingsPaid } from "@/lib/commissionPayout";
import { logCommissionSettlement } from "@/utils/activityLogger.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bookingIds = Array.isArray(body?.bookingIds) ? body.bookingIds.map(String) : [];
    const paidBy = String(body?.paidBy || "admin").trim() || "admin";

    if (!bookingIds.length) {
      return NextResponse.json({ error: "Select at least one booking." }, { status: 400 });
    }

    const result = await markCommissionBookingsPaid(bookingIds, paidBy);
    await logCommissionSettlement(paidBy, {
      bookingCount: result.modifiedCount,
      agentCount: 1,
      amount: null,
      scope: "mark-bookings",
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const message = error?.message || "Could not mark commission paid.";
    const status =
      message.includes("not due") ||
      message.includes("not eligible") ||
      message.includes("not confirmed") ||
      message.includes("No bookings")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
