import { NextRequest, NextResponse } from "next/server";
import connectDB, { getGenericModel } from "@/lib/db";
import { localQuery } from "@/lib/localStore";
import { countBookedSeats, getAvailabilityStatus, getRecordId, getShowCapacity, isShowBookableAt } from "@/lib/booking";

const enrichShows = async (shows: any[]) => {
  const Layout = getGenericModel("layouts") as any;
  const Booking = getGenericModel("bookings") as any;
  const [layouts, bookings] = await Promise.all([
    Layout.find().lean(),
    Booking.find({ status: { $in: ["CONFIRMED", "HELD"] } }).lean(),
  ]);

  const layoutById = new Map<string, any>();
  layouts.forEach((layout: any) => layoutById.set(String(getRecordId(layout)), layout));

  const bookingsByShow = new Map<string, any[]>();
  bookings.forEach((booking: any) => {
    const showId = String(booking.show_id);
    bookingsByShow.set(showId, [...(bookingsByShow.get(showId) || []), booking]);
  });

  return shows.map((show: any) => {
    const next = { ...show };
    if (next.layout_id) next.layout = layoutById.get(String(next.layout_id)) || null;
    const capacity = getShowCapacity(next);
    const booked = countBookedSeats(bookingsByShow.get(String(getRecordId(next))) || []);
    return {
      ...next,
      booked_count: booked,
      available_count: Math.max(0, capacity - booked),
      availability_status: getAvailabilityStatus(capacity, booked),
    };
  });
};

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
      filters.status = "ACTIVE";
    }
    if (activityId) filters.activity_id = activityId;

    const shows = await Show.find(filters).sort({ date: 1, time: 1 }).lean();
    const enriched = await enrichShows(upcoming ? shows.filter((show: any) => isShowBookableAt(show)) : shows);
    return NextResponse.json({
      data: upcoming
        ? enriched.filter((show: any) => show.availability_status !== "SOLD_OUT" && Number(show.available_count ?? 1) > 0)
        : enriched
    });
  } catch (error: any) {
    const { searchParams } = new URL(req.url);
    const rangeFilters: Record<string, any> = {};
    const filters: Record<string, any> = {};
    if (searchParams.get("upcoming") !== "false") {
      rangeFilters.date = { gte: new Date().toISOString().split("T")[0] };
      filters.status = "ACTIVE";
    }
    if (searchParams.get("activityId")) filters.activity_id = searchParams.get("activityId");
    const data = await localQuery({ collection: "shows", filters, rangeFilters, orderBy: { column: "date", ascending: true } });
    return NextResponse.json({
      data: searchParams.get("upcoming") !== "false"
        ? data.filter((show: any) =>
            isShowBookableAt(show) &&
            show.availability_status !== "SOLD_OUT" &&
            Number(show.available_count ?? 1) > 0
          )
        : data,
      fallback: true
    });
  }
}
