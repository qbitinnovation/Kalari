import { getVendorCode } from "@/lib/vendorId";
import {
  buildActivityLookupMap,
  isActivityEventComplete,
  isBookingCustomerPaid,
  isBookingSettleable,
} from "@/lib/bookingPayoutLifecycle";
import { getRecordId } from "@/lib/booking";
import { normalizePayoutMethod, type PayoutMethod } from "@/lib/agentCommission";

export const roundMoney = (amount: number) => Math.round(Number(amount || 0) * 100) / 100;

export const calculatePlatformAndVendorAmounts = (totalAmount: number, platformPct: unknown) => {
  const total = roundMoney(totalAmount);
  const pct = Math.min(100, Math.max(0, Number(platformPct || 0)));
  const platformAmount = roundMoney((total * pct) / 100);
  const vendorAmount = roundMoney(total - platformAmount);
  if (roundMoney(platformAmount + vendorAmount) !== total) {
    throw new Error("Platform and vendor amounts must sum to total booking amount.");
  }
  return { platformAmount, vendorAmount, platformPct: pct };
};

export const isActivityBooking = (booking: unknown) => {
  const row = booking as { booking_type?: unknown; activity_id?: unknown };
  if (String(row?.booking_type || "").toUpperCase() === "ACTIVITY") return true;
  return Boolean(row?.activity_id);
};

export const isShowBooking = (booking: unknown) => {
  const row = booking as { booking_type?: unknown; show_id?: unknown; activity_id?: unknown };
  if (String(row?.booking_type || "").toUpperCase() === "SHOW") return true;
  return Boolean(row?.show_id && !row?.activity_id);
};

export const inferVendorPayoutMethod = (vendor: unknown): PayoutMethod => {
  const record = vendor as {
    payout_method?: unknown;
    gpay_phone?: unknown;
    bank_account_number?: unknown;
    bank_name?: unknown;
  };
  if (record?.payout_method) return normalizePayoutMethod(record.payout_method);
  if (String(record?.gpay_phone || "").trim()) return "GPAY";
  if (record?.bank_account_number || record?.bank_name) return "BANK";
  return "BANK";
};

export const vendorUsesContactGpayPhone = (vendor: unknown) => {
  const record = vendor as { gpay_phone?: unknown; phone?: unknown };
  const gpayPhone = String(record?.gpay_phone || "").trim();
  const contactPhone = String(record?.phone || "").trim();
  return !gpayPhone || gpayPhone === contactPhone;
};

export const getVendorGpayPhone = (vendor: unknown) => {
  const record = vendor as { gpay_phone?: unknown; phone?: unknown };
  const gpayPhone = String(record?.gpay_phone || "").trim();
  if (gpayPhone) return gpayPhone;
  return String(record?.phone || "").trim();
};

export const getVendorPayoutLabel = (vendor: unknown) => {
  if (inferVendorPayoutMethod(vendor) === "GPAY") {
    const phone = getVendorGpayPhone(vendor);
    return phone ? `GPay • ${phone}` : "GPay";
  }
  const record = vendor as { bank_name?: unknown };
  return String(record?.bank_name || "").trim() || "Bank transfer";
};

export const getVendorPayoutDetailRows = (vendor: unknown): Array<[string, string]> => {
  if (inferVendorPayoutMethod(vendor) === "GPAY") {
    const usesContact = vendorUsesContactGpayPhone(vendor);
    return [
      ["Method", "Google Pay"],
      ["GPay Number", getVendorGpayPhone(vendor) || "Not added"],
      ["Number Source", usesContact ? "Contact number" : "Separate GPay number"],
    ];
  }
  const record = vendor as {
    bank_account_name?: unknown;
    bank_account_number?: unknown;
    bank_ifsc?: unknown;
    bank_name?: unknown;
  };
  return [
    ["Method", "Bank transfer"],
    ["Account Name", String(record?.bank_account_name || "").trim() || "Not added"],
    ["Account Number", String(record?.bank_account_number || "").trim() || "Not added"],
    ["IFSC", String(record?.bank_ifsc || "").trim() || "Not added"],
    ["Bank", String(record?.bank_name || "").trim() || "Not added"],
  ];
};

