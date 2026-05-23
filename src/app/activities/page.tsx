"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Filter, MapPin, Search, Star } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration: string;
  price: number;
  rating: number;
  review_count: number;
  image: string;
  description: string;
  tags?: string[];
};

const publicRecordId = (record: { id?: string; _id?: string }, fallback: string) =>
  String(record.id || record._id || fallback);

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    fetch("/api/activities?status=ACTIVE")
      .then((response) => response.json())
      .then((payload) => {
        setActivities(payload?.data || []);
      })
      .catch(() => undefined);
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(activities.map((activity) => activity.category)))], [activities]);
  const filtered = activities.filter((activity) => {
    const matchesCategory = category === "All" || activity.category === category;
    const matchesQuery = `${activity.title} ${activity.location} ${activity.description}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />
      <section className="border-b border-slate-200 bg-[#f6f8fb]">
        <div className="mx-auto max-w-[1530px] px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-black uppercase tracking-widest text-primary-600">Kerala activities</p>
          <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-3xl text-5xl font-black leading-tight">Things to do and Kalary booking</h1>
              <p className="mt-3 max-w-2xl text-lg font-medium leading-8 text-slate-600">
                Browse Kalari shows, private workshops, wellness sessions, and day activities from Kovalam.
              </p>
            </div>
            <label className="flex h-14 w-full max-w-xl items-center rounded-full border border-slate-200 bg-white pl-5 pr-3 shadow-lg">
              <Search className="mr-3 h-5 w-5 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activities" className="w-full bg-transparent font-semibold outline-none" />
            </label>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1530px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500"><Filter className="h-4 w-4" /> Filter</span>
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full px-5 py-2 text-sm font-black ${category === item ? "bg-[#10284a] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
            {toDisplayTitle(item)}
            </button>
          ))}
        </div>

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((activity) => (
            <Link key={publicRecordId(activity, `activity-${activity.slug || activity.title}`)} href={`/activities/${activity.slug}`} className="group rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="relative overflow-hidden rounded-t-lg">
                <img src={activity.image} alt={toDisplayTitle(activity.title)} className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-primary-600">{toDisplayTitle(activity.category)}</p>
                <h2 className="mt-2 text-2xl font-black leading-tight">{toDisplayTitle(activity.title)}</h2>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {toDisplayTitle(activity.location)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {toDisplayTitle(activity.duration)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{toDisplayTitle(activity.description)}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-sm font-bold"><Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" /> {activity.rating} ({activity.review_count})</span>
                  <span className="font-black">Rs. {activity.price}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
