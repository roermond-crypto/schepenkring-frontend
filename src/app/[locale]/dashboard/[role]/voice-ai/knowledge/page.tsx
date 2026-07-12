"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, BookOpen } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Reuses the existing Faq/CopilotFaqService knowledge base — the one system
// actually wired into live AI grounding via Pinecone — rather than building
// a 4th parallel KB system. Voice-relevant entries are just Faq rows tagged
// category=voice_ai.
const VOICE_CATEGORY = "voice_ai";

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  language: string | null;
  location_id: number;
};

type LocationOption = { id: number; name: string };

export default function VoiceKnowledgePage() {
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ location_id: "", question: "", answer: "", language: "nl" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [faqRes, locRes] = await Promise.all([
        api.get<{ data: FaqRow[] }>("/faqs", { params: { category: VOICE_CATEGORY, per_page: 100 } }),
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
    void load();
  }, [load]);

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
        visibility: "internal",
        source_type: "manual_voice_kb",
      });
      toast.success("Toegevoegd aan kennisbank");
      setForm({ location_id: "", question: "", answer: "", language: "nl" });
      setShowForm(false);
      await load();
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setSaving(false);
    }
  };

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

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen kennisbank-items voor voice AI.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {faqs.map((faq) => (
              <div key={faq.id} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800">{faq.question}</p>
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
