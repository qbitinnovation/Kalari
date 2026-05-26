"use client";

import React from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Instagram, Facebook, Twitter, ShieldCheck, Clock } from 'lucide-react'
import { Logo } from './PublicNavbar'

export const PublicFooter: React.FC = () => {
  return (
    <footer className="border-t border-primary-100 bg-[#fdf8ee] pt-20 pb-10 text-stone-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
            </Link>
            <p className="text-stone-600 text-sm leading-relaxed">
              Experience the ancient art of Kalaripayattu in its purest form. Live shows and authentic training sessions in the heart of Kovalam, Kerala.
            </p>
            <div className="flex gap-4">
              <a href="#" className="rounded-lg bg-white p-2 text-stone-700 shadow-sm ring-1 ring-primary-100 transition-all hover:bg-primary-500 hover:text-white"><Instagram className="h-5 w-5" /></a>
              <a href="#" className="rounded-lg bg-white p-2 text-stone-700 shadow-sm ring-1 ring-primary-100 transition-all hover:bg-primary-500 hover:text-white"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="rounded-lg bg-white p-2 text-stone-700 shadow-sm ring-1 ring-primary-100 transition-all hover:bg-primary-500 hover:text-white"><Twitter className="h-5 w-5" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary-700 mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><Link href="/about" className="text-stone-600 hover:text-primary-700 transition-colors text-sm font-bold">About Us</Link></li>
              <li><Link href="/shows" className="text-stone-600 hover:text-primary-700 transition-colors text-sm font-bold">Shows</Link></li>
              <li><Link href="/contact" className="text-stone-600 hover:text-primary-700 transition-colors text-sm font-bold">Get in Touch</Link></li>
              <li><Link href="/book" className="text-stone-600 hover:text-primary-700 transition-colors text-sm font-bold">Book Tickets</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary-700 mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-stone-600 text-sm">
                <MapPin className="h-5 w-5 text-primary-600 shrink-0" />
                <span>Kovalam Beach Road, Near Lighthouse,<br/>Kovalam, Kerala 695527</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 text-sm">
                <Phone className="h-5 w-5 text-primary-600 shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 text-sm">
                <Mail className="h-5 w-5 text-primary-600 shrink-0" />
                <span>hello@kalarikovalam.com</span>
              </li>
            </ul>
          </div>

          {/* Trust Signals */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary-700 mb-6">Safe Booking</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-white p-3 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-xs font-black">Secure Checkout</div>
                  <div className="text-[10px] text-stone-500">Razorpay Encrypted</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-white p-3 shadow-sm">
                <Clock className="h-5 w-5 text-primary-600" />
                <div>
                  <div className="text-xs font-black">Instant E-Tickets</div>
                  <div className="text-[10px] text-stone-500">Sent via Email/SMS</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-10 border-t border-primary-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-stone-500 text-xs font-bold">
            Copyright {new Date().getFullYear()} Kalary Guide. All rights reserved.
          </p>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-stone-500">
            <Link href="/terms" className="hover:text-primary-700 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary-700 transition-colors">Privacy Policy</Link>
            <Link href="/refund" className="hover:text-primary-700 transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
