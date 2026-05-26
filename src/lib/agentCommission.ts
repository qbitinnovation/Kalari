export type PayoutFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

const pad = (value: number) => String(value).padStart(2, "0");

export const normalizePayoutFrequency = (value: unknown): PayoutFrequency => {
  const frequency = String(value || "").toUpperCase();
  if (frequency === "WEEKLY" || frequency === "MONTHLY") return frequency;
  return "DAILY";
};

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

export const getAgentDisplayName = (agent: any) =>
  String(agent?.name || agent?.full_name || "Unnamed Agent");

export const getAgentContact = (agent: any) =>
  String(agent?.phone || agent?.contact_number || agent?.email || "");

export const calculateEventCommission = (amount: number, percentage: unknown) =>
  (Number(amount || 0) * Number(percentage || 0)) / 100;
