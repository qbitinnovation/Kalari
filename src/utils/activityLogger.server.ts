import connectDB, { getGenericModel } from '@/lib/db'
import { readStore, writeStore } from '@/lib/localStore'
import { buildActivityLogRow, type LogActivityParams } from '@/utils/activityLogger'

export async function logActivityServer(params: LogActivityParams): Promise<string | null> {
  const row = {
    ...buildActivityLogRow(params),
    id: `activity_log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }

  try {
    await connectDB()
    const Model = getGenericModel('activity_logs') as any
    const docs = await Model.insertMany([row])
    return docs?.[0]?.id || String(docs?.[0]?._id || row.id)
  } catch (error) {
    try {
      const store = await readStore()
      store.activity_logs = store.activity_logs || []
      store.activity_logs.push(row)
      await writeStore(store)
      return row.id
    } catch (fallbackError) {
      console.error('Error logging activity on server:', error, fallbackError)
      return null
    }
  }
}

export const logVendorPayoutSettlement = async (
  performedBy: string,
  details: { bookingCount: number; vendorCount?: number; amount?: number; scope?: string },
) => {
  return logActivityServer({
    action: 'SETTLE',
    entityType: 'VENDOR_PAYOUT',
    entityName: 'Vendor payout',
    details,
    performedBy,
  })
}

export const logCommissionSettlement = async (
  performedBy: string,
  details: { bookingCount: number; agentCount?: number; amount?: number; scope?: string },
) => {
  return logActivityServer({
    action: 'SETTLE',
    entityType: 'COMMISSION',
    entityName: 'Commission payout',
    details,
    performedBy,
  })
}

export const logBookingCreationServer = async (
  bookingId: string,
  title: string,
  performedBy: string,
  details?: any,
) => {
  return logActivityServer({
    action: 'BOOKING',
    entityType: 'BOOKING',
    entityId: bookingId,
    entityName: title,
    details,
    performedBy,
  })
}

export const logBookingCancellationServer = async (
  bookingId: string,
  title: string,
  performedBy: string,
  details?: any,
) => {
  return logActivityServer({
    action: 'CANCELLATION',
    entityType: 'BOOKING',
    entityId: bookingId,
    entityName: title,
    details,
    performedBy,
  })
}
