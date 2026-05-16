import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery } from "@/lib/localStore";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const Show = getGenericModel("shows") as any;
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get("upcoming") !== "false";
    const activityId = searchParams.get("activityId");

    const filters: Record<string, any> = {};
    if (upcoming) {
      filters.date = { $gte: new Date().toISOString().split("T")[0] };
      filters.status = { $in: ["ACTIVE", "HOUSE_FULL"] };
    }
    if (activityId) filters.activity_id = activityId;

    const shows = await Show.find(filters).sort({ date: 1, time: 1 }).lean();
    return NextResponse.json({ data: shows });
  } catch (error: any) {
    const { searchParams } = new URL(req.url);
    const rangeFilters: Record<string, any> = {};
    const filters: Record<string, any> = {};
    if (searchParams.get("upcoming") !== "false") {
      rangeFilters.date = { gte: new Date().toISOString().split("T")[0] };
    }
    if (searchParams.get("activityId")) filters.activity_id = searchParams.get("activityId");
    return NextResponse.json({ data: await localQuery({ collection: "shows", filters, rangeFilters, orderBy: { column: "date", ascending: true } }), fallback: true });
  }
}
