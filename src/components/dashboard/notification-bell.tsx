"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import type { UserRole } from "@/lib/auth/roles";
import { apiRequest } from "@/lib/api/http";

type NotificationBellProps = {
  locale: AppLocale;
  role: UserRole;
};

type NotificationItem = {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type BackendNotification = {
  id: number | string;
  read?: boolean;
  pivot?: { read?: boolean };
  notification?: {
    message?: string;
    title?: string;
    created_at?: string;
    data?: { sender_name?: string };
  };
  sender?: { name?: string };
  message?: string;
  created_at?: string;
};

const humanizeDate = (
  value: string | undefined,
  t: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  },
) => {
  if (!value) return t.justNow;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t.justNow;

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return `${minutes}${t.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t.hoursAgo}`;
  const days = Math.floor(hours / 24);
  return `${days}${t.daysAgo}`;
};

const mapBackendNotification = (
  item: BackendNotification,
  t: {
    defaultSender: string;
    defaultMessage: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  },
): NotificationItem => {
  const read = Boolean(item.read ?? item.pivot?.read ?? false);
  const message = item.notification?.message ?? item.message ?? t.defaultMessage;
  const sender = item.sender?.name ?? item.notification?.data?.sender_name ?? t.defaultSender;
  const createdAt = humanizeDate(item.notification?.created_at ?? item.created_at, t);

  return {
    id: String(item.id),
    sender,
    message,
    createdAt,
    read,
  };
};

export function NotificationBell({ locale, role }: NotificationBellProps) {
  const dictionary = getDictionary(locale);
  const t = dictionary.dashboard.notifications;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "1",
      sender: t.defaultSender,
      message: t.fallbackLead,
      createdAt: `2${t.minutesAgo}`,
      read: false,
    },
    {
      id: "2",
      sender: "Admin",
      message: t.fallbackExport,
      createdAt: `14${t.minutesAgo}`,
      read: false,
    },
    {
      id: "3",
      sender: "CRM",
      message: t.fallbackProfile,
      createdAt: `1${t.hoursAgo}`,
      read: true,
    },
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const notificationsPath = `/${locale}/dashboard/${role}/emails`;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await apiRequest<
        { data?: BackendNotification[] } | BackendNotification[]
      >({
        url: "/notifications",
        method: "GET",
      });

      const list = Array.isArray(payload) ? payload : payload.data ?? [];
      if (list.length > 0) {
        setNotifications(list.slice(0, 5).map((item) => mapBackendNotification(item, t)));
      }
    } catch {
      // Keep fallback notifications when endpoint is unavailable.
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;

    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchNotifications, open]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#d6e1ee] bg-white text-[#0B1F3A] transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={t.label}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-[#C9D8EE] bg-white p-0 shadow-[0_24px_48px_rgba(11,31,58,0.25)] dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                {t.title}
              </h3>
              <Link
                href={notificationsPath}
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {t.viewAll}
              </Link>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto bg-[#FBFDFF] dark:bg-slate-900">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.loading}
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={notificationsPath}
                  onClick={() => setOpen(false)}
                  className="block border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7F0FF] text-xs font-semibold text-[#0B1F3A] dark:bg-slate-700 dark:text-slate-100">
                      {item.sender.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                          {item.sender}
                        </p>
                        {!item.read ? (
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-600 dark:text-slate-300">
                        {item.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-slate-400">
                        {item.createdAt}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-slate-600" />
                <p className="text-sm">{t.empty}</p>
              </div>
            )}
          </div>

          {notifications.length > 0 ? (
            <div className="border-t border-slate-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={markAllRead}
                className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {t.markAllRead}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
