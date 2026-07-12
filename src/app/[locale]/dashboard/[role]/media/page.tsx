"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Trash, Upload, X } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LOCALES = ["nl", "en", "de", "fr"] as const;
type Locale = (typeof LOCALES)[number];
type LocaleValue = Partial<Record<Locale, string>>;

type MediaItem = {
  id: number;
  url: string;
  thumb_url: string;
  original_name: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  alt_text: LocaleValue | null;
  caption: LocaleValue | null;
  seo_title: LocaleValue | null;
  status: string;
  ai_alt_text_is_draft: boolean;
  ai_seo_title_is_draft: boolean;
  usages_count: number;
};

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "unused", label: "Ongebruikt" },
  { key: "needs_alt_text", label: "Alt-tekst nodig" },
  { key: "needs_seo", label: "SEO nodig" },
  { key: "large_file_size", label: "Groot bestand" },
  { key: "recently_uploaded", label: "Recent geüpload" },
] as const;

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: MediaItem[] }>("/admin/media", {
        params: { filter, search: search || undefined },
      });
      setItems(res.data.data);
    } catch {
      toast.error("Kon media niet laden");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files[]", file));
      await api.post("/admin/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Geüpload");
      await load();
    } catch {
      toast.error("Uploaden mislukt");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteItem = async (item: MediaItem) => {
    try {
      await api.delete(`/admin/media/${item.id}`);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
      toast.success("Verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Media bibliotheek</h1>
          <p className="text-sm text-slate-500">Beheer afbeeldingen voor de publieke website.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Uploaden
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border",
              filter === f.key ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200",
            )}
          >
            {f.label}
          </button>
        ))}
        <Input
          placeholder="Zoeken op bestandsnaam..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs ml-auto"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 px-1">Geen media gevonden.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden text-left hover:border-blue-400 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumb_url} alt={item.alt_text?.nl ?? ""} className="w-full aspect-square object-cover" />
              <div className="p-2">
                <p className="text-[11px] font-medium text-slate-700 truncate">{item.original_name ?? "—"}</p>
                <p className="text-[10px] text-slate-400">{formatSize(item.file_size)} · {item.usages_count}x gebruikt</p>
                {!item.alt_text?.nl && (
                  <span className="inline-block mt-1 text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Geen alt-tekst
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <MediaDetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={() => void deleteItem(selected)}
          onUpdated={(updated) => {
            setSelected(updated);
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
        />
      )}
    </div>
  );
}

function MediaDetailPanel({
  item,
  onClose,
  onDelete,
  onUpdated,
}: {
  item: MediaItem;
  onClose: () => void;
  onDelete: () => void;
  onUpdated: (item: MediaItem) => void;
}) {
  const [altText, setAltText] = useState<LocaleValue>(item.alt_text ?? {});
  const [caption, setCaption] = useState<LocaleValue>(item.caption ?? {});
  const [seoTitle, setSeoTitle] = useState<LocaleValue>(item.seo_title ?? {});
  const [saving, setSaving] = useState(false);
  const [generatingAlt, setGeneratingAlt] = useState(false);
  const [generatingSeo, setGeneratingSeo] = useState(false);

  useEffect(() => {
    setAltText(item.alt_text ?? {});
    setCaption(item.caption ?? {});
    setSeoTitle(item.seo_title ?? {});
  }, [item]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ data: MediaItem }>(`/admin/media/${item.id}`, {
        alt_text: altText,
        caption,
        seo_title: seoTitle,
      });
      toast.success("Opgeslagen");
      onUpdated(res.data.data);
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const generateAltText = async () => {
    setGeneratingAlt(true);
    try {
      const res = await api.post<{ data: MediaItem }>(`/admin/media/${item.id}/ai-alt-text`);
      setAltText(res.data.data.alt_text ?? {});
      onUpdated(res.data.data);
      toast.success("AI-concept gegenereerd — controleer voor opslaan");
    } catch {
      toast.error("AI-generatie mislukt");
    } finally {
      setGeneratingAlt(false);
    }
  };

  const generateSeoTitle = async () => {
    setGeneratingSeo(true);
    try {
      const res = await api.post<{ data: MediaItem }>(`/admin/media/${item.id}/ai-seo-title`);
      setSeoTitle(res.data.data.seo_title ?? {});
      onUpdated(res.data.data);
      toast.success("AI-concept gegenereerd — controleer voor opslaan");
    } catch {
      toast.error("AI-generatie mislukt");
    } finally {
      setGeneratingSeo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800 truncate">{item.original_name}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt="" className="w-full max-h-64 object-contain rounded-lg bg-slate-50" />

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{item.width}×{item.height}px</span>
            <span>{formatSize(item.file_size)}</span>
            <span>{item.usages_count}x gebruikt</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Alt-tekst {item.ai_alt_text_is_draft && <span className="text-amber-600">(AI-concept)</span>}
              </p>
              <Button size="sm" variant="outline" onClick={() => void generateAltText()} disabled={generatingAlt}>
                {generatingAlt ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                AI genereren
              </Button>
            </div>
            {LOCALES.map((loc) => (
              <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">{loc}</span>
                <Input value={altText[loc] ?? ""} onChange={(e) => setAltText((prev) => ({ ...prev, [loc]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Bijschrift</p>
            {LOCALES.map((loc) => (
              <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">{loc}</span>
                <Input value={caption[loc] ?? ""} onChange={(e) => setCaption((prev) => ({ ...prev, [loc]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">
                SEO titel {item.ai_seo_title_is_draft && <span className="text-amber-600">(AI-concept)</span>}
              </p>
              <Button size="sm" variant="outline" onClick={() => void generateSeoTitle()} disabled={generatingSeo}>
                {generatingSeo ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                AI genereren
              </Button>
            </div>
            {LOCALES.map((loc) => (
              <div key={loc} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">{loc}</span>
                <Input value={seoTitle[loc] ?? ""} onChange={(e) => setSeoTitle((prev) => ({ ...prev, [loc]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <button onClick={onDelete} className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5">
            <Trash className="h-3.5 w-3.5" /> Verwijderen
          </button>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            Opslaan
          </Button>
        </div>
      </div>
    </div>
  );
}
