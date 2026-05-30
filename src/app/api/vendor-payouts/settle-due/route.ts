import { NextRequest, NextResponse } from "next/server";
import { settleDueVendorPayouts } from "@/lib/vendorCommissionPayout";
import { logVendorPayoutSettlement } from "@/utils/activityLogger.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const paidBy = String(body?.paidBy || "admin").trim() || "admin";

    const result = await settleDueVendorPayouts(paidBy);
    await logVendorPayoutSettlement(paidBy, {
      bookingCount: result.bookingCount,
      vendorCount: result.vendorCount,
      amount: result.totalAmount,
      scope: "all-due",
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const message = error?.message || "Could not settle vendor payouts.";
    const status = message.includes("No vendor payouts are due") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
