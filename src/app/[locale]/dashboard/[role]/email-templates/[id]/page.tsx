"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Settings2,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Moon,
  Sun,
  Send,
  Save,
  History,
  Globe2,
  MapPin,
  Loader2,
  Image as ImageIcon,
  Type,
  AlignLeft,
  Square,
  Minus,
  Space,
  Share2,
  Ship,
  Tag,
  FileText,
  Phone,
  Building2,
  CreditCard,
  Sparkles,
  Search,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = "nl" | "en" | "de" | "fr";
const LANGS: Lang[] = ["nl", "en", "de", "fr"];
const LANG_LABELS: Record<Lang, string> = { nl: "NL", en: "EN", de: "DE", fr: "FR" };

interface LocalizedString {
  nl: string;
  en: string;
  de: string;
  fr: string;
}

type BlockType =
  | "logo" | "header" | "text" | "rich_text" | "button"
  | "image" | "divider" | "spacer" | "footer" | "signature"
  | "social_links" | "boat_card" | "offer_card" | "seller_card"
  | "buyer_card" | "location_card" | "contract_card";

interface Block {
  id: string;
  type: BlockType;
  settings: Record<string, unknown>;
}

interface EmailTemplate {
  id: number;
  type: string;
  name: string;
  description: string | null;
  is_global: boolean;
  location_id: number | null;
  location?: { id: number; name: string } | null;
  language_default: Lang;
  subject: LocalizedString;
  blocks: Block[];
  sender_name_override: string | null;
  sender_email_override: string | null;
  reply_to_override: string | null;
  primary_color_override: string | null;
  is_active: boolean;
  is_archived: boolean;
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
}

interface TemplateType {
  value: string;
  label: string;
  required_tags?: string[];
}

interface TagInfo {
  key: string;
  description: string;
  category: string;
}

// ─── Block palette definitions ─────────────────────────────────────────────

interface BlockDef {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  category: "standard" | "smart";
  defaultSettings: Record<string, unknown>;
}

const emptyLocalized = (): LocalizedString => ({ nl: "", en: "", de: "", fr: "" });

const BLOCK_DEFS: BlockDef[] = [
  // Standard
  {
    type: "logo", label: "Logo", icon: <ImageIcon size={14} />, category: "standard",
    defaultSettings: { source: "location_logo", custom_url: "" },
  },
  {
    type: "header", label: "Koptekst", icon: <Type size={14} />, category: "standard",
    defaultSettings: { content: { nl: "Hallo {{buyer_name}},", en: "Hello {{buyer_name}},", de: "Hallo {{buyer_name}},", fr: "Bonjour {{buyer_name}}," } },
  },
  {
    type: "text", label: "Tekst", icon: <AlignLeft size={14} />, category: "standard",
    defaultSettings: { content: emptyLocalized() },
  },
  {
    type: "rich_text", label: "Opgemaakte tekst", icon: <AlignLeft size={14} />, category: "standard",
    defaultSettings: { html: emptyLocalized() },
  },
  {
    type: "button", label: "Knop", icon: <Square size={14} />, category: "standard",
    defaultSettings: { label: { nl: "Bekijk", en: "View", de: "Ansehen", fr: "Voir" }, url: "{{offer_link}}", color: "#C8102E" },
  },
  {
    type: "image", label: "Afbeelding", icon: <ImageIcon size={14} />, category: "standard",
    defaultSettings: { src: "", alt: "", link: "" },
  },
  {
    type: "divider", label: "Scheidingslijn", icon: <Minus size={14} />, category: "standard",
    defaultSettings: { color: "#eeeeee" },
  },
  {
    type: "spacer", label: "Ruimte", icon: <Space size={14} />, category: "standard",
    defaultSettings: { height: 24 },
  },
  {
    type: "footer", label: "Voettekst", icon: <AlignLeft size={14} />, category: "standard",
    defaultSettings: { content: { nl: "{{location_name}} · {{location_address}}\n{{location_email}} · {{location_phone}}", en: "{{location_name}} · {{location_address}}\n{{location_email}} · {{location_phone}}", de: "{{location_name}} · {{location_address}}\n{{location_email}} · {{location_phone}}", fr: "{{location_name}} · {{location_address}}\n{{location_email}} · {{location_phone}}" } },
  },
  {
    type: "signature", label: "Handtekening", icon: <FileText size={14} />, category: "standard",
    defaultSettings: { name: "{{location_name}}", title: "", phone: "{{location_phone}}" },
  },
  {
    type: "social_links", label: "Socials", icon: <Share2 size={14} />, category: "standard",
    defaultSettings: { links: [] },
  },
  // Smart
  {
    type: "boat_card", label: "Boot kaart", icon: <Ship size={14} />, category: "smart",
    defaultSettings: { show_image: true, show_price: true, button_label: { nl: "Bekijk boot", en: "View boat", de: "Boot ansehen", fr: "Voir le bateau" } },
  },
  {
    type: "offer_card", label: "Bod kaart", icon: <Tag size={14} />, category: "smart",
    defaultSettings: { show_amount: true, button_label: { nl: "Bekijk bod", en: "View offer", de: "Angebot ansehen", fr: "Voir l'offre" } },
  },
  {
    type: "seller_card", label: "Verkoper kaart", icon: <Phone size={14} />, category: "smart",
    defaultSettings: { show_email: true, show_phone: true },
  },
  {
    type: "buyer_card", label: "Koper kaart", icon: <Phone size={14} />, category: "smart",
    defaultSettings: { show_email: true, show_phone: true },
  },
  {
    type: "location_card", label: "Locatie kaart", icon: <Building2 size={14} />, category: "smart",
    defaultSettings: { show_address: true, show_phone: true, show_email: true },
  },
  {
    type: "contract_card", label: "Contract kaart", icon: <CreditCard size={14} />, category: "smart",
    defaultSettings: { button_label: { nl: "Contract ondertekenen", en: "Sign contract", de: "Vertrag unterzeichnen", fr: "Signer le contrat" } },
  },
];

