"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Pencil, Ticket, Trash2 } from "lucide-react";
import { db, type Show } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { useDarkMode } from "@/hooks/useDarkMode";
import { canBookShow, getAdminBookingUrl } from "@/lib/adminBooking";
import { getAgentDisplayName } from "@/lib/agentCommission";
import {
  getShowDisplayStatus,
  showDisplayStatusLabels,
  showDisplayStatusStyles,
} from "@/lib/catalogLifecycle";
import { summarizeShowSales } from "@/lib/catalogSalesSummary";
import { getRecordId } from "@/lib/booking";
import { Button } from "@/components/ui";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

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

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const showId = String(params.id || "");
  const darkMode = useDarkMode();
  const [show, setShow] = useState<Show | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [sales, setSales] = useState({ bookingCount: 0, ticketsSold: 0, capacity: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (showId) fetchShow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  const fetchShow = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await db
        .from("shows")
        .select("*, layout:layouts(*)")
        .eq("id", showId)
        .single();
      if (fetchError || !data) throw new Error("Show not found.");

      const { data: bookings } = await db
        .from("bookings")
        .select("*")
        .eq("show_id", getRecordId(data))
        .eq("status", "CONFIRMED");

      setShow(data);
      setSales(summarizeShowSales(data, bookings || []));
      if (data.agent_id) {
        const { data: agent } = await db.from("agents").select("*").eq("id", data.agent_id).single();
        setAgentName(agent ? getAgentDisplayName(agent) : null);
      } else {
        setAgentName(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load show.");
      setShow(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!show) return;
    if (!window.confirm(`Delete ${toDisplayTitle(show.title)}?`)) return;
    await db.from("shows").delete().eq("id", getRecordId(show));
    router.push("/admin/shows");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className={`h-10 w-48 animate-pulse rounded-lg ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
        <div className={`h-64 animate-pulse rounded-2xl ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
      </div>
    );
  }

  if (error && !show) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 font-bold text-red-600">{error}</p>
        <Link href="/admin/shows" className="font-bold text-amber-600">
          Back to Shows
        </Link>
      </div>
    );
  }

  if (!show) return null;

  const displayStatus = getShowDisplayStatus(show);
  const id = getRecordId(show);
  const bookable = canBookShow(show);
  const fillLabel =
    sales.capacity > 0
      ? `${sales.ticketsSold} / ${sales.capacity} seats (${Math.round((sales.ticketsSold / sales.capacity) * 100)}%)`
      : `${sales.ticketsSold} tickets sold`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/shows"
            className={`rounded-2xl border p-3 transition-all ${darkMode ? "border-slate-800 bg-slate-900 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
              {toDisplayTitle(show.title)}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${showDisplayStatusStyles[displayStatus]}`}>
                {showDisplayStatusLabels[displayStatus]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/shows">
            <Button variant="secondary">
              <Pencil className="h-4 w-4" />
              Edit on list
            </Button>
          </Link>
          <Button variant="secondary" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          {bookable ? (
            <Link href={getAdminBookingUrl({ showId: id })}>
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
          src={show.image || activityImages.kalari}
          alt={toDisplayTitle(show.title)}
          className="h-72 w-full object-cover"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          darkMode={darkMode}
          title="Sales summary"
          rows={[
            ["Tickets sold", fillLabel],
            ["Confirmed bookings", String(sales.bookingCount)],
            ["Revenue", `Rs. ${sales.revenue.toLocaleString("en-IN")}`],
          ]}
        />
        <InfoCard
          darkMode={darkMode}
          title="Schedule"
          rows={[
            ["Date", formatDisplayDateValue(show.date)],
            ["Time", formatDisplayTimeValue(show.time)],
            ["Ticket price", `Rs. ${Number(show.price || 0).toLocaleString("en-IN")}`],
          ]}
        />
        <InfoCard
          darkMode={darkMode}
          title="Layout & agent"
          rows={[
            ["Arena layout", toDisplayTitle(show.layout?.name || "Default Kalari layout")],
            ["Linked agent", show.agent_id ? agentName || "Linked agent" : "None"],
            [
              "Agent commission",
              show.agent_id ? `${show.agent_commission_percentage || 0}%` : "—",
            ],
          ]}
        />
      </div>

      <section className={`rounded-2xl border p-6 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h2 className="mb-3 text-lg font-black">Description</h2>
        <p className={`whitespace-pre-wrap text-sm leading-7 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
          {show.description || "No description provided."}
        </p>
        <div className={`mt-6 flex flex-wrap gap-4 text-sm font-semibold opacity-70 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {formatDisplayDateValue(show.date)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {formatDisplayTimeValue(show.time)}
          </span>
        </div>
      </section>
    </div>
  );
}
