import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery } from "@/lib/localStore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await connectDB();
    const { slug } = await params;
    const Activity = getGenericModel("activities") as any;
    const activity = await Activity.findOne({ slug }).lean();
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    return NextResponse.json({ data: activity });
  } catch (error: any) {
    const { slug } = await params;
    const activity = await localQuery({ collection: "activities", filters: { slug }, expectSingle: true });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    return NextResponse.json({ data: activity, fallback: true });
  }
}
