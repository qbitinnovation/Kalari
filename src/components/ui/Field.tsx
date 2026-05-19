'use client'

import React from 'react'
import { cn } from '@/lib/cn'
import { fieldErrorClass, fieldHintClass, fieldLabelClass, type FieldVariant } from './field-styles'

export interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  variant?: FieldVariant
  className?: string
  children: React.ReactNode
  htmlFor?: string
}

export function Field({
  label,
  hint,
  error,
  required,
  variant = 'admin',
  className,
  children,
  htmlFor,
}: FieldProps) {
  return (
    <div className={cn('block w-full', className)}>
      {label && (
        <label htmlFor={htmlFor} className={fieldLabelClass(variant)}>
          {label}
          {required && <span className="ml-0.5 text-primary-600">*</span>}
        </label>
      )}
      {children}
      {error && <p className={fieldErrorClass(variant)} role="alert">{error}</p>}
      {!error && hint && <p className={fieldHintClass(variant)}>{hint}</p>}
    </div>
  )
}
