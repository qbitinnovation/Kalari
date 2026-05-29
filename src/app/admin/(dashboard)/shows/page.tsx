"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db, Show, Layout } from "@/lib/database";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  logShowDeletion,
  logShowCreation,
  logShowUpdate,
} from "@/utils/activityLogger";
import { useAuth } from "@/contexts/AuthContext";
import { activityImages } from "@/lib/seedData";
import { isActiveBookingReservation } from "@/lib/booking";
import { resolveShowStatus } from "@/lib/catalogLifecycle";
import { canBookShow, getAdminBookingUrl } from "@/lib/adminBooking";
import { getDefaultArenaStructure } from "@/lib/arenaLayout";
import { toDisplayTitle } from "@/lib/textFormat";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";
import {
  Button,
  AdminTable,
  AdminTableBody,
  AdminTableEmpty,
  AdminTableHead,
  AdminTablePanel,
  AdminTableSkeleton,
  DatePicker,
  TimePicker,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const DEFAULT_KALARI_LAYOUT_ID = "layout-main-arena";
const DEFAULT_KALARI_LAYOUT_NAME = "Main Kalari Arena";
const layoutRecordId = (layout: Layout) =>
  String(layout.id || (layout as Layout & { _id?: string })._id || "");
const findDefaultKalariLayoutId = (layouts: Layout[]) =>
  layoutRecordId(
    layouts.find((layout) => layoutRecordId(layout) === DEFAULT_KALARI_LAYOUT_ID) ||
      layouts.find((layout) => layout.name === DEFAULT_KALARI_LAYOUT_NAME) ||
      ({} as Layout),
  );
const Shows: React.FC = () => {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [allShows, setAllShows] = useState<Show[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const darkMode = useDarkMode();
  const [showModal, setShowModal] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    price: "",
    image: activityImages.kalari,
    description: "",
    layout_id: "",
    status: "ACTIVE" as "ACTIVE" | "HOUSE_FULL" | "SHOW_STARTED" | "SHOW_DONE",
  });
  const showStatusLabels: Record<string, string> = {
    ACTIVE: "Active",
    HOUSE_FULL: "House Full",
    SHOW_STARTED: "Show Started",
    SHOW_DONE: "Show Done",
  };

  useEffect(() => {
    fetchShows();
    fetchLayouts();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const filteredShows = allShows.filter(
        (show) => show.date === selectedDate,
      );
      setShows(filteredShows);
    } else {
      setShows(allShows);
    }
  }, [selectedDate, allShows]);

  const fetchShows = async () => {
    try {
      const { data, error } = await db
        .from("shows")
        .select(
          `
          *,
          layout:layouts(*)
        `,
        )
        .order("date", { ascending: false });

      if (error) throw error;

      if (data) {
        await checkAndUpdateShowStatuses(data);
        const { data: updatedData } = await db
          .from("shows")
          .select(
            `
            *,
            layout:layouts(*)
          `,
          )
          .order("date", { ascending: false });
        setAllShows(updatedData || []);
        setShows(updatedData || []);
      } else {
        setAllShows([]);
        setShows([]);
      }
    } catch (error) {
      console.error("Error fetching shows:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndUpdateShowStatuses = async (shows: Show[]) => {
    for (const show of shows) {
      try {
        const nextStatus = resolveShowStatus(show);

        if (nextStatus !== show.status) {
          await db
            .from("shows")
            .update({ status: nextStatus })
            .eq("id", show.id || (show as any)._id);
          if (nextStatus === "SHOW_DONE") {
            await db
              .from("tickets")
              .update({ status: "COMPLETED" })
              .eq("show_id", show.id || (show as any)._id)
              .in("status", ["ACTIVE"]);
          }
          continue;
        }

        if (show.status === "ACTIVE") {
          const isHouseFull = await checkIfHouseFull(show);
          if (isHouseFull) {
            await db
              .from("shows")
              .update({ status: "HOUSE_FULL" })
              .eq("id", show.id || (show as any)._id);
          }
        }
      } catch (error) {
        console.error(`Error processing show status:`, error);
      }
    }
  };

  const checkIfHouseFull = async (show: Show) => {
    try {
      let totalSeats = 0;
      if (show.layout) {
        totalSeats =
          show.layout.structure.sections?.reduce(
            (total: number, section: any) => {
              if (section.rows && Array.isArray(section.rows)) {
                return (
                  total +
                  section.rows.reduce(
                    (sum: number, row: any) => sum + (row.seats || 0),
                    0,
                  )
                );
              }
              return total + (section.rows || 0) * (section.seatsPerRow || 0);
            },
            0,
          ) || 0;
      }

      const { data: bookings } = await db
        .from("bookings")
        .select("seat_code")
        .eq("show_id", show.id || (show as any)._id)
        .in("status", ["CONFIRMED", "HELD"]);
      const bookedSeatsCount =
        bookings?.reduce((count: number, booking: any) => {
          if (!isActiveBookingReservation(booking)) return count;
          try {
            const seats = JSON.parse(booking.seat_code);
            return count + (Array.isArray(seats) ? seats.length : 1);
          } catch {
            return (
              count +
              (booking.seat_code.includes(",")
                ? booking.seat_code.split(",").length
                : 1)
            );
          }
        }, 0) || 0;

      return bookedSeatsCount >= totalSeats;
    } catch (error) {
      console.error("Error checking if house is full:", error);
      return false;
    }
  };

  const fetchLayouts = async () => {
    try {
      const { data, error } = await db
        .from("layouts")
        .select("*")
        .order("name");
      if (error) throw error;
      setLayouts(data || []);
    } catch (error) {
      console.error("Error fetching layouts:", error);
    }
  };

  const ensureDefaultKalariLayoutId = async () => {
    const existingDefaultId = findDefaultKalariLayoutId(layouts);
    if (existingDefaultId) return existingDefaultId;

    const { data, error } = await db.from("layouts").insert([{
      id: DEFAULT_KALARI_LAYOUT_ID,
      name: DEFAULT_KALARI_LAYOUT_NAME,
      structure: getDefaultArenaStructure(),
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;

    const defaultLayout = (data || [])[0] as Layout | undefined;
    const defaultLayoutId = defaultLayout ? layoutRecordId(defaultLayout) : DEFAULT_KALARI_LAYOUT_ID;
    setLayouts((current) => defaultLayout ? [...current, defaultLayout] : current);
    return defaultLayoutId || DEFAULT_KALARI_LAYOUT_ID;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const layoutId = formData.layout_id || await ensureDefaultKalariLayoutId();
      const showData = {
        title: formData.title,
        date: formData.date,
        time: formData.time,
        price: parseFloat(formData.price),
        image: formData.image,
        description: formData.description,
        type: "KALARI",
        capacity: null,
        layout_id: layoutId,
        activity_id: null,
        agent_id: null,
        agent_commission_percentage: 0,
        status: formData.status,
      };

      const userEmail = user?.email || "unknown";

      if (editingShow) {
        const showId = editingShow.id || (editingShow as any)._id;
        const { error } = await db
          .from("shows")
          .update(showData)
          .eq("id", showId);
        if (error) throw error;
        await logShowUpdate(showId, showData.title, userEmail, {
          updated_at: new Date().toISOString(),
        });
      } else {
        const { data: newShow, error } = await db
          .from("shows")
          .insert([showData])
          .select();
        if (error) throw error;
        if (newShow?.[0]) {
          const newId = newShow[0].id || newShow[0]._id;
          await logShowCreation(newId, showData.title, userEmail, {
            created_at: new Date().toISOString(),
          });
        }
      }

      setShowModal(false);
      setEditingShow(null);
      resetForm();
      await fetchShows();
    } catch (error) {
      console.error("Error saving show:", error);
    }
  };

  const handleEdit = (show: Show) => {
    setEditingShow(show);
    setFormData({
      title: show.title,
      date: show.date,
      time: show.time,
      price: show.price.toString(),
      image: show.image || activityImages.kalari,
      description: show.description || "",
      layout_id: show.layout_id || "",
      status: (show.status as any) || "ACTIVE",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this show?")) {
      try {
        const { data: showToDelete } = await db
          .from("shows")
          .select("title, date, time")
          .eq("id", id)
          .single();
        const { error } = await db.from("shows").delete().eq("id", id);
        if (error) throw error;

        if (showToDelete) {
          const userEmail = user?.email || "unknown";
          await logShowDeletion(id, showToDelete.title, userEmail, {
            deleted_at: new Date().toISOString(),
          });
        }
        fetchShows();
      } catch (error) {
        console.error("Error deleting show:", error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      date: "",
      time: "",
      price: "",
      image: activityImages.kalari,
      description: "",
      layout_id: findDefaultKalariLayoutId(layouts),
      status: "ACTIVE",
    });
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-semibold transition-colors duration-200 ${darkMode ? "text-slate-100" : "text-slate-900"}`}
          >
            Shows
          </h1>
          <p
            className={`mt-1 text-sm transition-colors duration-200 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
          >
            Manage show timings and schedules
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
          <DatePicker
            label="Filter by Date"
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="All dates"
            presets={[
              { label: "Clear", value: "clear" },
              { label: "Today", value: "today" },
            ]}
            className="w-full sm:w-64"
          />
          <Button
            onClick={() => {
              resetForm();
              setEditingShow(null);
              setShowModal(true);
            }}
            className="touch-manipulation sm:self-end"
          >
            <Plus className="h-5 w-5" />
            Add Show
          </Button>
        </div>
      </div>

      <AdminTablePanel>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                  Show Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                  Layout
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {loading ? (
                <AdminTableSkeleton columns={6} leadColumn="avatar" />
              ) : shows.length === 0 ? (
                <AdminTableEmpty colSpan={6}>No shows found.</AdminTableEmpty>
              ) : (
                shows.map((show) => (
                  <tr
                    key={show.id || (show as any)._id}
                    className={
                      darkMode ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                    }
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={show.image || activityImages.kalari}
                          alt={toDisplayTitle(show.title)}
                          className="h-12 w-16 rounded-lg object-cover"
                        />
                        <div>
                          <div className="font-medium">{toDisplayTitle(show.title)}</div>
                          <div className="text-sm opacity-60">
                            {toDisplayTitle(show.description)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{formatDisplayDateValue(show.date)}</div>
                      <div className="text-sm opacity-60">
                        {formatDisplayTimeValue(show.time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">₹{show.price}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm">
                        {toDisplayTitle(show.layout?.name || "Kalari")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          show.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : show.status === "HOUSE_FULL"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {showStatusLabels[show.status || ""] || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {canBookShow(show) ? (
                          <Link href={getAdminBookingUrl({ showId: show.id || String((show as any)._id) })}>
                            <Button size="sm">Book Now</Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled>
                            Book Now
                          </Button>
                        )}
                        <button
                          onClick={() => handleEdit(show)}
                          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          aria-label="Edit show"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(show.id || (show as any)._id)
                          }
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                          aria-label="Delete show"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </AdminTableBody>
          </AdminTable>
      </AdminTablePanel>

      {showModal && (
        <div className="admin-modal-overlay">
          <form
            onSubmit={handleSubmit}
            className="admin-modal-panel admin-modal-card"
          >
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">
                  {editingShow ? "Edit Show" : "Add Show"}
                </h2>
                <p className="admin-modal-subtitle">
                  Schedule a Kalari show with date, time, and arena layout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="admin-modal-close"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Title"
                value={formData.title}
                onChange={(title) => setFormData({ ...formData, title })}
                required
              />
              <DatePicker
                label="Date"
                value={formData.date}
                onChange={(date) => setFormData({ ...formData, date })}
                required
              />
              <TimePicker
                label="Time"
                value={formData.time}
                onChange={(time) => setFormData({ ...formData, time })}
                required
              />
              <Input
                label="Price (Rs.)"
                type="number"
                value={formData.price}
                onChange={(price) => setFormData({ ...formData, price })}
                required
              />
              <Select
                label="Status"
                value={formData.status}
                onChange={(status) =>
                  setFormData({
                    ...formData,
                    status: status as typeof formData.status,
                  })
                }
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "HOUSE_FULL", label: "Sold Out / House Full" },
                  { value: "SHOW_STARTED", label: "Show Started" },
                  { value: "SHOW_DONE", label: "Show Done" },
                ]}
              />
              <Input
                label="Image URL"
                type="url"
                value={formData.image}
                onChange={(image) => setFormData({ ...formData, image })}
                placeholder="https://..."
                required
                className="md:col-span-2"
              />
              <Select
                label="Layout"
                value={formData.layout_id || "__none__"}
                onChange={(layout_id) =>
                  setFormData({
                    ...formData,
                    layout_id: layout_id === "__none__" ? "" : layout_id,
                  })
                }
                placeholder="Use default Kalari layout"
                options={[
                  { value: "__none__", label: "Use default Kalari layout" },
                  ...layouts.map((l) => ({
                    value: String(l.id || (l as { _id?: string })._id),
                    label: l.name,
                  })),
                ]}
                className="md:col-span-2"
              />
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(description) =>
                  setFormData({ ...formData, description })
                }
                rows={4}
                className="md:col-span-2"
              />
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Show</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Shows;
