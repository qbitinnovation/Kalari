import type { Show } from "@/lib/database";
import { isActivityPubliclyBookable } from "@/lib/activityAvailability";
import { isShowBookableAt } from "@/lib/booking";
import { isShowCompleted } from "@/lib/catalogLifecycle";

type BookableActivity = {
  status?: string;
  booking_status?: string;
  daily_capacity?: number;
  start_date?: string;
  end_date?: string;
};

export type AdminBookingUrlOptions = {
  showId?: string;
  activityId?: string;
  date?: string;
};

export function getAdminBookingUrl(options: AdminBookingUrlOptions) {
  const params = new URLSearchParams();
  if (options.showId) params.set("showId", options.showId);
  if (options.activityId) params.set("activityId", options.activityId);
  if (options.date) params.set("date", options.date);
  const query = params.toString();
  return query ? `/admin/booking?${query}` : "/admin/booking";
}

export function canBookShow(show: Pick<Show, "status" | "date" | "time" | "availability_status" | "available_count">) {
  if (isShowCompleted(show)) return false;
  if (show.status !== "ACTIVE") return false;
  if (!isShowBookableAt(show)) return false;
  if (show.availability_status === "SOLD_OUT") return false;
  if (Number(show.available_count ?? 1) <= 0) return false;
  return true;
}

export function canBookActivity(activity: BookableActivity) {
  return isActivityPubliclyBookable(activity);
}
