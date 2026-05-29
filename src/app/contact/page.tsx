"use client";

import React, { useState } from 'react'
import PublicNavbar from '@/components/PublicNavbar'
import { PublicFooter } from '@/components/PublicFooter'
import { Mail, Phone, MapPin, Send, MessageSquare, Instagram, Facebook, Twitter, CheckCircle2 } from 'lucide-react'
import { Input, IndianPhoneField, Textarea } from '@/components/ui'
import { PublicHero } from '@/components/PublicHero'
import { activityImages } from '@/lib/seedData'
import { formatIndianMobileForStorage, getIndianMobileValidationError } from '@/lib/indianPhone'

const Contact: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const phoneError = form.phone.trim() ? getIndianMobileValidationError(form.phone) : ''
    if (phoneError) {
      setError(phoneError)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/contact-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: form.phone.trim() ? formatIndianMobileForStorage(form.phone) : '',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to send message.')
      setSubmitted(true)
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err: any) {
      setError(err.message || 'Unable to send message.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f2e8] flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        <PublicHero
          badge="Support & inquiries"
          badgeIcon={<MessageSquare className="h-3.5 w-3.5" />}
          title={<>Let&apos;s <span className="text-gradient-primary">Connect.</span></>}
          description="Have questions about shows, training, or group bookings? Our team is here to help you experience the best of Kerala."
          image={activityImages.temple}
        />

        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              {/* Contact Sidebar */}
              <div className="lg:col-span-5 space-y-10">
                <div>
                  <h2 className="text-3xl font-black mb-8 tracking-tight">Visit our Kalari.</h2>
                  <div className="space-y-8">
                    {[
                      { icon: MapPin, title: 'Our Location', detail: 'Kovalam Beach Road, Near Lighthouse, Kovalam, Kerala 695527', color: 'text-primary-700 bg-primary-100' },
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
                      {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                          {error}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                          variant="public"
                          label="Full Name"
                          value={form.name}
                          onChange={(name) => setForm({ ...form, name })}
                          placeholder="John Doe"
                          required
                          inputClassName="rounded-2xl border-2 border-stone-100 px-5 py-4 font-bold"
                        />
                        <Input
                          variant="public"
                          label="Email Address"
                          type="email"
                          value={form.email}
                          onChange={(email) => setForm({ ...form, email })}
                          placeholder="john@example.com"
                          required
                          inputClassName="rounded-2xl border-2 border-stone-100 px-5 py-4 font-bold"
                        />
                      </div>
                      <IndianPhoneField
                        variant="public"
                        label="Phone Number"
                        value={form.phone}
                        onChange={(phone) => setForm({ ...form, phone })}
                        containerClassName="rounded-2xl border-2 border-stone-100"
                      />
                      <Textarea
                        variant="public"
                        label="Your Message"
                        value={form.message}
                        onChange={(message) => setForm({ ...form, message })}
                        rows={6}
                        placeholder="How can we help you?"
                        required
                        inputClassName="rounded-2xl border-2 border-stone-100 px-5 py-4 font-bold resize-none"
                      />
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
