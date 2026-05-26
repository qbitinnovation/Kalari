"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Calendar, CheckCircle2, CreditCard, Download, Info, Phone, User } from "lucide-react";
import { db, type Agent, type Booking, type Show } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeaderCell, AdminTablePanel, AdminTableRow, Button } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { escapeReportHtml, openAdminReportPdf } from "@/lib/adminReportTemplate";
import { getBookingReference, getRecordId, parseSeatCodes } from "@/lib/booking";
import { getAgentContact, getAgentDisplayName, normalizePayoutFrequency } from "@/lib/agentCommission";
import { toDisplayTitle } from "@/lib/textFormat";

interface BookingWithDetails extends Booking {
  show_details?: Show;
}

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = String(params.id || "");
  const darkMode = useDarkMode();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (agentId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      let { data: agentData } = await db.from("agents").select("*").eq("id", agentId).single();
      if (!agentData) {
        const legacy = await db.from("users").select("*").eq("id", agentId).single();
        agentData = legacy.data ? { ...legacy.data, name: legacy.data.full_name, phone: legacy.data.phone || legacy.data.email, payout_frequency: "MONTHLY" } : null;
      }
      if (!agentData) throw new Error("Agent not found.");
      setAgent(agentData);

      const { data: bookingData, error: bookingError } = await db
        .from("bookings")
        .select("*, customer:customers(*)")
        .eq("agent_id", agentId)
        .order("booking_time", { ascending: false });
      if (bookingError) throw bookingError;

      const rows = await Promise.all((bookingData || []).map(async (booking: BookingWithDetails) => {
        const { data: showData } = await db.from("shows").select("*").eq("id", booking.show_id).single();
        return { ...booking, show_details: showData };
      }));
      setBookings(rows);
      setSelectedIds(rows.filter(isUnpaidCommission).map(getRecordId));
    } catch (error: any) {
      setError(error.message || "Failed to load agent details.");
    } finally {
      setLoading(false);
    }
  };

  const isUnpaidCommission = (booking: BookingWithDetails) =>
    booking.status === "CONFIRMED" && Number(booking.commission_amount || 0) > 0 && booking.commission_status !== "PAID";

  const totals = useMemo(() => {
    const unpaid = bookings.filter(isUnpaidCommission).reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);
    const paid = bookings.filter((booking) => booking.commission_status === "PAID").reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);
    return { unpaid, paid, all: unpaid + paid };
  }, [bookings]);

  const selectedUnpaid = bookings.filter((booking) => selectedIds.includes(getRecordId(booking)) && isUnpaidCommission(booking));
  const selectedAmount = selectedUnpaid.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);

  const toggleSelection = (bookingId: string) => {
    setSelectedIds((current) => current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId]);
  };

  const markSelectedPaid = async () => {
    if (!selectedUnpaid.length) return;
    setMarkingPaid(true);
    setError("");
    try {
      const { data: auth } = await db.auth.getUser();
      const now = new Date().toISOString();
      for (const booking of selectedUnpaid) {
        const { error } = await db.from("bookings").update({
          commission_status: "PAID",
          commission_paid_at: now,
          commission_paid_by: auth.user?.id || auth.user?.email || "admin",
          updated_at: now,
        }).eq("id", getRecordId(booking));
        if (error) throw error;
      }
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "AGENT_PAYOUT_PAID",
          module: "AGENTS",
          title: "Agent commission marked paid",
          message: `${agent ? getAgentDisplayName(agent) : "Agent"} commission of ${rupees(selectedAmount)} was marked paid.`,
          severity: "SUCCESS",
          entity_type: "agent",
          entity_id: agentId,
          action_url: `/admin/agents/${agentId}`,
        }),
      }).catch(() => null);
      await fetchData();
    } catch (error: any) {
      setError(error.message || "Could not mark commission paid.");
    } finally {
      setMarkingPaid(false);
    }
  };

  const exportAgentReport = () => {
    if (!agent) return;
    const bookingRows = bookings.map((booking) => `
      <tr>
        <td><strong>${escapeReportHtml(getBookingReference(booking))}</strong><span class="muted">${escapeReportHtml(formatDisplayDateValue(booking.booking_time))}</span></td>
        <td><strong>${escapeReportHtml(booking.show_details?.title || "Unknown Show")}</strong><span class="muted">${escapeReportHtml(booking.show_details?.type || "Event")}</span></td>
        <td>${escapeReportHtml(booking.booked_by || booking.customer?.name || "Customer")}</td>
        <td class="nowrap">${escapeReportHtml(parseSeatCodes(booking.seat_code).length)}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.total_amount || 0))}</td>
        <td class="nowrap">${escapeReportHtml(`${booking.agent_commission_percentage || 0}%`)}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.commission_amount || 0))}</td>
        <td>${escapeReportHtml(booking.commission_status || "UNPAID")}</td>
      </tr>
    `).join("");

    openAdminReportPdf({
      title: "Agent Commission Report",
      subtitle: `Offline payout summary for ${getAgentDisplayName(agent)}.`,
      generatedLabel: `Generated ${formatDisplayDateValue(new Date())}`,
      body: `
        <section class="metrics">
          <article class="metric"><p class="label">Unpaid</p><p class="value">${escapeReportHtml(rupees(totals.unpaid))}</p></article>
          <article class="metric"><p class="label">Paid</p><p class="value">${escapeReportHtml(rupees(totals.paid))}</p></article>
          <article class="metric"><p class="label">Bookings</p><p class="value">${escapeReportHtml(bookings.length)}</p></article>
          <article class="metric"><p class="label">Payout Cycle</p><p class="value">${escapeReportHtml(toDisplayTitle(agent.payout_frequency))}</p></article>
        </section>
        <section class="panels">
          <article class="panel">
            <h2>Agent Details</h2>
            <div class="detail-grid">
              <div class="detail"><p class="label">Name</p><p class="value">${escapeReportHtml(getAgentDisplayName(agent))}</p></div>
              <div class="detail"><p class="label">Phone</p><p class="value">${escapeReportHtml(getAgentContact(agent))}</p></div>
              <div class="detail"><p class="label">Bank</p><p class="value">${escapeReportHtml(agent.bank_name || "Not added")}</p></div>
              <div class="detail"><p class="label">Account</p><p class="value">${escapeReportHtml(agent.bank_account_number || "Not added")}</p></div>
            </div>
          </article>
          <article class="panel">
            <h2>Commission Bookings</h2>
            ${bookings.length ? `<table><thead><tr><th>Booking</th><th>Event</th><th>Customer</th><th>Tickets</th><th>Amount</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>${bookingRows}</tbody></table>` : '<div class="empty">No bookings found for this agent.</div>'}
          </article>
        </section>
      `,
    });
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" /></div>;

  if (error || !agent) return (
    <div className="p-8 text-center">
      <div className="mb-4 inline-block rounded-xl bg-red-50 p-4 text-red-600">
        <Info className="mr-2 inline" /> {error || "Agent not found"}
      </div>
      <button onClick={() => router.back()} className="mx-auto flex items-center justify-center gap-2 font-bold text-amber-600">
        <ArrowLeft className="h-4 w-4" /> Go Back
      </button>
    </div>
  );

  return (
    <div className={`min-h-screen p-4 sm:p-8 ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className={`rounded-2xl border p-3 transition-all ${darkMode ? "border-slate-800 bg-slate-900 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{toDisplayTitle(getAgentDisplayName(agent))}</h1>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
                <span className={`h-2 w-2 rounded-full ${agent.active !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                {agent.active !== false ? "Active Agent" : "Inactive Agent"} • {toDisplayTitle(normalizePayoutFrequency(agent.payout_frequency))} payout
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <Button variant="secondary" onClick={exportAgentReport}><Download className="h-4 w-4" /> Export PDF</Button>
            <Button onClick={markSelectedPaid} disabled={markingPaid || selectedUnpaid.length === 0}><CheckCircle2 className="h-4 w-4" /> Mark Selected Paid ({rupees(selectedAmount)})</Button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Unpaid Commission" value={rupees(totals.unpaid)} icon={<CreditCard className="h-6 w-6 text-amber-500" />} darkMode={darkMode} />
          <StatCard label="Paid Commission" value={rupees(totals.paid)} icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} darkMode={darkMode} />
          <StatCard label="Total Bookings" value={String(bookings.length)} icon={<Calendar className="h-6 w-6 text-blue-500" />} darkMode={darkMode} />
          <StatCard label="Payout Cycle" value={toDisplayTitle(agent.payout_frequency)} icon={<User className="h-6 w-6 text-purple-500" />} darkMode={darkMode} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InfoCard title="Contact" rows={[["Phone", getAgentContact(agent)], ["Agent ID", getRecordId(agent)], ["Joined", formatDisplayDateValue(agent.created_at)]]} />
          <InfoCard title="Bank Details" rows={[["Account Name", agent.bank_account_name || "Not added"], ["Account Number", agent.bank_account_number || "Not added"], ["IFSC", agent.bank_ifsc || "Not added"], ["Bank", agent.bank_name || "Not added"]]} />
        </div>

        <AdminTablePanel title="Commission Bookings">
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>Select</AdminTableHeaderCell>
                <AdminTableHeaderCell>Booking / Event</AdminTableHeaderCell>
                <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
                <AdminTableHeaderCell>Tickets</AdminTableHeaderCell>
                <AdminTableHeaderCell>Rate</AdminTableHeaderCell>
                <AdminTableHeaderCell>Commission</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {bookings.map((booking) => {
                const bookingId = getRecordId(booking);
                const unpaid = isUnpaidCommission(booking);
                return (
                  <AdminTableRow key={bookingId}>
                    <AdminTableCell>
                      <input type="checkbox" disabled={!unpaid} checked={selectedIds.includes(bookingId)} onChange={() => toggleSelection(bookingId)} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-bold text-sm">{booking.show_details?.title || "Unknown Event"}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-40">{getBookingReference(booking)} • {formatDisplayDateValue(booking.booking_time)}</div>
                    </AdminTableCell>
                    <AdminTableCell>{booking.booked_by || booking.customer?.name || "Customer"}</AdminTableCell>
                    <AdminTableCell>{parseSeatCodes(booking.seat_code).length}</AdminTableCell>
                    <AdminTableCell>{booking.agent_commission_percentage || 0}%</AdminTableCell>
                    <AdminTableCell><span className="font-black text-emerald-600">{rupees(booking.commission_amount || 0)}</span></AdminTableCell>
                    <AdminTableCell>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${booking.commission_status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {booking.commission_status || "UNPAID"}
                      </span>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
              {bookings.length === 0 && <AdminTableEmpty colSpan={7}>No bookings found for this agent.</AdminTableEmpty>}
            </AdminTableBody>
          </AdminTable>
        </AdminTablePanel>
      </div>
    </div>
  );
}

const InfoCard = ({ title, rows }: { title: string; rows: [string, string][] }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="mb-4 flex items-center gap-2 font-black"><Banknote className="h-5 w-5 text-amber-600" /> {title}</h2>
    <div className="grid gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 text-sm">
          <span className="font-bold opacity-50">{label}</span>
          <span className="text-right font-black">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const StatCard = ({ label, value, icon, darkMode }: { label: string; value: string; icon: React.ReactNode; darkMode: boolean }) => (
  <div className={`rounded-2xl border p-6 transition-all ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
    <div className={`mb-4 inline-flex rounded-2xl p-3 ${darkMode ? "bg-slate-800" : "bg-slate-50"}`}>{icon}</div>
    <div className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-40">{label}</div>
    <div className="text-2xl font-black tracking-tight">{value}</div>
  </div>
);
