"use client";

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Shield, ArrowRight, Sparkles, Lock, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(email, password)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('kalari_user') : null
      const user = stored ? JSON.parse(stored) : null
      if (user?.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/admin/booking')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=2400&q=80" 
          className="w-full h-full object-cover opacity-20 scale-105 animate-pulse-slow" 
          alt="Kalari"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent" />
      </div>

      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10 px-4"
      >
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
            <div className="w-16 h-16 bg-amber-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-amber-600/30 group-hover:scale-110 transition-transform duration-500">
               <Shield className="h-8 w-8 text-white fill-white/20" />
            </div>
          </Link>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase">Staff <span className="text-amber-500">Access</span></h1>
          <p className="text-stone-400 font-bold text-xs uppercase tracking-[0.3em]">Authorized Personnel Only</p>
        </div>

        <div className="bg-white/95 backdrop-blur-2xl rounded-[40px] p-10 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Email ID</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-500 outline-none transition-all font-bold text-stone-900"
                  placeholder="name@kalari.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-stone-100 focus:border-amber-500 outline-none transition-all font-bold text-stone-900"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black">!</span>
                </div>
                <p className="text-red-700 text-xs font-bold leading-tight">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-stone-950 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 transition-all duration-300 disabled:opacity-50 shadow-xl shadow-stone-950/20 active:scale-95 flex items-center justify-center gap-3 group"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Authenticate Access
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-stone-100 flex flex-col items-center gap-4">
             <Link href="/" className="text-xs font-black text-amber-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                Public Booking Site
             </Link>
             <p className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] text-center">Secure Multi-Role Administrative Interface</p>
          </div>
        </div>

        <div className="mt-10 flex justify-center gap-8">
           <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">SSL Secure</span>
           </div>
           <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Multi-Role Support</span>
           </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
