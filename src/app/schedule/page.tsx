"use client";

import React, { useEffect, useState } from 'react'
import { db } from '@/lib/database'
import { format } from 'date-fns'
import PublicNavbar from '@/components/PublicNavbar'
import { PublicFooter } from '@/components/PublicFooter'
import { Calendar, Clock, MapPin, IndianRupee, ArrowRight, Filter, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvailabilityLabel, isShowBookableAt } from '@/lib/booking'
import { formatDisplayDateValue } from '@/components/ui/date-utils'

interface PublicShow {
  id: string
  _id?: string
  title: string
  date: string
  time: string
  price: number
  image?: string
  description?: string
  status: string
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT"
  available_count?: number
  type?: 'KALARI' | 'EVENT'
}

const publicShowBookingHref = (show: PublicShow) => {
  const showId = String(show.id || show._id || "")
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book"
}

const Schedule: React.FC = () => {
  const [shows, setShows] = useState<PublicShow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming')

  useEffect(() => {
    fetchShows()
  }, [filter])

  const fetchShows = async () => {
    try {
      setLoading(true)
      let query = db.from('shows').select('*').order('date', { ascending: true })

      if (filter === 'upcoming') {
        query = query.gte('date', new Date().toISOString().split('T')[0])
      }

      const { data } = await query
      setShows((data || []).filter((show: PublicShow) => isShowBookableAt(show)))
    } catch (error) {
      console.error('Error fetching shows:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (show: PublicShow) => {
    if (show.status === 'HOUSE_FULL' || show.availability_status === 'SOLD_OUT') return 'bg-red-100 text-red-800 border-red-200'
    if (show.availability_status === 'FILLING_FAST') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (show.status === 'ACTIVE') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    return 'bg-stone-100 text-stone-600 border-stone-200'
  }

  return (
    <div className="min-h-screen bg-[#f7f2e8] flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="bg-stone-950 py-24 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="mx-auto max-w-7xl px-4 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-6">
                <Calendar className="h-3 w-3" />
                Live Show Calendar
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">Training & Performance <span className="text-amber-400">Schedule.</span></h1>
              <p className="text-stone-400 text-lg max-w-2xl mx-auto font-medium">Browse our upcoming Kalaripayattu shows and special cultural events. Book your seats in advance to ensure the best view.</p>
            </motion.div>
          </div>
        </section>

        {/* Filter Bar */}
        <section className="sticky top-16 z-30 bg-white/80 backdrop-blur-xl border-b border-stone-200 py-4 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilter('upcoming')}
                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${filter === 'upcoming' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-950'}`}
              >
                Upcoming
              </button>
              <button 
                onClick={() => setFilter('all')}
                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-950'}`}
              >
                All Shows
              </button>
            </div>
            <div className="text-xs font-bold opacity-40 uppercase tracking-widest flex items-center gap-2">
              <Filter className="h-3 w-3" /> {shows.length} Sessions Found
            </div>
          </div>
        </section>

        {/* Shows Grid */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {loading ? (
              <div className="py-32 flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
                <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Loading Schedule...</p>
              </div>
            ) : shows.length === 0 ? (
              <div className="py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-stone-200">
                <div className="text-6xl mb-6">📅</div>
                <h3 className="text-2xl font-black mb-2">No shows scheduled yet.</h3>
                <p className="text-stone-500 max-w-md mx-auto">We are currently updating our calendar for the coming weeks. Please check back later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {shows.map((show, idx) => (
                    <motion.div 
                      key={show.id || (show as any)._id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-white rounded-[32px] border border-stone-200 overflow-hidden hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 flex flex-col"
                    >
                      <div className="h-48 relative overflow-hidden">
                        <img 
                          src={show.image || 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80'} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          alt={show.title}
                        />
                        <div className="absolute top-4 left-4 flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${getStatusBadge(show)}`}>
                            {show.status === 'HOUSE_FULL' ? 'Sold Out' : getAvailabilityLabel(show.availability_status || 'AVAILABLE')}
                          </span>
                        </div>
                        {show.type === 'EVENT' && (
                          <div className="absolute bottom-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                            Special Event
                          </div>
                        )}
                      </div>

                      <div className="p-8 flex-1 flex flex-col">
                        <div className="flex items-center gap-4 text-xs font-black opacity-40 uppercase tracking-widest mb-4">
                           <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDisplayDateValue(show.date)}</div>
                           <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {show.time}</div>
                        </div>
                        
                        <h3 className="text-2xl font-black mb-3 group-hover:text-amber-600 transition-colors leading-tight">{show.title}</h3>
                        <p className="text-stone-500 text-sm leading-relaxed mb-8 flex-1 line-clamp-3">
                          {show.description || 'Authentic Kalaripayattu performance featuring traditional weapons and ancient combat sequences.'}
                        </p>

                        <div className="pt-6 border-t border-stone-100 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">From</div>
                            <div className="text-2xl font-black">₹{show.price}</div>
                          </div>
                          
                          {show.status === 'ACTIVE' && show.availability_status !== 'SOLD_OUT' ? (
                            <Link 
                              href={publicShowBookingHref(show)}
                              className="bg-stone-950 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-600 transition-all flex items-center gap-2 group/btn"
                            >
                              Book Now
                              <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                          ) : (
                            <div className="text-xs font-black text-red-600 opacity-60">Waitlist Only</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

export default Schedule
