"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  cloneElement,
  isValidElement,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Camera,
  Loader2,
  Upload,
  Waves,
  Coins,
  Images,
  Trash,
  AlertCircle,
  Ship,
  Compass,
  Box,
  CheckSquare,
  Sparkles,
  CheckCircle,
  Zap,
  Bed,
  Save,
  Settings2,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Eye,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Globe,
  Volume2,
  Shield,
  Anchor,
  WifiOff,
  Wind,
  Filter,
  HelpCircle,
  Info,
  Languages,
  Star,
  Users,
  Video,
  Wifi,
  Plus,
  X,
  UploadCloud,
  Edit3,
  Anchor as MooringIcon,
  CalendarDays,
  Key,
  Sun,
  ShieldCheck,
  Play,
  GripVertical,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { getDictionary } from "@/lib/i18n";
import { normalizeRole } from "@/lib/auth/roles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DropResult } from "@hello-pangea/dnd";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="border border-slate-200 rounded-lg p-6 h-[340px] bg-slate-50 animate-pulse flex items-center justify-center text-sm text-slate-400">
      Loading editor...
    </div>
  ),
});
import { toast as hotToast, Toaster } from "react-hot-toast";
import { useYachtDraft } from "@/hooks/useYachtDraft";
import { convertBatchToWebP } from "@/lib/convertToWebP";
import { CatalogAutocomplete } from "@/components/ui/CatalogAutocomplete";
import { BoatCreationAssistant } from "@/components/yachts/BoatCreationAssistant";
import { signhostApi } from "@/lib/api/signhost";
import {
  latestSignhostFromTransaction,
  normalizeClientContractStatus,
  normalizeLatestSignhost,
} from "@/lib/signhost/latest-signhost";
import { useClientSession } from "@/components/session/ClientSessionProvider";
import { useImagePipeline, PipelineImage } from "@/hooks/useImagePipeline";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  generateUUID,
  createLocalBoat,
  updateLocalBoat,
  getLocalBoat,
} from "@/lib/offline-db";
import { storeImage } from "@/hooks/useImageStore";
import {
  createOrReplaceYachtDraft,
  patchYachtDraft,
  getYachtDraft,
  commitYachtDraft,
} from "@/lib/api/yacht-drafts";
import { FieldHistoryPopover } from "@/components/yachts/FieldHistoryPopover";
import {
  FieldCorrectionControls,
  CorrectionLabel,
} from "@/components/yachts/FieldCorrectionControls";
import {
  getBoatFormConfig,
  type BoatFormConfigBlock,
} from "@/lib/api/boat-form-config";
import { ConfigurableBoatFieldBlock } from "@/components/yachts/ConfigurableBoatFieldBlock";
import { FieldHelpTooltip } from "@/components/yachts/FieldHelpTooltip";
import { BoatFieldSettingsLink } from "@/components/yachts/BoatFieldSettingsLink";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { WizardStep1 } from "@/components/yachts/wizard/WizardStep1";
import { WizardStep2 } from "@/components/yachts/wizard/WizardStep2";
import { WizardStep3 } from "@/components/yachts/wizard/WizardStep3";
import { WizardStep4 } from "@/components/yachts/wizard/WizardStep4";
import { WizardStep5 } from "@/components/yachts/wizard/WizardStep5";
import { WizardStep6 } from "@/components/yachts/wizard/WizardStep6";
import { 
  FieldLabel, 
  WizardInput as Input, 
  SelectField, 
  YachtFieldWrapper, 
  TriStateSelect, 
  SectionHeader,
  AiEvidenceHover,
  hasFilledFieldValue
} from "@/components/yachts/wizard/WizardHelpers";
import { matchBoat, type BoatMatchResult } from "@/lib/api/boat-match";

// ALi
// Wizard step config
const WIZARD_STEP_IDS = [
  { id: 1, key: "images", icon: Images },
  { id: 2, key: "specs", icon: Waves },
  { id: 3, key: "text", icon: FileText },
  { id: 4, key: "display", icon: Eye },
  { id: 5, key: "review", icon: CheckCircle },
  { id: 6, key: "contract", icon: Key },
] as const;

const MAX_IMAGES_UPLOAD = 50;
const UPLOAD_BATCH_SIZE = 10;
const UPLOAD_MAX_PARALLEL_BATCHES = 2;
const EXTRACTION_ESTIMATED_DURATION_SECONDS = 120;
const EXTRACTION_INITIAL_PROGRESS = 5;
const EXTRACTION_PROGRESS_CAP = 95;

// Configuration
const STORAGE_URL = "https://app.schepen-kring.nl/storage/";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=600&q=80";
const YACHT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "for sale": "For Sale",
  "for bid": "For Bid",
  sold: "Sold",
  active: "Active",
  inactive: "Inactive",
  maintenance: "Maintenance",
};

function normalizeStatusForForm(status: unknown): string | null {
  if (status === null || status === undefined) return null;

  const rawValue = String(status).trim();
  if (!rawValue) return null;

  return YACHT_STATUS_LABELS[rawValue.toLowerCase()] ?? rawValue;
}

function normalizeStatusForApi(status: unknown): string | null {
  const normalizedFormValue = normalizeStatusForForm(status);
  if (!normalizedFormValue) return null;

  const matchingEntry = Object.entries(YACHT_STATUS_LABELS).find(
    ([, label]) => label === normalizedFormValue,
  );

  return matchingEntry?.[0] ?? normalizedFormValue.toLowerCase();
}

function normalizeStatusForNewYacht(
  status: unknown,
  isClientRole = false,
): string {
  const fallbackStatus = isClientRole ? "Draft" : "For Sale";
  const normalized = normalizeStatusForForm(status);
  if (!normalized) return fallbackStatus;

  return ["Draft", "For Sale", "For Bid"].includes(normalized)
    ? normalized
    : fallbackStatus;
}

function isVideoGeneratingStatus(status: unknown): boolean {
  return ["queued", "processing", "pending", "rendering"].includes(
    String(status || "").toLowerCase(),
  );
}

const suppressedToast = Object.assign(
  ((..._args: any[]) => "suppressed") as any,
  {
    success: ((..._args: any[]) => "suppressed") as any,
    error: ((..._args: any[]) => "suppressed") as any,
    loading: ((..._args: any[]) => "suppressed") as any,
    dismiss: ((..._args: any[]) => undefined) as any,
  },
) as typeof hotToast;

type AiStagedImage = {
  file: File;
  preview: string;
  category: string;
  originalName: string;
};
type GalleryState = { [key: string]: any[] };

type ImageGridDensity = "regular" | "compact" | "dense";
type ReviewPipelineImage = PipelineImage & { client_upload_key?: string };
type BoatDocumentType = "ai_reference" | "compliance";
type BoatDocumentItem = {
  id: number;
  file_path: string;
  file_url?: string | null;
  file_type?: string | null;
  document_type?: string | null;
  sort_order?: number | null;
  uploaded_at?: string | null;
};

type MarktplaatsListingState = {
  id?: number | null;
  channel_name: "marktplaats";
  is_enabled: boolean;
  auto_publish: boolean;
  status: string;
  external_id?: string | null;
  external_url?: string | null;
  last_sync_at?: string | null;
  last_error_message?: string | null;
  last_validation_errors_json?: string[] | null;
  settings_json: {
    marktplaats_promoted?: boolean;
    marktplaats_budget_type?: string;
    marktplaats_cpc_bid?: string | number | null;
    marktplaats_target_views?: string | number | null;
  };
  capabilities?: Record<string, any> | null;
};

type SellerPublicationOption = {
  slug: string;
  name: string;
  logo: string;
  price: number;
};

const DEFAULT_MARKTPLAATS_LISTING_STATE: MarktplaatsListingState = {
  channel_name: "marktplaats",
  is_enabled: false,
  auto_publish: false,
  status: "draft",
  external_id: null,
  external_url: null,
  last_sync_at: null,
  last_error_message: null,
  last_validation_errors_json: null,
  settings_json: {
    marktplaats_promoted: false,
    marktplaats_budget_type: "cpc",
    marktplaats_cpc_bid: "",
    marktplaats_target_views: "",
  },
  capabilities: null,
};

const SELLER_PUBLICATION_OPTIONS: SellerPublicationOption[] = [
  {
    slug: "marktplaats",
    name: "Marktplaats",
    logo: "/logos/marktplaats.svg",
    price: 149,
  },
  {
    slug: "botentekoop",
    name: "Botentekoop.nl",
    logo: "/logos/botentekoop.svg",
    price: 99,
  },
  {
    slug: "yachtfocus",
    name: "YachtFocus",
    logo: "/logos/yachtfocus.svg",
    price: 89,
  },
  {
    slug: "yachtworld",
    name: "YachtWorld",
    logo: "/logos/yachtworld.svg",
    price: 129,
  },
];

// Availability Rule Type
type AvailabilityRule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
};

function normalizeBoatDocumentType(value: string): BoatDocumentType {
  return value === "ai_reference" ? "ai_reference" : "compliance";
}

type SchedulingOption = {
  value: string;
  labels: {
    en: string;
    nl: string;
    de: string;
  };
};

const MIN_NOTICE_OPTIONS: SchedulingOption[] = [
  { value: "0", labels: { en: "Same day", nl: "Dezelfde dag", de: "Am selben Tag" } },
  { value: "1", labels: { en: "1 day before", nl: "1 dag van tevoren", de: "1 Tag vorher" } },
  { value: "2", labels: { en: "2 days before", nl: "2 dagen van tevoren", de: "2 Tage vorher" } },
  { value: "3", labels: { en: "3 days before", nl: "3 dagen van tevoren", de: "3 Tage vorher" } },
  { value: "7", labels: { en: "1 week before", nl: "1 week van tevoren", de: "1 Woche vorher" } },
];

const MAX_AHEAD_OPTIONS: SchedulingOption[] = [
  { value: "30", labels: { en: "30 days ahead", nl: "30 dagen vooruit", de: "30 Tage im Voraus" } },
  { value: "60", labels: { en: "60 days ahead", nl: "60 dagen vooruit", de: "60 Tage im Voraus" } },
  { value: "90", labels: { en: "90 days ahead", nl: "90 dagen vooruit", de: "90 Tage im Voraus" } },
  { value: "180", labels: { en: "180 days ahead", nl: "180 dagen vooruit", de: "180 Tage im Voraus" } },
  { value: "365", labels: { en: "1 year ahead", nl: "1 jaar vooruit", de: "1 Jahr im Voraus" } },
];

const APPOINTMENT_DURATION_OPTIONS: SchedulingOption[] = [
  { value: "15", labels: { en: "15 minutes", nl: "15 minuten", de: "15 Minuten" } },
  { value: "30", labels: { en: "30 minutes", nl: "30 minuten", de: "30 Minuten" } },
  { value: "45", labels: { en: "45 minutes", nl: "45 minuten", de: "45 Minuten" } },
  { value: "60", labels: { en: "1 hour", nl: "1 uur", de: "1 Stunde" } },
  { value: "90", labels: { en: "1.5 hours", nl: "1,5 uur", de: "1,5 Stunden" } },
  { value: "120", labels: { en: "2 hours", nl: "2 uur", de: "2 Stunden" } },
];

const MAX_APPOINTMENTS_OPTIONS: SchedulingOption[] = [
  { value: "1", labels: { en: "1 per day", nl: "1 per dag", de: "1 pro Tag" } },
  { value: "2", labels: { en: "2 per day", nl: "2 per dag", de: "2 pro Tag" } },
  { value: "3", labels: { en: "3 per day", nl: "3 per dag", de: "3 pro Tag" } },
  { value: "5", labels: { en: "5 per day", nl: "5 per dag", de: "5 pro Tag" } },
  { value: "10", labels: { en: "10 per day", nl: "10 per dag", de: "10 pro Tag" } },
  { value: "unlimited", labels: { en: "Unlimited", nl: "Onbeperkt", de: "Unbegrenzt" } },
];

const YES_NO_OPTIONS: SchedulingOption[] = [
  { value: "false", labels: { en: "No", nl: "Nee", de: "Nein" } },
  { value: "true", labels: { en: "Yes", nl: "Ja", de: "Ja" } },
];

const OPTIONAL_CUTOFF_OPTIONS: SchedulingOption[] = [
  { value: "none", labels: { en: "No cutoff", nl: "Geen limiet", de: "Kein Limit" } },
  { value: "1", labels: { en: "1 hour before", nl: "1 uur van tevoren", de: "1 Stunde vorher" } },
  { value: "2", labels: { en: "2 hours before", nl: "2 uur van tevoren", de: "2 Stunden vorher" } },
  { value: "4", labels: { en: "4 hours before", nl: "4 uur van tevoren", de: "4 Stunden vorher" } },
  { value: "8", labels: { en: "8 hours before", nl: "8 uur van tevoren", de: "8 Stunden vorher" } },
  { value: "12", labels: { en: "12 hours before", nl: "12 uur van tevoren", de: "12 Stunden vorher" } },
  { value: "24", labels: { en: "24 hours before", nl: "24 uur van tevoren", de: "24 Stunden vorher" } },
  { value: "48", labels: { en: "48 hours before", nl: "48 uur van tevoren", de: "48 Stunden vorher" } },
];

const SCHEDULING_PREVIEW_DAYS = 3;
const SCHEDULING_PREVIEW_SLOT_STEP_MINUTES = 15;
const SCHEDULING_PREVIEW_BUFFER_MINUTES = 15;

function normalizePipelineImageName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const AUTO_SORT_CATEGORY_ORDER: Record<string, number> = {
  Exterior: 0,
  Bridge: 1,
  Interior: 2,
  "Engine Room": 3,
  General: 4,
};

function inferAutoSortCategoryFromName(originalName: unknown): string {
  const normalized = normalizePipelineImageName(originalName);

  if (normalized.includes("engine")) {
    return "Engine Room";
  }

  if (
    normalized.includes("bridge") ||
    normalized.includes("helm") ||
    normalized.includes("cockpit")
  ) {
    return "Bridge";
  }

  if (
    normalized.includes("interior") ||
    normalized.includes("cabin") ||
    normalized.includes("salon") ||
    normalized.includes("galley") ||
    normalized.includes("kitchen") ||
    normalized.includes("bed")
  ) {
    return "Interior";
  }

  if (
    normalized.includes("exterior") ||
    normalized.includes("outside") ||
    normalized.includes("deck") ||
    normalized.includes("hull")
  ) {
    return "Exterior";
  }

  return "General";
}

// Available explicitly from FieldCorrectionControls import

type ConfidenceMeta = {
  overall_confidence: number;
  field_confidence: Record<string, number>;
  needs_user_confirmation: string[];
  enrichment_used?: boolean;
  stages_run: string[];
  warnings: string[];
  field_sources?: Record<string, string>;
  ai_session_id?: string | null;
  model_name?: string | null;
};

const OPTIONAL_TRI_STATE_FIELDS = [
  "life_jackets",
  "bimini",
  "anchor",
  "fishfinder",
  "bow_thruster",
  "trailer",
  "heating",
  "toilet",
  "fridge",
  "shower",
  "bath",
  "oven",
  "microwave",
  "freezer",
  "television",
  "ais",
  "radar",
  "autopilot",
  "life_raft",
  "epirb",
  "bilge_pump",
  "fire_extinguisher",
  "mob_system",
  "radar_reflector",
  "flares",
  "life_buoy",
  "watertight_door",
  "gas_bottle_locker",
  "self_draining_cockpit",
  "solar_panel",
  "wind_generator",
  "stern_anchor",
  "spud_pole",
  "cockpit_tent",
  "outdoor_cushions",
  "teak_deck",
  "swimming_platform",
  "swimming_ladder",
  "shorepower",
  "bowsprit",
  "main_sail",
  "furling_mainsail",
  "genoa",
  "jib",
  "spinnaker",
  "gennaker",
  "mizzen",
  "furling_mizzen",
  "winches",
  "electric_winches",
] as const;

const CORRECTION_BUTTONS: Array<{ value: CorrectionLabel; label: string }> = [
  { value: "wrong_image_detection", label: "Wrong image detection" },
  { value: "wrong_text_interpretation", label: "Wrong text interpretation" },
  { value: "guessed_too_much", label: "Guessed too much" },
  { value: "duplicate_data_issue", label: "Duplicate data issue" },
  { value: "import_mismatch", label: "Import mismatch" },
  { value: "other", label: "Other" },
];

declare global {
  interface Window {
    __flushYachtDraftNow?: () => Promise<void> | void;
  }
}

const DEFAULT_SCHEDULING_SETTINGS = {
  booking_min_notice_days: 1,
  booking_max_days_ahead: 365,
  booking_duration_minutes: 60,
  booking_max_appointments_per_day: 10,
  booking_requires_manual_approval: false,
  booking_send_confirmation_email: true,
  booking_allow_rescheduling: true,
  booking_reschedule_cutoff_hours: "none",
  booking_allow_cancellations: true,
  booking_cancellation_cutoff_hours: "none",
  booking_allow_instant: false,
} as const;

function getSchedulingOptionLabel(option: SchedulingOption, locale: string): string {
  if (locale === "nl") return option.labels.nl;
  if (locale === "de") return option.labels.de;
  return option.labels.en;
}

function normalizeSchedulingSelectValue(value: unknown, fallback: string | number): string {
  if (value === null || value === undefined) {
    return String(fallback);
  }

  const normalized = String(value).trim();
  return normalized === "" ? String(fallback) : normalized;
}

function normalizeSchedulingBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseAvailabilityMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return -1;
  }

  return hours * 60 + minutes;
}

function formatAvailabilityMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function createDefaultAvailabilityRules(
  locationDefaults: { opening_hours_start: string; opening_hours_end: string } | null,
): AvailabilityRule[] {
  const startTime = locationDefaults?.opening_hours_start || "09:00";
  const endTime = locationDefaults?.opening_hours_end || "17:00";

  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
    enabled: day !== 6 && day !== 0,
  }));
}

function normalizeAvailabilityRules(
  rawRules: any[],
  locationDefaults: { opening_hours_start: string; opening_hours_end: string } | null,
): AvailabilityRule[] {
  const defaults = createDefaultAvailabilityRules(locationDefaults);
  if (!Array.isArray(rawRules) || rawRules.length === 0) {
    return defaults;
  }

  return defaults.map((defaultRule) => {
    const matchingRule = rawRules.find((r: any) => {
      if (typeof r.day_of_week === "number") {
        return r.day_of_week === defaultRule.day_of_week;
      }
      if (Array.isArray(r.days_of_week)) {
        return r.days_of_week.includes(defaultRule.day_of_week);
      }
      return false;
    });

    if (matchingRule) {
      return {
        ...defaultRule,
        start_time: matchingRule.start_time?.substring(0, 5) || defaultRule.start_time,
        end_time: matchingRule.end_time?.substring(0, 5) || defaultRule.end_time,
        enabled: true,
      };
    }

    return { ...defaultRule, enabled: false };
  });
}

function buildSchedulingPreviewDays(
  availabilityRules: AvailabilityRule[],
  minNoticeDays: number,
  maxDaysAhead: number,
  durationMinutes: number,
): Array<{ date: Date; slots: string[]; totalSlots: number }> {
  if (durationMinutes <= 0 || maxDaysAhead < minNoticeDays) {
    return [];
  }

  const preview: Array<{ date: Date; slots: string[]; totalSlots: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (
    let dayOffset = minNoticeDays;
    dayOffset <= maxDaysAhead && preview.length < SCHEDULING_PREVIEW_DAYS;
    dayOffset += 1
  ) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);

    const rule = availabilityRules.find(
      (entry) => entry.enabled && entry.day_of_week === date.getDay(),
    );
    if (!rule) {
      continue;
    }

    const startMinutes = parseAvailabilityMinutes(rule.start_time);
    const endMinutes = parseAvailabilityMinutes(rule.end_time);
    if (startMinutes < 0 || endMinutes <= startMinutes) {
      continue;
    }

    const slots: string[] = [];
    for (
      let cursor = startMinutes;
      cursor + durationMinutes + SCHEDULING_PREVIEW_BUFFER_MINUTES <= endMinutes;
      cursor += SCHEDULING_PREVIEW_SLOT_STEP_MINUTES
    ) {
      slots.push(formatAvailabilityMinutes(cursor));
    }

    if (slots.length === 0) {
      continue;
    }

    preview.push({
      date,
      slots: slots.slice(0, 4),
      totalSlots: slots.length,
    });
  }

  return preview;
}

function isPlaceholderFieldText(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "" ||
    [
      "unknown",
      "[object object]",
      "object object",
      "n/a",
      "na",
      "null",
      "undefined",
      "onbekend",
      "unbekannt",
      "inconnu",
    ].includes(normalized)
  );
}

function sanitizeScalarFieldValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = sanitizeScalarFieldValue(item);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  if (typeof value === "object") {
    const record = toObjectRecord(value);

    for (const key of [
      "value",
      "normalized_value",
      "answer",
      "result",
      "text",
      "name",
      "label",
    ]) {
      if (!(key in record)) {
        continue;
      }

      const normalized = sanitizeScalarFieldValue(record[key]);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  const text = String(value).trim();
  return isPlaceholderFieldText(text) ? null : text;
}

function normalizeDomFieldValue(
  value: unknown,
): string | number | readonly string[] | undefined {
  const sanitized = sanitizeScalarFieldValue(value);

  if (sanitized === null) {
    return undefined;
  }

  if (typeof sanitized === "boolean") {
    return sanitized ? "true" : "false";
  }

  return sanitized;
}

function normalizeBoatDocumentResponse(value: unknown): BoatDocumentItem[] {
  if (Array.isArray(value)) {
    return value as BoatDocumentItem[];
  }

  const payload = toObjectRecord(value);
  const documents = payload.documents;
  if (Array.isArray(documents)) {
    return documents as BoatDocumentItem[];
  }

  const document = payload.document;
  if (document && typeof document === "object") {
    return [document as BoatDocumentItem];
  }

  return [];
}

function hasObjectValues(value: unknown): boolean {
  return Object.keys(toObjectRecord(value)).length > 0;
}

function normalizeBoatFormBlockKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findBoatFormConfigBlock(
  blocks: BoatFormConfigBlock[],
  aliases: readonly string[],
): BoatFormConfigBlock | null {
  const normalizedAliases = aliases.map(normalizeBoatFormBlockKey);

  return (
    blocks.find((block) =>
      normalizedAliases.includes(normalizeBoatFormBlockKey(block.block_key)),
    ) ?? null
  );
}

function hasRenderableBoatFormBlock(
  block: BoatFormConfigBlock | null | undefined,
): block is BoatFormConfigBlock {
  return Boolean(
    block &&
    (block.primary_fields.length > 0 || block.secondary_fields.length > 0),
  );
}

function getConfigBlockExpansionKey(
  block: BoatFormConfigBlock,
  values: Record<string, unknown> | null | undefined,
  optionalTriStateFields: readonly string[],
): string {
  const hasFilledSecondaryField = block.secondary_fields.some((field) =>
    hasFilledFieldValue(values?.[field.internal_key], {
      treatUnknownAsEmpty:
        field.field_type === "tri_state" ||
        optionalTriStateFields.includes(field.internal_key),
    }),
  );

  return `${block.block_key}-${hasFilledSecondaryField ? "filled" : "empty"}`;
}

function clampWizardStep(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(6, Math.max(1, Math.trunc(parsed)));
}

const YACHT_FORM_TEXT = {
  en: {
    common: { yes: "Yes", no: "No", unknown: "Unknown", confirm: "confirm" },
    sections: {
      electricalSystem: "Electrical System",
      kitchenComfort: "Kitchen & Comfort",
    },
    labels: {
      airConditioning: "Air Conditioning",
      flybridge: "Flybridge",
      cockpitType: "Cockpit Type",
      waterTank: "Water Tank",
      waterTankGauge: "Water Tank Gauge",
      waterMaker: "Water Maker",
      wasteWaterTank: "Waste Water Tank",
      wasteWaterGauge: "Waste Water Gauge",
      wasteTankDrainPump: "Waste Tank Drain Pump",
      deckSuction: "Deck Suction",
      waterSystem: "Water System",
      hotWater: "Hot Water",
      seaWaterPump: "Sea Water Pump",
      deckWashPump: "Deck Wash Pump",
      deckShower: "Deck Shower",
      battery: "Batteries",
      batteryCharger: "Battery Charger",
      generator: "Generator",
      inverter: "Inverter",
      shorepower: "Shorepower",
      solarPanel: "Solar Panel",
      windGenerator: "Wind Generator",
      voltage: "Voltage",
      dynamo: "Dynamo",
      accumonitor: "Accumonitor",
      voltmeter: "Voltmeter",
      shorePowerCable: "Shore Power Cable",
      consumptionMonitor: "Consumption Monitor",
      controlPanel: "Control Panel",
      fuelTankGauge: "Fuel Tank Gauge",
      tachometer: "Tachometer",
      oilPressureGauge: "Oil Pressure Gauge",
      temperatureGauge: "Temperature Gauge",
      oven: "Oven",
      microwave: "Microwave",
      fridge: "Fridge",
      freezer: "Freezer",
      cooker: "Cooker",
      television: "Television",
      cdPlayer: "Radio / CD Player",
      dvdPlayer: "DVD Player",
      satelliteReception: "Satellite Reception",
      hotAir: "Hot Air Heating",
      stove: "Stove Heating",
      centralHeating: "Central Heating",
      essentialRegistryData: "Essential Registry Data",
      technicalDossier: "Technical Dossier",
      hullDimensions: "Hull & Dimensions",
      enginePerformance: "Engine & Performance",
      accommodationFacilities: "Accommodation & Facilities",
      navigationElectronics: "Navigation & Electronics",
      safetyEquipment: "Safety Equipment",
      deckEquipment: "Deck Equipment",
      riggingSails: "Rigging & Sails",
      registryComments: "Registry & Comments",
      schedulingAuthority: "Scheduling Authority",
      vesselDescription: "Vessel Description",
      daysOfWeek: "Days of Week",
      startTime: "Start Time",
      endTime: "End Time",
      reviewSummary:
        "Review all steps before submitting. Completed steps are marked with a blue checkmark in the tab bar above.",
      vesselName: "Vessel Name *",
      manufacturer: "Manufacturer / Make",
      model: "Model",
      ballast: "Ballast",
      designer: "Designer",
      builder: "Builder",
      controlType: "Control Type",
      newTitle: "Register New Vessel",
      editTitle: "Edit Vessel",
      loadingName: "Loading...",
      stepImages: "Images",
      stepSpecs: "Specifications",
      stepText: "Description",
      stepDisplay: "Display",
      stepReview: "Review",
      stepContract: "Contract",
      stepBrokerReview: "Broker Check",
      stepOneTitle: "Vessel Assets & AI Extraction",
      stepOneDescription:
        "Upload images -> system auto-optimizes -> approve -> then AI fills all form fields.",
      imagesApproved: "Images Approved",
      vesselDescriptionHelp: "Vessel Description",
      optionalRecommended: "(optional but recommended)",
      createVessel: "Create Vessel",
      updateVessel: "Update Vessel",
      previous: "Previous",
      next: "Next",
      approveImagesFirst: "Approve Images First",
      completed: "Completed",
      pending: "Pending",
      continueToContract: "Save and Continue to Contract",
      submitForBrokerReview: "Submit for Broker Review",
      finishFlow: "Finish",
      finishFlowToast: "Vessel flow completed.",
      contractStepDescription:
        "Manage the contract template, print the PDF, and generate the Signhost-ready contract from this step.",
      reviewContractNotice:
        "Save this vessel first. The contract flow opens in the next step after the vessel record is stored.",
      clientReviewStepDescription:
        "This vessel has been submitted for review. A broker will contact you and send the Signhost contract by email once everything is ready.",
      clientReviewStatusTitle: "Submitted for Review",
      clientReviewStatusDescription:
        "This vessel has been submitted for review. A broker will contact you and send the Signhost contract by email once everything is ready.",
      clientReviewProgressTitle: "Submission progress",
      clientReviewBoatStatusLabel: "Broker review",
      clientReviewContractStatusLabel: "Contract signing",
      clientReviewBoatPending: "Pending broker review",
      clientReviewBoatApproved: "Approved by broker",
      clientReviewContractWaiting: "Waiting for Signhost invite",
      clientReviewContractSent: "Signhost invite sent",
      clientReviewContractSigned: "Contract signed",
      clientReviewContractFailed: "Signing needs attention",
      clientReviewContractWaitingDescription:
        "Your broker approved this vessel. The Signhost invitation will appear here as soon as it is sent.",
      clientReviewContractSentDescription:
        "Your broker sent the Signhost request. Open the contract to review and sign it.",
      clientReviewContractSignedDescription:
        "The Signhost contract has been signed successfully.",
      clientReviewContractFailedDescription:
        "The latest Signhost request expired, failed, or was declined. Open the contract page to continue.",
      clientReviewOpenContract: "Open contract",
      clientReviewSignNow: "Sign now",
      internalReviewTitle: "Broker review actions",
      internalReviewDescription:
        "Review this client vessel here. Keeping it as draft means it stays under review. Approving it moves the vessel into the live sales flow and lets you continue with Signhost.",
      internalReviewStatusLabel: "Current review state",
      internalReviewPending: "Pending broker review",
      internalReviewApproved: "Approved for sales flow",
      markPendingReview: "Keep in review",
      approveVessel: "Approve vessel",
      vesselMarkedPendingReview: "Vessel kept in broker review.",
      vesselApprovedSuccess:
        "Vessel approved. You can continue with Signhost now.",
      vesselReviewActionFailed: "Could not update vessel review status.",
      pendingBrokerReview: "Pending broker review",
      saveVesselFirst: "Save Vessel First",
      stepSticker: "Boat Sticker & QR",
      stickerStepDescription:
        "Generate and download the high-resolution QR code sticker for this vessel. This sticker can be printed and placed on the boat for easy access to the listing.",
      vesselQrCodeAlt: "Vessel QR Code",
      noQrGeneratedYet: "No QR code generated yet",
      refreshSticker: "Refresh Sticker",
      generateSticker: "Generate Sticker",
      previewSticker: "Preview Sticker",
      downloadStickerPdf: "Download PDF Sticker",
      imageCountLabel: "Images",
      processingBadge: "processing",
      readyForReviewBadge: "ready for review",
      approvedBadge: "approved",
      savingOrder: "Saving order...",
      aiAutoSort: "AI auto-sort",
      manualSortImages: "Manual sort",
      manualSortDescription:
        "Drag images to control the order they appear in the gallery.",
      saveImageOrder: "Save order",
      manualSortSaved: "Image order saved.",
      manualSortFailed: "Failed to save image order.",
      sortPosition: "Position",
      addMoreImages: "Add More",
      deleteAllImages: "Delete all images",
      clickToAddImages: "Click to add up to {count} images",
      uploadingImages: "Uploading images...",
      uploadAreaPendingHelp:
        "This area stays visible until the current upload finishes.",
      uploadAreaFormatsHelp: "JPEG, PNG, HEIC auto-optimized by AI",
      uploadAreaHint:
        "Include HIN plates, dashboards, engine hours, and key boat details",
      processingStatusLabel: "Processing...",
      readyForReviewStatusLabel: "Ready for Review",
      approvedStatusLabel: "Approved",
      failedStatusLabel: "Failed",
      dragToReorder: "Drag to reorder",
      aiReviewScore: "AI review score",
      keepOriginal: "Keep original",
      aiComments: "AI comments",
      approveImage: "Approve",
      generalCategory: "General",
      acceptableQuality: "Acceptable",
      offlineQuality: "Offline",
      galleryReadinessHint: "Measures gallery readiness after AI cleanup.",
      galleryReady: "Gallery ready",
      needsReview: "Needs review",
      needsCorrection: "Needs correction",
      scoreSuitabilityHelp:
        "This score reflects how suitable the image is for the public gallery after AI cleanup and classification.",
      extractionInProgress: "AI Extraction in Progress",
      extractionAnalyzingPhotos:
        "AI is analyzing your yacht photos and preparing fields.",
      extractionSearchingKnowledge:
        "RAG Engine is searching Pinecone to find consensus and auto-filling details...",
      percentComplete: "{percent}% Complete",
      secondsRemaining: "Approx. {seconds}s remaining",
      dataConflictDetected: "Data Conflict Detected",
      vesselDescriptionPlaceholder:
        'Brand/Model/Year + short notes (e.g. "Beneteau Oceanis 38, 2016, diesel, 3 cabins, VAT paid, CE docs available")',
      vesselDescriptionAccuracyHint:
        "Adding brand/model/year dramatically improves AI accuracy.",
      shower: "Shower",
      bath: "Bath",
      saloon: "Saloon",
      headroom: "Headroom",
      engineRoom: "Engine Room",
      spacesInside: "Spaces Inside",
      matrasses: "Matrasses",
      cushions: "Cushions",
      curtains: "Curtains",
      heating: "Heating",
      compass: "Compass",
      depthInstrument: "Depth Instrument",
      windInstrument: "Wind Instrument",
      navigationLights: "Navigation Lights",
      autopilot: "Autopilot",
      gps: "GPS",
      vhf: "VHF / Marifoon",
      plotter: "Chart Plotter",
      speedInstrument: "Log / Speed",
      radar: "Radar",
      fishfinder: "Fishfinder",
      ais: "AIS",
      logSpeed: "Log / Speed",
      rudderPositionIndicator: "Rudder Position Indicator",
      turnIndicator: "Turn Indicator",
      ssbReceiver: "SSB Receiver",
      shortwaveRadio: "Shortwave Radio",
      shortBandTransmitter: "Short Band Transmitter",
      satelliteCommunication: "Satellite Communication",
      weatherfaxNavtex: "Weatherfax / Navtex",
      chartsGuides: "Charts / Guides",
      lifeRaft: "Life Raft",
      epirb: "EPIRB",
      bilgePump: "Bilge Pump",
      bilgePumpManual: "Bilge Pump (Manual)",
      bilgePumpElectric: "Bilge Pump (Electric)",
      fireExtinguisher: "Fire Extinguisher",
      mobSystem: "MOB System",
      lifeJackets: "Life Jackets",
      radarReflector: "Radar Reflector",
      flares: "Flares",
      lifeBuoy: "Life Buoy",
      watertightDoor: "Watertight Door",
      gasBottleLocker: "Gas Bottle Locker",
      selfDrainingCockpit: "Self Draining Cockpit",
      sailplanType: "Sailplan Type",
      numberOfMasts: "Number of Masts",
      sparsMaterial: "Spars Material",
      bowsprit: "Bowsprit",
      standingRig: "Standing Rig",
      mainSail: "Main Sail",
      furlingMainsail: "Furling Mainsail",
      jib: "Jib",
      genoa: "Genoa",
      spinnaker: "Spinnaker",
      gennaker: "Gennaker",
      mizzen: "Mizzen",
      winches: "Winches",
      electricWinches: "Electric Winches",
      manualWinches: "Manual Winches",
      anchor: "Anchor",
      bowThruster: "Bow Thruster",
      anchorWinch: "Anchor Winch",
      sprayHood: "Spray Hood",
      bimini: "Bimini",
      swimmingPlatform: "Swimming Platform",
      swimmingLadder: "Swimming Ladder",
      teakDeck: "Teak Deck",
      cockpitTable: "Cockpit Table",
      dinghy: "Dinghy",
      trailer: "Trailer",
      covers: "Covers",
      fenders: "Fenders & Lines",
      fendersLines: "Fenders & Lines",
      anchorConnection: "Anchor Connection",
      sternAnchor: "Stern Anchor",
      spudPole: "Spud Pole",
      cockpitTent: "Cockpit Tent",
      outdoorCushions: "Outdoor Cushions",
      seaRails: "Sea Rails",
      pushpitPullpit: "Pushpit / Pullpit",
      sailLoweringSystem: "Sail Lowering System",
      crutch: "Crutch (Schaar)",
      dinghyBrand: "Dinghy Brand",
      outboardEngine: "Outboard Engine",
      crane: "Crane",
      davits: "Davits",
      imageDetectedDark:
        "Source image was detected as dark before enhancement.",
      imageStrongHighlights:
        "Source image had strong highlights before enhancement.",
      imageSoftRecovery:
        "Source image was soft, so clarity recovery was attempted.",
      imageLowRes:
        "Source image resolution was low, so upscale logic was considered.",
      imageRotationCorrected:
        "Image orientation was corrected by {degrees} degrees.",
      imageGalleryReadyNoCorrections:
        "AI marked this image as gallery-ready without major corrections.",
      aiReadyAnalyzeApprovedImages:
        "Automatically check and enrich the details",
      uploadApproveImagesFirstAi:
        "Upload and approve images first, then AI will analyze them",
      runAiExtractionManually: "Execute",
      noSchedulingRules: "No scheduling rules defined yet.",
      vesselVideoOperations: "Vessel Video Operations",
      manageVideosSocialPosting: "Manage Videos & Social Posting",
      generateFromImages: "Generate from images",
      uploadMp4: "Upload MP4",
      automatedSocialVideo: "Automated Social Video",
      queueMarketingVideo:
        "Queue a marketing video built from the approved boat images. The backend will render it and it will appear in the social video library with status updates.",
      openSocialLibrary: "Open Social Library",
      forceRegenerate: "Force Regenerate",
      generatedMarketingVideos: "Generated marketing videos",
      refresh: "Refresh",
      marketingVideo: "Marketing Video",
      templateLabel: "Template",
      videoUrlLabel: "Video URL",
      readyState: "ready",
      waitingState: "waiting",
      addSchedulingWindow: "Add Scheduling Window",
      locationSelectPlaceholder: "Select location...",
      locationAssignedAutomatically:
        "Location is assigned automatically from your account.",
      locationRequiredForNextStep:
        "Select a sales location before continuing to the next step.",
      noSpecificDocumentsRequired:
        "No specific documents required for this type.",
      referenceDocumentsTitle: "Invoice, leaflet & spec files",
      referenceDocumentsDescription:
        "Upload invoices, brochures, leaflets, or spec sheets here. These files stay separate from the image gallery and are used by AI to help fill Step 2.",
      uploadReferenceDocuments: "Upload reference documents",
      clickOrDropReferenceDocument:
        "Click or drag an invoice, leaflet, or brochure",
      uploadedReferenceDocuments: "Reference documents ({count})",
      referenceDocumentsHint:
        "PDF, DOC, DOCX, JPG, PNG. Stored separately from gallery images.",
      referenceDocumentsEmpty: "No reference documents uploaded yet.",
      complianceDocumentsTitle: "Compliance & delivery documents",
      complianceDocumentsDescription:
        "Upload contract, delivery, or compliance documents here. These stay separate from the AI reference files in Step 1.",
      referenceDocumentsMovedNotice:
        "Invoices and leaflets for AI extraction now belong in Step 1 under the image section.",
      noComplianceDocumentsUploaded: "No compliance documents uploaded yet.",
      uploadDocuments: "Upload Documents",
      documentUploading: "Uploading...",
      clickOrDropDocument: "Click or drag a document",
      uploadedDocuments: "Already uploaded ({count})",
      deleteAllImagesTitle: "Delete all images",
      deleteAllImagesDescription:
        "Are you sure you want to remove all uploaded images from this yacht? This action cannot be undone.",
      deletingAllImages: "Deleting...",
      deleteAllAction: "Delete all",
      failedImagesNavTitle: "Remove failed images",
      failedImagesNavDescription:
        "First delete the images with the red borders to proceed to the next step.",
      deleting: "Deleting...",
      deleteFailedImages: "Delete failed images",
      vesselIdentification: "Vessel Identification",
      brand: "Brand",
      year: "Year",
      cancel: "Cancel",
      aiExtractionNotAvailableOffline: "AI Extraction Not Available Offline",
      offlineManualHint:
        "You can skip this step and fill in the boat details manually. Images are saved locally.",
      skipToStep2Manual: "Skip to Step 2 (Manual Fill)",
      geminiAnalyzingImages: "Gemini is analyzing your images...",
      aiExtractionNeedsInternet:
        "AI extraction requires an internet connection. You can skip to Step 2 to fill in details manually.",
      uploadOneImageFirst: "Please upload at least one image first.",
      uploadOneImageFirstOffline:
        "Please upload at least one image first (saved locally).",
      aiExtractionStartedBackground:
        "🤖 AI extraction started in background...",
      aiPipelineAnalyzingImages: "🤖 AI Pipeline is analyzing your images...",
      connectingGeminiVisionApi: "Connecting to Gemini Vision API...",
      analyzingVesselImagesGemini:
        "Analyzing vessel images with Gemini Vision...",
      searchingCatalogMatchingModels:
        "Searching catalog for matching models...",
      crossReferencingTechnicalSpecs:
        "Cross-referencing technical specifications...",
      finalizingDataValidatingResults:
        "Finalizing data and validating results...",
      aiGalleryReview: "AI Gallery Review",
      reviewDetails: "Review Details",
      imageReviewTitle: "Image review",
      imageReviewDescription:
        "Review the full image, the AI quality score, and the applied corrections before approving it for the final gallery.",
      closeImageReview: "Close image review",
      aiEnhanced: "AI Enhanced",
      imagesApprovedUnlocked: "✅ Images approved - Step 2 is unlocked!",
      imagesApprovedExtractionRunning:
        "🤖 Images approved. AI extraction is still running...",
      approvedMinimumImages:
        "⏳ {approved} of {minimum} minimum images approved",
      editManifestUnlocked:
        "ℹ️ Edit Manifest mode - Step 2 is unlocked with existing boat details.",
      stepTwoUnlockHint:
        "Step 2 opens after image approval. AI extraction starts when you click Approve All.",
      stillProcessingCount: "{count} still processing...",
      approveAllImages: "Approve All",
      aiTimedOutStepTwo:
        "AI extraction timed out. Step 2 is unlocked; you can continue manually and retry AI later.",
      imagesApprovedManualAi:
        "Images approved. You can manually run AI autofill if needed.",
      imagesApprovedShort: "Images approved.",
      fourImagesPerRow: "4 images per row",
      sixImagesPerRow: "6 images per row",
      eightImagesPerRow: "8 images per row",
      salesLocation: "Sales Location *",
      price: "Price (€)",
      minBidAmount: "Minimum Bid Amount (€)",
      yearBuilt: "Year Built",
      boatType: "Boat Type",
      boatCategory: "Boat Category",
      newOrUsed: "New or Used",
      loa: "LOA (Length Overall)",
      lwl: "LWL (Waterline Length)",
      shipyard: "Shipyard / Werf",
      ceCategory: "CE Category",
      status: "Status",
      passengerCapacity: "Passenger Capacity",
      beam: "Beam (Width)",
      draft: "Draft (Depth)",
      airDraft: "Air Draft (Clearance)",
      hullType: "Hull Type",
      hullConstruction: "Hull Construction",
      hullColour: "Hull Colour",
      hullNumber: "Hull Number",
      deckColour: "Deck Colour",
      deckConstruction: "Deck Construction",
      superStructureColour: "Superstructure Colour",
      superStructureConstruction: "Superstructure Construction",
      engineManufacturer: "Engine Manufacturer",
      engineModel: "Engine Model",
      engineType: "Engine Type",
      horsePower: "Horse Power",
      engineHours: "Engine Hours",
      fuelType: "Fuel Type",
      engineQuantity: "Engine Quantity",
      engineYear: "Engine Year",
      maxSpeed: "Max Speed",
      cruisingSpeed: "Cruising Speed",
      driveType: "Drive Type",
      gallonsPerHour: "Gallons per Hour",
      cabins: "Cabins",
      berthsFixed: "Berths (Fixed)",
      berthsExtra: "Berths (Extra)",
      berthsCrew: "Berths (Crew)",
      interiorType: "Interior Type",
      separateDiningArea: "Separate Dining Area",
      upholsteryColor: "Upholstery Color",
      cookingFuel: "Cooking Fuel",
      ownerComment: "Owner's Comment",
      knownDefects: "Known Defects",
      registrationDetails: "Registration Details",
      lastServiced: "Last Serviced",
      displacement: "Displacement",
      propulsion: "Propulsion",
      tankage: "Tankage",
      berths: "Berths",
      toilet: "Toilet",
      fillSpecsFirst: "Please fill in some specifications first so AI can write a description.",
      descriptionGeneratedSuccess: "Description generated successfully.",
      descriptionGenerationFailed: "Failed to generate description.",
    },
    placeholders: {
      battery: "e.g. 4x 12V 125Ah AGM",
      batteryCharger: "e.g. Victron Blue Smart 30A",
      generator: "e.g. Onan 9kW",
      inverter: "e.g. Victron Phoenix 3000W",
      shorepower: "e.g. 230V 16A",
      solarPanel: "e.g. 2x 100W flexible",
      windGenerator: "e.g. Silentwind 400+",
      voltage: "e.g. 12V / 230V",
      cockpitType: "Aft cockpit",
      waterTank: "200L",
      waterTankGauge: "Yes",
      waterMaker: "60 L/h",
      wasteWaterTank: "80L",
      wasteWaterGauge: "Yes",
      wasteTankDrainPump: "Electric",
      deckSuction: "Yes",
      waterSystem: "Pressurized",
      hotWater: "Boiler",
      seaWaterPump: "Yes",
      television: 'e.g. Samsung 32" Smart TV',
      cdPlayer: "e.g. Fusion MS-RA770",
      dvdPlayer: "e.g. Sony DVP-SR210P",
      satelliteReception: "e.g. KVH TracVision TV5",
      hotAir: "Yes",
      stove: "Yes",
      centralHeating: "Yes",
    },
  },
  nl: {
    common: {
      yes: "Ja",
      no: "Nee",
      unknown: "Onbekend",
      confirm: "controleren",
    },
    sections: {
      electricalSystem: "Elektrisch systeem",
      kitchenComfort: "Keuken & comfort",
      hullDimensions: "Romp & afmetingen",
      enginePerformance: "Motor & prestaties",
      accommodationFacilities: "Accommodatie & faciliteiten",
      navigationElectronics: "Navigatie & elektronica",
      safetyEquipment: "Veiligheidsuitrusting",
      deckEquipment: "Dekuitrusting",
      riggingSails: "Tuigage & zeilen",
      registryComments: "Registratie & opmerkingen",
    },
    labels: {
      airConditioning: "Airconditioning",
      flybridge: "Flybridge",
      cockpitType: "Cockpit-type",
      waterTank: "Watertank",
      waterTankGauge: "Watertankmeter",
      waterMaker: "Watermaker",
      wasteWaterTank: "Vuilwatertank",
      wasteWaterGauge: "Vuilwatermeter",
      wasteTankDrainPump: "Vuilwatertank afvoerpomp",
      deckSuction: "Dekafzuiging",
      waterSystem: "Watersysteem",
      hotWater: "Warm water",
      seaWaterPump: "Zeewaterpomp",
      deckWashPump: "Dekwaspomp",
      deckShower: "Dekdouche",
      battery: "Batterijen",
      batteryCharger: "Batterijlader",
      generator: "Generator",
      inverter: "Omvormer",
      shorepower: "Walstroom",
      solarPanel: "Zonnepaneel",
      windGenerator: "Windgenerator",
      voltage: "Spanning",
      dynamo: "Dynamo",
      accumonitor: "Accumonitor",
      voltmeter: "Voltmeter",
      shorePowerCable: "Walstroomkabel",
      consumptionMonitor: "Verbruiksmonitor",
      controlPanel: "Bedieningspaneel",
      fuelTankGauge: "Brandstoftankmeter",
      tachometer: "Toerenteller",
      oilPressureGauge: "Oliedrukmeter",
      temperatureGauge: "Temperatuurmeter",
      oven: "Oven",
      microwave: "Magnetron",
      fridge: "Koelkast",
      freezer: "Vriezer",
      cooker: "Kooktoestel",
      television: "Televisie",
      cdPlayer: "Radio / CD-speler",
      dvdPlayer: "DVD-speler",
      satelliteReception: "Satellietontvangst",
      hotAir: "Heteluchtverwarming",
      stove: "Kachelverwarming",
      centralHeating: "Centrale verwarming",
      essentialRegistryData: "Essentiele registratiedata",
      technicalDossier: "Technisch dossier",
      hullDimensions: "Romp & afmetingen",
      enginePerformance: "Motor & prestaties",
      accommodationFacilities: "Accommodatie & faciliteiten",
      navigationElectronics: "Navigatie & elektronica",
      safetyEquipment: "Veiligheidsuitrusting",
      deckEquipment: "Dekuitrusting",
      riggingSails: "Tuigage & zeilen",
      registryComments: "Registratie & opmerkingen",
      schedulingAuthority: "Planning",
      vesselDescription: "Vaartuigbeschrijving",
      daysOfWeek: "Dagen van de week",
      startTime: "Starttijd",
      endTime: "Eindtijd",
      reviewSummary:
        "Controleer alle stappen voordat je indient. Voltooide stappen krijgen bovenaan een blauw vinkje.",
      vesselName: "Vaartuignaam *",
      manufacturer: "Merk / fabrikant",
      model: "Model",
      ballast: "Ballast",
      designer: "Ontwerper",
      builder: "Bouwer",
      controlType: "Besturingstype",
      newTitle: "Nieuw vaartuig registreren",
      editTitle: "Vaartuig bewerken",
      loadingName: "Laden...",
      stepImages: "Afbeeldingen",
      stepSpecs: "Specificaties",
      stepText: "Beschrijving",
      stepDisplay: "Weergave",
      stepReview: "Controle",
      stepContract: "Contract",
      stepBrokerReview: "Broker check",
      stepOneTitle: "Vaartuigmedia & AI-extractie",
      stepOneDescription:
        "Upload afbeeldingen -> systeem optimaliseert automatisch -> keur goed -> daarna vult AI alle velden in.",
      imagesApproved: "Afbeeldingen goedgekeurd",
      vesselDescriptionHelp: "Vaartuigbeschrijving",
      optionalRecommended: "(optioneel maar aanbevolen)",
      createVessel: "Vaartuig aanmaken",
      updateVessel: "Vaartuig bijwerken",
      previous: "Vorige",
      next: "Volgende",
      approveImagesFirst: "Keur eerst afbeeldingen goed",
      completed: "Voltooid",
      pending: "Open",
      continueToContract: "Opslaan en naar contract",
      submitForBrokerReview: "Indienen voor broker check",
      finishFlow: "Afronden",
      finishFlowToast: "Vaartuigflow voltooid.",
      contractStepDescription:
        "Beheer het contractsjabloon, druk de PDF af en genereer vanuit deze stap het Signhost-klare contract.",
      reviewContractNotice:
        "Sla dit vaartuig eerst op. De contractflow opent in de volgende stap zodra het vaartuigrecord is opgeslagen.",
      clientReviewStepDescription:
        "Dit vaartuig is ingediend voor controle. Een broker neemt contact op en stuurt het Signhost-contract per e-mail zodra alles klaar is.",
      clientReviewStatusTitle: "Ingediend voor controle",
      clientReviewStatusDescription:
        "Dit vaartuig is ingediend voor controle. Een broker neemt contact op en stuurt het Signhost-contract per e-mail zodra alles klaar is.",
      clientReviewProgressTitle: "Indieningsstatus",
      clientReviewBoatStatusLabel: "Brokercontrole",
      clientReviewContractStatusLabel: "Contractondertekening",
      clientReviewBoatPending: "Wacht op brokercontrole",
      clientReviewBoatApproved: "Goedgekeurd door broker",
      clientReviewContractWaiting: "Wacht op Signhost-uitnodiging",
      clientReviewContractSent: "Signhost-uitnodiging verzonden",
      clientReviewContractSigned: "Contract ondertekend",
      clientReviewContractFailed: "Ondertekening vraagt aandacht",
      clientReviewContractWaitingDescription:
        "Je broker heeft dit vaartuig goedgekeurd. De Signhost-uitnodiging verschijnt hier zodra die is verzonden.",
      clientReviewContractSentDescription:
        "Je broker heeft het Signhost-verzoek verzonden. Open het contract om het te bekijken en te ondertekenen.",
      clientReviewContractSignedDescription:
        "Het Signhost-contract is succesvol ondertekend.",
      clientReviewContractFailedDescription:
        "Het laatste Signhost-verzoek is verlopen, mislukt of geweigerd. Open de contractpagina om verder te gaan.",
      clientReviewOpenContract: "Contract openen",
      clientReviewSignNow: "Nu ondertekenen",
      internalReviewTitle: "Broker review-acties",
      internalReviewDescription:
        "Beoordeel dit klantvaartuig hier. Als het concept blijft, blijft het in review. Bij goedkeuring gaat het vaartuig door naar de verkoopflow en kun je verder met Signhost.",
      internalReviewStatusLabel: "Huidige reviewstatus",
      internalReviewPending: "Wacht op brokercontrole",
      internalReviewApproved: "Goedgekeurd voor verkoopflow",
      markPendingReview: "In review houden",
      approveVessel: "Vaartuig goedkeuren",
      vesselMarkedPendingReview: "Vaartuig blijft in brokerreview.",
      vesselApprovedSuccess:
        "Vaartuig goedgekeurd. Je kunt nu verder met Signhost.",
      vesselReviewActionFailed:
        "De reviewstatus van het vaartuig kon niet worden bijgewerkt.",
      pendingBrokerReview: "Wacht op brokercontrole",
      saveVesselFirst: "Sla eerst het vaartuig op",
      stepSticker: "Bootsticker & QR",
      stickerStepDescription:
        "Genereer en download de QR-code sticker in hoge resolutie voor dit vaartuig. Deze sticker kan worden geprint en op de boot geplaatst voor eenvoudige toegang tot de advertentie.",
      vesselQrCodeAlt: "Vaartuig QR-code",
      noQrGeneratedYet: "Nog geen QR-code gegenereerd",
      refreshSticker: "Sticker vernieuwen",
      generateSticker: "Sticker genereren",
      previewSticker: "Preview bekijken",
      downloadStickerPdf: "Download PDF sticker",
      imageCountLabel: "Afbeeldingen",
      processingBadge: "in verwerking",
      readyForReviewBadge: "klaar voor controle",
      approvedBadge: "goedgekeurd",
      savingOrder: "Volgorde opslaan...",
      aiAutoSort: "AI automatisch sorteren",
      manualSortImages: "Handmatig sorteren",
      manualSortDescription:
        "Sleep afbeeldingen om de volgorde in de galerij te bepalen.",
      saveImageOrder: "Volgorde opslaan",
      manualSortSaved: "Afbeeldingsvolgorde opgeslagen.",
      manualSortFailed: "Opslaan van de afbeeldingsvolgorde is mislukt.",
      sortPosition: "Positie",
      addMoreImages: "Meer toevoegen",
      deleteAllImages: "Alle afbeeldingen verwijderen",
      clickToAddImages: "Klik om maximaal {count} afbeeldingen toe te voegen",
      uploadingImages: "Afbeeldingen uploaden...",
      uploadAreaPendingHelp:
        "Dit vlak blijft zichtbaar totdat de huidige upload klaar is.",
      uploadAreaFormatsHelp:
        "JPEG, PNG, HEIC worden automatisch door AI geoptimaliseerd",
      uploadAreaHint:
        "Voeg HIN-plaatjes, dashboards, motoruren en belangrijke bootdetails toe",
      processingStatusLabel: "Verwerken...",
      readyForReviewStatusLabel: "Klaar voor controle",
      approvedStatusLabel: "Goedgekeurd",
      failedStatusLabel: "Mislukt",
      dragToReorder: "Sleep om te herschikken",
      aiReviewScore: "AI-beoordelingsscore",
      keepOriginal: "Origineel behouden",
      aiComments: "AI-opmerkingen",
      approveImage: "Goedkeuren",
      generalCategory: "Algemeen",
      acceptableQuality: "Acceptabel",
      offlineQuality: "Offline",
      galleryReadinessHint:
        "Meet hoe geschikt de afbeelding is voor de galerij na AI-opruiming.",
      galleryReady: "Klaar voor galerij",
      needsReview: "Controle nodig",
      needsCorrection: "Correctie nodig",
      scoreSuitabilityHelp:
        "Deze score laat zien hoe geschikt de afbeelding is voor de publieke galerij na AI-opruiming en classificatie.",
      extractionInProgress: "AI-extractie bezig",
      extractionAnalyzingPhotos:
        "AI analyseert je jachtfoto's en bereidt de velden voor.",
      extractionSearchingKnowledge:
        "De RAG-engine doorzoekt Pinecone en vult velden automatisch aan...",
      percentComplete: "{percent}% voltooid",
      secondsRemaining: "Nog ongeveer {seconds}s",
      dataConflictDetected: "Gegevensconflict gedetecteerd",
      vesselDescriptionPlaceholder:
        'Merk/Model/Jaar + korte notities (bijv. "Beneteau Oceanis 38, 2016, diesel, 3 hutten, btw betaald, CE-documenten aanwezig")',
      vesselDescriptionAccuracyHint:
        "Merk/model/jaar toevoegen verbetert de AI-nauwkeurigheid sterk.",
      shower: "Douche",
      bath: "Bad",
      saloon: "Salon",
      headroom: "Stahoogte",
      engineRoom: "Machinekamer",
      spacesInside: "Ruimtes binnen",
      matrasses: "Matrassen",
      cushions: "Kussens",
      curtains: "Gordijnen",
      heating: "Verwarming",
      compass: "Kompas",
      depthInstrument: "Dieptemeter",
      windInstrument: "Windinstrument",
      navigationLights: "Navigatieverlichting",
      autopilot: "Automatische piloot",
      gps: "GPS",
      vhf: "VHF / Marifoon",
      plotter: "Kaartplotter",
      speedInstrument: "Log / Snelheid",
      radar: "Radar",
      fishfinder: "Fishfinder",
      ais: "AIS",
      logSpeed: "Log / Snelheid",
      rudderPositionIndicator: "Roerstandaanwijzer",
      turnIndicator: "Bochtindicator",
      ssbReceiver: "SSB-ontvanger",
      shortwaveRadio: "Kortegolfradio",
      shortBandTransmitter: "Kortegolfzender",
      satelliteCommunication: "Satellietcommunicatie",
      weatherfaxNavtex: "Weatherfax / Navtex",
      chartsGuides: "Kaarten / Gidsen",
      lifeRaft: "Reddingsvlot",
      epirb: "EPIRB",
      bilgePump: "Bilgepomp",
      bilgePumpManual: "Bilgepomp (handmatig)",
      bilgePumpElectric: "Bilgepomp (elektrisch)",
      fireExtinguisher: "Brandblusser",
      mobSystem: "MOB-systeem",
      lifeJackets: "Reddingsvesten",
      radarReflector: "Radarreflector",
      flares: "Noodsignalen",
      lifeBuoy: "Reddingsboei",
      watertightDoor: "Waterdichte deur",
      gasBottleLocker: "Gasbun",
      selfDrainingCockpit: "Zelflozende kuip",
      sailplanType: "Tuigplan",
      numberOfMasts: "Aantal masten",
      sparsMaterial: "Materiaal rondhouten",
      bowsprit: "Boegspriet",
      standingRig: "Staand want",
      mainSail: "Grootzeil",
      furlingMainsail: "Rolgrootzeil",
      jib: "Fok",
      genoa: "Genua",
      spinnaker: "Spinnaker",
      gennaker: "Gennaker",
      mizzen: "Bezaan",
      winches: "Lieren",
      electricWinches: "Elektrische lieren",
      manualWinches: "Handmatige lieren",
      anchor: "Anker",
      bowThruster: "Boegschroef",
      anchorWinch: "Ankerlier",
      sprayHood: "Sprayhood",
      bimini: "Bimini",
      swimmingPlatform: "Zwemplatform",
      swimmingLadder: "Zwemtrap",
      teakDeck: "Teakdek",
      cockpitTable: "Kuiptafel",
      dinghy: "Bijboot",
      trailer: "Trailer",
      covers: "Hoezen",
      fenders: "Stootwillen & lijnen",
      fendersLines: "Stootwillen & lijnen",
      anchorConnection: "Ankerverbinding",
      sternAnchor: "Hekanker",
      spudPole: "Spudpaal",
      cockpitTent: "Kuiptent",
      outdoorCushions: "Buitenkussens",
      seaRails: "Zeereling",
      pushpitPullpit: "Preekstoel / Hekstoel",
      sailLoweringSystem: "Zeilstrijksysteem",
      crutch: "Bokkepoot",
      dinghyBrand: "Merk bijboot",
      outboardEngine: "Buitenboordmotor",
      crane: "Kraan",
      davits: "Davits",
      imageDetectedDark: "Bronafbeelding was donker voor verbetering.",
      imageStrongHighlights:
        "Bronafbeelding had sterke hooglichten voor verbetering.",
      imageSoftRecovery:
        "Bronafbeelding was zacht, dus helderheidsherstel is geprobeerd.",
      imageLowRes:
        "Bronafbeelding had een lage resolutie, dus opschalen is overwogen.",
      imageRotationCorrected:
        "Beeldorientatie is gecorrigeerd met {degrees} graden.",
      imageGalleryReadyNoCorrections:
        "AI heeft deze afbeelding galerijklaar gemarkeerd zonder grote correcties.",
      aiReadyAnalyzeApprovedImages:
        "Gegevens automatisch laten controleren en aanvullen",
      uploadApproveImagesFirstAi:
        "Upload en keur eerst afbeeldingen goed, daarna analyseert AI ze",
      runAiExtractionManually: "Uitvoeren",
      noSchedulingRules: "Er zijn nog geen planningsregels ingesteld.",
      vesselVideoOperations: "Beheer van scheepsvideo's",
      manageVideosSocialPosting: "Beheer video's en social posting",
      generateFromImages: "Genereer uit afbeeldingen",
      uploadMp4: "Upload MP4",
      automatedSocialVideo: "Automatische social video",
      queueMarketingVideo:
        "Zet een marketingvideo op basis van de goedgekeurde bootafbeeldingen in de wachtrij. De backend rendert de video en toont statusupdates in de social-videobibliotheek.",
      openSocialLibrary: "Open social bibliotheek",
      forceRegenerate: "Opnieuw genereren forceren",
      generatedMarketingVideos: "Gegenereerde marketingvideo's",
      refresh: "Vernieuwen",
      marketingVideo: "Marketingvideo",
      templateLabel: "Template",
      videoUrlLabel: "Video-URL",
      readyState: "gereed",
      waitingState: "wachtend",
      addSchedulingWindow: "Planningsvenster toevoegen",
      locationSelectPlaceholder: "Selecteer locatie...",
      locationAssignedAutomatically:
        "Locatie wordt automatisch toegewezen vanuit je account.",
      locationRequiredForNextStep:
        "Selecteer eerst een verkooplocatie voordat je doorgaat naar de volgende stap.",
      noSpecificDocumentsRequired:
        "Geen specifieke documenten vereist voor dit type.",
      referenceDocumentsTitle: "Factuur-, brochure- en specificatiebestanden",
      referenceDocumentsDescription:
        "Upload hier facturen, brochures, leaflets of specificatiebladen. Deze bestanden blijven apart van de galerijafbeeldingen en helpen AI om stap 2 in te vullen.",
      uploadReferenceDocuments: "Referentiedocumenten uploaden",
      clickOrDropReferenceDocument:
        "Klik of sleep een factuur, leaflet of brochure",
      uploadedReferenceDocuments: "Referentiedocumenten ({count})",
      referenceDocumentsHint:
        "PDF, DOC, DOCX, JPG, PNG. Apart opgeslagen van galerijafbeeldingen.",
      referenceDocumentsEmpty: "Nog geen referentiedocumenten geüpload.",
      complianceDocumentsTitle: "Compliance- en overdrachtsdocumenten",
      complianceDocumentsDescription:
        "Upload hier contract-, overdrachts- of compliancedocumenten. Deze blijven apart van de AI-referentiebestanden uit stap 1.",
      referenceDocumentsMovedNotice:
        "Facturen en leaflets voor AI-extractie horen nu in stap 1 onder de afbeeldingssectie.",
      noComplianceDocumentsUploaded: "Nog geen compliancedocumenten geüpload.",
      uploadDocuments: "Documenten uploaden",
      documentUploading: "Bezig met uploaden...",
      clickOrDropDocument: "Klik of sleep een document",
      uploadedDocuments: "Al geüpload ({count})",
      deleteAllImagesTitle: "Alle afbeeldingen verwijderen",
      deleteAllImagesDescription:
        "Weet je zeker dat je alle geüploade afbeeldingen van dit jacht wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.",
      deletingAllImages: "Verwijderen...",
      deleteAllAction: "Alles verwijderen",
      failedImagesNavTitle: "Verwijder mislukte afbeeldingen",
      failedImagesNavDescription:
        "Verwijder eerst de afbeeldingen met de rode randen om door te gaan naar de volgende stap.",
      deleting: "Verwijderen...",
      deleteFailedImages: "Verwijder mislukte afbeeldingen",
      vesselIdentification: "Vaartuig Identificatie",
      brand: "Merk",
      year: "Bouwjaar",
      cancel: "Annuleren",
      aiExtractionNotAvailableOffline: "AI-extractie niet beschikbaar offline",
      offlineManualHint:
        "Je kunt deze stap overslaan en de bootgegevens handmatig invullen. Afbeeldingen zijn lokaal opgeslagen.",
      skipToStep2Manual: "Ga naar stap 2 (handmatig invullen)",
      geminiAnalyzingImages: "Gemini analyseert je afbeeldingen...",
      aiExtractionNeedsInternet:
        "AI-extractie vereist een internetverbinding. Je kunt doorgaan naar stap 2 om de gegevens handmatig in te vullen.",
      uploadOneImageFirst: "Upload eerst minimaal een afbeelding.",
      uploadOneImageFirstOffline:
        "Upload eerst minimaal een afbeelding (lokaal opgeslagen).",
      aiExtractionStartedBackground:
        "🤖 AI-extractie is op de achtergrond gestart...",
      aiPipelineAnalyzingImages:
        "🤖 De AI-pijplijn analyseert je afbeeldingen...",
      connectingGeminiVisionApi: "Verbinden met de Gemini Vision API...",
      analyzingVesselImagesGemini:
        "Vaartuigafbeeldingen worden geanalyseerd met Gemini Vision...",
      searchingCatalogMatchingModels:
        "Catalogus wordt doorzocht op overeenkomende modellen...",
      crossReferencingTechnicalSpecs:
        "Technische specificaties worden vergeleken...",
      finalizingDataValidatingResults:
        "Gegevens worden afgerond en resultaten gevalideerd...",
      aiGalleryReview: "AI-galerijcontrole",
      reviewDetails: "Controledetails",
      imageReviewTitle: "Afbeeldingscontrole",
      imageReviewDescription:
        "Controleer de volledige afbeelding, de AI-score en de toegepaste correcties voordat je deze goedkeurt voor de uiteindelijke galerij.",
      closeImageReview: "Afbeeldingscontrole sluiten",
      aiEnhanced: "AI verbeterd",
      imagesApprovedUnlocked:
        "✅ Afbeeldingen goedgekeurd - stap 2 is ontgrendeld!",
      imagesApprovedExtractionRunning:
        "🤖 Afbeeldingen goedgekeurd. AI-extractie loopt nog...",
      approvedMinimumImages:
        "⏳ {approved} van {minimum} minimale afbeeldingen goedgekeurd",
      editManifestUnlocked:
        "ℹ️ Bewerkingsmodus - stap 2 is ontgrendeld met bestaande bootgegevens.",
      stepTwoUnlockHint:
        "Stap 2 opent na goedkeuring van de afbeeldingen. AI-extractie loopt op de achtergrond door en vult de velden zodra alles klaar is.",
      stillProcessingCount: "{count} nog in verwerking...",
      approveAllImages: "Alles goedkeuren",
      aiTimedOutStepTwo:
        "AI-extractie duurde te lang. Stap 2 is ontgrendeld; je kunt doorgaan en AI later opnieuw proberen.",
      imagesApprovedManualAi:
        "Afbeeldingen goedgekeurd. Je kunt AI-autofill handmatig starten als dat nodig is.",
      imagesApprovedShort: "Afbeeldingen goedgekeurd.",
      fourImagesPerRow: "4 afbeeldingen per rij",
      sixImagesPerRow: "6 afbeeldingen per rij",
      eightImagesPerRow: "8 afbeeldingen per rij",
      salesLocation: "Verkooplocatie *",
      price: "Prijs (€)",
      minBidAmount: "Minimum biedbedrag (€)",
      yearBuilt: "Bouwjaar",
      boatType: "Boottype",
      boatCategory: "Bootcategorie",
      newOrUsed: "Nieuw of gebruikt",
      loa: "LOA (lengte over alles)",
      lwl: "LWL (waterlijnlengte)",
      shipyard: "Werf",
      ceCategory: "CE-categorie",
      status: "Status",
      passengerCapacity: "Passagierscapaciteit",
      beam: "Breedte",
      draft: "Diepgang",
      airDraft: "Doorvaarthoogte",
      hullType: "Rompvorm",
      hullConstruction: "Rompconstructie",
      hullColour: "Rompkleur",
      hullNumber: "Rompnummer",
      deckColour: "Dekkleur",
      deckConstruction: "Dekconstructie",
      superStructureColour: "Opbouwkleur",
      superStructureConstruction: "Opbouwconstructie",
      engineManufacturer: "Motorfabrikant",
      engineModel: "Motormodel",
      engineType: "Motortype",
      horsePower: "Vermogen",
      engineHours: "Motoruren",
      fuelType: "Brandstoftype",
      engineQuantity: "Aantal motoren",
      engineYear: "Motorjaar",
      maxSpeed: "Topsnelheid",
      cruisingSpeed: "Kruissnelheid",
      driveType: "Aandrijving",
      gallonsPerHour: "Gallons per uur",
      cabins: "Cabines",
      berthsFixed: "Slaapplaatsen (vast)",
      berthsExtra: "Slaapplaatsen (extra)",
      berthsCrew: "Slaapplaatsen (crew)",
      interiorType: "Interieurtype",
      separateDiningArea: "Aparte eethoek",
      upholsteryColor: "Kleur bekleding",
      cookingFuel: "Kookbrandstof",
      ownerComment: "Opmerking van eigenaar",
      knownDefects: "Bekende gebreken",
      registrationDetails: "Registratiegegevens",
      lastServiced: "Laatste onderhoud",
      displacement: "Waterverplaatsing",
      propulsion: "Voortstuwing",
      tankage: "Tanksysteem",
      berths: "Slaapplaatsen",
      toilet: "Toilet",
      fillSpecsFirst: "Vul eerst enkele specificaties in zodat AI een beschrijving kan schrijven.",
      descriptionGeneratedSuccess: "Beschrijving succesvol gegenereerd.",
      descriptionGenerationFailed: "Gegenereerde beschrijving mislukt.",
    },
    placeholders: {
      battery: "bijv. 4x 12V 125Ah AGM",
      batteryCharger: "bijv. Victron Blue Smart 30A",
      generator: "bijv. Onan 9 kW",
      inverter: "bijv. Victron Phoenix 3000 W",
      shorepower: "bijv. 230V 16A",
      solarPanel: "bijv. 2x 100W flexibel",
      windGenerator: "bijv. Silentwind 400+",
      voltage: "bijv. 12V / 230V",
      cockpitType: "Achtercockpit",
      waterTank: "200L",
      waterTankGauge: "Ja",
      waterMaker: "60 L/u",
      wasteWaterTank: "80L",
      wasteWaterGauge: "Ja",
      wasteTankDrainPump: "Elektrisch",
      deckSuction: "Ja",
      waterSystem: "Onder druk",
      hotWater: "Boiler",
      seaWaterPump: "Ja",
      television: 'bijv. Samsung 32" Smart TV',
      cdPlayer: "bijv. Fusion MS-RA770",
      dvdPlayer: "bijv. Sony DVP-SR210P",
      satelliteReception: "bijv. KVH TracVision TV5",
      hotAir: "Ja",
      stove: "Ja",
      centralHeating: "Ja",
    },
  },
  de: {
    common: { yes: "Ja", no: "Nein", unknown: "Unbekannt", confirm: "prufen" },
    sections: {
      electricalSystem: "Elektrisches System",
      kitchenComfort: "Küche und Komfort",
      hullDimensions: "Rumpf & Abmessungen",
      enginePerformance: "Motor & Leistung",
      accommodationFacilities: "Unterbringung & Einrichtungen",
      navigationElectronics: "Navigation & Elektronik",
      safetyEquipment: "Sicherheitsausrüstung",
      deckEquipment: "Decksausrüstung",
      riggingSails: "Takelage & Segel",
      registryComments: "Registrierung & Kommentare",
    },
    labels: {
      airConditioning: "Klimaanlage",
      flybridge: "Flybridge",
      cockpitType: "Kokpit-Typ",
      waterTank: "Wassertank",
      waterTankGauge: "Wassertankanzeige",
      waterMaker: "Wassermacher",
      wasteWaterTank: "Abwassertank",
      wasteWaterGauge: "Abwasseranzeige",
      wasteTankDrainPump: "Abwassertank-Ablasspumpe",
      deckSuction: "Deckabsaugung",
      waterSystem: "Wassersystem",
      hotWater: "Warmwasser",
      seaWaterPump: "Seewasserpumpe",
      deckWashPump: "Deckwaschpumpe",
      deckShower: "Deckdusche",
      battery: "Batterien",
      batteryCharger: "Batterieladegerat",
      generator: "Generator",
      inverter: "Wechselrichter",
      shorepower: "Landstrom",
      solarPanel: "Solarpanel",
      windGenerator: "Windgenerator",
      voltage: "Spannung",
      dynamo: "Dynamo",
      accumonitor: "Batteriemonitor",
      voltmeter: "Voltmeter",
      shorePowerCable: "Landstromkabel",
      consumptionMonitor: "Verbrauchsmonitor",
      controlPanel: "Bedienfeld",
      fuelTankGauge: "Kraftstoffanzeige",
      tachometer: "Drehzahlmesser",
      oilPressureGauge: "Oldruckanzeige",
      temperatureGauge: "Temperaturanzeige",
      oven: "Backofen",
      microwave: "Mikrowelle",
      fridge: "Kuhlschrank",
      freezer: "Gefrierschrank",
      cooker: "Kochfeld",
      television: "Fernseher",
      cdPlayer: "Radio / CD-Player",
      dvdPlayer: "DVD-Player",
      satelliteReception: "Satellitenempfang",
      hotAir: "Warmluftheizung",
      stove: "Ofenheizung",
      centralHeating: "Zentralheizung",
      essentialRegistryData: "Wichtige Registrierungsdaten",
      technicalDossier: "Technisches Dossier",
      hullDimensions: "Rumpf und Abmessungen",
      enginePerformance: "Motor und Leistung",
      accommodationFacilities: "Unterkunft und Einrichtungen",
      navigationElectronics: "Navigation und Elektronik",
      safetyEquipment: "Sicherheitsausrustung",
      deckEquipment: "Deckausrustung",
      riggingSails: "Takelage und Segel",
      registryComments: "Registrierung und Kommentare",
      schedulingAuthority: "Terminplanung",
      vesselDescription: "Schiffsbeschreibung",
      daysOfWeek: "Wochentage",
      startTime: "Startzeit",
      endTime: "Endzeit",
      reviewSummary:
        "Prufen Sie alle Schritte vor dem Speichern. Abgeschlossene Schritte sind oben mit einem blauen Haken markiert.",
      vesselName: "Schiffsname *",
      manufacturer: "Hersteller / Marke",
      model: "Modell",
      ballast: "Ballast",
      designer: "Designer",
      builder: "Werft",
      controlType: "Steuerungstyp",
      newTitle: "Neues Schiff registrieren",
      editTitle: "Schiff bearbeiten",
      loadingName: "Wird geladen...",
      stepImages: "Bilder",
      stepSpecs: "Spezifikationen",
      stepText: "Beschreibung",
      stepDisplay: "Anzeige",
      stepReview: "Prufung",
      stepContract: "Vertrag",
      stepBrokerReview: "Broker-Check",
      stepOneTitle: "Schiffsmedien & KI-Extraktion",
      stepOneDescription:
        "Bilder hochladen -> System optimiert automatisch -> freigeben -> danach fullt die KI alle Felder aus.",
      imagesApproved: "Bilder freigegeben",
      vesselDescriptionHelp: "Schiffsbeschreibung",
      optionalRecommended: "(optional, aber empfohlen)",
      createVessel: "Schiff erstellen",
      updateVessel: "Schiff aktualisieren",
      previous: "Zuruck",
      next: "Weiter",
      approveImagesFirst: "Bilder zuerst freigeben",
      completed: "Abgeschlossen",
      pending: "Offen",
      continueToContract: "Speichern und weiter zum Vertrag",
      submitForBrokerReview: "Zur Broker-Prufung einreichen",
      finishFlow: "Fertigstellen",
      finishFlowToast: "Schiffsablauf abgeschlossen.",
      contractStepDescription:
        "Verwalten Sie die Vertragsvorlage, drucken Sie das PDF und erzeugen Sie in diesem Schritt den Signhost-bereiten Vertrag.",
      reviewContractNotice:
        "Speichern Sie dieses Schiff zuerst. Der Vertragsablauf wird im nächsten Schritt geöffnet, sobald der Datensatz gespeichert ist.",
      clientReviewStepDescription:
        "Dieses Schiff wurde zur Prufung eingereicht. Ein Broker wird Sie kontaktieren und den Signhost-Vertrag per E-Mail senden, sobald alles bereit ist.",
      clientReviewStatusTitle: "Zur Prufung eingereicht",
      clientReviewStatusDescription:
        "Dieses Schiff wurde zur Prufung eingereicht. Ein Broker wird Sie kontaktieren und den Signhost-Vertrag per E-Mail senden, sobald alles bereit ist.",
      clientReviewProgressTitle: "Einreichungsstatus",
      clientReviewBoatStatusLabel: "Broker-Prüfung",
      clientReviewContractStatusLabel: "Vertragsunterzeichnung",
      clientReviewBoatPending: "Wartet auf Broker-Prüfung",
      clientReviewBoatApproved: "Vom Broker freigegeben",
      clientReviewContractWaiting: "Wartet auf Signhost-Einladung",
      clientReviewContractSent: "Signhost-Einladung gesendet",
      clientReviewContractSigned: "Vertrag unterzeichnet",
      clientReviewContractFailed: "Unterzeichnung erfordert Aufmerksamkeit",
      clientReviewContractWaitingDescription:
        "Ihr Broker hat dieses Boot freigegeben. Die Signhost-Einladung erscheint hier, sobald sie versendet wurde.",
      clientReviewContractSentDescription:
        "Ihr Broker hat die Signhost-Anfrage gesendet. Offnen Sie den Vertrag, um ihn zu prufen und zu unterschreiben.",
      clientReviewContractSignedDescription:
        "Der Signhost-Vertrag wurde erfolgreich unterzeichnet.",
      clientReviewContractFailedDescription:
        "Die letzte Signhost-Anfrage ist abgelaufen, fehlgeschlagen oder abgelehnt worden. Offnen Sie die Vertragsseite, um fortzufahren.",
      clientReviewOpenContract: "Vertrag offnen",
      clientReviewSignNow: "Jetzt unterschreiben",
      internalReviewTitle: "Broker-Prufaktionen",
      internalReviewDescription:
        "Prufen Sie dieses Kundenboot hier. Solange es im Entwurf bleibt, bleibt es in der Prufung. Mit der Freigabe geht das Boot in den Verkaufsablauf uber und Sie konnen mit Signhost fortfahren.",
      internalReviewStatusLabel: "Aktueller Prufstatus",
      internalReviewPending: "Wartet auf Broker-Prufung",
      internalReviewApproved: "Fur Verkaufsablauf freigegeben",
      markPendingReview: "In Prufung behalten",
      approveVessel: "Boot freigeben",
      vesselMarkedPendingReview: "Boot bleibt in der Broker-Prufung.",
      vesselApprovedSuccess:
        "Boot freigegeben. Sie konnen jetzt mit Signhost fortfahren.",
      vesselReviewActionFailed:
        "Der Prufstatus des Boots konnte nicht aktualisiert werden.",
      pendingBrokerReview: "Wartet auf Broker-Prufung",
      saveVesselFirst: "Schiff zuerst speichern",
      stepSticker: "Bootsaufkleber & QR",
      stickerStepDescription:
        "Erstellen und laden Sie den hochauflösenden QR-Code-Aufkleber für dieses Schiff herunter. Dieser Aufkleber kann ausgedruckt und am Boot angebracht werden, um einen einfachen Zugriff auf das Inserat zu ermöglichen.",
      vesselQrCodeAlt: "Schiff QR-Code",
      noQrGeneratedYet: "Noch kein QR-Code generiert",
      refreshSticker: "Aufkleber aktualisieren",
      generateSticker: "Aufkleber generieren",
      previewSticker: "Vorschau anzeigen",
      downloadStickerPdf: "PDF Aufkleber herunterladen",
      imageCountLabel: "Bilder",
      processingBadge: "in Bearbeitung",
      readyForReviewBadge: "zur Prüfung bereit",
      approvedBadge: "freigegeben",
      savingOrder: "Reihenfolge wird gespeichert...",
      aiAutoSort: "KI automatisch sortieren",
      addMoreImages: "Mehr hinzufügen",
      deleteAllImages: "Alle Bilder löschen",
      clickToAddImages: "Klicken Sie, um bis zu {count} Bilder hinzuzufügen",
      uploadingImages: "Bilder werden hochgeladen...",
      uploadAreaPendingHelp:
        "Dieser Bereich bleibt sichtbar, bis der aktuelle Upload abgeschlossen ist.",
      uploadAreaFormatsHelp:
        "JPEG, PNG, HEIC werden automatisch von KI optimiert",
      uploadAreaHint:
        "Fügen Sie HIN-Schilder, Armaturen, Motorstunden und wichtige Bootsdetails hinzu",
      processingStatusLabel: "Wird verarbeitet...",
      readyForReviewStatusLabel: "Zur Prüfung bereit",
      approvedStatusLabel: "Freigegeben",
      failedStatusLabel: "Fehlgeschlagen",
      dragToReorder: "Zum Umordnen ziehen",
      aiReviewScore: "KI-Bewertung",
      keepOriginal: "Original behalten",
      aiComments: "KI-Kommentare",
      approveImage: "Freigeben",
      generalCategory: "Allgemein",
      acceptableQuality: "Akzeptabel",
      offlineQuality: "Offline",
      galleryReadinessHint:
        "Misst die Galerietauglichkeit nach der KI-Bereinigung.",
      galleryReady: "Galeriebereit",
      needsReview: "Prüfung nötig",
      needsCorrection: "Korrektur nötig",
      scoreSuitabilityHelp:
        "Diese Bewertung zeigt, wie gut das Bild nach KI-Bereinigung und Klassifizierung für die öffentliche Galerie geeignet ist.",
      extractionInProgress: "KI-Extraktion läuft",
      extractionAnalyzingPhotos:
        "Die KI analysiert Ihre Yachtfotos und bereitet die Felder vor.",
      extractionSearchingKnowledge:
        "Die RAG-Engine durchsucht Pinecone und füllt Felder automatisch aus...",
      percentComplete: "{percent}% abgeschlossen",
      secondsRemaining: "Noch ca. {seconds}s",
      dataConflictDetected: "Datenkonflikt erkannt",
      vesselDescriptionPlaceholder:
        'Marke/Modell/Jahr + kurze Hinweise (z. B. "Beneteau Oceanis 38, 2016, Diesel, 3 Kabinen, MwSt. bezahlt, CE-Dokumente vorhanden")',
      vesselDescriptionAccuracyHint:
        "Marke/Modell/Jahr verbessern die KI-Genauigkeit deutlich.",
      shower: "Dusche",
      bath: "Bad",
      saloon: "Salon",
      headroom: "Stehhöhe",
      engineRoom: "Maschinenraum",
      spacesInside: "Innenräume",
      matrasses: "Matratzen",
      cushions: "Kissen",
      curtains: "Vorhänge",
      heating: "Heizung",
      compass: "Kompass",
      depthInstrument: "Tiefenmesser",
      windInstrument: "Windinstrument",
      navigationLights: "Navigationslichter",
      autopilot: "Autopilot",
      gps: "GPS",
      vhf: "VHF / Marifunk",
      plotter: "Kartenplotter",
      speedInstrument: "Log / Geschwindigkeit",
      radar: "Radar",
      fishfinder: "Fischfinder",
      ais: "AIS",
      logSpeed: "Log / Geschwindigkeit",
      rudderPositionIndicator: "Ruderlagenanzeiger",
      turnIndicator: "Wendeanzeiger",
      ssbReceiver: "SSB-Empfänger",
      shortwaveRadio: "Kurzwellenradio",
      shortBandTransmitter: "Kurzwellensender",
      satelliteCommunication: "Satellitenkommunikation",
      weatherfaxNavtex: "Weatherfax / Navtex",
      chartsGuides: "Karten / Handbücher",
      lifeRaft: "Rettungsinsel",
      epirb: "EPIRB",
      bilgePump: "Bilgenpumpe",
      bilgePumpManual: "Bilgenpumpe (manuell)",
      bilgePumpElectric: "Bilgenpumpe (elektrisch)",
      fireExtinguisher: "Feuerlöscher",
      mobSystem: "MOB-System",
      lifeJackets: "Rettungswesten",
      radarReflector: "Radarreflektor",
      flares: "Notsignale",
      lifeBuoy: "Rettungsring",
      watertightDoor: "Wasserdichte Tür",
      gasBottleLocker: "Gasflaschenkasten",
      selfDrainingCockpit: "Selbstlenzendes Cockpit",
      sailplanType: "Segelplan",
      numberOfMasts: "Anzahl der Masten",
      sparsMaterial: "Material der Spieren",
      bowsprit: "Bugspriet",
      standingRig: "Stehendes Gut",
      mainSail: "Großsegel",
      furlingMainsail: "Rollgroßsegel",
      jib: "Fock",
      genoa: "Genua",
      spinnaker: "Spinnaker",
      gennaker: "Gennaker",
      mizzen: "Besan",
      winches: "Winschen",
      electricWinches: "Elektrische Winschen",
      manualWinches: "Manuelle Winschen",
      anchor: "Anker",
      bowThruster: "Bugstrahlruder",
      anchorWinch: "Ankerwinde",
      sprayHood: "Sprayhood",
      bimini: "Bimini",
      swimmingPlatform: "Badeplattform",
      swimmingLadder: "Badeleiter",
      teakDeck: "Teakdeck",
      cockpitTable: "Cockpittisch",
      dinghy: "Beiboot",
      trailer: "Trailer",
      covers: "Abdeckungen",
      fenders: "Fender & Leinen",
      fendersLines: "Fender & Leinen",
      anchorConnection: "Ankerverbindung",
      sternAnchor: "Heckanker",
      spudPole: "Spud-Pfahl",
      cockpitTent: "Cockpitzelt",
      outdoorCushions: "Außenkissen",
      seaRails: "Seereling",
      pushpitPullpit: "Bugkorb / Heckkorb",
      sailLoweringSystem: "Segelbergsystem",
      crutch: "Schere",
      dinghyBrand: "Beibootmarke",
      outboardEngine: "Außenbordmotor",
      crane: "Kran",
      davits: "Davits",
      imageDetectedDark: "Das Ausgangsbild war vor der Verbesserung zu dunkel.",
      imageStrongHighlights:
        "Das Ausgangsbild hatte vor der Verbesserung starke Lichter.",
      imageSoftRecovery:
        "Das Ausgangsbild war weich, daher wurde eine Klarheitskorrektur versucht.",
      imageLowRes:
        "Das Ausgangsbild hatte eine niedrige Auflösung, daher wurde Upscaling erwogen.",
      imageRotationCorrected:
        "Die Bildausrichtung wurde um {degrees} Grad korrigiert.",
      imageGalleryReadyNoCorrections:
        "Die KI hat dieses Bild ohne größere Korrekturen als galeriegeeignet markiert.",
      aiReadyAnalyzeApprovedImages:
        "Daten automatisch prüfen und ergänzen",
      uploadApproveImagesFirstAi:
        "Lade zuerst Bilder hoch und gib sie frei, dann analysiert die KI sie",
      runAiExtractionManually: "Ausführen",
      noSchedulingRules: "Es sind noch keine Planungsregeln definiert.",
      vesselVideoOperations: "Vessel-Videoverwaltung",
      manageVideosSocialPosting: "Videos und Social Posting verwalten",
      generateFromImages: "Aus Bildern generieren",
      uploadMp4: "MP4 hochladen",
      automatedSocialVideo: "Automatisches Social-Video",
      queueMarketingVideo:
        "Stelle ein Marketingvideo aus den freigegebenen Bootsbildern in die Warteschlange. Das Backend rendert das Video und zeigt Statusupdates in der Social-Video-Bibliothek an.",
      openSocialLibrary: "Social-Bibliothek öffnen",
      forceRegenerate: "Neu erzeugen erzwingen",
      generatedMarketingVideos: "Generierte Marketingvideos",
      refresh: "Aktualisieren",
      marketingVideo: "Marketingvideo",
      templateLabel: "Vorlage",
      videoUrlLabel: "Video-URL",
      readyState: "bereit",
      waitingState: "wartend",
      addSchedulingWindow: "Zeitfenster hinzufügen",
      locationSelectPlaceholder: "Standort auswählen...",
      locationAssignedAutomatically:
        "Der Standort wird automatisch aus Ihrem Konto übernommen.",
      locationRequiredForNextStep:
        "Wählen Sie einen Verkaufsstandort, bevor Sie mit dem nächsten Schritt fortfahren.",
      noSpecificDocumentsRequired:
        "Für diesen Typ sind keine speziellen Dokumente erforderlich.",
      referenceDocumentsTitle: "Rechnungen, Prospekte und Datenblätter",
      referenceDocumentsDescription:
        "Laden Sie hier Rechnungen, Prospekte, Leaflets oder Datenblätter hoch. Diese Dateien bleiben getrennt von der Bildergalerie und helfen der KI beim Ausfüllen von Schritt 2.",
      uploadReferenceDocuments: "Referenzdokumente hochladen",
      clickOrDropReferenceDocument:
        "Rechnung, Leaflet oder Prospekt anklicken oder ziehen",
      uploadedReferenceDocuments: "Referenzdokumente ({count})",
      referenceDocumentsHint:
        "PDF, DOC, DOCX, JPG, PNG. Getrennt von den Galeriebildern gespeichert.",
      referenceDocumentsEmpty: "Noch keine Referenzdokumente hochgeladen.",
      complianceDocumentsTitle: "Compliance- und Ubergabedokumente",
      complianceDocumentsDescription:
        "Laden Sie hier Vertrags-, Ubergabe- oder Compliance-Dokumente hoch. Diese bleiben getrennt von den KI-Referenzdateien aus Schritt 1.",
      referenceDocumentsMovedNotice:
        "Rechnungen und Leaflets fur die KI-Extraktion gehoren jetzt in Schritt 1 unter den Bildbereich.",
      noComplianceDocumentsUploaded:
        "Noch keine Compliance-Dokumente hochgeladen.",
      uploadDocuments: "Dokumente hochladen",
      documentUploading: "Wird hochgeladen...",
      clickOrDropDocument: "Klicken oder ziehen Sie ein Dokument hierher",
      uploadedDocuments: "Bereits hochgeladen ({count})",
      deleteAllImagesTitle: "Alle Bilder löschen",
      deleteAllImagesDescription:
        "Möchten Sie wirklich alle hochgeladenen Bilder von dieser Yacht entfernen? Diese Aktion kann nicht rückgängig gemacht werden.",
      deletingAllImages: "Löschen...",
      deleteAllAction: "Alle löschen",
      failedImagesNavTitle: "Fehlerhafte Bilder entfernen",
      failedImagesNavDescription:
        "Löschen Sie zuerst die Bilder mit den roten Rändern, um zum nächsten Schritt zu gelangen.",
      deleting: "Löschen...",
      deleteFailedImages: "Fehlerhafte Bilder löschen",
      vesselIdentification: "Schiffsidentifikation",
      brand: "Marke",
      year: "Baujahr",
      cancel: "Abbrechen",
      aiExtractionNotAvailableOffline: "KI-Extraktion offline nicht verfügbar",
      offlineManualHint:
        "Sie können diesen Schritt überspringen und die Bootsdaten manuell ausfüllen. Bilder sind lokal gespeichert.",
      skipToStep2Manual: "Zu Schritt 2 wechseln (manuell)",
      geminiAnalyzingImages: "Gemini analysiert Ihre Bilder...",
      aiExtractionNeedsInternet:
        "Die KI-Extraktion benötigt eine Internetverbindung. Du kannst zu Schritt 2 wechseln, um die Angaben manuell auszufüllen.",
      uploadOneImageFirst: "Bitte lade zuerst mindestens ein Bild hoch.",
      uploadOneImageFirstOffline:
        "Bitte lade zuerst mindestens ein Bild hoch (lokal gespeichert).",
      aiExtractionStartedBackground:
        "🤖 KI-Extraktion wurde im Hintergrund gestartet...",
      aiPipelineAnalyzingImages:
        "🤖 Die KI-Pipeline analysiert deine Bilder...",
      connectingGeminiVisionApi:
        "Verbindung zur Gemini Vision API wird hergestellt...",
      analyzingVesselImagesGemini:
        "Schiffsbilder werden mit Gemini Vision analysiert...",
      searchingCatalogMatchingModels:
        "Katalog wird nach passenden Modellen durchsucht...",
      crossReferencingTechnicalSpecs:
        "Technische Spezifikationen werden abgeglichen...",
      finalizingDataValidatingResults:
        "Daten werden finalisiert und Ergebnisse validiert...",
      aiGalleryReview: "KI-Galerieprüfung",
      reviewDetails: "Prüfdetails",
      imageReviewTitle: "Bildprüfung",
      imageReviewDescription:
        "Prüfen Sie das vollständige Bild, die KI-Bewertung und die angewendeten Korrekturen, bevor Sie es für die endgültige Galerie freigeben.",
      closeImageReview: "Bildprüfung schließen",
      aiEnhanced: "KI verbessert",
      imagesApprovedUnlocked:
        "✅ Bilder freigegeben - Schritt 2 ist entsperrt!",
      imagesApprovedExtractionRunning:
        "🤖 Bilder freigegeben. Die KI-Extraktion läuft noch...",
      approvedMinimumImages:
        "⏳ {approved} von {minimum} Mindestbildern freigegeben",
      editManifestUnlocked:
        "ℹ️ Bearbeitungsmodus - Schritt 2 ist mit vorhandenen Bootsdaten entsperrt.",
      stepTwoUnlockHint:
        "Schritt 2 wird nach der Bildfreigabe geöffnet. Die KI-Extraktion läuft im Hintergrund weiter und füllt die Felder, sobald alles bereit ist.",
      stillProcessingCount: "{count} noch in Bearbeitung...",
      approveAllImages: "Alle freigeben",
      aiTimedOutStepTwo:
        "Die KI-Extraktion hat ein Zeitlimit erreicht. Schritt 2 ist entsperrt; Sie können fortfahren und die KI später erneut ausführen.",
      imagesApprovedManualAi:
        "Bilder freigegeben. Sie können die KI-Autofüllung bei Bedarf manuell starten.",
      imagesApprovedShort: "Bilder freigegeben.",
      fourImagesPerRow: "4 Bilder pro Reihe",
      sixImagesPerRow: "6 Bilder pro Reihe",
      eightImagesPerRow: "8 Bilder pro Reihe",
      salesLocation: "Verkaufsstandort *",
      price: "Preis (€)",
      minBidAmount: "Mindestgebot (€)",
      yearBuilt: "Baujahr",
      boatType: "Bootstyp",
      boatCategory: "Bootskategorie",
      newOrUsed: "Neu oder gebraucht",
      loa: "LOA (Gesamtlange)",
      lwl: "LWL (Wasserlinienlange)",
      shipyard: "Werft",
      ceCategory: "CE-Kategorie",
      status: "Status",
      passengerCapacity: "Passagierkapazitat",
      beam: "Breite",
      draft: "Tiefgang",
      airDraft: "Durchfahrtshohe",
      hullType: "Rumpftyp",
      hullConstruction: "Rumpfkonstruktion",
      hullColour: "Rumpffarbe",
      hullNumber: "Rumpfnummer",
      deckColour: "Deckfarbe",
      deckConstruction: "Deckkonstruktion",
      superStructureColour: "Aufbaufarbe",
      superStructureConstruction: "Aufbaukonstruktion",
      engineManufacturer: "Motorhersteller",
      engineModel: "Motormodell",
      engineType: "Motortyp",
      horsePower: "PS",
      engineHours: "Motorstunden",
      fuelType: "Kraftstoffart",
      engineQuantity: "Anzahl Motoren",
      engineYear: "Motorjahr",
      maxSpeed: "Hochstgeschwindigkeit",
      cruisingSpeed: "Reisegeschwindigkeit",
      driveType: "Antriebsart",
      gallonsPerHour: "Gallonen pro Stunde",
      cabins: "Kabinen",
      berthsFixed: "Kojen (fest)",
      berthsExtra: "Kojen (zusatzlich)",
      berthsCrew: "Kojen (Crew)",
      interiorType: "Interieurtyp",
      separateDiningArea: "Separater Essbereich",
      upholsteryColor: "Polsterfarbe",
      cookingFuel: "Kochbrennstoff",
      ownerComment: "Kommentar des Eigentumers",
      knownDefects: "Bekannte Mangel",
      registrationDetails: "Registrierungsdetails",
      lastServiced: "Letzte Wartung",
      displacement: "Verdrängung",
      propulsion: "Antrieb",
      tankage: "Tankanlage",
      berths: "Liegeplätze",
      toilet: "Toilette",
      fillSpecsFirst: "Bitte füllen Sie zuerst einige Spezifikationen aus, damit die KI eine Beschreibung schreiben kann.",
      descriptionGeneratedSuccess: "Beschreibung erfolgreich generiert.",
      descriptionGenerationFailed: "Generierung der Beschreibung fehlgeschlagen.",
    },
    placeholders: {
      battery: "z. B. 4x 12 V 125 Ah AGM",
      batteryCharger: "z. B. Victron Blue Smart 30 A",
      generator: "z. B. Onan 9 kW",
      inverter: "z. B. Victron Phoenix 3000 W",
      shorepower: "z. B. 230 V 16 A",
      solarPanel: "z. B. 2x 100 W flexibel",
      windGenerator: "z. B. Silentwind 400+",
      voltage: "z. B. 12 V / 230 V",
      cockpitType: "Achtercockpit",
      waterTank: "200L",
      waterTankGauge: "Ja",
      waterMaker: "60 L/h",
      wasteWaterTank: "80L",
      wasteWaterGauge: "Ja",
      wasteTankDrainPump: "Elektrisch",
      deckSuction: "Ja",
      waterSystem: "Druckwassersystem",
      hotWater: "Boiler",
      seaWaterPump: "Ja",
      television: 'z. B. Samsung 32" Smart TV',
      cdPlayer: "z. B. Fusion MS-RA770",
      dvdPlayer: "z. B. Sony DVP-SR210P",
      satelliteReception: "z. B. KVH TracVision TV5",
      hotAir: "Ja",
      stove: "Ja",
      centralHeating: "Ja",
    },
  },
  fr: {
    common: { yes: "Oui", no: "Non", unknown: "Inconnu", confirm: "verifier" },
    sections: {
      electricalSystem: "Système électrique",
      kitchenComfort: "Cuisine et confort",
      hullDimensions: "Coque et dimensions",
      enginePerformance: "Moteur et performances",
      accommodationFacilities: "Hébergement et équipements",
      navigationElectronics: "Navigation et électronique",
      safetyEquipment: "Équipement de sécurité",
      deckEquipment: "Équipement de pont",
      riggingSails: "Gréement et voiles",
      registryComments: "Immatriculation et commentaires",
    },
    labels: {
      airConditioning: "Climatisation",
      flybridge: "Flybridge",
      cockpitType: "Type de cockpit",
      waterTank: "Reservoir d'eau",
      waterTankGauge: "Jauge du reservoir d'eau",
      waterMaker: "Dessalinisateur",
      wasteWaterTank: "Reservoir d'eaux usees",
      wasteWaterGauge: "Jauge d'eaux usees",
      wasteTankDrainPump: "Pompe de vidange des eaux usees",
      deckSuction: "Aspiration de pont",
      waterSystem: "Systeme d'eau",
      hotWater: "Eau chaude",
      seaWaterPump: "Pompe a eau de mer",
      deckWashPump: "Pompe de lavage du pont",
      deckShower: "Douche de pont",
      battery: "Batteries",
      batteryCharger: "Chargeur de batterie",
      generator: "Generateur",
      inverter: "Onduleur",
      shorepower: "Alimentation de quai",
      solarPanel: "Panneau solaire",
      windGenerator: "Generateur eolien",
      voltage: "Tension",
      dynamo: "Dynamo",
      accumonitor: "Moniteur de batterie",
      voltmeter: "Voltmetre",
      shorePowerCable: "Cable d'alimentation de quai",
      consumptionMonitor: "Moniteur de consommation",
      controlPanel: "Panneau de commande",
      fuelTankGauge: "Jauge de carburant",
      tachometer: "Compte-tours",
      oilPressureGauge: "Jauge de pression d'huile",
      temperatureGauge: "Jauge de temperature",
      oven: "Four",
      microwave: "Micro-ondes",
      fridge: "Refrigerateur",
      freezer: "Congelateur",
      cooker: "Cuisiniere",
      television: "Televiseur",
      cdPlayer: "Radio / Lecteur CD",
      dvdPlayer: "Lecteur DVD",
      satelliteReception: "Reception satellite",
      hotAir: "Chauffage a air pulse",
      stove: "Chauffage par poele",
      centralHeating: "Chauffage central",
      essentialRegistryData: "Donnees d'immatriculation essentielles",
      technicalDossier: "Dossier technique",
      hullDimensions: "Coque et dimensions",
      enginePerformance: "Moteur et performances",
      accommodationFacilities: "Hebergement et equipements",
      navigationElectronics: "Navigation et electronique",
      safetyEquipment: "Equipement de securite",
      deckEquipment: "Equipement de pont",
      riggingSails: "Greement et voiles",
      registryComments: "Immatriculation et commentaires",
      schedulingAuthority: "Planification",
      vesselDescription: "Description du navire",
      daysOfWeek: "Jours de la semaine",
      startTime: "Heure de debut",
      endTime: "Heure de fin",
      reviewSummary:
        "Verifiez toutes les etapes avant l'envoi. Les etapes terminees sont marquees d'une coche bleue.",
      vesselName: "Nom du bateau *",
      manufacturer: "Fabricant / marque",
      model: "Modele",
      ballast: "Ballast",
      designer: "Designer",
      builder: "Constructeur",
      controlType: "Type de commande",
      newTitle: "Enregistrer un nouveau bateau",
      editTitle: "Modifier le bateau",
      loadingName: "Chargement...",
      stepImages: "Images",
      stepSpecs: "Specifications",
      stepText: "Description",
      stepDisplay: "Affichage",
      stepReview: "Revision",
      stepContract: "Contrat",
      stepBrokerReview: "Controle du courtier",
      stepOneTitle: "Medias du bateau et extraction IA",
      stepOneDescription:
        "Telechargez des images -> le systeme optimise automatiquement -> approuvez -> puis l'IA remplit les champs.",
      imagesApproved: "Images approuvees",
      vesselDescriptionHelp: "Description du bateau",
      optionalRecommended: "(optionnel mais recommande)",
      createVessel: "Creer le bateau",
      updateVessel: "Mettre a jour le bateau",
      previous: "Precedent",
      next: "Suivant",
      approveImagesFirst: "Approuver d'abord les images",
      completed: "Termine",
      pending: "En attente",
      continueToContract: "Enregistrer et continuer vers le contrat",
      submitForBrokerReview: "Soumettre au courtier",
      finishFlow: "Terminer",
      finishFlowToast: "Flux du bateau termine.",
      contractStepDescription:
        "Gerez le modele de contrat, imprimez le PDF et generez depuis cette etape le contrat pret pour Signhost.",
      reviewContractNotice:
        "Enregistrez d'abord ce bateau. Le flux du contrat s'ouvre a l'etape suivante une fois la fiche enregistree.",
      clientReviewStepDescription:
        "Ce bateau a ete soumis pour revision. Un courtier vous contactera et enverra le contrat Signhost par e-mail lorsque tout sera pret.",
      clientReviewStatusTitle: "Soumis pour revision",
      clientReviewStatusDescription:
        "Ce bateau a ete soumis pour revision. Un courtier vous contactera et enverra le contrat Signhost par e-mail lorsque tout sera pret.",
      clientReviewProgressTitle: "Progression de la soumission",
      clientReviewBoatStatusLabel: "Revision du courtier",
      clientReviewContractStatusLabel: "Signature du contrat",
      clientReviewBoatPending: "En attente de revision du courtier",
      clientReviewBoatApproved: "Approuve par le courtier",
      clientReviewContractWaiting: "En attente de l'invitation Signhost",
      clientReviewContractSent: "Invitation Signhost envoyee",
      clientReviewContractSigned: "Contrat signe",
      clientReviewContractFailed: "La signature demande de l'attention",
      clientReviewContractWaitingDescription:
        "Votre courtier a approuve ce bateau. L'invitation Signhost apparaitra ici des qu'elle sera envoyee.",
      clientReviewContractSentDescription:
        "Votre courtier a envoye la demande Signhost. Ouvrez le contrat pour le consulter et le signer.",
      clientReviewContractSignedDescription:
        "Le contrat Signhost a ete signe avec succes.",
      clientReviewContractFailedDescription:
        "La derniere demande Signhost a expire, a echoue ou a ete refusee. Ouvrez la page du contrat pour continuer.",
      clientReviewOpenContract: "Ouvrir le contrat",
      clientReviewSignNow: "Signer maintenant",
      internalReviewTitle: "Actions de revision du courtier",
      internalReviewDescription:
        "Revisez ici ce bateau client. Le conserver en brouillon signifie qu'il reste en revision. L'approuver le fait passer au flux commercial et vous permet de continuer avec Signhost.",
      internalReviewStatusLabel: "Etat actuel de revision",
      internalReviewPending: "En attente de revision du courtier",
      internalReviewApproved: "Approuve pour le flux commercial",
      markPendingReview: "Garder en revision",
      approveVessel: "Approuver le bateau",
      vesselMarkedPendingReview: "Le bateau reste en revision du courtier.",
      vesselApprovedSuccess:
        "Bateau approuve. Vous pouvez maintenant continuer avec Signhost.",
      vesselReviewActionFailed:
        "Impossible de mettre a jour l'etat de revision du bateau.",
      pendingBrokerReview: "En attente de revision du courtier",
      saveVesselFirst: "Enregistrer d'abord le bateau",
      stepSticker: "Autocollant de bateau & QR",
      stickerStepDescription:
        "Générez et téléchargez l'autocollant QR code haute résolution pour ce navire. Cet autocollant peut être imprimé et placé sur le bateau pour un accès facile à l'annonce.",
      vesselQrCodeAlt: "Code QR du navire",
      noQrGeneratedYet: "Aucun code QR généré pour le moment",
      refreshSticker: "Actualiser l'autocollant",
      generateSticker: "Générer l'autocollant",
      previewSticker: "Aperçu de l'autocollant",
      downloadStickerPdf: "Télécharger l'autocollant PDF",
      imageCountLabel: "Images",
      processingBadge: "en cours",
      readyForReviewBadge: "prete pour revision",
      approvedBadge: "approuvees",
      savingOrder: "Enregistrement de l'ordre...",
      aiAutoSort: "Tri automatique IA",
      addMoreImages: "Ajouter",
      deleteAllImages: "Supprimer toutes les images",
      clickToAddImages: "Cliquez pour ajouter jusqu'a {count} images",
      uploadingImages: "Telechargement des images...",
      uploadAreaPendingHelp:
        "Cette zone reste visible jusqu'a la fin du telechargement en cours.",
      uploadAreaFormatsHelp:
        "JPEG, PNG, HEIC optimises automatiquement par l'IA",
      uploadAreaHint:
        "Ajoutez plaques HIN, tableaux de bord, heures moteur et details cles du bateau",
      processingStatusLabel: "Traitement...",
      readyForReviewStatusLabel: "Prete pour revision",
      approvedStatusLabel: "Approuvee",
      failedStatusLabel: "Echec",
      dragToReorder: "Glisser pour reordonner",
      aiReviewScore: "Score d'evaluation IA",
      keepOriginal: "Conserver l'original",
      aiComments: "Commentaires IA",
      approveImage: "Approuver",
      generalCategory: "General",
      acceptableQuality: "Acceptable",
      offlineQuality: "Hors ligne",
      galleryReadinessHint:
        "Mesure l'aptitude de l'image pour la galerie apres le nettoyage IA.",
      galleryReady: "Pret pour la galerie",
      needsReview: "Revision necessaire",
      needsCorrection: "Correction necessaire",
      scoreSuitabilityHelp:
        "Ce score indique a quel point l'image convient a la galerie publique apres le nettoyage et la classification par IA.",
      extractionInProgress: "Extraction IA en cours",
      extractionAnalyzingPhotos:
        "L'IA analyse les photos de votre bateau et prepare les champs.",
      extractionSearchingKnowledge:
        "Le moteur RAG recherche dans Pinecone et remplit automatiquement les champs...",
      percentComplete: "{percent}% termine",
      secondsRemaining: "Encore environ {seconds}s",
      dataConflictDetected: "Conflit de donnees detecte",
      vesselDescriptionPlaceholder:
        'Marque/Modele/Annee + notes courtes (ex. "Beneteau Oceanis 38, 2016, diesel, 3 cabines, TVA payee, documents CE disponibles")',
      vesselDescriptionAccuracyHint:
        "Ajouter marque/modele/annee ameliore fortement la precision de l'IA.",
      shower: "Douche",
      bath: "Bain",
      saloon: "Salon",
      headroom: "Hauteur sous barrot",
      engineRoom: "Salle des machines",
      spacesInside: "Espaces intérieurs",
      matrasses: "Matelas",
      cushions: "Coussins",
      curtains: "Rideaux",
      heating: "Chauffage",
      compass: "Compas",
      depthInstrument: "Sondeur",
      windInstrument: "Instrument de vent",
      navigationLights: "Feux de navigation",
      autopilot: "Pilote automatique",
      gps: "GPS",
      vhf: "VHF / Radio marine",
      plotter: "Traceur de cartes",
      speedInstrument: "Loch / Vitesse",
      radar: "Radar",
      fishfinder: "Sondeur de peche",
      ais: "AIS",
      logSpeed: "Loch / Vitesse",
      rudderPositionIndicator: "Indicateur d'angle de barre",
      turnIndicator: "Indicateur de giration",
      ssbReceiver: "Recepteur SSB",
      shortwaveRadio: "Radio ondes courtes",
      shortBandTransmitter: "Emetteur ondes courtes",
      satelliteCommunication: "Communication satellite",
      weatherfaxNavtex: "Weatherfax / Navtex",
      chartsGuides: "Cartes / Guides",
      lifeRaft: "Radeau de survie",
      epirb: "EPIRB",
      bilgePump: "Pompe de cale",
      bilgePumpManual: "Pompe de cale (manuelle)",
      bilgePumpElectric: "Pompe de cale (electrique)",
      fireExtinguisher: "Extincteur",
      mobSystem: "Systeme HOM",
      lifeJackets: "Gilets de sauvetage",
      radarReflector: "Reflecteur radar",
      flares: "Fusees",
      lifeBuoy: "Bouee de sauvetage",
      watertightDoor: "Porte etanche",
      gasBottleLocker: "Coffre a bouteilles de gaz",
      selfDrainingCockpit: "Cockpit auto-videur",
      sailplanType: "Plan de voilure",
      numberOfMasts: "Nombre de mats",
      sparsMaterial: "Materiau du greement",
      bowsprit: "Beaupre",
      standingRig: "Greement dormant",
      mainSail: "Grand-voile",
      furlingMainsail: "Grand-voile sur enrouleur",
      jib: "Foc",
      genoa: "Genois",
      spinnaker: "Spinnaker",
      gennaker: "Gennaker",
      mizzen: "Misaine",
      winches: "Winchs",
      electricWinches: "Winchs electriques",
      manualWinches: "Winchs manuels",
      anchor: "Ancre",
      bowThruster: "Propulseur d'etrave",
      anchorWinch: "Guindeau",
      sprayHood: "Capote",
      bimini: "Bimini",
      swimmingPlatform: "Plateforme de bain",
      swimmingLadder: "Echelle de bain",
      teakDeck: "Pont en teck",
      cockpitTable: "Table de cockpit",
      dinghy: "Annexe",
      trailer: "Remorque",
      covers: "Housses",
      fenders: "Pare-battages et amarres",
      fendersLines: "Pare-battages et amarres",
      anchorConnection: "Connexion d'ancre",
      sternAnchor: "Ancre arriere",
      spudPole: "Pieu d'ancrage",
      cockpitTent: "Tente de cockpit",
      outdoorCushions: "Coussins exterieurs",
      seaRails: "Balcons de mer",
      pushpitPullpit: "Balcon avant / arriere",
      sailLoweringSystem: "Systeme d'affalage des voiles",
      crutch: "Chevre",
      dinghyBrand: "Marque de l'annexe",
      outboardEngine: "Moteur hors-bord",
      crane: "Grue",
      davits: "Bossoirs",
      imageDetectedDark: "L'image source etait sombre avant l'amelioration.",
      imageStrongHighlights:
        "L'image source presentait de fortes hautes lumieres avant l'amelioration.",
      imageSoftRecovery:
        "L'image source etait douce, une recuperation de clarte a donc ete tentee.",
      imageLowRes:
        "L'image source avait une faible resolution, une mise a l'echelle a donc ete envisagee.",
      imageRotationCorrected:
        "L'orientation de l'image a ete corrigee de {degrees} degres.",
      imageGalleryReadyNoCorrections:
        "L'IA a marque cette image comme prete pour la galerie sans corrections majeures.",
      aiReadyAnalyzeApprovedImages:
        "Verifier et completer automatiquement les donnees",
      uploadApproveImagesFirstAi:
        "Telechargez et approuvez d'abord les images, puis l'IA les analysera",
      runAiExtractionManually: "Executer",
      noSchedulingRules: "Aucune regle de planification n'est encore definie.",
      vesselVideoOperations: "Operations video du navire",
      manageVideosSocialPosting: "Gerer les videos et la publication sociale",
      generateFromImages: "Generer a partir des images",
      uploadMp4: "Telecharger MP4",
      automatedSocialVideo: "Video sociale automatisee",
      queueMarketingVideo:
        "Mettez en file d'attente une video marketing creee a partir des images approuvees du bateau. Le backend generera la video et affichera les mises a jour de statut dans la bibliotheque video sociale.",
      openSocialLibrary: "Ouvrir la bibliotheque sociale",
      forceRegenerate: "Forcer la regeneration",
      generatedMarketingVideos: "Videos marketing generees",
      refresh: "Actualiser",
      marketingVideo: "Video marketing",
      templateLabel: "Modele",
      videoUrlLabel: "URL video",
      readyState: "prete",
      waitingState: "en attente",
      addSchedulingWindow: "Ajouter un creneau",
      locationSelectPlaceholder: "Selectionner un lieu...",
      locationAssignedAutomatically:
        "Le lieu est attribue automatiquement a partir de votre compte.",
      locationRequiredForNextStep:
        "Selectionnez un lieu de vente avant de passer a l'etape suivante.",
      noSpecificDocumentsRequired:
        "Aucun document specifique requis pour ce type.",
      referenceDocumentsTitle: "Factures, brochures et fiches techniques",
      referenceDocumentsDescription:
        "Telechargez ici les factures, brochures, leaflets ou fiches techniques. Ces fichiers restent separes de la galerie d'images et aident l'IA a remplir l'etape 2.",
      uploadReferenceDocuments: "Telecharger des documents de reference",
      clickOrDropReferenceDocument:
        "Cliquez ou glissez une facture, un leaflet ou une brochure",
      uploadedReferenceDocuments: "Documents de reference ({count})",
      referenceDocumentsHint:
        "PDF, DOC, DOCX, JPG, PNG. Stockes separement des images de la galerie.",
      referenceDocumentsEmpty:
        "Aucun document de reference telecharge pour le moment.",
      complianceDocumentsTitle: "Documents de conformite et de livraison",
      complianceDocumentsDescription:
        "Telechargez ici les documents de contrat, de livraison ou de conformite. Ils restent separes des fichiers de reference IA de l'etape 1.",
      referenceDocumentsMovedNotice:
        "Les factures et leaflets pour l'extraction IA appartiennent maintenant a l'etape 1 sous la section images.",
      noComplianceDocumentsUploaded:
        "Aucun document de conformite telecharge pour le moment.",
      uploadDocuments: "Telecharger des documents",
      documentUploading: "Telechargement...",
      clickOrDropDocument: "Cliquez ou glissez un document",
      uploadedDocuments: "Deja telecharges ({count})",
      deleteAllImagesTitle: "Supprimer toutes les images",
      deleteAllImagesDescription:
        "Voulez-vous vraiment supprimer toutes les images telechargees de ce yacht ? Cette action est irreversible.",
      deletingAllImages: "Suppression...",
      deleteAllAction: "Tout supprimer",
      failedImagesNavTitle: "Supprimer les images échouées",
      failedImagesNavDescription:
        "Supprimez d'abord les images avec les bordures rouges pour passer à l'étape suivante.",
      deleting: "Suppression...",
      deleteFailedImages: "Supprimer les images échouées",
      vesselIdentification: "Identification du navire",
      brand: "Marque",
      year: "Année",
      cancel: "Annuler",
      aiExtractionNotAvailableOffline: "Extraction IA indisponible hors ligne",
      offlineManualHint:
        "Vous pouvez ignorer cette etape et remplir les details du bateau manuellement. Les images sont enregistrees localement.",
      skipToStep2Manual: "Passer a l'etape 2 (manuel)",
      geminiAnalyzingImages: "Gemini analyse vos images...",
      aiExtractionNeedsInternet:
        "L'extraction IA necessite une connexion Internet. Vous pouvez passer a l'etape 2 pour renseigner les details manuellement.",
      uploadOneImageFirst: "Veuillez d'abord telecharger au moins une image.",
      uploadOneImageFirstOffline:
        "Veuillez d'abord telecharger au moins une image (enregistree localement).",
      aiExtractionStartedBackground:
        "🤖 L'extraction IA a demarre en arriere-plan...",
      aiPipelineAnalyzingImages: "🤖 Le pipeline IA analyse vos images...",
      connectingGeminiVisionApi: "Connexion a l'API Gemini Vision...",
      analyzingVesselImagesGemini:
        "Analyse des images du bateau avec Gemini Vision...",
      searchingCatalogMatchingModels:
        "Recherche de modeles correspondants dans le catalogue...",
      crossReferencingTechnicalSpecs:
        "Verification croisee des specifications techniques...",
      finalizingDataValidatingResults:
        "Finalisation des donnees et validation des resultats...",
      aiGalleryReview: "Revue galerie IA",
      reviewDetails: "Details de revision",
      imageReviewTitle: "Revision de l'image",
      imageReviewDescription:
        "Examinez l'image complete, le score IA et les corrections appliquees avant de l'approuver pour la galerie finale.",
      closeImageReview: "Fermer la revision de l'image",
      aiEnhanced: "IA amelioree",
      imagesApprovedUnlocked:
        "✅ Images approuvees - l'etape 2 est deverrouillee !",
      imagesApprovedExtractionRunning:
        "🤖 Images approuvees. L'extraction IA est encore en cours...",
      approvedMinimumImages:
        "⏳ {approved} sur {minimum} images minimales approuvees",
      editManifestUnlocked:
        "ℹ️ Mode modification - l'etape 2 est deverrouillee avec les donnees existantes du bateau.",
      stepTwoUnlockHint:
        "L'etape 2 s'ouvre apres l'approbation des images. L'extraction IA continue en arriere-plan et remplit les champs des qu'elle est prete.",
      stillProcessingCount: "{count} encore en cours de traitement...",
      approveAllImages: "Tout approuver",
      aiTimedOutStepTwo:
        "L'extraction IA a expire. L'etape 2 est deverrouillee ; vous pouvez continuer et relancer l'IA plus tard.",
      imagesApprovedManualAi:
        "Images approuvees. Vous pouvez lancer le remplissage IA manuellement si necessaire.",
      imagesApprovedShort: "Images approuvees.",
      fourImagesPerRow: "4 images par ligne",
      sixImagesPerRow: "6 images par ligne",
      eightImagesPerRow: "8 images par ligne",
      salesLocation: "Lieu de vente *",
      price: "Prix (€)",
      minBidAmount: "Montant minimum de l'offre (€)",
      yearBuilt: "Annee de construction",
      boatType: "Type de bateau",
      boatCategory: "Categorie de bateau",
      newOrUsed: "Neuf ou occasion",
      loa: "LOA (longueur hors tout)",
      lwl: "LWL (longueur a la flottaison)",
      shipyard: "Chantier naval",
      ceCategory: "Categorie CE",
      status: "Statut",
      passengerCapacity: "Capacite passagers",
      beam: "Largeur",
      draft: "Tirant d'eau",
      airDraft: "Tirant d'air",
      hullType: "Type de coque",
      hullConstruction: "Construction de coque",
      hullColour: "Couleur de coque",
      hullNumber: "Numero de coque",
      deckColour: "Couleur du pont",
      deckConstruction: "Construction du pont",
      superStructureColour: "Couleur de superstructure",
      superStructureConstruction: "Construction de superstructure",
      engineManufacturer: "Fabricant du moteur",
      engineModel: "Modele moteur",
      engineType: "Type de moteur",
      horsePower: "Puissance",
      engineHours: "Heures moteur",
      fuelType: "Type de carburant",
      engineQuantity: "Nombre de moteurs",
      engineYear: "Annee moteur",
      maxSpeed: "Vitesse maximale",
      cruisingSpeed: "Vitesse de croisiere",
      driveType: "Type de transmission",
      gallonsPerHour: "Gallons par heure",
      cabins: "Cabines",
      berthsFixed: "Couchettes (fixes)",
      berthsExtra: "Couchettes (supplementaires)",
      berthsCrew: "Couchettes (equipage)",
      interiorType: "Type d'interieur",
      separateDiningArea: "Coin repas separe",
      upholsteryColor: "Couleur de sellerie",
      cookingFuel: "Combustible de cuisson",
      ownerComment: "Commentaire du proprietaire",
      knownDefects: "Defauts connus",
      registrationDetails: "Details d'immatriculation",
      lastServiced: "Dernier entretien",
      displacement: "Déplacement",
      propulsion: "Propulsion",
      tankage: "Réservoirs",
      berths: "Couchages",
      toilet: "Toilettes",
      fillSpecsFirst: "Veuillez d'abord remplir quelques spécifications afin que l'IA puisse rédiger une description.",
      descriptionGeneratedSuccess: "Description générée avec succès.",
      descriptionGenerationFailed: "Échec de la génération de la description.",
    },
    placeholders: {
      battery: "p. ex. 4x 12V 125Ah AGM",
      batteryCharger: "p. ex. Victron Blue Smart 30A",
      generator: "p. ex. Onan 9kW",
      inverter: "p. ex. Victron Phoenix 3000W",
      shorepower: "p. ex. 230V 16A",
      solarPanel: "p. ex. 2x 100W flexible",
      windGenerator: "p. ex. Silentwind 400+",
      voltage: "p. ex. 12V / 230V",
      cockpitType: "Cockpit arriere",
      waterTank: "200L",
      waterTankGauge: "Oui",
      waterMaker: "60 L/h",
      wasteWaterTank: "80L",
      wasteWaterGauge: "Oui",
      wasteTankDrainPump: "Electrique",
      deckSuction: "Oui",
      waterSystem: "Sous pression",
      hotWater: "Boiler",
      seaWaterPump: "Oui",
      television: 'p. ex. Samsung 32" Smart TV',
      cdPlayer: "p. ex. Fusion MS-RA770",
      dvdPlayer: "p. ex. Sony DVP-SR210P",
      satelliteReception: "p. ex. KVH TracVision TV5",
      hotAir: "Oui",
      stove: "Oui",
      centralHeating: "Oui",
    },
  },
} as const;

function normalizeTriStateValue(value: unknown): "yes" | "no" | null {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value > 0 ? "yes" : "no";
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (
    [
      "unknown",
      "unsure",
      "uncertain",
      "n/a",
      "na",
      "null",
      "none",
      "onbekend",
      "unbekannt",
      "inconnu",
    ].includes(normalized)
  )
    return null;
  if (
    ["no", "n", "false", "0", "absent", "nee", "nein", "non"].includes(
      normalized,
    )
  )
    return "no";
  if (
    ["yes", "y", "true", "1", "present", "included", "ja", "oui"].includes(
      normalized,
    )
  )
    return "yes";
  if (/\b(without|not visible|not present|missing)\b/.test(normalized))
    return "no";
  if (/\b(with|equipped|installed|available)\b/.test(normalized)) return "yes";
  if (/\d+/.test(normalized)) return "yes";
  // If it's something else not matching the above, return null to be safe
  return null;
}

type DescriptionFormValue = string | number | boolean;
const DESCRIPTION_LANGS = ["nl", "en", "de", "fr"] as const;
type DescriptionLanguage = (typeof DESCRIPTION_LANGS)[number];
type DescriptionTextState = Record<DescriptionLanguage, string>;
const DESCRIPTION_LANGUAGE_BADGES: Record<DescriptionLanguage, string> = {
  nl: "🇳🇱 NL",
  en: "🇬🇧 EN",
  de: "🇩🇪 DE",
  fr: "🇫🇷 FR",
};
const DESCRIPTION_LANGUAGE_LABELS: Record<DescriptionLanguage, string> = {
  nl: "Nederlandse Beschrijving",
  en: "English Description",
  de: "Deutsche Beschreibung",
  fr: "Description Francaise",
};
const DESCRIPTION_LANGUAGE_LOCALES: Record<DescriptionLanguage, string> = {
  nl: "nl-NL",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
};

const DESCRIPTION_CONTEXT_IGNORED_FIELDS = new Set([
  "id",
  "user_id",
  "created_at",
  "updated_at",
  "deleted_at",
  "main_image",
  "images",
  "availability_rules",
  "availabilityRules",
  "short_description_en",
  "short_description_nl",
  "short_description_de",
  "short_description_fr",
]);

function stripRichText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDescriptionFormValues(
  value: unknown,
): Record<string, DescriptionFormValue> {
  const record = toObjectRecord(value);
  const entries = Object.entries(record)
    .filter(([key, rawValue]) => {
      if (DESCRIPTION_CONTEXT_IGNORED_FIELDS.has(key)) return false;
      if (rawValue === null || rawValue === undefined) return false;
      if (Array.isArray(rawValue)) return false;
      if (typeof rawValue === "object") return false;
      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        return trimmed !== "" && trimmed.toLowerCase() !== "undefined";
      }
      if (typeof rawValue === "number") {
        return Number.isFinite(rawValue);
      }
      return typeof rawValue === "boolean";
    })
    .map(([key, rawValue]) => [
      key,
      typeof rawValue === "string" ? rawValue.trim() : rawValue,
    ])
    .sort(([leftKey], [rightKey]) =>
      (leftKey as string).localeCompare(rightKey as string),
    );

  return Object.fromEntries(entries);
}

