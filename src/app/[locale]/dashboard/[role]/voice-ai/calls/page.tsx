"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type CallRow = {
  id: string;
  provider: string | null;
  direction: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  cost_eur: string | null;
  created_at: string;
  seller?: { name: string } | null;
  yacht?: { boat_name: string } | null;
  location?: { name: string } | null;
  campaign?: { name: string } | null;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Analytics = {
  total_calls: number;
  total_spend_eur: number;
  avg_cost_per_call_eur: number | null;
  cost_per_seller_onboarding_eur: number | null;
  cost_per_viewing_eur: number | null;
  cost_per_completed_deal_eur: number | null;
  completed_deals_count: number;
};

const fmt = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";

const durationLabel = (seconds: number | null) => {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

const euro = (v: number | null) => (v === null ? "—" : `€${v.toFixed(2)}`);

export default function VoiceCallsPage() {
  const [page, setPage] = useState<Paginated<CallRow> | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("");

  const load = useCallback(async (pageNum = 1, providerFilter = "") => {
    setLoading(true);
    try {
      const [callsRes, analyticsRes] = await Promise.all([
        api.get<Paginated<CallRow>>("/admin/voice-ai/calls", {
          params: { page: pageNum, ...(providerFilter ? { provider: providerFilter } : {}) },
        }),
        api.get<Analytics>("/admin/voice-ai/analytics"),
      ]);
      setPage(callsRes.data);
      setAnalytics(analyticsRes.data);
    } catch {
      toast.error("Kon gesprekken niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, provider);
  }, [load, provider]);

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gesprekken</h1>
          <p className="text-sm text-slate-500">{page?.total ?? 0} totaal</p>
        </div>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Alle providers</option>
          <option value="retell">Retell</option>
          <option value="telnyx">Telnyx</option>
        </select>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Totale kosten", value: euro(analytics.total_spend_eur) },
            { label: "Gem. kosten/gesprek", value: euro(analytics.avg_cost_per_call_eur) },
            { label: "Kosten/verkoper-onboarding", value: euro(analytics.cost_per_seller_onboarding_eur) },
            { label: "Kosten/bezichtiging", value: euro(analytics.cost_per_viewing_eur) },
            { label: "Kosten/afgeronde deal", value: euro(analytics.cost_per_completed_deal_eur) },
            { label: "Afgeronde deals", value: String(analytics.completed_deals_count) },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{tile.label}</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : !page || page.data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Geen gesprekken gevonden.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {page.data.map((call) => (
              <div key={call.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {call.direction === "inbound" ? (
                    <PhoneIncoming className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <PhoneOutgoing className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                          call.provider === "retell" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {call.provider ?? "?"}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {call.seller?.name ?? call.yacht?.boat_name ?? "Onbekend"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {call.location?.name} {call.campaign ? `· ${call.campaign.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-600">{call.outcome ?? call.status}</p>
                  <p className="text-xs text-slate-400">
                    {durationLabel(call.duration_seconds)} · {call.cost_eur ? `€${call.cost_eur}` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-300">{fmt(call.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {page && page.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: page.last_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => void load(p, provider)}
              className={cn(
                "w-8 h-8 rounded-lg text-xs font-semibold",
                p === page.current_page ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
