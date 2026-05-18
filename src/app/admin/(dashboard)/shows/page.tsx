"use client";

import React, { useState, useEffect } from 'react'
import { db, Show, Layout } from '@/lib/database'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { logShowDeletion, logShowCreation, logShowUpdate } from '@/utils/activityLogger'
import { useAuth } from '@/contexts/AuthContext'
import { activityImages } from '@/lib/seedData'

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

      const { data: bookings } = await db.from('bookings').select('seat_code').eq('show_id', show.id || (show as any)._id).eq('status', 'CONFIRMED')
      const bookedSeatsCount = bookings?.reduce((count: number, booking: any) => {
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
          <button
            onClick={() => {
              resetForm()
              setEditingShow(null)
              setShowModal(true)
            }}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-all duration-200 flex items-center justify-center touch-manipulation shadow-sm dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            <span>Add Show</span>
          </button>
        </div>
      </div>

      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h2 className={`text-lg font-medium mb-4 transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>Filter by Date</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                darkMode 
                  ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedDate('')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Clear
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700"
            >
              Today
            </button>
          </div>
        </div>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="admin-modal-panel rounded-2xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto transition-colors duration-200">
            <h2 className="text-2xl font-bold mb-6">{editingShow ? 'Edit Show' : 'Add New Show'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="admin-modal-label">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="admin-modal-field" />
              </div>
              <div>
                <label className="admin-modal-label">Linked Activity</label>
                <select value={formData.activity_id} onChange={e => setFormData({...formData, activity_id: e.target.value})} className="admin-modal-field">
                  <option value="">No linked activity</option>
                  {activities.map(activity => <option key={activity.id || activity._id} value={activity.id || activity._id}>{activity.title}</option>)}
                </select>
              </div>
              <div className="flex gap-4 text-sm font-semibold">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <input type="radio" name="type" value="KALARI" checked={formData.type === 'KALARI'} onChange={() => setFormData({...formData, type: 'KALARI'})} /> Kalari
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <input type="radio" name="type" value="EVENT" checked={formData.type === 'EVENT'} onChange={() => setFormData({...formData, type: 'EVENT'})} /> Event
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="admin-modal-label">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="admin-modal-field" />
                </div>
                <div>
                  <label className="admin-modal-label">Time</label>
                  <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required className="admin-modal-field" />
                </div>
              </div>
              <div>
                <label className="admin-modal-label">Price (Rs.)</label>
                <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required className="admin-modal-field" />
              </div>
              <div>
                <label className="admin-modal-label">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="admin-modal-field">
                  <option value="ACTIVE">Active</option>
                  <option value="HOUSE_FULL">Sold Out / House Full</option>
                  <option value="SHOW_STARTED">Show Started</option>
                  <option value="SHOW_DONE">Show Done</option>
                </select>
              </div>
              <div>
                <label className="admin-modal-label">Image URL</label>
                <input type="url" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} required className="admin-modal-field" placeholder="https://..." />
              </div>
              {formData.type === 'KALARI' ? (
                <div>
                  <label className="admin-modal-label">Layout</label>
                  <select value={formData.layout_id} onChange={e => setFormData({...formData, layout_id: e.target.value})} required className="admin-modal-field">
                    <option value="">Select Layout</option>
                    {layouts.map(l => <option key={l.id || (l as any)._id} value={l.id || (l as any)._id}>{l.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="admin-modal-label">Capacity</label>
                  <input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} required className="admin-modal-field" />
                </div>
              )}
              <div>
                <label className="admin-modal-label">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={4} className="admin-modal-field" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Shows
