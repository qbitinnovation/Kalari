"use client";

import React, { useState, useEffect } from 'react'
import { db, Show, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logBookingCreation } from '@/utils/activityLogger'
import { createTicketCode, getRecordId, parseSeatCodes } from '@/lib/booking'
import {
  ARENA_TOP_LABEL,
  arrowForArenaSide,
  alignClassForArenaSide,
  groupSeatsByArenaSide,
  type ArenaSide,
} from '@/lib/arenaLayout'
import { useAuth } from '@/contexts/AuthContext'

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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [submittingCustomer, setSubmittingCustomer] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const darkMode = useDarkMode()
  const { user } = useAuth()

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm)
  )

  useEffect(() => {
    fetchActiveShows()
    fetchCustomers()
    fetchAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedShow) {
      fetchSeatsForShow(recordId(selectedShow))
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
        .eq('type', 'KALARI')
        .in('status', ['ACTIVE', 'SHOW_STARTED'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')

      if (error) throw error
      
      const updatedShows = await checkAndUpdateShowStatuses(data || [])
      const activeShows = updatedShows.filter(show => show.status === 'ACTIVE' || show.status === 'SHOW_STARTED')
      
      setAllShows(activeShows)
      setShows(activeShows)
    } catch (error) {
      console.error('Error fetching shows:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await db.from('customers').select('*').order('name')
      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
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
      if (user?.role === 'agent') {
        const self = (data || []).find((agent: Agent) => recordId(agent) === user.id || agent.email === user.email)
        if (self) setSelectedAgentId(recordId(self))
      }
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
      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', recordId(show)).eq('status', 'CONFIRMED')
      const bookedSeatsCount = bookings?.reduce((count, booking) => {
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
      if (!show?.layout) return
      const generatedSeats: SeatData[] = []

      show.layout.structure.sections?.forEach((section: any) => {
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

      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', showId).eq('status', 'CONFIRMED')
      const bookedSeats = new Set<string>()
      bookings?.forEach(booking => {
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

  const getTotalAmount = () => (selectedShow?.price || 100) * selectedSeats.length

  const handleContinueBooking = () => {
    if (!selectedShow || selectedSeats.length === 0) return
    setShowCustomerModal(true)
  }

  const handleBookSeats = async () => {
    if (!selectedShow || selectedSeats.length === 0 || !selectedCustomer) return
    try {
      setLoading(true)
      const { data: existingBookings } = await db.from('bookings').select('seat_code').eq('show_id', recordId(selectedShow)).eq('status', 'CONFIRMED')
      const allBookedSeats = existingBookings?.flatMap(booking => {
        return parseSeatCodes(booking.seat_code)
      }) || []
      const conflictingSeats = selectedSeats.filter(seat => allBookedSeats.includes(seat))
      if (conflictingSeats.length > 0) {
        alert(`Some seats are already booked. Please refresh and try again.`)
        fetchSeatsForShow(recordId(selectedShow))
        return
      }

      const agent = agents.find(a => recordId(a) === selectedAgentId)
      const commissionAmount = agent ? (getTotalAmount() * (agent.commission_percentage || 0)) / 100 : 0

      const bookingToInsert = {
        show_id: recordId(selectedShow),
        seat_code: JSON.stringify(selectedSeats),
        booked_by: selectedCustomer.name,
        customer_id: selectedCustomer.id,
        agent_id: selectedAgentId || null,
        commission_amount: commissionAmount,
        payment_method: 'COUNTER',
        payment_status: 'PAID',
        total_amount: getTotalAmount(),
        booking_time: new Date().toISOString(),
        status: 'CONFIRMED'
      }

      const { data: bookings, error: bookingError } = await db.from('bookings').insert([bookingToInsert]).select()
      if (bookingError) throw bookingError
      const booking = bookings[0]

      const ticketsToInsert = selectedSeats.map(seatCode => ({
        booking_id: booking.id, show_id: recordId(selectedShow), seat_code: seatCode,
        ticket_code: createTicketCode(),
        price: selectedShow.price || 100, generated_by: 'admin', generated_at: new Date().toISOString(), status: 'ACTIVE'
      }))

      const { data: tickets, error: ticketError } = await db.from('tickets').insert(ticketsToInsert).select()
      if (ticketError) throw ticketError

      const { data: { user } } = await db.auth.getUser()
      await logBookingCreation(booking.id, selectedShow.title, user?.email || 'unknown', {
        seat_codes: selectedSeats, total_price: getTotalAmount(), agent_name: agent?.full_name
      })

      setBookingResult({ bookings, tickets, success: true, totalAmount: getTotalAmount() })
      setShowConfirmation(true)
      setSelectedSeats([])
      fetchSeatsForShow(recordId(selectedShow))
    } catch (error: any) { alert(`Error: ${error.message}`) } finally { setLoading(false) }
  }

  const handleCustomerSelection = async () => {
    if (!selectedCustomer) return
    setShowCustomerModal(false)
    await handleBookSeats()
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
    const borderTone =
      side === 'top' ? 'border-blue-500/30' : side === 'right' ? 'border-purple-500/30' : side === 'bottom' ? 'border-orange-500/30' : 'border-emerald-500/30'
    return (
      <div className={`rounded-2xl border-2 border-dashed p-4 ${borderTone}`}>
        {side === 'top' && (
          <div className="mb-4 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            <span>{ARENA_TOP_LABEL}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{arrowForArenaSide(side)}</span>
          </div>
        )}
        <div className="space-y-2">
          {rows.map((rowSeats, index) => (
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

    return (
      <div className="min-w-[620px] space-y-5 rounded-3xl bg-slate-50 p-5 dark:bg-slate-950/40">
        {renderArenaSide(arenaGroups.top, 'top')}
        <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-5">
          <div className="w-full">{renderArenaSide(arenaGroups.left, 'left')}</div>
          <div className={`flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-slate-500/20 shadow-inner ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
             <div className="text-center text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Kalari<br/>Performance</div>
          </div>
          <div className="w-full">{renderArenaSide(arenaGroups.right, 'right')}</div>
        </div>
        {renderArenaSide(arenaGroups.bottom, 'bottom')}
      </div>
    )
  }

  return (
    <div className={darkMode ? 'text-slate-100' : 'text-slate-900'}>
      <div className="w-full">
        <header className="mb-6">
          <h1 className="text-4xl font-black tracking-tight mb-2">Book Seats</h1>
          <p className="opacity-60 font-medium">Manage bookings and issue tickets for Kalari Arena</p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Show Selection */}
          <div className="space-y-6 lg:col-span-1">
            <div className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                Select Date
              </h2>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full p-4 rounded-2xl border font-bold outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 focus:border-amber-500' : 'bg-slate-50 border-slate-200 focus:border-amber-500'}`}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {getAvailableDates().map(d => (
                   <button key={d} onClick={() => setSelectedDate(d)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedDate === d ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}>
                     {format(new Date(d), 'MMM dd')}
                   </button>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                Available Shows
              </h2>
              <div className="space-y-3">
                {shows.map(show => (
                  <button
                    key={recordId(show)}
                    onClick={() => setSelectedShow(show)}
                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${selectedShow?.id === show.id ? 'border-amber-500 bg-amber-500/5 shadow-lg' : darkMode ? 'border-slate-800 bg-slate-800/50 hover:border-slate-700' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                  >
                    <div className="font-black text-lg leading-tight mb-1">{show.title}</div>
                    <div className="text-xs font-bold opacity-50 uppercase tracking-widest">{format(new Date(show.date), 'EEE, MMM dd')} • {show.time}</div>
                    <div className="mt-2 text-amber-600 font-black">₹{show.price}</div>
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
                    <h2 className="text-2xl font-black">{selectedShow.title}</h2>
                    <p className="text-sm font-bold opacity-40 uppercase tracking-widest">{format(new Date(selectedShow.date), 'PPPP')} @ {selectedShow.time}</p>
                  </div>
                  {selectedSeats.length > 0 && (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Amount</div>
                        <div className="text-2xl font-black text-amber-600">₹{getTotalAmount()}</div>
                      </div>
                      <button onClick={handleContinueBooking} className="bg-amber-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 active:scale-95 transition-all">
                        Checkout ({selectedSeats.length})
                      </button>
                    </motion.div>
                  )}
                </div>

                <div className="overflow-x-auto pb-8">
                  {loading ? <div className="h-96 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div></div> : renderRectangularSeatMap()}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowCustomerModal(false)} />
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`relative w-full max-w-2xl p-8 rounded-[3rem] border shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
             <h2 className="text-3xl font-black mb-8">Complete Booking</h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Customer Selection</label>
                   <input type="text" placeholder="Search customer..." value={customerSearchTerm} onChange={e => setCustomerSearchTerm(e.target.value)} className={`w-full p-4 rounded-2xl border font-bold outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                   <div className="mt-3 max-h-48 overflow-y-auto space-y-1 rounded-2xl border p-2 dark:border-slate-800">
                     {filteredCustomers.map(c => (
                       <button key={c.id} onClick={() => setSelectedCustomer(c)} className={`w-full p-3 rounded-xl text-left text-sm font-bold transition-all ${selectedCustomer?.id === c.id ? 'bg-amber-500 text-white' : darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                         {c.name} <span className="opacity-60 text-[10px] ml-2">{c.phone}</span>
                       </button>
                     ))}
                   </div>
                 </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Agent (Optional)</label>
                   {user?.role === 'agent' ? (
                     <div className={`w-full p-4 rounded-2xl border font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                       {agents.find(a => recordId(a) === selectedAgentId)?.full_name || user.email}
                     </div>
                   ) : (
                     <select 
                       value={selectedAgentId} 
                       onChange={e => setSelectedAgentId(e.target.value)}
                       className={`w-full p-4 rounded-2xl border font-bold outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                     >
                       <option value="">No Agent</option>
                       {agents.map(a => (
                         <option key={recordId(a)} value={recordId(a)}>{a.full_name} ({a.commission_percentage}%)</option>
                       ))}
                     </select>
                   )}
                 </div>

                 <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Summary</div>
                   <div className="space-y-2">
                     <div className="flex justify-between font-bold"><span>Total:</span><span>₹{getTotalAmount()}</span></div>
                     {selectedAgentId && (
                       <div className="flex justify-between text-xs font-bold text-amber-600">
                         <span>Agent Comm.:</span>
                         <span>₹{(getTotalAmount() * (agents.find(a => recordId(a) === selectedAgentId)?.commission_percentage || 0) / 100).toFixed(2)}</span>
                       </div>
                     )}
                   </div>
                 </div>

                 <button
                   onClick={handleCustomerSelection}
                   disabled={!selectedCustomer || loading}
                   className="w-full bg-amber-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 disabled:opacity-50 transition-all"
                 >
                   {loading ? 'Processing...' : 'Confirm & Generate Tickets'}
                 </button>
               </div>
             </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`relative w-full max-w-md p-10 rounded-[3rem] text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
             <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h2 className="text-3xl font-black mb-2">Booking Success!</h2>
             <p className="opacity-60 font-medium mb-10">Tickets have been generated and recorded in the system.</p>
             <div className="space-y-4">
               <button onClick={() => window.location.href = '/admin/tickets'} className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all">View All Tickets</button>
               <button onClick={() => setShowConfirmation(false)} className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest opacity-40 hover:opacity-60 transition-all">New Booking</button>
             </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Booking
