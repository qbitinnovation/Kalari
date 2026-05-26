import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery } from "@/lib/localStore";
import mongoose from "mongoose";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await connectDB();
    const { slug } = await params;
    const Activity = getGenericModel("activities") as any;
    const or: any[] = [{ slug }, { id: slug }];
    if (mongoose.Types.ObjectId.isValid(slug)) or.push({ _id: new mongoose.Types.ObjectId(slug) });
    const activity = await Activity.findOne({ $or: or }).lean();
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    return NextResponse.json({ data: activity });
  } catch (error: any) {
    const { slug } = await params;
    const bySlug = await localQuery({ collection: "activities", filters: { slug }, expectSingle: true });
    const activity = bySlug || await localQuery({ collection: "activities", filters: { id: slug }, expectSingle: true });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    return NextResponse.json({ data: activity, fallback: true });
  }
}
