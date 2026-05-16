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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Key,
  User,
  Users,
  UserRound,
  Settings as SettingsIcon,
  ShieldCheck,
  Map
} from 'lucide-react'
import { db } from '@/lib/database'

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
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

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

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      setShowProfile(false)
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
    const baseNavigation = [
      { name: 'Shows', href: '/admin/shows', icon: Film },
      { name: 'Book Seats', href: '/admin/booking', icon: Ticket },
      { name: 'Activity Bookings', href: '/admin/activity-bookings', icon: Map },
      { name: 'Customers', href: '/admin/customers', icon: User },
      { name: 'Ticket History', href: '/admin/tickets', icon: Ticket },
    ]

    if (user?.role === 'admin') {
      return [
        { name: 'Dashboard', href: '/admin', icon: Home },
        ...baseNavigation,
        { name: 'Activities', href: '/admin/activities', icon: Map },
        { name: 'Layouts', href: '/admin/layouts', icon: LayoutGrid },
        { name: 'Customer Reports', href: '/admin/customer-reports', icon: FileText },
        { name: 'Reports', href: '/admin/reports', icon: BarChart },
        { name: 'Analytics', href: '/admin/analytics', icon: LineChart },
        { name: 'Agents', href: '/admin/agents', icon: Users },
        { name: 'Staff Management', href: '/admin/staff', icon: ShieldCheck },
        { name: 'Settings', href: '/admin/settings', icon: SettingsIcon },
      ]
    } else if (user?.role === 'agent') {
       return [
        { name: 'Book Seats', href: '/admin/booking', icon: Ticket },
        { name: 'Ticket History', href: '/admin/tickets', icon: Ticket },
       ]
    } else {
      return baseNavigation
    }
  }

  const navigation = getNavigation()

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
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center px-4 py-4 text-base font-medium rounded-xl transition-all duration-200 touch-manipulation ${isActive
                            ? darkMode
                              ? 'bg-slate-800 text-slate-100 shadow-sm border-l-4 border-slate-400'
                              : 'bg-slate-100 text-slate-900 shadow-sm border-l-4 border-slate-600'
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
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium text-base">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-base font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                    </div>
                    <div className={`text-sm truncate transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {user?.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={`p-2 rounded-lg transition-colors duration-200 touch-manipulation ${
                    signingOut 
                      ? 'opacity-50 cursor-not-allowed' 
                      : darkMode 
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LogOut className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block transition-all duration-300 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} ${darkMode ? 'lg:bg-slate-900 lg:border-r lg:border-slate-800' : 'lg:bg-white lg:border-r lg:border-slate-200'}`}>
        <div className={`flex h-16 items-center justify-between px-4 border-b transition-colors duration-200 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative w-8 h-8 flex-shrink-0 transition-transform hover:scale-105">
              <Image 
                src="/logo.png" 
                alt="Kovalam Kalari" 
                fill
                className="object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className={`text-sm font-black tracking-tighter leading-none truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>KOVALAM</span>
                <span className="text-[10px] font-bold tracking-widest text-amber-600 leading-none mt-0.5">KALARI</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="mt-8 px-2">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'} text-sm font-medium rounded-xl transition-all duration-200 group relative ${isActive
                      ? darkMode
                        ? 'bg-slate-800 text-slate-100 shadow-sm'
                        : 'bg-slate-100 text-slate-900 shadow-sm'
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

        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t transition-colors duration-200 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center group relative">
                <span className="text-white font-medium text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className={`p-2 rounded-lg transition-colors duration-200 group relative ${
                  signingOut 
                    ? 'opacity-50 cursor-not-allowed' 
                    : darkMode 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <LogOut className="h-4 w-4" />
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Sign Out
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                  </div>
                  <div className={`text-xs truncate transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {user?.email}
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  signingOut 
                    ? 'opacity-50 cursor-not-allowed' 
                    : darkMode 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
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
            <h1 className={`text-lg font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Kalari
            </h1>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Header - All Pages */}
      <div className={`sticky top-0 lg:top-0 z-40 transition-all duration-300 py-2 sm:py-4 px-0 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'} ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`mx-2 sm:mx-4 rounded-2xl shadow-sm border px-4 sm:px-6 py-3 sm:py-4 transition-colors duration-200 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="min-w-0">
                <h1 className={`text-lg font-medium transition-colors duration-200 truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  <span className="hidden sm:inline">Kalari Booking Dashboard</span>
                  <span className="sm:hidden">Kalari Booking</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 rounded-xl relative transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                >
                  <Bell className="h-5 w-5" />
                </button>
                {showNotifications && (
                   <div className="absolute right-0 mt-2 w-80 rounded-2xl shadow-xl border backdrop-blur-xl z-50 transition-all duration-200 bg-white/95 border-slate-200/50 dark:bg-slate-900/95 dark:border-slate-700/50 p-6">
                      <div className="text-center">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Coming Soon</p>
                        <p className="text-xs opacity-60">Real-time notifications are in development.</p>
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

              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className={`flex items-center space-x-2 p-2 rounded-xl transition-colors duration-200 ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center">
                    <span className="text-white font-medium text-xs">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-500 hidden sm:block" />
                </button>

                {showProfile && (
                  <div className={`absolute right-0 mt-2 w-44 rounded-xl shadow-lg border py-2 z-[60] transition-colors duration-200 backdrop-blur-sm ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                    <button
                      onClick={() => {
                        setShowProfile(false)
                        setShowPasswordModal(true)
                      }}
                      className={`flex items-center w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </button>
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={`flex items-center w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                        signingOut 
                          ? 'opacity-50 cursor-not-allowed' 
                          : darkMode 
                            ? 'text-slate-300 hover:bg-slate-800' 
                            : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {signingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <main className="p-3 sm:p-4 lg:p-6 min-h-screen">
          {children}
        </main>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="admin-modal-panel rounded-2xl p-6 max-w-md w-full transition-colors duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                Change Password
              </h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ newPassword: '', confirmPassword: '' })
                  setPasswordError('')
                }}
                className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  minLength={6}
                  className="admin-modal-field"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="admin-modal-field"
                  placeholder="Confirm new password"
                />
              </div>
              {passwordError && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{passwordError}</div>}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors duration-200 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors duration-200 ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''} bg-blue-600 text-white hover:bg-blue-700`}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
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
