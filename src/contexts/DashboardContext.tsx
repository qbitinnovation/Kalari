"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { db } from '@/lib/database'
import { differenceInDays, differenceInHours, differenceInMinutes, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns'

interface DashboardMetrics {
  totalRevenue: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  todayBookings: number
  weeklyGrowth: number
  monthlyGrowth: number
  lastWeekRevenue: number
  lastMonthRevenue: number
  yesterdayRevenue: number
  dailyGrowth: number
}

interface UpcomingEvent {
  id: string
  name: string
  date: string
  time: string
  booked: number
  capacity: number
  countdown: string
}

interface TopEvent {
  name: string
  revenue: number
  tickets: number
  avgPrice: number
}

interface ActivityLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: any
  performed_by: string
  performed_at: string
  ip_address: string | null
  user_agent: string | null
}

interface DashboardData {
  metrics: DashboardMetrics
  upcomingEvents: UpcomingEvent[]
  topEvents: TopEvent[]
  dailyRevenue: number[]
  weeklyTickets: number[]
  monthlyTickets: number
  activityLogs: ActivityLog[]
}

interface DashboardContextType {
  data: DashboardData | null
  loading: boolean
  logsLoading: boolean
  fetchDashboardData: () => Promise<void>
  fetchActivityLogs: () => Promise<void>
  refreshData: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export const useDashboard = () => {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

const initialMetrics: DashboardMetrics = {
  totalRevenue: 0,
  todayRevenue: 0,
  weekRevenue: 0,
  monthRevenue: 0,
  todayBookings: 0,
  weeklyGrowth: 0,
  monthlyGrowth: 0,
  lastWeekRevenue: 0,
  lastMonthRevenue: 0,
  yesterdayRevenue: 0,
  dailyGrowth: 0
}

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const lastFetchTime = useRef<number>(0)
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

  const fetchMetrics = async (): Promise<DashboardMetrics> => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const yesterday = subDays(now, 1).toISOString().split('T')[0]

    // Date ranges
    const thisWeekStart = startOfWeek(now).toISOString()
    const thisWeekEnd = endOfWeek(now).toISOString()
    const lastWeekStart = startOfWeek(subWeeks(now, 1)).toISOString()
    const lastWeekEnd = endOfWeek(subWeeks(now, 1)).toISOString()

    const thisMonthStart = startOfMonth(now).toISOString()
    const thisMonthEnd = endOfMonth(now).toISOString()
    const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString()
    const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString()

    // Get all tickets for total revenue (including ACTIVE and COMPLETED)
    const { data: allTickets } = await db
      .from('tickets')
      .select('price, generated_at, status')
      .in('status', ['ACTIVE', 'COMPLETED'])

    if (!allTickets) return initialMetrics

    // Calculate total revenue from all valid tickets
    const totalRevenue = allTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Today's data
    const todayTickets = allTickets.filter((ticket: any) => {
      const ticketDate = new Date(ticket.generated_at).toISOString().split('T')[0]
      return ticketDate === today
    })
    const todayRevenue = todayTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Yesterday's data
    const yesterdayTickets = allTickets.filter((ticket: any) => {
      const ticketDate = new Date(ticket.generated_at).toISOString().split('T')[0]
      return ticketDate === yesterday
    })
    const yesterdayRevenue = yesterdayTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // This week's data
    const thisWeekTickets = allTickets.filter((ticket: any) => {
      const ticketDateTime = new Date(ticket.generated_at)
      return ticketDateTime >= new Date(thisWeekStart) && ticketDateTime <= new Date(thisWeekEnd)
    })
    const weekRevenue = thisWeekTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Last week's data
    const lastWeekTickets = allTickets.filter((ticket: any) => {
      const ticketDateTime = new Date(ticket.generated_at)
      return ticketDateTime >= new Date(lastWeekStart) && ticketDateTime <= new Date(lastWeekEnd)
    })
    const lastWeekRevenue = lastWeekTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // This month's data
    const thisMonthTickets = allTickets.filter((ticket: any) => {
      const ticketDateTime = new Date(ticket.generated_at)
      return ticketDateTime >= new Date(thisMonthStart) && ticketDateTime <= new Date(thisMonthEnd)
    })
    const monthRevenue = thisMonthTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Last month's data
    const lastMonthTickets = allTickets.filter((ticket: any) => {
      const ticketDateTime = new Date(ticket.generated_at)
      return ticketDateTime >= new Date(lastMonthStart) && ticketDateTime <= new Date(lastMonthEnd)
    })
    const lastMonthRevenue = lastMonthTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Calculate growth percentages
    const weeklyGrowth = lastWeekRevenue > 0 ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : (weekRevenue > 0 ? 100 : 0)
    const monthlyGrowth = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : (monthRevenue > 0 ? 100 : 0)
    const dailyGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : (todayRevenue > 0 ? 100 : 0)

    return {
      totalRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      todayBookings: todayTickets.length,
      weeklyGrowth,
      monthlyGrowth,
      lastWeekRevenue,
      lastMonthRevenue,
      yesterdayRevenue,
      dailyGrowth
    }
  }

