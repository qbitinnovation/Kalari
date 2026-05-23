"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { ArrowLeft, CalendarDays, Clock, Printer, Send, Ticket, X } from "lucide-react";
import { db, Booking, Ticket as TicketType } from "@/lib/database";
import { getBookingReference, getRecordId, isGeneralAdmissionSeatCode, parseSeatCodes } from "@/lib/booking";
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
    type?: "KALARI" | "EVENT";
    description?: string;
  };
};

const SESSION_KEY = "kalari_customer";

export default function CustomerBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = String(params.id || "");
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
      fetchBooking(parsed.id);
    } catch {
      localStorage.removeItem(SESSION_KEY);
      router.replace("/customer/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, router]);

  const fetchBooking = async (customerId: string) => {
    setLoading(true);
    let { data, error } = await db.from("bookings").select("*, show:shows(*)").eq("booking_reference", bookingId).single();
    if (!data) {
      const fallback = await db.from("bookings").select("*, show:shows(*)").eq("id", bookingId).single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data || data.customer_id !== customerId) {
      setNotice(error?.message || "Booking not found for this customer.");
      setLoading(false);
      return;
    }

    setBooking(data);
    const { data: ticketRows } = await db.from("tickets").select("*").eq("booking_id", getRecordId(data)).order("generated_at", { ascending: true });
    setTickets(ticketRows || []);
    setLoading(false);
  };

  const seats = useMemo(() => parseSeatCodes(booking?.seat_code), [booking]);
  const bookingReference = booking ? getBookingReference(booking) : "";
  const isEventBooking = booking?.show?.type === "EVENT" || seats.every(isGeneralAdmissionSeatCode);
  const ticketDisplayValue = isEventBooking ? `GENERAL${tickets.length > 1 ? ` x ${tickets.length}` : ""}` : seats.join(", ");
  const qrValue = bookingReference;
  const isUpcoming = booking?.show?.date && booking?.show?.time ? new Date(`${booking.show.date}T${booking.show.time}`) >= new Date() : false;
  const canRequestCancel = Boolean(booking && isUpcoming && booking.status === "CONFIRMED" && booking.cancellation_status !== "PENDING");

  const requestCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking || !customer) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/customer/cancel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: getRecordId(booking), customerId: customer.id, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not submit cancellation request.");
      setCancelOpen(false);
      setReason("");
      await fetchBooking(customer.id);
      setNotice("Cancellation request submitted. The team will review it.");
    } catch (error: any) {
      setNotice(error.message || "Could not submit cancellation request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] pt-24">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] pt-24 text-stone-950">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="rounded-lg bg-white p-10 shadow-sm ring-1 ring-stone-200">
            <h1 className="text-3xl font-black">Booking unavailable</h1>
            <p className="mt-3 font-semibold text-stone-500">{notice || "We could not load this booking."}</p>
            <Link href="/customer" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-5 py-3 font-black text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to My Bookings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3eb] pt-24 text-stone-950 print:bg-white print:pt-0">
      <CustomerPrintTicket
        bookingReference={bookingReference}
        showTitle={booking.show?.title || "Booking"}
        date={formatDisplayDateValue(booking.show?.date, "N/A")}
        time={formatDisplayTimeValue(booking.show?.time, "N/A")}
        guestName={customer?.name || "Guest"}
        admissionLabel={isEventBooking ? "Admission" : "Seats"}
        admissionValue={ticketDisplayValue || `${tickets.length} ticket(s)`}
        quantity={`${tickets.length || seats.length || 1} ticket(s)`}
        total={`Rs. ${Number(booking.total_amount || 0).toLocaleString()}`}
        payment={booking.payment_status || "Recorded"}
        qrValue={qrValue}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 print:hidden">
        <Link href="/customer" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-stone-950">
          <ArrowLeft className="h-4 w-4" />
          My Bookings
        </Link>

        {notice && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{notice}</div>}

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                  <Ticket className="h-4 w-4" />
                  Confirmed Booking
                </div>
                {booking.cancellation_status === "PENDING" && <div className="mb-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">Cancellation requested</div>}
                <h1 className="text-3xl font-black">{booking.show?.title || "Booking"}</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-stone-500">{booking.show?.description || "Show this QR ticket at the venue entrance."}</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs font-black uppercase tracking-wider text-stone-400">Total</div>
                <div className="text-3xl font-black text-amber-700">Rs. {Number(booking.total_amount || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg bg-stone-50 p-4 sm:grid-cols-2">
              <Info label="Booking Ref" value={bookingReference} mono />
              <Info label="Payment" value={booking.payment_status || "Recorded"} />
              <Info label="Date" value={formatDisplayDateValue(booking.show?.date, "N/A")} icon={<CalendarDays className="h-4 w-4" />} />
              <Info label="Time" value={formatDisplayTimeValue(booking.show?.time, "N/A")} icon={<Clock className="h-4 w-4" />} />
              <div className="sm:col-span-2">
                <Info label={isEventBooking ? "Admission" : "Seats"} value={ticketDisplayValue || `${tickets.length} ticket(s)`} />
              </div>
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-lg font-black">{isEventBooking ? "Tickets" : "Ticket Codes"}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {tickets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-300 p-4 text-sm font-bold text-stone-500">No ticket rows found for this booking.</div>
                ) : (
                  tickets.map((ticket) => (
                    <div key={getRecordId(ticket)} className="rounded-lg border border-stone-200 p-4">
                      <div className="text-xs font-black uppercase tracking-wider text-stone-400">Ticket</div>
                      <div className="mt-1 font-mono text-sm font-black">{isEventBooking ? "GENERAL" : ticket.ticket_code}</div>
                      {!isGeneralAdmissionSeatCode(ticket.seat_code) && <div className="mt-2 text-sm font-bold text-stone-500">{ticket.seat_code}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-5 py-3 font-black text-white hover:bg-stone-800">
                <Printer className="h-4 w-4" />
                Print Ticket
              </button>
              {canRequestCancel && (
                <button onClick={() => setCancelOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 hover:bg-red-100">
                  Request Cancellation
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
            <h2 className="text-xl font-black">Entrance QR</h2>
            <p className="mt-2 text-sm font-semibold text-stone-500">Scan this booking at the counter.</p>
            <div className="mx-auto mt-6 w-fit rounded-lg bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <QRCode value={qrValue} size={180} />
            </div>
            <div className="mt-4 font-mono text-xs font-black text-stone-500">{qrValue}</div>
          </aside>
        </section>
      </div>

      {cancelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={requestCancellation} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">Request Cancellation</h2>
              <button type="button" onClick={() => setCancelOpen(false)} className="rounded-lg p-2 hover:bg-stone-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Reason</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={4} className="w-full rounded-lg border border-stone-200 px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-amber-400" placeholder="Tell us why you need to cancel..." />
            </label>
            <button disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700 disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Request"}
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

const CustomerPrintTicket = ({
  bookingReference,
  showTitle,
  date,
  time,
  guestName,
  admissionLabel,
  admissionValue,
  quantity,
  total,
  payment,
  qrValue,
}: {
  bookingReference: string;
  showTitle: string;
  date: string;
  time: string;
  guestName: string;
  admissionLabel: string;
  admissionValue: string;
  quantity: string;
  total: string;
  payment: string;
  qrValue: string;
}) => (
  <section className="hidden print:block">
    <div className="mx-auto w-[180mm] rounded-lg border border-stone-300 p-8 text-stone-950">
      <div className="flex items-start justify-between gap-8 border-b border-stone-200 pb-5">
        <div className="flex items-start gap-4">
          <img src="/logo.png" alt="Kovalam Kalari" className="h-16 w-16 rounded object-contain" />
          <div>
            <div className="text-sm font-black uppercase tracking-[0.25em] text-amber-700">Kovalam Kalari</div>
            <h1 className="mt-3 text-3xl font-black leading-tight">{showTitle}</h1>
            <p className="mt-2 font-mono text-sm font-black text-stone-500">{bookingReference}</p>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <QRCode value={qrValue} size={118} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-5 text-sm">
        <PrintField label="Guest" value={guestName} />
        <PrintField label="Payment" value={payment} />
        <PrintField label="Date" value={date} />
        <PrintField label="Time" value={time} />
        <PrintField label={admissionLabel} value={admissionValue} />
        <PrintField label="Quantity" value={quantity} />
        <PrintField label="Total" value={total} />
        <PrintField label="QR Value" value={qrValue} mono />
      </div>
    </div>
  </section>
);

const PrintField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">{label}</div>
    <div className={`mt-1 text-base font-black ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

const Info = ({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) => (
  <div>
    <span className="mb-1 flex items-center gap-1 text-xs font-black uppercase tracking-wider text-stone-400">
      {icon}
      {label}
    </span>
    <span className={`block font-black text-stone-950 ${mono ? "font-mono text-sm" : ""}`}>{value}</span>
  </div>
);
