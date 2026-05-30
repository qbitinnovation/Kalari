import { NextRequest, NextResponse } from "next/server";
import { settleDueCommissionsForAgent } from "@/lib/commissionPayout";
import { logCommissionSettlement } from "@/utils/activityLogger.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentId = String(body?.agentId || "").trim();
    const paidBy = String(body?.paidBy || "admin").trim() || "admin";
    const periodKey = String(body?.periodKey || "").trim() || undefined;

    if (!agentId) {
      return NextResponse.json({ error: "Agent is required." }, { status: 400 });
    }

    const result = await settleDueCommissionsForAgent(agentId, paidBy, periodKey);
    await logCommissionSettlement(paidBy, {
      bookingCount: result.bookingCount,
      agentCount: 1,
      amount: result.totalAmount,
      scope: periodKey ? `agent:${agentId}:${periodKey}` : `agent:${agentId}`,
    });
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const message = error?.message || "Could not settle agent commissions.";
    const status = message.includes("No commissions are due") || message.includes("not found") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
