"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, ShieldCheck, Star } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = any;
type Show = any;

const publicRecordId = (record: { id?: string; _id?: string }, fallback = "") =>
  String(record?.id || record?._id || fallback);

const publicShowBookingHref = (show: { id?: string; _id?: string }) => {
  const showId = publicRecordId(show);
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

export default function ActivityDetailPage() {
  const params = useParams<{ slug: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities/${params.slug}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.data) {
          setActivity(payload.data);
          return fetch(`/api/shows?activityId=${publicRecordId(payload.data)}`);
        }
        return null;
      })
      .then((response) => response?.json())
      .then((payload) => {
        if (payload?.data) setShows(payload.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-[1530px] px-4 py-16">
          <div className="h-[520px] animate-pulse rounded-lg bg-slate-100" />
        </div>
      </main>
    );
  }

  if (!activity) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-4xl px-4 py-24 text-center">
          <h1 className="text-4xl font-black">Activity not found</h1>
          <Link href="/activities" className="btn-gradient-primary mt-6 inline-flex rounded-full px-7 py-3 font-black text-white">View activities</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />
      <section className="mx-auto grid max-w-[1530px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <img src={activity.image} alt={toDisplayTitle(activity.title)} className="h-[520px] w-full rounded-lg object-cover" />
        </div>
        <div className="self-center">
          <p className="text-sm font-black uppercase tracking-widest text-primary-600">{toDisplayTitle(activity.category)}</p>
          <h1 className="mt-3 text-5xl font-black leading-tight">{toDisplayTitle(activity.title)}</h1>
          <div className="mt-5 flex flex-wrap gap-4 text-base font-bold text-slate-600">
            <span className="inline-flex items-center gap-1"><Star className="h-5 w-5 fill-[#ffb800] text-[#ffb800]" /> {activity.rating} ({activity.review_count} reviews)</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-5 w-5" /> {toDisplayTitle(activity.duration)}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-5 w-5" /> {toDisplayTitle(activity.location)}</span>
          </div>
          <p className="mt-6 text-lg font-medium leading-8 text-slate-700">{toDisplayTitle(activity.description)}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {(activity.tags || []).map((tag: string) => (
              <span key={tag} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">{tag}</span>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-slate-200 bg-[#f6f8fb] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">From</p>
                <p className="text-4xl font-black">Rs. {activity.price}</p>
              </div>
              <Link href={activity.category === "Kalari Booking" ? `/book?activity=${encodeURIComponent(publicRecordId(activity))}` : "/book"} className="btn-gradient-primary inline-flex items-center gap-2 rounded-full px-7 py-4 font-black text-white shadow-lg shadow-primary-900/15">
                Check availability
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1530px] gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-3xl font-black">Experience highlights</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(activity.highlights || []).map((highlight: string) => (
              <div key={highlight} className="flex gap-3 rounded-lg bg-slate-50 p-4 font-bold">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                {highlight}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2 font-black">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Secure booking
          </div>
          <h3 className="text-2xl font-black">Upcoming Kalari slots</h3>
          <div className="mt-4 grid gap-3">
            {shows.length ? shows.map((show, index) => (
              <Link key={publicRecordId(show, `activity-show-${index}`)} href={publicShowBookingHref(show)} className="rounded-lg border border-slate-200 p-4 hover:border-primary-500">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{toDisplayTitle(show.title)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600"><CalendarDays className="mr-1 inline h-4 w-4" /> {show.date} at {show.time}</p>
                  </div>
                  <p className="font-black">Rs. {show.price}</p>
                </div>
              </Link>
            )) : (
              <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-600">No upcoming slots are available right now.</p>
            )}
          </div>
        </aside>
      </section>
      <PublicFooter />
    </main>
  );
}
