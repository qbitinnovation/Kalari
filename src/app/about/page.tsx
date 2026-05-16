"use client";

import React from 'react'
import Link from 'next/link'
import PublicNavbar from '@/components/PublicNavbar'
import { PublicFooter } from '@/components/PublicFooter'
import { motion } from 'framer-motion'
import { Sparkles, Shield, MapPin, History, ArrowRight, CheckCircle2 } from 'lucide-react'

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f7f2e8] text-stone-950 flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-stone-950 text-white">
          <img 
            src="https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=2400&q=90" 
            alt="Kalari Training" 
            className="absolute inset-0 w-full h-full object-cover opacity-40 scale-105 animate-pulse-slow"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f7f2e8] to-transparent" />
          
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-400 text-xs font-black uppercase tracking-widest mb-6 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                Our Ancient Roots
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-stone-950 mb-8">
                3000 Years of <br/>
                <span className="text-amber-600">Warrior Wisdom.</span>
              </h1>
              <p className="text-stone-700 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                Step into the sacred circle where body, mind, and spirit become one. We preserve the authentic Kalaripayattu tradition in its purest form.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="inline-block p-3 bg-amber-100 rounded-2xl"><History className="h-8 w-8 text-amber-600" /></div>
                <h2 className="text-4xl font-black tracking-tight leading-tight">The Mother of <br/> All Martial Arts.</h2>
                <p className="text-stone-600 text-lg leading-relaxed font-medium">
                  Kalaripayattu originated in Kerala over 3,000 years ago, widely regarded as the oldest and most scientific martial arts in the world. It is a comprehensive system that encompasses physical conditioning, mental discipline, weaponry, and traditional healing.
                </p>
                <div className="grid grid-cols-2 gap-6 pt-4">
                  {[
                    { label: 'Founded', value: '3000 BC' },
                    { label: 'Origin', value: 'Kerala' },
                    { label: 'Focus', value: 'Body & Mind' },
                    { label: 'Method', value: 'Traditional' },
                  ].map(stat => (
                    <div key={stat.label} className="border-l-4 border-amber-400 pl-4">
                      <div className="text-sm font-black opacity-40 uppercase tracking-widest">{stat.label}</div>
                      <div className="text-2xl font-black">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-4 bg-amber-400/20 rounded-[40px] blur-2xl group-hover:opacity-100 transition-opacity" />
                <img 
                  src="https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=1500&q=88" 
                  alt="Traditional Training" 
                  className="relative rounded-[32px] w-full h-[500px] object-cover shadow-2xl border-8 border-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pillars Section */}
        <section className="py-24 bg-stone-950 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black tracking-tight">The Four Pillars</h2>
              <p className="text-stone-400 mt-4 max-w-xl mx-auto">The journey of a Kalari practitioner is divided into four distinct stages of development.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Meithari', desc: 'Body conditioning exercises to improve flexibility, balance, and coordination.' },
                { title: 'Kolthari', desc: 'Training with wooden weapons like sticks and rods to master distance and timing.' },
                { title: 'Ankathari', desc: 'The use of sharp metal weapons like swords, shields, and the Urumi.' },
                { title: 'Verumkai', desc: 'Advanced unarmed combat techniques for self-defense and pressure points.' },
              ].map((pillar, i) => (
                <div key={pillar.title} className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <div className="text-5xl font-black text-amber-400/20 group-hover:text-amber-400/40 transition-colors mb-6">0{i+1}</div>
                  <h3 className="text-xl font-black mb-4">{pillar.title}</h3>
                  <p className="text-sm text-stone-400 leading-relaxed font-medium">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-amber-400">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-stone-950 leading-none mb-8">
              Begin Your Journey <br/> into the Circle.
            </h2>
            <p className="text-stone-900/60 text-lg md:text-xl font-bold max-w-2xl mx-auto mb-10">
              Join our daily shows or sign up for traditional training sessions. Authenticity is guaranteed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book" className="px-10 py-5 bg-stone-950 text-white rounded-2xl font-black text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-950/20 active:scale-95 flex items-center justify-center gap-3">
                Book Tickets Now
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/contact" className="px-10 py-5 bg-white text-stone-950 rounded-2xl font-black text-lg hover:bg-stone-50 transition-all border-2 border-stone-950/10 flex items-center justify-center gap-3">
                Inquire Training
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

export default About
