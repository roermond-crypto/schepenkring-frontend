"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RefreshCw, Save, Trash } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LOCALES = ["nl", "en", "de", "fr"] as const;
type Locale = (typeof LOCALES)[number];
type LocaleValue = Partial<Record<Locale, string>>;

const FIELD_TYPES = ["text", "textarea", "date", "select", "checkbox", "radio"] as const;
type FieldType = (typeof FIELD_TYPES)[number];
const OPTION_FIELD_TYPES: FieldType[] = ["select", "checkbox", "radio"];

type OptionRow = { value: string; label: LocaleValue };

type QuestionRow = {
  id: number;
  audience: "seller" | "buyer" | "both";
  step_key: string;
  field_type: FieldType;
  label: LocaleValue;
  help_text: LocaleValue | null;
  placeholder: LocaleValue | null;
  options: OptionRow[] | null;
  required: boolean;
  sort_order: number;
  active: boolean;
};

function emptyLocaleValue(): LocaleValue {
  return { nl: "", en: "", de: "", fr: "" };
}

function emptyQuestion(): QuestionRow {
  return {
    id: -Date.now(),
    audience: "both",
    step_key: "profile",
    field_type: "text",
    label: emptyLocaleValue(),
    help_text: emptyLocaleValue(),
    placeholder: emptyLocaleValue(),
    options: [],
    required: false,
    sort_order: 0,
    active: true,
  };
}

