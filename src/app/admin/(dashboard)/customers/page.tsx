"use client";

import React, { useState, useEffect } from 'react'
import { db, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const darkMode = useDarkMode()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data, error } = await db
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required'
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (formData.phone && !/^[+]?[0-9\-\s()]{10,}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    try {
      setSubmitting(true)
      
      if (editingCustomer) {
        // Update existing customer
        const { error } = await db
          .from('customers')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCustomer.id)
        
        if (error) throw error
      } else {
        // Create new customer
        const { error } = await db
          .from('customers')
          .insert([formData])
        
        if (error) throw error
      }
      
      await fetchCustomers()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Error saving customer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleDelete = async (customer: Customer) => {
    if (!window.confirm(`Are you sure you want to delete ${customer.name}? This action cannot be undone.`)) {
      return
    }
    
    try {
      const { error } = await db
        .from('customers')
        .delete()
        .eq('id', customer.id)
      
      if (error) throw error
      await fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Error deleting customer. Please try again.')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCustomer(null)
    setFormData({ name: '', email: '', phone: '', address: '' })
    setFormErrors({})
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className={`text-2xl sm:text-3xl font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          Customer Management
        </h1>
        <p className={`mt-2 text-sm sm:text-base transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Manage customer information and view booking history
        </p>
      </div>

      {/* Header Actions */}
      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors duration-200 ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-slate-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
              />
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Customers List */}
      <div className={`rounded-2xl shadow-sm border transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <UserIcon className={`mx-auto h-12 w-12 mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {searchTerm ? 'No customers found' : 'No customers yet'}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Customer
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Contact
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Address
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Created
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {filteredCustomers.map((customer) => (
                    <motion.tr
                      key={customer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors duration-200`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {customer.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center text-sm">
                              <EnvelopeIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {customer.email}
                              </span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center text-sm">
                              <PhoneIcon className={`h-4 w-4 mr-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                              <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {customer.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {customer.address ? (
                          <div className="flex items-start text-sm">
                            <MapPinIcon className={`h-4 w-4 mr-2 mt-0.5 flex-shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {customer.address}
                            </span>
                          </div>
                        ) : (
                          <span className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            No address
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {format(new Date(customer.created_at), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(customer)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                            title="Edit Customer"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`}
                            title="Delete Customer"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`rounded-2xl p-6 max-w-md w-full shadow-2xl border transition-colors duration-200 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                onClick={handleCloseModal}
                className={`p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                    formErrors.name
                      ? 'border-red-500 focus:border-red-500'
                      : darkMode 
                        ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                  placeholder="Enter customer name"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                    formErrors.email
                      ? 'border-red-500 focus:border-red-500'
                      : darkMode 
                        ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                    formErrors.phone
                      ? 'border-red-500 focus:border-red-500'
                      : darkMode 
                        ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                  placeholder="Enter phone number"
                />
                {formErrors.phone && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors duration-200 ${
                    darkMode 
                      ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-slate-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500/20`}
                  placeholder="Enter address"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors duration-200 ${
                    submitting 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-primary-700'
                  } bg-primary-600 text-white`}
                >
                  {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Add Customer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Customers