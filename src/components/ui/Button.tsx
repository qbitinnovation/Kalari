'use client'

import React from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-2 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'btn-gradient-primary text-white shadow-md shadow-primary-600/25 hover:shadow-lg hover:shadow-primary-600/30 active:scale-[0.98]',
  secondary:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm active:scale-[0.98]',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80',
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold tracking-wide transition-all duration-200',
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && 'w-full',
    className
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size, fullWidth, className }),
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
