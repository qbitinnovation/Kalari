import { NextRequest, NextResponse } from "next/server";
import { settleDueCommissions } from "@/lib/commissionPayout";
import { logCommissionSettlement } from "@/utils/activityLogger.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const paidBy = String(body?.paidBy || "admin").trim() || "admin";
    const result = await settleDueCommissions(paidBy);
    await logCommissionSettlement(paidBy, {
      bookingCount: result.bookingCount,
      agentCount: result.agentCount,
      amount: result.totalAmount,
      scope: "all_due",
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const message = error?.message || "Could not settle due commissions.";
    const status = message.includes("No commissions are due") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
