import mongoose from "mongoose";
import connectDB, { getGenericModel } from "@/lib/db";
import {
  buildVendorLookupMap,
  collectDueVendorPayoutBookings,
  findVendorByReference,
  getVendorDisplayName,
  isActivityBooking,
  isBookingVendorPayoutDue,
} from "@/lib/vendorPayout";
import { buildActivityLookupMap, isBookingSettleable } from "@/lib/bookingPayoutLifecycle";
import { getRecordId } from "@/lib/booking";
import { createNotification } from "@/lib/notificationStore";
import { readStore, writeStore } from "@/lib/localStore";

const recordId = (record: any) => String(record?.id || record?._id || "");

const normalizeBookingIds = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));

const toObjectIds = (ids: string[]) =>
  ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

export type MarkVendorPayoutPaidResult = {
  bookingIds: string[];
  modifiedCount: number;
  paidAt: string;
  paidBy: string;
};

async function loadActivitiesForBookings(bookings: any[]) {
  const activityIds = Array.from(
    new Set(bookings.map((booking) => String(booking?.activity_id || "")).filter(Boolean)),
  );
  if (!activityIds.length) return [];

  try {
    await connectDB();
    const Activity = getGenericModel("activities") as any;
    const objectIds = toObjectIds(activityIds);
    const filter = objectIds.length
      ? { $or: [{ _id: { $in: objectIds } }, { id: { $in: activityIds } }] }
      : { id: { $in: activityIds } };
    return Activity.find(filter).lean();
  } catch {
    const store = await readStore();
    return (store.activities || []).filter(
      (activity: any) =>
        activityIds.includes(getRecordId(activity)) || activityIds.includes(String(activity.id)),
    );
  }
}

async function assertVendorPayoutBookingsPayable(bookingIds: string[]) {
  const ids = normalizeBookingIds(bookingIds);
  const { vendors, bookings: allBookings } = await loadVendorsAndPayoutBookings();
  const targets = allBookings.filter((booking: any) => ids.includes(getRecordId(booking)));
  if (targets.length !== ids.length) {
    throw new Error("One or more bookings are not eligible for vendor payout.");
  }
  const activities = await loadActivitiesForBookings(targets);
  const activityById = buildActivityLookupMap(activities);
  const vendorById = buildVendorLookupMap(vendors);
  const today = new Date();

  targets.forEach((booking: any) => {
    if (!isBookingSettleable(booking)) {
      throw new Error(`Booking ${booking.booking_reference || getRecordId(booking)} is not confirmed.`);
    }
    const vendor = findVendorByReference(vendorById, String(booking.vendor_id || ""));
    const activity = activityById.get(String(booking.activity_id || "")) || null;
    if (!vendor || !isBookingVendorPayoutDue(booking, vendor, activity, today)) {
      throw new Error(
        `Booking ${booking.booking_reference || getRecordId(booking)} is not due for vendor payout yet.`,
      );
    }
  });
}

export async function markVendorPayoutBookingsPaid(
  bookingIds: string[],
  paidBy: string,
): Promise<MarkVendorPayoutPaidResult> {
  const ids = normalizeBookingIds(bookingIds);
  if (!ids.length) {
    throw new Error("No bookings selected for vendor payout.");
  }

  await assertVendorPayoutBookingsPayable(ids);

  const paidAt = new Date().toISOString();
  const payload = {
    vendor_payout_status: "PAID",
    vendor_payout_paid_at: paidAt,
    vendor_payout_paid_by: paidBy,
    updated_at: paidAt,
  };

  try {
    await connectDB();
    const Booking = getGenericModel("bookings") as any;
    const objectIds = toObjectIds(ids);
    const filter = objectIds.length
      ? {
          $or: [{ _id: { $in: objectIds } }, { id: { $in: ids } }],
          status: "CONFIRMED",
          vendor_payout_status: { $ne: "PAID" },
          vendor_payout_amount: { $gt: 0 },
        }
      : {
          id: { $in: ids },
          status: "CONFIRMED",
          vendor_payout_status: { $ne: "PAID" },
          vendor_payout_amount: { $gt: 0 },
        };
    const result = await Booking.updateMany(filter, { $set: payload });
    const modifiedCount = Number(result?.modifiedCount || 0);
    if (modifiedCount === 0) {
      throw new Error("Could not update any vendor payout bookings.");
    }
    return { bookingIds: ids, modifiedCount, paidAt, paidBy };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Could not update") || error.message.startsWith("No bookings"))
    ) {
      throw error;
    }
    const store = await readStore();
    store.bookings = store.bookings || [];
    let modifiedCount = 0;
    store.bookings = store.bookings.map((booking: any) => {
      const id = recordId(booking);
      if (
        !ids.includes(id) ||
        booking.vendor_payout_status === "PAID" ||
        booking.status !== "CONFIRMED" ||
        Number(booking.vendor_payout_amount || 0) <= 0
      ) {
        return booking;
      }
      modifiedCount += 1;
      return { ...booking, ...payload };
    });
    if (modifiedCount === 0) {
      throw new Error("Could not update any vendor payout bookings.");
    }
    await writeStore(store);
    return { bookingIds: ids, modifiedCount, paidAt, paidBy };
  }
}

export type SettleDueVendorPayoutsResult = MarkVendorPayoutPaidResult & {
  vendorCount: number;
  bookingCount: number;
  totalAmount: number;
};