const getBlockDef = (type: BlockType): BlockDef =>
  BLOCK_DEFS.find((d) => d.type === type) ?? BLOCK_DEFS[0];

// Maps BlockType → "EmailTemplateEditor" i18n key for the block palette
const BLOCK_TYPE_I18N: Record<BlockType, string> = {
  logo: "blocks.logo", header: "blocks.header", text: "blocks.text",
  rich_text: "blocks.richText", button: "blocks.button", image: "blocks.image",
  divider: "blocks.divider", spacer: "blocks.spacer", footer: "blocks.footer",
  signature: "blocks.signature", social_links: "blocks.socials",
  boat_card: "blocks.boatCard", offer_card: "blocks.offerCard",
  seller_card: "blocks.sellerCard", buyer_card: "blocks.buyerCard",
  location_card: "blocks.locationCard", contract_card: "blocks.contractCard",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _blockIdCounter = 0;
const nextBlockId = () => `b_${Date.now()}_${++_blockIdCounter}`;

function localStr(val: unknown, lang: Lang, fallback = ""): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, string>;
    return obj[lang] ?? obj["nl"] ?? fallback;
  }
  return fallback;
}

// ─── Block canvas item ────────────────────────────────────────────────────────
//
// Renders each block the way it will actually look in the sent email (not an
// abstract settings-summary card), so the center canvas genuinely reads as
// "the email itself" per the redesign. Clicking a block expands its edit
// fields directly beneath it, in place — that's what makes text/logo/button/
// image editing feel direct rather than routed through a separate far-away
// panel, without the fragility of true contentEditable inside rendered HTML.

function EmailBlockPreview({ block, lang }: { block: Block; lang: Lang }) {
  const t = useTranslations("EmailTemplateEditor");
  const s = block.settings;

  switch (block.type) {
    case "logo": {
      const src = s.source === "custom_url" && s.custom_url ? String(s.custom_url) : null;
      return (
        <div className="flex justify-center py-2">
          {src ? (
            <img src={src} alt="Logo" className="h-14 max-w-[200px] object-contain" />
          ) : (
            <div className="flex h-14 w-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">
              {t("canvas.logoPlaceholder")}
            </div>
          )}
        </div>
      );
    }
    case "header":
      return (
        <p className="text-2xl font-bold leading-snug text-slate-800 dark:text-slate-100">
          {localStr(s.content, lang) || <span className="text-slate-300 dark:text-slate-600">{t("canvas.headerPlaceholder")}</span>}
        </p>
      );
    case "text":
      return (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          {localStr(s.content, lang) || <span className="text-slate-300 dark:text-slate-600">{t("canvas.textPlaceholder")}</span>}
        </p>
      );
    case "rich_text":
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          {localStr(s.html, lang) || t("canvas.richTextLabel")}
        </div>
      );
    case "button":
      return (
        <div className="flex justify-center py-1">
          <div
            className="rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: String(s.color ?? "#C8102E") }}
          >
            {localStr(s.label, lang, t("canvas.buttonFallback"))}
          </div>
        </div>
      );
    case "image":
      return s.src ? (
        <img src={String(s.src)} alt={String(s.alt || "")} className="max-h-64 w-full rounded-lg object-contain" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700">
          {t("canvas.imagePlaceholder")}
        </div>
      );
    case "divider":
      return <hr style={{ borderColor: String(s.color ?? "#eeeeee") }} />;
    case "spacer":
      return (
        <div className="flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600" style={{ height: Number(s.height ?? 24) }}>
          {Number(s.height ?? 24)}{t("canvas.spacerSuffix")}
        </div>
      );
    case "footer":
      return (
        <p className="whitespace-pre-wrap text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {localStr(s.content, lang) || t("canvas.footerPlaceholder")}
        </p>
      );
    case "signature":
      return (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold">{String(s.name ?? "") || t("canvas.signatureName")}</p>
          {!!s.title && <p className="text-slate-500 dark:text-slate-400">{String(s.title)}</p>}
          {!!s.phone && <p className="text-slate-500 dark:text-slate-400">{String(s.phone)}</p>}
        </div>
      );
    case "social_links":
      return <p className="text-center text-xs text-slate-400">{t("canvas.socialLinksLabel")}</p>;
    case "boat_card":
      return <SmartCardPlaceholder icon={<Ship size={16} />} label={t("canvas.boatCardLabel")} tone="blue" />;
    case "offer_card":
      return <SmartCardPlaceholder icon={<Tag size={16} />} label={t("canvas.offerCardLabel")} tone="green" />;
    case "seller_card":
      return <SmartCardPlaceholder icon={<Phone size={16} />} label={t("canvas.sellerCardLabel")} tone="purple" />;
    case "buyer_card":
      return <SmartCardPlaceholder icon={<Phone size={16} />} label={t("canvas.buyerCardLabel")} tone="orange" />;
    case "location_card":
      return <SmartCardPlaceholder icon={<Building2 size={16} />} label={t("canvas.locationCardLabel")} tone="slate" />;
    case "contract_card":
      return <SmartCardPlaceholder icon={<CreditCard size={16} />} label={t("canvas.contractCardLabel")} tone="red" />;
    default:
      return null;
  }
}

