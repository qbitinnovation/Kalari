"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Eye, WalletCards, X } from "lucide-react";
import { db, type Agent, type Booking, type Show } from "@/lib/database";
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
import {
  buildAgentLookupMap,
  buildCommissionGroups,
  collectDueCommissionBookings,
  findAgentByReference,
  getAgentAlertMethod,
  getAgentDisplayName,
  getAgentPayoutLabel,
  isShowBooking,
  normalizePayoutFrequency,
  summarizeCommissionTotals,
} from "@/lib/agentCommission";
import { getRecordId } from "@/lib/booking";
import { toDisplayTitle } from "@/lib/textFormat";

type CommissionStatus = "DUE" | "PENDING" | "PAID";

type CommissionGroup = {
  key: string;
  agent: Agent | null;
  agentId: string;
  periodKey: string;
  status: CommissionStatus;
  amount: number;
  bookingCount: number;
  firstBookingAt: string;
  lastBookingAt: string;
  notificationMethod: string;
  bookingIds: string[];
};

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export default function CommissionsPage() {
  const darkMode = useDarkMode();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(String(searchParams.get("status") || "ALL").toUpperCase());
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");
  const [settleGroupTarget, setSettleGroupTarget] = useState<CommissionGroup | null>(null);
  const [settlingGroup, setSettlingGroup] = useState(false);
  const [groupSettleError, setGroupSettleError] = useState("");

  const agentFilter = String(searchParams.get("agentId") || "");
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
      await fetch("/api/agents/backfill", { method: "POST" }).catch(() => null);
      const [agentResult, bookingResult, legacyResult] = await Promise.all([
        db.from("agents").select("*").order("name", { ascending: true }),
        db.from("bookings").select("*").order("booking_time", { ascending: false }),
        db.from("users").select("*").eq("role", "agent").order("full_name", { ascending: true }),
      ]);
      if (agentResult.error) throw agentResult.error;
      if (bookingResult.error) throw bookingResult.error;
      const legacyAgents = (legacyResult.data || []).map((user: any) => ({
        ...user,
        name: user.full_name,
        phone: user.phone || user.email,
        payout_frequency: "MONTHLY",
      }));
      const existingIds = new Set((agentResult.data || []).map(getRecordId));
      setAgents([
        ...(agentResult.data || []),
        ...legacyAgents.filter((agent: any) => !existingIds.has(getRecordId(agent))),
      ]);
      const commissionBookings = (bookingResult.data || []).filter(
        (booking: Booking) =>
          isShowBooking(booking) && Number(booking.commission_amount || 0) > 0,
      );
      setBookings(commissionBookings);
      const showIds = Array.from(
        new Set(commissionBookings.map((booking) => String(booking.show_id || "")).filter(Boolean)),
      );
      if (showIds.length) {
        const { data: showData, error: showError } = await db.from("shows").select("*").in("id", showIds);
        if (showError) throw showError;
        setShows(showData || []);
      } else {
        setShows([]);
      }
    } catch (error: any) {
      setError(error.message || "Could not load commissions.");
    } finally {
      setLoading(false);
    }
  };

  const agentById = useMemo(() => buildAgentLookupMap(agents), [agents]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    bookings.forEach((booking) => {
      const agentId = String(booking.agent_id || "");
      const periodKey = String(booking.commission_period_key || "unassigned");
      if (!agentId) return;
      const key = `${agentId}:${periodKey}:${booking.commission_status === "PAID" ? "PAID" : "UNPAID"}`;
      grouped.set(key, [...(grouped.get(key) || []), booking]);
    });

    return buildCommissionGroups(agents, bookings, new Date(), shows)
      .map((group) => {
        const rows = grouped.get(group.key) || [];
        const agent = findAgentByReference(agentById, group.agentId);
        const times = rows.map((booking) => String(booking.booking_time || "")).sort();
        return {
          key: group.key,
          agent,
          agentId: group.agentId,
          periodKey: group.periodKey,
          status: group.status as CommissionStatus,
          amount: group.amount,
          bookingCount: group.bookingCount,
          firstBookingAt: times[0] || "",
          lastBookingAt: times[times.length - 1] || "",
          notificationMethod: getAgentAlertMethod(agent),
          bookingIds: rows.map((booking) => getRecordId(booking)).filter(Boolean),
        };
      })
      .sort((left, right) => {
        const statusRank = { DUE: 0, PENDING: 1, PAID: 2 };
        return statusRank[left.status] - statusRank[right.status] || right.lastBookingAt.localeCompare(left.lastBookingAt);
      });
  }, [agentById, agents, bookings, shows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((group) => {
      if (status !== "ALL" && group.status !== status) return false;
      if (agentFilter && group.agentId !== agentFilter) return false;
      if (periodKeyFilter && group.periodKey !== periodKeyFilter) return false;
      if (periodKeysFilter.length && !periodKeysFilter.includes(group.periodKey)) return false;
      const haystack = `${getAgentDisplayName(group.agent)} ${group.periodKey} ${group.status}`.toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [agentFilter, groups, periodKeyFilter, periodKeysFilter, query, status]);

  const dueCommission = useMemo(
    () => collectDueCommissionBookings(agents, bookings, new Date(), shows),
    [agents, bookings, shows]
  );

  const totals = useMemo(
    () => summarizeCommissionTotals(agents, bookings, new Date(), shows),
    [agents, bookings, shows]
  );

  const applyPaidBookingIds = (paidIds: Set<string>, paidAt: string, paidBy: string) => {
    setBookings((current) =>
      current.map((booking) =>
        paidIds.has(getRecordId(booking))
          ? {
              ...booking,
              commission_status: "PAID",
              commission_paid_at: paidAt,
              commission_paid_by: paidBy,
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
      const response = await fetch("/api/commissions/settle-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: settleGroupTarget.agentId,
          paidBy,
          periodKey: settleGroupTarget.periodKey !== "unassigned" ? settleGroupTarget.periodKey : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle this commission group.");
      }

      const paidIds = new Set<string>((payload.data?.bookingIds || settleGroupTarget.bookingIds).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;
      applyPaidBookingIds(paidIds, paidAt, paidByUser);
      setSettleGroupTarget(null);
    } catch (error: any) {
      setGroupSettleError(error.message || "Could not settle this commission group.");
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
      const response = await fetch("/api/commissions/settle-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidBy }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not settle due commissions.");
      }

      const paidIds = new Set<string>((payload.data?.bookingIds || []).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;

      applyPaidBookingIds(paidIds, paidAt, paidByUser);
      setShowSettleConfirm(false);
    } catch (error: any) {
      setSettleError(error.message || "Could not settle due commissions.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Commissions</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Track due, pending, and paid show agent commission payouts.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          {totals.due > 0 && (
            <Button onClick={() => { setSettleError(""); setShowSettleConfirm(true); }} disabled={settling || loading}>
              <CheckCircle2 className="h-4 w-4" />
              Settle All Due ({rupees(totals.due)})
            </Button>
          )}
          <SearchInput value={query} onChange={setQuery} placeholder="Search agent or period..." containerClassName="sm:w-80" />
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

      {(agentFilter || periodKeyFilter || periodKeysFilter.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Showing commission due from the selected notification.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Due Now" value={rupees(totals.due)} icon={<Clock className="h-5 w-5 text-amber-600" />} />
        <StatCard label="Pending" value={rupees(totals.pending)} icon={<WalletCards className="h-5 w-5 text-blue-600" />} />
        <StatCard label="Paid" value={rupees(totals.paid)} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
      </div>

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Agent</AdminTableHeaderCell>
              <AdminTableHeaderCell>Period</AdminTableHeaderCell>
              <AdminTableHeaderCell>Amount</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Notify By</AdminTableHeaderCell>
              <AdminTableHeaderCell>Bookings</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right">Action</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={7} leadColumn="avatar" />
            ) : filtered.length === 0 ? (
              <AdminTableEmpty colSpan={7}>No commission records found.</AdminTableEmpty>
            ) : (
              filtered.map((group) => (
              <AdminTableRow key={group.key}>
                <AdminTableCell>
                  <div className="font-black">{toDisplayTitle(getAgentDisplayName(group.agent))}</div>
                  <div className="mt-1 text-xs font-semibold opacity-50">{normalizePayoutFrequency(group.agent?.payout_frequency)} payout</div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="font-black">{group.periodKey}</div>
                  <div className="mt-1 text-xs font-semibold opacity-50">
                    {group.firstBookingAt ? formatDisplayDateValue(group.firstBookingAt) : "Date not set"}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span className="font-black text-emerald-700">{rupees(group.amount)}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <StatusPill status={group.status} />
                </AdminTableCell>
                <AdminTableCell>{group.notificationMethod === "EMAIL" ? "Email" : "Text message"}</AdminTableCell>
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
                    <Link href={`/admin/agents/${group.agentId}?periodKey=${encodeURIComponent(group.periodKey)}&status=${group.status === "PAID" ? "PAID" : "UNPAID"}`}>
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
                <h2 className="admin-modal-title">Settle due commission</h2>
                <p className="admin-modal-subtitle">
                  Mark all due bookings for this agent and period as paid.
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
                  <span className="font-bold opacity-60">Agent</span>
                  <span className="min-w-0 break-words text-right font-black">{toDisplayTitle(getAgentDisplayName(settleGroupTarget.agent))}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Period</span>
                  <span className="font-black">{settleGroupTarget.periodKey}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Payout</span>
                  <span className="min-w-0 break-words text-right font-black">{settleGroupTarget.agent ? getAgentPayoutLabel(settleGroupTarget.agent) : "—"}</span>
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
                <h2 className="admin-modal-title">Settle all due commissions</h2>
                <p className="admin-modal-subtitle">
                  This will mark every commission due now as paid. Pending future commissions will not be affected.
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
                  <span className="font-black text-emerald-600">{rupees(dueCommission.summary.totalAmount)}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Agents</span>
                  <span className="font-black">{dueCommission.summary.agentCount}</span>
                </div>
                <div className="mt-3 flex justify-between gap-4 text-sm">
                  <span className="font-bold opacity-60">Bookings</span>
                  <span className="font-black">{dueCommission.summary.bookingCount}</span>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Payout</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueCommission.summary.byAgent.map((row) => (
                      <tr key={row.agentId} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3 font-bold">{toDisplayTitle(row.agentName)}</td>
                        <td className="px-4 py-3 text-xs font-semibold opacity-70">{row.periodKeys.join(", ")}</td>
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

const StatusPill = ({ status }: { status: CommissionStatus }) => {
  const classes = status === "DUE"
    ? "bg-amber-100 text-amber-800"
    : status === "PAID"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-blue-100 text-blue-800";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${classes}`}>{status}</span>;
};
