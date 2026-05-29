import { NextRequest, NextResponse } from "next/server";
import { ensureCommissionDueReminders, type ReminderSlot } from "@/lib/commissionReminders";

const validSlots = new Set<ReminderSlot>(["morning", "evening"]);

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = String(req.nextUrl.searchParams.get("slot") || "") as ReminderSlot;
  if (!validSlots.has(slot)) {
    return NextResponse.json({ error: "Valid slot (morning|evening) is required." }, { status: 400 });
  }

  const result = await ensureCommissionDueReminders({ slot });
  return NextResponse.json({ data: result });
}
