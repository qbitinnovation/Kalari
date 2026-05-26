"use client";

import React, { useState, useEffect } from "react";
import { db, Show, Layout, type Agent } from "@/lib/database";
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
import { getDefaultArenaStructure } from "@/lib/arenaLayout";
import { toDisplayTitle } from "@/lib/textFormat";
import { formatDisplayDateValue, formatDisplayTimeValue } from "@/components/ui/date-utils";
import { getAgentContact, getAgentDisplayName } from "@/lib/agentCommission";
import {
  Button,
  AdminTable,
  AdminTableBody,
  AdminTableEmpty,
  AdminTableHead,
  AdminTablePanel,
  DatePicker,
  TimePicker,
  Input,
  Select,
  Tabs,
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
  const [activities, setActivities] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
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
    type: "KALARI" as "KALARI" | "EVENT",
    capacity: "",
    layout_id: "",
    activity_id: "",
    agent_id: "",
    agent_commission_percentage: "",
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
    fetchActivities();
    fetchAgents();
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
        const showDateTime = new Date(`${show.date}T${show.time}`);
        const now = new Date();
        const thirtyMinutesAfterShow = new Date(
          showDateTime.getTime() + 30 * 60 * 1000,
        );

        if (now > thirtyMinutesAfterShow && show.status !== "SHOW_DONE") {
          await db
            .from("shows")
            .update({ status: "SHOW_DONE" })
            .eq("id", show.id || (show as any)._id);
          await db
            .from("tickets")
            .update({ status: "COMPLETED" })
            .eq("show_id", show.id || (show as any)._id)
            .in("status", ["ACTIVE"]);
        } else if (
          now > showDateTime &&
          now <= thirtyMinutesAfterShow &&
          show.status === "ACTIVE"
        ) {
          await db
            .from("shows")
            .update({ status: "SHOW_STARTED" })
            .eq("id", show.id || (show as any)._id);
        } else if (now > showDateTime && show.status === "HOUSE_FULL") {
          await db
            .from("shows")
            .update({ status: "SHOW_DONE" })
            .eq("id", show.id || (show as any)._id);
          await db
            .from("tickets")
            .update({ status: "COMPLETED" })
            .eq("show_id", show.id || (show as any)._id)
            .in("status", ["ACTIVE"]);
        } else if (show.status === "ACTIVE") {
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
      if (show.type === "EVENT") {
        totalSeats = show.capacity || 0;
      } else if (show.layout) {
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

  const fetchActivities = async () => {
    try {
      const { data } = await db
        .from("activities")
        .select("*")
        .order("title", { ascending: true });
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await db
        .from("agents")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      const legacy = await db
        .from("users")
        .select("*")
        .eq("role", "agent")
        .eq("active", true)
        .order("full_name", { ascending: true });
      const legacyAgents = (legacy.data || []).map((agent: any) => ({
        ...agent,
        name: agent.full_name,
        phone: agent.phone || agent.email,
        payout_frequency: "MONTHLY",
      }));
      const existingIds = new Set((data || []).map((agent: any) => String(agent.id || agent._id)));
      setAgents([...(data || []), ...legacyAgents.filter((agent: any) => !existingIds.has(String(agent.id || agent._id)))]);
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const layoutId =
        formData.type === "KALARI"
          ? formData.layout_id || await ensureDefaultKalariLayoutId()
          : null;
      const showData = {
        title: formData.title,
        date: formData.date,
        time: formData.time,
        price: parseFloat(formData.price),
        image: formData.image,
        description: formData.description,
        type: formData.type,
        capacity:
          formData.type === "EVENT" ? parseInt(formData.capacity) : null,
        layout_id: layoutId,
        activity_id: formData.activity_id || null,
        agent_id: formData.type === "EVENT" ? formData.agent_id || null : null,
        agent_commission_percentage:
          formData.type === "EVENT" ? Number(formData.agent_commission_percentage || 0) : 0,
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
      type: show.type || "KALARI",
      capacity: show.capacity?.toString() || "",
      layout_id: show.layout_id || "",
      activity_id: (show as any).activity_id || "",
      agent_id: show.agent_id || "",
      agent_commission_percentage: String(show.agent_commission_percentage || (show as any).commission_percentage || ""),
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
      type: "KALARI",
      capacity: "",
      layout_id: findDefaultKalariLayoutId(layouts),
      activity_id: "",
      agent_id: "",
      agent_commission_percentage: "",
      status: "ACTIVE",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

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
                  Layout/Type
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
              {shows.length === 0 ? (
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
                        {show.type === "EVENT"
                          ? `Event (${show.capacity} seats)`
                          : toDisplayTitle(show.layout?.name || "Kalari")}
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
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(show)}
                          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(show.id || (show as any)._id)
                          }
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
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
                  Choose a layout for Kalari shows or a ticket limit for event
                  slots.
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
              <Tabs
                ariaLabel="Show type"
                value={formData.type}
                onChange={(type) =>
                  setFormData({
                    ...formData,
                    type,
                    layout_id: type === "KALARI"
                      ? formData.layout_id || findDefaultKalariLayoutId(layouts)
                      : formData.layout_id,
                  })
                }
                options={[
                  { value: "KALARI", label: "Kalari" },
                  { value: "EVENT", label: "Event" },
                ]}
                className="mb-5"
              />
              <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Title"
                value={formData.title}
                onChange={(title) => setFormData({ ...formData, title })}
                required
              />
              <Select
                label="Linked Activity"
                value={formData.activity_id || "__none__"}
                onChange={(activity_id) =>
                  setFormData({
                    ...formData,
                    activity_id: activity_id === "__none__" ? "" : activity_id,
                  })
                }
                placeholder="No linked activity"
                options={[
                  { value: "__none__", label: "No linked activity" },
                  ...activities.map((activity) => ({
                    value: String(activity.id || activity._id),
                    label: activity.title,
                  })),
                ]}
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
              {formData.type === "KALARI" ? (
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
              ) : (
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <Input
                    label="Ticket Limit"
                    type="number"
                    value={formData.capacity}
                    onChange={(capacity) =>
                      setFormData({ ...formData, capacity })
                    }
                    required
                  />
                  <Select
                    label="Linked Agent"
                    value={formData.agent_id || "__none__"}
                    onChange={(agent_id) =>
                      setFormData({
                        ...formData,
                        agent_id: agent_id === "__none__" ? "" : agent_id,
                      })
                    }
                    placeholder="No linked agent"
                    options={[
                      { value: "__none__", label: "No linked agent" },
                      ...agents.map((agent) => ({
                        value: String(agent.id || agent._id),
                        label: `${getAgentDisplayName(agent)}${getAgentContact(agent) ? ` (${getAgentContact(agent)})` : ""}`,
                      })),
                    ]}
                    searchable={agents.length > 3}
                  />
                  <Input
                    label="Event Commission (%)"
                    type="number"
                    value={formData.agent_commission_percentage}
                    onChange={(agent_commission_percentage) =>
                      setFormData({ ...formData, agent_commission_percentage })
                    }
                    placeholder="0"
                  />
                </div>
              )}
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
