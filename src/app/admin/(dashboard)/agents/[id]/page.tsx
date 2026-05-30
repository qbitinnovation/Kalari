"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Calendar, CheckCircle2, CreditCard, Download, Info, MessageSquare, Smartphone, User, X } from "lucide-react";
import { db, type Activity, type Agent, type Booking, type Show } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeaderCell, AdminTablePanel, AdminTableRow, AdminTableSkeleton, Button } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { escapeReportHtml, openAdminReportPdf } from "@/lib/adminReportTemplate";
import { getBookingReference, getRecordId, parseSeatCodes } from "@/lib/booking";
import {
  getAgentContact,
  getAgentDisplayName,
  getAgentAlertMethod,
  getAgentGpayPhone,
  getAgentPayoutDetailRows,
  getBookingCommissionDisplayStatus,
  inferAgentPayoutMethod,
  isBookingCommissionDue,
  isShowBooking,
  normalizeAgentNotificationMethod,
  normalizePayoutFrequency,
} from "@/lib/agentCommission";
import { getAgentCode, getAgentPublicId } from "@/lib/agentId";
import { toDisplayTitle } from "@/lib/textFormat";

interface BookingWithDetails extends Booking {
  show_details?: Show;
  activity_details?: Activity;
}

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const getBookingEventTitle = (booking: BookingWithDetails) =>
  booking.activity_details?.title || booking.show_details?.title || "Unknown Event";

const getBookingEventType = (booking: BookingWithDetails) =>
  booking.activity_details ? "Activity" : booking.show_details?.type || "Event";

