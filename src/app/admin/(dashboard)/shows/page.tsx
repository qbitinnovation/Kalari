"use client";

import React, { useState, useEffect } from 'react'
import { db, Show, Layout } from '@/lib/database'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logShowDeletion, logShowCreation, logShowUpdate } from '@/utils/activityLogger'
import { useAuth } from '@/contexts/AuthContext'
import { activityImages } from '@/lib/seedData'
import { isActiveBookingReservation } from '@/lib/booking'
import { Button, DatePicker, TimePicker, Input, Select, Textarea } from '@/components/ui'

const Shows: React.FC = () => {
  const { user } = useAuth()
  const [shows, setShows] = useState<Show[]>([])
  const [allShows, setAllShows] = useState<Show[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const darkMode = useDarkMode()
  const [showModal, setShowModal] = useState(false)
  const [editingShow, setEditingShow] = useState<Show | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    price: '',
    image: activityImages.kalari,
    description: '',
    type: 'KALARI' as 'KALARI' | 'EVENT',
    capacity: '',
    layout_id: '',
    activity_id: '',
    status: 'ACTIVE' as 'ACTIVE' | 'HOUSE_FULL' | 'SHOW_STARTED' | 'SHOW_DONE'
  })

  useEffect(() => {
    fetchShows()
    fetchLayouts()
    fetchActivities()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      const filteredShows = allShows.filter(show => show.date === selectedDate)
      setShows(filteredShows)
    } else {
      setShows(allShows)
    }
  }, [selectedDate, allShows])

  const fetchShows = async () => {
    try {
      const { data, error } = await db
        .from('shows')
        .select(`
          *,
          layout:layouts(*)
        `)
        .order('date', { ascending: false })

      if (error) throw error

      if (data) {
        await checkAndUpdateShowStatuses(data)
        const { data: updatedData } = await db
          .from('shows')
          .select(`
            *,
            layout:layouts(*)
          `)
          .order('date', { ascending: false })
        setAllShows(updatedData || [])
        setShows(updatedData || [])
      } else {
        setAllShows([])
        setShows([])
      }
    } catch (error) {
      console.error('Error fetching shows:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAndUpdateShowStatuses = async (shows: Show[]) => {
    for (const show of shows) {
      try {
        const showDateTime = new Date(`${show.date}T${show.time}`)
        const now = new Date()
        const thirtyMinutesAfterShow = new Date(showDateTime.getTime() + 30 * 60 * 1000)

        if (now > thirtyMinutesAfterShow && show.status !== 'SHOW_DONE') {
          await db.from('shows').update({ status: 'SHOW_DONE' }).eq('id', show.id || (show as any)._id)
          await db.from('tickets').update({ status: 'COMPLETED' }).eq('show_id', show.id || (show as any)._id).in('status', ['ACTIVE'])
        } else if (now > showDateTime && now <= thirtyMinutesAfterShow && show.status === 'ACTIVE') {
          await db.from('shows').update({ status: 'SHOW_STARTED' }).eq('id', show.id || (show as any)._id)
        } else if (now > showDateTime && show.status === 'HOUSE_FULL') {
          await db.from('shows').update({ status: 'SHOW_DONE' }).eq('id', show.id || (show as any)._id)
          await db.from('tickets').update({ status: 'COMPLETED' }).eq('show_id', show.id || (show as any)._id).in('status', ['ACTIVE'])
        } else if (show.status === 'ACTIVE') {
          const isHouseFull = await checkIfHouseFull(show)
          if (isHouseFull) {
            await db.from('shows').update({ status: 'HOUSE_FULL' }).eq('id', show.id || (show as any)._id)
          }
        }
      } catch (error) {
        console.error(`Error processing show status:`, error)
      }
    }
  }

  const checkIfHouseFull = async (show: Show) => {
    try {
      let totalSeats = 0
      if (show.type === 'EVENT') {
        totalSeats = show.capacity || 0
      } else if (show.layout) {
        totalSeats = show.layout.structure.sections?.reduce((total: number, section: any) => {
          if (section.rows && Array.isArray(section.rows)) {
            return total + section.rows.reduce((sum: number, row: any) => sum + (row.seats || 0), 0)
          }
          return total + ((section.rows || 0) * (section.seatsPerRow || 0))
        }, 0) || 0
      }

      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', show.id || (show as any)._id).in('status', ['CONFIRMED', 'HELD'])
      const bookedSeatsCount = bookings?.reduce((count: number, booking: any) => {
        if (!isActiveBookingReservation(booking)) return count
        try {
          const seats = JSON.parse(booking.seat_code)
          return count + (Array.isArray(seats) ? seats.length : 1)
        } catch {
          return count + (booking.seat_code.includes(',') ? booking.seat_code.split(',').length : 1)
        }
      }, 0) || 0

      return bookedSeatsCount >= totalSeats
    } catch (error) {
      console.error('Error checking if house is full:', error)
      return false
    }
  }

  const fetchLayouts = async () => {
    try {
      const { data, error } = await db.from('layouts').select('*').order('name')
      if (error) throw error
      setLayouts(data || [])
    } catch (error) {
      console.error('Error fetching layouts:', error)
    }
  }

  const fetchActivities = async () => {
    try {
      const { data } = await db.from('activities').select('*').order('title', { ascending: true })
      setActivities(data || [])
    } catch (error) {
      console.error('Error fetching activities:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const showData = {
        title: formData.title,
        date: formData.date,
        time: formData.time,
        price: parseFloat(formData.price),
        image: formData.image,
        description: formData.description,
        type: formData.type,
        capacity: formData.type === 'EVENT' ? parseInt(formData.capacity) : null,
        layout_id: formData.type === 'KALARI' ? formData.layout_id : null,
        activity_id: formData.activity_id || null,
        status: formData.status
      }

      const userEmail = user?.email || 'unknown'

      if (editingShow) {
        const showId = editingShow.id || (editingShow as any)._id
        const { error } = await db.from('shows').update(showData).eq('id', showId)
        if (error) throw error
        await logShowUpdate(showId, showData.title, userEmail, { updated_at: new Date().toISOString() })
      } else {
        const { data: newShow, error } = await db.from('shows').insert([showData]).select()
        if (error) throw error
        if (newShow?.[0]) {
          const newId = newShow[0].id || newShow[0]._id
          await logShowCreation(newId, showData.title, userEmail, { created_at: new Date().toISOString() })
        }
      }

      setShowModal(false)
      setEditingShow(null)
      resetForm()
      await fetchShows()
    } catch (error) {
      console.error('Error saving show:', error)
    }
  }

  const handleEdit = (show: Show) => {
    setEditingShow(show)
    setFormData({
      title: show.title,
      date: show.date,
      time: show.time,
      price: show.price.toString(),
      image: show.image || activityImages.kalari,
      description: show.description || '',
      type: show.type || 'KALARI',
      capacity: show.capacity?.toString() || '',
      layout_id: show.layout_id || '',
      activity_id: (show as any).activity_id || '',
      status: (show.status as any) || 'ACTIVE'
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this show?')) {
      try {
        const { data: showToDelete } = await db.from('shows').select('title, date, time').eq('id', id).single()
        const { error } = await db.from('shows').delete().eq('id', id)
        if (error) throw error

        if (showToDelete) {
          const userEmail = user?.email || 'unknown'
          await logShowDeletion(id, showToDelete.title, userEmail, { deleted_at: new Date().toISOString() })
        }
        fetchShows()
      } catch (error) {
        console.error('Error deleting show:', error)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      date: '',
      time: '',
      price: '',
      image: activityImages.kalari,
      description: '',
      type: 'KALARI',
      capacity: '',
      layout_id: '',
      activity_id: '',
      status: 'ACTIVE'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Shows
          </h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage show timings and schedules
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={() => {
              resetForm()
              setEditingShow(null)
              setShowModal(true)
            }}
            className="touch-manipulation"
          >
            <Plus className="h-5 w-5" />
            Add Show
          </Button>
        </div>
      </div>

      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`text-lg font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Filter by Date</h2>
        <DatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          placeholder="All dates"
          presets={[
            { label: 'Clear', value: 'clear' },
            { label: 'Today', value: 'today' },
          ]}
        />
      </div>

      <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y transition-colors duration-200 ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
            <thead className={darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Show Details</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">Layout/Type</th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {shows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center opacity-50">No shows found.</td>
                </tr>
              ) : (
                shows.map((show) => (
                  <tr key={show.id || (show as any)._id} className={darkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={show.image || activityImages.kalari} alt={show.title} className="h-12 w-16 rounded-lg object-cover" />
                        <div>
                          <div className="font-medium">{show.title}</div>
                          <div className="text-sm opacity-60">{show.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{format(new Date(show.date), 'MMM dd, yyyy')}</div>
                      <div className="text-sm opacity-60">{format(new Date(`2000-01-01T${show.time}`), 'h:mm a')}</div>
                    </td>
                    <td className="px-6 py-4 text-center">₹{show.price}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm">
                        {show.type === 'EVENT' ? `Event (${show.capacity} seats)` : (show.layout?.name || 'Kalari')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        show.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        show.status === 'HOUSE_FULL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {show.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(show)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(show.id || (show as any)._id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="admin-modal-overlay">
          <form onSubmit={handleSubmit} className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">{editingShow ? 'Edit Show' : 'Add Show'}</h2>
                <p className="admin-modal-subtitle">Choose a layout for Kalari shows or a ticket limit for event slots.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="admin-modal-close" aria-label="Close modal">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-4">
              <Input label="Title" value={formData.title} onChange={(title) => setFormData({ ...formData, title })} required />
              <Select
                label="Linked Activity"
                value={formData.activity_id || '__none__'}
                onChange={(activity_id) => setFormData({ ...formData, activity_id: activity_id === '__none__' ? '' : activity_id })}
                placeholder="No linked activity"
                options={[
                  { value: '__none__', label: 'No linked activity' },
                  ...activities.map((activity) => ({
                    value: String(activity.id || activity._id),
                    label: activity.title,
                  })),
                ]}
              />
              <div className="flex gap-4 text-sm font-semibold">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <input type="radio" name="type" value="KALARI" checked={formData.type === 'KALARI'} onChange={() => setFormData({...formData, type: 'KALARI'})} /> Kalari
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <input type="radio" name="type" value="EVENT" checked={formData.type === 'EVENT'} onChange={() => setFormData({...formData, type: 'EVENT'})} /> Event
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DatePicker
                  label="Date"
                  value={formData.date}
                  onChange={(date) => setFormData({ ...formData, date })}
                  required
                />
                <TimePicker
                  label="Time"
                  value={formData.time}
                  onChange={(time) => setFormData({ ...formData, time })}
                  required
                />
              </div>
              <Input
                label="Price (Rs.)"
                type="number"
                value={formData.price}
                onChange={(price) => setFormData({ ...formData, price })}
                required
              />
              <Select
                label="Status"
                value={formData.status}
                onChange={(status) => setFormData({ ...formData, status: status as typeof formData.status })}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'HOUSE_FULL', label: 'Sold Out / House Full' },
                  { value: 'SHOW_STARTED', label: 'Show Started' },
                  { value: 'SHOW_DONE', label: 'Show Done' },
                ]}
              />
              <Input
                label="Image URL"
                type="url"
                value={formData.image}
                onChange={(image) => setFormData({ ...formData, image })}
                placeholder="https://..."
                required
              />
              {formData.type === 'KALARI' ? (
                <Select
                  label="Layout"
                  value={formData.layout_id || '__none__'}
                  onChange={(layout_id) => setFormData({ ...formData, layout_id: layout_id === '__none__' ? '' : layout_id })}
                  placeholder="Select Layout"
                  required
                  options={[
                    { value: '__none__', label: 'Select Layout' },
                    ...layouts.map((l) => ({
                      value: String(l.id || (l as { _id?: string })._id),
                      label: l.name,
                    })),
                  ]}
                />
              ) : (
                <Input
                  label="Ticket Limit"
                  type="number"
                  value={formData.capacity}
                  onChange={(capacity) => setFormData({ ...formData, capacity })}
                  required
                />
              )}
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(description) => setFormData({ ...formData, description })}
                rows={4}
              />
            </div>
            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Save Show</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Shows
