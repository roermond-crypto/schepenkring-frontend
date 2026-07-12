"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Bot } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VoiceAgent = {
  id: number;
  name: string;
  slug: string;
  language: string | null;
  purpose: string | null;
  voice: string | null;
  model: string | null;
  status: string;
  retell_agent_id: string | null;
};

// Suggested slugs from spec §8 — a starting point, not an enforced list.
const SUGGESTED_SLUGS = [
  "seller_outbound_nl", "seller_outbound_en", "seller_outbound_de", "seller_outbound_fr",
  "buyer_support", "seller_onboarding_support", "harbor_outreach", "schepenkring_reception",
  "viewing_support", "bid_support", "deal_support", "contract_support",
  "payment_escrow_support", "broker_transfer",
];

export default function VoiceAgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", language: "nl", voice: "", model: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: VoiceAgent[] }>("/admin/voice-ai/agents");
      setAgents(res.data.data);
    } catch {
      toast.error("Kon agents niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createAgent = async () => {
    if (!form.name || !form.slug) {
      toast.error("Naam en slug zijn verplicht");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/voice-ai/agents", { ...form, status: "inactive" });
      toast.success("Agent aangemaakt");
      setForm({ name: "", slug: "", language: "nl", voice: "", model: "" });
      setShowForm(false);
      await load();
    } catch {
      toast.error("Aanmaken mislukt — bestaat deze slug al?");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (agent: VoiceAgent) => {
    try {
      await api.put(`/admin/voice-ai/agents/${agent.id}`, {
        name: agent.name,
        slug: agent.slug,
        status: agent.status === "active" ? "inactive" : "active",
      });
      await load();
    } catch {
      toast.error("Bijwerken mislukt");
    }
  };

  const removeAgent = async (id: number) => {
    if (!confirm("Deze agent verwijderen?")) return;
    try {
      await api.delete(`/admin/voice-ai/agents/${id}`);
      toast.success("Verwijderd");
      await load();
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Voice AI Agents</h1>
          <p className="text-sm text-slate-500">Aparte agent per doel/taal (spec §8) — geen oversized prompt.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Agent toevoegen
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Naam" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input
              placeholder="slug (bv. seller_outbound_nl)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              list="voice-agent-slugs"
            />
            <datalist id="voice-agent-slugs">
              {SUGGESTED_SLUGS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            >
              <option value="nl">Nederlands</option>
              <option value="en">Engels</option>
              <option value="de">Duits</option>
              <option value="fr">Frans</option>
            </select>
            <Input placeholder="Voice (Retell voice ID)" value={form.voice} onChange={(e) => setForm((f) => ({ ...f, voice: e.target.value }))} />
          </div>
          <Button size="sm" onClick={() => void createAgent()} disabled={saving}>
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
        ) : agents.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen agents geconfigureerd.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {agents.map((agent) => (
              <div key={agent.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{agent.name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {agent.slug} · {agent.language ?? "—"} {agent.retell_agent_id ? "· gekoppeld" : "· niet gekoppeld aan Retell"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void toggleStatus(agent)}
                    className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full",
                      agent.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {agent.status === "active" ? "actief" : "inactief"}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => void removeAgent(agent.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
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
