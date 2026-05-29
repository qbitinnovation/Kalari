"use client";

import React, { useState, useEffect } from 'react'
import { db, Customer } from '@/lib/database'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDarkMode } from '@/hooks/useDarkMode'
import { AdminTable, AdminTableBody, AdminTableEmpty, AdminTableHead, AdminTablePanel, AdminTableSkeleton, Button, Input, IndianPhoneField, SearchInput, Textarea } from '@/components/ui'
import { getRecordId } from '@/lib/booking'
import { toDisplayInitial, toDisplayTitle } from '@/lib/textFormat'
import { formatDisplayDateValue } from '@/components/ui/date-utils'
import {
  formatIndianMobileForStorage,
  getIndianMobileDigits,
  getIndianMobileValidationError,
} from '@/lib/indianPhone'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  XMarkIcon
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
    
    if (formData.phone && getIndianMobileValidationError(formData.phone)) {
      errors.phone = getIndianMobileValidationError(formData.phone)
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
        const { error } = await db
          .from('customers')
          .update({
            ...formData,
            phone: formData.phone.trim() ? formatIndianMobileForStorage(formData.phone) : '',
            updated_at: new Date().toISOString()
          })
          .eq('id', getRecordId(editingCustomer))
        
        if (error) throw error
      } else {
        const { error } = await db
          .from('customers')
          .insert([{
            ...formData,
            phone: formData.phone.trim() ? formatIndianMobileForStorage(formData.phone) : '',
          }])
        
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
      phone: getIndianMobileDigits(customer.phone || ''),
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
        .eq('id', getRecordId(customer))
      
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
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-medium transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Customer Management
          </h1>
          <p className={`mt-2 text-sm sm:text-base transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage customer information and view booking history
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search customers..." containerClassName="w-full sm:w-80" />
          <Button onClick={() => setShowModal(true)}>
            <PlusIcon className="h-5 w-5" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Customers List */}
      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
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
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={5} leadColumn="avatar" />
            ) : filteredCustomers.length === 0 ? (
              <AdminTableEmpty colSpan={5}>
                {searchTerm ? 'No customers found. Try adjusting your search terms.' : 'No customers yet. Get started by adding your first customer.'}
              </AdminTableEmpty>
            ) : (
              filteredCustomers.map((customer, index) => (
                    <motion.tr
                      key={getRecordId(customer) || `customer-row-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors duration-200`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                            {toDisplayInitial(customer.name)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {toDisplayTitle(customer.name)}
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
                          {formatDisplayDateValue(customer.created_at)}
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
                  ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="admin-modal-overlay">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="admin-modal-panel admin-modal-card"
          >
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h2>
                <p className="admin-modal-subtitle">Keep customer contact details clean for bookings and tickets.</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="admin-modal-close text-[0px]"
                aria-label="Close modal"
              >
                <XMarkIcon className="h-5 w-5" />
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="admin-modal-body space-y-4">
              <div>
                <Input
                  label="Name"
                  value={formData.name}
                  onChange={(name) => setFormData({ ...formData, name })}
                  placeholder="Enter customer name"
                  error={formErrors.name}
                  required
                />
              </div>

              <div>
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(email) => setFormData({ ...formData, email })}
                  placeholder="Enter email address"
                  error={formErrors.email}
                />
              </div>

              <div>
                <IndianPhoneField
                  label="Phone"
                  value={formData.phone}
                  onChange={(phone) => setFormData({ ...formData, phone })}
                  error={formErrors.phone}
                />
              </div>

              <div>
                <Textarea
                  label="Address"
                  value={formData.address}
                  onChange={(address) => setFormData({ ...formData, address })}
                  rows={3}
                  placeholder="Enter address"
                />
              </div>

              </div>

              <div className="admin-modal-footer">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Add Customer'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default Customers
