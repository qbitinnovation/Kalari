"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Eye, Mail, MessageSquare, Reply, X } from "lucide-react";
import { db, type ContactMessage } from "@/lib/database";
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
  Textarea,
} from "@/components/ui";
import { formatDisplayDateValue, formatDisplayTimeValue, formatTimeValue } from "@/components/ui/date-utils";
import { toDisplayTitle } from "@/lib/textFormat";

const recordId = (row: ContactMessage) => row.id || String(row._id || "");

const timestamp = (value?: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Date not set";
  return `${formatDisplayDateValue(date)} ${formatDisplayTimeValue(formatTimeValue(date.getHours(), date.getMinutes()))}`;
};

export default function MessagesPage() {
  const darkMode = useDarkMode();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await db.from("contact_messages").select("*").order("created_at", { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    setAdminNote(selected?.admin_note || "");
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((message) => {
      const matchesStatus = status === "ALL" || message.status === status;
      const haystack = `${message.name} ${message.email} ${message.phone || ""} ${message.message}`.toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [messages, query, status]);

  const updateMessage = async (message: ContactMessage, patch: Partial<ContactMessage>) => {
    const next = { ...patch, updated_at: new Date().toISOString() };
    await db.from("contact_messages").update(next).eq("id", recordId(message));
    setMessages((current) => current.map((item) => (recordId(item) === recordId(message) ? { ...item, ...next } : item)));
    setSelected((current) => (current && recordId(current) === recordId(message) ? { ...current, ...next } : current));
  };

  const openMessage = async (message: ContactMessage) => {
    setSelected(message);
    if (message.status === "NEW") {
      await updateMessage(message, { status: "READ" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={`text-3xl font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Messages</h1>
          <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Review website contact enquiries and internal follow-up notes.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <SearchInput value={query} onChange={setQuery} placeholder="Search messages..." containerClassName="sm:w-80" />
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All Status" },
              { value: "NEW", label: "New" },
              { value: "READ", label: "Read" },
              { value: "REPLIED", label: "Replied" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
            searchable={false}
            className="sm:w-44"
          />
        </div>
      </div>

      <AdminTablePanel>
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Sender</AdminTableHeaderCell>
              <AdminTableHeaderCell>Message</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Received</AdminTableHeaderCell>
              <AdminTableHeaderCell align="right">Action</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {loading ? (
              <AdminTableSkeleton columns={5} leadColumn="avatar" />
            ) : filtered.length === 0 ? (
              <AdminTableEmpty colSpan={5}>No messages to display.</AdminTableEmpty>
            ) : (
              filtered.map((message) => (
                <AdminTableRow key={recordId(message)}>
                  <AdminTableCell>
                    <div className="font-black text-slate-950 dark:text-slate-100">{toDisplayTitle(message.name)}</div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-500">{message.email}</div>
                    {message.phone ? <div className="truncate text-xs font-semibold text-slate-500">{message.phone}</div> : null}
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="max-w-xl truncate font-semibold text-slate-700 dark:text-slate-300">{message.message}</div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      message.status === "NEW" ? "bg-amber-100 text-amber-800" :
                      message.status === "REPLIED" ? "bg-emerald-100 text-emerald-800" :
                      message.status === "ARCHIVED" ? "bg-slate-100 text-slate-600" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {toDisplayTitle(message.status)}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>{timestamp(message.created_at)}</AdminTableCell>
                  <AdminTableCell align="right">
                    <Button size="sm" variant="ghost" onClick={() => openMessage(message)}>
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTablePanel>

      {selected && (
        <div className="admin-modal-overlay !items-stretch !justify-end !p-0">
          <aside className="admin-modal-panel flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none bg-white shadow-2xl dark:bg-slate-900 sm:rounded-l-2xl">
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-subtitle">Website enquiry</p>
                <h2 className="admin-modal-title">{toDisplayTitle(selected.name)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="admin-modal-close" aria-label="Close details">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="admin-modal-body space-y-5">
              <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500">
                  <Mail className="h-4 w-4" /> Sender
                </h3>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Name</span><span className="font-semibold">{toDisplayTitle(selected.name)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Email</span><span className="font-semibold">{selected.email}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Phone</span><span className="font-semibold">{selected.phone || "Not provided"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Received</span><span className="font-semibold">{timestamp(selected.created_at)}</span></div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500">
                  <MessageSquare className="h-4 w-4" /> Message
                </h3>
                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700 dark:text-slate-300">{selected.message}</p>
              </section>
              <Textarea label="Internal Note" value={adminNote} onChange={setAdminNote} placeholder="Add follow-up notes for staff..." rows={5} />
            </div>
            <div className="admin-modal-footer flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => updateMessage(selected, { admin_note: adminNote, status: "ARCHIVED" })}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
              <Button variant="secondary" onClick={() => updateMessage(selected, { admin_note: adminNote, status: "REPLIED" })}>
                <Reply className="h-4 w-4" /> Mark Replied
              </Button>
              <Button onClick={() => updateMessage(selected, { admin_note: adminNote, status: selected.status === "NEW" ? "READ" : selected.status })}>
                <CheckCircle2 className="h-4 w-4" /> Save Note
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
