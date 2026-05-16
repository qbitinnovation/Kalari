"use client";

import React, { useEffect, useState } from "react";
import { Clock, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { db } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
import { useDarkMode } from "@/hooks/useDarkMode";

type Activity = {
  id: string;
  _id?: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  duration: string;
  price: number;
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
  rating: "4.7",
  review_count: "0",
  image: activityImages.kalari,
  description: "",
  status: "ACTIVE" as "ACTIVE" | "DRAFT",
  featured: false,
  tags: "Instant confirmation, Family friendly",
};

const recordId = (record: Activity) => record.id || String(record._id);
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function AdminActivitiesPage() {
  const darkMode = useDarkMode();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(blankForm);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    const { data } = await db.from("activities").select("*").order("title", { ascending: true });
    setActivities(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
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
    const now = new Date().toISOString();
    const payload = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      category: form.category,
      location: form.location,
      duration: form.duration,
      price: Number(form.price),
      rating: Number(form.rating),
      review_count: Number(form.review_count),
      image: form.image,
      description: form.description,
      status: form.status,
      featured: form.featured,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      updated_at: now,
    };

    if (editing) {
      await db.from("activities").update(payload).eq("id", recordId(editing));
    } else {
      await db.from("activities").insert([{ ...payload, id: `activity-${Date.now()}`, created_at: now }]);
    }

    setModalOpen(false);
    await fetchActivities();
  };

  const deleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Delete ${activity.title}?`)) return;
    await db.from("activities").delete().eq("id", recordId(activity));
    await fetchActivities();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Activities</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Manage public activity cards, Kalary booking products, prices, and images.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800">
          <Plus className="h-5 w-5" />
          Add Activity
        </button>
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => (
            <article key={recordId(activity)} className={`overflow-hidden rounded-2xl border shadow-sm ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <img src={activity.image} alt={activity.title} className="h-48 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700">{activity.category}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${activity.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{activity.status}</span>
                </div>
                <h2 className="mt-3 text-xl font-black">{activity.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm opacity-70">{activity.description}</p>
                <div className="mt-4 grid gap-2 text-sm font-semibold opacity-80">
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {activity.location}</span>
                  <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> {activity.duration}</span>
                  <span className="inline-flex items-center gap-2"><Star className="h-4 w-4" /> {activity.rating} ({activity.review_count})</span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                  <span className="text-2xl font-black">Rs. {activity.price}</span>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(activity)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Edit activity">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteActivity(activity)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label="Delete activity">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={saveActivity} className="admin-modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
            <h2 className="text-2xl font-black">{editing ? "Edit Activity" : "Add Activity"}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value, slug: form.slug || slugify(value) })} required />
              <Field label="Slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} required />
              <Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} required />
              <Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} required />
              <Field label="Duration" value={form.duration} onChange={(value) => setForm({ ...form, duration: value })} required />
              <Field label="Price" type="number" value={form.price} onChange={(value) => setForm({ ...form, price: value })} required />
              <Field label="Rating" type="number" value={form.rating} onChange={(value) => setForm({ ...form, rating: value })} required />
              <Field label="Review Count" type="number" value={form.review_count} onChange={(value) => setForm({ ...form, review_count: value })} required />
              <label className="sm:col-span-2">
                <span className="admin-modal-label">Image URL</span>
                <input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} required className="admin-modal-field" />
              </label>
              <label className="sm:col-span-2">
                <span className="admin-modal-label">Description</span>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required rows={4} className="admin-modal-field" />
              </label>
              <Field label="Tags comma separated" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
              <label>
                <span className="admin-modal-label">Status</span>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "ACTIVE" | "DRAFT" })} className="admin-modal-field">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 text-slate-950 dark:bg-slate-900 dark:text-slate-100">
                <input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} />
                <span className="font-bold">Featured on homepage</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100">Cancel</button>
              <button type="submit" className="rounded-xl bg-amber-600 px-5 py-3 font-bold text-white">Save Activity</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const Field = ({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) => (
  <label>
    <span className="admin-modal-label">{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="admin-modal-field" />
  </label>
);
