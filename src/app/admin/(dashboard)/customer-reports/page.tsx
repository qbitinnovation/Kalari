"use client";

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { formatDisplayDateValue } from '@/components/ui/date-utils'
import { toDisplayInitial, toDisplayTitle } from '@/lib/textFormat'
import { AdminTable, AdminTableBody, AdminTableHead, AdminTablePanel, SearchInput } from '@/components/ui'
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  DocumentTextIcon,
  TicketIcon,
  CurrencyRupeeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface CustomerAnalytics {
  totalBookings: number
  totalSpent: number
  totalTickets: number
  averageSpent: number
  lastBooking?: string
}

interface CustomerWithAnalytics extends Customer {
  analytics: CustomerAnalytics
}

const CustomerReports: React.FC = () => {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerWithAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'totalBookings' | 'lastBooking'>('totalSpent')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const darkMode = useDarkMode()

  useEffect(() => {
    fetchCustomersWithAnalytics()
  }, [])

  const fetchCustomersWithAnalytics = async () => {
    try {
      setLoading(true)
      
      // Fetch all customers
      const { data: customersData, error: customersError } = await db
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Fetch all bookings with show details
      const { data: bookingsData, error: bookingsError } = await db
        .from('bookings')
        .select(`
          *,
          show:shows(*)
        `)

      if (bookingsError) throw bookingsError

      // Calculate analytics for each customer
      const customersWithAnalytics: CustomerWithAnalytics[] = (customersData || []).map(customer => {
        const customerBookings = (bookingsData || []).filter(booking => booking.customer_id === customer.id)
        
        const totalBookings = customerBookings.length
        const totalTickets = customerBookings.reduce((sum, booking) => {
          try {
            const seatCodes = JSON.parse(booking.seat_code)
            return sum + (Array.isArray(seatCodes) ? seatCodes.length : 1)
          } catch {
            return sum + (booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1)
          }
        }, 0)

        const totalSpent = customerBookings.reduce((sum, booking) => {
          const seatCount = (() => {
            try {
              const seatCodes = JSON.parse(booking.seat_code)
              return Array.isArray(seatCodes) ? seatCodes.length : 1
            } catch {
              return booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1
            }
          })()
          return sum + (booking.show?.price || 0) * seatCount
        }, 0)

        const lastBooking = customerBookings.length > 0 
          ? customerBookings.sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())[0].booking_time
          : undefined

        return {
          ...customer,
          analytics: {
            totalBookings,
            totalSpent,
            totalTickets,
            averageSpent: totalBookings > 0 ? totalSpent / totalBookings : 0,
            lastBooking
          }
        }
      })

      setCustomers(customersWithAnalytics)
    } catch (error) {
      console.error('Error fetching customer analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedCustomers = customers
    .filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)
    )
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'totalSpent':
          aValue = a.analytics.totalSpent
          bValue = b.analytics.totalSpent
          break
        case 'totalBookings':
          aValue = a.analytics.totalBookings
          bValue = b.analytics.totalBookings
          break
        case 'lastBooking':
          aValue = a.analytics.lastBooking ? new Date(a.analytics.lastBooking).getTime() : 0
          bValue = b.analytics.lastBooking ? new Date(b.analytics.lastBooking).getTime() : 0
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((sum, customer) => sum + customer.analytics.totalSpent, 0)
  const totalBookings = customers.reduce((sum, customer) => sum + customer.analytics.totalBookings, 0)
  const averageRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Customer Reports
          </h1>
          <p className={`mt-2 text-sm sm:text-base transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Analyze customer behavior and booking patterns
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search customers..." containerClassName="w-full sm:w-72" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
              darkMode
                ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-slate-500'
                : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
            } focus:outline-none focus:ring-[3px] focus:ring-primary-500/20`}
          >
            <option value="totalSpent">Sort by Revenue</option>
            <option value="totalBookings">Sort by Bookings</option>
            <option value="name">Sort by Name</option>
            <option value="lastBooking">Sort by Last Booking</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={`min-h-11 min-w-11 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              darkMode
                ? 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
            }`}
            aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortOrder === 'asc' ? 'â†‘' : 'â†“'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center">
            <UserIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {totalCustomers}
              </p>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Customers
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center">
            <CurrencyRupeeIcon className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                ₹{totalRevenue.toLocaleString()}
              </p>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Revenue
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center">
            <TicketIcon className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {totalBookings}
              </p>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Bookings
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                ₹{Math.round(averageRevenuePerCustomer).toLocaleString()}
              </p>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Avg per Customer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="hidden">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-slate-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className={`px-4 py-2 rounded-lg border transition-colors duration-200 ${
                darkMode 
                  ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
            >
              <option value="totalSpent">Sort by Revenue</option>
              <option value="totalBookings">Sort by Bookings</option>
              <option value="name">Sort by Name</option>
              <option value="lastBooking">Sort by Last Booking</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className={`px-4 py-2 rounded-lg border transition-colors duration-200 ${
                darkMode 
                  ? 'bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700' 
                  : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
              }`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Reports Table */}
      <AdminTablePanel>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className={`mx-auto h-12 w-12 mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {searchTerm ? 'No customers found' : 'No customer data available'}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {searchTerm ? 'Try adjusting your search terms' : 'Customer reports will appear here once you have bookings'}
            </p>
          </div>
        ) : (
              <AdminTable>
                <AdminTableHead>
                  <tr>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}
                      onClick={() => handleSort('name')}
                    >
                      Customer {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Contact
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}
                      onClick={() => handleSort('totalBookings')}
                    >
                      Bookings {sortBy === 'totalBookings' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}
                      onClick={() => handleSort('totalSpent')}
                    >
                      Revenue {sortBy === 'totalSpent' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}
                      onClick={() => handleSort('lastBooking')}
                    >
                      Last Booking {sortBy === 'lastBooking' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Actions
                    </th>
                  </tr>
                </AdminTableHead>
                <AdminTableBody>
                  {filteredAndSortedCustomers.map((customer) => (
                    <motion.tr
                      key={customer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors duration-200`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {toDisplayInitial(customer.name)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {toDisplayTitle(customer.name)}
                            </div>
                            <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Customer since {formatDisplayDateValue(customer.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center text-sm">
                              <EnvelopeIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {customer.email}
                              </span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center text-sm">
                              <PhoneIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {customer.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                            {customer.analytics.totalBookings} bookings
                          </div>
                          <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {customer.analytics.totalTickets} tickets
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                            ₹{customer.analytics.totalSpent.toLocaleString()}
                          </div>
                          <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Avg: ₹{Math.round(customer.analytics.averageSpent).toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.analytics.lastBooking ? (
                          <div className="space-y-1">
                            <div className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {formatDisplayDateValue(customer.analytics.lastBooking)}
                            </div>
                            <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {format(new Date(customer.analytics.lastBooking), 'h:mm a')}
                            </div>
                          </div>
                        ) : (
                          <span className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            No bookings
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/admin/customers/${customer.id}`)}
                          className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AdminTableBody>
              </AdminTable>
        )}
      </AdminTablePanel>
    </div>
  )
}

export default CustomerReports
