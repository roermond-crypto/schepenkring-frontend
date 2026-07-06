"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  Minus,
  Save,
  Eye,
  History,
  Settings2,
  Globe2,
  MapPin,
  Star,
  Loader2,
  Tag,
  ChevronDown,
  ChevronRight,
  FileText,
  PenLine,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = "nl" | "en" | "de" | "fr";
const LANGS: Lang[] = ["nl", "en", "de", "fr"];
const LANG_LABELS: Record<Lang, string> = { nl: "NL", en: "EN", de: "DE", fr: "FR" };

interface ContractTemplate {
  id: number;
  name: string;
  type: string;
  location_id: number | null;
  location?: { id: number; name: string } | null;
  language: Lang;
  is_global: boolean;
  is_default: boolean;
  is_active: boolean;
  is_archived: boolean;
  description: string | null;
  content_html: string;
  content_json: Record<string, unknown> | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: number;
  version: number;
  change_note: string | null;
  created_by_id: number | null;
  created_at: string;
  content_html?: string;
}

interface TemplateType {
  value: string;
  label: string;
}

interface TagInfo {
  key: string;
  label: string;
  category: string;
  sample: string;
}

interface LocationOption {
  id: number;
  name: string;
}

// ─── Tag categories ───────────────────────────────────────────────────────────

function groupTagsByCategory(tags: TagInfo[]): Record<string, TagInfo[]> {
  const groups: Record<string, TagInfo[]> = {};
  tags.forEach((t) => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });
  return groups;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TB({
  onClick,
  active = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-sm transition",
        active
          ? "bg-[#003566] text-white"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

// ─── Word-like toolbar ────────────────────────────────────────────────────────

function WordToolbar({
  editor,
  onInsertTag,
  onInsertSignatureBlock,
  onInsertPageBreak,
}: {
  editor: ReturnType<typeof useEditor>;
  onInsertTag: (tag: string) => void;
  onInsertSignatureBlock: () => void;
  onInsertPageBreak: () => void;
}) {
  const t = useTranslations("ContractTemplateEditor.toolbar");

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      {/* Undo/Redo */}
      <TB onClick={() => editor.chain().focus().undo().run()} title={t("undo")}><Undo size={14} /></TB>
      <TB onClick={() => editor.chain().focus().redo().run()} title={t("redo")}><Redo size={14} /></TB>
      <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Text style */}
      <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title={t("bold")}><Bold size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title={t("italic")}><Italic size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title={t("underline")}><UnderlineIcon size={14} /></TB>
      <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Headings */}
      {([1, 2, 3] as const).map((level) => (
        <TB
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          active={editor.isActive("heading", { level })}
          title={t("heading", { level })}
        >
          <span className="text-[10px] font-black">H{level}</span>
        </TB>
      ))}
      <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Lists */}
      <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title={t("bulletList")}><List size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title={t("orderedList")}><ListOrdered size={14} /></TB>
      <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Page break */}
      <TB onClick={onInsertPageBreak} title={t("pageBreak")}><Minus size={14} /></TB>

      {/* Signature block */}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onInsertSignatureBlock(); }}
        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition"
        title={t("insertSignature")}
      >
        <PenLine size={13} />
        <span className="hidden sm:inline">{t("signatureLabel")}</span>
      </button>

      {/* Clear formatting */}
      <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <TB onClick={() => editor.chain().focus().unsetAllMarks().run()} title={t("clearFormat")}>
        <span className="text-[10px] font-black text-slate-500">T✕</span>
      </TB>
    </div>
  );
}

// ─── Tag sidebar panel ────────────────────────────────────────────────────────

