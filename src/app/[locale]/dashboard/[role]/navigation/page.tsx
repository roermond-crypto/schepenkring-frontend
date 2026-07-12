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

type NavItemRow = {
  id: number;
  location: "header" | "footer";
  footer_column: string | null;
  label: LocaleValue;
  url: string;
  sort_order: number;
  is_visible: boolean;
  open_in_new_tab: boolean;
};

type SiteSettings = {
  footer_tagline: LocaleValue | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
};

function emptyLocaleValue(): LocaleValue {
  return { nl: "", en: "", de: "", fr: "" };
}

export default function NavigationBuilderPage() {
  const [items, setItems] = useState<NavItemRow[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    footer_tagline: emptyLocaleValue(),
    contact_email: "",
    contact_phone: "",
    contact_address: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async (location: "header" | "footer") => {
    const res = await api.get<{ data: NavItemRow[]; site_settings: SiteSettings }>("/admin/navigation", {
      params: { location },
    });
    return res;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [headerRes, footerRes] = await Promise.all([load("header"), load("footer")]);
      setItems([...headerRes.data.data, ...footerRes.data.data]);
      setSettings({
        footer_tagline: { ...emptyLocaleValue(), ...(footerRes.data.site_settings.footer_tagline ?? {}) },
        contact_email: footerRes.data.site_settings.contact_email ?? "",
        contact_phone: footerRes.data.site_settings.contact_phone ?? "",
        contact_address: footerRes.data.site_settings.contact_address ?? "",
      });
    } catch {
      toast.error("Kon navigatie niet laden");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const addItem = (location: "header" | "footer", footerColumn?: string) => {
    setItems((prev) => [
      ...prev,
      {
        id: -Date.now(),
        location,
        footer_column: footerColumn ?? null,
        label: emptyLocaleValue(),
        url: "",
        sort_order: prev.filter((i) => i.location === location).length,
        is_visible: true,
        open_in_new_tab: false,
      },
    ]);
  };

  const updateItem = (id: number, patch: Partial<NavItemRow>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const saveItem = async (item: NavItemRow) => {
    try {
      if (item.id < 0) {
        const res = await api.post<{ data: NavItemRow }>("/admin/navigation", item);
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data.data : i)));
      } else {
        await api.put(`/admin/navigation/${item.id}`, item);
      }
      toast.success("Opgeslagen");
    } catch {
      toast.error("Opslaan mislukt");
    }
  };

  const deleteItem = async (item: NavItemRow) => {
    if (item.id > 0) {
      try {
        await api.delete(`/admin/navigation/${item.id}`);
      } catch {
        toast.error("Verwijderen mislukt");
        return;
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const moveItem = (item: NavItemRow, direction: -1 | 1) => {
    const siblings = items
      .filter((i) => i.location === item.location && i.footer_column === item.footer_column)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((i) => i.id === item.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const a = siblings[index];
    const b = siblings[targetIndex];
    updateItem(a.id, { sort_order: b.sort_order });
    updateItem(b.id, { sort_order: a.sort_order });

    void api.put("/admin/navigation/reorder", {
      items: [
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ],
    });
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put("/admin/navigation/site-settings", settings);
      toast.success("Instellingen opgeslagen");
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSavingSettings(false);
    }
  };

  const headerItems = items.filter((i) => i.location === "header").sort((a, b) => a.sort_order - b.sort_order);
  const footerItems = items.filter((i) => i.location === "footer").sort((a, b) => a.sort_order - b.sort_order);
  const footerColumns = Array.from(new Set(footerItems.map((i) => i.footer_column || "general")));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Navigatie</h1>
          <p className="text-sm text-slate-500">Beheer de header- en footerlinks van de publieke website.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Verversen
        </Button>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Header</h2>
          <Button size="sm" variant="outline" onClick={() => addItem("header")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Link toevoegen
          </Button>
        </div>
        {headerItems.map((item, index) => (
          <NavItemRowEditor
            key={item.id}
            item={item}
            onChange={(patch) => updateItem(item.id, patch)}
            onSave={() => void saveItem(item)}
            onDelete={() => void deleteItem(item)}
            onMoveUp={() => moveItem(item, -1)}
            onMoveDown={() => moveItem(item, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < headerItems.length - 1}
          />
        ))}
      </section>

      {/* Footer */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Footer</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => addItem("footer", "company")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Link toevoegen
            </Button>
          </div>
        </div>
        {footerColumns.map((column) => (
          <div key={column} className="space-y-2 pt-2 border-t border-slate-100 first:border-t-0 first:pt-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{column}</p>
            {footerItems
              .filter((i) => (i.footer_column || "general") === column)
              .map((item, index, arr) => (
                <NavItemRowEditor
                  key={item.id}
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onSave={() => void saveItem(item)}
                  onDelete={() => void deleteItem(item)}
                  onMoveUp={() => moveItem(item, -1)}
                  onMoveDown={() => moveItem(item, 1)}
                  canMoveUp={index > 0}
                  canMoveDown={index < arr.length - 1}
                  showColumn
                />
              ))}
          </div>
        ))}
      </section>

      {/* Footer settings */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Footer instellingen</h2>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500">Tagline</p>
          {LOCALES.map((loc) => (
            <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
              <span className="text-[10px] font-bold uppercase text-slate-400">{loc}</span>
              <Input
                value={settings.footer_tagline?.[loc] ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    footer_tagline: { ...prev.footer_tagline, [loc]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="E-mail"
            value={settings.contact_email ?? ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, contact_email: e.target.value }))}
          />
          <Input
            placeholder="Telefoon"
            value={settings.contact_phone ?? ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, contact_phone: e.target.value }))}
          />
          <Input
            placeholder="Adres"
            value={settings.contact_address ?? ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, contact_address: e.target.value }))}
          />
        </div>
        <Button size="sm" onClick={() => void saveSettings()} disabled={savingSettings}>
          {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
          Opslaan
        </Button>
      </section>
    </div>
  );
}

function NavItemRowEditor({
  item,
  onChange,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  showColumn = false,
}: {
  item: NavItemRow;
  onChange: (patch: Partial<NavItemRow>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  showColumn?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-100 p-3 space-y-2", !item.is_visible && "opacity-50")}>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <Input
          placeholder="Label (NL)"
          value={item.label.nl ?? ""}
          onChange={(e) => onChange({ label: { ...item.label, nl: e.target.value } })}
        />
        <Input
          placeholder="Label (EN)"
          value={item.label.en ?? ""}
          onChange={(e) => onChange({ label: { ...item.label, en: e.target.value } })}
        />
        <Input
          placeholder="URL"
          value={item.url}
          onChange={(e) => onChange({ url: e.target.value })}
          className="sm:col-span-2"
        />
        {showColumn && (
          <Input
            placeholder="Kolom"
            value={item.footer_column ?? ""}
            onChange={(e) => onChange({ footer_column: e.target.value })}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={item.is_visible} onChange={(e) => onChange({ is_visible: e.target.checked })} />
            Zichtbaar
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={item.open_in_new_tab}
              onChange={(e) => onChange({ open_in_new_tab: e.target.checked })}
            />
            Nieuw tabblad
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <Button size="sm" variant="outline" onClick={onSave}>
            <Save className="h-3 w-3" />
          </Button>
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600">
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
