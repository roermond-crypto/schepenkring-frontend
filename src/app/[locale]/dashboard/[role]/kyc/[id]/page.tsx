"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getDictionary } from "@/lib/i18n";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────

interface Question {
  id: number;
  section: string;
  question: string;
  action: string | null;
  field_type: "yes_no" | "dropdown" | "text" | "textarea" | "date" | "number" | "money" | "country" | "document" | "photo" | "signature";
  options: string[] | null;
  risk_points: number;
  risk_flag: "none" | "warning" | "blocking" | "critical";
  required: boolean;
  conditional_on_question_id: number | null;
  conditional_show_when: string | null;
  current_answer: string | null;
  current_note: string | null;
  risk_points_awarded: number;
}

interface KycDocument {
  id: number;
  party: string;
  document_type: string;
  original_name: string;
  size: number;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

interface TimelineEntry {
  id: number;
  event: string;
  description: string | null;
  actor_name: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

interface KycFullCase {
  id: number;
  case_number: string;
  status: string;
  risk_score: number;
  risk_level: string;
  blocking: boolean;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_address: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
  buyer_iban: string | null;
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  boat_name: string | null;
  boat_type: string | null;
  boat_value: number | null;
  deal_value: number | null;
  payment_method: string | null;
  notes: string | null;
  rejection_reason: string | null;
  approved_by: { id: number; name: string } | null;
  approved_at: string | null;
  location: { id: number; name: string } | null;
  broker: { id: number; name: string } | null;
  answers: { question_id: number; answer: string; note: string | null; risk_points_awarded: number; answered_by: string | null }[];
  documents: KycDocument[];
  timeline: TimelineEntry[];
  missing_documents?: { party: string; type: string }[];
}

// ── Style maps (colors only — labels from i18n) ──────────────

const STATUS_COLORS: Record<string, string> = {
  draft:             "bg-slate-100 text-slate-700",
  in_progress:       "bg-blue-100 text-blue-800",
  waiting_documents: "bg-amber-100 text-amber-800",
  under_review:      "bg-indigo-100 text-indigo-800",
  approved:          "bg-green-100 text-green-800",
  rejected:          "bg-red-100 text-red-800",
  high_risk:         "bg-red-200 text-red-900",
  reported:          "bg-purple-100 text-purple-800",
};

const RISK_TEXT: Record<string, string> = {
  low:      "text-green-600",
  medium:   "text-amber-600",
  high:     "text-red-600",
  critical: "text-red-900 font-bold",
};

const RISK_BAR: Record<string, string> = {
  low:      "bg-green-500",
  medium:   "bg-amber-500",
  high:     "bg-red-500",
  critical: "bg-red-900",
};

const FLAG_BORDER: Record<string, string> = {
  none:     "border-slate-200",
  warning:  "border-amber-300 bg-amber-50/50",
  blocking: "border-red-400 bg-red-50/50",
  critical: "border-red-500 bg-red-50/50",
};

// ── Main page ────────────────────────────────────────────────

export default function KycCaseDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const locale   = params.locale as string;
  const role     = params.role as string;
  const caseId   = params.id as string;

  const t            = getDictionary(locale).KycDashboard;
  const td           = t.detail        as Record<string, string>;
  const statusLabels = t.status        as Record<string, string>;
  const riskLabels   = t.risk          as Record<string, string>;
  const riskLegend   = t.riskLegend    as Record<string, string>;
  const flagLabels   = t.flag          as Record<string, string>;
  const fieldLabels  = t.fields        as Record<string, string>;
  const partyLabels  = t.party         as Record<string, string>;
  const docLabels    = t.docTypes      as Record<string, string>;