export const getVendorDisplayName = (vendor: any) =>
  String(vendor?.name || "Unnamed Vendor");

export const getVendorContact = (vendor: any) =>
  String(vendor?.phone || vendor?.email || "").trim();

export const buildVendorLookupMap = <T extends { id?: string; _id?: string; vendor_code?: string }>(
  vendors: T[],
) => {
  const map = new Map<string, T>();
  vendors.forEach((vendor) => {
    const keys = new Set<string>();
    const record = getRecordId(vendor);
    if (record) keys.add(record);
    if (vendor._id) keys.add(String(vendor._id));
    if (vendor.id) keys.add(String(vendor.id));
    const code = getVendorCode(vendor);
    if (code) keys.add(code);
    keys.forEach((key) => {
      if (key && !map.has(key)) map.set(key, vendor);
    });
  });
  return map;
};

export const findVendorByReference = <T>(map: Map<string, T>, reference: unknown) =>
  map.get(String(reference || "").trim()) || null;

export type BookingVendorPayoutDisplayStatus = "PAID" | "DUE" | "PENDING" | "NONE";

export const getBookingVendorPayoutDisplayStatus = (
  booking: unknown,
  vendor: unknown,
  activity: unknown,
  today = new Date(),
): BookingVendorPayoutDisplayStatus => {
  const row = booking as { vendor_payout_status?: unknown; vendor_payout_amount?: unknown; status?: unknown };
  if (Number(row?.vendor_payout_amount || 0) <= 0) return "NONE";
  if (row?.vendor_payout_status === "PAID") return "PAID";
  if (String(row?.status || "") !== "CONFIRMED") return "NONE";
  if (isBookingVendorPayoutDue(booking, vendor, activity, today)) return "DUE";
  return "PENDING";
};

export const isBookingVendorPayoutEligible = (booking: unknown, activity: unknown, today = new Date()) => {
  const row = booking as {
    vendor_payout_status?: unknown;
    vendor_payout_amount?: unknown;
  };
  if (!isBookingSettleable(booking)) return false;
  if (row?.vendor_payout_status === "PAID") return false;
  if (Number(row?.vendor_payout_amount || 0) <= 0) return false;
  if (!isBookingCustomerPaid(booking)) return false;
  if (!isActivityEventComplete(activity, booking, today.toISOString().slice(0, 10))) return false;
  return true;
};

export const isBookingVendorPayoutDue = (booking: unknown, vendor: unknown, activity?: unknown, today = new Date()) => {
  const vendorRecord = vendor as { active?: unknown };
  if (vendorRecord?.active === false) return false;
  return isBookingVendorPayoutEligible(booking, activity, today);
};

export type DueVendorBreakdown = {
  vendorId: string;
  vendor: any;
  vendorName: string;
  payoutLabel: string;
  periodKeys: string[];
  bookingCount: number;
  amount: number;
};

export type DueVendorPayoutBookingsResult = {
  bookings: any[];
  summary: {
    vendorCount: number;
    bookingCount: number;
    totalAmount: number;
    vendorIds: string[];
    periodKeys: string[];
    byVendor: DueVendorBreakdown[];
  };
};

