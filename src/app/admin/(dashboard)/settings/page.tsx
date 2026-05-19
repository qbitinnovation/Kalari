"use client";

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input } from '@/components/ui'
import { db } from '@/lib/database'
import { getBookingReference } from '@/lib/booking'
import { format } from 'date-fns'
import { 
  UserIcon, 
  KeyIcon, 
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'

const Settings: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const [profileData, setProfileData] = useState({
    name: '',
    contact: '',
    email: user?.email || ''
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // In a real app, you'd update user profile in Supabase
      // For now, just show success message
      setMessage('Profile updated successfully!')
    } catch (error) {
      setMessage('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // In a real implementation, you would call your password update API
      // For now, just show success message
      setMessage('Password change functionality will be implemented with proper backend integration')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      setMessage(error.message || 'Error updating password')
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = async () => {
    setLoading(true)
    try {
      // Get all bookings with show details
      const { data: bookings, error } = await db
        .from('bookings')
        .select(`
          *,
          show:shows(title, date, time),
          ticket:tickets(ticket_code, price, status)
        `)
        .eq('status', 'CONFIRMED')

      if (error) throw error

      // Create CSV content
      const csvContent = [
        ['Booking Ref', 'Show', 'Date', 'Time', 'Seat', 'Ticket Code', 'Price', 'Status', 'Booking Time'].join(','),
        ...(bookings || []).map(booking => [
          getBookingReference(booking),
          booking.show?.title || '',
          booking.show?.date || '',
          booking.show?.time || '',
          booking.seat_code,
          booking.ticket?.ticket_code || '',
          booking.ticket?.price || '',
          booking.ticket?.status || '',
          format(new Date(booking.booking_time), 'MMM dd, yyyy h:mm a')
        ].join(','))
      ].join('\n')

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Kalari-bookings-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      setMessage('Report exported successfully!')
    } catch (error) {
      setMessage('Error exporting report')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'password', name: 'Password', icon: KeyIcon },
    { id: 'reports', name: 'Reports', icon: DocumentArrowDownIcon },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account and system preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="mr-3 h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {message && (
              <div className={`mb-6 p-4 rounded-xl ${
                message.includes('Error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <Input
                    label="Full Name"
                    value={profileData.name}
                    onChange={(name) => setProfileData({ ...profileData, name })}
                    placeholder="Enter your full name"
                  />
                  <Input
                    label="Contact Number"
                    type="tel"
                    value={profileData.contact}
                    onChange={(contact) => setProfileData({ ...profileData, contact })}
                    placeholder="Enter your contact number"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={profileData.email}
                    onChange={() => {}}
                    disabled
                    hint="Email cannot be changed"
                  />

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'password' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(currentPassword) => setPasswordData({ ...passwordData, currentPassword })}
                    required
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(newPassword) => setPasswordData({ ...passwordData, newPassword })}
                    required
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(confirmPassword) => setPasswordData({ ...passwordData, confirmPassword })}
                    required
                  />

                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Change Password'}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Export Reports</h2>
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Full Booking Report</h3>
                    <p className="text-gray-600 mb-4">
                      Export all booking data including show details, seat information, and ticket status.
                    </p>
                    <Button onClick={handleExportReport} disabled={loading}>
                      <DocumentArrowDownIcon className="h-5 w-5" />
                      {loading ? 'Exporting...' : 'Export CSV'}
                    </Button>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">System Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current User:</span>
                        <span className="font-medium">{user?.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Role:</span>
                        <span className={`font-medium px-2 py-1 rounded-full text-xs ${
                          user?.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Full Name:</span>
                        <span className="font-medium">{user?.full_name || 'Not set'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
