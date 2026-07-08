"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Calendar,
  Clock,
  Euro,
  HelpCircle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────

type OfferRow = {
  id: number;
  buyer_name?: string;
  buyer_email?: string;
  amount?: number;
  status?: string;
  below_minimum?: boolean;
  created_at?: string;
};

type ConvRow = {
  id: string;
  chat_type?: string;
  status?: string;
  contact?: { name?: string; email?: string };
  last_message_at?: string;
};

type TimelineRow = {
  id: number;
  action?: string;
  created_at?: string;
  meta?: Record<string, unknown>;
};

// ── Status badge helper ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:              "bg-blue-50 text-blue-700",
  sent_to_seller:   "bg-amber-50 text-amber-700",
  seller_accepted:  "bg-emerald-50 text-emerald-700",
  seller_rejected:  "bg-red-50 text-red-700",
  seller_countered: "bg-violet-50 text-violet-700",
  open:             "bg-blue-50 text-blue-700",
  closed:           "bg-slate-100 text-slate-500",
  plan_viewing:     "bg-cyan-50 text-cyan-700",
  question:         "bg-amber-50 text-amber-700",
  offer:            "bg-emerald-50 text-emerald-700",
};

function Badge({ label }: { label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
        STATUS_COLORS[label ?? ""] ?? "bg-slate-100 text-slate-500",
      )}
    >
      {label?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Tab panels ───────────────────────────────────────────────────

function OffersPanel({ yachtId }: { yachtId: string }) {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/yachts/${yachtId}/offers`)
      .then((r) => setRows(r.data?.offers ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [yachtId]);

  if (loading) return <PanelLoader />;
  if (!rows.length) return <PanelEmpty label="Geen biedingen gevonden" />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            <th className="py-3 pr-4">Koper</th>
            <th className="py-3 pr-4">Bedrag</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Datum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 pr-4 font-medium text-slate-800">
                {r.buyer_name ?? "—"}
                {r.below_minimum && (
                  <span className="ml-2 text-[10px] font-bold text-amber-600">onder minimum</span>
                )}
              </td>
              <td className="py-3 pr-4 font-semibold text-slate-800">
                {r.amount ? `€ ${Number(r.amount).toLocaleString("nl-NL")}` : "—"}
              </td>
              <td className="py-3 pr-4"><Badge label={r.status} /></td>
              <td className="py-3 pr-4 text-slate-500">{fmt(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationsPanel({ yachtId, type }: { yachtId: string; type?: string }) {
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (type) params.set("chat_type", type);
    api.get(`/chat/conversations?boat_id=${yachtId}&${params.toString()}`)
      .then((r) => setRows(r.data?.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [yachtId, type]);

  const label =
    type === "plan_viewing" ? "bezichtigingen"
    : type === "question" ? "vragen"
    : "gesprekken";

  if (loading) return <PanelLoader />;
  if (!rows.length) return <PanelEmpty label={`Geen ${label} gevonden`} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            <th className="py-3 pr-4">Contact</th>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Laatste bericht</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-3 pr-4 font-medium text-slate-800">
                {r.contact?.name ?? r.contact?.email ?? "Anoniem"}
              </td>
              <td className="py-3 pr-4"><Badge label={r.chat_type} /></td>
              <td className="py-3 pr-4"><Badge label={r.status} /></td>
              <td className="py-3 pr-4 text-slate-500">{fmt(r.last_message_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelinePanel({ yachtId }: { yachtId: string }) {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/audit?entity_type=yacht&entity_id=${yachtId}&per_page=50&sort_by=created_at&sort_dir=desc`)
      .then((r) => setRows(r.data?.logs ?? r.data?.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [yachtId]);

  if (loading) return <PanelLoader />;
  if (!rows.length) return <PanelEmpty label="Geen tijdlijn gevonden" />;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1E3A8A]" />
          <div>
            <p className="text-sm font-medium text-slate-800">
              {r.action?.replace(/_/g, " ") ?? "—"}
            </p>
            <p className="text-xs text-slate-400">{fmt(r.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
}

function PanelEmpty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-400">
      <AlertCircle size={16} />
      {label}
    </div>
  );
}

// ── Tab definitions ──────────────────────────────────────────────

type TabId = "offers" | "chats" | "questions" | "viewings" | "timeline";

const TABS: { id: TabId; label: string; icon: typeof Euro }[] = [
  { id: "offers",    label: "Biedingen",    icon: Euro },
  { id: "chats",     label: "Gesprekken",   icon: MessageSquare },
  { id: "questions", label: "Vragen",       icon: HelpCircle },
  { id: "viewings",  label: "Bezichtigingen", icon: Calendar },
  { id: "timeline",  label: "Tijdlijn",     icon: Clock },
];

// ── Main component ───────────────────────────────────────────────

export function BoatDetailTabs({ yachtId }: { yachtId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("offers");

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-5 py-3.5 text-[13px] font-semibold transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[#1E3A8A] text-[#1E3A8A]"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="p-6">
        {activeTab === "offers"    && <OffersPanel yachtId={yachtId} />}
        {activeTab === "chats"     && <ConversationsPanel yachtId={yachtId} />}
        {activeTab === "questions" && <ConversationsPanel yachtId={yachtId} type="question" />}
        {activeTab === "viewings"  && <ConversationsPanel yachtId={yachtId} type="plan_viewing" />}
        {activeTab === "timeline"  && <TimelinePanel yachtId={yachtId} />}
      </div>
    </div>
  );
}
