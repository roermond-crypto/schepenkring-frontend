"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Conflict, Paginated } from "../_types";

export function ConflictsTab({ onResolved }: { onResolved: () => void }) {
  const t = useTranslations("IntegrationCenter.conflicts");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<Conflict>>("/admin/yachtshift/conflicts", {
        params: { status: "pending" },
      });
      setConflicts(res.data.data ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConflicts();
  }, [loadConflicts]);

  const handleResolve = async (conflictId: number, resolution: "local" | "remote") => {
    setResolvingId(conflictId);
    try {
      await api.post(`/admin/yachtshift/conflicts/${conflictId}/resolve`, { resolution });
      toast.success(t("resolveSuccess"));
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      onResolved();
    } catch {
      toast.error(t("resolveFailed"));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : conflicts.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <div key={c.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {c.yacht?.boat_name ?? `#${c.yacht_id}`}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                    {c.field_name}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{t("external")}: {c.external_id}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{t("localValue")}</p>
                  <p className="truncate text-sm text-slate-700 dark:text-slate-200">{c.local_value ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{t("remoteValue")}</p>
                  <p className="truncate text-sm text-slate-700 dark:text-slate-200">{c.remote_value ?? "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resolvingId === c.id}
                  onClick={() => void handleResolve(c.id, "local")}
                  className="rounded-lg text-xs"
                >
                  {t("keepLocal")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resolvingId === c.id}
                  onClick={() => void handleResolve(c.id, "remote")}
                  className="rounded-lg text-xs"
                >
                  {t("keepRemote")}
                </Button>
                {resolvingId === c.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