export const collectDueVendorPayoutBookings = (
  vendors: any[],
  bookings: any[],
  today = new Date(),
  activities: any[] = [],
): DueVendorPayoutBookingsResult => {
  const vendorById = buildVendorLookupMap(vendors.filter((vendor) => vendor.active !== false));
  const activityById = buildActivityLookupMap(activities);
  const dueBookings: any[] = [];
  const vendorIds = new Set<string>();
  const byVendorMap = new Map<string, DueVendorBreakdown>();

  bookings.forEach((booking) => {
    if (!isActivityBooking(booking)) return;
    const vendorId = String(booking.vendor_id || "");
    const vendor = findVendorByReference(vendorById, vendorId);
    const activity = activityById.get(String(booking.activity_id || "")) || null;
    if (!vendor || !isBookingVendorPayoutDue(booking, vendor, activity, today)) return;

    dueBookings.push(booking);
    const routeVendorId = getRecordId(vendor);
    vendorIds.add(routeVendorId);

    const existing = byVendorMap.get(routeVendorId);
    const amount = Number(booking.vendor_payout_amount || 0);
    if (existing) {
      existing.bookingCount += 1;
      existing.amount += amount;
      return;
    }
    byVendorMap.set(routeVendorId, {
      vendorId: routeVendorId,
      vendor,
      vendorName: getVendorDisplayName(vendor),
      payoutLabel: getVendorPayoutLabel(vendor),
      periodKeys: [],
      bookingCount: 1,
      amount,
    });
  });

  const byVendor = Array.from(byVendorMap.values()).sort((left, right) =>
    left.vendorName.localeCompare(right.vendorName),
  );
  const totalAmount = dueBookings.reduce(
    (sum, booking) => sum + Number(booking.vendor_payout_amount || 0),
    0,
  );

  return {
    bookings: dueBookings,
    summary: {
      vendorCount: vendorIds.size,
      bookingCount: dueBookings.length,
      totalAmount,
      vendorIds: Array.from(vendorIds),
      periodKeys: [],
      byVendor,
    },
  };
};

export type VendorPayoutGroupStatus = "DUE" | "PENDING" | "PAID";

export type VendorPayoutGroupSummary = {
  key: string;
  vendorId: string;
  status: VendorPayoutGroupStatus;
  amount: number;
  bookingCount: number;
};

export const buildVendorPayoutGroups = (
  vendors: any[],
  bookings: any[],
  today = new Date(),
  activities: any[] = [],
): VendorPayoutGroupSummary[] => {
  const vendorById = buildVendorLookupMap(vendors);
  const activityById = buildActivityLookupMap(activities);
  const grouped = new Map<string, any[]>();

  bookings.forEach((booking) => {
    if (!isActivityBooking(booking)) return;
    const vendorId = String(booking.vendor_id || "");
    if (!vendorId) return;
    const key = `${vendorId}:${booking.vendor_payout_status === "PAID" ? "PAID" : "UNPAID"}`;
    grouped.set(key, [...(grouped.get(key) || []), booking]);
  });

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const first = rows[0];
    const vendorId = String(first.vendor_id || "");
    const vendor = findVendorByReference(vendorById, vendorId);
    const routeVendorId = vendor ? getRecordId(vendor) : vendorId;
    const paid = rows.every((booking) => booking.vendor_payout_status === "PAID");
    const status: VendorPayoutGroupStatus = paid
      ? "PAID"
      : rows.some((booking) =>
          isBookingVendorPayoutDue(
            booking,
            vendor,
            activityById.get(String(booking.activity_id || "")) || null,
            today,
          ),
        )
        ? "DUE"
        : "PENDING";

    return {
      key,
      vendorId: routeVendorId,
      status,
      amount: rows.reduce((sum, booking) => sum + Number(booking.vendor_payout_amount || 0), 0),
      bookingCount: rows.length,
    };
  });
};

export type VendorPayoutTotalsSummary = {
  due: number;
  pending: number;
  paid: number;
  dueVendorCount: number;
  dueBookingCount: number;
  dueByVendor: DueVendorBreakdown[];
  groups: VendorPayoutGroupSummary[];
};

