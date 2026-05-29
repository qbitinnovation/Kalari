"use client";

import React, { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import type { Notification } from "@/lib/database";

export type NotificationToast = {
  notification: Notification;
  toastKey: string;
};

type ToastItemProps = {
  toast: NotificationToast;
  darkMode: boolean;
  autoHideMs: number;
  onDismiss: (toastKey: string) => void;
  onOpen: (notification: Notification) => void;
};

const severityConfig = (severity?: string) => {
  switch (severity) {
    case "ERROR":
      return {
        icon: AlertTriangle,
        accent: "border-red-500/70 bg-red-50/95 dark:bg-red-950/50",
        iconClass: "text-red-600 dark:text-red-400",
        barClass: "bg-red-500",
      };
    case "WARNING":
      return {
        icon: AlertTriangle,
        accent: "border-amber-500/70 bg-amber-50/95 dark:bg-amber-950/45",
        iconClass: "text-amber-600 dark:text-amber-400",
        barClass: "bg-amber-500",
      };
    case "SUCCESS":
      return {
        icon: CheckCircle2,
        accent: "border-emerald-500/70 bg-emerald-50/95 dark:bg-emerald-950/45",
        iconClass: "text-emerald-600 dark:text-emerald-400",
        barClass: "bg-emerald-500",
      };
    default:
      return {
        icon: Info,
        accent: "border-sky-500/60 bg-sky-50/95 dark:bg-sky-950/45",
        iconClass: "text-sky-600 dark:text-sky-400",
        barClass: "bg-sky-500",
      };
  }
};

const NotificationToastItem = ({ toast, darkMode, autoHideMs, onDismiss, onOpen }: ToastItemProps) => {
  const { notification } = toast;
  const config = severityConfig(notification.severity);
  const Icon = config.icon;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.toastKey), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [autoHideMs, onDismiss, toast.toastKey]);

  return (
    <div
      role="alert"
      className={`admin-notification-toast overflow-hidden rounded-xl border shadow-lg backdrop-blur-md ${config.accent} ${darkMode ? "border-opacity-50 text-slate-100" : "text-slate-900"}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${config.iconClass}`} />
        <button
          type="button"
          onClick={() => {
            onDismiss(toast.toastKey);
            onOpen(notification);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-xs font-black leading-tight">{notification.title}</p>
          <p className="truncate text-[11px] font-medium leading-tight opacity-70">{notification.message}</p>
        </button>
        <button
          type="button"
          onClick={() => onDismiss(toast.toastKey)}
          className={`shrink-0 rounded p-0.5 transition-colors ${darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"}`}
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`h-0.5 ${config.barClass} admin-notification-toast-progress`} style={{ animationDuration: `${autoHideMs}ms` }} />
    </div>
  );
};

type AdminNotificationToastsProps = {
  toasts: NotificationToast[];
  darkMode: boolean;
  autoHideMs?: number;
  onDismiss: (toastKey: string) => void;
  onOpen: (notification: Notification) => void;
};

export function AdminNotificationToasts({
  toasts,
  darkMode,
  autoHideMs = 5000,
  onDismiss,
  onOpen,
}: AdminNotificationToastsProps) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-3 top-4 z-[100] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1.5 lg:right-6 lg:top-24"
    >
      {toasts.map((toast) => (
        <NotificationToastItem
          key={toast.toastKey}
          toast={toast}
          darkMode={darkMode}
          autoHideMs={autoHideMs}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
