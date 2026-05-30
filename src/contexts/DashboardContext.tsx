"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { db } from "@/lib/database";
import { getRecordId } from "@/lib/booking";
import { isShowBooking, summarizeCommissionTotalsForRange, type DueAgentBreakdown } from "@/lib/agentCommission";
import {
  isActivityBooking,
  summarizeVendorPayoutTotalsForRange,
  type VendorPayoutRangeSummary,
} from "@/lib/vendorPayout";
import { normalizeActivityLog } from "@/utils/activityLogNormalize";
import {
  aggregateTicketMetrics,
  buildChartSeries,
  calcGrowth,
  defaultDashboardPeriod,
  formatPeriodLabel,
  isTimestampInRange,
  periodDateBounds,
  resolvePeriodRange,
  type ChartPoint,
  type DashboardPeriod,
  type DashboardPeriodPreset,
} from "@/lib/dashboardPeriod";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";

interface DashboardMetrics {
  revenue: number;
  tickets: number;
  avgTicketPrice: number;
  growth: number;
  previousRevenue: number;
  showsWithSales: number;
}

interface PeriodShow {
  id: string;
  name: string;
  date: string;
  time: string;
  booked: number;
  capacity: number;
  countdown: string;
}

interface TopEvent {
  name: string;
  revenue: number;
  tickets: number;
  avgPrice: number;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: any;
  performed_by: string;
  performed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface CommissionDashboardSummary {
  earned: number;
  paid: number;
  unpaid: number;
  agentCount: number;
  bookingCount: number;
  byAgent: DueAgentBreakdown[];
}

interface DashboardData {
  metrics: DashboardMetrics;
  periodShows: PeriodShow[];
  topEvents: TopEvent[];
  chartSeries: ChartPoint[];
  platformRevenue: number;
  vendorPayout: VendorPayoutRangeSummary;
  commission: CommissionDashboardSummary;
  activityLogs: ActivityLog[];
  periodLabel: string;
}

interface DashboardContextType {
  data: DashboardData | null;
  loading: boolean;
  logsLoading: boolean;
  period: DashboardPeriod;
  setPeriodPreset: (preset: DashboardPeriodPreset) => void;
  setCustomPeriod: (start: string, end: string) => void;
  fetchDashboardData: (force?: boolean) => Promise<void>;
  fetchActivityLogs: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};

const emptyMetrics: DashboardMetrics = {
  revenue: 0,
  tickets: 0,
  avgTicketPrice: 0,
  growth: 0,
  previousRevenue: 0,
  showsWithSales: 0,
};

const emptyCommission: CommissionDashboardSummary = {
  earned: 0,
  paid: 0,
  unpaid: 0,
  agentCount: 0,
  bookingCount: 0,
  byAgent: [],
};

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>(() => defaultDashboardPeriod());
  const cachedPeriodKey = useRef("");
  const cachedAt = useRef(0);
  const CACHE_DURATION = 5 * 60 * 1000;

