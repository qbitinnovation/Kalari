"use client";

import React, { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/database'
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears,
  format, parseISO
} from 'date-fns'
import {
  CurrencyDollarIcon,
  TicketIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logActivity } from '@/utils/activityLogger'
import { AdminTable, AdminTableBody, AdminTableHead, AdminTableSkeleton, Button, DateRangePicker } from '@/components/ui'

interface AnalyticsData {
  totalRevenue: number
  totalTickets: number
  averageTicketPrice: number
  averageTicketsPerShow: number
  dailyData: DailyData[]
  monthlyData: MonthlyData[]
  yearlyData: YearlyData[]
  showPerformance: ShowPerformance[]
  customerPerformance: CustomerPerformance[]
  revenueComparison: RevenueComparison
}

interface DailyData {
  date: string
  revenue: number
  tickets: number
  shows: number
}

interface MonthlyData {
  month: string
  revenue: number
  tickets: number
  shows: number
}

interface YearlyData {
  year: string
  revenue: number
  tickets: number
  shows: number
}

interface ShowPerformance {
  showName: string
  showDate: string
  revenue: number
  tickets: number
  capacity: number
  occupancyRate: number
}

interface RevenueComparison {
  currentPeriod: number
  previousPeriod: number
  growthRate: number
  periodType: string
}

interface CustomerPerformance {
  customerId: string
  customerName: string
  customerEmail?: string
  totalRevenue: number
  totalTickets: number
  totalBookings: number
  averageOrderValue: number
  lastBookingDate: string
}



