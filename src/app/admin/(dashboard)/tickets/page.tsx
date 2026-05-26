"use client";

import React, { useState, useEffect } from 'react'
import { db, Ticket } from '@/lib/database'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { 
  PrinterIcon, 
  XMarkIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useAuth } from '@/contexts/AuthContext'
import { getBookingReference, isGeneralAdmissionSeatCode } from '@/lib/booking'
import { toDisplayTitle } from '@/lib/textFormat'
import { AdminTable, AdminTableBody, AdminTableEmpty, AdminTableHead, AdminTablePanel, Button, DatePicker, SearchInput, Select } from '@/components/ui'
import { formatDisplayDateValue, formatDisplayTimeValue } from '@/components/ui/date-utils'

interface TicketWithDetails extends Omit<Ticket, 'show' | 'activity' | 'booking'> {
  show?: {
    title: string
    date: string
    time: string
    type?: 'KALARI' | 'EVENT'
  }
  activity?: {
    title: string
    price?: number
    booking_price?: number
  }
  booking?: {
    id?: string
    _id?: string
    booking_reference?: string
    customer_id: string
    agent_id?: string
    status?: 'CONFIRMED' | 'CANCELLED'
    cancellation_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
    cancellation_reason?: string
    cancellation_requested_at?: string
    customer?: {
      name: string
      email?: string
      phone?: string
    }
    activity?: {
      title: string
      price?: number
      booking_price?: number
    }
    booking_date?: string
    booking_type?: 'SHOW' | 'ACTIVITY'
  }
  booked_by: string
}

interface BookingGroup {
  booking_id: string
  booking_reference: string
  show?: {
    title: string
    date: string
    time: string
    type?: 'KALARI' | 'EVENT'
  }
  activity?: {
    title: string
    price?: number
    booking_price?: number
  }
  booking_date?: string
  booking_type?: 'SHOW' | 'ACTIVITY'
  tickets: TicketWithDetails[]
  total_price: number
  seat_codes: string[]
  status: string
  booking_status?: 'CONFIRMED' | 'CANCELLED'
  cancellation_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  cancellation_reason?: string
  cancellation_requested_at?: string
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
  const [reviewingCancellation, setReviewingCancellation] = useState(false)
  const [cancellationReviewError, setCancellationReviewError] = useState('')

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
          show:shows(title, date, time, type),
          activity:activities(title, price, booking_price),
          booking:bookings(
            booking_reference,
            booking_date,
            booking_type,
            customer_id,
            agent_id,
            status,
            cancellation_status,
            cancellation_reason,
            cancellation_requested_at,
            activity:activities(title, price, booking_price),
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
            booking_reference: getBookingReference(ticket.booking || { id: ticket.booking_id }),
            show: ticket.show,
            activity: ticket.activity || ticket.booking?.activity,
            booking_date: ticket.booking?.booking_date,
            booking_type: ticket.booking?.booking_type,
            tickets: [],
            total_price: 0,
            seat_codes: [],
            status: ticket.status,
            booking_status: ticket.booking?.status,
            cancellation_status: ticket.booking?.cancellation_status,
            cancellation_reason: ticket.booking?.cancellation_reason,
            cancellation_requested_at: ticket.booking?.cancellation_requested_at,
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
      booking.booking_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.show?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.activity?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.seat_codes.some(code => code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      booking.tickets.some(ticket => ticket.ticket_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      booking.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customer?.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && booking.status === 'ACTIVE') ||
      (statusFilter === 'completed' && booking.status === 'COMPLETED') ||
      (statusFilter === 'revoked' && booking.status === 'REVOKED') ||
      (statusFilter === 'cancellation-pending' && booking.cancellation_status === 'PENDING')
    
    return matchesSearch && matchesStatus
  })

  const isEventBooking = (booking: BookingGroup) =>
    booking.booking_type === 'ACTIVITY' || booking.show?.type === 'EVENT' || booking.seat_codes.every(isGeneralAdmissionSeatCode)

  const getTicketDisplayLabel = (booking: BookingGroup) => isEventBooking(booking) ? 'Admission' : 'Seats'

  const getTicketDisplayValues = (booking: BookingGroup) =>
    isEventBooking(booking) ? ['GENERAL'] : booking.seat_codes

