"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, Show, Customer, type Activity } from '@/lib/database'
import { motion } from 'framer-motion'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logBookingCreation } from '@/utils/activityLogger'
import { createBookingReference, createTicketCodes, getBookingReference, getRecordId, isActiveBookingReservation, isShowBookableAt, parseSeatCodes } from '@/lib/booking'
import { resolveShowStatus } from '@/lib/catalogLifecycle'
import { isActivityPubliclyBookable } from '@/lib/activityAvailability'
import {
  ARENA_TOP_LABEL,
  arrowForArenaSide,
  alignClassForArenaSide,
  groupSeatsByArenaSide,
  getSymmetricArenaSections,
  sideLabelForArenaSide,
  type ArenaSide,
} from '@/lib/arenaLayout'
import { CalendarDays, Clock, IndianRupee, Printer, Ticket, X, ArrowLeft } from 'lucide-react'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTablePanel,
  AdminTableRow,
  Button,
  DatePicker,
  IndianPhoneField,
  Input,
  SearchInput,
  Select,
} from '@/components/ui'
import { formatDisplayDateValue, todayDateValue } from '@/components/ui/date-utils'
import {
  getBookingCustomerErrors,
  getBookingEmailError,
  getBookingNameError,
  getBookingPhoneError,
  hasBookingCustomerErrors,
  normalizeBookingPhone,
} from '@/lib/bookingCustomer'
import { buildShowAgentCommissionFields } from '@/lib/agentCommission'
import { toDisplayTitle } from '@/lib/textFormat'

interface SeatData {
  id: string
  section: string
  row: string
  seat_number: string
  price: number
  booked: boolean
  seatName?: string
}

const recordId = getRecordId

type BookingMode = 'SHOW' | 'ACTIVITY'
type BookingTypeFilter = 'ALL' | BookingMode

