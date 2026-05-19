'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Field, type FieldProps } from './Field'
import { inputClass, type FieldVariant } from './field-styles'

export interface InputProps extends Omit<FieldProps, 'children'> {
  id?: string
  type?: React.HTMLInputTypeAttribute
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  leftIcon?: LucideIcon
  inputClassName?: string
  variant?: FieldVariant
}

export function Input({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  step,
  leftIcon: LeftIcon,
  inputClassName,
  variant = 'admin',
  className,
  error,
  ...fieldProps
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <Field {...fieldProps} error={error} variant={variant} className={className} htmlFor={inputId}>
      <div className={LeftIcon ? 'relative' : undefined}>
        {LeftIcon && (
          <LeftIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          required={fieldProps.required}
          className={cn(
            inputClass(variant, inputClassName),
            LeftIcon && 'pl-11',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
          )}
        />
      </div>
    </Field>
  )
}
