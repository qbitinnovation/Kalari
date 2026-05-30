"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Calendar, CheckCircle2, CreditCard, Download, Info, Smartphone, X } from "lucide-react";
import { db, type Activity, type Booking, type Vendor } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeaderCell, AdminTablePanel, AdminTableRow, AdminTableSkeleton, Button } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { escapeReportHtml, openAdminReportPdf } from "@/lib/adminReportTemplate";
import { getBookingReference, getRecordId } from "@/lib/booking";
import {
  collectDueVendorPayoutBookings,
  getBookingVendorPayoutDisplayStatus,
  getVendorContact,
  getVendorDisplayName,
  getVendorGpayPhone,
  getVendorPayoutDetailRows,
  getVendorPayoutLabel,
  inferVendorPayoutMethod,
  isActivityBooking,
  isBookingVendorPayoutDue,
  summarizeVendorPayoutTotals,
} from "@/lib/vendorPayout";
import { getVendorLookupIds, getVendorPublicId } from "@/lib/vendorId";
import { toDisplayTitle } from "@/lib/textFormat";

interface BookingWithDetails extends Booking {
  activity_details?: Activity;
}

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const getBookingEventTitle = (booking: BookingWithDetails) =>
  booking.activity_details?.title || "Activity Booking";

export default function VendorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const vendorId = String(params.id || "");
  const periodFilter = String(searchParams.get("periodKey") || searchParams.get("period") || "");
  const statusFilter = String(searchParams.get("status") || "").toUpperCase();
  const darkMode = useDarkMode();
  const [vendor, setVendor] = useState<Vendor | null>(null);
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
    if (vendorId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      await fetch("/api/vendors/backfill", { method: "POST" }).catch(() => null);

      let { data: vendorData } = await db.from("vendors").select("*").eq("id", vendorId).single();
      if (!vendorData) {
        const retry = await db.from("vendors").select("*").eq("_id", vendorId).single();
        vendorData = retry.data;
      }
      if (!vendorData) throw new Error("Vendor not found.");

      setVendor(vendorData);

      const vendorLookupIds = getVendorLookupIds(vendorData, vendorId);
      const { data: bookingData, error: bookingError } = await db
        .from("bookings")
        .select("*, customer:customers(*)")
        .in("vendor_id", vendorLookupIds)
        .order("booking_time", { ascending: false });
      if (bookingError) throw bookingError;

      const activityRows = (bookingData || []).filter(isActivityBooking);
      const rows = await Promise.all(activityRows.map(async (booking: BookingWithDetails) => {
        const activityResult = booking.activity_id
          ? await db.from("activities").select("*").eq("id", booking.activity_id).single()
          : { data: null };
        return { ...booking, activity_details: activityResult.data || undefined };
      }));
      const visibleRows = filterRows(rows);
      setBookings(rows);
      if (!silent && vendorData) {
        setSelectedIds(
          rows
            .filter((booking) =>
              isBookingVendorPayoutDue(booking, vendorData, booking.activity_details),
            )
            .map(getRecordId),
        );
      }
    } catch (error: any) {
      setError(error.message || "Failed to load vendor details.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const linkedActivities = useMemo(() => {
    const map = new Map<string, Activity>();
    bookings.forEach((booking) => {
      if (booking.activity_details) {
        map.set(getRecordId(booking.activity_details), booking.activity_details);
      }
    });
    return Array.from(map.values());
  }, [bookings]);

  const getPayoutRowStatus = (booking: BookingWithDetails) =>
    vendor ? getBookingVendorPayoutDisplayStatus(booking, vendor, booking.activity_details) : "NONE";

  const isUnpaidVendorPayout = (booking: BookingWithDetails) => {
    const rowStatus = getPayoutRowStatus(booking);
    return rowStatus === "DUE" || rowStatus === "PENDING";
  };

  const isDueVendorPayout = (booking: BookingWithDetails) =>
    vendor ? isBookingVendorPayoutDue(booking, vendor, booking.activity_details) : false;

  const filterRows = (rows: BookingWithDetails[]) => rows.filter((booking) => {
    if (periodFilter && booking.vendor_payout_period_key !== periodFilter) return false;
    const rowStatus = getPayoutRowStatus(booking);
    if (effectiveStatusFilter === "DUE") return rowStatus === "DUE";
    if (effectiveStatusFilter === "PENDING") return rowStatus === "PENDING";
    if (effectiveStatusFilter === "UNPAID") return isUnpaidVendorPayout(booking);
    if (effectiveStatusFilter === "PAID") return rowStatus === "PAID";
    return true;
  });

  const visibleBookings = useMemo(() => filterRows(bookings), [bookings, periodFilter, effectiveStatusFilter]);

  const payoutSummary = useMemo(() => {
    if (!vendor) {
      return {
        platformRevenue: 0,
        vendorEarned: 0,
        paid: 0,
        due: 0,
      };
    }
    const confirmed = visibleBookings.filter((booking) => booking.status === "CONFIRMED");
    const platformRevenue = confirmed.reduce(
      (sum, booking) => sum + Number(booking.platform_commission_amount || 0),
      0,
    );
    const vendorEarned = confirmed.reduce(
      (sum, booking) => sum + Number(booking.vendor_payout_amount || 0),
      0,
    );
    const paid = confirmed
      .filter((booking) => booking.vendor_payout_status === "PAID")
      .reduce((sum, booking) => sum + Number(booking.vendor_payout_amount || 0), 0);
    const totals = summarizeVendorPayoutTotals([vendor], bookings, new Date(), linkedActivities);
    return {
      platformRevenue,
      vendorEarned,
      paid,
      due: totals.due,
    };
  }, [linkedActivities, vendor, visibleBookings, bookings]);

  const selectedUnpaid = visibleBookings.filter(
    (booking) => selectedIds.includes(getRecordId(booking)) && isDueVendorPayout(booking),
  );
  const selectedAmount = selectedUnpaid.reduce(
    (sum, booking) => sum + Number(booking.vendor_payout_amount || 0),
    0,
  );

  const dueBookings = useMemo(() => {
    if (!vendor) return [];
    const { bookings: due } = collectDueVendorPayoutBookings(
      [vendor],
      bookings,
      new Date(),
      linkedActivities,
    );
    return due;
  }, [linkedActivities, vendor, bookings]);

  const dueAmount = dueBookings.reduce(
    (sum, booking) => sum + Number(booking.vendor_payout_amount || 0),
    0,
  );

  const applyPaidBookings = (paidIds: Set<string>, paidAt: string, paidBy: string) => {
    setBookings((current) =>
      current.map((booking) =>
        paidIds.has(getRecordId(booking))
          ? {
              ...booking,
              vendor_payout_status: "PAID",
              vendor_payout_paid_at: paidAt,
              vendor_payout_paid_by: paidBy,
              updated_at: paidAt,
            }
          : booking,
      ),
    );
    setSelectedIds((ids) => ids.filter((id) => !paidIds.has(id)));
  };

  const settleAllDueForVendor = async () => {
    if (!vendor || dueBookings.length === 0) return;
    setSettlingAllDue(true);
    setError("");
    try {
      const { data: auth } = await db.auth.getUser();
      const paidBy = auth.user?.id || auth.user?.email || "admin";
      const response = await fetch("/api/vendor-payouts/settle-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, paidBy }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle due vendor payouts.");
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
        router.replace(query ? `/admin/vendors/${vendorId}?${query}` : `/admin/vendors/${vendorId}`);
      }
    } catch (error: any) {
      setError(error.message || "Could not settle due vendor payouts.");
    } finally {
      setSettlingAllDue(false);
    }
  };

  const toggleSelection = (bookingId: string) => {
    setSelectedIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId],
    );
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
      const response = await fetch("/api/vendor-payouts/mark-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingIds: selectedUnpaid.map(getRecordId),
          paidBy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not mark vendor payout paid.");
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
        router.replace(query ? `/admin/vendors/${vendorId}?${query}` : `/admin/vendors/${vendorId}`);
      }

      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "VENDOR_PAYOUT_PAID",
          module: "VENDORS",
          title: "Vendor payout marked paid",
          message: `${vendor ? getVendorDisplayName(vendor) : "Vendor"} payout of ${rupees(amountToPay)} was marked paid.`,
          severity: "SUCCESS",
          entity_type: "vendor",
          entity_id: vendorId,
          action_url: `/admin/vendors/${vendorId}`,
        }),
      }).catch(() => null);
    } catch (error: any) {
      setError(error.message || "Could not mark vendor payout paid.");
    } finally {
      setMarkingPaid(false);
    }
  };

  const exportVendorReport = () => {
    if (!vendor) return;
    const bookingRows = bookings.map((booking) => `
      <tr>
        <td><strong>${escapeReportHtml(getBookingReference(booking))}</strong><span class="muted">${escapeReportHtml(formatDisplayDateValue(booking.booking_time))}</span></td>
        <td><strong>${escapeReportHtml(getBookingEventTitle(booking))}</strong></td>
        <td>${escapeReportHtml(booking.booked_by || booking.customer?.name || "Customer")}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.total_amount || 0))}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.platform_commission_amount || 0))}</td>
        <td class="nowrap">${escapeReportHtml(rupees(booking.vendor_payout_amount || 0))}</td>
        <td>${escapeReportHtml(booking.vendor_payout_status || "UNPAID")}</td>
      </tr>
    `).join("");

    openAdminReportPdf({
      title: "Vendor Payout Report",
      subtitle: `Activity payout summary for ${getVendorDisplayName(vendor)}.`,
      generatedLabel: `Generated ${formatDisplayDateValue(new Date())}`,
      compact: true,
      body: `
        <section class="report-top">
          <div class="kv-grid">
            <div class="kv-item"><p class="label">Platform Revenue</p><p class="value">${escapeReportHtml(rupees(payoutSummary.platformRevenue))}</p></div>
            <div class="kv-item"><p class="label">Vendor Earned</p><p class="value">${escapeReportHtml(rupees(payoutSummary.vendorEarned))}</p></div>
            <div class="kv-item"><p class="label">Paid</p><p class="value">${escapeReportHtml(rupees(payoutSummary.paid))}</p></div>
            <div class="kv-item"><p class="label">Due</p><p class="value">${escapeReportHtml(rupees(payoutSummary.due))}</p></div>
          </div>
          <div class="kv-grid">
            <div class="kv-item"><p class="label">Name</p><p class="value">${escapeReportHtml(getVendorDisplayName(vendor))}</p></div>
            <div class="kv-item"><p class="label">Phone</p><p class="value">${escapeReportHtml(getVendorContact(vendor))}</p></div>
            <div class="kv-item"><p class="label">Email</p><p class="value">${escapeReportHtml(vendor.email || "Not added")}</p></div>
            <div class="kv-item"><p class="label">Payout</p><p class="value">${escapeReportHtml(inferVendorPayoutMethod(vendor) === "GPAY" ? `GPay • ${getVendorGpayPhone(vendor) || "Not added"}` : (vendor.bank_name || "Bank transfer"))}</p></div>
            ${inferVendorPayoutMethod(vendor) === "BANK" ? `<div class="kv-item"><p class="label">Account</p><p class="value">${escapeReportHtml(vendor.bank_account_number || "Not added")}</p></div>` : ""}
          </div>
        </section>
        <section class="bookings-section">
          <h2>Activity Payout Ledger</h2>
          ${bookings.length ? `<table><thead><tr><th>Booking</th><th>Activity</th><th>Customer</th><th>Total</th><th>Platform</th><th>Vendor</th><th>Status</th></tr></thead><tbody>${bookingRows}</tbody></table>` : '<div class="empty">No activity bookings found for this vendor.</div>'}
        </section>
      `,
    });
  };

  if (error && !vendor && !loading) return (
    <div className="py-12 text-center">
      <div className="mb-4 inline-block rounded-xl bg-red-50 p-4 text-red-600">
        <Info className="mr-2 inline" /> {error || "Vendor not found"}
      </div>
      <button onClick={() => router.back()} className="mx-auto flex items-center justify-center gap-2 font-bold text-amber-600">
        <ArrowLeft className="h-4 w-4" /> Go Back
      </button>
    </div>
  );

  if (!vendor && !loading) return null;

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
                  getVendorDisplayName(vendor!)
                )}
              </h1>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50">
                {loading ? (
                  <span className={`inline-block h-3 w-36 animate-pulse rounded ${darkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                ) : (
                  <>
                    <span className={`h-2 w-2 rounded-full ${vendor!.active !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                    {vendor!.active !== false ? "Active Vendor" : "Inactive Vendor"} • {getVendorPayoutLabel(vendor!)}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            {(periodFilter || statusFilter) && <Button variant="secondary" onClick={() => router.push(`/admin/vendors/${vendorId}`)}>Clear Filter</Button>}
            <Button variant="secondary" onClick={exportVendorReport} disabled={loading || !vendor}><Download className="h-4 w-4" /> Export PDF</Button>
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
            Showing {effectiveStatusFilter ? toDisplayTitle(effectiveStatusFilter) : "filtered"} vendor payouts.
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
              <StatCard label="Platform Revenue" value={rupees(payoutSummary.platformRevenue)} icon={<CreditCard className="h-6 w-6 text-amber-500" />} darkMode={darkMode} />
              <StatCard label="Vendor Earned" value={rupees(payoutSummary.vendorEarned)} icon={<Banknote className="h-6 w-6 text-violet-500" />} darkMode={darkMode} />
              <StatCard label="Paid" value={rupees(payoutSummary.paid)} icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} darkMode={darkMode} />
              <StatCard label="Due" value={rupees(payoutSummary.due)} icon={<Calendar className="h-6 w-6 text-blue-500" />} darkMode={darkMode} />
            </>
          )}
        </div>

        {!loading && vendor && (
        <div className="grid gap-3 lg:grid-cols-2">
          <InfoCard
            darkMode={darkMode}
            title="Contact"
            rows={[
              ["Phone", getVendorContact(vendor)],
              ["Email", vendor.email || "Not added"],
              ["Vendor ID", getVendorPublicId(vendor)],
              ["Joined", formatDisplayDateValue(vendor.created_at)],
            ]}
          />
          <InfoCard
            darkMode={darkMode}
            title="Payout method"
            icon={inferVendorPayoutMethod(vendor) === "GPAY" ? <Smartphone className="h-5 w-5 text-emerald-600" /> : <Banknote className="h-5 w-5 text-emerald-600" />}
            rows={getVendorPayoutDetailRows(vendor!)}
          />
        </div>
        )}

        <AdminTablePanel title="Activity Payout Ledger">
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>Select</AdminTableHeaderCell>
                <AdminTableHeaderCell>Booking / Activity</AdminTableHeaderCell>
                <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
                <AdminTableHeaderCell>Total</AdminTableHeaderCell>
                <AdminTableHeaderCell>Platform Cut</AdminTableHeaderCell>
                <AdminTableHeaderCell>Vendor Payout</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {loading ? (
                <AdminTableSkeleton columns={7} />
              ) : visibleBookings.length === 0 ? (
                <AdminTableEmpty colSpan={7}>No activity bookings found for this vendor.</AdminTableEmpty>
              ) : visibleBookings.map((booking) => {
                const bookingId = getRecordId(booking);
                const rowStatus = getPayoutRowStatus(booking);
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
                    <AdminTableCell><span className="font-bold">{rupees(booking.total_amount || 0)}</span></AdminTableCell>
                    <AdminTableCell><span className="font-bold text-amber-600">{rupees(booking.platform_commission_amount || 0)}</span></AdminTableCell>
                    <AdminTableCell><span className="font-black text-emerald-600">{rupees(booking.vendor_payout_amount || 0)}</span></AdminTableCell>
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

      {showSettleAllConfirm && vendor && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Settle all due vendor payouts</h2>
                <p className="admin-modal-subtitle">
                  This will mark every vendor payout currently due for {getVendorDisplayName(vendor)} as paid.
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
                  <span className="font-bold opacity-60">Vendor</span>
                  <span className="min-w-0 break-words text-right font-black">{getVendorDisplayName(vendor)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout via</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {inferVendorPayoutMethod(vendor) === "GPAY"
                      ? `GPay • ${getVendorGpayPhone(vendor) || "Not added"}`
                      : vendor.bank_name || "Bank transfer"}
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
              <Button type="button" onClick={settleAllDueForVendor} disabled={settlingAllDue}>
                <CheckCircle2 className="h-4 w-4" />
                {settlingAllDue ? "Processing..." : "Confirm settle all due"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPayConfirm && vendor && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Confirm vendor payout</h2>
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
                  <span className="font-bold opacity-60">Vendor</span>
                  <span className="min-w-0 break-words text-right font-black">{getVendorDisplayName(vendor)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout via</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {inferVendorPayoutMethod(vendor) === "GPAY"
                      ? `GPay • ${getVendorGpayPhone(vendor) || "Not added"}`
                      : vendor.bank_name || "Bank transfer"}
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