  const fetchUpcomingEvents = async (): Promise<UpcomingEvent[]> => {
    const today = new Date().toISOString().split('T')[0]

    // Get upcoming shows
    const { data: shows } = await db
      .from('shows')
      .select(`
        *,
        layout:layouts(*)
      `)
      .eq('active', true)
      .gte('date', today)
      .order('date')
      .limit(10)

    if (!shows) return []

    const events: UpcomingEvent[] = []
    const now = new Date()

    for (const show of shows) {
      // Check if show has already started
      const showDateTime = new Date(`${show.date}T${show.time}`)
      
      // Skip shows that have already started
      if (showDateTime <= now) {
        continue
      }

      // Calculate total capacity
      let capacity = 0
      if (show.layout?.structure?.sections) {
        show.layout.structure.sections.forEach((section: any) => {
          if (section.rows && Array.isArray(section.rows)) {
            // New format with individual row configuration
            capacity += section.rows.reduce((sum: number, row: any) => sum + (row.seats || 0), 0)
          } else {
            // Fallback for old format
            capacity += (section.rows || 0) * (section.seatsPerRow || 0)
          }
        })
      }

      // Get bookings for this show
      const { data: bookings } = await db
        .from('bookings')
        .select('seat_code')
        .eq('show_id', show.id || show._id)
        .eq('status', 'CONFIRMED')

      // Count booked seats
      let booked = 0
      bookings?.forEach((booking: any) => {
        try {
          const seats = JSON.parse(booking.seat_code)
          booked += Array.isArray(seats) ? seats.length : 1
        } catch {
          booked += booking.seat_code.includes(',')
            ? booking.seat_code.split(',').length
            : 1
        }
      })

      // Calculate countdown
      const countdown = getCountdown(showDateTime, now)

      events.push({
        id: show.id || show._id,
        name: show.title,
        date: show.date,
        time: show.time,
        booked,
        capacity,
        countdown
      })

      // Stop when we have 3 upcoming events
      if (events.length >= 3) {
        break
      }
    }

    return events
  }

  const fetchTopEvents = async (): Promise<TopEvent[]> => {
    // Get all shows with their revenue
    const { data: shows } = await db
      .from('shows')
      .select('id, _id, title, price')

    if (!shows) return []

    const eventStats: TopEvent[] = []

    for (const show of shows) {
      // Get tickets for this show
      const { data: tickets } = await db
        .from('tickets')
        .select('price')
        .eq('show_id', show.id || show._id)
        .in('status', ['ACTIVE', 'COMPLETED'])

      if (tickets && tickets.length > 0) {
        const revenue = tickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)
        const ticketCount = tickets.length
        const avgPrice = revenue / ticketCount

        eventStats.push({
          name: show.title,
          revenue,
          tickets: ticketCount,
          avgPrice
        })
      }
    }

    // Sort by revenue and take top 3
    eventStats.sort((a, b) => b.revenue - a.revenue)
    return eventStats.slice(0, 3)
  }

  const fetchDailyData = async (): Promise<{ dailyRevenue: number[], weeklyTickets: number[], monthlyTickets: number }> => {
    const { data: tickets } = await db
      .from('tickets')
      .select('price, generated_at')
      .in('status', ['ACTIVE', 'COMPLETED'])
      .order('generated_at')

    if (!tickets) return { dailyRevenue: [], weeklyTickets: [], monthlyTickets: 0 }

    const now = new Date()
    const thisMonthStart = startOfMonth(now).toISOString()
    const thisMonthEnd = endOfMonth(now).toISOString()

    // Get last 7 days of data
    const revenueArray: number[] = []
    const ticketsArray: number[] = []

    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = date.toISOString().split('T')[0]

      const dayTickets = tickets.filter((ticket: any) =>
        ticket.generated_at.startsWith(dateStr)
      )

      const dayRevenue = dayTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

      revenueArray.push(dayRevenue)
      ticketsArray.push(dayTickets.length)
    }

    // Calculate actual monthly tickets
    const monthlyTicketsData = tickets.filter((ticket: any) =>
      ticket.generated_at >= thisMonthStart && ticket.generated_at <= thisMonthEnd
    )

    return {
      dailyRevenue: revenueArray,
      weeklyTickets: ticketsArray,
      monthlyTickets: monthlyTicketsData.length
    }
  }

  const getCountdown = (showDateTime: Date, now: Date) => {
    if (showDateTime < now) {
      return 'Started'
    }

    const days = differenceInDays(showDateTime, now)
    const hours = differenceInHours(showDateTime, now) % 24
    const minutes = differenceInMinutes(showDateTime, now) % 60

    if (days > 0) {
      return `${days}d ${hours}h`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const fetchActivityLogs = useCallback(async () => {
    try {
      setLogsLoading(true)
      const { data: logs } = await db
        .from('activity_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(50)

      if (logs && data) {
        setData(prev => prev ? { ...prev, activityLogs: logs } : null)
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [data])

  const fetchDashboardData = useCallback(async () => {
    // Check if we have cached data that's still fresh
    const now = Date.now()
    if (data && (now - lastFetchTime.current) < CACHE_DURATION) {
      return
    }

    try {
      setLoading(true)
      
      const [metrics, upcomingEvents, topEvents, dailyData, logs] = await Promise.all([
        fetchMetrics(),
        fetchUpcomingEvents(),
        fetchTopEvents(),
        fetchDailyData(),
        db
          .from('activity_logs')
          .select('*')
          .order('performed_at', { ascending: false })
          .limit(50)
          .then(({ data }) => data || [])
      ])

      const newData: DashboardData = {
        metrics,
        upcomingEvents,
        topEvents,
        dailyRevenue: dailyData.dailyRevenue,
        weeklyTickets: dailyData.weeklyTickets,
        monthlyTickets: dailyData.monthlyTickets,
        activityLogs: logs
      }

      setData(newData)
      lastFetchTime.current = now
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [data])

  const refreshData = useCallback(async () => {
    // Force refresh by clearing cache
    lastFetchTime.current = 0
    await fetchDashboardData()
  }, [fetchDashboardData])

  const value = {
    data,
    loading,
    logsLoading,
    fetchDashboardData,
    fetchActivityLogs,
    refreshData
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
