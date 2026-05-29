"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Eye, WalletCards, X } from "lucide-react";
import { db, type Agent, type Booking } from "@/lib/database";
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
  collectDueCommissionBookings,
  findAgentByReference,
  getAgentAlertMethod,
  getAgentDisplayName,
  getDueCommissionPeriodKeys,
  normalizePayoutFrequency,
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
};

const rupees = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export default function CommissionsPage() {
  const darkMode = useDarkMode();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(String(searchParams.get("status") || "ALL").toUpperCase());
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");

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
      setBookings((bookingResult.data || []).filter((booking: Booking) => Number(booking.commission_amount || 0) > 0));
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

    return Array.from(grouped.entries()).map(([key, rows]) => {
      const first = rows[0];
      const agentId = String(first.agent_id || "");
      const agent = findAgentByReference(agentById, agentId);
      const routeAgentId = agent ? getRecordId(agent) : agentId;
      const periodKey = String(first.commission_period_key || "unassigned");
      const paid = rows.every((booking) => booking.commission_status === "PAID");
      const dueKeys = getDueCommissionPeriodKeys(agent?.payout_frequency || "DAILY");
      const status: CommissionStatus = paid ? "PAID" : dueKeys.includes(periodKey) ? "DUE" : "PENDING";
      const times = rows.map((booking) => String(booking.booking_time || "")).sort();
      return {
        key,
        agent,
        agentId: routeAgentId,
        periodKey,
        status,
        amount: rows.reduce((sum, booking) => sum + Number(booking.commission_amount || 0), 0),
        bookingCount: rows.length,
        firstBookingAt: times[0] || "",
        lastBookingAt: times[times.length - 1] || "",
        notificationMethod: getAgentAlertMethod(agent),
      };
    }).sort((left, right) => {
      const statusRank = { DUE: 0, PENDING: 1, PAID: 2 };
      return statusRank[left.status] - statusRank[right.status] || right.lastBookingAt.localeCompare(left.lastBookingAt);
    });
  }, [agentById, bookings]);

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
    () => collectDueCommissionBookings(agents, bookings),
    [agents, bookings]
  );

  const totals = useMemo(() => ({
    due: dueCommission.summary.totalAmount,
    pending: groups.filter((group) => group.status === "PENDING").reduce((sum, group) => sum + group.amount, 0),
    paid: groups.filter((group) => group.status === "PAID").reduce((sum, group) => sum + group.amount, 0),
  }), [dueCommission.summary.totalAmount, groups]);

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

      const paidIds = new Set((payload.data?.bookingIds || []).map(String));
      const paidAt = payload.data?.paidAt || new Date().toISOString();
      const paidByUser = payload.data?.paidBy || paidBy;

      setBookings((current) =>
        current.map((booking) =>
          paidIds.has(getRecordId(booking))
            ? {
                ...booking,
                commission_status: "PAID",
                commission_paid_at: paidAt,
                commission_paid_by: paidByUser,
                updated_at: paidAt,
              }
            : booking
        )
      );
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
            Track due, pending, and paid agent commission payouts.
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
                  <Link href={`/admin/agents/${group.agentId}?periodKey=${encodeURIComponent(group.periodKey)}&status=${group.status === "PAID" ? "PAID" : "UNPAID"}`}>
                    <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /> View</Button>
                  </Link>
                </AdminTableCell>
              </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

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
