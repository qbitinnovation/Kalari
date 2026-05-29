import { getRecordId } from "@/lib/booking";

export const AGENT_ID_PREFIX = "AGT";

export const parseAgentNumber = (value: unknown): number | null => {
  const match = String(value || "").trim().match(/^AGT-(\d+)$/i);
  return match ? Number(match[1]) : null;
};

export const formatAgentId = (sequence: number) =>
  `${AGENT_ID_PREFIX}-${String(sequence).padStart(4, "0")}`;

export const getAgentCode = (agent: unknown): string => {
  const code = String((agent as { agent_code?: unknown })?.agent_code || "").trim();
  if (parseAgentNumber(code) !== null) return code.toUpperCase();
  return "";
};

export const getMaxAgentNumber = (agents: Array<{ agent_code?: unknown }>) =>
  agents.reduce((highest, agent) => {
    const parsed = parseAgentNumber(getAgentCode(agent));
    return parsed !== null && parsed > highest ? parsed : highest;
  }, 0);

export const createAgentId = (existingAgents: Array<{ agent_code?: unknown }>) =>
  formatAgentId(getMaxAgentNumber(existingAgents) + 1);

export const getAgentPublicId = (agent: unknown) => {
  const code = getAgentCode(agent);
  if (code) return code;
  return "—";
};

export const needsAgentPublicId = (agent: unknown) => !getAgentCode(agent);

export const assignAgentIds = <T extends Record<string, unknown>>(
  existingAgents: Array<{ agent_code?: unknown }>,
  rows: T[]
) => {
  let nextNumber = getMaxAgentNumber(existingAgents);
  return rows.map((row) => {
    if (getAgentCode(row)) return row;
    nextNumber += 1;
    return { ...row, agent_code: formatAgentId(nextNumber) };
  });
};

export const getAgentLookupIds = (agent: unknown, requestedId = "") => {
  const keys = new Set<string>();
  if (requestedId) keys.add(requestedId);
  const recordId = getRecordId(agent);
  if (recordId) keys.add(recordId);
  const mongoId = (agent as { _id?: unknown })?._id;
  if (mongoId) keys.add(String(mongoId));
  return Array.from(keys).filter(Boolean);
};
