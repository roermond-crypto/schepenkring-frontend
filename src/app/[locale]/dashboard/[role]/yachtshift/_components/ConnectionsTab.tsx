"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Platform } from "../_types";

type ValidationIssue = { severity: "error" | "warning" | string; message: string };
type ValidationResult = { valid: boolean; issues: ValidationIssue[] };
type TestResult = { success: boolean; message?: string };

export function ConnectionsTab() {
  const t = useTranslations("IntegrationCenter.connections");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const root = `/${locale}/dashboard/${role}`;

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [validation, setValidation] = useState<Record<number, ValidationResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Platform[] | { data: Platform[] }>("/admin/platforms");
      const data = Array.isArray(res.data) ? res.data : (res.data as { data?: Platform[] })?.data ?? [];
      setPlatforms(data);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const connections = platforms.filter((p) => !p.feed_source_platform_id);
  const marketplacesFor = (connectionId: number) => platforms.filter((p) => p.feed_source_platform_id === connectionId);

  const handleSetDefault = async (platform: Platform) => {
    setBusyId(platform.id);
    try {
      await api.post(`/admin/platforms/${platform.id}/set-default`);
      toast.success(t("setDefaultSuccess"));
      void load();
    } catch {
      toast.error(t("setDefaultFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (platform: Platform) => {
    setBusyId(platform.id);
    try {
      await api.patch(`/admin/platforms/${platform.id}`, { is_active: !platform.is_active });
      setPlatforms((prev) => prev.map((p) => (p.id === platform.id ? { ...p, is_active: !p.is_active } : p)));
    } catch {
      toast.error(t("setDefaultFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleTestConnection = async (platform: Platform) => {
    setBusyId(platform.id);
    try {
      const res = await api.post<TestResult>(`/admin/platforms/${platform.id}/test-connection`);
      setTestResults((prev) => ({ ...prev, [platform.id]: res.data }));
      if (res.data.success) toast.success(t("testSuccess"));
      else toast.error(t("testFailed"));
    } catch {
      toast.error(t("testFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleValidate = async (platform: Platform) => {
    setBusyId(platform.id);
    try {
      const res = await api.post<ValidationResult>(`/admin/platforms/${platform.id}/validate`);
      setValidation((prev) => ({ ...prev, [platform.id]: res.data }));
    } catch {
      toast.error(t("validateFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleAssign = async (marketplace: Platform, connectionId: number | null) => {
    setBusyId(marketplace.id);
    try {
      await api.put(`/admin/platforms/${marketplace.id}`, { feed_source_platform_id: connectionId });
      void load();
    } catch {
      toast.error(t("setDefaultFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (platform: Platform) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusyId(platform.id);
    try {
      await api.delete(`/admin/platforms/${platform.id}`);
      toast.success(t("deleteSuccess"));
      void load();
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`${root}/platforms/new`}>
          <Button className="gap-2 rounded-lg bg-[#003566] text-white hover:bg-[#00284f]">
            <Plus size={14} /> {t("newButton")}
          </Button>
        </Link>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((connection) => {
            const marketplaces = marketplacesFor(connection.id);
            const candidates = platforms.filter((p) => p.id !== connection.id);
            const test = testResults[connection.id];
            const val = validation[connection.id];
            const busy = busyId === connection.id;

            return (
              <div key={connection.id} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      {connection.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={connection.logo_url} alt="" className="h-6 w-6 object-contain" />
                      ) : (
                        <Plug size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{connection.name}</span>
                        {connection.is_default && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <Star size={10} className="fill-current" /> {t("default")}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            connection.is_active
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                          )}
                        >
                          {connection.is_active ? t("active") : t("inactive")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {t("category")}: {connection.category ?? "—"} · {t("exportMethod")}: {connection.export_method}
                        {connection.openmarine_dealer_id ? ` · ${t("dealerId")}: ${connection.openmarine_dealer_id}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!connection.is_default && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleSetDefault(connection)} className="rounded-lg text-xs">
                        {t("setDefault")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleToggleActive(connection)} className="rounded-lg text-xs">
                      {connection.is_active ? t("inactive") : t("active")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleTestConnection(connection)} className="rounded-lg text-xs">
                      {t("testConnection")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleValidate(connection)} className="gap-1 rounded-lg text-xs">
                      <ShieldCheck size={12} /> {t("validate")}
                    </Button>
                    <Link href={`${root}/platforms/${connection.id}`} className="inline-flex">
                      <Button size="sm" variant="outline" className="gap-1 rounded-lg text-xs">
                        <ExternalLink size={12} /> {t("manageInPlatforms")}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleDelete(connection)}
                      className="rounded-lg text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {(test || val) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {test && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
                          test.success ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                        )}
                      >
                        {test.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {test.message ?? (test.success ? t("testSuccess") : t("testFailed"))}
                      </div>
                    )}
                    {val && (
                      <div
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs",
                          val.valid ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {val.valid ? t("noIssues") : t("issuesFound", { count: val.issues?.length ?? 0 })}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("assignedMarketplaces")}</p>
                  {marketplaces.length === 0 ? (
                    <p className="text-xs text-slate-400">—</p>
                  ) : (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {marketplaces.map((m) => (
                        <span
                          key={m.id}
                          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {m.name}
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => void handleAssign(m, null)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    value=""
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const target = candidates.find((c) => c.id === id);
                      if (target) void handleAssign(target, connection.id);
                    }}
                  >
                    <option value="">{t("assignTo")}...</option>
                    {candidates
                      .filter((c) => c.feed_source_platform_id !== connection.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
