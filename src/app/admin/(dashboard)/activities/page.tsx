"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { db, type Vendor } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  calculatePlatformAndVendorAmounts,
  getVendorContact,
  getVendorDisplayName,
} from "@/lib/vendorPayout";
import { canBookActivity, getAdminBookingUrl } from "@/lib/adminBooking";
import {
  activityDisplayStatusLabels,
  activityDisplayStatusStyles,
  formatAdminActivityDates,
  getActivityDisplayStatus,
} from "@/lib/activityAvailability";
import { resolveActivityStatus } from "@/lib/catalogLifecycle";
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
  DatePicker,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDisplayDateValue, todayDateValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration?: string;
  start_date?: string;
  end_date?: string;
  price: number;
  booking_price?: number;
  daily_capacity?: number;
  booking_status?: "ACTIVE" | "PAUSED";
  vendor_id?: string;
  platform_commission_percentage?: number;
  rating: number;
  review_count: number;
  image: string;
  description: string;
  status: "ACTIVE" | "DRAFT" | "COMPLETED";
  featured: boolean;
  tags?: string[];
};

const defaultEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
};

const blankForm = {
  title: "",
  location: "Kovalam",
  start_date: todayDateValue(),
  end_date: defaultEndDate(),
  price: "999",
  daily_capacity: "20",
  booking_status: "ACTIVE" as "ACTIVE" | "PAUSED",
  vendor_id: "",
  platform_commission_percentage: "",
  rating: "4.7",
  review_count: "0",
  image: activityImages.kalari,
  description: "",
  status: "ACTIVE" as "ACTIVE" | "DRAFT" | "COMPLETED",
  featured: false,
  tags: "Instant confirmation, Family friendly",
};

const recordId = (record: Activity) => record.id || String(record._id);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const formatAdminActivityDatesDisplay = (activity: Activity) => {
  const label = formatAdminActivityDates(activity);
  if (!label) return null;
  if (label.includes(" to ")) {
    const [start, end] = label.split(" to ");
    return `${formatDisplayDateValue(start)} to ${formatDisplayDateValue(end)}`;
  }
  if (label.startsWith("From ")) {
    return `From ${formatDisplayDateValue(label.slice(5))}`;
  }
  if (label.startsWith("Until ")) {
    return `Until ${formatDisplayDateValue(label.slice(6))}`;
  }
  return label;
};

