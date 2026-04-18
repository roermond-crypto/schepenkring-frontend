"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { toast, Toaster } from "react-hot-toast";
import { Check, Edit, Loader2, Plus, Search, Trash2, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  AiKnowledgeArticle,
  getKnowledgeArticles,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  deleteKnowledgeArticle,
  seedStarterBrandModelKnowledgeArticles,
  translateKnowledgeArticleDraft,
} from "@/lib/api/knowledge-articles";

const SUPPORTED_LANGUAGES = ["nl", "en", "de"] as const;
type Language = (typeof SUPPORTED_LANGUAGES)[number];

export default function KnowledgeArticlesPage() {
  const locale = useLocale();
  const defaultLanguage = SUPPORTED_LANGUAGES.includes(locale as Language) ? (locale as Language) : "nl";
  const [articles, setArticles] = useState<AiKnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState<string>(defaultLanguage);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AiKnowledgeArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [translatingLanguage, setTranslatingLanguage] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [matchType, setMatchType] = useState<"brand" | "model" | "boat_type" | "general">("brand");
  const [matchValue, setMatchValue] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [tagsInput, setTagsInput] = useState("");

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeArticles({
        search,
        match_type: matchTypeFilter !== "all" ? matchTypeFilter : undefined,
        language: languageFilter !== "all" ? languageFilter : undefined,
      });
      setArticles(res.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load knowledge articles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void loadArticles(), 400);
    return () => clearTimeout(timer);
  }, [search, matchTypeFilter, languageFilter]);

  const parseTagsInput = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);

  const openCreateDialog = () => {
    setEditingArticle(null);
    setTitle("");
    setContent("");
    setMatchType("brand");
    setMatchValue("");
    setLanguage(defaultLanguage);
    setStatus("active");
    setTagsInput("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (article: AiKnowledgeArticle) => {
    setEditingArticle(article);
    setTitle(article.title);
    setContent(article.content);
    setMatchType(article.match_type);
    setMatchValue(article.match_value || "");
    setLanguage((SUPPORTED_LANGUAGES.includes(article.language as Language) ? article.language : "en") as Language);
    setStatus(article.status);
    setTagsInput(article.tags?.join(", ") || "");
    setIsDialogOpen(true);
  };

  const handleLanguageChange = async (nextLanguage: string) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage as Language)) return;
    if (nextLanguage === language) return;

    const hasDraftContent = Boolean(title.trim() || content.trim() || tagsInput.trim());
    if (!hasDraftContent) {
      setLanguage(nextLanguage as Language);
      return;
    }

    setTranslatingLanguage(true);
    try {
      const translated = await translateKnowledgeArticleDraft({
        source_language: language,
        target_language: nextLanguage,
        title,
        content,
        tags: parseTagsInput(tagsInput),
      });

      setTitle(translated.title);
      setContent(translated.content);
      setTagsInput(translated.tags.join(", "));
      setLanguage(nextLanguage as Language);
      toast.success("Draft translated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to translate draft");
    } finally {
      setTranslatingLanguage(false);
    }
  };

  const saveArticle = async () => {
    if (!title || !content || !matchType) {
      toast.error("Please fill in title and content");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        content,
        match_type: matchType,
        match_value: matchValue || null,
        language,
        status,
        tags: tagsInput ? parseTagsInput(tagsInput) : null,
      };

      if (editingArticle) {
        await updateKnowledgeArticle(editingArticle.id, payload);
        toast.success("Knowledge article updated");
      } else {
        await createKnowledgeArticle(payload);
        toast.success("Knowledge article created");
      }
      setIsDialogOpen(false);
      await loadArticles();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save knowledge article");
    } finally {
      setSaving(false);
    }
  };

  const handleSeedStarter = async () => {
    setSeeding(true);
    try {
      const res = await seedStarterBrandModelKnowledgeArticles();
      toast.success(`${res.message} (${res.embedded_attempts})`);
      await loadArticles();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to seed starter articles");
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteKnowledgeArticle(deleteId);
      toast.success("Knowledge article deleted");
      await loadArticles();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete knowledge article");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Knowledge Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage rich brand and model articles that the RAG pipeline uses to generate listing descriptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSeedStarter} disabled={seeding}>
            {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Load starter brands & models
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Article
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search titles, match values, or content..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-gray-50 border-gray-200" />
        </div>
        <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="brand">Brand</SelectItem>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="boat_type">Boat Type</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Languages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectItem value="nl">Dutch</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="de">German</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md shadow-sm bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="text-left p-4 font-medium">Title</th>
              <th className="text-left p-4 font-medium">Match Context</th>
              <th className="text-left p-4 font-medium">Language & Status</th>
              <th className="text-left p-4 font-medium">Pinecone Sync</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="h-48 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Loading Knowledge Articles...</td></tr>
            ) : articles.length === 0 ? (
              <tr><td colSpan={5} className="h-48 text-center text-muted-foreground">No articles found.</td></tr>
            ) : articles.map((article) => (
              <tr key={article.id} className="border-t">
                <td className="p-4 align-top">
                  <div className="font-medium text-gray-900">{article.title}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-sm">{article.content}</div>
                </td>
                <td className="p-4 align-top">
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit">{article.match_type}</Badge>
                    {article.match_value && <span className="text-sm font-medium">{article.match_value}</span>}
                  </div>
                </td>
                <td className="p-4 align-top">
                  <div className="flex items-center gap-2">
                    <Badge variant={article.status === "active" ? "default" : "secondary"}>{article.status}</Badge>
                    <span className="text-sm font-medium uppercase text-gray-500">{article.language}</span>
                  </div>
                </td>
                <td className="p-4 align-top">
                  {article.pinecone_id ? (
                    <div className="flex items-center text-green-600 text-sm font-medium gap-1"><CheckCircle2 className="h-4 w-4" /> Embedded</div>
                  ) : (
                    <div className="flex items-center text-amber-600 text-sm font-medium gap-1"><AlertCircle className="h-4 w-4" /> Pending</div>
                  )}
                </td>
                <td className="p-4 align-top">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(article)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(article.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit Knowledge Article" : "Create Knowledge Article"}</DialogTitle>
            <DialogDescription>Manage article content, match context, language, and status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select value={matchType} onValueChange={(v) => setMatchType(v as any)}>
                <SelectTrigger><SelectValue placeholder="Match Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="model">Model</SelectItem>
                  <SelectItem value="boat_type">Boat Type</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Match Value (e.g. Princess)" value={matchValue} onChange={(e) => setMatchValue(e.target.value)} />
              <Select value={language} onValueChange={(v) => void handleLanguageChange(v)}>
                <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">Dutch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Tags, comma separated" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
            <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-64" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveArticle} disabled={saving || translatingLanguage}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Knowledge Article"
        description="Are you sure you want to delete this knowledge article? This cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