  const [kycCase, setKycCase]   = useState<KycFullCase | null>(null);
  const [sections, setSections] = useState<Record<string, Question[]>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [answers, setAnswers]   = useState<Record<number, string>>({});
  const [notes, setNotes]       = useState<Record<number, string>>({});
  const [saving, setSaving]     = useState<number | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus]     = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploadingDoc, setUploadingDoc]    = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [uploadParty, setUploadParty]     = useState<"buyer" | "seller" | "boat">("buyer");
  const [uploadDocType, setUploadDocType] = useState("passport");
  const [editMode, setEditMode]       = useState(false);
  const [editData, setEditData]       = useState<Record<string, string>>({});
  const [savingCase, setSavingCase]   = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        kyc_case: KycFullCase;
        sections: Record<string, Question[]>;
        progress: Record<string, number>;
        missing_documents: { party: string; type: string }[];
      }>(`/admin/kyc-cases/${caseId}`);

      const caseWithMissing = { ...res.data.kyc_case, missing_documents: res.data.missing_documents ?? [] };
      setKycCase(caseWithMissing);
      setSections(res.data.sections ?? {});
      setProgress(res.data.progress ?? {});

      const answerMap: Record<number, string> = {};
      const noteMap: Record<number, string> = {};
      res.data.kyc_case.answers.forEach((a) => {
        answerMap[a.question_id] = a.answer;
        if (a.note) noteMap[a.question_id] = a.note;
      });
      setAnswers(answerMap);
      setNotes(noteMap);

      if (!activeSection && Object.keys(res.data.sections ?? {}).length > 0) {
        setActiveSection(Object.keys(res.data.sections)[0]);
      }
    } catch {
      toast.error(td.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [caseId, activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAnswer(questionId: number) {
    const answer = answers[questionId];
    if (answer === undefined || answer === "") return;
    setSaving(questionId);
    try {
      const res = await api.post<{ risk: { score: number; level: string }; blocking: boolean }>(
        `/admin/kyc-cases/${caseId}/answers`,
        { question_template_id: questionId, answer, note: notes[questionId] ?? null }
      );
      setKycCase((prev) => prev ? {
        ...prev,
        risk_score: res.data.risk.score,
        risk_level: res.data.risk.level,
        blocking: res.data.blocking,
      } : prev);
      toast.success(td.answeredOk);
    } catch {
      toast.error(td.saveFailed);
    } finally {
      setSaving(null);
    }
  }

  async function handleDocUpload(file: File) {
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("party", uploadParty);
    fd.append("document_type", uploadDocType);
    try {
      await api.post(`/admin/kyc-cases/${caseId}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(td.uploadOk);
      void load();
    } catch {
      toast.error(td.uploadFailed);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function verifyDocument(docId: number) {
    try {
      await api.post(`/admin/kyc-cases/${caseId}/verify-document`, { document_id: docId });
      toast.success(td.verifyOk);
      void load();
    } catch {
      toast.error(td.verifyFailed);
    }
  }

  async function updateStatus() {
    if (!newStatus) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/admin/kyc-cases/${caseId}/status`, {
        status: newStatus,
        rejection_reason: rejectReason || undefined,
      });
      toast.success(td.statusOk);
      setStatusModal(false);
      void load();
    } catch {
      toast.error(td.statusFailed);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openEdit() {
    if (!kycCase) return;
    setEditData({
      buyer_name:     kycCase.buyer_name     ?? "",
      buyer_email:    kycCase.buyer_email    ?? "",
      buyer_phone:    kycCase.buyer_phone    ?? "",
      buyer_address:  kycCase.buyer_address  ?? "",
      buyer_city:     kycCase.buyer_city     ?? "",
      buyer_country:  kycCase.buyer_country  ?? "",
      buyer_iban:     kycCase.buyer_iban     ?? "",
      seller_name:    kycCase.seller_name    ?? "",
      seller_email:   kycCase.seller_email   ?? "",
      seller_phone:   kycCase.seller_phone   ?? "",
      boat_name:      kycCase.boat_name      ?? "",
      boat_type:      kycCase.boat_type      ?? "",
      boat_value:     kycCase.boat_value     != null ? String(kycCase.boat_value) : "",
      deal_value:     kycCase.deal_value     != null ? String(kycCase.deal_value) : "",
      payment_method: kycCase.payment_method ?? "",
      notes:          kycCase.notes          ?? "",
    });
    setEditMode(true);
  }

  async function saveCase() {
    setSavingCase(true);
    try {
      const payload: Record<string, string | number | null> = {};
      for (const [k, v] of Object.entries(editData)) {
        if (["boat_value", "deal_value"].includes(k)) {
          payload[k] = v === "" ? null : Number(v);
        } else {
          payload[k] = v === "" ? null : v;
        }
      }
      const res = await api.patch<{ kyc_case: KycFullCase }>(`/admin/kyc-cases/${caseId}`, payload);
      setKycCase((prev) => prev ? { ...prev, ...res.data.kyc_case, missing_documents: prev.missing_documents } : prev);
      setEditMode(false);
      toast.success(td.savedOk ?? "Opgeslagen");
    } catch {
      toast.error(td.saveFailed);
    } finally {
      setSavingCase(false);
    }
  }

  async function deleteCase() {
    if (!confirm(td.deleteConfirm ?? "Weet je zeker dat je dit dossier wilt verwijderen?")) return;
    setDeletingCase(true);
    try {
      await api.delete(`/admin/kyc-cases/${caseId}`);
      toast.success(td.deleteOk ?? "Dossier verwijderd");
      router.push(`/${locale}/dashboard/${role}/kyc`);
    } catch {
      toast.error(td.deleteFailed ?? "Verwijderen mislukt.");
      setDeletingCase(false);
    }
  }

  function isVisible(q: Question): boolean {
    if (!q.conditional_on_question_id) return true;
    const parentAnswer = answers[q.conditional_on_question_id]?.toLowerCase();
    const showWhen = (q.conditional_show_when ?? "yes").toLowerCase();
    return parentAnswer === showWhen || parentAnswer === "ja";
  }

  function renderField(q: Question) {
    const val    = answers[q.id] ?? "";
    const change = (v: string) => setAnswers((prev) => ({ ...prev, [q.id]: v }));
    const cls    = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10";

    if (q.field_type === "yes_no") {
      return (
        <div className="flex gap-3">
          {([["ja", td.yes], ["nee", td.no]] as [string, string][]).map(([v, label]) => (
            <button key={v} onClick={() => { change(v); void saveAnswer(q.id); }} disabled={saving === q.id}
              className={[
                "flex-1 py-2 rounded-xl border text-sm font-semibold transition-all",
                val === v
                  ? v === "ja" ? "bg-[#003566] border-[#003566] text-white" : "bg-slate-700 border-slate-700 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              ].join(" ")}>
              {saving === q.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : label}
            </button>
          ))}
        </div>
      );
    }

    if (q.field_type === "dropdown" && q.options) {
      return (
        <select className={cls} value={val} onChange={(e) => change(e.target.value)} onBlur={() => void saveAnswer(q.id)}>
          <option value="">{td.chooseOption}</option>
          {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    if (q.field_type === "textarea") {
      return <textarea rows={3} className={cls + " resize-none"} value={val}
        onChange={(e) => change(e.target.value)} onBlur={() => void saveAnswer(q.id)} />;
    }

    if (q.field_type === "date") {
      return <input type="date" className={cls} value={val}
        onChange={(e) => change(e.target.value)} onBlur={() => void saveAnswer(q.id)} />;
    }

    if (q.field_type === "money" || q.field_type === "number") {
      return <input type="number" className={cls} value={val}
        onChange={(e) => change(e.target.value)} onBlur={() => void saveAnswer(q.id)}
        placeholder={q.field_type === "money" ? "€ 0,00" : "0"} />;
    }

    return <input type="text" className={cls} value={val}
      onChange={(e) => change(e.target.value)} onBlur={() => void saveAnswer(q.id)}
      placeholder={q.field_type === "country" ? "NL, DE, BE..." : ""} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!kycCase) {
    return <div className="p-6 text-slate-500">{td.notFound}</div>;
  }

  const statusColor = STATUS_COLORS[kycCase.status] ?? STATUS_COLORS.draft;
  const statusLabel = statusLabels[kycCase.status] ?? kycCase.status;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/${locale}/dashboard/${role}/kyc`)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{kycCase.case_number}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
              {kycCase.blocking && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900 animate-pulse">
                  {t.blocksDeal as string}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {kycCase.buyer_name ?? "—"} · {kycCase.boat_name ?? "—"}
              {kycCase.deal_value ? ` · € ${Number(kycCase.deal_value).toLocaleString("nl-NL")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => load()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={deleteCase} disabled={deletingCase}
            className="p-2 rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-red-500 disabled:opacity-50">
            {deletingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://app.schepen-kring.nl/api"}/admin/kyc-cases/${caseId}/pdf?print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </a>
          <button onClick={() => { setNewStatus(kycCase.status); setStatusModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors">
            <ShieldCheck className="w-4 h-4" />
            {td.statusChange}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: questions ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Section tabs */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(sections).map((sec) => {
              const pct = progress[sec] ?? 0;
              return (
                <button key={sec} onClick={() => setActiveSection(sec)}
                  className={[
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    activeSection === sec
                      ? "bg-[#003566] text-white border-[#003566]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                  ].join(" ")}>
                  {sec}
                  <span className={[
                    "px-1.5 py-0.5 rounded-full text-xs",
                    pct === 100 ? "bg-green-500 text-white" :
                    pct > 0 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500",
                  ].join(" ")}>
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Questions in active section */}
          {activeSection && sections[activeSection] && (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-900 text-base">{activeSection}</h2>
              {sections[activeSection].map((q) => {
                if (!isVisible(q)) return null;
                const borderCls = FLAG_BORDER[q.risk_flag] ?? FLAG_BORDER.none;
                const answered  = answers[q.id] !== undefined && answers[q.id] !== "";
                return (
                  <div key={q.id} className={`rounded-2xl border p-4 bg-white ${borderCls}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {q.required && <span className="text-xs text-red-600 font-semibold">{td.required}</span>}
                          {q.risk_points > 0 && (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              +{q.risk_points}p
                            </span>
                          )}
                          {q.risk_flag !== "none" && (
                            <span className={[
                              "text-xs px-1.5 py-0.5 rounded-full font-medium",
                              q.risk_flag === "blocking" || q.risk_flag === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                            ].join(" ")}>
                              {flagLabels[q.risk_flag] ?? q.risk_flag}
                            </span>
                          )}
                          {answered && <Check className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                        <p className="text-sm text-slate-800 font-medium">{q.question}</p>
                        {q.action && <p className="text-xs text-slate-500 mt-1 italic">→ {q.action}</p>}
                      </div>
                    </div>

                    {renderField(q)}

                    <div className="mt-2">
                      <input type="text" placeholder={td.notePlaceholder}
                        value={notes[q.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        onBlur={() => { if (answers[q.id]) void saveAnswer(q.id); }}
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50 outline-none focus:border-slate-300 text-slate-500 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: risk, case data, docs, timeline ── */}
        <div className="space-y-4">

          {/* Risk score */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{td.riskScore}</p>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-4xl font-black ${RISK_TEXT[kycCase.risk_level]}`}>{kycCase.risk_score}</span>
              <span className="text-sm text-slate-400 mb-1">{td.points}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
              <div className={`h-2 rounded-full transition-all ${RISK_BAR[kycCase.risk_level]}`}
                style={{ width: `${Math.min(100, kycCase.risk_score)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 = {riskLabels.low}</span>
              <span className={`font-semibold ${RISK_TEXT[kycCase.risk_level]}`}>
                {riskLabels[kycCase.risk_level]}
              </span>
              <span>100+ = {riskLabels.critical}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-1 text-xs text-slate-500">
              {(Object.entries(riskLegend) as [string, string][]).map(([range, label]) => {
                const level = range === "0-20" ? "low" : range === "21-60" ? "medium" : range === "61-100" ? "high" : "critical";
                return (
                  <div key={range} className="flex items-center gap-1">
                    <span className={`font-mono ${RISK_TEXT[level]}`}>{range}</span>
                    <span className={RISK_TEXT[level]}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Case data */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{td.caseData}</p>
              {!editMode ? (
                <button onClick={openEdit}
                  className="flex items-center gap-1 text-xs text-[#003566] hover:underline">
                  <Pencil className="w-3 h-3" />
                  {td.edit ?? "Bewerken"}
                </button>
              ) : null}
            </div>

            {editMode ? (
              <div className="space-y-3">
                {([
                  { label: fieldLabels.buyer,    key: "buyer_name",     type: "text" },
                  { label: fieldLabels.email,    key: "buyer_email",    type: "email" },
                  { label: fieldLabels.phone,    key: "buyer_phone",    type: "text" },
                  { label: fieldLabels.address,  key: "buyer_address",  type: "text" },
                  { label: fieldLabels.iban,     key: "buyer_iban",     type: "text" },
                  { label: fieldLabels.seller,   key: "seller_name",    type: "text" },
                  { label: fieldLabels.boat,     key: "boat_name",      type: "text" },
                  { label: fieldLabels.boatType, key: "boat_type",      type: "text" },
                  { label: fieldLabels.value,    key: "deal_value",     type: "number" },
                  { label: fieldLabels.payment,  key: "payment_method", type: "text" },
                ] as { label: string; key: string; type: string }[]).map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-0.5">{label}</label>
                    <input
                      type={type}
                      value={editData[key] ?? ""}
                      onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#003566] bg-white"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-slate-400 mb-0.5">{td.notesLabel ?? "Notities"}</label>
                  <textarea
                    rows={2}
                    value={editData.notes ?? ""}
                    onChange={(e) => setEditData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#003566] bg-white resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditMode(false)}
                    className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <X className="w-3.5 h-3.5" />
                    {td.cancel}
                  </button>
                  <button onClick={saveCase} disabled={savingCase}
                    className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors disabled:opacity-60">
                    {savingCase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {td.saveStatus}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {([
                  [fieldLabels.buyer,    kycCase.buyer_name],
                  [fieldLabels.email,    kycCase.buyer_email],
                  [fieldLabels.phone,    kycCase.buyer_phone],
                  [fieldLabels.address,  [kycCase.buyer_address, kycCase.buyer_city, kycCase.buyer_country].filter(Boolean).join(", ") || null],
                  [fieldLabels.iban,     kycCase.buyer_iban],
                  [fieldLabels.seller,   kycCase.seller_name],
                  [fieldLabels.boat,     kycCase.boat_name],
                  [fieldLabels.boatType, kycCase.boat_type],
                  [fieldLabels.value,    kycCase.deal_value ? `€ ${Number(kycCase.deal_value).toLocaleString("nl-NL")}` : null],
                  [fieldLabels.payment,  kycCase.payment_method],
                  [fieldLabels.broker,   kycCase.broker?.name],
                  [fieldLabels.location, kycCase.location?.name],
                  [td.notesLabel ?? "Notities", kycCase.notes],
                ] as [string, string | null | undefined][]).map(([label, value]) => value ? (
                  <div key={label} className="flex gap-2">
                    <span className="text-slate-400 w-20 shrink-0">{label}</span>
                    <span className="text-slate-700 font-medium break-all">{value}</span>
                  </div>
                ) : null)}
                {!kycCase.buyer_name && !kycCase.boat_name && !kycCase.deal_value && (
                  <p className="text-xs text-slate-400 italic py-2">
                    {td.noDataYet ?? "Nog geen gegevens. Klik op bewerken om te beginnen."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{td.documents}</p>

            {/* Missing documents checklist */}
            {kycCase.missing_documents && kycCase.missing_documents.length > 0 && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-bold text-amber-800 mb-1.5">Vereiste documenten ontbreken:</p>
                {kycCase.missing_documents.map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-medium">{partyLabels[m.party] ?? m.party}</span>
                    <span>—</span>
                    <span>{docLabels[m.type] ?? m.type}</span>
                  </div>
                ))}
              </div>
            )}

            {kycCase.documents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">{td.noDocuments}</p>
            ) : (
              <div className="space-y-2 mb-4">
                {kycCase.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {docLabels[d.document_type] ?? d.document_type}
                        </p>
                        <p className="text-xs text-slate-400">
                          {partyLabels[d.party] ?? d.party} · {d.uploaded_by}
                        </p>
                      </div>
                    </div>
                    {d.verified ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <button onClick={() => verifyDocument(d.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors shrink-0">
                        {td.verify}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={uploadParty} onChange={(e) => setUploadParty(e.target.value as "buyer" | "seller" | "boat")}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none">
                  {(["buyer", "seller", "boat"] as const).map((p) => (
                    <option key={p} value={p}>{partyLabels[p]}</option>
                  ))}
                </select>
                <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none">
                  {Object.entries(docLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <label className={[
                "flex items-center justify-center gap-2 w-full py-2 rounded-xl border-2 border-dashed text-xs font-semibold cursor-pointer transition-colors",
                uploadingDoc ? "border-slate-200 text-slate-300" : "border-[#003566]/30 text-[#003566] hover:border-[#003566] hover:bg-[#003566]/5",
              ].join(" ")}>
                {uploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingDoc ? td.uploading : td.uploadDocument}
                <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  disabled={uploadingDoc}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); }} />
              </label>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{td.timeline}</p>
            {kycCase.timeline.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">{td.noActivity}</p>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-slate-100" />
                {kycCase.timeline.slice().reverse().map((entry) => (
                  <div key={entry.id} className="relative mb-4 last:mb-0">
                    <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-[#003566] border-2 border-white shadow" />
                    <p className="text-xs font-semibold text-slate-700">{entry.description ?? entry.event}</p>
                    <p className="text-xs text-slate-400">
                      {entry.actor_name && `${entry.actor_name} · `}
                      {new Date(entry.created_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{td.changeStatus}</h3>

            <div className="space-y-3">
              {Object.keys(STATUS_COLORS).map((key) => (
                <button key={key} onClick={() => setNewStatus(key)}
                  className={[
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                    newStatus === key ? "border-[#003566] bg-[#003566]/5" : "border-slate-200 hover:border-slate-300",
                  ].join(" ")}>
                  <span>{statusLabels[key] ?? key}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[key]}`}>{key}</span>
                </button>
              ))}
            </div>

            {(newStatus === "rejected" || newStatus === "reported") && (
              <textarea rows={3} placeholder={td.reasonPlaceholder} value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#003566] resize-none"
              />
            )}

            <div className="mt-5 flex gap-3">
              <button onClick={() => setStatusModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                {td.cancel}
              </button>
              <button onClick={updateStatus} disabled={!newStatus || updatingStatus}
                className="flex-1 py-2.5 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                {td.saveStatus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
