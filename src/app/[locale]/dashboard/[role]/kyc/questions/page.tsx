"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

interface QuestionTemplate {
  id: number;
  section: string;
  question: string;
  action: string | null;
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

const EMPTY_FORM = {
  section: "",
  question: "",
  action: "",
  field_type: "yes_no",
  options: "",
  risk_points: 0,
  risk_flag: "none" as const,
  required: true,
  conditional_on_question_id: "",
  conditional_show_when: "",
  sort_order: 0,
  active: true,
};

type FormState = typeof EMPTY_FORM;

export default function KycQuestionsPage() {
  const params = useParams();
  const locale = params.locale as string;

  const [questions, setQuestions] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: QuestionTemplate[] }>("/admin/kyc-questions");
      setQuestions(res.data.data ?? []);
    } catch {
      toast.error("Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sections = [...new Set(questions.map((q) => q.section))];

  function startNew() {
    setForm({ ...EMPTY_FORM, section: sections[0] ?? "" });
    setEditingId("new");
  }

  function startEdit(q: QuestionTemplate) {
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
    });
    setEditingId(q.id);
  }

  function buildPayload() {
    return {
      section:                    form.section,
      question:                   form.question,
      action:                     form.action || null,
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

  async function save() {
    if (!form.section || !form.question) {
      toast.error("Sectie en vraag zijn verplicht");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        const res = await api.post<{ data: QuestionTemplate }>("/admin/kyc-questions", buildPayload());
        setQuestions((prev) => [...prev, res.data.data].sort((a, b) => a.sort_order - b.sort_order));
        toast.success("Vraag aangemaakt");
      } else {
        const res = await api.patch<{ data: QuestionTemplate }>(`/admin/kyc-questions/${editingId}`, buildPayload());
        setQuestions((prev) => prev.map((q) => q.id === editingId ? res.data.data : q));
        toast.success("Vraag opgeslagen");
      }
      setEditingId(null);
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: number) {
    if (!confirm("Weet je zeker dat je deze vraag wilt verwijderen?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/kyc-questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success("Vraag verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    } finally {
      setDeletingId(null);
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
      toast.error("Volgorde opslaan mislukt");
      void load();
    }
  }

  function toggleSection(s: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const inp = "w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 outline-none focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10 bg-white";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Toaster />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-[#003566]" />
            KYC Vragenlijst beheer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Voeg vragen toe, bewerk ze of verwijder ze. Volgorde bepaalt de weergave.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={startNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors">
            <Plus className="w-4 h-4" />
            Nieuwe vraag
          </button>
        </div>
      </div>

      {/* New question form */}
      {editingId === "new" && (
        <QuestionForm
          form={form}
          setForm={setForm}
          questions={questions}
          sections={sections}
          saving={saving}
          onSave={() => void save()}
          onCancel={() => setEditingId(null)}
          inp={inp}
          isNew
        />
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : sections.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nog geen vragen. Klik op &ldquo;Nieuwe vraag&rdquo; om te beginnen.</p>
        </div>
      ) : (
        sections.map((section) => {
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
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{sectionQs.length} vragen</span>
                </div>
                {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
              </button>

              {!collapsed && (
                <div className="divide-y divide-slate-100">
                  {sectionQs.map((q, idx) => (
                    <div key={q.id}>
                      {editingId === q.id ? (
                        <div className="p-5 bg-blue-50/40">
                          <QuestionForm
                            form={form}
                            setForm={setForm}
                            questions={questions}
                            sections={sections}
                            saving={saving}
                            onSave={() => void save()}
                            onCancel={() => setEditingId(null)}
                            inp={inp}
                            isNew={false}
                          />
                        </div>
                      ) : (
                        <div className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/60 group">
                          {/* Order buttons */}
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

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-slate-800">{q.question}</span>
                              {!q.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">Inactief</span>}
                              {q.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Verplicht</span>}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${FLAG_COLORS[q.risk_flag]}`}>{q.risk_flag} {q.risk_points > 0 ? `+${q.risk_points}p` : ""}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{q.field_type}</span>
                            </div>
                            {q.action && <p className="text-xs text-slate-400 truncate">→ {q.action}</p>}
                            {q.conditional_on_question_id && (
                              <p className="text-xs text-slate-400">Conditioneel op vraag #{q.conditional_on_question_id} = {q.conditional_show_when}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => startEdit(q)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#003566] hover:bg-blue-50 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => void deleteQuestion(q.id)} disabled={deletingId === q.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              {deletingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

function QuestionForm({
  form, setForm, questions, sections, saving, onSave, onCancel, inp, isNew,
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
}) {
  const set = (k: keyof FormState, v: FormState[keyof FormState]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 text-sm">{isNew ? "Nieuwe vraag" : "Vraag bewerken"}</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Section */}
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Sectie *</label>
          <input
            list="sections-list"
            value={form.section}
            onChange={(e) => set("section", e.target.value)}
            placeholder="Bijv. Klant"
            className={inp}
          />
          <datalist id="sections-list">
            {sections.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        {/* Field type */}
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Veldtype *</label>
          <select value={form.field_type} onChange={(e) => set("field_type", e.target.value)} className={inp}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Question */}
      <div>
        <label className="block text-xs text-slate-400 mb-0.5">Vraag *</label>
        <textarea rows={2} value={form.question} onChange={(e) => set("question", e.target.value)}
          placeholder="Bijv. Cliënt is een natuurlijk persoon." className={inp + " resize-none"} />
      </div>

      {/* Action / hint */}
      <div>
        <label className="block text-xs text-slate-400 mb-0.5">Actie / hint (optioneel)</label>
        <input value={form.action} onChange={(e) => set("action", e.target.value)}
          placeholder="Bijv. → Kopie van identiteitsbewijs." className={inp} />
      </div>

      {/* Dropdown options */}
      {form.field_type === "dropdown" && (
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Opties (één per regel)</label>
          <textarea rows={3} value={form.options} onChange={(e) => set("options", e.target.value)}
            placeholder={"Optie 1\nOptie 2\nOptie 3"} className={inp + " resize-none font-mono text-xs"} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {/* Risk points */}
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Risicopunten</label>
          <input type="number" min={0} value={form.risk_points}
            onChange={(e) => set("risk_points", Number(e.target.value))} className={inp} />
        </div>

        {/* Risk flag */}
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Risicovlag</label>
          <select value={form.risk_flag} onChange={(e) => set("risk_flag", e.target.value as FormState["risk_flag"])} className={inp}>
            {RISK_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Volgorde</label>
          <input type="number" min={0} value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))} className={inp} />
        </div>
      </div>

      {/* Conditional */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Conditioneel op vraag ID</label>
          <input type="number" value={form.conditional_on_question_id}
            onChange={(e) => set("conditional_on_question_id", e.target.value)}
            placeholder="Leeg = altijd zichtbaar" className={inp} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-0.5">Toon wanneer antwoord =</label>
          <input value={form.conditional_show_when}
            onChange={(e) => set("conditional_show_when", e.target.value)}
            placeholder="ja / nee / waarde" className={inp} />
        </div>
      </div>

      {/* Flags */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.required} onChange={(e) => set("required", e.target.checked)}
            className="rounded accent-[#003566]" />
          Verplicht
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)}
            className="rounded accent-[#003566]" />
          Actief
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <X className="w-3.5 h-3.5" /> Annuleren
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#003566] text-white text-sm font-semibold hover:bg-[#002a52] transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Opslaan
        </button>
      </div>
    </div>
  );
}
