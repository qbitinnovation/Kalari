"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Trend = {
  value: number;
  label?: string;
};

export function DashboardStatCard({
  label,
  value,
  icon,
  subtitle,
  trend,
  accent = "amber",
  loading = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: Trend;
  accent?: "amber" | "emerald" | "blue" | "purple" | "slate";
  loading?: boolean;
}) {
  const accentClasses = {
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  const trendUp = (trend?.value ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${accentClasses[accent]}`}>{icon}</div>
        {loading ? (
          <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        ) : trend ? (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${
              trendUp
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
            }`}
            title={trend.label}
          >
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        ) : null}
      </div>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-1 h-8 w-28 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      ) : (
        <p className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">{value}</p>
      )}
      {loading ? (
        subtitle ? <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : null
      ) : subtitle ? (
        <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}