function buildDescriptionRequestSignature(
  formValues: Record<string, DescriptionFormValue>,
  tone: string,
  minWords: number | "",
  maxWords: number | "",
): string {
  return JSON.stringify({
    tone,
    minWords: minWords || 200,
    maxWords: maxWords || 500,
    formValues,
  });
}

function hasThinDescriptions(texts: DescriptionTextState): boolean {
  return DESCRIPTION_LANGS.some(
    (lang) => stripRichText(texts[lang]).length < 140,
  );
}

function YachtEditorInner() {
  const [step1Brand, setStep1Brand] = useState("");
  const [step1Model, setStep1Model] = useState("");
  const [step1Year, setStep1Year] = useState("");
  const [boatHint, setBoatHint] = useState("");
  const restoredBoatHintRef = useRef(false);
  const boatHintEditedRef = useRef(false);
  const params = useParams<{ id: string; role?: string }>();
  const searchParams = useSearchParams();
  // We can't safely extract locale from params directly if it's missing or async,
  // so we'll grab it safely using our hook that reads the pathname
  const locale = useLocale();
  const role = normalizeRole(params?.role) ?? "admin";
  const isClientRole = role === "client";
  const dict = getDictionary(locale) as any;
  const t = dict?.YachtWizard || dict?.DashboardAdminYachtEditor || ({} as any);
  const router = useRouter();
  const step2CommonTextByLocale = {
    en: {
      select: "Select...",
      selectLocation: "Select location...",
      conditionNew: "New",
      conditionUsed: "Used",
      ceOcean: "Ocean",
      ceOffshore: "Offshore",
      ceInshore: "Inshore",
      ceSheltered: "Sheltered Waters",
      statusForSale: "For Sale",
      statusForBid: "For Bid",
      statusSold: "Sold",
      statusDraft: "Draft",
      yes: "Yes",
      no: "No",
      unknown: "Unknown",
      confirm: "Confirm",
    },
    nl: {
      select: "Selecteer...",
      selectLocation: "Selecteer locatie...",
      conditionNew: "Nieuw",
      conditionUsed: "Gebruikt",
      ceOcean: "Oceaan",
      ceOffshore: "Offshore",
      ceInshore: "Binnenwateren",
      ceSheltered: "Beschutte wateren",
      statusForSale: "Te koop",
      statusForBid: "In bieding",
      statusSold: "Verkocht",
      statusDraft: "Concept",
      yes: "Ja",
      no: "Nee",
      unknown: "Onbekend",
      confirm: "Controleren",
    },
    de: {
      select: "Auswahlen...",
      selectLocation: "Standort auswahlen...",
      conditionNew: "Neu",
      conditionUsed: "Gebraucht",
      ceOcean: "Ozean",
      ceOffshore: "Hochsee",
      ceInshore: "Binnengewasser",
      ceSheltered: "Geschutzte Gewasser",
      statusForSale: "Zum Verkauf",
      statusForBid: "Zur Auktion",
      statusSold: "Verkauft",
      statusDraft: "Entwurf",
      yes: "Ja",
      no: "Nein",
      unknown: "Unbekannt",
      confirm: "Prüfen",
    },
    fr: {
      select: "Selectionner...",
      selectLocation: "Selectionner le lieu...",
      conditionNew: "Neuf",
      conditionUsed: "Occasion",
      ceOcean: "Ocean",
      ceOffshore: "Au large",
      ceInshore: "Cotiere",
      ceSheltered: "Eaux abritees",
      statusForSale: "A vendre",
      statusForBid: "En encheres",
      statusSold: "Vendu",
      statusDraft: "Brouillon",
      yes: "Oui",
      no: "Non",
      unknown: "Inconnu",
      confirm: "Vérifier",
    },
  } as const;
  const step2PlaceholderByLocale = {
    en: {
      vesselName: "e.g. M/Y NOBILITY",
      manufacturer: "e.g. Beneteau, Sunseeker",
      model: "e.g. Oceanis 38.1",
      minBidAmount: "Auto-calculates 90% of price if empty",
      boatType: "e.g. Sailboat, Motorboat",
      boatCategory: "e.g. Cruiser, Racing, Fishing",
      shipyard: "e.g. Beneteau, Bavaria",
      ownerComment: "Any seller notes or comments...",
      knownDefects: "Any known issues or defects...",
      registrationDetails: "e.g. NL registration, MMSI 244...",
      lastServiced: "e.g. March 2024",
    },
    nl: {
      vesselName: "bijv. M/Y NOBILITY",
      manufacturer: "bijv. Beneteau, Sunseeker",
      model: "bijv. Oceanis 38.1",
      minBidAmount: "Wordt automatisch 90% van de prijs als dit leeg blijft",
      boatType: "bijv. Zeilboot, Motorboot",
      boatCategory: "bijv. Cruiser, Race, Visboot",
      shipyard: "bijv. Beneteau, Bavaria",
      ownerComment: "Notities of opmerkingen van de verkoper...",
      knownDefects: "Bekende problemen of gebreken...",
      registrationDetails: "bijv. NL-registratie, MMSI 244...",
      lastServiced: "bijv. maart 2024",
    },
    de: {
      vesselName: "z. B. M/Y NOBILITY",
      manufacturer: "z. B. Beneteau, Sunseeker",
      model: "z. B. Oceanis 38.1",
      minBidAmount:
        "Wird automatisch mit 90 % des Preises berechnet, wenn leer",
      boatType: "z. B. Segelboot, Motorboot",
      boatCategory: "z. B. Cruiser, Regatta, Angeln",
      shipyard: "z. B. Beneteau, Bavaria",
      ownerComment: "Hinweise oder Kommentare des Verkaufers...",
      knownDefects: "Bekannte Probleme oder Mangel...",
      registrationDetails: "z. B. NL-Registrierung, MMSI 244...",
      lastServiced: "z. B. Marz 2024",
    },
    fr: {
      vesselName: "p. ex. M/Y NOBILITY",
      manufacturer: "p. ex. Beneteau, Sunseeker",
      model: "p. ex. Oceanis 38.1",
      minBidAmount: "Calcule automatiquement 90 % du prix si vide",
      boatType: "p. ex. Voilier, bateau a moteur",
      boatCategory: "p. ex. Croisiere, course, peche",
      shipyard: "p. ex. Beneteau, Bavaria",
      ownerComment: "Notes ou commentaires du vendeur...",
      knownDefects: "Problemes ou defauts connus...",
      registrationDetails: "p. ex. immatriculation NL, MMSI 244...",
      lastServiced: "p. ex. mars 2024",
    },
  } as const;
  const step2HelpByLocale = {
    en: {
      boat_name: "Official or advertised vessel name shown in the listing.",
      manufacturer: "Brand or manufacturer responsible for building the boat.",
      model: "Commercial model name or series used for this boat.",
      location_id:
        "Sales location where the boat is listed or physically available.",
      price: "Public asking price for the boat in EUR.",
      min_bid_amount:
        "Lowest bid amount accepted for the auction. Leave it empty to use 90% of the asking price automatically.",
      year: "Year the boat was built or first completed.",
      boat_type:
        "Main vessel type, for example sailboat, motorboat, or catamaran.",
      boat_category:
        "More specific market category such as cruiser, racer, or fishing boat.",
      new_or_used: "Choose whether the boat is sold as new or used.",
      loa: "Length overall of the vessel, usually measured in meters.",
      lwl: "Length of the hull at the waterline.",
      where:
        "Shipyard, build location, or yard reference associated with the vessel.",
      ce_category:
        "European CE design category that indicates the operating conditions the boat is certified for.",
      status:
        "Current commercial status of the listing, for example Draft, For Sale, or Sold.",
      passenger_capacity:
        "Maximum recommended number of people the boat can carry.",
      owners_comment:
        "Seller notes, context, or details that help the team understand the vessel better.",
      known_defects:
        "Known damage, technical issues, or missing equipment that should be disclosed.",
      reg_details:
        "Registration number, MMSI, flag, or other official registry details for the vessel.",
      last_serviced:
        "Most recent known service or maintenance date, for example March 2024.",
    },
    nl: {
      boat_name:
        "Officiele of geadverteerde naam van het vaartuig in de listing.",
      manufacturer: "Merk of fabrikant die de boot heeft gebouwd.",
      model: "Commerciele modelnaam of serie van deze boot.",
      location_id:
        "Verkooplocatie waar de boot ligt of aangeboden wordt.",
      price: "Publieke vraagprijs van de boot in EUR.",
      min_bid_amount:
        "Laagste bod dat geaccepteerd wordt in de veiling. Laat leeg om automatisch 90% van de vraagprijs te gebruiken.",
      year: "Bouwjaar of jaar waarin de boot is opgeleverd.",
      boat_type:
        "Hoofdtype vaartuig, bijvoorbeeld zeilboot, motorboot of catamaran.",
      boat_category:
        "Specifiekere marktcategorie zoals cruiser, racer of visboot.",
      new_or_used: "Geef aan of de boot als nieuw of gebruikt wordt verkocht.",
      loa: "Totale lengte van het schip, meestal gemeten in meters.",
      lwl: "Lengte van de waterlijn van de romp.",
      where:
        "Scheepswerf, bouwlocatie of werfreferentie die bij het schip hoort.",
      ce_category:
        "Europese CE-ontwerpcategorie die aangeeft voor welke omstandigheden de boot is gecertificeerd.",
      status:
        "Huidige commerciele status van de listing, bijvoorbeeld Concept, Te koop of Verkocht.",
      passenger_capacity:
        "Maximaal aanbevolen aantal personen dat de boot kan meenemen.",
      owners_comment:
        "Notities of context van de verkoper die het team helpen de boot beter te begrijpen.",
      known_defects:
        "Bekende schade, technische problemen of ontbrekende uitrusting die gemeld moeten worden.",
      reg_details:
        "Registratienummer, MMSI, vlag of andere officiele registratiedetails van het schip.",
      last_serviced:
        "Laatst bekende onderhouds- of servicedatum, bijvoorbeeld maart 2024.",
    },
    de: {
      boat_name: "Offizieller oder ausgeschriebener Bootsname in der Anzeige.",
      manufacturer: "Marke oder Hersteller, der das Boot gebaut hat.",
      model: "Kommerzieller Modellname oder Baureihe dieses Boots.",
      location_id:
        "Verkaufsstandort, an dem das Boot liegt oder angeboten wird.",
      price: "Offentlicher Angebotspreis des Boots in EUR.",
      min_bid_amount:
        "Niedrigster Gebotsbetrag fur die Auktion. Leer lassen, um automatisch 90 % des Angebotspreises zu verwenden.",
      year: "Baujahr oder Fertigstellungsjahr des Boots.",
      boat_type:
        "Haupttyp des Fahrzeugs, zum Beispiel Segelboot, Motorboot oder Katamaran.",
      boat_category: "Genauere Kategorie wie Cruiser, Racer oder Angelboot.",
      new_or_used:
        "Wahlen Sie, ob das Boot als neu oder gebraucht verkauft wird.",
      loa: "Gesamtlange des Boots, in der Regel in Metern gemessen.",
      lwl: "Lange der Wasserlinie des Rumpfs.",
      where: "Werft, Bauort oder Werftbezug des Boots.",
      ce_category:
        "Europische CE-Kategorie fur die zertifizierten Einsatzbedingungen des Boots.",
      status:
        "Aktueller Verkaufsstatus der Anzeige, zum Beispiel Entwurf, Zum Verkauf oder Verkauft.",
      passenger_capacity: "Maximal empfohlene Anzahl von Personen an Bord.",
      owners_comment:
        "Notizen oder Hinweise des Verkaufers, die dem Team beim Verstandnis des Boots helfen.",
      known_defects:
        "Bekannte Schaden, technische Probleme oder fehlende Ausrustung, die offengelegt werden sollten.",
      reg_details:
        "Registrierungsnummer, MMSI, Flagge oder andere offizielle Registerangaben zum Boot.",
      last_serviced:
        "Zuletzt bekanntes Service- oder Wartungsdatum, zum Beispiel Marz 2024.",
    },
    fr: {
      boat_name: "Official or advertised vessel name shown in the listing.",
      manufacturer: "Brand or manufacturer responsible for building the boat.",
      model: "Commercial model name or series used for this boat.",
      location_id:
        "Sales location where the boat is listed or physically available.",
      price: "Public asking price for the boat in EUR.",
      min_bid_amount:
        "Lowest bid amount accepted for the auction. Leave it empty to use 90% of the asking price automatically.",
      year: "Year the boat was built or first completed.",
      boat_type:
        "Main vessel type, for example sailboat, motorboat, or catamaran.",
      boat_category:
        "More specific market category such as cruiser, racer, or fishing boat.",
      new_or_used: "Choose whether the boat is sold as new or used.",
      loa: "Length overall of the vessel, usually measured in meters.",
      lwl: "Length of the hull at the waterline.",
      where:
        "Shipyard, build location, or yard reference associated with the vessel.",
      ce_category:
        "European CE design category that indicates the operating conditions the boat is certified for.",
      status:
        "Current commercial status of the listing, for example Draft, For Sale, or Sold.",
      passenger_capacity:
        "Maximum recommended number of people the boat can carry.",
      owners_comment:
        "Seller notes, context, or details that help the team understand the vessel better.",
      known_defects:
        "Known damage, technical issues, or missing equipment that should be disclosed.",
      reg_details:
        "Registration number, MMSI, flag, or other official registry details for the vessel.",
      last_serviced:
        "Most recent known service or maintenance date, for example March 2024.",
    },
  } as const;
  const yachtFormText =
    YACHT_FORM_TEXT[locale as keyof typeof YACHT_FORM_TEXT] ??
    YACHT_FORM_TEXT.en;
  const step2CommonText =
    step2CommonTextByLocale[locale as keyof typeof step2CommonTextByLocale] ??
    step2CommonTextByLocale.en;
  const step2PlaceholderText =
    step2PlaceholderByLocale[locale as keyof typeof step2PlaceholderByLocale] ??
    step2PlaceholderByLocale.en;
  const step2HelpText =
    step2HelpByLocale[locale as keyof typeof step2HelpByLocale] ??
    step2HelpByLocale.en;
  const labelText = (
    key: keyof typeof yachtFormText.labels,
    fallback: string,
  ) => t?.labels?.[key] || yachtFormText.labels[key] || fallback;
  const placeholderText = (
    key: keyof typeof yachtFormText.placeholders,
    fallback: string,
  ) => t?.placeholders?.[key] || yachtFormText.placeholders[key] || fallback;
  const commonText = (key: keyof typeof step2CommonText, fallback: string) =>
    t?.common?.[key] || step2CommonText[key] || fallback;
  const step2Placeholder = (
    key: keyof typeof step2PlaceholderText,
    fallback: string,
  ) => t?.placeholders?.[key] || step2PlaceholderText[key] || fallback;
  const sectionText = (
    key: keyof typeof yachtFormText.sections,
    fallback: string,
  ) => t?.sections?.[key] || yachtFormText.sections[key] || fallback;
  const step2ExtraLabelByLocale = {
    en: {
      displacement: "Displacement",
      propulsion: "Propulsion",
      tankage: "Tankage",
      berths: "Berths",
      toilet: "Toilet",
      shower: "Shower",
      bath: "Bath",
      saloon: "Saloon",
      headroom: "Headroom",
      engineRoom: "Engine Room",
      spacesInside: "Spaces Inside",
      matrasses: "Matrasses",
      cushions: "Cushions",
      curtains: "Curtains",
      heating: "Heating",
      outdoorCushions: "Outdoor Cushions",
    },
    nl: {
      displacement: "Waterverplaatsing",
      propulsion: "Voortstuwing",
      tankage: "Tankinhoud",
      berths: "Slaapplaatsen",
      toilet: "Toilet",
      shower: "Douche",
      bath: "Bad",
      saloon: "Salon",
      headroom: "Stahoogte",
      engineRoom: "Machinekamer",
      spacesInside: "Binnenruimtes",
      matrasses: "Matrassen",
      cushions: "Kussens",
      curtains: "Gordijnen",
      heating: "Verwarming",
      outdoorCushions: "Buitenkussens",
    },
    de: {
      displacement: "Verdrangung",
      propulsion: "Antrieb",
      tankage: "Tanksystem",
      berths: "Liegeplatze",
      toilet: "Toilette",
      shower: "Dusche",
      bath: "Badewanne",
      saloon: "Salon",
      headroom: "Stehhohe",
      engineRoom: "Maschinenraum",
      spacesInside: "Innenraume",
      matrasses: "Matratzen",
      cushions: "Polster",
      curtains: "Vorhange",
      heating: "Heizung",
      outdoorCushions: "Aussenpolster",
    },
    fr: {
      displacement: "Deplacement",
      propulsion: "Propulsion",
      tankage: "Reservoirs",
      berths: "Couchages",
      toilet: "Toilettes",
      shower: "Douche",
      bath: "Baignoire",
      saloon: "Salon",
      headroom: "Hauteur sous plafond",
      engineRoom: "Salle des machines",
      spacesInside: "Espaces interieurs",
      matrasses: "Matelas",
      cushions: "Coussins",
      curtains: "Rideaux",
      heating: "Chauffage",
      outdoorCushions: "Coussins exterieurs",
    },
  } as const;
  const step2ExtraLabels =
    step2ExtraLabelByLocale[locale as keyof typeof step2ExtraLabelByLocale] ??
    step2ExtraLabelByLocale.en;
  const extraLabelText = (
    key: keyof typeof step2ExtraLabels,
    fallback: string,
  ) => step2ExtraLabels[key] || fallback;

  const stepFallbacks: Record<string, string> = {
    images: labelText("stepImages", "Images"),
    specs: labelText("stepSpecs", "Specifications"),
    text: labelText("stepText", "Description"),
    display: labelText("stepDisplay", "Display"),
    review: labelText("stepReview", "Review"),
    contract: isClientRole
      ? labelText("stepBrokerReview", "Broker Review")
      : labelText("stepContract", "Contract"),
  };
  const localizeFieldLabel = useCallback(
    (fieldName: string, fallback: string) => {
      const key = fieldName.replace(/_([a-z])/g, (_, letter: string) =>
        letter.toUpperCase(),
      ) as keyof typeof yachtFormText.labels;
      return labelText(key, fallback);
    },
    [labelText],
  );

  const wizardSteps = WIZARD_STEP_IDS.map((step) => ({
    ...step,
    label: t?.steps?.[step.key] || stepFallbacks[step.key] || step.key,
  }));
  const visibleWizardSteps = useMemo(
    () =>
      isClientRole ? wizardSteps.filter((step) => step.id !== 4) : wizardSteps,
    [isClientRole, wizardSteps],
  );
  const weekdayOptions = [
    { value: 1, label: t?.weekdays?.monday || "Monday" },
    { value: 2, label: t?.weekdays?.tuesday || "Tuesday" },
    { value: 3, label: t?.weekdays?.wednesday || "Wednesday" },
    { value: 4, label: t?.weekdays?.thursday || "Thursday" },
    { value: 5, label: t?.weekdays?.friday || "Friday" },
    { value: 6, label: t?.weekdays?.saturday || "Saturday" },
    { value: 0, label: t?.weekdays?.sunday || "Sunday" },
  ];
  const isNewMode = params.id === "new";
  const requestedStep = clampWizardStep(searchParams.get("step"), 0);
  const yachtId = params.id;
  const { isOnline } = useNetworkStatus();
  const { user } = useClientSession();
  const draftStorageScope = useMemo(
    () => `${role}_${String(user?.id || "guest")}`,
    [role, user?.id],
  );
  const aiMetaStorageKey = useMemo(
    () => `yacht_ai_meta_${draftStorageScope}_${yachtId}`,
    [draftStorageScope, yachtId],
  );
  const completedDraftStorageKey = useMemo(
    () => `yacht_draft_completed_${draftStorageScope}_${yachtId}`,
    [draftStorageScope, yachtId],
  );

  // Offline-first: stable UUID per session for new boats
  const offlineIdRef = useRef<string>("");
  useEffect(() => {
    offlineIdRef.current = generateUUID();
  }, []);

  // Track locally-stored images when offline
  const [offlineImages, setOfflineImages] = useState<
    { key: string; preview: string; file: File }[]
  >([]);

  // Wizard State
  const [activeStep, setActiveStep] = useState<number>(1);
  const showStepOneVideoSection = false;
  const activeVisibleStepIndex = Math.max(
    0,
    visibleWizardSteps.findIndex((step) => step.id === activeStep),
  );
  const suppressCreationToasts = isNewMode && activeStep <= 4;
  const toast = suppressCreationToasts ? suppressedToast : hotToast;
  const {
    draft,
    isLoaded: isDraftLoaded,
    saveStepData,
    debouncedSave,
    setActiveStep: setDraftStep,
    getStepData,
    markStepComplete,
    markStepIncomplete,
    clearDraft,
    flushDraft,
    isStepComplete,
  } = useYachtDraft(yachtId as string, {
    scopeKey: draftStorageScope,
  });
  const getNextVisibleStepId = useCallback(
    (currentStep: number) => {
      const currentIndex = visibleWizardSteps.findIndex(
        (step) => step.id === currentStep,
      );
      if (currentIndex === -1) {
        return visibleWizardSteps[0]?.id ?? currentStep;
      }
      return (
        visibleWizardSteps[
          Math.min(currentIndex + 1, visibleWizardSteps.length - 1)
        ]?.id ?? currentStep
      );
    },
    [visibleWizardSteps],
  );
  const getPreviousVisibleStepId = useCallback(
    (currentStep: number) => {
      const currentIndex = visibleWizardSteps.findIndex(
        (step) => step.id === currentStep,
      );
      if (currentIndex === -1) {
        return visibleWizardSteps[0]?.id ?? currentStep;
      }
      return (
        visibleWizardSteps[Math.max(currentIndex - 1, 0)]?.id ?? currentStep
      );
    },
    [visibleWizardSteps],
  );

  // Form State
  const [selectedYacht, setSelectedYacht] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(!isNewMode);
  const [errors, setErrors] = useState<any>(null);
  const [clientSignhostStatus, setClientSignhostStatus] = useState<
    string | null
  >(null);
  const [clientSignhostUrl, setClientSignhostUrl] = useState<string | null>(
    null,
  );
  const [clientSignhostLoading, setClientSignhostLoading] = useState(false);
  const [reviewActionLoading, setReviewActionLoading] = useState<
    "draft" | "approved" | null
  >(null);
  const [internalReviewSelection, setInternalReviewSelection] = useState<
    "Draft" | "For Sale"
  >("Draft");
  const [boatFormConfigBlocks, setBoatFormConfigBlocks] = useState<
    BoatFormConfigBlock[]
  >([]);

  // Video State
  const [boatVideos, setBoatVideos] = useState<any[]>([]);
  const [marketingVideos, setMarketingVideos] = useState<any[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isGeneratingMarketingVideo, setIsGeneratingMarketingVideo] =
    useState(false);
  const [isPublishingVideo, setIsPublishingVideo] = useState<number | null>(
    null,
  );
  const [deleteVideoDialogOpen, setDeleteVideoDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);

  // Image Pipeline Hook (server-side processing)
  const [createdYachtId, setCreatedYachtId] = useState<number | null>(null);
  const selectedYachtId =
    selectedYacht?.id && Number.isFinite(Number(selectedYacht.id))
      ? Number(selectedYacht.id)
      : undefined;
  const activeYachtId = isNewMode
    ? createdYachtId
      ? String(createdYachtId)
      : null
    : (yachtId as string);
  const localizedYachtsBasePath = useMemo(
    () => `/${locale}/dashboard/${role}/yachts`,
    [locale, role],
  );
  const socialLibraryHref = useMemo(() => {
    const targetId = isNewMode ? createdYachtId || yachtId : yachtId;
    const basePath = `/${locale}/dashboard/${role}/social`;

    return targetId ? `${basePath}?yacht_id=${targetId}` : basePath;
  }, [createdYachtId, isNewMode, locale, role, yachtId]);
  const currentBoatDocumentId = isNewMode ? createdYachtId : yachtId;
  const isPersistedYachtRoute =
    !isNewMode && typeof yachtId === "string" && /^[0-9]+$/.test(yachtId);

  // Gemini Extraction State (Step 1)
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedWizardLocationId, setSelectedWizardLocationId] = useState<number | null>(null);
  const [step1Type, setStep1Type] = useState("");
  const [step1Category, setStep1Category] = useState("");
  const [matchedBoat, setMatchedBoat] = useState<BoatMatchResult | null>(null);
  const [isMatchingBoat, setIsMatchingBoat] = useState(false);

  const pipeline = useImagePipeline(activeYachtId, {
    pausePolling: isExtracting,
  });
  const imagesApproved = pipeline.isStep2Unlocked;
  const [reviewImages, setReviewImages] = useState<ReviewPipelineImage[]>([]);
  const [pendingUploadPreviews, setPendingUploadPreviews] = useState<
    ReviewPipelineImage[]
  >([]);

  useEffect(() => {
    if (!isClientRole || !activeYachtId || activeStep < 5) {
      return;
    }

    let active = true;

    const loadClientSignhostStatus = async () => {
      setClientSignhostLoading(true);
      try {
        const [statusResult, yachtResult] = await Promise.allSettled([
          signhostApi.getYachtStatus(Number(activeYachtId)),
          api.get(`/yachts/${activeYachtId}`),
        ]);
        if (!active) return;

        if (yachtResult.status === "fulfilled") {
          const yacht = yachtResult.value.data;
          setSelectedYacht((previous: Record<string, unknown> | null) => ({
            ...(previous && typeof previous === "object" ? previous : {}),
            ...yacht,
            location_id:
              yacht?.location_id ??
              yacht?.location_id ??
              previous?.location_id ??
              null,
            status:
              normalizeStatusForForm(yacht?.status) ??
              yacht?.status ??
              previous?.status,
          }));
        }

        if (
          statusResult.status === "fulfilled" &&
          statusResult.value.transaction
        ) {
          const liveSummary = latestSignhostFromTransaction(
            statusResult.value.transaction,
          );
          setClientSignhostStatus(liveSummary.status);
          setClientSignhostUrl(liveSummary.client_sign_url);
        } else if (yachtResult.status === "fulfilled") {
          const yachtSummary = normalizeLatestSignhost(
            yachtResult.value.data?.latest_signhost,
          );
          setClientSignhostStatus(yachtSummary.status);
          setClientSignhostUrl(yachtSummary.client_sign_url);
        } else {
          setClientSignhostStatus(null);
          setClientSignhostUrl(null);
        }
      } finally {
        if (active) {
          setClientSignhostLoading(false);
        }
      }
    };

    void loadClientSignhostStatus();
    const interval = window.setInterval(loadClientSignhostStatus, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeStep, activeYachtId, isClientRole]);

  const loadMarketingVideos = useCallback(
    async (targetYachtId: number | string) => {
      try {
        const response = await api.get("/social/videos", {
          params: { yacht_id: Number(targetYachtId) },
        });
        const payload = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.videos)
            ? response.data.videos
            : Array.isArray(response.data?.data?.videos)
              ? response.data.data.videos
              : Array.isArray(response.data?.data)
                ? response.data.data
                : [];

        const nextVideos = payload
          .filter(
            (video: any) =>
              Number(video?.yacht_id ?? video?.boat_id) ===
              Number(targetYachtId),
          )
          .sort(
            (left: any, right: any) =>
              new Date(right?.created_at || 0).getTime() -
              new Date(left?.created_at || 0).getTime(),
          );

        setMarketingVideos((previous: any[]) => {
          const placeholders = previous.filter(
            (video) =>
              Number(video?.id) < 0 &&
              Number(video?.yacht_id ?? video?.boat_id) ===
                Number(targetYachtId),
          );

          return nextVideos.some((video: any) =>
            isVideoGeneratingStatus(video?.status),
          )
            ? nextVideos
            : [...nextVideos, ...placeholders];
        });
      } catch (error) {
        console.error("Failed to fetch marketing videos", error);
      }
    },
    [],
  );

  useEffect(() => {
    const targetId = isNewMode ? createdYachtId : yachtId;
    if (!targetId || marketingVideos.length === 0) return;

    const hasProcessingVideo = marketingVideos.some((video) =>
      isVideoGeneratingStatus(video?.status),
    );

    if (!hasProcessingVideo) return;

    const timer = window.setInterval(() => {
      void loadMarketingVideos(targetId);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [
    createdYachtId,
    isNewMode,
    loadMarketingVideos,
    marketingVideos,
    yachtId,
  ]);
  const [imageGridDensity, setImageGridDensity] =
    useState<ImageGridDensity>("regular");
  const [selectedLightboxImageId, setSelectedLightboxImageId] = useState<
    number | null
  >(null);
  const [isAutoSortingImages, setIsAutoSortingImages] = useState(false);
  const [isReorderingImages, setIsReorderingImages] = useState(false);
  const [deleteAllImagesDialogOpen, setDeleteAllImagesDialogOpen] =
    useState(false);
  const [isDeletingAllImages, setIsDeletingAllImages] = useState(false);
  const [isGeneratingSticker, setIsGeneratingSticker] = useState(false);
  const [failedImagesNavDialogOpen, setFailedImagesNavDialogOpen] = useState(false);
  const [isDeletingFailedImages, setIsDeletingFailedImages] = useState(false);
  const failedImages = useMemo(
    () => pipeline.images.filter((img) => img.status === "processing_failed"),
    [pipeline.images],
  );
  const hasFailedImagesRef = useRef(failedImages.length > 0);
  const [manualSortDialogOpen, setManualSortDialogOpen] = useState(false);
  const [manualSortImages, setManualSortImages] = useState<
    ReviewPipelineImage[]
  >([]);
  const [isSavingManualSort, setIsSavingManualSort] = useState(false);
  const [pipelineImageSourceIndexByKey, setPipelineImageSourceIndexByKey] =
    useState<Record<string, number>>({});

  // Legacy staging for non-image features (Main Profile etc)
  const [aiStaging, setAiStaging] = useState<AiStagedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const lastSuccessfulExtractionSignatureRef = useRef<string | null>(null);
  const hasInFlightImageUploads = isUploading || pipeline.isUploading;
  const persistedPipelineImages = useMemo(
    () => pipeline.images.filter((image) => image.id > 0),
    [pipeline.images],
  );
  const currentPipelineExtractionSignature = useMemo(() => {
    const targetId = isNewMode ? createdYachtId : yachtId;
    if (
      !targetId ||
      targetId === "new" ||
      persistedPipelineImages.length === 0
    ) {
      return null;
    }

    return `${targetId}:${persistedPipelineImages
      .map(
        (image) =>
          `${image.id}:${String(image.status ?? "")}:${String(image.updated_at ?? "")}`,
      )
      .join("|")}`;
  }, [createdYachtId, isNewMode, persistedPipelineImages, yachtId]);
  const shouldRefreshAiExtraction =
    currentPipelineExtractionSignature !== null &&
    lastSuccessfulExtractionSignatureRef.current !==
      currentPipelineExtractionSignature;
  const approvedMarketingImageIds = useMemo(
    () =>
      persistedPipelineImages
        .filter((image) => image.status === "approved")
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((image) => image.id),
    [persistedPipelineImages],
  );
  const canManualSortImages = persistedPipelineImages.length > 1;
  const displayReadyForReviewCount = persistedPipelineImages.filter(
    (image) => image.status === "ready_for_review",
  ).length;
  const displayApprovedCount = persistedPipelineImages.filter(
    (image) => image.status === "approved",
  ).length;
  const displayProcessingCount =
    persistedPipelineImages.filter((image) =>
      ["queued", "pending", "processing", "rendering"].includes(
        String(image.status || "").toLowerCase(),
      ),
    ).length + pendingUploadPreviews.length;
  const normalizedClientBoatStatus = String(
    selectedYacht?.status || "",
  ).toLowerCase();
  const clientBoatApproved = [
    "active",
    "for sale",
    "for_sale",
    "sold",
    "published",
  ].includes(normalizedClientBoatStatus);
  const initialClientSignhost = normalizeLatestSignhost(
    selectedYacht?.latest_signhost,
  );
  const normalizedClientContractStatus = normalizeClientContractStatus(
    clientSignhostStatus || initialClientSignhost.status,
  );
  const effectiveClientSignhostUrl =
    clientSignhostUrl || initialClientSignhost.client_sign_url;
  const clientContractStatusKey =
    normalizedClientContractStatus === "signed"
      ? "clientReviewContractSigned"
      : normalizedClientContractStatus === "signing"
        ? "clientReviewContractSent"
        : normalizedClientContractStatus === "failed"
          ? "clientReviewContractFailed"
          : "clientReviewContractWaiting";
  const clientContractDescriptionKey =
    normalizedClientContractStatus === "signed"
      ? "clientReviewContractSignedDescription"
      : normalizedClientContractStatus === "signing"
        ? "clientReviewContractSentDescription"
        : normalizedClientContractStatus === "failed"
          ? "clientReviewContractFailedDescription"
          : normalizedClientContractStatus === "waiting_invite"
            ? "clientReviewContractWaitingDescription"
            : "clientReviewStatusDescription";
  const internalReviewApproved = clientBoatApproved;
  const internalReviewStatusKey = internalReviewApproved
    ? "internalReviewApproved"
    : "internalReviewPending";
  const handleOpenClientSignhost = useCallback(() => {
    if (!effectiveClientSignhostUrl) {
      return;
    }

    window.open(effectiveClientSignhostUrl, "_blank", "noopener,noreferrer");
  }, [effectiveClientSignhostUrl]);
  const displayTotalImageCount =
    persistedPipelineImages.length + pendingUploadPreviews.length;
  const shouldShowImageUploadDropzone =
    reviewImages.length === 0 || hasInFlightImageUploads;
  const shouldShowImageGrid = reviewImages.length > 0;
  const selectedYachtStatusForForm = isNewMode
    ? normalizeStatusForNewYacht(selectedYacht?.status, isClientRole)
    : (normalizeStatusForForm(selectedYacht?.status) ??
      selectedYacht?.status ??
      "Draft");

  useEffect(() => {
    setInternalReviewSelection(internalReviewApproved ? "For Sale" : "Draft");
  }, [internalReviewApproved]);

  // AI Pipeline State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (suppressCreationToasts) {
      hotToast.dismiss();
    }
  }, [suppressCreationToasts]);

  useEffect(() => {
    hasFailedImagesRef.current = failedImages.length > 0;
  }, [failedImages.length]);

  const [isApprovingAllImages, setIsApprovingAllImages] = useState(false);

  // Gemini Extraction State (Step 1)
  const handleAiExtractRef = useRef<
    ((
      options?: {
        background?: boolean;
        navigateToStep2?: boolean;
        speedMode?: "fast" | "balanced" | "deep";
      },
    ) => Promise<boolean>) | null
  >(null);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [geminiExtracted, setGeminiExtracted] = useState(false);
  const hasCompletedAiExtraction = useMemo(() => {
    if (!geminiExtracted) {
      return false;
    }

    return Object.values(toObjectRecord(extractionResult)).some(
      (value) => sanitizeScalarFieldValue(value) !== null,
    );
  }, [extractionResult, geminiExtracted]);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractionType, setExtractionType] = useState<"gemini" | "magic">(
    "gemini",
  );
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Correction feedback loop state
  const [fieldCorrectionLabels, setFieldCorrectionLabels] = useState<
    Record<string, CorrectionLabel | null>
  >({});
  const handleFieldCorrectionLabelChange = useCallback(
    (fieldName: string, label: CorrectionLabel | null) => {
      setFieldCorrectionLabels((previous) => ({
        ...previous,
        [fieldName]: label,
      }));
    },
    [],
  );
  const [confidenceMeta, setConfidenceMeta] = useState<ConfidenceMeta | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem(aiMetaStorageKey);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },
  );
  const [correctionLabel, setCorrectionLabel] =
    useState<CorrectionLabel | null>(null);

  // Persist confidenceMeta to localStorage immediately (no debounce)
  useEffect(() => {
    if (!yachtId) return;
    if (confidenceMeta) {
      localStorage.setItem(aiMetaStorageKey, JSON.stringify(confidenceMeta));
    } else {
      localStorage.removeItem(aiMetaStorageKey);
    }
  }, [aiMetaStorageKey, confidenceMeta, yachtId]);

  // New AI UI Feedback States
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [extractionCountdown, setExtractionCountdown] = useState(
    EXTRACTION_ESTIMATED_DURATION_SECONDS,
  );
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Locations
  const [locations, setLocations] = useState<any[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);
  const currentUserLocationId = useMemo(() => {
    const rawValue =
      user?.client_location_id ??
      user?.client_location?.id ??
      user?.location_id ??
      user?.location?.id ??
      user?.locations?.[0]?.id ??
      null;

    if (
      rawValue === null ||
      rawValue === undefined ||
      (rawValue as any) === ""
    ) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [
    user?.client_location_id,
    user?.client_location?.id,
    user?.location_id,
    user?.location?.id,
    user?.locations?.[0]?.id,
  ]);

  // Debounced boat matching: search DB when brand+model change
  useEffect(() => {
    if (step1Brand.trim().length < 2) {
      setMatchedBoat(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsMatchingBoat(true);
        const result = await matchBoat({
          brand: step1Brand.trim(),
          model: step1Model.trim() || undefined,
          year: step1Year ? Number(step1Year) : undefined,
        });
        setMatchedBoat(result);
      } catch (err) {
        console.error("[BoatMatch] Failed:", err);
        setMatchedBoat(null);
      } finally {
        setIsMatchingBoat(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [step1Brand, step1Model, step1Year]);

  const currentUserLocationCode = useMemo(
    () =>
      user?.client_location?.code ??
      user?.location?.code ??
      user?.locations?.[0]?.code ??
      null,
    [
      user?.client_location?.code,
      user?.location?.code,
      user?.locations?.[0]?.code,
    ],
  );
  const currentUserLocationName = useMemo(
    () =>
      user?.client_location?.name ??
      user?.location?.name ??
      user?.locations?.[0]?.name ??
      null,
    [
      user?.client_location?.name,
      user?.location?.name,
      user?.locations?.[0]?.name,
    ],
  );
  const preferredLocationId = useMemo(() => {
    if (locations.length === 0) {
      return null;
    }

    const normalizeText = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase();

    const byId =
      currentUserLocationId !== null
        ? locations.find(
            (location: any) => Number(location?.id) === currentUserLocationId,
          )
        : null;

    const normalizedCode = normalizeText(currentUserLocationCode);
    const byCode =
      !byId && normalizedCode
        ? locations.find(
            (location: any) => normalizeText(location?.code) === normalizedCode,
          )
        : null;

    const normalizedName = normalizeText(currentUserLocationName);
    const byName =
      !byId && !byCode && normalizedName
        ? locations.find(
            (location: any) => normalizeText(location?.name) === normalizedName,
          )
        : null;

    const fallbackLocation = locations.length === 1 ? locations[0] : null;
    const nextLocationId =
      byId?.id ?? byCode?.id ?? byName?.id ?? fallbackLocation?.id ?? null;

    if (nextLocationId === null || nextLocationId === undefined) {
      return null;
    }

    const parsed = Number(nextLocationId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [
    currentUserLocationCode,
    currentUserLocationId,
    currentUserLocationName,
    locations,
  ]);
  const effectiveLocationId =
    selectedYacht?.location_id ??
    preferredLocationId ??
    currentUserLocationId ??
    null;
  const bootstrapDraftLocationId = useMemo(() => {
    if (
      effectiveLocationId === null ||
      effectiveLocationId === undefined
    ) {
      return null;
    }

    const parsed = Number(effectiveLocationId);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : null;
  }, [effectiveLocationId]);
  const hasSelectedLocation = hasFilledFieldValue(effectiveLocationId);
  const isLocationSelectionBlocking = !isClientRole && !hasSelectedLocation;
  const draftBoatType =
    (draft?.data as any)?.step2?.selectedYacht?.boat_type ?? null;
  const boatTypeForConfig = selectedYacht?.boat_type ?? draftBoatType ?? null;
  const createBootstrapDraftYacht = useCallback(async () => {
    const fd = new FormData();
    fd.append("status", "draft");

    if (bootstrapDraftLocationId) {
      fd.append("location_id", bootstrapDraftLocationId);
    }

    const createRes = await api.post("/yachts", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const nextId = Number(createRes.data?.id);

    if (!Number.isFinite(nextId) || nextId <= 0) {
      throw new Error("Failed to initialize draft vessel.");
    }

    setCreatedYachtId(nextId);
    return nextId;
  }, [bootstrapDraftLocationId]);
  const boatFormFieldHelpMap = useMemo(() => {
    const nextMap = new Map<string, string>();

    boatFormConfigBlocks.forEach((block) => {
      [...block.primary_fields, ...block.secondary_fields].forEach((field) => {
        const helpText = field.help_text?.trim();
        if (!helpText) return;

        nextMap.set(field.internal_key, helpText);

        if (field.storage_column) {
          nextMap.set(field.storage_column, helpText);
        }
      });
    });

    return nextMap;
  }, [boatFormConfigBlocks]);
  const buildGenericFieldHelpText = useCallback(
    (
      label: string,
      kind: "text" | "number" | "select" | "textarea" = "text",
    ) => {
      const normalizedLabel =
        label.replace(/\s*\*+\s*$/, "").trim() || "this field";

      if (kind === "number") {
        if (locale === "nl") {
          return `Vul de numerieke waarde in voor ${normalizedLabel}. Laat dit veld leeg als de informatie onbekend is.`;
        }
        if (locale === "de") {
          return `Geben Sie den numerischen Wert fur ${normalizedLabel} ein. Lassen Sie das Feld leer, wenn die Angabe unbekannt ist.`;
        }
        return `Enter the numeric value for ${normalizedLabel}. Leave this field empty if the information is unknown.`;
      }

      if (kind === "select") {
        if (locale === "nl") {
          return `Kies de optie die het beste past bij ${normalizedLabel} voor deze boot.`;
        }
        if (locale === "de") {
          return `Wahlen Sie die Option, die am besten zu ${normalizedLabel} fur dieses Boot passt.`;
        }
        return `Choose the option that best matches ${normalizedLabel} for this boat.`;
      }

      if (kind === "textarea") {
        if (locale === "nl") {
          return `Beschrijf hier de relevante informatie voor ${normalizedLabel}.`;
        }
        if (locale === "de") {
          return `Beschreiben Sie hier die relevanten Angaben zu ${normalizedLabel}.`;
        }
        return `Describe the relevant information for ${normalizedLabel} here.`;
      }

      if (locale === "nl") {
        return `Vul de informatie in voor ${normalizedLabel}. Laat dit veld leeg als de informatie niet beschikbaar is.`;
      }
      if (locale === "de") {
        return `Tragen Sie die Angabe fur ${normalizedLabel} ein. Lassen Sie das Feld leer, wenn die Information nicht verfugbar ist.`;
      }
      return `Enter the information for ${normalizedLabel}. Leave this field empty if the information is not available.`;
    },
    [locale],
  );
  const resolveFieldHelpText = useCallback(
    (
      fieldName: string,
      label: string,
      kind: "text" | "number" | "select" | "textarea" = "text",
    ) =>
      boatFormFieldHelpMap.get(fieldName) ||
      step2HelpText[fieldName as keyof typeof step2HelpText] ||
      buildGenericFieldHelpText(label, kind),
    [boatFormFieldHelpMap, buildGenericFieldHelpText, step2HelpText],
  );
  const accommodationConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "interior",
        "accommodation",
        "accommodation_facilities",
      ]),
    [boatFormConfigBlocks],
  );
  const hullConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "hull",
        "hull_dimensions",
        "general_hull",
        "dimensions",
      ]),
    [boatFormConfigBlocks],
  );
  const engineConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "engine",
        "engine_performance",
        "propulsion",
      ]),
    [boatFormConfigBlocks],
  );
  const navigationConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "navigation",
        "navigation_electronics",
        "electronics",
        "navigation_equipment",
      ]),
    [boatFormConfigBlocks],
  );
  const safetyConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "safety",
        "safety_equipment",
      ]),
    [boatFormConfigBlocks],
  );
  const electricalConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "electrical",
        "electrical_system",
      ]),
    [boatFormConfigBlocks],
  );
  const comfortConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "comfort",
        "kitchen_comfort",
        "kitchen",
        "galley",
      ]),
    [boatFormConfigBlocks],
  );
  const deckConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, ["deck", "deck_equipment"]),
    [boatFormConfigBlocks],
  );
  const riggingConfigBlock = useMemo(
    () =>
      findBoatFormConfigBlock(boatFormConfigBlocks, [
        "rigging",
        "rigging_sails",
        "sails",
      ]),
    [boatFormConfigBlocks],
  );
  const shouldUseDynamicAccommodationBlock = hasRenderableBoatFormBlock(
    accommodationConfigBlock,
  );
  const shouldUseDynamicHullBlock = hasRenderableBoatFormBlock(hullConfigBlock);
  const shouldUseDynamicEngineBlock =
    hasRenderableBoatFormBlock(engineConfigBlock);
  const shouldUseDynamicNavigationBlock = hasRenderableBoatFormBlock(
    navigationConfigBlock,
  );
  const shouldUseDynamicSafetyBlock =
    hasRenderableBoatFormBlock(safetyConfigBlock);
  const shouldUseDynamicElectricalBlock = hasRenderableBoatFormBlock(
    electricalConfigBlock,
  );
  const shouldUseDynamicComfortBlock =
    hasRenderableBoatFormBlock(comfortConfigBlock);
  const shouldUseDynamicDeckBlock = hasRenderableBoatFormBlock(deckConfigBlock);
  const shouldUseDynamicRiggingBlock =
    hasRenderableBoatFormBlock(riggingConfigBlock);

  const yachtSubmitFieldNames = useMemo(() => {
    const staticFieldNames = [
      "year",
      "status",
      "loa",
      "lwl",
      "where",
      "vessel_lying",
      "location_city",
      "location_lat",
      "location_lng",
      "passenger_capacity",
      "beam",
      "draft",
      "air_draft",
      "displacement",
      "hull_type",
      "hull_construction",
      "hull_colour",
      "hull_number",
      "designer",
      "builder",
      "engine_manufacturer",
      "engine_model",
      "engine_type",
      "engine_quantity",
      "engine_year",
      "horse_power",
      "hours",
      "fuel",
      "max_speed",
      "cruising_speed",
      "drive_type",
      "propulsion",
      "gallons_per_hour",
      "tankage",
      "cabins",
      "berths",
      "toilet",
      "shower",
      "bath",
      "heating",
      "cockpit_type",
      "control_type",
      "external_url",
      "print_url",
      "owners_comment",
      "reg_details",
      "known_defects",
      "last_serviced",
      "super_structure_colour",
      "super_structure_construction",
      "deck_colour",
      "deck_construction",
      "ballast",
      "stern_thruster",
      "bow_thruster",
      "starting_type",
      "manufacturer",
      "model",
      "boat_type",
      "boat_category",
      "new_or_used",
      "ce_category",
      "location_id",
      "anchor",
      "anchor_winch",
      "bimini",
      "spray_hood",
      "swimming_platform",
      "swimming_ladder",
      "teak_deck",
      "cockpit_table",
      "dinghy",
      "trailer",
      "covers",
      "spinnaker",
      "fenders",
      "life_jackets",
      "radar_reflector",
      "flares",
      "shorepower",
      "solar_panel",
      "wind_generator",
      "voltage",
      "satellite_reception",
      "short_description_en",
      "short_description_nl",
      "short_description_de",
      "short_description_fr",
      "compass",
      "gps",
      "radar",
      "fishfinder",
      "autopilot",
      "vhf",
      "plotter",
      "depth_instrument",
      "wind_instrument",
      "speed_instrument",
      "navigation_lights",
      "life_raft",
      "epirb",
      "fire_extinguisher",
      "bilge_pump",
      "mob_system",
      "battery",
      "battery_charger",
      "generator",
      "inverter",
      "television",
      "cd_player",
      "dvd_player",
      "oven",
      "microwave",
      "fridge",
      "freezer",
      "cooker",
    ];

    const configuredFieldNames = boatFormConfigBlocks.flatMap((block) =>
      [...block.primary_fields, ...block.secondary_fields].map(
        (field) => field.internal_key,
      ),
    );

    return Array.from(
      new Set([...staticFieldNames, ...configuredFieldNames]),
    );
  }, [boatFormConfigBlocks]);

  const canProceedFromStep1 =
    !isNewMode || (!isOnline && offlineImages.length > 0) || imagesApproved;
  const areReviewPrerequisitesComplete = [1, 2, 3, 4].every((stepId) =>
    isStepComplete(stepId),
  );

  // AI Text State (Tab 3)
  const [aiTexts, setAiTexts] = useState<DescriptionTextState>({
    nl: "",
    en: "",
    de: "",
    fr: "",
  });
  const [selectedLang, setSelectedLang] = useState<DescriptionLanguage>("nl");

  // AI Tone Settings & Speech
  const [aiTone, setAiTone] = useState("professional");
  const [aiMinWords, setAiMinWords] = useState<number | "">(200);
  const [aiMaxWords, setAiMaxWords] = useState<number | "">(500);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const lastDescriptionRequestSignatureRef = useRef<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isDictating, setIsDictating] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const descriptionFormValues = useMemo(
    () => buildDescriptionFormValues(selectedYacht),
    [selectedYacht],
  );
  const descriptionRequestSignature = useMemo(
    () =>
      buildDescriptionRequestSignature(
        descriptionFormValues,
        aiTone,
        aiMinWords,
        aiMaxWords,
      ),
    [descriptionFormValues, aiTone, aiMinWords, aiMaxWords],
  );
  const hasDescriptionContext = useMemo(() => {
    const keys = Object.keys(descriptionFormValues);
    return (
      keys.length >= 5 ||
      Boolean(
        descriptionFormValues.boat_name ||
        descriptionFormValues.manufacturer ||
        descriptionFormValues.model ||
        descriptionFormValues.boat_type ||
        descriptionFormValues.boat_category,
      )
    );
  }, [descriptionFormValues]);
  const needsAutoDescriptionGeneration = useMemo(
    () => hasThinDescriptions(aiTexts),
    [aiTexts],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = false;
        recog.onresult = (event: any) => {
          const transcript =
            event.results[event.results.length - 1][0].transcript;
          setAiTexts((prev) => ({
            ...prev,
            [selectedLang]: prev[selectedLang] + " " + transcript,
          }));
        };
        recog.onend = () => setIsDictating(false);
        setRecognition(recog);
      }
    }
  }, [selectedLang]);

  useEffect(() => {
    setPendingUploadPreviews((previous) => {
      if (previous.length === 0) return previous;

      const pipelineCounts = new Map<string, number>();
      pipeline.images
        .filter((image) => image.id > 0)
        .forEach((image) => {
          const key = normalizePipelineImageName(image.original_name);
          pipelineCounts.set(key, (pipelineCounts.get(key) || 0) + 1);
        });

      const nextPending: ReviewPipelineImage[] = [];
      previous.forEach((image) => {
        const key = normalizePipelineImageName(image.original_name);
        const availableCount = pipelineCounts.get(key) || 0;
        if (availableCount > 0) {
          pipelineCounts.set(key, availableCount - 1);
        } else {
          nextPending.push(image);
        }
      });

      return nextPending;
    });
  }, [pipeline.images]);

  useEffect(() => {
    setReviewImages([
      ...pipeline.images,
      ...pendingUploadPreviews.filter(
        (image) =>
          !pipeline.images.some((existing) => existing.id === image.id),
      ),
    ]);
  }, [pendingUploadPreviews, pipeline.images]);

  useEffect(() => {
    if (!manualSortDialogOpen) {
      setManualSortImages(persistedPipelineImages);
    }
  }, [manualSortDialogOpen, persistedPipelineImages]);

  useEffect(() => {
    if (!isDraftLoaded) return;

    if (!areReviewPrerequisitesComplete) {
      if (isStepComplete(5)) {
        markStepIncomplete(5);
      }
      return;
    }

    if (activeStep === 5 && !isStepComplete(5)) {
      markStepComplete(5);
    }
  }, [
    activeStep,
    areReviewPrerequisitesComplete,
    isDraftLoaded,
    isStepComplete,
    markStepComplete,
    markStepIncomplete,
  ]);

  // Availability State
  const [availabilityRules, setAvailabilityRules] = useState<
    AvailabilityRule[]
  >([]);

  const schedulingSettings = useMemo(
    () => ({
      booking_min_notice_days: normalizeSchedulingSelectValue(
        selectedYacht?.booking_min_notice_days,
        DEFAULT_SCHEDULING_SETTINGS.booking_min_notice_days,
      ),
      booking_max_days_ahead: normalizeSchedulingSelectValue(
        selectedYacht?.booking_max_days_ahead,
        DEFAULT_SCHEDULING_SETTINGS.booking_max_days_ahead,
      ),
      booking_duration_minutes: normalizeSchedulingSelectValue(
        selectedYacht?.booking_duration_minutes,
        DEFAULT_SCHEDULING_SETTINGS.booking_duration_minutes,
      ),
      booking_max_appointments_per_day:
        selectedYacht?.booking_max_appointments_per_day === 0
          ? "unlimited"
          : normalizeSchedulingSelectValue(
            selectedYacht?.booking_max_appointments_per_day,
            DEFAULT_SCHEDULING_SETTINGS.booking_max_appointments_per_day,
          ),
      booking_requires_manual_approval: normalizeSchedulingBooleanValue(
        selectedYacht?.booking_requires_manual_approval,
        DEFAULT_SCHEDULING_SETTINGS.booking_requires_manual_approval,
      ),
      booking_send_confirmation_email: normalizeSchedulingBooleanValue(
        selectedYacht?.booking_send_confirmation_email,
        DEFAULT_SCHEDULING_SETTINGS.booking_send_confirmation_email,
      ),
      booking_allow_instant: normalizeSchedulingBooleanValue(
        selectedYacht?.booking_allow_instant,
        DEFAULT_SCHEDULING_SETTINGS.booking_allow_instant,
      ),
      booking_allow_rescheduling: normalizeSchedulingBooleanValue(
        selectedYacht?.booking_allow_rescheduling,
        DEFAULT_SCHEDULING_SETTINGS.booking_allow_rescheduling,
      ),
      booking_reschedule_cutoff_hours:
        selectedYacht?.booking_reschedule_cutoff_hours === 0
          ? "none"
          : normalizeSchedulingSelectValue(
            selectedYacht?.booking_reschedule_cutoff_hours,
            DEFAULT_SCHEDULING_SETTINGS.booking_reschedule_cutoff_hours,
          ),
      booking_allow_cancellations: normalizeSchedulingBooleanValue(
        selectedYacht?.booking_allow_cancellations,
        DEFAULT_SCHEDULING_SETTINGS.booking_allow_cancellations,
      ),
      booking_cancellation_cutoff_hours:
        selectedYacht?.booking_cancellation_cutoff_hours === 0
          ? "none"
          : normalizeSchedulingSelectValue(
            selectedYacht?.booking_cancellation_cutoff_hours,
            DEFAULT_SCHEDULING_SETTINGS.booking_cancellation_cutoff_hours,
          ),
    }),
    [selectedYacht],
  );

  const schedulingPreview = useMemo(
    () =>
      buildSchedulingPreviewDays(
        availabilityRules,
        Number(schedulingSettings.booking_min_notice_days),
        Number(schedulingSettings.booking_max_days_ahead),
        Number(schedulingSettings.booking_duration_minutes),
      ),
    [availabilityRules, schedulingSettings],
  );

  const updateSchedulingSetting = (field: string, value: string | boolean) => {
    setSelectedYacht((prev: any) => ({
      ...(prev || {}),
      [field]: value,
    }));
  };

  // Location Defaults State
  const [locationDefaults, setLocationDefaults] = useState<{
    opening_hours_start: string;
    opening_hours_end: string;
  } | null>(null);

  // Document + Checklist State
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [boatDocuments, setBoatDocuments] = useState<BoatDocumentItem[]>([]);
  const [marktplaatsListing, setMarktplaatsListing] =
    useState<MarktplaatsListingState>(DEFAULT_MARKTPLAATS_LISTING_STATE);
  const [selectedPublicationPlatforms, setSelectedPublicationPlatforms] =
    useState<string[]>([]);
  const [isSavingMarktplaatsListing, setIsSavingMarktplaatsListing] =
    useState(false);
  const [isRunningMarktplaatsAction, setIsRunningMarktplaatsAction] =
    useState<string | null>(null);
  const sellerPublicationOptions = SELLER_PUBLICATION_OPTIONS;
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentDropTarget, setDocumentDropTarget] =
    useState<BoatDocumentType | null>(null);
  const [fetchingChecklist, setFetchingChecklist] = useState(false);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] =
    useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);
  const referenceBoatDocuments = useMemo(
    () =>
      boatDocuments.filter(
        (document) => document.document_type === "ai_reference",
      ),
    [boatDocuments],
  );
  const complianceBoatDocuments = useMemo(
    () =>
      boatDocuments.filter(
        (document) => document.document_type !== "ai_reference",
      ),
    [boatDocuments],
  );

  const normalizeMarktplaatsListing = useCallback(
    (raw?: any): MarktplaatsListingState => {
      if (!raw) {
        return DEFAULT_MARKTPLAATS_LISTING_STATE;
      }

      return {
        channel_name: "marktplaats",
        id: raw.id ?? null,
        is_enabled: Boolean(raw.is_enabled),
        auto_publish: Boolean(raw.auto_publish),
        status: String(raw.status || "draft"),
        external_id: raw.external_id || null,
        external_url: raw.external_url || raw.capabilities?.feed_url || null,
        last_sync_at: raw.last_sync_at || null,
        last_error_message: raw.last_error_message || null,
        last_validation_errors_json: Array.isArray(
          raw.last_validation_errors_json,
        )
          ? raw.last_validation_errors_json
          : null,
        settings_json: {
          marktplaats_promoted: Boolean(
            raw.settings_json?.marktplaats_promoted ?? false,
          ),
          marktplaats_budget_type: String(
            raw.settings_json?.marktplaats_budget_type || "cpc",
          ),
          marktplaats_cpc_bid: raw.settings_json?.marktplaats_cpc_bid ?? "",
          marktplaats_target_views:
            raw.settings_json?.marktplaats_target_views ?? "",
        },
        capabilities: raw.capabilities || null,
      };
    },
    [],
  );

  const fetchMarktplaatsListing = useCallback(
    async (targetYachtId: string | number) => {
      const res = await api.get(`/yachts/${targetYachtId}/channel-listings`);
      const listings = Array.isArray(res.data) ? res.data : [];
      const next = listings.find(
        (entry: any) => entry?.channel_name === "marktplaats",
      );
      setMarktplaatsListing(normalizeMarktplaatsListing(next));
    },
    [normalizeMarktplaatsListing],
  );

  const persistMarktplaatsListing = useCallback(
    async (targetYachtId: string | number) => {
      setIsSavingMarktplaatsListing(true);
      try {
        const payload = {
          is_enabled: marktplaatsListing.is_enabled,
          auto_publish: marktplaatsListing.auto_publish,
          settings_json: {
            marktplaats_promoted: Boolean(
              marktplaatsListing.settings_json?.marktplaats_promoted,
            ),
            marktplaats_budget_type:
              marktplaatsListing.settings_json?.marktplaats_budget_type ||
              "cpc",
            marktplaats_cpc_bid:
              marktplaatsListing.settings_json?.marktplaats_cpc_bid === ""
                ? null
                : Number(marktplaatsListing.settings_json?.marktplaats_cpc_bid),
            marktplaats_target_views:
              marktplaatsListing.settings_json?.marktplaats_target_views === ""
                ? null
                : Number(
                    marktplaatsListing.settings_json?.marktplaats_target_views,
                  ),
          },
        };

        const res = await api.put(
          `/yachts/${targetYachtId}/channel-listings/marktplaats`,
          payload,
        );
        setMarktplaatsListing(
          normalizeMarktplaatsListing({ ...marktplaatsListing, ...res.data }),
        );
        await fetchMarktplaatsListing(targetYachtId);
      } finally {
        setIsSavingMarktplaatsListing(false);
      }
    },
    [fetchMarktplaatsListing, marktplaatsListing, normalizeMarktplaatsListing],
  );

  const runMarktplaatsAction = useCallback(
    async (action: "retry" | "pause" | "remove" | "sync") => {
      const targetId = activeYachtId;
      if (!targetId) return;

      setIsRunningMarktplaatsAction(action);
      try {
        await api.post(
          `/yachts/${targetId}/channel-listings/marktplaats/${action}`,
        );
        await fetchMarktplaatsListing(targetId);
        toast.success(`Marktplaats ${action} requested.`);
      } catch (error: any) {
        console.error(`Failed to ${action} Marktplaats listing`, error);
        toast.error(
          error?.response?.data?.message ||
            `Failed to ${action} Marktplaats listing.`,
        );
      } finally {
        setIsRunningMarktplaatsAction(null);
      }
    },
    [activeYachtId, fetchMarktplaatsListing, toast],
  );

  useEffect(() => {
    if (!currentBoatDocumentId) {
      if (isNewMode) {
        setBoatDocuments([]);
      }
      return;
    }

    let isCancelled = false;

    const fetchBoatDocuments = async () => {
      try {
        const docsRes = await api.get(
          `/yachts/${currentBoatDocumentId}/documents`,
        );
        if (!isCancelled) {
          setBoatDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load boat documents", error);
        }
      }
    };

    void fetchBoatDocuments();

    return () => {
      isCancelled = true;
    };
  }, [currentBoatDocumentId, isNewMode]);

  // Fetch Checklist Templates for Step 5
  useEffect(() => {
    if (activeStep === 5) {
      const fetchComplianceData = async () => {
        setFetchingChecklist(true);
        try {
          const typeId =
            selectedYacht?.boat_type_id ||
            (draft?.data as any)?.step2?.selectedYacht?.boat_type_id ||
            "";
          const templatesRes = await api.get(
            `/checklists/templates?boat_type_id=${typeId}`,
          );
          setChecklistTemplates(templatesRes.data);
        } catch (e) {
          console.error("Failed to load compliance data", e);
        } finally {
          setFetchingChecklist(false);
        }
      };
      fetchComplianceData();
    }
  }, [
    activeStep,
    selectedYacht?.boat_type_id,
    (draft?.data as any)?.boat_type_id,
  ]);

  useEffect(() => {
    if (!activeYachtId) {
      setMarktplaatsListing(DEFAULT_MARKTPLAATS_LISTING_STATE);
      return;
    }

    fetchMarktplaatsListing(activeYachtId).catch((error) => {
      console.error("Failed to fetch Marktplaats channel listing", error);
    });
  }, [activeYachtId, fetchMarktplaatsListing]);

  // Location defaults are currently handled by createDefaultAvailabilityRules with hardcoded fallbacks
  // until the backend locations table supports opening_hours.

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setIsLocationsLoading(true);
        const res = await api.get("/public/locations");
        const list = res.data || [];
        setLocations(list);
      } catch (err) {
        console.error("Failed to fetch locations", err);
      } finally {
        setIsLocationsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!isNewMode || preferredLocationId === null) {
      return;
    }

    setSelectedYacht((prev: any) => {
      if (hasFilledFieldValue(prev?.location_id)) {
        return prev;
      }

      return {
        ...(prev ?? {}),
        location_id: preferredLocationId,
      };
    });
  }, [isNewMode, preferredLocationId]);

  useEffect(() => {
    if (!isClientRole || activeStep !== 4) {
      return;
    }

    setActiveStep(5);
    setDraftStep(5);
  }, [activeStep, isClientRole, setDraftStep]);

  useEffect(() => {
    const selectedLocationId = Number(
      selectedYacht?.location_id ?? preferredLocationId ?? null,
    );

    if (!Number.isFinite(selectedLocationId) || selectedLocationId <= 0) {
      return;
    }

    const extractDefaults = (payload: any) => {
      const settings = payload?.settings ?? payload?.data?.settings ?? payload;
      const startValue = settings?.opening_hours_start
        ? String(settings.opening_hours_start)
        : "";
      const endValue = settings?.opening_hours_end
        ? String(settings.opening_hours_end)
        : "";

      if (!startValue && !endValue) {
        return null;
      }

      return {
        opening_hours_start: (startValue || "09:00").substring(0, 5),
        opening_hours_end: (endValue || "17:00").substring(0, 5),
      };
    };

    const selectedLocation = locations.find(
      (location: any) => Number(location?.id) === selectedLocationId,
    );
    const localDefaults =
      extractDefaults(selectedLocation?.booking_settings) ||
      extractDefaults(selectedLocation?.settings) ||
      extractDefaults(selectedLocation);

    if (localDefaults) {
      setLocationDefaults(localDefaults);
    }

    let cancelled = false;

    const fetchBookingDefaults = async () => {
      const candidatePaths = [
        `/public/locations/${selectedLocationId}/booking-settings`,
        `/locations/${selectedLocationId}/booking-settings`,
        `/admin/locations/${selectedLocationId}/booking-settings`,
      ];

      for (const path of candidatePaths) {
        try {
          const response = await api.get(path);
          const defaults = extractDefaults(response.data);
          if (defaults && !cancelled) {
            setLocationDefaults(defaults);
            return;
          }
        } catch {
          // Different environments expose different booking-settings routes.
        }
      }
    };

    void fetchBookingDefaults();

    return () => {
      cancelled = true;
    };
  }, [locations, preferredLocationId, selectedYacht?.location_id]);

  useEffect(() => {
    let active = true;

    const fetchBoatFormConfig = async () => {
      try {
        const config = await getBoatFormConfig({
          boatType: boatTypeForConfig,
          step: "specs",
          locale,
        });

        if (!active) return;
        setBoatFormConfigBlocks(config.blocks ?? []);
      } catch (error) {
        if (!active) return;
        setBoatFormConfigBlocks([]);
        console.warn("Failed to load boat form config", error);
      }
    };

    void fetchBoatFormConfig();

    return () => {
      active = false;
    };
  }, [boatTypeForConfig, locale]);

  // Initial Empty State Population for Step 4 / client auto-applied planning defaults
  useEffect(() => {
    if (
      (activeStep === 4 || isClientRole) &&
      availabilityRules.length === 0 &&
      locationDefaults
    ) {
      setAvailabilityRules([
        ...createDefaultAvailabilityRules(locationDefaults),
      ]);
    }
  }, [activeStep, availabilityRules.length, locationDefaults, isClientRole]);

  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const restoredDraftRef = useRef(false);
  const serverDraftVersionRef = useRef<number | null>(null);
  const lastServerDraftSnapshotRef = useRef<string | null>(null);
  const syncingServerDraftRef = useRef(false);
  const serverSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const serverDraftInitializedRef = useRef(false);
  const serverDraftBootstrapInFlightRef = useRef(false);
  const localPreviewUrlsRef = useRef<Set<string>>(new Set());
  const verifiedDraftYachtIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNewMode || !selectedYacht || typeof selectedYacht !== "object") {
      return;
    }

    const nextStatus = normalizeStatusForNewYacht(
      selectedYacht.status,
      isClientRole,
    );
    const currentStatus =
      normalizeStatusForForm(selectedYacht.status) ?? selectedYacht.status;

    if (currentStatus === nextStatus) {
      return;
    }

    setSelectedYacht((previous: any) => ({
      ...(previous && typeof previous === "object" ? previous : {}),
      status: nextStatus,
    }));
    setFormKey((current) => current + 1);
  }, [isClientRole, isNewMode, selectedYacht?.status, yachtId]);

  // Restore draft payload for new-yacht flow once.
  useEffect(() => {
    if (!isDraftLoaded || !isNewMode || restoredDraftRef.current) return;

    const step1 = getStepData(1);
    const step2 = getStepData(2);
    const step3 = getStepData(3);
    const step4 = getStepData(4);
    const step1Obj = toObjectRecord(step1);
    const step2Obj = toObjectRecord(step2);
    const step3Obj = toObjectRecord(step3);
    const step4Obj = toObjectRecord(step4);
    const hasRestorableData =
      hasObjectValues(step1Obj) ||
      hasObjectValues(step2Obj) ||
      hasObjectValues(step3Obj) ||
      hasObjectValues(step4Obj);

    if (!hasRestorableData) return;

    // Guard: if the previous "new" draft was already submitted via Step 5,
    // clear stale data so the user starts fresh for the next yacht.
    const isFreshRequest = searchParams.get("fresh") === "true";
    if (localStorage.getItem(completedDraftStorageKey) || isFreshRequest) {
      void clearDraft();
      localStorage.removeItem(completedDraftStorageKey);
      localStorage.removeItem(aiMetaStorageKey);
      restoredDraftRef.current = true;
      
      if (isFreshRequest) {
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("fresh");
        router.replace(`${window.location.pathname}?${newSearchParams.toString()}`);
      }
      return;
    }

    const restoredCreatedYachtId = Number(step1Obj.createdYachtId);
    if (
      Number.isInteger(restoredCreatedYachtId) &&
      restoredCreatedYachtId > 0
    ) {
      setCreatedYachtId(restoredCreatedYachtId);
    }
    if (typeof step1Obj.boatHint === "string") setBoatHint(step1Obj.boatHint);
    if (typeof step1Obj.geminiExtracted === "boolean")
      setGeminiExtracted(step1Obj.geminiExtracted);
    if (step1Obj.extractionResult !== undefined)
      setExtractionResult(step1Obj.extractionResult);
    if (
      step1Obj.confidenceMeta &&
      typeof step1Obj.confidenceMeta === "object"
    ) {
      setConfidenceMeta(step1Obj.confidenceMeta as ConfidenceMeta);
    }

    if (step2Obj.selectedYacht && typeof step2Obj.selectedYacht === "object") {
      const restoredSelectedYacht = step2Obj.selectedYacht as Record<
        string,
        unknown
      >;

      setSelectedYacht({
        ...restoredSelectedYacht,
        location_id: hasFilledFieldValue(restoredSelectedYacht.location_id)
          ? restoredSelectedYacht.location_id
          : (currentUserLocationId ?? restoredSelectedYacht.location_id),
        status: normalizeStatusForNewYacht(
          restoredSelectedYacht.status,
          isClientRole,
        ),
      });
      setFormKey((k) => k + 1);
    }
    if (typeof step2Obj.correctionLabel === "string") {
      setCorrectionLabel(step2Obj.correctionLabel as CorrectionLabel);
    }

    if (step3Obj.aiTexts && typeof step3Obj.aiTexts === "object") {
      const aiTextObj = step3Obj.aiTexts as Record<string, unknown>;
      setAiTexts({
        nl: typeof aiTextObj.nl === "string" ? aiTextObj.nl : "",
        en: typeof aiTextObj.en === "string" ? aiTextObj.en : "",
        de: typeof aiTextObj.de === "string" ? aiTextObj.de : "",
        fr: typeof aiTextObj.fr === "string" ? aiTextObj.fr : "",
      });
    }

    if (
      step3Obj.selectedLang === "nl" ||
      step3Obj.selectedLang === "en" ||
      step3Obj.selectedLang === "de" ||
      step3Obj.selectedLang === "fr"
    ) {
      setSelectedLang(step3Obj.selectedLang);
    }
    if (typeof step3Obj.aiTone === "string") setAiTone(step3Obj.aiTone);
    if (typeof step3Obj.aiMinWords === "number" || step3Obj.aiMinWords === "") {
      setAiMinWords(step3Obj.aiMinWords);
    }
    if (typeof step3Obj.aiMaxWords === "number" || step3Obj.aiMaxWords === "") {
      setAiMaxWords(step3Obj.aiMaxWords);
    }

    if (Array.isArray(step4Obj.availabilityRules)) {
      setAvailabilityRules(step4Obj.availabilityRules as AvailabilityRule[]);
    }

    restoredDraftRef.current = true;
  }, [
    aiMetaStorageKey,
    clearDraft,
    completedDraftStorageKey,
    currentUserLocationId,
    getStepData,
    isDraftLoaded,
    isNewMode,
    yachtId,
    router,
    searchParams,
  ]);

  // Restore draft step on mount (but respect approval gate)
  useEffect(() => {
    if (isDraftLoaded && draft.currentStep > 1 && isNewMode) {
      if (!canProceedFromStep1) return;
      setActiveStep(draft.currentStep);
    }
  }, [isDraftLoaded, draft.currentStep, isNewMode, canProceedFromStep1]);

  useEffect(() => {
    if (!isDraftLoaded || requestedStep < 1) return;
    setActiveStep(requestedStep);
  }, [isDraftLoaded, requestedStep]);

  // Keep current wizard step synced to draft metadata.
  useEffect(() => {
    if (!isDraftLoaded) return;
    setDraftStep(activeStep);
  }, [activeStep, isDraftLoaded, setDraftStep]);

  // Persist key slices to draft in the background.
  useEffect(() => {
    if (!isDraftLoaded) return;
    debouncedSave(1, {
      createdYachtId,
      boatHint,
      geminiExtracted,
      extractionResult,
      confidenceMeta,
    });
  }, [
    isDraftLoaded,
    createdYachtId,
    boatHint,
    geminiExtracted,
    extractionResult,
    confidenceMeta,
    debouncedSave,
  ]);

  // Once the draft exists on the server, switch /yachts/new to the permanent id route.
  useEffect(() => {
    if (!isNewMode || !createdYachtId || createdYachtId <= 0) return;
    if (typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    if (!currentPath.endsWith("/new")) return;

    router.replace(
      `${localizedYachtsBasePath}/${createdYachtId}?step=${activeStep}&draftFlow=1`,
    );
  }, [isNewMode, createdYachtId, activeStep, localizedYachtsBasePath, router]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    debouncedSave(2, {
      selectedYacht: selectedYacht || {},
      correctionLabel,
    });
  }, [isDraftLoaded, selectedYacht, correctionLabel, debouncedSave]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    debouncedSave(3, {
      aiTexts,
      selectedLang,
      aiTone,
      aiMinWords,
      aiMaxWords,
    });
  }, [
    isDraftLoaded,
    aiTexts,
    selectedLang,
    aiTone,
    aiMinWords,
    aiMaxWords,
    debouncedSave,
  ]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    debouncedSave(4, { availabilityRules });
  }, [isDraftLoaded, availabilityRules, debouncedSave]);

  const buildServerDraftSnapshot = useCallback(() => {
    const serverDraftId = String(draft.id || yachtId || "new");
    const linkedYachtId = activeYachtId ? Number(activeYachtId) : null;

    return {
      draftId: serverDraftId,
      linkedYachtId,
      payloadPatch: {
        step1: {
          createdYachtId,
          boatHint,
          geminiExtracted,
          extractionResult,
          confidenceMeta,
        },
        step2: {
          selectedYacht: selectedYacht || {},
          correctionLabel,
        },
        step3: {
          aiTexts,
          selectedLang,
          aiTone,
          aiMinWords,
          aiMaxWords,
        },
        step4: {
          availabilityRules,
        },
      } as Record<string, unknown>,
      uiStatePatch: {
        currentStep: activeStep,
        completedSteps: draft.completedSteps,
        isOnline,
      } as Record<string, unknown>,
      imagesManifestPatch: {
        pipeline: {
          total: pipeline.stats.total,
          approved: pipeline.stats.approved,
          processing: pipeline.stats.processing,
          ready: pipeline.stats.ready,
          imageIds: pipeline.images.map((img) => img.id),
        },
        offline: offlineImages.map((img) => img.key),
      } as Record<string, unknown>,
      aiStatePatch: {
        extracted: geminiExtracted,
        extracting: isExtracting,
        aiSessionId: confidenceMeta?.ai_session_id ?? null,
        modelName: confidenceMeta?.model_name ?? null,
        needsConfirmation: confidenceMeta?.needs_user_confirmation ?? [],
        warnings: confidenceMeta?.warnings ?? [],
        correctionLabel,
        fieldCorrectionLabels,
      } as Record<string, unknown>,
    };
  }, [
    draft.id,
    draft.completedSteps,
    yachtId,
    activeYachtId,
    createdYachtId,
    boatHint,
    geminiExtracted,
    extractionResult,
    confidenceMeta,
    correctionLabel,
    selectedYacht,
    aiTexts,
    selectedLang,
    aiTone,
    aiMinWords,
    aiMaxWords,
    availabilityRules,
    activeStep,
    isOnline,
    pipeline.stats.total,
    pipeline.stats.approved,
    pipeline.stats.processing,
    pipeline.stats.ready,
    pipeline.images,
    offlineImages,
    isExtracting,
    fieldCorrectionLabels,
  ]);

  const imageManifestSyncKey = [
    pipeline.stats.total,
    pipeline.stats.approved,
    pipeline.stats.processing,
    pipeline.stats.ready,
    pipeline.images
      .map(
        (img) =>
          `${img.id}:${img.status}:${img.sort_order}:${img.keep_original ? 1 : 0}:${img.category}`,
      )
      .join("|"),
    offlineImages.map((img) => img.key).join("|"),
  ].join("::");

  const syncDraftToServer = useCallback(
    async (mode: "upsert" | "patch" = "patch") => {
      if (!isDraftLoaded || !isOnline || syncingServerDraftRef.current) return;
      if (typeof window === "undefined" || !localStorage.getItem("auth_token"))
        return;

      const snapshot = buildServerDraftSnapshot();
      const snapshotSignature = JSON.stringify(snapshot);
      if (
        mode === "patch" &&
        serverDraftVersionRef.current !== null &&
        lastServerDraftSnapshotRef.current === snapshotSignature
      ) {
        return;
      }
      syncingServerDraftRef.current = true;

      try {
        if (mode === "upsert" || serverDraftVersionRef.current === null) {
          const saved = await createOrReplaceYachtDraft({
            draft_id: snapshot.draftId,
            yacht_id: snapshot.linkedYachtId,
            wizard_step: activeStep,
            payload_json: snapshot.payloadPatch,
            ui_state_json: snapshot.uiStatePatch,
            images_manifest_json: snapshot.imagesManifestPatch,
            ai_state_json: snapshot.aiStatePatch,
            version: serverDraftVersionRef.current ?? undefined,
            client_saved_at: new Date().toISOString(),
          });
          serverDraftVersionRef.current = saved.version;
          lastServerDraftSnapshotRef.current = snapshotSignature;
          return;
        }

        const patched = await patchYachtDraft(snapshot.draftId, {
          version: serverDraftVersionRef.current,
          wizard_step: activeStep,
          payload_patch: snapshot.payloadPatch,
          ui_state_patch: snapshot.uiStatePatch,
          images_manifest_patch: snapshot.imagesManifestPatch,
          ai_state_patch: snapshot.aiStatePatch,
          client_saved_at: new Date().toISOString(),
        });
        serverDraftVersionRef.current = patched.version;
        lastServerDraftSnapshotRef.current = snapshotSignature;
      } catch (error: unknown) {
        const err = error as {
          response?: {
            status?: number;
            data?: {
              server?: {
                version?: number;
              };
            };
          };
        };
        const conflictVersion = err?.response?.data?.server?.version;
        if (
          err?.response?.status === 409 &&
          typeof conflictVersion === "number"
        ) {
          serverDraftVersionRef.current = conflictVersion;
          try {
            const snapshotRetry = buildServerDraftSnapshot();
            const retried = await patchYachtDraft(snapshotRetry.draftId, {
              version: serverDraftVersionRef.current,
              wizard_step: activeStep,
              payload_patch: snapshotRetry.payloadPatch,
              ui_state_patch: snapshotRetry.uiStatePatch,
              images_manifest_patch: snapshotRetry.imagesManifestPatch,
              ai_state_patch: snapshotRetry.aiStatePatch,
              client_saved_at: new Date().toISOString(),
            });
            serverDraftVersionRef.current = retried.version;
            lastServerDraftSnapshotRef.current = JSON.stringify(snapshotRetry);
          } catch (retryError) {
            console.warn("[DraftSync] Patch retry failed:", retryError);
          }
        } else {
          console.warn("[DraftSync] Sync failed:", error);
        }
      } finally {
        syncingServerDraftRef.current = false;
      }
    },
    [isDraftLoaded, isOnline, buildServerDraftSnapshot, activeStep],
  );

  const syncDraftToServerRef = useRef(syncDraftToServer);

  useEffect(() => {
    syncDraftToServerRef.current = syncDraftToServer;
  }, [syncDraftToServer]);

  useEffect(() => {
    const activePreviewUrls = new Set(
      [...pipeline.images, ...pendingUploadPreviews]
        .map((image) => image.client_preview_url)
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    );

    localPreviewUrlsRef.current.forEach((url) => {
      if (!activePreviewUrls.has(url)) {
        URL.revokeObjectURL(url);
        localPreviewUrlsRef.current.delete(url);
      }
    });
  }, [pendingUploadPreviews, pipeline.images]);

  useEffect(() => {
    return () => {
      localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localPreviewUrlsRef.current.clear();
    };
  }, []);

  // Bootstrap server draft safely:
  // 1) fetch existing server draft if present
  // 2) hydrate local when local is empty
  // 3) otherwise patch server with current local state
  useEffect(() => {
    if (!isDraftLoaded || !isOnline) return;
    if (
      serverDraftInitializedRef.current ||
      serverDraftBootstrapInFlightRef.current
    )
      return;
    if (typeof window === "undefined" || !localStorage.getItem("auth_token"))
      return;

    let cancelled = false;
    serverDraftBootstrapInFlightRef.current = true;

    const bootstrapServerDraft = async () => {
      const serverDraftId = String(draft.id || yachtId || "new");
      const hasLocalDraftContent =
        hasObjectValues(getStepData(1)) ||
        hasObjectValues(getStepData(2)) ||
        hasObjectValues(getStepData(3)) ||
        hasObjectValues(getStepData(4)) ||
        hasObjectValues(getStepData(5)) ||
        draft.completedSteps.length > 0 ||
        draft.currentStep > 1;

      try {
        const remoteDraft = await getYachtDraft(serverDraftId);
        if (cancelled) return;

        serverDraftVersionRef.current = remoteDraft.version;

        // Skip restoring server drafts that were already submitted
        if (remoteDraft.status === "submitted") {
          serverDraftInitializedRef.current = true;
          serverDraftBootstrapInFlightRef.current = false;
          return;
        }

        if (!hasLocalDraftContent) {
          const payload = toObjectRecord(remoteDraft.payload_json);
          const uiState = toObjectRecord(remoteDraft.ui_state_json);
          const serverCompletedSteps = Array.isArray(uiState.completedSteps)
            ? uiState.completedSteps
                .map((value) => Number(value))
                .filter(
                  (value) =>
                    Number.isInteger(value) && value >= 1 && value <= 5,
                )
            : [];

          flushDraft({
            currentStep: clampWizardStep(
              uiState.currentStep ?? remoteDraft.wizard_step ?? 1,
            ),
            completedSteps: serverCompletedSteps,
            data: {
              step1: toObjectRecord(payload.step1),
              step2: toObjectRecord(payload.step2),
              step3: toObjectRecord(payload.step3),
              step4: toObjectRecord(payload.step4),
              step5: hasObjectValues(payload.step5)
                ? toObjectRecord(payload.step5)
                : draft.data.step5,
            },
          });
          restoredDraftRef.current = false;
        } else {
          await syncDraftToServer("patch");
        }
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) {
          await syncDraftToServer("upsert");
        } else {
          console.warn("[DraftSync] Bootstrap failed:", error);
        }
      } finally {
        if (!cancelled) {
          serverDraftInitializedRef.current = true;
        }
        serverDraftBootstrapInFlightRef.current = false;
      }
    };

    void bootstrapServerDraft();

    return () => {
      cancelled = true;
    };
  }, [
    isDraftLoaded,
    isOnline,
    draft.id,
    draft.currentStep,
    draft.completedSteps.length,
    draft.data.step5,
    yachtId,
    getStepData,
    flushDraft,
    syncDraftToServer,
  ]);

  // Debounced server patch whenever local draft changes.
  useEffect(() => {
    if (!isDraftLoaded || !isOnline) return;
    if (!serverDraftInitializedRef.current) return;
    if (serverSyncTimerRef.current) {
      clearTimeout(serverSyncTimerRef.current);
    }
    serverSyncTimerRef.current = setTimeout(() => {
      void syncDraftToServerRef.current("patch");
    }, 1800);

    return () => {
      if (serverSyncTimerRef.current) {
        clearTimeout(serverSyncTimerRef.current);
      }
    };
  }, [
    isDraftLoaded,
    isOnline,
    draft.lastSaved,
    activeStep,
    imageManifestSyncKey,
  ]);

  // Expose a global best-effort flush hook for language switching/navigation.
  const flushYachtDraftNow = useCallback(async () => {
    if (!isDraftLoaded) return;
    flushDraft({
      currentStep: activeStep,
      data: {
        step1: {
          ...toObjectRecord(draft.data.step1),
          createdYachtId,
          boatHint,
          geminiExtracted,
          extractionResult,
          confidenceMeta,
        },
        step2: {
          ...toObjectRecord(draft.data.step2),
          selectedYacht: selectedYacht || {},
          correctionLabel,
        },
        step3: {
          ...toObjectRecord(draft.data.step3),
          aiTexts,
          selectedLang,
          aiTone,
          aiMinWords,
          aiMaxWords,
        },
        step4: {
          ...toObjectRecord(draft.data.step4),
          availabilityRules,
        },
        step5: draft.data.step5,
      },
    });
    await syncDraftToServer(
      serverDraftVersionRef.current === null ? "upsert" : "patch",
    );
  }, [
    isDraftLoaded,
    draft.data.step1,
    draft.data.step2,
    draft.data.step3,
    draft.data.step4,
    draft.data.step5,
    createdYachtId,
    boatHint,
    geminiExtracted,
    extractionResult,
    confidenceMeta,
    correctionLabel,
    selectedYacht,
    aiTexts,
    selectedLang,
    aiTone,
    aiMinWords,
    aiMaxWords,
    availabilityRules,
    activeStep,
    flushDraft,
    syncDraftToServer,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__flushYachtDraftNow = flushYachtDraftNow;
    return () => {
      if (window.__flushYachtDraftNow === flushYachtDraftNow) {
        delete window.__flushYachtDraftNow;
      }
    };
  }, [flushYachtDraftNow]);

  // Helper: check if a field needs user confirmation
  const needsConfirm = useCallback(
    (fieldName: string) =>
      confidenceMeta?.needs_user_confirmation?.includes(fieldName) ?? false,
    [confidenceMeta],
  );

  const isOptionalTriStateField = useCallback(
    (fieldName: string) =>
      (OPTIONAL_TRI_STATE_FIELDS as readonly string[]).includes(fieldName),
    [],
  );

  const handleApproveAllImages = useCallback(async () => {
    if (pipeline.images.length === 0) return;
    try {
      setIsApprovingAllImages(true);
      await pipeline.approveAll();
    } catch (error) {
      console.error("Approve all failed", error);
      toast.error("Failed to approve images.");
    } finally {
      setIsApprovingAllImages(false);
    }
  }, [pipeline]);

  // ── AI Fill Pipeline ──
  const handleRegenerateDescription = useCallback(
    async (options?: {
      silent?: boolean;
      signature?: string;
      formValuesOverride?: Record<string, DescriptionFormValue>;
    }) => {
      const silent = options?.silent ?? false;
      const signature = options?.signature ?? null;
      const formValuesOverride = options?.formValuesOverride ?? null;

      try {
        const targetId = isNewMode ? createdYachtId : yachtId;
        if (!targetId || targetId === "new") {
          return;
        }

        const effectiveValues = formValuesOverride || buildDescriptionFormValues(selectedYacht);
        if (Object.keys(effectiveValues).length === 0) {
          if (!silent) {
            toast.error(
              labelText(
                "fillSpecsFirst",
                "Please fill in some specifications first so AI can write a description.",
              ),
            );
          }
          return;
        }

        const effectiveSignature = signature || buildDescriptionRequestSignature(
          effectiveValues,
          aiTone,
          aiMinWords,
          aiMaxWords,
        );

        if (!silent) {
          setIsAiLoading(true);
        }

        const res = await api.post(`/yachts/${targetId}/generate-description`, {
          tone: aiTone,
          min_words: aiMinWords,
          max_words: aiMaxWords,
          signature: effectiveSignature,
          form_values: effectiveValues,
        });

        const data = res.data;
        if (data?.success && data?.texts) {
          setAiTexts((prev) => ({
            ...prev,
            ...data.texts,
          }));
          if (!silent) {
            toast.success(
              labelText(
                "descriptionGeneratedSuccess",
                "Description generated successfully.",
              ),
            );
          }
        }
      } catch (error) {
        console.error("Description generation failed", error);
        if (!silent) {
          toast.error(
            labelText(
              "descriptionGenerationFailed",
              "Failed to generate description.",
            ),
          );
        }
      } finally {
        if (!silent) {
          setIsAiLoading(false);
        }
      }
    },
    [
      aiMaxWords,
      aiMinWords,
      aiTone,
      createdYachtId,
      isNewMode,
      labelText,
      selectedYacht,
      yachtId,
    ],
  );

  const handleAiExtract = useCallback(
    async (options?: {
      background?: boolean;
      navigateToStep2?: boolean;
      speedMode?: "fast" | "balanced" | "deep";
    }): Promise<boolean> => {
      const background = options?.background ?? false;
      const navigateToStep2 = options?.navigateToStep2 ?? !background;
      const speedMode = options?.speedMode ?? "balanced";
      const isTimeoutLike = (message: string) => {
        const lower = message.toLowerCase();
        return (
          lower.includes("timeout") ||
          lower.includes("timed out") ||
          lower.includes("abort") ||
          lower.includes("gateway timeout") ||
          lower.includes("504")
        );
      };

      // Block AI extraction when offline
      if (!navigator.onLine) {
        toast.error(
          labelText(
            "aiExtractionNeedsInternet",
            "AI extraction requires an internet connection. You can skip to Step 2 to fill in details manually.",
          ),
        );
        return false;
      }
      if (pipeline.images.length === 0 && referenceBoatDocuments.length === 0) {
        toast.error(
          labelText(
            "uploadOneImageFirst",
            "Please upload at least one image or reference document first.",
          ),
        );
        return false;
      }

      setExtractionType("gemini");
      setIsExtracting(true);
      if (!background) {
        setShowExtractModal(true);
      }

      // ── Start Progress & Countdown ──
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setExtractionProgress(EXTRACTION_INITIAL_PROGRESS);
      setExtractionCountdown(EXTRACTION_ESTIMATED_DURATION_SECONDS);
      setExtractionStatus(
        labelText(
          "connectingGeminiVisionApi",
          "Connecting to Gemini Vision API...",
        ),
      );

      const extractionStartedAt = Date.now();
      const extractionDurationMs = EXTRACTION_ESTIMATED_DURATION_SECONDS * 1000;
      const progressRange = EXTRACTION_PROGRESS_CAP - EXTRACTION_INITIAL_PROGRESS;

      progressIntervalRef.current = setInterval(() => {
        const elapsedMs = Date.now() - extractionStartedAt;
        const clampedElapsedMs = Math.min(elapsedMs, extractionDurationMs);
        const progressRatio = clampedElapsedMs / extractionDurationMs;
        const nextProgress = Math.min(
          EXTRACTION_PROGRESS_CAP,
          Math.round(EXTRACTION_INITIAL_PROGRESS + progressRatio * progressRange),
        );
        const secondsRemaining = Math.max(
          1,
          Math.ceil((extractionDurationMs - clampedElapsedMs) / 1000),
        );

        setExtractionProgress(nextProgress);
        setExtractionCountdown(secondsRemaining);

        if (nextProgress < 25)
          setExtractionStatus(
            labelText(
              "analyzingVesselImagesGemini",
              "Analyzing vessel images with Gemini Vision...",
            ),
          );
        else if (nextProgress < 50)
          setExtractionStatus(
            labelText(
              "searchingCatalogMatchingModels",
              "Searching catalog for matching models...",
            ),
          );
        else if (nextProgress < 80)
          setExtractionStatus(
            labelText(
              "crossReferencingTechnicalSpecs",
              "Cross-referencing technical specifications...",
            ),
          );
        else
          setExtractionStatus(
            labelText(
              "finalizingDataValidatingResults",
              "Finalizing data and validating results...",
            ),
          );
      }, 1000);

      try {
        const formData = new FormData();

        // Always pass a valid yacht ID; recover if restored draft ID was deleted server-side.
        let targetId: number | string | null = isNewMode
          ? createdYachtId
          : yachtId;
        if (isNewMode && targetId) {
          try {
            await api.get(`/yachts/${targetId}`);
          } catch (err: any) {
            if (err?.response?.status === 404) {
              targetId = null;
            } else {
              throw err;
            }
          }
        }
        if (!targetId || targetId === "new") {
          targetId = await createBootstrapDraftYacht();
        }

        formData.append("yacht_id", String(targetId));
        formData.append("speed_mode", speedMode);

        if (boatHint.trim()) {
          formData.append("hint_text", boatHint.trim());
        }

        // Images are NOT sent from frontend — backend fetches them from DB
        // using yacht_id (matching old project behavior for reliability).

        // We use fetch directly here to bypass Axios JSON parser,
        // which fails if PHP outputs warnings before the JSON
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${api.defaults.baseURL}/ai/pipeline-extract`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          signal: AbortSignal.timeout(600000), // 10 mins
        });

        const responseText = await res.text();
        let responseData: any = {};

        try {
          // Try parsing directly first
          responseData = JSON.parse(responseText);
        } catch (e) {
          // If it fails, try to extract the JSON part (in case of PHP warnings before the JSON)
          console.warn(
            "🔵 [Pipeline] Dirty response, attempting to extract JSON...",
          );
          const jsonMatch = responseText.match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            responseData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Invalid response format from server");
          }
        }

        if (!res.ok) {
          throw new Error(
            responseData?.error ||
              responseData?.message ||
              `AI extraction request failed (HTTP ${res.status})`,
          );
        }

        console.log("🔵 [Pipeline] Parsed API response:", responseData);

        if (responseData?.success && responseData?.step2_form_values) {
          const formValues = toObjectRecord(responseData.step2_form_values);
          const meta = responseData.meta;

          const normalizedFormValues: Record<string, unknown> = Object.fromEntries(
            Object.entries(formValues).map(([key, value]) => [
              key,
              sanitizeScalarFieldValue(value),
            ]),
          );

          const currentYear = new Date().getFullYear();
          const parseNum = (value: unknown): number | null => {
            if (value === null || value === undefined || value === "")
              return null;
            const raw = String(value).replace(",", ".").trim();
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
          };

          const sanitizeDimension = (
            value: unknown,
            field: "loa" | "beam" | "draft",
          ): number | null => {
            let num = parseNum(value);
            if (num === null) return null;

            // Most feeds use meters; convert obvious centimeter values for draft.
            if (field === "draft" && num > 20 && num <= 500) {
              num = num / 100;
            }

            if (num <= 0) return null;
            if (field === "loa" && num > 120) return null;
            if (field === "beam" && num > 30) return null;
            if (field === "draft" && num > 10) return null;
            return Number(num.toFixed(2));
          };

          // Normalize frequent alias keys from AI/feed outputs into our Step 2 schema keys.
          const aliasMap: Record<string, string> = {
            brand_name: "manufacturer",
            make: "manufacturer",
            model_name: "model",
            type_name: "boat_type",
            vessel_type: "boat_type",
            year_built: "year",
            length_m: "loa",
            length_overall: "loa",
            beam_m: "beam",
            width: "beam",
            draft_m: "draft",
            draught: "draft",
            hp: "horse_power",
            engine_brand: "engine_manufacturer",
            engine_make: "engine_manufacturer",
            fuel_type: "fuel",
            engine_hp: "horse_power",
            engine_hours: "hours",
            engine_count: "engine_quantity",
            hull_material: "hull_construction",
            construction_material: "hull_construction",
            cabins_count: "cabins",
            berths_count: "berths",
            vessel_lying: "where",
            asking_price: "price",
            speed_max: "max_speed",
            speed_cruising: "cruising_speed",
            air_draf: "air_draft",
          };
          Object.entries(aliasMap).forEach(([from, to]) => {
            const sourceValue = normalizedFormValues[from];
            const targetValue = normalizedFormValues[to];
            if (
              (targetValue === null ||
                targetValue === undefined ||
                targetValue === "") &&
              sourceValue !== null &&
              sourceValue !== undefined &&
              sourceValue !== ""
            ) {
              normalizedFormValues[to] = sourceValue;
            }
          });

          // Normalize suspicious values from feed/LLM fallback before filling Step 2.
          if (typeof normalizedFormValues.model === "number") {
            normalizedFormValues.model = String(normalizedFormValues.model);
          }
          if (
            parseNum(normalizedFormValues.price) !== null &&
            (parseNum(normalizedFormValues.price) as number) <= 0
          ) {
            normalizedFormValues.price = null;
          }
          const yearNum = parseNum(normalizedFormValues.year);
          if (yearNum !== null) {
            normalizedFormValues.year =
              yearNum >= 1950 && yearNum <= currentYear + 1
                ? Math.round(yearNum)
                : null;
          }
          normalizedFormValues.loa = sanitizeDimension(
            normalizedFormValues.loa,
            "loa",
          );
          normalizedFormValues.beam = sanitizeDimension(
            normalizedFormValues.beam,
            "beam",
          );
          normalizedFormValues.draft = sanitizeDimension(
            normalizedFormValues.draft,
            "draft",
          );

          // Enrich missing Step 2 specs from historical suggestions (brand+model based).
          try {
            const query = [
              String(normalizedFormValues.manufacturer ?? "").trim(),
              String(normalizedFormValues.model ?? "").trim(),
            ]
              .filter(Boolean)
              .join(" ")
              .trim();

            if (query.length >= 3) {
              const suggestionsRes = await api.post("/ai/suggestions", { query });
              const consensusValues = toObjectRecord(
                suggestionsRes.data?.consensus_values,
              );

              Object.entries(consensusValues).forEach(([field, value]) => {
                const current = normalizedFormValues[field];
                const isEmptyCurrent =
                  current === null ||
                  current === undefined ||
                  current === "" ||
                  current === "unknown";

                if (
                  isEmptyCurrent &&
                  sanitizeScalarFieldValue(value) !== null
                ) {
                  normalizedFormValues[field] = sanitizeScalarFieldValue(value);
                }
              });
            }
          } catch (suggestionError) {
            console.warn(
              "[AI Extraction] Suggestions enrichment failed:",
              suggestionError,
            );
          }

          // Keep optional equipment conservative and always explicit in the form.
          OPTIONAL_TRI_STATE_FIELDS.forEach((field) => {
            const raw = normalizedFormValues[field];
            normalizedFormValues[field] =
              raw === null || raw === undefined || raw === ""
                ? null
                : normalizeTriStateValue(raw);
          });

          // Merge only meaningful values so empty API placeholders do not wipe existing data.
          const fieldsToMerge = Object.fromEntries(
            Object.entries(normalizedFormValues).filter(
              ([, val]) => val !== null && val !== "",
            ),
          );

          console.log("🟢 [Pipeline] Fields to merge:", fieldsToMerge);
          console.log("🟢 [Pipeline] Stages run:", meta?.stages_run);
          console.log(
            "🟢 [Pipeline] Overall confidence:",
            meta?.overall_confidence,
          );
          console.log(
            "🟢 [Pipeline] Needs confirmation:",
            meta?.needs_user_confirmation,
          );
          console.log("🔴 [Pipeline] Removed fields:", meta?.removed_fields);
          console.log("⚠️ [Pipeline] Anomalies:", meta?.anomalies);
          console.log("📝 [Pipeline] Validation notes:", meta?.validation_notes);

          setExtractionResult(normalizedFormValues);
          setGeminiExtracted(true);
          setConfidenceMeta(meta || null);
          setCorrectionLabel(null);
          lastSuccessfulExtractionSignatureRef.current =
            currentPipelineExtractionSignature;

          // Prefill form: merge into selectedYacht
          setSelectedYacht((prev: any) => ({
            ...(prev || {}),
            ...fieldsToMerge,
          }));
          setFormKey((k) => k + 1);

          // Prefill AI texts if returned
          if (formValues.short_description_en) {
            setAiTexts((prev) => ({
              ...prev,
              en: String(sanitizeScalarFieldValue(formValues.short_description_en) ?? ""),
            }));
          }
          if (formValues.short_description_nl) {
            setAiTexts((prev) => ({
              ...prev,
              nl: String(sanitizeScalarFieldValue(formValues.short_description_nl) ?? ""),
            }));
          }
          if (formValues.short_description_de) {
            setAiTexts((prev) => ({
              ...prev,
              de: String(sanitizeScalarFieldValue(formValues.short_description_de) ?? ""),
            }));
          }
          if (formValues.short_description_fr) {
            setAiTexts((prev) => ({
              ...prev,
              fr: String(sanitizeScalarFieldValue(formValues.short_description_fr) ?? ""),
            }));
          }

          const mergedDescriptionState = {
            ...toObjectRecord(selectedYacht),
            ...fieldsToMerge,
          };
          const extractedDescriptionFormValues = buildDescriptionFormValues(
            mergedDescriptionState,
          );
          if (Object.keys(extractedDescriptionFormValues).length > 0) {
            void handleRegenerateDescription({
              silent: true,
              signature: buildDescriptionRequestSignature(
                extractedDescriptionFormValues,
                aiTone,
                aiMinWords,
                aiMaxWords,
              ),
              formValuesOverride: extractedDescriptionFormValues,
            });
          }

          const fieldCount = Object.keys(fieldsToMerge).length;
          const confPct = Math.round((meta?.overall_confidence || 0) * 100);
          const removedCount = meta?.removed_fields?.length || 0;
          const anomalyCount = meta?.anomalies?.length || 0;
          const validatedBadge = meta?.stages_run?.includes("chatgpt_validation")
            ? " ✓ validated"
            : "";

          let toastMsg = `✅ Extracted ${fieldCount} fields (${confPct}% confidence${validatedBadge})`;
          if (removedCount > 0) {
            toastMsg += `\n🔴 Removed ${removedCount} hallucinated field${removedCount > 1 ? "s" : ""}`;
          }
          if (anomalyCount > 0) {
            toastMsg += `\n⚠️ ${anomalyCount} anomal${anomalyCount > 1 ? "ies" : "y"} detected`;
          }
          toast.success(toastMsg, { duration: 5000 });

          if (navigateToStep2) {
            // Navigate to Step 2 immediately only for foreground/manual runs.
            console.log("🚀 [Pipeline] Navigating to Step 2...");
            setActiveStep(2);
          }
          return true;
        } else {
          console.error(
            "🔴 [Pipeline] Extraction failed — response:",
            responseData,
          );
          toast.error(
            responseData?.error || "Extraction failed — no data returned",
          );
          return false;
        }
      } catch (err: any) {
        console.error("AI pipeline failed:", err);
        const errorMsg =
          err?.response?.data?.error || err?.message || "AI extraction failed";

        if (speedMode === "deep" && isTimeoutLike(String(errorMsg))) {
          toast("Deep extraction timed out. Retrying with balanced mode...");
          return await handleAiExtract({
            background,
            navigateToStep2,
            speedMode: "balanced",
          });
        }

        toast.error(errorMsg);
        return false;
      } finally {
        setIsExtracting(false);
        if (!background) {
          setShowExtractModal(false);
        }
        // Clear intervals
        if (progressIntervalRef.current)
          clearInterval(progressIntervalRef.current);
        if (countdownIntervalRef.current)
          clearInterval(countdownIntervalRef.current);
        progressIntervalRef.current = null;
        countdownIntervalRef.current = null;
        setExtractionProgress(0);
        setExtractionCountdown(EXTRACTION_ESTIMATED_DURATION_SECONDS);
      }
    },
    [
      aiMaxWords,
      aiMinWords,
      aiTone,
      boatHint,
      createBootstrapDraftYacht,
      createdYachtId,
      currentPipelineExtractionSignature,
      handleRegenerateDescription,
      isNewMode,
      labelText,
      pipeline.images.length,
      referenceBoatDocuments.length,
      selectedYacht,
      yachtId,
    ],
  );

  // Auto-save current step data when switching tabs
  const handleStepChange = useCallback(
    (newStep: number) => {
      const targetStep = isClientRole && newStep === 4 ? 5 : newStep;

      // OFFLINE: allow skipping to any step (no server gating)
      if (!isOnline) {
        if (
          targetStep > 1 &&
          offlineImages.length === 0 &&
          pipeline.images.length === 0
        ) {
          toast.error(
            labelText(
              "uploadOneImageFirstOffline",
              "Please upload at least one image first (saved locally).",
            ),
          );
          return;
        }
        setActiveStep(targetStep);
        return;
      }
      // In new mode: block Step 2+ until image gate is satisfied
      if (isNewMode && targetStep > 1) {
        // Block if any images have failed processing
        if (hasFailedImagesRef.current) {
          setFailedImagesNavDialogOpen(true);
          return;
        }

        // Auto-approve and trigger AI extraction if they haven't run it yet
        if (targetStep === 2) {
          if (!imagesApproved && pipeline.images.length > 0) {
            void handleApproveAllImages();
            if (!isExtracting) {
              void handleAiExtract();
              return; // AI handles navigation on success
            }
          } else if (imagesApproved && !hasCompletedAiExtraction && !isExtracting) {
            void handleAiExtract();
            return; // AI handles navigation on success
          }
        }

        if (!canProceedFromStep1) {
          toast.error(
            "Please approve images first. You can continue manually even if AI extraction fails.",
          );
          return;
        }
      }
      if (targetStep > 2 && isLocationSelectionBlocking) {
        toast.error(
          labelText(
            "locationRequiredForNextStep",
            "Please select a location first.",
          ),
        );
        return;
      }
      setActiveStep(targetStep);
    },
    [
      isClientRole,
      isOnline,
      isNewMode,
      canProceedFromStep1,
      isLocationSelectionBlocking,
      offlineImages,
      pipeline.images.length,
      imagesApproved,
      handleApproveAllImages,
      isExtracting,
      handleAiExtract,
      hasCompletedAiExtraction,
    ],
  );

  const updateInternalReviewStatus = useCallback(
    async (nextStatus: "Draft" | "For Sale", nextStep?: number) => {
      if (!activeYachtId || isClientRole) {
        return;
      }

      setReviewActionLoading(nextStatus === "Draft" ? "draft" : "approved");

      try {
        const formData = new FormData();
        formData.append("_method", "PUT");
        formData.append("status", nextStatus);

        await api.post(`/yachts/${activeYachtId}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setSelectedYacht((previous: any) => ({
          ...(previous && typeof previous === "object" ? previous : {}),
          status: nextStatus,
        }));

        toast.success(
          labelText(
            nextStatus === "Draft"
              ? "vesselMarkedPendingReview"
              : "vesselApprovedSuccess",
            nextStatus === "Draft"
              ? "Vessel kept in broker review."
              : "Vessel approved. You can continue with Signhost now.",
          ),
        );

        if (typeof nextStep === "number") {
          markStepComplete(activeStep);
          handleStepChange(nextStep);
        }
      } catch (error) {
        console.error("Failed to update yacht review status", error);
        toast.error(
          labelText(
            "vesselReviewActionFailed",
            "Could not update vessel review status.",
          ),
        );
      } finally {
        setReviewActionLoading(null);
      }
    },
    [
      activeStep,
      activeYachtId,
      handleStepChange,
      isClientRole,
      labelText,
      markStepComplete,
      selectedYacht,
    ],
  );

  // --- 1. FETCH DATA (IF EDITING) ---
  useEffect(() => {
    if (!isPersistedYachtRoute) {
      setLoading(false);
      return;
    }

    const fetchYachtDetails = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/yachts/${currentBoatDocumentId}`);
        const yacht = res.data;
        setSelectedYacht({
          ...yacht,
          location_id: yacht?.location_id ?? null,
          status: normalizeStatusForForm(yacht?.status) ?? yacht?.status,
        });

        // Restore Step 1 identification fields from server data
        if (yacht.manufacturer && !step1Brand) setStep1Brand(yacht.manufacturer);
        if (yacht.model && !step1Model) setStep1Model(yacht.model);
        if (yacht.year && !step1Year) setStep1Year(String(yacht.year));
        if (yacht.owners_comment && !boatHint) {
          setBoatHint(yacht.owners_comment);
          restoredBoatHintRef.current = true;
        }

        // Populate Main Image
        setMainPreview(
          yacht.main_image ? `${STORAGE_URL}${yacht.main_image}` : null,
        );

        // Populate all existing images into aiStaging
        if (yacht.images && yacht.images.length > 0) {
          const loadedImages: AiStagedImage[] = yacht.images.map(
            (img: any) => ({
              // We can't realistically create a File object from a URL synchronously,
              // so we'll just mock it or handle it in the saving logic later.
              // For now we'll put a mock File to satisfy the type.
              file: new File([""], img.original_name || `image_${img.id}.jpg`),
              preview: `${STORAGE_URL}${img.image_path}`,
              category: img.category || "General",
              originalName: img.original_name || `Existing Image ${img.id}`,
            }),
          );
          setAiStaging(loadedImages);
        }

        // Fetch Boat Videos (Endpoint currently missing/obsolete)
        // try {
        //   const videoRes = await api.get(`/yachts/${yachtId}/boat-videos`);
        //   setBoatVideos(videoRes.data);
        // } catch (e) {
        //   console.error("Failed to fetch boat videos", e);
        // }

        if (currentBoatDocumentId) {
          await loadMarketingVideos(currentBoatDocumentId);
        }

        // Load existing availability rules
        if (yacht.availability_rules || yacht.availabilityRules) {
          const rawRules = yacht.availability_rules || yacht.availabilityRules;
          setAvailabilityRules(normalizeAvailabilityRules(rawRules, locationDefaults));
        } else {
          setAvailabilityRules(createDefaultAvailabilityRules(locationDefaults));
        }

        // Load existing AI descriptions
        setAiTexts({
          en: yacht.short_description_en || "",
          nl: yacht.short_description_nl || "",
          de: yacht.short_description_de || "",
          fr: yacht.short_description_fr || "",
        });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          console.warn(`[YachtEditor] Skipping missing yacht ${yachtId}`);
          toast.error("Vessel not found.");
          router.push(`/${locale}/dashboard/${role}/yachts`);
          return;
        }
        console.error("Failed to fetch yacht details", err);
        toast.error("Failed to load yacht details");
        router.push(`/${locale}/dashboard/${role}/yachts`);
      } finally {
        setLoading(false);
      }
    };

    fetchYachtDetails();
  }, [yachtId, isPersistedYachtRoute, locale, router, loadMarketingVideos]);

  // --- 2. HANDLERS ---

  // Video Handlers
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let draftToastId: string | undefined;

    try {
      const isMp4 =
        file.type === "video/mp4" || /\.mp4$/i.test(file.name || "");
      if (!isMp4) {
        toast.error("Please upload an MP4 file.");
        return;
      }

      setIsUploadingVideo(true);

      // Auto-create draft yacht if needed
      let targetId = isNewMode ? createdYachtId : yachtId;

      if (isNewMode && !targetId) {
        draftToastId = toast.loading("Creating vessel draft...");
        targetId = await createBootstrapDraftYacht();
        toast.dismiss(draftToastId);
        draftToastId = undefined;
      }

      if (!targetId) {
        toast.error("Save the vessel first before uploading a video.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("video", file);

      const res = await api.post(`/yachts/${targetId}/boat-videos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedVideo = res.data?.video ?? res.data?.data ?? res.data;
      setBoatVideos((prev) => [uploadedVideo, ...prev]);
      toast.success(t?.video?.uploaded || "Video uploaded successfully");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        t?.video?.uploadFailed ||
        "Video upload failed";
      console.error("Video upload failed", err);
      toast.error(message);
    } finally {
      if (draftToastId) {
        toast.dismiss(draftToastId);
      }
      setIsUploadingVideo(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleGenerateMarketingVideo = useCallback(
    async (force = false) => {
      let targetId = isNewMode ? createdYachtId : yachtId;
      if (isNewMode && !targetId) {
        const loadingToastId = toast.loading("Creating vessel draft...");
        try {
          targetId = await createBootstrapDraftYacht();
          toast.dismiss(loadingToastId);
        } catch (error) {
          toast.dismiss(loadingToastId);
          toast.error("Failed to initialize draft vessel.");
          return;
        }
      }

      if (!targetId) {
        toast.error("Save the vessel first before generating a marketing video.");
        return;
      }

      if (approvedMarketingImageIds.length === 0) {
        toast.error(
          "Approve at least one uploaded image before generating a marketing video.",
        );
        return;
      }

      setIsGeneratingMarketingVideo(true);
      try {
        const queuedPlaceholderId = -Date.now();
        setMarketingVideos((previous: any[]) => [
          {
            id: queuedPlaceholderId,
            yacht_id: Number(targetId),
            boat_id: Number(targetId),
            status: "queued",
            template_type: "vertical_slideshow_v1",
            generation_trigger: force ? "manual_force" : "manual",
            created_at: new Date().toISOString(),
            renderable_image_count: approvedMarketingImageIds.length,
          },
          ...previous.filter(
            (video) =>
              !(
                video.id < 0 &&
                video.generation_trigger === (force ? "manual_force" : "manual")
              ),
          ),
        ]);

        const response = await api.post("/social/videos/generate", {
          yacht_id: Number(targetId),
          boat_id: Number(targetId),
          template_type: "vertical_slideshow_v1",
          force,
          approved_image_ids: approvedMarketingImageIds,
          use_approved_images_only: true,
        });

        const queuedCount = response.data?.renderable_image_count;
        const message =
          typeof queuedCount === "number"
            ? `Video queued with ${queuedCount} approved image(s).`
            : "Video generation queued.";

        toast.success(response.data?.message || message);
        await loadMarketingVideos(targetId);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            "Could not queue marketing video generation.",
        );
      } finally {
        setIsGeneratingMarketingVideo(false);
      }
    },
    [
      isNewMode,
      createdYachtId,
      yachtId,
      createBootstrapDraftYacht,
      approvedMarketingImageIds,
      api,
      loadMarketingVideos,
    ],
  );

  const handleNotifyMarketingVideoOwner = async (videoId: number) => {
    setIsPublishingVideo(videoId);
    try {
      const response = await api.post(
        `/social/videos/${videoId}/notify-owner`,
        {
          force: true,
        },
      );
      toast.success(
        response.data?.message || "Owner WhatsApp delivery queued.",
      );
      const targetId = isNewMode ? createdYachtId : yachtId;
      if (targetId) {
        await loadMarketingVideos(targetId);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Could not queue owner WhatsApp delivery.",
      );
    } finally {
      setIsPublishingVideo(null);
    }
  };

  // Document Handlers (Step 1 reference docs + Step 5 compliance docs)
  const uploadDocumentFiles = useCallback(
    async (
      inputFiles: FileList | File[],
      documentType: BoatDocumentType = "compliance",
    ) => {
      const files = Array.from(inputFiles).filter(
        (file): file is File => file instanceof File,
      );
      if (files.length === 0) return;

      let targetId = currentBoatDocumentId;
      if (isNewMode && !targetId) {
        const loadingToastId = toast.loading(
          "Creating vessel draft for document upload...",
        );
        try {
          targetId = await createBootstrapDraftYacht();
          toast.dismiss(loadingToastId);
        } catch (err) {
          toast.dismiss(loadingToastId);
          toast.error("Failed to initialize draft vessel.");
          return;
        }
      }

      setIsUploadingDocument(true);
      const formData = new FormData();
      if (files.length === 1) {
        formData.append("file", files[0]);
      } else {
        files.forEach((file) => formData.append("files[]", file));
      }
      formData.append("document_type", documentType);

      try {
        const res = await api.post(`/yachts/${targetId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const uploadedDocuments = normalizeBoatDocumentResponse(res.data);
        setBoatDocuments((prev) => [
          ...uploadedDocuments,
          ...prev.filter(
            (existing) =>
              !uploadedDocuments.some((uploaded) => uploaded.id === existing.id),
          ),
        ]);
        toast.success(
          uploadedDocuments.length > 1
            ? `${uploadedDocuments.length} documents uploaded successfully`
            : "Document uploaded successfully",
        );
      } catch (err: any) {
        toast.error(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Document upload failed",
        );
      } finally {
        setIsUploadingDocument(false);
        setDocumentDropTarget(null);
      }
    },
    [createBootstrapDraftYacht, currentBoatDocumentId, isNewMode],
  );

  const handleDocumentInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    documentType: string = "compliance",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    await uploadDocumentFiles(files, normalizeBoatDocumentType(documentType));
    e.target.value = "";
  };

  const handleDocumentDrop = async (
    event: React.DragEvent<Element>,
    documentType: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) {
      setDocumentDropTarget(null);
      return;
    }

    await uploadDocumentFiles(files, normalizeBoatDocumentType(documentType));
  };

  const handleDocumentDragOver = (
    event: React.DragEvent<Element>,
    documentType: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDocumentDropTarget(normalizeBoatDocumentType(documentType));
  };

  const handleDocumentDragLeave = (
    event: React.DragEvent<Element>,
    documentType: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const normalizedDocumentType = normalizeBoatDocumentType(documentType);

    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setDocumentDropTarget((current) =>
      current === normalizedDocumentType ? null : current,
    );
  };

  const handleDocumentDelete = (id: number) => {
    setDocumentToDelete(id);
    setDeleteDocumentDialogOpen(true);
  };

  const executeDocumentDelete = async () => {
    if (!documentToDelete) return;
    const targetId = currentBoatDocumentId;
    try {
      await api.delete(`/yachts/${targetId}/documents/${documentToDelete}`);
      setBoatDocuments((prev) =>
        prev.filter((doc) => doc.id !== documentToDelete),
      );
      toast.success("Document removed");
    } catch (err) {
      toast.error("Failed to delete document");
    } finally {
      setDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleReferenceDocumentDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    const targetId = currentBoatDocumentId;
    if (!targetId) {
      toast.error("Please save the yacht first.");
      return;
    }

    const reordered = Array.from(referenceBoatDocuments);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    const reorderedIds = reordered.map((doc) => Number(doc.id));
    const reorderedById = new Map(
      reordered.map((doc, index) => [
        Number(doc.id),
        { ...doc, sort_order: index },
      ]),
    );

    setBoatDocuments((prev) =>
      prev.map((doc) => reorderedById.get(Number(doc.id)) ?? doc),
    );

    try {
      await api.post(`/yachts/${targetId}/documents/reorder`, {
        document_ids: reorderedIds,
      });
    } catch (err) {
      toast.error("Failed to save document order.");
      const refreshed = await api.get(`/yachts/${targetId}/documents`);
      setBoatDocuments(Array.isArray(refreshed.data) ? refreshed.data : []);
    }
  };

  const handleVideoDelete = (id: number) => {
    setVideoToDelete(id);
    setDeleteVideoDialogOpen(true);
  };

  const executeVideoDelete = async () => {
    if (!videoToDelete) return;
    try {
      await api.delete(`/boat-videos/${videoToDelete}`);
      setBoatVideos((prev) => prev.filter((v) => v.id !== videoToDelete));
      toast.success(t?.video?.removed || "Video removed");
    } catch (err) {
      toast.error(t?.video?.removeFailed || "Failed to remove video");
    } finally {
      setDeleteVideoDialogOpen(false);
      setVideoToDelete(null);
    }
  };

  const handleVideoPublish = async (id: number) => {
    setIsPublishingVideo(id);
    try {
      await api.post(`/boat-videos/${id}/publish`);
      toast.success(
        t?.video?.publishSent || "Publish request sent to social API",
      );

      // Refresh videos to get the new 'publishing' status
      const res = await api.get(`/yachts/${yachtId}/boat-videos`);
      setBoatVideos(res.data);
    } catch (err) {
      toast.error(t?.video?.publishFailed || "Publish failed");
    } finally {
      setIsPublishingVideo(null);
    }
  };

  const gridClassName = useMemo(() => {
    switch (imageGridDensity) {
      case "dense":
        return "grid-cols-2 lg:grid-cols-8";
      case "compact":
        return "grid-cols-2 lg:grid-cols-6";
      default:
        return "grid-cols-2 lg:grid-cols-4";
    }
  }, [imageGridDensity]);

  const selectedLightboxImage = useMemo(
    () =>
      selectedLightboxImageId === null
        ? null
        : (reviewImages.find((image) => image.id === selectedLightboxImageId) ??
          null),
    [reviewImages, selectedLightboxImageId],
  );

  const selectedLightboxIndex = useMemo(
    () =>
      selectedLightboxImageId === null
        ? -1
        : reviewImages.findIndex(
            (image) => image.id === selectedLightboxImageId,
          ),
    [reviewImages, selectedLightboxImageId],
  );

  const buildImageAiNotes = useCallback(
    (image: PipelineImage) => {
      const notes: string[] = [];
      const adjustments = Array.isArray(image.quality_flags?.ai_adjustments)
        ? image.quality_flags.ai_adjustments
        : [];
      notes.push(...adjustments);

      if (image.quality_flags?.too_dark) {
        notes.push(
          labelText(
            "imageDetectedDark",
            "Source image was detected as dark before enhancement.",
          ),
        );
      }
      if (image.quality_flags?.too_bright) {
        notes.push(
          labelText(
            "imageStrongHighlights",
            "Source image had strong highlights before enhancement.",
          ),
        );
      }
      if (image.quality_flags?.blurry) {
        notes.push(
          labelText(
            "imageSoftRecovery",
            "Source image was soft, so clarity recovery was attempted.",
          ),
        );
      }
      if (image.quality_flags?.low_res) {
        notes.push(
          labelText(
            "imageLowRes",
            "Source image resolution was low, so upscale logic was considered.",
          ),
        );
      }
      if (
        typeof image.quality_flags?.ai_rotation_angle === "number" &&
        image.quality_flags.ai_rotation_angle > 0
      ) {
        notes.push(
          labelText(
            "imageRotationCorrected",
            `Image orientation was corrected by ${image.quality_flags.ai_rotation_angle} degrees.`,
          ),
        );
      }
      if (notes.length === 0) {
        notes.push(
          labelText(
            "imageGalleryReadyNoCorrections",
            "AI marked this image as gallery-ready without major corrections.",
          ),
        );
      }

      return Array.from(new Set(notes));
    },
    [labelText],
  );

  const handlePipelineDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;

      const reordered = Array.from(reviewImages);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      setReviewImages(reordered);

      try {
        setIsReorderingImages(true);
        await pipeline.reorderImages(reordered.map((image) => image.id));
      } catch (error) {
        setReviewImages(pipeline.images);
        toast.error("Failed to save image order");
        console.error(error);
      } finally {
        setIsReorderingImages(false);
      }
    },
    [pipeline, reviewImages],
  );

  const getPipelineStatusLabel = useCallback(
    (status: ReviewPipelineImage["status"]) => {
      switch (status) {
        case "approved":
          return labelText("approvedStatusLabel", "Approved");
        case "ready_for_review":
          return labelText("readyForReviewStatusLabel", "Ready for Review");
        case "processing_failed":
          return labelText("failedStatusLabel", "Failed");
        default:
          return labelText("processingStatusLabel", "Processing...");
      }
    },
    [labelText],
  );

  const openManualSortDialog = useCallback(() => {
    setManualSortImages(persistedPipelineImages);
    setManualSortDialogOpen(true);
  }, [persistedPipelineImages]);

  const handleManualSortDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;

      const reordered = Array.from(manualSortImages);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      setManualSortImages(reordered);
    },
    [manualSortImages],
  );

  const handleSaveManualSort = useCallback(async () => {
    if (manualSortImages.length <= 1) {
      setManualSortDialogOpen(false);
      return;
    }

    const orderMap = new Map(
      manualSortImages.map((image, index) => [image.id, index]),
    );

    try {
      setIsSavingManualSort(true);
      setIsReorderingImages(true);

      await pipeline.reorderImages(manualSortImages.map((image) => image.id));

      setReviewImages((previous) => {
        const persisted = previous
          .filter((image) => orderMap.has(image.id))
          .sort(
            (left, right) =>
              (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0),
          )
          .map((image) => ({
            ...image,
            sort_order: orderMap.get(image.id) ?? image.sort_order,
          }));
        const transient = previous.filter((image) => !orderMap.has(image.id));

        return [...persisted, ...transient];
      });

      setManualSortDialogOpen(false);
      toast.success(
        (labelText as any)("manualSortSaved", "Image order saved."),
      );
    } catch (error) {
      toast.error(
        (labelText as any)("manualSortFailed", "Failed to save image order."),
      );
      console.error(error);
    } finally {
      setIsSavingManualSort(false);
      setIsReorderingImages(false);
    }
  }, [labelText, manualSortImages, pipeline]);

  const buildOptimisticAutoSortedImages = useCallback(
    (images: ReviewPipelineImage[]) =>
      [...images]
        .map((image) => {
          const existingCategory = String(image.category || "").trim();
          const nextCategory =
            existingCategory && existingCategory !== "General"
              ? existingCategory
              : inferAutoSortCategoryFromName(image.original_name);

          return {
            ...image,
            category: nextCategory,
          };
        })
        .sort((left, right) => {
          const leftRank =
            AUTO_SORT_CATEGORY_ORDER[left.category || "General"] ?? 999;
          const rightRank =
            AUTO_SORT_CATEGORY_ORDER[right.category || "General"] ?? 999;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }

          if (left.sort_order !== right.sort_order) {
            return left.sort_order - right.sort_order;
          }

          return left.id - right.id;
        })
        .map((image, index) => ({
          ...image,
          sort_order: index,
        })),
    [],
  );

  const applyOptimisticAutoSort = useCallback(
    (
      images: ReviewPipelineImage[],
      sortedPersistedImages: ReviewPipelineImage[],
    ) => {
      const persistedIds = new Set(
        sortedPersistedImages.map((image) => image.id),
      );
      const sortedById = new Map(
        sortedPersistedImages.map((image) => [image.id, image]),
      );

      const persisted = images
        .filter((image) => persistedIds.has(image.id))
        .map((image) => {
          const sorted = sortedById.get(image.id);
          if (!sorted) return image;

          return {
            ...image,
            category: sorted.category,
            sort_order: sorted.sort_order,
          };
        })
        .sort((left, right) => left.sort_order - right.sort_order);

      const transient = images.filter((image) => !persistedIds.has(image.id));

      return [...persisted, ...transient];
    },
    [],
  );

  const handleAutoSortImages = useCallback(async () => {
    if (persistedPipelineImages.length <= 1) {
      return;
    }

    const previousPipelineImages = pipeline.images;
    const previousReviewImages = reviewImages;
    const previousManualSortImages = manualSortImages;
    const optimisticPersistedImages = buildOptimisticAutoSortedImages(
      persistedPipelineImages,
    );

    try {
      setIsAutoSortingImages(true);

      const optimisticPipelineImages = applyOptimisticAutoSort(
        pipeline.images,
        optimisticPersistedImages,
      );
      const optimisticReviewImages = applyOptimisticAutoSort(
        reviewImages,
        optimisticPersistedImages,
      );

      pipeline.setImagesDirectly?.({
        images: optimisticPipelineImages,
        stats: pipeline.stats,
        step2_unlocked: pipeline.isStep2Unlocked,
      });
      setReviewImages(optimisticReviewImages);
      setManualSortImages(optimisticPersistedImages);

      await pipeline.autoClassifyImages();
      toast.success("Images sorted instantly.");
    } catch (error) {
      pipeline.setImagesDirectly?.({
        images: previousPipelineImages,
        stats: pipeline.stats,
        step2_unlocked: pipeline.isStep2Unlocked,
      });
      setReviewImages(previousReviewImages);
      setManualSortImages(previousManualSortImages);
      toast.error("Auto-sort failed.");
      console.error(error);
    } finally {
      setIsAutoSortingImages(false);
    }
  }, [
    applyOptimisticAutoSort,
    buildOptimisticAutoSortedImages,
    manualSortImages,
    persistedPipelineImages,
    pipeline,
    reviewImages,
  ]);

  const handleDeleteAllImages = useCallback(async () => {
    if (reviewImages.length === 0) return;

    try {
      setIsDeletingAllImages(true);
      setSelectedLightboxImageId(null);

      const result = await pipeline.deleteImages(
        reviewImages.map((image) => image.id),
      );

      if (result.failed > 0) {
        toast.error(
          `Deleted ${result.deleted} images, ${result.failed} failed.`,
        );
      } else {
        toast.success(`Deleted ${result.deleted} images.`);
      }
    } catch (error) {
      toast.error("Failed to delete images.");
      console.error(error);
    } finally {
      setDeleteAllImagesDialogOpen(false);
      setIsDeletingAllImages(false);
    }
  }, [pipeline, reviewImages]);

  const handleDeleteFailedImages = useCallback(async () => {
    if (failedImages.length === 0) return;

    try {
      setIsDeletingFailedImages(true);
      const result = await pipeline.deleteImages(
        failedImages.map((image) => image.id),
      );

      if (result.failed > 0) {
        toast.error(
          `Deleted ${result.deleted} images, ${result.failed} failed.`,
        );
      } else {
        toast.success(`Deleted ${result.deleted} failed images.`);
        setFailedImagesNavDialogOpen(false);
        handleStepChange(2);
      }
    } catch (error) {
      toast.error("Failed to delete images.");
      console.error(error);
    } finally {
      setIsDeletingFailedImages(false);
    }
  }, [pipeline, failedImages, handleStepChange]);

  const handleGenerateSticker = useCallback(async () => {
    if (!activeYachtId) {
      toast.error("Save the vessel first before generating a sticker.");
      return;
    }

    try {
      setIsGeneratingSticker(true);
      const response = await api.post(
        `/yachts/${activeYachtId}/sticker/generate`,
      );
      setSelectedYacht((prev: any) => ({
        ...(prev || {}),
        ...(response.data || {}),
      }));
      toast.success(
        selectedYacht?.qr_code_path
          ? "Sticker refreshed successfully."
          : "Sticker generated successfully.",
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to generate the sticker.",
      );
    } finally {
      setIsGeneratingSticker(false);
    }
  }, [activeYachtId, api, selectedYacht?.qr_code_path]);

  const openStickerPreview = useCallback(() => {
    if (!activeYachtId) {
      toast.error("Save the vessel first before previewing the sticker.");
      return;
    }

    void (async () => {
      try {
        const response = await api.get(
          `/yachts/${activeYachtId}/sticker/preview`,
          {
            responseType: "blob",
            headers: {
              Accept: "text/html",
            },
          },
        );

        const previewBlob = new Blob([response.data], {
          type: response.headers["content-type"] || "text/html;charset=utf-8",
        });
        const previewUrl = window.URL.createObjectURL(previewBlob);
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => window.URL.revokeObjectURL(previewUrl), 60_000);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to preview the sticker.",
        );
      }
    })();
  }, [activeYachtId, api]);

  const downloadStickerPdf = useCallback(() => {
    if (!activeYachtId) {
      toast.error("Save the vessel first before downloading the sticker.");
      return;
    }

    void (async () => {
      try {
        const response = await api.get(`/yachts/${activeYachtId}/sticker/pdf`, {
          responseType: "blob",
          headers: {
            Accept: "application/pdf",
          },
        });

        const blob = new Blob([response.data], {
          type: response.headers["content-type"] || "application/pdf",
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `sticker-${activeYachtId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to download the sticker.",
        );
      }
    })();
  }, [activeYachtId, api]);

  const moveLightboxImage = useCallback(
    (direction: "next" | "prev") => {
      if (selectedLightboxIndex < 0 || reviewImages.length === 0) return;

      const delta = direction === "next" ? 1 : -1;
      const nextIndex =
        (selectedLightboxIndex + delta + reviewImages.length) %
        reviewImages.length;
      setSelectedLightboxImageId(reviewImages[nextIndex]?.id ?? null);
    },
    [reviewImages, selectedLightboxIndex],
  );

  const resolvePipelineAssetUrl = useCallback(
    (value: string | null | undefined) => {
      if (typeof value !== "string") return null;

      const trimmed = value.trim();
      if (!trimmed) return null;

      if (
        /^(blob:|data:|https?:\/\/)/i.test(trimmed) ||
        trimmed.startsWith("/")
      ) {
        return trimmed;
      }

      const configuredBaseUrl =
        typeof api.defaults.baseURL === "string" ? api.defaults.baseURL : "";
      if (!configuredBaseUrl) return null;

      const relativePath = trimmed
        .replace(/^storage\//, "")
        .replace(/^\/+/, "");

      try {
        const parsedBaseUrl = new URL(
          configuredBaseUrl,
          typeof window !== "undefined" ? window.location.origin : undefined,
        );
        return `${parsedBaseUrl.origin}/storage/${relativePath}`;
      } catch {
        const origin = configuredBaseUrl
          .replace(/\/api\/?$/, "")
          .replace(/\/$/, "");
        return origin ? `${origin}/storage/${relativePath}` : null;
      }
    },
    [],
  );

  const resolveBoatDocumentUrl = useCallback((document: BoatDocumentItem) => {
    const candidate =
      typeof document.file_url === "string" && document.file_url.trim() !== ""
        ? document.file_url
        : document.file_path;

    if (typeof candidate !== "string") {
      return null;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }

    const configuredBaseUrl =
      typeof api.defaults.baseURL === "string" ? api.defaults.baseURL : "";
    let apiOrigin = "";

    try {
      if (configuredBaseUrl) {
        apiOrigin = new URL(
          configuredBaseUrl,
          typeof window !== "undefined" ? window.location.origin : undefined,
        ).origin;
      }
    } catch {
      apiOrigin = configuredBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
    }

    if (/^(blob:|data:)/i.test(trimmed)) {
      return trimmed;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      if (!apiOrigin) {
        return trimmed;
      }

      try {
        const parsedCandidate = new URL(trimmed);
        if (parsedCandidate.pathname.startsWith("/storage/")) {
          return `${apiOrigin}${parsedCandidate.pathname}${parsedCandidate.search}${parsedCandidate.hash}`;
        }
      } catch {
        return trimmed;
      }

      return trimmed;
    }

    if (!apiOrigin) {
      return trimmed.startsWith("/storage/") ? trimmed : null;
    }

    if (trimmed.startsWith("/storage/")) {
      return `${apiOrigin}${trimmed}`;
    }

    const relativePath = trimmed.replace(/^storage\//, "").replace(/^\/+/, "");
    return `${apiOrigin}/storage/${relativePath}`;
  }, []);

  const getPipelineImageCandidates = useCallback(
    (image: PipelineImage) =>
      Array.from(
        new Set(
          [
            image.client_preview_url,
            image.thumb_full_url,
            image.optimized_url,
            image.full_url,
            resolvePipelineAssetUrl(image.thumb_url),
            resolvePipelineAssetUrl(image.optimized_master_url),
            resolvePipelineAssetUrl(image.original_kept_url),
            resolvePipelineAssetUrl(image.original_temp_url),
            resolvePipelineAssetUrl(image.url),
          ].filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          ),
        ),
      ),
    [resolvePipelineAssetUrl],
  );

  const getPipelineImageSourceKey = useCallback(
    (image: PipelineImage) =>
      [
        image.id,
        image.updated_at,
        image.client_preview_url,
        image.thumb_full_url,
        image.optimized_url,
        image.full_url,
      ]
        .map((value) => String(value ?? ""))
        .join("::"),
    [],
  );

  const getPipelineImageSrc = useCallback(
    (image: PipelineImage) => {
      const candidates = getPipelineImageCandidates(image);
      const sourceKey = getPipelineImageSourceKey(image);
      const index = pipelineImageSourceIndexByKey[sourceKey] ?? 0;
      return candidates[index] ?? PLACEHOLDER_IMAGE;
    },
    [
      getPipelineImageCandidates,
      getPipelineImageSourceKey,
      pipelineImageSourceIndexByKey,
    ],
  );

  const isPipelineImageFallbackExhausted = useCallback(
    (image: PipelineImage) => {
      const candidates = getPipelineImageCandidates(image);
      const sourceKey = getPipelineImageSourceKey(image);
      const index = pipelineImageSourceIndexByKey[sourceKey] ?? 0;
      return index >= candidates.length;
    },
    [
      getPipelineImageCandidates,
      getPipelineImageSourceKey,
      pipelineImageSourceIndexByKey,
    ],
  );

  const handlePipelineImageError = useCallback(
    (image: PipelineImage) => {
      const candidateCount = getPipelineImageCandidates(image).length;
      const sourceKey = getPipelineImageSourceKey(image);
      setPipelineImageSourceIndexByKey((previous) => {
        const currentIndex = previous[sourceKey] ?? 0;
        const nextIndex = Math.min(currentIndex + 1, candidateCount);
        if (nextIndex === currentIndex) {
          return previous;
        }

        return {
          ...previous,
          [sourceKey]: nextIndex,
        };
      });
    },
    [getPipelineImageCandidates, getPipelineImageSourceKey],
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // ── OFFLINE PATH: store images locally in IndexedDB ──
    if (!navigator.onLine) {
      setIsUploading(true);
      const toastId = toast.loading(
        `Saving ${files.length} image(s) locally...`,
      );

      try {
        const fileArray = Array.from(files);
        const offlineId = offlineIdRef.current;
        const newOfflineImages: typeof offlineImages = [];
        const newPipelineImages: any[] = [];

        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          const key = `boat_${offlineId}_img_${Date.now()}_${i}`;
          await storeImage(key, file);

          const previewUrl = URL.createObjectURL(file);

          newOfflineImages.push({
            key,
            preview: previewUrl,
            file,
          });

          // ── Inject a faked approved image into the pipeline so it renders instantly ──
          newPipelineImages.push({
            id: Date.now() + i, // fake ID
            yacht_id: 0,
            original_name: file.name,
            full_url: previewUrl,
            thumb_full_url: previewUrl,
            optimized_url: previewUrl,
            thumb_optimized_url: previewUrl,
            status: "approved", // Skip processing straight to approved
            enhancement_method: "none",
            quality_score: 99,
            quality_label: "Offline",
            auto_approved: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        setOfflineImages((prev) => [...prev, ...newOfflineImages]);
        if (pipeline.setImagesDirectly) {
          pipeline.setImagesDirectly({
            images: [...pipeline.images, ...newPipelineImages],
            stats: {
              ...pipeline.stats,
              total: pipeline.stats.total + newPipelineImages.length,
              approved: pipeline.stats.approved + newPipelineImages.length,
            },
            step2_unlocked: true,
          });
        }

        // Auto-set main image if not set
        if (!mainFile && !mainPreview && fileArray.length > 0) {
          setMainFile(fileArray[0]);
          setMainPreview(URL.createObjectURL(fileArray[0]));
        }

        toast.success(
          `${files.length} image(s) saved locally. Will upload when back online.`,
          { id: toastId, icon: "⚡", duration: 4000 },
        );
      } catch (err) {
        console.error("Offline image save failed:", err);
        toast.error("Failed to save images locally", { id: toastId });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
      return;
    }

    // ── ONLINE PATH: original server upload flow ──
    // Check total gallery limit before starting any upload batches.
    if (pipeline.stats.total + files.length > MAX_IMAGES_UPLOAD) {
      toast.error(
        `Maximum ${MAX_IMAGES_UPLOAD} images allowed for this vessel.`,
      );
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} image(s)...`);
    const previousImages = pipeline.images;
    const previousStats = pipeline.stats;
    const previousStep2Unlocked = pipeline.isStep2Unlocked;

    let optimisticImages: ReviewPipelineImage[] = [];

    try {
      const fileArray = Array.from(files);
      const filesToUpload = fileArray;
      let targetId = isNewMode ? createdYachtId : yachtId;
      let shouldSetCreatedYachtId = false;

      const optimisticBaseId = -Date.now();
      optimisticImages = fileArray.map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        localPreviewUrlsRef.current.add(previewUrl);
        return {
          id: optimisticBaseId - index,
          yacht_id: Number(targetId || 0),
          client_upload_key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          client_preview_url: previewUrl,
          url: previewUrl,
          original_temp_url: previewUrl,
          optimized_master_url: previewUrl,
          thumb_url: previewUrl,
          original_kept_url: null,
          status: "processing",
          keep_original: false,
          quality_score: null,
          quality_flags: null,
          quality_label: labelText("processingStatusLabel", "Processing..."),
          category: "general",
          original_name: file.name,
          sort_order: pipeline.images.length + index,
          optimized_url: previewUrl,
          thumb_full_url: previewUrl,
          full_url: previewUrl,
          enhancement_method: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Render instant previews while upload/process is still running.
      setPendingUploadPreviews((previous) => [
        ...previous,
        ...optimisticImages,
      ]);
      pipeline.setImagesDirectly?.({
        images: [...pipeline.images, ...optimisticImages],
        stats: {
          ...pipeline.stats,
          total: pipeline.stats.total + optimisticImages.length,
          processing: pipeline.stats.processing + optimisticImages.length,
        },
        step2_unlocked: pipeline.isStep2Unlocked,
      });

      // ── Skipped orientation/WebP conversion to match old project speeds ──
      // Backend ImageProcessingService now efficiently handles all WebP
      // encoding, EXIF rotation, and thumbnail generation in a background job.
      // ---------------------------------------------------------------------

      // Recover from stale draft yacht IDs restored from local draft state only once.
      if (isNewMode && targetId) {
        const numericTargetId = Number(targetId);
        if (
          Number.isFinite(numericTargetId) &&
          verifiedDraftYachtIdRef.current !== numericTargetId
        ) {
          try {
            await api.get(`/yachts/${targetId}`);
            verifiedDraftYachtIdRef.current = numericTargetId;
          } catch (err: any) {
            if (err?.response?.status === 404) {
              targetId = null;
              verifiedDraftYachtIdRef.current = null;
            } else {
              throw err;
            }
          }
        }
      }

      // Auto-create draft yacht upon first image drop in new mode
      if (isNewMode && !targetId) {
        toast.loading("Creating vessel draft...", { id: toastId });
        targetId = await createBootstrapDraftYacht();
        shouldSetCreatedYachtId = true;
        verifiedDraftYachtIdRef.current = Number(targetId);
      }

      if (!targetId) {
        throw new Error("Unable to resolve yacht id for upload");
      }

      const batches: File[][] = [];
      for (let i = 0; i < filesToUpload.length; i += UPLOAD_BATCH_SIZE) {
        batches.push(filesToUpload.slice(i, i + UPLOAD_BATCH_SIZE));
      }

      let uploadedCount = 0;
      let failedBatches = 0;
      const uploadedImages: PipelineImage[] = [];

      for (let i = 0; i < batches.length; i += UPLOAD_MAX_PARALLEL_BATCHES) {
        const chunk = batches.slice(i, i + UPLOAD_MAX_PARALLEL_BATCHES);
        toast.loading(
          `Uploading batch ${Math.min(i + chunk.length, batches.length)} of ${batches.length}...`,
          { id: toastId },
        );

        const settled = await Promise.allSettled(
          chunk.map(async (batchFiles) => {
            const uploadFd = new FormData();
            batchFiles.forEach((file) => uploadFd.append("images[]", file));
            const res = await api.post(
              `/yachts/${targetId}/images/upload`,
              uploadFd,
              {
                headers: { "Content-Type": "multipart/form-data" },
              },
            );
            const responseImages = Array.isArray(res.data?.images)
              ? (res.data.images as PipelineImage[])
              : [];
            return {
              count: responseImages.length,
              images: responseImages,
            };
          }),
        );

        settled.forEach((result) => {
          if (result.status === "fulfilled") {
            uploadedCount += result.value.count;
            uploadedImages.push(...result.value.images);
          } else {
            failedBatches += 1;
            console.error("[Upload] Batch failed:", result.reason);
          }
        });
      }

      if (uploadedCount === 0) {
        throw new Error("No images uploaded");
      }

      const failedImageCount = Math.max(fileArray.length - uploadedCount, 0);

      // Auto-set the first uploaded file as main profile
      if (!mainFile && !mainPreview && filesToUpload.length > 0) {
        setMainFile(filesToUpload[0]);
        setMainPreview(URL.createObjectURL(filesToUpload[0]));
      }

      toast.success(
        failedBatches > 0 || failedImageCount > 0
          ? `${uploadedCount} images queued.${failedBatches > 0 ? ` ${failedBatches} batch(es) failed.` : ""}${failedImageCount > 0 ? ` ${failedImageCount} image(s) could not be attached.` : ""}`
          : `${uploadedCount} images sent for processing!`,
        {
          id: toastId,
        },
      );

      const previewQueueByName = new Map<string, string[]>();
      fileArray.forEach((file, index) => {
        const previewUrl = optimisticImages[index]?.client_preview_url;
        if (!previewUrl) return;
        const queue = previewQueueByName.get(file.name) || [];
        queue.push(previewUrl);
        previewQueueByName.set(file.name, queue);
      });

      if (uploadedImages.length > 0) {
        const hydratedUploadedImages = uploadedImages.map((image) => {
          const previewQueue =
            typeof image.original_name === "string"
              ? previewQueueByName.get(image.original_name)
              : undefined;
          const previewUrl = previewQueue?.shift() || null;

          if (!previewUrl) {
            return image;
          }

          return {
            ...image,
            client_preview_url: previewUrl,
          };
        });

        pipeline.setImagesDirectly?.({
          images: [...previousImages, ...hydratedUploadedImages],
          stats: {
            ...previousStats,
            total: previousStats.total + hydratedUploadedImages.length,
            approved:
              previousStats.approved +
              hydratedUploadedImages.filter(
                (image) => image.status === "approved",
              ).length,
            processing:
              previousStats.processing +
              hydratedUploadedImages.filter(
                (image) =>
                  image.status === "processing" ||
                  image.enhancement_method === "pending",
              ).length,
            ready:
              previousStats.ready +
              hydratedUploadedImages.filter(
                (image) => image.status === "ready_for_review",
              ).length,
            min_required: previousStats.min_required,
          },
          step2_unlocked:
            previousStep2Unlocked ||
            hydratedUploadedImages.some((image) => image.status === "approved"),
        });

        const uploadedCountsByName = new Map<string, number>();
        hydratedUploadedImages.forEach((image) => {
          const key = normalizePipelineImageName(image.original_name);
          uploadedCountsByName.set(
            key,
            (uploadedCountsByName.get(key) || 0) + 1,
          );
        });

        setPendingUploadPreviews((previous) =>
          previous.filter((image) => {
            if (
              optimisticImages.some((optimistic) => optimistic.id === image.id)
            ) {
              return false;
            }

            const key = normalizePipelineImageName(image.original_name);
            const availableCount = uploadedCountsByName.get(key) || 0;
            if (availableCount <= 0) {
              return true;
            }

            uploadedCountsByName.set(key, availableCount - 1);
            return false;
          }),
        );
      }

      if (shouldSetCreatedYachtId) {
        setCreatedYachtId(Number(targetId));
      }
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload images", { id: toastId });

      const optimisticUrls: string[] = optimisticImages
        .map((img: PipelineImage) => img.client_preview_url)
        .filter((url): url is string => typeof url === "string");
      optimisticUrls.forEach((url: string) => URL.revokeObjectURL(url));
      setPendingUploadPreviews((previous) =>
        previous.filter(
          (image) =>
            !optimisticImages.some((optimistic) => optimistic.id === image.id),
        ),
      );
      pipeline.setImagesDirectly?.({
        images: previousImages,
        stats: previousStats,
        step2_unlocked: previousStep2Unlocked,
      });
      // Reset to backend truth if optimistic previews were shown.
      if (pipeline.refreshImages) await pipeline.refreshImages();
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Helper: check if a field needs user confirmation
  useEffect(() => {
    handleAiExtractRef.current = handleAiExtract;
  }, [handleAiExtract]);

  useEffect(() => {
    if (
      hasCompletedAiExtraction &&
      currentPipelineExtractionSignature &&
      lastSuccessfulExtractionSignatureRef.current === null
    ) {
      lastSuccessfulExtractionSignatureRef.current =
        currentPipelineExtractionSignature;
    }
  }, [currentPipelineExtractionSignature, hasCompletedAiExtraction]);



  useEffect(() => {
    if (activeStep !== 3) return;
    const targetId = isNewMode ? createdYachtId : yachtId;
    if (!targetId || isRegenerating) return;
    if (!hasDescriptionContext || !needsAutoDescriptionGeneration) return;
    if (
      lastDescriptionRequestSignatureRef.current === descriptionRequestSignature
    ) {
      return;
    }

    lastDescriptionRequestSignatureRef.current = descriptionRequestSignature;
    void handleRegenerateDescription({
      silent: true,
      signature: descriptionRequestSignature,
    });
  }, [
    activeStep,
    isNewMode,
    createdYachtId,
    yachtId,
    isRegenerating,
    hasDescriptionContext,
    needsAutoDescriptionGeneration,
    descriptionRequestSignature,
    handleRegenerateDescription,
  ]);

  const toggleDictation = () => {
    if (!recognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isDictating) {
      recognition.stop();
      setIsDictating(false);
    } else {
      recognition.lang = DESCRIPTION_LANGUAGE_LOCALES[selectedLang];
      recognition.start();
      setIsDictating(true);
      toast.success("Listening... Speak now");
    }
  };

  const handleMagicAutoFill = async () => {
    if (!navigator.onLine) {
      toast.error(
        "Magic Auto-fill requires an internet connection. You can fill in details manually.",
      );
      return;
    }

    setExtractionType("magic");
    setIsExtracting(true);
    setShowExtractModal(true);

    try {
      const toBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.onerror = (error) => reject(error);
        });

      const base64Images = [];
      for (const item of pipeline.images.slice(0, 3)) {
        // Max 3 for payload size
        try {
          // Fetch the blob from the pipeline URL and convert to Base64
          const res = await fetch(item.optimized_url || item.full_url);
          const blob = await res.blob();
          const fileObj = new File([blob], "image.webp", { type: blob.type });
          const b64 = await toBase64(fileObj);
          base64Images.push(b64);
        } catch (e) {
          console.error("Failed to convert pipeline image for autofill", e);
        }
      }

      const payload = {
        text_input: boatHint || (selectedYacht?.boat_name ?? ""),
        images: base64Images,
      };

      const res = await api.post("/ai/autofill-rag", payload);

      if (res.data?.success && res.data?.consensus) {
        const consensus = res.data.consensus;

        setSelectedYacht((prev: any) => ({
          ...(prev || {}),
          manufacturer: consensus.brand_name || prev?.manufacturer,
          model: consensus.model_name || prev?.model,
          year: consensus.year || prev?.year,
          loa: consensus.length || prev?.loa,
          boat_type: consensus.type_name || prev?.boat_type,
        }));

        if (consensus.brand_id) {
          setSelectedBrandId(consensus.brand_id);
        }

        setFormKey((k) => k + 1);
        toast.success(
          `🪄 Magic Fill Success! (${consensus.confidence_score}% confidence)`,
        );
      } else {
        toast.error("No relevant consensus could be built from catalog.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error || "Magic Autofill failed.");
    } finally {
      setIsExtracting(false);
      setShowExtractModal(false);
    }
  };

  const removeStagedImage = (index: number) => {
    setAiStaging((prev) => {
      const newItems = [...prev];
      const removed = newItems[index];

      // If it was the main profile image, clear main preview
      if (mainPreview === removed.preview) {
        setMainPreview(null);
        setMainFile(null);
      }

      newItems.splice(index, 1);
      return newItems;
    });
  };

  const setAsMainProfileImage = (index: number) => {
    const item = aiStaging[index];
    setMainFile(item.file);
    setMainPreview(item.preview);
    toast.success("Profile image updated");
  };

  // Availability Handlers
  const addAvailabilityRule = () => {
    // In the 7-day model, we don't "add" rules, they are always there.
    // This is kept for compatibility with WizardStep4Props interface if needed.
  };

  const removeAvailabilityRule = (index: number) => {
    // In the 7-day model, we "disable" instead of remove.
  };

  const updateAvailabilityRule = (
    index: number,
    field: keyof AvailabilityRule,
    value: any,
  ) => {
    const newRules = [...availabilityRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setAvailabilityRules(newRules);
  };

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;

    if (!target?.name) return;
    if (target instanceof HTMLInputElement && target.type === "file") return;

    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;

    setSelectedYacht((prev: any) => ({
      ...(prev || {}),
      [target.name]: value,
    }));
  };

  // --- 3. SIMPLIFIED SUBMIT LOGIC ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors(null);

    // Create form data directly without validation
    const formData = new FormData();
    formData.append("manufacturer", step1Brand);
    formData.append("model", step1Model);
    formData.append("year", step1Year);
    formData.append("owners_comment", boatHint);

    const toFormValue = (value: unknown): string | null => {
      const sanitized = sanitizeScalarFieldValue(value);
      if (sanitized === null) return null;
      if (typeof sanitized === "boolean") return sanitized ? "true" : "false";
      const stringValue = String(sanitized);
      return stringValue.trim() === "" ? null : stringValue;
    };

    const getFieldValue = (field: string): string | null => {
      const element = document.querySelector(`[name="${field}"]`) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;

      if (element) {
        if (
          element instanceof HTMLInputElement &&
          element.type === "checkbox"
        ) {
          return element.checked ? "true" : "false";
        }
        return toFormValue(element.value);
      }

      return toFormValue(selectedYacht?.[field]);
    };

    const normalizeComparableValue = (
      field: string,
      value: unknown,
    ): string => {
      if (isOptionalTriStateField(field)) {
        return normalizeTriStateValue(value) || "";
      }
      if (typeof value === "boolean") return value ? "true" : "false";
      return String(value ?? "")
        .trim()
        .toLowerCase();
    };

    // Add primary fields first (from visible inputs OR persisted form state)
    const boatName = getFieldValue("boat_name");
    const price = getFieldValue("price");
    const minBidAmount = getFieldValue("min_bid_amount");

    if (boatName !== null) formData.append("boat_name", boatName);
    if (price !== null) formData.append("price", price);
    if (minBidAmount !== null) formData.append("min_bid_amount", minBidAmount);

    // Add main image if exists
    if (mainFile) {
      formData.append("main_image", mainFile);
    }

    // Add all other fields from form
    yachtSubmitFieldNames.forEach((field) => {
      const value = getFieldValue(field);
      if (value !== null) {
        formData.append(field, value);
      }
    });

    const normalizedStatus =
      normalizeStatusForApi(getFieldValue("status") ?? selectedYacht?.status) ??
      "draft";
    formData.set("status", normalizedStatus);

    const locationId =
      getFieldValue("location_id") ??
      toFormValue(selectedWizardLocationId);

    if (locationId !== null) {
      formData.set("location_id", locationId);
    }

    if (matchedBoat?.matched && matchedBoat?.template?.template_id) {
      formData.set("template_id", matchedBoat.template.template_id.toString());
    }

    // Handle boolean fields - SIMPLIFIED
    const booleanFields = ["allow_bidding", "flybridge", "air_conditioning"];
    const truthySet = new Set([true, "true", 1, "1"]);

    booleanFields.forEach((field) => {
      const checkbox = document.querySelector(
        `[name="${field}"]`,
      ) as HTMLInputElement;
      if (checkbox && checkbox.type === "checkbox") {
        formData.append(field, checkbox.checked ? "true" : "false");
      } else {
        const fallback = selectedYacht?.[field];
        formData.append(field, truthySet.has(fallback) ? "true" : "false");
      }
    });

    // Ensure rich-text descriptions are included even when user submits from Step 5.
    if (aiTexts.en?.trim())
      formData.set("short_description_en", aiTexts.en.trim());
    if (aiTexts.nl?.trim())
      formData.set("short_description_nl", aiTexts.nl.trim());
    if (aiTexts.de?.trim())
      formData.set("short_description_de", aiTexts.de.trim());
    if (aiTexts.fr?.trim())
      formData.set("short_description_fr", aiTexts.fr.trim());

    // Add scheduling settings payload
    const schedulingPayload = {
      booking_allow_instant: schedulingSettings.booking_allow_instant
        ? "true"
        : "false",
      booking_allow_rescheduling: schedulingSettings.booking_allow_rescheduling
        ? "true"
        : "false",
      booking_reschedule_cutoff_hours:
        schedulingSettings.booking_allow_rescheduling &&
        schedulingSettings.booking_reschedule_cutoff_hours !== "none"
          ? schedulingSettings.booking_reschedule_cutoff_hours
          : "0",
      booking_allow_cancellations: schedulingSettings.booking_allow_cancellations
        ? "true"
        : "false",
      booking_cancellation_cutoff_hours:
        schedulingSettings.booking_allow_cancellations &&
        schedulingSettings.booking_cancellation_cutoff_hours !== "none"
          ? schedulingSettings.booking_cancellation_cutoff_hours
          : "0",
    };

    Object.entries(schedulingPayload).forEach(([field, value]) => {
      formData.set(field, value);
    });

    // Add availability rules
    if (availabilityRules.length > 0) {
      const expandedRules = availabilityRules
        .filter((r) => r.enabled)
        .map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
        }));
      formData.append("availability_rules", JSON.stringify(expandedRules));
    }

    // Attach AI correction context so backend can log proposal-vs-final deltas.
    const extractionValues = toObjectRecord(extractionResult);
    const aiSessionId = confidenceMeta?.ai_session_id || null;
    const modelName = confidenceMeta?.model_name || null;
    const fieldConfidence = confidenceMeta?.field_confidence || {};
    const aiSuggestedFields = Object.entries(extractionValues).filter(
      ([, value]) => value !== null,
    );

    if (aiSessionId) {
      formData.append("ai_session_id", aiSessionId);
    }
    if (modelName) {
      formData.append("model_name", modelName);
    }
    if (Object.keys(fieldConfidence).length > 0) {
      formData.append("field_confidence", JSON.stringify(fieldConfidence));
    }

    // Add Correction Feedback
    if (Object.keys(fieldCorrectionLabels).length > 0) {
      formData.append(
        "field_correction_labels",
        JSON.stringify(fieldCorrectionLabels),
      );
    }

    formData.append("changed_by_type", role === "admin" ? "admin" : "user");

    let changedAiFieldCount = 0;
    let guessedTooMuchCount = 0;
    for (const [field, aiValue] of aiSuggestedFields) {
      const currentValue =
        getFieldValue(field) ?? selectedYacht?.[field] ?? null;
      const aiNormalized = normalizeComparableValue(field, aiValue);
      const currentNormalized = normalizeComparableValue(field, currentValue);
      if (aiNormalized !== currentNormalized) {
        changedAiFieldCount++;
        if (
          isOptionalTriStateField(field) &&
          aiNormalized === "yes" &&
          currentNormalized !== "yes"
        ) {
          guessedTooMuchCount++;
        }
      }
    }

    if (aiSessionId && changedAiFieldCount > 0) {
      const autoLabel: CorrectionLabel =
        guessedTooMuchCount > 0
          ? "guessed_too_much"
          : "wrong_text_interpretation";
      formData.append("correction_label", correctionLabel ?? autoLabel);
      formData.append("source_type", "manual");
      formData.append(
        "change_reason",
        guessedTooMuchCount > 0
          ? `Reviewer downgraded ${guessedTooMuchCount} optional AI equipment guess(es).`
          : `Reviewer adjusted ${changedAiFieldCount} AI-suggested field(s) before save.`,
      );
    } else if (correctionLabel) {
      formData.append("correction_label", correctionLabel);
      formData.append("source_type", "manual");
    }

    try {
      let finalYachtId = selectedYacht?.id ?? createdYachtId ?? null;
      let savedYachtPayload: any = null;

      // Recover from stale draft yacht IDs restored from local draft state.
      if (isNewMode && finalYachtId) {
        try {
          await api.get(`/yachts/${finalYachtId}`);
        } catch (err: any) {
          if (err?.response?.status === 404) {
            finalYachtId = null;
            setCreatedYachtId(null);
          } else {
            throw err;
          }
        }
      }

      if (finalYachtId) {
        // UPDATE existing yacht (including auto-created draft in "new" flow)
        formData.append("_method", "PUT");
        try {
          const updateRes = await api.post(`/yachts/${finalYachtId}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              "X-Allow-Create-If-Missing": "1",
            },
          });
          savedYachtPayload = updateRes.data;
        } catch (updateErr: any) {
          // If the draft yacht was deleted server-side, transparently create a new draft yacht.
          if (isNewMode && updateErr?.response?.status === 404) {
            formData.delete("_method");
            const res = await api.post("/yachts", formData, {
              headers: {
                "X-Offline-ID": offlineIdRef.current,
                "Content-Type": "multipart/form-data",
              },
            });
            savedYachtPayload = res.data;
            finalYachtId = res.data.id;
          } else {
            throw updateErr;
          }
        }
      } else {
        // CREATE NEW
        const res = await api.post("/yachts", formData, {
          headers: {
            "X-Offline-ID": offlineIdRef.current,
            "Content-Type": "multipart/form-data",
          },
        });
        savedYachtPayload = res.data;
        finalYachtId = res.data.id;
      }

      if (savedYachtPayload) {
        setSelectedYacht(savedYachtPayload);
        setFormKey((k) => k + 1);
      }

      if (finalYachtId && !selectedYacht?.id) {
        setCreatedYachtId(Number(finalYachtId));
      }

      // Mark synced in local DB if we had one
      try {
        const local = await getLocalBoat(offlineIdRef.current);
        if (local) {
          await updateLocalBoat(offlineIdRef.current, {
            status: "synced",
            retry_count: 0,
          });
        }
      } catch (e) {
        // Ignore
      }

      // Best-effort finalize/commit draft on backend.
      if (typeof window !== "undefined" && localStorage.getItem("auth_token")) {
        try {
          const snapshot = buildServerDraftSnapshot();
          const nextWizardStep = activeStep === 5 ? 6 : activeStep;
          const savedDraft = await createOrReplaceYachtDraft({
            draft_id: snapshot.draftId,
            yacht_id: Number(finalYachtId),
            wizard_step: nextWizardStep,
            payload_json: snapshot.payloadPatch,
            ui_state_json: snapshot.uiStatePatch,
            images_manifest_json: snapshot.imagesManifestPatch,
            ai_state_json: snapshot.aiStatePatch,
            version: serverDraftVersionRef.current ?? undefined,
            client_saved_at: new Date().toISOString(),
          });
          serverDraftVersionRef.current = savedDraft.version;

          const committed = await commitYachtDraft(snapshot.draftId, {
            version: serverDraftVersionRef.current,
          });
          serverDraftVersionRef.current = committed.version;
        } catch (commitErr) {
          console.warn("[DraftSync] Draft commit failed:", commitErr);
        }
      }

      // Draft is now persisted server-side, clear local wizard draft.
      await clearDraft();
      // Mark this draft as completed so next visit to /yachts/new starts fresh
      if (isNewMode) {
        localStorage.setItem(completedDraftStorageKey, "1");
        localStorage.removeItem(aiMetaStorageKey);
      }

      // (Legacy manual bulk image gallery submission removed; handled by Image Pipeline now)

      toast.success(
        isNewMode
          ? "Vessel Registered Successfully"
          : "Manifest Updated Successfully",
      );
      setActiveStep(6);
      setDraftStep(6);
      router.replace(
        `/${locale}/dashboard/${role}/yachts/${finalYachtId}?step=6`,
      );
    } catch (err: any) {
      console.error("Submission error:", err);

      if (err.response?.status === 422) {
        setErrors(err.response?.data?.errors || {});

        const serverMessage =
          err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {})
            .flat()
            .find((msg) => typeof msg === "string");

        toast.error(
          typeof serverMessage === "string" && serverMessage.trim()
            ? serverMessage
            : "Please check required fields",
        );
      } else if (err.response?.status === 403) {
        toast.error("Permission denied.");
      } else if (err.response?.status === 500) {
        const serverMessage =
          err.response?.data?.message || err.response?.data?.error;
        toast.error(serverMessage || "Server error. Please try again.");
      } else {
        toast.error(`Error: ${err.response?.data?.message || "System Error"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950">
        <Loader2 className="animate-spin text-[#003566]" size={40} />
      </div>
    );
  }

  return (
    <div className="yacht-editor-theme bg-[#F8FAFC]">
      {!suppressCreationToasts && <Toaster position="top-right" />}

      {showExtractModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-7 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
              <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {labelText("extractionInProgress", "AI Extraction in Progress")}
            </h3>
            <p className="text-sm text-slate-500 mt-2 min-h-[40px]">
              {extractionStatus ||
                (extractionType === "gemini"
                  ? "AI is analyzing your yacht photos and preparing fields."
                  : "🪄 RAG Engine is searching Pinecone to find consensus and auto-filling details...")}
            </p>
            <div className="mt-5 space-y-3">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>
                  {labelText("percentComplete", "{percent}% Complete").replace(
                    "{percent}",
                    String(extractionProgress),
                  )}
                </span>
                <span>
                  {labelText(
                    "secondsRemaining",
                    "Approx. {seconds}s remaining",
                  ).replace("{seconds}", String(extractionCountdown))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP INDICATOR (circles with connecting lines) ──── */}
      <div className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-7 px-6">
          {visibleWizardSteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const stepVisibleIndex = visibleWizardSteps.findIndex(
              (visibleStep) => visibleStep.id === step.id,
            );
            const isCompleted =
              !isNewMode ||
              stepVisibleIndex < activeVisibleStepIndex ||
              (activeVisibleStepIndex === visibleWizardSteps.length - 1 &&
                stepVisibleIndex === activeVisibleStepIndex);
            const isPast = isActive || isCompleted;
            const isLocked =
              (!canProceedFromStep1 && step.id > 1) ||
              (isNewMode && isExtracting && step.id > 1) ||
              (isNewMode && step.id === 6 && !createdYachtId);
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepChange(step.id)}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? isNewMode && step.id === 6 && !createdYachtId
                        ? labelText("saveVesselFirst", "Save Vessel First")
                        : labelText(
                            "approveImagesFirst",
                            "Approve Images First",
                          )
                      : step.label
                  }
                  className={`
                    w-[54px] h-[54px] rounded-full flex items-center justify-center
                    text-[18px] font-bold border-[3px] transition-all duration-300
                    ${
                      isLocked
                        ? "border-slate-200 text-slate-300 bg-slate-100 cursor-not-allowed opacity-50"
                        : isPast
                          ? "border-[#2563eb] text-[#2563eb] bg-white hover:bg-blue-50 cursor-pointer"
                          : "border-[#d4d8de] text-[#b0b5bd] bg-[#f0f2f5] hover:border-[#b0b5bd] cursor-pointer"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check size={20} strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </button>
                {index < visibleWizardSteps.length - 1 && (
                  <div
                    className={`w-[60px] sm:w-[80px] md:w-[100px] h-[3px] transition-all duration-300 ${
                      stepVisibleIndex < activeVisibleStepIndex
                        ? "bg-[#2563eb]"
                        : "bg-[#d4d8de]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PAGE HEADER */}
      <div className="bg-[#003566] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,rgba(0,0,0,0.2)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px]" />
        <div className="max-w-7xl mx-auto px-6 py-6 relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-white/70" />
            </button>
            <div>
              <h1 className="text-xl lg:text-2xl font-serif italic text-white">
                {isNewMode
                  ? t?.header?.newTitle ||
                    labelText("newTitle", "Register New Vessel")
                  : (
                      t?.header?.editTitle ||
                      labelText("editTitle", "Edit Vessel")
                    )?.replace(
                      "{name}",
                      selectedYacht?.boat_name ||
                        labelText("loadingName", "Loading..."),
                    )}
              </h1>
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mt-0.5">
                Step {activeVisibleStepIndex + 1} of {visibleWizardSteps.length}{" "}
                &middot; {visibleWizardSteps[activeVisibleStepIndex]?.label}
              </p>
            </div>
          </div>
          {role === "admin" && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(`/${locale}/dashboard/${role}/yachts/settings`)
              }
              className="h-10 w-full border-white/20 bg-white/10 px-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15 hover:text-white lg:w-auto"
            >
              <Settings2 size={14} className="mr-2" />
              Field Settings
            </Button>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6 lg:p-12 pt-16">
        <form
          onSubmit={handleSubmit}
          onChange={handleFormChange}
          className="space-y-16"
        >
          {/* ERROR SUMMARY */}
          {errors && Object.keys(errors).length > 0 && (
            <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700">
              <div className="flex items-center gap-2 mb-3 font-bold text-sm">
                <AlertCircle size={16} />{" "}
                {labelText("dataConflictDetected", "Data Conflict Detected")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.keys(errors).map((key) => (
                  <p key={key} className="text-xs font-medium">
                    ● {key.toUpperCase()}: {errors[key][0]}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 1: ASSETS (Analyzed by AI) ──────────────── */}
          {activeStep === 1 && (
            <WizardStep1
              labelText={labelText}
              role={role}
              isClientRole={isClientRole}
              isNewMode={isNewMode}
              isOnline={isOnline}
              step1Type={step1Type}
              setStep1Type={setStep1Type}
              step1Category={step1Category}
              setStep1Category={setStep1Category}
              step1Brand={step1Brand}
              setStep1Brand={setStep1Brand}
              selectedBrandId={selectedBrandId}
              setSelectedBrandId={setSelectedBrandId}
              step1Model={step1Model}
              setStep1Model={setStep1Model}
              step1Year={step1Year}
              setStep1Year={setStep1Year}
              boatHint={boatHint}
              setBoatHint={setBoatHint}
              isMatchingBoat={isMatchingBoat}
              matchedBoat={matchedBoat}
              isExtracting={isExtracting}
              hasCompletedAiExtraction={hasCompletedAiExtraction}
              handleAiExtract={handleAiExtract}
              shouldShowImageUploadDropzone={shouldShowImageUploadDropzone}
              hasInFlightImageUploads={hasInFlightImageUploads}
              MAX_IMAGES_UPLOAD={MAX_IMAGES_UPLOAD}
              handleImageUpload={handleImageUpload}
              shouldShowImageGrid={shouldShowImageGrid}
              displayTotalImageCount={displayTotalImageCount}
              displayReadyForReviewCount={displayReadyForReviewCount}
              displayApprovedCount={displayApprovedCount}
              isReorderingImages={isReorderingImages}
              imageGridDensity={imageGridDensity}
              setImageGridDensity={setImageGridDensity}
              canManualSortImages={canManualSortImages}
              openManualSortDialog={openManualSortDialog}
              handleAutoSortImages={handleAutoSortImages}
              isAutoSortingImages={isAutoSortingImages}
              setDeleteAllImagesDialogOpen={setDeleteAllImagesDialogOpen}
              isDeletingAllImages={isDeletingAllImages}
              pipeline={pipeline}
              reviewImages={reviewImages}
              gridClassName={gridClassName}
              getPipelineImageSrc={getPipelineImageSrc}
              handlePipelineImageError={handlePipelineImageError}
              setSelectedLightboxImageId={setSelectedLightboxImageId}
              isPipelineImageFallbackExhausted={isPipelineImageFallbackExhausted}
              getPipelineStatusLabel={getPipelineStatusLabel}
              buildImageAiNotes={buildImageAiNotes}
              handlePipelineDragEnd={handlePipelineDragEnd}
              manualSortDialogOpen={manualSortDialogOpen}
              setManualSortDialogOpen={setManualSortDialogOpen}
              manualSortImages={manualSortImages}
              handleManualSortDragEnd={handleManualSortDragEnd}
              isSavingManualSort={isSavingManualSort}
              handleSaveManualSort={handleSaveManualSort}
              selectedLightboxImage={selectedLightboxImage}
              selectedLightboxIndex={selectedLightboxIndex}
              moveLightboxImage={moveLightboxImage}
              referenceBoatDocuments={referenceBoatDocuments}
              resolveBoatDocumentUrl={resolveBoatDocumentUrl}
              handleDocumentDelete={handleDocumentDelete}
              handleReferenceDocumentDragEnd={handleReferenceDocumentDragEnd}
              isUploadingDocument={isUploadingDocument}
              documentDropTarget={documentDropTarget}
              handleDocumentDragOver={handleDocumentDragOver}
              handleDocumentDragLeave={handleDocumentDragLeave}
              handleDocumentDrop={handleDocumentDrop}
              handleDocumentInputChange={handleDocumentInputChange}
              showStepOneVideoSection={showStepOneVideoSection}
              marketingVideos={marketingVideos}
              isGeneratingMarketingVideo={isGeneratingMarketingVideo}
              handleGenerateMarketingVideo={handleGenerateMarketingVideo}
              isUploadingVideo={isUploadingVideo}
              handleVideoUpload={handleVideoUpload}
              isPublishingVideo={isPublishingVideo}
              handleNotifyMarketingVideoOwner={handleNotifyMarketingVideoOwner}
              socialLibraryHref={socialLibraryHref}
              loadMarketingVideos={loadMarketingVideos}
              yachtId={yachtId}
              createdYachtId={createdYachtId}
              handleVideoPublish={handleVideoPublish}
              handleVideoDelete={handleVideoDelete}
              boatVideos={boatVideos}
              t={t}
              locale={locale}
              setActiveStep={setActiveStep}
              offlineImages={offlineImages}
              router={router}
              canProceedFromStep1={canProceedFromStep1}
              shouldRefreshAiExtraction={shouldRefreshAiExtraction}
              toast={toast}
            />
          )}

          {/* ── STEP 2: SPECS (Analyzed by AI) ──────────────── */}
          {activeStep === 2 && (
            <WizardStep2
              selectedYacht={selectedYacht}
              setSelectedYacht={setSelectedYacht}
              formKey={formKey}
              setFormKey={setFormKey}
              isClientRole={isClientRole}
              locations={locations}
              preferredLocationId={preferredLocationId}
              currentUserLocationName={currentUserLocationName}
              currentUserLocationCode={currentUserLocationCode}
              selectedBrandId={selectedBrandId}
              setSelectedBrandId={setSelectedBrandId}
              selectedLocationId={selectedWizardLocationId}
              setSelectedLocationId={setSelectedWizardLocationId}
              labelText={labelText}
              commonText={commonText}
              resolveFieldHelpText={resolveFieldHelpText}
              extraLabelText={extraLabelText}
              sectionText={sectionText}
              placeholderText={placeholderText}
              localizeFieldLabel={localizeFieldLabel}
              needsConfirm={needsConfirm}
              handleFieldCorrectionLabelChange={handleFieldCorrectionLabelChange}
              fieldCorrectionLabels={fieldCorrectionLabels}
              selectedYachtStatusForForm={selectedYachtStatusForForm}
              hullConfigBlock={hullConfigBlock}
              engineConfigBlock={engineConfigBlock}
              accommodationConfigBlock={accommodationConfigBlock}
              navigationConfigBlock={navigationConfigBlock}
              safetyConfigBlock={safetyConfigBlock}
              electricalConfigBlock={electricalConfigBlock}
              comfortConfigBlock={comfortConfigBlock}
              deckConfigBlock={deckConfigBlock}
              riggingConfigBlock={riggingConfigBlock}
              shouldUseDynamicHullBlock={shouldUseDynamicHullBlock}
              shouldUseDynamicEngineBlock={shouldUseDynamicEngineBlock}
              shouldUseDynamicAccommodationBlock={shouldUseDynamicAccommodationBlock}
              shouldUseDynamicNavigationBlock={shouldUseDynamicNavigationBlock}
              shouldUseDynamicSafetyBlock={shouldUseDynamicSafetyBlock}
              shouldUseDynamicElectricalBlock={shouldUseDynamicElectricalBlock}
              shouldUseDynamicComfortBlock={shouldUseDynamicComfortBlock}
              shouldUseDynamicDeckBlock={shouldUseDynamicDeckBlock}
              shouldUseDynamicRiggingBlock={shouldUseDynamicRiggingBlock}
              selectedYachtId={selectedYachtId}
              OPTIONAL_TRI_STATE_FIELDS={OPTIONAL_TRI_STATE_FIELDS}
              getConfigBlockExpansionKey={getConfigBlockExpansionKey}
              sanitizeScalarFieldValue={sanitizeScalarFieldValue}
              isOptionalTriStateField={isOptionalTriStateField}
              yachtFormText={yachtFormText}
            />
          )}

          {/* ── STEP 3: TEXT (AI Generated) ──────────────── */}
          {activeStep === 3 && (
            <WizardStep3
              selectedLang={selectedLang}
              setSelectedLang={setSelectedLang}
              aiTone={aiTone}
              setAiTone={setAiTone}
              aiMinWords={aiMinWords}
              setAiMinWords={setAiMinWords}
              aiMaxWords={aiMaxWords}
              setAiMaxWords={setAiMaxWords}
              aiTexts={aiTexts}
              setAiTexts={setAiTexts}
              isRegenerating={isRegenerating}
              handleRegenerateDescription={handleRegenerateDescription}
              isDictating={isDictating}
              toggleDictation={toggleDictation}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              isPlayingAudio={isPlayingAudio}
              setIsPlayingAudio={setIsPlayingAudio}
              voices={voices}
              labelText={labelText}
            />
          )}

          {/* ── STEP 4: DISPLAY SETTINGS ─────────────────── */}
          {activeStep === 4 && !isClientRole && (
            <WizardStep4
              schedulingSettings={schedulingSettings}
              updateSchedulingSetting={updateSchedulingSetting}
              schedulingPreview={schedulingPreview}
              availabilityRules={availabilityRules}
              addAvailabilityRule={addAvailabilityRule}
              updateAvailabilityRule={updateAvailabilityRule}
              removeAvailabilityRule={removeAvailabilityRule}
              labelText={labelText}
              locale={locale}
              t={t}
            />
          )}

          {activeStep === 5 && (
            <WizardStep5
              labelText={labelText}
              t={t}
              role={role}
              isClientRole={isClientRole}
              fetchingChecklist={fetchingChecklist}
              checklistTemplates={checklistTemplates}
              isUploadingDocument={isUploadingDocument}
              documentDropTarget={documentDropTarget}
              complianceBoatDocuments={complianceBoatDocuments}
              handleDocumentDragOver={handleDocumentDragOver}
              handleDocumentDragLeave={handleDocumentDragLeave}
              handleDocumentDrop={handleDocumentDrop}
              handleDocumentInputChange={handleDocumentInputChange}
              resolveBoatDocumentUrl={resolveBoatDocumentUrl}
              handleDocumentDelete={handleDocumentDelete}
              normalizedClientContractStatus={normalizedClientContractStatus}
              clientContractDescriptionKey={clientContractDescriptionKey}
              clientBoatApproved={clientBoatApproved}
              clientSignhostLoading={clientSignhostLoading}
              clientContractStatusKey={clientContractStatusKey}
              effectiveClientSignhostUrl={effectiveClientSignhostUrl}
              handleOpenClientSignhost={handleOpenClientSignhost}
              handleStepChange={handleStepChange}
              activeYachtId={activeYachtId ? Number(activeYachtId) : null}
              marktplaatsListing={marktplaatsListing}
              setMarktplaatsListing={setMarktplaatsListing}
              sellerPublicationOptions={sellerPublicationOptions}
              selectedPublicationPlatforms={selectedPublicationPlatforms}
              setSelectedPublicationPlatforms={setSelectedPublicationPlatforms}
              isSavingMarktplaatsListing={isSavingMarktplaatsListing}
              isRunningMarktplaatsAction={isRunningMarktplaatsAction}
              persistMarktplaatsListing={persistMarktplaatsListing}
              runMarktplaatsAction={runMarktplaatsAction}
              internalReviewStatusKey={internalReviewStatusKey}
              internalReviewApproved={internalReviewApproved}
              internalReviewSelection={internalReviewSelection}
              setInternalReviewSelection={setInternalReviewSelection}
              reviewActionLoading={reviewActionLoading}
              updateInternalReviewStatus={updateInternalReviewStatus}
              isSubmitting={isSubmitting}
            />
          )}
          {activeStep === 6 && (
            <WizardStep6
              labelText={labelText}
              isClientRole={isClientRole}
              normalizedClientContractStatus={normalizedClientContractStatus}
              clientContractDescriptionKey={clientContractDescriptionKey}
              clientContractStatusKey={clientContractStatusKey}
              effectiveClientSignhostUrl={effectiveClientSignhostUrl}
              handleOpenClientSignhost={handleOpenClientSignhost}
              activeYachtId={activeYachtId ? Number(activeYachtId) : null}
              selectedYacht={selectedYacht}
              draft={draft}
              locations={locations}
              onNavigateToLocationStep={() => setActiveStep(2)}
              role={role}
              resolvePipelineAssetUrl={resolvePipelineAssetUrl}
              handleGenerateSticker={handleGenerateSticker}
              isGeneratingSticker={isGeneratingSticker}
              openStickerPreview={openStickerPreview}
              downloadStickerPdf={downloadStickerPdf}
            />
          )}

          {/* ── STEP NAVIGATION ───────────────────────────── */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200 mt-8">
            <Button
              type="button"
              onClick={() =>
                handleStepChange(getPreviousVisibleStepId(activeStep))
              }
              disabled={activeVisibleStepIndex === 0}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-11 px-6 text-xs font-bold uppercase tracking-wider disabled:opacity-30"
            >
              <ChevronLeft size={16} className="mr-1" />{" "}
              {t?.wizard?.nav?.previous || labelText("previous", "Previous")}
            </Button>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Step {activeVisibleStepIndex + 1} of {visibleWizardSteps.length}
            </span>
            {activeVisibleStepIndex < visibleWizardSteps.length - 1 &&
            activeStep !== 5 ? (
              <Button
                type="button"
                onClick={() => {
                  markStepComplete(activeStep);
                  handleStepChange(getNextVisibleStepId(activeStep));
                }}
                disabled={
                  (isNewMode && !canProceedFromStep1 && activeStep === 1) ||
                  (activeStep === 2 && isLocationSelectionBlocking)
                }
                className={cn(
                  "h-11 px-6 text-xs font-bold uppercase tracking-wider",
                  (isNewMode && !canProceedFromStep1 && activeStep === 1) ||
                    (activeStep === 2 && isLocationSelectionBlocking)
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-[#003566] text-white hover:bg-blue-800",
                )}
              >
                {isNewMode && !canProceedFromStep1 && activeStep === 1 ? (
                  <>
                    {t?.wizard?.nav?.runExtractionFirst ||
                      labelText("approveImagesFirst", "Approve Images First")}
                  </>
                ) : activeStep === 2 && isLocationSelectionBlocking ? (
                  <>
                    {labelText(
                      "locationRequiredForNextStep",
                      "Select a sales location before continuing to the next step.",
                    )}
                  </>
                ) : (
                  <>
                    {t?.wizard?.nav?.next || labelText("next", "Next")}{" "}
                    <ChevronRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            ) : activeStep === 5 ? (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-6 text-xs font-bold uppercase tracking-wider bg-[#003566] text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight size={16} className="mr-1" />
                )}
                {labelText(
                  isClientRole ? "submitForBrokerReview" : "continueToContract",
                  isClientRole
                    ? "Submit for Broker Review"
                    : "Save and Continue to Contract",
                )}
              </Button>
            ) : activeStep === 6 ? (
              <Button
                type="button"
                onClick={() => {
                  toast.success(
                    labelText("finishFlowToast", "Vessel flow completed."),
                  );
                  router.push(`/${locale}/dashboard/${role}/yachts`);
                }}
                className="h-11 px-6 text-xs font-bold uppercase tracking-wider bg-[#003566] text-white hover:bg-blue-800"
              >
                {labelText("finishFlow", "Finish")}
              </Button>
            ) : (
              <div />
            )}
          </div>
        </form>
      </div>

      <style jsx global>{`
        .dark .yacht-editor-theme {
          background: rgb(2 6 23) !important;
          color: rgb(226 232 240);
        }

        .dark .yacht-editor-theme .bg-white,
        .dark .yacht-editor-theme .bg-slate-50,
        .dark .yacht-editor-theme .bg-slate-100 {
          background: rgb(15 23 42) !important;
        }

        .dark .yacht-editor-theme .border-slate-100,
        .dark .yacht-editor-theme .border-slate-200,
        .dark .yacht-editor-theme .border-slate-300,
        .dark .yacht-editor-theme .border-gray-200 {
          border-color: rgb(51 65 85) !important;
        }

        .dark .yacht-editor-theme .text-slate-900,
        .dark .yacht-editor-theme .text-slate-800,
        .dark .yacht-editor-theme .text-slate-700 {
          color: rgb(241 245 249) !important;
        }

        .dark .yacht-editor-theme .text-slate-600,
        .dark .yacht-editor-theme .text-slate-500,
        .dark .yacht-editor-theme .text-slate-400 {
          color: rgb(148 163 184) !important;
        }

        .dark .yacht-editor-theme input,
        .dark .yacht-editor-theme select,
        .dark .yacht-editor-theme textarea {
          background: rgb(2 6 23) !important;
          color: rgb(226 232 240) !important;
          border-color: rgb(51 65 85) !important;
        }
      `}</style>

      <ConfirmDialog
        open={deleteDocumentDialogOpen}
        onOpenChange={setDeleteDocumentDialogOpen}
        title="Remove Document"
        description="Are you sure you want to remove this document? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={executeDocumentDelete}
      />

      <ConfirmDialog
        open={deleteVideoDialogOpen}
        onOpenChange={setDeleteVideoDialogOpen}
        title={t?.video?.confirmDeleteTitle || "Remove Video"}
        description={
          t?.video?.confirmDelete ||
          "Are you sure you want to remove this video?"
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={executeVideoDelete}
      />

      <ConfirmDialog
        open={deleteAllImagesDialogOpen}
        onOpenChange={setDeleteAllImagesDialogOpen}
        title={labelText("deleteAllImagesTitle", "Delete all images")}
        description={labelText(
          "deleteAllImagesDescription",
          "Are you sure you want to remove all uploaded images from this yacht? This action cannot be undone.",
        )}
        confirmText={
          isDeletingAllImages
            ? labelText("deletingAllImages", "Deleting...")
            : labelText("deleteAllAction", "Delete all")
        }
        cancelText={labelText("cancel", "Cancel")}
        variant="destructive"
        onConfirm={handleDeleteAllImages}
      />

      <ConfirmDialog
        open={failedImagesNavDialogOpen}
        onOpenChange={setFailedImagesNavDialogOpen}
        title={labelText("failedImagesNavTitle", "Remove failed images")}
        description={labelText(
          "failedImagesNavDescription",
          "First delete the images with the red borders to proceed to the next step.",
        )}
        confirmText={
          isDeletingFailedImages
            ? labelText("deleting", "Deleting...")
            : labelText("deleteFailedImages", "Delete failed images")
        }
        cancelText={labelText("cancel", "Cancel")}
        variant="destructive"
        onConfirm={handleDeleteFailedImages}
      />
    </div>
  );
}

export default function YachtEditorPage() {
  const params = useParams<{ locale: string; role: string; id: string }>();
  const searchParams = useSearchParams();
  const fresh = searchParams.get("fresh");
  
  // Create a composite key to force React to unmount and remount the inner component 
  // whenever the ID changes or when "fresh=true" is explicitly requested.
  // This solves the issue of React preserving state when navigating between identical layouts.
  const key = `${params.id}-${fresh || "no"}`;
  
  return <YachtEditorInner key={key} />;
}

// ---------------- Helper Components ---------------- //

function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-slate-700 mb-1.5 block group-hover:text-blue-600 transition-colors",
        className,
      )}
    >
      {children}
    </label>
  );
}

// Internal helper components moved to WizardHelpers.tsx
