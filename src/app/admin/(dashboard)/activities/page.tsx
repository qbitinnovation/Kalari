"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Star,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { toDisplayTitle } from "@/lib/textFormat";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration: string;
  price: number;
  booking_price?: number;
  daily_capacity?: number;
  booking_status?: "ACTIVE" | "PAUSED";
  rating: number;
  review_count: number;
  image: string;
  description: string;
  status: "ACTIVE" | "DRAFT";
  featured: boolean;
  tags?: string[];
};

const blankForm = {
  title: "",
  slug: "",
  category: "Activities",
  location: "Kovalam",
  duration: "2 hours",
  price: "999",
  booking_price: "999",
  daily_capacity: "20",
  booking_status: "ACTIVE" as "ACTIVE" | "PAUSED",
  rating: "4.7",
  review_count: "0",
  image: activityImages.kalari,
  description: "",
  status: "ACTIVE" as "ACTIVE" | "DRAFT",
  featured: false,
  tags: "Instant confirmation, Family friendly",
};

const recordId = (record: Activity) => record.id || String(record._id);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AdminActivitiesPage() {
  const darkMode = useDarkMode();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    const { data } = await db
      .from("activities")
      .select("*")
      .order("title", { ascending: true });
    setActivities(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setBookingSettingsOpen(false);
    setModalOpen(true);
  };

  const openEdit = (activity: Activity) => {
    setEditing(activity);
    setForm({
      title: activity.title || "",
      slug: activity.slug || "",
      category: activity.category || "Activities",
      location: activity.location || "",
      duration: activity.duration || "",
      price: String(activity.price || 0),
      booking_price: String(activity.booking_price || activity.price || 0),
      daily_capacity: String(activity.daily_capacity || 20),
      booking_status: activity.booking_status || "ACTIVE",
      rating: String(activity.rating || 4.7),
      review_count: String(activity.review_count || 0),
      image: activity.image || activityImages.kalari,
      description: activity.description || "",
      status: activity.status || "ACTIVE",
      featured: Boolean(activity.featured),
      tags: (activity.tags || []).join(", "),
    });
    setBookingSettingsOpen(true);
    setModalOpen(true);
  };

  const saveActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const payload = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      category: form.category,
      location: form.location,
      duration: form.duration,
      price: Number(form.price),
      booking_price: Number(form.booking_price || form.price),
      daily_capacity: Number(form.daily_capacity || 0),
      booking_status: form.booking_status,
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
        .insert([
          { ...payload, id: `activity-${Date.now()}`, created_at: now },
        ]);
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
            Manage public activity cards, Kalari booking products, prices, and
            images.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-5 w-5" />
          Add Activity
        </Button>
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => (
            <article
              key={recordId(activity)}
              className={`overflow-hidden rounded-2xl border shadow-sm ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
            >
              <img
                src={activity.image}
                alt={toDisplayTitle(activity.title)}
                className="h-48 w-full object-cover"
              />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700">
                    {toDisplayTitle(activity.category)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${activity.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {toDisplayTitle(activity.status)}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-black">
                  {toDisplayTitle(activity.title)}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm opacity-70">
                  {toDisplayTitle(activity.description)}
                </p>
                <div className="mt-4 grid gap-2 text-sm font-semibold opacity-80">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {activity.location}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {activity.duration}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Star className="h-4 w-4" /> {activity.rating} (
                    {activity.review_count})
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Ticket className="h-4 w-4" />{" "}
                    {activity.booking_status === "PAUSED"
                      ? "Booking Paused"
                      : "Booking Active"}{" "}
                    · {activity.daily_capacity || 20}/day
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-2xl font-black">
                    Rs. {activity.price}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(activity)}
                      className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Edit activity"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteActivity(activity)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      aria-label="Delete activity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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
                  Manage public activity cards, pricing, and visibility.
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
                onChange={(title) =>
                  setForm({ ...form, title, slug: form.slug || slugify(title) })
                }
                required
              />
              <Input
                label="Slug"
                value={form.slug}
                onChange={(slug) => setForm({ ...form, slug })}
                required
              />
              <Input
                label="Category"
                value={form.category}
                onChange={(category) => setForm({ ...form, category })}
                required
              />
              <Input
                label="Location"
                value={form.location}
                onChange={(location) => setForm({ ...form, location })}
                required
              />
              <Input
                label="Duration"
                value={form.duration}
                onChange={(duration) => setForm({ ...form, duration })}
                required
              />
              <Input
                label="Price"
                type="number"
                value={form.price}
                onChange={(price) => setForm({ ...form, price })}
                required
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
                  setForm({ ...form, status: status as "ACTIVE" | "DRAFT" })
                }
                options={[
                  { value: "ACTIVE", label: "ACTIVE" },
                  { value: "DRAFT", label: "DRAFT" },
                ]}
              />
              <label className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 text-slate-950 dark:bg-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm({ ...form, featured: event.target.checked })
                  }
                />
                <span className="font-bold">Featured on homepage</span>
              </label>
              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBookingSettingsOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-black uppercase tracking-widest text-slate-500">
                      Booking Settings
                    </div>
                    <div className="text-xs font-semibold text-slate-400">
                      Daily capacity, booking price, and booking status.
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 transition ${bookingSettingsOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {bookingSettingsOpen && (
                  <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-800">
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
                    <Input
                      label="Booking Price"
                      type="number"
                      min={0}
                      value={form.booking_price}
                      onChange={(booking_price) =>
                        setForm({ ...form, booking_price })
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
                  </div>
                )}
              </div>
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
