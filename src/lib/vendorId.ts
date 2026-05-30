import { getRecordId } from "@/lib/booking";

export const VENDOR_ID_PREFIX = "VND";

export const parseVendorNumber = (value: unknown): number | null => {
  const match = String(value || "").trim().match(/^VND-(\d+)$/i);
  return match ? Number(match[1]) : null;
};

export const formatVendorId = (sequence: number) =>
  `${VENDOR_ID_PREFIX}-${String(sequence).padStart(4, "0")}`;

export const getVendorCode = (vendor: unknown): string => {
  const code = String((vendor as { vendor_code?: unknown })?.vendor_code || "").trim();
  if (parseVendorNumber(code) !== null) return code.toUpperCase();
  return "";
};

export const getMaxVendorNumber = (vendors: Array<{ vendor_code?: unknown }>) =>
  vendors.reduce((highest, vendor) => {
    const parsed = parseVendorNumber(getVendorCode(vendor));
    return parsed !== null && parsed > highest ? parsed : highest;
  }, 0);

export const createVendorId = (existingVendors: Array<{ vendor_code?: unknown }>) =>
  formatVendorId(getMaxVendorNumber(existingVendors) + 1);

export const getVendorPublicId = (vendor: unknown) => {
  const code = getVendorCode(vendor);
  if (code) return code;
  return "—";
};

export const needsVendorPublicId = (vendor: unknown) => !getVendorCode(vendor);

export const assignVendorIds = <T extends Record<string, unknown>>(
  existingVendors: Array<{ vendor_code?: unknown }>,
  rows: T[],
) => {
  let nextNumber = getMaxVendorNumber(existingVendors);
  return rows.map((row) => {
    if (getVendorCode(row)) return row;
    nextNumber += 1;
    return { ...row, vendor_code: formatVendorId(nextNumber) };
  });
};

export const getVendorLookupIds = (vendor: unknown, requestedId = "") => {
  const keys = new Set<string>();
  if (requestedId) keys.add(requestedId);
  const recordId = getRecordId(vendor);
  if (recordId) keys.add(recordId);
  const mongoId = (vendor as { _id?: unknown })?._id;
  if (mongoId) keys.add(String(mongoId));
  return Array.from(keys).filter(Boolean);
};
