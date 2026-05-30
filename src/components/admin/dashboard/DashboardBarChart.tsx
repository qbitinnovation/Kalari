"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getChartTheme } from "./chartTheme";

type ChartPoint = { label: string; value: number };

export function DashboardBarChart({
  data,
  darkMode,
  title,
}: {
  data: ChartPoint[];
  darkMode: boolean;
  title?: string;
}) {
  const theme = getChartTheme(darkMode);

  return (
    <div className="h-64 w-full">
      {title && (
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.axis, fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.tooltipBg,
              borderColor: theme.tooltipBorder,
              borderRadius: 12,
              color: theme.tooltipText,
              fontSize: 12,
              fontWeight: 700,
            }}
            formatter={(value) => [Number(value || 0), "Tickets"]}
          />
          <Bar dataKey="value" fill={theme.bar} radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
