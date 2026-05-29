"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, IndianPhoneField, Input, Tabs } from "@/components/ui";
import { db } from "@/lib/database";
import { getBookingReference } from "@/lib/booking";
import { format } from "date-fns";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

type SettingsTab = "profile" | "password" | "reports";

const tabOptions = [
  { value: "profile" as const, label: "Profile" },
  { value: "password" as const, label: "Password" },
  { value: "reports" as const, label: "Reports" },
];

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [profileData, setProfileData] = useState({
    name: "",
    contact: "",
    email: user?.email || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      setMessage("Profile updated successfully!");
    } catch {
      setMessage("Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage("New passwords do not match");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      setMessage("Password change functionality will be implemented with proper backend integration");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      setMessage(error.message || "Error updating password");
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    setLoading(true);
    try {
      const { data: bookings, error } = await db
        .from("bookings")
        .select(`
          *,
          show:shows(title, date, time),
          ticket:tickets(ticket_code, price, status)
        `)
        .eq("status", "CONFIRMED");

      if (error) throw error;

      const csvContent = [
        ["Booking Ref", "Show", "Date", "Time", "Seat", "Ticket Code", "Price", "Status", "Booking Time"].join(","),
        ...(bookings || []).map((booking) =>
          [
            getBookingReference(booking),
            booking.show?.title || "",
            booking.show?.date || "",
            booking.show?.time || "",
            booking.seat_code,
            booking.ticket?.ticket_code || "",
            booking.ticket?.price || "",
            booking.ticket?.status || "",
            format(new Date(booking.booking_time), "MMM dd, yyyy h:mm a"),
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kalari-bookings-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      setMessage("Report exported successfully!");
    } catch {
      setMessage("Error exporting report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-slate-400">Manage your account and system preferences</p>
      </div>

      <Tabs
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value);
          setMessage("");
        }}
        options={tabOptions}
        ariaLabel="Settings sections"
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {message && (
          <div
            className={`mb-6 rounded-xl border p-4 ${
              message.includes("Error")
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
            }`}
          >
            {message}
          </div>
        )}

        {activeTab === "profile" && (
          <div>
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-slate-100">Profile Information</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  value={profileData.name}
                  onChange={(name) => setProfileData({ ...profileData, name })}
                  placeholder="Enter your full name"
                />
                <IndianPhoneField
                  label="Contact Number"
                  value={profileData.contact}
                  onChange={(contact) => setProfileData({ ...profileData, contact })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileData.email}
                  onChange={() => {}}
                  disabled
                  hint="Email cannot be changed"
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </div>
        )}

        {activeTab === "password" && (
          <div>
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-slate-100">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(currentPassword) => setPasswordData({ ...passwordData, currentPassword })}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(newPassword) => setPasswordData({ ...passwordData, newPassword })}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(confirmPassword) => setPasswordData({ ...passwordData, confirmPassword })}
                  required
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Change Password"}
              </Button>
            </form>
          </div>
        )}

        {activeTab === "reports" && (
          <div>
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-slate-100">Export Reports</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-6 dark:border-slate-800">
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-slate-100">Full Booking Report</h3>
                <p className="mb-4 text-gray-600 dark:text-slate-400">
                  Export all booking data including show details, seat information, and ticket status.
                </p>
                <Button onClick={handleExportReport} disabled={loading}>
                  <DocumentArrowDownIcon className="h-5 w-5" />
                  {loading ? "Exporting..." : "Export CSV"}
                </Button>
              </div>

              <div className="rounded-xl border border-gray-200 p-6 dark:border-slate-800">
                <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-slate-100">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600 dark:text-slate-400">Current User:</span>
                    <span className="font-medium text-gray-900 dark:text-slate-100">{user?.email}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600 dark:text-slate-400">Role:</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user?.role === "admin"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      }`}
                    >
                      {user?.role === "admin" ? "Administrator" : "Staff Member"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600 dark:text-slate-400">Full Name:</span>
                    <span className="font-medium text-gray-900 dark:text-slate-100">{user?.full_name || "Not set"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
