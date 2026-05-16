"use client";

import React from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Instagram, Facebook, Twitter, ShieldCheck, Clock } from 'lucide-react'
import { Logo } from './PublicNavbar'

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-stone-950 text-white pt-20 pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
            </Link>
            <p className="text-stone-400 text-sm leading-relaxed">
              Experience the ancient art of Kalaripayattu in its purest form. Live shows and authentic training sessions in the heart of Kovalam, Kerala.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Instagram className="h-5 w-5" /></a>
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="p-2 rounded-lg bg-white/5 hover:bg-amber-400 hover:text-stone-950 transition-all"><Twitter className="h-5 w-5" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link href="/about" className="text-stone-400 hover:text-white transition-colors text-sm font-bold">About Us</Link></li>
              <li><Link href="/schedule" className="text-stone-400 hover:text-white transition-colors text-sm font-bold">Show Schedule</Link></li>
              <li><Link href="/contact" className="text-stone-400 hover:text-white transition-colors text-sm font-bold">Get in Touch</Link></li>
              <li><Link href="/book" className="text-stone-400 hover:text-white transition-colors text-sm font-bold">Book Tickets</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-stone-400 text-sm">
                <MapPin className="h-5 w-5 text-amber-400 shrink-0" />
                <span>Kovalam Beach Road, Near Lighthouse,<br/>Kovalam, Kerala 695527</span>
              </li>
              <li className="flex items-center gap-3 text-stone-400 text-sm">
                <Phone className="h-5 w-5 text-amber-400 shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3 text-stone-400 text-sm">
                <Mail className="h-5 w-5 text-amber-400 shrink-0" />
                <span>hello@kalarikovalam.com</span>
              </li>
            </ul>
          </div>

          {/* Trust Signals */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6">Safe Booking</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-xs font-black">Secure Checkout</div>
                  <div className="text-[10px] opacity-40">Razorpay Encrypted</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                <Clock className="h-5 w-5 text-blue-400" />
                <div>
                  <div className="text-xs font-black">Instant E-Tickets</div>
                  <div className="text-[10px] opacity-40">Sent via Email/SMS</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-stone-500 text-xs font-bold">
            Copyright {new Date().getFullYear()} Kalary Guide. All rights reserved.
          </p>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-stone-500">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
