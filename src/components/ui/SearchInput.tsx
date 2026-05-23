'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  containerClassName?: string
}

export function SearchInput({
  value,
  onChange,
  className,
  containerClassName,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  return (
    <label className={cn('relative block w-full', containerClassName)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'ui-field min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-primary-500 focus:ring-[3px] focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
          className
        )}
      />
    </label>
  )
}
