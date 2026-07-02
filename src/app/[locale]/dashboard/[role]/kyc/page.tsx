"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSearch,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShieldX,
  Trash2,
  X,
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

interface QuestionTranslations {
  section?: string;
  question?: string;
  action?: string;
}

interface QuestionTemplate {
  id: number;
  section: string;
  question: string;
  action: string | null;
  translations: Record<string, QuestionTranslations> | null;
  field_type: string;
  options: string[] | null;
  risk_points: number;
  risk_flag: "none" | "warning" | "blocking" | "critical";
  required: boolean;
  conditional_on_question_id: number | null;
  conditional_show_when: string | null;
  sort_order: number;
  active: boolean;
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

const FIELD_TYPES = [
  "yes_no", "dropdown", "text", "textarea", "date",
  "number", "money", "country", "document", "photo", "signature",
] as const;

const RISK_FLAGS = ["none", "warning", "blocking", "critical"] as const;

const FLAG_COLORS: Record<string, string> = {
  none:     "bg-slate-100 text-slate-600",
  warning:  "bg-amber-100 text-amber-700",
  blocking: "bg-red-100 text-red-700",
  critical: "bg-red-200 text-red-900 font-bold",
};

const Q_LOCALES = ["en", "de", "fr"] as const;
type TranslationLocale = typeof Q_LOCALES[number];

type TranslationFields = {
  [K in TranslationLocale]: { section: string; question: string; action: string };
};

type FormState = {
  section: string;
  question: string;
  action: string;
  field_type: string;
  options: string;
  risk_points: number;
  risk_flag: "none" | "warning" | "blocking" | "critical";
  required: boolean;
  conditional_on_question_id: string;
  conditional_show_when: string;
  sort_order: number;
  active: boolean;
  translations: TranslationFields;
};

const emptyTranslations = (): TranslationFields => ({
  en: { section: "", question: "", action: "" },
  de: { section: "", question: "", action: "" },
  fr: { section: "", question: "", action: "" },
});

const EMPTY_FORM: FormState = {
  section: "",
  question: "",
  action: "",
  field_type: "yes_no",
  options: "",
  risk_points: 0,
  risk_flag: "none",
  required: true,
  conditional_on_question_id: "",
  conditional_show_when: "",
  sort_order: 0,
  active: true,
  translations: emptyTranslations(),
};

// ── Main component ───────────────────────────────────────────

export default function KycCasesPage() {
  const params   = useParams();
  const router   = useRouter();
  const locale   = params.locale as string;
  const role     = params.role as string;

  const t  = getDictionary(locale).KycDashboard;
  const tq = getDictionary(locale).KycQuestions;

  // ── Cases state ──
  const [view, setView]           = useState<"cases" | "questionnaire">("cases");
  const [cases, setCases]         = useState<KycCase[]>([]);
  const [stats, setStats]         = useState<KycStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter]     = useState("");
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);
  const [total, setTotal]         = useState(0);
  const [creating, setCreating]   = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Questionnaire state ──
  const [questions, setQuestions]           = useState<QuestionTemplate[]>([]);
  const [qLoading, setQLoading]             = useState(false);
  const [editingQId, setEditingQId]         = useState<number | "new" | null>(null);
  const [form, setForm]                     = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]                 = useState(false);
  const [qDeletingId, setQDeletingId]       = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // ── Cases API ──
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

  async function deleteCase(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm(t.detail.deleteConfirm)) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/kyc-cases/${id}`);
      toast.success(t.detail.deleteOk);
      void fetchCases();
    } catch {
      toast.error(t.detail.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Questionnaire API ──
  const loadQuestions = useCallback(async () => {
    setQLoading(true);
    try {
      const res = await api.get<{ data: QuestionTemplate[] }>("/admin/kyc-questions");
      setQuestions(res.data.data ?? []);
    } catch {
      toast.error(tq.loadFailed);
    } finally {
      setQLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openQuestionnaire() {
    setView("questionnaire");
    if (questions.length === 0) void loadQuestions();
  }

  const qSections = [...new Set(questions.map((q) => q.section))];

  function startNewQuestion() {
    setForm({ ...EMPTY_FORM, section: qSections[0] ?? "", translations: emptyTranslations() });
    setEditingQId("new");
  }

  function startEditQuestion(q: QuestionTemplate) {
    const trans = emptyTranslations();
    if (q.translations) {
      for (const loc of Q_LOCALES) {
        if (q.translations[loc]) {
          trans[loc] = {
            section:  q.translations[loc].section  ?? "",
            question: q.translations[loc].question ?? "",
            action:   q.translations[loc].action   ?? "",
          };
        }
      }
    }
    setForm({
      section: q.section,
      question: q.question,
      action: q.action ?? "",
      field_type: q.field_type,
      options: q.options ? q.options.join("\n") : "",
      risk_points: q.risk_points,
      risk_flag: q.risk_flag,
      required: q.required,
      conditional_on_question_id: q.conditional_on_question_id ? String(q.conditional_on_question_id) : "",
      conditional_show_when: q.conditional_show_when ?? "",
      sort_order: q.sort_order,
      active: q.active,
      translations: trans,
    });
    setEditingQId(q.id);
  }

  function buildQPayload() {
    const trans: Record<string, QuestionTranslations> = {};
    for (const loc of Q_LOCALES) {
      const f = form.translations[loc];
      if (f.section || f.question || f.action) {
        trans[loc] = {
          section:  f.section  || undefined,
          question: f.question || undefined,
          action:   f.action   || undefined,
        };
      }
    }
    return {
      section:                    form.section,
      question:                   form.question,
      action:                     form.action || null,
      translations:               Object.keys(trans).length > 0 ? trans : null,
      field_type:                 form.field_type,
      options:                    form.field_type === "dropdown" && form.options
                                    ? form.options.split("\n").map((s) => s.trim()).filter(Boolean)
                                    : null,
      risk_points:                Number(form.risk_points),
      risk_flag:                  form.risk_flag,
      required:                   form.required,
      conditional_on_question_id: form.conditional_on_question_id ? Number(form.conditional_on_question_id) : null,
      conditional_show_when:      form.conditional_show_when || null,
      sort_order:                 Number(form.sort_order),
      active:                     form.active,
    };
  }

  async function saveQuestion() {
    if (!form.section || !form.question) {
      toast.error(tq.sectionAndQuestionRequired);
      return;
    }
    setSaving(true);
    try {
      if (editingQId === "new") {
        const res = await api.post<{ data: QuestionTemplate }>("/admin/kyc-questions", buildQPayload());
        setQuestions((prev) => [...prev, res.data.data].sort((a, b) => a.sort_order - b.sort_order));
        toast.success(tq.created);
      } else {
        const res = await api.patch<{ data: QuestionTemplate }>(`/admin/kyc-questions/${editingQId}`, buildQPayload());
        setQuestions((prev) => prev.map((q) => q.id === editingQId ? res.data.data : q));
        toast.success(tq.saved);
      }
      setEditingQId(null);
    } catch {
      toast.error(tq.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: number) {
    if (!confirm(tq.deleteConfirm)) return;
    setQDeletingId(id);
    try {
      await api.delete(`/admin/kyc-questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success(tq.deleted);
    } catch {
      toast.error(tq.deleteFailed);
    } finally {
      setQDeletingId(null);
    }
  }

  async function moveQuestion(q: QuestionTemplate, dir: "up" | "down") {
    const sectionQs = questions.filter((x) => x.section === q.section).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sectionQs.findIndex((x) => x.id === q.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sectionQs.length) return;
    const a = sectionQs[idx];
    const b = sectionQs[swapIdx];
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;
    setQuestions((prev) => prev.map((x) =>
      x.id === a.id ? { ...x, sort_order: bOrder } :
      x.id === b.id ? { ...x, sort_order: aOrder } : x
    ));
    try {
      await api.post("/admin/kyc-questions/reorder", {
        items: [{ id: a.id, sort_order: bOrder }, { id: b.id, sort_order: aOrder }],
      });
    } catch {
      toast.error(tq.reorderFailed);
      void loadQuestions();
    }
  }

  function toggleSection(s: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  // ── Stat card filter handler ──
  function handleStatClick(statusKey: string) {
    setStatusFilter((prev) => prev === statusKey ? "" : statusKey);
    setPage(1);
  }

  // ── Render: questionnaire view ──
  if (view === "questionnaire") {
    const inp = "w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 bg-white";

    return (
      <div className="p-6 space-y-6 max-w-5xl">
        <Toaster />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("cases")}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-7 h-7 text-[#003566]" />
                {tq.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">{tq.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void loadQuestions()} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={startNewQuestion}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors">
              <Plus className="w-4 h-4" />
              {tq.newQuestion}
            </button>
          </div>
        </div>

        {editingQId === "new" && (
          <QuestionForm
            form={form}
            setForm={setForm}
            questions={questions}
            sections={qSections}
            saving={saving}
            onSave={() => void saveQuestion()}
            onCancel={() => setEditingQId(null)}
            inp={inp}
            isNew
            t={tq}
          />
        )}

        {qLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : qSections.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{tq.empty}</p>
          </div>
        ) : (
          qSections.map((section) => {
            const sectionQs = questions
              .filter((q) => q.section === section)
              .sort((a, b) => a.sort_order - b.sort_order);
            const collapsed = collapsedSections.has(section);

            return (
              <div key={section} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="font-bold text-slate-800">{section}</h2>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {sectionQs.length} {tq.questions}
                    </span>
                  </div>
                  {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </button>

                {!collapsed && (
                  <div className="divide-y divide-slate-100">
                    {sectionQs.map((q, idx) => (
                      <div key={q.id}>
                        {editingQId === q.id ? (
                          <div className="p-5 bg-blue-50/40">
                            <QuestionForm
                              form={form}
                              setForm={setForm}
                              questions={questions}
                              sections={qSections}
                              saving={saving}
                              onSave={() => void saveQuestion()}
                              onCancel={() => setEditingQId(null)}
                              inp={inp}
                              isNew={false}
                              t={tq}
                            />
                          </div>
                        ) : (
                          <div className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/60 group">
                            <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                              <button type="button" onClick={() => void moveQuestion(q, "up")} disabled={idx === 0}
                                className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => void moveQuestion(q, "down")} disabled={idx === sectionQs.length - 1}
                                className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-slate-800">{q.question}</span>
                                {!q.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">{tq.inactive}</span>}
                                {q.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{tq.required}</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${FLAG_COLORS[q.risk_flag]}`}>{q.risk_flag} {q.risk_points > 0 ? `+${q.risk_points}p` : ""}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{q.field_type}</span>
                                {q.translations && Object.keys(q.translations).length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                    {Object.keys(q.translations).join(", ")}
                                  </span>
                                )}
                              </div>
                              {q.action && <p className="text-xs text-slate-400 truncate">→ {q.action}</p>}
                              {q.conditional_on_question_id && (
                                <p className="text-xs text-slate-400">{tq.conditionalOn} #{q.conditional_on_question_id} = {q.conditional_show_when}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => startEditQuestion(q)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#003566] hover:bg-blue-50 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => void deleteQuestion(q.id)} disabled={qDeletingId === q.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                {qDeletingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ── Render: cases view ──
  const statCards = [
    { label: t.stats.open,             value: stats?.open ?? 0,              color: "bg-blue-50 border-blue-200 text-blue-800",     activeRing: "ring-2 ring-blue-400",    statusKey: "" },
    { label: t.stats.waitingDocuments, value: stats?.waiting_documents ?? 0, color: "bg-amber-50 border-amber-200 text-amber-800",   activeRing: "ring-2 ring-amber-400",   statusKey: "waiting_documents" },
    { label: t.stats.highRisk,         value: stats?.high_risk ?? 0,         color: "bg-red-50 border-red-200 text-red-800",         activeRing: "ring-2 ring-red-400",     statusKey: "high_risk" },
    { label: t.stats.underReview,      value: stats?.under_review ?? 0,      color: "bg-indigo-50 border-indigo-200 text-indigo-800", activeRing: "ring-2 ring-indigo-400",  statusKey: "under_review" },
    { label: t.stats.approvedMonth,    value: stats?.approved_month ?? 0,    color: "bg-green-50 border-green-200 text-green-800",   activeRing: "ring-2 ring-green-400",   statusKey: "approved" },
  ];

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
          <button onClick={openQuestionnaire}
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

      {/* Stats cards — clickable to filter */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(({ label, value, color, activeRing, statusKey }) => {
            const isActive = statusFilter === statusKey && !(statusKey === "" && statusFilter !== "");
            return (
              <button
                key={label as string}
                type="button"
                onClick={() => handleStatClick(statusKey)}
                className={[
                  "rounded-2xl border p-4 text-left transition-all hover:opacity-90 active:scale-95",
                  color,
                  isActive ? activeRing : "",
                ].join(" ")}
              >
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-medium mt-1 opacity-75">{label as string}</p>
              </button>
            );
          })}
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
        {statusFilter && (
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t.allStatuses}
          </button>
        )}
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
                  <th className="px-4 py-3 w-10" />
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
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => void deleteCase(e, c.id)}
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === c.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
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

// ── QuestionForm component ────────────────────────────────────

const LOCALE_LABELS: Record<string, string> = { en: "English", de: "Deutsch", fr: "Français" };

function QuestionForm({
  form, setForm, questions, sections, saving, onSave, onCancel, inp, isNew, t,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  questions: QuestionTemplate[];
  sections: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  inp: string;
  isNew: boolean;
  t: Record<string, string>;
}) {
  const [activeTranslationTab, setActiveTranslationTab] = useState<TranslationLocale>("en");

  const set = (k: keyof FormState, v: FormState[keyof FormState]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const setTrans = (loc: TranslationLocale, field: keyof QuestionTranslations, v: string) =>
    setForm((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [loc]: { ...prev.translations[loc], [field]: v },
      },
    }));

  return (
    <div className="space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 text-sm">{isNew ? t.newQuestion : t.editQuestion}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.sectionNl} *</label>
          <input
            list="sections-list"
            value={form.section}
            onChange={(e) => set("section", e.target.value)}
            placeholder={t.sectionPlaceholder}
            className={inp}
          />
          <datalist id="sections-list">
            {sections.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.fieldType} *</label>
          <select value={form.field_type} onChange={(e) => set("field_type", e.target.value)} className={inp}>
            {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-0.5">{t.questionNl} *</label>
        <textarea rows={2} value={form.question} onChange={(e) => set("question", e.target.value)}
          placeholder={t.questionPlaceholder} className={inp + " resize-none"} />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-0.5">{t.actionNl}</label>
        <input value={form.action} onChange={(e) => set("action", e.target.value)}
          placeholder={t.actionPlaceholder} className={inp} />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          {Q_LOCALES.map((loc) => {
            const hasTrans = form.translations[loc].question.length > 0;
            return (
              <button key={loc} type="button"
                onClick={() => setActiveTranslationTab(loc)}
                className={[
                  "flex-1 py-2 text-xs font-semibold transition-colors",
                  activeTranslationTab === loc
                    ? "bg-white text-[#003566] border-b-2 border-[#003566]"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}>
                {LOCALE_LABELS[loc]}
                {hasTrans && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
              </button>
            );
          })}
        </div>
        <div className="p-3 space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-0.5">{t.sectionTranslation}</label>
            <input value={form.translations[activeTranslationTab].section}
              onChange={(e) => setTrans(activeTranslationTab, "section", e.target.value)}
              placeholder={t.sectionTranslationPlaceholder} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-0.5">{t.questionTranslation}</label>
            <textarea rows={2} value={form.translations[activeTranslationTab].question}
              onChange={(e) => setTrans(activeTranslationTab, "question", e.target.value)}
              placeholder={t.questionTranslationPlaceholder} className={inp + " resize-none"} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-0.5">{t.actionTranslation}</label>
            <input value={form.translations[activeTranslationTab].action}
              onChange={(e) => setTrans(activeTranslationTab, "action", e.target.value)}
              placeholder={t.actionTranslationPlaceholder} className={inp} />
          </div>
        </div>
      </div>

      {form.field_type === "dropdown" && (
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.dropdownOptions}</label>
          <textarea rows={3} value={form.options} onChange={(e) => set("options", e.target.value)}
            placeholder={"Option 1\nOption 2\nOption 3"} className={inp + " resize-none font-mono text-xs"} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.riskPoints}</label>
          <input type="number" min={0} value={form.risk_points}
            onChange={(e) => set("risk_points", Number(e.target.value))} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.riskFlag}</label>
          <select value={form.risk_flag} onChange={(e) => set("risk_flag", e.target.value as FormState["risk_flag"])} className={inp}>
            {RISK_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.sortOrder}</label>
          <input type="number" min={0} value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.conditionalOnId}</label>
          <input type="number" value={form.conditional_on_question_id}
            onChange={(e) => set("conditional_on_question_id", e.target.value)}
            placeholder={t.conditionalOnIdPlaceholder} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">{t.showWhen}</label>
          <input value={form.conditional_show_when}
            onChange={(e) => set("conditional_show_when", e.target.value)}
            placeholder={t.showWhenPlaceholder} className={inp} />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.required} onChange={(e) => set("required", e.target.checked)}
            className="rounded accent-[#003566]" />
          {t.required}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)}
            className="rounded accent-[#003566]" />
          {t.active}
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <X className="w-3.5 h-3.5" /> {t.cancel}
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {t.save}
        </button>
      </div>
    </div>
  );
}
