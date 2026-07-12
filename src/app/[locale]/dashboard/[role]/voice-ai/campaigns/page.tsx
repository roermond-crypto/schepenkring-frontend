"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Play, Pause, Users } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CampaignRow = {
  id: number;
  name: string;
  type: string;
  status: string;
  min_score_to_call: number;
  targets_count: number;
  location?: { id: number; name: string } | null;
};

const CAMPAIGN_TYPES = [
  "seller_followup", "buyer_followup", "harbor_outreach", "viewing_confirmation",
  "bid_followup", "contract_reminder", "payment_reminder", "callback_followup",
  "onboarding_incomplete",
];

export default function VoiceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: CAMPAIGN_TYPES[0], email_template_key: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CampaignRow[] }>("/admin/voice-ai/campaigns");
      setCampaigns(res.data.data);
    } catch {
      toast.error("Kon campagnes niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createCampaign = async () => {
    if (!form.name) {
      toast.error("Naam is verplicht");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/voice-ai/campaigns", { ...form, status: "draft" });
      toast.success("Campagne aangemaakt");
      setForm({ name: "", type: CAMPAIGN_TYPES[0], email_template_key: "" });
      setShowForm(false);
      await load();
    } catch {
      toast.error("Aanmaken mislukt");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (campaign: CampaignRow) => {
    const nextStatus = campaign.status === "active" ? "paused" : "active";
    try {
      await api.put(`/admin/voice-ai/campaigns/${campaign.id}`, { name: campaign.name, type: campaign.type, status: nextStatus });
      toast.success(nextStatus === "active" ? "Campagne actief" : "Campagne gepauzeerd");
      await load();
    } catch {
      toast.error("Bijwerken mislukt");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Voice AI Campagnes</h1>
          <p className="text-sm text-slate-500">Email-first funnel: verstuurd → betrokkenheid → score → gebeld.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Campagne toevoegen
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="Naam" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              placeholder="Email template key"
              value={form.email_template_key}
              onChange={(e) => setForm((f) => ({ ...f, email_template_key: e.target.value }))}
            />
          </div>
          <Button size="sm" onClick={() => void createCampaign()} disabled={saving}>
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
        ) : campaigns.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen campagnes.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>{c.type}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.targets_count} leads
                    </span>
                    <span>min. score {c.min_score_to_call}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full",
                      c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {c.status}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void toggleActive(c)}>
                    {c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