function TagSidebarPanel({
  tags,
  onInsert,
  missingKeys,
}: {
  tags: TagInfo[];
  onInsert: (tag: string) => void;
  missingKeys: string[];
}) {
  const t = useTranslations("ContractTemplateEditor.tags");
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const grouped = groupTagsByCategory(tags);

  const filtered = search
    ? tags.filter((t) => t.key.includes(search.toLowerCase()) || t.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{t("sectionTitle")}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-[#003566]"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {missingKeys.length > 0 && (
          <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300 mb-1.5">
              <AlertTriangle size={10} className="inline mr-1" />
              {t("missingTitle", { count: missingKeys.length })}
            </p>
            <div className="flex flex-wrap gap-1">
              {missingKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => onInsert(`{{${k}}}`)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 hover:bg-orange-200 transition"
                >
                  {`{{${k}}}`}
                </button>
              ))}
            </div>
          </div>
        )}
        {filtered ? (
          <div className="space-y-1">
            {filtered.map((tg) => (
              <TagButton key={tg.key} tag={tg} onInsert={onInsert} isMissing={missingKeys.includes(tg.key)} />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catTags]) => (
            <div key={cat} className="mb-3">
              <button
                onClick={() => setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                className="flex w-full items-center justify-between py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {cat}
                {openCategories[cat] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
              {(!Object.prototype.hasOwnProperty.call(openCategories, cat) || openCategories[cat] !== false) && (
                <div className="space-y-0.5">
                  {catTags.map((tg) => (
                    <TagButton key={tg.key} tag={tg} onInsert={onInsert} isMissing={missingKeys.includes(tg.key)} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TagButton({ tag, onInsert, isMissing }: { tag: TagInfo; onInsert: (t: string) => void; isMissing: boolean }) {
  return (
    <button
      onClick={() => onInsert(`{{${tag.key}}}`)}
      className={cn(
        "group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition",
        isMissing
          ? "border border-orange-200 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20 hover:bg-orange-100"
          : "hover:bg-slate-50 dark:hover:bg-slate-800",
      )}
    >
      <Tag size={10} className={cn("mt-0.5 flex-shrink-0", isMissing ? "text-orange-500" : "text-slate-300 group-hover:text-slate-500")} />
      <div className="min-w-0">
        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate">{`{{${tag.key}}}`}</p>
        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{tag.label}</p>
      </div>
    </button>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({
  templateId,
  contentHtml,
  yachtId,
}: {
  templateId: number;
  contentHtml: string;
  yachtId?: number;
}) {
  const t = useTranslations("ContractTemplateEditor.preview");
  const [html, setHtml] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [useSample, setUseSample] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post<{ html: string; missing_tags: string[] }>(
        `/admin/contract-templates/${templateId}/preview`,
        { use_sample_tags: useSample, content_html: contentHtml, yacht_id: yachtId ?? null },
      );
      setHtml(res.data.html);
      setMissing(res.data.missing_tags ?? []);
    } catch {
      setHtml(`<p style='color:red;padding:20px;'>${t("loadError")}</p>`);
    } finally {
      setLoading(false);
    }
  }, [templateId, contentHtml, useSample, yachtId, t]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void loadPreview(); }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadPreview]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("sectionTitle")}</p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={useSample} onChange={(e) => setUseSample(e.target.checked)} className="rounded" />
          <span className="text-xs text-slate-500 dark:text-slate-400">{t("sampleValues")}</span>
        </label>
      </div>
      {missing.length > 0 && (
        <div className="mx-3 mt-2 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20 px-3 py-2 text-[10px] text-orange-700 dark:text-orange-300">
          <AlertTriangle size={10} className="inline mr-1" />
          {t("missingTagsWarning", { count: missing.length, tags: missing.map((m) => `{{${m}}}`).join(", ") })}
        </div>
      )}
      <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-800 p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : html ? (
          <div className="mx-auto max-w-[600px] bg-white shadow rounded text-sm leading-relaxed">
            <div
              className="p-8 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Versions panel ───────────────────────────────────────────────────────────

function VersionsPanel({
  templateId,
  currentVersion,
  onRestore,
}: {
  templateId: number;
  currentVersion: number;
  onRestore: () => void;
}) {
  const t = useTranslations("ContractTemplateEditor.versions");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get(`/admin/contract-templates/${templateId}/versions`);
        const versionsArr = (res.data as { versions?: TemplateVersion[] })?.versions ?? res.data;
        setVersions(Array.isArray(versionsArr) ? versionsArr : []);
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [templateId, t]);

  const handleRestore = async (v: TemplateVersion) => {
    if (!confirm(t("confirmRestore", { version: v.version }))) return;
    setRestoring(v.version);
    try {
      await api.post(`/admin/contract-templates/${templateId}/restore-version`, { version: v.version });
      toast.success(t("restoreSuccess", { version: v.version }));
      onRestore();
    } catch {
      toast.error(t("restoreFailed"));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("sectionTitle")}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
        ) : versions.map((v) => (
          <div key={v.id} className={cn("rounded-xl border p-3", v.version === currentVersion ? "border-[#003566]/40 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900")}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">v{v.version}</span>
                  {v.version === currentVersion && <span className="rounded-full bg-[#003566] px-1.5 py-0.5 text-[9px] font-black text-white">{t("currentBadge")}</span>}
                </div>
                <p className="text-[10px] text-slate-400">{new Date(v.created_at).toLocaleString()}</p>
                {v.change_note && <p className="text-[10px] text-slate-500 mt-0.5">{v.change_note}</p>}
              </div>
              <div className="flex items-center gap-1">
                {v.content_html && (
                  <button onClick={() => setExpanded(expanded === v.id ? null : v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Eye size={12} />
                  </button>
                )}
                {v.version !== currentVersion && (
                  <button
                    onClick={() => void handleRestore(v)}
                    disabled={restoring === v.version}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {restoring === v.version ? <Loader2 size={10} className="animate-spin" /> : t("restoreButton")}
                  </button>
                )}
              </div>
            </div>
            {expanded === v.id && v.content_html && (
              <div className="mt-2 rounded-lg border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-950 p-2">
                <div className="prose prose-xs max-w-none text-[11px] max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: v.content_html }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function ContractTemplateEditorPage() {
  const locale = useLocale();
  const t = useTranslations("ContractTemplateEditor");
  const tTop = useTranslations("ContractTemplateEditor.topBar");
  const tMeta = useTranslations("ContractTemplateEditor.meta");
  const tModal = useTranslations("ContractTemplateEditor.saveModal");

  const params = useParams<{ role?: string; id?: string }>();
  const role = params?.role ?? "admin";
  const templateId = Number(params?.id);
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState("purchase_contract");
  const [language, setLanguage] = useState<Lang>("nl");
  const [isGlobal, setIsGlobal] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  const [types, setTypes] = useState<TemplateType[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [missingTags, setMissingTags] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [rightPanel, setRightPanel] = useState<"tags" | "preview" | "versions" | "meta">("tags");
  const [changeNote, setChangeNote] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingWithNote, setSavingWithNote] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: [
          "outline-none min-h-[900px] px-[8%] py-[9%] text-[14px] leading-[1.8] text-slate-800",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-slate-900",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-slate-900",
          "[&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-slate-800",
          "[&_p]:my-2.5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline",
          "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
          "[&_hr]:my-8 [&_hr]:border-slate-300",
          "[&_.missing-tag]:bg-red-100 [&_.missing-tag]:text-red-700 [&_.missing-tag]:rounded [&_.missing-tag]:px-0.5",
        ].join(" "),
      },
    },
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  useEffect(() => {
    if (!templateId) return;
    void loadTemplate();
    void loadMeta();
  }, [templateId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/contract-templates/${templateId}`);
      const tpl = (res.data as { template?: ContractTemplate } & ContractTemplate)?.template ?? res.data as ContractTemplate;
      setTemplate(tpl);
      setName(tpl.name ?? "");
      setDescription(tpl.description ?? "");
      setTemplateType(tpl.type ?? "purchase_contract");
      setLanguage(tpl.language ?? "nl");
      setIsGlobal(tpl.is_global ?? false);
      setIsDefault(tpl.is_default ?? false);
      if (editor) {
        editor.commands.setContent(tpl.content_html ?? "");
      }
      setIsDirty(false);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editor && template?.content_html) {
      editor.commands.setContent(template.content_html);
    }
  }, [editor, template?.id]);

  const loadMeta = async () => {
    try {
      const typesRes = await api.get("/admin/contract-templates/types");
      const typesArr = (typesRes.data as { types?: TemplateType[] })?.types;
      setTypes(Array.isArray(typesArr) ? typesArr : []);
    } catch { /* non-fatal */ }

    try {
      const tagsRes = await api.get("/admin/contract-templates/tags");
      const tagsArr = (tagsRes.data as { tags?: TagInfo[] })?.tags;
      setTags(Array.isArray(tagsArr) ? tagsArr : []);
    } catch { /* non-fatal */ }

    try {
      const locRes = await api.get<{ data: LocationOption[] }>("/admin/locations?per_page=200");
      setLocations(locRes.data?.data ?? []);
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (!editor || tags.length === 0) return;
    const html = editor.getHTML();
    const usedMatches = html.matchAll(/\{\{([a-z_]+)\}\}/g);
    const allTagKeys = new Set(tags.map((tg) => tg.key));
    const missing: string[] = [];
    for (const m of usedMatches) {
      const key = m[1];
      if (!allTagKeys.has(key)) missing.push(key);
    }
    setMissingTags(missing);
  }, [editor?.state, tags]);

  const insertTag = (tag: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(tag).run();
    setIsDirty(true);
  };

  const insertSignatureBlock = () => {
    if (!editor) return;
    editor.chain().focus().insertContent(
      `<p>&nbsp;</p><p>&nbsp;</p><p><strong>{{seller_signature_label}}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>{{buyer_signature_label}}</strong></p><p>_________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _________________________</p><p>{{seller_name}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {{buyer_name}}</p><p>Datum: ________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Datum: ________________</p>`
    ).run();
    setIsDirty(true);
  };

  const insertPageBreak = () => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
    setIsDirty(true);
  };

  const handleSave = async (note?: string) => {
    if (!editor) return;
    setSaving(true);
    try {
      await api.patch(`/admin/contract-templates/${templateId}`, {
        name,
        description: description || null,
        type: templateType,
        language,
        is_global: isGlobal,
        is_default: isDefault,
        content_html: editor.getHTML(),
        change_note: note || null,
      });
      toast.success(tModal("saveSuccess"));
      setIsDirty(false);
      setChangeNote("");
      setShowSaveModal(false);
      await loadTemplate();
    } catch {
      toast.error(tModal("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWithNote = async () => {
    setSavingWithNote(true);
    await handleSave(changeNote);
    setSavingWithNote(false);
    setShowSaveModal(false);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(`/admin/contract-templates/${templateId}/pdf`, {
        params: { use_sample_tags: true },
        responseType: "blob",
      });
      const contentType = (res.headers as Record<string, string>)["content-type"] ?? "";
      const isPdf = contentType.includes("pdf");
      const ext = isPdf ? "pdf" : "html";
      const slug = (template?.name ?? `contract-template-${templateId}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: contentType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("pdfFailed"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500">{t("notFound")}</p>
      </div>
    );
  }

  const typeLabel = types.find((tp) => tp.value === templateType)?.label ?? templateType;

  const panelTitles: Record<"tags" | "preview" | "versions" | "meta", string> = {
    tags: tTop("panelTags"),
    preview: tTop("panelPreview"),
    versions: tTop("panelVersions"),
    meta: tTop("panelSettings"),
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-2.5">
        <button
          onClick={() => router.push(`${root}/contract-templates`)}
          className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
            className="w-full bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            placeholder={tTop("namePlaceholder")}
          />
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{typeLabel}</span>
            {template.is_global ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold"><Globe2 size={9} /> {tTop("globalBadge")}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold"><MapPin size={9} /> {template.location?.name ?? tTop("locationFallback")}</span>
            )}
            {template.is_default && <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold"><Star size={9} /> {tTop("defaultBadge")}</span>}
            <span className="text-[10px] text-slate-400">v{template.current_version}</span>
            {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" title={tTop("unsavedIndicator")} />}
            {missingTags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
                <AlertTriangle size={9} /> {tTop("missingTagsWarning", { count: missingTags.length })}
              </span>
            )}
          </div>
        </div>

        {/* Right panel toggles */}
        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
          {(["tags", "preview", "versions", "meta"] as const).map((panel) => {
            const Icon = panel === "tags" ? Tag : panel === "preview" ? Eye : panel === "versions" ? History : Settings2;
            return (
              <button
                key={panel}
                onClick={() => setRightPanel(panel)}
                className={cn("rounded-lg p-1.5 transition", rightPanel === panel ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}
                title={panelTitles[panel]}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={downloadingPdf}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          title={tTop("pdfButtonTitle")}
        >
          {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          <span className="hidden sm:inline">{tTop("pdfButtonLabel")}</span>
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 rounded-xl bg-[#003566] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {tTop("saveButton")}
        </button>
      </div>

      {/* Toolbar */}
      {editor && (
        <WordToolbar
          editor={editor}
          onInsertTag={insertTag}
          onInsertSignatureBlock={insertSignatureBlock}
          onInsertPageBreak={insertPageBreak}
        />
      )}

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center: A4 paper editor */}
        <div className="flex-1 overflow-y-auto bg-slate-200 dark:bg-slate-800 px-8 py-8">
          <div className="mx-auto mb-3 max-w-[794px]">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {tTop("a4Hint", { type: typeLabel, lang: LANG_LABELS[language] })}
            </p>
          </div>

          <div className="mx-auto max-w-[794px] min-h-[1123px] bg-white shadow-2xl dark:shadow-slate-900">
            {editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 flex flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {rightPanel === "tags" ? (
            <TagSidebarPanel tags={tags} onInsert={insertTag} missingKeys={missingTags} />
          ) : rightPanel === "preview" ? (
            <PreviewPanel templateId={templateId} contentHtml={editor?.getHTML() ?? ""} />
          ) : rightPanel === "versions" ? (
            <VersionsPanel templateId={templateId} currentVersion={template.current_version} onRestore={() => { void loadTemplate(); }} />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tMeta("sectionTitle")}</p>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{tMeta("typeLabel")}</label>
                <select value={templateType} onChange={(e) => { setTemplateType(e.target.value); setIsDirty(true); }} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {types.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{tMeta("languageLabel")}</label>
                <select value={language} onChange={(e) => { setLanguage(e.target.value as Lang); setIsDirty(true); }} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{tMeta("descriptionLabel")}</label>
                <textarea rows={2} value={description} onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 resize-none outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={isGlobal} onChange={(e) => { setIsGlobal(e.target.checked); setIsDirty(true); }} className="rounded" />
                  {tMeta("globalMaster")}
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={isDefault} onChange={(e) => { setIsDefault(e.target.checked); setIsDirty(true); }} className="rounded" />
                  {tMeta("defaultForLocation")}
                </label>
              </div>
              {template.location && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{tMeta("locationSection")}</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{template.location.name}</p>
                  </div>
                </div>
              )}
              {!isGlobal && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{tMeta("assignSection")}</p>
                  <AssignToLocationPanel templateId={templateId} locations={locations} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{tModal("title")}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{tModal("subtitle")}</p>
            <textarea
              rows={2}
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder={tModal("placeholder")}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-[#003566] resize-none mb-4"
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <Button variant="outline" onClick={() => setShowSaveModal(false)} className="rounded-xl">{tModal("cancel")}</Button>
              <Button onClick={() => void handleSave()} disabled={saving} variant="outline" className="rounded-xl text-slate-500">
                {tModal("saveWithoutNote")}
              </Button>
              <Button onClick={() => void handleSaveWithNote()} disabled={savingWithNote} className="rounded-xl bg-[#003566] text-white hover:bg-blue-900">
                {savingWithNote ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                {tModal("save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assign to location mini-panel ───────────────────────────────────────────

function AssignToLocationPanel({
  templateId,
  locations,
}: {
  templateId: number;
  locations: LocationOption[];
}) {
  const t = useTranslations("ContractTemplateEditor.meta");
  const [locationId, setLocationId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!locationId) return;
    setAssigning(true);
    try {
      await api.post(`/admin/contract-templates/${templateId}/assign-to-location`, { location_id: Number(locationId) });
      toast.success(t("assignSuccess"));
      setLocationId("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t("assignFailed"));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className="h-8 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        <option value="">{t("chooseLocation")}</option>
        {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
      </select>
      <Button
        onClick={() => void handleAssign()}
        disabled={!locationId || assigning}
        size="sm"
        className="w-full h-8 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs disabled:opacity-50"
      >
        {assigning ? <Loader2 size={11} className="animate-spin mr-1" /> : <Copy size={11} className="mr-1" />}
        {t("duplicateForLocation")}
      </Button>
    </div>
  );
}