const Analytics: React.FC = () => {
  const darkMode = useDarkMode()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalTickets: 0,
    averageTicketPrice: 0,
    averageTicketsPerShow: 0,
    dailyData: [],
    monthlyData: [],
    yearlyData: [],
    showPerformance: [],
    customerPerformance: [],
    revenueComparison: {
      currentPeriod: 0,
      previousPeriod: 0,
      growthRate: 0,
      periodType: 'month'
    }
  })

  // Filter states
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 90), 'yyyy-MM-dd'), // Extended to 90 days for more data
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [viewType] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  const [comparisonPeriod, setComparisonPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch all tickets with show information
      const startDate = dateRange.start + 'T00:00:00'
      const endDate = dateRange.end + 'T23:59:59'
      
      console.log('Fetching analytics data for date range:', { startDate, endDate })
      
      const { data: tickets, error } = await db
        .from('tickets')
        .select(`
          *,
          show:shows(id, title, date, time, price)
        `)
        .in('status', ['ACTIVE', 'COMPLETED'])
        .gte('generated_at', startDate)
        .lte('generated_at', endDate)

      if (error) throw error

      console.log('Fetched tickets:', tickets?.length || 0, 'tickets')

      // Fetch shows for capacity calculation
      const { data: shows } = await db
        .from('shows')
        .select(`
          *,
          layout:layouts(structure)
        `)

      if (!tickets || !shows) {
        console.log('No tickets or shows found')
        return
      }

      // Calculate basic metrics (filtered by date range)
      const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.price, 0)
      const totalTickets = tickets.length
      const averageTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0
      
      // Calculate average tickets per show (independent of date filter)
      const { data: allTickets } = await db
        .from('tickets')
        .select(`
          id,
          show:shows(id)
        `)
        .in('status', ['ACTIVE', 'COMPLETED'])
      
      const allUniqueShows = new Set(allTickets?.map((ticket: any) => ticket.show?.id).filter(Boolean) || [])
      const totalAllTickets = allTickets?.length || 0
      const averageTicketsPerShow = allUniqueShows.size > 0 ? totalAllTickets / allUniqueShows.size : 0

      // Process daily data
      const dailyData = processDailyData(tickets)
      
      // Process monthly data
      const monthlyData = processMonthlyData(tickets)
      
      // Process yearly data
      const yearlyData = processYearlyData(tickets)

      // Calculate show performance
      const showPerformance = await calculateShowPerformance(shows, tickets)

      // Calculate customer performance
      const customerPerformance = await calculateCustomerPerformance(startDate, endDate)

      // Calculate revenue comparison
      const revenueComparison = calculateRevenueComparison(tickets, comparisonPeriod)

      console.log('Analytics data processed:', {
        totalRevenue,
        totalTickets,
        dailyDataLength: dailyData.length,
        monthlyDataLength: monthlyData.length,
        yearlyDataLength: yearlyData.length,
        showPerformanceLength: showPerformance.length
      })

      setAnalytics({
        totalRevenue,
        totalTickets,
        averageTicketPrice,
        averageTicketsPerShow,
        dailyData,
        monthlyData,
        yearlyData,
        showPerformance,
        customerPerformance,
        revenueComparison
      })

    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange, comparisonPeriod])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  const processDailyData = (tickets: any[]): DailyData[] => {
    const dailyMap = new Map<string, { revenue: number; tickets: number; shows: Set<string> }>()

    tickets.forEach(ticket => {
      const date = format(parseISO(ticket.generated_at), 'yyyy-MM-dd')
      const existing = dailyMap.get(date) || { revenue: 0, tickets: 0, shows: new Set() }
      
      existing.revenue += ticket.price
      existing.tickets += 1
      if (ticket.show?.id) existing.shows.add(ticket.show.id)
      
      dailyMap.set(date, existing)
    })

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        tickets: data.tickets,
        shows: data.shows.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const processMonthlyData = (tickets: any[]): MonthlyData[] => {
    const monthlyMap = new Map<string, { revenue: number; tickets: number; shows: Set<string> }>()

    tickets.forEach(ticket => {
      const month = format(parseISO(ticket.generated_at), 'yyyy-MM')
      const existing = monthlyMap.get(month) || { revenue: 0, tickets: 0, shows: new Set() }
      
      existing.revenue += ticket.price
      existing.tickets += 1
      if (ticket.show?.id) existing.shows.add(ticket.show.id)
      
      monthlyMap.set(month, existing)
    })

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        tickets: data.tickets,
        shows: data.shows.size
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  const processYearlyData = (tickets: any[]): YearlyData[] => {
    const yearlyMap = new Map<string, { revenue: number; tickets: number; shows: Set<string> }>()

    tickets.forEach(ticket => {
      const year = format(parseISO(ticket.generated_at), 'yyyy')
      const existing = yearlyMap.get(year) || { revenue: 0, tickets: 0, shows: new Set() }
      
      existing.revenue += ticket.price
      existing.tickets += 1
      if (ticket.show?.id) existing.shows.add(ticket.show.id)
      
      yearlyMap.set(year, existing)
    })

    return Array.from(yearlyMap.entries())
      .map(([year, data]) => ({
        year,
        revenue: data.revenue,
        tickets: data.tickets,
        shows: data.shows.size
      }))
      .sort((a, b) => a.year.localeCompare(b.year))
  }

  const calculateShowPerformance = async (shows: any[], tickets: any[]): Promise<ShowPerformance[]> => {
    const showPerformanceMap = new Map<string, { revenue: number; tickets: number; capacity: number; showName: string; showDate: string }>()

    // Calculate capacity for each show
    shows.forEach(show => {
      let capacity = 0
      if (show.layout?.structure?.sections) {
        show.layout.structure.sections.forEach((section: any) => {
          if (section.rows && Array.isArray(section.rows)) {
            // New format with individual row configuration
            capacity += section.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
          } else {
            // Fallback for old format
            capacity += section.rows * section.seatsPerRow || 0
          }
        })
      }

      showPerformanceMap.set(show.id, {
        revenue: 0,
        tickets: 0,
        capacity,
        showName: show.title,
        showDate: show.date
      })
    })

    // Add ticket data
    tickets.forEach(ticket => {
      if (ticket.show?.id && showPerformanceMap.has(ticket.show.id)) {
        const existing = showPerformanceMap.get(ticket.show.id)!
        existing.revenue += ticket.price
        existing.tickets += 1
      }
    })

    return Array.from(showPerformanceMap.entries())
      .map(([showId, data]) => ({
        showName: data.showName,
        showDate: data.showDate,
        revenue: data.revenue,
        tickets: data.tickets,
        capacity: data.capacity,
        occupancyRate: data.capacity > 0 ? (data.tickets / data.capacity) * 100 : 0
      }))
      .filter(show => show.tickets > 0)
      .sort((a, b) => b.revenue - a.revenue)
  }

  const calculateCustomerPerformance = async (startDate: string, endDate: string): Promise<CustomerPerformance[]> => {
    try {
      // Fetch bookings with customer and ticket information
      const { data: bookings, error } = await db
        .from('bookings')
        .select(`
          id,
          customer_id,
          booking_time,
          customers!customer_id(id, name, email),
          tickets(id, price, status)
        `)
        .eq('status', 'CONFIRMED')
        .gte('booking_time', startDate)
        .lte('booking_time', endDate)

      if (error) throw error

      if (!bookings) return []

      // Group by customer
      const customerMap = new Map<string, {
        customerId: string
        customerName: string
        customerEmail?: string
        totalRevenue: number
        totalTickets: number
        totalBookings: number
        lastBookingDate: string
      }>()

      bookings.forEach((booking: any) => {
        if (!booking.customers) return

        const customer = booking.customers
        const customerId = customer.id
        const existing = customerMap.get(customerId) || {
          customerId,
          customerName: customer.name,
          customerEmail: customer.email,
          totalRevenue: 0,
          totalTickets: 0,
          totalBookings: 0,
          lastBookingDate: booking.booking_time
        }

        // Calculate revenue from active/completed tickets only
        const activeTickets = booking.tickets?.filter((ticket: any) => 
          ticket.status === 'ACTIVE' || ticket.status === 'COMPLETED'
        ) || []
        
        existing.totalRevenue += activeTickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)
        existing.totalTickets += activeTickets.length
        existing.totalBookings += 1
        
        // Update last booking date if this one is more recent
        if (new Date(booking.booking_time) > new Date(existing.lastBookingDate)) {
          existing.lastBookingDate = booking.booking_time
        }

        customerMap.set(customerId, existing)
      })

      // Convert to array and calculate average order value
      return Array.from(customerMap.values())
        .map(customer => ({
          ...customer,
          averageOrderValue: customer.totalBookings > 0 ? customer.totalRevenue / customer.totalBookings : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue) // Sort by revenue descending

    } catch (error) {
      console.error('Error calculating customer performance:', error)
      return []
    }
  }

  const calculateRevenueComparison = (tickets: any[], period: string): RevenueComparison => {
    const now = new Date()
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date

    switch (period) {
      case 'day':
        currentStart = startOfDay(now)
        currentEnd = endOfDay(now)
        previousStart = startOfDay(subDays(now, 1))
        previousEnd = endOfDay(subDays(now, 1))
        break
      case 'week':
        currentStart = startOfWeek(now)
        currentEnd = endOfWeek(now)
        previousStart = startOfWeek(subWeeks(now, 1))
        previousEnd = endOfWeek(subWeeks(now, 1))
        break
      case 'month':
        currentStart = startOfMonth(now)
        currentEnd = endOfMonth(now)
        previousStart = startOfMonth(subMonths(now, 1))
        previousEnd = endOfMonth(subMonths(now, 1))
        break
      case 'year':
        currentStart = startOfYear(now)
        currentEnd = endOfYear(now)
        previousStart = startOfYear(subYears(now, 1))
        previousEnd = endOfYear(subYears(now, 1))
        break
      default:
        currentStart = startOfMonth(now)
        currentEnd = endOfMonth(now)
        previousStart = startOfMonth(subMonths(now, 1))
        previousEnd = endOfMonth(subMonths(now, 1))
    }

    const currentPeriodTickets = tickets.filter(ticket => {
      const ticketDate = parseISO(ticket.generated_at)
      return ticketDate >= currentStart && ticketDate <= currentEnd
    })

    const previousPeriodTickets = tickets.filter(ticket => {
      const ticketDate = parseISO(ticket.generated_at)
      return ticketDate >= previousStart && ticketDate <= previousEnd
    })

    const currentPeriod = currentPeriodTickets.reduce((sum, ticket) => sum + ticket.price, 0)
    const previousPeriod = previousPeriodTickets.reduce((sum, ticket) => sum + ticket.price, 0)
    const growthRate = previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0

    return {
      currentPeriod,
      previousPeriod,
      growthRate,
      periodType: period
    }
  }

  const exportData = async (exportFormat: 'csv' | 'json') => {
    const data = {
      summary: {
        totalRevenue: analytics.totalRevenue,
        totalTickets: analytics.totalTickets,
        averageTicketPrice: analytics.averageTicketPrice,
        averageTicketsPerShow: analytics.averageTicketsPerShow,
        dateRange: dateRange
      },
      dailyData: analytics.dailyData,
      monthlyData: analytics.monthlyData,
      yearlyData: analytics.yearlyData,
      showPerformance: analytics.showPerformance,
      customerPerformance: analytics.customerPerformance,
      revenueComparison: analytics.revenueComparison
    }

    // Get current user email for logging
    const { data: { user } } = await db.auth.getUser()
    const userEmail = user?.email || 'unknown'

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)

      // Log the JSON export
      await logActivity({
        action: 'EXPORT',
        entityType: 'ANALYTICS',
        entityName: 'JSON Report',
        details: {
          format: 'JSON',
          dateRange: dateRange,
          totalRevenue: analytics.totalRevenue,
          totalTickets: analytics.totalTickets,
          exported_at: new Date().toISOString()
        },
        performedBy: userEmail
      })
    } else {
      // Comprehensive CSV export with all analytics data
      const csvSections = []
      
      // Header with date range
      csvSections.push('Analytics Dashboard Report')
      csvSections.push(`Date Range: ${dateRange.start} to ${dateRange.end}`)
      csvSections.push(`Generated: ${format(new Date(), 'yyyy-MM-dd h:mm:ss a')}`)
      csvSections.push('')
      
      // Summary metrics
      csvSections.push('SUMMARY METRICS')
      csvSections.push('Metric,Value')
      csvSections.push(`Total Revenue,"${analytics.totalRevenue} INR"`)
      csvSections.push(`Total Tickets,${analytics.totalTickets}`)
      csvSections.push(`Average Ticket Price,"${analytics.averageTicketPrice.toFixed(0)} INR"`)
      csvSections.push(`Average Tickets Per Show,${analytics.averageTicketsPerShow.toFixed(0)}`)
      csvSections.push('')
      
      // Daily performance data
      if (analytics.dailyData.length > 0) {
        csvSections.push('DAILY PERFORMANCE')
        csvSections.push('Date,Revenue (INR),Tickets,Shows')
        analytics.dailyData.forEach(day => {
          csvSections.push(`${day.date},${day.revenue},${day.tickets},${day.shows}`)
        })
        csvSections.push('')
      }
      
      // Monthly performance data
      if (analytics.monthlyData.length > 0) {
        csvSections.push('MONTHLY PERFORMANCE')
        csvSections.push('Month,Revenue (INR),Tickets,Shows')
        analytics.monthlyData.forEach(month => {
          const monthFormatted = format(parseISO(month.month + '-01'), 'MMM yyyy')
          csvSections.push(`"${monthFormatted}",${month.revenue},${month.tickets},${month.shows}`)
        })
        csvSections.push('')
      }
      
      // Yearly performance data
      if (analytics.yearlyData.length > 0) {
        csvSections.push('YEARLY PERFORMANCE')
        csvSections.push('Year,Revenue (INR),Tickets,Shows')
        analytics.yearlyData.forEach(year => {
          csvSections.push(`${year.year},${year.revenue},${year.tickets},${year.shows}`)
        })
        csvSections.push('')
      }
      
      // Show performance data
      if (analytics.showPerformance.length > 0) {
        csvSections.push('SHOW PERFORMANCE')
        csvSections.push('Show Name,Show Date,Revenue (INR),Tickets Sold,Capacity,Occupancy Rate (%)')
        analytics.showPerformance.forEach(show => {
          const showDateFormatted = format(parseISO(show.showDate), 'MMM dd yyyy')
          csvSections.push(`"${show.showName}","${showDateFormatted}",${show.revenue},${show.tickets},${show.capacity},${show.occupancyRate.toFixed(1)}`)
        })
        csvSections.push('')
      }
      
      // Customer performance data
      if (analytics.customerPerformance.length > 0) {
        csvSections.push('CUSTOMER PERFORMANCE')
        csvSections.push('Customer Name,Email,Total Revenue (INR),Total Tickets,Total Bookings,Average Order Value (INR),Last Booking Date')
        analytics.customerPerformance.forEach(customer => {
          const lastBookingFormatted = format(parseISO(customer.lastBookingDate), 'MMM dd yyyy')
          csvSections.push(`"${customer.customerName}","${customer.customerEmail || 'N/A'}",${customer.totalRevenue},${customer.totalTickets},${customer.totalBookings},${customer.averageOrderValue.toFixed(0)},"${lastBookingFormatted}"`)
        })
      }

      const csvContent = csvSections.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)

      // Log the CSV export
      await logActivity({
        action: 'EXPORT',
        entityType: 'ANALYTICS',
        entityName: 'CSV Report',
        details: {
          format: 'CSV',
          dateRange: dateRange,
          totalRevenue: analytics.totalRevenue,
          totalTickets: analytics.totalTickets,
          exported_at: new Date().toISOString()
        },
        performedBy: userEmail
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Analytics Dashboard
          </h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Comprehensive business intelligence and financial reporting
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Date Range */}
          <DateRangePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={setDateRange}
          />

          {/* Export */}
          <div className="flex justify-center sm:justify-start">
            <Button size="sm" onClick={async () => await exportData('csv')}>
              <ArrowDownTrayIcon className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Revenue */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {loading ? <span className={`inline-block h-8 w-28 animate-pulse rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} /> : `₹${analytics.totalRevenue.toLocaleString()}`}
            </p>
          </div>
        </div>

        {/* Total Tickets */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TicketIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Tickets</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {loading ? <span className={`inline-block h-8 w-16 animate-pulse rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} /> : analytics.totalTickets.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Average Ticket Price */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg. Ticket Price</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {loading ? <span className={`inline-block h-8 w-20 animate-pulse rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} /> : `₹${analytics.averageTicketPrice.toFixed(0)}`}
            </p>
          </div>
        </div>

        {/* Average Tickets Per Show */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <UserGroupIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Avg. Tickets Per Show</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {loading ? <span className={`inline-block h-8 w-16 animate-pulse rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} /> : analytics.averageTicketsPerShow.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Active Customers */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <UserGroupIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Customers</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{analytics.customerPerformance.length}</p>
          </div>
        </div>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Time-based Data */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {viewType.charAt(0).toUpperCase() + viewType.slice(1)} Performance
          </h3>
          
            <AdminTable className="w-full">
              <AdminTableHead>
                <tr className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {viewType === 'daily' ? 'Date' : viewType === 'monthly' ? 'Month' : 'Year'}
                  </th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tickets</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Shows</th>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeleton columns={4} />
                ) : (viewType === 'daily' ? analytics.dailyData : 
                  viewType === 'monthly' ? analytics.monthlyData : 
                  analytics.yearlyData).length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`py-8 text-center text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No data available for the selected date range
                    </td>
                  </tr>
                ) : (viewType === 'daily' ? analytics.dailyData : 
                  viewType === 'monthly' ? analytics.monthlyData : 
                  analytics.yearlyData).slice(-10).map((item: any, index) => (
                  <tr key={index} className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className={`py-3 px-2 text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {viewType === 'daily' ? format(parseISO(item.date), 'MMM dd') :
                       viewType === 'monthly' ? format(parseISO(item.month + '-01'), 'MMM yyyy') :
                       item.year}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      ₹{item.revenue.toLocaleString()}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {item.tickets}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {item.shows}
                    </td>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
        </div>

        {/* Show Performance */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Show Performance
          </h3>
          
            <AdminTable className="w-full">
              <AdminTableHead>
                <tr className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Show</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Occupancy</th>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeleton columns={3} leadColumn="avatar" />
                ) : analytics.showPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`py-8 text-center text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No show performance data available
                    </td>
                  </tr>
                ) : analytics.showPerformance.slice(0, 10).map((show, index) => (
                  <tr key={index} className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className={`py-3 px-2 text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div>
                        <div className="font-medium">{show.showName}</div>
                        <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {format(parseISO(show.showDate), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-2 text-sm text-right font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      ₹{show.revenue.toLocaleString()}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center justify-end space-x-2">
                        <span>{show.occupancyRate.toFixed(1)}%</span>
                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              show.occupancyRate >= 80 ? 'bg-green-500' :
                              show.occupancyRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(show.occupancyRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
        </div>

        {/* Customer Performance */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Customer Performance
          </h3>
          
            <AdminTable className="w-full">
              <AdminTableHead>
                <tr className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Customer</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tickets</th>
                  <th className={`text-right py-3 px-2 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>AOV</th>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeleton columns={4} leadColumn="avatar" />
                ) : analytics.customerPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`py-8 text-center text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No customer performance data available
                    </td>
                  </tr>
                ) : analytics.customerPerformance.slice(0, 10).map((customer, index) => (
                  <tr key={index} className={`border-b transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className={`py-3 px-2 text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-medium text-xs">
                            {customer.customerName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{customer.customerName}</div>
                          {customer.customerEmail && (
                            <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {customer.customerEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-2 text-sm text-right font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      ₹{customer.totalRevenue.toLocaleString()}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {customer.totalTickets}
                    </td>
                    <td className={`py-3 px-2 text-sm text-right transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      ₹{customer.averageOrderValue.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
        </div>
      </div>

      {/* Revenue Comparison Details */}
      <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Revenue Comparison
          </h3>
          <select
            value={comparisonPeriod}
            onChange={(e) => setComparisonPeriod(e.target.value as 'day' | 'week' | 'month' | 'year')}
            className={`px-3 py-2 border rounded-lg text-sm transition-colors duration-200 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="day">Day over Day</option>
            <option value="week">Week over Week</option>
            <option value="month">Month over Month</option>
            <option value="year">Year over Year</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`text-2xl font-bold mb-2 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              ₹{analytics.revenueComparison.currentPeriod.toLocaleString()}
            </div>
            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Current {analytics.revenueComparison.periodType}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold mb-2 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              ₹{analytics.revenueComparison.previousPeriod.toLocaleString()}
            </div>
            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Previous {analytics.revenueComparison.periodType}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold mb-2 ${
              analytics.revenueComparison.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {analytics.revenueComparison.growthRate >= 0 ? '+' : ''}{analytics.revenueComparison.growthRate.toFixed(1)}%
            </div>
            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Growth Rate
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
