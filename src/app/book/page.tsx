"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  ShieldCheck,
  Ticket,
  User,
  WalletCards,
} from 'lucide-react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { db } from '@/lib/database'
import { Input } from '@/components/ui'
import {
  ARENA_TOP_LABEL,
  arrowForArenaSide,
  alignClassForArenaSide,
  groupSeatsByArenaSide,
  getSymmetricArenaSections,
  sideLabelForArenaSide,
  type ArenaSide,
} from '@/lib/arenaLayout'
import { createBookingReference, createTicketCode, getAvailabilityLabel, getRecordId, parseSeatCodes } from '@/lib/booking'

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ''

declare global {
  interface Window {
    Razorpay?: any
  }
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

interface Show {
  id: string
  _id?: string
  title: string
  date: string
  time: string
  price: number
  image?: string
  description?: string
  status: string
  booked_count?: number
  available_count?: number
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT"
  layout?: { structure: any }
  type?: 'KALARI' | 'EVENT'
  capacity?: number
}

interface SeatOption {
  id: string
  label: string
  row: string
  section: string
}

interface BookingForm {
  name: string
  phone: string
  email: string
}

type PaymentMethod = 'razorpay' | 'cod'
type Step = 'show' | 'seats' | 'details' | 'payment' | 'success'

const stepLabels: { id: Step; label: string }[] = [
  { id: 'show', label: 'Show' },
  { id: 'seats', label: 'Seats' },
  { id: 'details', label: 'Guest' },
  { id: 'payment', label: 'Payment' },
]

const fallbackBookingImage = 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1800&q=88'

const BookingContent: React.FC = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedShowId = searchParams.get('show')
  const preselectedActivityId = searchParams.get('activity')
  const preselectedDate = searchParams.get('date') || ''
  const [shows, setShows] = useState<Show[]>([])
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set())
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [eventTicketCount, setEventTicketCount] = useState<number>(1)
  const [step, setStep] = useState<Step>('show')
  const [form, setForm] = useState<BookingForm>({ name: '', phone: '', email: '' })
  const [errors, setErrors] = useState<Partial<BookingForm>>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [bookingReference, setBookingReference] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'COD_PENDING'>('PAID')
  const [ticketCodes, setTicketCodes] = useState<string[]>([])
  const [showsLoading, setShowsLoading] = useState(true)

  useEffect(() => {
    fetchShows()
  }, [])

  useEffect(() => {
    if (selectedShow) fetchBookedSeats(getRecordId(selectedShow))
  }, [selectedShow])

  useEffect(() => {
    if (preselectedShowId && shows.length > 0) {
      const show = shows.find(item => getRecordId(item) === preselectedShowId)
      if (show) {
        setSelectedShow(show)
        setSelectedSeats([])
        setEventTicketCount(1)
        setStep('seats')
      }
    }
  }, [preselectedShowId, shows])

  const fetchShows = async () => {
    setShowsLoading(true)
    let query = db
      .from('shows')
      .select('*, layout:layouts(*)')
      .in('status', ['ACTIVE'])
      .gte('date', new Date().toISOString().split('T')[0])

    if (!preselectedActivityId) {
      query = query.eq('type', 'KALARI')
    }

    const { data, error } = await query
      .order('date', { ascending: true })

    if (error) setNotice(error.message || 'Unable to load shows.')
    setShows(data || [])
    setShowsLoading(false)
  }

  const fetchBookedSeats = async (showId: string) => {
    const { data } = await db
      .from('bookings')
      .select('seat_code')
      .eq('show_id', showId)
      .eq('status', 'CONFIRMED')

    const nextBooked = new Set<string>()
    data?.forEach((booking: any) => {
      parseSeatCodes(booking.seat_code).forEach(seat => nextBooked.add(seat))
    })
    setBookedSeats(nextBooked)
  }

  const seats = useMemo<SeatOption[]>(() => {
    if (!selectedShow?.layout?.structure?.sections) return []
    const generated: SeatOption[] = []

    getSymmetricArenaSections(selectedShow.layout.structure.sections).forEach((section: any) => {
      const sectionName = String(section.name || 'Main')
      const prefix = sectionName.charAt(0).toUpperCase()

      if (Array.isArray(section.rows)) {
        section.rows.forEach((row: any, rowIndex: number) => {
          const rowLetter = String.fromCharCode(65 + rowIndex)
          for (let index = 1; index <= Number(row.seats || 0); index += 1) {
            generated.push({ id: `${sectionName}-${rowLetter}-${index}`, label: `${prefix}${rowLetter}${index}`, row: rowLetter, section: sectionName })
          }
        })
        return
      }

      for (let rowIndex = 1; rowIndex <= Number(section.rows || 0); rowIndex += 1) {
        const rowLetter = String.fromCharCode(64 + rowIndex)
        for (let index = 1; index <= Number(section.seatsPerRow || 0); index += 1) {
          generated.push({ id: `${sectionName}-${rowLetter}-${index}`, label: `${prefix}${rowLetter}${index}`, row: rowLetter, section: sectionName })
        }
      }
    })

    return generated
  }, [selectedShow])

  const sectionNames = Array.from(new Set(seats.map(seat => seat.section)))
  const totalTickets = selectedShow?.type === 'EVENT' ? eventTicketCount : selectedSeats.length
  const selectedSeatLabels = selectedShow?.type === 'EVENT' ? `${eventTicketCount} ticket(s)` : selectedSeats.map(id => seats.find(seat => seat.id === id)?.label || id).join(', ')
  const totalAmount = selectedShow ? totalTickets * Number(selectedShow.price || 0) : 0
  const activeIndex = stepLabels.findIndex(item => item.id === step)
  const bookingImages = (shows.map(show => show.image).filter(Boolean) as string[]).slice(0, 3)
  const heroImage = selectedShow?.image || bookingImages[0] || fallbackBookingImage

  const toggleSeat = (seatId: string) => {
    if (bookedSeats.has(seatId)) return
    setSelectedSeats(current => current.includes(seatId) ? current.filter(id => id !== seatId) : [...current, seatId])
  }

  const getRowsForSection = (section: string) => {
    return seats.filter(seat => seat.section === section).reduce<Record<string, SeatOption[]>>((grouped, seat) => {
      grouped[seat.row] = grouped[seat.row] || []
      grouped[seat.row].push(seat)
      return grouped
    }, {})
  }

  const renderSeatButton = (seat: SeatOption) => {
    const blockedSeats = selectedShow?.layout?.structure?.blockedSeats || []
    const isBooked = bookedSeats.has(seat.id) || blockedSeats.includes(seat.id)
    const isSelected = selectedSeats.includes(seat.id)
    return (
      <button
        key={seat.id}
        onClick={() => toggleSeat(seat.id)}
        disabled={isBooked}
        className={`h-8 w-9 rounded-lg border text-[10px] font-bold transition ${isBooked ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-300' : isSelected ? 'border-amber-500 bg-amber-400 text-stone-950 shadow-md' : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-500 hover:bg-emerald-50'}`}
      >
        {seat.label}
      </button>
    )
  }

  const arenaSeatGroups = useMemo(
    () => groupSeatsByArenaSide(seats, getRowsForSection),
    [seats]
  )

  const renderGuestSeatGroup = (rows: SeatOption[][], side: ArenaSide) => {
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
          <div key={`${side}-${rowSeats[0]?.row || rowIndex}`} className="flex flex-col items-center gap-2">
            <span className="text-center text-xs font-bold text-stone-400">
              {rowSeats[0]?.row || String.fromCharCode(65 + rowIndex)}
            </span>
            {Array.from({ length: maxSeatsInSide }, (_, seatIndex) => {
              const seat = rowSeats[seatIndex]
              return seat ? renderSeatButton(seat) : <span key={`${side}-${rowIndex}-${seatIndex}`} className="h-8 w-9" />
            })}
          </div>
        ))}
      </div>
    )

    return (
      <div className="rounded-lg border border-stone-200 bg-white/80 p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-500">{sideLabelForArenaSide(side)}</h3>
          <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-black text-stone-600 ring-1 ring-stone-200">
            {arrowForArenaSide(side)}
          </span>
        </div>
        <div className="overflow-x-auto pb-1">
          {isSide ? renderSideColumns() : (
            <div className="mx-auto min-w-max space-y-2">
              {rows.map((rowSeats, index) => (
              <div
                key={`${side}-${rowSeats[0]?.row || index}`}
                className={`flex items-center gap-2 ${alignClassForArenaSide(side)}`}
              >
                <span className="w-6 shrink-0 text-center text-xs font-bold text-stone-400">
                  {rowSeats[0]?.row || String.fromCharCode(65 + index)}
                </span>
                {rowSeats.map(renderSeatButton)}
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderGuestKalariSeatMap = () => {
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
        <div className="text-center text-xs font-black uppercase tracking-widest text-stone-500">Ankathattu</div>
      </div>
    )

    return (
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-950">Kalari arena seating</h3>
            <p className="mt-1 text-sm font-medium text-stone-500">{ARENA_TOP_LABEL} performance square.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-white px-3 py-1 text-stone-600 ring-1 ring-stone-200">Available</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Selected</span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-500">Booked</span>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1040px] space-y-5 rounded-lg bg-[#f7f3eb] p-5 ring-1 ring-stone-200">
            <div>{renderGuestSeatGroup(arenaSeatGroups.top, 'top')}</div>
            <div className="grid grid-cols-[260px_430px_260px] items-center justify-center gap-5">
              <div className="self-stretch">{renderGuestSeatGroup(arenaSeatGroups.left, 'left')}</div>
              {renderArenaCenter()}
              <div className="self-stretch">{renderGuestSeatGroup(arenaSeatGroups.right, 'right')}</div>
            </div>
            <div>{renderGuestSeatGroup(arenaSeatGroups.bottom, 'bottom')}</div>
          </div>
        </div>
      </div>
    )
  }

  const validateDetails = () => {
    const nextErrors: Partial<BookingForm> = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.phone.trim()) nextErrors.phone = 'Phone is required.'
    else if (!/^[0-9+\s-]{10,}$/.test(form.phone)) nextErrors.phone = 'Enter a valid phone number.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const getUnavailableSeats = async () => {
    if (!selectedShow) return new Set<string>()
    const { data } = await db
      .from('bookings')
      .select('seat_code')
      .eq('show_id', getRecordId(selectedShow))
      .eq('status', 'CONFIRMED')

    const unavailable = new Set<string>()
    data?.forEach((booking: any) => {
      parseSeatCodes(booking.seat_code).forEach(seat => unavailable.add(seat))
    })
    setBookedSeats(unavailable)
    return unavailable
  }

  const verifySeatAvailability = async () => {
    if (!selectedShow) return false
    const unavailable = await getUnavailableSeats()
    
    if (selectedShow.type === 'EVENT') {
      const bookedCount = unavailable.size
      const capacity = selectedShow.capacity || 1000
      if (bookedCount + eventTicketCount > capacity) {
        setNotice(`Only ${Math.max(0, capacity - bookedCount)} tickets left. Please reduce your quantity.`)
        return false
      }
      return true
    }

    const conflicts = selectedSeats.filter(seat => unavailable.has(seat))
    if (conflicts.length) {
      setNotice(`These seats were just booked: ${conflicts.join(', ')}. Choose another seat.`)
      setSelectedSeats(current => current.filter(seat => !unavailable.has(seat)))
      return false
    }
    return true
  }

  const findOrCreateCustomer = async () => {
    const { data: existingCustomers } = await db.from('customers').select('*').eq('phone', form.phone.trim())
    if (existingCustomers?.[0]) return getRecordId(existingCustomers[0])

    const now = new Date().toISOString()
    const { data: customers, error } = await db.from('customers').insert([{
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      created_at: now,
      updated_at: now,
    }])

    if (error || !customers?.[0]) throw new Error(error?.message || 'Could not create customer.')
    return getRecordId(customers[0])
  }

  const saveBooking = async (paymentId: string, method: PaymentMethod, status: 'PAID' | 'COD_PENDING', razorpayOrderId?: string) => {
    if (!selectedShow) throw new Error('No show selected.')
    if (!(await verifySeatAvailability())) throw new Error('Selected seats are no longer available.')

    const customerId = await findOrCreateCustomer()
    const now = new Date().toISOString()
    const bookingReference = createBookingReference(new Date(now))
    
    let seatCodesToSave = selectedSeats
    if (selectedShow.type === 'EVENT') {
      seatCodesToSave = Array.from({ length: eventTicketCount }).map((_, i) => `EVT-${Date.now()}-${i + 1}`)
    }

    const { data: bookings, error: bookingError } = await db.from('bookings').insert([{
      booking_reference: bookingReference,
      show_id: getRecordId(selectedShow),
      seat_code: JSON.stringify(seatCodesToSave),
      booked_by: form.name.trim(),
      customer_id: customerId,
      booking_time: now,
      status: 'CONFIRMED',
      payment_id: paymentId,
      razorpay_payment_id: method === 'razorpay' ? paymentId : null,
      razorpay_order_id: razorpayOrderId || null,
      payment_method: method === 'cod' ? 'COD' : 'RAZORPAY',
      payment_status: status,
      total_amount: totalAmount,
      cancellation_status: 'NONE',
    }])

    if (bookingError || !bookings?.[0]) throw new Error(bookingError?.message || 'Booking could not be saved.')
    const savedBookingId = getRecordId(bookings[0])

    const generatedTickets = seatCodesToSave.map(seatCode => ({
      booking_id: savedBookingId,
      show_id: getRecordId(selectedShow),
      seat_code: seatCode,
      ticket_code: createTicketCode(),
      price: Number(selectedShow.price || 0),
      generated_by: form.name.trim(),
      generated_at: now,
      status: 'ACTIVE',
    }))

    const { error: ticketError } = await db.from('tickets').insert(generatedTickets)

    if (ticketError) throw new Error(ticketError.message || 'Tickets could not be created.')
    setBookingId(savedBookingId)
    setBookingReference(bookingReference)
    setTicketCodes(generatedTickets.map(ticket => ticket.ticket_code))
    setPaymentStatus(status)
    setStep('success')
  }

  const payWithRazorpay = async () => {
    if (!selectedShow || !validateDetails()) return
    if (!RAZORPAY_KEY_ID) {
      setNotice('Razorpay key is missing. Add NEXT_PUBLIC_RAZORPAY_KEY_ID or choose COD.')
      return
    }

    setLoading(true)
    setNotice('')
    try {
      if (!(await verifySeatAvailability())) return
      if (!(await loadRazorpayScript())) throw new Error('Could not load Razorpay checkout.')

      const orderResponse = await fetch(`/api/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount, currency: 'INR', receipt: `booking_${Date.now()}` }),
      })
      const orderPayload = await orderResponse.json().catch(() => ({}))
      if (!orderResponse.ok || !orderPayload.data?.id) throw new Error(orderPayload.error || 'Could not create Razorpay order.')

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: RAZORPAY_KEY_ID,
          amount: orderPayload.data.amount,
          currency: orderPayload.data.currency,
          name: 'Experience Booking',
          description: `${selectedShow.title} - ${selectedShow.type === 'EVENT' ? eventTicketCount : selectedSeats.length} ticket(s)`,
          order_id: orderPayload.data.id,
          prefill: { name: form.name.trim(), email: form.email.trim(), contact: form.phone.trim() },
          theme: { color: '#f59e0b' },
          handler: async (response: any) => {
            try {
              const verifyResponse = await fetch(`/api/payment/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response),
              })
              const verifyPayload = await verifyResponse.json().catch(() => ({}))
              if (!verifyResponse.ok || !verifyPayload.data?.valid) return reject(new Error(verifyPayload.error || 'Payment verification failed.'))
              await saveBooking(response.razorpay_payment_id, 'razorpay', 'PAID', response.razorpay_order_id)
              resolve()
            } catch (error) {
              reject(error)
            }
          },
          modal: { confirm_close: true, ondismiss: () => reject(new Error('Payment cancelled.')) },
        })
        checkout.open()
      })
    } catch (error: any) {
      if (error?.message !== 'Payment cancelled.') setNotice(error?.message || 'Payment failed.')
    } finally {
      setLoading(false)
    }
  }

  const reserveWithCod = async () => {
    if (!selectedShow || !validateDetails()) return
    setLoading(true)
    setNotice('')
    try {
      await saveBooking(`COD-${Date.now()}`, 'cod', 'COD_PENDING')
    } catch (error: any) {
      setNotice(error?.message || 'Could not reserve tickets with COD.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-stone-950 text-stone-950">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[minmax(420px,42vw)_1fr]">
        <section className="sticky top-0 hidden h-screen overflow-hidden lg:block">
          <img src={heroImage} alt="Kalary booking" className="absolute inset-0 h-full w-full object-cover object-[50%_68%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Pay online or at the venue
            </div>
            <h1 className="max-w-xl text-6xl font-bold leading-tight">Book Experiences</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-stone-200">
              One fast checkout for travellers: choose experience, select tickets, confirm payment, show ticket at venue.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {(bookingImages.length ? bookingImages : [heroImage]).map((image, index) => (
                <img key={`${image}-${index}`} src={image} alt={`booking view ${index + 1}`} className="h-28 w-full rounded-lg object-cover object-[50%_68%]" />
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-x-hidden bg-[#f7f3eb] lg:h-screen lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl min-w-0 px-4 py-5 sm:px-6 lg:px-10">
            <div className="mb-5 overflow-hidden rounded-lg bg-stone-950 text-white lg:hidden">
              <img src={heroImage} alt="Kalary booking" className="h-56 w-full object-cover object-[50%_68%] opacity-80" />
              <div className="p-5">
                <h1 className="text-3xl font-bold">Book Experiences</h1>
                <p className="mt-2 text-sm leading-6 text-stone-300">Reserve your spot now and choose how you want to pay.</p>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">Kovalam, Kerala</p>
                <h2 className="text-3xl font-bold text-stone-950">Book your experience</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-bold text-stone-700 shadow-sm">
                <Ticket className="h-4 w-4 text-amber-600" />
                Instant ticket
              </div>
            </div>

            <div className="mb-5 grid w-full grid-cols-2 gap-2 overflow-hidden rounded-lg bg-white p-2 shadow-sm sm:grid-cols-4">
              {stepLabels.map((item, index) => {
                const done = activeIndex > index || step === 'success'
                const active = activeIndex === index
                return (
                  <div key={item.id} className={`min-w-0 rounded-lg px-1.5 py-3 text-center text-xs font-bold sm:px-2 ${done ? 'bg-emerald-600 text-white' : active ? 'bg-amber-400 text-stone-950' : 'bg-stone-100 text-stone-500'}`}>
                    <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/40">{done ? <Check className="h-4 w-4" /> : index + 1}</span>
                    <span className="block truncate">{item.label}</span>
                  </div>
                )
              })}
            </div>

            {notice && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{notice}</div>}

            {step === 'show' && (
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                {showsLoading ? (
                  <div className="md:col-span-2 rounded-lg border border-stone-200 bg-white p-10 text-center text-stone-600 shadow-sm">
                    Loading available shows...
                  </div>
                ) : shows.filter(show => (!preselectedDate || show.date === preselectedDate) && (!preselectedActivityId || (show as any).activity_id === preselectedActivityId)).length === 0 ? (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center text-stone-600">
                    No shows available right now.
                  </div>
                ) : shows.filter(show => (!preselectedDate || show.date === preselectedDate) && (!preselectedActivityId || (show as any).activity_id === preselectedActivityId)).map(show => (
                  <button
                    key={getRecordId(show)}
                    onClick={() => { if (show.availability_status !== 'SOLD_OUT') { setSelectedShow(show); setSelectedSeats([]); setStep('seats') } }}
                    disabled={show.availability_status === 'SOLD_OUT'}
                    className="group flex h-full min-h-[445px] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 md:max-w-none"
                  >
                    <img src={show.image || fallbackBookingImage} alt={show.title} className="h-40 w-full object-cover object-[50%_68%] transition duration-500 group-hover:scale-105" />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 grid grid-cols-2 gap-2 text-xs font-bold sm:flex sm:flex-wrap">
                        <span className={`truncate rounded-full px-3 py-1 text-center sm:text-left ${show.type === 'EVENT' ? 'bg-purple-50 text-purple-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          {show.type === 'EVENT' ? 'Special Event' : 'Kalari Show'}
                        </span>
                        <span className={`truncate rounded-full px-3 py-1 text-center sm:text-left ${show.availability_status === 'SOLD_OUT' ? 'bg-red-50 text-red-800' : show.availability_status === 'FILLING_FAST' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          {getAvailabilityLabel(show.availability_status || 'AVAILABLE')}
                        </span>
                        <span className="truncate rounded-full bg-stone-100 px-3 py-1 text-center text-stone-800 sm:text-left">{format(new Date(show.date), 'EEE, MMM dd')}</span>
                        <span className="truncate rounded-full bg-sky-50 px-3 py-1 text-center text-sky-800 sm:text-left">{format(new Date(`2000-01-01T${show.time}`), 'h:mm a')}</span>
                      </div>
                      <h3 className="text-xl font-bold leading-snug">{show.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{show.description || 'Reserved seating for an authentic Kalari live show.'}</p>
                      <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                        <span className="text-2xl font-bold">Rs. {show.price}</span>
                        <span className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white ${show.availability_status === 'SOLD_OUT' ? 'bg-stone-400' : 'bg-stone-950'}`}>{show.availability_status === 'SOLD_OUT' ? 'Sold Out' : 'Select'} <ArrowRight className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 'seats' && selectedShow && (
              <div className="pb-24 sm:pb-0">
                <TopBar title={selectedShow.type === 'EVENT' ? 'Select Tickets' : 'Choose seats'} onBack={() => setStep('show')} />
                <Summary show={selectedShow} selectedSeatLabels={selectedSeatLabels} selectedSeats={totalTickets} totalAmount={totalAmount} />
                
                {selectedShow.type === 'EVENT' ? (
                  <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">
                    <h3 className="mb-4 text-lg font-bold">Number of Tickets</h3>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setEventTicketCount(Math.max(1, eventTicketCount - 1))} className="flex h-12 w-12 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-xl font-bold text-stone-700 transition hover:bg-stone-100">-</button>
                      <span className="text-2xl font-black text-stone-950">{eventTicketCount}</span>
                      <button onClick={() => setEventTicketCount(Math.min(selectedShow.capacity || 1000, eventTicketCount + 1))} className="flex h-12 w-12 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-xl font-bold text-stone-700 transition hover:bg-stone-100">+</button>
                    </div>
                  </div>
                ) : (
                  renderGuestKalariSeatMap()
                )}
                
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <PrimaryButton disabled={totalTickets === 0} onClick={() => setStep('details')}>Continue with {totalTickets} ticket(s)</PrimaryButton>
                </div>
              </div>
            )}

            {step === 'details' && selectedShow && (
              <div className="pb-24 sm:pb-0">
                <TopBar title="Guest details" onBack={() => setStep('seats')} />
                <Summary show={selectedShow} selectedSeatLabels={selectedSeatLabels} selectedSeats={totalTickets} totalAmount={totalAmount} />
                <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-stone-200">
                  <label className="mb-4 block">
                    <Input
                      variant="public"
                      label="Full name"
                      value={form.name}
                      onChange={(name) => setForm({ ...form, name })}
                      placeholder="Guest name"
                      leftIcon={User}
                      error={errors.name}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <Input
                        variant="public"
                        label="Phone"
                        type="tel"
                        value={form.phone}
                        onChange={(phone) => setForm({ ...form, phone })}
                        placeholder="+91 98765 43210"
                        leftIcon={Phone}
                        error={errors.phone}
                      />
                    </label>
                    <label>
                      <Input
                        variant="public"
                        label="Email optional"
                        type="email"
                        value={form.email}
                        onChange={(email) => setForm({ ...form, email })}
                        placeholder="name@email.com"
                        error={errors.email}
                      />
                    </label>
                  </div>
                </div>
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <PrimaryButton onClick={() => { if (validateDetails()) setStep('payment') }}>Continue to payment</PrimaryButton>
                </div>
              </div>
            )}

            {step === 'payment' && selectedShow && (
              <div className="pb-24 sm:pb-0">
                <TopBar title="Payment" onBack={() => setStep('details')} />
                <Summary show={selectedShow} selectedSeatLabels={selectedSeatLabels} selectedSeats={totalTickets} totalAmount={totalAmount} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PaymentCard active={paymentMethod === 'razorpay'} icon={<CreditCard className="h-7 w-7 text-amber-600" />} title="Razorpay" text="Pay now with UPI, cards, wallets, or netbanking." onClick={() => setPaymentMethod('razorpay')} />
                  <PaymentCard active={paymentMethod === 'cod'} icon={<WalletCards className="h-7 w-7 text-emerald-700" />} title="COD" text="Reserve now and pay at the venue counter." onClick={() => setPaymentMethod('cod')} />
                </div>
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <PrimaryButton disabled={loading} dark onClick={paymentMethod === 'razorpay' ? payWithRazorpay : reserveWithCod}>
                    {loading ? 'Processing...' : paymentMethod === 'razorpay' ? `Pay Rs. ${totalAmount}` : 'Reserve with COD'}
                  </PrimaryButton>
                </div>
              </div>
            )}

            {step === 'success' && selectedShow && (
              <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-stone-200">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h2 className="mt-5 text-3xl font-bold">Booking confirmed</h2>
                <p className="mt-2 text-stone-600">Show this confirmation at the venue.</p>
                <div className="mt-6 grid gap-3 rounded-lg bg-stone-50 p-4 text-left text-sm sm:grid-cols-2">
                  <Info label="Booking Ref" value={bookingReference || bookingId} mono />
                  <Info label="Payment" value={paymentStatus === 'PAID' ? 'Paid via Razorpay' : 'COD pending'} />
                  <Info label="Guest" value={form.name} />
                  <Info label="Total" value={`Rs. ${totalAmount}`} />
                  <div className="sm:col-span-2"><Info label="Seats" value={selectedSeatLabels} /></div>
                  {ticketCodes.length > 0 && <div className="sm:col-span-2"><Info label="Ticket Codes" value={ticketCodes.join(', ')} mono /></div>}
                </div>
                <div className="mx-auto mt-6 flex w-fit rounded-lg bg-white p-3 shadow-sm">
                  <QRCode value={bookingReference || bookingId} size={132} />
                </div>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button onClick={() => window.print()} className="rounded-lg bg-emerald-700 px-6 py-3 font-bold text-white">Print ticket</button>
                  <button onClick={() => window.location.reload()} className="rounded-lg bg-stone-950 px-6 py-3 font-bold text-white">Book another ticket</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

const PublicBooking: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}

const TopBar: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <h3 className="min-w-0 text-2xl font-bold leading-tight">{title}</h3>
    <button onClick={onBack} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm ring-1 ring-stone-200">
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back</span>
    </button>
  </div>
)

const Summary: React.FC<{ show: Show; selectedSeatLabels: string; selectedSeats: number; totalAmount: number }> = ({ show, selectedSeatLabels, selectedSeats, totalAmount }) => (
  <div className="mb-5 rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h4 className="font-bold">{show.title}</h4>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-600">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {format(new Date(show.date), 'EEE, MMM dd')}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {format(new Date(`2000-01-01T${show.time}`), 'h:mm a')}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> Kovalam</span>
        </div>
        {selectedSeatLabels && <div className="mt-3 text-sm font-bold text-stone-800">Seats: {selectedSeatLabels}</div>}
      </div>
      <div className="min-w-[120px] text-left sm:text-right">
        <div className="text-sm font-bold text-stone-500">{selectedSeats} ticket(s)</div>
        <div className="text-2xl font-bold text-amber-700">Rs. {totalAmount}</div>
      </div>
    </div>
  </div>
)

const PaymentCard: React.FC<{ active: boolean; icon: React.ReactNode; title: string; text: string; onClick: () => void }> = ({ active, icon, title, text, onClick }) => (
  <button onClick={onClick} className={`rounded-lg bg-white p-5 text-left shadow-sm ring-2 transition ${active ? 'ring-amber-400' : 'ring-stone-200 hover:ring-stone-300'}`}>
    {icon}
    <h4 className="mt-4 text-lg font-bold">{title}</h4>
    <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
  </button>
)

const PrimaryButton: React.FC<{ children: React.ReactNode; onClick: () => void; disabled?: boolean; dark?: boolean }> = ({ children, onClick, disabled, dark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 ${dark ? 'bg-stone-950 text-white hover:bg-stone-800' : 'bg-amber-400 text-stone-950 hover:bg-amber-300'}`}
  >
    {children}
    <ArrowRight className="h-5 w-5" />
  </button>
)

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <span className="block text-xs font-bold uppercase tracking-wider text-stone-500">{label}</span>
    <span className={`mt-1 block font-bold text-stone-950 ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
)

export default PublicBooking