  const getCountdown = (showDateTime: Date, now: Date) => {
    if (showDateTime < now) return "Started";
    const days = differenceInDays(showDateTime, now);
    const hours = differenceInHours(showDateTime, now) % 24;
    const minutes = differenceInMinutes(showDateTime, now) % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const loadDashboard = useCallback(async (activePeriod: DashboardPeriod, force = false) => {
    const resolved = resolvePeriodRange(activePeriod.preset, activePeriod.start, activePeriod.end);
    const fetchKey = `${activePeriod.preset}:${resolved.start}:${resolved.end}`;

    if (!force && cachedPeriodKey.current === fetchKey && Date.now() - cachedAt.current < CACHE_DURATION) {
      return;
    }

    try {
      setLoading(true);
      const { startIso, endIso } = periodDateBounds(resolved.start, resolved.end);
      const prevBounds = periodDateBounds(resolved.previousStart, resolved.previousEnd);

      const [
        ticketResult,
        prevTicketResult,
        showResult,
        agentResult,
        vendorResult,
        bookingResult,
        legacyResult,
        logResult,
      ] = await Promise.all([
        db
          .from("tickets")
          .select("price, generated_at, show_id, status")
          .in("status", ["ACTIVE", "COMPLETED"])
          .gte("generated_at", startIso)
          .lte("generated_at", endIso),
        db
          .from("tickets")
          .select("price, generated_at, show_id, status")
          .in("status", ["ACTIVE", "COMPLETED"])
          .gte("generated_at", prevBounds.startIso)
          .lte("generated_at", prevBounds.endIso),
        db
          .from("shows")
          .select("id, _id, title, date, time, active, layout:layouts(*)")
          .gte("date", resolved.start)
          .lte("date", resolved.end)
          .order("date"),
        db.from("agents").select("*"),
        db.from("vendors").select("*"),
        db.from("bookings").select("*"),
        db.from("users").select("*").eq("role", "agent"),
        db
          .from("activity_logs")
          .select("*")
          .gte("performed_at", startIso)
          .lte("performed_at", endIso)
          .order("performed_at", { ascending: false })
          .limit(10),
      ]);

      const tickets = ticketResult.data || [];
      const prevTickets = prevTicketResult.data || [];
      const currentMetrics = aggregateTicketMetrics(tickets);
      const previousMetrics = aggregateTicketMetrics(prevTickets);

      const chartSeries = buildChartSeries(
        tickets,
        resolved.start,
        resolved.end,
        resolved.chartGranularity,
      );

      const showTitleById = new Map<string, string>();
      (showResult.data || []).forEach((show: any) => {
        const id = String(show.id || show._id || "");
        if (id) showTitleById.set(id, show.title);
      });

      const topEventsMap = new Map<string, { revenue: number; tickets: number; name: string }>();
      tickets.forEach((ticket: any) => {
        const showId = String(ticket.show_id || "");
        const name = showTitleById.get(showId) || "Unknown Show";
        const existing = topEventsMap.get(showId) || { revenue: 0, tickets: 0, name };
        existing.revenue += Number(ticket.price || 0);
        existing.tickets += 1;
        topEventsMap.set(showId, existing);
      });

      const topEvents: TopEvent[] = Array.from(topEventsMap.values())
        .map((row) => ({
          name: row.name,
          revenue: row.revenue,
          tickets: row.tickets,
          avgPrice: row.tickets > 0 ? row.revenue / row.tickets : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const nowDate = new Date();
      const periodShows: PeriodShow[] = [];

      for (const show of showResult.data || []) {
        let capacity = 0;
        if (show.layout?.structure?.sections) {
          show.layout.structure.sections.forEach((section: any) => {
            if (section.rows && Array.isArray(section.rows)) {
              capacity += section.rows.reduce((sum: number, row: any) => sum + (row.seats || 0), 0);
            } else {
              capacity += (section.rows || 0) * (section.seatsPerRow || 0);
            }
          });
        }

        const { data: showBookings } = await db
          .from("bookings")
          .select("seat_code")
          .eq("show_id", show.id || show._id)
          .eq("status", "CONFIRMED");

        let booked = 0;
        showBookings?.forEach((booking: any) => {
          try {
            const seats = JSON.parse(booking.seat_code);
            booked += Array.isArray(seats) ? seats.length : 1;
          } catch {
            booked += booking.seat_code?.includes(",")
              ? booking.seat_code.split(",").length
              : 1;
          }
        });

        const showDateTime = new Date(`${show.date}T${show.time || "00:00"}`);
        periodShows.push({
          id: show.id || show._id,
          name: show.title,
          date: show.date,
          time: show.time,
          booked,
          capacity,
          countdown: getCountdown(showDateTime, nowDate),
        });

        if (periodShows.length >= 5) break;
      }

      const legacyAgents = (legacyResult.data || []).map((user: any) => ({
        ...user,
        name: user.full_name,
        phone: user.phone || user.email,
        payout_frequency: "MONTHLY",
      }));
      const existingIds = new Set((agentResult.data || []).map(getRecordId));
      const agents = [
        ...(agentResult.data || []),
        ...legacyAgents.filter((agent: any) => !existingIds.has(getRecordId(agent))),
      ];
      const vendors = vendorResult.data || [];
      const allBookings = bookingResult.data || [];
      const commissionBookings = allBookings.filter(
        (booking: any) =>
          isShowBooking(booking) && Number(booking.commission_amount || 0) > 0,
      );
      const activityBookings = allBookings.filter((booking: any) => isActivityBooking(booking));

      const commission = summarizeCommissionTotalsForRange(
        agents,
        commissionBookings,
        new Date(startIso),
        new Date(endIso),
      );
      const vendorPayout = summarizeVendorPayoutTotalsForRange(
        vendors,
        activityBookings,
        new Date(startIso),
        new Date(endIso),
      );

      const activityLogs = (logResult.data || [])
        .map(normalizeActivityLog)
        .filter((log) => log.performed_at && isTimestampInRange(log.performed_at, resolved.start, resolved.end))

      setData({
        metrics: {
          revenue: currentMetrics.revenue,
          tickets: currentMetrics.tickets,
          avgTicketPrice: currentMetrics.avgTicketPrice,
          growth: calcGrowth(currentMetrics.revenue, previousMetrics.revenue),
          previousRevenue: previousMetrics.revenue,
          showsWithSales: currentMetrics.showIds,
        },
        periodShows,
        topEvents,
        chartSeries,
        platformRevenue: vendorPayout.platformRevenue,
        vendorPayout,
        commission,
        activityLogs,
        periodLabel: formatPeriodLabel(resolved.start, resolved.end),
      });
      cachedPeriodKey.current = fetchKey;
      cachedAt.current = Date.now();
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(
    async (force = false) => {
      await loadDashboard(period, force);
    },
    [loadDashboard, period],
  );

  const setPeriodPreset = useCallback((preset: DashboardPeriodPreset) => {
    const resolved = resolvePeriodRange(preset);
    setPeriod({ preset, start: resolved.start, end: resolved.end });
  }, []);

  const setCustomPeriod = useCallback((start: string, end: string) => {
    const safeEnd = end >= start ? end : start;
    setPeriod({ preset: "custom", start, end: safeEnd });
  }, []);

  useEffect(() => {
    void loadDashboard(period, true);
  }, [period, loadDashboard]);

  const fetchActivityLogs = useCallback(async () => {
    if (!period) return;
    try {
      setLogsLoading(true);
      const resolved = resolvePeriodRange(period.preset, period.start, period.end);
      const { startIso, endIso } = periodDateBounds(resolved.start, resolved.end);
      const { data: logs } = await db
        .from("activity_logs")
        .select("*")
        .gte("performed_at", startIso)
        .lte("performed_at", endIso)
        .order("performed_at", { ascending: false })
        .limit(10);

      if (logs) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                activityLogs: logs.map(normalizeActivityLog).filter((log) => Boolean(log.performed_at)),
              }
            : prev,
        )
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLogsLoading(false);
    }
  }, [period]);

  const value = {
    data,
    loading,
    logsLoading,
    period,
    setPeriodPreset,
    setCustomPeriod,
    fetchDashboardData,
    fetchActivityLogs,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};
