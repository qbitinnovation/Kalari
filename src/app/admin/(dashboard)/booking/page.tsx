"use client";

import React, { useState, useEffect } from 'react'
import { db, Show, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logBookingCreation } from '@/utils/activityLogger'
import { createBookingReference, createTicketCodes, getBookingReference, getRecordId, isActiveBookingReservation, isShowBookableAt, parseSeatCodes } from '@/lib/booking'
import {
  ARENA_TOP_LABEL,
  arrowForArenaSide,
  alignClassForArenaSide,
  groupSeatsByArenaSide,
  getSymmetricArenaSections,
  sideLabelForArenaSide,
  type ArenaSide,
} from '@/lib/arenaLayout'
import { CalendarDays, Clock, IndianRupee, Ticket, X } from 'lucide-react'
import { Button, DatePicker, Input } from '@/components/ui'
import { formatDisplayDateValue } from '@/components/ui/date-utils'
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

interface Agent {
  id: string
  _id?: string
  email: string
  role: string
  full_name: string
  commission_percentage?: number
  active: boolean
}

const recordId = getRecordId

const Booking: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([])
  const [allShows, setAllShows] = useState<Show[]>([])
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [seats, setSeats] = useState<SeatData[]>([])
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [eventTicketCount, setEventTicketCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [submittingCustomer, setSubmittingCustomer] = useState(false)
  const [checkoutCustomerPhone, setCheckoutCustomerPhone] = useState('')
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('')
  const [checkoutCustomerError, setCheckoutCustomerError] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const darkMode = useDarkMode()

  useEffect(() => {
    fetchActiveShows()
    fetchAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedShow) {
      fetchSeatsForShow(recordId(selectedShow))
      setSelectedSeats([])
      setEventTicketCount(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .in('status', ['ACTIVE', 'SHOW_STARTED'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')

      if (error) throw error
      
      const updatedShows = await checkAndUpdateShowStatuses(data || [])
      const activeShows = updatedShows.filter(show =>
        (show.status === 'ACTIVE' || show.status === 'SHOW_STARTED') && isShowBookableAt(show)
      )
      
      setAllShows(activeShows)
      setShows(activeShows)
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const fetchAgents = async () => {
    try {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('role', 'agent')
        .eq('active', true)
        .order('full_name')
      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const checkAndUpdateShowStatuses = async (shows: Show[]) => {
    const updatedShows = []
    for (const show of shows) {
      let updatedShow = { ...show }
      const showDateTime = new Date(`${show.date}T${show.time}`)
      const now = new Date()
      const thirtyMinutesAfterShow = new Date(showDateTime.getTime() + 30 * 60 * 1000)

      if (now > thirtyMinutesAfterShow && show.status !== 'SHOW_DONE') {
        try {
          await db.from('shows').update({ status: 'SHOW_DONE' }).eq('id', recordId(show))
          await db.from('tickets').update({ status: 'COMPLETED' }).eq('show_id', recordId(show)).in('status', ['ACTIVE'])
        } catch (error) { console.error(error) }
        updatedShow.status = 'SHOW_DONE'
      } 
      else if (now > showDateTime && now <= thirtyMinutesAfterShow && show.status === 'ACTIVE') {
        try {
          await db.from('shows').update({ status: 'SHOW_STARTED' }).eq('id', recordId(show))
        } catch (error) { console.error(error) }
        updatedShow.status = 'SHOW_STARTED'
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
      if (show?.type === 'EVENT') {
        setSeats([])
        return
      }
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

  const getTicketQuantity = () => selectedShow?.type === 'EVENT' ? eventTicketCount : selectedSeats.length

  const getTotalAmount = () => (selectedShow?.price || 100) * getTicketQuantity()

  const handleContinueBooking = () => {
    if (!selectedShow || getTicketQuantity() === 0) return
    if (!isShowBookableAt(selectedShow)) {
      alert('Booking is closed because this show time has passed.')
      setSelectedShow(null)
      fetchActiveShows()
      return
    }
    setCheckoutCustomerError('')
    setShowCustomerModal(true)
  }

  const findOrCreateCheckoutCustomer = async () => {
    const phone = checkoutCustomerPhone.trim()
    if (!/^[0-9+\s-]{10,}$/.test(phone)) {
      throw new Error('Enter a valid customer mobile number.')
    }

    const { data: existingCustomers, error: existingError } = await db.from('customers').select('*').eq('phone', phone)
    if (existingError) throw new Error(existingError.message || 'Could not check customer mobile number.')
    if (existingCustomers?.[0]) return existingCustomers[0] as Customer

    const now = new Date().toISOString()
    const { data: customers, error } = await db.from('customers').insert([{
      name: checkoutCustomerName.trim() || 'Walk-in Customer',
      phone,
      email: '',
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
      if (selectedShow.type === 'EVENT') {
        const bookedCount = activeBookings.reduce((count: number, booking: any) => count + parseSeatCodes(booking.seat_code).length, 0)
        const capacity = Number(selectedShow.capacity || 0)
        if (capacity > 0 && bookedCount + eventTicketCount > capacity) {
          alert(`Only ${Math.max(0, capacity - bookedCount)} tickets left. Please reduce the ticket count.`)
          return
        }
      } else {
        const allBookedSeats = activeBookings.flatMap(booking => {
          return parseSeatCodes(booking.seat_code)
        })
        const conflictingSeats = selectedSeats.filter(seat => allBookedSeats.includes(seat))
        if (conflictingSeats.length > 0) {
          alert(`Some seats are already booked. Please refresh and try again.`)
          fetchSeatsForShow(recordId(selectedShow))
          return
        }
      }

      const linkedAgentId = selectedShow.type === 'EVENT' ? selectedShow.agent_id || '' : ''
      const agent = agents.find(a => recordId(a) === linkedAgentId)
      const commissionAmount = agent ? (getTotalAmount() * (agent.commission_percentage || 0)) / 100 : 0
      const bookingReference = createBookingReference()
      const seatCodesToSave = selectedShow.type === 'EVENT'
        ? Array.from({ length: eventTicketCount }).map(() => 'GENERAL')
        : selectedSeats
      const generatedTicketCodes = createTicketCodes(seatCodesToSave.length)

      const bookingToInsert = {
        booking_reference: bookingReference,
        show_id: recordId(selectedShow),
        seat_code: JSON.stringify(seatCodesToSave),
        booked_by: customer.name,
        customer_id: recordId(customer),
        agent_id: linkedAgentId || null,
        commission_amount: commissionAmount,
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
        booking_reference: getBookingReference(booking), seat_codes: seatCodesToSave, total_price: getTotalAmount(), agent_name: agent?.full_name
      })

      setBookingResult({ bookings, tickets, success: true, totalAmount: getTotalAmount() })
      setShowConfirmation(true)
      setShowCustomerModal(false)
      setCheckoutCustomerPhone('')
      setCheckoutCustomerName('')
      setSelectedSeats([])
      setEventTicketCount(1)
      if (selectedShow.type === 'KALARI') fetchSeatsForShow(recordId(selectedShow))
    } catch (error: any) { alert(`Error: ${error.message}`) } finally { setLoading(false) }
  }

  const handleCustomerCheckout = async () => {
    setSubmittingCustomer(true)
    setCheckoutCustomerError('')
    try {
      const customer = await findOrCreateCheckoutCustomer()
      await handleBookSeats(customer)
    } catch (error: any) {
      setCheckoutCustomerError(error.message || 'Could not complete booking.')
    } finally {
      setSubmittingCustomer(false)
    }
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

  return (
    <div className={darkMode ? 'text-slate-100' : 'text-slate-900'}>
      <div className="w-full space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-black tracking-tight">Book Tickets</h1>
            <p className="max-w-2xl font-medium opacity-60">Manage Kalari seat bookings and general event tickets</p>
          </div>
          <div className="w-full max-w-sm lg:pt-1">
            <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50">
              <CalendarDays className="h-4 w-4" />
              Select Date
            </label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="Select date"
              triggerClassName={`font-bold ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            />
          </div>
        </header>

        <section className="space-y-6">
          {/* Left Column: Show Selection */}
          <div className="space-y-6">
            <div className={`hidden rounded-2xl border p-4 shadow-sm sm:p-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                Select Date
              </h2>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Select date"
                triggerClassName={`font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {getAvailableDates().map(d => (
                   <button key={d} onClick={() => setSelectedDate(d)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedDate === d ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                     {formatDisplayDateValue(d)}
                   </button>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                Available Shows
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {shows.map(show => (
                  <button
                    key={recordId(show)}
                    onClick={() => setSelectedShow(show)}
                    className={`flex min-h-[190px] w-full flex-col rounded-2xl border-2 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${selectedShow && recordId(selectedShow) === recordId(show) ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10' : darkMode ? 'border-slate-800 bg-slate-800/50 hover:border-slate-700' : 'border-slate-100 bg-slate-50 hover:border-amber-200'}`}
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${show.type === 'EVENT' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                        {show.type === 'EVENT' ? 'Event Tickets' : 'Kalari Seating'}
                      </span>
                      {selectedShow && recordId(selectedShow) === recordId(show) && (
                        <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">Selected</span>
                      )}
                    </div>
                    <div className="text-lg font-black leading-tight">{toDisplayTitle(show.title)}</div>
                    <div className="mt-4 space-y-2 text-sm font-bold opacity-60">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        {formatDisplayDateValue(show.date)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        {show.time}
                      </div>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <span className="flex items-center gap-1 text-xl font-black text-amber-600">
                        <IndianRupee className="h-4 w-4" />
                        {show.price}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest opacity-50">
                        <Ticket className="h-4 w-4" />
                        {show.type === 'EVENT' ? `Limit ${show.capacity || 0}` : 'Seats'}
                      </span>
                    </div>
                  </button>
                ))}
                {shows.length === 0 && <div className="py-12 text-center opacity-30 font-bold">No shows found</div>}
              </div>
            </div>
          </div>

          {/* Right Column: Seating Plan */}
          <div className="lg:col-span-2">
            {selectedShow ? (
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
                        <div className="text-2xl font-black text-amber-600">₹{getTotalAmount()}</div>
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
                  ) : selectedShow.type === 'EVENT' ? (
                    <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="mb-5">
                        <h3 className="text-xl font-black">General admission tickets</h3>
                        <p className="mt-1 text-sm font-bold opacity-50">No seat selection is needed for this event. Select the number of tickets to issue.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setEventTicketCount(Math.max(1, eventTicketCount - 1))} className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-black ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>-</button>
                        <div className="min-w-24 text-center">
                          <div className="text-3xl font-black text-amber-600">{eventTicketCount}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Tickets</div>
                        </div>
                        <button onClick={() => setEventTicketCount(Math.min(Number(selectedShow.capacity || 9999), eventTicketCount + 1))} className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-black ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>+</button>
                      </div>
                      <div className="mt-5 text-sm font-bold opacity-60">Ticket limit: {selectedShow.capacity || 'Unlimited'}</div>
                    </div>
                  ) : renderRectangularSeatMap()}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 opacity-20 dark:border-slate-800">
                <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                <div className="text-xl font-black uppercase tracking-widest">Select a show to begin</div>
              </div>
            )}
          </div>
        </section>
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
                     <Input
                       label="Mobile Number"
                       type="tel"
                       value={checkoutCustomerPhone}
                       onChange={(phone) => {
                         setCheckoutCustomerPhone(phone)
                         setCheckoutCustomerError('')
                       }}
                       placeholder="+91 98765 43210"
                       required
                       error={checkoutCustomerError}
                     />
                     <Input
                       label="Customer Name (optional for new mobile)"
                       value={checkoutCustomerName}
                       onChange={setCheckoutCustomerName}
                       placeholder="Walk-in Customer"
                     />
                   </div>
                 </div>
               </div>

               <div className="space-y-6">
                 <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Summary</div>
                   <div className="space-y-2">
                     <div className="flex justify-between gap-4 text-sm font-bold"><span className="opacity-60">Show:</span><span className="text-right">{toDisplayTitle(selectedShow?.title)}</span></div>
                     <div className="flex justify-between gap-4 text-sm font-bold"><span className="opacity-60">Tickets:</span><span>{getTicketQuantity()}</span></div>
                     <div className="flex justify-between font-bold"><span>Total:</span><span>₹{getTotalAmount()}</span></div>
                   </div>
                 </div>

               </div>
             </div>
             <div className="admin-modal-footer">
               <Button type="button" variant="secondary" onClick={() => setShowCustomerModal(false)}>
                 Cancel
               </Button>
               <Button
                 onClick={handleCustomerCheckout}
                 disabled={!checkoutCustomerPhone.trim() || loading || submittingCustomer}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="admin-modal-panel admin-modal-card text-center">
             <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h2 className="text-3xl font-black mb-2">Booking Success!</h2>
             <p className="opacity-60 font-medium mb-10">Tickets have been generated and recorded in the system.</p>
             {bookingResult?.bookings?.[0] && (
               <div className="mb-8 rounded-2xl bg-amber-50 px-4 py-3 font-mono text-sm font-black text-amber-800">
                 {getBookingReference(bookingResult.bookings[0])}
               </div>
             )}
             <div className="admin-modal-footer">
               <Button variant="secondary" onClick={() => setShowConfirmation(false)}>New Booking</Button>
               <Button onClick={() => window.location.href = '/admin/tickets'}>View All Tickets</Button>
             </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Booking
