"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Ticket, Trash2, User } from "lucide-react";
import { db, Customer } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { getBookingReference, getRecordId, parseSeatCodes } from "@/lib/booking";
import { AdminTable, AdminTableBody, AdminTableEmpty, AdminTableHead, AdminTablePanel, Button, DatePicker, Input, Select } from "@/components/ui";
import { formatDisplayDateValue, todayDateValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  title: string;
  category: string;
  price: number;
  booking_price?: number;
  daily_capacity?: number;
  booking_status?: "ACTIVE" | "PAUSED";
};

type BookingRow = {
  id: string;
  _id?: string;
  booking_reference?: string;
  activity_id?: string;
  booking_date?: string;
  booking_type?: "SHOW" | "ACTIVITY";
  customer_id?: string;
  booked_by: string;
  seat_code: string;
  booking_time: string;
  status: "CONFIRMED" | "CANCELLED";
  total_amount?: number;
  payment_method?: string;
  activity?: Activity;
  customer?: Customer;
};

const recordId = getRecordId;

export default function ActivityBookingsPage() {
  const darkMode = useDarkMode();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    activityId: "",
    date: todayDateValue(),
    customerId: "",
    customerPhone: "",
    customerName: "",
    ticketCount: 1,
    paymentMethod: "COD",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: activityData }, { data: customerData }, { data: bookingData }] = await Promise.all([
      db.from("activities").select("*").eq("status", "ACTIVE").order("title", { ascending: true }),
      db.from("customers").select("*").order("name", { ascending: true }),
      db.from("bookings").select("*, activity:activities(*), customer:customers(*)").order("booking_time", { ascending: false }).limit(100),
    ]);
    setActivities(activityData || []);
    setCustomers(customerData || []);
    setBookings((bookingData || []).filter((booking: BookingRow) => booking.booking_type === "ACTIVITY" || booking.activity_id));
    setLoading(false);
  };

  const selectedActivity = activities.find((activity) => recordId(activity) === form.activityId);
  const selectedCustomer = customers.find((customer) => recordId(customer) === form.customerId);
  const activityPrice = Number(selectedActivity?.booking_price || selectedActivity?.price || 0);
  const totalAmount = activityPrice * Number(form.ticketCount || 0);

  const bookedForSelection = useMemo(() => {
    if (!selectedActivity || !form.date) return 0;
    return bookings
      .filter((booking) =>
        booking.activity_id === recordId(selectedActivity) &&
        booking.booking_date === form.date &&
        booking.status === "CONFIRMED"
      )
      .reduce((count, booking) => count + parseSeatCodes(booking.seat_code).length, 0);
  }, [bookings, form.date, selectedActivity]);

  const remaining = Math.max(0, Number(selectedActivity?.daily_capacity || 0) - bookedForSelection);

  const saveBooking = async () => {
    if (!selectedActivity) {
      alert("Select an activity.");
      return;
    }
    if (selectedActivity.booking_status === "PAUSED") {
      alert("This activity booking is paused.");
      return;
    }
    if (form.ticketCount < 1 || form.ticketCount > remaining) {
      alert(`Only ${remaining} ticket(s) available for this activity date.`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/activity-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: recordId(selectedActivity),
          date: form.date,
          ticketCount: form.ticketCount,
          paymentMethod: form.paymentMethod,
          customer: selectedCustomer
            ? { name: selectedCustomer.name, phone: selectedCustomer.phone, email: selectedCustomer.email }
            : { name: form.customerName || "Walk-in customer", phone: form.customerPhone },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create activity booking.");
      setForm({ activityId: "", date: todayDateValue(), customerId: "", customerPhone: "", customerName: "", ticketCount: 1, paymentMethod: "COD" });
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
    await db.from("bookings").update({ status: "CANCELLED", cancellation_status: "APPROVED" }).eq("id", bookingId);
    await db.from("tickets").update({ status: "REVOKED" }).eq("booking_id", bookingId);
    await fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Activity Bookings</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Create standalone general-admission activity bookings.</p>
        </div>
        <Button variant="secondary" onClick={fetchData}>
          <RefreshCw className="h-5 w-5" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className={`rounded-2xl border p-6 shadow-sm ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5" /> New Activity Booking</h2>
          <div className="space-y-4">
            <Select
              label="Activity"
              value={form.activityId || "__none__"}
              onChange={(activityId) => setForm({ ...form, activityId: activityId === "__none__" ? "" : activityId })}
              placeholder="Select activity"
              options={[
                { value: "__none__", label: "Select activity" },
                ...activities.map((activity) => ({
                  value: recordId(activity),
                  label: `${toDisplayTitle(activity.title)} - Rs. ${activity.booking_price || activity.price}`,
                })),
              ]}
            />
            <DatePicker label="Booking Date" value={form.date} onChange={(date) => setForm({ ...form, date })} minDate={todayDateValue()} />
            <Input label="Tickets" type="number" min={1} value={String(form.ticketCount)} onChange={(value) => setForm({ ...form, ticketCount: Number(value) || 1 })} />
            <Select
              label="Customer (optional)"
              value={form.customerId || "__none__"}
              onChange={(customerId) => setForm({ ...form, customerId: customerId === "__none__" ? "" : customerId })}
              placeholder="Walk-in customer"
              options={[
                { value: "__none__", label: "Walk-in customer / new mobile" },
                ...customers.map((customer) => ({
                  value: recordId(customer),
                  label: `${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}`,
                })),
              ]}
            />
            {!selectedCustomer && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Mobile Number" value={form.customerPhone} onChange={(customerPhone) => setForm({ ...form, customerPhone })} placeholder="+91 98765 43210" />
                <Input label="Customer Name" value={form.customerName} onChange={(customerName) => setForm({ ...form, customerName })} placeholder="Walk-in customer" />
              </div>
            )}
            <Select
              label="Payment Method"
              value={form.paymentMethod}
              onChange={(paymentMethod) => setForm({ ...form, paymentMethod })}
              options={[
                { value: "COD", label: "Pay at venue" },
                { value: "COUNTER", label: "Counter Paid" },
              ]}
            />
            <div className="rounded-xl bg-slate-100 p-4 text-slate-950 dark:bg-slate-800 dark:text-slate-100">
              <div className="flex justify-between text-sm"><span>Total</span><strong>Rs. {totalAmount}</strong></div>
              {selectedActivity && <div className="mt-1 flex justify-between text-xs opacity-70"><span>Available for selected date</span><span>{remaining}</span></div>}
            </div>
            <Button onClick={saveBooking} disabled={saving} fullWidth>
              {saving ? "Saving..." : "Create Booking"}
            </Button>
          </div>
        </section>

        <AdminTablePanel>
          <div className="border-b border-slate-200 p-6 dark:border-slate-800">
            <h2 className="text-xl font-black">Recent Activity Bookings</h2>
          </div>
          {loading ? (
            <div className="flex h-56 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" /></div>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <tr className="text-left text-xs font-black uppercase tracking-widest opacity-60">
                  <th className="px-6 py-4">Booking</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Tickets</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {bookings.length === 0 && <AdminTableEmpty colSpan={6}>No activity bookings to display.</AdminTableEmpty>}
                {bookings.map((booking) => {
                  const ticketCount = parseSeatCodes(booking.seat_code).length || 1;
                  return (
                    <tr key={recordId(booking)}>
                      <td className="px-6 py-4">
                        <div className="font-bold">{toDisplayTitle(booking.activity?.title, "Activity")}</div>
                        <div className="mt-1 font-mono text-xs font-black text-amber-600">{getBookingReference(booking)}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs opacity-60"><CalendarDays className="h-3 w-3" /> {formatDisplayDateValue(booking.booking_date, "No date")}</div>
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> {booking.customer?.name || booking.booked_by}</span></td>
                      <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><Ticket className="h-4 w-4" /> GENERAL x {ticketCount}</span></td>
                      <td className="px-6 py-4 font-black">Rs. {booking.total_amount || (ticketCount * Number(booking.activity?.booking_price || booking.activity?.price || 0))}</td>
                      <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${booking.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{toDisplayTitle(booking.status)}</span></td>
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
              </AdminTableBody>
            </AdminTable>
          )}
        </AdminTablePanel>
      </div>
    </div>
  );
}