  const getQrValue = (booking: BookingGroup) =>
    booking.booking_reference

  const getBookingTitle = (booking: BookingGroup) =>
    toDisplayTitle(booking.show?.title || booking.activity?.title, 'Booking')

  const getBookingDate = (booking: BookingGroup) =>
    booking.booking_type === 'ACTIVITY' ? booking.booking_date : booking.show?.date

  const getBookingTime = (booking: BookingGroup) =>
    booking.booking_type === 'ACTIVITY' ? null : booking.show?.time

  const canReviewCancellation = (booking: BookingGroup) =>
    (user?.role === 'admin' || user?.role === 'staff') && booking.cancellation_status === 'PENDING'

  const reviewCancellation = async (booking: BookingGroup, action: 'APPROVE' | 'REJECT') => {
    setReviewingCancellation(true)
    setCancellationReviewError('')
    try {
      const response = await fetch('/api/admin/cancellation-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.booking_id,
          action,
          reviewerRole: user?.role,
          reviewerId: user?.id,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not review cancellation request.')
      await fetchBookings()
      setShowPreview(false)
      setSelectedBooking(null)
    } catch (error: any) {
      setCancellationReviewError(error.message || 'Could not review cancellation request.')
    } finally {
      setReviewingCancellation(false)
    }
  }

  const handlePrintBooking = (booking: BookingGroup) => {
    // Use the same QR code API as a reliable source
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getQrValue(booking))}`
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Booking Ticket - ${booking.booking_reference}</title>
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
                <div class="title">${isEventBooking(booking) ? 'EVENT TICKET' : 'KALARI BOOKING'}</div>
                <div class="divider"></div>
                <div class="show-title">${getBookingTitle(booking)}</div>
              </div>
              
              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${formatDisplayDateValue(getBookingDate(booking), 'N/A')}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Time:</span>
                  <span class="info-value">${getBookingTime(booking) ? formatDisplayTimeValue(getBookingTime(booking), 'N/A') : 'General admission'}</span>
                </div>
                <div class="seats-section">
                  <div class="seats-label">${getTicketDisplayLabel(booking)}:</div>
                  <div class="seats-box">${getTicketDisplayValues(booking).join(', ')}</div>
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
                <div>Booking Ref: ${booking.booking_reference}</div>
                <div>Generated: ${formatDisplayDateValue(booking.generated_at)} ${format(new Date(booking.generated_at), 'h:mm a')}</div>
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

  const handleDownloadBooking = (booking: BookingGroup) => {
    const content = [
      'KOVALAM KALARI TICKET',
      `Booking Ref: ${booking.booking_reference}`,
      `Title: ${getBookingTitle(booking)}`,
      `Date: ${formatDisplayDateValue(getBookingDate(booking), 'N/A')}`,
      `Time: ${getBookingTime(booking) ? formatDisplayTimeValue(getBookingTime(booking), 'N/A') : 'General admission'}`,
      `Customer: ${booking.customer?.name || booking.booked_by || 'N/A'}`,
      `${getTicketDisplayLabel(booking)}: ${getTicketDisplayValues(booking).join(', ')}`,
      `Quantity: ${booking.tickets.length}`,
      `Total: Rs. ${booking.total_price}`,
      `Status: ${booking.status}`,
      `QR Value: ${getQrValue(booking)}`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${booking.booking_reference || booking.booking_id}-ticket.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
      <div className="mb-8 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Ticket History
          </h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            View, print, and manage all generated tickets
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end 2xl:w-auto 2xl:flex-nowrap">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search tickets, seats, shows..."
            containerClassName="w-full sm:w-72"
          />
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <DatePicker
              label="Generated Date"
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="All dates"
              presets={[
                { label: 'Clear Filter', value: 'clear' },
                { label: 'Today', value: 'today' },
              ]}
              className="w-full sm:w-44"
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'revoked', label: 'Revoked' },
                { value: 'cancellation-pending', label: 'Cancellation Requests' },
              ]}
              className="w-full sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="hidden">
        <h2 className={`text-lg font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Filter by Generated Date</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <DatePicker
            label="Select Generated Date"
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
          <div className={`text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {selectedDate ? (
              <>Showing {bookings.length} booking(s) generated on {formatDisplayDateValue(selectedDate)}</>
            ) : (
              <>Showing {bookings.length} booking(s) (all dates)</>
            )}
          </div>
          {selectedDate && (
            <div className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
              darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-700'
            }`}>
              Filtered by: {formatDisplayDateValue(selectedDate)}
            </div>
          )}
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="hidden">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
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
              <option value="cancellation-pending">Cancellation Requests</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <AdminTablePanel>
            <AdminTable className="table-fixed">
              <AdminTableHead>
                <tr>
                  <th className={`w-[18%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Booking Ref
                  </th>
                  <th className={`w-[24%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Booking
                  </th>
                  <th className={`w-[26%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Customer
                  </th>
                  <th className={`w-[12%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Quantity
                  </th>
                  <th className={`w-[12%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Total
                  </th>
                  <th className={`w-[12%] px-6 py-4 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Status
                  </th>
                  <th className={`w-[8%] px-6 py-4 text-right text-xs font-medium uppercase tracking-wider transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Actions
                  </th>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {filteredBookings.length === 0 && (
                  <AdminTableEmpty colSpan={7}>
                    {searchTerm || statusFilter !== 'all' || selectedDate
                      ? 'No ticket history matches the current filters.'
                      : 'No ticket history to display.'}
                  </AdminTableEmpty>
                )}
                {filteredBookings.map((booking) => (
                  <tr key={booking.booking_id} className={`transition-colors duration-200 ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`truncate text-sm font-mono transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} title={booking.booking_reference}>
                        {booking.booking_reference}
                      </div>
                      {booking.cancellation_status === 'PENDING' && (
                        <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Cancellation Request
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`truncate text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} title={getBookingTitle(booking)}>{getBookingTitle(booking)}</div>
                      <div className={`truncate text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatDisplayDateValue(getBookingDate(booking), 'N/A')}
                      </div>
                      <div className={`truncate text-xs transition-colors duration-200 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {getBookingTime(booking) ? formatDisplayTimeValue(getBookingTime(booking), 'N/A') : 'General admission'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {booking.customer ? (
                        <div className="flex min-w-0 items-center">
                          <div className="w-8 h-8 shrink-0 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-medium text-sm">
                              {booking.customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className={`truncate text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} title={booking.customer.name}>
                              {toDisplayTitle(booking.customer.name)}
                            </div>
                            {booking.customer.email && (
                              <div className={`truncate text-xs transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} title={booking.customer.email}>
                            {booking.customer.email}
                              </div>
                            )}
                            {booking.customer.phone && (
                              <div className={`truncate text-xs transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} title={booking.customer.phone}>
                                {booking.customer.phone}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {booking.tickets.length} ticket(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Rs. {booking.total_price}</div>
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
                          {toDisplayTitle(booking.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedBooking(booking)
                            setCancellationReviewError('')
                            setShowPreview(true)
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Preview"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
      </AdminTablePanel>

      {/* Details Sheet */}
      <AnimatePresence>
      {showPreview && selectedBooking && (
        <motion.div
          key="ticket-details-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="admin-modal-overlay !items-stretch !justify-end !p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPreview(false)
              setSelectedBooking(null)
            }
          }}
        >
          <motion.div
            initial={{ x: 560, opacity: 0.98 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 560, opacity: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="admin-modal-panel flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-none bg-white shadow-2xl dark:bg-slate-900 sm:rounded-l-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
              <div className="admin-modal-header">
                <div>
                  <h3 className="admin-modal-title">Ticket Details</h3>
                  <p className="admin-modal-subtitle">{selectedBooking.booking_reference}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setSelectedBooking(null)
                  }}
                  className="admin-modal-close"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

            <div className="admin-modal-body space-y-5">
              <div className={`rounded-2xl border p-5 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <QRCode
                      value={getQrValue(selectedBooking)}
                      size={108}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-600">
                      {isEventBooking(selectedBooking) ? 'General admission ticket' : 'Kalari reserved ticket'}
                    </p>
                    <h4 className="mt-2 truncate text-2xl font-black" title={getBookingTitle(selectedBooking)}>
                      {getBookingTitle(selectedBooking)}
                    </h4>
                    <p className="mt-2 truncate font-mono text-sm font-black text-slate-500 dark:text-slate-400" title={selectedBooking.booking_reference}>
                      {selectedBooking.booking_reference}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`border-b px-5 py-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <h4 className="font-black">Booking Details</h4>
                </div>
                {[
                  ['Customer', selectedBooking.customer ? `${toDisplayTitle(selectedBooking.customer.name)}${selectedBooking.customer.phone ? ` - ${selectedBooking.customer.phone}` : ''}` : selectedBooking.booked_by || 'N/A'],
                  ['Date', formatDisplayDateValue(getBookingDate(selectedBooking), 'N/A')],
                  ['Time', getBookingTime(selectedBooking) ? formatDisplayTimeValue(getBookingTime(selectedBooking), 'N/A') : 'General admission'],
                  ['Generated', `${formatDisplayDateValue(selectedBooking.generated_at)} ${format(new Date(selectedBooking.generated_at), 'h:mm a')}`],
                ].map(([label, value]) => (
                  <div key={label} className={`flex items-center justify-between gap-6 border-b px-5 py-4 last:border-b-0 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</div>
                    <div className="min-w-0 truncate text-right text-sm font-medium text-slate-700 dark:text-slate-200" title={value}>{value}</div>
                  </div>
                ))}
              </div>

              <div className={`rounded-2xl border ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`border-b px-5 py-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <h4 className="font-black">Ticket Details</h4>
                </div>
                {[
                  [getTicketDisplayLabel(selectedBooking), getTicketDisplayValues(selectedBooking).join(', ')],
                  ['Quantity', `${selectedBooking.tickets.length} ticket(s)`],
                  ['Total Price', `Rs. ${selectedBooking.total_price}`],
                  ['Ticket Status', toDisplayTitle(selectedBooking.status)],
                ].map(([label, value]) => (
                  <div key={label} className={`flex items-center justify-between gap-6 border-b px-5 py-4 last:border-b-0 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</div>
                    <div className="min-w-0 truncate text-right text-sm font-medium text-slate-700 dark:text-slate-200" title={value}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedBooking.cancellation_status && selectedBooking.cancellation_status !== 'NONE' && (
                <div className={`mt-4 rounded-xl border p-4 ${selectedBooking.cancellation_status === 'PENDING' ? darkMode ? 'border-amber-800 bg-amber-950/30' : 'border-amber-200 bg-amber-50' : darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-black">Cancellation Request</h4>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${selectedBooking.cancellation_status === 'PENDING' ? 'bg-amber-500 text-white' : selectedBooking.cancellation_status === 'APPROVED' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'}`}>
                      {toDisplayTitle(selectedBooking.cancellation_status)}
                    </span>
                  </div>
                  {selectedBooking.cancellation_requested_at && (
                    <p className="mt-2 text-xs font-bold opacity-60">
                      Requested {formatDisplayDateValue(selectedBooking.cancellation_requested_at)} {format(new Date(selectedBooking.cancellation_requested_at), 'h:mm a')}
                    </p>
                  )}
                  <div className={`mt-3 rounded-lg border p-3 text-sm font-semibold leading-6 ${darkMode ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                    {selectedBooking.cancellation_reason || 'No cancellation note provided.'}
                  </div>
                </div>
              )}

              {cancellationReviewError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {cancellationReviewError}
                </div>
              )}

            </div>

              <div className="admin-modal-footer">
                <Button
                  variant="secondary"
                  onClick={() => handleDownloadBooking(selectedBooking)}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download Ticket
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handlePrintBooking(selectedBooking)}
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Export PDF
                </Button>
                {canReviewCancellation(selectedBooking) ? (
                  <>
                    <Button
                      variant="danger"
                      disabled={reviewingCancellation}
                      onClick={() => reviewCancellation(selectedBooking, 'APPROVE')}
                    >
                      {reviewingCancellation ? 'Reviewing...' : 'Approve Cancellation'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={reviewingCancellation}
                      onClick={() => reviewCancellation(selectedBooking, 'REJECT')}
                    >
                      Reject Request
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      handlePrintBooking(selectedBooking)
                    }}
                  >
                    <PrinterIcon className="h-4 w-4" />
                    View Ticket
                  </Button>
                )}
              </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

export default Tickets
