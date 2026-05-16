import { NextResponse } from "next/server";
import { resetLocalStore } from "@/lib/localStore";

export async function GET() {
  const store = await resetLocalStore();
  return NextResponse.json({
    ok: true,
    message: "Store reset to latest seed data",
    counts: {
      activities: store.activities.length,
      shows: store.shows.length,
    }
  });
}
