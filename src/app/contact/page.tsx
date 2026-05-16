"use client";

import React, { useState } from 'react'
import PublicNavbar from '@/components/PublicNavbar'
import { PublicFooter } from '@/components/PublicFooter'
import { motion } from 'framer-motion'
import { Mail, Phone, MapPin, Send, MessageSquare, Instagram, Facebook, Twitter, CheckCircle2 } from 'lucide-react'

const Contact: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f7f2e8] flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="bg-stone-950 py-24 relative overflow-hidden text-center">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
          <div className="mx-auto max-w-7xl px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-6">
                <MessageSquare className="h-3 w-3" />
                Support & Inquiries
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">Let’s <span className="text-amber-400">Connect.</span></h1>
              <p className="text-stone-400 text-lg max-w-xl mx-auto font-medium">Have questions about shows, training, or group bookings? Our team is here to help you experience the best of Kerala.</p>
            </motion.div>
          </div>
        </section>

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              {/* Contact Sidebar */}
              <div className="lg:col-span-5 space-y-10">
                <div>
                  <h2 className="text-3xl font-black mb-8 tracking-tight">Visit our Kalari.</h2>
                  <div className="space-y-8">
                    {[
                      { icon: MapPin, title: 'Our Location', detail: 'Kovalam Beach Road, Near Lighthouse, Kovalam, Kerala 695527', color: 'text-blue-600 bg-blue-100' },
                      { icon: Phone, title: 'Call Us', detail: '+91 98765 43210', color: 'text-emerald-600 bg-emerald-100' },
                      { icon: Mail, title: 'Email Us', detail: 'hello@kalarikovalam.com', color: 'text-purple-600 bg-purple-100' },
                    ].map(item => (
                      <div key={item.title} className="flex gap-5">
                        <div className={`p-4 rounded-2xl shrink-0 ${item.color}`}><item.icon className="h-6 w-6" /></div>
                        <div>
                          <h3 className="font-black text-sm uppercase tracking-widest opacity-40 mb-1">{item.title}</h3>
                          <p className="font-bold text-stone-800 leading-snug">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 rounded-[40px] bg-stone-900 text-white">
                  <h3 className="font-black mb-4">Follow our journey.</h3>
                  <div className="flex gap-4">
                    <a href="#" className="p-3 rounded-xl bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Instagram className="h-6 w-6" /></a>
                    <a href="#" className="p-3 rounded-xl bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Facebook className="h-6 w-6" /></a>
                    <a href="#" className="p-3 rounded-xl bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Twitter className="h-6 w-6" /></a>
                  </div>
                  <p className="mt-8 text-xs font-bold text-stone-500 uppercase tracking-[0.2em]">Official Social Channels</p>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-[40px] p-10 shadow-2xl shadow-stone-200/50 border border-stone-200">
                  {submitted ? (
                    <div className="py-20 text-center animate-in zoom-in duration-500">
                      <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-[30px] flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                      <h3 className="text-3xl font-black mb-3">Message Received!</h3>
                      <p className="text-stone-500 font-medium max-w-xs mx-auto">Thank you for reaching out. We will get back to you shortly.</p>
                      <button onClick={() => setSubmitted(false)} className="mt-10 font-black text-amber-600 hover:underline">Send another message</button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Full Name</label>
                          <input 
                            required
                            type="text" 
                            placeholder="John Doe" 
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="w-full px-5 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-400 outline-none transition-colors font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Email Address</label>
                          <input 
                            required
                            type="email" 
                            placeholder="john@example.com" 
                            value={form.email}
                            onChange={e => setForm({...form, email: e.target.value})}
                            className="w-full px-5 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-400 outline-none transition-colors font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Phone Number</label>
                        <input 
                          type="tel" 
                          placeholder="+91 98765 43210" 
                          value={form.phone}
                          onChange={e => setForm({...form, phone: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-400 outline-none transition-colors font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">Your Message</label>
                        <textarea 
                          required
                          rows={6}
                          placeholder="How can we help you?" 
                          value={form.message}
                          onChange={e => setForm({...form, message: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-400 outline-none transition-colors font-bold resize-none"
                        />
                      </div>
                      <button 
                        disabled={loading}
                        type="submit" 
                        className="w-full bg-stone-950 text-white py-5 rounded-2xl font-black text-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-stone-950/10 active:scale-[0.98] disabled:opacity-50"
                      >
                        {loading ? 'Sending...' : 'Send Message'}
                        <Send className="h-5 w-5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Map Placeholder */}
        <section className="px-4 sm:px-6 lg:px-8 pb-24">
          <div className="mx-auto max-w-7xl h-[400px] rounded-[40px] overflow-hidden border-4 border-white shadow-2xl relative">
            <div className="absolute inset-0 bg-stone-200 flex items-center justify-center">
               <div className="text-center">
                  <MapPin className="h-12 w-12 text-stone-400 mx-auto mb-4 animate-bounce" />
                  <p className="font-black text-stone-500 uppercase tracking-widest text-sm">Interactive Map Coming Soon</p>
                  <p className="text-xs text-stone-400 font-bold mt-1">Kovalam, Thiruvananthapuram, Kerala</p>
               </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

export default Contact
