"use client";

import React from "react";
import Link from 'next/link'
import Image from 'next/image'

export const Logo = () => (
  <div className="flex items-center gap-2 group">
    <div className="relative h-12 w-12 transition-transform group-hover:scale-105">
      <Image 
        src="/logo.png" 
        alt="Kovalam Kalari" 
        fill
        className="object-contain"
        priority
      />
    </div>
    <div className="flex flex-col">
      <span className="text-xl font-black tracking-tighter text-stone-900 leading-none">KOVALAM</span>
      <span className="text-sm font-bold tracking-widest text-amber-600 leading-none mt-0.5">KALARI</span>
    </div>
  </div>
);

const PublicNavbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo />
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-bold text-stone-600">
          <Link href="/schedule" className="hover:text-amber-600 transition-colors">Shows</Link>
          <Link href="/activities" className="hover:text-amber-600 transition-colors">Activities</Link>
          <Link href="/packages" className="hover:text-amber-600 transition-colors">Packages</Link>
          <Link href="/gallery" className="hover:text-amber-600 transition-colors">Gallery</Link>
          <Link href="/blog" className="hover:text-amber-600 transition-colors">Blog</Link>
          <Link href="/about" className="hover:text-amber-600 transition-colors">About</Link>
          <Link href="/contact" className="hover:text-amber-600 transition-colors">Contact</Link>
          <Link href="/book" className="hover:text-amber-600 transition-colors">Book Now</Link>
          <Link href="/admin/login" className="px-5 py-2.5 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-all active:scale-95 shadow-lg shadow-stone-900/20">Staff Login</Link>
        </div>
      </div>
    </nav>
  )
}

export default PublicNavbar
