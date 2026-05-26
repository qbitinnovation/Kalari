"use client";

import React, { useEffect, useMemo, useState } from "react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHero } from "@/components/PublicHero";
import { activityImages } from "@/lib/seedData";
import { Images, PlayCircle } from "lucide-react";
import { db, type GalleryItem } from "@/lib/database";
import { toDisplayTitle } from "@/lib/textFormat";

const fallbackGallery: GalleryItem[] = [
  { id: "fallback-kalari", title: "Evening Kalari performance", media_type: "IMAGE", media_url: activityImages.kalari, status: "PUBLISHED", created_at: new Date().toISOString() },
  { id: "fallback-boat", title: "Kerala backwater activity", media_type: "IMAGE", media_url: activityImages.boat, status: "PUBLISHED", created_at: new Date().toISOString() },
  { id: "fallback-ayurveda", title: "Ayurveda wellness session", media_type: "IMAGE", media_url: activityImages.ayurveda, status: "PUBLISHED", created_at: new Date().toISOString() },
  { id: "fallback-temple", title: "Temple and culture trail", media_type: "IMAGE", media_url: activityImages.temple, status: "PUBLISHED", created_at: new Date().toISOString() },
  { id: "fallback-beach", title: "Kovalam beach day", media_type: "IMAGE", media_url: activityImages.beach, status: "PUBLISHED", created_at: new Date().toISOString() },
  { id: "fallback-spice", title: "Spice market walk", media_type: "IMAGE", media_url: activityImages.spice, status: "PUBLISHED", created_at: new Date().toISOString() },
];

const recordId = (item: GalleryItem) => item.id || String(item._id || item.media_url);

export default function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    db.from("gallery_items").select("*").eq("status", "PUBLISHED").order("sort_order", { ascending: true }).then(({ data }) => {
      if (!mounted) return;
      setGallery(data || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const visibleGallery = useMemo(() => gallery.length ? gallery : fallbackGallery, [gallery]);

  return (
    <main className="min-h-screen bg-[#f7f3eb] text-stone-950">
      <PublicNavbar />
      <PublicHero
        badge="Gallery"
        badgeIcon={<Images className="h-3.5 w-3.5" />}
        title="Moments from the arena and around Kovalam"
        description="Browse Kalari performances, training spaces, local activities, and cultural experiences."
        image={activityImages.kalari}
      />
      <section className="mx-auto max-w-7xl px-4 py-12">
        {loading ? (
          <div className="rounded-lg bg-white p-12 text-center font-bold text-stone-500 shadow-sm">Loading gallery...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGallery.map((item) => {
              const image = item.thumbnail_url || item.media_url;
              return (
                <figure key={recordId(item)} className="group overflow-hidden rounded-lg bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative">
                    <img src={image} alt={toDisplayTitle(item.title)} className="h-80 w-full object-cover transition duration-500 group-hover:scale-105" />
                    {item.media_type === "VIDEO" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                        <PlayCircle className="h-14 w-14 drop-shadow-xl" />
                      </div>
                    ) : null}
                  </div>
                  <figcaption className="p-4">
                    <p className="text-sm font-black">{toDisplayTitle(item.title)}</p>
                    {item.caption ? <p className="mt-1 line-clamp-2 text-xs font-medium text-stone-500">{item.caption}</p> : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}