export const summarizeVendorPayoutTotals = (
  vendors: any[],
  bookings: any[],
  today = new Date(),
  activities: any[] = [],
): VendorPayoutTotalsSummary => {
  const activityBookings = bookings.filter(isActivityBooking);
  const duePayouts = collectDueVendorPayoutBookings(vendors, activityBookings, today, activities);
  const groups = buildVendorPayoutGroups(vendors, activityBookings, today, activities);

  return {
    due: duePayouts.summary.totalAmount,
    pending: groups
      .filter((group) => group.status === "PENDING")
      .reduce((sum, group) => sum + group.amount, 0),
    paid: groups
      .filter((group) => group.status === "PAID")
      .reduce((sum, group) => sum + group.amount, 0),
    dueVendorCount: duePayouts.summary.vendorCount,
    dueBookingCount: duePayouts.summary.bookingCount,
    dueByVendor: duePayouts.summary.byVendor,
    groups,
  };
};

export type VendorPayoutRangeSummary = {
  platformRevenue: number;
  vendorEarned: number;
  vendorPaid: number;
  vendorUnpaid: number;
  vendorCount: number;
  bookingCount: number;
  byVendor: DueVendorBreakdown[];
};

const isBookingInDateRange = (booking: any, start: Date, end: Date) => {
  const raw = String(booking?.booking_time || booking?.created_at || "");
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

export const summarizeVendorPayoutTotalsForRange = (
  vendors: any[],
  bookings: any[],
  start: Date,
  end: Date,
): VendorPayoutRangeSummary => {
  const vendorById = buildVendorLookupMap(vendors.filter((vendor) => vendor.active !== false));
  const inRange = bookings.filter(
    (booking) =>
      isActivityBooking(booking) &&
      String(booking.status || "") === "CONFIRMED" &&
      isBookingInDateRange(booking, start, end),
  );

  let platformRevenue = 0;
  let vendorEarned = 0;
  let vendorPaid = 0;
  let vendorUnpaid = 0;
  const byVendorMap = new Map<string, DueVendorBreakdown>();

  inRange.forEach((booking) => {
    platformRevenue += Number(booking.platform_commission_amount || 0);
    const amount = Number(booking.vendor_payout_amount || 0);
    vendorEarned += amount;
    const isPaid = booking.vendor_payout_status === "PAID";
    if (isPaid) {
      vendorPaid += amount;
      return;
    }

    vendorUnpaid += amount;
    const vendorId = String(booking.vendor_id || "");
    const vendor = findVendorByReference(vendorById, vendorId);
    if (!vendor) return;
    const routeVendorId = getRecordId(vendor);

    const existing = byVendorMap.get(routeVendorId);
    if (existing) {
      existing.bookingCount += 1;
      existing.amount += amount;
      return;
    }
    byVendorMap.set(routeVendorId, {
      vendorId: routeVendorId,
      vendor,
      vendorName: getVendorDisplayName(vendor),
      payoutLabel: getVendorPayoutLabel(vendor),
      periodKeys: [],
      bookingCount: 1,
      amount,
    });
  });

  const byVendor = Array.from(byVendorMap.values()).sort((left, right) =>
    right.amount - left.amount || left.vendorName.localeCompare(right.vendorName),
  );

  return {
    platformRevenue,
    vendorEarned,
    vendorPaid,
    vendorUnpaid,
    vendorCount: byVendor.length,
    bookingCount: inRange.length,
    byVendor,
  };
};

export const buildVendorPayoutFields = (
  activity: any,
  totalAmount: number,
  _bookingTime?: Date,
  _vendor?: any,
) => {
  const vendorId = String(activity?.vendor_id || "");
  const platformPct = vendorId ? Number(activity?.platform_commission_percentage || 0) : 0;
  const { platformAmount, vendorAmount } = calculatePlatformAndVendorAmounts(totalAmount, platformPct);

  return {
    vendor_id: vendorId || null,
    platform_commission_percentage: platformPct,
    platform_commission_amount: platformAmount,
    vendor_payout_amount: vendorAmount,
    vendor_payout_status: vendorAmount > 0 ? "UNPAID" : "PAID",
    vendor_payout_period_key: null,
    agent_id: null,
    agent_commission_percentage: 0,
    commission_amount: 0,
    commission_status: "PAID" as const,
    commission_period_key: null,
  };
};

export type { PayoutMethod };
