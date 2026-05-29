"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import {
  formatDisplayDateValue,
  formatDisplayTimeValue,
} from "@/components/ui/date-utils";
import { getAvailabilityLabel, getRecordId, isShowBookableAt } from "@/lib/booking";
import { isShowPubliclyAccessible } from "@/lib/catalogLifecycle";
import { db } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { toDisplayTitle } from "@/lib/textFormat";

type Show = {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  price: number;
  status: string;
  image?: string;
  description?: string;
  available_count?: number;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
};

const publicShowBookingHref = (show: { id?: string; _id?: string }) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

export default function ShowDetailPage() {
  const params = useParams<{ id: string }>();
  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadShow = async () => {
      setLoading(true);
      const { data } = await db
        .from("shows")
        .select("*")
        .eq("id", params.id)
        .single();

      setShow(data || null);
      setLoading(false);
    };

    loadShow();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-[1530px] px-4 pb-16 pt-28 sm:px-6 lg:px-8">
          <div className="h-[560px] animate-pulse rounded-lg bg-slate-100" />
        </div>
      </main>
    );
  }

  if (!show || !isShowPubliclyAccessible(show)) {
    return (
      <main className="min-h-screen bg-white text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-32 text-center">
          <h1 className="text-4xl font-black">Show not found</h1>
          <Link
            href="/shows"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-950 px-7 py-3 font-black text-white transition hover:bg-primary-700"
          >
            View shows
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </main>
    );
  }

  const canBookShow = isShowBookableAt(show);
  const image = show.image || activityImages.kalari;
  const availabilityLabel = getAvailabilityLabel(
    show.availability_status || "AVAILABLE",
  );

  return (
    <main className="min-h-screen bg-white text-[#10284a]">
      <PublicNavbar />

      <section className="mx-auto grid max-w-[1530px] gap-8 px-4 pb-12 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-32">
        <div className="relative min-h-[520px] overflow-hidden rounded-lg bg-stone-950">
          <img
            src={image}
            alt={toDisplayTitle(show.title)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent" />
          <Link
            href="/shows"
            className="absolute left-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#10284a] shadow-lg transition hover:bg-primary-100"
            aria-label="Back to shows"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="self-center">
          <p className="text-sm font-black uppercase tracking-widest text-primary-600">
            Kalari show
          </p>
          <h1 className="mt-3 text-5xl font-black leading-tight md:text-6xl">
            {toDisplayTitle(show.title)}
          </h1>
          <div className="mt-5 flex flex-wrap gap-4 text-base font-bold text-slate-600">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary-600" />
              {formatDisplayDateValue(show.date)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              {formatDisplayTimeValue(show.time)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              Kovalam
            </span>
          </div>

          {show.description ? (
            <p className="mt-6 text-lg font-medium leading-8 text-slate-700">
              {toDisplayTitle(show.description)}
            </p>
          ) : null}

          <div className="mt-8 rounded-lg border border-slate-200 bg-[#f6f8fb] p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">From</p>
                <p className="text-4xl font-black">Rs. {show.price}</p>
                <p className="mt-1 text-sm font-black text-primary-700">
                  {availabilityLabel}
                  {Number(show.available_count || 0) > 0
                    ? ` - ${show.available_count} seats left`
                    : ""}
                </p>
              </div>
              {canBookShow ? (
                <Link
                  href={publicShowBookingHref(show)}
                  className="btn-gradient-primary inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 font-black text-white shadow-lg shadow-primary-900/15"
                >
                  Book Now
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <span className="inline-flex justify-center rounded-full bg-slate-200 px-7 py-4 font-black text-slate-500">
                  Booking unavailable
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1530px] gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-3xl font-black">What to expect</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Live Kalaripayattu performance",
              "Traditional weapons and movement sequences",
              "Reserved ticket booking",
              "Evening experience in Kovalam",
            ].map((highlight) => (
              <div
                key={highlight}
                className="flex gap-3 rounded-lg bg-slate-50 p-4 font-bold"
              >
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
          <h3 className="text-2xl font-black">Ticket details</h3>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 font-black">
                <Ticket className="h-5 w-5 text-primary-600" />
                Admission
              </span>
              <span className="font-black">
                RESERVED
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-bold text-slate-500">Status</span>
              <span className="font-black">{availabilityLabel}</span>
            </div>
          </div>
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
