"use client";

import { useEffect, useState } from "react";
import {
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Rss,
  Ship,
  FileSignature,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

interface PublishingHealth {
  publishable_boats: number;
  exported_boats: number;
  failed_exports: number;
  platforms_with_errors: number;
  platforms_healthy: number;
  platforms_total: number;
  last_feed_generated_at: string | null;
  last_validation_error_at: string | null;
  signhost_pending: number;
  draft_boats_in_export: number;
  sold_boats_in_export: number;
  broken_image_count: number;
  overall_status: "healthy" | "warning" | "critical";
}

interface PublishingHealthWidgetProps {
  dashboardBase: string;
  locale: string;
}

const STATUS_CONFIG = {
  healthy: { label: "Gezond", color: "text-green-600", bg: "bg-green-50 border-green-200", dot: "bg-green-500" },
  warning: { label: "Waarschuwing", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  critical: { label: "Kritiek", color: "text-red-600", bg: "bg-red-50 border-red-200", dot: "bg-red-500" },
};

function StatCard({
  icon,
  label,
  value,
  subtext,
  alertLevel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtext?: string;
  alertLevel?: "ok" | "warning" | "error";
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-1",
      alertLevel === "error" ? "border-red-200 bg-red-50" :
      alertLevel === "warning" ? "border-yellow-200 bg-yellow-50" :
      "border-slate-200 bg-white"
    )}>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <span className={cn(
          alertLevel === "error" ? "text-red-500" :
          alertLevel === "warning" ? "text-yellow-600" :
          "text-slate-400"
        )}>{icon}</span>
        {label}
      </div>
      <p className={cn(
        "text-2xl font-black",
        alertLevel === "error" ? "text-red-700" :
        alertLevel === "warning" ? "text-yellow-700" :
        "text-slate-800"
      )}>{value}</p>
      {subtext && <p className="text-[10px] text-slate-400">{subtext}</p>}
    </div>
  );
}

export function PublishingHealthWidget({ dashboardBase, locale }: PublishingHealthWidgetProps) {
  const [health, setHealth] = useState<PublishingHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get<PublishingHealth>("/admin/publishing/health");
      setHealth(res.data);
    } catch {
      // Endpoint may not exist yet — gracefully hide the widget
      setHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={16} className="animate-spin" /> Publicatiestatus laden...
        </div>
      </div>
    );
  }

  if (!health) return null;

  const statusCfg = STATUS_CONFIG[health.overall_status] ?? STATUS_CONFIG.warning;
  const lastFeedDate = health.last_feed_generated_at
    ? new Date(health.last_feed_generated_at).toLocaleDateString(`${locale}-${locale.toUpperCase()}`, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  const hasCriticalIssues = health.draft_boats_in_export > 0 || health.sold_boats_in_export > 0;
  const hasWarnings = health.broken_image_count > 0 || health.failed_exports > 0;

  return (
    <div className="rounded-2xl border border-[#CFDCF2] bg-white/90 p-6 shadow-[0_8px_28px_rgba(11,31,58,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
        <div>
          <p className="text-sm text-slate-500">Systeem status</p>
          <h2 className="text-xl font-black text-[#0B1F3A] flex items-center gap-2">
            <Radio size={18} className="text-indigo-600" />
            Publicatie & Export Gezondheid
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Overall status badge */}
          <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold", statusCfg.bg, statusCfg.color)}>
            <span className={cn("w-2 h-2 rounded-full", statusCfg.dot)} />
            {statusCfg.label}
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Critical alerts */}
      {hasCriticalIssues && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 space-y-1.5">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
            <XCircle size={12} /> Kritieke problemen gedetecteerd
          </p>
          {health.draft_boats_in_export > 0 && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={10} /> {health.draft_boats_in_export} concept-boot(en) staan in de live export
            </p>
          )}
          {health.sold_boats_in_export > 0 && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={10} /> {health.sold_boats_in_export} verkochte boot(en) staan nog in de export
            </p>
          )}
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<Ship size={12} />}
          label="Publiceerbaar"
          value={health.publishable_boats}
          subtext="Goedgekeurde boten"
          alertLevel="ok"
        />
        <StatCard
          icon={<Rss size={12} />}
          label="Geëxporteerd"
          value={health.exported_boats}
          subtext={`van ${health.publishable_boats} boten`}
          alertLevel={health.exported_boats < health.publishable_boats ? "warning" : "ok"}
        />
        <StatCard
          icon={<XCircle size={12} />}
          label="Export mislukt"
          value={health.failed_exports}
          subtext="Herprobeert automatisch"
          alertLevel={health.failed_exports > 0 ? "error" : "ok"}
        />
        <StatCard
          icon={<Activity size={12} />}
          label="Platforms met fouten"
          value={`${health.platforms_with_errors}/${health.platforms_total}`}
          subtext={`${health.platforms_healthy} gezond`}
          alertLevel={health.platforms_with_errors > 0 ? (health.platforms_with_errors > 1 ? "error" : "warning") : "ok"}
        />
        <StatCard
          icon={<FileSignature size={12} />}
          label="Signhost openstaand"
          value={health.signhost_pending}
          subtext="Wachten op ondertekening"
          alertLevel={health.signhost_pending > 5 ? "warning" : "ok"}
        />
        <StatCard
          icon={<CheckCircle2 size={12} />}
          label="Kapotte afbeeldingen"
          value={health.broken_image_count}
          alertLevel={health.broken_image_count > 0 ? "warning" : "ok"}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1 sm:col-span-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Laatste feed gegenereerd</p>
          <p className="text-sm font-bold text-slate-700">
            {lastFeedDate ?? "Nog niet gegenereerd"}
          </p>
          {health.last_validation_error_at && (
            <p className="text-[10px] text-yellow-600 flex items-center gap-1">
              <AlertTriangle size={9} />
              Laatste validatiefout: {new Date(health.last_validation_error_at).toLocaleDateString(`${locale}-${locale.toUpperCase()}`, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
        <Link
          href={`${dashboardBase}/platforms`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <Radio size={11} /> Platforms beheren <ArrowRight size={10} />
        </Link>
        <Link
          href={`${dashboardBase}/yachts`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Ship size={11} /> Vloot bekijken <ArrowRight size={10} />
        </Link>
        <Link
          href={`${dashboardBase}/audit`}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Activity size={11} /> Audit log <ArrowRight size={10} />
        </Link>
      </div>
    </div>
  );
}
