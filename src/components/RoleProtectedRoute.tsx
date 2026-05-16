"use client";

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: ('admin' | 'staff' | 'agent')[]
  fallbackPath?: string
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  children, 
  allowedRoles, 
  fallbackPath = '/' 
}) => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/admin/login')
      } else if (!allowedRoles.includes(user.role)) {
        router.push(fallbackPath)
      }
    }
  }, [user, loading, allowedRoles, fallbackPath, router])

  if (loading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return <>{children}</>
}

export default RoleProtectedRoute
