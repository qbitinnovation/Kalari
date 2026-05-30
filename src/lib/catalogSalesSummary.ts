import { countBookedSeats, getRecordId, getShowCapacity, isActiveBookingReservation } from "@/lib/booking";

const normalizeDate = (value: unknown) => String(value || "").slice(0, 10);

export type CatalogSalesSummary = {
  bookingCount: number;
  ticketsSold: number;
  capacity: number;
  revenue: number;
};

export const summarizeShowSales = (show: any, bookings: any[] = []): CatalogSalesSummary => {
  const showId = getRecordId(show);
  const confirmed = bookings.filter(
    (booking) =>
      String(booking.show_id || "") === showId &&
      booking.status === "CONFIRMED",
  );
  const ticketsSold = countBookedSeats(confirmed);
  const capacity = getShowCapacity(show);
  const revenue = confirmed.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);
  return {
    bookingCount: confirmed.length,
    ticketsSold,
    capacity,
    revenue,
  };
};

export const summarizeActivitySales = (
  activity: { start_date?: string; end_date?: string },
  bookings: any[] = [],
): CatalogSalesSummary => {
  const activityId = getRecordId(activity);
  const startDate = normalizeDate(activity.start_date);
  const endDate = normalizeDate(activity.end_date);
  const confirmed = bookings.filter((booking) => {
    if (String(booking.activity_id || "") !== activityId) return false;
    if (booking.status !== "CONFIRMED") return false;
    const bookingDate = normalizeDate(booking.booking_date);
    if (!bookingDate) return true;
    if (startDate && bookingDate < startDate) return false;
    if (endDate && bookingDate > endDate) return false;
    return true;
  });
  const ticketsSold = countBookedSeats(confirmed);
  const capacityPerDay = Number((activity as { daily_capacity?: number }).daily_capacity || 20);
  const daySpan =
    startDate && endDate
      ? Math.max(1, Math.ceil((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1)
      : 1;
  return {
    bookingCount: confirmed.length,
    ticketsSold,
    capacity: capacityPerDay * daySpan,
    revenue: confirmed.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0),
  };
};

/** Include held seats in admin capacity views when useful. */
export const summarizeShowReservations = (show: any, bookings: any[] = []): CatalogSalesSummary => {
  const showId = getRecordId(show);
  const reserved = bookings.filter(
    (booking) =>
      String(booking.show_id || "") === showId && isActiveBookingReservation(booking),
  );
  const ticketsSold = countBookedSeats(reserved);
  const capacity = getShowCapacity(show);
  const revenue = reserved
    .filter((booking) => booking.status === "CONFIRMED")
    .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);
  return {
    bookingCount: reserved.filter((booking) => booking.status === "CONFIRMED").length,
    ticketsSold,
    capacity,
    revenue,
  };
};
