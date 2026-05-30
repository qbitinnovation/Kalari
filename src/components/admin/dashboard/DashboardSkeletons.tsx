"use client";

import React from "react";

export function DashboardTextSkeleton({ className = "h-8 w-28" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

export function DashboardChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-2 px-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 animate-pulse rounded-t-md bg-slate-200 dark:bg-slate-700"
          style={{ height: `${35 + (index % 4) * 12}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardDonutSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-40 w-40 animate-pulse rounded-full border-[14px] border-slate-200 dark:border-slate-700" />
    </div>
  );
}

export function DashboardListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
        >
          <DashboardTextSkeleton className="mb-2 h-4 w-48" />
          <DashboardTextSkeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function DashboardTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 dark:border-slate-800">
          <DashboardTextSkeleton className="h-4 w-40" />
          <DashboardTextSkeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
