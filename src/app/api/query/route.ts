import { NextRequest, NextResponse } from 'next/server';
import connectDB, { getGenericModel } from '@/lib/db';
import mongoose from 'mongoose';
import { localQuery } from '@/lib/localStore';
import { assignAgentIds } from '@/lib/agentId';
import { assignVendorIds } from '@/lib/vendorId';
import { backfillAgentPublicIds } from '@/lib/agentIdBackfill';
import { backfillVendorPublicIds } from '@/lib/vendorIdBackfill';
import { countBookedSeats, getAvailabilityStatus, getRecordId, getShowCapacity, isShowBookableAt } from '@/lib/booking';
import {
  syncAllActivitiesInMongo,
  syncAllShowsInMongo,
} from '@/lib/catalogLifecycle';

const normalizeIdValue = (value: any) => {
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

const normalizeFilters = (filters: Record<string, any> = {}) => {
  const next: Record<string, any> = { ...filters };
  if (next.id !== undefined && next._id === undefined && mongoose.Types.ObjectId.isValid(next.id)) {
    next._id = normalizeIdValue(next.id);
    delete next.id;
  }
  return next;
};

const applyFilters = (query: any, filters = {}, inFilters = {}, rangeFilters = {}) => {
  Object.entries(filters || {}).forEach(([key, value]) => {
    const field = key === "id" && mongoose.Types.ObjectId.isValid(value as any) ? "_id" : key;
    query.where(field).equals(field === "_id" ? normalizeIdValue(value) : value);
  });

  Object.entries(inFilters || {}).forEach(([key, values]) => {
    const canUseObjectIds = Array.isArray(values) && values.every((value) => mongoose.Types.ObjectId.isValid(value));
    const field = key === "id" && canUseObjectIds ? "_id" : key;
    query.where(field).in((values as any[]).map((value) => field === "_id" ? normalizeIdValue(value) : value));
  });

  Object.entries(rangeFilters || {}).forEach(([key, range]: [string, any]) => {
    if (range.gte !== undefined) {
      query.where(key).gte(range.gte);
    }
    if (range.lte !== undefined) {
      query.where(key).lte(range.lte);
    }
  });

  return query;
};

const recordId = (row: any) => row?.id || (row?._id ? String(row._id) : undefined);

const attachRelations = async (collection: string, docs: any[] | any) => {
  const rows = Array.isArray(docs) ? docs : docs ? [docs] : [];
  if (rows.length === 0) return docs;

  if (collection === "shows") {
    const Layout = getGenericModel("layouts") as any;
    const layouts = await Layout.find().lean();
    const layoutById = new Map<string, any>();
    layouts.forEach((layout: any) => {
      const id = recordId(layout);
      if (id) layoutById.set(id, layout);
    });
    rows.forEach((show: any) => {
      if (show.layout_id) show.layout = layoutById.get(String(show.layout_id)) || null;
    });
    const Booking = getGenericModel("bookings") as any;
    const bookings = await Booking.find({ show_id: { $in: rows.map((show: any) => String(getRecordId(show))) }, status: { $in: ["CONFIRMED", "HELD"] } }).lean();
    const bookingsByShow = new Map<string, any[]>();
    bookings.forEach((booking: any) => {
      const key = String(booking.show_id);
      bookingsByShow.set(key, [...(bookingsByShow.get(key) || []), booking]);
    });
    rows.forEach((show: any) => {
      const showId = String(getRecordId(show));
      const capacity = getShowCapacity(show);
      const booked = countBookedSeats(bookingsByShow.get(showId) || []);
      show.booked_count = booked;
      show.available_count = Math.max(0, capacity - booked);
      show.availability_status = getAvailabilityStatus(capacity, booked);
    });
  }

  if (collection === "bookings") {
    const Show = getGenericModel("shows") as any;
    const Activity = getGenericModel("activities") as any;
    const Customer = getGenericModel("customers") as any;
    const [shows, activities, customers] = await Promise.all([Show.find().lean(), Activity.find().lean(), Customer.find().lean()]);
    const showById = new Map<string, any>();
    const activityById = new Map<string, any>();
    const customerById = new Map<string, any>();
    shows.forEach((show: any) => {
      const id = recordId(show);
      if (id) showById.set(id, show);
    });
    activities.forEach((activity: any) => {
      const id = recordId(activity);
      if (id) activityById.set(id, activity);
    });
    customers.forEach((customer: any) => {
      const id = recordId(customer);
      if (id) customerById.set(id, customer);
    });
    rows.forEach((booking: any) => {
      if (booking.show_id) booking.show = showById.get(String(booking.show_id)) || null;
      if (booking.activity_id) booking.activity = activityById.get(String(booking.activity_id)) || null;
      if (booking.customer_id) booking.customer = customerById.get(String(booking.customer_id)) || null;
    });
  }

  if (collection === "tickets") {
    const Show = getGenericModel("shows") as any;
    const Activity = getGenericModel("activities") as any;
    const Booking = getGenericModel("bookings") as any;
    const Customer = getGenericModel("customers") as any;
    const [shows, activities, bookings, customers] = await Promise.all([Show.find().lean(), Activity.find().lean(), Booking.find().lean(), Customer.find().lean()]);
    const showById = new Map<string, any>();
    const activityById = new Map<string, any>();
    const bookingById = new Map<string, any>();
    const customerById = new Map<string, any>();
    shows.forEach((show: any) => showById.set(String(recordId(show)), show));
    activities.forEach((activity: any) => activityById.set(String(recordId(activity)), activity));
    bookings.forEach((booking: any) => bookingById.set(String(recordId(booking)), booking));
    customers.forEach((customer: any) => customerById.set(String(recordId(customer)), customer));
    rows.forEach((ticket: any) => {
      if (ticket.show_id) ticket.show = showById.get(String(ticket.show_id)) || null;
      if (ticket.activity_id) ticket.activity = activityById.get(String(ticket.activity_id)) || null;
      if (ticket.booking_id) {
        const booking = bookingById.get(String(ticket.booking_id)) || null;
        if (booking?.customer_id) booking.customer = customerById.get(String(booking.customer_id)) || null;
        if (booking?.show_id) booking.show = showById.get(String(booking.show_id)) || null;
        if (booking?.activity_id) booking.activity = activityById.get(String(booking.activity_id)) || null;
        ticket.booking = booking;
        ticket.booked_by = booking?.booked_by || ticket.generated_by;
      }
    });
  }

  return docs;
};

export async function POST(req: NextRequest) {
  let body: any = await req.json().catch(() => null);
  try {
    await connectDB();
    const {
      collection,
      operation = "select",
      filters,
      inFilters,
      rangeFilters,
      orderBy,
      limitBy,
      updatePayload,
      insertPayload,
      expectSingle
    } = body;

    const Model = getGenericModel(collection) as any;

    if (collection === "agents" && operation === "select") {
      await backfillAgentPublicIds();
    }

    if (collection === "vendors" && operation === "select") {
      await backfillVendorPublicIds();
    }

    if (operation === "select") {
      if (collection === "shows") {
        const Show = getGenericModel("shows") as any;
        const Ticket = getGenericModel("tickets") as any;
        await syncAllShowsInMongo(Show, Ticket);
      }
      if (collection === "activities") {
        const Activity = getGenericModel("activities") as any;
        await syncAllActivitiesInMongo(Activity);
      }
    }

    if (operation === "insert") {
      if (collection === "bookings") {
        const Show = getGenericModel("shows") as any;
        const bookingShows = await Promise.all((insertPayload || []).map(async (booking: any) => {
          if (booking?.booking_type === "ACTIVITY" || booking?.activity_id) return true;
          const showId = String(booking?.show_id || "");
          const byPublicId = showId ? await Show.findOne({ id: showId }).lean() : null;
          if (byPublicId) return byPublicId;
          return mongoose.Types.ObjectId.isValid(showId) ? Show.findById(showId).lean() : null;
        }));
        if (bookingShows.some((show) => show !== true && !isShowBookableAt(show))) {
          return NextResponse.json({ error: "Booking is closed because this show time has passed." }, { status: 400 });
        }
      }
      let rows = insertPayload || [];
      if (collection === "agents") {
        const existingAgents = await Model.find({}).select("agent_code").lean();
        rows = assignAgentIds(existingAgents, rows);
      }
      if (collection === "vendors") {
        const existingVendors = await Model.find({}).select("vendor_code").lean();
        rows = assignVendorIds(existingVendors, rows);
      }
      const docs = await Model.insertMany(rows);
      return NextResponse.json({ data: docs });
    }

    if (operation === "update") {
      const result = await Model.updateMany(normalizeFilters(filters), { $set: updatePayload || {} });
      return NextResponse.json({ data: result });
    }

    if (operation === "delete") {
      const result = await Model.deleteMany(normalizeFilters(filters));
      return NextResponse.json({ data: result });
    }

    let query = Model.find();
    query = applyFilters(query, filters, inFilters, rangeFilters);

    if (orderBy?.column) {
      query = query.sort({ [orderBy.column]: orderBy.ascending === false ? -1 : 1 });
    }
    if (limitBy) {
      query = query.limit(Number(limitBy));
    }

    const docs = await query.lean();
    const data = expectSingle ? docs[0] || null : docs;
    return NextResponse.json({ data: await attachRelations(collection, data) });
  } catch (error: any) {
    try {
      if (body) {
        return NextResponse.json({ data: await localQuery(body), fallback: true });
      }
    } catch {}
    return NextResponse.json({ error: error.message || "Query failed" }, { status: 500 });
  }
}
