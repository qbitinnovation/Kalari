"use client";

import React, { useState, useEffect } from 'react'
import { db, Layout } from '@/lib/database'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Button } from '@/components/ui'
import { getDefaultArenaStructure, getSymmetricArenaSections } from '@/lib/arenaLayout'

const Layouts: React.FC = () => {
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [loading, setLoading] = useState(true)
  const darkMode = useDarkMode()
  const [showModal, setShowModal] = useState(false)
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    structure: getDefaultArenaStructure()
  })

  useEffect(() => {
    fetchLayouts()
  }, [])

  const fetchLayouts = async () => {
    try {
      const { data, error } = await db
        .from('layouts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLayouts(data || [])
    } catch (error) {
      console.error('Error fetching layouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const layoutData = {
        name: formData.name,
        structure: {
          ...formData.structure,
          sections: getSymmetricArenaSections(formData.structure.sections),
        }
      }

      if (editingLayout) {
        const { error } = await db
          .from('layouts')
          .update(layoutData)
          .eq('id', editingLayout.id)
        
        if (error) throw error
      } else {
        const { error } = await db
          .from('layouts')
          .insert([layoutData])
        
        if (error) throw error
      }

      setShowModal(false)
      setEditingLayout(null)
      resetForm()
      fetchLayouts()
    } catch (error) {
      console.error('Error saving layout:', error)
    }
  }

  const handleEdit = (layout: Layout) => {
    setEditingLayout(layout)
    
    // Convert old format to new format if needed
    const convertedStructure = {
      ...layout.structure,
      blockedSeats: layout.structure.blockedSeats || [],
      sections: layout.structure.sections?.map((section: any) => {
        if (Array.isArray(section.rows)) {
          // Already in new format
          return section
        } else {
          // Convert old format to new format
          const rowCount = section.rows || 0
          const seatsPerRow = section.seatsPerRow || 0
          return {
            name: section.name,
            rows: Array.from({ length: rowCount }, (_, i) => ({
              rowNumber: i + 1,
              seats: seatsPerRow
            }))
          }
        }
      }) || []
    }
    
    setFormData({
      name: layout.name,
      structure: convertedStructure
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this layout?')) {
      try {
        const { error } = await db
          .from('layouts')
          .delete()
          .eq('id', id)
        
        if (error) throw error
        fetchLayouts()
      } catch (error) {
        console.error('Error deleting layout:', error)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      structure: getDefaultArenaStructure(),
    })
  }

  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...formData.structure.sections]
    newSections[index] = { ...newSections[index], [field]: value }
    setFormData({
      ...formData,
      structure: { ...formData.structure, sections: newSections }
    })
  }

  const addRowToSection = (sectionIndex: number) => {
    const newSections = [...formData.structure.sections]
    const section = newSections[sectionIndex]
    const newRowNumber = section.rows.length + 1
    section.rows.push({ rowNumber: newRowNumber, seats: 10 })
    setFormData({
      ...formData,
      structure: { ...formData.structure, sections: newSections }
    })
  }

  const removeRowFromSection = (sectionIndex: number, rowIndex: number) => {
    const newSections = [...formData.structure.sections]
    const section = newSections[sectionIndex]
    section.rows.splice(rowIndex, 1)
    // Renumber rows
    section.rows.forEach((row, index) => {
      row.rowNumber = index + 1
    })
    setFormData({
      ...formData,
      structure: { ...formData.structure, sections: newSections }
    })
  }

  const updateRowSeats = (sectionIndex: number, rowIndex: number, seats: number) => {
    const newSections = [...formData.structure.sections]
    newSections[sectionIndex].rows[rowIndex].seats = seats
    setFormData({
      ...formData,
      structure: { ...formData.structure, sections: newSections }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-semibold transition-colors duration-200 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            Theatre Layouts
          </h1>
          <p className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Design and manage 360° seating arrangements
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setEditingLayout(null)
            setShowModal(true)
          }}
        >
          <PlusIcon className="h-5 w-5" />
          Create Layout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {layouts.map((layout) => (
          <div key={layout.id} className={`rounded-2xl shadow-sm border p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className={`text-lg font-semibold transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{layout.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(layout)}
                  className="text-primary-600 hover:text-primary-900"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(layout.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {layout.structure.sections?.map((section: any, index: number) => {
                const totalSeats = Array.isArray(section.rows) 
                  ? section.rows.reduce((sum: number, row: any) => sum + row.seats, 0) 
                  : (section.rows * section.seatsPerRow || 0)
                const rowCount = Array.isArray(section.rows) 
                  ? section.rows.length 
                  : (section.rows || 0)
                return (
                  <div key={index} className="flex justify-between text-sm">
                    <span className={`transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{section.name}</span>
                    <div className="text-right">
                      <div className={`transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {rowCount}R × {totalSeats}S
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Total Seats: {layout.structure.sections?.reduce((total: number, section: any) => {
                  const sectionSeats = Array.isArray(section.rows) 
                    ? section.rows.reduce((sum: number, row: any) => sum + row.seats, 0) 
                    : (section.rows * section.seatsPerRow || 0)
                  return total + sectionSeats
                }, 0)}
              </div>
            </div>

            {/* Enhanced theater-style visual representation */}
            <div className={`mt-4 rounded-xl p-4 h-48 transition-colors duration-200 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                
                {/* North section indicator */}
                <div className="flex flex-col items-center space-y-1">
                  <div className="text-xs text-gray-500 font-medium">NORTH</div>
                  <div className="flex space-x-0.5">
                    {(() => {
                      const northSection = layout.structure.sections?.find((s: any) => s.name === 'North')
                      const maxSeats = Array.isArray(northSection?.rows) 
                        ? Math.max(...northSection.rows.map((r: any) => r.seats))
                        : (northSection?.seatsPerRow || 0)
                      return Array.from({ length: Math.min(maxSeats, 12) }, (_, i) => (
                        <div key={i} className="w-1.5 h-1 bg-blue-300 rounded-sm"></div>
                      ))
                    })()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {(() => {
                      const northSection = layout.structure.sections?.find((s: any) => s.name === 'North')
                      const rowCount = Array.isArray(northSection?.rows) ? northSection.rows.length : (northSection?.rows || 0)
                      const totalSeats = Array.isArray(northSection?.rows) 
                        ? northSection.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
                        : ((northSection?.rows || 0) * (northSection?.seatsPerRow || 0))
                      return `${rowCount}R × ${totalSeats}S`
                    })()}
                  </div>
                </div>
                
                {/* Middle section with West, Stage, East */}
                <div className="flex items-center justify-center space-x-6 w-full">
                  {/* West */}
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-xs text-gray-500 font-medium rotate-90">WEST</div>
                    <div className="flex space-x-0.5">
                      {(() => {
                        const westSection = layout.structure.sections?.find((s: any) => s.name === 'West')
                        const maxSeats = Array.isArray(westSection?.rows) 
                          ? Math.max(...westSection.rows.map((r: any) => r.seats))
                          : (westSection?.seatsPerRow || 0)
                        return Array.from({ length: Math.min(maxSeats, 2) }, (_, i) => (
                          <div key={i} className="flex flex-col space-y-0.5">
                            {Array.from({ length: Math.min(8, 8) }, (_, j) => (
                              <div key={j} className="w-1 h-1.5 bg-green-300 rounded-sm"></div>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                      {(() => {
                        const westSection = layout.structure.sections?.find((s: any) => s.name === 'West')
                        const rowCount = Array.isArray(westSection?.rows) ? westSection.rows.length : (westSection?.rows || 0)
                        const totalSeats = Array.isArray(westSection?.rows) 
                          ? westSection.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
                          : ((westSection?.rows || 0) * (westSection?.seatsPerRow || 0))
                        return `${rowCount}R × ${totalSeats}S`
                      })()}
                    </div>
                  </div>
                  
                  {/* Central Stage */}
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      <div className="text-center">
                        <div>Kalari</div>
                        <div className="text-xs opacity-80">STAGE</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">All eyes this way please</div>
                  </div>
                  
                  {/* East */}
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-xs text-gray-500 font-medium rotate-90">EAST</div>
                    <div className="flex space-x-0.5">
                      {(() => {
                        const eastSection = layout.structure.sections?.find((s: any) => s.name === 'East')
                        const maxSeats = Array.isArray(eastSection?.rows) 
                          ? Math.max(...eastSection.rows.map((r: any) => r.seats))
                          : (eastSection?.seatsPerRow || 0)
                        return Array.from({ length: Math.min(maxSeats, 2) }, (_, i) => (
                          <div key={i} className="flex flex-col space-y-0.5">
                            {Array.from({ length: Math.min(8, 8) }, (_, j) => (
                              <div key={j} className="w-1 h-1.5 bg-green-300 rounded-sm"></div>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                    <div className="text-xs text-gray-400 text-center">
                      {(() => {
                        const eastSection = layout.structure.sections?.find((s: any) => s.name === 'East')
                        const rowCount = Array.isArray(eastSection?.rows) ? eastSection.rows.length : (eastSection?.rows || 0)
                        const totalSeats = Array.isArray(eastSection?.rows) 
                          ? eastSection.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
                          : ((eastSection?.rows || 0) * (eastSection?.seatsPerRow || 0))
                        return `${rowCount}R × ${totalSeats}S`
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* South section indicator */}
                <div className="flex flex-col items-center space-y-1">
                  <div className="flex space-x-0.5">
                    {(() => {
                      const southSection = layout.structure.sections?.find((s: any) => s.name === 'South')
                      const maxSeats = Array.isArray(southSection?.rows) 
                        ? Math.max(...southSection.rows.map((r: any) => r.seats))
                        : (southSection?.seatsPerRow || 0)
                      return Array.from({ length: Math.min(maxSeats, 12) }, (_, i) => (
                        <div key={i} className="w-1.5 h-1 bg-orange-300 rounded-sm"></div>
                      ))
                    })()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {(() => {
                      const southSection = layout.structure.sections?.find((s: any) => s.name === 'South')
                      const rowCount = Array.isArray(southSection?.rows) ? southSection.rows.length : (southSection?.rows || 0)
                      const totalSeats = Array.isArray(southSection?.rows) 
                        ? southSection.rows.reduce((sum: number, row: any) => sum + row.seats, 0)
                        : ((southSection?.rows || 0) * (southSection?.seatsPerRow || 0))
                      return `${rowCount}R × ${totalSeats}S`
                    })()}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">SOUTH</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="admin-modal-overlay">
          <form onSubmit={handleSubmit} className="admin-modal-panel admin-modal-card admin-modal-card-lg">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">{editingLayout ? 'Edit Layout' : 'Create Layout'}</h2>
                <p className="admin-modal-subtitle">Layouts are saved as a symmetric four-sided Kalari arena.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="admin-modal-close" aria-label="Close modal">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="admin-modal-body space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Layout Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  placeholder="e.g., Main Hall Layout"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Sections</h3>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const newSection = { 
                          name: `Section ${formData.structure.sections.length + 1}`,
                          rows: [
                            { rowNumber: 1, seats: 10 },
                            { rowNumber: 2, seats: 10 },
                            { rowNumber: 3, seats: 10 }
                          ]
                        }
                        setFormData({
                          ...formData,
                          structure: {
                            ...formData.structure,
                            sections: [...formData.structure.sections, newSection]
                          }
                        })
                      }}
                    >
                      + Add Section
                    </Button>
                  </div>
                </div>
                <div className="space-y-6">
                  {formData.structure.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className={`font-medium transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {section.name} Section
                        </h4>
                        {formData.structure.sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSections = formData.structure.sections.filter((_, i) => i !== sectionIndex)
                              setFormData({
                                ...formData,
                                structure: { ...formData.structure, sections: newSections }
                              })
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Section Basic Info */}
                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <div>
                          <label className={`block text-sm font-medium mb-1 transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Section Name
                          </label>
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => updateSection(sectionIndex, 'name', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                      </div>

                      {/* Row Configuration */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-3">
                          <label className={`block text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Row Configuration
                          </label>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => addRowToSection(sectionIndex)}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              + Add Row
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Array.isArray(section.rows) && section.rows.map((row, rowIndex) => (
                            <div key={rowIndex} className={`flex items-center space-x-3 p-2 rounded-lg transition-colors duration-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                              <div className="flex-shrink-0">
                                <span className={`text-sm font-medium transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  Row {String.fromCharCode(65 + rowIndex)}:
                                </span>
                              </div>
                              <div className="flex-1">
                                <input
                                  type="number"
                                  value={row.seats}
                                  onChange={(e) => updateRowSeats(sectionIndex, rowIndex, parseInt(e.target.value) || 0)}
                                  min="0"
                                  max="30"
                                  className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                  placeholder="Seats"
                                />
                              </div>
                              <div className="flex-shrink-0">
                                <span className={`text-xs transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  seats
                                </span>
                              </div>
                              {Array.isArray(section.rows) && section.rows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRowFromSection(sectionIndex, rowIndex)}
                                  className="flex-shrink-0 text-red-500 hover:text-red-700 text-xs"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Fallback for old format */}
                      {!Array.isArray(section.rows) && (
                        <div className={`p-3 rounded-lg text-sm transition-colors duration-200 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                          <p>This layout uses the old format. Please edit and save to convert to the new row-by-row configuration.</p>
                          <p className="mt-1">Current: {(section as any).rows || 0} rows × {(section as any).seatsPerRow || 0} seats per row</p>
                        </div>
                      )}
                      
                      {/* Section Summary */}
                      <div className={`p-3 rounded-lg text-sm transition-colors duration-200 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                        <div className="flex justify-between items-center">
                          <span>Total seats in {section.name}:</span>
                          <span className="font-semibold">{Array.isArray(section.rows) ? section.rows.reduce((sum, row) => sum + row.seats, 0) : ((section as any).rows * (section as any).seatsPerRow || 0)} seats</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span>Number of rows:</span>
                          <span className="font-semibold">{Array.isArray(section.rows) ? section.rows.length : ((section as any).rows || 0)} rows</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Blocked / Reserved Seat IDs
                </label>
                <input
                  value={(formData.structure.blockedSeats || []).join(', ')}
                  onChange={(event) => setFormData({
                    ...formData,
                    structure: {
                      ...formData.structure,
                      blockedSeats: event.target.value.split(',').map((seat) => seat.trim()).filter(Boolean)
                    }
                  })}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                  placeholder="Example: North-A-1, North-A-2"
                />
                <p className={`mt-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Use the same seat IDs generated in booking maps, such as Section-A-1.</p>
              </div>

              {/* Layout Summary */}
              <div className={`rounded-xl p-4 transition-colors duration-200 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <h4 className={`text-lg font-medium mb-3 transition-colors duration-200 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Layout Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formData.structure.sections.reduce((total, section) => {
                        const sectionSeats = section.rows.reduce((sum, row) => sum + row.seats, 0)
                        return total + sectionSeats
                      }, 0)}
                    </div>
                    <div className={`transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Seats</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold transition-colors duration-200 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      {formData.structure.sections.length}
                    </div>
                    <div className={`transition-colors duration-200 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sections</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editingLayout ? 'Update' : 'Create'} Layout</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Layouts
