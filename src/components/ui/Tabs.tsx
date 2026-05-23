'use client'

import React from 'react'
import { cn } from '@/lib/cn'

export type TabOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

export interface TabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: TabOption<T>[]
  ariaLabel: string
  className?: string
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-grid min-h-12 w-full grid-cols-[repeat(var(--tabs-count),minmax(0,1fr))] gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      style={{ '--tabs-count': options.length } as React.CSSProperties}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition-colors',
              active
                ? 'bg-white text-slate-950 shadow-sm ring-1 ring-primary-200 dark:bg-slate-800 dark:text-white dark:ring-primary-900'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
              option.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
