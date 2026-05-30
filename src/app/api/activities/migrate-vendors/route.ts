import { NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { readStore, writeStore } from "@/lib/localStore";

const clearAgentFields = (activity: Record<string, unknown>) => {
  const next = { ...activity };
  delete next.agent_id;
  delete next.agent_commission_percentage;
  return next;
};

async function migrateActivitiesMongo() {
  await connectDB();
  const Activity = getGenericModel("activities") as any;
  const result = await Activity.updateMany(
    {},
    { $unset: { agent_id: "", agent_commission_percentage: "" } },
  );
  return { updated: result.modifiedCount ?? result.nModified ?? 0 };
}

async function migrateActivitiesLocal() {
  const store = await readStore();
  store.activities = (store.activities || []).map((activity: Record<string, unknown>) =>
    clearAgentFields(activity),
  );
  await writeStore(store);
  return { updated: store.activities.length };
}

export async function POST() {
  try {
    const result = await migrateActivitiesMongo();
    return NextResponse.json({ data: result });
  } catch {
    const result = await migrateActivitiesLocal();
    return NextResponse.json({ data: result });
  }
}
