"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Eye, Pencil, Plus, Smartphone, Trash2, X } from "lucide-react";
import { db, type Vendor } from "@/lib/database";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAuth } from "@/contexts/AuthContext";
import {
  logVendorCreation,
  logVendorDeletion,
  logVendorUpdate,
} from "@/utils/activityLogger";
import { AdminTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeaderCell, AdminTablePanel, AdminTableRow, AdminTableSkeleton, Button, IndianPhoneField, Input, SearchInput } from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import {
  formatIndianMobileDisplay,
  formatIndianMobileForStorage,
  getIndianMobileDigits,
  INDIAN_MOBILE_ERROR,
  isValidIndianMobileDigits,
} from "@/lib/indianPhone";
import { normalizePayoutMethod, type PayoutMethod } from "@/lib/agentCommission";
import {
  getVendorContact,
  getVendorDisplayName,
  getVendorPayoutLabel,
  vendorUsesContactGpayPhone,
  inferVendorPayoutMethod,
} from "@/lib/vendorPayout";
import { getVendorPublicId } from "@/lib/vendorId";
import { toDisplayInitial, toDisplayTitle } from "@/lib/textFormat";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  payout_method: "GPAY" as PayoutMethod,
  gpay_use_contact_phone: true,
  gpay_phone: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
};

const recordId = (row: any) => String(row?.id || row?._id || "");