export default function AgentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = String(params.id || "");
  const periodFilter = String(searchParams.get("periodKey") || searchParams.get("period") || "");
  const statusFilter = String(searchParams.get("status") || "").toUpperCase();
  const darkMode = useDarkMode();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [showSettleAllConfirm, setShowSettleAllConfirm] = useState(false);
  const [settlingAllDue, setSettlingAllDue] = useState(false);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [error, setError] = useState("");

  const effectiveStatusFilter = showAllStatuses ? "" : statusFilter;

  useEffect(() => {
    setShowAllStatuses(false);
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    if (agentId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      await fetch("/api/agents/backfill", { method: "POST" }).catch(() => null);

      let { data: agentData } = await db.from("agents").select("*").eq("id", agentId).single();
      if (!agentData) {
        const legacy = await db.from("users").select("*").eq("id", agentId).single();
        agentData = legacy.data
          ? { ...legacy.data, name: legacy.data.full_name, phone: legacy.data.phone || legacy.data.email, payout_frequency: "MONTHLY" }
          : null;
      }
      if (!agentData) throw new Error("Agent not found.");

      if (!getAgentCode(agentData)) {
        await fetch("/api/agents/backfill", { method: "POST" }).catch(() => null);
        const retry = await db.from("agents").select("*").eq("id", agentId).single();
        agentData = retry.data || agentData;
      }

      setAgent(agentData);

      const agentLookupIds = [agentId, getRecordId(agentData)].filter(Boolean);
      const uniqueAgentIds = Array.from(new Set(agentLookupIds));
      const { data: bookingData, error: bookingError } = await db
        .from("bookings")
        .select("*, customer:customers(*)")
        .in("agent_id", uniqueAgentIds)
        .order("booking_time", { ascending: false });
      if (bookingError) throw bookingError;

      const rows = await Promise.all((bookingData || []).map(async (booking: BookingWithDetails) => {
        const [showResult, activityResult] = await Promise.all([
          booking.show_id
            ? db.from("shows").select("*").eq("id", booking.show_id).single()
            : Promise.resolve({ data: null }),
          booking.activity_id
            ? db.from("activities").select("*").eq("id", booking.activity_id).single()
            : Promise.resolve({ data: null }),
        ]);
        return { ...booking, show_details: showResult.data || undefined, activity_details: activityResult.data || undefined };
      }));
      const showRows = rows.filter(isShowBooking);
      const visibleRows = filterRows(showRows);
      setBookings(showRows);
      if (!silent && agentData) {
        setSelectedIds(
          showRows
            .filter((booking) =>
              isBookingCommissionDue(booking, agentData, new Date(), booking.show_details),
            )
            .map(getRecordId),
        );
      }
    } catch (error: any) {
      setError(error.message || "Failed to load agent details.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getCommissionRowStatus = (booking: BookingWithDetails) =>
    agent ? getBookingCommissionDisplayStatus(booking, agent, booking.show_details) : "NONE";

  const isUnpaidCommission = (booking: BookingWithDetails) => {
    const rowStatus = getCommissionRowStatus(booking);
    return rowStatus === "DUE" || rowStatus === "PENDING";
  };

  const isDueCommission = (booking: BookingWithDetails) =>
    agent ? isBookingCommissionDue(booking, agent, new Date(), booking.show_details) : false;

  const filterRows = (rows: BookingWithDetails[]) => rows.filter((booking) => {
    if (periodFilter && booking.commission_period_key !== periodFilter) return false;
    const rowStatus = getCommissionRowStatus(booking);
    if (effectiveStatusFilter === "DUE") return rowStatus === "DUE";
    if (effectiveStatusFilter === "PENDING") return rowStatus === "PENDING";
    if (effectiveStatusFilter === "UNPAID") return isUnpaidCommission(booking);
    if (effectiveStatusFilter === "PAID") return rowStatus === "PAID";
    return true;
  });

  const visibleBookings = useMemo(() => filterRows(bookings), [bookings, periodFilter, effectiveStatusFilter]);

  const totals = useMemo(() => {
    const unpaid = visibleBookings.filter(isUnpaidCommission).reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);
    const paid = visibleBookings.filter((booking) => booking.commission_status === "PAID").reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);
    return { unpaid, paid, all: unpaid + paid };
  }, [visibleBookings]);

  const selectedUnpaid = visibleBookings.filter(
    (booking) => selectedIds.includes(getRecordId(booking)) && isDueCommission(booking),
  );
  const selectedAmount = selectedUnpaid.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);

  const dueBookings = useMemo(
    () =>
      agent
        ? bookings.filter((booking) => isBookingCommissionDue(booking, agent, new Date(), booking.show_details))
        : [],
    [agent, bookings],
  );
  const dueAmount = dueBookings.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0);

  const applyPaidBookings = (paidIds: Set<string>, paidAt: string, paidBy: string) => {
    setBookings((current) =>
      current.map((booking) =>
        paidIds.has(getRecordId(booking))
          ? { ...booking, commission_status: "PAID", commission_paid_at: paidAt, commission_paid_by: paidBy, updated_at: paidAt }
          : booking,
      ),
    );
    setSelectedIds((ids) => ids.filter((id) => !paidIds.has(id)));
  };

  const settleAllDueForAgent = async () => {
    if (!agent || dueBookings.length === 0) return;
    setSettlingAllDue(true);
    setError("");
    try {
      const { data: auth } = await db.auth.getUser();
      const paidBy = auth.user?.id || auth.user?.email || "admin";
      const response = await fetch("/api/commissions/settle-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, paidBy }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle due commissions for this agent.");
      }

      const paidIds = new Set<string>((payload.data?.bookingIds || dueBookings.map(getRecordId)).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;
      applyPaidBookings(paidIds, paidAt, paidByUser);
      setShowSettleAllConfirm(false);

      if (statusFilter === "UNPAID" || statusFilter === "DUE") {
        setShowAllStatuses(true);
        const params = new URLSearchParams();
        if (periodFilter) params.set("periodKey", periodFilter);
        const query = params.toString();
        router.replace(query ? `/admin/agents/${agentId}?${query}` : `/admin/agents/${agentId}`);
      }
    } catch (error: any) {
      setError(error.message || "Could not settle due commissions for this agent.");
    } finally {
      setSettlingAllDue(false);
    }
  };

  const toggleSelection = (bookingId: string) => {
    setSelectedIds((current) => current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId]);
  };

  const markSelectedPaid = async () => {
    if (!selectedUnpaid.length) return;
    setMarkingPaid(true);
    setError("");
    const paidIds = new Set(selectedUnpaid.map(getRecordId));
    const amountToPay = selectedAmount;
    try {
      const { data: auth } = await db.auth.getUser();
      const paidBy = auth.user?.id || auth.user?.email || "admin";
      const response = await fetch("/api/commissions/mark-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingIds: selectedUnpaid.map(getRecordId),
          paidBy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not mark commission paid.");
      }

      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;
      applyPaidBookings(paidIds, paidAt, paidByUser);
      setShowPayConfirm(false);

      if (statusFilter === "UNPAID" || statusFilter === "DUE") {
        setShowAllStatuses(true);
        const params = new URLSearchParams();
        if (periodFilter) params.set("periodKey", periodFilter);
        const query = params.toString();
        router.replace(query ? `/admin/agents/${agentId}?${query}` : `/admin/agents/${agentId}`);
      }

      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "AGENT_PAYOUT_PAID",
          module: "AGENTS",
          title: "Agent commission marked paid",
          message: `${agent ? getAgentDisplayName(agent) : "Agent"} commission of ${rupees(amountToPay)} was marked paid.`,
          severity: "SUCCESS",
          entity_type: "agent",
          entity_id: agentId,
          action_url: `/admin/agents/${agentId}`,
        }),
      }).catch(() => null);
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
        <td><strong>${escapeReportHtml(getBookingEventTitle(booking))}</strong><span class="muted">${escapeReportHtml(getBookingEventType(booking))}</span></td>
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
      compact: true,
      body: `
        <section class="report-top">
          <div class="kv-grid">
            <div class="kv-item"><p class="label">Unpaid</p><p class="value">${escapeReportHtml(rupees(totals.unpaid))}</p></div>
            <div class="kv-item"><p class="label">Paid</p><p class="value">${escapeReportHtml(rupees(totals.paid))}</p></div>
            <div class="kv-item"><p class="label">Bookings</p><p class="value">${escapeReportHtml(bookings.length)}</p></div>
            <div class="kv-item"><p class="label">Payout Cycle</p><p class="value">${escapeReportHtml(toDisplayTitle(agent.payout_frequency))}</p></div>
          </div>
          <div class="kv-grid">
            <div class="kv-item"><p class="label">Name</p><p class="value">${escapeReportHtml(getAgentDisplayName(agent))}</p></div>
            <div class="kv-item"><p class="label">Phone</p><p class="value">${escapeReportHtml(getAgentContact(agent))}</p></div>
            <div class="kv-item"><p class="label">Email</p><p class="value">${escapeReportHtml(agent.email || "Not added")}</p></div>
            <div class="kv-item"><p class="label">Payout</p><p class="value">${escapeReportHtml(inferAgentPayoutMethod(agent) === "GPAY" ? `GPay • ${getAgentGpayPhone(agent) || "Not added"}` : (agent.bank_name || "Bank transfer"))}</p></div>
            ${inferAgentPayoutMethod(agent) === "BANK" ? `<div class="kv-item"><p class="label">Account</p><p class="value">${escapeReportHtml(agent.bank_account_number || "Not added")}</p></div>` : ""}
          </div>
        </section>
        <section class="bookings-section">
          <h2>Commission Bookings</h2>
          ${bookings.length ? `<table><thead><tr><th>Booking</th><th>Event</th><th>Customer</th><th>Tickets</th><th>Amount</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>${bookingRows}</tbody></table>` : '<div class="empty">No bookings found for this agent.</div>'}
        </section>
      `,
    });
  };

  if (error && !agent && !loading) return (
    <div className="py-12 text-center">
      <div className="mb-4 inline-block rounded-xl bg-red-50 p-4 text-red-600">
        <Info className="mr-2 inline" /> {error || "Agent not found"}
      </div>
      <button onClick={() => router.back()} className="mx-auto flex items-center justify-center gap-2 font-bold text-amber-600">
        <ArrowLeft className="h-4 w-4" /> Go Back
      </button>
    </div>
  );

  if (!agent && !loading) return null;

  return (
    <div className="space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className={`rounded-2xl border p-3 transition-all ${darkMode ? "border-slate-800 bg-slate-900 hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                {loading ? (
                  <span className={`inline-block h-8 w-48 animate-pulse rounded-lg ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                ) : (
                  getAgentDisplayName(agent!)
                )}
              </h1>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
                {loading ? (
                  <span className={`inline-block h-3 w-36 animate-pulse rounded ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                ) : (
                  <>
                    <span className={`h-2 w-2 rounded-full ${agent!.active !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                    {agent!.active !== false ? "Active Agent" : "Inactive Agent"} • {toDisplayTitle(normalizePayoutFrequency(agent!.payout_frequency))} payout
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            {(periodFilter || statusFilter) && <Button variant="secondary" onClick={() => router.push(`/admin/agents/${agentId}`)}>Clear Filter</Button>}
            <Button variant="secondary" onClick={exportAgentReport} disabled={loading || !agent}><Download className="h-4 w-4" /> Export PDF</Button>
            {dueBookings.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => { setError(""); setShowSettleAllConfirm(true); }}
                disabled={loading || settlingAllDue || markingPaid}
              >
                <CheckCircle2 className="h-4 w-4" />
                Settle All Due ({rupees(dueAmount)})
              </Button>
            )}
            <Button onClick={() => setShowPayConfirm(true)} disabled={loading || markingPaid || settlingAllDue || selectedUnpaid.length === 0}><CheckCircle2 className="h-4 w-4" /> Mark Selected Paid ({rupees(selectedAmount)})</Button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
        {(periodFilter || effectiveStatusFilter) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            Showing {effectiveStatusFilter ? toDisplayTitle(effectiveStatusFilter) : "filtered"} commission{periodFilter ? ` for period ${periodFilter}` : ""}.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
                <div className={`mb-3 h-4 w-24 animate-pulse rounded ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                <div className={`h-8 w-32 animate-pulse rounded ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Unpaid Commission" value={rupees(totals.unpaid)} icon={<CreditCard className="h-6 w-6 text-amber-500" />} darkMode={darkMode} />
              <StatCard label="Paid Commission" value={rupees(totals.paid)} icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} darkMode={darkMode} />
              <StatCard label="Total Bookings" value={String(visibleBookings.length)} icon={<Calendar className="h-6 w-6 text-blue-500" />} darkMode={darkMode} />
              <StatCard label="Payout Cycle" value={toDisplayTitle(agent!.payout_frequency)} icon={<User className="h-6 w-6 text-purple-500" />} darkMode={darkMode} />
            </>
          )}
        </div>

        {!loading && agent && (
        <div className="grid gap-3 lg:grid-cols-3">
          <InfoCard
            darkMode={darkMode}
            title="Contact"
            rows={[
              ["Phone", getAgentContact(agent)],
              ["Email", agent.email || "Not added"],
              ["Agent ID", getAgentPublicId(agent)],
              ["Joined", formatDisplayDateValue(agent.created_at)],
            ]}
          />
          <InfoCard
            darkMode={darkMode}
            title="Notifications"
            icon={<MessageSquare className="h-5 w-5 text-blue-600" />}
            rows={[
              ["Agent Alerts", normalizeAgentNotificationMethod(getAgentAlertMethod(agent)) === "EMAIL" ? "Email" : "Text message"],
            ]}
          />
          <InfoCard
            darkMode={darkMode}
            title="Payout Details"
            icon={inferAgentPayoutMethod(agent) === "GPAY" ? <Smartphone className="h-5 w-5 text-emerald-600" /> : <Banknote className="h-5 w-5 text-emerald-600" />}
            rows={getAgentPayoutDetailRows(agent!)}
          />
        </div>
        )}

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
              {loading ? (
                <AdminTableSkeleton columns={7} />
              ) : visibleBookings.length === 0 ? (
                <AdminTableEmpty colSpan={7}>No bookings found for this agent.</AdminTableEmpty>
              ) : visibleBookings.map((booking) => {
                const bookingId = getRecordId(booking);
                const rowStatus = getCommissionRowStatus(booking);
                const canSelect = rowStatus === "DUE";
                return (
                  <AdminTableRow key={bookingId}>
                    <AdminTableCell>
                      <input type="checkbox" disabled={!canSelect} checked={selectedIds.includes(bookingId)} onChange={() => toggleSelection(bookingId)} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-bold text-sm">{getBookingEventTitle(booking)}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-40">{getBookingReference(booking)} • {formatDisplayDateValue(booking.booking_time)}</div>
                    </AdminTableCell>
                    <AdminTableCell>{booking.booked_by || booking.customer?.name || "Customer"}</AdminTableCell>
                    <AdminTableCell>{parseSeatCodes(booking.seat_code).length}</AdminTableCell>
                    <AdminTableCell>{booking.agent_commission_percentage || 0}%</AdminTableCell>
                    <AdminTableCell><span className="font-black text-emerald-600">{rupees(booking.commission_amount || 0)}</span></AdminTableCell>
                    <AdminTableCell>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                          rowStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : rowStatus === "DUE"
                              ? "bg-amber-100 text-amber-800"
                              : rowStatus === "PENDING"
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {rowStatus === "NONE" ? "—" : rowStatus}
                      </span>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTable>
        </AdminTablePanel>

      {showSettleAllConfirm && agent && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Settle all due commissions</h2>
                <p className="admin-modal-subtitle">
                  This will mark every commission currently due for {getAgentDisplayName(agent)} as paid.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleAllConfirm(false)}
                className="admin-modal-close"
                aria-label="Close modal"
                disabled={settlingAllDue}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Agent</span>
                  <span className="min-w-0 break-words text-right font-black">{getAgentDisplayName(agent)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout via</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {inferAgentPayoutMethod(agent) === "GPAY"
                      ? `GPay • ${getAgentGpayPhone(agent) || "Not added"}`
                      : agent.bank_name || "Bank transfer"}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Due bookings</span>
                  <span className="font-black">{dueBookings.length}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Total payout</span>
                  <span className="font-black text-emerald-600">{rupees(dueAmount)}</span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowSettleAllConfirm(false)} disabled={settlingAllDue}>
                Cancel
              </Button>
              <Button type="button" onClick={settleAllDueForAgent} disabled={settlingAllDue}>
                <CheckCircle2 className="h-4 w-4" />
                {settlingAllDue ? "Processing..." : "Confirm settle all due"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPayConfirm && agent && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Confirm commission payout</h2>
                <p className="admin-modal-subtitle">This will mark the selected bookings as paid and cannot be undone from this screen.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayConfirm(false)}
                className="admin-modal-close"
                aria-label="Close modal"
                disabled={markingPaid}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Agent</span>
                  <span className="min-w-0 break-words text-right font-black">{getAgentDisplayName(agent)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout via</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {inferAgentPayoutMethod(agent) === "GPAY"
                      ? `GPay • ${getAgentGpayPhone(agent) || "Not added"}`
                      : agent.bank_name || "Bank transfer"}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Bookings</span>
                  <span className="font-black">{selectedUnpaid.length}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Total payout</span>
                  <span className="font-black text-emerald-600">{rupees(selectedAmount)}</span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowPayConfirm(false)} disabled={markingPaid}>
                Cancel
              </Button>
              <Button type="button" onClick={markSelectedPaid} disabled={markingPaid}>
                <CheckCircle2 className="h-4 w-4" />
                {markingPaid ? "Processing..." : "Confirm payout"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const InfoCard = ({ title, rows, icon, darkMode }: { title: string; rows: [string, string][]; icon?: React.ReactNode; darkMode: boolean }) => (
  <div className={`rounded-xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
    <h2 className={`mb-3 flex items-center gap-2 text-sm font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{icon || <Banknote className="h-4 w-4 text-amber-600" />} {title}</h2>
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 text-sm">
          <span className={`shrink-0 font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
          <span className={`min-w-0 break-words text-right font-black ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const StatCard = ({ label, value, icon, darkMode }: { label: string; value: string; icon: React.ReactNode; darkMode: boolean }) => (
  <div className={`rounded-xl border p-4 ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-sm"}`}>
    <div className={`mb-2 inline-flex rounded-xl p-2 ${darkMode ? "bg-slate-800" : "bg-slate-50"}`}>{icon}</div>
    <div className={`mb-0.5 text-[10px] font-black uppercase tracking-widest ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</div>
    <div className={`text-xl font-black tracking-tight ${darkMode ? "text-slate-100" : "text-slate-950"}`}>{value}</div>
  </div>
);
