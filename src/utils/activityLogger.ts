import { db } from '@/lib/database'

export interface LogActivityParams {
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  details?: any
  performedBy: string
  ipAddress?: string
  userAgent?: string
}

export const logActivity = async ({
  action,
  entityType,
  entityId,
  entityName,
  details,
  performedBy,
  ipAddress,
  userAgent
}: LogActivityParams): Promise<string | null> => {
  try {
    const { data, error } = await db
      .from('activity_logs')
      .insert({
        action: action.toUpperCase(),
        entity_type: entityType.toUpperCase(),
        entity_id: entityId || null,
        entity_name: entityName || null,
        details: details || null,
        performed_by: performedBy,
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      })

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

// Convenience functions for common actions
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
