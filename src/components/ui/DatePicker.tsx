'use client'

import React, { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Field, type FieldProps } from './Field'
import { formatDateValue, parseDateValue, todayDateValue } from './date-utils'
import { popoverContentClass, triggerClass, type FieldVariant } from './field-styles'
import { Button } from './Button'

export type DatePreset =
  | { label: string; value: 'today' | 'clear' }
  | { label: string; value: string }

export interface DatePickerProps extends Omit<FieldProps, 'children'> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  presets?: DatePreset[]
  triggerClassName?: string
  variant?: FieldVariant
}

function resolvePreset(preset: DatePreset): string {
  if (preset.value === 'today') return todayDateValue()
  if (preset.value === 'clear') return ''
  return preset.value
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  minDate,
  maxDate,
  presets,
  triggerClassName,
  variant = 'admin',
  className,
  ...fieldProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseDateValue(value), [value])
  const min = useMemo(() => (minDate ? parseDateValue(minDate) : undefined), [minDate])
  const max = useMemo(() => (maxDate ? parseDateValue(maxDate) : undefined), [maxDate])

  const display = selected ? format(selected, 'MMM d, yyyy') : placeholder

  return (
    <Field {...fieldProps} variant={variant} className={className}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              triggerClass(variant, triggerClassName),
              !selected && 'text-slate-400 dark:text-slate-500'
            )}
          >
            <span className="truncate">{display}</span>
            <Calendar className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={cn(popoverContentClass(variant), 'w-auto p-0')}
            align="start"
            sideOffset={6}
          >
            <div className="p-3">
              <DayPicker
                className="kalari-day-picker"
                mode="single"
                selected={selected}
                onSelect={(date) => {
                  if (date) {
                    onChange(formatDateValue(date))
                    setOpen(false)
                  }
                }}
                disabled={
                  min && max
                    ? { before: min, after: max }
                    : min
                      ? { before: min }
                      : max
                        ? { after: max }
                        : undefined
                }
                defaultMonth={selected ?? min ?? new Date()}
              />
            </div>
            {presets && presets.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={preset.value === 'today' ? 'primary' : 'secondary'}
                    onClick={() => {
                      onChange(resolvePreset(preset))
                      if (preset.value !== 'clear') setOpen(false)
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  )
}
