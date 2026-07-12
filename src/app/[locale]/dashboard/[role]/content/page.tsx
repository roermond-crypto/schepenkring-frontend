"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CmsPageRow = {
  id: number;
  slug: string;
  name: string;
  status: "draft" | "review" | "published" | "scheduled" | "archived";
  sections_count: number;
  updated_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  review: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-blue-50 text-blue-700",
  archived: "bg-red-50 text-red-600",
};

export default function CmsContentPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const role = params.role as string;

  const [pages, setPages] = useState<CmsPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CmsPageRow[] }>("/admin/cms/pages", {
        params: search ? { search } : undefined,
      });
      setPages(res.data.data);
    } catch {
      toast.error("Kon pagina's niet laden");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPage = async () => {
    if (!newSlug.trim() || !newName.trim()) {
      toast.error("Slug en naam zijn verplicht");
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ data: CmsPageRow }>("/admin/cms/pages", {
        slug: newSlug.trim(),
        name: newName.trim(),
      });
      toast.success("Pagina aangemaakt");
      setShowCreate(false);
      setNewSlug("");
      setNewName("");
      router.push(`/${locale}/dashboard/${role}/content/${res.data.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Aanmaken mislukt");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Content</h1>
          <p className="text-sm text-slate-500">
            Beheer pagina's, secties en content voor de publieke website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Verversen
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" /> Nieuwe pagina
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Slug, bijv. boot-aanmelden"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
            />
            <Input
              placeholder="Interne naam"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => void createPage()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aanmaken
          </Button>
        </div>
      )}

      <Input
        placeholder="Zoeken op naam of slug..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : pages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Nog geen pagina's.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => router.push(`/${locale}/dashboard/${role}/content/${page.id}`)}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{page.name}</p>
                    <p className="text-xs text-slate-400 font-mono">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-slate-400">{page.sections_count} secties</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full",
                      STATUS_STYLE[page.status] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {page.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
