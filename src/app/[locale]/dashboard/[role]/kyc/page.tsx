"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────

interface KycStats {
  open: number;
  waiting_documents: number;
  high_risk: number;
  under_review: number;
  approved_month: number;
}

interface KycCase {
  id: number;
  case_number: string;
  status: string;
  risk_score: number;
  risk_level: string;
  blocking: boolean;
  buyer_name: string | null;
  buyer_email: string | null;
  seller_name: string | null;
  boat_name: string | null;
  deal_value: number | null;
  location: { id: number; name: string } | null;
  auto_created: boolean;
  created_at: string;
  approved_at: string | null;
}

// ── Style maps (colors/icons only — labels from i18n) ────────

const STATUS_COLORS: Record<string, string> = {
  draft:             "bg-slate-100 text-slate-600",
  in_progress:       "bg-blue-100 text-blue-700",
  waiting_documents: "bg-amber-100 text-amber-700",
  under_review:      "bg-indigo-100 text-indigo-700",
  approved:          "bg-green-100 text-green-700",
  rejected:          "bg-red-100 text-red-700",
  high_risk:         "bg-red-200 text-red-800",
  reported:          "bg-purple-100 text-purple-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft:             <Clock className="w-3 h-3" />,
  in_progress:       <Loader2 className="w-3 h-3" />,
  waiting_documents: <FileSearch className="w-3 h-3" />,
  under_review:      <ShieldCheck className="w-3 h-3" />,
  approved:          <CheckCircle2 className="w-3 h-3" />,
  rejected:          <XCircle className="w-3 h-3" />,
  high_risk:         <ShieldX className="w-3 h-3" />,
  reported:          <AlertTriangle className="w-3 h-3" />,
};

const RISK_COLORS: Record<string, string> = {
  low:      "text-green-600",
  medium:   "text-amber-600",
  high:     "text-red-600",
  critical: "text-red-800 font-bold",
};

// ── Main component ───────────────────────────────────────────

export default function KycCasesPage() {
  const params   = useParams();
  const router   = useRouter();
  const locale   = params.locale as string;
  const role     = params.role as string;

  const t = getDictionary(locale).KycDashboard;

  const [cases, setCases]     = useState<KycCase[]>([]);
  const [stats, setStats]     = useState<KycStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter]     = useState("");
  const [page, setPage]       = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]     = useState(0);
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), per_page: "30" });
      if (search) qp.set("search", search);
      if (statusFilter) qp.set("status", statusFilter);
      if (riskFilter) qp.set("risk_level", riskFilter);

      const res = await api.get<{
        data: KycCase[]; total: number; last_page: number; stats: KycStats;
      }>(`/admin/kyc-cases?${qp}`);

      setCases(res.data.data ?? []);
      setStats(res.data.stats ?? null);
      setTotal(res.data.total ?? 0);
      setLastPage(res.data.last_page ?? 1);
    } catch {
      toast.error(t.detail.listLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, riskFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchCases(); }, [fetchCases]);

  async function createManual() {
    setCreating(true);
    try {
      const res = await api.post<{ kyc_case: KycCase }>("/admin/kyc-cases", {});
      router.push(`/${locale}/dashboard/${role}/kyc/${res.data.kyc_case.id}`);
    } catch {
      toast.error(t.detail.createFailed);
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#003566]" />
            {t.pageTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchCases()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => router.push(`/${locale}/dashboard/${role}/kyc/questions`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Settings2 className="w-4 h-4" />
            {t.questionnaire}
          </button>
          <button onClick={createManual} disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t.newCase}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: t.stats.open,              value: stats.open,              color: "bg-blue-50 border-blue-200 text-blue-800" },
            { label: t.stats.waitingDocuments,  value: stats.waiting_documents, color: "bg-amber-50 border-amber-200 text-amber-800" },
            { label: t.stats.highRisk,          value: stats.high_risk,         color: "bg-red-50 border-red-200 text-red-800" },
            { label: t.stats.underReview,       value: stats.under_review,      color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
            { label: t.stats.approvedMonth,     value: stats.approved_month,    color: "bg-green-50 border-green-200 text-green-800" },
          ].map(({ label, value, color }) => (
            <div key={label as string} className={`rounded-2xl border p-4 ${color}`}>
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs font-medium mt-1 opacity-75">{label as string}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#003566]">
            <option value="">{t.allStatuses}</option>
            {(Object.keys(STATUS_COLORS) as string[]).map((k) => (
              <option key={k} value={k}>{(t.status as Record<string, string>)[k] ?? k}</option>
            ))}
          </select>
        </div>
        <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#003566]">
          <option value="">{t.allRiskLevels}</option>
          {(["low", "medium", "high", "critical"] as const).map((k) => (
            <option key={k} value={k}>{(t.risk as Record<string, string>)[k]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : cases.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t.noCasesFound}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {(["case", "buyer", "boat", "value", "risk", "status", "date"] as const).map((k) => (
                    <th key={k} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {(t.col as Record<string, string>)[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cases.map((c) => {
                  const statusColor = STATUS_COLORS[c.status] ?? STATUS_COLORS.draft;
                  const statusIcon  = STATUS_ICONS[c.status] ?? STATUS_ICONS.draft;
                  const statusLabel = (t.status as Record<string, string>)[c.status] ?? c.status;
                  const riskColor   = RISK_COLORS[c.risk_level] ?? RISK_COLORS.low;
                  const riskLabel   = (t.risk as Record<string, string>)[c.risk_level] ?? c.risk_level;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/${locale}/dashboard/${role}/kyc/${c.id}`)}
                      className={`cursor-pointer hover:bg-slate-50 transition-colors ${c.blocking ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#003566]">{c.case_number}</span>
                          {c.blocking && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">{t.blocking}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[140px]">{c.buyer_name ?? "—"}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">{c.buyer_email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]">{c.boat_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {c.deal_value ? `€ ${Number(c.deal_value).toLocaleString("nl-NL")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${riskColor}`}>{c.risk_score}p</span>
                          <span className={`text-xs ${riskColor}`}>{riskLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {statusIcon} {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>{String(t.casesTotal).replace("{n}", String(total))}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              {t.prevPage}
            </button>
            <span className="px-3 py-1.5">
              {String(t.pageOf).replace("{page}", String(page)).replace("{last}", String(lastPage))}
            </span>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              {t.nextPage}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
