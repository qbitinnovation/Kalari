"use client";

import React, { useState, useEffect } from 'react'
import { db, Ticket } from '@/lib/database'
import { format } from 'date-fns'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { 
  MagnifyingGlassIcon, 
  PrinterIcon, 
  XMarkIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useAuth } from '@/contexts/AuthContext'

interface TicketWithDetails extends Ticket {
  show?: {
    title: string
    date: string
    time: string
  }
  booking?: {
    customer_id: string
    agent_id?: string
    customer?: {
      name: string
      email?: string
      phone?: string
    }
  }
  booked_by: string
}

interface BookingGroup {
  booking_id: string
  show?: {
    title: string
    date: string
    time: string
  }
  tickets: TicketWithDetails[]
  total_price: number
  seat_codes: string[]
  status: string
  generated_at: string
  booked_by: string
  customer?: {
    name: string
    email?: string
    phone?: string
  }
}

const Tickets: React.FC = () => {
  const darkMode = useDarkMode()
  const { user } = useAuth()
  const [bookings, setBookings] = useState<BookingGroup[]>([])
  const [allBookings, setAllBookings] = useState<BookingGroup[]>([]) // Store all bookings for filtering
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDate, setSelectedDate] = useState<string>('') // Date filter state
  const [selectedBooking, setSelectedBooking] = useState<BookingGroup | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role])

  // Filter bookings by ticket generated date
  useEffect(() => {
    if (selectedDate) {
      const filteredBookings = allBookings.filter(booking => {
        const generatedDate = new Date(booking.generated_at).toISOString().split('T')[0]
        return generatedDate === selectedDate
      })
      setBookings(filteredBookings)
    } else {
      setBookings(allBookings) // Show all bookings if no date selected
    }
  }, [selectedDate, allBookings])

  const fetchBookings = async () => {
    try {
      const { data, error } = await db
        .from('tickets')
        .select(`
          *,
          show:shows(title, date, time),
          booking:bookings(
            customer_id,
            customer:customers(name, email, phone)
          )
        `)
        .order('generated_at', { ascending: false })

      if (error) throw error

      // Group tickets by booking_id
      const groupedBookings: { [key: string]: BookingGroup } = {}
      
      data?.forEach((ticket: TicketWithDetails) => {
        if (user?.role === 'agent' && ticket.booking?.agent_id !== user.id && ticket.booking?.agent_id !== (user as any)._id) return
        if (!groupedBookings[ticket.booking_id]) {
          groupedBookings[ticket.booking_id] = {
            booking_id: ticket.booking_id,
            show: ticket.show,
            tickets: [],
            total_price: 0,
            seat_codes: [],
            status: ticket.status,
            generated_at: ticket.generated_at,
            booked_by: ticket.booked_by,
            customer: ticket.booking?.customer
          }
        }
        
        groupedBookings[ticket.booking_id].tickets.push(ticket)
        groupedBookings[ticket.booking_id].total_price += ticket.price
        groupedBookings[ticket.booking_id].seat_codes.push(ticket.seat_code)
        
        // Update booking status based on ticket status
        if (ticket.status === 'REVOKED') {
          groupedBookings[ticket.booking_id].status = 'REVOKED'
        }
      })

      const bookingsList = Object.values(groupedBookings)
      setAllBookings(bookingsList) // Store all bookings
      setBookings(bookingsList) // Initially show all bookings
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.booking_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.show?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.seat_codes.some(code => code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      booking.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && booking.status === 'ACTIVE') ||
      (statusFilter === 'completed' && booking.status === 'COMPLETED') ||
      (statusFilter === 'revoked' && booking.status === 'REVOKED')
    
    return matchesSearch && matchesStatus
  })

  const handlePrintBooking = (booking: BookingGroup) => {
    // Use the same QR code API as a reliable source
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(booking.booking_id)}`
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Booking Ticket - ${booking.booking_id}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Poppins', sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              padding: 20px;
            }
            .ticket {
              border: 2px dashed #9ca3af;
              padding: 24px;
              border-radius: 12px;
              background: #f9fafb;
            }
            .header {
              text-align: center;
              margin-bottom: 24px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #111827;
            }
            .divider {
              height: 1px;
              background: #6b7280;
              margin: 12px 0;
            }
            .show-title {
              font-size: 18px;
              font-weight: 600;
              color: #374151;
            }
            .info-section {
              margin: 24px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 12px 0;
              font-size: 14px;
            }
            .info-label {
              font-weight: 500;
              color: #6b7280;
            }
            .info-value {
              color: #111827;
              font-weight: 400;
            }
            .seats-section {
              margin: 16px 0;
            }
            .seats-label {
              font-weight: 500;
              margin-bottom: 8px;
              color: #6b7280;
              font-size: 14px;
            }
            .seats-box {
              border: 1px solid #d1d5db;
              padding: 12px;
              text-align: center;
              font-weight: bold;
              background: #e5e7eb;
              border-radius: 6px;
              color: #111827;
            }
            .qr-section {
              text-align: center;
              margin: 24px 0;
            }
            .qr-code {
              width: 120px;
              height: 120px;
              margin: 0 auto;
              background: white;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
              margin-top: 16px;
            }
            .footer div {
              margin: 4px 0;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 10px;
                background: white;
              }
              .container {
                max-width: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="ticket">
              <div class="header">
                <div class="title">KALARI BOOKING</div>
                <div class="divider"></div>
                <div class="show-title">${booking.show?.title || 'N/A'}</div>
              </div>
              
              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${booking.show?.date ? format(new Date(booking.show.date), 'MMM dd, yyyy') : 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Time:</span>
                  <span class="info-value">${booking.show?.time ? format(new Date(`2000-01-01T${booking.show.time}`), 'h:mm a') : 'N/A'}</span>
                </div>
                <div class="seats-section">
                  <div class="seats-label">Seats:</div>
                  <div class="seats-box">${booking.seat_codes.join(', ')}</div>
                </div>
                <div class="info-row">
                  <span class="info-label">Quantity:</span>
                  <span class="info-value">${booking.tickets.length} ticket(s)</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Total Price:</span>
                  <span class="info-value">₹${booking.total_price}</span>
                </div>
                ${booking.customer ? `
                <div class="info-row">
                  <span class="info-label">Customer:</span>
                  <span class="info-value">${booking.customer.name}</span>
                </div>
                ` : ''}
              </div>

              <div class="qr-section">
                <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" style="width: 120px; height: 120px;" />
              </div>

              <div class="footer">
                <div>Booking ID: ${booking.booking_id.slice(0, 8)}...</div>
                <div>Generated: ${format(new Date(booking.generated_at), 'MMM dd, yyyy h:mm a')}</div>
              </div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Ticket History
          </h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            View, print, and manage all generated tickets
          </p>
        </div>
      </div>

      {/* Date Filter */}
      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`text-lg font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Filter by Generated Date</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Select Generated Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                darkMode 
                  ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDate('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                darkMode
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Clear Filter
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                darkMode
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Today
            </button>
          </div>
        </div>
        
        {/* Show count and selected date info */}
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {selectedDate ? (
              <>Showing {bookings.length} booking(s) generated on {format(new Date(selectedDate), 'MMM dd, yyyy')}</>
            ) : (
              <>Showing {bookings.length} booking(s) (all dates)</>
            )}
          </div>
          {selectedDate && (
            <div className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
              darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-700'
            }`}>
              Filtered by: {format(new Date(selectedDate), 'MMM dd, yyyy')}
            </div>
          )}
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="Search by ticket code, seat, show, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all duration-200 ${darkMode ? 'bg-slate-800/50 border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500'}`}
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all duration-200 ${darkMode ? 'bg-slate-800/50 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <div className="px-3 sm:px-0">
            <table className={`min-w-full divide-y transition-colors duration-200 ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              <thead className={`transition-colors duration-200 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Booking ID
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Show
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Customer
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Seats
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Quantity
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Total Price
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Status
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Generated
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 divide-slate-800' : 'bg-white divide-slate-200'}`}>
                {filteredBookings.map((booking) => (
                  <tr key={booking.booking_id} className={`transition-colors duration-200 ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-mono transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {booking.booking_id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{booking.show?.title}</div>
                      <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {booking.show?.date ? format(new Date(booking.show.date), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                      <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {booking.show?.time ? format(new Date(`2000-01-01T${booking.show.time}`), 'h:mm a') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {booking.customer ? (
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-medium text-sm">
                              {booking.customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {booking.customer.name}
                            </div>
                            {booking.customer.email && (
                              <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {booking.customer.email}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          No customer info
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {booking.seat_codes.length > 3 
                          ? `${booking.seat_codes.slice(0, 3).join(', ')}...` 
                          : booking.seat_codes.join(', ')
                        }
                      </div>
                      {booking.seat_codes.length > 3 && (
                        <div className={`text-xs transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          +{booking.seat_codes.length - 3} more
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {booking.tickets.length} ticket(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>₹{booking.total_price}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex justify-start">
                        <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full min-w-[90px] ${
                          booking.status === 'ACTIVE' 
                            ? darkMode 
                              ? 'bg-green-900/20 text-green-400 border border-green-800'
                              : 'bg-green-100 text-green-800'
                            : booking.status === 'COMPLETED'
                              ? darkMode
                                ? 'bg-blue-900/20 text-blue-400 border border-blue-800'
                                : 'bg-blue-100 text-blue-800'
                              : darkMode
                                ? 'bg-red-900/20 text-red-400 border border-red-800'
                                : 'bg-red-100 text-red-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {format(new Date(booking.generated_at), 'MMM dd, yyyy')}
                      </div>
                      <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {format(new Date(booking.generated_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedBooking(booking)
                            setShowPreview(true)
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Preview"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {(booking.status === 'ACTIVE' || booking.status === 'COMPLETED') && (
                          <button
                            onClick={() => handlePrintBooking(booking)}
                            className="text-green-600 hover:text-green-900"
                            title="Print"
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className={`max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl transition-colors duration-200 ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  Ticket Preview
                </h3>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setSelectedBooking(null)
                  }}
                  className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Ticket Content */}
              <div className={`border-2 border-dashed p-4 rounded-xl transition-colors duration-200 ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-300 bg-slate-50'}`}>
                <div className="text-center mb-4">
                  <h4 className={`text-xl font-bold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    KALARI BOOKING
                  </h4>
                  <div className={`h-px my-2 transition-colors duration-200 ${darkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                  <h5 className={`text-lg font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {selectedBooking.show?.title || 'N/A'}
                  </h5>
                </div>

                <div className="space-y-3 mb-4">
                  {selectedBooking.customer && (
                    <div className="flex justify-between">
                      <span className={`font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Customer:</span>
                      <span className={`transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {selectedBooking.customer.name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className={`font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Date:</span>
                    <span className={`transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {selectedBooking.show?.date ? format(new Date(selectedBooking.show.date), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Time:</span>
                    <span className={`transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {selectedBooking.show?.time ? format(new Date(`2000-01-01T${selectedBooking.show.time}`), 'h:mm a') : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium block mb-1 transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Seats:</span>
                    <div className={`border p-2 rounded text-center font-bold transition-colors duration-200 ${darkMode ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-100 text-slate-900'}`}>
                      {selectedBooking.seat_codes.join(', ')}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className={`font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Quantity:</span>
                    <span className={`transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {selectedBooking.tickets.length} ticket(s)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Total Price:</span>
                    <span className={`transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      ₹{selectedBooking.total_price}
                    </span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="text-center mb-4">
                  <QRCode
                    value={selectedBooking.booking_id}
                    size={120}
                    bgColor={darkMode ? '#1e293b' : '#ffffff'}
                    fgColor={darkMode ? '#f1f5f9' : '#000000'}
                    className="mx-auto"
                  />
                </div>

                <div className="text-center text-xs space-y-1">
                  <div className={`transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Booking ID: {selectedBooking.booking_id.slice(0, 8)}...
                  </div>
                  <div className={`transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Generated: {format(new Date(selectedBooking.generated_at), 'MMM dd, yyyy h:mm a')}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    handlePrintBooking(selectedBooking)
                    setShowPreview(false)
                    setSelectedBooking(null)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors duration-200 ${darkMode ? 'bg-green-900/20 text-green-400 border border-green-800 hover:bg-green-900/30' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setSelectedBooking(null)
                  }}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors duration-200 ${darkMode ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tickets
