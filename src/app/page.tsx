"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Heart, MapPin, Search, Star } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { activityImages } from "@/lib/seedData";

type Activity = {
  id: string;
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
  title: string;
  date: string;
  time: string;
  price: number;
  type: "KALARI" | "EVENT";
  status: string;
  activity_id?: string;
  image?: string;
  description?: string;
};

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [activitiesResponse, showsResponse] = await Promise.all([
        fetch("/api/activities?status=ACTIVE").catch(() => null),
        fetch("/api/shows").catch(() => null),
      ]);

      const activitiesPayload = await activitiesResponse?.json().catch(() => null);
      const showsPayload = await showsResponse?.json().catch(() => null);

      setActivities(activitiesPayload?.data || []);
      setShows(showsPayload?.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const activityById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);
  const heroImage = shows[0]?.image || activityById.get(shows[0]?.activity_id || "")?.image || activities[0]?.image || activityImages.hero;
  const kalaryShows = shows.filter((show) => show.type === "KALARI").slice(0, 8);
  const activityBookings = activities.filter((activity) => activity.category !== "Kalari Booking").slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />

      <section className="relative min-h-[560px] overflow-hidden md:min-h-[660px]">
        <img src={heroImage} alt="Kalary booking experiences" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#10284a]/45" />
        <div className="relative mx-auto flex min-h-[560px] max-w-[1530px] flex-col items-center justify-center px-4 text-center md:min-h-[660px]">
          <h1 className="max-w-5xl text-5xl font-black leading-[1.03] tracking-[-0.02em] text-white sm:text-6xl md:text-7xl">
            Discover & book things to do
          </h1>
          <Link href="/activities" className="mt-8 flex h-[72px] w-full max-w-[740px] items-center rounded-full bg-white pl-7 pr-2 shadow-2xl">
            <Search className="mr-3 h-6 w-6 text-slate-400" />
            <span className="flex-1 truncate text-left text-lg font-bold text-slate-600">Find Kalary shows and activities</span>
            <span className="rounded-full bg-[#0875e1] px-9 py-5 text-xl font-black text-white">Search</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[#0875e1]">Kalary booking</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">Reserve live Kalari shows</h2>
          </div>
          <Link href="/book" className="inline-flex items-center gap-2 rounded-full bg-[#0875e1] px-6 py-3 font-black text-white">
            View all shows
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {loading ? <SkeletonRail /> : kalaryShows.length ? (
          <div className="grid auto-cols-[320px] grid-flow-col gap-7 overflow-x-auto pb-5 lg:grid-flow-row lg:grid-cols-3 xl:grid-cols-4">
            {kalaryShows.map((show) => (
              <ShowCard key={show.id} show={show} image={show.image || activityById.get(show.activity_id || "")?.image || activityImages.kalari} />
            ))}
          </div>
        ) : (
          <EmptyState text="No Kalary shows are available yet. Add shows from the portal to publish them here." />
        )}
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[#0875e1]">Activity booking</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">Book activities and experiences</h2>
          </div>
          <Link href="/activities" className="inline-flex items-center gap-2 rounded-full bg-[#10284a] px-6 py-3 font-black text-white">
            View all activities
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {loading ? <SkeletonRail /> : activityBookings.length ? (
          <div className="grid auto-cols-[280px] grid-flow-col gap-7 overflow-x-auto pb-5 md:grid-flow-row md:grid-cols-3 lg:grid-cols-4">
            {activityBookings.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <EmptyState text="No activities are available yet. Add activities from the portal to publish them here." />
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

const ShowCard = ({ show, image }: { show: Show; image: string }) => (
  <Link href={`/book?show=${show.id}`} className="group min-w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl lg:min-w-0">
    <div className="relative">
      <img src={image} alt={show.title} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800">Kalari show</span>
      <button className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#10284a] shadow-lg" aria-label="Save show">
        <Heart className="h-6 w-6" />
      </button>
    </div>
    <div className="p-5">
      <h3 className="text-2xl font-black leading-tight">{show.title}</h3>
      <p className="mt-2 line-clamp-2 min-h-12 text-sm font-medium leading-6 text-slate-600">{show.description}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {show.date}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {show.time}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> Venue</span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-bold text-slate-500">From <strong className="text-xl text-[#10284a]">Rs. {show.price}</strong></span>
        <span className="rounded-full bg-[#0875e1] px-5 py-3 text-sm font-black text-white">Book</span>
      </div>
    </div>
  </Link>
);

const ActivityCard = ({ activity }: { activity: Activity }) => (
  <Link href={`/activities/${activity.slug}`} className="group min-w-[280px] overflow-hidden rounded-lg bg-white md:min-w-0">
    <div className="relative">
      <img src={activity.image || activityImages.hero} alt={activity.title} className="h-[230px] w-full rounded-lg object-cover transition duration-500 group-hover:scale-[1.03]" />
      <button className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#10284a] shadow-lg" aria-label="Save activity">
        <Heart className="h-6 w-6" />
      </button>
    </div>
    <h3 className="mt-3 text-xl font-black leading-tight">{activity.title}</h3>
    <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-600">
      <Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" />
      {activity.rating || 0} ({activity.review_count || 0})
    </div>
    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-600">{activity.description}</p>
    <p className="mt-3 text-sm font-bold text-slate-500">From <span className="text-lg font-black text-[#10284a]">Rs. {activity.price}</span></p>
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
