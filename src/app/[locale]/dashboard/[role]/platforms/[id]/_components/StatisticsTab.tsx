"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, ExternalLink, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ComingSoonTab } from "./ComingSoonTab";

interface PlatformHealth {
  source: string;
  last_successful_export: string | null;
  last_sync: string | null;
  last_successful_api_call: string | null;
  last_failed_sync: string | null;
  success_rate_7d: number | null;
  success_rate_30d: number | null;
  total_exported_yachts: number;
  waiting_exports: number;
  failed_exports: number;
  last_error: string | null;
  avg_export_duration_ms: number | null;
}

function StatCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "default" | "warning" | "danger" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          "text-2xl font-black mt-1",
          tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-slate-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DeepLinkButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      {label} <ExternalLink size={12} />
    </button>
  );
}

export function StatisticsTab({ platformId }: { platformId: number | null }) {
  const t = useTranslations("Platforms.statistics");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadHealth = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get<PlatformHealth>(`/admin/platforms/${id}/health`);
      setHealth(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (platformId) void loadHealth(platformId);
  }, [platformId]);

  const goToAudit = (extra: Record<string, string>) => {
    const url = new URL(`${root}/audit`, window.location.origin);
    url.searchParams.set("entity_type", "platform");
    url.searchParams.set("entity_id", String(platformId));
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    router.push(url.pathname + url.search);
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : t("never");

  if (!platformId) {
    return <ComingSoonTab icon={Clock} title={t("comingSoonTitle")} body={t("comingSoonBody")} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error || !health) {
    return <p className="text-sm text-red-600">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label={t("stats.lastSuccessfulExport")} value={fmt(health.last_successful_export)} />
        <StatCard label={t("stats.lastSync")} value={fmt(health.last_sync)} />
        <StatCard label={t("stats.lastSuccessfulApiCall")} value={fmt(health.last_successful_api_call)} />
        <StatCard label={t("stats.lastFailedSync")} value={fmt(health.last_failed_sync)} tone={health.last_failed_sync ? "warning" : "default"} />
        <StatCard
          label={t("stats.successRate7d")}
          value={health.success_rate_7d === null ? t("noData") : `${health.success_rate_7d}%`}
          tone={health.success_rate_7d !== null && health.success_rate_7d < 80 ? "danger" : "default"}
        />
        <StatCard
          label={t("stats.successRate30d")}
          value={health.success_rate_30d === null ? t("noData") : `${health.success_rate_30d}%`}
          tone={health.success_rate_30d !== null && health.success_rate_30d < 80 ? "danger" : "default"}
        />
        <StatCard label={t("stats.totalExported")} value={health.total_exported_yachts} />
        <StatCard label={t("stats.waitingExports")} value={health.waiting_exports} tone={health.waiting_exports > 0 ? "warning" : "default"} />
        <StatCard label={t("stats.failedExports")} value={health.failed_exports} tone={health.failed_exports > 0 ? "danger" : "default"} />
        <StatCard label={t("stats.avgDuration")} value={t("notTracked")} />
      </div>

      {health.last_error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{t("stats.lastError")}</p>
            <p className="mt-0.5 text-xs">{health.last_error}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-[11px] font-black text-[#003566] uppercase tracking-[0.25em]">{t("deepLinks.title")}</p>
        <div className="flex flex-wrap gap-2">
          <DeepLinkButton onClick={() => goToAudit({})} label={t("deepLinks.viewAllActivity")} />
          <DeepLinkButton
            onClick={() => goToAudit({ action: "platform.publication.failed,platform.export.feed_failed" })}
            label={t("deepLinks.viewFailedExports")}
          />
          <DeepLinkButton
            onClick={() => goToAudit({ action: "platform.publication.synced,platform.export.feed_generated" })}
            label={t("deepLinks.viewSyncHistory")}
          />
          <DeepLinkButton
            onClick={() => goToAudit({ action: "platform.test_connection" })}
            label={t("deepLinks.viewConnectionTests")}
          />
        </div>
      </div>
    </div>
  );
}
