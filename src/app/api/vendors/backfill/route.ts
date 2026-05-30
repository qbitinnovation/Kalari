import { NextResponse } from "next/server";
import { backfillVendorPublicIds } from "@/lib/vendorIdBackfill";

export async function POST() {
  const result = await backfillVendorPublicIds();
  return NextResponse.json({ data: result });
}
