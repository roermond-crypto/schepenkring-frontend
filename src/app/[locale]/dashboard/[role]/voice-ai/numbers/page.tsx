"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Phone } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VoiceNumber = {
  id: number;
  harbor_id: number;
  provider: string;
  from_number: string;
  status: string;
  location?: { id: number; name: string } | null;
};

type LocationOption = { id: number; name: string };

export default function VoiceNumbersPage() {
  const [numbers, setNumbers] = useState<VoiceNumber[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ harbor_id: "", from_number: "", provider: "retell" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [numRes, locRes] = await Promise.all([
        api.get<{ data: VoiceNumber[] }>("/admin/voice-ai/numbers"),
        api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200"),
      ]);
      setNumbers(numRes.data.data);
      setLocations(locRes.data.data);
    } catch {
      toast.error("Kon nummers niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createNumber = async () => {
    if (!form.harbor_id || !form.from_number) {
      toast.error("Locatie en telefoonnummer zijn verplicht");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/voice-ai/numbers", {
        harbor_id: Number(form.harbor_id),
        from_number: form.from_number,
        provider: form.provider,
        status: "active",
      });
      toast.success("Nummer toegevoegd");
      setForm({ harbor_id: "", from_number: "", provider: "retell" });
      setShowForm(false);
      await load();
    } catch {
      toast.error("Toevoegen mislukt");
    } finally {
      setSaving(false);
    }
  };

  const removeNumber = async (id: number) => {
    if (!confirm("Dit nummer verwijderen?")) return;
    try {
      await api.delete(`/admin/voice-ai/numbers/${id}`);
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
          <h1 className="text-2xl font-bold text-slate-800">Telefoonnummers</h1>
          <p className="text-sm text-slate-500">Per-locatie nummers gekoppeld aan een voice provider.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-2" /> Nummer toevoegen
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.harbor_id}
              onChange={(e) => setForm((f) => ({ ...f, harbor_id: e.target.value }))}
            >
              <option value="">Kies locatie...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="+31612345678"
              value={form.from_number}
              onChange={(e) => setForm((f) => ({ ...f, from_number: e.target.value }))}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
            >
              <option value="retell">Retell</option>
              <option value="telnyx">Telnyx (legacy)</option>
            </select>
          </div>
          <Button size="sm" onClick={() => void createNumber()} disabled={saving}>
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
        ) : numbers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen nummers geconfigureerd.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {numbers.map((n) => (
              <div key={n.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{n.from_number}</p>
                    <p className="text-xs text-slate-400">
                      {n.location?.name ?? `Locatie #${n.harbor_id}`} · {n.provider} · {n.status}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void removeNumber(n.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
