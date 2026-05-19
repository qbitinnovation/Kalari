import { cn } from '@/lib/cn'

export type FieldVariant = 'admin' | 'public'

export function fieldLabelClass(variant: FieldVariant = 'admin') {
  return variant === 'admin'
    ? 'admin-modal-label'
    : 'mb-2 block text-sm font-bold text-stone-800 dark:text-stone-100'
}

export function fieldHintClass(variant: FieldVariant = 'admin') {
  return variant === 'admin'
    ? 'mt-1 text-xs text-slate-500 dark:text-slate-400'
    : 'mt-1 text-xs text-stone-500'
}

export function fieldErrorClass(variant: FieldVariant = 'admin') {
  return variant === 'admin'
    ? 'mt-1 text-sm text-red-600 dark:text-red-400'
    : 'mt-1 text-sm font-bold text-red-600'
}

export function inputClass(variant: FieldVariant = 'admin', className?: string) {
  return cn(
    variant === 'admin'
      ? 'ui-field admin-modal-field w-full rounded-xl border px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary-500 focus:ring-[3px] focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50'
      : 'ui-field w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500',
    className
  )
}

export function triggerClass(variant: FieldVariant = 'admin', className?: string) {
  return cn(
    inputClass(variant),
    'flex items-center justify-between gap-2 text-left font-medium',
    className
  )
}

export function popoverContentClass(variant: FieldVariant = 'admin') {
  return cn(
    'z-[200] rounded-2xl border p-3 shadow-xl outline-none',
    variant === 'admin'
      ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900'
  )
}
