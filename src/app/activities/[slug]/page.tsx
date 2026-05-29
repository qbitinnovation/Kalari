"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, MapPin, ShieldCheck, Star, Ticket } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { toDisplayTitle } from "@/lib/textFormat";
import {
  formatActivityDateRange,
  getActivityLifecycleStatus,
  isActivityPubliclyBookable,
  isActivityPubliclyVisible,
} from "@/lib/activityAvailability";

type Activity = any;

const publicActivityRouteId = (activity: { slug?: string; id?: string; _id?: string }) =>
  String(activity.id || activity._id || activity.slug || "");

export default function ActivityDetailPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date") || "";
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities/${params.slug}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.data) setActivity(payload.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-[1530px] px-4 pb-16 pt-28">
          <div className="h-[520px] animate-pulse rounded-lg bg-slate-100" />
        </div>
      </main>
    );
  }

  if (!activity || !isActivityPubliclyVisible(activity)) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-32 text-center">
          <h1 className="text-4xl font-black">Activity not found</h1>
          <Link href="/activities" className="btn-gradient-primary mt-6 inline-flex rounded-full px-7 py-3 font-black text-white">View activities</Link>
        </div>
      </main>
    );
  }

  const lifecycle = getActivityLifecycleStatus(activity);
  const canBookActivity = isActivityPubliclyBookable(activity);
  const dateLabel =
    formatActivityDateRange(activity) ||
    toDisplayTitle(activity.duration || "Flexible dates");
  const activityRouteId = publicActivityRouteId(activity);
  const bookingHref = selectedDate
    ? `/activities/${encodeURIComponent(activityRouteId)}/book?date=${encodeURIComponent(selectedDate)}`
    : `/activities/${encodeURIComponent(activityRouteId)}/book`;

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />
      <section className="mx-auto grid max-w-[1530px] gap-8 px-4 pb-10 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-32">
        <div>
          <img src={activity.image} alt={toDisplayTitle(activity.title)} className="h-[520px] w-full rounded-lg object-cover" />
        </div>
        <div className="self-center">
          <p className="text-sm font-black uppercase tracking-widest text-primary-600">{toDisplayTitle(activity.category)}</p>
          <h1 className="mt-3 text-5xl font-black leading-tight">{toDisplayTitle(activity.title)}</h1>
          <div className="mt-5 flex flex-wrap gap-4 text-base font-bold text-slate-600">
            <span className="inline-flex items-center gap-1"><Star className="h-5 w-5 fill-[#ffb800] text-[#ffb800]" /> {activity.rating} ({activity.review_count} reviews)</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-5 w-5" /> {dateLabel}</span>
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
              {canBookActivity ? (
                <div className="text-right">
                  {lifecycle === "UPCOMING" ? (
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-sky-700">
                      Opens {formatActivityDateRange(activity)}
                    </p>
                  ) : null}
                  <Link href={bookingHref} className="btn-gradient-primary inline-flex items-center gap-2 rounded-full px-7 py-4 font-black text-white shadow-lg shadow-primary-900/15">
                    {lifecycle === "UPCOMING" ? "Book ahead" : "Book Now"}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              ) : (
                <span className="inline-flex rounded-full bg-slate-200 px-7 py-4 font-black text-slate-500">
                  Booking unavailable
                </span>
              )}
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
          <h3 className="text-2xl font-black">General admission</h3>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 font-black"><Ticket className="h-5 w-5 text-primary-600" /> Daily limit</span>
              <span className="font-black">{activity.daily_capacity || 20} tickets</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-bold text-slate-500">Admission</span>
              <span className="font-black">GENERAL</span>
            </div>
          </div>
        </aside>
      </section>
      <PublicFooter />
    </main>
  );
}
