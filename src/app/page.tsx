"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { DatePicker } from "@/components/ui";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";
import { activityImages } from "@/lib/seedData";
import { getAvailabilityLabel } from "@/lib/booking";
import { toDisplayTitle } from "@/lib/textFormat";

type SearchType = "all" | "events" | "activities";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration: string;
  price: number;
  rating?: number;
  review_count?: number;
  image?: string;
  description?: string;
  featured?: boolean;
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
  activity_id?: string;
  image?: string;
  description?: string;
};

const publicRecordId = (record: { id?: string; _id?: string }, fallback: string) =>
  String(record.id || record._id || fallback);

const publicShowBookingHref = (show: { id?: string; _id?: string }) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [heroDate, setHeroDate] = useState("");
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [activitiesResponse, showsResponse] = await Promise.all([
        fetch("/api/activities?status=ACTIVE").catch(() => null),
        fetch("/api/shows").catch(() => null),
      ]);

      const activitiesPayload = await activitiesResponse
        ?.json()
        .catch(() => null);
      const showsPayload = await showsResponse?.json().catch(() => null);

      setActivities(activitiesPayload?.data || []);
      setShows(showsPayload?.data || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const activityById = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );
  const heroImage =
    shows[0]?.image ||
    activityById.get(shows[0]?.activity_id || "")?.image ||
    activities[0]?.image ||
    activityImages.hero;
  const kalaryShows = shows
    .filter((show) => show.type === "KALARI")
    .slice(0, 8);
  const activityBookings = activities
    .filter((activity) => activity.category !== "Kalari Booking")
    .slice(0, 8);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchedShows = useMemo(() => {
    if (!normalizedSearch || searchType === "activities") return [];

    return shows
      .filter((show) =>
        `${show.title} ${show.description || ""} ${show.type} ${show.date} ${show.time}`
          .toLowerCase()
          .includes(normalizedSearch),
      )
      .slice(0, 5);
  }, [normalizedSearch, searchType, shows]);
  const matchedActivities = useMemo(() => {
    if (!normalizedSearch || searchType === "events") return [];

    return activities
      .filter((activity) =>
        `${activity.title} ${activity.category} ${activity.location} ${activity.description || ""}`
          .toLowerCase()
          .includes(normalizedSearch),
      )
      .slice(0, 5);
  }, [activities, normalizedSearch, searchType]);
  const hasSearchSuggestions =
    matchedShows.length > 0 || matchedActivities.length > 0;

  const quickBookHref = heroDate
    ? `/book?date=${heroDate}`
    : kalaryShows[0]
      ? publicShowBookingHref(kalaryShows[0])
      : "/book";
  const searchHref = `/search?${new URLSearchParams({
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(searchType !== "all" ? { type: searchType } : {}),
    ...(heroDate ? { date: heroDate } : {}),
  }).toString()}`;

  const openSearchSuggestions = (event?: FormEvent) => {
    event?.preventDefault();
    window.location.href = searchHref;
  };

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />

      <section className="relative min-h-[650px] overflow-visible md:min-h-[720px]">
        <img
          src={heroImage}
          alt="Kalary booking experiences"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-stone-950/55" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />
        <div className="relative mx-auto flex min-h-[650px] max-w-[1530px] flex-col items-center justify-center px-4 pb-16 pt-28 text-center md:min-h-[720px] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-300/30 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-200 backdrop-blur">
              Live Kalari shows and local experiences
            </div>
            <h1 className="mx-auto flex max-w-6xl flex-col items-center text-center text-5xl font-black leading-[1.04] text-white sm:text-6xl lg:text-[4rem] xl:text-[4.35rem] 2xl:text-[4.65rem]">
              <span className="block text-center lg:whitespace-nowrap">
                Book Kovalam's Kalari
              </span>
              <span className="block text-center lg:whitespace-nowrap">
                nights and day experiences.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/80">
              Search live performances, special events, and curated activities.
            </p>
          </div>

          <div
            ref={searchWrapRef}
            className="relative z-30 mt-9 w-full max-w-5xl"
          >
            <form
              role="search"
              onSubmit={openSearchSuggestions}
              className="grid gap-3 rounded-3xl border border-white/70 bg-white/95 p-3 text-left shadow-2xl shadow-stone-950/25 backdrop-blur md:grid-cols-[minmax(0,1fr)_190px_auto_auto]"
            >
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 md:col-span-4">
                {[
                  { value: "all", label: "All" },
                  { value: "events", label: "Events" },
                  { value: "activities", label: "Activities" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSearchType(option.value as SearchType)}
                    className={`min-h-11 rounded-lg px-3 text-sm font-black transition ${
                      searchType === option.value
                        ? "bg-white text-primary-800 shadow-sm ring-1 ring-primary-200"
                        : "text-stone-500 hover:bg-white/70 hover:text-stone-950"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <label className="flex min-h-16 items-center rounded-xl bg-stone-50 px-4 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-primary-400">
                  <Search className="mr-3 h-6 w-6 shrink-0 text-primary-600" />
                  <span className="sr-only">Search shows and activities</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => normalizedSearch && setSearchOpen(true)}
                    placeholder="Search Kalari shows, events, or activities"
                    aria-label="Search shows and activities"
                    aria-expanded={searchOpen}
                    className="min-w-0 flex-1 bg-transparent text-left text-base font-bold text-slate-800 outline-none placeholder:text-slate-400 sm:text-lg"
                  />
                </label>

                {searchOpen && normalizedSearch && (
                  <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[80] max-h-[min(520px,60vh)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-2xl shadow-[#10284a]/25">
                    {hasSearchSuggestions ? (
                      <>
                        {matchedShows.length > 0 && (
                          <SearchSuggestionGroup title="Events">
                            {matchedShows.map((show) => (
                              <SearchSuggestion
                                key={publicRecordId(show, `suggestion-show-${show.title}-${show.date}`)}
                                href={publicShowBookingHref(show)}
                                image={
                                  show.image ||
                                  activityById.get(show.activity_id || "")
                                    ?.image ||
                                  activityImages.kalari
                                }
                                title={toDisplayTitle(show.title)}
                                meta={`${show.type === "EVENT" ? "Event" : "Kalari show"} | ${show.date} | ${show.time}`}
                                action="Book"
                                onSelect={() => setSearchOpen(false)}
                              />
                            ))}
                          </SearchSuggestionGroup>
                        )}

                        {matchedActivities.length > 0 && (
                          <SearchSuggestionGroup title="Activities">
                            {matchedActivities.map((activity) => (
                              <SearchSuggestion
                                key={publicRecordId(activity, `suggestion-activity-${activity.slug || activity.title}`)}
                                href={`/activities/${activity.slug}`}
                                image={activity.image || activityImages.hero}
                                title={toDisplayTitle(activity.title)}
                                meta={`${toDisplayTitle(activity.category)} | ${toDisplayTitle(activity.location || "Kovalam")}`}
                                action="View"
                                onSelect={() => setSearchOpen(false)}
                              />
                            ))}
                          </SearchSuggestionGroup>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-stone-50 px-4 py-5 text-center">
                        <div className="text-sm font-black text-stone-800">
                          Nothing matches this search.
                        </div>
                        <div className="mt-1 text-xs font-semibold text-stone-500">
                          Try another keyword or switch the filter.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DatePicker
                value={heroDate}
                onChange={setHeroDate}
                placeholder="Select date"
                variant="public"
                className="w-full"
                triggerClassName="min-h-16 rounded-xl border-0 bg-stone-50 px-4 text-base font-black text-slate-800 ring-1 ring-stone-200 focus:ring-2 focus:ring-primary-400"
                presets={[
                  { label: "Today", value: "today" },
                  { label: "Clear", value: "clear" },
                ]}
              />
              <button
                type="submit"
                className="btn-gradient-primary inline-flex min-h-16 items-center justify-center rounded-xl px-7 text-base font-black text-white shadow-lg shadow-primary-900/20 transition"
              >
                Search
              </button>
              <Link
                href={quickBookHref}
                className="inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-stone-950 px-7 text-base font-black text-white shadow-lg shadow-stone-950/20 transition hover:bg-primary-700"
              >
                Quick book
                <ArrowRight className="h-4 w-4" />
              </Link>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-primary-600">
              Kalary booking
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
              Reserve live Kalari shows
            </h2>
          </div>
          <Link
            href="/book"
            className="btn-gradient-primary inline-flex items-center gap-2 rounded-full px-6 py-3 font-black text-white shadow-lg shadow-primary-900/15"
          >
            View all shows
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonRail />
        ) : kalaryShows.length ? (
          <div className="grid auto-cols-[320px] grid-flow-col gap-7 overflow-x-auto pb-5 lg:grid-flow-row lg:grid-cols-3 xl:grid-cols-4">
            {kalaryShows.map((show) => (
              <ShowCard
                key={publicRecordId(show, `home-show-${show.title}-${show.date}`)}
                show={show}
                image={
                  show.image ||
                  activityById.get(show.activity_id || "")?.image ||
                  activityImages.kalari
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState text="No Kalari shows are available right now." />
        )}
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-primary-600">
              Activity booking
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
              Book activities and experiences
            </h2>
          </div>
          <Link
            href="/activities"
            className="inline-flex items-center gap-2 rounded-full bg-[#10284a] px-6 py-3 font-black text-white"
          >
            View all activities
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonRail />
        ) : activityBookings.length ? (
          <div className="grid auto-cols-[280px] grid-flow-col gap-7 overflow-x-auto pb-5 md:grid-flow-row md:grid-cols-3 lg:grid-cols-4">
            {activityBookings.map((activity) => (
              <ActivityCard key={publicRecordId(activity, `home-activity-${activity.slug || activity.title}`)} activity={activity} />
            ))}
          </div>
        ) : (
          <EmptyState text="No activities are available right now." />
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

const ShowCard = ({ show, image }: { show: Show; image: string }) => (
  <Link
    href={publicShowBookingHref(show)}
    className="group min-w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl lg:min-w-0"
  >
    <div className="relative">
      <img
        src={image}
        alt={toDisplayTitle(show.title)}
        className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800">
        Kalari show
      </span>
      <span
        className={`absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${show.availability_status === "SOLD_OUT" ? "bg-red-50 text-red-800" : show.availability_status === "FILLING_FAST" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
      >
        {getAvailabilityLabel(show.availability_status || "AVAILABLE")}
      </span>
    </div>
    <div className="p-5">
      <h3 className="text-2xl font-black leading-tight">{toDisplayTitle(show.title)}</h3>
      {show.description && (
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-600">
          {toDisplayTitle(show.description)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-4 w-4" /> {formatDisplayDateValue(show.date)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" /> {formatDisplayTimeValue(show.time)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" /> Venue
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-bold text-slate-500">
          From{" "}
          <strong className="text-xl text-[#10284a]">Rs. {show.price}</strong>
        </span>
        <span
          className={`rounded-full px-5 py-3 text-sm font-black text-white ${show.availability_status === "SOLD_OUT" ? "bg-slate-400" : "btn-gradient-primary"}`}
        >
          {show.availability_status === "SOLD_OUT" ? "Full" : "Book"}
        </span>
      </div>
    </div>
  </Link>
);

const ActivityCard = ({ activity }: { activity: Activity }) => (
  <Link
    href={`/activities/${activity.slug}`}
    className="group min-w-[280px] overflow-hidden rounded-lg bg-white md:min-w-0"
  >
    <div className="relative">
      <img
        src={activity.image || activityImages.hero}
        alt={toDisplayTitle(activity.title)}
        className="h-[230px] w-full rounded-lg object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    </div>
    <h3 className="mt-3 text-xl font-black leading-tight">{toDisplayTitle(activity.title)}</h3>
    <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-600">
      <Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" />
      {activity.rating || 0} ({activity.review_count || 0})
    </div>
    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-600">
      {toDisplayTitle(activity.description)}
    </p>
    <p className="mt-3 text-sm font-bold text-slate-500">
      From{" "}
      <span className="text-lg font-black text-[#10284a]">
        Rs. {activity.price}
      </span>
    </p>
  </Link>
);

const SkeletonRail = () => (
  <div className="grid gap-7 md:grid-cols-3 lg:grid-cols-4">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="h-80 animate-pulse rounded-lg bg-slate-100" />
    ))}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center font-semibold text-slate-600">
    {text}
  </div>
);

const SearchSuggestionGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="[&+&]:mt-3">
    <div className="px-2 pb-2 pt-1 text-xs font-black uppercase tracking-widest text-primary-600">
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </section>
);

const SearchSuggestion = ({
  href,
  image,
  title,
  meta,
  action,
  onSelect,
}: {
  href: string;
  image: string;
  title: string;
  meta: string;
  action: string;
  onSelect: () => void;
}) => (
  <Link
    href={href}
    onClick={onSelect}
    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#f1f7fd] focus-visible:bg-[#f1f7fd] focus-visible:outline-none"
  >
    <img
      src={image}
      alt=""
      className="h-14 w-16 shrink-0 rounded-md object-cover"
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-black text-[#10284a] sm:text-base">
        {title}
      </span>
      <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
        {meta}
      </span>
    </span>
    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-[#10284a] transition group-hover:bg-primary-600 group-hover:text-white">
      {action}
    </span>
  </Link>
);
