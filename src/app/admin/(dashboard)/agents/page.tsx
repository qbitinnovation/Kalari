"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Eye, MessageSquare, Pencil, Plus, Smartphone, Trash2, X } from "lucide-react";
import { db, type Agent } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeaderCell, AdminTablePanel, AdminTableRow, AdminTableSkeleton, Button, IndianPhoneField, Input, SearchInput, Select } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import {
  formatIndianMobileDisplay,
  formatIndianMobileForStorage,
  getIndianMobileDigits,
  INDIAN_MOBILE_ERROR,
  isValidIndianMobileDigits,
} from "@/lib/indianPhone";
import {
  getAgentContact,
  getAgentDisplayName,
  getAgentAlertMethod,
  getAgentPayoutLabel,
  agentUsesContactGpayPhone,
  inferAgentPayoutMethod,
  normalizeAgentNotificationMethod,
  normalizePayoutFrequency,
  normalizePayoutMethod,
  type AgentNotificationMethod,
  type PayoutFrequency,
  type PayoutMethod,
} from "@/lib/agentCommission";
import { getAgentPublicId } from "@/lib/agentId";
import { toDisplayInitial, toDisplayTitle } from "@/lib/textFormat";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  alert_method: "SMS" as AgentNotificationMethod,
  payout_frequency: "MONTHLY" as PayoutFrequency,
  payout_method: "GPAY" as PayoutMethod,
  gpay_use_contact_phone: true,
  gpay_phone: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
  active: true,
};

const recordId = (row: any) => String(row?.id || row?._id || "");

const isBankPayoutComplete = (form: typeof emptyForm) =>
  Boolean(
    form.bank_account_name.trim() &&
      form.bank_account_number.trim() &&
      form.bank_ifsc.trim() &&
      form.bank_name.trim()
  );

const getBankPayoutFieldErrors = (form: typeof emptyForm, showErrors: boolean) => {
  if (!showErrors || form.payout_method !== "BANK") {
    return {
      bank_account_name: "",
      bank_account_number: "",
      bank_ifsc: "",
      bank_name: "",
    };
  }
  return {
    bank_account_name: !form.bank_account_name.trim() ? "Account name is required." : "",
    bank_account_number: !form.bank_account_number.trim() ? "Account number is required." : "",
    bank_ifsc: !form.bank_ifsc.trim() ? "IFSC is required." : "",
    bank_name: !form.bank_name.trim() ? "Bank name is required." : "",
  };
};

