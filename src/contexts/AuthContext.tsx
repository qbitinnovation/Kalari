"use client";

import React, { createContext, useContext, useEffect, useState } from 'react'
import { db } from '@/lib/database'

interface User {
  id: string
  email: string
  role: 'admin' | 'staff' | 'agent'
  full_name?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: () => boolean
  isStaff: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored user session
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('kalari_user') : null
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        localStorage.removeItem('kalari_user')
      }
    }
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await db.rpc('authenticate_user', {
        p_email: email,
        p_password: password
      })

      if (error) throw error

      if (data.success) {
        const userData = data.user
        setUser(userData)
        localStorage.setItem('kalari_user', JSON.stringify(userData))
      } else {
        throw new Error(data.error || 'Authentication failed')
      }
    } catch (error: any) {
      throw new Error(error.message || 'Login failed')
    }
  }

  const signOut = async () => {
    try {
      setUser(null)
      localStorage.removeItem('kalari_user')
    } catch (error) {
      console.error('Error in signOut:', error)
      throw error
    }
  }

  const isAdmin = () => user?.role === 'admin'
  const isStaff = () => user?.role === 'staff' || user?.role === 'admin'

  const value = {
    user,
    loading,
    signIn,
    signOut,
    isAdmin,
    isStaff,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
