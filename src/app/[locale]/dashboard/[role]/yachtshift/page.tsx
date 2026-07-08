"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Clock,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = {
  total_yachts: number;
  synced_to_yachtshift: number;
  pending_export: number;
  last_sync_at: string | null;
  publish_statuses: Record<string, number>;
  failed_exports: number;
  pending_conflicts: number;
};

type Conflict = {
  id: number;
  yacht_id: number;
  external_id: string;
  field_name: string;
  local_value: string | null;
  remote_value: string | null;
  status: string;
  yacht?: { id: number; boat_name: string | null; vessel_id: string | null } | null;
};

type SyncRun = {
  id: number;
  action: string;
  result: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

const fmt = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";

const ACTION_LABELS: Record<string, string> = {
  "yachtshift.import.completed": "Import voltooid",
  "yachtshift.import.failed": "Import mislukt",
  "yachtshift.import.empty_response": "Import geblokkeerd (lege respons)",
  "yachtshift.import.boat_synced": "Boot gesynchroniseerd (import)",
  "yachtshift.import.conflict": "Conflict gedetecteerd",
  "yachtshift.export.completed": "Export voltooid",
  "yachtshift.export.completed_with_errors": "Export voltooid met fouten",
  "yachtshift.export.failed": "Export mislukt",
  "yachtshift.export.boat_synced": "Boot gesynchroniseerd (export)",
  "yachtshift.conflict.resolved": "Conflict opgelost",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function YachtShiftSyncPage() {
  const [tab, setTab] = useState<"overview" | "conflicts" | "runs">("overview");
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<"import" | "export" | "both">("both");
  const [dryRun, setDryRun] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<SyncStatus>("/admin/yachtshift/sync/status");
      setStatus(res.data);
    } catch {
      toast.error("Status laden mislukt.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConflicts = useCallback(async () => {
    setConflictsLoading(true);
    try {
      const res = await api.get<Paginated<Conflict>>("/admin/yachtshift/conflicts", {
        params: { status: "pending" },
      });
      setConflicts(res.data.data ?? []);
    } catch {
      toast.error("Conflicten laden mislukt.");
    } finally {
      setConflictsLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await api.get<Paginated<SyncRun>>("/admin/yachtshift/runs");
      setRuns(res.data.data ?? []);
    } catch {
      toast.error("Sync-geschiedenis laden mislukt.");
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (tab === "conflicts") void loadConflicts();
    if (tab === "runs") void loadRuns();
  }, [tab, loadConflicts, loadRuns]);

  const handleTrigger = async () => {
    setTriggering(true);
    setLastResult(null);
    try {
      const res = await api.post("/admin/yachtshift/sync", { direction, dry_run: dryRun });
      setLastResult(res.data);
      toast.success(dryRun ? "Proefsync voltooid." : "Synchronisatie voltooid.");
      void loadStatus();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Synchronisatie mislukt.");
    } finally {
      setTriggering(false);
    }
  };

  const handleResolve = async (conflictId: number, resolution: "local" | "remote") => {
    setResolvingId(conflictId);
    try {
      await api.post(`/admin/yachtshift/conflicts/${conflictId}/resolve`, { resolution });
      toast.success("Conflict opgelost.");
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      void loadStatus();
    } catch {
      toast.error("Oplossen mislukt.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif italic text-[#003566] dark:text-slate-100">YachtShift Sync</h1>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">
            Import &middot; export &middot; conflicten
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadStatus()} className="gap-2 rounded-lg">
          <RefreshCw size={14} /> Verversen
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {([
          { id: "overview", label: "Overzicht" },
          { id: "conflicts", label: `Conflicten${status?.pending_conflicts ? ` (${status.pending_conflicts})` : ""}` },
          { id: "runs", label: "Geschiedenis" },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.id ? "bg-[#003566] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {/* ── Overview ─────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Totaal boten", value: status?.total_yachts ?? 0 },
                  { label: "Gesynchroniseerd", value: status?.synced_to_yachtshift ?? 0 },
                  { label: "Wacht op export", value: status?.pending_export ?? 0 },
                  { label: "Mislukte exports", value: status?.failed_exports ?? 0, danger: (status?.failed_exports ?? 0) > 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{s.label}</p>
                    <p className={cn("mt-2 text-3xl font-bold", s.danger ? "text-red-600" : "text-[#003566] dark:text-slate-100")}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Clock size={13} className="mr-1.5 inline" />
                Laatste sync: <strong>{fmt(status?.last_sync_at)}</strong>
              </div>

              {/* Manual trigger */}
              <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">Handmatig synchroniseren</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                    {([
                      { id: "import", label: "Import", icon: ArrowDownToLine },
                      { id: "both", label: "Beide", icon: ArrowLeftRight },
                      { id: "export", label: "Export", icon: ArrowUpFromLine },
                    ] as const).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDirection(d.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                          direction === d.id ? "bg-[#003566] text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
                        )}
                      >
                        <d.icon size={13} /> {d.label}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                    Proefsync (geen wijzigingen opslaan)
                  </label>

                  <Button
                    type="button"
                    onClick={() => void handleTrigger()}
                    disabled={triggering}
                    className="ml-auto gap-2 rounded-lg bg-[#003566] text-white hover:bg-[#00284f]"
                  >
                    {triggering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Synchroniseren
                  </Button>
                </div>

                {lastResult && (
                  <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ── Conflicts ────────────────────────────────────────── */}
          {tab === "conflicts" && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {conflictsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : conflicts.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                  Geen openstaande conflicten.
                </p>
              ) : (
                <div className="space-y-2">
                  {conflicts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className="text-amber-600" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {c.yacht?.boat_name ?? `Boot #${c.yacht_id}`}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                            {c.field_name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">extern: {c.external_id}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Lokale waarde</p>
                          <p className="truncate text-sm text-slate-700 dark:text-slate-200">{c.local_value ?? "—"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                          <p className="text-[10px] font-bold uppercase text-slate-400">YachtShift waarde</p>
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
                          Lokale waarde behouden
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resolvingId === c.id}
                          onClick={() => void handleResolve(c.id, "remote")}
                          className="rounded-lg text-xs"
                        >
                          YachtShift waarde overnemen
                        </Button>
                        {resolvingId === c.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Runs / history ───────────────────────────────────── */}
          {tab === "runs" && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {runsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : runs.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Nog geen sync-activiteit.</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.map((r) => {
                    const failed = r.result?.toLowerCase() === "fail";
                    return (
                      <div key={r.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 text-sm last:border-0 dark:border-slate-800">
                        {failed ? (
                          <XCircle size={14} className="shrink-0 text-red-500" />
                        ) : (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        )}
                        <span className="w-40 shrink-0 text-xs tabular-nums text-slate-400">{fmt(r.created_at)}</span>
                        <span className="text-slate-700 dark:text-slate-200">{ACTION_LABELS[r.action] ?? r.action}</span>
                        {r.meta && typeof r.meta === "object" && "summary" in r.meta && (
                          <span className="truncate text-xs text-slate-400">
                            {JSON.stringify((r.meta as Record<string, unknown>).summary)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
