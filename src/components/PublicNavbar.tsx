"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, Ticket, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'

type CustomerSession = {
  id: string
  name?: string
  phone: string
  email?: string
}

const CUSTOMER_SESSION_KEY = 'kalari_customer'

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
  const pathname = usePathname()
  const accountRef = useRef<HTMLDivElement>(null)
  const [customer, setCustomer] = useState<CustomerSession | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const links = [
    { href: '/shows', label: 'Shows' },
    { href: '/activities', label: 'Activities' },
    { href: '/packages', label: 'Packages' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/blog', label: 'Blog' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ]

  const isActiveLink = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => {
    const loadSession = () => {
      const raw = localStorage.getItem(CUSTOMER_SESSION_KEY)
      if (!raw) {
        setCustomer(null)
        return
      }

      try {
        setCustomer(JSON.parse(raw))
      } catch {
        localStorage.removeItem(CUSTOMER_SESSION_KEY)
        setCustomer(null)
      }
    }

    loadSession()
    window.addEventListener('storage', loadSession)
    return () => window.removeEventListener('storage', loadSession)
  }, [pathname])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const logout = () => {
    localStorage.removeItem(CUSTOMER_SESSION_KEY)
    setCustomer(null)
    setAccountOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo />
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-bold text-stone-600">
          {links.map((link) => {
            const active = isActiveLink(link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-2 transition-colors hover:text-amber-600',
                  active && 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                )}
              >
                {link.label}
              </Link>
            )
          })}
          {customer ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-label="Customer account menu"
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full border px-3 text-[#10284a] transition hover:border-amber-300 hover:bg-amber-50',
                  pathname.startsWith('/customer') ? 'border-amber-300 bg-amber-100' : 'border-stone-200 bg-white'
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10284a] text-white">
                  <UserRound className="h-4 w-4" />
                </span>
                <ChevronDown className={cn('h-4 w-4 text-stone-500 transition', accountOpen && 'rotate-180')} />
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+12px)] w-72 overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-2xl shadow-stone-900/15">
                  <div className="border-b border-stone-100 px-4 py-4">
                    <div className="truncate text-sm font-black text-[#10284a]">{customer.name || 'Customer Account'}</div>
                    <div className="mt-1 truncate text-xs font-bold text-stone-500">{customer.phone}</div>
                  </div>
                  <div className="p-2">
                    <Link
                      href="/customer"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-black text-stone-700 transition hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Ticket className="h-4 w-4" />
                      My Bookings
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-black text-stone-700 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/customer/login"
              aria-current={pathname === '/customer/login' ? 'page' : undefined}
              className={cn(
                'rounded-full border px-5 py-2.5 text-[#10284a] transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
                pathname === '/customer/login' ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-stone-200 bg-white'
              )}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default PublicNavbar
