"use client";

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { db, Booking, Show, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
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
                {agent.active ? 'Active Agent' : 'Inactive Agent'} • Agent ID: {agent.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className={`flex-1 md:flex-none px-6 py-3 rounded-2xl border font-bold text-sm transition-all flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
              <Download className="w-4 h-4" /> Export Report
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
            value={format(new Date(agent.created_at), 'MMM dd, yyyy')} 
            icon={<User className="w-6 h-6 text-purple-500" />} 
            darkMode={darkMode}
          />
        </div>

        {/* Bookings Table */}
        <div className={`rounded-[2.5rem] border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl shadow-slate-100'}`}>
          <div className="p-8 border-b dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-black">Agent Bookings History</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className={`flex-1 sm:flex-none flex items-center gap-2 px-4 py-2 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <Filter className="w-4 h-4 opacity-40" />
                <span className="text-xs font-bold opacity-60">Sort: Newest</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={darkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40">Date & Show</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40">Customer</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40">Seats</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40">Booking Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40">Commission</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-8 py-6">
                      <div className="font-bold text-sm leading-tight mb-1">{booking.show_details?.title || 'Unknown Show'}</div>
                      <div className="text-[10px] font-black opacity-30 uppercase tracking-tighter">
                        {format(new Date(booking.booking_time), 'MMM dd, yyyy • hh:mm a')}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">
                          {booking.booked_by.charAt(0)}
                        </div>
                        <div className="font-bold text-sm">{booking.booked_by}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black">
                        {getSeatCount(booking.seat_code)} SEATS
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-sm text-slate-500">₹{calculateTotalPrice(booking).toLocaleString()}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-sm text-emerald-500">₹{booking.commission_amount?.toLocaleString() || 0}</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => router.push(`/admin/tickets?booking=${booking.id}`)}
                        className="p-2 rounded-lg opacity-20 group-hover:opacity-100 hover:bg-amber-100 hover:text-amber-600 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-24 text-center opacity-30 font-black uppercase tracking-widest">
                      No bookings found for this agent
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
