import { getSymmetricArenaSections, isArenaLayout } from "./arenaLayout";

export type ShowStatus = "ACTIVE" | "HOUSE_FULL" | "SHOW_STARTED" | "SHOW_DONE";
export type BookingStatus = "CONFIRMED" | "HELD" | "CANCELLED" | "EXPIRED";
export type TicketStatus = "ACTIVE" | "COMPLETED" | "REVOKED";
export type PaymentStatus = "PAID" | "COD_PENDING" | "FAILED" | "REFUNDED";
export type PaymentMethod = "RAZORPAY" | "COD" | "COUNTER";

export type AvailabilityStatus = "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";

export const AGENT_DEFAULT_COMMISSION_PERCENTAGE = 20;
export const BOOKING_HOLD_MINUTES = 10;
export const BOOKING_HOLD_DURATION_MS = BOOKING_HOLD_MINUTES * 60 * 1000;

export const getRecordId = (record: any): string => String(record?.id || record?._id || "");

export const createBookingReference = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KAL-${yy}${mm}${dd}-${random}`;
};

export const getBookingReference = (booking: any): string => {
  const reference = booking?.booking_reference || booking?.booking_ref;
  if (reference) return String(reference);
  const recordId = getRecordId(booking);
  return recordId ? `KAL-${recordId.slice(-8).toUpperCase()}` : "KAL-PENDING";
};

export const parseSeatCodes = (seatCode: unknown): string[] => {
  if (Array.isArray(seatCode)) return seatCode.map(String).filter(Boolean);
  if (seatCode === null || seatCode === undefined) return [];

  const raw = String(seatCode);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (parsed) return [String(parsed)];
  } catch {}

  return raw.split(",").map((seat) => seat.trim()).filter(Boolean);
};

export const getShowCapacity = (show: any): number => {
  if (show?.type === "EVENT") return Number(show?.capacity || 0);

  const rawSections = show?.layout?.structure?.sections || [];
  const sections = isArenaLayout(rawSections) ? getSymmetricArenaSections(rawSections) : rawSections;
  return sections.reduce((total: number, section: any) => {
    if (Array.isArray(section.rows)) {
      return total + section.rows.reduce((sum: number, row: any) => sum + Number(row.seats || 0), 0);
    }
    return total + Number(section.rows || 0) * Number(section.seatsPerRow || 0);
  }, 0);
};

export const countBookedSeats = (bookings: any[] = []): number => {
  return bookings
    .filter(isActiveBookingReservation)
    .reduce((count, booking) => count + parseSeatCodes(booking?.seat_code).length, 0);
};

export const isActiveBookingHold = (booking: any, now = Date.now()): boolean => {
  if (booking?.status !== "HELD" || !booking?.hold_expires_at) return false;
  const expiresAt = new Date(booking.hold_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

export const isActiveBookingReservation = (booking: any, now = Date.now()): boolean =>
  booking?.status === "CONFIRMED" || isActiveBookingHold(booking, now);

export const getAvailabilityStatus = (capacity: number, booked: number): AvailabilityStatus => {
  if (capacity > 0 && booked >= capacity) return "SOLD_OUT";
  if (capacity > 0 && booked / capacity >= 0.7) return "FILLING_FAST";
  return "AVAILABLE";
};

export const getAvailabilityLabel = (status: AvailabilityStatus): string => {
  if (status === "SOLD_OUT") return "Sold Out";
  if (status === "FILLING_FAST") return "Filling Fast";
  return "Available";
};

export const normalizeTicketStatus = (status?: string): TicketStatus => {
  if (status === "COMPLETED" || status === "REVOKED") return status;
  return "ACTIVE";
};

export const createTicketCode = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(-8).toUpperCase();
  return `TKT-${yy}${mm}${dd}-${random}`;
};

export const createTicketCodes = (count: number, date = new Date()) => {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(createTicketCode(date));
  return Array.from(codes);
};

export const isGeneralAdmissionSeatCode = (code?: string) => {
  const normalized = String(code || "").trim().toUpperCase();
  return normalized === "GENERAL" || normalized.startsWith("EVT-");
};
