"use client";

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/database'
import { motion, AnimatePresence } from 'framer-motion'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Button } from '@/components/ui'
import {
  Plus,
  Trash2,
  User,
  AlertTriangle,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Search,
  Percent,
  Mail,
  X,
  Check,
  Eye
} from 'lucide-react'
import Link from 'next/link'

interface Agent {
  id: string
  _id?: string
  email: string
  role: string
  full_name: string
  commission_percentage?: number
  created_at: string
  active: boolean
}

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '', commission_percentage: 0 })
  const [editFormData, setEditFormData] = useState({ email: '', full_name: '', commission_percentage: 0, active: true })
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [agentToDeactivate, setAgentToDeactivate] = useState<string | null>(null)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const darkMode = useDarkMode()

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.from('users').select('*').eq('role', 'agent').order('created_at', { ascending: false })
      if (error) throw error
      setAgents(data || [])
    } catch (error: any) {
      setError('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError('')
    try {
      const { data, error } = await db.rpc('create_user', {
        p_email: formData.email,
        p_password: formData.password,
        p_role: 'agent',
        p_full_name: formData.full_name,
        p_commission_percentage: formData.commission_percentage
      })
      if (error) throw error
      if (data.success) {
        setFormData({ email: '', password: '', full_name: '', commission_percentage: 0 })
        setShowAddForm(false)
        fetchAgents()
      } else {
        setError(data.error || 'Failed to create agent')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create agent')
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAgent) return
    setFormLoading(true)
    setError('')
    try {
      const { error } = await db.from('users').update({
        email: editFormData.email,
        full_name: editFormData.full_name,
        commission_percentage: Number(editFormData.commission_percentage),
        active: editFormData.active,
        updated_at: new Date().toISOString()
      }).eq('id', editingAgent.id || (editingAgent as any)._id)
      if (error) throw error
      setShowEditForm(false)
      setEditingAgent(null)
      fetchAgents()
    } catch (error: any) {
      setError(error.message || 'Failed to update agent')
    } finally {
      setFormLoading(false)
    }
  }

  const handleToggleStatus = async (agent: Agent) => {
     try {
       const { error } = await db.from('users').update({ active: !agent.active }).eq('id', agent.id || (agent as any)._id)
       if (error) throw error
       fetchAgents()
     } catch (err) {
       setError('Failed to update status')
     }
  }

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return
    try {
      const { error } = await db.from('users').delete().eq('id', agentToDelete)
      if (error) throw error
      fetchAgents()
      setShowDeleteDialog(false)
      setAgentToDelete(null)
    } catch (error: any) {
      setError('Failed to delete agent')
    }
  }

  const filteredAgents = agents.filter(a => 
    a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agents Management</h1>
          <p className="text-sm opacity-60">Control booking permissions and commission rates</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-5 w-5" />
          Add Agent
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
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
              <h2 className="text-xl font-bold">{showAddForm ? 'Create New Agent' : 'Edit Agent Profile'}</h2>
              <button onClick={() => { setShowAddForm(false); setShowEditForm(false); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><X className="h-5 w-5" /></button>
            </div>
            
            <form onSubmit={showAddForm ? handleAddAgent : handleUpdateAgent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Full Name</label>
                <input 
                  type="text" 
                  value={showAddForm ? formData.full_name : editFormData.full_name} 
                  onChange={e => showAddForm ? setFormData({...formData, full_name: e.target.value}) : setEditFormData({...editFormData, full_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Agent Name"
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
                  placeholder="agent@example.com"
                  required
                />
              </div>
              {showAddForm && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Password</label>
                  <input 
                    type="password" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Commission Percentage (%)</label>
                <div className="relative">
                  <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                  <input 
                    type="number" 
                    step="0.1"
                    value={showAddForm ? formData.commission_percentage : editFormData.commission_percentage} 
                    onChange={e => showAddForm ? setFormData({...formData, commission_percentage: Number(e.target.value)}) : setEditFormData({...editFormData, commission_percentage: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0.0"
                  />
                </div>
              </div>
              
              <div className="md:col-span-2 pt-4 flex gap-3">
                <Button
                  type="submit"
                  disabled={formLoading}
                  fullWidth
                  className="uppercase tracking-widest"
                >
                  {formLoading ? 'Processing...' : showAddForm ? 'Create Agent' : 'Update Agent'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`rounded-3xl border overflow-hidden ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Filter agents by name or email..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border dark:bg-gray-800 dark:border-gray-700 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Agent</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Commission</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Registered</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filteredAgents.map(agent => (
                <tr key={agent.id || (agent as any)._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center font-black text-sm">
                        {agent.full_name?.charAt(0) || <User className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="font-bold">{agent.full_name || 'Unnamed Agent'}</div>
                        <div className="text-xs opacity-50 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" /> {agent.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-black text-amber-600">
                      <Percent className="h-4 w-4" />
                      <span>{agent.commission_percentage || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleToggleStatus(agent)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${agent.active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200 opacity-50'}`}
                    >
                      {agent.active ? <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Active</span> : <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Disabled</span>}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold opacity-40">
                    {new Date(agent.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/agents/${agent.id || (agent as any)._id}`}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button 
                        onClick={() => {
                          setEditingAgent(agent);
                          setEditFormData({ email: agent.email, full_name: agent.full_name || '', commission_percentage: agent.commission_percentage || 0, active: agent.active });
                          setShowEditForm(true);
                        }}
                        className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => { setAgentToDelete(agent.id || (agent as any)._id); setShowDeleteDialog(true); }}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAgents.length === 0 && <tr><td colSpan={5} className="py-20 text-center opacity-40 font-bold">No agents found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <div className="admin-modal-overlay">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteDialog(false)} className="absolute inset-0" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="admin-modal-panel admin-modal-card text-center">
              <div className="h-20 w-20 bg-red-100 text-red-600 rounded-[30px] flex items-center justify-center mx-auto mb-6"><AlertTriangle className="h-10 w-10" /></div>
              <h3 className="admin-modal-title mb-2">Delete Agent?</h3>
              <p className="admin-modal-subtitle mb-8">This will permanently remove the agent and all associated commission data. This action cannot be undone.</p>
              <div className="admin-modal-footer">
                <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                <Button variant="danger" onClick={confirmDeleteAgent}>Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AgentsPage
