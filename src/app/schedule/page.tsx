"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/database";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Calendar, CalendarDays, Clock, ArrowRight } from "lucide-react";
import { PublicHero } from "@/components/PublicHero";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getAvailabilityLabel, isShowBookableAt } from "@/lib/booking";
import { DatePicker, Pagination, SearchInput } from "@/components/ui";
import {
  formatDisplayDateValue,
  todayDateValue,
} from "@/components/ui/date-utils";
import { activityImages } from "@/lib/seedData";

interface PublicShow {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time: string;
  price: number;
  image?: string;
  description?: string;
  status: string;
  availability_status?: "AVAILABLE" | "FILLING_FAST" | "SOLD_OUT";
  available_count?: number;
  type?: "KALARI" | "EVENT";
}

const publicShowBookingHref = (show: PublicShow) => {
  const showId = String(show.id || show._id || "");
  return showId ? `/book?show=${encodeURIComponent(showId)}` : "/book";
};

const Schedule: React.FC = () => {
  const [shows, setShows] = useState<PublicShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    fetchShows();
  }, []);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const query = db
        .from("shows")
        .select("*")
        .gte("date", todayDateValue())
        .order("date", { ascending: true });

      const { data } = await query;
      setShows(
        (data || []).filter((show: PublicShow) => isShowBookableAt(show)),
      );
    } catch (error) {
      console.error("Error fetching shows:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return shows.filter((show) => {
      const searchableText = [
        show.title,
        show.description,
        show.type === "EVENT" ? "event special event" : "kalari show",
        show.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesDate = !selectedDate || show.date === selectedDate;

      return matchesSearch && matchesDate;
    });
  }, [searchTerm, selectedDate, shows]);

  const totalPages = Math.max(1, Math.ceil(filteredShows.length / pageSize));

  const paginatedShows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredShows.slice(start, start + pageSize);
  }, [filteredShows, page]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getStatusBadge = (show: PublicShow) => {
    if (show.status === "HOUSE_FULL" || show.availability_status === "SOLD_OUT")
      return "bg-red-100 text-red-800 border-red-200";
    if (show.availability_status === "FILLING_FAST")
      return "bg-amber-100 text-amber-800 border-amber-200";
    if (show.status === "ACTIVE")
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    return "bg-stone-100 text-stone-600 border-stone-200";
  };

  return (
    <div className="min-h-screen bg-[#f7f2e8] flex flex-col">
      <PublicNavbar />

      <main className="flex-1">
        <PublicHero
          badge="Live show calendar"
          badgeIcon={<CalendarDays className="h-3.5 w-3.5" />}
          title={
            <>
              Training & Performance{" "}
              <span className="text-gradient-primary">Schedule.</span>
            </>
          }
          description="Browse our upcoming Kalaripayattu shows and special cultural events. Book your seats in advance to ensure the best view."
          image={activityImages.kalari}
        />

        {/* Filter Bar */}
        <section className="sticky top-20 z-30 bg-white/80 backdrop-blur-xl border-b border-stone-200 py-4 shadow-sm">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search shows..."
                containerClassName="w-full min-w-0"
                className="min-h-12 border-stone-200 font-bold placeholder:font-semibold focus:border-amber-400 focus:ring-amber-400/20"
              />
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="All dates"
                minDate={todayDateValue()}
                presets={[
                  { label: "Today", value: "today" },
                  { label: "Clear", value: "clear" },
                ]}
                variant="public"
                className="w-full"
                triggerClassName="min-h-12 w-full rounded-xl font-bold"
              />
            </div>
          </div>
        </section>

        {/* Shows Grid */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {loading ? (
              <div className="py-32 flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
                <p className="text-sm font-bold opacity-40 uppercase tracking-widest">
                  Loading Shows...
                </p>
              </div>
            ) : filteredShows.length === 0 ? (
              <div className="py-32 text-center bg-white rounded-xl border-2 border-dashed border-stone-200">
                <Calendar className="mx-auto mb-6 h-14 w-14 text-stone-300" />
                <h3 className="text-2xl font-black mb-2">No shows found.</h3>
                <p className="text-stone-500 max-w-md mx-auto">
                  Try changing the search text or date filter to find another
                  session.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <AnimatePresence mode="popLayout">
                    {paginatedShows.map((show, idx) => (
                      <motion.div
                        key={
                          show.id ||
                          show._id ||
                          `${show.title}-${show.date}-${show.time}-${idx}`
                        }
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 flex flex-col"
                      >
                        <div className="h-48 relative overflow-hidden">
                          <img
                            src={
                              show.image ||
                              "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80"
                            }
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            alt={show.title}
                          />
                          <div className="absolute top-4 left-4 flex gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${getStatusBadge(show)}`}
                            >
                              {show.status === "HOUSE_FULL"
                                ? "Sold Out"
                                : getAvailabilityLabel(
                                    show.availability_status || "AVAILABLE",
                                  )}
                            </span>
                          </div>
                          {show.type === "EVENT" && (
                            <div className="absolute bottom-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                              Special Event
                            </div>
                          )}
                        </div>

                        <div className="p-8 flex-1 flex flex-col">
                          <div className="flex items-center gap-4 text-xs font-black opacity-40 uppercase tracking-widest mb-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{" "}
                              {formatDisplayDateValue(show.date)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {show.time}
                            </div>
                          </div>

                          <h3 className="text-2xl font-black mb-3 group-hover:text-amber-600 transition-colors leading-tight">
                            {show.title}
                          </h3>
                          <p className="text-stone-500 text-sm leading-relaxed mb-8 flex-1 line-clamp-3">
                            {show.description ||
                              "Authentic Kalaripayattu performance featuring traditional weapons and ancient combat sequences."}
                          </p>

                          <div className="pt-6 border-t border-stone-100 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">
                                From
                              </div>
                              <div className="text-2xl font-black">
                                Rs. {show.price}
                              </div>
                            </div>

                            {show.status === "ACTIVE" &&
                            show.availability_status !== "SOLD_OUT" ? (
                              <Link
                                href={publicShowBookingHref(show)}
                                className="btn-gradient-primary text-white px-6 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 group/btn shadow-lg shadow-amber-900/10"
                              >
                                Book Now
                                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                              </Link>
                            ) : (
                              <div className="text-xs font-black text-red-600 opacity-60">
                                Waitlist Only
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  className="mt-12"
                />
              </>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Schedule;
