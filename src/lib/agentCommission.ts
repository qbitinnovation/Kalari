import { getAgentCode } from "@/lib/agentId";
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

export const isBookingCommissionDue = (booking: unknown, agent: unknown, today = new Date()) => {
  const row = booking as {
    status?: unknown;
    commission_status?: unknown;
    commission_amount?: unknown;
    commission_period_key?: unknown;
  };
  const agentRecord = agent as { active?: unknown; payout_frequency?: unknown };
  if (agentRecord?.active === false) return false;
  if (String(row?.status || "") !== "CONFIRMED") return false;
  if (row?.commission_status === "PAID") return false;
  if (Number(row?.commission_amount || 0) <= 0) return false;
  const periodKey = String(row?.commission_period_key || "");
  if (!periodKey) return false;
  const dueKeys = getDueCommissionPeriodKeys(agentRecord?.payout_frequency, today);
  return dueKeys.includes(periodKey);
};

export const collectDueCommissionBookings = (
  agents: any[],
  bookings: any[],
  today = new Date()
): DueCommissionBookingsResult => {
  const agentById = buildAgentLookupMap(agents.filter((agent) => agent.active !== false));
  const dueBookings: any[] = [];
  const periodKeys = new Set<string>();
  const agentIds = new Set<string>();
  const byAgentMap = new Map<string, DueAgentBreakdown>();

  bookings.forEach((booking) => {
    const agentId = String(booking.agent_id || "");
    const agent = findAgentByReference(agentById, agentId);
    if (!agent || !isBookingCommissionDue(booking, agent, today)) return;

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
