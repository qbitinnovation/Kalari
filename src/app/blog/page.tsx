"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHero } from "@/components/PublicHero";
import { db, type BlogPost } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

const fallbackPosts: BlogPost[] = [
  {
    id: "fallback-first-show",
    title: "What to expect at your first Kalaripayattu show",
    slug: "first-kalaripayattu-show",
    image: activityImages.kalari,
    excerpt: "A quick guide for guests: arrival, seating, performance flow, and ticket check-in.",
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-culture",
    title: "Why Kalari matters in Kerala culture",
    slug: "why-kalari-matters",
    image: activityImages.temple,
    excerpt: "An accessible introduction to the history, discipline, and living practice of Kalari.",
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "fallback-kovalam",
    title: "Planning a culture day in Kovalam",
    slug: "planning-culture-day-kovalam",
    image: activityImages.beach,
    excerpt: "Pair a performance with nearby activities, food stops, and coastal time.",
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

const recordId = (post: BlogPost) => post.id || String(post._id || post.slug);

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    db.from("blog_posts").select("*").eq("status", "PUBLISHED").order("published_at", { ascending: false }).then(({ data }) => {
      if (!mounted) return;
      setPosts(data || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const visiblePosts = useMemo(() => posts.length ? posts : fallbackPosts, [posts]);

  return (
    <main className="min-h-screen bg-white text-stone-950">
      <PublicNavbar />
      <PublicHero
        badge="Articles"
        badgeIcon={<Newspaper className="h-3.5 w-3.5" />}
        title="Stories, guides, and cultural notes"
        description="Read useful updates from the Kalari arena, local culture calendar, and Kovalam travel desk."
        image={activityImages.temple}
      />
      <section className="mx-auto max-w-7xl px-4 py-12">
        {loading ? (
          <div className="rounded-lg border border-stone-200 bg-white p-12 text-center font-bold text-stone-500">Loading articles...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {visiblePosts.map((post) => (
              <article key={recordId(post)} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <img src={post.image} alt={toDisplayTitle(post.title)} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <p className="mb-3 text-xs font-black uppercase tracking-widest text-primary-700">{formatDisplayDateValue(post.published_at || post.created_at)}</p>
                  <h2 className="text-2xl font-black leading-tight">{toDisplayTitle(post.title)}</h2>
                  <p className="mt-3 min-h-20 text-sm font-medium leading-6 text-stone-600">{post.excerpt}</p>
                  <Link href="/contact" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary-700">
                    Request article update <ArrowRight className="h-4 w-4" />
                  </Link>
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
