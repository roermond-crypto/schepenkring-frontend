"use client";

import {
  startTransition,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import {
  TrendingUp,
  Clock,
  AlertCircle,
  Bell,
  CheckCircle2,
  RefreshCcw,
  ArrowRight,
  Sailboat,
  Activity,
  AlertTriangle,
  CircleCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@/i18n/navigation";
import { normalizeRole } from "@/lib/auth/roles";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/client-session";

type DashboardData = {
  activeBidsCount: number;
  pendingTasks: number;
  fleetIntake: number;
  pendingRegistrations: number;
  totalSalesNumber: number;
  monthlyRevenue: number;
  conversionRate: number;
  avgDaysToSale: number;
  hasBoatListings: boolean;
  hasPlacedBids: boolean;
  brokerReviewCount: number;
  recentBids: DashboardYachtWithStatus[];
  recentRegistrations: any[];
  auditLogs: DashboardAuditItem[];
  trends: {
    activeBids: { change: number; sparkline: number[] };
    pendingTasks: { change: number; sparkline: number[] };
    fleetIntake: { change: number; sparkline: number[] };
    completedSales: { change: number; sparkline: number[] };
  };
};

type DashboardAuditItem = {
  id: number;
  action?: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: number | null;
  assigned_to?: number | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  description?: string;
  title?: string;
};

type DashboardTask = {
  status?: string | null;
};

type DashboardYacht = {
  id: number | string;
  name?: string | null;
  status?: string | null;
  price?: string | number | null;
  updated_at?: string | null;
  created_at?: string | null;
  current_bid?: string | number | null;
  vessel_id?: string | number | null;
  [key: string]: unknown;
};

type DashboardYachtWithStatus = DashboardYacht & {
  normalizedStatus: string;
};

function toNumericValue(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}

function CountUpNumber({
  value,
  duration = 700,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const totalFrames = Math.max(1, Math.round(duration / 16));
    const startValue = displayValue;
    const delta = value - startValue;

    const timer = setInterval(() => {
      frame += 1;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + delta * eased));
      if (progress === 1) clearInterval(timer);
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString("de-DE")}</>;
}

function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length === 0) {
    return (
      <div className="h-11 w-32 flex items-center justify-center">
        <div className="h-1 w-full bg-white/10 rounded-full animate-pulse" />
      </div>
    );
  }
  const data = points.map((p, i) => ({ name: `Day ${i + 1}`, value: p }));
  return (
    <div className="h-11 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="sparkStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-md bg-white p-1 text-xs shadow-lg text-[#0B1F3A] font-medium border border-slate-100 z-50 relative pointer-events-none">
                    Value: {payload[0].value}
                  </div>
                );
              }
              return null;
            }}
            cursor={{
              stroke: "white",
              strokeWidth: 1,
              strokeDasharray: "3 3",
              strokeOpacity: 0.5,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#60A5FA"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#sparkStroke)"
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function renderMarketplaceText(
  value: string,
  marketplace: (chunks: string) => ReactNode,
): ReactNode {
  const match = value.match(
    /^(.*)<marketplace>(.*)<\/marketplace>(.*)$/s,
  );

  if (!match) {
    return value;
  }

  const [, before, highlighted, after] = match;

  return (
    <>
      {before}
      {marketplace(highlighted)}
      {after}
    </>
  );
}

export default function AdminDashboardHome() {
  const t = useTranslations("DashboardAdminOverview");
  const params = useParams<{ role?: string }>();
  const role = normalizeRole(params?.role) ?? "admin";
  const dashboardBase = `/dashboard/${role}`;
  const marketplaceUrl = "https://www.schepenkring.nl/aanbod-boten/";
  const isAdminRole = role === "admin";
  const showAdminSalesInsights = role !== "client";
  const showAuditPanel = role !== "client";
  const defaultUserName = t("defaults.userName");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [welcomeName, setWelcomeName] = useState(defaultUserName);
  const [data, setData] = useState<DashboardData>({
    activeBidsCount: 0,
    pendingTasks: 0,
    fleetIntake: 0,
    pendingRegistrations: 0,
    totalSalesNumber: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
    avgDaysToSale: 0,
    hasBoatListings: false,
    hasPlacedBids: false,
    brokerReviewCount: 0,
    recentBids: [],
    recentRegistrations: [],
    auditLogs: [],
    trends: {
      activeBids: { change: 0, sparkline: [] },
      pendingTasks: { change: 0, sparkline: [] },
      fleetIntake: { change: 0, sparkline: [] },
      completedSales: { change: 0, sparkline: [] },
    },
  });
  const brokerReviewHeading =
    data.brokerReviewCount === 1
      ? t("empty.brokerReviewHeadingOne").replace(
          "{count}",
          String(data.brokerReviewCount),
        )
      : t("empty.brokerReviewHeadingOther").replace(
          "{count}",
          String(data.brokerReviewCount),
        );

  const fetchDashboardData = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    setIsRefreshing(true);
    try {
      const [
        yachtsRes,
        tasksRes,
        bidsRes,
        logsRes,
        summaryRes,
        unreadCountRes,
      ] = await Promise.allSettled([
        api.get("/yachts"),
        api.get("/tasks"),
        api.get("/bids?page=1"),
        api.get("/audit?per_page=5&sort_by=created_at&sort_dir=desc"),
        api.get("/dashboard/summary"),
        api.get("/notifications/unread-count"),
      ]);

      const yachts: DashboardYacht[] =
        yachtsRes.status === "fulfilled"
          ? normalizeList<DashboardYacht>(yachtsRes.value.data)
          : [];
      const tasks: DashboardTask[] =
        tasksRes.status === "fulfilled"
          ? normalizeList<DashboardTask>(tasksRes.value.data)
          : [];
      const bidsRaw =
        bidsRes.status === "fulfilled"
          ? normalizeList(bidsRes.value.data)
          : [];
      const auditLogs: DashboardAuditItem[] =
        logsRes.status === "fulfilled"
          ? normalizeList<DashboardAuditItem>(
              logsRes.value.data?.logs ?? logsRes.value.data,
            )
          : [];
      const unreadCount =
        unreadCountRes.status === "fulfilled"
          ? Number(
              unreadCountRes.value.data?.count ??
                unreadCountRes.value.data?.unread_count ??
                0,
            )
          : 0;

      const normalizeYachtStatus = (status: unknown) => {
        const normalized = String(status ?? "")
          .trim()
          .toLowerCase();
        if (!normalized) return "draft";

        const statusMap: Record<string, string> = {
          draft: "draft",
          "for sale": "for sale",
          for_sale: "for sale",
          "for bid": "for bid",
          for_bid: "for bid",
          sold: "sold",
          active: "active",
          inactive: "inactive",
          maintenance: "maintenance",
          published: "published",
        };

        return statusMap[normalized] || normalized;
      };

      const yachtsWithNormalizedStatus: DashboardYachtWithStatus[] = yachts.map(
        (yacht) => ({
          ...yacht,
          normalizedStatus: normalizeYachtStatus(yacht?.status),
        }),
      );

      const activeBids = yachtsWithNormalizedStatus.filter(
        (yacht) => yacht.normalizedStatus === "for bid",
      ).length;
      const pendingRegistrations = yachts.filter((y: any) => {
        const normalizedStatus = String(y?.status || "").toLowerCase();
        return (
          normalizedStatus === "draft" ||
          normalizedStatus === "pending" ||
          normalizedStatus === "pending_review" ||
          normalizedStatus === "pending review"
        );
      });
      const intake = yachtsWithNormalizedStatus.filter(
        (yacht) =>
          yacht.normalizedStatus === "draft" ||
          yacht.normalizedStatus === "for sale",
      ).length;
      const pending = tasks.filter((task) => task.status !== "Done").length;
      const soldYachts = yachtsWithNormalizedStatus.filter(
        (yacht) => yacht.normalizedStatus === "sold",
      );
      const brokerReviewCount = yachtsWithNormalizedStatus.filter(
        (yacht) => yacht.normalizedStatus === "draft",
      ).length;
      const now = new Date();

      const salesTotal = soldYachts.reduce(
        (sum, yacht) => sum + toNumericValue(yacht.price),
        0,
      );
      const monthlyRevenue = soldYachts
        .filter((yacht) => {
          const updatedAt = yacht.updated_at
            ? new Date(yacht.updated_at)
            : null;
          return (
            updatedAt &&
            updatedAt.getMonth() === now.getMonth() &&
            updatedAt.getFullYear() === now.getFullYear()
          );
        })
        .reduce((sum, yacht) => sum + toNumericValue(yacht.price), 0);
      const conversionRate =
        yachts.length > 0
          ? Math.round((soldYachts.length / yachts.length) * 100)
          : 0;
      const avgDaysToSale =
        soldYachts.length > 0
          ? Math.round(
              soldYachts.reduce((acc, yacht) => {
                const created = yacht.created_at
                  ? new Date(yacht.created_at)
                  : null;
                const updated = yacht.updated_at
                  ? new Date(yacht.updated_at)
                  : null;
                if (!created || !updated) return acc;
                return (
                  acc +
                  Math.max(
                    1,
                    Math.round(
                      (updated.getTime() - created.getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )
                );
              }, 0) / soldYachts.length,
            )
          : 0;

      const recentBids = yachtsWithNormalizedStatus
        .filter((yacht) => toNumericValue(yacht.current_bid) > 0)
        .sort(
          (left, right) =>
            new Date(String(right.updated_at ?? 0)).getTime() -
            new Date(String(left.updated_at ?? 0)).getTime(),
        )
        .slice(0, 3);
      const recentRegistrations = pendingRegistrations
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime(),
        )
        .slice(0, 4);

      startTransition(() => {
        setUnreadNotificationCount(unreadCount);
        setData({
          activeBidsCount: activeBids,
          pendingTasks: pending,
          fleetIntake: intake,
          pendingRegistrations: pendingRegistrations.length,
          totalSalesNumber: salesTotal,
          monthlyRevenue,
          conversionRate,
          avgDaysToSale,
          hasBoatListings: yachtsWithNormalizedStatus.length > 0,
          hasPlacedBids: Array.isArray(bidsRaw) && bidsRaw.length > 0,
          brokerReviewCount,
          recentBids,
          recentRegistrations,
          auditLogs: auditLogs.slice(0, 5),
          trends:
            summaryRes.status === "fulfilled" && summaryRes.value.data
              ? summaryRes.value.data
              : {
                  activeBids: { change: 0, sparkline: [] },
                  pendingTasks: { change: 0, sparkline: [] },
                  fleetIntake: { change: 0, sparkline: [] },
                  completedSales: { change: 0, sparkline: [] },
                },
        });
      });
    } catch (error) {
      console.error("Admin dashboard sync error:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(false), 300000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  useEffect(() => {
    const syncWelcomeName = () => {
      try {
        const rawUserData = localStorage.getItem("user_data");
        if (rawUserData) {
          const parsed = JSON.parse(rawUserData) as { name?: string };
          if (parsed.name) {
            setWelcomeName(parsed.name);
            return;
          }
        }
      } catch {
        // Ignore malformed local user cache.
      }

      const encoded = document.cookie
        .split("; ")
        .find((part) => part.startsWith(`${AUTH_SESSION_COOKIE}=`))
        ?.split("=")[1];

      if (!encoded) {
        setWelcomeName(defaultUserName);
        return;
      }

      try {
        const padded = encoded
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
        const parsed = JSON.parse(atob(padded)) as { name?: string };
        setWelcomeName(parsed.name || defaultUserName);
      } catch {
        setWelcomeName(defaultUserName);
      }
    };

    syncWelcomeName();
    window.addEventListener("focus", syncWelcomeName);
    window.addEventListener("storage", syncWelcomeName);

    return () => {
      window.removeEventListener("focus", syncWelcomeName);
      window.removeEventListener("storage", syncWelcomeName);
    };
  }, [defaultUserName]);

  const showClientBrokerReview =
    role === "client" &&
    !loading &&
    data.brokerReviewCount > 0 &&
    data.recentBids.length === 0 &&
    !data.hasPlacedBids;
  const showRecentBiddingPanel =
    role !== "client" ||
    (!showClientBrokerReview && (data.hasBoatListings || data.hasPlacedBids));
  const showClientOnboarding =
    role === "client" &&
    !loading &&
    !data.hasBoatListings &&
    !data.hasPlacedBids;

  const stats = [
    {
      label: t("stats.activeBids"),
      value: data.activeBidsCount,
      change: `${data.trends.activeBids.change > 0 ? "+" : ""}${data.trends.activeBids.change}%`,
      trendLabel: "this week",
      icon: TrendingUp,
      tone: "from-[#122746] to-[#1E3A8A]",
      link: `${dashboardBase}/yachts`,
      sparkline: data.trends.activeBids.sparkline,
      positive: data.trends.activeBids.change >= 0,
    },
    {
      label: t("stats.pendingManifest"),
      value: data.pendingTasks,
      change: `${data.trends.pendingTasks.change > 0 ? "+" : ""}${data.trends.pendingTasks.change}%`,
      trendLabel: "from yesterday",
      icon: Clock,
      tone: "from-[#0B1F3A] to-[#0F355E]",
      link: `${dashboardBase}/tasks`,
      sparkline: data.trends.pendingTasks.sparkline,
      positive: data.trends.pendingTasks.change <= 0,
    },
    {
      label: t("stats.fleetInIntake"),
      value: data.fleetIntake,
      change: `${data.trends.fleetIntake.change > 0 ? "+" : ""}${data.trends.fleetIntake.change}%`,
      trendLabel: "this week",
      icon: AlertCircle,
      tone: "from-[#122746] to-[#1E3A8A]",
      link: `${dashboardBase}/yachts`,
      sparkline: data.trends.fleetIntake.sparkline,
      positive: data.trends.fleetIntake.change >= 0,
    },
    {
      label: t("stats.completedSales"),
      value: data.totalSalesNumber,
      change: `${data.trends.completedSales.change > 0 ? "+" : ""}${data.trends.completedSales.change}%`,
      trendLabel: "this month",
      icon: CheckCircle2,
      tone: "from-[#0D2A4F] to-[#1E3A8A]",
      link: `${dashboardBase}/yachts`,
      sparkline: data.trends.completedSales.sparkline,
      positive: data.trends.completedSales.change >= 0,
      isCurrency: true,
    },
  ];

  const performanceSnapshot = [
    { label: t("snapshot.boatsInIntake"), value: data.fleetIntake, suffix: "" },
    {
      label: t("snapshot.avgDaysToSale"),
      value: 36,
      suffix: t("snapshot.daysSuffix"),
    },
    { label: t("snapshot.conversion"), value: 23, suffix: "%" },
    {
      label: t("snapshot.revenueThisMonth"),
      value: data.totalSalesNumber,
      suffix: "",
      isCurrency: true,
      target: Math.max(1, data.totalSalesNumber || 1),
    },
  ];

  const auditStatus = (task: DashboardAuditItem) => {
    const status = (task?.status || "").toLowerCase();
    if (status.includes("done") || status.includes("completed")) {
      return {
        icon: CircleCheck,
        dot: "bg-[#16A34A]",
        text: "text-[#16A34A]",
        label: t("audit.ok"),
      };
    }
    if (
      status.includes("warn") ||
      status.includes("pending") ||
      status.includes("progress")
    ) {
      return {
        icon: AlertTriangle,
        dot: "bg-[#F59E0B]",
        text: "text-[#F59E0B]",
        label: t("audit.warning"),
      };
    }
    if (
      status.includes("done") ||
      status.includes("completed") ||
      status.includes("created") ||
      status.includes("updated") ||
      status.includes("login")
    ) {
      return {
        icon: CircleCheck,
        dot: "bg-[#16A34A]",
        text: "text-[#16A34A]",
        label: t("audit.ok"),
      };
    }
    return {
      icon: CircleCheck,
      dot: "bg-[#16A34A]",
      text: "text-[#16A34A]",
      label: t("audit.ok"),
    };
  };

  return (
    <div className="space-y-7 p-2 sm:p-4 lg:p-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#BFD0EA] bg-gradient-to-r from-[#F4F8FF] via-[#EFF6FF] to-[#E6F1FF] p-6 shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:from-[#0f172a] dark:via-[#111827] dark:to-[#0b1220]">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#1E3A8A]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-24 w-24 rounded-tl-full bg-white/60 dark:bg-slate-700/40" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {t("welcomeBack", { name: welcomeName })}
            </p>
            <h1 className="text-3xl font-black text-[#0B1F3A] sm:text-4xl dark:text-slate-100">
              {role === "client"
                ? t("title_client")
                : role === "employee"
                  ? t("title_employee")
                  : t("title_admin")}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#1E3A8A] dark:text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-semibold dark:bg-slate-800/90 dark:text-slate-100">
                <Bell size={14} />
                {t("notificationSummary", { count: unreadNotificationCount })}
              </span>
              {isAdminRole && data.pendingRegistrations > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle size={14} />
                  {t("registrationSummary", {
                    count: data.pendingRegistrations,
                  })}
                </span>
              )}
              {isAdminRole && (
                <span className="font-semibold">
                  {t("activeBiddingItems", {
                    count: data.activeBidsCount,
                  })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("liveSync")}
            </p>
            <button
              onClick={() => fetchDashboardData(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C7D8F5] bg-white px-3 py-2 text-xs font-semibold text-[#0B1F3A] transition hover:border-[#1E3A8A] hover:text-[#1E3A8A] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-400 dark:hover:text-white"
            >
              <RefreshCcw
                size={14}
                className={cn(isRefreshing && "animate-spin")}
              />
              {t("refresh")}
            </button>
          </div>
        </div>
      </header>

      {showAdminSalesInsights && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, i) => (
              <Link href={stat.link} key={stat.label} passHref>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br p-6 text-white shadow-[0_16px_34px_rgba(11,31,58,0.2)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_38px_rgba(11,31,58,0.28)]",
                    stat.tone,
                  )}
                >
                  <stat.icon
                    size={92}
                    className="absolute -right-6 -bottom-5 rotate-12 opacity-10 transition-transform duration-500 group-hover:scale-110"
                  />

                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-white/20 p-2 backdrop-blur-md">
                        <stat.icon size={20} className="text-white" />
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          stat.positive
                            ? "bg-emerald-500/20 text-emerald-100"
                            : "bg-red-500/20 text-red-100",
                        )}
                      >
                        {stat.change} {stat.trendLabel}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                        {stat.label}
                      </p>
                      <h3 className="mt-1 text-4xl font-black leading-none">
                        {loading ? (
                          <span className="inline-block h-10 w-24 animate-pulse rounded-md bg-white/20" />
                        ) : stat.isCurrency ? (
                          new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 0,
                          }).format(stat.value as number)
                        ) : (
                          <CountUpNumber value={stat.value as number} />
                        )}
                      </h3>
                      <p className="mt-2 text-sm font-semibold text-white/90">
                        Weekly Trend
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/20 bg-black/10 px-2 py-1">
                      <Sparkline points={stat.sparkline} />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300"
                        style={{
                          width: `${Math.min(100, Math.max(8, (Number(stat.value) || 0) * 8))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center text-xs font-semibold text-white group-hover:text-amber-300 transition-colors duration-200">
                      View details
                      <ArrowRight
                        size={13}
                        className="ml-1 transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>

          <section className="rounded-2xl border border-[#CFDCF2] bg-white/80 p-6 shadow-[0_8px_28px_rgba(11,31,58,0.08)] backdrop-blur dark:border-slate-700 dark:bg-[#0f172a]/90">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("sections.businessInsights")}
                </p>
                <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                  {t("sections.performanceSnapshot")}
                </h2>
              </div>
              <Sparkles
                className="text-[#1E3A8A] dark:text-sky-300"
                size={18}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {performanceSnapshot.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800"
                >
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                    {item.isCurrency
                      ? new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                        }).format(item.value)
                      : `${item.value}${item.suffix}`}
                  </p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#16A34A]"
                      style={{
                        width: `${Math.min(100, Math.round((item.value / (item.target || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {isAdminRole && (
        <section className="rounded-2xl border border-[#CFDCF2] bg-white/90 p-6 shadow-[0_8px_28px_rgba(11,31,58,0.08)] backdrop-blur dark:border-slate-700 dark:bg-[#0f172a]/90">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("sections.businessInsights")}
              </p>
              <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                {t("sections.newRegistrations")}
              </h2>
            </div>
            <Link
              href={`${dashboardBase}/yachts`}
              className="inline-flex items-center gap-1 rounded-lg border border-[#BED0EE] bg-[#EFF4FF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#dfe9ff] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t("actions.reviewRegistrations")}
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mt-2 h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : data.recentRegistrations.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.recentRegistrations.map((yacht: any) => (
                <Link
                  key={yacht.id}
                  href={`${dashboardBase}/yachts/${yacht.id}?step=5`}
                  className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 transition hover:border-[#BBD0F2] hover:shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 dark:hover:border-slate-600"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                    {t("labels.submittedForReview")}
                  </p>
                  <p className="mt-2 text-base font-bold text-[#0B1F3A] dark:text-slate-100">
                    {yacht.boat_name || yacht.name || t("labels.unknown")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t("labels.registry")}:{" "}
                    {yacht.vessel_id || yacht.ref_code || t("labels.unknown")}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{yacht.status || t("labels.unknown")}</span>
                    <span>
                      {formatDistanceToNow(
                        new Date(
                          yacht.updated_at || yacht.created_at || Date.now(),
                        ),
                        { addSuffix: true },
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t("empty.noNewRegistrations")}
            </div>
          )}
        </section>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          showAuditPanel ? "xl:grid-cols-3" : "xl:grid-cols-1",
        )}
      >
        {showRecentBiddingPanel && (
          <div
            className={cn(
              "rounded-2xl border border-[#CFDCF2] bg-white p-7 shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:bg-slate-900",
              showAuditPanel && "xl:col-span-2",
            )}
          >
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("sections.marketPulse")}
                </p>
                <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                  {t("sections.recentBiddingActivity")}
                </h2>
              </div>
              <Link
                href={`${dashboardBase}/yachts`}
                className="inline-flex items-center gap-1 rounded-lg border border-[#BED0EE] bg-[#EFF4FF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#dfe9ff] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t("actions.viewBiddings")}
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-3">
              {loading &&
                Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-2 h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}

              {!loading &&
                data.recentBids.map((yacht, idx) => (
                  <motion.div
                    key={yacht.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 transition hover:border-[#BBD0F2] hover:shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 dark:hover:border-slate-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B1F3A] text-sm font-bold text-white">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-[#0B1F3A] dark:text-slate-100">
                          {yacht.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t("labels.registry")}:{" "}
                          {yacht.vessel_id || t("labels.unknown")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[#1E3A8A]">
                        €
                        {toNumericValue(yacht.current_bid).toLocaleString(
                          "de-DE",
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("labels.currentBid")}
                      </p>
                    </div>
                  </motion.div>
                ))}

              {!loading && data.recentBids.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#C6D6F2] bg-gradient-to-b from-[#F8FBFF] to-white p-10 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B1F3A]/10">
                    <Sailboat className="text-[#1E3A8A]" size={26} />
                  </div>
                  <p className="text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                    {t("empty.noRecentBiddingTitle")}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("empty.noRecentBiddingSubtitle")}
                  </p>
                  <Link
                    href={`${dashboardBase}/yachts`}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#112f58]"
                  >
                    {t("actions.viewBiddings")}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {showClientBrokerReview && (
          <div className="rounded-2xl border border-[#CFDCF2] bg-white p-7 shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("sections.marketPulse")}
                </p>
                <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                  {t("empty.brokerReviewTitle")}
                </h2>
              </div>
              <Link
                href={`${dashboardBase}/yachts`}
                className="inline-flex items-center gap-1 rounded-lg border border-[#BED0EE] bg-[#EFF4FF] px-3 py-2 text-sm font-semibold text-[#1E3A8A] transition hover:bg-[#dfe9ff] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t("actions.viewBoats")}
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-2xl border border-dashed border-[#C6D6F2] bg-gradient-to-b from-[#F8FBFF] to-white p-10 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B1F3A]/10">
                <Sailboat className="text-[#1E3A8A]" size={26} />
              </div>
              <p className="text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                {brokerReviewHeading}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("empty.brokerReviewSubtitle")}
              </p>
              <Link
                href={`${dashboardBase}/yachts`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#112f58]"
              >
                {t("actions.viewBoats")}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {showClientOnboarding && (
          <div className="rounded-2xl border border-[#CFDCF2] bg-white p-7 shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-6 border-b border-slate-100 pb-4 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("sections.marketPulse")}
              </p>
              <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                {t("empty.onboardingTitle")}
              </h2>
            </div>

            <div className="rounded-2xl border border-dashed border-[#C6D6F2] bg-gradient-to-b from-[#F8FBFF] to-white p-10 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B1F3A]/10">
                <Sailboat className="text-[#1E3A8A]" size={26} />
              </div>
              <p className="text-lg font-bold text-[#0B1F3A] dark:text-slate-100">
                {t("empty.onboardingHeading")}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {renderMarketplaceText(
                  t("empty.onboardingSubtitle"),
                  (chunks) => (
                    <a
                      href={marketplaceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-[#1E3A8A] dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-sky-300"
                    >
                      {chunks}
                    </a>
                  ),
                )}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`${dashboardBase}/yachts/new`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#112f58]"
                >
                  {t("actions.createFirstListing")}
                  <ArrowRight size={14} />
                </Link>
                <a
                  href={marketplaceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#C6D6F2] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] transition hover:border-[#1E3A8A] hover:text-[#1E3A8A] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400 dark:hover:text-sky-300"
                >
                  {t("actions.browseMarketplace")}
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </div>
        )}

        {showAuditPanel && (
          <div className="rounded-2xl border border-[#CFDCF2] bg-white p-7 shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("sections.liveDiagnostics")}
                </p>
                <h2 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
                  {t("sections.systemAudit")}
                </h2>
              </div>
              <Activity
                size={17}
                className="text-[#1E3A8A] dark:text-sky-300"
              />
            </div>
            <div className="space-y-4">
              {loading &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse rounded-lg border border-slate-100 p-3 dark:border-slate-700"
                  >
                    <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-2 h-2.5 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}

              {!loading &&
                data.auditLogs.slice(0, 5).map((task: DashboardAuditItem) => {
                  const status = auditStatus(task);
                  const auditHref = `${dashboardBase}/audit?logId=${task.id}`;
                  const StatusIcon = status.icon;
                  return (
                    <Link
                      key={task.id}
                      href={auditHref}
                      className="block rounded-xl border border-slate-200 p-3 transition hover:border-[#BBD0F2] hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 rounded-full p-1.5 text-white",
                            status.dot,
                          )}
                        >
                          <StatusIcon size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                            {task.description ||
                              task.title ||
                              task.event_type ||
                              task.action ||
                              t("audit.taskUpdate")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {task.entity_type ||
                              (task.assigned_to
                                ? t("audit.operatorAction")
                                : t("audit.autoSystemEvent"))}{" "}
                            {task.entity_id
                              ? `#${task.entity_id}`
                              : `${t("audit.on")} ${t("audit.globalFleet")}`}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                status.text,
                              )}
                            >
                              {status.label}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {formatDistanceToNow(
                                new Date(
                                  task.created_at ||
                                    task.updated_at ||
                                    Date.now(),
                                ),
                                {
                                  addSuffix: true,
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

              {!loading && data.auditLogs.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t("empty.noSystemLogs")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
