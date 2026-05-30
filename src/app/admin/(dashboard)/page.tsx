"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  IndianRupee,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useDashboard } from "@/contexts/DashboardContext";
import { DashboardStatCard } from "@/components/admin/dashboard/DashboardStatCard";
import { DashboardSection } from "@/components/admin/dashboard/DashboardSection";
import {
  DashboardChartSkeleton,
  DashboardDonutSkeleton,
  DashboardListSkeleton,
  DashboardTableSkeleton,
  DashboardTextSkeleton,
} from "@/components/admin/dashboard/DashboardSkeletons";
import { DashboardAreaChart } from "@/components/admin/dashboard/DashboardAreaChart";
import { DashboardBarChart } from "@/components/admin/dashboard/DashboardBarChart";
import { DashboardDonutChart } from "@/components/admin/dashboard/DashboardDonutChart";
import { toDisplayTitle } from "@/lib/textFormat";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { Button, DateRangePicker, Select } from "@/components/ui";
import type { DashboardPeriodPreset } from "@/lib/dashboardPeriod";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  details: any;
  performed_by: string;
  performed_at: string;
}

const rupees = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const PERIOD_OPTIONS: { value: DashboardPeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const emptyMetrics = {
  revenue: 0,
  previousRevenue: 0,
  growth: 0,
  tickets: 0,
  avgTicketPrice: 0,
  showsWithSales: 0,
};

const emptyCommission = {
  earned: 0,
  paid: 0,
  unpaid: 0,
  agentCount: 0,
  bookingCount: 0,
  byAgent: [] as { agentId: string; agentName: string; payoutLabel: string; bookingCount: number; amount: number }[],
};

const emptyVendorPayout = {
  platformRevenue: 0,
  vendorEarned: 0,
  vendorPaid: 0,
  vendorUnpaid: 0,
  vendorCount: 0,
  bookingCount: 0,
  byVendor: [] as { vendorId: string; vendorName: string; payoutLabel: string; bookingCount: number; amount: number }[],
};

const Dashboard: React.FC = () => {
  const darkMode = useDarkMode();
  const {
    data,
    loading,
    logsLoading,
    period,
    setPeriodPreset,
    setCustomPeriod,
    fetchActivityLogs,
  } = useDashboard();

  const revenueChartData = useMemo(
    () => (data?.chartSeries || []).map((point) => ({ label: point.label, value: point.revenue })),
    [data?.chartSeries],
  );

  const ticketsChartData = useMemo(
    () => (data?.chartSeries || []).map((point) => ({ label: point.label, value: point.tickets })),
    [data?.chartSeries],
  );

  const commissionDonutData = useMemo(() => {
    if (!data?.commission) return [];
    const { paid, unpaid } = data.commission;
    return [
      { name: "Paid", value: paid, key: "paid" as const },
      { name: "Unpaid", value: unpaid, key: "due" as const },
    ].filter((slice) => slice.value > 0);
  }, [data?.commission]);

  const formatLogSummary = (log: ActivityLog) => {
    const details = log.details || {};
    switch (log.action.toLowerCase()) {
      case "booking":
        return `Booked ${details.ticket_count || details.seat_count || 1} ticket(s) for ${rupees(details.total_amount || details.total_price || 0)}`;
      case "settle":
        return `Settled commission for ${details.booking_count || 0} booking(s)${details.amount ? ` — ${rupees(details.amount)}` : ""}`;
      case "create":
        return `Created ${log.entity_type.toLowerCase()}: ${log.entity_name || "Unknown"}`;
      case "update":
        return `Updated ${log.entity_type.toLowerCase()}: ${log.entity_name || "Unknown"}`;
      case "delete":
        return `Deleted ${log.entity_type.toLowerCase()}: ${log.entity_name || "Unknown"}`;
      case "cancellation":
        return `Cancelled booking for ${log.entity_name || "Unknown"}`;
      default:
        return `${log.action} ${log.entity_type.toLowerCase()}: ${log.entity_name || "Unknown"}`;
    }
  };

  const showSkeletons = loading;

  if (!data && !loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Could not load dashboard data.</p>
      </div>
    );
  }

  const metrics = data?.metrics ?? emptyMetrics;
  const platformRevenue = data?.platformRevenue ?? 0;
  const vendorPayout = data?.vendorPayout ?? emptyVendorPayout;
  const commission = data?.commission ?? emptyCommission;
  const periodShows = data?.periodShows ?? [];
  const topEvents = data?.topEvents ?? [];
  const activityLogs = data?.activityLogs ?? [];
  const periodLabel = data?.periodLabel ?? "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
          {showSkeletons ? (
            <DashboardTextSkeleton className="mt-2 h-4 w-44" />
          ) : (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{periodLabel}</p>
          )}
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 sm:items-end xl:w-auto">
          <Select
            value={period.preset}
            onChange={(value) => setPeriodPreset(value as DashboardPeriodPreset)}
            options={PERIOD_OPTIONS}
            searchable={false}
            className="w-full sm:w-52"
          />
          {period.preset === "custom" && (
            <DateRangePicker
              start={period.start}
              end={period.end}
              onChange={({ start, end }) => setCustomPeriod(start, end)}
              className="w-full sm:w-auto"
            />
          )}
        </div>
      </div>

      <DashboardSection
        title="Revenue Overview"
        description={
          showSkeletons
            ? undefined
            : `Ticket sales for ${periodLabel}`
        }
      >
        {showSkeletons && (
          <DashboardTextSkeleton className="mb-4 h-3 w-56" />
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Revenue"
            value={rupees(metrics.revenue)}
            icon={<IndianRupee className="h-5 w-5" />}
            accent="emerald"
            trend={{ value: metrics.growth, label: `vs previous period (${rupees(metrics.previousRevenue)})` }}
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Tickets Sold"
            value={String(metrics.tickets)}
            subtitle="In selected period"
            icon={<Ticket className="h-5 w-5" />}
            accent="blue"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Avg Ticket Price"
            value={rupees(Math.round(metrics.avgTicketPrice))}
            subtitle="Per ticket in period"
            icon={<TrendingUp className="h-5 w-5" />}
            accent="purple"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Shows With Sales"
            value={String(metrics.showsWithSales)}
            subtitle="Shows that sold tickets"
            icon={<CalendarDays className="h-5 w-5" />}
            accent="amber"
            loading={showSkeletons}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Platform Revenue (Activities)"
        description={showSkeletons ? undefined : `Kalari platform share from activity bookings in ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-64" />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardStatCard
            label="Platform Revenue"
            value={rupees(platformRevenue)}
            subtitle={`${vendorPayout.bookingCount} activity bookings`}
            icon={<IndianRupee className="h-5 w-5" />}
            accent="amber"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Vendor Earned"
            value={rupees(vendorPayout.vendorEarned)}
            subtitle="Total vendor share in period"
            icon={<WalletCards className="h-5 w-5" />}
            accent="purple"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Activity Bookings"
            value={String(vendorPayout.bookingCount)}
            subtitle="Confirmed in selected period"
            icon={<Ticket className="h-5 w-5" />}
            accent="blue"
            loading={showSkeletons}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Vendor Payables"
        description={showSkeletons ? undefined : `Activity vendor payouts in ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-64" />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Vendor Earned"
            value={rupees(vendorPayout.vendorEarned)}
            subtitle="Total in period"
            icon={<WalletCards className="h-5 w-5" />}
            accent="amber"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Paid"
            value={rupees(vendorPayout.vendorPaid)}
            subtitle="Settled in period"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="emerald"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Unpaid"
            value={rupees(vendorPayout.vendorUnpaid)}
            subtitle="Still owed from period bookings"
            icon={<Clock className="h-5 w-5" />}
            accent="blue"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Vendors Unpaid"
            value={String(vendorPayout.vendorCount)}
            subtitle="With outstanding balance"
            icon={<Users className="h-5 w-5" />}
            accent="slate"
            loading={showSkeletons}
          />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Unpaid by Vendor</h3>
          {showSkeletons ? (
            <DashboardTableSkeleton rows={5} />
          ) : vendorPayout.byVendor.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm font-semibold text-slate-500">
              No unpaid vendor payouts in this period
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="pb-2 pr-3">Vendor</th>
                    <th className="pb-2 pr-3">Bookings</th>
                    <th className="pb-2 text-right">Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPayout.byVendor.slice(0, 8).map((row) => (
                    <tr key={row.vendorId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/admin/vendors/${row.vendorId}`}
                          className="font-bold text-slate-900 hover:text-amber-600 dark:text-slate-100"
                        >
                          {toDisplayTitle(row.vendorName)}
                        </Link>
                        <p className="text-[11px] font-semibold text-slate-500">{row.payoutLabel}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-semibold text-slate-500">{row.bookingCount}</td>
                      <td className="py-2.5 text-right font-black text-emerald-700">{rupees(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Agent Commissions (Shows)"
        description={showSkeletons ? undefined : `Show agent commission from bookings in ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-64" />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Commission Earned"
            value={rupees(commission.earned)}
            subtitle="Total in period"
            icon={<WalletCards className="h-5 w-5" />}
            accent="amber"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Paid"
            value={rupees(commission.paid)}
            subtitle="Settled in period"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="emerald"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Unpaid"
            value={rupees(commission.unpaid)}
            subtitle="Still owed from period bookings"
            icon={<Clock className="h-5 w-5" />}
            accent="blue"
            loading={showSkeletons}
          />
          <DashboardStatCard
            label="Agents Unpaid"
            value={String(commission.agentCount)}
            subtitle={`${commission.bookingCount} unpaid bookings`}
            icon={<Users className="h-5 w-5" />}
            accent="slate"
            loading={showSkeletons}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Paid vs Unpaid</h3>
            {showSkeletons ? (
              <DashboardDonutSkeleton />
            ) : (
              <>
                <DashboardDonutChart data={commissionDonutData} darkMode={darkMode} />
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  {commissionDonutData.map((slice) => (
                    <div key={slice.key} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          slice.key === "paid" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {slice.name}: {rupees(slice.value)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Unpaid by Agent</h3>
            {showSkeletons ? (
              <DashboardTableSkeleton rows={5} />
            ) : commission.byAgent.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
                No unpaid show commission in this period
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="pb-2 pr-3">Agent</th>
                      <th className="pb-2 pr-3">Bookings</th>
                      <th className="pb-2 text-right">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commission.byAgent.slice(0, 8).map((row) => (
                      <tr key={row.agentId} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/admin/agents/${row.agentId}`}
                            className="font-bold text-slate-900 hover:text-amber-600 dark:text-slate-100"
                          >
                            {toDisplayTitle(row.agentName)}
                          </Link>
                          <p className="text-[11px] font-semibold text-slate-500">{row.payoutLabel}</p>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-slate-500">{row.bookingCount}</td>
                        <td className="py-2.5 text-right font-black text-emerald-700">{rupees(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Sales Trend"
        description={showSkeletons ? undefined : `Revenue and tickets for ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-52" />}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-slate-100">Revenue</h3>
            {showSkeletons ? (
              <DashboardChartSkeleton />
            ) : (
              <DashboardAreaChart data={revenueChartData} darkMode={darkMode} />
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-slate-100">Tickets Sold</h3>
            {showSkeletons ? (
              <DashboardChartSkeleton />
            ) : (
              <DashboardBarChart data={ticketsChartData} darkMode={darkMode} />
            )}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Shows"
        description={showSkeletons ? undefined : `Shows scheduled in ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-48" />}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Shows in Period</h3>
            {showSkeletons ? (
              <DashboardListSkeleton rows={3} />
            ) : periodShows.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-500">No shows in this period</p>
            ) : (
              <div className="space-y-3">
                {periodShows.map((event) => {
                  const progress = event.capacity > 0 ? (event.booked / event.capacity) * 100 : 0;
                  return (
                    <div key={event.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900 dark:text-slate-100">{event.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDisplayDateValue(event.date)} at {event.time}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          {event.countdown}
                        </span>
                      </div>
                      <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                        <span>Bookings</span>
                        <span>{event.booked}/{event.capacity || "—"} seats</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress >= 80 ? "bg-red-500" : progress >= 60 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Top Performing Shows</h3>
            {showSkeletons ? (
              <DashboardListSkeleton rows={4} />
            ) : topEvents.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-500">No ticket sales in this period</p>
            ) : (
              <div className="space-y-3">
                {topEvents.map((event, index) => (
                  <div
                    key={`${event.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-sm font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100">{event.name}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {event.tickets} tickets · avg {rupees(Math.round(event.avgPrice))}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-emerald-700">{rupees(event.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent Activity"
        description={showSkeletons ? undefined : `Actions logged in ${periodLabel}`}
      >
        {showSkeletons && <DashboardTextSkeleton className="mb-4 h-3 w-44" />}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={fetchActivityLogs} disabled={logsLoading || showSkeletons}>
              {logsLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          {showSkeletons ? (
            <DashboardListSkeleton rows={4} />
          ) : activityLogs.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-slate-500">No admin actions logged in this period</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        {log.action}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {log.entity_type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatLogSummary(log as ActivityLog)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">by {log.performed_by}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                    {new Date(log.performed_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardSection>
    </div>
  );
};

export default Dashboard;
