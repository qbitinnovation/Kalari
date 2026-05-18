"use client";

import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { activityImages } from "@/lib/seedData";

const gallery = [
  { title: "Evening Kalari performance", image: activityImages.kalari },
  { title: "Kerala backwater activity", image: activityImages.boat },
  { title: "Ayurveda wellness session", image: activityImages.ayurveda },
  { title: "Temple and culture trail", image: activityImages.temple },
  { title: "Kovalam beach day", image: activityImages.beach },
  { title: "Spice market walk", image: activityImages.spice },
];

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#f7f3eb] text-stone-950">
      <PublicNavbar />
      <section className="mx-auto max-w-7xl px-4 pt-32">
        <p className="text-sm font-black uppercase tracking-widest text-amber-700">Gallery</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight md:text-7xl">Moments from the arena and around Kovalam</h1>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((item) => (
          <figure key={item.title} className="group overflow-hidden rounded-lg bg-white shadow-sm">
            <img src={item.image} alt={item.title} className="h-80 w-full object-cover transition duration-500 group-hover:scale-105" />
            <figcaption className="p-4 text-sm font-black">{item.title}</figcaption>
          </figure>
        ))}
      </section>
      <PublicFooter />
    </main>
  );
}
