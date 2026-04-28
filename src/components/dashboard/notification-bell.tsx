"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import type { UserRole } from "@/lib/auth/roles";
import { apiRequest } from "@/lib/api/http";
import { cn } from "@/lib/utils";

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
  href?: string;
};

type BackendNotificationData = {
  sender_name?: string;
  url?: string;
  entity_type?: string;
  entity_id?: number | string;
  sign_request_id?: number | string;
};

type BackendNotification = {
  id: number | string;
  read?: boolean;
  read_at?: string | null;
  pivot?: { read?: boolean; read_at?: string | null };
  notification?: {
    message?: string;
    title?: string;
    created_at?: string;
    data?: BackendNotificationData;
  };
  sender?: { name?: string };
  message?: string;
  created_at?: string;
};

export const OPEN_DASHBOARD_NOTIFICATIONS_EVENT = "dashboard:open-notifications";

const resolveNotificationHref = (
  item: BackendNotification,
  role: UserRole,
): string | undefined => {
  const data = item.notification?.data;
  const entityType = String(data?.entity_type ?? "").toLowerCase();
  const entityId = data?.entity_id;
  const signRequestId = data?.sign_request_id;

  if (
    (entityType === "vessel" || entityType === "yacht" || entityType === "boat") &&
    entityId !== undefined &&
    entityId !== null &&
    entityId !== ""
  ) {
    const params = new URLSearchParams({ step: "6" });
    if (signRequestId !== undefined && signRequestId !== null && signRequestId !== "") {
      params.set("sign_request_id", String(signRequestId));
    }

    return `/dashboard/${role}/yachts/${String(entityId)}?${params.toString()}`;
  }

  if (
    (entityType === "task" || entityType.endsWith("\\task")) &&
    entityId !== undefined &&
    entityId !== null &&
    entityId !== ""
  ) {
    const params = new URLSearchParams({ task: String(entityId) });
    return `/dashboard/${role}/tasks?${params.toString()}`;
  }

  const rawUrl = typeof data?.url === "string" ? data.url.trim() : "";
  const taskUrlMatch = rawUrl.match(/^\/dashboard\/tasks\/([^/?#]+)$/i);
  if (taskUrlMatch?.[1]) {
    const params = new URLSearchParams({ task: taskUrlMatch[1] });
    return `/dashboard/${role}/tasks?${params.toString()}`;
  }

  if (rawUrl === "/dashboard/tasks") {
    return `/dashboard/${role}/tasks`;
  }

  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }

  return undefined;
};

const humanizeDate = (
  value: string | undefined,
  t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string },
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

const mapNotification = (
  item: BackendNotification,
  t: {
    defaultSender: string;
    defaultMessage: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  },
  role: UserRole,
): NotificationItem => ({
  id: String(item.id),
  sender:
    item.sender?.name ??
    item.notification?.data?.sender_name ??
    t.defaultSender,
  message: item.notification?.message ?? item.message ?? t.defaultMessage,
  createdAt: humanizeDate(item.notification?.created_at ?? item.created_at, t),
  read: Boolean(item.read ?? item.pivot?.read ?? false),
  href: resolveNotificationHref(item, role),
});

export function NotificationBell({ locale, role }: NotificationBellProps) {
  const router = useRouter();
  const dictionary = getDictionary(locale);
  const t = dictionary.dashboard.notifications;
  const text = {
    title: t.title,
    viewAll: t.viewAll,
    loading: t.loading,
    empty: t.empty,
    markAllRead: t.markAllRead,
    enableNotifications: "Enable notifications",
    notificationsOff: "Notifications off",
    masterSwitch: "Master switch",
    toastAlerts: "In-app popups",
    browserPush: "Browser push",
    on: "On",
    off: "Off",
    delete: "Delete",
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(true);
  const [browserPushEnabled, setBrowserPushEnabled] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  useEffect(() => {
    const notifPref = localStorage.getItem("notifications_enabled");
    const pushPref = localStorage.getItem("push_alerts_enabled");
    const browserPref = localStorage.getItem("browser_push_enabled");

    if (notifPref !== null) setNotificationsEnabled(notifPref === "true");
    if (pushPref !== null) setPushAlertsEnabled(pushPref === "true");
    if (browserPref !== null) setBrowserPushEnabled(browserPref === "true");
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!notificationsEnabled) return;

    try {
      setLoading(true);
      const payload = await apiRequest<
        { data?: BackendNotification[] } | BackendNotification[]
      >({
        url: "/notifications",
        method: "GET",
      });

      const list = Array.isArray(payload) ? payload : (payload.data ?? []);
      setNotifications(
        list.slice(0, 10).map((entry) => mapNotification(entry, t, role)),
      );
    } catch {
      // Keep UI stable even when endpoint is unavailable.
    } finally {
      setLoading(false);
    }
  }, [notificationsEnabled, role, t]);

  useEffect(() => {
    if (!open || !notificationsEnabled) return;
    void fetchNotifications();
  }, [fetchNotifications, notificationsEnabled, open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOpen = () => {
      setOpen(true);
    };

    window.addEventListener(OPEN_DASHBOARD_NOTIFICATIONS_EVENT, handleOpen);
    return () =>
      window.removeEventListener(OPEN_DASHBOARD_NOTIFICATIONS_EVENT, handleOpen);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiRequest({ url: `/notifications/${id}/read`, method: "POST" });
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
    } catch {
      // Ignore endpoint errors to avoid breaking interaction.
    }
  };

  const markAllAsRead = async () => {
    const previous = notifications;
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    try {
      await apiRequest({ url: "/notifications/read-all", method: "POST" });
    } catch {
      try {
        await Promise.all(
          previous
            .filter((item) => !item.read)
            .map((item) =>
              apiRequest({
                url: `/notifications/${item.id}/read`,
                method: "POST",
              }),
            ),
        );
      } catch {
        setNotifications(previous);
      }
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiRequest({ url: `/notifications/${id}`, method: "DELETE" });
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // Ignore endpoint errors to avoid breaking interaction.
    }
  };

  const deleteAllNotifications = async () => {
    const previous = notifications;
    setNotifications([]);

    try {
      setDeletingAll(true);
      await apiRequest({ url: "/notifications", method: "DELETE" });
    } catch {
      try {
        await Promise.all(
          previous.map((item) =>
            apiRequest({
              url: `/notifications/${item.id}`,
              method: "DELETE",
            }),
          ),
        );
      } catch {
        setNotifications(previous);
      }
    } finally {
      setDeletingAll(false);
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem("notifications_enabled", String(next));
    if (!next) setNotifications([]);
  };

  const togglePushAlerts = () => {
    const next = !pushAlertsEnabled;
    setPushAlertsEnabled(next);
    localStorage.setItem("push_alerts_enabled", String(next));
  };

  const toggleBrowserPush = () => {
    const next = !browserPushEnabled;
    setBrowserPushEnabled(next);
    localStorage.setItem("browser_push_enabled", String(next));
  };

  const openNotification = (item: NotificationItem) => {
    if (!item.href) return;

    setOpen(false);
    setNotifications((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
    );
    void markAsRead(item.id);
    router.push(item.href);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#d6e1ee] bg-white text-[#0B1F3A] transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={t.label}
      >
        {notificationsEnabled ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5 opacity-60" />
        )}
        {notificationsEnabled && unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[360px] overflow-hidden rounded-2xl border border-[#C9D8EE] bg-white p-0 shadow-[0_24px_48px_rgba(11,31,58,0.25)] dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                  {text.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount > 0
                    ? `${unreadCount} unread updates`
                    : "All caught up"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {notificationsEnabled && notifications.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void markAllAsRead()}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-label={text.markAllRead}
                      title={text.markAllRead}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAllNotifications()}
                      disabled={deletingAll}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      aria-label="Delete all"
                      title="Delete all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                {/* <Link
                  href={notificationsPath}
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {text.viewAll}
                </Link> */}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <ToggleRow
              label={text.masterSwitch}
              desc={text.enableNotifications}
              checked={notificationsEnabled}
              onToggle={toggleNotifications}
              text={text}
            />
            {notificationsEnabled ? (
              <>
                <ToggleRow
                  label={text.toastAlerts}
                  desc="Toggle toast alerts"
                  checked={pushAlertsEnabled}
                  onToggle={togglePushAlerts}
                  text={text}
                />
                <ToggleRow
                  label={text.browserPush}
                  desc="Desktop and mobile push"
                  checked={browserPushEnabled}
                  onToggle={toggleBrowserPush}
                  text={text}
                />
              </>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto bg-[#FBFDFF] dark:bg-slate-900">
            {!notificationsEnabled ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                <BellOff className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-slate-600" />
                <p className="text-sm">{text.notificationsOff}</p>
              </div>
            ) : loading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {text.loading}
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800",
                    item.href && "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                  )}
                  onClick={() => openNotification(item)}
                  onKeyDown={(event) => {
                    if (!item.href) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openNotification(item);
                    }
                  }}
                  role={item.href ? "button" : undefined}
                  tabIndex={item.href ? 0 : undefined}
                  aria-label={item.href ? `Open notification: ${item.message}` : undefined}
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
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-400 dark:text-slate-400">
                          {item.createdAt}
                        </p>
                        <div className="flex items-center gap-2">
                          {!item.read ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void markAsRead(item.id);
                              }}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              {text.markAllRead}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteNotification(item.id);
                            }}
                            className="text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-300"
                          >
                            {text.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-slate-600" />
                <p className="text-sm">{text.empty}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onToggle,
  text,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
  text: { on: string; off: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium text-[#0B1F3A] dark:text-slate-100">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-6 w-11 items-center rounded-full px-1 transition-colors",
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
        <span className="sr-only">{checked ? text.on : text.off}</span>
      </button>
    </div>
  );
}
