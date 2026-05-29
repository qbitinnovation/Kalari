"use client";

import React, { useState, useEffect } from 'react'
import { db, Show } from '@/lib/database'
import { format } from 'date-fns'
import { 
  DocumentArrowDownIcon,
  ChartBarIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logActivity } from '@/utils/activityLogger'
import { getBookingReference } from '@/lib/booking'
import { AdminTable, AdminTableBody, AdminTableHead, AdminTablePanel, AdminTableSkeleton, DatePicker } from '@/components/ui'
import { formatDisplayDateValue, formatDisplayTimeValue } from '@/components/ui/date-utils'

interface BookingReport {
  booking_id: string
  booking_reference: string
  show_title: string
  show_date: string
  show_time: string
  seat_codes: string[]
  total_tickets: number
  total_amount: number
  booked_by: string
  booking_time: string
  status: string
}

const Reports: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([])
  const [allShows, setAllShows] = useState<Show[]>([]) // Store all shows for filtering
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [bookingData, setBookingData] = useState<BookingReport[]>([])
  const [loading, setLoading] = useState(false)
  const darkMode = useDarkMode()
  const [selectedDate, setSelectedDate] = useState<string>('') // Date filter state
  const [summary, setSummary] = useState({
    totalBookings: 0,
    totalTickets: 0,
    totalRevenue: 0,
    averageTicketsPerBooking: 0
  })

  useEffect(() => {
    fetchShows()
  }, [])

  // Filter shows by selected date
  useEffect(() => {
    if (selectedDate) {
      const filteredShows = allShows.filter(show => show.date === selectedDate)
      setShows(filteredShows)
    } else {
      setShows(allShows) // Show all shows if no date selected
    }
    // Reset selected show if it's not in the filtered results
    if (selectedShow && selectedDate && selectedShow.date !== selectedDate) {
      setSelectedShow(null)
      setBookingData([])
      setSummary({
        totalBookings: 0,
        totalTickets: 0,
        totalRevenue: 0,
        averageTicketsPerBooking: 0
      })
    }
  }, [selectedDate, allShows, selectedShow])

  const fetchShows = async () => {
    try {
      const { data, error } = await db
        .from('shows')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setAllShows(data || []) // Store all shows
      setShows(data || []) // Initially show all shows
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const fetchBookingReport = async (showId: string) => {
    setLoading(true)
    try {
      // Get bookings with tickets for the selected show
      const { data: tickets, error } = await db
        .from('tickets')
        .select(`
          *,
          booking:bookings(
            id,
            seat_code,
            booked_by,
            booking_time,
            status
          ),
          show:shows(
            title,
            date,
            time
          )
        `)
        .eq('show_id', showId)
        .order('generated_at', { ascending: false })

      if (error) throw error

      // Group tickets by booking
      const bookingMap = new Map<string, BookingReport>()
      
      tickets?.forEach((ticket: any) => {
        const bookingId = ticket.booking_id
        const bookingReference = getBookingReference(ticket.booking || { id: bookingId })
          
        if (!bookingMap.has(bookingId)) {
          // Parse seat codes from booking
          let seatCodes: string[] = []
          try {
            // Try JSON format first
            seatCodes = JSON.parse(ticket.booking.seat_code)
          } catch {
            // Fall back to comma-separated format
            seatCodes = ticket.booking.seat_code.includes(',') 
              ? ticket.booking.seat_code.split(',').map((s: string) => s.trim())
              : [ticket.booking.seat_code]
          }

          bookingMap.set(bookingId, {
            booking_id: bookingId,
            booking_reference: bookingReference,
            show_title: ticket.show.title,
            show_date: ticket.show.date,
            show_time: ticket.show.time,
            seat_codes: seatCodes,
            total_tickets: 0,
            total_amount: 0,
            booked_by: ticket.booking.booked_by,
            booking_time: ticket.booking.booking_time,
            status: ticket.booking.status
          })
        }

        const booking = bookingMap.get(bookingId)!
        booking.total_tickets += 1
        booking.total_amount += ticket.price
      })

      const reportData = Array.from(bookingMap.values())
      setBookingData(reportData)

      // Calculate summary
      const totalBookings = reportData.length
      const totalTickets = reportData.reduce((sum, booking) => sum + booking.total_tickets, 0)
      const totalRevenue = reportData.reduce((sum, booking) => sum + booking.total_amount, 0)
      const averageTicketsPerBooking = totalBookings > 0 ? totalTickets / totalBookings : 0

      setSummary({
        totalBookings,
        totalTickets,
        totalRevenue,
        averageTicketsPerBooking: Math.round(averageTicketsPerBooking * 100) / 100
      })

    } catch (error) {
      console.error('Error fetching booking report:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCSV = async () => {
    if (!selectedShow || bookingData.length === 0) return

    const headers = [
      'Booking Ref',
      'Show Title',
      'Show Date',
      'Show Time',
      'Seats',
      'Total Tickets',
      'Total Amount (₹)',
      'Booked By',
      'Booking Time',
      'Status'
    ]

    const csvData = bookingData.map(booking => [
      booking.booking_reference,
      booking.show_title,
      formatDisplayDateValue(booking.show_date),
      booking.show_time,
      booking.seat_codes.join('; '),
      booking.total_tickets,
      booking.total_amount,
      booking.booked_by,
      `${formatDisplayDateValue(booking.booking_time)} ${format(new Date(booking.booking_time), 'h:mm a')}`,
      booking.status
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `booking-report-${selectedShow.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Log the report export
    try {
      const { data: { user } } = await db.auth.getUser()
      const userEmail = user?.email || 'unknown'

      await logActivity({
        action: 'EXPORT',
        entityType: 'REPORT',
        entityId: selectedShow.id,
        entityName: `Booking Report - ${selectedShow.title}`,
        details: {
          format: 'CSV',
          showTitle: selectedShow.title,
          showDate: selectedShow.date,
          totalBookings: bookingData.length,
          totalTickets: summary.totalTickets,
          totalRevenue: summary.totalRevenue,
          exported_at: new Date().toISOString()
        },
        performedBy: userEmail
      })
    } catch (error) {
      console.error('Error logging report export:', error)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={`text-3xl font-bold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Reports</h1>
          <p className={`mt-2 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generate booking reports and export data</p>
        </div>
        <DatePicker
          label="Filter by Date"
          value={selectedDate}
          onChange={setSelectedDate}
          placeholder="All dates"
          presets={[
            { label: 'Clear Filter', value: 'clear' },
            { label: 'Today', value: 'today' },
          ]}
          className="w-full sm:w-64"
        />
      </div>

      {/* Date Filter */}
      <div className="hidden">
        <h2 className={`text-lg font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Filter by Date</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <DatePicker
            label="Select Date"
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="All dates"
            presets={[
              { label: 'Clear Filter', value: 'clear' },
              { label: 'Today', value: 'today' },
            ]}
            className="flex-1"
          />
        </div>
        
        {/* Show count and selected date info */}
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {selectedDate ? (
              <>Showing {shows.length} show(s) for {formatDisplayDateValue(selectedDate)}</>
            ) : (
              <>Showing {shows.length} show(s) (all dates)</>
            )}
          </div>
          {selectedDate && (
            <div className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
              darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
            }`}>
              Filtered by: {formatDisplayDateValue(selectedDate)}
            </div>
          )}
        </div>
      </div>

      {/* Show Selection */}
      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-lg font-semibold mb-4 flex items-center transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          <CalendarIcon className="h-5 w-5 mr-2" />
          Select Show for Report {selectedDate && `(${formatDisplayDateValue(selectedDate)})`}
        </h2>
        
        {shows.length === 0 ? (
          <div className={`text-center py-8 transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {selectedDate ? (
              <>
                <div className="text-lg mb-2">No shows available for {formatDisplayDateValue(selectedDate)}</div>
                <div className="text-sm">Try selecting a different date or clear the filter to see all shows.</div>
              </>
            ) : (
              <>
                <div className="text-lg mb-2">No shows available</div>
                <div className="text-sm">Create shows to generate reports.</div>
              </>
            )}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shows.map((show) => (
            <button
              key={show.id}
              onClick={() => {
                setSelectedShow(show)
                fetchBookingReport(show.id)
              }}
              className={`p-4 rounded-xl border-2 text-left transition-colors ${
                selectedShow?.id === show.id
                  ? darkMode 
                    ? 'border-blue-500 bg-blue-900/20' 
                    : 'border-blue-500 bg-blue-50'
                  : darkMode
                    ? 'border-gray-600 hover:border-gray-500 bg-gray-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{show.title}</div>
              <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {formatDisplayDateValue(show.date)} at {formatDisplayTimeValue(show.time)}
              </div>
              <div className="text-sm font-medium text-blue-600">₹{show.price}</div>
              <div className="mt-2">
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                  show.status === 'ACTIVE' 
                    ? darkMode 
                      ? 'bg-green-900/20 text-green-400 border border-green-800'
                      : 'bg-green-100 text-green-800'
                    : show.status === 'HOUSE_FULL'
                      ? darkMode
                        ? 'bg-orange-900/20 text-orange-400 border border-orange-800'
                        : 'bg-orange-100 text-orange-800'
                      : show.status === 'SHOW_STARTED'
                        ? darkMode
                          ? 'bg-yellow-900/20 text-yellow-400 border border-yellow-800'
                          : 'bg-yellow-100 text-yellow-800'
                        : darkMode
                          ? 'bg-gray-700 text-gray-300 border border-gray-600'
                          : 'bg-gray-100 text-gray-800'
                }`}>
                  {show.status === 'ACTIVE' ? 'Active' : 
                   show.status === 'HOUSE_FULL' ? 'House Full' : 
                   show.status === 'SHOW_STARTED' ? 'Show Started' :
                   'Show Done'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Report Summary */}
      {selectedShow && (
        <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-lg font-semibold flex items-center transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Booking Summary - {selectedShow.title}
            </h2>
            <button
              onClick={async () => await generateCSV()}
              disabled={loading || bookingData.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export CSV
            </button>
          </div>

          {loading ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-20 rounded-xl animate-pulse ${darkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`} />
                ))}
              </div>
              <AdminTablePanel>
                <AdminTable>
                  <AdminTableHead>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Booking Ref
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Seats
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tickets
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Amount
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Booked By
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Booking Time
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Status
                      </th>
                    </tr>
                  </AdminTableHead>
                  <AdminTableBody>
                    <AdminTableSkeleton columns={7} />
                  </AdminTableBody>
                </AdminTable>
              </AdminTablePanel>
            </>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className={`p-4 rounded-xl transition-colors duration-200 ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <div className="text-2xl font-bold text-blue-600">{summary.totalBookings}</div>
                  <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-blue-400' : 'text-blue-800'}`}>Total Bookings</div>
                </div>
                <div className={`p-4 rounded-xl transition-colors duration-200 ${darkMode ? 'bg-green-900/20' : 'bg-green-50'}`}>
                  <div className="text-2xl font-bold text-green-600">{summary.totalTickets}</div>
                  <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-green-400' : 'text-green-800'}`}>Total Tickets</div>
                </div>
                <div className={`p-4 rounded-xl transition-colors duration-200 ${darkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                  <div className="text-2xl font-bold text-purple-600">₹{summary.totalRevenue.toLocaleString()}</div>
                  <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-purple-400' : 'text-purple-800'}`}>Total Revenue</div>
                </div>
                <div className={`p-4 rounded-xl transition-colors duration-200 ${darkMode ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                  <div className="text-2xl font-bold text-orange-600">{summary.averageTicketsPerBooking}</div>
                  <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-orange-400' : 'text-orange-800'}`}>Avg Tickets/Booking</div>
                </div>
              </div>

              {/* Booking Details Table */}
              {bookingData.length > 0 ? (
                <AdminTablePanel>
                  <AdminTable>
                    <AdminTableHead>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Booking Ref
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Seats
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Tickets
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Amount
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Booked By
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Booking Time
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Status
                        </th>
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {bookingData.map((booking) => (
                        <tr key={booking.booking_id} className={`transition-colors duration-200 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-mono transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {booking.booking_reference}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {booking.seat_codes.length > 3 
                                ? `${booking.seat_codes.slice(0, 3).join(', ')}...` 
                                : booking.seat_codes.join(', ')
                              }
                            </div>
                            {booking.seat_codes.length > 3 && (
                              <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                +{booking.seat_codes.length - 3} more
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {booking.total_tickets}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              ₹{booking.total_amount.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{booking.booked_by}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {formatDisplayDateValue(booking.booking_time)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(booking.booking_time), 'h:mm a')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              booking.status === 'CONFIRMED' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {booking.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                </AdminTablePanel>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No bookings found for this show.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Reports
