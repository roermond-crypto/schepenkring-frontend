"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, PhoneCall, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type FollowUpRow = {
  id: number;
  subject_type: string;
  subject_id: number;
  next_action: string;
  due_at: string | null;
  ai_summary: string | null;
  assigned_employee: string | null;
  related_chat_thread_id: string | null;
};

// Only the "a human needs to pick this up" actions from the full due list
// (spec §11's warm-transfer/callback-fallback flow) — retry/email/link
// actions belong to the automated funnel, not this queue.
const HANDOFF_ACTIONS = ["warm_transfer", "retry_call", "route_to_contract_support", "open_bid_task"];

const fmt = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "—";

export default function HumanQueuePage() {
  const params = useParams();
  const locale = params.locale as string;
  const role = params.role as string;

  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ due_follow_ups: FollowUpRow[] }>("/admin/sales-command-center");
      setRows(res.data.due_follow_ups.filter((f) => HANDOFF_ACTIONS.includes(f.next_action)));
    } catch {
      toast.error("Kon wachtrij niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markDone = async (id: number) => {
    setBusyId(id);
    try {
      await api.post("/admin/sales-command-center/mark-outcome", { follow_up_id: id, status: "done" });
      toast.success("Afgehandeld");
      await load();
    } catch {
      toast.error("Bijwerken mislukt");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Menselijke wachtrij</h1>
        <p className="text-sm text-slate-500">Warme transfers, callbacks en escalaties die een mens moeten oppakken.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Wachtrij is leeg.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((f) => (
              <div key={f.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <PhoneCall className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-600">{f.next_action}</span>
                    <p className="text-sm text-slate-700 truncate">{f.ai_summary ?? `${f.subject_type} #${f.subject_id}`}</p>
                    <p className="text-xs text-slate-400">
                      {fmt(f.due_at)} {f.assigned_employee ? `· ${f.assigned_employee}` : ""}
                    </p>
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
                  <Button variant="outline" size="sm" disabled={busyId === f.id} onClick={() => void markDone(f.id)}>
                    {busyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
