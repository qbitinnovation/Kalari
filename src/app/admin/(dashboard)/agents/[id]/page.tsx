"use client";

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db, Booking, Show, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { formatDisplayDateValue } from '@/components/ui/date-utils'
import { getBookingReference, getRecordId } from '@/lib/booking'
import { escapeReportHtml, openAdminReportPdf } from '@/lib/adminReportTemplate'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTablePanel,
  AdminTableRow,
} from '@/components/ui'
import { 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  User, 
  CreditCard, 
  ChevronRight,
  Filter,
  Download,
  Info
} from 'lucide-react'

interface Agent {
  id: string
  _id?: string
  email: string
  role: string
  full_name: string
  commission_percentage?: number
  created_at: string
  active: boolean
}

interface BookingWithDetails extends Booking {
  show_details?: Show
}

const AgentDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  const darkMode = useDarkMode()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (agentId) {
      fetchData()
    }
  }, [agentId])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // 1. Fetch Agent
      const { data: agentData, error: agentError } = await db
        .from('users')
        .select('*')
        .eq('id', agentId)
        .single()

      if (agentError) throw agentError
      setAgent(agentData)

      // 2. Fetch Bookings for this agent
      const { data: bookingData, error: bookingError } = await db
        .from('bookings')
        .select('*, customer:customers(*)')
        .eq('agent_id', agentId)
        .order('booking_time', { ascending: false })

      if (bookingError) throw bookingError
      
      // 3. Fetch Show details for these bookings
      const bookingsWithShows = await Promise.all((bookingData || []).map(async (booking) => {
        const { data: showData } = await db
          .from('shows')
          .select('*')
          .eq('id', booking.show_id)
          .single()
        
        return {
          ...booking,
          show_details: showData
        }
      }))

      setBookings(bookingsWithShows)
    } catch (err: any) {
      console.error('Error fetching agent details:', err)
      setError('Failed to load agent details')
    } finally {
      setLoading(false)
    }
  }

  const totalBookings = bookings.length
  const totalCommission = bookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0)
  
  const getSeatCount = (seatCode: string) => {
    try {
      const seats = JSON.parse(seatCode)
      return Array.isArray(seats) ? seats.length : 1
    } catch {
      return seatCode.includes(',') ? seatCode.split(',').length : 1
    }
  }

  const calculateTotalPrice = (booking: BookingWithDetails) => {
    if (!booking.show_details) return 0
    return booking.show_details.price * getSeatCount(booking.seat_code)
  }
  const displayedAgentId = getRecordId(agent)
  const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`
  const exportAgentReport = () => {
    if (!agent) return

    const bookingRows = bookings.map((booking) => `
      <tr>
        <td>
          <strong>${escapeReportHtml(getBookingReference(booking))}</strong>
          <span class="muted">${escapeReportHtml(formatDisplayDateValue(booking.booking_time))}</span>
        </td>
        <td>
          <strong>${escapeReportHtml(booking.show_details?.title || 'Unknown Show')}</strong>
          <span class="muted">${escapeReportHtml(booking.show_details?.type || 'Show')}</span>
        </td>
        <td>${escapeReportHtml(booking.booked_by || booking.customer?.name || 'Customer')}</td>
        <td class="nowrap">${escapeReportHtml(getSeatCount(booking.seat_code))}</td>
        <td class="nowrap">${escapeReportHtml(rupees(calculateTotalPrice(booking)))}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.commission_amount || 0))}</td>
        <td>${escapeReportHtml(booking.status || 'CONFIRMED')}</td>
      </tr>
    `).join('')

    openAdminReportPdf({
      title: 'Agent Performance Report',
      subtitle: `Booking and commission summary for ${agent.full_name}.`,
      generatedLabel: `Generated ${formatDisplayDateValue(new Date())}`,
      body: `
        <section class="metrics">
          <article class="metric"><p class="label">Total Bookings</p><p class="value">${escapeReportHtml(totalBookings)}</p></article>
          <article class="metric"><p class="label">Total Commission</p><p class="value">${escapeReportHtml(rupees(totalCommission))}</p></article>
          <article class="metric"><p class="label">Commission Rate</p><p class="value">${escapeReportHtml(`${agent.commission_percentage || 0}%`)}</p></article>
          <article class="metric"><p class="label">Agent Status</p><p class="value">${escapeReportHtml(agent.active ? 'Active' : 'Inactive')}</p></article>
        </section>
        <section class="panels">
          <article class="panel">
            <h2>Agent Details</h2>
            <div class="detail-grid">
              <div class="detail"><p class="label">Agent Name</p><p class="value">${escapeReportHtml(agent.full_name)}</p></div>
              <div class="detail"><p class="label">Agent ID</p><p class="value">${escapeReportHtml(displayedAgentId)}</p></div>
              <div class="detail"><p class="label">Email</p><p class="value">${escapeReportHtml(agent.email)}</p></div>
              <div class="detail"><p class="label">Joined Date</p><p class="value">${escapeReportHtml(formatDisplayDateValue(agent.created_at))}</p></div>
            </div>
          </article>
          <article class="panel">
            <h2>Bookings History</h2>
            ${bookings.length ? `
              <table>
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Show / Event</th>
                    <th>Customer</th>
                    <th>Tickets</th>
                    <th>Amount</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${bookingRows}</tbody>
              </table>
            ` : '<div class="empty">No bookings found for this agent.</div>'}
          </article>
        </section>
      `,
    })
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>

  if (error || !agent) return (
    <div className="p-8 text-center">
      <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block mb-4">
        <Info className="inline mr-2" /> {error || 'Agent not found'}
      </div>
      <br />
      <button onClick={() => router.back()} className="text-amber-600 font-bold flex items-center justify-center gap-2 mx-auto">
        <ArrowLeft className="w-4 h-4" /> Go Back
      </button>
    </div>
  )

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className={`p-3 rounded-2xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{agent.full_name}</h1>
              <p className="opacity-50 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agent.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                {agent.active ? 'Active Agent' : 'Inactive Agent'} • Agent ID: {displayedAgentId.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={exportAgentReport} className={`flex-1 md:flex-none px-6 py-3 rounded-2xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Total Commission" 
            value={`₹${totalCommission.toLocaleString()}`} 
            icon={<CreditCard className="w-6 h-6 text-emerald-500" />} 
            darkMode={darkMode}
          />
          <StatCard 
            label="Total Bookings" 
            value={totalBookings.toString()} 
            icon={<Calendar className="w-6 h-6 text-blue-500" />} 
            darkMode={darkMode}
          />
          <StatCard 
            label="Commission Rate" 
            value={`${agent.commission_percentage}%`} 
            icon={<TrendingUp className="w-6 h-6 text-amber-500" />} 
            darkMode={darkMode}
          />
          <StatCard 
            label="Joined Date" 
            value={formatDisplayDateValue(agent.created_at)} 
            icon={<User className="w-6 h-6 text-purple-500" />} 
            darkMode={darkMode}
          />
        </div>

        <AdminTablePanel
          title="Agent Bookings History"
          actions={
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Filter className="h-4 w-4" />
              Sort: Newest
            </div>
          }
        >
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTableHeaderCell>Date & Show</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Seats</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Booking Amount</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Commission</AdminTableHeaderCell>
                  <AdminTableHeaderCell align="right">Action</AdminTableHeaderCell>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {bookings.map((booking) => (
                  <AdminTableRow key={getRecordId(booking)} className="group">
                    <AdminTableCell>
                      <div className="font-bold text-sm leading-tight mb-1">{booking.show_details?.title || 'Unknown Show'}</div>
                      <div className="text-[10px] font-black opacity-30 uppercase tracking-tighter">
                        {formatDisplayDateValue(booking.booking_time)} - {format(new Date(booking.booking_time), 'hh:mm a')}
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">
                          {booking.booked_by.charAt(0)}
                        </div>
                        <div className="font-bold text-sm">{booking.booked_by}</div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black">
                        {getSeatCount(booking.seat_code)} SEATS
                      </span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-bold text-sm text-slate-500">₹{calculateTotalPrice(booking).toLocaleString()}</div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-black text-sm text-emerald-500">₹{booking.commission_amount?.toLocaleString() || 0}</div>
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <button 
                        onClick={() => router.push(`/admin/tickets?booking=${getRecordId(booking)}`)}
                        className="p-2 rounded-lg opacity-20 group-hover:opacity-100 hover:bg-amber-100 hover:text-amber-600 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
                {bookings.length === 0 && (
                  <AdminTableEmpty colSpan={6}>No bookings found for this agent.</AdminTableEmpty>
                )}
              </AdminTableBody>
            </AdminTable>
        </AdminTablePanel>
      </div>
    </div>
  )
}

const StatCard = ({ label, value, icon, darkMode }: { label: string, value: string, icon: React.ReactNode, darkMode: boolean }) => (
  <div className={`p-8 rounded-[2.5rem] border transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-slate-200'}`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
        {icon}
      </div>
    </div>
    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">{label}</div>
    <div className="text-2xl font-black tracking-tight">{value}</div>
  </div>
)

export default AgentDetailPage
