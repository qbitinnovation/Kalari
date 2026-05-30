"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Eye, X } from "lucide-react";
import { db, type Activity, type Booking, type Vendor } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTablePanel,
  AdminTableRow,
  AdminTableSkeleton,
  Button,
  SearchInput,
  Select,
} from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { getRecordId } from "@/lib/booking";
import { toDisplayTitle } from "@/lib/textFormat";
import {
  buildVendorLookupMap,
  buildVendorPayoutGroups,
  collectDueVendorPayoutBookings,
  findVendorByReference,
  getVendorDisplayName,
  getVendorPayoutLabel,
  isActivityBooking,
  summarizeVendorPayoutTotals,
  type VendorPayoutGroupSummary,
} from "@/lib/vendorPayout";

type VendorPayoutStatus = "DUE" | "PENDING" | "PAID";

type VendorPayoutGroup = VendorPayoutGroupSummary & {
  vendor: Vendor | null;
  firstBookingAt: string;
  lastBookingAt: string;
  bookingIds: string[];
};

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export default function VendorPayoutsPage() {
  const darkMode = useDarkMode();
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(String(searchParams.get("status") || "ALL").toUpperCase());
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");
  const [settleGroupTarget, setSettleGroupTarget] = useState<VendorPayoutGroup | null>(null);
  const [settlingGroup, setSettlingGroup] = useState(false);
  const [groupSettleError, setGroupSettleError] = useState("");

  const vendorFilter = String(searchParams.get("vendorId") || "");
  const periodKeyFilter = String(searchParams.get("periodKey") || "");
  const periodKeysFilter = String(searchParams.get("periodKeys") || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const nextStatus = String(searchParams.get("status") || "ALL").toUpperCase();
    setStatus(nextStatus);
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [vendorResult, bookingResult] = await Promise.all([
        db.from("vendors").select("*").order("name", { ascending: true }),
        db.from("bookings").select("*").order("booking_time", { ascending: false }),
      ]);
      if (vendorResult.error) throw vendorResult.error;
      if (bookingResult.error) throw bookingResult.error;
      setVendors(vendorResult.data || []);
      const payoutBookings = (bookingResult.data || []).filter(
        (booking: Booking) =>
          isActivityBooking(booking) && Number(booking.vendor_payout_amount || 0) > 0,
      );
      setBookings(payoutBookings);
      const activityIds = Array.from(
        new Set(payoutBookings.map((booking) => String(booking.activity_id || "")).filter(Boolean)),
      );
      if (activityIds.length) {
        const { data: activityData, error: activityError } = await db
          .from("activities")
          .select("*")
          .in("id", activityIds);
        if (activityError) throw activityError;
        setActivities(activityData || []);
      } else {
        setActivities([]);
      }
    } catch (error: any) {
      setError(error.message || "Could not load vendor payouts.");
    } finally {
      setLoading(false);
    }
  };

  const vendorById = useMemo(() => buildVendorLookupMap(vendors), [vendors]);

  const groups = useMemo(() => {
    const groupedBookings = new Map<string, Booking[]>();
    bookings.forEach((booking) => {
      const vendorId = String(booking.vendor_id || "");
      if (!vendorId) return;
      const key = `${vendorId}:${booking.vendor_payout_status === "PAID" ? "PAID" : "UNPAID"}`;
      groupedBookings.set(key, [...(groupedBookings.get(key) || []), booking]);
    });

    return buildVendorPayoutGroups(vendors, bookings, new Date(), activities)
      .map((group) => {
        const rows = groupedBookings.get(group.key) || [];
        const first = rows[0];
        const vendor = findVendorByReference(vendorById, String(first?.vendor_id || group.vendorId));
        const times = rows.map((booking) => String(booking.booking_time || "")).sort();
        return {
          ...group,
          vendor,
          firstBookingAt: times[0] || "",
          lastBookingAt: times[times.length - 1] || "",
          bookingIds: rows.map((booking) => getRecordId(booking)).filter(Boolean),
        };
      })
      .sort((left, right) => {
        const statusRank: Record<VendorPayoutStatus, number> = { DUE: 0, PENDING: 1, PAID: 2 };
        return (
          statusRank[left.status] - statusRank[right.status] ||
          right.lastBookingAt.localeCompare(left.lastBookingAt)
        );
      });
  }, [activities, bookings, vendorById, vendors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((group) => {
      if (status !== "ALL" && group.status !== status) return false;
      if (vendorFilter && group.vendorId !== vendorFilter) return false;
      if (periodKeyFilter || periodKeysFilter.length) {
        const rows = bookings.filter((b) => String(b.vendor_id) === group.vendorId);
        if (periodKeyFilter && !rows.some((b) => String(b.vendor_payout_period_key || "") === periodKeyFilter)) {
          return false;
        }
        if (periodKeysFilter.length && !rows.some((b) => periodKeysFilter.includes(String(b.vendor_payout_period_key || "")))) {
          return false;
        }
      }
      const haystack = `${getVendorDisplayName(group.vendor)} ${group.status}`.toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [groups, periodKeyFilter, periodKeysFilter, query, status, vendorFilter]);

  const duePayouts = useMemo(
    () => collectDueVendorPayoutBookings(vendors, bookings, new Date(), activities),
    [activities, bookings, vendors],
  );

  const totals = useMemo(
    () => summarizeVendorPayoutTotals(vendors, bookings, new Date(), activities),
    [activities, bookings, vendors],
  );

  const applyPaidBookingIds = (paidIds: Set<string>, paidAt: string, paidBy: string) => {
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
  };

  const settleGroupDue = async () => {
    if (!settleGroupTarget) return;
    setSettlingGroup(true);
    setGroupSettleError("");
    try {
      const { data: auth } = await db.auth.getUser();
      const paidBy = auth.user?.id || auth.user?.email || "admin";
      const response = await fetch("/api/vendor-payouts/settle-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: settleGroupTarget.vendorId,
          paidBy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle this vendor payout group.");
      }

      const paidIds = new Set<string>((payload.data?.bookingIds || settleGroupTarget.bookingIds).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;
      applyPaidBookingIds(paidIds, paidAt, paidByUser);
      setSettleGroupTarget(null);
    } catch (error: any) {
      setGroupSettleError(error.message || "Could not settle this vendor payout group.");
    } finally {
      setSettlingGroup(false);
    }
  };

  const settleAllDue = async () => {
    setSettling(true);
    setSettleError("");
    try {
      const { data: auth } = await db.auth.getUser();
      const paidBy = auth.user?.id || auth.user?.email || "admin";
      const response = await fetch("/api/vendor-payouts/settle-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidBy }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle due vendor payouts.");
      }

      const paidIds = new Set<string>((payload.data?.bookingIds || []).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;

      applyPaidBookingIds(paidIds, paidAt, paidByUser);
      setShowSettleConfirm(false);
    } catch (error: any) {
      setSettleError(error.message || "Could not settle due vendor payouts.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Vendor Payouts</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Settle activity vendor shares whenever you are ready — unpaid amounts show as due.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          {totals.due > 0 && (
            <Button onClick={() => { setSettleError(""); setShowSettleConfirm(true); }} disabled={settling || loading}>
              <CheckCircle2 className="h-4 w-4" />
              Settle All Due ({rupees(totals.due)})
            </Button>
          )}
          <SearchInput value={query} onChange={setQuery} placeholder="Search vendor..." containerClassName="sm:w-80" />
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All Status" },
              { value: "DUE", label: "Due" },
              { value: "PENDING", label: "Pending" },
              { value: "PAID", label: "Paid" },
            ]}
            searchable={false}
            className="sm:w-44"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}

      {vendorFilter && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Showing payouts for the selected vendor.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Due Now" value={rupees(totals.due)} icon={<Clock className="h-5 w-5 text-amber-600" />} />
        <StatCard label="Pending" value={rupees(totals.pending)} icon={<Clock className="h-5 w-5 text-blue-600" />} />
        <StatCard label="Paid" value={rupees(totals.paid)} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
      </div>

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
              <AdminTableHeaderCell>Last booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Amount</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Bookings</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right">Action</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={6} leadColumn="avatar" />
            ) : filtered.length === 0 ? (
              <AdminTableEmpty colSpan={6}>No vendor payout records found.</AdminTableEmpty>
            ) : (
              filtered.map((group) => (
                <AdminTableRow key={group.key}>
                  <AdminTableCell>
                    <div className="font-black">{toDisplayTitle(getVendorDisplayName(group.vendor))}</div>
                    <div className="mt-1 text-xs font-semibold opacity-50">
                      {group.vendor ? getVendorPayoutLabel(group.vendor) : "—"}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="font-black">
                      {group.lastBookingAt ? formatDisplayDateValue(group.lastBookingAt) : "—"}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="font-black text-emerald-700">{rupees(group.amount)}</span>
                  </AdminTableCell>
                  <AdminTableCell>
                    <StatusPill status={group.status} />
                  </AdminTableCell>
                  <AdminTableCell>{group.bookingCount}</AdminTableCell>
                  <AdminTableCell align="right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {group.status === "DUE" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setGroupSettleError("");
                            setSettleGroupTarget(group);
                          }}
                          disabled={settlingGroup || settling}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Settle
                        </Button>
                      )}
                      <Link
                        href={`/admin/vendors/${group.vendorId}?status=${group.status === "PAID" ? "PAID" : "UNPAID"}`}
                      >
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /> View</Button>
                      </Link>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

      {settleGroupTarget && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card max-w-xl">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Settle due vendor payout</h2>
                <p className="admin-modal-subtitle">
                  Mark all unpaid activity bookings for this vendor as paid.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleGroupTarget(null)}
                className="admin-modal-close"
                aria-label="Close modal"
                disabled={settlingGroup}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-4">
              {groupSettleError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {groupSettleError}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Vendor</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {toDisplayTitle(getVendorDisplayName(settleGroupTarget.vendor))}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout</span>
                  <span className="min-w-0 break-words text-right font-black">
                    {settleGroupTarget.vendor ? getVendorPayoutLabel(settleGroupTarget.vendor) : "—"}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Bookings</span>
                  <span className="font-black">{settleGroupTarget.bookingCount}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Amount</span>
                  <span className="font-black text-emerald-600">{rupees(settleGroupTarget.amount)}</span>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setSettleGroupTarget(null)} disabled={settlingGroup}>
                Cancel
              </Button>
              <Button type="button" onClick={settleGroupDue} disabled={settlingGroup}>
                <CheckCircle2 className="h-4 w-4" />
                {settlingGroup ? "Settling..." : "Confirm settle"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSettleConfirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-panel admin-modal-card max-w-2xl">
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">Settle all due vendor payouts</h2>
                <p className="admin-modal-subtitle">
                  This will mark every vendor payout that is due now as paid.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleConfirm(false)}
                className="admin-modal-close"
                aria-label="Close modal"
                disabled={settling}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-4">
              {settleError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {settleError}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Total due</span>
                  <span className="font-black text-emerald-600">{rupees(duePayouts.summary.totalAmount)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Vendors</span>
                  <span className="font-black">{duePayouts.summary.vendorCount}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Bookings</span>
                  <span className="font-black">{duePayouts.summary.bookingCount}</span>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Payout</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duePayouts.summary.byVendor.map((row) => (
                      <tr key={row.vendorId} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3 font-bold">{toDisplayTitle(row.vendorName)}</td>
                        <td className="px-4 py-3 text-xs font-semibold opacity-70">{row.payoutLabel}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">{rupees(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowSettleConfirm(false)} disabled={settling}>
                Cancel
              </Button>
              <Button type="button" onClick={settleAllDue} disabled={settling}>
                <CheckCircle2 className="h-4 w-4" />
                {settling ? "Settling..." : "Confirm settle all"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">{icon}{label}</div>
    <div className="text-2xl font-black text-slate-950 dark:text-slate-100">{value}</div>
  </div>
);

const StatusPill = ({ status }: { status: VendorPayoutStatus }) => {
  const classes =
    status === "DUE" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${classes}`}>{status}</span>;
};
