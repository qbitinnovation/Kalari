"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Plus, RefreshCw, Ticket, Trash2, User } from "lucide-react";
import { db, Customer } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";

type Activity = {
  id: string;
  _id?: string;
  title: string;
  category: string;
  price: number;
};

type ActivitySlot = {
  id: string;
  _id?: string;
  title: string;
  activity_id?: string;
  date: string;
  time: string;
  price: number;
  capacity?: number;
  status: string;
  type?: "KALARI" | "EVENT";
};

type BookingRow = {
  id: string;
  _id?: string;
  show_id: string;
  customer_id?: string;
  booked_by: string;
  seat_code: string;
  booking_time: string;
  status: "CONFIRMED" | "CANCELLED";
  total_amount?: number;
  payment_method?: string;
  show?: ActivitySlot;
  customer?: Customer;
};

const recordId = (record: any) => record?.id || record?._id;

export default function ActivityBookingsPage() {
  const darkMode = useDarkMode();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [slots, setSlots] = useState<ActivitySlot[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    activityId: "",
    slotId: "",
    customerId: "",
    ticketCount: 1,
    paymentMethod: "COD",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: activityData }, { data: slotData }, { data: customerData }, { data: bookingData }] = await Promise.all([
      db.from("activities").select("*").eq("status", "ACTIVE").order("title", { ascending: true }),
      db.from("shows").select("*").eq("type", "EVENT").in("status", ["ACTIVE", "HOUSE_FULL"]).order("date", { ascending: true }),
      db.from("customers").select("*").order("name", { ascending: true }),
      db.from("bookings").select("*, show:shows(*), customer:customers(*)").order("booking_time", { ascending: false }).limit(100),
    ]);
    setActivities((activityData || []).filter((activity: Activity) => activity.category !== "Kalari Booking"));
    setSlots(slotData || []);
    setCustomers(customerData || []);
    setBookings((bookingData || []).filter((booking: BookingRow) => booking.show?.type === "EVENT"));
    setLoading(false);
  };

  const filteredSlots = useMemo(() => {
    if (!form.activityId) return slots;
    return slots.filter((slot) => slot.activity_id === form.activityId);
  }, [form.activityId, slots]);

  const selectedSlot = slots.find((slot) => recordId(slot) === form.slotId);
  const selectedCustomer = customers.find((customer) => recordId(customer) === form.customerId);
  const totalAmount = Number(selectedSlot?.price || 0) * Number(form.ticketCount || 0);

  const countBookedTickets = (slotId: string) => {
    return bookings
      .filter((booking) => booking.show_id === slotId && booking.status === "CONFIRMED")
      .reduce((count, booking) => {
        try {
          const parsed = JSON.parse(booking.seat_code);
          return count + (Array.isArray(parsed) ? parsed.length : 1);
        } catch {
          return count + String(booking.seat_code || "").split(",").filter(Boolean).length;
        }
      }, 0);
  };

  const saveBooking = async () => {
    if (!selectedSlot) {
      alert("Select an activity slot.");
      return;
    }

    const remaining = Number(selectedSlot.capacity || 9999) - countBookedTickets(recordId(selectedSlot));
    if (form.ticketCount < 1 || form.ticketCount > remaining) {
      alert(`Only ${Math.max(0, remaining)} ticket(s) available for this activity slot.`);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const bookedBy = selectedCustomer?.name || "Walk-in customer";
      const ticketCodes = Array.from({ length: form.ticketCount }).map((_, index) => `ACT-${Date.now()}-${index + 1}`);
      const { data: createdBookings, error: bookingError } = await db.from("bookings").insert([{
        show_id: recordId(selectedSlot),
        activity_id: selectedSlot.activity_id || form.activityId || null,
        customer_id: selectedCustomer ? recordId(selectedCustomer) : null,
        booked_by: bookedBy,
        seat_code: JSON.stringify(ticketCodes),
        booking_time: now,
        status: "CONFIRMED",
        payment_method: form.paymentMethod,
        payment_status: form.paymentMethod === "COD" ? "COD_PENDING" : "PAID",
        total_amount: totalAmount,
      }]);

      if (bookingError || !createdBookings?.[0]) throw new Error(bookingError?.message || "Could not create activity booking.");
      const bookingId = recordId(createdBookings[0]);

      const { error: ticketError } = await db.from("tickets").insert(ticketCodes.map((seatCode) => ({
        booking_id: bookingId,
        show_id: recordId(selectedSlot),
        seat_code: seatCode,
        ticket_code: `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        price: Number(selectedSlot.price || 0),
        generated_by: bookedBy,
        generated_at: now,
        status: "ACTIVE",
      })));

      if (ticketError) throw new Error(ticketError.message || "Could not create tickets.");

      setForm({ activityId: "", slotId: "", customerId: "", ticketCount: 1, paymentMethod: "COD" });
      await fetchData();
    } catch (error: any) {
      alert(error.message || "Unable to create activity booking.");
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async (booking: BookingRow) => {
    if (!window.confirm("Cancel this activity booking?")) return;
    const bookingId = recordId(booking);
    await db.from("bookings").update({ status: "CANCELLED" }).eq("id", bookingId);
    await db.from("tickets").update({ status: "REVOKED" }).eq("booking_id", bookingId);
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Activity Bookings</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Create and manage non-seat activity bookings.</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">
          <RefreshCw className="h-5 w-5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className={`rounded-2xl border p-6 shadow-sm ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5" /> New Activity Booking</h2>
          <div className="space-y-4">
            <Field label="Activity">
              <select value={form.activityId} onChange={(event) => setForm({ ...form, activityId: event.target.value, slotId: "" })} className="admin-modal-field">
                <option value="">All activities</option>
                {activities.map((activity) => <option key={recordId(activity)} value={recordId(activity)}>{activity.title}</option>)}
              </select>
            </Field>
            <Field label="Date Slot">
              <select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })} className="admin-modal-field">
                <option value="">Select slot</option>
                {filteredSlots.map((slot) => (
                  <option key={recordId(slot)} value={recordId(slot)}>
                    {slot.title} - {slot.date} {slot.time} - Rs. {slot.price}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Customer (optional)">
              <select value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} className="admin-modal-field">
                <option value="">Walk-in customer</option>
                {customers.map((customer) => <option key={recordId(customer)} value={recordId(customer)}>{customer.name} {customer.phone ? `- ${customer.phone}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Tickets">
              <input type="number" min={1} value={form.ticketCount} onChange={(event) => setForm({ ...form, ticketCount: Number(event.target.value) })} className="admin-modal-field" />
            </Field>
            <Field label="Payment Method">
              <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className="admin-modal-field">
                <option value="COD">COD</option>
                <option value="COUNTER">Counter Paid</option>
              </select>
            </Field>
            <div className="rounded-xl bg-slate-100 p-4 text-slate-950">
              <div className="flex justify-between text-sm"><span>Total</span><strong>Rs. {totalAmount}</strong></div>
              {selectedSlot && <div className="mt-1 flex justify-between text-xs opacity-70"><span>Available</span><span>{Math.max(0, Number(selectedSlot.capacity || 9999) - countBookedTickets(recordId(selectedSlot)))}</span></div>}
            </div>
            <button onClick={saveBooking} disabled={saving} className="w-full rounded-xl bg-amber-600 px-5 py-3 font-black text-white disabled:opacity-50">
              {saving ? "Saving..." : "Create Booking"}
            </button>
          </div>
        </section>

        <section className={`rounded-2xl border shadow-sm ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="border-b border-slate-200 p-6 dark:border-slate-800">
            <h2 className="text-xl font-black">Recent Activity Bookings</h2>
          </div>
          {loading ? (
            <div className="flex h-56 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" /></div>
          ) : bookings.length === 0 ? (
            <div className="p-10 text-center opacity-60">No activity bookings yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-widest opacity-60">
                    <th className="px-6 py-4">Booking</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Tickets</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {bookings.map((booking) => {
                    const ticketCount = (() => {
                      try {
                        const parsed = JSON.parse(booking.seat_code);
                        return Array.isArray(parsed) ? parsed.length : 1;
                      } catch {
                        return 1;
                      }
                    })();
                    return (
                      <tr key={recordId(booking)}>
                        <td className="px-6 py-4">
                          <div className="font-bold">{booking.show?.title || "Activity"}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs opacity-60"><CalendarDays className="h-3 w-3" /> {booking.show?.date ? format(new Date(booking.show.date), "MMM dd, yyyy") : "No date"} {booking.show?.time}</div>
                        </td>
                        <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> {booking.customer?.name || booking.booked_by}</span></td>
                        <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><Ticket className="h-4 w-4" /> {ticketCount}</span></td>
                        <td className="px-6 py-4 font-black">Rs. {booking.total_amount || (ticketCount * Number(booking.show?.price || 0))}</td>
                        <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${booking.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{booking.status}</span></td>
                        <td className="px-6 py-4 text-right">
                          {booking.status === "CONFIRMED" && (
                            <button onClick={() => cancelBooking(booking)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Cancel booking">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="admin-modal-label">{label}</span>
    {children}
  </label>
);