const Booking: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkShowId = searchParams.get('showId') || ''
  const deepLinkActivityId = searchParams.get('activityId') || ''
  const deepLinkDate = searchParams.get('date') || ''
  const catalogHidden = Boolean(deepLinkShowId || deepLinkActivityId)
  const deepLinkHandled = useRef(false)

  const [bookingMode, setBookingMode] = useState<BookingMode>('SHOW')
  const [bookingTypeFilter, setBookingTypeFilter] = useState<BookingTypeFilter>('ALL')
  const [bookingSearch, setBookingSearch] = useState('')
  const [shows, setShows] = useState<Show[]>([])
  const [allShows, setAllShows] = useState<Show[]>([])
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [linkedShowAgent, setLinkedShowAgent] = useState<any>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [activityTicketCount, setActivityTicketCount] = useState(1)
  const [activityRemaining, setActivityRemaining] = useState<number | null>(null)
  const [activityAvailability, setActivityAvailability] = useState<Record<string, number>>({})
  const [seats, setSeats] = useState<SeatData[]>([])
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [submittingCustomer, setSubmittingCustomer] = useState(false)
  const [checkoutCustomerPhone, setCheckoutCustomerPhone] = useState('')
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('')
  const [checkoutCustomerEmail, setCheckoutCustomerEmail] = useState('')
  const [checkoutCustomerError, setCheckoutCustomerError] = useState('')
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState({ name: '', phone: '', email: '' })
  const [catalogReady, setCatalogReady] = useState(false)
  const darkMode = useDarkMode()

  useEffect(() => {
    let cancelled = false
    async function initCatalog() {
      await Promise.all([fetchActiveShows(), fetchActivities()])
      if (!cancelled) setCatalogReady(true)
    }
    initCatalog()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedShow) {
      fetchSeatsForShow(recordId(selectedShow))
      setSelectedSeats([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShow])

  useEffect(() => {
    const loadLinkedAgent = async () => {
      const agentId = String((selectedShow as any)?.agent_id || "")
      if (!agentId) {
        setLinkedShowAgent(null)
        return
      }
      const { data } = await db.from('agents').select('*').eq('id', agentId).single()
      setLinkedShowAgent(data || null)
    }
    void loadLinkedAgent()
  }, [selectedShow])

  useEffect(() => {
    if (selectedDate) {
      const filteredShows = allShows.filter(show => show.date === selectedDate)
      setShows(filteredShows)
    } else {
      setShows(allShows)
    }
    if (selectedShow && selectedDate && selectedShow.date !== selectedDate) {
      setSelectedShow(null)
    }
  }, [selectedDate, allShows, selectedShow])

  useEffect(() => {
    if (bookingMode !== 'ACTIVITY' || !selectedActivity) return
    fetchActivityAvailability(selectedActivity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingMode, selectedActivity, selectedDate])

  useEffect(() => {
    if (activities.length === 0) {
      setActivityAvailability({})
      return
    }

    const loadAvailability = async () => {
      const date = selectedDate || todayDateValue()
      const entries = await Promise.all(activities.map(async (activity) => {
        try {
          const response = await fetch(`/api/activity-bookings?activityId=${encodeURIComponent(recordId(activity))}&date=${encodeURIComponent(date)}`)
          const payload = await response.json().catch(() => ({}))
          return [recordId(activity), Number(payload?.data?.remaining ?? activity.daily_capacity ?? 20)] as const
        } catch {
          return [recordId(activity), Number(activity.daily_capacity || 20)] as const
        }
      }))
      setActivityAvailability(Object.fromEntries(entries))
    }

    loadAvailability()
  }, [activities, selectedDate])

  const getAvailableDates = () => {
    const uniqueDates = new Set(allShows.map(show => show.date))
    return Array.from(uniqueDates).sort()
  }

  const fetchActiveShows = async () => {
    try {
      const { data, error } = await db
        .from('shows')
        .select(`
          *,
          layout:layouts(*)
        `)
        .in('status', ['ACTIVE'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')

      if (error) throw error
      
      const updatedShows = await checkAndUpdateShowStatuses(data || [])
      const activeShows = updatedShows.filter(show =>
        show.status === 'ACTIVE' &&
        isShowBookableAt(show) &&
        show.availability_status !== 'SOLD_OUT' &&
        Number(show.available_count ?? 1) > 0
      )
      
      setAllShows(activeShows)
      setShows(activeShows)
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const checkAndUpdateShowStatuses = async (shows: Show[]) => {
    const updatedShows = []
    for (const show of shows) {
      let updatedShow = { ...show }
      const nextStatus = resolveShowStatus(show)
      if (nextStatus !== show.status) {
        try {
          await db.from('shows').update({ status: nextStatus }).eq('id', recordId(show))
          if (nextStatus === 'SHOW_DONE') {
            await db.from('tickets').update({ status: 'COMPLETED' }).eq('show_id', recordId(show)).in('status', ['ACTIVE'])
          }
        } catch (error) { console.error(error) }
        updatedShow.status = nextStatus as Show['status']
      }
      updatedShows.push(updatedShow)
    }
    return updatedShows
  }

  const checkIfHouseFull = async (show: Show) => {
    try {
      if (!show.layout) return false
      const totalSeats = show.layout.structure.sections?.reduce((total: number, section: any) => {
        if (section.rows && Array.isArray(section.rows)) {
          return total + section.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
        }
        return total + ((section.rows || 0) * (section.seatsPerRow || 0))
      }, 0) || 0
      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', recordId(show)).in('status', ['CONFIRMED', 'HELD'])
      const bookedSeatsCount = bookings?.reduce((count, booking) => {
        if (!isActiveBookingReservation(booking)) return count
        try {
          const seats = JSON.parse(booking.seat_code)
          return count + (Array.isArray(seats) ? seats.length : 1)
        } catch {
          return count + (booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1)
        }
      }, 0) || 0
      return bookedSeatsCount >= totalSeats
    } catch (error) { return false }
  }

  const fetchSeatsForShow = async (showId: string) => {
    setLoading(true)
    try {
      const show = shows.find(s => recordId(s) === showId)
      if (!show?.layout) {
        setSeats([])
        return
      }
      const generatedSeats: SeatData[] = []

      getSymmetricArenaSections(show.layout.structure.sections || []).forEach((section: any) => {
        const sectionPrefix = section.name.charAt(0).toUpperCase()
        if (section.rows && Array.isArray(section.rows)) {
          section.rows.forEach((rowConfig: any, rowIndex: number) => {
            const rowLetter = String.fromCharCode(65 + rowIndex)
            for (let seat = 1; seat <= rowConfig.seats; seat++) {
              const seatName = `${sectionPrefix}${rowLetter}${seat}`
              const seatId = `${section.name}-${rowLetter}-${seat}`
              generatedSeats.push({
                id: seatId, section: section.name, row: rowLetter,
                seat_number: seat.toString(), price: selectedShow?.price || 100, booked: false, seatName: seatName
              })
            }
          })
        } else {
          for (let row = 1; row <= (section.rows || 0); row++) {
            const rowLetter = String.fromCharCode(65 + row - 1)
            for (let seat = 1; seat <= (section.seatsPerRow || 0); seat++) {
              const seatName = `${sectionPrefix}${rowLetter}${seat}`
              const seatId = `${section.name}-${rowLetter}-${seat}`
              generatedSeats.push({
                id: seatId, section: section.name, row: row.toString(),
                seat_number: seat.toString(), price: selectedShow?.price || 100, booked: false, seatName: seatName
              })
            }
          }
        }
      })

      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', showId).in('status', ['CONFIRMED', 'HELD'])
      const bookedSeats = new Set<string>()
      bookings?.forEach(booking => {
        if (!isActiveBookingReservation(booking)) return
        try {
          const s = JSON.parse(booking.seat_code)
          if (Array.isArray(s)) s.forEach(seat => bookedSeats.add(seat))
          else bookedSeats.add(booking.seat_code)
        } catch {
          if (booking.seat_code.includes(',')) booking.seat_code.split(',').forEach((seat: string) => bookedSeats.add(seat.trim()))
          else bookedSeats.add(booking.seat_code)
        }
      })
      const blockedSeats = show.layout.structure.blockedSeats || []
      generatedSeats.forEach(seat => { seat.booked = bookedSeats.has(seat.id) || blockedSeats.includes(seat.id) })
      setSeats(generatedSeats)
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  const toggleSeat = (seatId: string) => {
    const seat = seats.find(s => s.id === seatId)
    if (!seat || seat.booked) return
    setSelectedSeats(prev => prev.includes(seatId) ? prev.filter(id => id !== seatId) : [...prev, seatId])
  }

  const getTicketQuantity = () => {
    if (bookingMode === 'ACTIVITY') return activityTicketCount
    return selectedSeats.length
  }

  const getTotalAmount = () => {
    if (bookingMode === 'ACTIVITY') return Number(selectedActivity?.booking_price || selectedActivity?.price || 0) * getTicketQuantity()
    return (selectedShow?.price || 100) * getTicketQuantity()
  }

  const getSelectedTitle = () =>
    bookingMode === 'ACTIVITY' ? selectedActivity?.title : selectedShow?.title

  const handleContinueBooking = () => {
    if (bookingMode === 'ACTIVITY') {
      if (!selectedActivity || getTicketQuantity() === 0) return
      if (selectedActivity.booking_status === 'PAUSED') {
        alert('This activity booking is paused.')
        return
      }
      const remaining = activityRemaining ?? Number(selectedActivity.daily_capacity || 20)
      if (activityTicketCount > remaining) {
        alert(`Only ${remaining} tickets left for this activity date.`)
        return
      }
      setCheckoutCustomerError('')
      setCheckoutFieldErrors({ name: '', phone: '', email: '' })
      setBookingDetailOpen(false)
      setShowCustomerModal(true)
      return
    }
    if (!selectedShow || getTicketQuantity() === 0) return
    if (!isShowBookableAt(selectedShow)) {
      alert('Booking is closed because this show time has passed.')
      setSelectedShow(null)
      fetchActiveShows()
      return
    }
    setCheckoutCustomerError('')
    setBookingDetailOpen(false)
    setShowCustomerModal(true)
  }

  const fetchActivities = async () => {
    try {
      const { data, error } = await db
        .from('activities')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('title')
      if (error) throw error
      setActivities((data || []).filter((activity: Activity) =>
        isActivityPubliclyBookable(activity),
      ))
    } catch (error) {
      console.error('Error fetching activities:', error)
    }
  }

  const fetchActivityAvailability = async (activity: Activity) => {
    try {
      const date = selectedDate || todayDateValue()
      const response = await fetch(`/api/activity-bookings?activityId=${encodeURIComponent(recordId(activity))}&date=${encodeURIComponent(date)}`)
      const payload = await response.json().catch(() => ({}))
      setActivityRemaining(Number(payload?.data?.remaining ?? activity.daily_capacity ?? 20))
    } catch {
      setActivityRemaining(Number(activity.daily_capacity || 20))
    }
  }

  const validateCheckoutCustomer = () => {
    const nextErrors = getBookingCustomerErrors({
      name: checkoutCustomerName,
      phone: checkoutCustomerPhone,
      email: checkoutCustomerEmail,
    })
    setCheckoutFieldErrors(nextErrors)
    return !hasBookingCustomerErrors(nextErrors)
  }

  const findOrCreateCheckoutCustomer = async () => {
    if (!validateCheckoutCustomer()) {
      throw new Error('Enter the customer name and a valid mobile number.')
    }

    const name = checkoutCustomerName.trim()
    const phone = normalizeBookingPhone(checkoutCustomerPhone)
    const email = checkoutCustomerEmail.trim()

    const { data: existingCustomers, error: existingError } = await db.from('customers').select('*').eq('phone', phone)
    if (existingError) throw new Error(existingError.message || 'Could not check customer mobile number.')
    if (existingCustomers?.[0]) {
      const existing = existingCustomers[0] as Customer
      if (name !== existing.name || email !== (existing.email || '')) {
        const now = new Date().toISOString()
        await db.from('customers').update({ name, email, updated_at: now }).eq('id', recordId(existing))
        return { ...existing, name, email } as Customer
      }
      return existing
    }

    const now = new Date().toISOString()
    const { data: customers, error } = await db.from('customers').insert([{
      name,
      phone,
      email,
      created_at: now,
      updated_at: now,
    }]).select()

    if (error || !customers?.[0]) throw new Error(error?.message || 'Could not create customer.')
    return customers[0] as Customer
  }

  const handleBookSeats = async (customer: Customer) => {
    if (!selectedShow || getTicketQuantity() === 0) return
    try {
      if (!isShowBookableAt(selectedShow)) {
        throw new Error('Booking is closed because this show time has passed.')
      }
      setLoading(true)
      const { data: existingBookings } = await db.from('bookings').select('seat_code').eq('show_id', recordId(selectedShow)).in('status', ['CONFIRMED', 'HELD'])
      const activeBookings = existingBookings?.filter(isActiveBookingReservation) || []
      const allBookedSeats = activeBookings.flatMap(booking => parseSeatCodes(booking.seat_code))
      const conflictingSeats = selectedSeats.filter(seat => allBookedSeats.includes(seat))
      if (conflictingSeats.length > 0) {
        alert(`Some seats are already booked. Please refresh and try again.`)
        fetchSeatsForShow(recordId(selectedShow))
        return
      }

      const bookingReference = createBookingReference()
      const seatCodesToSave = selectedSeats
      const generatedTicketCodes = createTicketCodes(seatCodesToSave.length)

      const bookingToInsert = {
        booking_reference: bookingReference,
        show_id: recordId(selectedShow),
        booking_type: 'SHOW',
        seat_code: JSON.stringify(seatCodesToSave),
        booked_by: customer.name,
        customer_id: recordId(customer),
        ...buildShowAgentCommissionFields(selectedShow, getTotalAmount(), new Date(), linkedShowAgent),
        payment_method: 'COUNTER',
        payment_status: 'PAID',
        total_amount: getTotalAmount(),
        booking_time: new Date().toISOString(),
        status: 'CONFIRMED',
        cancellation_status: 'NONE'
      }

      const { data: bookings, error: bookingError } = await db.from('bookings').insert([bookingToInsert]).select()
      if (bookingError) throw bookingError
      const booking = bookings[0]
      const bookingId = recordId(booking)

      const ticketsToInsert = seatCodesToSave.map((seatCode, index) => ({
        booking_id: bookingId, show_id: recordId(selectedShow), seat_code: seatCode,
        ticket_code: generatedTicketCodes[index],
        price: selectedShow.price || 100, generated_by: 'admin', generated_at: new Date().toISOString(), status: 'ACTIVE'
      }))

      const { data: tickets, error: ticketError } = await db.from('tickets').insert(ticketsToInsert).select()
      if (ticketError) throw ticketError
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'NEW_BOOKING',
          module: 'BOOKING',
          title: 'New counter booking',
          message: `${getBookingReference(booking)} was booked for ${selectedShow.title}.`,
          severity: 'SUCCESS',
          entity_type: 'booking',
          entity_id: bookingId,
          action_url: '/admin/tickets',
          metadata: { booking_reference: getBookingReference(booking), show_id: recordId(selectedShow) },
        }),
      }).catch(() => null)

      const { data: { user } } = await db.auth.getUser()
      await logBookingCreation(bookingId, selectedShow.title, user?.email || 'unknown', {
        booking_reference: getBookingReference(booking), seat_codes: seatCodesToSave, total_price: getTotalAmount()
      })

      setBookingResult({ bookings, tickets, success: true, totalAmount: getTotalAmount() })
      setShowConfirmation(true)
      setShowCustomerModal(false)
      setCheckoutCustomerPhone('')
      setCheckoutCustomerName('')
      setCheckoutCustomerEmail('')
      setCheckoutFieldErrors({ name: '', phone: '', email: '' })
      setSelectedSeats([])
      fetchSeatsForShow(recordId(selectedShow))
    } catch (error: any) { alert(`Error: ${error.message}`) } finally { setLoading(false) }
  }

  const handleBookActivity = async () => {
    if (!selectedActivity || activityTicketCount < 1) return
    if (!validateCheckoutCustomer()) {
      throw new Error('Enter the customer name and a valid mobile number.')
    }

    const phone = normalizeBookingPhone(checkoutCustomerPhone)
    const date = selectedDate || todayDateValue()
    const response = await fetch('/api/activity-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: recordId(selectedActivity),
        date,
        ticketCount: activityTicketCount,
        paymentMethod: 'COUNTER',
        customer: {
          name: checkoutCustomerName.trim(),
          phone,
          email: checkoutCustomerEmail.trim(),
        },
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not complete activity booking.')

    const booking = payload.data?.booking
    const tickets = payload.data?.tickets || []
    const bookingId = recordId(booking)
    const { data: { user } } = await db.auth.getUser()
    await logBookingCreation(bookingId, selectedActivity.title, user?.email || 'unknown', {
      booking_reference: getBookingReference(booking),
      seat_codes: Array.from({ length: activityTicketCount }).map(() => 'GENERAL'),
      total_price: getTotalAmount(),
    })

    setBookingResult({ bookings: [booking], tickets, success: true, totalAmount: getTotalAmount() })
    setShowConfirmation(true)
    setShowCustomerModal(false)
    setCheckoutCustomerPhone('')
    setCheckoutCustomerName('')
    setActivityTicketCount(1)
    fetchActivityAvailability(selectedActivity)
  }

  const handleCustomerCheckout = async () => {
    setSubmittingCustomer(true)
    setCheckoutCustomerError('')
    try {
      if (bookingMode === 'ACTIVITY') {
        await handleBookActivity()
        return
      }
      const customer = await findOrCreateCheckoutCustomer()
      await handleBookSeats(customer)
    } catch (error: any) {
      setCheckoutCustomerError(error.message || 'Could not complete booking.')
    } finally {
      setSubmittingCustomer(false)
    }
  }

  const handlePrintBookingResult = () => {
    const booking = bookingResult?.bookings?.[0]
    if (!booking) return
    const reference = getBookingReference(booking)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(reference)}`
    const title = toDisplayTitle(getSelectedTitle() || booking.activity?.title || booking.show?.title || 'Booking')
    const admission = bookingMode === 'ACTIVITY' ? 'GENERAL' : 'Reserved seats'
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket - ${reference}</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
            .ticket { max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; }
            .brand { font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #d97706; text-transform: uppercase; }
            h1 { margin: 10px 0 4px; font-size: 28px; }
            .muted { color: #6b7280; font-weight: 700; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
            .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; }
            .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #9ca3af; text-transform: uppercase; }
            .value { margin-top: 6px; font-size: 18px; font-weight: 900; }
            .qr { text-align: center; margin-top: 20px; }
            .ref { margin-top: 14px; text-align: center; font-family: monospace; font-weight: 900; color: #b45309; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="brand">Kovalam Kalari</div>
            <h1>${title}</h1>
            <div class="muted">Counter booking ticket</div>
            <div class="grid">
              <div class="box"><div class="label">Admission</div><div class="value">${admission}</div></div>
              <div class="box"><div class="label">Tickets</div><div class="value">${bookingResult?.tickets?.length || getTicketQuantity()}</div></div>
              <div class="box"><div class="label">Total</div><div class="value">Rs. ${bookingResult?.totalAmount ?? getTotalAmount()}</div></div>
              <div class="box"><div class="label">Payment</div><div class="value">Paid</div></div>
            </div>
            <div class="qr"><img src="${qrCodeUrl}" width="140" height="140" alt="QR Code" /></div>
            <div class="ref">${reference}</div>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 500)</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const getRowsForSection = (section: string) =>
    seats
      .filter((seat) => seat.section === section)
      .reduce<Record<string, SeatData[]>>((grouped, seat) => {
        const rowLetter = seat.seatName?.charAt(1) || seat.row
        grouped[rowLetter] = grouped[rowLetter] || []
        grouped[rowLetter].push(seat)
        return grouped
      }, {})

  const renderAdminSeatButton = (seat: SeatData) => (
    <motion.button
      key={seat.id}
      onClick={() => toggleSeat(seat.id)}
      disabled={seat.booked}
      whileHover={{ scale: seat.booked ? 1 : 1.08 }}
      className={`h-8 w-9 rounded border text-[10px] font-bold transition-all ${
        seat.booked ? 'bg-red-100 border-red-300 text-red-600 opacity-50' :
        selectedSeats.includes(seat.id) ? 'bg-green-500 border-green-600 text-white shadow-lg shadow-green-500/30' :
        darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
      }`}
    >
      {seat.seatName || seat.seat_number}
    </motion.button>
  )

  const renderArenaSide = (rows: SeatData[][], side: ArenaSide) => {
    if (rows.length === 0) return null
    const isSide = side === 'left' || side === 'right'
    const sideRows = isSide && side === 'left' ? [...rows].reverse() : rows
    const maxSeatsInSide = isSide ? Math.max(...sideRows.map(row => row.length)) : 0

    const renderSideColumns = () => (
      <div
        className="grid h-full content-center justify-center gap-2"
        style={{ gridTemplateColumns: `repeat(${sideRows.length}, minmax(36px, 44px))` }}
      >
        {sideRows.map((rowSeats, rowIndex) => (
          <div key={`${side}-${rowSeats[0]?.seatName || rowIndex}`} className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-bold opacity-30">
              {rowSeats[0]?.seatName?.charAt(1) || String.fromCharCode(65 + rowIndex)}
            </span>
            {Array.from({ length: maxSeatsInSide }, (_, seatIndex) => {
              const seat = rowSeats[seatIndex]
              return seat ? renderAdminSeatButton(seat) : <span key={`${side}-${rowIndex}-${seatIndex}`} className="h-8 w-9" />
            })}
          </div>
        ))}
      </div>
    )

    return (
      <div className={`h-full rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{sideLabelForArenaSide(side)}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">{arrowForArenaSide(side)}</span>
        </div>
        <div className="space-y-2 overflow-x-auto pb-1">
          {isSide ? renderSideColumns() : rows.map((rowSeats, index) => (
            <motion.div
              key={`${side}-${rowSeats[0]?.seatName || index}`}
              className={`flex items-center gap-1 ${alignClassForArenaSide(side)}`}
            >
              <span className="w-6 shrink-0 text-[10px] font-bold opacity-30">
                {rowSeats[0]?.seatName?.charAt(1) || String.fromCharCode(65 + index)}
              </span>
              {rowSeats.map(renderAdminSeatButton)}
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  const renderRowSeats = (section: any, rowConfig: any, rowIndex: number, sectionSeats: any[]) => {
    const rowLetter = String.fromCharCode(65 + rowIndex)
    const sectionPrefix = section.name.charAt(0).toUpperCase()
    return Array.from({ length: rowConfig.seats }, (_, seatIndex) => {
      const seatNumber = seatIndex + 1
      const seatId = `${section.name}-${rowLetter}-${seatNumber}`
      const seat = sectionSeats.find(s => s.row === (rowIndex + 1).toString() && s.seat_number === seatNumber.toString()) || {
        id: seatId, booked: false, seatName: `${sectionPrefix}${rowLetter}${seatNumber}`
      }
      return (
        <motion.button
          key={seatId} onClick={() => toggleSeat(seatId)} disabled={seat.booked}
          whileHover={{ scale: seat.booked ? 1 : 1.1 }}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded border text-[10px] sm:text-xs font-bold transition-all ${
            seat.booked ? 'bg-red-100 border-red-300 text-red-600 opacity-50' :
            selectedSeats.includes(seatId) ? 'bg-green-500 border-green-600 text-white shadow-lg shadow-green-500/30' :
            darkMode ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }`}
        >
          {seatNumber}
        </motion.button>
      )
    })
  }

  const renderRectangularSeatMap = () => {
    if (!selectedShow?.layout) return null
    const arenaGroups = groupSeatsByArenaSide(seats, getRowsForSection)
    const renderArenaCenter = () => (
      <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex aspect-square w-[390px] items-center justify-center overflow-hidden rounded-lg border-4 border-[#8b5a2b]/30 bg-[#b8793b] shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#d6a15f_0%,#b8793b_42%,#8b5a2b_100%)]" />
          <div className="absolute inset-4 rounded-lg border border-[#f3d6a3]/35" />
          <div className="absolute h-[72%] w-1.5 rotate-45 rounded-full bg-[#6f3f1c]/45" />
          <div className="absolute h-[72%] w-1.5 -rotate-45 rounded-full bg-[#6f3f1c]/45" />
          <div className="absolute h-16 w-16 rounded-full border-2 border-[#f3d6a3]/40" />
          <div className="absolute h-3 w-3 rounded-full bg-[#f3d6a3]/80" />
        </div>
        <div className="text-center text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ankathattu</div>
      </div>
    )

    return (
      <div className="min-w-[1040px] space-y-5 rounded-lg bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-950/40 dark:ring-slate-800">
        <div className="text-center text-xs font-black uppercase tracking-widest text-slate-400">{ARENA_TOP_LABEL}</div>
        <div>{renderArenaSide(arenaGroups.top, 'top')}</div>
        <div className="grid grid-cols-[260px_430px_260px] items-center justify-center gap-5">
          <div className="h-full">{renderArenaSide(arenaGroups.left, 'left')}</div>
          {renderArenaCenter()}
          <div className="h-full">{renderArenaSide(arenaGroups.right, 'right')}</div>
        </div>
        <div>{renderArenaSide(arenaGroups.bottom, 'bottom')}</div>
      </div>
    )
  }

  const bookingRows = useMemo(() => {
    const showRows = shows.map((show) => ({
      id: recordId(show),
      type: 'SHOW' as const,
      name: show.title,
      date: show.date,
      timeLabel: show.time || 'Time not set',
      availability: Number(show.available_count ?? 0),
      price: Number(show.price || 0),
      source: show,
    }))
    const activityRows = activities.map((activity) => {
      const activityId = recordId(activity)
      return {
        id: activityId,
        type: 'ACTIVITY' as const,
        name: activity.title,
        date: selectedDate || todayDateValue(),
        timeLabel: 'General admission',
        availability: Number(activityAvailability[activityId] ?? activity.daily_capacity ?? 20),
        price: Number(activity.booking_price || activity.price || 0),
        source: activity,
      }
    })
    const query = bookingSearch.trim().toLowerCase()
    return [...showRows, ...activityRows]
      .filter((row) => bookingTypeFilter === 'ALL' || row.type === bookingTypeFilter)
      .filter((row) => !selectedDate || row.type === 'ACTIVITY' || row.date === selectedDate)
      .filter((row) => !query || `${row.name} ${row.type} ${row.date} ${row.timeLabel}`.toLowerCase().includes(query))
      .sort((left, right) => {
        const byDate = String(left.date).localeCompare(String(right.date))
        if (byDate !== 0) return byDate
        if (left.type !== right.type) return left.type === 'SHOW' ? -1 : 1
        return left.name.localeCompare(right.name)
      })
  }, [activities, activityAvailability, bookingSearch, bookingTypeFilter, selectedDate, shows])

  const openShowBooking = (show: Show) => {
    setBookingMode('SHOW')
    setSelectedShow(show)
    setSelectedActivity(null)
    setActivityTicketCount(1)
    setActivityRemaining(null)
    setBookingDetailOpen(true)
  }

  const openActivityBooking = (activity: Activity, date?: string) => {
    const bookingDate = date || selectedDate || todayDateValue()
    setBookingMode('ACTIVITY')
    setSelectedActivity(activity)
    setSelectedShow(null)
    setSelectedSeats([])
    setActivityTicketCount(1)
    setActivityRemaining(Number(activityAvailability[recordId(activity)] ?? activity.daily_capacity ?? 20))
    setSelectedDate(bookingDate)
    setBookingDetailOpen(true)
  }

  const closeBookingDetail = () => {
    setBookingDetailOpen(false)
    if (catalogHidden) router.replace('/admin/booking')
  }

  useEffect(() => {
    if (!catalogReady || deepLinkHandled.current) return

    async function applyDeepLink() {
      if (deepLinkDate) setSelectedDate(deepLinkDate)

      if (deepLinkShowId) {
        let show =
          allShows.find((item) => recordId(item) === deepLinkShowId) ||
          shows.find((item) => recordId(item) === deepLinkShowId)
        if (!show) {
          const { data } = await db
            .from('shows')
            .select('*, layout:layouts(*)')
            .eq('id', deepLinkShowId)
            .single()
          show = data || undefined
        }
        if (show) {
          openShowBooking(show)
          deepLinkHandled.current = true
        }
        return
      }

      if (deepLinkActivityId) {
        let activity = activities.find((item) => recordId(item) === deepLinkActivityId)
        if (!activity) {
          const { data } = await db.from('activities').select('*').eq('id', deepLinkActivityId).single()
          activity = data || undefined
        }
        if (activity) {
          openActivityBooking(activity, deepLinkDate || todayDateValue())
          deepLinkHandled.current = true
        }
      }
    }

    applyDeepLink()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, deepLinkShowId, deepLinkActivityId, deepLinkDate, allShows, shows, activities])

  const selectBookingRow = (row: typeof bookingRows[number]) => {
    if (row.type === 'SHOW') {
      openShowBooking(row.source as Show)
      return
    }
    openActivityBooking(row.source as Activity, selectedDate || todayDateValue())
  }

  const selectedName = selectedActivity?.title || selectedShow?.title

  return (
    <div className={darkMode ? 'text-slate-100' : 'text-slate-900'}>
      <div className="w-full space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          {catalogHidden ? (
            <div className="flex items-center gap-4">
              <Link
                href={deepLinkShowId ? '/admin/shows' : '/admin/activities'}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${darkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <ArrowLeft className="h-4 w-4" />
                {deepLinkShowId ? 'Back to Shows' : 'Back to Activities'}
              </Link>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Counter Booking</h1>
                {selectedName && (
                  <p className="mt-1 text-sm font-semibold opacity-60">{toDisplayTitle(selectedName)}</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-black tracking-tight">Counter Booking</h1>
              <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:items-center">
                <SearchInput
                  value={bookingSearch}
                  onChange={setBookingSearch}
                  placeholder="Search shows or activities..."
                  containerClassName="w-full sm:min-w-[320px] xl:w-96"
                />
                <Select
                  value={bookingTypeFilter}
                  onChange={(value) => setBookingTypeFilter(value as BookingTypeFilter)}
                  options={[
                    { value: 'ALL', label: 'All Types' },
                    { value: 'SHOW', label: 'Shows' },
                    { value: 'ACTIVITY', label: 'Activities' },
                  ]}
                  className="w-full sm:w-48"
                />
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder="All dates"
                  minDate={bookingTypeFilter === 'ACTIVITY' ? todayDateValue() : undefined}
                  presets={[
                    { label: 'Today', value: 'today' },
                    { label: 'Clear', value: 'clear' },
                  ]}
                  className="w-full sm:w-48"
                />
              </div>
            </>
          )}
        </header>

        {!catalogHidden && (
        <section className="space-y-6">
          <AdminTablePanel>
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Type</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Date</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Time / Admission</AdminTableHeaderCell>
                  <AdminTableHeaderCell align="center">Available</AdminTableHeaderCell>
                  <AdminTableHeaderCell align="right">Price</AdminTableHeaderCell>
                  <AdminTableHeaderCell align="right">Action</AdminTableHeaderCell>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {bookingRows.length === 0 && (
                  <AdminTableEmpty colSpan={7}>
                    No bookable shows or activities match the current filters.
                  </AdminTableEmpty>
                )}
                {bookingRows.map((row) => {
                  const active = row.type === 'SHOW'
                    ? selectedShow && recordId(selectedShow) === row.id
                    : selectedActivity && recordId(selectedActivity) === row.id
                  return (
                    <AdminTableRow
                      key={`${row.type}-${row.id}`}
                      className={active ? 'bg-amber-50/80 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30' : undefined}
                    >
                      <AdminTableCell>
                        <div className="font-black text-slate-950 dark:text-slate-100">{toDisplayTitle(row.name)}</div>
                        <div className="mt-1 text-xs font-bold text-slate-400">
                          {row.type === 'SHOW' ? 'Kalari seat booking' : 'Daily activity booking'}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${row.type === 'SHOW' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                          {row.type === 'SHOW' ? 'Show' : 'Activity'}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>{formatDisplayDateValue(row.date)}</AdminTableCell>
                      <AdminTableCell>{row.timeLabel}</AdminTableCell>
                      <AdminTableCell align="center">
                        <span className="font-black">{Math.max(0, row.availability)}</span>
                      </AdminTableCell>
                      <AdminTableCell align="right">
                        <span className="font-black text-amber-600">Rs. {row.price}</span>
                      </AdminTableCell>
                      <AdminTableCell align="right">
                        <Button size="sm" variant="primary" onClick={() => selectBookingRow(row)}>
                          Book Now
                        </Button>
                      </AdminTableCell>
                    </AdminTableRow>
                  )
                })}
              </AdminTableBody>
            </AdminTable>
          </AdminTablePanel>

        </section>
        )}

        {bookingDetailOpen && (selectedActivity || selectedShow) && (
          <div
            className="admin-modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeBookingDetail()
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="admin-modal-panel admin-modal-card w-full"
              style={{ maxWidth: 'min(1320px, 96vw)' }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="admin-modal-header">
                <div>
                  <h2 className="admin-modal-title">Book Tickets</h2>
                  <p className="admin-modal-subtitle">
                    {bookingMode === 'ACTIVITY'
                      ? `${formatDisplayDateValue(selectedDate || todayDateValue())} - General admission`
                      : selectedShow ? `${formatDisplayDateValue(selectedShow.date)} - ${selectedShow.time || 'Time not set'}` : 'Select tickets'}
                  </p>
                </div>
                <button type="button" onClick={closeBookingDetail} className="admin-modal-close" aria-label="Close booking details">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="admin-modal-body">
            {bookingMode === 'ACTIVITY' && selectedActivity ? (
              <div className={`grid gap-6 rounded-2xl border p-5 shadow-sm transition-all lg:grid-cols-[minmax(0,1fr)_360px] sm:p-7 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <span className="w-fit rounded-full bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      Activity tickets
                    </span>
                    <div>
                      <h2 className="text-3xl font-black tracking-tight">{toDisplayTitle(selectedActivity.title)}</h2>
                      <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                        {formatDisplayDateValue(selectedDate || todayDateValue())} - General admission
                      </p>
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-2xl font-black">General admission</h3>
                        <p className="mt-1 text-sm font-bold opacity-50">Choose how many tickets to issue for this activity date.</p>
                      </div>
                      <div className="w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                        {activityRemaining ?? selectedActivity.daily_capacity ?? 20} remaining
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <button onClick={() => setActivityTicketCount(Math.max(1, activityTicketCount - 1))} className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl font-black transition-colors ${darkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-100'}`}>-</button>
                      <div className={`flex min-w-36 flex-col items-center rounded-2xl border px-8 py-4 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                        <div className="text-4xl font-black text-amber-600">{activityTicketCount}</div>
                        <div className="text-[11px] font-black uppercase tracking-widest opacity-40">Tickets</div>
                      </div>
                      <button
                        onClick={() => setActivityTicketCount(Math.min(activityRemaining ?? Number(selectedActivity.daily_capacity || 20), activityTicketCount + 1))}
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl font-black transition-colors ${darkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-100'}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-6 grid gap-3 text-sm font-bold text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                      <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">Admission: GENERAL</div>
                      <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">Daily limit: {selectedActivity.daily_capacity || 20}</div>
                    </div>
                  </div>
                </div>

                <aside className={`flex flex-col justify-between rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Booking summary</p>
                    <div className="mt-5 space-y-4 text-sm font-bold">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">Ticket type</span>
                        <span>GENERAL</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">Quantity</span>
                        <span>{getTicketQuantity()}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">Price</span>
                        <span>Rs. {Number(selectedActivity.booking_price || selectedActivity.price || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total amount</p>
                        <p className="mt-1 text-4xl font-black text-amber-600">Rs. {getTotalAmount()}</p>
                      </div>
                    </div>
                    <Button onClick={handleContinueBooking} size="lg" className="mt-6 w-full uppercase tracking-widest">
                      Checkout ({getTicketQuantity()})
                    </Button>
                  </div>
                </aside>
              </div>
            ) : bookingMode === 'SHOW' && selectedShow ? (
              <div className={`rounded-2xl border p-4 shadow-sm transition-all sm:p-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-2xl font-black">{toDisplayTitle(selectedShow.title)}</h2>
                    <p className="text-sm font-bold opacity-40 uppercase tracking-widest">{formatDisplayDateValue(selectedShow.date)} @ {selectedShow.time}</p>
                  </div>
                  {getTicketQuantity() > 0 && (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Amount</div>
                        <div className="text-2xl font-black text-amber-600">Rs. {getTotalAmount()}</div>
                      </div>
                      <Button onClick={handleContinueBooking} size="lg" className="uppercase tracking-widest">
                        Checkout ({getTicketQuantity()})
                      </Button>
                    </motion.div>
                  )}
                </div>

                <div className="overflow-x-auto pb-8">
                  {loading ? (
                    <div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div></div>
                  ) : renderRectangularSeatMap()}
                </div>
              </div>
            ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div
          className="admin-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCustomerModal(false)
          }}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="admin-modal-panel admin-modal-card admin-modal-card-lg"
            onMouseDown={(event) => event.stopPropagation()}
          >
             <div className="admin-modal-header">
               <div>
                 <h2 className="admin-modal-title">Complete Booking</h2>
                 <p className="admin-modal-subtitle">Link this counter booking to the customer mobile number.</p>
               </div>
               <button type="button" onClick={() => setShowCustomerModal(false)} className="admin-modal-close" aria-label="Close modal">
                 <X className="h-5 w-5" />
               </button>
             </div>
             
             <div className="admin-modal-body grid gap-6 md:grid-cols-2">
               <div className="space-y-6">
                 <div className={`rounded-2xl border p-5 ${darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'}`}>
                   <div className="mb-4">
                     <h3 className="text-lg font-black">Customer Contact</h3>
                     <p className="mt-1 text-sm font-bold opacity-50">Existing customers are reused by mobile number. New mobile numbers create a customer record for this booking.</p>
                   </div>
                   <div className="space-y-4">
                     <IndianPhoneField
                       label="Mobile Number"
                       value={checkoutCustomerPhone}
                       onChange={(value) => {
                         setCheckoutCustomerPhone(value)
                         setCheckoutCustomerError('')
                         if (checkoutFieldErrors.phone) {
                           setCheckoutFieldErrors((current) => ({ ...current, phone: getBookingPhoneError(value, true) }))
                         }
                       }}
                       required
                       error={checkoutFieldErrors.phone}
                     />
                     <Input
                       label="Customer Name"
                       value={checkoutCustomerName}
                       onChange={(value) => {
                         setCheckoutCustomerName(value)
                         setCheckoutCustomerError('')
                         if (checkoutFieldErrors.name) {
                           setCheckoutFieldErrors((current) => ({ ...current, name: getBookingNameError(value) }))
                         }
                       }}
                       placeholder="Enter customer name"
                       required
                       error={checkoutFieldErrors.name}
                     />
                     <Input
                       label="Email (optional)"
                       type="email"
                       value={checkoutCustomerEmail}
                       onChange={(value) => {
                         setCheckoutCustomerEmail(value)
                         if (checkoutFieldErrors.email) {
                           setCheckoutFieldErrors((current) => ({ ...current, email: getBookingEmailError(value) }))
                         }
                       }}
                       placeholder="customer@example.com"
                       error={checkoutFieldErrors.email}
                     />
                   </div>
                 </div>
               </div>

               <div className="space-y-6">
                 <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Summary</div>
                   <div className="space-y-2">
                     <div className="flex justify-between gap-4 text-sm font-bold"><span className="opacity-60">{bookingMode === 'ACTIVITY' ? 'Activity:' : 'Show:'}</span><span className="text-right">{toDisplayTitle(getSelectedTitle())}</span></div>
                     <div className="flex justify-between gap-4 text-sm font-bold"><span className="opacity-60">Admission:</span><span>{bookingMode === 'ACTIVITY' ? 'GENERAL' : 'Seats'}</span></div>
                     <div className="flex justify-between gap-4 text-sm font-bold"><span className="opacity-60">Tickets:</span><span>{getTicketQuantity()}</span></div>
                     <div className="flex justify-between font-bold"><span>Total:</span><span>Rs. {getTotalAmount()}</span></div>
                   </div>
                 </div>

               </div>
             </div>
             {checkoutCustomerError && (
               <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                 {checkoutCustomerError}
               </div>
             )}
             <div className="admin-modal-footer">
               <Button type="button" variant="secondary" onClick={() => setShowCustomerModal(false)}>
                 Cancel
               </Button>
               <Button
                 onClick={handleCustomerCheckout}
                 disabled={loading || submittingCustomer}
               >
                 {loading || submittingCustomer ? 'Processing...' : 'Confirm & Generate Tickets'}
               </Button>
             </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="admin-modal-overlay">
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="admin-modal-panel admin-modal-card w-full"
            style={{ maxWidth: 'min(760px, 94vw)' }}
          >
            <div className="admin-modal-header">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="admin-modal-title">Booking confirmed</h2>
                  <p className="admin-modal-subtitle">Tickets are generated and saved in ticket history.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowConfirmation(false)} className="admin-modal-close" aria-label="Close confirmation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Booking reference</p>
                    <p className="mt-2 break-all font-mono text-2xl font-black text-amber-600">
                      {bookingResult?.bookings?.[0] ? getBookingReference(bookingResult.bookings[0]) : 'Confirmed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total amount</p>
                    <p className="mt-2 text-2xl font-black">Rs. {bookingResult?.totalAmount ?? getTotalAmount()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tickets</p>
                    <p className="mt-2 text-lg font-black">{bookingResult?.tickets?.length || getTicketQuantity()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Admission</p>
                    <p className="mt-2 text-lg font-black">{bookingMode === 'ACTIVITY' ? 'GENERAL' : 'Reserved seats'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button variant="secondary" onClick={() => setShowConfirmation(false)}>New Booking</Button>
              <Button variant="secondary" onClick={handlePrintBookingResult}>
                <Printer className="h-4 w-4" />
                Print Ticket
              </Button>
              <Button onClick={() => window.location.href = '/admin/tickets'}>View Tickets</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Booking
