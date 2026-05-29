'use client'

import React from 'react'
import { cn } from '@/lib/cn'
import { getIndianMobileDigits } from '@/lib/indianPhone'
import { Field, type FieldProps } from './Field'
import type { FieldVariant } from './field-styles'

export interface IndianPhoneFieldProps extends Omit<FieldProps, 'children'> {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  containerClassName?: string
  id?: string
  variant?: FieldVariant
}

export function IndianPhoneField({
  value,
  onChange,
  disabled,
  containerClassName,
  variant = 'admin',
  error,
  className,
  id,
  ...fieldProps
}: IndianPhoneFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  const wrapperClass =
    variant === 'admin'
      ? cn(
          'flex overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 focus-within:border-primary-500 focus-within:ring-[3px] focus-within:ring-primary-500/20 dark:bg-slate-900',
          error
            ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20'
            : 'border-slate-200 dark:border-slate-700',
          disabled && 'cursor-not-allowed opacity-50'
        )
      : cn(
          'flex overflow-hidden rounded-lg border border-stone-200 bg-white transition-[border-color,box-shadow] duration-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30 dark:border-stone-700 dark:bg-stone-900',
          error && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20',
          disabled && 'cursor-not-allowed opacity-50'
        )

  const prefixClass =
    variant === 'admin'
      ? 'flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
      : 'flex shrink-0 items-center border-r border-stone-200 bg-stone-50 px-4 py-3 text-sm font-black text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'

  const inputClass =
    variant === 'admin'
      ? 'min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500'
      : 'min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-stone-100 dark:placeholder:text-stone-500'

  return (
    <Field {...fieldProps} error={error} variant={variant} className={className} htmlFor={inputId}>
      <div className={cn(wrapperClass, containerClassName)}>
        <span className={prefixClass}>+91</span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={(event) => onChange(getIndianMobileDigits(event.target.value))}
          placeholder="9876543210"
          minLength={10}
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          required={fieldProps.required}
          disabled={disabled}
          className={inputClass}
        />
      </div>
    </Field>
  )
}
