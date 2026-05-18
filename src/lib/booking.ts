export type ShowStatus = "ACTIVE" | "HOUSE_FULL" | "SHOW_STARTED" | "SHOW_DONE";
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type TicketStatus = "ACTIVE" | "COMPLETED" | "REVOKED";
export type PaymentStatus = "PAID" | "COD_PENDING" | "FAILED" | "REFUNDED";
export type PaymentMethod = "RAZORPAY" | "COD" | "COUNTER";

export type AvailabilityStatus = "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";

export const AGENT_DEFAULT_COMMISSION_PERCENTAGE = 20;

export const getRecordId = (record: any): string => String(record?.id || record?._id || "");

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

  const sections = show?.layout?.structure?.sections || [];
  return sections.reduce((total: number, section: any) => {
    if (Array.isArray(section.rows)) {
      return total + section.rows.reduce((sum: number, row: any) => sum + Number(row.seats || 0), 0);
    }
    return total + Number(section.rows || 0) * Number(section.seatsPerRow || 0);
  }, 0);
};

export const countBookedSeats = (bookings: any[] = []): number => {
  return bookings
    .filter((booking) => booking?.status !== "CANCELLED")
    .reduce((count, booking) => count + parseSeatCodes(booking?.seat_code).length, 0);
};

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

export const createTicketCode = () =>
  `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
