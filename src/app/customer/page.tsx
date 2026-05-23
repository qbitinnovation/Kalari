"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, LogOut, Ticket, UserRound } from "lucide-react";
import { db, Booking } from "@/lib/database";
import { getBookingReference, getRecordId, parseSeatCodes } from "@/lib/booking";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";

type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

type BookingRow = Booking & {
  show?: {
    title: string;
    date: string;
    time: string;
    price: number;
    type?: string;
  };
};

const SESSION_KEY = "kalari_customer";

const showDateTime = (booking: BookingRow) => {
  if (!booking.show?.date || !booking.show?.time) return new Date(booking.booking_time);
  return new Date(`${booking.show.date}T${booking.show.time}`);
};

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      router.replace("/customer/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setCustomer(parsed);
      fetchBookings(parsed.id);
    } catch {
      localStorage.removeItem(SESSION_KEY);
      router.replace("/customer/login");
    }
  }, [router]);

  const fetchBookings = async (customerId: string) => {
    setLoading(true);
    const { data, error } = await db
      .from("bookings")
      .select("*, show:shows(*)")
      .eq("customer_id", customerId)
      .order("booking_time", { ascending: false });

    if (error) setNotice(error.message || "Could not load bookings.");
    setBookings(data || []);
    setLoading(false);
  };

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const activeBookings = bookings.filter((booking) => booking.status === "CONFIRMED");
    return {
      upcoming: activeBookings.filter((booking) => showDateTime(booking) >= now),
      past: activeBookings.filter((booking) => showDateTime(booking) < now),
    };
  }, [bookings]);

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    router.replace("/customer/login");
  };

  if (!customer) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] pt-24">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3eb] pt-24 text-stone-950">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-col justify-between gap-4 rounded-lg bg-stone-950 p-6 text-white sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-200">
              <UserRound className="h-4 w-4" />
              Customer Portal
            </div>
            <h1 className="text-4xl font-black">My Bookings</h1>
            <p className="mt-2 text-sm font-semibold text-stone-300">{customer.phone}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/book" className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-black text-stone-950 hover:bg-amber-300">
              Book Again
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={signOut} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-3 font-black text-white hover:bg-white/15">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </header>

        {notice && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{notice}</div>}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-stone-200">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
          </div>
        ) : (
          <div className="space-y-8">
            <BookingSection title="Upcoming" bookings={upcoming} emptyText="No upcoming bookings found for this phone number." />
            <BookingSection title="Past" bookings={past} emptyText="Past bookings will appear here after the show time." />
          </div>
        )}
      </div>
    </main>
  );
}

const BookingSection = ({ title, bookings, emptyText }: { title: string; bookings: BookingRow[]; emptyText: string }) => (
  <section>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-2xl font-black">{title}</h2>
      <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-stone-500 ring-1 ring-stone-200">{bookings.length}</span>
    </div>
    {bookings.length === 0 ? (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center font-bold text-stone-500">{emptyText}</div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {bookings.map((booking) => {
          const seats = parseSeatCodes(booking.seat_code);
          const bookingId = getRecordId(booking);
          const bookingReference = getBookingReference(booking);
          const cancellationPending = booking.cancellation_status === "PENDING";
          return (
            <Link key={bookingId} href={`/customer/bookings/${bookingReference}`} className="group rounded-lg bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    <Ticket className="h-4 w-4" />
                    {seats.length} ticket(s)
                  </div>
                  {cancellationPending && <div className="mb-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">Cancellation requested</div>}
                  <h3 className="text-xl font-black">{booking.show?.title || "Booking"}</h3>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-stone-500">
                    <CalendarDays className="h-4 w-4" />
                    {formatDisplayDateValue(booking.show?.date, "Date unavailable")}
                    {booking.show?.time ? ` at ${formatDisplayTimeValue(booking.show.time)}` : ""}
                  </p>
                </div>
                <ArrowRight className="mt-2 h-5 w-5 text-stone-300 transition group-hover:text-amber-600" />
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-sm font-bold">
                <span className="font-mono text-amber-700">{bookingReference}</span>
                <span>Rs. {Number(booking.total_amount || 0).toLocaleString()}</span>
              </div>
            </Link>
          );
        })}
      </div>
    )}
  </section>
);
