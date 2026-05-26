"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, MapPin, Search } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { DatePicker } from "@/components/ui";
import { activityImages } from "@/lib/seedData";
import { getAvailabilityLabel } from "@/lib/booking";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

type SearchType = "all" | "shows" | "activities";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration: string;
  price: number;
  image?: string;
  description?: string;
  booking_status?: "ACTIVE" | "PAUSED";
  daily_capacity?: number;
};

type Show = {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  price: number;
  type: "KALARI" | "EVENT";
  status: string;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
  available_count?: number;
  image?: string;
  description?: string;
  activity_id?: string;
};

const publicRecordId = (record: { id?: string; _id?: string }, fallback: string) =>
  String(record.id || record._id || fallback);

const publicShowBookingHref = (show: { id?: string; _id?: string }) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

const publicActivityHref = (activity: { id?: string; _id?: string; slug?: string }) => {
  const activityId = String(activity.id || activity._id || activity.slug || "");
  return activityId ? `/activities/${encodeURIComponent(activityId)}` : "/activities";
};

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const initialType = (params.get("type") || "all") as SearchType;
  const [query, setQuery] = useState(params.get("q") || "");
  const [type, setType] = useState<SearchType>(["all", "shows", "activities"].includes(initialType) ? initialType : "all");
  const [date, setDate] = useState(params.get("date") || "");
  const [shows, setShows] = useState<Show[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [showsResponse, activitiesResponse] = await Promise.all([
        fetch("/api/shows?upcoming=true").catch(() => null),
        fetch("/api/activities?status=ACTIVE").catch(() => null),
      ]);
      const showsPayload = await showsResponse?.json().catch(() => null);
      const activitiesPayload = await activitiesResponse?.json().catch(() => null);
      setShows((showsPayload?.data || []).filter((show: Show) =>
        show.type === "KALARI" &&
        show.status === "ACTIVE" &&
        show.availability_status !== "SOLD_OUT" &&
        Number(show.available_count ?? 1) > 0
      ));
      setActivities((activitiesPayload?.data || []).filter((activity: Activity) =>
        activity.booking_status !== "PAUSED" &&
        Number(activity.daily_capacity || 20) > 0
      ));
      setLoading(false);
    };

    load();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredShows = useMemo(() => {
    if (type === "activities") return [];

    return shows.filter((show) => {
      const matchesQuery =
        !normalizedQuery ||
        `${show.title} ${show.description || ""} ${show.type} ${show.date} ${show.time}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesDate = !date || show.date === date;
      return matchesQuery && matchesDate;
    });
  }, [date, normalizedQuery, shows, type]);

  const filteredActivities = useMemo(() => {
    if (type === "shows") return [];

    return activities.filter((activity) => {
      const matchesQuery =
        !normalizedQuery ||
        `${activity.title} ${activity.category} ${activity.location} ${activity.description || ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesQuery;
    });
  }, [activities, normalizedQuery, type]);

  const hasResults = filteredShows.length > 0 || filteredActivities.length > 0;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const nextParams = new URLSearchParams();
    if (query.trim()) nextParams.set("q", query.trim());
    if (type !== "all") nextParams.set("type", type);
    if (date) nextParams.set("date", date);
    window.history.replaceState(null, "", `/search${nextParams.toString() ? `?${nextParams}` : ""}`);
  };

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />
      <section className="border-b border-primary-100 bg-[#fdf8ee] pt-28">
        <div className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-black uppercase tracking-widest text-primary-700">Search</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-black leading-tight sm:text-5xl">
            Find shows and activities
          </h1>
          <form onSubmit={submitSearch} className="mt-8 grid gap-3 rounded-3xl border border-primary-100 bg-white p-3 shadow-xl md:grid-cols-[minmax(0,1fr)_190px_auto]">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 md:col-span-3">
              {[
                { value: "all", label: "All" },
                { value: "shows", label: "Shows" },
                { value: "activities", label: "Activities" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value as SearchType)}
                  className={`min-h-11 rounded-lg px-3 text-sm font-black transition ${
                    type === option.value
                      ? "bg-white text-primary-800 shadow-sm ring-1 ring-primary-200"
                      : "text-stone-500 hover:bg-white/70 hover:text-stone-950"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex min-h-14 items-center rounded-xl bg-stone-50 px-4 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-primary-400">
              <Search className="mr-3 h-5 w-5 shrink-0 text-primary-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, type, or location"
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Any date"
              variant="public"
              triggerClassName="min-h-14 rounded-xl border-0 bg-stone-50 px-4 text-sm font-black text-slate-800 ring-1 ring-stone-200 focus:ring-2 focus:ring-primary-400"
              presets={[
                { label: "Today", value: "today" },
                { label: "Clear", value: "clear" },
              ]}
            />
            <button type="submit" className="btn-gradient-primary min-h-14 rounded-xl px-7 font-black text-white">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <SearchLoading />
        ) : !hasResults ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
            <h2 className="text-2xl font-black">No results found.</h2>
            <p className="mt-2 font-semibold text-stone-500">Try another keyword, date, or filter.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredShows.length > 0 && (
              <ResultSection title="Shows" count={filteredShows.length}>
                {filteredShows.map((show) => (
                  <Link key={publicRecordId(show, `search-show-${show.title}-${show.date}`)} href={publicShowBookingHref(show)} className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <img src={show.image || activityImages.kalari} alt={toDisplayTitle(show.title)} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="p-5">
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary-800">
                        Kalari Show
                      </span>
                      <h3 className="mt-3 text-2xl font-black">{toDisplayTitle(show.title)}</h3>
                      <p className="mt-2 line-clamp-2 min-h-11 text-sm font-medium leading-6 text-stone-600">{toDisplayTitle(show.description)}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-stone-600">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDisplayDateValue(show.date)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {formatDisplayTimeValue(show.time)}</span>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                        <span className="font-black">Rs. {show.price}</span>
                        <span className="rounded-full bg-stone-950 px-4 py-2 text-sm font-black text-white">
                          {show.availability_status === "SOLD_OUT" ? "Full" : getAvailabilityLabel(show.availability_status || "AVAILABLE")}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </ResultSection>
            )}

            {filteredActivities.length > 0 && (
              <ResultSection title="Activities" count={filteredActivities.length}>
                {filteredActivities.map((activity) => (
                  <Link key={publicRecordId(activity, `search-activity-${activity.slug || activity.title}`)} href={publicActivityHref(activity)} className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <img src={activity.image || activityImages.hero} alt={toDisplayTitle(activity.title)} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="p-5">
                      <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary-800">{toDisplayTitle(activity.category)}</span>
                      <h3 className="mt-3 text-2xl font-black">{toDisplayTitle(activity.title)}</h3>
                      <p className="mt-2 line-clamp-2 min-h-11 text-sm font-medium leading-6 text-stone-600">{toDisplayTitle(activity.description)}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-stone-600">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {toDisplayTitle(activity.location)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {toDisplayTitle(activity.duration)}</span>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                        <span className="font-black">Rs. {activity.price}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-4 py-2 text-sm font-black text-white">
                          View <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </ResultSection>
            )}
          </div>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-primary-700">{title}</p>
          <h2 className="mt-1 text-3xl font-black">{count} result{count === 1 ? "" : "s"}</h2>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function SearchLoading() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-80 animate-pulse rounded-xl bg-stone-100" />
      ))}
    </div>
  );
}
