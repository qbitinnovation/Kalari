import { db } from '@/lib/database'

export { normalizeActivityLog } from '@/utils/activityLogNormalize'

export interface LogActivityParams {
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  details?: any
  performedBy: string
  ipAddress?: string
  userAgent?: string
  performedAt?: string
}

export const buildActivityLogRow = ({
  action,
  entityType,
  entityId,
  entityName,
  details,
  performedBy,
  ipAddress,
  userAgent,
  performedAt,
}: LogActivityParams) => ({
  action: action.toUpperCase(),
  entity_type: entityType.toUpperCase(),
  entity_id: entityId || null,
  entity_name: entityName || null,
  details: details || null,
  performed_by: performedBy,
  ip_address: ipAddress || null,
  user_agent: userAgent || null,
  performed_at: performedAt || new Date().toISOString(),
})

export const logActivity = async (params: LogActivityParams): Promise<string | null> => {
  try {
    const { data, error } = await db
      .from('activity_logs')
      .insert(buildActivityLogRow(params))

    if (error) {
      console.error('Error logging activity:', error)
      return null
    }

    return (data as any)?.[0]?.id || (data as any)?.[0]?._id || null
  } catch (error) {
    console.error('Error logging activity:', error)
    return null
  }
}

export const logShowCreation = async (showId: string, showTitle: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'SHOW',
    entityId: showId,
    entityName: showTitle,
    details,
    performedBy
  })
}

export const logShowUpdate = async (showId: string, showTitle: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'SHOW',
    entityId: showId,
    entityName: showTitle,
    details,
    performedBy
  })
}

export const logShowDeletion = async (showId: string, showTitle: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'SHOW',
    entityId: showId,
    entityName: showTitle,
    details,
    performedBy
  })
}

export const logActivityCatalogCreation = async (activityId: string, title: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'ACTIVITY',
    entityId: activityId,
    entityName: title,
    details,
    performedBy,
  })
}

export const logActivityCatalogUpdate = async (activityId: string, title: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'ACTIVITY',
    entityId: activityId,
    entityName: title,
    details,
    performedBy,
  })
}

export const logActivityCatalogDeletion = async (activityId: string, title: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'ACTIVITY',
    entityId: activityId,
    entityName: title,
    details,
    performedBy,
  })
}

export const logAgentCreation = async (agentId: string, agentName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'AGENT',
    entityId: agentId,
    entityName: agentName,
    details,
    performedBy,
  })
}

export const logAgentUpdate = async (agentId: string, agentName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'AGENT',
    entityId: agentId,
    entityName: agentName,
    details,
    performedBy,
  })
}

export const logAgentDeletion = async (agentId: string, agentName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'AGENT',
    entityId: agentId,
    entityName: agentName,
    details,
    performedBy,
  })
}

export const logVendorCreation = async (vendorId: string, vendorName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'VENDOR',
    entityId: vendorId,
    entityName: vendorName,
    details,
    performedBy,
  })
}

export const logVendorUpdate = async (vendorId: string, vendorName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'VENDOR',
    entityId: vendorId,
    entityName: vendorName,
    details,
    performedBy,
  })
}

export const logVendorDeletion = async (vendorId: string, vendorName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'VENDOR',
    entityId: vendorId,
    entityName: vendorName,
    details,
    performedBy,
  })
}

export const logCustomerCreation = async (customerId: string, customerName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'CUSTOMER',
    entityId: customerId,
    entityName: customerName,
    details,
    performedBy,
  })
}

export const logCustomerUpdate = async (customerId: string, customerName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'CUSTOMER',
    entityId: customerId,
    entityName: customerName,
    details,
    performedBy,
  })
}

export const logCustomerDeletion = async (customerId: string, customerName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'CUSTOMER',
    entityId: customerId,
    entityName: customerName,
    details,
    performedBy,
  })
}

export const logBookingCreation = async (bookingId: string, showTitle: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'BOOKING',
    entityType: 'BOOKING',
    entityId: bookingId,
    entityName: showTitle,
    details,
    performedBy
  })
}

export const logBookingCancellation = async (bookingId: string, showTitle: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CANCELLATION',
    entityType: 'BOOKING',
    entityId: bookingId,
    entityName: showTitle,
    details,
    performedBy
  })
}

export const logTicketGeneration = async (ticketId: string, ticketCode: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'TICKET',
    entityId: ticketId,
    entityName: ticketCode,
    details,
    performedBy
  })
}

export const logLayoutCreation = async (layoutId: string, layoutName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'CREATE',
    entityType: 'LAYOUT',
    entityId: layoutId,
    entityName: layoutName,
    details,
    performedBy
  })
}

export const logLayoutUpdate = async (layoutId: string, layoutName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'UPDATE',
    entityType: 'LAYOUT',
    entityId: layoutId,
    entityName: layoutName,
    details,
    performedBy
  })
}

export const logLayoutDeletion = async (layoutId: string, layoutName: string, performedBy: string, details?: any) => {
  return logActivity({
    action: 'DELETE',
    entityType: 'LAYOUT',
    entityId: layoutId,
    entityName: layoutName,
    details,
    performedBy
  })
}
