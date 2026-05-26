import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB, { getGenericModel, User } from "@/lib/db";
import { getSeedData } from "@/lib/seedData";
import { resetLocalStore } from "@/lib/localStore";
import { ensureLocalBootstrapUsers, ensureMongoBootstrapUsers, envCredentialSummary } from "@/lib/bootstrapUsers";

const seedCollection = async (collection: string, rows: any[]) => {
  const Model = getGenericModel(collection) as any;
  await Model.deleteMany({});
  if (rows.length > 0) {
    await Model.insertMany(rows.map(row => ({
      ...row,
      created_at: row.created_at || new Date().toISOString()
    })));
  }
  return Model.countDocuments();
};


async function seed() {
  await connectDB();
  const data = getSeedData();
  await ensureMongoBootstrapUsers();
  const UserModel = User as any;
  const password_hash = await bcrypt.hash("admin123", 10);
  const staff_password_hash = await bcrypt.hash("staff123", 10);
  await UserModel.updateOne(
    { email: "admin@kalari.local" },
    {
      $set: {
        email: "admin@kalari.local",
        password_hash,
        role: "admin",
        full_name: "Kalari Admin",
        active: true,
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: { created_at: new Date().toISOString() },
    },
    { upsert: true }
  );

  await UserModel.updateOne(
    { email: "staff@kalari.local" },
    {
      $set: {
        email: "staff@kalari.local",
        password_hash: staff_password_hash,
        role: "staff",
        full_name: "Kalari Staff",
        active: true,
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: { created_at: new Date().toISOString() },
    },
    { upsert: true }
  );

  const [activityCount, showCount, layoutCount] = await Promise.all([
    seedCollection("activities", data.activities),
    seedCollection("shows", data.shows),
    seedCollection("layouts", data.layouts),
  ]);
  const agentCount = await seedCollection("agents", [{
    id: "agent-local",
    name: "Booking Agent",
    phone: "+91 98765 43210",
    payout_frequency: "MONTHLY",
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }]);

  return {
    ok: true,
    credentials: {
      ...envCredentialSummary(),
      localAdmin: "admin@kalari.local / admin123",
      staff: "staff@kalari.local / staff123",
    },
    counts: {
      activities: activityCount,
      shows: showCount,
      layouts: layoutCount,
      agents: agentCount,
    },
  };
}

export async function GET() {
  try {
    return NextResponse.json(await seed());
  } catch (error: any) {
    const store = await resetLocalStore();
    await ensureLocalBootstrapUsers();
    return NextResponse.json({
      ok: true,
      fallback: true,
      note: "MongoDB is not available, so seed data was written to .data/kalary-store.json.",
      credentials: {
        ...envCredentialSummary(),
        localAdmin: "admin@kalari.local / admin123",
        staff: "staff@kalari.local / staff123",
      },
      counts: {
        activities: store.activities.length,
        shows: store.shows.length,
        layouts: store.layouts.length,
        agents: (store.agents || []).length,
      },
      mongoError: error.message || "Seed failed",
    });
  }
}

export async function POST() {
  return GET();
}
