"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { activityImages } from "@/lib/seedData";

const posts = [
  {
    title: "What to expect at your first Kalaripayattu show",
    image: activityImages.kalari,
    text: "A quick guide for guests: arrival, seating, performance flow, and ticket check-in.",
  },
  {
    title: "Why Kalari matters in Kerala culture",
    image: activityImages.temple,
    text: "An accessible introduction to the history, discipline, and living practice of Kalari.",
  },
  {
    title: "Planning a culture day in Kovalam",
    image: activityImages.beach,
    text: "Pair a performance with nearby activities, food stops, and coastal time.",
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-white text-stone-950">
      <PublicNavbar />
      <section className="mx-auto max-w-7xl px-4 pt-32">
        <p className="text-sm font-black uppercase tracking-widest text-amber-700">Articles</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight md:text-7xl">Stories, guides, and cultural notes</h1>
      </section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-3">
        {posts.map((post) => (
          <article key={post.title} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <img src={post.image} alt={post.title} className="h-56 w-full object-cover" />
            <div className="p-6">
              <h2 className="text-2xl font-black leading-tight">{post.title}</h2>
              <p className="mt-3 min-h-20 text-sm font-medium leading-6 text-stone-600">{post.text}</p>
              <Link href="/contact" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-700">
                Request article update <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </section>
      <PublicFooter />
    </main>
  );
}
