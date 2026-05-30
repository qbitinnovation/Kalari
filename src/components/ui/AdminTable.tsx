'use client'

import React from 'react'
import { cn } from '@/lib/cn'

type ClassNameProps = {
  className?: string
  children?: React.ReactNode
}

export interface AdminTablePanelProps extends ClassNameProps {
  title?: React.ReactNode
  actions?: React.ReactNode
}

export function AdminTablePanel({
  title,
  actions,
  className,
  children,
}: AdminTablePanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/50',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          {title && <div className="text-base font-semibold text-slate-950 dark:text-slate-100">{title}</div>}
          {actions}
        </header>
      )}
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

export function AdminTable({ className, children }: ClassNameProps) {
  return (
    <table className={cn('min-w-full divide-y divide-slate-200 text-left dark:divide-slate-800', className)}>
      {children}
    </table>
  )
}

export function AdminTableHead({ className, children }: ClassNameProps) {
  return <thead className={cn('bg-slate-50 dark:bg-slate-800/50', className)}>{children}</thead>
}

export function AdminTableBody({ className, children }: ClassNameProps) {
  return <tbody className={cn('divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900/30', className)}>{children}</tbody>
}

export function AdminTableRow({ className, children }: ClassNameProps) {
  return <tr className={cn('transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40', className)}>{children}</tr>
}

export interface AdminTableCellProps extends ClassNameProps {
  align?: 'left' | 'center' | 'right'
  colSpan?: number
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function AdminTableHeaderCell({
  align = 'left',
  className,
  children,
}: AdminTableCellProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400',
        alignClass[align],
        className
      )}
    >
      {children}
    </th>
  )
}

export function AdminTableCell({
  align = 'left',
  className,
  colSpan,
  children,
}: AdminTableCellProps) {
  return (
    <td colSpan={colSpan} className={cn('px-4 py-3 align-middle text-sm', alignClass[align], className)}>
      {children}
    </td>
  )
}

export function AdminTableEmpty({ colSpan, children, className }: AdminTableCellProps) {
  return (
    <AdminTableRow className="hover:bg-transparent dark:hover:bg-transparent">
      <AdminTableCell colSpan={colSpan} className={cn('px-4 py-10 text-center font-semibold text-slate-400', className)}>
        {children || 'Nothing to display.'}
      </AdminTableCell>
    </AdminTableRow>
  )
}

function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)} />
}

export type AdminTableSkeletonProps = {
  columns: number
  rows?: number
  leadColumn?: 'avatar' | 'default'
}

export function AdminTableSkeleton({
  columns,
  rows = 6,
  leadColumn = 'default',
}: AdminTableSkeletonProps) {
  const barWidths = ['w-full', 'w-3/4', 'w-2/3', 'w-4/5', 'w-1/2', 'w-3/5', 'w-2/5']

  return Array.from({ length: rows }).map((_, rowIndex) => (
        <AdminTableRow key={`skeleton-row-${rowIndex}`} className="hover:bg-transparent dark:hover:bg-transparent">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <AdminTableCell
              key={colIndex}
              align={colIndex === columns - 1 ? 'right' : 'left'}
            >
              {colIndex === 0 && leadColumn === 'avatar' ? (
                <div className="flex items-center gap-4">
                  <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBar className="h-4 w-32 max-w-full" />
                    <SkeletonBar className="h-3 w-20 max-w-full" />
                  </div>
                </div>
              ) : (
                <SkeletonBar className={cn('h-4', barWidths[(rowIndex + colIndex) % barWidths.length], colIndex === columns - 1 && 'ml-auto')} />
              )}
            </AdminTableCell>
          ))}
        </AdminTableRow>
      ))
}
