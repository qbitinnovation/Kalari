"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getChartTheme } from "./chartTheme";

type DonutSlice = { name: string; value: number; key: "due" | "pending" | "paid" };

export function DashboardDonutChart({
  data,
  darkMode,
}: {
  data: DonutSlice[];
  darkMode: boolean;
}) {
  const theme = getChartTheme(darkMode);
  const filtered = data.filter((item) => item.value > 0);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No commission data yet
      </div>
    );
  }

  const colorByKey = {
    due: theme.donut.due,
    pending: theme.donut.pending,
    paid: theme.donut.paid,
  };

  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={3}
            stroke="none"
          >
            {filtered.map((entry) => (
              <Cell key={entry.key} fill={colorByKey[entry.key]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: theme.tooltipBg,
              borderColor: theme.tooltipBorder,
              borderRadius: 12,
              color: theme.tooltipText,
              fontSize: 12,
              fontWeight: 700,
            }}
            formatter={(value) => [`Rs. ${Number(value || 0).toLocaleString("en-IN")}`, "Amount"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</span>
        <span className="text-lg font-black text-slate-900 dark:text-slate-100">
          Rs. {total.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
