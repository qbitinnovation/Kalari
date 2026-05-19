'use client'

import React from 'react'
import { cn } from '@/lib/cn'
import { Field, type FieldProps } from './Field'
import { inputClass, type FieldVariant } from './field-styles'

export interface TextareaProps extends Omit<FieldProps, 'children'> {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  inputClassName?: string
  variant?: FieldVariant
}

export function Textarea({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 4,
  inputClassName,
  variant = 'admin',
  className,
  ...fieldProps
}: TextareaProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <Field {...fieldProps} variant={variant} className={className} htmlFor={inputId}>
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        required={fieldProps.required}
        className={cn(inputClass(variant, inputClassName), 'resize-y min-h-[6rem]')}
      />
    </Field>
  )
}
