'use client'

import React, { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { format, parse } from 'date-fns'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Field, type FieldProps } from './Field'
import { buildTimeSlots, parseTimeValue } from './date-utils'
import { popoverContentClass, triggerClass, type FieldVariant } from './field-styles'

export interface TimePickerProps extends Omit<FieldProps, 'children'> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minuteStep?: number
  startHour?: number
  endHour?: number
  triggerClassName?: string
  variant?: FieldVariant
}

function formatDisplayTime(value: string): string {
  const parsed = parseTimeValue(value)
  if (!parsed) return ''
  const date = parse(`${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`, 'HH:mm', new Date())
  return format(date, 'h:mm a')
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Pick a time',
  disabled,
  minuteStep = 15,
  startHour = 6,
  endHour = 23,
  triggerClassName,
  variant = 'admin',
  className,
  ...fieldProps
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const slots = useMemo(() => buildTimeSlots(minuteStep, startHour, endHour), [minuteStep, startHour, endHour])
  const display = value ? formatDisplayTime(value) : placeholder

  return (
    <Field {...fieldProps} variant={variant} className={className}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              triggerClass(variant, triggerClassName),
              !value && 'text-slate-400 dark:text-slate-500'
            )}
          >
            <span className="truncate">{display}</span>
            <Clock className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={cn(popoverContentClass(variant), 'w-56 p-2')}
            align="start"
            sideOffset={6}
          >
            <div className="max-h-64 overflow-y-auto">
              <div className="grid grid-cols-2 gap-1">
                {slots.map((slot) => {
                  const active = slot === value
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        onChange(slot)
                        setOpen(false)
                      }}
                      className={cn(
                        'rounded-lg px-2 py-2 text-xs font-semibold transition-colors',
                        active
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-primary-900/30'
                      )}
                    >
                      {formatDisplayTime(slot)}
                    </button>
                  )
                })}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  )
}