async function loadVendorsAndPayoutBookings() {
  try {
    await connectDB();
    const Vendor = getGenericModel("vendors") as any;
    const Booking = getGenericModel("bookings") as any;
    const [vendors, bookings] = await Promise.all([
      Vendor.find({}).lean(),
      Booking.find({
        status: "CONFIRMED",
        vendor_payout_status: { $ne: "PAID" },
        vendor_payout_amount: { $gt: 0 },
      }).lean(),
    ]);
    return { vendors, bookings: bookings.filter(isActivityBooking) };
  } catch {
    const store = await readStore();
    return {
      vendors: store.vendors || [],
      bookings: (store.bookings || []).filter(
        (booking: any) =>
          isActivityBooking(booking) &&
          booking.status === "CONFIRMED" &&
          booking.vendor_payout_status !== "PAID" &&
          Number(booking.vendor_payout_amount || 0) > 0,
      ),
    };
  }
}

const matchesVendorReference = (vendorById: Map<string, any>, vendorId: string, booking: any) => {
  const vendor = findVendorByReference(vendorById, String(booking.vendor_id || ""));
  const routeVendorId = vendor ? getRecordId(vendor) : String(booking.vendor_id || "");
  return routeVendorId === vendorId || String(booking.vendor_id || "") === vendorId;
};

export async function settleDueVendorPayoutsForVendor(
  vendorId: string,
  paidBy: string,
  periodKey?: string,
): Promise<SettleDueVendorPayoutsResult & { vendorId: string }> {
  const normalizedVendorId = String(vendorId || "").trim();
  if (!normalizedVendorId) {
    throw new Error("Vendor is required.");
  }

  const { vendors, bookings } = await loadVendorsAndPayoutBookings();
  const vendorById = buildVendorLookupMap(vendors);
  const vendor = findVendorByReference(vendorById, normalizedVendorId);
  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  const activities = await loadActivitiesForBookings(bookings);
  const { bookings: dueBookings } = collectDueVendorPayoutBookings(vendors, bookings, new Date(), activities);
  const vendorDueBookings = dueBookings.filter((booking) =>
    matchesVendorReference(vendorById, normalizedVendorId, booking),
  );

  if (!vendorDueBookings.length) {
    throw new Error("No vendor payouts are due for this vendor right now.");
  }

  const bookingIds = vendorDueBookings.map((booking) => getRecordId(booking)).filter(Boolean);
  const totalAmount = vendorDueBookings.reduce(
    (sum, booking) => sum + Number(booking.vendor_payout_amount || 0),
    0,
  );
  const periodKeys = Array.from(
    new Set(vendorDueBookings.map((booking) => String(booking.vendor_payout_period_key || "")).filter(Boolean)),
  );
  const result = await markVendorPayoutBookingsPaid(bookingIds, paidBy);
  const vendorName = getVendorDisplayName(vendor);
  const amountLabel = `Rs. ${Number(totalAmount || 0).toLocaleString("en-IN")}`;
  const bookingsLabel =
    vendorDueBookings.length === 1 ? "1 booking" : `${vendorDueBookings.length} bookings`;

  await createNotification({
    type: "VENDOR_PAYOUT_PAID",
    module: "VENDORS",
    title: "Vendor payout settled",
    message: `${amountLabel} settled for ${vendorName} (${bookingsLabel}).`,
    severity: "SUCCESS",
    action_url: `/admin/vendors/${normalizedVendorId}`,
    metadata: {
      settle_vendor_due: true,
      vendor_id: normalizedVendorId,
      period_key: periodKey || null,
      period_keys: periodKeys,
      booking_count: vendorDueBookings.length,
      amount: totalAmount,
      booking_ids: result.bookingIds,
    },
  }).catch(() => null);

  return {
    ...result,
    vendorId: normalizedVendorId,
    vendorCount: 1,
    bookingCount: vendorDueBookings.length,
    totalAmount,
  };
}

export async function settleDueVendorPayouts(paidBy: string): Promise<SettleDueVendorPayoutsResult> {
  const { vendors, bookings } = await loadVendorsAndPayoutBookings();
  const activities = await loadActivitiesForBookings(bookings);
  const { bookings: dueBookings, summary } = collectDueVendorPayoutBookings(
    vendors,
    bookings,
    new Date(),
    activities,
  );
  if (!dueBookings.length || summary.totalAmount <= 0) {
    throw new Error("No vendor payouts are due right now.");
  }

  const bookingIds = dueBookings.map((booking) => getRecordId(booking)).filter(Boolean);
  const result = await markVendorPayoutBookingsPaid(bookingIds, paidBy);

  const vendorsLabel = summary.vendorCount === 1 ? "1 vendor" : `${summary.vendorCount} vendors`;
  const bookingsLabel = summary.bookingCount === 1 ? "1 booking" : `${summary.bookingCount} bookings`;
  const amountLabel = `Rs. ${Number(summary.totalAmount || 0).toLocaleString("en-IN")}`;

  await createNotification({
    type: "VENDOR_PAYOUT_PAID",
    module: "VENDORS",
    title: "Due vendor payouts settled",
    message: `${amountLabel} settled for ${vendorsLabel} (${bookingsLabel}).`,
    severity: "SUCCESS",
    action_url: "/admin/vendor-payouts?status=PAID",
    metadata: {
      settle_all_due: true,
      vendor_count: summary.vendorCount,
      booking_count: summary.bookingCount,
      amount: summary.totalAmount,
      vendor_ids: summary.vendorIds,
      period_keys: summary.periodKeys,
      booking_ids: result.bookingIds,
    },
  }).catch(() => null);

  return {
    ...result,
    vendorCount: summary.vendorCount,
    bookingCount: summary.bookingCount,
    totalAmount: summary.totalAmount,
  };
}
