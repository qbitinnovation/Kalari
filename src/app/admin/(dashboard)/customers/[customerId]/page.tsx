"use client";

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui'
import { useParams } from 'next/navigation'
import { db, Customer, Booking } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { getBookingReference, getRecordId } from '@/lib/booking'
import {
  ArrowLeftIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  TicketIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

const CustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState({
    totalBookings: 0,
    totalSpent: 0,
    totalTickets: 0,
    averageSpent: 0
  })
  const darkMode = useDarkMode()

  useEffect(() => {
    if (customerId) {
      fetchCustomerData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      
      // Fetch customer details
      const { data: customerData, error: customerError } = await db
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)

      // Fetch customer bookings with show details
      const { data: bookingsData, error: bookingsError } = await db
        .from('bookings')
        .select(`
          *,
          show:shows(*)
        `)
        .eq('customer_id', customerId)
        .order('booking_time', { ascending: false })

      if (bookingsError) throw bookingsError
      setBookings(bookingsData || [])

      // Calculate analytics
      const totalBookings = bookingsData?.length || 0
      const totalTickets = bookingsData?.reduce((sum, booking) => {
        try {
          const seatCodes = JSON.parse(booking.seat_code)
          return sum + (Array.isArray(seatCodes) ? seatCodes.length : 1)
        } catch {
          return sum + (booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1)
        }
      }, 0) || 0

      const totalSpent = bookingsData?.reduce((sum, booking) => {
        const seatCount = (() => {
          try {
            const seatCodes = JSON.parse(booking.seat_code)
            return Array.isArray(seatCodes) ? seatCodes.length : 1
          } catch {
            return booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1
          }
        })()
        return sum + (booking.show?.price || 0) * seatCount
      }, 0) || 0

      setAnalytics({
        totalBookings,
        totalSpent,
        totalTickets,
        averageSpent: totalBookings > 0 ? totalSpent / totalBookings : 0
      })

    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setLoading(false)
    }
  } 
 if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <UserIcon className={`mx-auto h-12 w-12 mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          Customer not found
        </h3>
        <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          The customer you're looking for doesn't exist.
        </p>
        <Link href="/admin/customers" className={buttonVariants({ size: 'md' })}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Customers
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/customers"
          className={`inline-flex items-center text-sm font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Customers
        </Link>
        <h1 className={`text-2xl sm:text-3xl font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          {customer.name}
        </h1>
        <p className={`mt-2 text-sm sm:text-base transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Customer details and booking history
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="lg:col-span-1">
          <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {customer.name}
              </h2>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Customer since {format(new Date(customer.created_at), 'MMM yyyy')}
              </p>
            </div>

            <div className="space-y-4">
              {customer.email && (
                <div className="flex items-center">
                  <EnvelopeIcon className={`h-5 w-5 mr-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {customer.email}
                  </span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center">
                  <PhoneIcon className={`h-5 w-5 mr-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {customer.phone}
                  </span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-start">
                  <MapPinIcon className={`h-5 w-5 mr-3 mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {customer.address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-200'}`}>
              <div className="flex items-center">
                <TicketIcon className="h-8 w-8 text-blue-500" />
                <div className="ml-3">
                  <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {analytics.totalBookings}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Total Bookings
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-200'}`}>
              <div className="flex items-center">
                <CurrencyRupeeIcon className="h-8 w-8 text-green-500" />
                <div className="ml-3">
                  <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    ₹{analytics.totalSpent.toLocaleString()}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Total Spent
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-200'}`}>
              <div className="flex items-center">
                <TicketIcon className="h-8 w-8 text-purple-500" />
                <div className="ml-3">
                  <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {analytics.totalTickets}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Total Tickets
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-slate-200'}`}>
              <div className="flex items-center">
                <ChartBarIcon className="h-8 w-8 text-orange-500" />
                <div className="ml-3">
                  <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    ₹{Math.round(analytics.averageSpent).toLocaleString()}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Avg per Booking
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking History */}
        <div className="lg:col-span-2">
          <div className={`rounded-2xl shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                Booking History
              </h3>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                All bookings made by this customer
              </p>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <TicketIcon className={`mx-auto h-12 w-12 mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  No bookings yet
                </h3>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  This customer hasn't made any bookings yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {bookings.map((booking) => {
                  const seatCount = (() => {
                    try {
                      const seatCodes = JSON.parse(booking.seat_code)
                      return Array.isArray(seatCodes) ? seatCodes.length : 1
                    } catch {
                      return booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1
                    }
                  })()
                  
                  const totalAmount = (booking.show?.price || 0) * seatCount

                  return (
                      <motion.div
                        key={getRecordId(booking)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                              <h4 className={`text-lg font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                {booking.show?.title || 'Unknown Show'}
                              </h4>
                            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                              booking.status === 'CONFIRMED'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              {booking.status}
                            </span>
                            </div>
                            <div className="mt-1 font-mono text-xs font-black text-amber-600">
                              {getBookingReference(booking)}
                            </div>
                            
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center">
                              <CalendarIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {booking.show?.date ? format(new Date(booking.show.date), 'MMM dd, yyyy') : 'Unknown Date'}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <TicketIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {seatCount} ticket{seatCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <CurrencyRupeeIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                                ₹{totalAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          <div className={`mt-2 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Booked on {format(new Date(booking.booking_time), 'MMM dd, yyyy \'at\' h:mm a')}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerDetail
