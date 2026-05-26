"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit3, Eye, FileText, Image as ImageIcon, MessageSquareQuote, Package, Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/database";
import { activityImages } from "@/lib/seedData";
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
  Button,
  Input,
  SearchInput,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { formatDisplayDateValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

type ContentTab = "packages" | "blog_posts" | "gallery_items" | "reviews";
type AnyRow = Record<string, any>;

const tabOptions = [
  { value: "packages", label: "Packages" },
  { value: "blog_posts", label: "Blog" },
  { value: "gallery_items", label: "Gallery" },
  { value: "reviews", label: "Reviews" },
];

const tabMeta: Record<ContentTab, { title: string; icon: React.ElementType; empty: AnyRow }> = {
  packages: {
    title: "Package",
    icon: Package,
    empty: {
      title: "",
      slug: "",
      image: activityImages.boat,
      summary: "",
      description: "",
      price: "2499",
      duration: "1 day",
      group_size: "2-12 guests",
      location: "Kovalam",
      status: "PUBLISHED",
      featured: false,
      sort_order: "0",
    },
  },
  blog_posts: {
    title: "Blog Post",
    icon: FileText,
    empty: {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      image: activityImages.temple,
      author: "Kovalam Kalari",
      tags: "",
      status: "PUBLISHED",
      published_at: new Date().toISOString().split("T")[0],
    },
  },
  gallery_items: {
    title: "Gallery Item",
    icon: ImageIcon,
    empty: {
      title: "",
      media_type: "IMAGE",
      media_url: activityImages.kalari,
      thumbnail_url: "",
      caption: "",
      status: "PUBLISHED",
      sort_order: "0",
    },
  },
  reviews: {
    title: "Review",
    icon: MessageSquareQuote,
    empty: {
      customer_name: "",
      rating: "5",
      comment: "",
      target_type: "GENERAL",
      target_id: "",
      status: "PUBLISHED",
      source: "ADMIN",
    },
  },
};

const recordId = (row: AnyRow) => row.id || String(row._id || "");
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function WebsiteContentPage() {
  const darkMode = useDarkMode();
  const [activeTab, setActiveTab] = useState<ContentTab>("packages");
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState<AnyRow>(tabMeta.packages.empty);

  const meta = tabMeta[activeTab];
  const Icon = meta.icon;

  const fetchRows = async () => {
    setLoading(true);
    const orderColumn = activeTab === "reviews" ? "created_at" : activeTab === "blog_posts" ? "published_at" : "sort_order";
    const { data } = await db.from(activeTab).select("*").order(orderColumn, { ascending: activeTab !== "reviews" });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [activeTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = String(row.status || "");
      const matchesStatus = status === "ALL" || rowStatus === status;
      const haystack = `${row.title || ""} ${row.customer_name || ""} ${row.summary || ""} ${row.excerpt || ""} ${row.comment || ""}`.toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [rows, query, status]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...meta.empty });
    setModalOpen(true);
  };

  const openEdit = (row: AnyRow) => {
    setEditing(row);
    setForm({
      ...meta.empty,
      ...row,
      price: row.price !== undefined ? String(row.price) : meta.empty.price,
      sort_order: row.sort_order !== undefined ? String(row.sort_order) : meta.empty.sort_order,
      rating: row.rating !== undefined ? String(row.rating) : meta.empty.rating,
      tags: Array.isArray(row.tags) ? row.tags.join(", ") : row.tags || "",
      published_at: row.published_at ? String(row.published_at).slice(0, 10) : meta.empty.published_at,
    });
    setModalOpen(true);
  };

  const saveRow = async (event: React.FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const base: AnyRow = { ...form, updated_at: now };
    if ("title" in base) base.slug = base.slug || slugify(base.title || "");
    if (activeTab === "packages") {
      base.price = Number(base.price || 0);
      base.sort_order = Number(base.sort_order || 0);
      base.featured = Boolean(base.featured);
    }
    if (activeTab === "blog_posts") {
      base.tags = String(base.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      base.published_at = base.published_at ? new Date(base.published_at).toISOString() : now;
    }
    if (activeTab === "gallery_items") base.sort_order = Number(base.sort_order || 0);
    if (activeTab === "reviews") {
      base.rating = Math.min(5, Math.max(1, Number(base.rating || 5)));
      base.source = "ADMIN";
    }

    if (editing) {
      await db.from(activeTab).update(base).eq("id", recordId(editing));
    } else {
      await db.from(activeTab).insert([{ ...base, id: `${activeTab}-${Date.now()}`, created_at: now }]);
    }
    setModalOpen(false);
    await fetchRows();
  };

  const deleteRow = async (row: AnyRow) => {
    const label = row.title || row.customer_name || "this item";
    if (!window.confirm(`Delete ${toDisplayTitle(label)}?`)) return;
    await db.from(activeTab).delete().eq("id", recordId(row));
    await fetchRows();
  };

  const statusOptions = activeTab === "reviews"
    ? [
        { value: "ALL", label: "All Status" },
        { value: "PENDING", label: "Pending" },
        { value: "PUBLISHED", label: "Published" },
        { value: "REJECTED", label: "Rejected" },
        { value: "HIDDEN", label: "Hidden" },
      ]
    : [
        { value: "ALL", label: "All Status" },
        { value: "PUBLISHED", label: "Published" },
        { value: "DRAFT", label: "Draft" },
      ];

  const rowDetails = (row: AnyRow) =>
    row.summary || row.excerpt || row.caption || row.comment || (row.price ? `Rs. ${row.price}` : "No details");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Website Content</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Manage public packages, blog posts, gallery media, and reviews.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-5 w-5" />
          Add {meta.title}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onChange={(value) => { setActiveTab(value as ContentTab); setQuery(""); setStatus("ALL"); }}
        options={tabOptions}
        ariaLabel="Website content sections"
      />

      <AdminTablePanel
        title={<span className="inline-flex items-center gap-2"><Icon className="h-5 w-5 text-amber-600" /> {meta.title}s</span>}
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder={`Search ${meta.title.toLowerCase()}s...`} containerClassName="sm:w-80" />
            <Select value={status} onChange={setStatus} options={statusOptions} searchable={false} className="sm:w-44" />
          </div>
        }
      >
        <AdminTable className="table-fixed">
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell className="w-[28%]">Title</AdminTableHeaderCell>
              <AdminTableHeaderCell className="w-[34%]">Details</AdminTableHeaderCell>
              <AdminTableHeaderCell className="w-[12%]">Status</AdminTableHeaderCell>
              <AdminTableHeaderCell className="w-[14%]">Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell className="w-[12%]" align="right">Actions</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableEmpty colSpan={5}>Loading content...</AdminTableEmpty>
            ) : filtered.length === 0 ? (
              <AdminTableEmpty colSpan={5}>Nothing to display.</AdminTableEmpty>
            ) : (
              filtered.map((row) => (
                <AdminTableRow key={recordId(row)}>
                  <AdminTableCell className="whitespace-nowrap">
                    <div className="truncate font-black text-slate-950 dark:text-slate-100">
                      {toDisplayTitle(row.title || row.customer_name)}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                      {row.slug || row.email || row.target_type || "Website item"}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap">
                    <div
                      className="truncate font-semibold text-slate-700 dark:text-slate-300"
                      title={String(rowDetails(row))}
                    >
                      {rowDetails(row)}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      row.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" :
                      row.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                      row.status === "REJECTED" || row.status === "HIDDEN" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {toDisplayTitle(row.status)}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap">{formatDisplayDateValue(row.updated_at || row.created_at)}</AdminTableCell>
                  <AdminTableCell className="whitespace-nowrap" align="right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRow(row)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

      {modalOpen && (
        <div className="admin-modal-overlay">
          <form onSubmit={saveRow} className="admin-modal-panel admin-modal-card admin-modal-card-lg">
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-subtitle">Website content</p>
                <h2 className="admin-modal-title">{editing ? `Edit ${meta.title}` : `Add ${meta.title}`}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="admin-modal-close" aria-label="Close modal">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body grid gap-4 md:grid-cols-2">
              {activeTab !== "reviews" ? (
                <>
                  <Input label="Title" value={form.title || ""} onChange={(title) => setForm({ ...form, title })} placeholder="Enter title" required />
                  <Input label="Slug" value={form.slug || ""} onChange={(slug) => setForm({ ...form, slug })} placeholder="auto-generated-if-empty" />
                </>
              ) : (
                <>
                  <Input label="Customer Name" value={form.customer_name || ""} onChange={(customer_name) => setForm({ ...form, customer_name })} placeholder="Enter customer name" required />
                  <Input label="Rating" type="number" min={1} max={5} value={form.rating || "5"} onChange={(rating) => setForm({ ...form, rating })} required />
                </>
              )}

              {activeTab === "packages" && (
                <>
                  <Input label="Image URL" value={form.image || ""} onChange={(image) => setForm({ ...form, image })} placeholder="https://..." className="md:col-span-2" required />
                  <Input label="Price" type="number" value={form.price || ""} onChange={(price) => setForm({ ...form, price })} required />
                  <Input label="Duration" value={form.duration || ""} onChange={(duration) => setForm({ ...form, duration })} placeholder="1 day" required />
                  <Input label="Group Size" value={form.group_size || ""} onChange={(group_size) => setForm({ ...form, group_size })} placeholder="2-12 guests" required />
                  <Input label="Location" value={form.location || ""} onChange={(location) => setForm({ ...form, location })} placeholder="Kovalam" required />
                  <Textarea label="Summary" value={form.summary || ""} onChange={(summary) => setForm({ ...form, summary })} className="md:col-span-2" required />
                </>
              )}

              {activeTab === "blog_posts" && (
                <>
                  <Input label="Image URL" value={form.image || ""} onChange={(image) => setForm({ ...form, image })} placeholder="https://..." className="md:col-span-2" required />
                  <Input label="Author" value={form.author || ""} onChange={(author) => setForm({ ...form, author })} placeholder="Kovalam Kalari" />
                  <Input label="Published Date" type="date" value={String(form.published_at || "").slice(0, 10)} onChange={(published_at) => setForm({ ...form, published_at })} />
                  <Input label="Tags" value={form.tags || ""} onChange={(tags) => setForm({ ...form, tags })} placeholder="Kalari, Travel" className="md:col-span-2" />
                  <Textarea label="Excerpt" value={form.excerpt || ""} onChange={(excerpt) => setForm({ ...form, excerpt })} className="md:col-span-2" required />
                  <Textarea label="Content" value={form.content || ""} onChange={(content) => setForm({ ...form, content })} rows={8} className="md:col-span-2" />
                </>
              )}

              {activeTab === "gallery_items" && (
                <>
                  <Select label="Media Type" value={form.media_type || "IMAGE"} onChange={(media_type) => setForm({ ...form, media_type })} options={[{ value: "IMAGE", label: "Image" }, { value: "VIDEO", label: "Video" }]} searchable={false} />
                  <Input label="Sort Order" type="number" value={form.sort_order || "0"} onChange={(sort_order) => setForm({ ...form, sort_order })} />
                  <Input label="Media URL" value={form.media_url || ""} onChange={(media_url) => setForm({ ...form, media_url })} placeholder="https://..." className="md:col-span-2" required />
                  <Input label="Thumbnail URL" value={form.thumbnail_url || ""} onChange={(thumbnail_url) => setForm({ ...form, thumbnail_url })} placeholder="Optional thumbnail" className="md:col-span-2" />
                  <Textarea label="Caption" value={form.caption || ""} onChange={(caption) => setForm({ ...form, caption })} className="md:col-span-2" />
                </>
              )}

              {activeTab === "reviews" && (
                <>
                  <Select label="Target Type" value={form.target_type || "GENERAL"} onChange={(target_type) => setForm({ ...form, target_type })} options={[{ value: "GENERAL", label: "General" }, { value: "SHOW", label: "Show" }, { value: "ACTIVITY", label: "Activity" }]} searchable={false} />
                  <Input label="Target ID" value={form.target_id || ""} onChange={(target_id) => setForm({ ...form, target_id })} placeholder="Optional" />
                  <Textarea label="Review" value={form.comment || ""} onChange={(comment) => setForm({ ...form, comment })} className="md:col-span-2" required />
                </>
              )}

              <Select
                label="Status"
                value={form.status || (activeTab === "reviews" ? "PUBLISHED" : "DRAFT")}
                onChange={(nextStatus) => setForm({ ...form, status: nextStatus })}
                options={statusOptions.filter((option) => option.value !== "ALL")}
                searchable={false}
              />
              {activeTab === "packages" ? (
                <Input label="Sort Order" type="number" value={form.sort_order || "0"} onChange={(sort_order) => setForm({ ...form, sort_order })} />
              ) : <div />}
            </div>
            <div className="admin-modal-footer">
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit"><Eye className="h-4 w-4" /> Save {meta.title}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
