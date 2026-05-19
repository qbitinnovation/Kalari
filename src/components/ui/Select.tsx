'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Field, type FieldProps } from './Field'
import { popoverContentClass, triggerClass, type FieldVariant } from './field-styles'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<FieldProps, 'children'> {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  /** Show a search field inside the dropdown (default: true when there are more than 3 options). */
  searchable?: boolean
  searchPlaceholder?: string
  triggerClassName?: string
  variant?: FieldVariant
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  searchable,
  searchPlaceholder = 'Search…',
  triggerClassName,
  variant = 'admin',
  className,
  ...fieldProps
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const selectId = id ?? generatedId

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder
  const isPlaceholder = !selected || selected.value === '__none__'
  const enableSearch = searchable ?? options.length > 2

  const filtered = useMemo(() => {
    if (!enableSearch || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query, enableSearch])

  useEffect(() => {
    if (open && enableSearch) {
      const timer = window.setTimeout(() => searchRef.current?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
    if (!open) setQuery('')
  }, [open, enableSearch])

  const handleSelect = (optionValue: string) => {
    const option = options.find((o) => o.value === optionValue)
    if (option?.disabled) return
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <Field {...fieldProps} variant={variant} className={className} htmlFor={selectId}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            id={selectId}
            type="button"
            className={cn(
              triggerClass(variant, triggerClassName),
              isPlaceholder && 'font-normal text-slate-400 dark:text-slate-500'
            )}
            aria-label={fieldProps.label}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform duration-200', open && 'rotate-180')}
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={cn(
              popoverContentClass(variant),
              'w-[var(--radix-popover-trigger-width)] overflow-hidden p-0'
            )}
            align="start"
            sideOffset={6}
          >
            {enableSearch && (
              <div className="border-b border-slate-200 p-2 dark:border-slate-700">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(
                      'ui-field w-full rounded-xl border py-2 pr-3 pl-10 text-sm outline-none transition-[border-color,box-shadow] duration-200',
                      variant === 'admin'
                        ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-[3px] focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500'
                        : 'border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100'
                    )}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Escape') setOpen(false)
                    }}
                  />
                </div>
              </div>
            )}
            <ul role="listbox" className="max-h-60 overflow-y-auto p-1" aria-label={fieldProps.label}>
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">No results</li>
              ) : (
                filtered.map((option) => {
                  const isSelected = option.value === value
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          'relative flex w-full cursor-pointer items-center rounded-lg py-2.5 pl-9 pr-3 text-left text-sm outline-none transition-colors',
                          option.disabled && 'pointer-events-none opacity-40',
                          isSelected
                            ? 'bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                            : 'text-slate-700 hover:bg-primary-50 hover:text-primary-900 dark:text-slate-200 dark:hover:bg-primary-900/30 dark:hover:text-primary-100'
                        )}
                      >
                        {isSelected && (
                          <Check className="absolute left-2.5 h-4 w-4 text-primary-600 dark:text-primary-400" />
                        )}
                        <span className="truncate">{option.label}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  )
}