export default function OnboardingQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [audienceFilter, setAudienceFilter] = useState<"all" | "seller" | "buyer" | "both">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: QuestionRow[] }>("/admin/onboarding-questions", {
        params: audienceFilter !== "all" ? { audience: audienceFilter } : undefined,
      });
      setQuestions(res.data.data.map((q) => ({ ...q, options: q.options ?? [] })));
    } catch {
      toast.error("Kon vragen niet laden");
    } finally {
      setLoading(false);
    }
  }, [audienceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const addQuestion = () => {
    const q = emptyQuestion();
    setQuestions((prev) => [...prev, q]);
    setExpandedId(q.id);
  };

  const updateQuestion = (id: number, patch: Partial<QuestionRow>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const saveQuestion = async (question: QuestionRow) => {
    try {
      if (question.id < 0) {
        const res = await api.post<{ data: QuestionRow }>("/admin/onboarding-questions", question);
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? res.data.data : q)));
        setExpandedId(res.data.data.id);
      } else {
        await api.put(`/admin/onboarding-questions/${question.id}`, question);
      }
      toast.success("Opgeslagen");
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const deleteQuestion = async (question: QuestionRow) => {
    if (question.id > 0) {
      try {
        await api.delete(`/admin/onboarding-questions/${question.id}`);
      } catch {
        toast.error("Verwijderen mislukt");
        return;
      }
    }
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
  };

  const moveQuestion = (question: QuestionRow, direction: -1 | 1) => {
    const siblings = questions
      .filter((q) => q.step_key === question.step_key)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((q) => q.id === question.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const a = siblings[index];
    const b = siblings[targetIndex];
    updateQuestion(a.id, { sort_order: b.sort_order });
    updateQuestion(b.id, { sort_order: a.sort_order });

    void api.put("/admin/onboarding-questions/reorder", {
      items: [
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ],
    });
  };

  const addOption = (question: QuestionRow) => {
    updateQuestion(question.id, {
      options: [...(question.options ?? []), { value: "", label: emptyLocaleValue() }],
    });
  };

  const updateOption = (question: QuestionRow, index: number, patch: Partial<OptionRow>) => {
    const next = [...(question.options ?? [])];
    next[index] = { ...next[index], ...patch };
    updateQuestion(question.id, { options: next });
  };

  const removeOption = (question: QuestionRow, index: number) => {
    updateQuestion(question.id, { options: (question.options ?? []).filter((_, i) => i !== index) });
  };

  const sorted = [...questions].sort((a, b) => a.step_key.localeCompare(b.step_key) || a.sort_order - b.sort_order);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Onboarding vragen</h1>
          <p className="text-sm text-slate-500">
            Beheer extra profielvragen voor de verkoper- en koperonboarding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Verversen
          </Button>
          <Button size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" /> Vraag toevoegen
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "seller", "buyer", "both"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAudienceFilter(a)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border",
              audienceFilter === a ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200",
            )}
          >
            {a === "all" ? "Alle" : a === "seller" ? "Verkoper" : a === "buyer" ? "Koper" : "Beide"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-400">Nog geen vragen.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((question, index, arr) => (
            <QuestionCard
              key={question.id}
              question={question}
              expanded={expandedId === question.id}
              onToggleExpand={() => setExpandedId(expandedId === question.id ? null : question.id)}
              onChange={(patch) => updateQuestion(question.id, patch)}
              onSave={() => void saveQuestion(question)}
              onDelete={() => void deleteQuestion(question)}
              onMoveUp={() => moveQuestion(question, -1)}
              onMoveDown={() => moveQuestion(question, 1)}
              canMoveUp={index > 0 && arr[index - 1].step_key === question.step_key}
              canMoveDown={index < arr.length - 1 && arr[index + 1].step_key === question.step_key}
              onAddOption={() => addOption(question)}
              onUpdateOption={(i, patch) => updateOption(question, i, patch)}
              onRemoveOption={(i) => removeOption(question, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  expanded,
  onToggleExpand,
  onChange,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  question: QuestionRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<QuestionRow>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAddOption: () => void;
  onUpdateOption: (index: number, patch: Partial<OptionRow>) => void;
  onRemoveOption: (index: number) => void;
}) {
  const showOptions = OPTION_FIELD_TYPES.includes(question.field_type);

  return (
    <div className={cn("rounded-2xl border bg-white", question.active ? "border-slate-200" : "border-slate-100 opacity-60")}>
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-4 px-5 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{question.label.nl || "(geen label)"}</p>
          <p className="text-xs text-slate-400">
            {question.step_key} · {question.audience} · {question.field_type}
            {question.required && " · verplicht"}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className={cn("p-1 text-slate-400 hover:text-slate-700", !canMoveUp && "opacity-30 pointer-events-none")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </span>
          <span onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className={cn("p-1 text-slate-400 hover:text-slate-700", !canMoveDown && "opacity-30 pointer-events-none")}>
            <ArrowDown className="h-3.5 w-3.5" />
          </span>
          <span onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-slate-400 hover:text-red-600">
            <Trash className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Doelgroep</span>
              <select
                value={question.audience}
                onChange={(e) => onChange({ audience: e.target.value as QuestionRow["audience"] })}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="both">Beide</option>
                <option value="seller">Verkoper</option>
                <option value="buyer">Koper</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Stap</span>
              <Input value={question.step_key} onChange={(e) => onChange({ step_key: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Veldtype</span>
              <select
                value={question.field_type}
                onChange={(e) => onChange({ field_type: e.target.value as FieldType })}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={question.required} onChange={(e) => onChange({ required: e.target.checked })} />
                Verplicht
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={question.active} onChange={(e) => onChange({ active: e.target.checked })} />
                Actief
              </label>
            </div>
          </div>

          <LocaleFieldGroup label="Label" value={question.label} onChange={(v) => onChange({ label: v })} />
          <LocaleFieldGroup label="Hulptekst" value={question.help_text ?? emptyLocaleValue()} onChange={(v) => onChange({ help_text: v })} />
          <LocaleFieldGroup label="Placeholder" value={question.placeholder ?? emptyLocaleValue()} onChange={(v) => onChange({ placeholder: v })} />

          {showOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Opties</p>
                <Button size="sm" variant="outline" onClick={onAddOption}>
                  <Plus className="h-3 w-3 mr-1" /> Optie toevoegen
                </Button>
              </div>
              {(question.options ?? []).map((option, index) => (
                <div key={index} className="rounded-lg border border-slate-100 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="waarde"
                      value={option.value}
                      onChange={(e) => onUpdateOption(index, { value: e.target.value })}
                      className="max-w-[10rem]"
                    />
                    <Input
                      placeholder="label (NL)"
                      value={option.label.nl ?? ""}
                      onChange={(e) => onUpdateOption(index, { label: { ...option.label, nl: e.target.value } })}
                    />
                    <button onClick={() => onRemoveOption(index)} className="text-slate-400 hover:text-red-600">
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5 mr-2" /> Opslaan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocaleFieldGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LocaleValue;
  onChange: (value: LocaleValue) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {LOCALES.map((loc) => (
        <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
          <span className="text-[10px] font-bold uppercase text-slate-400">{loc}</span>
          <Input value={value[loc] ?? ""} onChange={(e) => onChange({ ...value, [loc]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}
