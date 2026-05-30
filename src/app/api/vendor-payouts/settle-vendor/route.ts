import { NextRequest, NextResponse } from "next/server";
import { settleDueVendorPayoutsForVendor } from "@/lib/vendorCommissionPayout";
import { logVendorPayoutSettlement } from "@/utils/activityLogger.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body?.vendorId || "").trim();
    const paidBy = String(body?.paidBy || "admin").trim() || "admin";
    const periodKey = String(body?.periodKey || "").trim() || undefined;

    if (!vendorId) {
      return NextResponse.json({ error: "Vendor is required." }, { status: 400 });
    }

    const result = await settleDueVendorPayoutsForVendor(vendorId, paidBy, periodKey);
    await logVendorPayoutSettlement(paidBy, {
      bookingCount: result.bookingCount,
      vendorCount: 1,
      amount: result.totalAmount,
      scope: periodKey ? `vendor:${vendorId}:${periodKey}` : `vendor:${vendorId}`,
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const message = error?.message || "Could not settle vendor payouts.";
    const status = message.includes("No vendor payouts are due") || message.includes("not found") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
