"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, ChevronDown, Eye, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { db, type Agent } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { AdminTable, AdminTableBody, AdminTableEmpty, AdminTableHead, AdminTablePanel, Button, SearchInput, Select } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { getAgentContact, getAgentDisplayName, normalizePayoutFrequency, type PayoutFrequency } from "@/lib/agentCommission";
import { toDisplayInitial, toDisplayTitle } from "@/lib/textFormat";

const emptyForm = {
  name: "",
  phone: "",
  payout_frequency: "MONTHLY" as PayoutFrequency,
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
  active: true,
};

const recordId = (row: any) => String(row?.id || row?._id || "");
const normalizeIndianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return value.trim();
};

const isValidIndianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const darkMode = useDarkMode();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
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
    setBankDetailsOpen(false);
    setShowForm(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: getAgentDisplayName(agent),
      phone: getAgentContact(agent),
      payout_frequency: normalizePayoutFrequency(agent.payout_frequency),
      bank_account_name: agent.bank_account_name || "",
      bank_account_number: agent.bank_account_number || "",
      bank_ifsc: agent.bank_ifsc || "",
      bank_name: agent.bank_name || "",
      active: agent.active !== false,
    });
    setBankDetailsOpen(Boolean(agent.bank_account_name || agent.bank_account_number || agent.bank_ifsc || agent.bank_name));
    setShowForm(true);
  };

  const saveAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormLoading(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const payload = {
        ...formData,
        name: formData.name.trim(),
        phone: normalizeIndianPhone(formData.phone),
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_ifsc: formData.bank_ifsc.trim(),
        bank_name: formData.bank_name.trim(),
        payout_frequency: normalizePayoutFrequency(formData.payout_frequency),
        updated_at: now,
      };

      if (!payload.name || !payload.phone) throw new Error("Agent name and contact number are required.");
      if (!isValidIndianPhone(formData.phone)) throw new Error("Enter a valid Indian mobile number. Use 10 digits or +91 followed by 10 digits.");

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
    `${getAgentDisplayName(agent)} ${getAgentContact(agent)} ${agent.bank_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents Management</h1>
          <p className="text-sm opacity-60">Manage offline agents, bank details, and payout cycles</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Filter agents by name, phone, or bank..." containerClassName="w-full sm:w-80" />
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
                <p className="admin-modal-subtitle">Add offline agent contact, bank details, and payout cycle.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="admin-modal-close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveAgent}>
              <div className="admin-modal-body grid gap-4 md:grid-cols-2">
                <Field label="Agent Name" value={formData.name} onChange={(name) => setFormData({ ...formData, name })} placeholder="Enter agent name" required />
                <Field label="Contact Number" value={formData.phone} onChange={(phone) => setFormData({ ...formData, phone })} placeholder="+91 98765 43210" inputMode="tel" required maxLength={17} />
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
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setBankDetailsOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-black transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      Bank Details
                    </span>
                    <ChevronDown className={`h-4 w-4 transition ${bankDetailsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {bankDetailsOpen && (
                    <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:grid-cols-2">
                      <Field label="Bank Account Name" value={formData.bank_account_name} onChange={(bank_account_name) => setFormData({ ...formData, bank_account_name })} placeholder="Enter account holder name" />
                      <Field label="Bank Account Number" value={formData.bank_account_number} onChange={(bank_account_number) => setFormData({ ...formData, bank_account_number })} placeholder="123456789012" inputMode="numeric" />
                      <Field label="IFSC" value={formData.bank_ifsc} onChange={(bank_ifsc) => setFormData({ ...formData, bank_ifsc: bank_ifsc.toUpperCase() })} placeholder="SBIN0001234" maxLength={11} />
                      <Field label="Bank Name" value={formData.bank_name} onChange={(bank_name) => setFormData({ ...formData, bank_name })} placeholder="State Bank of India" />
                    </div>
                  )}
                </div>
              </div>
              <div className="admin-modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading}>{formLoading ? "Saving..." : editingAgent ? "Update Agent" : "Create Agent"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminTablePanel>
        <div className="overflow-x-auto">
          <AdminTable>
            <AdminTableHead>
              <tr className={darkMode ? "bg-gray-800/50" : "bg-gray-50"}>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-40">Agent</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-40">Payout</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-40">Bank</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-40">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest opacity-40">Created</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest opacity-40">Actions</th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {filteredAgents.map((agent) => (
                <tr key={recordId(agent)} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-sm font-black text-amber-600 dark:bg-amber-900/30">
                        {toDisplayInitial(getAgentDisplayName(agent))}
                      </div>
                      <div>
                        <div className="font-bold">{toDisplayTitle(getAgentDisplayName(agent))}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs opacity-50"><Phone className="h-3 w-3" /> {getAgentContact(agent)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-black">{toDisplayTitle(agent.payout_frequency)}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2 font-bold">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      {agent.bank_name || "Not added"}
                    </div>
                    {agent.bank_account_number && <div className="mt-1 text-xs opacity-50">•••• {agent.bank_account_number.slice(-4)}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleAgent(agent)} className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${agent.active !== false ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-red-200 bg-red-100 text-red-700"}`}>
                      {agent.active !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold opacity-50">{formatDisplayDateValue(agent.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/agents/${recordId(agent)}`} className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"><Eye className="h-4 w-4" /></Link>
                      <button onClick={() => openEdit(agent)} className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteAgent(agent)} className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAgents.length === 0 && <AdminTableEmpty colSpan={6}>No agents found.</AdminTableEmpty>}
            </AdminTableBody>
          </AdminTable>
        </div>
      </AdminTablePanel>
    </div>
  );
}

const Field = ({
  label,
  value,
  onChange,
  required,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) => (
  <label className="space-y-2">
    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className="w-full rounded-xl border px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-800"
    />
  </label>
);
