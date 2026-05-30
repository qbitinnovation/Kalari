import connectDB, { getGenericModel } from "@/lib/db";
import { formatVendorId, getMaxVendorNumber, needsVendorPublicId } from "@/lib/vendorId";
import { readStore, writeStore } from "@/lib/localStore";

export { needsVendorPublicId };

const sortVendorsForBackfill = <T extends { created_at?: string }>(vendors: T[]) =>
  [...vendors].sort((left, right) => String(left.created_at || "").localeCompare(String(right.created_at || "")));

export async function backfillVendorPublicIdsLocal(store: any) {
  store.vendors = store.vendors || [];
  if (!store.vendors.some(needsVendorPublicId)) return { updated: 0 };

  let nextNumber = getMaxVendorNumber(store.vendors);
  let updated = 0;

  sortVendorsForBackfill(store.vendors).forEach((vendor: any) => {
    if (!needsVendorPublicId(vendor)) return;
    nextNumber += 1;
    vendor.vendor_code = formatVendorId(nextNumber);
    updated += 1;
  });

  return { updated };
}

export async function backfillVendorPublicIdsMongo() {
  await connectDB();
  const Vendor = getGenericModel("vendors") as any;

  const vendors = await Vendor.find({}).lean();
  if (!vendors.some(needsVendorPublicId)) return { updated: 0 };

  let nextNumber = getMaxVendorNumber(vendors);
  const vendorUpdates: Array<{ filter: Record<string, unknown>; newId: string }> = [];

  sortVendorsForBackfill(vendors).forEach((vendor: any) => {
    if (!needsVendorPublicId(vendor)) return;
    nextNumber += 1;
    vendorUpdates.push({
      filter: vendor._id ? { _id: vendor._id } : { id: vendor.id },
      newId: formatVendorId(nextNumber),
    });
  });

  for (const update of vendorUpdates) {
    await Vendor.updateOne(update.filter, { $set: { vendor_code: update.newId } });
  }

  return { updated: vendorUpdates.length };
}

export async function backfillVendorPublicIds() {
  try {
    return await backfillVendorPublicIdsMongo();
  } catch {
    const store = await readStore();
    const result = await backfillVendorPublicIdsLocal(store);
    if (result.updated > 0) await writeStore(store);
    return result;
  }
}
