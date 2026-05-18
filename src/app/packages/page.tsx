"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { activityImages } from "@/lib/seedData";

const packages = [
  {
    title: "Kalari Evening + Backwater Day",
    image: activityImages.boat,
    price: 2499,
    duration: "1 day",
    group: "2-12 guests",
    text: "Pair the signature evening performance with a guided Poovar backwater escape.",
  },
  {
    title: "Culture & Wellness Weekend",
    image: activityImages.ayurveda,
    price: 3999,
    duration: "2 days",
    group: "2-8 guests",
    text: "Kalari show, beginner workshop, Ayurveda reset, and local host assistance.",
  },
  {
    title: "School Group Kalari Visit",
    image: activityImages.kalari,
    price: 699,
    duration: "Half day",
    group: "20+ guests",
    text: "Bulk booking package with reserved seating, introduction talk, and fast entry.",
  },
];

export default function PackagesPage() {
  return (
    <main className="min-h-screen bg-white text-stone-950">
      <PublicNavbar />
      <section className="bg-stone-950 pt-32 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <p className="text-sm font-black uppercase tracking-widest text-amber-400">Bundled experiences</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight md:text-7xl">Packages for groups, travellers, and culture days</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300">Launch-ready package cards for bundled tours. Final package inventory can be managed as activities in the admin panel.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {packages.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <img src={item.image} alt={item.title} className="h-64 w-full object-cover" />
              <div className="p-6">
                <h2 className="text-2xl font-black leading-tight">{item.title}</h2>
                <p className="mt-3 min-h-16 text-sm font-medium leading-6 text-stone-600">{item.text}</p>
                <div className="mt-5 grid gap-2 text-sm font-bold text-stone-600">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {item.duration}</span>
                  <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {item.group}</span>
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Kovalam and nearby</span>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
                  <span className="text-sm font-bold text-stone-500">From <strong className="text-2xl text-stone-950">Rs. {item.price}</strong></span>
                  <Link href="/contact" className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white">
                    Enquire <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
