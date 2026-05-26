"use client";

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/database'
import { motion, AnimatePresence } from 'framer-motion'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useAuth } from '@/contexts/AuthContext'
import { AdminTable, AdminTableBody, AdminTableEmpty, AdminTableHead, AdminTablePanel, Button, SearchInput } from '@/components/ui'
import { formatDisplayDateValue } from '@/components/ui/date-utils'
import { toDisplayInitial, toDisplayTitle } from '@/lib/textFormat'
import {
  Plus,
  Trash2,
  User,
  AlertTriangle,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Mail,
  X,
  Check,
  UserPlus,
  Shield,
  Key
} from 'lucide-react'

interface Staff {
  id: string
  _id?: string
  email: string
  role: string
  full_name: string
  created_at: string
  active: boolean
}

const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingUser, setEditingUser] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', role: 'staff' })
  const [editFormData, setEditFormData] = useState({ email: '', full_name: '', role: 'staff', active: true })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const darkMode = useDarkMode()
  const { user: currentUser } = useAuth()

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.from('users').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setStaff(data || [])
    } catch (error: any) {
      setError('Failed to load staff members')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data, error } = await db.rpc('create_user', {
        p_email: formData.email,
        p_password: formData.password,
        p_role: formData.role,
        p_full_name: formData.full_name
      })
      if (error) throw error
      if (data.success) {
        setFormData({ email: '', password: '', full_name: '', role: 'staff' })
        setShowAddForm(false)
        fetchStaff()
      } else {
        setError(data.error || 'Failed to create user')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create user')
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormLoading(true)
    setError('')
    try {
      const { error } = await db.from('users').update({
        email: editFormData.email,
        full_name: editFormData.full_name,
        role: editFormData.role,
        active: editFormData.active,
        updated_at: new Date().toISOString()
      }).eq('id', editingUser.id || (editingUser as any)._id)
      if (error) throw error
      setShowEditForm(false)
      setEditingUser(null)
      fetchStaff()
    } catch (error: any) {
      setError(error.message || 'Failed to update user')
    } finally {
      setFormLoading(false)
    }
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    try {
      const { error } = await db.from('users').delete().eq('id', userToDelete)
      if (error) throw error
      fetchStaff()
      setShowDeleteDialog(false)
      setUserToDelete(null)
    } catch (error: any) {
      setError('Failed to delete user')
    }
  }

  const filteredStaff = staff.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm opacity-60">Manage administrative access and system roles</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search team members..." containerClassName="w-full sm:w-80" />
          <Button onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-5 w-5" />
            Add Team Member
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      <AnimatePresence>
        {(showAddForm || showEditForm) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className={`p-8 rounded-3xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-xl'}`}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">{showAddForm ? 'Register New Staff' : 'Edit Member Access'}</h2>
              <button onClick={() => { setShowAddForm(false); setShowEditForm(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <form onSubmit={showAddForm ? handleAddStaff : handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Full Name</label>
                <input 
                  type="text" 
                  value={showAddForm ? formData.full_name : editFormData.full_name} 
                  onChange={e => showAddForm ? setFormData({...formData, full_name: e.target.value}) : setEditFormData({...editFormData, full_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Email Address</label>
                <input 
                  type="email" 
                  value={showAddForm ? formData.email : editFormData.email} 
                  onChange={e => showAddForm ? setFormData({...formData, email: e.target.value}) : setEditFormData({...editFormData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="email@example.com"
                  required
                />
              </div>
              {showAddForm && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Initial Password</label>
                  <div className="relative">
                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                    <input 
                      type="password" 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">System Role</label>
                <select 
                  value={showAddForm ? formData.role : editFormData.role} 
                  onChange={e => showAddForm ? setFormData({...formData, role: e.target.value}) : setEditFormData({...editFormData, role: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="staff">Staff Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              
              <div className="md:col-span-2 pt-4 flex gap-3">
                <Button
                  type="submit"
                  disabled={formLoading}
                  fullWidth
                  className="uppercase tracking-widest"
                >
                  {formLoading ? 'Processing...' : showAddForm ? 'Create Account' : 'Update Profile'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminTablePanel>
        <div className="overflow-x-auto">
          <AdminTable>
            <AdminTableHead>
              <tr className={darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Team Member</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Role</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Added On</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Actions</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {filteredStaff.map(member => (
                <tr key={member.id || (member as any)._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm ${member.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-600'}`}>
                        {member.full_name ? toDisplayInitial(member.full_name) : <User className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="font-bold">{toDisplayTitle(member.full_name, 'No Name')} {member.id === currentUser?.id && <span className="ml-2 px-1.5 py-0.5 rounded-md bg-stone-100 text-[8px] uppercase tracking-widest">You</span>}</div>
                        <div className="text-xs opacity-50 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" /> {member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-black text-xs uppercase tracking-widest opacity-60">
                      <Shield className={`h-3 w-3 ${member.role === 'admin' ? 'text-amber-600' : 'text-stone-400'}`} />
                      <span>{member.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${member.active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200 opacity-50'}`}>
                      {member.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold opacity-40">
                    {formatDisplayDateValue(member.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingUser(member);
                          setEditFormData({ email: member.email, full_name: member.full_name || '', role: member.role, active: member.active });
                          setShowEditForm(true);
                        }}
                        className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {member.id !== currentUser?.id && (
                        <button 
                          onClick={() => { setUserToDelete(member.id || (member as any)._id); setShowDeleteDialog(true); }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && <AdminTableEmpty colSpan={5}>No team members found.</AdminTableEmpty>}
            </AdminTableBody>
          </AdminTable>
        </div>
      </AdminTablePanel>

      {/* Delete Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <div className="admin-modal-overlay">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteDialog(false)} className="absolute inset-0" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="admin-modal-panel admin-modal-card text-center">
              <div className="h-20 w-20 bg-red-100 text-red-600 rounded-[30px] flex items-center justify-center mx-auto mb-6"><AlertTriangle className="h-10 w-10" /></div>
              <h3 className="admin-modal-title mb-2">Delete Member?</h3>
              <p className="admin-modal-subtitle mb-8">This will permanently revoke all system access for this member. This action cannot be reversed.</p>
              <div className="admin-modal-footer">
                <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                <Button variant="danger" onClick={confirmDeleteUser}>Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default StaffPage