function SmartCardPlaceholder({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "blue" | "green" | "purple" | "orange" | "slate" | "red" }) {
  const tones: Record<typeof tone, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    green: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
    purple: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-200",
    orange: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-200",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium", tones[tone])}>
      {icon}
      {label}
    </div>
  );
}

function BlockCanvasItem({
  block,
  index,
  isSelected,
  lang,
  tags,
  onSelect,
  onRemove,
  onChange,
}: {
  block: Block;
  index: number;
  isSelected: boolean;
  lang: Lang;
  tags: TagInfo[];
  onSelect: () => void;
  onRemove: () => void;
  onChange: (settings: Record<string, unknown>) => void;
}) {
  const t = useTranslations("EmailTemplateEditor");
  const def = getBlockDef(block.type);

  const BLOCK_LABELS: Record<BlockType, string> = {
    logo: t("blocks.logo"), header: t("blocks.header"), text: t("blocks.text"),
    rich_text: t("blocks.richText"), button: t("blocks.button"), image: t("blocks.image"),
    divider: t("blocks.divider"), spacer: t("blocks.spacer"), footer: t("blocks.footer"),
    signature: t("blocks.signature"), social_links: t("blocks.socials"),
    boat_card: t("blocks.boatCard"), offer_card: t("blocks.offerCard"),
    seller_card: t("blocks.sellerCard"), buyer_card: t("blocks.buyerCard"),
    location_card: t("blocks.locationCard"), contract_card: t("blocks.contractCard"),
  };

  return (
    <Draggable draggableId={block.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group rounded-xl border bg-white transition dark:bg-slate-900",
            isSelected
              ? "border-[#003566] shadow-sm dark:border-blue-500"
              : "border-transparent hover:border-slate-200 dark:hover:border-slate-700",
            snapshot.isDragging && "shadow-lg ring-2 ring-[#003566]/20",
          )}
        >
          <div
            className="flex cursor-pointer items-start gap-2 px-4 py-3"
            onClick={onSelect}
            title={t("canvas.clickToEditHint")}
          >
            <div
              {...provided.dragHandleProps}
              className="mt-1 cursor-grab text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <EmailBlockPreview block={block} lang={lang} />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="mt-1 rounded-lg p-1 text-slate-200 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-slate-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {isSelected && (
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span className="text-slate-400 dark:text-slate-500">{def.icon}</span>
                {BLOCK_LABELS[block.type] ?? def.label}
              </div>
              <BlockSettingsFields block={block} lang={lang} onChange={onChange} tags={tags} />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Logo block settings (with file upload) ───────────────────────────────────

function LogoBlockSettings({
  s,
  setField,
}: {
  s: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("EmailTemplateEditor");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<{ url: string }>("/admin/email-templates/upload-media", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setField("source", "custom_url");
      setField("custom_url", res.data.url);
    } catch {
      toast.error(t("toasts.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.logoSource")}</label>
        <select
          value={String(s.source ?? "location_logo")}
          onChange={(e) => setField("source", e.target.value)}
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="location_logo">{t("blockSettings.logoSourceAuto")}</option>
          <option value="custom_url">{t("blockSettings.logoSourceCustom")}</option>
        </select>
      </div>
      {String(s.source ?? "location_logo") === "custom_url" && (
        <div className="space-y-2">
          <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.logoUrl")}</label>
          <Input
            value={String(s.custom_url ?? "")}
            onChange={(e) => setField("custom_url", e.target.value)}
            className="rounded-xl text-sm"
            placeholder="https://..."
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{t("blockSettings.or")}</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              {uploading ? t("blockSettings.uploading") : t("blockSettings.uploadFile")}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileChange(e)} />
          </div>
          {!!s.custom_url && (
            <img src={String(s.custom_url)} alt="Logo preview" className="mt-2 max-h-16 max-w-full rounded border border-slate-200 object-contain p-1" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Image block settings (with file upload) ──────────────────────────────────

function ImageBlockSettings({
  s,
  setField,
}: {
  s: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("EmailTemplateEditor");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<{ url: string }>("/admin/email-templates/upload-media", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setField("src", res.data.url);
    } catch {
      toast.error(t("toasts.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.imageUrl")}</label>
        <Input value={String(s.src ?? "")} onChange={(e) => setField("src", e.target.value)} className="rounded-xl text-sm" placeholder="https://..." />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
            {uploading ? t("blockSettings.uploading") : t("blockSettings.uploadFile")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFileChange(e)} />
        </div>
        {!!s.src && (
          <img src={String(s.src)} alt="" className="mt-2 max-h-20 max-w-full rounded border border-slate-200 object-contain p-1" />
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.altText")}</label>
        <Input value={String(s.alt ?? "")} onChange={(e) => setField("alt", e.target.value)} className="rounded-xl text-sm" />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.linkOptional")}</label>
        <Input value={String(s.link ?? "")} onChange={(e) => setField("link", e.target.value)} className="rounded-xl text-sm" placeholder="https://..." />
      </div>
    </div>
  );
}

// ─── Block settings panel ─────────────────────────────────────────────────────

function BlockSettingsFields({
  block,
  lang,
  onChange,
  tags,
}: {
  block: Block;
  lang: Lang;
  onChange: (settings: Record<string, unknown>) => void;
  tags: TagInfo[];
}) {
  const t = useTranslations("EmailTemplateEditor");
  const s = block.settings;

  const setField = (key: string, value: unknown) => onChange({ ...s, [key]: value });
  const setLocalizedField = (key: string, value: string) => {
    const current = (s[key] ?? emptyLocalized()) as LocalizedString;
    onChange({ ...s, [key]: { ...current, [lang]: value } });
  };

  const tagOptions = tags.map((t) => `{{${t.key}}}`);

  const LocalizedTextArea = ({ fieldKey, label, rows = 3 }: { fieldKey: string; label: string; rows?: number }) => (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label} ({LANG_LABELS[lang]})</label>
      <textarea
        rows={rows}
        value={localStr(s[fieldKey], lang)}
        onChange={(e) => setLocalizedField(fieldKey, e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 resize-none outline-none focus:border-[#003566]"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {tagOptions.slice(0, 6).map((tag) => (
          <button
            key={tag}
            onClick={() => setLocalizedField(fieldKey, localStr(s[fieldKey], lang) + tag)}
            className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 hover:bg-[#003566] hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-900 transition"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );

  const LocalizedInput = ({ fieldKey, label }: { fieldKey: string; label: string }) => (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label} ({LANG_LABELS[lang]})</label>
      <Input
        value={localStr(s[fieldKey], lang)}
        onChange={(e) => setLocalizedField(fieldKey, e.target.value)}
        className="rounded-xl text-sm"
      />
    </div>
  );

  const BoolToggle = ({ fieldKey, label }: { fieldKey: string; label: string }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={Boolean(s[fieldKey])}
        onChange={(e) => setField(fieldKey, e.target.checked)}
        className="rounded"
      />
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  );

  const renderFields = () => {
    switch (block.type) {
      case "logo":
        return (
          <LogoBlockSettings s={s} setField={setField} />
        );
      case "header":
        return <LocalizedTextArea fieldKey="content" label={t("blockSettings.text")} rows={2} />;
      case "text":
        return <LocalizedTextArea fieldKey="content" label={t("blockSettings.text")} rows={5} />;
      case "rich_text":
        return <LocalizedTextArea fieldKey="html" label={t("blockSettings.htmlContent")} rows={8} />;
      case "button":
        return (
          <div className="space-y-4">
            <LocalizedInput fieldKey="label" label={t("blockSettings.buttonLabel")} />
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.buttonUrl")}</label>
              <Input value={String(s.url ?? "")} onChange={(e) => setField("url", e.target.value)} className="rounded-xl text-sm" placeholder="{{offer_link}}" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["{{offer_link}}", "{{contract_link}}", "{{chat_link}}", "{{brochure_link}}", "{{boat_url}}"].map((tag) => (
                  <button key={tag} onClick={() => setField("url", tag)} className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 hover:bg-[#003566] hover:text-white dark:bg-slate-800 dark:text-slate-300 transition">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.color")}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={String(s.color ?? "#C8102E")} onChange={(e) => setField("color", e.target.value)} className="h-9 w-14 rounded-xl border border-slate-200 bg-white dark:border-slate-700 cursor-pointer" />
                <Input value={String(s.color ?? "#C8102E")} onChange={(e) => setField("color", e.target.value)} className="rounded-xl text-sm font-mono" />
              </div>
            </div>
          </div>
        );
      case "image":
        return (
          <ImageBlockSettings s={s} setField={setField} />
        );
      case "divider":
        return (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.color")}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={String(s.color ?? "#eeeeee")} onChange={(e) => setField("color", e.target.value)} className="h-9 w-14 rounded-xl border border-slate-200 bg-white dark:border-slate-700 cursor-pointer" />
              <Input value={String(s.color ?? "#eeeeee")} onChange={(e) => setField("color", e.target.value)} className="rounded-xl text-sm font-mono" />
            </div>
          </div>
        );
      case "spacer":
        return (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.spacerHeight")}</label>
            <Input type="number" min={4} max={120} value={Number(s.height ?? 24)} onChange={(e) => setField("height", Number(e.target.value))} className="rounded-xl text-sm" />
          </div>
        );
      case "footer":
        return <LocalizedTextArea fieldKey="content" label={t("blockSettings.footer")} rows={4} />;
      case "signature":
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.sigName")}</label>
              <Input value={String(s.name ?? "")} onChange={(e) => setField("name", e.target.value)} className="rounded-xl text-sm" placeholder="{{location_name}}" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.sigTitle")}</label>
              <Input value={String(s.title ?? "")} onChange={(e) => setField("title", e.target.value)} className="rounded-xl text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("blockSettings.sigPhone")}</label>
              <Input value={String(s.phone ?? "")} onChange={(e) => setField("phone", e.target.value)} className="rounded-xl text-sm" placeholder="{{location_phone}}" />
            </div>
          </div>
        );
      case "social_links":
        return (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t("blockSettings.socialLinksInfo")}
          </div>
        );
      case "boat_card":
        return (
          <div className="space-y-4">
            <BoolToggle fieldKey="show_image" label={t("blockSettings.showImage")} />
            <BoolToggle fieldKey="show_price" label={t("blockSettings.showPrice")} />
            <LocalizedInput fieldKey="button_label" label={t("blockSettings.cardButtonText")} />
          </div>
        );
      case "offer_card":
        return (
          <div className="space-y-4">
            <BoolToggle fieldKey="show_amount" label={t("blockSettings.showAmount")} />
            <LocalizedInput fieldKey="button_label" label={t("blockSettings.cardButtonText")} />
          </div>
        );
      case "seller_card":
      case "buyer_card":
        return (
          <div className="space-y-4">
            <BoolToggle fieldKey="show_email" label={t("blockSettings.showEmail")} />
            <BoolToggle fieldKey="show_phone" label={t("blockSettings.showPhone")} />
          </div>
        );
      case "location_card":
        return (
          <div className="space-y-4">
            <BoolToggle fieldKey="show_address" label={t("blockSettings.showAddress")} />
            <BoolToggle fieldKey="show_phone" label={t("blockSettings.showPhone")} />
            <BoolToggle fieldKey="show_email" label={t("blockSettings.showEmail")} />
          </div>
        );
      case "contract_card":
        return <LocalizedInput fieldKey="button_label" label={t("blockSettings.cardButtonText")} />;
      default:
        return <p className="text-sm text-slate-400">{t("blockSettings.noSettings")}</p>;
    }
  };

  return (
    <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
      {renderFields()}
      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{t("blockSettings.availableTags")}</p>
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {tags.map((t) => (
            <span key={t.key} title={t.description} className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-default">
              {`{{${t.key}}}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Preview pane ─────────────────────────────────────────────────────────────

type PreviewMode = "desktop" | "tablet" | "mobile";

function PreviewPane({
  templateId,
  lang,
  blocks,
  subject,
}: {
  templateId: number;
  lang: Lang;
  blocks: Block[];
  subject: LocalizedString;
}) {
  const t = useTranslations("EmailTemplateEditor");
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [dark, setDark] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Keep t in a ref so it never needs to be a useCallback dep (avoids re-trigger loops)
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const loadPreview = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await api.post<{ html: string }>(
        `/admin/email-templates/${templateId}/preview`,
        { lang, blocks },
        { signal: controller.signal, timeout: 20000 },
      );
      if (controller.signal.aborted) return;
      setHtml(res.data.html);
    } catch {
      if (controller.signal.aborted) return;
      setHtml(`<p style='color:red;padding:20px;'>${tRef.current("preview.loadFailed")}</p>`);
    } finally {
      // Only clear loading for the request that is still "current" — not for aborted ones,
      // because the aborting call already set loading=true for the next request.
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [templateId, lang, blocks]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void loadPreview(); }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadPreview]);

  const handleTestSend = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      await api.post(`/admin/email-templates/${templateId}/test-send`, { email: testEmail, lang });
      toast.success(t("preview.testSentSuccess", { email: testEmail }));
    } catch {
      toast.error(t("preview.testSentFailed"));
    } finally {
      setSendingTest(false);
    }
  };

  const widthMap: Record<PreviewMode, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top controls */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
          {(["desktop", "tablet", "mobile"] as PreviewMode[]).map((m) => {
            const Icon = m === "desktop" ? Monitor : m === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn("rounded-lg p-1.5 transition", mode === m ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setDark(!dark)}
          className={cn("rounded-xl border p-1.5 transition", dark ? "border-slate-600 bg-slate-800 text-white" : "border-slate-200 text-slate-400 hover:text-slate-700")}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder={t("preview.testPlaceholder")}
            className="h-8 rounded-xl text-xs w-44"
            type="email"
          />
          <Button
            onClick={() => void handleTestSend()}
            disabled={!testEmail || sendingTest}
            size="sm"
            className="h-8 rounded-xl bg-[#003566] text-white text-xs hover:bg-blue-900 disabled:opacity-50"
          >
            {sendingTest ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
            {t("preview.testButton")}
          </Button>
        </div>
      </div>

      {/* Subject preview */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("preview.subjectPrefix")}{LANG_LABELS[lang]}):</p>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{subject[lang] || t("preview.noSubject")}</p>
      </div>

      {/* Frame */}
      <div className={cn("flex-1 overflow-auto p-4 transition", dark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-900")}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="mx-auto transition-all" style={{ maxWidth: widthMap[mode] }}>
            {html && (
              <iframe
                srcDoc={html}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm bg-white"
                style={{ height: "600px" }}
                sandbox="allow-same-origin"
              />
            )}
          </div>
        )}
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
  const t = useTranslations("EmailTemplateEditor");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get(`/admin/email-templates/${templateId}/versions`);
        const raw = res.data as { versions?: TemplateVersion[] } | TemplateVersion[];
        setVersions(Array.isArray(raw) ? raw : (raw as { versions?: TemplateVersion[] })?.versions ?? []);
      } catch {
        toast.error(t("versions.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [templateId, t]);

  const handleRestore = async (v: TemplateVersion) => {
    if (!confirm(t("versions.restoreConfirm", { version: v.version }))) return;
    setRestoring(v.version);
    try {
      await api.post(`/admin/email-templates/${templateId}/restore-version`, { version: v.version });
      toast.success(t("versions.restored", { version: v.version }));
      onRestore();
    } catch {
      toast.error(t("versions.restoreFailed"));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="p-5">
      <p className="mb-4 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("versions.title")}</p>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-sm text-slate-500">{t("versions.empty")}</p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className={cn("rounded-xl border p-3", v.version === currentVersion ? "border-[#003566]/40 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900")}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">v{v.version}</span>
                    {v.version === currentVersion && (
                      <span className="rounded-full bg-[#003566] px-1.5 py-0.5 text-[9px] font-black text-white">{t("versions.current")}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(v.created_at).toLocaleString("nl-NL")}</p>
                  {v.change_note && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{v.change_note}</p>}
                </div>
                {v.version !== currentVersion && (
                  <button
                    onClick={() => void handleRestore(v)}
                    disabled={restoring === v.version}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {restoring === v.version ? <Loader2 size={10} className="animate-spin" /> : t("versions.restore")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tags panel ───────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["User", "Buyer", "Seller", "Boat", "Location", "Deal", "Contract", "Invoice", "Payment", "Company", "System"];

function TagsPanel({ tags }: { tags: TagInfo[] }) {
  const t = useTranslations("EmailTemplateEditor");
  const [search, setSearch] = useState("");

  const filtered = search
    ? tags.filter((tag) => tag.key.toLowerCase().includes(search.toLowerCase()) || tag.description.toLowerCase().includes(search.toLowerCase()))
    : tags;

  const grouped = CATEGORY_ORDER.reduce<Record<string, TagInfo[]>>((acc, cat) => {
    const items = filtered.filter((tag) => tag.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const remaining = filtered.filter((tag) => !CATEGORY_ORDER.includes(tag.category));
  if (remaining.length > 0) grouped["other"] = remaining;

  const getCategoryLabel = (cat: string): string => {
    const key = `categories.${cat}` as Parameters<typeof t>[0];
    try { return t(key); } catch { return cat; }
  };

  const handleTagInsert = (e: React.MouseEvent, tagKey: string) => {
    e.preventDefault();
    const tagText = `{{${tagKey}}}`;
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
      document.execCommand("insertText", false, tagText);
    } else {
      void navigator.clipboard.writeText(tagText).then(() => toast.success(t("tags.copied", { tag: tagText })));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">{t("tags.title")}</p>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("tags.searchPlaceholder")}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-7 pr-3 py-1.5 text-xs outline-none focus:border-[#003566] dark:text-slate-100"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-[10px] text-slate-400 leading-relaxed">{t("tags.instruction")}</p>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {getCategoryLabel(cat)}
            </p>
            <div className="flex flex-wrap gap-1">
              {items.map((tag) => (
                <button
                  key={tag.key}
                  onMouseDown={(e) => handleTagInsert(e, tag.key)}
                  title={tag.description}
                  className="inline-flex items-center rounded-md border border-[#003566]/20 bg-[#003566]/5 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#003566] hover:bg-[#003566]/10 hover:border-[#003566]/40 transition dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
                >
                  {`{{${tag.key}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-xs text-slate-400">{t("tags.empty")}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main editor page ─────────────────────────────────────────────────────────

export default function EmailTemplateEditorPage() {
  const t = useTranslations("EmailTemplateEditor");
  const tTypes = useTranslations("EmailTemplates");
  const locale = useLocale();
  const params = useParams<{ role?: string; id?: string }>();
  const role = params?.role ?? "admin";
  const templateId = Number(params?.id);
  const router = useRouter();
  const root = `/${locale}/dashboard/${role}`;

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [subject, setSubject] = useState<LocalizedString>({ nl: "", en: "", de: "", fr: "" });
  const [preheader, setPreheader] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [languageDefault, setLanguageDefault] = useState<Lang>("nl");
  const [isActive, setIsActive] = useState(true);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#C8102E");
  const [isGlobal, setIsGlobal] = useState(false);

  const [activeLang, setActiveLang] = useState<Lang>("nl");
  // Selecting a block expands its edit fields inline, directly below it in
  // the canvas — there's no separate "settings" right-panel mode anymore.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"preview" | "versions" | "meta" | "tags">("preview");

  const [types, setTypes] = useState<TemplateType[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [showChangeNoteModal, setShowChangeNoteModal] = useState(false);
  const [savingWithNote, setSavingWithNote] = useState(false);
  const [blockFilter, setBlockFilter] = useState<"standard" | "smart" | "all">("all");

  // Mirrors the backend's EmailTemplateRendererService::extractUsedTags() —
  // any {{tag}} referenced in this template's blocks/subject that isn't in
  // the known tag list will now (per the rendering fix) be silently
  // stripped at send time rather than left raw in the email, but an admin
  // should still know it's there and never gets replaced.
  const unsupportedTags = useMemo(() => {
    if (tags.length === 0) return [];
    const known = new Set(tags.map((tag) => tag.key));
    const haystack = JSON.stringify({ blocks, subject });
    const found = haystack.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? [];
    const used = new Set(found.map((m) => m.replace(/[{}\s]/g, "")));
    return Array.from(used).filter((key) => !known.has(key));
  }, [blocks, subject, tags]);

  // The inverse check: tags the send-time code for *this* event type always
  // populates (EmailTemplateRendererService::REQUIRED_TAGS_PER_TYPE) that
  // this template never references — e.g. an offer-received email that
  // never mentions {{offer_amount}}. A tag being globally "known" (checked
  // above) doesn't mean it's actually relevant to the selected event.
  const missingRequiredTags = useMemo(() => {
    const required = types.find((tp) => tp.value === templateType)?.required_tags ?? [];
    if (required.length === 0) return [];
    const haystack = JSON.stringify({ blocks, subject });
    return required.filter((key) => !haystack.includes(`{{${key}}}`));
  }, [blocks, subject, templateType, types]);

  useEffect(() => {
    if (!templateId) return;
    void loadTemplate();
    void loadMeta();
  }, [templateId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/email-templates/${templateId}`);
      const t = (res.data as { template?: EmailTemplate })?.template ?? res.data as EmailTemplate;
      setTemplate(t);
      setBlocks(Array.isArray(t.blocks) ? t.blocks : []);
      setSubject(t.subject ?? { nl: "", en: "", de: "", fr: "" });
      setPreheader((t as unknown as { preheader?: string }).preheader ?? "");
      setName(t.name ?? "");
      setDescription(t.description ?? "");
      setTemplateType(t.type ?? "");
      setLanguageDefault(t.language_default ?? "nl");
      setIsActive(t.is_active ?? true);
      setSenderName(t.sender_name_override ?? "");
      setSenderEmail(t.sender_email_override ?? "");
      setReplyTo(t.reply_to_override ?? "");
      setPrimaryColor(t.primary_color_override ?? "#C8102E");
      setIsGlobal(t.is_global ?? false);
      setIsDirty(false);
    } catch {
      toast.error(t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [typesRes, tagsRes] = await Promise.all([
        api.get("/admin/email-templates/types"),
        api.get("/admin/email-templates/tags"),
      ]);
      const rawTypes = typesRes.data;
      setTypes(Array.isArray(rawTypes) ? (rawTypes as TemplateType[]) : []);
      const rawTags = tagsRes.data;
      // New format: { tags: TagInfo[], categories: string[] }; old format: TagInfo[]
      if (Array.isArray(rawTags)) {
        setTags(rawTags as TagInfo[]);
      } else if (rawTags && typeof rawTags === "object" && Array.isArray((rawTags as { tags?: TagInfo[] }).tags)) {
        setTags((rawTags as { tags: TagInfo[] }).tags);
      }
    } catch {
      // non-fatal
    }
  };

  const markDirty = () => setIsDirty(true);

  const handleAddBlock = (def: BlockDef) => {
    const newBlock: Block = {
      id: nextBlockId(),
      type: def.type,
      settings: JSON.parse(JSON.stringify(def.defaultSettings)) as Record<string, unknown>,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    markDirty();
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    markDirty();
  };

  const handleBlockSettingsChange = (id: string, settings: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, settings } : b)));
    markDirty();
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(blocks);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setBlocks(reordered);
    markDirty();
  };

  const handleSave = async (note?: string) => {
    setSaving(true);
    try {
      await api.patch(`/admin/email-templates/${templateId}`, {
        name,
        description: description || null,
        type: templateType,
        language_default: languageDefault,
        subject,
        preheader: preheader || null,
        blocks,
        sender_name_override: senderName || null,
        sender_email_override: senderEmail || null,
        reply_to_override: replyTo || null,
        primary_color_override: primaryColor || null,
        is_active: isActive,
        is_global: isGlobal,
        change_note: note || null,
      });
      toast.success(t("toasts.saved"));
      setIsDirty(false);
      setChangeNote("");
      await loadTemplate();
    } catch {
      toast.error(t("toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWithNote = async () => {
    setSavingWithNote(true);
    await handleSave(changeNote);
    setSavingWithNote(false);
    setShowChangeNoteModal(false);
  };

  const filteredBlockDefs = blockFilter === "all"
    ? BLOCK_DEFS
    : BLOCK_DEFS.filter((d) => d.category === blockFilter);

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
        <p className="text-slate-500">{t("toasts.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-3 flex-shrink-0">
        <button
          onClick={() => router.push(`${root}/email-templates`)}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); markDirty(); }}
            className="w-full bg-transparent text-base font-bold text-slate-900 dark:text-white outline-none placeholder:text-slate-400 truncate"
            placeholder={t("topBar.namePlaceholder")}
          />
          <div className="flex items-center gap-2 mt-0.5">
            {template.is_global ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                <Globe2 size={9} /> {t("topBar.globalBadge")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                <MapPin size={9} /> {template.location?.name ?? t("topBar.locationFallback")}
              </span>
            )}
            <span className="text-[10px] text-slate-400">v{template.current_version}</span>
            {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" title={t("topBar.unsavedDot")} />}
          </div>
        </div>

        {/* Language tabs */}
        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setActiveLang(l)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                activeLang === l ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>

        {/* Right panel toggles */}
        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
          <button onClick={() => setRightPanel("preview")} className={cn("rounded-lg p-1.5 transition", rightPanel === "preview" ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")} title={t("topBar.previewTooltip")}>
            <Eye size={14} />
          </button>
          <button onClick={() => setRightPanel("versions")} className={cn("rounded-lg p-1.5 transition", rightPanel === "versions" ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")} title={t("topBar.versionsTooltip")}>
            <History size={14} />
          </button>
          <button onClick={() => setRightPanel("meta")} className={cn("rounded-lg p-1.5 transition", rightPanel === "meta" ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")} title={t("topBar.settingsTooltip")}>
            <Settings2 size={14} />
          </button>
          <button onClick={() => setRightPanel("tags")} className={cn("rounded-lg p-1.5 transition", rightPanel === "tags" ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")} title={t("topBar.tagsTooltip")}>
            <Tag size={14} />
          </button>
        </div>

        <button
          onClick={() => setShowChangeNoteModal(true)}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t("topBar.saveButton")}
        </button>
      </div>

      {unsupportedTags.length > 0 && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 flex-shrink-0">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {t("warnings.unsupportedTags", { tags: unsupportedTags.map((tag) => `{{${tag}}}`).join(", ") })}
        </div>
      )}

      {missingRequiredTags.length > 0 && (
        <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 flex-shrink-0">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {t("warnings.missingRequiredTags", { tags: missingRequiredTags.map((tag) => `{{${tag}}}`).join(", ") })}
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block palette */}
        <div className="w-52 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{t("palette.heading")}</p>
            <div className="flex gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              {(["all", "standard", "smart"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setBlockFilter(f)}
                  className={cn("flex-1 rounded-md py-0.5 text-[10px] font-bold transition",
                    blockFilter === f ? "bg-[#003566] text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  {f === "all" ? t("palette.filterAll") : f === "standard" ? t("palette.filterBasic") : <Sparkles size={10} className="mx-auto" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {filteredBlockDefs.map((def) => (
              <button
                key={def.type}
                onClick={() => handleAddBlock(def)}
                className="flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-xs text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 transition"
              >
                <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">{def.icon}</span>
                <span className="truncate">{t(BLOCK_TYPE_I18N[def.type] as Parameters<typeof t>[0])}</span>
                <Plus size={11} className="ml-auto flex-shrink-0 text-slate-300 dark:text-slate-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Event / location / status info bar */}
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("infoBar.eventLabel")}</span>
              <select
                value={templateType}
                onChange={(e) => { setTemplateType(e.target.value); markDirty(); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {types.length === 0 && <option value={templateType}>{templateType || t("infoBar.eventFallback")}</option>}
                {types.map((tp) => {
                  let label = tp.label;
                  try { label = tTypes(`types.${tp.value}` as Parameters<typeof tTypes>[0]); } catch {}
                  return <option key={tp.value} value={tp.value}>{label}</option>;
                })}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              {template?.is_global ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                  <Globe2 size={9} /> {t("infoBar.globalBadge")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <MapPin size={9} /> {template?.location?.name ?? t("infoBar.noLocation")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("infoBar.languageLabel")}</span>
              <select
                value={languageDefault}
                onChange={(e) => { setLanguageDefault(e.target.value as Lang); markDirty(); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span className={cn("text-[10px] font-black uppercase tracking-wider", isActive ? "text-emerald-600" : "text-slate-400")}>
                  {isActive ? t("infoBar.statusActive") : t("infoBar.statusDraft")}
                </span>
                <button
                  type="button"
                  onClick={() => { setIsActive((p) => !p); markDirty(); }}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
                  )}
                >
                  <span className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", isActive && "translate-x-4")} />
                </button>
              </label>
            </div>
          </div>

          {/* Subject + preheader */}
          <div className="mx-auto mb-4 max-w-[640px] rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t("canvas.subjectLabel", { lang: LANG_LABELS[activeLang] })}
              </label>
              <input
                value={subject[activeLang] ?? ""}
                onChange={(e) => { setSubject((prev) => ({ ...prev, [activeLang]: e.target.value })); markDirty(); }}
                className="w-full bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-300"
                placeholder={t("canvas.subjectPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t("canvas.preheaderLabel")}
              </label>
              <input
                value={preheader}
                onChange={(e) => { setPreheader(e.target.value); markDirty(); }}
                className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-300"
                placeholder={t("canvas.preheaderPlaceholder")}
                maxLength={200}
              />
            </div>
          </div>

          {/* Blocks — styled as the actual email body (white "paper", centered,
              email-width) so this genuinely reads as the email itself rather
              than a list of setting cards. */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="canvas">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="mx-auto max-w-[640px] space-y-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6"
                >
                  {blocks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-center">
                      <Plus size={24} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-400">{t("canvas.emptyState")}</p>
                    </div>
                  )}
                  {blocks.map((block, i) => (
                    <BlockCanvasItem
                      key={block.id}
                      block={block}
                      index={i}
                      isSelected={selectedBlockId === block.id}
                      lang={activeLang}
                      tags={tags}
                      onSelect={() => setSelectedBlockId((prev) => (prev === block.id ? null : block.id))}
                      onRemove={() => handleRemoveBlock(block.id)}
                      onChange={(settings) => handleBlockSettingsChange(block.id, settings)}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="mt-4 text-center text-[10px] text-slate-300 dark:text-slate-600">
            {t("canvas.blocksCount", { count: blocks.length })}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {rightPanel === "preview" ? (
            <PreviewPane
              templateId={templateId}
              lang={activeLang}
              blocks={blocks}
              subject={subject}
            />
          ) : rightPanel === "versions" ? (
            <div className="flex-1 overflow-y-auto">
              <VersionsPanel
                templateId={templateId}
                currentVersion={template.current_version}
                onRestore={() => { void loadTemplate(); }}
              />
            </div>
          ) : rightPanel === "tags" ? (
            <TagsPanel tags={tags} />
          ) : (
            // Meta settings
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t("meta.title")}</p>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("meta.description")}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 resize-none outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("meta.senderName")}</label>
                <Input value={senderName} onChange={(e) => { setSenderName(e.target.value); markDirty(); }} className="rounded-xl text-sm" placeholder="{{location_name}}" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("meta.senderEmail")}</label>
                <Input value={senderEmail} onChange={(e) => { setSenderEmail(e.target.value); markDirty(); }} className="rounded-xl text-sm" type="email" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("meta.replyTo")}</label>
                <Input value={replyTo} onChange={(e) => { setReplyTo(e.target.value); markDirty(); }} className="rounded-xl text-sm" type="email" />
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t("meta.style")}</p>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t("meta.primaryColor")}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); markDirty(); }} className="h-9 w-14 rounded-xl border border-slate-200 cursor-pointer dark:border-slate-700" />
                    <Input value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); markDirty(); }} className="rounded-xl text-sm font-mono" />
                  </div>
                </div>
              </div>
              {template.location && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">{t("meta.locationSection")}</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{template.location.name}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Change note modal */}
      {showChangeNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("changeNote.title")}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("changeNote.body")}</p>
            <textarea
              rows={3}
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder={t("changeNote.placeholder")}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-[#003566] resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowChangeNoteModal(false)} className="rounded-xl">{t("changeNote.cancel")}</Button>
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                variant="outline"
                className="rounded-xl text-slate-500"
              >
                {t("changeNote.saveWithoutNote")}
              </Button>
              <Button
                onClick={() => void handleSaveWithNote()}
                disabled={savingWithNote}
                className="rounded-xl bg-[#003566] text-white hover:bg-blue-900"
              >
                {savingWithNote ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                {t("changeNote.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
