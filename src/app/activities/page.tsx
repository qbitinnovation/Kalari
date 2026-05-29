"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Calendar, Clock, MapPin, Star } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHero } from "@/components/PublicHero";
import { DatePicker, Pagination, SearchInput } from "@/components/ui";
import { todayDateValue } from "@/components/ui/date-utils";
import { activityImages } from "@/lib/seedData";
import { formatActivityDateRange, isActivityPubliclyBookable, isActivityPubliclyVisible } from "@/lib/activityAvailability";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration?: string;
  start_date?: string;
  end_date?: string;
  price: number;
  rating: number;
  review_count: number;
  image: string;
  description: string;
  tags?: string[];
  booking_status?: "ACTIVE" | "PAUSED";
  daily_capacity?: number;
};

const publicRecordId = (
  record: { id?: string; _id?: string },
  fallback: string,
) => String(record.id || record._id || fallback);

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    fetch("/api/activities?status=ACTIVE")
      .then((response) => response.json())
      .then((payload) => {
        setActivities(
          (payload?.data || []).filter((activity: Activity) =>
            isActivityPubliclyVisible(activity),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(
    () =>
      activities.filter((activity) => {
        const matchesQuery =
          `${activity.title} ${activity.location} ${activity.description} ${activity.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        return matchesQuery;
      }),
    [activities, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activityHref = (activity: Activity) => {
    const routeId = encodeURIComponent(String(activity.id || activity._id || activity.slug || ""));
    const href = `/activities/${routeId}/book`;
    return selectedDate ? `${href}?date=${encodeURIComponent(selectedDate)}` : href;
  };
  const activityDetailHref = (activity: Activity) => {
    const routeId = encodeURIComponent(String(activity.id || activity._id || activity.slug || ""));
    return routeId ? `/activities/${routeId}` : "/activities";
  };

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-[#10284a]">
      <PublicNavbar />
      <PublicHero
        badge="Kerala activities"
        badgeIcon={<Compass className="h-3.5 w-3.5" />}
        title="Things to do and day experiences."
        description="Browse private workshops, wellness sessions, and daily activities from Kovalam."
        image={activityImages.hero}
      />

      <section className="sticky top-20 z-30 border-b border-stone-200 bg-white/80 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search activities..."
              containerClassName="w-full min-w-0"
              className="min-h-12 border-stone-200 font-bold placeholder:font-semibold focus:border-amber-400 focus:ring-amber-400/20"
            />
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="All dates"
              minDate={todayDateValue()}
              presets={[
                { label: "Today", value: "today" },
                { label: "Clear", value: "clear" },
              ]}
              variant="public"
              className="w-full"
              triggerClassName="min-h-12 w-full rounded-xl font-bold"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-stone-200 bg-white py-32 text-center">
            <Calendar className="mx-auto mb-6 h-14 w-14 text-stone-300" />
            <h3 className="text-2xl font-black text-stone-950">No activities found.</h3>
            <p className="mx-auto mt-2 max-w-md text-stone-500">
              Try changing the search text or date filter.
            </p>
          </div>
        ) : (
          <>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedActivities.map((activity) => (
            <article
              key={publicRecordId(
                activity,
                `activity-${activity.slug || activity.title}`,
              )}
              className="group rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <Link href={activityDetailHref(activity)} className="block">
                <div className="relative overflow-hidden rounded-t-lg">
                  <img
                    src={activity.image}
                    alt={toDisplayTitle(activity.title)}
                    className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
              </Link>
              <div className="p-5">
                <Link href={activityDetailHref(activity)} className="block">
                <h2 className="text-2xl font-black leading-tight">
                  {toDisplayTitle(activity.title)}
                </h2>
                </Link>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />{" "}
                    {toDisplayTitle(activity.location)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />{" "}
                    {formatActivityDateRange(activity) ||
                      toDisplayTitle(activity.duration || "Flexible dates")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-600">
                  {toDisplayTitle(activity.description)}
                </p>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1 text-sm font-bold">
                    <Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" />{" "}
                    {activity.rating} ({activity.review_count})
                  </span>
                  <span className="font-black">Rs. {activity.price}</span>
                </div>
                {isActivityPubliclyBookable(activity) ? (
                  <Link href={activityHref(activity)} className="btn-gradient-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-900/10">
                    Book Now
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <div className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-500">
                    Booking unavailable
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="mt-12"
        />
          </>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}
