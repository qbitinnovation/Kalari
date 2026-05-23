"use client";

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CurrencyDollarIcon,
  TicketIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  PlusIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useDashboard } from '@/contexts/DashboardContext'
import { formatDisplayDateValue } from '@/components/ui/date-utils'

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







const Dashboard: React.FC = () => {
  const router = useRouter()
  const darkMode = useDarkMode()
  const { data, loading, logsLoading, fetchDashboardData, fetchActivityLogs } = useDashboard()

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Helper functions for rendering
  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'booking':
        return <DocumentTextIcon className="h-4 w-4 text-green-600" />
      case 'update':
        return <ClockIcon className="h-4 w-4 text-blue-600" />
      case 'delete':
      case 'cancellation':
        return <UserIcon className="h-4 w-4 text-red-600" />
      default:
        return <DocumentTextIcon className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'booking':
        return 'text-green-600 bg-green-50'
      case 'update':
        return 'text-blue-600 bg-blue-50'
      case 'delete':
      case 'cancellation':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatLogDetails = (log: ActivityLog) => {
    const details = log.details || {}
    switch (log.action.toLowerCase()) {
      case 'booking':
        return `Booked ${details.seat_count || 1} seat(s) for ₹${details.total_price || 0}`
      case 'create':
        if (log.entity_type === 'SHOW') {
          return `Created show "${log.entity_name}" on ${details.date} at ${details.time}`
        }
        return `Created ${log.entity_type.toLowerCase()}: ${log.entity_name}`
      case 'update':
        if (log.entity_type === 'SHOW' && details.changes) {
          const changes = details.changes
          const changesList = Object.keys(changes).map(field => {
            const change = changes[field]
            if (field === 'price') {
              return `${field}: ₹${change.from} → ₹${change.to}`
            } else if (field === 'active') {
              return `${field}: ${change.from ? 'Active' : 'Inactive'} → ${change.to ? 'Active' : 'Inactive'}`
            } else {
              return `${field}: "${change.from}" → "${change.to}"`
            }
          })
          return `Updated show "${log.entity_name}" - ${changesList.join(', ')}`
        }
        return `Updated ${log.entity_type.toLowerCase()}: ${log.entity_name}`
      case 'delete':
        return `Deleted ${log.entity_type.toLowerCase()}: ${log.entity_name}`
      case 'cancellation':
        return `Cancelled booking for ${details.seat_count || 1} seat(s)`
      case 'export':
        if (log.entity_type === 'ANALYTICS') {
          return `Exported ${details.format} analytics report (${details.dateRange?.start} to ${details.dateRange?.end})`
        } else if (log.entity_type === 'REPORT') {
          return `Exported ${details.format} booking report for "${details.showTitle}"`
        }
        return `Exported ${log.entity_name}`
      default:
        return `${log.action} ${log.entity_type.toLowerCase()}: ${log.entity_name || 'Unknown'}`
    }
  }

  if (loading || !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className={`transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const { metrics, upcomingEvents, activityLogs } = data

  return (
    <div className="space-y-4">
      {/* Row 1 - Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Revenue</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{metrics.totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-right">
              <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Today</div>
              <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{formatDisplayDateValue(new Date())}</div>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Today's Revenue</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{metrics.todayRevenue.toLocaleString()}</p>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Bookings: {metrics.todayBookings} tickets</p>
              <div className="flex items-center space-x-1" title={`${metrics.dailyGrowth >= 0 ? 'Up' : 'Down'} ${Math.abs(metrics.dailyGrowth).toFixed(1)}% from yesterday (₹${metrics.yesterdayRevenue.toLocaleString()})`}>
                <ArrowTrendingUpIcon 
                  className={`h-3 w-3 ${
                    metrics.dailyGrowth >= 0 
                      ? 'text-green-500 rotate-0' 
                      : 'text-red-500 rotate-180'
                  }`} 
                />
                <span className={`text-xs font-medium ${
                  metrics.dailyGrowth >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {Math.abs(metrics.dailyGrowth).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* This Week's Revenue */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-right">
              <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>This Week</div>
              <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>7 Days</div>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Week's Revenue</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{metrics.weekRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* This Month's Revenue */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <TicketIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="text-right">
              <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>This Month</div>
              <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{new Date().toLocaleDateString('en-US', { month: 'short' })}</div>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Month's Revenue</h3>
            <p className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>₹{metrics.monthRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Row 2 - Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {/* Upcoming Events Countdown */}
          <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-6 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upcoming Events Countdown</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upcomingEvents.map((event, i) => {
                const progress = (event.booked / event.capacity) * 100
                return (
                  <div key={i} className={`border rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{event.name}</h4>
                      <span className="text-sm font-medium text-orange-600">{event.countdown}</span>
                    </div>
                    <div className={`flex items-center text-sm mb-3 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <CalendarDaysIcon className="h-4 w-4 mr-1" />
                      {formatDisplayDateValue(event.date)} at {event.time}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Bookings</span>
                      <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{event.booked}/{event.capacity} tickets</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${progress >= 80 ? 'bg-red-500' : progress >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Row 3 - Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Analytics */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Performance Analytics</h3>
          <div className="space-y-4">
            {/* Weekly Growth */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <div>
                <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Weekly Growth</div>
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {metrics.weeklyGrowth >= 0 ? '+' : ''}{metrics.weeklyGrowth.toFixed(1)}%
                  </span>
                  <ArrowTrendingUpIcon 
                    className={`h-4 w-4 ${
                      metrics.weeklyGrowth >= 0 
                        ? 'text-green-500 rotate-0' 
                        : 'text-red-500 rotate-180'
                    }`} 
                  />
                </div>
                <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  vs last week (₹{metrics.lastWeekRevenue.toLocaleString()})
                </div>
              </div>
            </div>

            {/* Monthly Growth */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              <div>
                <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>Monthly Growth</div>
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {metrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.monthlyGrowth.toFixed(1)}%
                  </span>
                  <ArrowTrendingUpIcon 
                    className={`h-4 w-4 ${
                      metrics.monthlyGrowth >= 0 
                        ? 'text-green-500 rotate-0' 
                        : 'text-red-500 rotate-180'
                    }`} 
                  />
                </div>
                <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  vs last month (₹{metrics.lastMonthRevenue.toLocaleString()})
                </div>
              </div>
            </div>

            {/* Average Ticket Value */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <div>
                <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Avg. Ticket Value</div>
                <div className={`text-lg font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  ₹{metrics.todayBookings > 0 ? (metrics.todayRevenue / metrics.todayBookings).toFixed(0) : '0'}
                </div>
                <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Today's average
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Business Insights */}
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Business Insights</h3>
          <div className="space-y-4">
            {/* Revenue Trend */}
            <div className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <ChartBarIcon className="h-5 w-5 text-blue-500" />
                  <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Revenue Trend</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  metrics.dailyGrowth >= 0 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  {metrics.dailyGrowth >= 0 ? 'Trending Up' : 'Trending Down'}
                </span>
              </div>
              <p className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {metrics.dailyGrowth >= 0 
                  ? `Revenue is up ${Math.abs(metrics.dailyGrowth).toFixed(1)}% from yesterday. Keep up the momentum!`
                  : `Revenue is down ${Math.abs(metrics.dailyGrowth).toFixed(1)}% from yesterday. Consider promotional strategies.`
                }
              </p>
            </div>

            {/* Booking Performance */}
            <div className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <TicketIcon className="h-5 w-5 text-orange-500" />
                  <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Booking Activity</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  metrics.todayBookings > 0 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300'
                }`}>
                  {metrics.todayBookings > 0 ? 'Active' : 'Quiet'}
                </span>
              </div>
              <p className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {metrics.todayBookings > 0 
                  ? `${metrics.todayBookings} tickets sold today. Average price: ₹${(metrics.todayRevenue / metrics.todayBookings).toFixed(0)}`
                  : 'No bookings today yet. Consider marketing campaigns or check upcoming shows.'
                }
              </p>
            </div>

            {/* Quick Actions */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
              <div className="flex items-center space-x-2 mb-2">
                <CurrencyDollarIcon className="h-5 w-5 text-orange-500" />
                <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Quick Actions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => router.push('/reports')}
                  className={`flex items-center space-x-1 px-3 py-1 text-xs border rounded-lg transition-colors duration-200 hover:scale-105 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <DocumentTextIcon className="h-3 w-3" />
                  <span>View Reports</span>
                </button>
                <button 
                  onClick={() => router.push('/shows')}
                  className={`flex items-center space-x-1 px-3 py-1 text-xs border rounded-lg transition-colors duration-200 hover:scale-105 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <PlusIcon className="h-3 w-3" />
                  <span>Add Show</span>
                </button>
                <button 
                  onClick={() => router.push('/analytics')}
                  className={`flex items-center space-x-1 px-3 py-1 text-xs border rounded-lg transition-colors duration-200 hover:scale-105 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <DocumentArrowDownIcon className="h-3 w-3" />
                  <span>Export Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4 - Activity Logs */}
      <div className="grid grid-cols-1 gap-6">
        <div className={`rounded-2xl p-6 shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activity Logs</h3>
            <button
              onClick={fetchActivityLogs}
              disabled={logsLoading}
              className="px-3 py-1 text-sm bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors duration-200 disabled:opacity-50"
            >
              {logsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activityLogs.length === 0 ? (
              <div className={`text-center py-8 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No activity logs found</p>
                <p className="text-sm mt-1">System activities will appear here</p>
              </div>
            ) : (
              activityLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start space-x-3 p-4 rounded-xl border transition-colors duration-200 ${darkMode ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-100 hover:bg-gray-50'}`}
                >
                  <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {log.action.toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {log.entity_type}
                        </span>
                      </div>
                      <span className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(log.performed_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {formatLogDetails(log)}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        by {log.performed_by}
                      </span>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <details className="text-xs">
                          <summary className={`cursor-pointer transition-colors duration-200 ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                            Details
                          </summary>
                          <pre className={`mt-2 p-2 rounded text-xs overflow-x-auto transition-colors duration-200 ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

export default Dashboard
