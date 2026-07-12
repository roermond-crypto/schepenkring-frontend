"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Play, Pause, Users, ChevronDown, ChevronUp } from "lucide-react";
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

type LocationOption = { id: number; name: string };

const CAMPAIGN_TYPES = [
  "seller_followup", "buyer_followup", "harbor_outreach", "viewing_confirmation",
  "bid_followup", "contract_reminder", "payment_reminder", "callback_followup",
  "onboarding_incomplete",
];

export default function VoiceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: CAMPAIGN_TYPES[0], email_template_key: "" });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [leadStatus, setLeadStatus] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [addingTargets, setAddingTargets] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, locRes] = await Promise.all([
        api.get<{ data: CampaignRow[] }>("/admin/voice-ai/campaigns"),
        api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200"),
      ]);
      setCampaigns(campRes.data.data);
      setLocations(locRes.data.data);
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

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setLeadStatus("");
    setSelectedLocationIds([]);
  };

  const addLeadTargets = async (campaignId: number) => {
    setAddingTargets(true);
    try {
      const res = await api.post<{ added: number }>(`/admin/voice-ai/campaigns/${campaignId}/targets`, {
        lead_status: leadStatus || undefined,
      });
      toast.success(`${res.data.added} lead(s) toegevoegd`);
      setLeadStatus("");
      await load();
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setAddingTargets(false);
    }
  };

  const addLocationTargets = async (campaignId: number) => {
    if (selectedLocationIds.length === 0) {
      toast.error("Kies minstens één locatie");
      return;
    }
    setAddingTargets(true);
    try {
      const res = await api.post<{ added: number }>(`/admin/voice-ai/campaigns/${campaignId}/targets`, {
        target_location_ids: selectedLocationIds,
      });
      toast.success(`${res.data.added} locatie(s) toegevoegd`);
      setSelectedLocationIds([]);
      await load();
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setAddingTargets(false);
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
              <div key={c.id}>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                      <span>{c.type}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {c.targets_count} doelen
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
                    <Button variant="outline" size="sm" onClick={() => toggleExpanded(c.id)}>
                      Doelgroep {expandedId === c.id ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                    </Button>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="px-5 pb-5 bg-slate-50 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Leads toevoegen</p>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Lead status filter (optioneel, leeg = alle)"
                          value={leadStatus}
                          onChange={(e) => setLeadStatus(e.target.value)}
                        />
                        <Button size="sm" disabled={addingTargets} onClick={() => void addLeadTargets(c.id)}>
                          {addingTargets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Toevoegen"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                        Locaties toevoegen (harbor outreach)
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2 max-h-40 overflow-y-auto">
                        {locations.map((loc) => (
                          <label
                            key={loc.id}
                            className={cn(
                              "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer",
                              selectedLocationIds.includes(loc.id)
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedLocationIds.includes(loc.id)}
                              onChange={(e) =>
                                setSelectedLocationIds((prev) =>
                                  e.target.checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id),
                                )
                              }
                            />
                            {loc.name}
                          </label>
                        ))}
                      </div>
                      <Button size="sm" disabled={addingTargets} onClick={() => void addLocationTargets(c.id)}>
                        {addingTargets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Locaties toevoegen"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