export default function AdminActivitiesPage() {
  const darkMode = useDarkMode();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(blankForm);
  const [commissionError, setCommissionError] = useState("");
  const [dateError, setDateError] = useState("");
  const [listFilter, setListFilter] = useState<"active" | "completed" | "all">("active");

  const payoutPreview = useMemo(() => {
    if (!form.vendor_id) return null;
    const total = Number(form.price || 0);
    if (!Number.isFinite(total) || total <= 0) return null;
    try {
      return calculatePlatformAndVendorAmounts(total, form.platform_commission_percentage);
    } catch {
      return null;
    }
  }, [form.vendor_id, form.price, form.platform_commission_percentage]);

  useEffect(() => {
    fetchActivities();
    fetchVendors();
  }, []);

  useEffect(() => {
    if (!editId || loading || activities.length === 0) return;
    const activity = activities.find((item) => recordId(item) === editId);
    if (activity) openEdit(activity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, loading, activities]);

  const syncActivityStatuses = async (rows: Activity[]) => {
    for (const activity of rows) {
      const nextStatus = resolveActivityStatus(activity);
      if (nextStatus === activity.status) continue;
      await db
        .from("activities")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", recordId(activity));
      activity.status = nextStatus;
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    const { data } = await db
      .from("activities")
      .select("*")
      .order("title", { ascending: true });
    const rows = data || [];
    await syncActivityStatuses(rows);
    setActivities(rows);
    setLoading(false);
  };

  const visibleActivities = useMemo(() => {
    return activities.filter((activity) => {
      const displayStatus = getActivityDisplayStatus(activity);
      if (listFilter === "active") return displayStatus !== "COMPLETED";
      if (listFilter === "completed") return displayStatus === "COMPLETED";
      return true;
    });
  }, [activities, listFilter]);

  const fetchVendors = async () => {
    try {
      await fetch("/api/vendors/backfill", { method: "POST" }).catch(() => null);
      const { data, error } = await db
        .from("vendors")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setCommissionError("");
    setModalOpen(true);
  };

  const openEdit = (activity: Activity) => {
    setEditing(activity);
    setCommissionError("");
    setForm({
      title: activity.title || "",
      location: activity.location || "",
      start_date: activity.start_date || todayDateValue(),
      end_date: activity.end_date || defaultEndDate(),
      price: String(activity.booking_price || activity.price || 0),
      daily_capacity: String(activity.daily_capacity || 20),
      booking_status: activity.booking_status || "ACTIVE",
      vendor_id: activity.vendor_id || "",
      platform_commission_percentage: String(activity.platform_commission_percentage || 0),
      rating: String(activity.rating || 4.7),
      review_count: String(activity.review_count || 0),
      image: activity.image || activityImages.kalari,
      description: activity.description || "",
      status: activity.status || "ACTIVE",
      featured: Boolean(activity.featured),
      tags: (activity.tags || []).join(", "),
    });
    setModalOpen(true);
  };

  const saveActivity = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.start_date?.trim() || !form.end_date?.trim()) {
      setDateError("Start date and end date are required.");
      return;
    }
    if (form.end_date < form.start_date) {
      setDateError("End date must be on or after the start date.");
      return;
    }
    setDateError("");

    if (form.booking_status === "ACTIVE" && !form.vendor_id) {
      setCommissionError("A linked vendor is required when booking is active.");
      return;
    }

    if (form.vendor_id) {
      const raw = String(form.platform_commission_percentage ?? "").trim();
      const pct = Number(raw);
      if (!raw) {
        setCommissionError("Platform commission percentage is required when a linked vendor is selected.");
        return;
      }
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        setCommissionError("Enter a valid platform commission percentage between 0 and 100.");
        return;
      }
    }
    setCommissionError("");

    const now = new Date().toISOString();
    const price = Number(form.price);
    const payload = {
      title: form.title,
      slug: editing?.slug || slugify(form.title),
      category: editing?.category || "Activities",
      location: form.location,
      start_date: form.start_date,
      end_date: form.end_date,
      price,
      booking_price: price,
      daily_capacity: Number(form.daily_capacity || 0),
      booking_status: form.booking_status,
      vendor_id: form.vendor_id || null,
      platform_commission_percentage: form.vendor_id
        ? Number(form.platform_commission_percentage || 0)
        : 0,
      rating: Number(form.rating),
      review_count: Number(form.review_count),
      image: form.image,
      description: form.description,
      status: form.status,
      featured: form.featured,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      updated_at: now,
    };

    if (editing) {
      await db.from("activities").update(payload).eq("id", recordId(editing));
    } else {
      await db
        .from("activities")
        .insert([{ ...payload, id: `activity-${Date.now()}`, created_at: now }]);
    }

    setModalOpen(false);
    await fetchActivities();
  };

  const deleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Delete ${toDisplayTitle(activity.title)}?`)) return;
    await db.from("activities").delete().eq("id", recordId(activity));
    await fetchActivities();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1
            className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}
          >
            Activities
          </h1>
          <p
            className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}
          >
            Manage bookable experiences, availability dates, vendors, and platform commission.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label="Activity list"
            value={listFilter}
            onChange={(value) => setListFilter(value as "active" | "completed" | "all")}
            options={[
              { value: "active", label: "Upcoming & in season" },
              { value: "completed", label: "Completed" },
              { value: "all", label: "All activities" },
            ]}
            className="w-full sm:w-56"
          />
          <Button onClick={openCreate} className="sm:self-end">
            <Plus className="h-5 w-5" />
            Add Activity
          </Button>
        </div>
      </div>

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Activity</AdminTableHeaderCell>
              <AdminTableHeaderCell>Location</AdminTableHeaderCell>
              <AdminTableHeaderCell>Dates</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right">Price</AdminTableHeaderCell>
              <AdminTableHeaderCell>Booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right">Actions</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={7} leadColumn="avatar" />
            ) : visibleActivities.length === 0 ? (
              <AdminTableEmpty colSpan={7}>No activities found.</AdminTableEmpty>
            ) : (
              visibleActivities.map((activity) => {
                const displayStatus = getActivityDisplayStatus(activity);
                const id = recordId(activity);
                const bookable = canBookActivity(activity);
                const dateLabel = formatAdminActivityDatesDisplay(activity);
                return (
                  <AdminTableRow key={id}>
                    <AdminTableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={activity.image || activityImages.kalari}
                          alt={toDisplayTitle(activity.title)}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">{toDisplayTitle(activity.title)}</div>
                          <div className="mt-0.5 truncate text-xs opacity-50">{toDisplayTitle(activity.category)}</div>
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>{activity.location}</AdminTableCell>
                    <AdminTableCell>
                      {dateLabel ? (
                        dateLabel
                      ) : (
                        <span className="text-xs font-bold text-amber-700">Dates not set</span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <span className="font-black">Rs. {activity.booking_price || activity.price}</span>
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="space-y-1">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            activity.booking_status === "PAUSED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {activity.booking_status === "PAUSED" ? "Paused" : "Open"}
                        </span>
                        <div className="text-xs opacity-60">{activity.daily_capacity || 20}/day</div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${activityDisplayStatusStyles[displayStatus]}`}
                      >
                        {activityDisplayStatusLabels[displayStatus]}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell align="right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/admin/activities/${id}`}>
                          <Button size="sm" variant="ghost" aria-label="View activity">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(activity)} aria-label="Edit activity">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteActivity(activity)} aria-label="Delete activity">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                        {bookable ? (
                          <Link href={getAdminBookingUrl({ activityId: id, date: todayDateValue() })}>
                            <Button size="sm">Book Now</Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled>
                            Book Now
                          </Button>
                        )}
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

      {modalOpen && (
        <div className="admin-modal-overlay">
          <form
            onSubmit={saveActivity}
            className="admin-modal-panel admin-modal-card admin-modal-card-lg"
          >
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">
                  {editing ? "Edit Activity" : "Add Activity"}
                </h2>
                <p className="admin-modal-subtitle">
                  Published activities appear on the website when status is ACTIVE
                  and within the start/end dates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="admin-modal-close"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body grid gap-4 sm:grid-cols-2">
              <Input
                label="Title"
                value={form.title}
                onChange={(title) => setForm({ ...form, title })}
                required
                className="sm:col-span-2"
              />
              <Input
                label="Location"
                value={form.location}
                onChange={(location) => setForm({ ...form, location })}
                required
              />
              <DatePicker
                label="Start Date"
                value={form.start_date}
                onChange={(start_date) => {
                  setDateError("");
                  setForm({ ...form, start_date });
                }}
                required
              />
              <DatePicker
                label="End Date"
                value={form.end_date}
                onChange={(end_date) => {
                  setDateError("");
                  setForm({ ...form, end_date });
                }}
                required
              />
              {dateError ? (
                <p className="text-sm font-bold text-red-600">{dateError}</p>
              ) : null}
              <Select
                label="Linked Vendor"
                value={form.vendor_id || "__none__"}
                onChange={(vendor_id) => {
                  const linked = vendor_id !== "__none__";
                  setCommissionError("");
                  setForm({
                    ...form,
                    vendor_id: linked ? vendor_id : "",
                    platform_commission_percentage: linked ? form.platform_commission_percentage : "",
                  });
                }}
                placeholder="No linked vendor"
                options={[
                  { value: "__none__", label: "No linked vendor" },
                  ...vendors.map((vendor) => ({
                    value: String(vendor.id || vendor._id),
                    label: `${getVendorDisplayName(vendor)}${getVendorContact(vendor) ? ` (${getVendorContact(vendor)})` : ""}`,
                  })),
                ]}
                searchable={vendors.length > 3}
                className="sm:col-span-2"
              />
              {form.vendor_id ? (
                <>
                  <Input
                    label="Platform Commission (%)"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={form.platform_commission_percentage}
                    error={commissionError}
                    onChange={(platform_commission_percentage) => {
                      setCommissionError("");
                      setForm({ ...form, platform_commission_percentage });
                    }}
                    placeholder="e.g. 15"
                    className="sm:col-span-2"
                  />
                  {payoutPreview ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 sm:col-span-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Per-ticket split preview</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold text-slate-500">Ticket price</p>
                          <p className="font-black">Rs. {Number(form.price || 0).toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500">Platform ({payoutPreview.platformPct}%)</p>
                          <p className="font-black text-amber-700">Rs. {payoutPreview.platformAmount.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500">Vendor payout</p>
                          <p className="font-black text-emerald-700">Rs. {payoutPreview.vendorAmount.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : commissionError ? (
                <p className="text-sm font-bold text-red-600 sm:col-span-2">{commissionError}</p>
              ) : null}
              <Input
                label="Price"
                type="number"
                value={form.price}
                onChange={(price) => setForm({ ...form, price })}
                required
              />
              <Input
                label="Daily Ticket Limit"
                type="number"
                min={1}
                value={form.daily_capacity}
                onChange={(daily_capacity) =>
                  setForm({ ...form, daily_capacity })
                }
                required
              />
              <Select
                label="Booking Status"
                value={form.booking_status}
                onChange={(booking_status) =>
                  setForm({
                    ...form,
                    booking_status: booking_status as "ACTIVE" | "PAUSED",
                  })
                }
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "PAUSED", label: "Paused" },
                ]}
              />
              <Input
                label="Rating"
                type="number"
                value={form.rating}
                onChange={(rating) => setForm({ ...form, rating })}
                required
              />
              <Input
                label="Review Count"
                type="number"
                value={form.review_count}
                onChange={(review_count) => setForm({ ...form, review_count })}
                required
              />
              <Input
                label="Image URL"
                value={form.image}
                onChange={(image) => setForm({ ...form, image })}
                required
                className="sm:col-span-2"
              />
              <Textarea
                label="Description"
                value={form.description}
                onChange={(description) => setForm({ ...form, description })}
                required
                rows={4}
                className="sm:col-span-2"
              />
              <Input
                label="Tags comma separated"
                value={form.tags}
                onChange={(tags) => setForm({ ...form, tags })}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(status) =>
                  setForm({ ...form, status: status as "ACTIVE" | "DRAFT" | "COMPLETED" })
                }
                options={[
                  { value: "ACTIVE", label: "ACTIVE" },
                  { value: "DRAFT", label: "DRAFT" },
                ]}
              />
              <label className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 text-slate-950 dark:bg-slate-900 dark:text-slate-100 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm({ ...form, featured: event.target.checked })
                  }
                />
                <span className="font-bold">Featured on homepage</span>
              </label>
            </div>
            <div className="admin-modal-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Activity</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
