"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Minus, Plus, Printer, Ticket } from "lucide-react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import PublicNavbar from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Button, DatePicker, Input, Select } from "@/components/ui";
import { formatDisplayDateValue, todayDateValue } from "@/components/ui/date-utils";
import { getBookingReference } from "@/lib/booking";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = any;

const recordId = (record: any) => String(record?.id || record?._id || "");
const activityRouteId = (activity: any) => String(activity?.id || activity?._id || activity?.slug || "");

export default function ActivityBookingPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") || "";
  const [activity, setActivity] = useState<Activity | null>(null);
  const [date, setDate] = useState(requestedDate || todayDateValue());
  const [ticketCount, setTicketCount] = useState(1);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities/${params.slug}`)
      .then((response) => response.json())
      .then((payload) => setActivity(payload?.data || null))
      .catch(() => setNotice("Could not load this activity."))
      .finally(() => setLoading(false));
  }, [params.slug]);

  useEffect(() => {
    if (!activity || !date) return;
    fetch(`/api/activity-bookings?activityId=${encodeURIComponent(recordId(activity))}&date=${encodeURIComponent(date)}`)
      .then((response) => response.json())
      .then((payload) => setRemaining(Number(payload?.data?.remaining ?? activity.daily_capacity ?? 0)))
      .catch(() => setRemaining(Number(activity.daily_capacity || 0)));
  }, [activity, date]);

  const price = Number(activity?.booking_price || activity?.price || 0);
  const total = useMemo(() => price * ticketCount, [price, ticketCount]);
  const available = remaining ?? Number(activity?.daily_capacity || 0);

  const submitBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activity) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/activity-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: recordId(activity),
          date,
          ticketCount,
          customer,
          paymentMethod,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create booking.");
      setSuccess(payload.data);
    } catch (error: any) {
      setNotice(error.message || "Could not create booking.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] text-[#10284a]">
        <PublicNavbar />
        <div className="flex min-h-[60vh] items-center justify-center pt-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      </main>
    );
  }

  if (!activity) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] text-[#10284a]">
        <PublicNavbar />
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 text-center">
          <h1 className="text-4xl font-black">Activity unavailable</h1>
          <Link href="/activities" className="mt-6 inline-flex rounded-full bg-stone-950 px-7 py-3 font-black text-white">Back to activities</Link>
        </div>
      </main>
    );
  }

  const bookingReference = success?.booking ? getBookingReference(success.booking) : "";
  const canBookActivity = activity.booking_status !== "PAUSED" && Number(activity.daily_capacity || 20) > 0;

  return (
    <main className="min-h-screen bg-[#f7f3eb] text-[#10284a] print:bg-white">
      <div className="print:hidden">
        <PublicNavbar />
      </div>
      {success && (
        <ActivityPrintTicket
          bookingReference={bookingReference}
          activityTitle={toDisplayTitle(activity.title)}
          date={formatDisplayDateValue(date, "N/A")}
          guestName={customer.name || "Guest"}
          admissionValue={`GENERAL x ${success.tickets?.length || ticketCount}`}
          quantity={`${success.tickets?.length || ticketCount} ticket(s)`}
          total={`Rs. ${total.toLocaleString("en-IN")}`}
          payment={paymentMethod === "RAZORPAY" ? "Online payment" : "Pay at venue"}
          qrValue={bookingReference}
        />
      )}
      <section className="mx-auto grid max-w-[1280px] gap-8 px-4 pb-10 pt-28 print:hidden lg:grid-cols-[0.9fr_1.1fr] lg:pt-32">
        <div>
          <Link href={`/activities/${encodeURIComponent(activityRouteId(activity))}`} className="mb-5 inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-stone-950">
            <ArrowLeft className="h-4 w-4" />
            Activity details
          </Link>
          <img src={activity.image} alt={toDisplayTitle(activity.title)} className="h-[440px] w-full rounded-lg object-cover shadow-sm" />
          <div className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-stone-200">
            <p className="text-xs font-black uppercase tracking-widest text-primary-600">{toDisplayTitle(activity.category)}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight">{toDisplayTitle(activity.title)}</h1>
            <p className="mt-3 font-semibold leading-7 text-stone-600">{toDisplayTitle(activity.description)}</p>
          </div>
        </div>

        <div className="self-start rounded-lg bg-white p-6 shadow-sm ring-1 ring-stone-200">
          {!canBookActivity ? (
            <div className="text-center">
              <h2 className="text-3xl font-black">Booking unavailable</h2>
              <p className="mt-2 font-semibold text-stone-500">This activity is not open for booking right now.</p>
              <Link href="/activities" className="mt-6 inline-flex rounded-full bg-stone-950 px-7 py-3 font-black text-white">View activities</Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-black">Activity booked</h2>
              <p className="mt-2 font-semibold text-stone-500">Show this QR at the counter.</p>
              <div className="mx-auto mt-6 w-fit rounded-lg bg-white p-4 ring-1 ring-stone-200">
                <QRCode value={bookingReference} size={180} />
              </div>
              <div className="mt-5 rounded-lg bg-stone-50 p-4 text-left">
                <Info label="Booking Ref" value={bookingReference} mono />
                <Info label="Activity" value={toDisplayTitle(activity.title)} />
                <Info label="Admission" value={`GENERAL x ${success.tickets?.length || ticketCount}`} />
                <Info label="Date" value={date} />
                <Info label="Total" value={`Rs. ${total.toLocaleString("en-IN")}`} />
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => window.print()} className="flex-1 whitespace-nowrap">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Link href="/customer" className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl bg-stone-100 px-5 py-3 font-black text-stone-950">My Bookings</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submitBooking} className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary-600">Activity booking</p>
                <h2 className="mt-2 text-3xl font-black">Reserve general tickets</h2>
                <p className="mt-2 text-sm font-semibold text-stone-500">Admission is GENERAL. Your QR uses one booking reference.</p>
              </div>
              {notice && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">{notice}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <DatePicker label="Select Date" value={date} onChange={setDate} minDate={todayDateValue()} variant="public" />
                <Select
                  label="Payment"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  variant="public"
                  options={[
                    { value: "RAZORPAY", label: "Online" },
                    { value: "COD", label: "Pay at venue" },
                  ]}
                />
              </div>
              <div className="rounded-lg border border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black">Tickets</div>
                    <div className="mt-1 text-xs font-semibold text-stone-500">{available} remaining for selected date</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setTicketCount((count) => Math.max(1, count - 1))} className="rounded-full border border-stone-200 p-2"><Minus className="h-4 w-4" /></button>
                    <span className="w-8 text-center text-xl font-black">{ticketCount}</span>
                    <button type="button" onClick={() => setTicketCount((count) => Math.min(available || count + 1, count + 1))} className="rounded-full border border-stone-200 p-2"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={customer.name} onChange={(name) => setCustomer({ ...customer, name })} placeholder="Enter your name" required variant="public" />
                <Input label="Mobile Number" value={customer.phone} onChange={(phone) => setCustomer({ ...customer, phone })} placeholder="+91 98765 43210" required variant="public" />
                <Input label="Email (optional)" value={customer.email} onChange={(email) => setCustomer({ ...customer, email })} placeholder="you@example.com" className="sm:col-span-2" variant="public" />
              </div>
              <div className="rounded-lg bg-stone-50 p-4">
                <div className="flex items-center justify-between font-black">
                  <span className="inline-flex items-center gap-2"><Ticket className="h-5 w-5 text-primary-600" /> GENERAL x {ticketCount}</span>
                  <span>Rs. {total.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <Button type="submit" disabled={saving || ticketCount > available || activity.booking_status === "PAUSED"} fullWidth>
                {saving ? "Booking..." : activity.booking_status === "PAUSED" ? "Booking paused" : "Confirm Activity Booking"}
              </Button>
            </form>
          )}
        </div>
      </section>
      <div className="print:hidden">
        <PublicFooter />
      </div>
    </main>
  );
}

const ActivityPrintTicket = ({
  bookingReference,
  activityTitle,
  date,
  guestName,
  admissionValue,
  quantity,
  total,
  payment,
  qrValue,
}: {
  bookingReference: string;
  activityTitle: string;
  date: string;
  guestName: string;
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
            <h1 className="mt-3 text-3xl font-black leading-tight">{activityTitle}</h1>
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
        <PrintField label="Time" value="General admission" />
        <PrintField label="Admission" value={admissionValue} />
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

const Info = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-4 border-b border-stone-200 py-3 last:border-0">
    <span className="text-sm font-bold text-stone-500">{label}</span>
    <span className={`text-right font-black ${mono ? "font-mono text-sm" : ""}`}>{value}</span>
  </div>
);
