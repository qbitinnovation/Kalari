"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  Star,
  Ticket,
  Trash2,
} from "lucide-react";
import { db, type Vendor } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { useDarkMode } from "@/hooks/useDarkMode";
import { canBookActivity, getAdminBookingUrl } from "@/lib/adminBooking";
import { getVendorDisplayName, getVendorContact } from "@/lib/vendorPayout";
import {
  activityDisplayStatusLabels,
  activityDisplayStatusStyles,
  formatAdminActivityDates,
  getActivityDisplayStatus,
} from "@/lib/activityAvailability";
import { summarizeActivitySales } from "@/lib/catalogSalesSummary";
import { Button } from "@/components/ui";
import { formatDisplayDateValue, todayDateValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  start_date?: string;
  end_date?: string;
  price: number;
  booking_price?: number;
  daily_capacity?: number;
  booking_status?: "ACTIVE" | "PAUSED";
  vendor_id?: string;
  platform_commission_percentage?: number;
  rating: number;
  review_count: number;
  image: string;
  description: string;
  status: "ACTIVE" | "DRAFT";
  featured: boolean;
  tags?: string[];
};

const recordId = (record: Activity) => record.id || String(record._id);

const formatAdminActivityDatesDisplay = (activity: Activity) => {
  const label = formatAdminActivityDates(activity);
  if (!label) return "Dates not set";
  if (label.includes(" to ")) {
    const [start, end] = label.split(" to ");
    return `${formatDisplayDateValue(start)} to ${formatDisplayDateValue(end)}`;
  }
  if (label.startsWith("From ")) {
    return `From ${formatDisplayDateValue(label.slice(5))}`;
  }
  if (label.startsWith("Until ")) {
    return `Until ${formatDisplayDateValue(label.slice(6))}`;
  }
  return label;
};

function InfoCard({
  darkMode,
  title,
  rows,
}: {
  darkMode: boolean;
  title: string;
  rows: [string, React.ReactNode][];
}) {
  return (
    <div className={`rounded-2xl border p-5 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <h3 className="mb-4 text-sm font-black uppercase tracking-widest opacity-40">{title}</h3>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <dt className="font-bold opacity-60">{label}</dt>
            <dd className="text-right font-black">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = String(params.id || "");
  const darkMode = useDarkMode();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [sales, setSales] = useState({ bookingCount: 0, ticketsSold: 0, capacity: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activityId) fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const fetchActivity = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await db
        .from("activities")
        .select("*")
        .eq("id", activityId)
        .single();
      if (fetchError || !data) throw new Error("Activity not found.");
      const { data: bookings } = await db
        .from("bookings")
        .select("*")
        .eq("activity_id", recordId(data))
        .eq("status", "CONFIRMED");

      setActivity(data);
      setSales(summarizeActivitySales(data, bookings || []));
      if (data.vendor_id) {
        const { data: vendorData } = await db.from("vendors").select("*").eq("id", data.vendor_id).single();
        setVendor(vendorData || null);
      } else {
        setVendor(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load activity.");
      setActivity(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    if (!window.confirm(`Delete ${toDisplayTitle(activity.title)}?`)) return;
    await db.from("activities").delete().eq("id", recordId(activity));
    router.push("/admin/activities");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className={`h-10 w-48 animate-pulse rounded-lg ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
        <div className={`h-64 animate-pulse rounded-2xl ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-32 animate-pulse rounded-2xl ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error && !activity) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 font-bold text-red-600">{error}</p>
        <Link href="/admin/activities" className="font-bold text-amber-600">
          Back to Activities
        </Link>
      </div>
    );
  }

  if (!activity) return null;

  const displayStatus = getActivityDisplayStatus(activity);
  const bookable = canBookActivity(activity);
  const id = recordId(activity);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/activities"
            className={`rounded-2xl border p-3 transition-all ${darkMode ? "border-slate-800 bg-slate-900 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
              {toDisplayTitle(activity.title)}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${activityDisplayStatusStyles[displayStatus]}`}>
                {activityDisplayStatusLabels[displayStatus]}
              </span>
              {activity.booking_status === "PAUSED" && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-800">
                  Booking paused
                </span>
              )}
              {activity.featured && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase text-amber-800">
                  Featured
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/activities?edit=${id}`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="secondary" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          {bookable ? (
            <Link href={getAdminBookingUrl({ activityId: id, date: todayDateValue() })}>
              <Button>
                <Ticket className="h-4 w-4" />
                Book Now
              </Button>
            </Link>
          ) : (
            <Button disabled>
              <Ticket className="h-4 w-4" />
              Book Now
            </Button>
          )}
        </div>
      </header>

      <div className={`overflow-hidden rounded-2xl border ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
        <img
          src={activity.image || activityImages.kalari}
          alt={toDisplayTitle(activity.title)}
          className="h-72 w-full object-cover"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          darkMode={darkMode}
          title="Sales summary"
          rows={[
            [
              "Tickets sold",
              `${sales.ticketsSold} confirmed (${sales.bookingCount} bookings)`,
            ],
            ["Revenue", `Rs. ${sales.revenue.toLocaleString("en-IN")}`],
            [
              "Season capacity (est.)",
              `${activity.daily_capacity || 20}/day · up to ${sales.capacity} tickets`,
            ],
          ]}
        />
        <InfoCard
          darkMode={darkMode}
          title="Pricing"
          rows={[
            ["Ticket price", `Rs. ${activity.booking_price || activity.price}`],
            ["Daily capacity", `${activity.daily_capacity || 20} tickets`],
            [
              "Booking",
              activity.booking_status === "PAUSED" ? "Paused" : "Open",
            ],
          ]}
        />
        <InfoCard
          darkMode={darkMode}
          title="Details"
          rows={[
            ["Location", activity.location],
            ["Dates", formatAdminActivityDatesDisplay(activity)],
            ["Rating", `${activity.rating} (${activity.review_count} reviews)`],
          ]}
        />
        <InfoCard
          darkMode={darkMode}
          title="Vendor"
          rows={[
            ["Linked vendor", vendor ? getVendorDisplayName(vendor) : "None"],
            ["Contact", vendor ? getVendorContact(vendor) || "—" : "—"],
            [
              "Platform commission",
              activity.vendor_id ? `${activity.platform_commission_percentage || 0}%` : "—",
            ],
            ["Category", toDisplayTitle(activity.category)],
          ]}
        />
      </div>

      <section className={`rounded-2xl border p-6 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h2 className="mb-3 text-lg font-black">Description</h2>
        <p className={`whitespace-pre-wrap text-sm leading-7 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
          {activity.description || "No description provided."}
        </p>
        {(activity.tags || []).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {activity.tags!.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-bold ${darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={`mt-6 flex flex-wrap gap-4 text-sm font-semibold opacity-70 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {activity.location}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {formatAdminActivityDatesDisplay(activity)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Star className="h-4 w-4" />
            {activity.rating} ({activity.review_count})
          </span>
        </div>
      </section>
    </div>
  );
}
