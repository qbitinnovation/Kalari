export type ActivityLifecycleStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export const todayDateValue = () => new Date().toISOString().slice(0, 10);

const normalizeDate = (value: unknown) => String(value || "").slice(0, 10);

export const getActivityLifecycleStatus = (
  activity: { start_date?: string; end_date?: string },
  today = todayDateValue(),
): ActivityLifecycleStatus => {
  const endDate = normalizeDate(activity.end_date);
  const startDate = normalizeDate(activity.start_date);
  if (endDate && today > endDate) return "COMPLETED";
  if (startDate && today < startDate) return "UPCOMING";
  return "ACTIVE";
};

/** Listed on the public site (includes upcoming — before start date). */
export const isActivityPubliclyVisible = (
  activity: {
    status?: string;
    start_date?: string;
    end_date?: string;
  },
  today = todayDateValue(),
) => {
  const status = String(activity.status || "ACTIVE").toUpperCase();
  if (status === "DRAFT" || status === "COMPLETED") return false;
  return getActivityLifecycleStatus(activity, today) !== "COMPLETED";
};

/** Customer can open the booking flow (upcoming + in-season, not paused/sold-out config). */
export const isActivityPubliclyBookable = (
  activity: {
    status?: string;
    booking_status?: string;
    daily_capacity?: number;
    start_date?: string;
    end_date?: string;
  },
  today = todayDateValue(),
) => {
  if (!isActivityPubliclyVisible(activity, today)) return false;
  if (activity.booking_status === "PAUSED") return false;
  if (Number(activity.daily_capacity || 0) <= 0) return false;
  return true;
};

export const isActivityBookingDateAllowed = (
  activity: {
    status?: string;
    booking_status?: string;
    daily_capacity?: number;
    start_date?: string;
    end_date?: string;
  },
  bookingDate: string,
  today = todayDateValue(),
) => {
  const date = normalizeDate(bookingDate);
  if (!date || date < today) return false;
  const startDate = normalizeDate(activity.start_date);
  const endDate = normalizeDate(activity.end_date);
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  if (getActivityLifecycleStatus(activity, today) === "COMPLETED") return false;
  const status = String(activity.status || "ACTIVE").toUpperCase();
  if (status !== "ACTIVE") return false;
  if (activity.booking_status === "PAUSED") return false;
  return true;
};

export const formatActivityDateRange = (activity: {
  start_date?: string;
  end_date?: string;
}) => {
  const startDate = normalizeDate(activity.start_date);
  const endDate = normalizeDate(activity.end_date);
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return "";
};

export type ActivityDisplayStatus = "DRAFT" | "UPCOMING" | "IN_SEASON" | "COMPLETED";

export const getActivityDisplayStatus = (
  activity: { status?: string; start_date?: string; end_date?: string },
  today = todayDateValue(),
): ActivityDisplayStatus => {
  const catalog = String(activity.status || "ACTIVE").toUpperCase();
  if (catalog === "DRAFT") return "DRAFT";
  if (catalog === "COMPLETED") return "COMPLETED";
  const lifecycle = getActivityLifecycleStatus(activity, today);
  if (lifecycle === "COMPLETED") return "COMPLETED";
  if (lifecycle === "UPCOMING") return "UPCOMING";
  return "IN_SEASON";
};

export const activityDisplayStatusLabels: Record<ActivityDisplayStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  IN_SEASON: "In season",
  COMPLETED: "Completed",
};

export const activityDisplayStatusStyles: Record<ActivityDisplayStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  UPCOMING: "bg-sky-50 text-sky-700",
  IN_SEASON: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-slate-200 text-slate-700",
};

/** Admin-facing date range — never falls back to session duration. */
export const formatAdminActivityDates = (activity: {
  start_date?: string;
  end_date?: string;
}) => {
  const startDate = normalizeDate(activity.start_date);
  const endDate = normalizeDate(activity.end_date);
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return "";
};
