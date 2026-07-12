"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, BookOpen } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Reuses the existing Faq/CopilotFaqService knowledge base — the one system
// actually wired into live AI grounding via Pinecone — rather than building
// a 4th parallel KB system. Voice-relevant entries are Faq rows tagged
// category=voice_ai, with the 7 knowledge areas from spec §13 modeled as
// Faq.tags (already an array column with tag-filtering support in
// FaqController) rather than 7 separate KB systems.
const VOICE_CATEGORY = "voice_ai";

const KNOWLEDGE_AREAS = [
  { tag: "global", label: "Algemeen Schepenkring" },
  { tag: "seller_process", label: "Verkoopproces" },
  { tag: "buyer_process", label: "Koopproces" },
  { tag: "yacht_onboarding", label: "Boot onboarding" },
  { tag: "viewing_bidding", label: "Bezichtiging & bieden" },
  { tag: "contracts_escrow", label: "Contracten & escrow" },
  { tag: "locations_harbors", label: "Locaties & havensamenwerking" },
];

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  language: string | null;
  location_id: number;
  tags: string[] | null;
};

type LocationOption = { id: number; name: string };

export default function VoiceKnowledgePage() {
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeArea, setActiveArea] = useState<string>("");
  const [form, setForm] = useState({
    location_id: "",
    question: "",
    answer: "",
    language: "nl",
    tag: KNOWLEDGE_AREAS[0].tag,
  });

  const load = useCallback(async (area: string) => {
    setLoading(true);
    try {
      const [faqRes, locRes] = await Promise.all([
        api.get<{ data: FaqRow[] }>("/faqs", {
          params: { category: VOICE_CATEGORY, per_page: 100, ...(area ? { tag: area } : {}) },
        }),
        api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200"),
      ]);
      setFaqs(faqRes.data.data);
      setLocations(locRes.data.data);
    } catch {
      toast.error("Kon kennisbank niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeArea);
  }, [load, activeArea]);

  const createFaq = async () => {
    if (!form.location_id || !form.question || !form.answer) {
      toast.error("Locatie, vraag en antwoord zijn verplicht");
      return;
    }
    setSaving(true);
    try {
      await api.post("/faqs", {
        location_id: Number(form.location_id),
        question: form.question,
        answer: form.answer,
        language: form.language,
        category: VOICE_CATEGORY,
        tags: [form.tag],
        visibility: "internal",
        source_type: "manual_voice_kb",
      });
      toast.success("Toegevoegd aan kennisbank");
      setForm({ location_id: "", question: "", answer: "", language: "nl", tag: KNOWLEDGE_AREAS[0].tag });
      setShowForm(false);
      await load(activeArea);
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setSaving(false);
    }
  };

  const areaLabel = (tag: string) => KNOWLEDGE_AREAS.find((a) => a.tag === tag)?.label ?? tag;

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Voice AI Kennisbank</h1>
          <p className="text-sm text-slate-500">
            Gedeeld met de chat-AI grounding — agents mogen nooit prijzen, status of garanties verzinnen.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Item toevoegen
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveArea("")}
          className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-full border",
            activeArea === "" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200",
          )}
        >
          Alle gebieden
        </button>
        {KNOWLEDGE_AREAS.map((area) => (
          <button
            key={area.tag}
            onClick={() => setActiveArea(area.tag)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border",
              activeArea === area.tag ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200",
            )}
          >
            {area.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.location_id}
              onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
            >
              <option value="">Kies locatie...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
            >
              {KNOWLEDGE_AREAS.map((area) => (
                <option key={area.tag} value={area.tag}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
          <Input placeholder="Vraag" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            placeholder="Antwoord"
            value={form.answer}
            onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          />
          <Button size="sm" onClick={() => void createFaq()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Opslaan
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : faqs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen kennisbank-items voor dit gebied.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {faqs.map((faq) => (
              <div key={faq.id} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800">{faq.question}</p>
                  {faq.tags?.[0] && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {areaLabel(faq.tags[0])}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1 ml-5">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
