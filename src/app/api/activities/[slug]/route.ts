import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery, readStore, writeStore } from "@/lib/localStore";
import mongoose from "mongoose";
import {
  resolveActivityStatus,
  syncActivityRecord,
  syncActivityStatusesLocal,
} from "@/lib/catalogLifecycle";
import { isActivityPubliclyVisible } from "@/lib/activityAvailability";

const recordId = (record: any) => String(record?.id || record?._id || "");

async function syncAndLoadActivity(slug: string) {
  await connectDB();
  const Activity = getGenericModel("activities") as any;
  const or: any[] = [{ slug }, { id: slug }];
  if (mongoose.Types.ObjectId.isValid(slug)) or.push({ _id: new mongoose.Types.ObjectId(slug) });
  const activity = await Activity.findOne({ $or: or }).lean();
  if (!activity) return null;

  const nextStatus = resolveActivityStatus(activity);
  if (nextStatus !== activity.status) {
    await Activity.updateOne(
      { _id: activity._id },
      { $set: { status: nextStatus, updated_at: new Date().toISOString() } },
    );
    activity.status = nextStatus;
  }
  return activity;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publicOnly = new URL(req.url).searchParams.get("public") !== "false";

  try {
    const activity = await syncAndLoadActivity(slug);
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    if (publicOnly && !isActivityPubliclyVisible(activity)) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    return NextResponse.json({ data: activity });
  } catch {
    const store = await readStore();
    if (syncActivityStatusesLocal(store)) await writeStore(store);

    const bySlug = (store.activities || []).find((row: any) => row.slug === slug);
    const byId = (store.activities || []).find((row: any) => recordId(row) === slug);
    const activity = bySlug || byId || null;
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

    syncActivityRecord(activity);
    if (publicOnly && !isActivityPubliclyVisible(activity)) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    await writeStore(store);
    return NextResponse.json({ data: activity, fallback: true });
  }
}
