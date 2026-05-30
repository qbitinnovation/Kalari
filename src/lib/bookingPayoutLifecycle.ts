import { todayDateValue } from "@/lib/activityAvailability";
import { isShowCompleted, resolveActivityStatus } from "@/lib/catalogLifecycle";
import { getRecordId } from "@/lib/booking";

/** Customer has paid (online) or counter booking is not an open COD/pending payment. */
export const isBookingCustomerPaid = (booking: unknown) => {
  const row = booking as { payment_status?: unknown; payment_method?: unknown };
  const status = String(row?.payment_status || "").toUpperCase();
  if (status === "PAID") return true;
  const method = String(row?.payment_method || "").toUpperCase();
  if (method !== "COUNTER") return false;
  return status !== "COD_PENDING" && status !== "PAYMENT_PENDING" && status !== "FAILED";
};

export const isActivityEventComplete = (activity: unknown, booking: unknown, today = todayDateValue()) => {
  if (!activity) return false;
  if (resolveActivityStatus(activity, today) === "COMPLETED") return true;
  const bookingDate = String((booking as { booking_date?: unknown })?.booking_date || "").slice(0, 10);
  return Boolean(bookingDate && bookingDate < today);
};

export const isBookingSettleable = (booking: unknown) => {
  const row = booking as { status?: unknown };
  return String(row?.status || "") === "CONFIRMED";
};

export type CancellationPayoutUpdate = {
  commission_amount: number;
  commission_status: "PAID";
  platform_commission_amount: number;
  vendor_payout_amount: number;
  vendor_payout_status: "PAID";
  commission_clawback_required: boolean;
  vendor_payout_clawback_required: boolean;
  commission_amount_at_cancel?: number;
  vendor_payout_amount_at_cancel?: number;
  updated_at: string;
};

/** Zero payout obligations on cancel; flag clawback when agent/vendor was already paid. */
export const buildCancellationPayoutUpdates = (booking: any, now = new Date().toISOString()): CancellationPayoutUpdate => {
  const agentAmount = Number(booking?.commission_amount || 0);
  const vendorAmount = Number(booking?.vendor_payout_amount || 0);
  const hadAgentPaid = booking?.commission_status === "PAID" && agentAmount > 0;
  const hadVendorPaid = booking?.vendor_payout_status === "PAID" && vendorAmount > 0;

  return {
    commission_amount: 0,
    commission_status: "PAID",
    platform_commission_amount: 0,
    vendor_payout_amount: 0,
    vendor_payout_status: "PAID",
    commission_clawback_required: hadAgentPaid,
    vendor_payout_clawback_required: hadVendorPaid,
    ...(hadAgentPaid ? { commission_amount_at_cancel: agentAmount } : {}),
    ...(hadVendorPaid ? { vendor_payout_amount_at_cancel: vendorAmount } : {}),
    updated_at: now,
  };
};

export const buildShowLookupMap = (shows: any[] = []) => {
  const map = new Map<string, any>();
  shows.forEach((show) => {
    const id = getRecordId(show);
    if (id) map.set(id, show);
    if (show?.id) map.set(String(show.id), show);
  });
  return map;
};

export const buildActivityLookupMap = (activities: any[] = []) => {
  const map = new Map<string, any>();
  activities.forEach((activity) => {
    const id = getRecordId(activity);
    if (id) map.set(id, activity);
    if (activity?.id) map.set(String(activity.id), activity);
  });
  return map;
};
