import { getAgentCode } from "@/lib/agentId";
import {
  buildShowLookupMap,
  isBookingCustomerPaid,
  isBookingSettleable,
} from "@/lib/bookingPayoutLifecycle";
import { isShowCompleted } from "@/lib/catalogLifecycle";
import { getRecordId } from "@/lib/booking";

export type PayoutFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type AgentNotificationMethod = "SMS" | "EMAIL";
export type PayoutMethod = "BANK" | "GPAY";

const pad = (value: number) => String(value).padStart(2, "0");

export const normalizePayoutFrequency = (value: unknown): PayoutFrequency => {
  const frequency = String(value || "").toUpperCase();
  if (frequency === "WEEKLY" || frequency === "MONTHLY") return frequency;
  return "DAILY";
};

export const normalizeAgentNotificationMethod = (value: unknown): AgentNotificationMethod => {
  const method = String(value || "").toUpperCase();
  return method === "EMAIL" ? "EMAIL" : "SMS";
};

export const normalizePayoutMethod = (value: unknown): PayoutMethod => {
  const method = String(value || "").toUpperCase();
  return method === "GPAY" ? "GPAY" : "BANK";
};

export const inferAgentPayoutMethod = (agent: unknown): PayoutMethod => {
  const record = agent as {
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

export const agentUsesContactGpayPhone = (agent: unknown) => {
  const record = agent as { gpay_phone?: unknown; phone?: unknown };
  const gpayPhone = String(record?.gpay_phone || "").trim();
  const contactPhone = String(record?.phone || "").trim();
  return !gpayPhone || gpayPhone === contactPhone;
};

export const getAgentGpayPhone = (agent: unknown) => {
  const record = agent as { gpay_phone?: unknown; phone?: unknown };
  const gpayPhone = String(record?.gpay_phone || "").trim();
  if (gpayPhone) return gpayPhone;
  return String(record?.phone || "").trim();
};

export const getAgentPayoutLabel = (agent: unknown) => {
  if (inferAgentPayoutMethod(agent) === "GPAY") {
    const phone = getAgentGpayPhone(agent);
    return phone ? `GPay • ${phone}` : "GPay";
  }
  const record = agent as { bank_name?: unknown };
  return String(record?.bank_name || "").trim() || "Bank transfer";
};

export const getAgentPayoutDetailRows = (agent: unknown): Array<[string, string]> => {
  if (inferAgentPayoutMethod(agent) === "GPAY") {
    const usesContact = agentUsesContactGpayPhone(agent);
    return [
      ["Method", "Google Pay"],
      ["GPay Number", getAgentGpayPhone(agent) || "Not added"],
      ["Number Source", usesContact ? "Contact number" : "Separate GPay number"],
    ];
  }
  const record = agent as {
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

export const getAgentAlertMethod = (agent: unknown): AgentNotificationMethod =>
  normalizeAgentNotificationMethod(
    (agent as { remaining_amount_notification_method?: unknown; commission_notification_method?: unknown })
      ?.remaining_amount_notification_method
      || (agent as { commission_notification_method?: unknown })?.commission_notification_method
  );

export const getCommissionPeriodKey = (date = new Date(), frequency: unknown = "DAILY") => {
  const normalized = normalizePayoutFrequency(frequency);
  const target = new Date(date);
  if (normalized === "DAILY") {
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }
  if (normalized === "MONTHLY") {
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;
  }

  const temp = new Date(Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()));
  const day = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${pad(week)}`;
};

export const previousDay = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
};

export const getDueCommissionPeriodKeys = (frequency: unknown, today = new Date()) => {
  const normalized = normalizePayoutFrequency(frequency);
  if (normalized === "DAILY") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return [getCommissionPeriodKey(today, normalized), getCommissionPeriodKey(yesterday, normalized)];
  }
  if (normalized === "WEEKLY") {
    const date = new Date(today);
    date.setDate(date.getDate() - 7);
    return [getCommissionPeriodKey(date, normalized)];
  }
  const date = new Date(today);
  date.setMonth(date.getMonth() - 1);
  return [getCommissionPeriodKey(date, normalized)];
};

export type DueAgentBreakdown = {
  agentId: string;
  agent: any;
  agentName: string;
  payoutLabel: string;
  periodKeys: string[];
  bookingCount: number;
  amount: number;
};

export type DueCommissionBookingsResult = {
  bookings: any[];
  summary: {
    agentCount: number;
    bookingCount: number;
    totalAmount: number;
    agentIds: string[];
    periodKeys: string[];
    byAgent: DueAgentBreakdown[];
  };
};

export type BookingCommissionDisplayStatus = "PAID" | "DUE" | "PENDING" | "NONE";

export const getBookingCommissionDisplayStatus = (
  booking: unknown,
  agent: unknown,
  show: unknown,
  today = new Date(),
): BookingCommissionDisplayStatus => {
  const row = booking as { commission_status?: unknown; commission_amount?: unknown; status?: unknown };
  if (Number(row?.commission_amount || 0) <= 0) return "NONE";
  if (row?.commission_status === "PAID") return "PAID";
  if (String(row?.status || "") !== "CONFIRMED") return "NONE";
  if (isBookingCommissionDue(booking, agent, today, show)) return "DUE";
  return "PENDING";
};

export const isBookingCommissionEligible = (
  booking: unknown,
  show: unknown,
  today = new Date(),
) => {
  const row = booking as { commission_status?: unknown; commission_amount?: unknown };
  if (!isBookingSettleable(booking)) return false;
  if (row?.commission_status === "PAID") return false;
  if (Number(row?.commission_amount || 0) <= 0) return false;
  if (!isBookingCustomerPaid(booking)) return false;
  if (!show || !isShowCompleted(show, today)) return false;
  return true;
};

export const isBookingCommissionDue = (
  booking: unknown,
  agent: unknown,
  today = new Date(),
  show?: unknown,
) => {
  const row = booking as {
    commission_period_key?: unknown;
  };
  const agentRecord = agent as { active?: unknown; payout_frequency?: unknown };
  if (agentRecord?.active === false) return false;
  if (!isBookingCommissionEligible(booking, show, today)) return false;
  const periodKey = String(row?.commission_period_key || "");
  if (!periodKey) return false;
  const dueKeys = getDueCommissionPeriodKeys(agentRecord?.payout_frequency, today);
  return dueKeys.includes(periodKey);
};

export const collectDueCommissionBookings = (
  agents: any[],
  bookings: any[],
  today = new Date(),
  shows: any[] = [],
): DueCommissionBookingsResult => {
  const showBookings = filterShowCommissionBookings(bookings);
  const agentById = buildAgentLookupMap(agents.filter((agent) => agent.active !== false));
  const showById = buildShowLookupMap(shows);
  const dueBookings: any[] = [];
  const periodKeys = new Set<string>();
  const agentIds = new Set<string>();
  const byAgentMap = new Map<string, DueAgentBreakdown>();

  showBookings.forEach((booking) => {
    const agentId = String(booking.agent_id || "");
    const agent = findAgentByReference(agentById, agentId);
    const show = showById.get(String(booking.show_id || "")) || null;
    if (!agent || !isBookingCommissionDue(booking, agent, today, show)) return;

    dueBookings.push(booking);
    periodKeys.add(String(booking.commission_period_key || ""));
    const routeAgentId = getRecordId(agent);
    agentIds.add(routeAgentId);

    const existing = byAgentMap.get(routeAgentId);
    const periodKey = String(booking.commission_period_key || "");
    const amount = Number(booking.commission_amount || 0);
    if (existing) {
      existing.bookingCount += 1;
      existing.amount += amount;
      if (!existing.periodKeys.includes(periodKey)) existing.periodKeys.push(periodKey);
      return;
    }
    byAgentMap.set(routeAgentId, {
      agentId: routeAgentId,
      agent,
      agentName: getAgentDisplayName(agent),
      payoutLabel: getAgentPayoutLabel(agent),
      periodKeys: [periodKey],
      bookingCount: 1,
      amount,
    });
  });

  const byAgent = Array.from(byAgentMap.values()).sort((left, right) =>
    left.agentName.localeCompare(right.agentName)
  );
  const totalAmount = dueBookings.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);

  return {
    bookings: dueBookings,
    summary: {
      agentCount: agentIds.size,
      bookingCount: dueBookings.length,
      totalAmount,
      agentIds: Array.from(agentIds),
      periodKeys: Array.from(periodKeys),
      byAgent,
    },
  };
};

export type CommissionGroupStatus = "DUE" | "PENDING" | "PAID";

export type CommissionGroupSummary = {
  key: string;
  agentId: string;
  periodKey: string;
  status: CommissionGroupStatus;
  amount: number;
  bookingCount: number;
};

export type CommissionTotalsSummary = {
  due: number;
  pending: number;
  paid: number;
  dueAgentCount: number;
  dueBookingCount: number;
  dueByAgent: DueAgentBreakdown[];
  groups: CommissionGroupSummary[];
};

export const buildCommissionGroups = (
  agents: any[],
  bookings: any[],
  today = new Date(),
  shows: any[] = [],
): CommissionGroupSummary[] => {
  const showBookings = filterShowCommissionBookings(bookings);
  const agentById = buildAgentLookupMap(agents);
  const showById = buildShowLookupMap(shows);
  const grouped = new Map<string, any[]>();

  showBookings.forEach((booking) => {
    const agentId = String(booking.agent_id || "");
    const periodKey = String(booking.commission_period_key || "unassigned");
    if (!agentId) return;
    const key = `${agentId}:${periodKey}:${booking.commission_status === "PAID" ? "PAID" : "UNPAID"}`;
    grouped.set(key, [...(grouped.get(key) || []), booking]);
  });

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const first = rows[0];
    const agentId = String(first.agent_id || "");
    const agent = findAgentByReference(agentById, agentId);
    const routeAgentId = agent ? getRecordId(agent) : agentId;
    const periodKey = String(first.commission_period_key || "unassigned");
    const paid = rows.every((booking) => booking.commission_status === "PAID");
    const status: CommissionGroupStatus = paid
      ? "PAID"
      : rows.some((booking) =>
          isBookingCommissionDue(
            booking,
            agent,
            today,
            showById.get(String(booking.show_id || "")) || null,
          ),
        )
        ? "DUE"
        : "PENDING";

    return {
      key,
      agentId: routeAgentId,
      periodKey,
      status,
      amount: rows.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0),
      bookingCount: rows.length,
    };
  });
};

export const summarizeCommissionTotals = (
  agents: any[],
  bookings: any[],
  today = new Date(),
  shows: any[] = [],
): CommissionTotalsSummary => {
  const dueCommission = collectDueCommissionBookings(agents, bookings, today, shows);
  const groups = buildCommissionGroups(agents, bookings, today, shows);

  return {
    due: dueCommission.summary.totalAmount,
    pending: groups
      .filter((group) => group.status === "PENDING")
      .reduce((sum, group) => sum + group.amount, 0),
    paid: groups
      .filter((group) => group.status === "PAID")
      .reduce((sum, group) => sum + group.amount, 0),
    dueAgentCount: dueCommission.summary.agentCount,
    dueBookingCount: dueCommission.summary.bookingCount,
    dueByAgent: dueCommission.summary.byAgent,
    groups,
  };
};

export type CommissionRangeSummary = {
  earned: number;
  paid: number;
  unpaid: number;
  agentCount: number;
  bookingCount: number;
  byAgent: DueAgentBreakdown[];
};

const isBookingInDateRange = (booking: any, start: Date, end: Date) => {
  const raw = String(booking?.booking_time || booking?.created_at || "");
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

export const summarizeCommissionTotalsForRange = (
  agents: any[],
  bookings: any[],
  start: Date,
  end: Date,
): CommissionRangeSummary => {
  const agentById = buildAgentLookupMap(agents.filter((agent) => agent.active !== false));
  const inRange = filterShowCommissionBookings(bookings).filter(
    (booking) =>
      Number(booking.commission_amount || 0) > 0 &&
      String(booking.status || "") === "CONFIRMED" &&
      isBookingInDateRange(booking, start, end),
  );

  let earned = 0;
  let paid = 0;
  let unpaid = 0;
  const byAgentMap = new Map<string, DueAgentBreakdown>();

  inRange.forEach((booking) => {
    const amount = Number(booking.commission_amount || 0);
    earned += amount;
    const isPaid = booking.commission_status === "PAID";
    if (isPaid) {
      paid += amount;
      return;
    }

    unpaid += amount;
    const agentId = String(booking.agent_id || "");
    const agent = findAgentByReference(agentById, agentId);
    if (!agent) return;
    const routeAgentId = getRecordId(agent);

    const existing = byAgentMap.get(routeAgentId);
    if (existing) {
      existing.bookingCount += 1;
      existing.amount += amount;
      return;
    }
    byAgentMap.set(routeAgentId, {
      agentId: routeAgentId,
      agent,
      agentName: getAgentDisplayName(agent),
      payoutLabel: getAgentPayoutLabel(agent),
      periodKeys: [String(booking.commission_period_key || "")],
      bookingCount: 1,
      amount,
    });
  });

  const byAgent = Array.from(byAgentMap.values()).sort((left, right) =>
    right.amount - left.amount || left.agentName.localeCompare(right.agentName),
  );

  return {
    earned,
    paid,
    unpaid,
    agentCount: byAgent.length,
    bookingCount: inRange.filter((booking) => booking.commission_status !== "PAID").length,
    byAgent,
  };
};

export const getAgentDisplayName = (agent: any) =>
  String(agent?.name || agent?.full_name || "Unnamed Agent");

export const buildAgentLookupMap = <T extends { id?: string; _id?: string; agent_code?: string }>(agents: T[]) => {
  const map = new Map<string, T>();
  agents.forEach((agent) => {
    const keys = new Set<string>();
    const record = getRecordId(agent);
    if (record) keys.add(record);
    if (agent._id) keys.add(String(agent._id));
    if (agent.id) keys.add(String(agent.id));
    const code = getAgentCode(agent);
    if (code) keys.add(code);
    keys.forEach((key) => {
      if (key && !map.has(key)) map.set(key, agent);
    });
  });
  return map;
};

export const findAgentByReference = <T>(map: Map<string, T>, reference: unknown) =>
  map.get(String(reference || "").trim()) || null;

export const getAgentContact = (agent: any) =>
  String(agent?.phone || agent?.contact_number || agent?.email || "");

export const calculateEventCommission = (amount: number, percentage: unknown) =>
  (Number(amount || 0) * Number(percentage || 0)) / 100;

export const isShowBooking = (booking: unknown) => {
  const row = booking as { booking_type?: unknown; show_id?: unknown; activity_id?: unknown };
  if (String(row?.booking_type || "").toUpperCase() === "SHOW") return true;
  return Boolean(row?.show_id && !row?.activity_id);
};

export const filterShowCommissionBookings = (bookings: any[]) =>
  bookings.filter(isShowBooking);

export const buildShowAgentCommissionFields = (
  show: any,
  totalAmount: number,
  bookingTime: Date,
  agent?: any,
) => {
  const agentId = String(show?.agent_id || "");
  const commissionPercentage = agentId ? Number(show?.agent_commission_percentage || 0) : 0;
  const commissionAmount = agentId
    ? calculateEventCommission(totalAmount, commissionPercentage)
    : 0;

  return {
    agent_id: agentId || null,
    agent_commission_percentage: commissionPercentage,
    commission_amount: commissionAmount,
    commission_status: commissionAmount > 0 ? ("UNPAID" as const) : ("PAID" as const),
    commission_period_key:
      commissionAmount > 0
        ? getCommissionPeriodKey(bookingTime, agent?.payout_frequency || "DAILY")
        : null,
    vendor_id: null,
    platform_commission_percentage: 0,
    platform_commission_amount: 0,
    vendor_payout_amount: 0,
    vendor_payout_status: "PAID" as const,
    vendor_payout_period_key: null,
  };
};
