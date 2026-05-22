"use client";

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardProvider } from '@/contexts/DashboardContext'
import RoleProtectedRoute from '@/components/RoleProtectedRoute'
import {
  Home,
  Film,
  Ticket,
  FileText,
  LogOut,
  LayoutGrid,
  BarChart,
  LineChart,
  Menu,
  X,
  Bell,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  UserRound,
  Settings as SettingsIcon,
  ShieldCheck,
  Map
} from 'lucide-react'
import { db, type Notification } from '@/lib/database'
import { Button, Input } from '@/components/ui'

const AdminLayoutUI: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedCollapsed = localStorage.getItem('sidebarCollapsed')
      return savedCollapsed ? JSON.parse(savedCollapsed) : false
    }
    return false
  })
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDarkMode = localStorage.getItem('darkMode')
      return savedDarkMode ? JSON.parse(savedDarkMode) : false
    }
    return false
  })
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const notificationId = (notification: Notification) => String(notification.id || notification._id || '')

  useEffect(() => {
    if (!user) return
    const staffRoutes = ['/admin/shows', '/admin/activities', '/admin/booking', '/admin/tickets', '/admin/customers', '/admin/activity-bookings']
    const agentRoutes = ['/admin/booking', '/admin/tickets']
    if (user.role === 'staff' && !staffRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
      router.replace('/admin/booking')
    }
    if (user.role === 'agent' && !agentRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
      router.replace('/admin/booking')
    }
  }, [pathname, router, user])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  const fetchNotifications = React.useCallback(async () => {
    if (!user?.role) return
    setNotificationsLoading(true)
    try {
      const response = await fetch(`/api/notifications?role=${encodeURIComponent(user.role)}&limit=12`)
      const payload = await response.json().catch(() => ({}))
      if (response.ok) setNotifications(payload.data || [])
    } finally {
      setNotificationsLoading(false)
    }
  }, [user?.role])

  useEffect(() => {
    fetchNotifications()
    if (!user?.role) return
    const interval = window.setInterval(fetchNotifications, 60000)
    return () => window.clearInterval(interval)
  }, [fetchNotifications, user?.role])

  const markNotificationRead = async (notification: Notification) => {
    if (!user?.id || (notification.read_by || []).includes(user.id)) return
    const id = notificationId(notification)
    if (!id) return
    setNotifications((current) => current.map((item) =>
      notificationId(item) === id ? { ...item, read_by: [...(item.read_by || []), user.id] } : item
    ))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id, userId: user.id }),
    }).catch(() => null)
  }

  const openNotification = async (notification: Notification) => {
    await markNotificationRead(notification)
    setShowNotifications(false)
    if (notification.action_url) router.push(notification.action_url)
  }

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await signOut()
      router.push('/admin/login')
    } catch (error) {
      console.error('Error signing out:', error)
      localStorage.clear()
      router.push('/admin/login')
    } finally {
      setSigningOut(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    
    try {
      setPasswordLoading(true)
      
      const { error } = await db.rpc('change_password', {
        userId: user?.id || (user as any)?._id,
        newPassword: passwordForm.newPassword
      })
      
      if (error) throw error
      
      setShowPasswordModal(false)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      alert('Password updated successfully!')
      
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to update password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const getNavigation = () => {
    const staffNavigation = [
      { name: 'Shows', href: '/admin/shows', icon: Film },
      { name: 'Book Seats', href: '/admin/booking', icon: Ticket },
      { name: 'Activity Bookings', href: '/admin/activity-bookings', icon: Map },
      { name: 'Customers', href: '/admin/customers', icon: User },
      { name: 'Ticket History', href: '/admin/tickets', icon: Ticket },
      { name: 'Activities', href: '/admin/activities', icon: Map },
    ]
    const agentNavigation = [
      { name: 'Book Seats', href: '/admin/booking', icon: Ticket },
      { name: 'Ticket History', href: '/admin/tickets', icon: Ticket },
    ]

    if (user?.role === 'admin') {
      return [
        { name: 'Dashboard', href: '/admin', icon: Home },
        ...staffNavigation,
        { name: 'Layouts', href: '/admin/layouts', icon: LayoutGrid },
        { name: 'Customer Reports', href: '/admin/customer-reports', icon: FileText },
        { name: 'Reports', href: '/admin/reports', icon: BarChart },
        { name: 'Analytics', href: '/admin/analytics', icon: LineChart },
        { name: 'Agents', href: '/admin/agents', icon: Users },
        { name: 'Staff Management', href: '/admin/staff', icon: ShieldCheck },
        { name: 'Settings', href: '/admin/settings', icon: SettingsIcon },
      ]
    } else if (user?.role === 'agent') {
       return agentNavigation
    } else {
      return staffNavigation
    }
  }

  const navigation = getNavigation()
  const displayName = user?.full_name || `${user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'} User`
  const userInitial = (user?.full_name || user?.email || 'A').charAt(0).toUpperCase()
  const routeLabels: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/shows': 'Shows',
    '/admin/booking': 'Book Seats',
    '/admin/activity-bookings': 'Activity Bookings',
    '/admin/customers': 'Customers',
    '/admin/tickets': 'Ticket History',
    '/admin/activities': 'Activities',
    '/admin/layouts': 'Seat Layouts',
    '/admin/customer-reports': 'Customer Reports',
    '/admin/reports': 'Reports',
    '/admin/analytics': 'Analytics',
    '/admin/agents': 'Agents',
    '/admin/staff': 'Staff Management',
    '/admin/settings': 'Settings',
  }
  const formatSegment = (segment: string) => segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments[0] !== 'admin') return [{ label: 'Dashboard', href: '/admin' }]

    const trail = [{ label: 'Dashboard', href: '/admin' }]
    let currentPath = '/admin'
    segments.slice(1).forEach((segment, index) => {
      currentPath += `/${segment}`
      const parentPath = currentPath.split('/').slice(0, -1).join('/')
      const isLast = index === segments.length - 2
      const looksLikeId = segment.length > 16 || /^[a-f0-9]{12,}$/i.test(segment)
      const label = routeLabels[currentPath] || (looksLikeId ? `${routeLabels[parentPath] || 'Record'} Detail` : formatSegment(segment))
      trail.push({ label, href: isLast ? currentPath : currentPath })
    })
    return trail
  }, [pathname])
  const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label || 'Dashboard'
  const unreadNotifications = notifications.filter((notification) => !(notification.read_by || []).includes(user?.id || '')).length

  return (
    <div className={`admin-portal min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
          <div className={`fixed inset-y-0 left-0 w-72 sm:w-64 shadow-2xl transition-colors duration-200 flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className={`flex h-16 items-center justify-between px-4 sm:px-6 border-b flex-shrink-0 transition-colors duration-200 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-3">
                <div className="relative w-10 h-10 transition-transform hover:scale-105">
                  <Image 
                    src="/logo.png" 
                    alt="Kovalam Kalari" 
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <span className={`text-lg font-black tracking-tighter leading-none ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>KOVALAM</span>
                  <span className="text-xs font-bold tracking-widest text-amber-600 leading-none mt-0.5">KALARI</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-2 rounded-lg transition-colors duration-200 touch-manipulation ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <nav className="mt-8 px-4 pb-4">
                <ul className="space-y-2">
                  {navigation.map((item) => {
                    const isActive = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center px-4 py-4 text-base font-medium rounded-xl transition-all duration-200 touch-manipulation ${isActive
                            ? 'admin-nav-link-active'
                            : darkMode
                              ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                          <item.icon className="h-6 w-6 mr-4 flex-shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>

            <div className={`flex-shrink-0 p-4 border-t transition-colors duration-200 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center">
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={`flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest transition-colors duration-200 touch-manipulation ${
                    signingOut 
                      ? 'opacity-50 cursor-not-allowed' 
                      : darkMode 
                        ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <LogOut className="h-6 w-6" />
                  {signingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} ${darkMode ? 'lg:bg-slate-900 lg:border-r lg:border-slate-800' : 'lg:bg-white lg:border-r lg:border-slate-200'}`}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`absolute -right-3 top-24 z-[70] flex h-7 w-7 items-center justify-center rounded-full border shadow-md transition-colors duration-200 ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <div className={`flex h-20 items-center px-4 border-b transition-colors duration-200 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative w-10 h-10 flex-shrink-0 transition-transform hover:scale-105">
              <Image 
                src="/logo.png" 
                alt="Kovalam Kalari" 
                fill
                className="object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className={`text-base font-black tracking-tighter leading-none truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>KOVALAM</span>
                <span className="text-[11px] font-bold tracking-widest text-amber-600 leading-none mt-1">KALARI</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'} text-sm font-bold rounded-xl transition-all duration-200 group relative ${isActive
                      ? 'admin-nav-link-active'
                      : darkMode
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <item.icon className={`h-5 w-5 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                    {sidebarCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={`shrink-0 border-t p-4 transition-colors duration-200 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className={`group relative flex w-full items-center rounded-xl text-sm font-bold transition-all duration-200 ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'} ${
              signingOut
                ? 'opacity-50 cursor-not-allowed'
                : darkMode
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LogOut className={`h-5 w-5 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'}`} />
            {!sidebarCollapsed && <span>{signingOut ? 'Logging out...' : 'Logout'}</span>}
            {sidebarCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className={`lg:hidden border-b px-4 py-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-2 rounded-lg transition-colors duration-200 touch-manipulation ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">K</span>
            </div>
            <h1 className={`max-w-[12rem] truncate text-lg font-black transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {currentPageTitle}
            </h1>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Header — desktop, same height as sidebar logo row (h-20) */}
      <div
        className={`sticky top-0 z-40 hidden transition-all duration-300 lg:block ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}
      >
        <div
          className={`flex h-20 items-center justify-between border-b px-4 sm:px-6 transition-colors duration-200 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
        >
            <div className="min-w-0 flex-1">
              <nav className={`flex min-w-0 items-center gap-1 text-sm font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={`${crumb.href}-${index}`}>
                    {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="truncate text-amber-600">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className={`truncate ${darkMode ? 'hover:text-slate-200' : 'hover:text-slate-900'}`}>
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications)
                    if (!showNotifications) fetchNotifications()
                  }}
                  className={`p-2 rounded-xl relative transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-stone-950">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </button>
                {showNotifications && (
                   <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white/95 shadow-xl backdrop-blur-xl transition-all duration-200 z-50 border-slate-200/50 dark:bg-slate-900/95 dark:border-slate-700/50">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-black">Notifications</p>
                          <p className="text-xs opacity-60">{unreadNotifications} unread for {user?.role}</p>
                        </div>
                        <button onClick={fetchNotifications} className={`rounded-lg px-2 py-1 text-xs font-bold ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                          Refresh
                        </button>
                      </div>
                      <div className="max-h-[26rem] overflow-y-auto p-2">
                        {notificationsLoading && notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm font-bold opacity-60">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell className="mx-auto mb-2 h-7 w-7 opacity-40" />
                            <p className="text-sm font-bold">No notifications yet</p>
                          </div>
                        ) : notifications.map((notification) => {
                          const unread = !(notification.read_by || []).includes(user?.id || '')
                          return (
                            <button
                              key={notificationId(notification)}
                              onClick={() => openNotification(notification)}
                              className={`mb-1 w-full rounded-xl border p-3 text-left transition-colors ${unread ? darkMode ? 'border-amber-800/70 bg-amber-950/25' : 'border-amber-200 bg-amber-50' : darkMode ? 'border-slate-800 hover:bg-slate-800/70' : 'border-slate-100 hover:bg-slate-50'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{notification.module}</p>
                                  <p className="mt-1 text-sm font-black">{notification.title}</p>
                                </div>
                                {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                              </div>
                              <p className="mt-1 text-xs font-semibold leading-5 opacity-70">{notification.message}</p>
                              <p className="mt-2 text-[10px] font-bold opacity-40">{new Date(notification.created_at).toLocaleString()}</p>
                            </button>
                          )
                        })}
                      </div>
                   </div>
                )}
              </div>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-xl transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className={`hidden items-center gap-3 rounded-2xl border px-3 py-2 sm:flex ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800">
                  <span className="text-sm font-bold text-white">{userInitial}</span>
                </div>
                <div className="min-w-0 text-left">
                  <div className={`max-w-40 truncate text-sm font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{displayName}</div>
                  <div className={`max-w-44 truncate text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <main className="min-h-screen px-2 pb-4 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pb-6">
          <div className="admin-page-surface min-h-[calc(100vh-8.5rem)] rounded-2xl border p-4 shadow-sm sm:p-6">
            {children}
          </div>
        </main>
      </div>

      {showPasswordModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Change Password</h2>
                <p className="admin-modal-subtitle">Update the password for the current admin session.</p>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ newPassword: '', confirmPassword: '' })
                  setPasswordError('')
                }}
                className="admin-modal-close"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="flex min-h-0 flex-1 flex-col">
              <div className="admin-modal-body space-y-4">
              <Input
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(newPassword) => setPasswordForm({ ...passwordForm, newPassword })}
                required
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(confirmPassword) => setPasswordForm({ ...passwordForm, confirmPassword })}
                required
                placeholder="Confirm new password"
              />
              {passwordError && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{passwordError}</div>}
              </div>
              <div className="admin-modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProtectedRoute allowedRoles={['admin', 'staff', 'agent']}>
      <DashboardProvider>
        <AdminLayoutUI>
          {children}
        </AdminLayoutUI>
      </DashboardProvider>
    </RoleProtectedRoute>
  )
}
