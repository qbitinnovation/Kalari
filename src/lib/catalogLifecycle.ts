import { getActivityLifecycleStatus, todayDateValue } from "@/lib/activityAvailability";
import { getRecordId, getShowStartTime, isShowBookableAt } from "@/lib/booking";

export type ActivityCatalogStatus = "ACTIVE" | "DRAFT" | "COMPLETED";

export const SHOW_DONE_GRACE_MS = 30 * 60 * 1000;

const normalizeDate = (value: unknown) => String(value || "").slice(0, 10);

export const resolveShowStatus = (show: any, now = new Date()): string => {
  const current = String(show?.status || "ACTIVE").toUpperCase();
  if (current === "SHOW_DONE") return "SHOW_DONE";

  const startTime = getShowStartTime(show);
  if (!startTime) return show?.status || "ACTIVE";

  const showEndGrace = new Date(startTime.getTime() + SHOW_DONE_GRACE_MS);
  if (now > showEndGrace) return "SHOW_DONE";
  if (now > startTime && current === "ACTIVE") return "SHOW_STARTED";
  if (now > startTime && current === "HOUSE_FULL") return "SHOW_DONE";

  return show?.status || "ACTIVE";
};

export const shouldCompleteActivity = (activity: any, today = todayDateValue()) => {
  const current = String(activity?.status || "ACTIVE").toUpperCase();
  if (current === "DRAFT" || current === "COMPLETED") return false;
  const endDate = normalizeDate(activity?.end_date);
  if (!endDate) return false;
  return today > endDate;
};

export const resolveActivityStatus = (
  activity: any,
  today = todayDateValue(),
): ActivityCatalogStatus => {
  const current = String(activity?.status || "ACTIVE").toUpperCase();
  if (current === "DRAFT") return "DRAFT";
  if (current === "COMPLETED") return "COMPLETED";
  if (shouldCompleteActivity(activity, today)) return "COMPLETED";
  return "ACTIVE";
};

/** Past or finished shows should not appear on the public website. */
export const isShowPubliclyAccessible = (show: any, now = new Date()) => {
  if (resolveShowStatus(show, now) === "SHOW_DONE") return false;
  const startTime = getShowStartTime(show);
  if (!startTime) return false;
  const today = todayDateValue();
  if (String(show?.date || "").slice(0, 10) < today) return false;
  return isShowBookableAt(show, now);
};

export const syncShowRecord = (show: any, now = new Date()) => {
  const nextStatus = resolveShowStatus(show, now);
  if (nextStatus === show.status) return false;
  show.status = nextStatus;
  show.updated_at = now.toISOString();
  return true;
};

export const syncActivityRecord = (activity: any, today = todayDateValue()) => {
  const nextStatus = resolveActivityStatus(activity, today);
  if (nextStatus === activity.status) return false;
  activity.status = nextStatus;
  activity.updated_at = new Date().toISOString();
  return true;
};

export const completeTicketsForShow = (store: Record<string, any[]>, showId: string) => {
  let changed = false;
  for (const ticket of store.tickets || []) {
    if (String(ticket.show_id) === showId && ticket.status === "ACTIVE") {
      ticket.status = "COMPLETED";
      changed = true;
    }
  }
  return changed;
};

export const syncShowStatusesLocal = (store: Record<string, any[]>) => {
  let changed = false;
  const now = new Date();
  for (const show of store.shows || []) {
    const previous = show.status;
    if (!syncShowRecord(show, now)) continue;
    changed = true;
    if (show.status === "SHOW_DONE" && previous !== "SHOW_DONE") {
      if (completeTicketsForShow(store, String(getRecordId(show)))) changed = true;
    }
  }
  return changed;
};

export const syncActivityStatusesLocal = (store: Record<string, any[]>) => {
  let changed = false;
  const today = todayDateValue();
  for (const activity of store.activities || []) {
    if (syncActivityRecord(activity, today)) changed = true;
  }
  return changed;
};

export async function syncShowStatusesMongo(Show: any, Ticket: any, shows: any[]) {
  const now = new Date();
  for (const show of shows) {
    const previous = show.status;
    const nextStatus = resolveShowStatus(show, now);
    if (nextStatus === previous) continue;

    await Show.updateOne(
      { _id: show._id },
      { $set: { status: nextStatus, updated_at: now.toISOString() } },
    );
    show.status = nextStatus;

    if (nextStatus === "SHOW_DONE" && previous !== "SHOW_DONE") {
      await Ticket.updateMany(
        { show_id: getRecordId(show), status: "ACTIVE" },
        { $set: { status: "COMPLETED" } },
      );
    }
  }
  return shows;
}

export async function syncActivityStatusesMongo(Activity: any, activities: any[]) {
  const today = todayDateValue();
  const now = new Date().toISOString();
  for (const activity of activities) {
    const nextStatus = resolveActivityStatus(activity, today);
    if (nextStatus === activity.status) continue;

    await Activity.updateOne(
      { _id: activity._id },
      { $set: { status: nextStatus, updated_at: now } },
    );
    activity.status = nextStatus;
  }
  return activities;
}

export async function syncAllShowsInMongo(Show: any, Ticket: any) {
  const shows = await Show.find({ status: { $nin: ["SHOW_DONE"] } }).lean();
  if (shows.length === 0) return;
  await syncShowStatusesMongo(Show, Ticket, shows);
}

export async function syncAllActivitiesInMongo(Activity: any) {
  const activities = await Activity.find({
    status: { $nin: ["COMPLETED", "DRAFT"] },
  }).lean();
  if (activities.length === 0) return;
  await syncActivityStatusesMongo(Activity, activities);
}

/** True when an activity should appear anywhere on the public website. */
export const isActivityPubliclyListed = (activity: any, today = todayDateValue()) => {
  if (String(activity?.status || "ACTIVE").toUpperCase() === "COMPLETED") return false;
  if (String(activity?.status || "ACTIVE").toUpperCase() === "DRAFT") return false;
  return getActivityLifecycleStatus(activity, today) !== "COMPLETED";
};
