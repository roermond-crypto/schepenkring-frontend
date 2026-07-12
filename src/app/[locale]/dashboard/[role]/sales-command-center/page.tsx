"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  PhoneCall,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Mic,
  Mail,
  Gauge,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

type FollowUpRow = {
  id: number;
  subject_type: string;
  subject_id: number;
  next_action: string;
  due_at: string | null;
  last_outcome: string | null;
  ai_summary: string | null;
  assigned_employee: string | null;
  related_yacht: { id: number; boat_name: string | null } | null;
  related_deal: { id: number; status: string; agreed_amount: string | null } | null;
  related_chat_thread_id: string | null;
};

type PrioritizedLeadRow = {
  campaign_target_id: number;
  campaign_name: string | null;
  score: number;
  call_attempts: number;
  lead_id: number | null;
  lead_status: string | null;
  name: string | null;
  phone: string | null;
  yacht_id: number | null;
  yacht_name: string | null;
  yacht_completeness_score: number | null;
  location_id: number | null;
  email_opens: number;
  email_clicks: number;
};

type RecentCallRow = {
  id: string;
  provider: string | null;
  direction: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  cost_eur: string | null;
  ended_at: string | null;
  summary: string | null;
  transcript_preview: string | null;
  has_recording: boolean;
  seller: string | null;
  yacht: string | null;
  conversation_id: string | null;
};

type CommandCenterData = {
  due_follow_ups: FollowUpRow[];
  prioritized_leads: PrioritizedLeadRow[];
  recent_calls: RecentCallRow[];
};

const fmt = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";

const durationLabel = (seconds: number | null) => {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SalesCommandCenterPage() {
  const params = useParams();
  const locale = params.locale as string;
  const role = params.role as string;

  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CommandCenterData>("/admin/sales-command-center");
      setData(res.data);
    } catch {
      toast.error("Kon Sales Command Center niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const callNow = async (campaignTargetId: number) => {
    setBusyId(`call-${campaignTargetId}`);
    try {
      await api.post("/admin/sales-command-center/call-now", { campaign_target_id: campaignTargetId });
      toast.success("Gesprek gestart");
      await load();
    } catch {
      toast.error("Bellen mislukt");
    } finally {
      setBusyId(null);
    }
  };

  const markDone = async (followUpId: number) => {
    setBusyId(`done-${followUpId}`);
    try {
      await api.post("/admin/sales-command-center/mark-outcome", { follow_up_id: followUpId, status: "done" });
      toast.success("Gemarkeerd als afgehandeld");
      await load();
    } catch {
      toast.error("Bijwerken mislukt");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Command Center</h1>
          <p className="text-sm text-slate-500">Wie moet nu gebeld worden, en met welke context.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Verversen
        </Button>
      </div>

      {/* Due follow-ups */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Openstaande follow-ups</h2>
          <span className="text-xs text-slate-400">({data?.due_follow_ups.length ?? 0})</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.due_follow_ups ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">Geen openstaande follow-ups.</p>
          )}
          {data?.due_follow_ups.map((f) => (
            <div key={f.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">{f.next_action}</span>
                  {f.due_at && <span className="text-xs text-slate-400">{fmt(f.due_at)}</span>}
                </div>
                <p className="text-sm text-slate-700 truncate">{f.ai_summary ?? `${f.subject_type} #${f.subject_id}`}</p>
                <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                  {f.related_yacht && <span>{f.related_yacht.boat_name}</span>}
                  {f.related_deal && (
                    <span
                      className={cn(
                        "font-semibold",
                        f.related_deal.status === "closed" ? "text-emerald-600" : "text-amber-600",
                      )}
                    >
                      Deal: {f.related_deal.status}
                      {f.related_deal.agreed_amount ? ` (€${f.related_deal.agreed_amount})` : ""}
                    </span>
                  )}
                  {f.assigned_employee && <span>Toegewezen: {f.assigned_employee}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {f.related_chat_thread_id && (
                  <a
                    href={`/${locale}/dashboard/${role}/chat?conversation=${f.related_chat_thread_id}`}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === `done-${f.id}`}
                  onClick={() => void markDone(f.id)}
                >
                  {busyId === `done-${f.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Prioritized leads */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Wie moet nu gebeld worden</h2>
          <span className="text-xs text-slate-400">({data?.prioritized_leads.length ?? 0})</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.prioritized_leads ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">Geen geprioriteerde leads op dit moment.</p>
          )}
          {data?.prioritized_leads.map((lead) => (
            <div key={lead.campaign_target_id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{lead.name ?? "Onbekend"}</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    score {lead.score}
                  </span>
                  {lead.yacht_completeness_score !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                      <Gauge className="h-3 w-3" /> {lead.yacht_completeness_score}% compleet
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {lead.campaign_name} · {lead.call_attempts} eerdere poging(en)
                  {lead.yacht_name ? ` · ${lead.yacht_name}` : ""}
                </p>
                {(lead.email_opens > 0 || lead.email_clicks > 0) && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" /> {lead.email_opens}x geopend, {lead.email_clicks}x geklikt
                  </p>
                )}
              </div>
              <Button
                size="sm"
                disabled={busyId === `call-${lead.campaign_target_id}`}
                onClick={() => void callNow(lead.campaign_target_id)}
              >
                {busyId === `call-${lead.campaign_target_id}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <PhoneCall className="h-3.5 w-3.5 mr-2" />
                )}
                Bel nu
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Recent calls */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <h2 className="font-semibold text-slate-800">Recente gesprekken</h2>
          <span className="text-xs text-slate-400">({data?.recent_calls.length ?? 0})</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.recent_calls ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">Nog geen afgeronde gesprekken.</p>
          )}
          {data?.recent_calls.map((call) => (
            <div key={call.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                      call.provider === "retell" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {call.provider ?? "onbekend"}
                  </span>
                  <span className="text-xs text-slate-500">{call.direction}</span>
                  <span className="text-xs text-slate-400">{durationLabel(call.duration_seconds)}</span>
                  {call.has_recording && (
                    <span title="Opname beschikbaar">
                      <Mic className="h-3 w-3 text-slate-400" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{fmt(call.ended_at)}</span>
              </div>
              {call.summary && <p className="text-sm text-slate-600 mt-1">{call.summary}</p>}
              {call.transcript_preview && (
                <p className="text-xs text-slate-400 italic mt-1 line-clamp-2">&ldquo;{call.transcript_preview}&hellip;&rdquo;</p>
              )}
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                {call.seller && <span>Verkoper: {call.seller}</span>}
                {call.yacht && <span>{call.yacht}</span>}
                {call.outcome && <span className="font-semibold text-slate-500">{call.outcome}</span>}
                {call.cost_eur && <span>€{call.cost_eur}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