const isBankPayoutComplete = (form: typeof emptyForm) =>
  Boolean(
    form.bank_account_name.trim() &&
      form.bank_account_number.trim() &&
      form.bank_ifsc.trim() &&
      form.bank_name.trim(),
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

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [error, setError] = useState("");
  const darkMode = useDarkMode();
  const { user } = useAuth();

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/vendors/backfill", { method: "POST" }).catch(() => null);
      const { data, error } = await db.from("vendors").select("*").order("name", { ascending: true });
      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      setError(error.message || "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingVendor(null);
    setFormData(emptyForm);
    setPayoutSubmitted(false);
    setShowForm(true);
  };

  const openEdit = (vendor: Vendor) => {
    const payoutMethod = inferVendorPayoutMethod(vendor);
    const usesContactGpay = vendorUsesContactGpayPhone(vendor);
    setEditingVendor(vendor);
    setPayoutSubmitted(false);
    setFormData({
      name: getVendorDisplayName(vendor),
      phone: getIndianMobileDigits(getVendorContact(vendor)),
      email: vendor.email || "",
      payout_method: payoutMethod,
      gpay_use_contact_phone: usesContactGpay,
      gpay_phone: usesContactGpay ? "" : getIndianMobileDigits(vendor.gpay_phone || ""),
      bank_account_name: vendor.bank_account_name || "",
      bank_account_number: vendor.bank_account_number || "",
      bank_ifsc: vendor.bank_ifsc || "",
      bank_name: vendor.bank_name || "",
    });
    setShowForm(true);
  };

  const saveVendor = async (event: React.FormEvent) => {
    event.preventDefault();
    setPayoutSubmitted(true);
    setFormLoading(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const payoutMethod = normalizePayoutMethod(formData.payout_method);
      const { gpay_use_contact_phone, ...formRest } = formData;
      const payload = {
        name: formData.name.trim(),
        phone: formatIndianMobileForStorage(formData.phone),
        email: formData.email.trim().toLowerCase(),
        payout_method: payoutMethod,
        gpay_phone:
          payoutMethod === "GPAY" && !gpay_use_contact_phone
            ? formatIndianMobileForStorage(formData.gpay_phone)
            : "",
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_ifsc: formData.bank_ifsc.trim(),
        bank_name: formData.bank_name.trim(),
        updated_at: now,
      };

      if (!payload.name || !formData.phone.trim()) throw new Error("Vendor name and contact number are required.");
      if (!isValidIndianMobileDigits(formData.phone)) throw new Error(INDIAN_MOBILE_ERROR);
      if (payload.email && !isValidEmail(payload.email)) throw new Error("Enter a valid email address.");
      if (payoutMethod === "GPAY") {
        const gpayError = getGpayPayoutError(formData, true);
        if (gpayError) throw new Error(gpayError);
      } else if (!isBankPayoutComplete(formData)) {
        throw new Error("Fill in all bank details for bank transfer payout.");
      }

      const performedBy = user?.email || user?.full_name || "admin";

      if (editingVendor) {
        const vendorId = recordId(editingVendor);
        const { error } = await db.from("vendors").update(payload).eq("id", vendorId);
        if (error) throw error;
        await logVendorUpdate(vendorId, payload.name, performedBy);
      } else {
        const { data, error } = await db.from("vendors").insert([{ ...payload, active: true, created_at: now }]);
        if (error) throw error;
        const created = (data as any)?.[0];
        const vendorId = String(created?.id || created?._id || "");
        await logVendorCreation(vendorId, payload.name, performedBy);
      }

      setShowForm(false);
      setEditingVendor(null);
      setFormData(emptyForm);
      setPayoutSubmitted(false);
      await fetchVendors();
    } catch (error: any) {
      setError(error.message || "Could not save vendor.");
    } finally {
      setFormLoading(false);
    }
  };

  const deleteVendor = async (vendor: Vendor) => {
    if (!window.confirm(`Delete ${getVendorDisplayName(vendor)}? Existing activity payout history will remain.`)) return;
    const vendorId = recordId(vendor);
    const { error } = await db.from("vendors").delete().eq("id", vendorId);
    if (error) setError(error.message || "Could not delete vendor.");
    else {
      await logVendorDeletion(
        vendorId,
        getVendorDisplayName(vendor),
        user?.email || user?.full_name || "admin",
      );
    }
    await fetchVendors();
  };

  const filteredVendors = vendors.filter((vendor) =>
    `${getVendorDisplayName(vendor)} ${getVendorContact(vendor)} ${vendor.email || ""} ${getVendorPayoutLabel(vendor)}`.toLowerCase().includes(searchTerm.toLowerCase()),
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
          <h1 className="text-2xl font-bold">Vendors Management</h1>
          <p className="text-sm opacity-60">Manage activity vendors and how you pay them (GPay or bank)</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Filter vendors by name, phone, or payout..." containerClassName="w-full sm:w-80" />
          <Button onClick={openCreate}><Plus className="h-5 w-5" /> Add Vendor</Button>
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
                <h2 className="admin-modal-title">{editingVendor ? "Edit Vendor" : "Create Vendor"}</h2>
                <p className="admin-modal-subtitle">Contact details and payout method (GPay or bank transfer).</p>
              </div>
              <button onClick={() => setShowForm(false)} className="admin-modal-close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveVendor} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="admin-modal-body grid gap-4 md:grid-cols-2">
                <Input label="Vendor Name" value={formData.name} onChange={(name) => setFormData({ ...formData, name })} placeholder="Enter vendor name" required />
                <IndianPhoneField
                  label="Contact Number"
                  value={formData.phone}
                  onChange={(phone) => setFormData({ ...formData, phone })}
                  error={phoneError}
                  required
                />
                <Input
                  label="Email (optional)"
                  value={formData.email}
                  onChange={(email) => setFormData({ ...formData, email })}
                  placeholder="vendor@example.com"
                  inputMode="email"
                  className="md:col-span-2"
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
                <Button type="submit" disabled={formLoading || !!phoneError}>{formLoading ? "Saving..." : editingVendor ? "Update Vendor" : "Create Vendor"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr className={darkMode ? "bg-gray-800/50" : "bg-gray-50"}>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Vendor</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Payout method</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-[10px] font-black uppercase tracking-widest opacity-40">Created</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right" className="text-[10px] font-black uppercase tracking-widest opacity-40">Actions</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={4} leadColumn="avatar" />
            ) : filteredVendors.length === 0 ? (
              <AdminTableEmpty colSpan={4}>No vendors found.</AdminTableEmpty>
            ) : (
              filteredVendors.map((vendor) => (
              <AdminTableRow key={recordId(vendor)}>
                <AdminTableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-600 dark:bg-violet-900/30">
                        {toDisplayInitial(getVendorDisplayName(vendor))}
                      </div>
                      <div>
                        <div className="font-bold">{toDisplayTitle(getVendorDisplayName(vendor))}</div>
                        <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-violet-600">{getVendorPublicId(vendor)}</div>
                      </div>
                    </div>
                </AdminTableCell>
                <AdminTableCell>
                    <div className="flex items-center gap-2 font-bold">
                      {inferVendorPayoutMethod(vendor) === "GPAY" ? (
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Banknote className="h-4 w-4 text-emerald-600" />
                      )}
                      {getVendorPayoutLabel(vendor)}
                    </div>
                    {inferVendorPayoutMethod(vendor) === "BANK" && vendor.bank_account_number && (
                      <div className="mt-1 text-xs opacity-50">•••• {vendor.bank_account_number.slice(-4)}</div>
                    )}
                </AdminTableCell>
                <AdminTableCell className="text-xs font-bold opacity-50">{formatDisplayDateValue(vendor.created_at)}</AdminTableCell>
                <AdminTableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/vendors/${recordId(vendor)}`} className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30"><Eye className="h-4 w-4" /></Link>
                      <button onClick={() => openEdit(vendor)} className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteVendor(vendor)} className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
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
