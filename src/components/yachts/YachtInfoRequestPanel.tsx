"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface InfoRequest {
  id: number;
  items: string[];
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  requested_by?: { name: string } | null;
}

export function YachtInfoRequestPanel({ yachtId }: { yachtId: number }) {
  const t = useTranslations("YachtInfoRequest");
  const [requests, setRequests] = useState<InfoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: InfoRequest[] }>(`/admin/yachts/${yachtId}/info-requests`);
      setRequests(res.data.data);
    } catch {
      // Non-critical — the panel just shows an empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [yachtId]);

  const submit = async () => {
    const cleaned = items.map((i) => i.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/yachts/${yachtId}/info-requests`, { items: cleaned });
      toast.success(t("sendSuccess"));
      setItems([""]);
      void load();
    } catch {
      toast.error(t("sendFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const openRequest = requests.find((r) => r.status === "open");
  const resolvedRequests = requests.filter((r) => r.status === "resolved");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("title")}</p>

      {loading ? (
        <div className="flex justify-center py-4 text-slate-400">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : openRequest ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <Clock size={12} /> {t("openRequestLabel")}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {openRequest.items.map((item, i) => (
              <li key={i} className="text-sm text-amber-800 flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((val, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={val}
                onChange={(e) =>
                  setItems((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                placeholder={t("itemPlaceholder")}
                className="flex-1 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, ""])}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> {t("addItem")}
            </button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || items.every((i) => !i.trim())}
              className="h-8 bg-[#003566] text-xs text-white hover:bg-[#00284f]"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : t("send")}
            </Button>
          </div>
        </div>
      )}

      {resolvedRequests.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{t("historyLabel")}</p>
          <ul className="space-y-1.5">
            {resolvedRequests.slice(0, 3).map((r) => (
              <li key={r.id} className="flex items-start gap-1.5 text-xs text-slate-500">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{r.items.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
