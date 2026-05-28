"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
  MessageSquareQuote,
  Search,
  ShieldCheck,
  Star,
  Ticket,
} from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { HeroBadge } from "@/components/PublicHero";
import { DatePicker } from "@/components/ui";
import {
  formatDisplayDateValue,
  formatDisplayTimeValue,
} from "@/components/ui/date-utils";
import { activityImages } from "@/lib/seedData";
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
  rating?: number;
  review_count?: number;
  image?: string;
  description?: string;
  featured?: boolean;
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
  activity_id?: string;
  image?: string;
  description?: string;
};

type Review = {
  id?: string;
  _id?: string;
  customer_name: string;
  rating: number;
  comment: string;
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "HIDDEN";
};

const publicRecordId = (
  record: { id?: string; _id?: string },
  fallback: string,
) => String(record.id || record._id || fallback);

const publicShowBookingHref = (show: { id?: string; _id?: string }) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

const publicShowDetailHref = (show: { id?: string; _id?: string }) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/shows/${encodeURIComponent(showId)}` : "/shows";
};

const publicActivityHref = (activity: {
  slug?: string;
  id?: string;
  _id?: string;
}) => {
  const activityId = String(activity.id || activity._id || activity.slug || "");
  return activityId
    ? `/activities/${encodeURIComponent(activityId)}/book`
    : "/activities";
};

const publicActivityDetailHref = (activity: {
  slug?: string;
  id?: string;
  _id?: string;
}) => {
  const activityId = String(activity.id || activity._id || activity.slug || "");
  return activityId
    ? `/activities/${encodeURIComponent(activityId)}`
    : "/activities";
};

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [heroDate, setHeroDate] = useState("");
  const [heroParallax, setHeroParallax] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [activitiesResponse, showsResponse, reviewsResponse] =
        await Promise.all([
          fetch("/api/activities?status=ACTIVE").catch(() => null),
          fetch("/api/shows?upcoming=true").catch(() => null),
          fetch("/api/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              collection: "reviews",
              operation: "select",
              filters: { status: "PUBLISHED" },
              orderBy: { column: "created_at", ascending: false },
              limitBy: 6,
            }),
          }).catch(() => null),
        ]);

      const activitiesPayload = await activitiesResponse
        ?.json()
        .catch(() => null);
      const showsPayload = await showsResponse?.json().catch(() => null);
      const reviewsPayload = await reviewsResponse?.json().catch(() => null);

      setActivities(
        (activitiesPayload?.data || []).filter(
          (activity: Activity) =>
            activity.booking_status !== "PAUSED" &&
            Number(activity.daily_capacity || 20) > 0,
        ),
      );
      setShows(
        (showsPayload?.data || []).filter(
          (show: Show) =>
            show.type === "KALARI" &&
            show.status === "ACTIVE" &&
            show.availability_status !== "SOLD_OUT" &&
            Number(show.available_count ?? 1) > 0,
        ),
      );
      setReviews(reviewsPayload?.data || []);
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

  useEffect(() => {
    let frame = 0;

    const updateHeroParallax = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setHeroParallax(Math.min(190, window.scrollY * 0.32));
      });
    };

    updateHeroParallax();
    window.addEventListener("scroll", updateHeroParallax, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateHeroParallax);
    };
  }, []);

  const activityById = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );

  const heroShow = shows[0];
  const heroActivity = heroShow
    ? activityById.get(heroShow.activity_id || "")
    : activities[0];
  const heroImage =
    heroShow?.image ||
    heroActivity?.image ||
    activities[0]?.image ||
    activityImages.hero;
  const kalariShows = shows.slice(0, 6);
  const activityBookings = activities
    .filter((activity) => activity.category !== "Kalari Booking")
    .slice(0, 6);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchedShows = useMemo(() => {
    if (!normalizedSearch || searchType === "activities") return [];

    return shows
      .filter((show) => {
        const matchesSearch =
          `${show.title} ${show.description || ""} ${show.type} ${show.date} ${show.time}`
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesDate = !heroDate || show.date === heroDate;

        return matchesSearch && matchesDate;
      })
      .slice(0, 5);
  }, [heroDate, normalizedSearch, searchType, shows]);

  const matchedActivities = useMemo(() => {
    if (!normalizedSearch || searchType === "shows") return [];

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

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />

      <section className="relative overflow-visible bg-[#100c08]">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={heroImage}
            alt="Kalari booking experiences"
            style={{
              transform: `translate3d(0, ${heroParallax}px, 0) scale(1.12)`,
            }}
            className="absolute -inset-x-8 -top-28 h-[calc(100%+17rem)] w-[calc(100%+4rem)] object-cover opacity-90 will-change-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/96 via-stone-950/74 to-stone-950/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#100c08] via-transparent to-stone-950/55" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white via-white/70 to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[820px] max-w-[1530px] flex-col justify-end px-4 pb-10 pt-32 sm:px-6 lg:px-8">
          <div className="max-w-5xl pb-2">
            <HeroBadge className="mb-5" icon={<Flame className="h-4 w-4" />}>
              Live Kalari shows and Kovalam experiences
            </HeroBadge>
            <h1 className="max-w-5xl text-5xl font-black leading-[0.96] text-white sm:text-6xl lg:text-[5.8rem]">
              Book a front-row night of Kerala's martial tradition.
            </h1>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrustPill
                icon={<Ticket className="h-4 w-4" />}
                text="Instant tickets"
              />
              <TrustPill
                icon={<ShieldCheck className="h-4 w-4" />}
                text="Secure checkout"
              />
              <TrustPill
                icon={<CheckCircle2 className="h-4 w-4" />}
                text="Easy login"
              />
            </div>
          </div>

          <div ref={searchWrapRef} className="relative z-30 mt-10 w-full">
            <div
              role="search"
              className="rounded-lg border border-white/70 bg-white/94 p-3 text-left shadow-2xl shadow-stone-950/25 backdrop-blur"
            >
              <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)_230px] lg:items-stretch">
                <div className="min-w-0 rounded-lg bg-stone-100 p-1.5">
                  <div className="grid h-full min-h-14 grid-cols-3 gap-1.5">
                    {[
                      { value: "all", label: "All" },
                      { value: "shows", label: "Shows" },
                      { value: "activities", label: "Activities" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setSearchType(option.value as SearchType)
                        }
                        className={`flex min-h-12 items-center justify-center rounded-md px-3 text-sm font-black transition ${
                          searchType === option.value
                            ? "bg-white text-primary-800 shadow-sm ring-1 ring-primary-200"
                            : "text-stone-500 hover:bg-white/70 hover:text-stone-950"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <label className="flex h-full min-h-16 items-center rounded-lg bg-stone-50 px-5 pr-2 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-primary-400">
                    <Search className="mr-3 h-6 w-6 shrink-0 text-primary-600" />
                    <span className="sr-only">Search shows and activities</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => normalizedSearch && setSearchOpen(true)}
                      placeholder="Search Kalari shows or activities"
                      aria-label="Search shows and activities"
                      aria-expanded={searchOpen}
                      className="min-w-0 flex-1 bg-transparent text-left text-base font-bold text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </label>

                  {searchOpen && normalizedSearch && (
                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[80] max-h-[min(520px,60vh)] overflow-y-auto rounded-lg border border-stone-200 bg-white p-3 text-left shadow-2xl shadow-[#10284a]/25">
                      {hasSearchSuggestions ? (
                        <>
                          {matchedShows.length > 0 && (
                            <SearchSuggestionGroup title="Shows">
                              {matchedShows.map((show) => (
                                <SearchSuggestion
                                  key={publicRecordId(
                                    show,
                                    `suggestion-show-${show.title}-${show.date}`,
                                  )}
                                  href={publicShowDetailHref(show)}
                                  image={
                                    show.image ||
                                    activityById.get(show.activity_id || "")
                                      ?.image ||
                                    activityImages.kalari
                                  }
                                  title={toDisplayTitle(show.title)}
                                  meta={`${show.type === "EVENT" ? "Event" : "Show"} | ${show.date} | ${show.time}`}
                                  action="View"
                                  onSelect={() => setSearchOpen(false)}
                                />
                              ))}
                            </SearchSuggestionGroup>
                          )}

                          {matchedActivities.length > 0 && (
                            <SearchSuggestionGroup title="Activities">
                              {matchedActivities.map((activity) => (
                                <SearchSuggestion
                                  key={publicRecordId(
                                    activity,
                                    `suggestion-activity-${activity.slug || activity.title}`,
                                  )}
                                  href={publicActivityDetailHref(activity)}
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
                        <div className="rounded-lg bg-stone-50 px-4 py-5 text-center">
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
                  triggerClassName="h-full min-h-16 rounded-lg border-0 bg-stone-50 px-5 text-base font-black text-slate-800 ring-1 ring-stone-200 focus:ring-2 focus:ring-primary-400"
                  presets={[
                    { label: "Today", value: "today" },
                    { label: "Clear", value: "clear" },
                  ]}
                />

              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1530px] px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Kalari booking"
          title="Featured upcoming Kalari shows"
          href="/shows"
          action="View all shows"
        />

        {loading ? (
          <SkeletonRail />
        ) : kalariShows.length ? (
          <ShowCarousel shows={kalariShows} activityById={activityById} />
        ) : (
          <EmptyState text="No Kalari shows are available right now." />
        )}
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Activity booking"
          title="Featured activities and day experiences"
          href="/activities"
          action="View all activities"
        />

        {loading ? (
          <SkeletonRail />
        ) : activityBookings.length ? (
          <ActivityShowcase activities={activityBookings} />
        ) : (
          <EmptyState text="No activities are available right now." />
        )}
      </section>

      {reviews.length > 0 ? (
        <section className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-lg bg-[#fdf8ee] px-5 py-10 ring-1 ring-primary-100 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary-700">
                  <MessageSquareQuote className="h-4 w-4" />
                  Guest reviews
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
                  What visitors say
                </h2>
              </div>
              <p className="max-w-md text-sm font-semibold leading-6 text-stone-600">
                Recent guests highlight the clarity of booking, the intimate
                venue, and the strength of the live Kalari performance.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {reviews.slice(0, 3).map((review, index) => (
                <article
                  key={publicRecordId(review, `review-${index}`)}
                  className="rounded-lg border border-primary-100 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex gap-1 text-[#ffb800]">
                    {Array.from({
                      length: Math.max(
                        1,
                        Math.min(5, Number(review.rating || 5)),
                      ),
                    }).map((_, starIndex) => (
                      <Star key={starIndex} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="line-clamp-4 text-sm font-semibold leading-7 text-stone-600">
                    {review.comment}
                  </p>
                  <p className="mt-5 font-black text-stone-950">
                    {toDisplayTitle(review.customer_name)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <PublicFooter />
    </main>
  );
}

const TrustPill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-black text-white backdrop-blur">
    {icon}
    {text}
  </span>
);

const SectionHeader = ({
  eyebrow,
  title,
  href,
  action,
}: {
  eyebrow: string;
  title: string;
  href: string;
  action: string;
}) => (
  <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="text-sm font-black uppercase tracking-widest text-primary-600">
        {eyebrow}
      </p>
      <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
        {title}
      </h2>
    </div>
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full px-1 py-3 font-black text-primary-700 transition hover:text-stone-950"
    >
      {action}
      <ArrowRight className="h-5 w-5" />
    </Link>
  </div>
);

const ShowCarousel = ({
  shows,
  activityById,
}: {
  shows: Show[];
  activityById: Map<string, Activity>;
}) => {
  const [activeIndex, setActiveIndex] = useState(() =>
    shows.length > 2 ? 1 : 0,
  );
  const [direction, setDirection] = useState<"previous" | "next">("next");
  const [paused, setPaused] = useState(false);

  const scrollShows = (direction: "previous" | "next") => {
    setDirection(direction);
    setActiveIndex((currentIndex) => {
      if (shows.length <= 1) return currentIndex;
      return direction === "next"
        ? (currentIndex + 1) % shows.length
        : (currentIndex - 1 + shows.length) % shows.length;
    });
  };

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      shows.length > 0 ? Math.min(currentIndex, shows.length - 1) : 0,
    );
  }, [shows.length]);

  useEffect(() => {
    if (paused || shows.length <= 1) return;

    const timer = window.setInterval(() => {
      setDirection("next");
      setActiveIndex((currentIndex) => (currentIndex + 1) % shows.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [paused, shows.length]);

  const visibleIndexes = useMemo(() => {
    if (shows.length === 0) return [];
    if (shows.length === 1) return [null, 0, null];

    return [
      (activeIndex - 1 + shows.length) % shows.length,
      activeIndex,
      (activeIndex + 1) % shows.length,
    ];
  }, [activeIndex, shows.length]);

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-[#130f0b] px-3 pb-6 pt-5 shadow-2xl shadow-stone-950/12 ring-1 ring-primary-100 sm:px-5 lg:px-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-2 flex items-center justify-between gap-4 px-1"></div>

      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 hidden w-28 bg-gradient-to-r from-[#130f0b] via-[#130f0b]/82 to-transparent md:block" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 hidden w-28 bg-gradient-to-l from-[#130f0b] via-[#130f0b]/82 to-transparent md:block" />

      <button
        type="button"
        onClick={() => scrollShows("previous")}
        className="absolute left-4 top-1/2 z-30 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/16 text-white shadow-2xl shadow-stone-950/40 ring-1 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:bg-white hover:text-stone-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 md:inline-flex"
        aria-label="Previous shows"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={() => scrollShows("next")}
        className="absolute right-4 top-1/2 z-30 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/16 text-white shadow-2xl shadow-stone-950/40 ring-1 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:bg-white hover:text-stone-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 md:inline-flex"
        aria-label="Next shows"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="relative z-10 grid gap-4 overflow-hidden pb-3 pt-5 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1.25fr)_minmax(0,0.55fr)] md:items-center lg:gap-5">
        {visibleIndexes.map((showIndex, slotIndex) => {
          const show = showIndex !== null ? shows[showIndex] : null;
          const active = slotIndex === 1;
          const slotAnimation =
            direction === "next"
              ? slotIndex === 0
                ? "home-show-slide-left"
                : slotIndex === 1
                  ? "home-show-slide-center-next"
                  : "home-show-slide-right-next"
              : slotIndex === 0
                ? "home-show-slide-left-previous"
                : slotIndex === 1
                  ? "home-show-slide-center-previous"
                  : "home-show-slide-right";

          return (
            <div
              key={`${slotIndex}-${show ? publicRecordId(show, `home-show-${show.title}-${show.date}`) : "empty"}`}
              className={`${slotAnimation} ${slotIndex !== 1 ? "hidden md:block" : ""}`}
            >
              {show ? (
                <ShowCard
                  show={show}
                  image={
                    show.image ||
                    activityById.get(show.activity_id || "")?.image ||
                    activityImages.kalari
                  }
                  active={active}
                  onActivate={
                    !active && showIndex !== null
                      ? () => {
                          setDirection(slotIndex === 0 ? "previous" : "next");
                          setActiveIndex(showIndex);
                        }
                      : undefined
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ShowCard = ({
  show,
  image,
  active,
  onActivate,
}: {
  show: Show;
  image: string;
  active?: boolean;
  onActivate?: () => void;
}) => (
  <div
    className={`relative w-full ${active ? "min-h-[520px]" : "min-h-[390px]"}`}
  >
    <Link
      href={publicShowDetailHref(show)}
      onClick={(event) => {
        if (!active && onActivate) {
          event.preventDefault();
          onActivate();
        }
      }}
      className={`group absolute inset-0 flex overflow-hidden rounded-lg bg-white text-white ring-1 ring-white/20 transition-[box-shadow,opacity,transform] duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${
        active
          ? "z-20 opacity-100 shadow-2xl shadow-black/45"
          : "z-10 scale-[0.94] opacity-60 shadow-lg shadow-black/25 hover:scale-[0.97] hover:opacity-92 focus-visible:opacity-95"
      }`}
    >
      <div className="absolute inset-0">
        <img
          src={image}
          alt={toDisplayTitle(show.title)}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/48 to-stone-950/8" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-stone-950/58 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-stone-950/34 to-transparent" />
      </div>

      <div
        className={`relative z-10 flex w-full flex-col justify-end ${active ? "p-5 sm:p-6" : "p-4"}`}
      >
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-black uppercase tracking-widest text-primary-100 backdrop-blur">
            <Ticket className="h-3.5 w-3.5" />
            Kalari show
          </div>
          <div
            className={`mb-4 flex flex-wrap gap-x-5 gap-y-2 font-black text-white/88 ${
              active ? "text-sm" : "text-xs"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-300" />
              {formatDisplayDateValue(show.date)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-300" />
              {formatDisplayTimeValue(show.time)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary-300" />
              Kovalam
            </span>
          </div>

          <h3
            className={`font-black leading-tight ${
              active ? "text-4xl md:text-5xl" : "text-2xl"
            }`}
          >
            {toDisplayTitle(show.title)}
          </h3>
          {show.description && active && (
            <p className="mt-3 line-clamp-2 max-w-xl text-sm font-semibold leading-6 text-white/78">
              {toDisplayTitle(show.description)}
            </p>
          )}

          <div
            className={`flex items-center justify-between gap-4 border-t border-white/18 ${
              active ? "mt-6 pt-5" : "mt-4 pt-4"
            }`}
          >
            <span className="text-sm font-bold text-white/70">
              From{" "}
              <strong
                className={`${active ? "text-2xl" : "text-xl"} text-white`}
              >
                Rs. {show.price}
              </strong>
            </span>
            <span className="pointer-events-none hidden translate-y-2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-stone-950 opacity-0 shadow-lg transition duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100 md:inline-flex">
              View Details
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  </div>
);

const ActivityShowcase = ({ activities }: { activities: Activity[] }) => {
  const [featured, ...rest] = activities;
  const listItems = rest.slice(0, 3);
  const tileItems = rest.slice(3, 6);

  return (
    <div className="overflow-hidden rounded-lg bg-[#120f0a] shadow-2xl shadow-stone-950/12 ring-1 ring-primary-100">
      <div className="grid lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)]">
        <Link
          href={publicActivityDetailHref(featured)}
          className="group relative block min-h-[560px] overflow-hidden text-white"
        >
          <img
            src={featured.image || activityImages.hero}
            alt={toDisplayTitle(featured.title)}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/42 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-stone-950/58 to-transparent" />
          <div className="relative z-10 flex min-h-[560px] flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-800 shadow-lg">
                Featured experience
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-950/45 px-3 py-2 text-xs font-black backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-[#ffb800] text-[#ffb800]" />
                {featured.rating || 0}
              </span>
            </div>

            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap gap-4 text-sm font-black text-white/82">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary-300" />
                  {toDisplayTitle(featured.location || "Kovalam")}
                </span>
                {featured.duration ? (
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary-300" />
                    {toDisplayTitle(featured.duration)}
                  </span>
                ) : null}
              </div>
              <h3 className="text-4xl font-black leading-tight sm:text-5xl">
                {toDisplayTitle(featured.title)}
              </h3>
              <p className="mt-4 line-clamp-3 max-w-xl text-sm font-semibold leading-7 text-white/76 sm:text-base">
                {toDisplayTitle(featured.description)}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <span className="text-sm font-bold text-white/70">
                  From{" "}
                  <strong className="text-3xl text-white">
                    Rs. {featured.price}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#10284a] shadow-lg transition group-hover:bg-primary-100">
                  View experience
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-[#f8f3e8] p-4 sm:p-5 lg:p-6">
          <div className="flex h-full flex-col gap-4">
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-primary-100">
              <p className="text-xs font-black uppercase tracking-widest text-primary-700">
                Curated around your visit
              </p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-[#10284a]">
                Add a day experience before or after the show.
              </h3>
            </div>

            <div className="grid gap-3">
              {listItems.map((activity, index) => (
                <ActivityListItem
                  key={publicRecordId(
                    activity,
                    `home-activity-list-${activity.slug || activity.title}`,
                  )}
                  activity={activity}
                  index={index + 1}
                />
              ))}
            </div>

            {tileItems.length > 0 ? (
              <div className="mt-auto grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {tileItems.map((activity) => (
                  <ActivityImageTile
                    key={publicRecordId(
                      activity,
                      `home-activity-tile-${activity.slug || activity.title}`,
                    )}
                    activity={activity}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityListItem = ({
  activity,
  index,
}: {
  activity: Activity;
  index: number;
}) => (
  <Link
    href={publicActivityDetailHref(activity)}
    className="group grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-4 rounded-lg bg-white p-3 shadow-sm ring-1 ring-primary-100 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-900/10"
  >
    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[#120f0a] text-lg font-black text-primary-200">
      {String(index).padStart(2, "0")}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-lg font-black text-[#10284a]">
        {toDisplayTitle(activity.title)}
      </span>
      <span className="mt-1 flex flex-wrap gap-3 text-xs font-bold text-stone-500">
        <span>{toDisplayTitle(activity.category || "Activity")}</span>
        {activity.duration ? <span>{toDisplayTitle(activity.duration)}</span> : null}
      </span>
    </span>
    <span className="hidden items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-[#10284a] transition group-hover:bg-primary-600 group-hover:text-white sm:inline-flex">
      View
      <ArrowRight className="h-4 w-4" />
    </span>
  </Link>
);

const ActivityImageTile = ({ activity }: { activity: Activity }) => (
  <Link
    href={publicActivityDetailHref(activity)}
    className="group relative min-h-[150px] overflow-hidden rounded-lg text-white shadow-sm ring-1 ring-white/20"
  >
    <img
      src={activity.image || activityImages.hero}
      alt={toDisplayTitle(activity.title)}
      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/88 via-stone-950/22 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 p-4">
      <p className="line-clamp-2 text-sm font-black leading-tight">
        {toDisplayTitle(activity.title)}
      </p>
      <p className="mt-1 text-xs font-bold text-white/70">
        Rs. {activity.price}
      </p>
    </div>
  </Link>
);

const ActivityCard = ({
  activity,
  featured,
}: {
  activity: Activity;
  featured?: boolean;
}) => (
  <Link
    href={publicActivityHref(activity)}
    className={`group relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-primary-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-900/10 ${
      featured ? "min-h-[520px]" : "min-h-[250px]"
    }`}
  >
    <div
      className={`relative overflow-hidden ${featured ? "h-full min-h-[520px]" : "h-[250px]"}`}
    >
      <img
        src={activity.image || activityImages.hero}
        alt={toDisplayTitle(activity.title)}
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/45 to-stone-950/5" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-stone-950/45 to-transparent" />
    </div>
    <div
      className={`absolute inset-0 flex flex-col justify-between p-5 text-white ${featured ? "sm:p-7" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/92 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary-800 shadow-sm">
          {toDisplayTitle(activity.category || "Activity")}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-stone-950/45 px-3 py-1 text-xs font-black backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-[#ffb800] text-[#ffb800]" />
          {activity.rating || 0}
        </span>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs font-black text-white/82">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary-300" />
            {toDisplayTitle(activity.location || "Kovalam")}
          </span>
          {activity.duration ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary-300" />
              {toDisplayTitle(activity.duration)}
            </span>
          ) : null}
        </div>
        <h3
          className={`${featured ? "text-4xl" : "text-2xl"} font-black leading-tight`}
        >
          {toDisplayTitle(activity.title)}
        </h3>
        <p
          className={`${featured ? "mt-3 line-clamp-3" : "mt-2 line-clamp-2"} text-sm font-semibold leading-6 text-white/78`}
        >
          {toDisplayTitle(activity.description)}
        </p>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/18 pt-4">
          <span className="text-sm font-bold text-white/70">
            From{" "}
            <strong className="text-2xl text-white">
              Rs. {activity.price}
            </strong>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#10284a] shadow-lg transition group-hover:bg-primary-100">
            Book
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </div>
  </Link>
);

const SkeletonRail = () => (
  <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="h-96 animate-pulse rounded-lg bg-slate-100" />
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
