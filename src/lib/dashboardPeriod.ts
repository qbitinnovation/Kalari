import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export type DashboardPeriodPreset = "today" | "week" | "month" | "year" | "custom";
export type ChartGranularity = "hour" | "day" | "week" | "month";

export interface DashboardPeriod {
  preset: DashboardPeriodPreset;
  start: string;
  end: string;
}

export interface ResolvedPeriodRange {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  chartGranularity: ChartGranularity;
}

export interface ChartPoint {
  label: string;
  revenue: number;
  tickets: number;
}

const toDateKey = (value: Date | string) => {
  const date = typeof value === "string" ? parseISO(value.split("T")[0]) : value;
  return format(date, "yyyy-MM-dd");
};

export const periodDateBounds = (start: string, end: string) => ({
  startIso: `${start}T00:00:00`,
  endIso: `${end}T23:59:59.999`,
});

export const isTimestampInRange = (value: string | undefined, start: string, end: string) => {
  if (!value) return false;
  const dateKey = value.split("T")[0];
  return dateKey >= start && dateKey <= end;
};

export const calcGrowth = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

export const resolvePeriodRange = (
  preset: DashboardPeriodPreset,
  customStart?: string,
  customEnd?: string,
  reference = new Date(),
): ResolvedPeriodRange => {
  let startDate: Date;
  let endDate: Date;
  let previousStartDate: Date;
  let previousEndDate: Date;
  let chartGranularity: ChartGranularity = "day";

  switch (preset) {
    case "today":
      startDate = startOfDay(reference);
      endDate = endOfDay(reference);
      previousStartDate = startOfDay(subDays(reference, 1));
      previousEndDate = endOfDay(subDays(reference, 1));
      chartGranularity = "hour";
      break;
    case "week":
      startDate = startOfWeek(reference, { weekStartsOn: 1 });
      endDate = endOfWeek(reference, { weekStartsOn: 1 });
      previousStartDate = startOfWeek(subWeeks(reference, 1), { weekStartsOn: 1 });
      previousEndDate = endOfWeek(subWeeks(reference, 1), { weekStartsOn: 1 });
      chartGranularity = "day";
      break;
    case "month":
      startDate = startOfMonth(reference);
      endDate = endOfMonth(reference);
      previousStartDate = startOfMonth(subMonths(reference, 1));
      previousEndDate = endOfMonth(subMonths(reference, 1));
      chartGranularity = "day";
      break;
    case "year":
      startDate = startOfYear(reference);
      endDate = endOfYear(reference);
      previousStartDate = startOfYear(subYears(reference, 1));
      previousEndDate = endOfYear(subYears(reference, 1));
      chartGranularity = "month";
      break;
    case "custom":
    default: {
      const start = customStart || toDateKey(reference);
      const end = customEnd || start;
      startDate = startOfDay(parseISO(start));
      endDate = endOfDay(parseISO(end));
      const span = differenceInCalendarDays(endDate, startDate) + 1;
      previousEndDate = endOfDay(subDays(startDate, 1));
      previousStartDate = startOfDay(subDays(previousEndDate, span - 1));
      if (span <= 1) chartGranularity = "hour";
      else if (span <= 31) chartGranularity = "day";
      else if (span <= 120) chartGranularity = "week";
      else chartGranularity = "month";
      break;
    }
  }

  return {
    start: toDateKey(startDate),
    end: toDateKey(endDate),
    previousStart: toDateKey(previousStartDate),
    previousEnd: toDateKey(previousEndDate),
    chartGranularity,
  };
};

export const defaultDashboardPeriod = (): DashboardPeriod => {
  const range = resolvePeriodRange("month");
  return { preset: "month", start: range.start, end: range.end };
};

export const formatPeriodLabel = (start: string, end: string) => {
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  if (start === end) return format(startDate, "d MMM yyyy");
  if (format(startDate, "yyyy-MM") === format(endDate, "yyyy-MM")) {
    return `${format(startDate, "d")} – ${format(endDate, "d MMM yyyy")}`;
  }
  if (format(startDate, "yyyy") === format(endDate, "yyyy")) {
    return `${format(startDate, "d MMM")} – ${format(endDate, "d MMM yyyy")}`;
  }
  return `${format(startDate, "d MMM yyyy")} – ${format(endDate, "d MMM yyyy")}`;
};

type TicketRow = { price: number; generated_at: string; show_id?: string };

const filterTicketsInRange = (tickets: TicketRow[], start: string, end: string) =>
  tickets.filter((ticket) => isTimestampInRange(ticket.generated_at, start, end));

export const aggregateTicketMetrics = (tickets: TicketRow[]) => {
  const revenue = tickets.reduce((sum, ticket) => sum + Number(ticket.price || 0), 0);
  const count = tickets.length;
  return {
    revenue,
    tickets: count,
    avgTicketPrice: count > 0 ? revenue / count : 0,
    showIds: new Set(
      tickets.map((ticket) => String(ticket.show_id || "")).filter(Boolean),
    ).size,
  };
};

export const buildChartSeries = (
  tickets: TicketRow[],
  start: string,
  end: string,
  granularity: ChartGranularity,
): ChartPoint[] => {
  const inRange = filterTicketsInRange(tickets, start, end);
  const startDate = parseISO(start);
  const endDate = parseISO(end);

  if (granularity === "hour") {
    return Array.from({ length: 24 }, (_, hour) => {
      const hourTickets = inRange.filter((ticket) => {
        const date = new Date(ticket.generated_at);
        return date.getHours() === hour;
      });
      return {
        label: format(new Date(2000, 0, 1, hour), "ha"),
        revenue: hourTickets.reduce((sum, t) => sum + t.price, 0),
        tickets: hourTickets.length,
      };
    });
  }

  if (granularity === "month") {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    return months.map((month) => {
      const monthStart = toDateKey(startOfMonth(month));
      const monthEnd = toDateKey(endOfMonth(month));
      const monthTickets = inRange.filter((ticket) =>
        isTimestampInRange(ticket.generated_at, monthStart, monthEnd),
      );
      return {
        label: format(month, "MMM"),
        revenue: monthTickets.reduce((sum, t) => sum + t.price, 0),
        tickets: monthTickets.length,
      };
    });
  }

  if (granularity === "week") {
    const points: ChartPoint[] = [];
    let cursor = startOfDay(startDate);
    let index = 1;
    while (cursor <= endDate) {
      const weekEnd = endOfDay(addDays(cursor, 6));
      const bucketEnd = weekEnd > endDate ? endDate : weekEnd;
      const bucketStart = toDateKey(cursor);
      const bucketEndKey = toDateKey(bucketEnd);
      const weekTickets = inRange.filter((ticket) =>
        isTimestampInRange(ticket.generated_at, bucketStart, bucketEndKey),
      );
      points.push({
        label: `W${index}`,
        revenue: weekTickets.reduce((sum, t) => sum + t.price, 0),
        tickets: weekTickets.length,
      });
      cursor = addDays(cursor, 7);
      index += 1;
    }
    return points;
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.map((day) => {
    const dayKey = toDateKey(day);
    const dayTickets = inRange.filter((ticket) => ticket.generated_at.startsWith(dayKey));
    return {
      label: format(day, days.length <= 7 ? "EEE" : "d MMM"),
      revenue: dayTickets.reduce((sum, t) => sum + t.price, 0),
      tickets: dayTickets.length,
    };
  });
};
