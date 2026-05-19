'use client'

import React from 'react'
import { cn } from '@/lib/cn'
import { DatePicker, type DatePreset } from './DatePicker'
import { type FieldVariant } from './field-styles'

export interface DateRangePickerProps {
  start: string
  end: string
  onChange: (range: { start: string; end: string }) => void
  label?: string
  variant?: FieldVariant
  className?: string
  presets?: DatePreset[]
}

export function DateRangePicker({
  start,
  end,
  onChange,
  label,
  variant = 'admin',
  className,
  presets,
}: DateRangePickerProps) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-end', className)}>
      {label && (
        <span className="sr-only">{label}</span>
      )}
      <DatePicker
        label={label ? 'From' : undefined}
        value={start}
        onChange={(startValue) => onChange({ start: startValue, end })}
        variant={variant}
        className="flex-1"
        presets={presets}
      />
      <span className="hidden px-1 pb-3 text-sm font-medium text-slate-500 dark:text-slate-400 sm:block">to</span>
      <DatePicker
        label={label ? 'To' : undefined}
        value={end}
        onChange={(endValue) => onChange({ start, end: endValue })}
        variant={variant}
        className="flex-1"
        minDate={start || undefined}
      />
    </div>
  )
}