const getGpayPayoutError = (form: typeof emptyForm, showErrors: boolean) => {
  if (!showErrors || form.payout_method !== "GPAY") return "";
  if (form.gpay_use_contact_phone) {
    if (!form.phone.trim()) return "Enter a contact number above to use for GPay payout.";
    if (!isValidIndianMobileDigits(form.phone)) return INDIAN_MOBILE_ERROR;
    return "";
  }
  if (!form.gpay_phone.trim()) return "Enter the GPay mobile number.";
  if (!isValidIndianMobileDigits(form.gpay_phone)) return INDIAN_MOBILE_ERROR;
  return "";
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const notificationContactHint = (method: AgentNotificationMethod, phone: string, email: string) => {
  if (method === "SMS") {
    const contact = formatIndianMobileDisplay(phone);
    return contact
      ? `Agent alerts will be sent by text to ${contact}.`
      : "Agent alerts will be sent by text to the contact number above.";
  }
  const address = email.trim();
  return address
    ? `Agent alerts will be sent by email to ${address}.`
    : "Agent alerts will be sent by email to the email address above.";
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [error, setError] = useState("");
  const darkMode = useDarkMode();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/agents/backfill", { method: "POST" }).catch(() => null);
      const { data, error } = await db.from("agents").select("*").order("name", { ascending: true });
      if (error) throw error;
      const legacy = await db.from("users").select("*").eq("role", "agent").order("full_name", { ascending: true });
      const legacyAgents = (legacy.data || []).map((user: any) => ({
        ...user,
        name: user.full_name,
        phone: user.phone || user.email,
        payout_frequency: "MONTHLY",
      }));
      const existingIds = new Set((data || []).map(recordId));
      setAgents([...(data || []), ...legacyAgents.filter((agent: any) => !existingIds.has(recordId(agent)))]);
    } catch (error: any) {
      setError(error.message || "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingAgent(null);
    setFormData(emptyForm);
    setPayoutSubmitted(false);
    setShowForm(true);
  };

  const openEdit = (agent: Agent) => {
    const payoutMethod = inferAgentPayoutMethod(agent);
    const usesContactGpay = agentUsesContactGpayPhone(agent);
    setEditingAgent(agent);
    setPayoutSubmitted(false);
    setFormData({
      name: getAgentDisplayName(agent),
      phone: getIndianMobileDigits(getAgentContact(agent)),
      email: agent.email || "",
      alert_method: getAgentAlertMethod(agent),
      payout_frequency: normalizePayoutFrequency(agent.payout_frequency),
      payout_method: payoutMethod,
      gpay_use_contact_phone: usesContactGpay,
      gpay_phone: usesContactGpay ? "" : getIndianMobileDigits(agent.gpay_phone || ""),
      bank_account_name: agent.bank_account_name || "",
      bank_account_number: agent.bank_account_number || "",
      bank_ifsc: agent.bank_ifsc || "",
      bank_name: agent.bank_name || "",
      active: agent.active !== false,
    });
    setShowForm(true);
  };

  const saveAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    setPayoutSubmitted(true);
    setFormLoading(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const alertMethod = normalizeAgentNotificationMethod(formData.alert_method);
      const payoutMethod = normalizePayoutMethod(formData.payout_method);
      const { alert_method: _alertMethod, active: _active, gpay_use_contact_phone, ...formRest } = formData;
      const payload = {
        ...formRest,
        name: formData.name.trim(),
        phone: formatIndianMobileForStorage(formData.phone),
        email: formData.email.trim().toLowerCase(),
        commission_notification_method: alertMethod,
        remaining_amount_notification_method: alertMethod,
        payout_method: payoutMethod,
        gpay_phone:
          payoutMethod === "GPAY" && !gpay_use_contact_phone
            ? formatIndianMobileForStorage(formData.gpay_phone)
            : "",
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_ifsc: formData.bank_ifsc.trim(),
        bank_name: formData.bank_name.trim(),
        payout_frequency: normalizePayoutFrequency(formData.payout_frequency),
        updated_at: now,
      };

      if (!payload.name || !formData.phone.trim()) throw new Error("Agent name and contact number are required.");
      if (!isValidIndianMobileDigits(formData.phone)) throw new Error(INDIAN_MOBILE_ERROR);
      if (alertMethod === "EMAIL" && !payload.email) throw new Error("Email is required when agent alerts are set to email.");
      if (payload.email && !isValidEmail(payload.email)) throw new Error("Enter a valid email address.");
      if (payoutMethod === "GPAY") {
        const gpayError = getGpayPayoutError(formData, true);
        if (gpayError) throw new Error(gpayError);
      } else if (!isBankPayoutComplete(formData)) {
        throw new Error("Fill in all bank details for bank transfer payout.");
      }

      if (editingAgent) {
        const { error } = await db.from("agents").update(payload).eq("id", recordId(editingAgent));
        if (error) throw error;
      } else {
        const { error } = await db.from("agents").insert([{ ...payload, active: true, created_at: now }]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingAgent(null);
      setFormData(emptyForm);
      setPayoutSubmitted(false);
      await fetchAgents();
    } catch (error: any) {
      setError(error.message || "Could not save agent.");
    } finally {
      setFormLoading(false);
    }
  };

  const toggleAgent = async (agent: Agent) => {
    const { error } = await db.from("agents").update({ active: agent.active === false, updated_at: new Date().toISOString() }).eq("id", recordId(agent));
    if (error) setError(error.message || "Could not update agent status.");
    await fetchAgents();
  };

  const deleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Delete ${getAgentDisplayName(agent)}? Existing booking commission history will remain.`)) return;
    const { error } = await db.from("agents").delete().eq("id", recordId(agent));
    if (error) setError(error.message || "Could not delete agent.");
    await fetchAgents();
  };

  const filteredAgents = agents.filter((agent) =>
    `${getAgentDisplayName(agent)} ${getAgentContact(agent)} ${agent.email || ""} ${getAgentPayoutLabel(agent)}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const phoneError = formData.phone.trim() && !isValidIndianMobileDigits(formData.phone) ? INDIAN_MOBILE_ERROR : "";
  const gpayPayoutError = getGpayPayoutError(formData, payoutSubmitted);
  const gpayPhoneError =
    formData.payout_method === "GPAY" && !formData.gpay_use_contact_phone ? gpayPayoutError : "";
  const gpayContactPayoutError =
    formData.payout_method === "GPAY" && formData.gpay_use_contact_phone ? gpayPayoutError : "";
  const bankFieldErrors = getBankPayoutFieldErrors(formData, payoutSubmitted);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents Management</h1>
          <p className="text-sm opacity-60">Manage offline agents, payout details, and payout cycles</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Filter agents by name, phone, or payout..." containerClassName="w-full sm:w-80" />
          <Button onClick={openCreate}><Plus className="h-5 w-5" /> Add Agent</Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal-panel admin-modal-card max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">{editingAgent ? "Edit Agent" : "Create Agent"}</h2>
                <p className="admin-modal-subtitle">Add offline agent contact, notification preference, payout method, and payout cycle.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="admin-modal-close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveAgent} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="admin-modal-body grid gap-4 md:grid-cols-2">
                <Input label="Agent Name" value={formData.name} onChange={(name) => setFormData({ ...formData, name })} placeholder="Enter agent name" required />
                <IndianPhoneField
                  label="Contact Number"
                  value={formData.phone}
                  onChange={(phone) => setFormData({ ...formData, phone })}
                  error={phoneError}
                  required
                />
                <Input
                  label="Email"
                  value={formData.email}
                  onChange={(email) => setFormData({ ...formData, email })}
                  placeholder="agent@example.com"
                  inputMode="email"
                  required={formData.alert_method === "EMAIL"}
                />
                <Select
                  label="Payout Frequency"
                  value={formData.payout_frequency}
                  onChange={(payout_frequency) => setFormData({ ...formData, payout_frequency: normalizePayoutFrequency(payout_frequency) })}
                  options={[
                    { value: "DAILY", label: "Daily" },
                    { value: "WEEKLY", label: "Weekly" },
                    { value: "MONTHLY", label: "Monthly" },
                  ]}
                />
                <Select
                  label="Agent Alerts Via"
                  value={formData.alert_method}
                  onChange={(alert_method) =>
                    setFormData({ ...formData, alert_method: normalizeAgentNotificationMethod(alert_method) })
                  }
                  hint={notificationContactHint(formData.alert_method, formData.phone, formData.email)}
                  className="md:col-span-2"
                  options={[
                    { value: "SMS", label: "Text message" },
                    { value: "EMAIL", label: "Email" },
                  ]}
                />
                <div className="md:col-span-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-4">
                    <div className="mb-2 text-sm font-black">Payout Method <span className="text-amber-600">*</span></div>
                    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutSubmitted(false);
                          setFormData({ ...formData, payout_method: "GPAY" });
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${
                          formData.payout_method === "GPAY"
                            ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        <Smartphone className="h-4 w-4" />
                        Google Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutSubmitted(false);
                          setFormData({ ...formData, payout_method: "BANK" });
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${
                          formData.payout_method === "BANK"
                            ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        <Banknote className="h-4 w-4" />
                        Bank Transfer
                      </button>
                    </div>
                  </div>

                  {formData.payout_method === "GPAY" ? (
                    <div className="space-y-4">
                      {gpayContactPayoutError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                          {gpayContactPayoutError}
                        </div>
                      )}
                      <div className="space-y-3">
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                          <input
                            type="radio"
                            name="gpay_phone_source"
                            checked={formData.gpay_use_contact_phone}
                            onChange={() => setFormData({ ...formData, gpay_use_contact_phone: true, gpay_phone: "" })}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-sm font-black">Use contact number</span>
                            <span className="mt-1 block text-xs font-semibold opacity-60">
                              {formData.phone.trim() ? `Payouts will go to ${formatIndianMobileDisplay(formData.phone)}` : "Uses the contact number entered above."}
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                          <input
                            type="radio"
                            name="gpay_phone_source"
                            checked={!formData.gpay_use_contact_phone}
                            onChange={() => setFormData({ ...formData, gpay_use_contact_phone: false })}
                            className="mt-1"
                          />
                          <span className="block text-sm font-black">Use a different GPay number</span>
                        </label>
                      </div>
                      {!formData.gpay_use_contact_phone && (
                        <IndianPhoneField
                          label="GPay Mobile Number"
                          value={formData.gpay_phone}
                          onChange={(gpay_phone) => setFormData({ ...formData, gpay_phone })}
                          error={gpayPhoneError}
                          required
                        />
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input label="Bank Account Name" value={formData.bank_account_name} onChange={(bank_account_name) => setFormData({ ...formData, bank_account_name })} placeholder="Enter account holder name" required error={bankFieldErrors.bank_account_name} />
                      <Input label="Bank Account Number" value={formData.bank_account_number} onChange={(bank_account_number) => setFormData({ ...formData, bank_account_number })} placeholder="123456789012" inputMode="numeric" required error={bankFieldErrors.bank_account_number} />
                      <Input label="IFSC" value={formData.bank_ifsc} onChange={(bank_ifsc) => setFormData({ ...formData, bank_ifsc: bank_ifsc.toUpperCase() })} placeholder="SBIN0001234" maxLength={11} required error={bankFieldErrors.bank_ifsc} />
                      <Input label="Bank Name" value={formData.bank_name} onChange={(bank_name) => setFormData({ ...formData, bank_name })} placeholder="State Bank of India" required error={bankFieldErrors.bank_name} />
                    </div>
                  )}
                </div>
              </div>
              <div className="admin-modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading || !!phoneError}>{formLoading ? "Saving..." : editingAgent ? "Update Agent" : "Create Agent"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr className={darkMode ? "bg-gray-800/50" : "bg-gray-50"}>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Agent</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Payout</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Notify</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Payout</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Created</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right" className="text-[10px] font-black uppercase tracking-widest opacity-40">Actions</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={7} leadColumn="avatar" />
            ) : filteredAgents.length === 0 ? (
              <AdminTableEmpty colSpan={7}>No agents found.</AdminTableEmpty>
            ) : (
              filteredAgents.map((agent) => (
              <AdminTableRow key={recordId(agent)}>
                <AdminTableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-amber-600 dark:bg-amber-900/30">
                        {toDisplayInitial(getAgentDisplayName(agent))}
                      </div>
                      <div>
                        <div className="font-bold">{toDisplayTitle(getAgentDisplayName(agent))}</div>
                        <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-amber-600">{getAgentPublicId(agent)}</div>
                      </div>
                    </div>
                </AdminTableCell>
                <AdminTableCell className="font-black">{toDisplayTitle(agent.payout_frequency)}</AdminTableCell>
                <AdminTableCell className="text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      Alerts: {normalizeAgentNotificationMethod(getAgentAlertMethod(agent)) === "EMAIL" ? "Email" : "Text message"}
                    </div>
                </AdminTableCell>
                <AdminTableCell>
                    <div className="flex items-center gap-2 font-bold">
                      {inferAgentPayoutMethod(agent) === "GPAY" ? (
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Banknote className="h-4 w-4 text-emerald-600" />
                      )}
                      {getAgentPayoutLabel(agent)}
                    </div>
                    {inferAgentPayoutMethod(agent) === "BANK" && agent.bank_account_number && (
                      <div className="mt-1 text-xs opacity-50">•••• {agent.bank_account_number.slice(-4)}</div>
                    )}
                </AdminTableCell>
                <AdminTableCell>
                    <button onClick={() => toggleAgent(agent)} className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${agent.active !== false ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-red-200 bg-red-100 text-red-700"}`}>
                      {agent.active !== false ? "Active" : "Inactive"}
                    </button>
                </AdminTableCell>
                <AdminTableCell className="text-xs font-bold opacity-50">{formatDisplayDateValue(agent.created_at)}</AdminTableCell>
                <AdminTableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/agents/${recordId(agent)}`} className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"><Eye className="h-4 w-4" /></Link>
                      <button onClick={() => openEdit(agent)} className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteAgent(agent)} className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                </AdminTableCell>
              </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>
    </div>
  );
}
