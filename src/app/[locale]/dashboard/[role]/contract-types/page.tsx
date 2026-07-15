"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  FileText,
  Plus,
  Pencil,
  Loader2,
  Check,
  X,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface ContractType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const SLUG_COLORS: Record<string, string> = {
  purchase_contract:   "bg-blue-50 border-blue-200 text-blue-800",
  seller_assignment:   "bg-purple-50 border-purple-200 text-purple-800",
  viewing_agreement:   "bg-green-50 border-green-200 text-green-800",
  offer_agreement:     "bg-orange-50 border-orange-200 text-orange-800",
  delivery_document:   "bg-teal-50 border-teal-200 text-teal-800",
  brokerage_agreement: "bg-rose-50 border-rose-200 text-rose-800",
};

interface FormState {
  name: string;
  description: string;
}

const emptyForm = (): FormState => ({ name: "", description: "" });

export default function ContractTypesPage() {
  const locale = useLocale();
  const [types, setTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm());
  const [creating, setCreating] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ContractType[] }>("/admin/contract-types");
      setTypes(res.data?.data ?? []);
    } catch {
      toast.error("Contracttypes laden mislukt.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (type: ContractType) => {
    setEditingId(type.id);
    setEditForm({ name: type.name, description: type.description ?? "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const saveEdit = async (type: ContractType) => {
    if (!editForm.name.trim()) return;
    setSavingId(type.id);
    try {
      await api.patch(`/admin/contract-types/${type.id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
      });
      toast.success("Opgeslagen.");
      setEditingId(null);
      await load();
    } catch {
      toast.error("Opslaan mislukt.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (type: ContractType) => {
    setTogglingId(type.id);
    try {
      await api.patch(`/admin/contract-types/${type.id}`, { is_active: !type.is_active });
      toast.success(type.is_active ? "Type gedeactiveerd." : "Type geactiveerd.");
      await load();
    } catch {
      toast.error("Bijwerken mislukt.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      await api.post("/admin/contract-types", {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
      });
      toast.success("Type aangemaakt.");
      setShowCreate(false);
      setCreateForm(emptyForm());
      await load();
    } catch {
      toast.error("Aanmaken mislukt.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003566] text-white">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Contracttypes</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Beheer de beschikbare contracttypes voor sjablonen
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setShowCreate(true); setCreateForm(emptyForm()); }}
            className="bg-[#003566] text-white hover:bg-blue-900 rounded-xl"
          >
            <Plus size={16} className="mr-2" />
            Nieuw type
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        {/* Create form */}
        {showCreate && (
          <div className="mb-6 rounded-2xl border border-[#003566]/20 bg-white dark:bg-slate-900 dark:border-blue-900/40 p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nieuw contracttype</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Naam *
                </label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="bijv. Koopovereenkomst"
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Beschrijving
                </label>
                <Input
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optionele toelichting..."
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating || !createForm.name.trim()}
                  className="rounded-xl bg-[#003566] text-white hover:bg-blue-900"
                >
                  {creating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
                  Aanmaken
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl"
                >
                  Annuleren
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : types.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <FileText size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Geen contracttypes gevonden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {types.map((type) => (
              <div
                key={type.id}
                className={cn(
                  "rounded-2xl border bg-white dark:bg-slate-900 p-4 transition",
                  type.is_active
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-slate-100 dark:border-slate-800 opacity-60",
                )}
              >
                {editingId === type.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="rounded-xl font-semibold"
                      autoFocus
                    />
                    <Input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Beschrijving..."
                      className="rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveEdit(type)}
                        disabled={savingId === type.id}
                        className="flex items-center gap-1.5 rounded-lg bg-[#003566] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
                      >
                        {savingId === type.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Opslaan
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        <X size={12} /> Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center gap-3">
                    <GripVertical size={14} className="text-slate-300 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{type.name}</p>
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold",
                          SLUG_COLORS[type.slug] ?? "bg-slate-50 border-slate-200 text-slate-600",
                        )}>
                          {type.slug}
                        </span>
                        {!type.is_active && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Inactief
                          </span>
                        )}
                      </div>
                      {type.description && (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{type.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(type)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Bewerken"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => void toggleActive(type)}
                        disabled={togglingId === type.id}
                        className={cn(
                          "rounded-lg p-1.5 transition",
                          type.is_active
                            ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                        )}
                        title={type.is_active ? "Deactiveren" : "Activeren"}
                      >
                        {togglingId === type.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : type.is_active ? (
                          <ToggleRight size={13} />
                        ) : (
                          <ToggleLeft size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-600">
          Slugs worden automatisch gegenereerd op basis van de naam en zijn niet aanpasbaar na aanmaken.
          Inactieve types zijn niet meer beschikbaar bij het aanmaken van nieuwe sjablonen.
        </p>
      </div>
    </div>
  );
}
