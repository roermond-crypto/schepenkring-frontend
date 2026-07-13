"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  GitBranch,
  History,
  LayoutDashboard,
  Loader2,
  Plug,
  RefreshCw,
  Route,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { OverviewTab } from "./_components/OverviewTab";
import { ConnectionsTab } from "./_components/ConnectionsTab";
import { MappingEditorTab } from "./_components/MappingEditorTab";
import { PreviewTab } from "./_components/PreviewTab";
import { ValidationTab } from "./_components/ValidationTab";
import { ConflictsTab } from "./_components/ConflictsTab";
import { RunsTab } from "./_components/RunsTab";
import { JourneyTab } from "./_components/JourneyTab";
import type { SyncStatus } from "./_types";

type TabId = "overview" | "connections" | "mapping" | "preview" | "validation" | "conflicts" | "runs" | "journey";
const TAB_IDS: TabId[] = ["overview", "connections", "mapping", "preview", "validation", "conflicts", "runs", "journey"];

const TAB_ICONS: Record<TabId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  connections: Plug,
  mapping: GitBranch,
  preview: Telescope,
  validation: ShieldCheck,
  conflicts: AlertTriangle,
  runs: History,
  journey: Route,
};

export default function IntegrationCenterPage() {
  const searchParams = useSearchParams();
  const t = useTranslations("IntegrationCenter");

  const initialTab = TAB_IDS.includes(searchParams?.get("tab") as TabId) ? (searchParams!.get("tab") as TabId) : "overview";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<SyncStatus>("/admin/yachtshift/sync/status");
      setStatus(res.data);
    } catch {
      toast.error(t("overview.statusLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const changeTab = (next: TabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif italic text-[#003566] dark:text-slate-100">{t("title")}</h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">
            {t("subtitle")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadStatus()} className="gap-2 rounded-lg">
          <RefreshCw size={14} /> {t("refresh")}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors",
                tab === id ? "bg-[#003566] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
            >
              <Icon size={14} />
              {t(`tabs.${id}`)}
              {id === "conflicts" && (status?.pending_conflicts ?? 0) > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-white">
                  {status?.pending_conflicts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {tab === "overview" && <OverviewTab status={status} onSynced={() => void loadStatus()} />}
          {tab === "connections" && <ConnectionsTab />}
          {tab === "mapping" && <MappingEditorTab />}
          {tab === "preview" && <PreviewTab />}
          {tab === "validation" && <ValidationTab onNavigateToMapping={() => changeTab("mapping")} />}
          {tab === "conflicts" && <ConflictsTab onResolved={() => void loadStatus()} />}
          {tab === "runs" && <RunsTab />}
          {tab === "journey" && <JourneyTab />}
        </>
      )}
    </div>
  );
}
