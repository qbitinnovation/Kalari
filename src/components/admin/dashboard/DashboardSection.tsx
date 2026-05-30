"use client";

import React from "react";

export function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
