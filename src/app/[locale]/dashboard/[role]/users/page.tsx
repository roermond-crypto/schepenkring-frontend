"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  UserPlus,
  Trash2,
  X,
  Loader2,
  Search,
  Eye,
  EyeOff,
  UserCircle,
  Briefcase,
  Anchor,
  LogIn,
  RefreshCw,
  MoreVertical,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  UsersRound,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { setClientSession } from "@/lib/auth/client-session";
import { useClientSession } from "@/components/session/ClientSessionProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserType = "ADMIN" | "EMPLOYEE" | "CLIENT";
type UserStatus = "ACTIVE" | "DISABLED" | "BLOCKED";
type UserCategory = "Employee" | "Admin" | "Partner" | "Customer";

type UserRecord = {
  id: number;
  type: UserType;
  role?: string;
  status: UserStatus;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  email: string;
  phone?: string | null;
  timezone?: string | null;
  locale?: string | null;
  two_factor_enabled?: boolean;
  last_login_at?: string | null;
  notifications_enabled?: boolean;
  email_notifications_enabled?: boolean;
  client_location_id?: number | null;
  client_location?: { id: number; name: string; code?: string | null } | null;
  locations?: Array<{
    id: number;
    name?: string;
    code?: string;
    role?: string;
  }>;
  created_at?: string;
  updated_at?: string;
};

type LocationOption = {
  id: number;
  name: string;
  code?: string | null;
};

type StatusUi = "Active" | "Inactive" | "Pending";

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const avatarColors: Record<UserCategory, string> = {
  Employee: "bg-blue-500",
  Admin: "bg-indigo-600",
  Partner: "bg-teal-500",
  Customer: "bg-amber-500",
};

const statusConfig: Record<
  StatusUi,
  { color: string; icon: LucideIcon; bg: string }
> = {
  Active: {
    color: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
  },
  Inactive: {
    color: "text-red-600 dark:text-red-300",
    icon: XCircle,
    bg: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900",
  },
  Pending: {
    color: "text-amber-600 dark:text-amber-300",
    icon: Clock,
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
  },
};

const tabConfig: { id: UserCategory; icon: LucideIcon }[] = [
  { id: "Employee", icon: Briefcase },
  { id: "Admin", icon: ShieldCheck },
  { id: "Partner", icon: Anchor },
  { id: "Customer", icon: UserCircle },
];

function mapTypeToCategory(type: UserType): UserCategory {
  if (type === "ADMIN") return "Admin";
  if (type === "EMPLOYEE") return "Employee";
  return "Customer";
}

function mapCategoryToType(category: UserCategory): UserType {
  if (category === "Admin") return "ADMIN";
  if (category === "Employee") return "EMPLOYEE";
  return "CLIENT";
}

function mapStatusToUi(status: UserStatus): StatusUi {
  if (status === "ACTIVE") return "Active";
  if (status === "BLOCKED") return "Pending";
  return "Inactive";
}

function mapUiToStatus(status: StatusUi): UserStatus {
  if (status === "Active") return "ACTIVE";
  if (status === "Pending") return "BLOCKED";
  return "DISABLED";
}

function mapTypeToRole(type: UserType) {
  if (type === "ADMIN") return "admin";
  if (type === "EMPLOYEE") return "employee";
  return "client";
}

function idempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      maybeResponse.response?.data?.message || maybeResponse.message || fallback
    );
  }
  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function RoleManagementPage() {
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const locale = useLocale();
  const t = useTranslations("DashboardAdminUsers");
  const { user: sessionUser } = useClientSession();
  const routeRole = params.role;
  const isEmployeeView = routeRole === "employee" || sessionUser.role === "employee";
  const canManageUsers = !isEmployeeView;
  const hasEmployeeLocation = Boolean(sessionUser.location_id);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UserCategory>(
    isEmployeeView ? "Customer" : "Employee",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<UserRecord | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<UserRecord | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [impersonating, setImpersonating] = useState(false);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    location_id: "",
    role: "Employee" as UserCategory,
    access_level: "Limited" as "Limited" | "Full",
    status: "Active" as StatusUi,
  });
  const syncFailedText = t("toasts.syncFailed");

  useEffect(() => {
    if (
      sessionUser.role === "employee" &&
      routeRole === "admin"
    ) {
      router.replace(`/${locale}/dashboard/employee/users`);
    }
  }, [locale, routeRole, router, sessionUser.role]);

  useEffect(() => {
    if (isEmployeeView) {
      setActiveTab("Customer");
    }
  }, [isEmployeeView]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isEmployeeView ? "/employee/users" : "/admin/users";
      const { data } = await api.get(endpoint, {
        params: isEmployeeView
          ? {
              search: searchQuery || undefined,
              per_page: 25,
            }
          : undefined,
      });
      const list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      setUsers(list);
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, syncFailedText));
    } finally {
      setLoading(false);
    }
  }, [isEmployeeView, searchQuery, syncFailedText]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!canManageUsers) return;
    let mounted = true;
    const fetchLocations = async () => {
      setLocationsLoading(true);
      try {
        const response = await api.get("/public/locations");
        const list = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        if (!mounted) return;
        setLocations(list);
      } catch {
        if (!mounted) return;
        setLocations([]);
      } finally {
        if (mounted) setLocationsLoading(false);
      }
    };
    void fetchLocations();
    return () => {
      mounted = false;
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers || locations.length === 0) return;
    setNewUser((prev) => {
      if (prev.location_id) return prev;
      return { ...prev, location_id: String(locations[0].id) };
    });
  }, [canManageUsers, locations]);

  useEffect(() => {
    const handler = () => setOpenActionId(null);
    if (openActionId !== null) {
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [openActionId]);

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      toast.loading(t("toasts.enrolling"), { id: "enroll" });
      const payload = {
        type: mapCategoryToType(newUser.role),
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        status: mapUiToStatus(newUser.status),
        location_id: newUser.location_id ? Number(newUser.location_id) : null,
      };
      const res = await api.post("/admin/users", payload);
      setUsers((prev) => [res.data?.data ?? res.data, ...prev]);
      setIsModalOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        location_id: locations[0] ? String(locations[0].id) : "",
        role: "Employee",
        access_level: "Limited",
        status: "Active",
      });
      toast.success(t("toasts.enrolled"), { id: "enroll" });
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, t("toasts.enrollmentFailed")), {
        id: "enroll",
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      toast.loading(t("toasts.terminating"), { id: "delete" });
      await api.delete(`/admin/users/${userId}`, {
        headers: { "Idempotency-Key": idempotencyKey() },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(t("toasts.terminated"), { id: "delete" });
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, t("toasts.terminationFailed")), {
        id: "delete",
      });
    }
  };

  const handleStatusToggle = async (user: UserRecord) => {
    const nextStatus: UserStatus =
      user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

    try {
      toast.loading(
        nextStatus === "ACTIVE"
          ? "Activating user..."
          : "Deactivating user...",
        { id: `status-${user.id}` },
      );

      const response = await api.patch(
        `/admin/users/${user.id}`,
        { status: nextStatus },
        { headers: { "Idempotency-Key": idempotencyKey() } },
      );

      const updated = response.data?.data ?? response.data;
      setUsers((prev) =>
        prev.map((entry) => (entry.id === user.id ? { ...entry, ...updated } : entry)),
      );

      toast.success(
        nextStatus === "ACTIVE"
          ? "User activated"
          : "User deactivated",
        { id: `status-${user.id}` },
      );
    } catch (err: unknown) {
      toast.error(
        extractErrorMessage(err, "Failed to update user status"),
        { id: `status-${user.id}` },
      );
    }
  };

  const impersonateUser = async (
    user: UserRecord,
    password: string,
    otp?: string,
  ) => {
    try {
      setImpersonating(true);
      toast.loading(t("toasts.assimilating"), { id: "impersonate" });
      const res = await api.post(
        `/admin/impersonate/${user.id}`,
        { password, otp_code: otp || undefined },
        { headers: { "Idempotency-Key": idempotencyKey() } },
      );

      const token = res.data?.token;
      const impersonated = res.data?.impersonated;
      if (!token || !impersonated)
        throw new Error(t("toasts.impersonationFailed"));

      setClientSession(token, {
        id: String(impersonated.id),
        name: impersonated.name,
        email: impersonated.email,
        role: mapTypeToRole(impersonated.type as UserType),
        type: impersonated.type as UserType,
        status: impersonated.status as UserStatus,
        phone: impersonated.phone ?? null,
        location_id: impersonated.location_id ?? null,
        location_role: impersonated.location_role ?? null,
        client_location_id: impersonated.client_location_id ?? null,
        has_location_assignment: impersonated.has_location_assignment ?? false,
        can_access_board: impersonated.can_access_board ?? false,
        location: impersonated.location ?? null,
        locations: Array.isArray(impersonated.locations)
          ? impersonated.locations
          : [],
      });

      localStorage.setItem(
        "impersonation_session",
        JSON.stringify({
          started_at: res.data?.session?.started_at,
          impersonated_id: impersonated.id,
          impersonated_name: impersonated.name,
        }),
      );

      toast.success(t("toasts.identityAssumed", { name: impersonated.name }), {
        id: "impersonate",
      });
      setImpersonateTarget(null);
      setAdminPassword("");
      setOtpCode("");
      setTimeout(() => {
        router.push(
          `/${locale}/dashboard/${mapTypeToRole(impersonated.type as UserType)}`,
        );
        router.refresh();
      }, 600);
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, t("toasts.impersonationFailed")), {
        id: "impersonate",
      });
    } finally {
      setImpersonating(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (isEmployeeView && (u.role === "employee" || u.role === "admin")) {
        return false;
      }
      const category = mapTypeToCategory(u.type);
      if (!isEmployeeView && category !== activeTab) return false;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, activeTab, isEmployeeView]);

  const roleCounts = useMemo(() => {
    const counts: Record<UserCategory, number> = {
      Employee: 0,
      Admin: 0,
      Partner: 0,
      Customer: 0,
    };
    users.forEach((u) => {
      if (isEmployeeView && (u.role === "employee" || u.role === "admin")) {
        return;
      }
      const category = mapTypeToCategory(u.type);
      counts[category] += 1;
    });
    return counts;
  }, [users, isEmployeeView]);

  return (
    <div className="min-h-screen max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-serif italic text-[#003566] dark:text-slate-100 sm:text-4xl">
            {t("header.title")}
          </h1>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-300">
            {t("header.subtitle")}
          </p>
        </div>
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={t("header.searchPlaceholder")}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-900"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManageUsers ? (
            <Button
              onClick={() => {
                setNewUser((prev) => ({
                  ...prev,
                  role: activeTab,
                  location_id:
                    prev.location_id || (locations[0] ? String(locations[0].id) : ""),
                }));
                setIsModalOpen(true);
              }}
              className="h-10 shrink-0 gap-2 rounded-lg bg-[#003566] px-5 text-xs font-bold tracking-wider text-white transition-colors hover:bg-[#002a52]"
            >
              <UserPlus size={15} />
              <span className="hidden sm:inline">{t("header.provisionNew")}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!hasEmployeeLocation && isEmployeeView ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
          No location assigned for this user.
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(isEmployeeView
          ? tabConfig.filter(({ id }) => id === "Customer")
          : tabConfig
        ).map(({ id, icon: Icon }) => {
          const count = roleCounts[id];
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                isActive
                  ? "border-[#003566] bg-[#003566] text-white shadow-lg shadow-[#003566]/20"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#003566]/30 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800",
                )}
              >
                <Icon
                  size={18}
                  className={
                    isActive
                      ? "text-white"
                      : "text-[#003566] dark:text-slate-200"
                  }
                />
              </div>
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold leading-none",
                    isActive
                      ? "text-white"
                      : "text-[#003566] dark:text-slate-100",
                  )}
                >
                  {count}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isActive
                      ? "text-white/70"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {t(`tabs.${id.toLowerCase()}`)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="hidden grid-cols-[1fr_1.25fr_190px_120px_80px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 md:grid dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("fields.fullName")}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("fields.emailAddress")}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isEmployeeView ? t("fields.location") : t("fields.clearance")}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("labels.status")}
          </p>
          <p className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {canManageUsers ? t("actions.terminate") : t("actions.refresh")}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2
              className="animate-spin text-[#003566] dark:text-slate-200"
              size={32}
            />
            <p className="text-sm text-slate-400">{t("labels.loadingUsers")}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <UsersRound size={36} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">
                {t("empty.title")}
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                {t("empty.description", {
                  role: t(`tabs.${activeTab.toLowerCase()}`).toLowerCase(),
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUsers.map((user, i) => {
              const status = statusConfig[mapStatusToUi(user.status)];
              const StatusIcon = status.icon;
              const category = mapTypeToCategory(user.type);

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group"
                >
                  <div className="hidden grid-cols-[1fr_1.25fr_190px_120px_80px] items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/80 md:grid dark:hover:bg-slate-800/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                          avatarColors[category] || "bg-slate-500",
                        )}
                      >
                        {initials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#003566] dark:text-slate-100">
                          {user.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {[user.first_name, user.last_name]
                            .filter(Boolean)
                            .join(" ") || "No profile name"}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {user.phone || "No phone"}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-500 dark:text-slate-300">
                        {user.email}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {user.client_location?.name ||
                          (user.locations?.length
                            ? `${user.locations.length} location(s)`
                            : "No location")}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        Last login: {formatDateTime(user.last_login_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {isEmployeeView ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          <Anchor size={11} />
                          {user.client_location?.name || "No location"}
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            <Shield size={11} />
                            {user.role || user.type}
                          </span>
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            {user.two_factor_enabled ? "2FA On" : "2FA Off"}
                          </span>
                        </>
                      )}
                    </div>

                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        status.bg,
                        status.color,
                      )}
                    >
                      <StatusIcon size={11} />
                      {mapStatusToUi(user.status)}
                    </span>

                    <div className="relative flex justify-end">
                      {canManageUsers ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId(
                                openActionId === user.id ? null : user.id,
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                          >
                            <MoreVertical size={16} />
                          </button>

                          <AnimatePresence>
                            {openActionId === user.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                              >
                                <button
                                  onClick={() => {
                                    router.push(
                                      `/${locale}/dashboard/admin/account?userId=${user.id}`,
                                    );
                                    setOpenActionId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <span className="inline-flex items-center gap-3">
                                    <UserCircle size={15} className="text-blue-500" />
                                    View account
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    void handleStatusToggle(user);
                                    setOpenActionId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <span className="inline-flex items-center gap-3">
                                    {user.status === "ACTIVE" ? (
                                      <XCircle size={15} className="text-red-500" />
                                    ) : (
                                      <CheckCircle2 size={15} className="text-emerald-500" />
                                    )}
                                    {user.status === "ACTIVE"
                                      ? "Set inactive"
                                      : "Set active"}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    setImpersonateTarget(user);
                                    setAdminPassword("");
                                    setOtpCode("");
                                    setOpenActionId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <span className="inline-flex items-center gap-3">
                                    <LogIn size={15} className="text-emerald-500" />
                                    {t("actions.assumeIdentity")}
                                  </span>
                                </button>
                                <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                                <button
                                  onClick={() => {
                                    setTerminateTarget(user);
                                    setOpenActionId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <span className="inline-flex items-center gap-3">
                                    <Trash2 size={15} />
                                    {t("actions.terminate")}
                                  </span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : (
                        <button
                          onClick={() => void fetchData()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                          title={t("actions.refresh")}
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="text-xs text-slate-400">
              {filteredUsers.length}{" "}
              {t(`tabs.${activeTab.toLowerCase()}`).toLowerCase()}
            </p>
            <button
              onClick={() => void fetchData()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#003566] hover:text-blue-700 dark:text-slate-200 dark:hover:text-slate-100"
            >
              <RefreshCw size={12} />
              {t("actions.refresh")}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {canManageUsers && isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            >
              <div className="bg-[#003566] px-6 pb-5 pt-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("modal.title")}
                    </h2>
                    <p className="mt-1 text-sm text-blue-200">
                      {t("modal.subtitle")}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleEnrollment} className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.fullName")}
                    </label>
                    <input
                      required
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.emailAddress")}
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    {t("fields.systemPassword")}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.assignment")}
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          role: e.target.value as UserCategory,
                        })
                      }
                    >
                      <option value="Employee">{t("tabs.employee")}</option>
                      <option value="Admin">{t("tabs.admin")}</option>
                      <option value="Customer">{t("tabs.customer")}</option>
                      <option value="Partner">{t("tabs.partner")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.location")}
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.location_id}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          location_id: e.target.value,
                        })
                      }
                      required
                      disabled={locationsLoading || locations.length === 0}
                    >
                      <option value="">{t("options.selectLocation")}</option>
                      {locations.map((location) => (
                        <option key={location.id} value={String(location.id)}>
                          {location.name}
                          {location.code ? ` (${location.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.clearance")}
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.access_level}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          access_level: e.target.value as "Limited" | "Full",
                        })
                      }
                    >
                      <option value="Limited">{t("options.limited")}</option>
                      <option value="Full">{t("options.full")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      {t("fields.accountStatus")}
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-all focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800"
                      value={newUser.status}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          status: e.target.value as StatusUi,
                        })
                      }
                    >
                      <option value="Active">{t("options.active")}</option>
                      <option value="Inactive">{t("options.inactive")}</option>
                      <option value="Pending">{t("options.pending")}</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-[#003566] text-sm font-semibold text-white shadow-lg shadow-[#003566]/20 transition-colors hover:bg-[#002a52]"
                >
                  {t("actions.finalizeEnrollment")}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Dialog
        open={Boolean(impersonateTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonateTarget(null);
            setAdminPassword("");
            setOtpCode("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-[#003566] dark:text-slate-100">
              {t("actions.assumeIdentity")}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {impersonateTarget
                ? `You are about to impersonate ${impersonateTarget.name}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                {t("prompts.confirmAdminPassword")}
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                {t("prompts.enterOtp")}
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 dark:border-slate-700 dark:bg-slate-800"
                placeholder="123456"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImpersonateTarget(null);
                setAdminPassword("");
                setOtpCode("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!impersonateTarget || !adminPassword.trim() || impersonating}
              onClick={() => {
                if (!impersonateTarget) return;
                void impersonateUser(
                  impersonateTarget,
                  adminPassword.trim(),
                  otpCode.trim() || undefined,
                );
              }}
              className="bg-[#003566] text-white hover:bg-[#002a52]"
            >
              {impersonating ? "Please wait..." : t("actions.assumeIdentity")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(terminateTarget)}
        onOpenChange={(open) => {
          if (!open) setTerminateTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#003566] dark:text-slate-100">
              {t("actions.terminate")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              {terminateTarget
                ? `This will disable ${terminateTarget.name}'s account access.`
                : t("confirm.terminate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTerminateTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!terminateTarget) return;
                void handleDeleteUser(terminateTarget.id);
                setTerminateTarget(null);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t("actions.terminate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
