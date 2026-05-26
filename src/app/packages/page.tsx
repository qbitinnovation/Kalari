"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Package, Users } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHero } from "@/components/PublicHero";
import { db, type PackageItem } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { toDisplayTitle } from "@/lib/textFormat";

const fallbackPackages: PackageItem[] = [
  {
    id: "fallback-package-backwater",
    title: "Kalari Evening + Backwater Day",
    slug: "kalari-evening-backwater-day",
    image: activityImages.boat,
    price: 2499,
    duration: "1 day",
    group_size: "2-12 guests",
    location: "Kovalam and nearby",
    summary: "Pair the signature evening performance with a guided Poovar backwater escape.",
    status: "PUBLISHED",
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-package-wellness",
    title: "Culture & Wellness Weekend",
    slug: "culture-wellness-weekend",
    image: activityImages.ayurveda,
    price: 3999,
    duration: "2 days",
    group_size: "2-8 guests",
    location: "Kovalam and nearby",
    summary: "Kalari show, beginner workshop, Ayurveda reset, and local host assistance.",
    status: "PUBLISHED",
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-package-school",
    title: "School Group Kalari Visit",
    slug: "school-group-kalari-visit",
    image: activityImages.kalari,
    price: 699,
    duration: "Half day",
    group_size: "20+ guests",
    location: "Kovalam Kalari Arena",
    summary: "Bulk booking package with reserved seating, introduction talk, and fast entry.",
    status: "PUBLISHED",
    created_at: new Date().toISOString(),
  },
];

const recordId = (item: PackageItem) => item.id || String(item._id || item.slug);

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    db.from("packages").select("*").eq("status", "PUBLISHED").order("sort_order", { ascending: true }).then(({ data }) => {
      if (!mounted) return;
      setPackages(data || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const visiblePackages = useMemo(() => packages.length ? packages : fallbackPackages, [packages]);

  return (
    <main className="min-h-screen bg-white text-stone-950">
      <PublicNavbar />
      <PublicHero
        badge="Bundled experiences"
        badgeIcon={<Package className="h-3.5 w-3.5" />}
        title="Packages for groups, travellers, and culture days"
        description="Curated combinations of Kalari shows, workshops, wellness sessions, and nearby Kerala activities."
        image={activityImages.boat}
      />

      <section className="mx-auto max-w-7xl px-4 py-14">
        {loading ? (
          <div className="rounded-lg border border-stone-200 bg-white p-12 text-center font-bold text-stone-500">Loading packages...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {visiblePackages.map((item) => (
              <article key={recordId(item)} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <img src={item.image} alt={toDisplayTitle(item.title)} className="h-64 w-full object-cover" />
                <div className="p-6">
                  <h2 className="text-2xl font-black leading-tight">{toDisplayTitle(item.title)}</h2>
                  <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm font-medium leading-6 text-stone-600">{item.summary}</p>
                  <div className="mt-5 grid gap-2 text-sm font-bold text-stone-600">
                    <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {item.duration}</span>
                    <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {item.group_size}</span>
                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {item.location}</span>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
                    <span className="text-sm font-bold text-stone-500">From <strong className="text-2xl text-stone-950">Rs. {item.price}</strong></span>
                    <Link href="/contact" className="btn-gradient-primary inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-black text-white">
                      Enquire <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}
