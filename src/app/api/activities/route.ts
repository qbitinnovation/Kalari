import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery } from "@/lib/localStore";

const getActivityPayload = async (req: NextRequest) => {
  await connectDB();
  const Activity = getGenericModel("activities") as any;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "ACTIVE";
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  const filters: Record<string, any> = {};
  if (status !== "ALL") filters.status = status;
  if (category) filters.category = category;
  if (featured === "true") filters.featured = true;

  const activities = await Activity.find(filters).sort({ featured: -1, rating: -1, title: 1 }).lean();
  return activities;
};

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ data: await getActivityPayload(req) });
  } catch (error: any) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ACTIVE";
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const filters: Record<string, any> = {};
    if (status !== "ALL") filters.status = status;
    if (category) filters.category = category;
    if (featured === "true") filters.featured = true;
    return NextResponse.json({ data: await localQuery({ collection: "activities", filters, orderBy: { column: "title", ascending: true } }), fallback: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const Activity = getGenericModel("activities") as any;
    const payload = await req.json();
    const now = new Date().toISOString();
    const doc = await Activity.create({
      ...payload,
      id: payload.id || `activity-${Date.now()}`,
      slug: payload.slug || String(payload.title || `activity-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      status: payload.status || "ACTIVE",
      featured: Boolean(payload.featured),
      created_at: payload.created_at || now,
      updated_at: now,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error: any) {
    const payload = await req.json().catch(() => ({}));
    return NextResponse.json({ data: await localQuery({ collection: "activities", operation: "insert", insertPayload: [payload] }), fallback: true }, { status: 201 });
  }
}
