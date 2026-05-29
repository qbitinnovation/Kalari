import { NextResponse } from "next/server";
import { backfillAgentPublicIds } from "@/lib/agentIdBackfill";

export async function POST() {
  const result = await backfillAgentPublicIds();
  return NextResponse.json({ data: result });
}
