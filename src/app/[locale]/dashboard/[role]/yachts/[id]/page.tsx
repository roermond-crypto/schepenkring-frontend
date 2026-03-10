"use client";

import { useState, useEffect, useCallback, useRef, SyntheticEvent, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Filter, HelpCircle, Info, Languages, Star, Users, Video, Wifi, Plus, X, UploadCloud, Edit3, Anchor as MooringIcon, CalendarDays, Key, Sun, ShieldCheck, Play, GripVertical, Wand2
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
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="border border-slate-200 rounded-lg p-6 h-[340px] bg-slate-50 animate-pulse flex items-center justify-center text-sm text-slate-400">
      Loading editor...
    </div>
  ),
});
import { toast, Toaster } from "react-hot-toast";
import { useYachtDraft } from "@/hooks/useYachtDraft";
import { convertBatchToWebP } from "@/lib/convertToWebP";
import { CatalogAutocomplete } from "@/components/ui/CatalogAutocomplete";
import { BoatCreationAssistant } from "@/components/yachts/BoatCreationAssistant";
import { SignhostFlow } from "@/components/yachts/SignhostFlow";
import { useUser } from "@/hooks/useUser";
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

// ALi
// Wizard step config
const WIZARD_STEP_IDS = [
  { id: 1, key: "images", icon: Images },
  { id: 2, key: "specs", icon: Waves },
  { id: 3, key: "text", icon: FileText },
  { id: 4, key: "display", icon: Eye },
  { id: 5, key: "review", icon: CheckCircle },
] as const;

const DRAFT_KEY_PREFIX = "yacht_draft_";
const MAX_IMAGES_UPLOAD = 50;
const UPLOAD_BATCH_SIZE = 6;
const UPLOAD_MAX_PARALLEL_BATCHES = 4;

// Configuration
const STORAGE_URL = "https://app.schepen-kring.nl/storage/";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=600&q=80";

type AiStagedImage = {
  file: File;
  preview: string;
  category: string;
  originalName: string;
};
type GalleryState = { [key: string]: any[] };

type ImageGridDensity = "regular" | "compact" | "dense";

// Availability Rule Type
type AvailabilityRule = {
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

type CorrectionLabel =
  | "wrong_image_detection"
  | "wrong_text_interpretation"
  | "guessed_too_much"
  | "duplicate_data_issue"
  | "import_mismatch"
  | "other";

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

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function hasObjectValues(value: unknown): boolean {
  return Object.keys(toObjectRecord(value)).length > 0;
}

function clampWizardStep(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(5, Math.max(1, Math.trunc(parsed)));
}

function normalizeTriStateValue(value: unknown): "yes" | "no" | null {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value > 0 ? "yes" : "no";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["unknown", "unsure", "uncertain", "n/a", "na", "null", "none"].includes(normalized)) return null;
  if (["no", "n", "false", "0", "absent"].includes(normalized)) return "no";
  if (["yes", "y", "true", "1", "present", "included"].includes(normalized)) return "yes";
  if (/\b(without|not visible|not present|missing)\b/.test(normalized)) return "no";
  if (/\b(with|equipped|installed|available)\b/.test(normalized)) return "yes";
  if (/\d+/.test(normalized)) return "yes";
  // If it's something else not matching the above, return null to be safe
  return null;
}

export default function YachtEditorPage() {
  const params = useParams<{ id: string; role?: string }>();
  // We can't safely extract locale from params directly if it's missing or async,
  // so we'll grab it safely using our hook that reads the pathname
  const locale = useLocale();
  const role = normalizeRole(params?.role) ?? "admin";
  const dict = getDictionary(locale) as any;
  const t = dict?.YachtWizard || {} as any;
  const router = useRouter();

  const stepFallbacks: Record<string, string> = {
    images: "Images",
    specs: "Specifications",
    text: "Description",
    display: "Display",
    review: "Review",
  };

  const wizardSteps = WIZARD_STEP_IDS.map((step) => ({
    ...step,
    label: t?.steps?.[step.key] || stepFallbacks[step.key] || step.key,
  }));
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
  const yachtId = params.id;
  const { isOnline } = useNetworkStatus();
  const { user } = useUser();

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
  } = useYachtDraft(yachtId as string);

  // Form State
  const [selectedYacht, setSelectedYacht] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(!isNewMode);
  const [errors, setErrors] = useState<any>(null);

  // Video State
  const [boatVideos, setBoatVideos] = useState<any[]>([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isPublishingVideo, setIsPublishingVideo] = useState<number | null>(null);
  const [deleteVideoDialogOpen, setDeleteVideoDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);

  // Image Pipeline Hook (server-side processing)
  const [createdYachtId, setCreatedYachtId] = useState<number | null>(null);
  const activeYachtId = isNewMode
    ? createdYachtId
      ? String(createdYachtId)
      : null
    : (yachtId as string);
  const pipeline = useImagePipeline(activeYachtId);
  const imagesApproved = pipeline.isStep2Unlocked;
  const [reviewImages, setReviewImages] = useState<PipelineImage[]>([]);
  const [imageGridDensity, setImageGridDensity] =
    useState<ImageGridDensity>("regular");
  const [selectedLightboxImageId, setSelectedLightboxImageId] = useState<number | null>(null);
  const [isAutoSortingImages, setIsAutoSortingImages] = useState(false);
  const [isReorderingImages, setIsReorderingImages] = useState(false);
  const [deleteAllImagesDialogOpen, setDeleteAllImagesDialogOpen] = useState(false);
  const [isDeletingAllImages, setIsDeletingAllImages] = useState(false);

  // Legacy staging for non-image features (Main Profile etc)
  const [aiStaging, setAiStaging] = useState<AiStagedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);

  // AI Pipeline State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Gemini Extraction State (Step 1)
  const [boatHint, setBoatHint] = useState("");
  const [geminiExtracted, setGeminiExtracted] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractionType, setExtractionType] = useState<"gemini" | "magic">("gemini");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confidenceMeta, setConfidenceMeta] = useState<ConfidenceMeta | null>(null);
  const [correctionLabel, setCorrectionLabel] = useState<CorrectionLabel | null>(null);

  // Harbors
  const [harbors, setHarbors] = useState<any[]>([]);
  const [isHarborsLoading, setIsHarborsLoading] = useState(false);
  const canProceedFromStep1 =
    !isNewMode ||
    (!isOnline && offlineImages.length > 0) ||
    imagesApproved;
  const areReviewPrerequisitesComplete = [1, 2, 3, 4].every((stepId) =>
    isStepComplete(stepId),
  );

  // AI Text State (Tab 3)
  const [aiTexts, setAiTexts] = useState({ nl: "", en: "", de: "" });
  const [selectedLang, setSelectedLang] = useState<"nl" | "en" | "de">("nl");

  // AI Tone Settings & Speech
  const [aiTone, setAiTone] = useState("professional");
  const [aiMinWords, setAiMinWords] = useState<number | "">(200);
  const [aiMaxWords, setAiMaxWords] = useState<number | "">(500);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [isDictating, setIsDictating] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = false;
        recog.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
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
    setReviewImages(pipeline.images);
  }, [pipeline.images]);

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

  // Harbor Defaults State
  const [harborDefaults, setHarborDefaults] = useState<{
    opening_hours_start: string;
    opening_hours_end: string;
  } | null>(null);

  // Checklist State (Step 5)
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [boatDocuments, setBoatDocuments] = useState<any[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [fetchingChecklist, setFetchingChecklist] = useState(false);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);

  // Fetch Checklist Templates & Documents for Step 5
  useEffect(() => {
    if (activeStep === 5) {
      const fetchComplianceData = async () => {
        setFetchingChecklist(true);
        try {
          const typeId = selectedYacht?.boat_type_id || (draft?.data as any)?.step2?.selectedYacht?.boat_type_id || "";
          const templatesRes = await api.get(`/checklists/templates?boat_type_id=${typeId}`);
          setChecklistTemplates(templatesRes.data);

          const targetId = isNewMode ? createdYachtId : yachtId;
          if (targetId) {
            const docsRes = await api.get(`/yachts/${targetId}/documents`);
            setBoatDocuments(docsRes.data);
          }
        } catch (e) {
          console.error("Failed to load compliance data", e);
        } finally {
          setFetchingChecklist(false);
        }
      };
      fetchComplianceData();
    }
  }, [activeStep, selectedYacht?.boat_type_id, (draft?.data as any)?.boat_type_id, isNewMode, createdYachtId, yachtId]);

  /* 
  useEffect(() => {
    const fetchDefaults = async () => {
      if (!user?.id) return;
      try {
        const res = await api.get(`/admin/harbors/${user.id}/booking-settings`);
        if (res.data?.settings) {
          const startStr = res.data.settings.opening_hours_start ? String(res.data.settings.opening_hours_start) : "09:00:00";
          const endStr = res.data.settings.opening_hours_end ? String(res.data.settings.opening_hours_end) : "17:00:00";

          setHarborDefaults({
            opening_hours_start: startStr.substring(0, 5),
            opening_hours_end: endStr.substring(0, 5),
          });
        }
      } catch (e) {
        console.error("Failed to load harbor defaults", e);
      }
    };
    fetchDefaults();
  }, [user?.id]);
  */

  useEffect(() => {
    const fetchHarbors = async () => {
      try {
        setIsHarborsLoading(true);
        const res = await api.get("/public/locations");
        const list = res.data || [];
        setHarbors(list);

        // Auto-select if only one harbor exists and none selected
        if (list.length === 1 && !selectedYacht?.ref_harbor_id) {
          setSelectedYacht((prev: any) => ({ ...prev, ref_harbor_id: list[0].id }));
        }
      } catch (err) {
        console.error("Failed to fetch harbors", err);
      } finally {
        setIsHarborsLoading(false);
      }
    };
    fetchHarbors();
  }, [selectedYacht?.ref_harbor_id]);

  // Initial Empty State Population for Step 4
  useEffect(() => {
    if (activeStep === 4 && availabilityRules.length === 0 && harborDefaults) {
      setAvailabilityRules([
        {
          days_of_week: [1, 2, 3, 4, 5], // Defaulting to Mon-Fri implicitly 
          start_time: harborDefaults.opening_hours_start || "09:00",
          end_time: harborDefaults.opening_hours_end || "17:00",
        },
      ]);
    }
  }, [activeStep, availabilityRules.length, harborDefaults]);


  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const restoredDraftRef = useRef(false);
  const serverDraftVersionRef = useRef<number | null>(null);
  const syncingServerDraftRef = useRef(false);
  const serverSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const serverDraftInitializedRef = useRef(false);
  const serverDraftBootstrapInFlightRef = useRef(false);

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

    const restoredCreatedYachtId = Number(step1Obj.createdYachtId);
    if (Number.isInteger(restoredCreatedYachtId) && restoredCreatedYachtId > 0) {
      setCreatedYachtId(restoredCreatedYachtId);
    }
    if (typeof step1Obj.boatHint === "string") setBoatHint(step1Obj.boatHint);
    if (typeof step1Obj.geminiExtracted === "boolean") setGeminiExtracted(step1Obj.geminiExtracted);
    if (step1Obj.extractionResult !== undefined) setExtractionResult(step1Obj.extractionResult);
    if (step1Obj.confidenceMeta && typeof step1Obj.confidenceMeta === "object") {
      setConfidenceMeta(step1Obj.confidenceMeta as ConfidenceMeta);
    }

    if (step2Obj.selectedYacht && typeof step2Obj.selectedYacht === "object") {
      setSelectedYacht(step2Obj.selectedYacht);
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
      });
    }

    if (
      step3Obj.selectedLang === "nl" ||
      step3Obj.selectedLang === "en" ||
      step3Obj.selectedLang === "de"
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
  }, [isDraftLoaded, isNewMode, getStepData]);

  // Restore draft step on mount (but respect approval gate)
  useEffect(() => {
    if (isDraftLoaded && draft.currentStep > 1 && isNewMode) {
      if (!canProceedFromStep1) return;
      setActiveStep(draft.currentStep);
    }
  }, [
    isDraftLoaded,
    draft.currentStep,
    isNewMode,
    canProceedFromStep1,
  ]);

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
  }, [isDraftLoaded, aiTexts, selectedLang, aiTone, aiMinWords, aiMaxWords, debouncedSave]);

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
  ]);

  const syncDraftToServer = useCallback(
    async (mode: "upsert" | "patch" = "patch") => {
      if (!isDraftLoaded || !isOnline || syncingServerDraftRef.current) return;
      if (typeof window === "undefined" || !localStorage.getItem("auth_token")) return;

      const snapshot = buildServerDraftSnapshot();
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
        if (err?.response?.status === 409 && typeof conflictVersion === "number") {
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

  // Bootstrap server draft safely:
  // 1) fetch existing server draft if present
  // 2) hydrate local when local is empty
  // 3) otherwise patch server with current local state
  useEffect(() => {
    if (!isDraftLoaded || !isOnline) return;
    if (serverDraftInitializedRef.current || serverDraftBootstrapInFlightRef.current) return;
    if (typeof window === "undefined" || !localStorage.getItem("auth_token")) return;

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

        if (!hasLocalDraftContent) {
          const payload = toObjectRecord(remoteDraft.payload_json);
          const uiState = toObjectRecord(remoteDraft.ui_state_json);
          const serverCompletedSteps = Array.isArray(uiState.completedSteps)
            ? uiState.completedSteps
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)
            : [];

          flushDraft({
            currentStep: clampWizardStep(uiState.currentStep ?? remoteDraft.wizard_step ?? 1),
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
        const status = (error as { response?: { status?: number } })?.response?.status;
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
      void syncDraftToServer("patch");
    }, 1800);

    return () => {
      if (serverSyncTimerRef.current) {
        clearTimeout(serverSyncTimerRef.current);
      }
    };
  }, [isDraftLoaded, isOnline, draft.lastSaved, activeStep, syncDraftToServer]);

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
    await syncDraftToServer(serverDraftVersionRef.current === null ? "upsert" : "patch");
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

  // Auto-save current step data when switching tabs
  const handleStepChange = useCallback(
    (newStep: number) => {
      // OFFLINE: allow skipping to any step (no server gating)
      if (!isOnline) {
        if (newStep > 1 && offlineImages.length === 0 && pipeline.images.length === 0) {
          toast.error("Please upload at least one image first (saved locally).");
          return;
        }
        setActiveStep(newStep);
        return;
      }
      // In new mode: block Step 2+ until image gate is satisfied
      if (isNewMode && !canProceedFromStep1 && newStep > 1) {
        toast.error(
          "Please approve images first. You can continue manually even if AI extraction fails.",
        );
        return;
      }
      setActiveStep(newStep);
    },
    [isOnline, isNewMode, canProceedFromStep1, offlineImages, pipeline.images.length],
  );

  // --- 1. FETCH DATA (IF EDITING) ---
  useEffect(() => {
    if (isNewMode) return;

    const fetchYachtDetails = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/yachts/${yachtId}`);
        const yacht = res.data;
        setSelectedYacht(yacht);

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

        // Fetch Boat Videos
        try {
          const videoRes = await api.get(`/yachts/${yachtId}/boat-videos`);
          setBoatVideos(videoRes.data);
        } catch (e) {
          console.error("Failed to fetch boat videos", e);
        }

        // Load existing availability rules
        if (yacht.availability_rules || yacht.availabilityRules) {
          const rawRules = yacht.availability_rules || yacht.availabilityRules;
          // Condense individual rules back into grouped day arrays
          const groupedRules: AvailabilityRule[] = [];

          rawRules.forEach((rule: any) => {
            const existingGroup = groupedRules.find(
              g => g.start_time === rule.start_time && g.end_time === rule.end_time
            );

            if (existingGroup) {
              if (!existingGroup.days_of_week.includes(rule.day_of_week)) {
                existingGroup.days_of_week.push(rule.day_of_week);
                // Optional: Sort days 1=Mon, 0=Sun (placed at end)
                existingGroup.days_of_week.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
              }
            } else {
              groupedRules.push({
                days_of_week: [rule.day_of_week],
                start_time: rule.start_time,
                end_time: rule.end_time
              });
            }
          });

          setAvailabilityRules(groupedRules);
        }

        // Load existing AI descriptions
        setAiTexts({
          en: yacht.short_description_en || "",
          nl: yacht.short_description_nl || "",
          de: yacht.short_description_de || "",
        });
      } catch (err) {
        console.error("Failed to fetch yacht details", err);
        toast.error("Failed to load yacht details");
        router.push(`/${locale}/dashboard/${role}/yachts`);
      } finally {
        setLoading(false);
      }
    };

    fetchYachtDetails();
  }, [yachtId, isNewMode, locale, router]);

  // --- 2. HANDLERS ---

  // Video Handlers
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-create draft yacht if needed 
    let targetId = isNewMode ? createdYachtId : yachtId;
    if (isNewMode && !targetId) {
      toast.loading("Creating vessel draft...");
      const fd = new FormData();
      fd.append("status", "draft");
      const createRes = await api.post("/yachts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      targetId = createRes.data.id;
      setCreatedYachtId(targetId as number);
    }

    setIsUploadingVideo(true);
    const formData = new FormData();
    formData.append("video", file);
    try {
      const res = await api.post(`/yachts/${targetId}/boat-videos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBoatVideos(prev => [res.data, ...prev]);
      toast.success(t?.video?.uploaded || "Video uploaded successfully");
    } catch (err) {
      toast.error(t?.video?.uploadFailed || "Video upload failed");
    } finally {
      setIsUploadingVideo(false);
      if (e.target) e.target.value = '';
    }
  };

  // Document Handlers (Step 5)
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let targetId = isNewMode ? createdYachtId : yachtId;
    if (isNewMode && !targetId) {
      const loadingToastId = toast.loading("Creating vessel draft for document upload...");
      try {
        const fd = new FormData();
        fd.append("status", "draft");
        const createRes = await api.post("/yachts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        targetId = createRes.data.id;
        setCreatedYachtId(targetId as number);
        toast.dismiss(loadingToastId);
      } catch (err) {
        toast.dismiss(loadingToastId);
        toast.error("Failed to initialize draft vessel.");
        return;
      }
    }

    setIsUploadingDocument(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(`/yachts/${targetId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBoatDocuments(prev => [...prev, res.data]);
      toast.success("Document uploaded successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Document upload failed");
    } finally {
      setIsUploadingDocument(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDocumentDelete = (id: number) => {
    setDocumentToDelete(id);
    setDeleteDocumentDialogOpen(true);
  };

  const executeDocumentDelete = async () => {
    if (!documentToDelete) return;
    const targetId = isNewMode ? createdYachtId : yachtId;
    try {
      await api.delete(`/yachts/${targetId}/documents/${documentToDelete}`);
      setBoatDocuments(prev => prev.filter(doc => doc.id !== documentToDelete));
      toast.success("Document removed");
    } catch (err) {
      toast.error("Failed to delete document");
    } finally {
      setDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);
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
      setBoatVideos(prev => prev.filter(v => v.id !== videoToDelete));
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
      toast.success(t?.video?.publishSent || "Publish request sent to social API");

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
        : reviewImages.find((image) => image.id === selectedLightboxImageId) ?? null,
    [reviewImages, selectedLightboxImageId],
  );

  const selectedLightboxIndex = useMemo(
    () =>
      selectedLightboxImageId === null
        ? -1
        : reviewImages.findIndex((image) => image.id === selectedLightboxImageId),
    [reviewImages, selectedLightboxImageId],
  );

  const buildImageAiNotes = useCallback((image: PipelineImage) => {
    const notes: string[] = [];
    const adjustments = Array.isArray(image.quality_flags?.ai_adjustments)
      ? image.quality_flags.ai_adjustments
      : [];
    notes.push(...adjustments);

    if (image.quality_flags?.too_dark) {
      notes.push("Source image was detected as dark before enhancement.");
    }
    if (image.quality_flags?.too_bright) {
      notes.push("Source image had strong highlights before enhancement.");
    }
    if (image.quality_flags?.blurry) {
      notes.push("Source image was soft, so clarity recovery was attempted.");
    }
    if (image.quality_flags?.low_res) {
      notes.push("Source image resolution was low, so upscale logic was considered.");
    }
    if (
      typeof image.quality_flags?.ai_rotation_angle === "number" &&
      image.quality_flags.ai_rotation_angle > 0
    ) {
      notes.push(`Image orientation was corrected by ${image.quality_flags.ai_rotation_angle} degrees.`);
    }
    if (notes.length === 0) {
      notes.push("AI marked this image as gallery-ready without major corrections.");
    }

    return Array.from(new Set(notes));
  }, []);

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

  const handleAutoSortImages = useCallback(async () => {
    try {
      setIsAutoSortingImages(true);
      await pipeline.autoClassifyImages();
      toast.success("AI sorted images into better categories.");
    } catch (error) {
      toast.error("AI image sorting failed.");
      console.error(error);
    } finally {
      setIsAutoSortingImages(false);
    }
  }, [pipeline]);

  const handleDeleteAllImages = useCallback(async () => {
    if (reviewImages.length === 0) return;

    try {
      setIsDeletingAllImages(true);
      setSelectedLightboxImageId(null);

      const result = await pipeline.deleteImages(reviewImages.map((image) => image.id));

      if (result.failed > 0) {
        toast.error(`Deleted ${result.deleted} images, ${result.failed} failed.`);
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

  const moveLightboxImage = useCallback(
    (direction: "next" | "prev") => {
      if (selectedLightboxIndex < 0 || reviewImages.length === 0) return;

      const delta = direction === "next" ? 1 : -1;
      const nextIndex =
        (selectedLightboxIndex + delta + reviewImages.length) % reviewImages.length;
      setSelectedLightboxImageId(reviewImages[nextIndex]?.id ?? null);
    },
    [reviewImages, selectedLightboxIndex],
  );


  const handleImageError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
    e.currentTarget.classList.add("opacity-50", "grayscale");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // ── OFFLINE PATH: store images locally in IndexedDB ──
    if (!navigator.onLine) {
      setIsUploading(true);
      const toastId = toast.loading(`Saving ${files.length} image(s) locally...`);

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
            id: Date.now() + i,     // fake ID
            yacht_id: 0,
            original_name: file.name,
            full_url: previewUrl,
            thumb_full_url: previewUrl,
            optimized_url: previewUrl,
            thumb_optimized_url: previewUrl,
            status: "approved",     // Skip processing straight to approved
            enhancement_method: "none",
            quality_score: 99,
            quality_label: "Offline",
            auto_approved: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
    // Check max limit (30)
    if (pipeline.stats.total + files.length > MAX_IMAGES_UPLOAD) {
      toast.error(`Maximum ${MAX_IMAGES_UPLOAD} images allowed per batch.`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} image(s)...`);
    const optimisticUrls: string[] = [];
    const previousImages = pipeline.images;
    const previousStats = pipeline.stats;
    const previousStep2Unlocked = pipeline.isStep2Unlocked;

    try {
      const fileArray = Array.from(files);
      const filesToUpload = fileArray;
      let targetId = isNewMode ? createdYachtId : yachtId;
      let shouldSetCreatedYachtId = false;

      const optimisticBaseId = -Date.now();
      const optimisticImages: PipelineImage[] = fileArray.map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        optimisticUrls.push(previewUrl);
        return {
          id: optimisticBaseId - index,
          yacht_id: Number(targetId || 0),
          url: previewUrl,
          original_temp_url: previewUrl,
          optimized_master_url: previewUrl,
          thumb_url: previewUrl,
          original_kept_url: null,
          status: "processing",
          keep_original: false,
          quality_score: null,
          quality_flags: null,
          quality_label: "Uploading...",
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

      // Recover from stale draft yacht IDs restored from local draft state.
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

      // Auto-create draft yacht upon first image drop in new mode
      if (isNewMode && !targetId) {
        toast.loading("Creating vessel draft...", { id: toastId });
        const fd = new FormData();
        fd.append("status", "draft");
        const createRes = await api.post("/yachts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        targetId = createRes.data.id;
        shouldSetCreatedYachtId = true;
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
            const res = await api.post(`/yachts/${targetId}/images/upload`, uploadFd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            return Array.isArray(res.data?.images) ? res.data.images.length : batchFiles.length;
          }),
        );

        settled.forEach((result) => {
          if (result.status === "fulfilled") {
            uploadedCount += result.value;
          } else {
            failedBatches += 1;
            console.error("[Upload] Batch failed:", result.reason);
          }
        });
      }

      if (uploadedCount === 0) {
        throw new Error("No images uploaded");
      }

      // Auto-set the first uploaded file as main profile
      if (!mainFile && !mainPreview && filesToUpload.length > 0) {
        setMainFile(filesToUpload[0]);
        setMainPreview(URL.createObjectURL(filesToUpload[0]));
      }

      toast.success(
        failedBatches > 0
          ? `${uploadedCount} images queued. ${failedBatches} batch(es) failed.`
          : `${uploadedCount} images sent for processing!`,
        {
          id: toastId,
        },
      );
      // Force a direct fetch using targetId (avoids stale closure from useImagePipeline)
      // This is needed because in new mode, the hook's yachtId may still be null/stale
      try {
        const refreshRes = await api.get(`/yachts/${targetId}/images`);
        if (refreshRes.data?.images) {
          pipeline.setImagesDirectly?.(refreshRes.data);
        }
      } catch { }
      if (pipeline.refreshImages) await pipeline.refreshImages();
      if (shouldSetCreatedYachtId) {
        setCreatedYachtId(Number(targetId));
      }
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload images", { id: toastId });
      pipeline.setImagesDirectly?.({
        images: previousImages,
        stats: previousStats,
        step2_unlocked: previousStep2Unlocked,
      });
      // Reset to backend truth if optimistic previews were shown.
      if (pipeline.refreshImages) await pipeline.refreshImages();
    } finally {
      optimisticUrls.forEach((url) => URL.revokeObjectURL(url));
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Helper: check if a field needs user confirmation
  const needsConfirm = (fieldName: string) =>
    confidenceMeta?.needs_user_confirmation?.includes(fieldName) ?? false;
  const isOptionalTriStateField = (fieldName: string) =>
    (OPTIONAL_TRI_STATE_FIELDS as readonly string[]).includes(fieldName);

  // ── AI Fill Pipeline ──
  const handleAiExtract = async (
    options?: {
      background?: boolean;
      navigateToStep2?: boolean;
      speedMode?: "fast" | "balanced" | "deep";
    },
  ): Promise<boolean> => {
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
      toast.error("AI extraction requires an internet connection. You can skip to Step 2 to fill in details manually.");
      return false;
    }
    if (pipeline.images.length === 0) {
      toast.error("Please upload at least one image first.");
      return false;
    }

    setExtractionType("gemini");
    setIsExtracting(true);
    if (!background) {
      setShowExtractModal(true);
    }
    const toastId = toast.loading(
      background
        ? "🤖 AI extraction started in background..."
        : "🤖 AI Pipeline is analyzing your images...",
    );

    try {
      const formData = new FormData();

      // Always pass a valid yacht ID; recover if restored draft ID was deleted server-side.
      let targetId: number | string | null = isNewMode ? createdYachtId : yachtId;
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
        const fd = new FormData();
        fd.append("status", "draft");
        const createRes = await api.post("/yachts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        targetId = createRes.data.id;
        if (isNewMode) {
          setCreatedYachtId(Number(targetId));
        }
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
        signal: AbortSignal.timeout(180000), // 3 mins
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
        const formValues = responseData.step2_form_values;
        const meta = responseData.meta;

        const normalizedFormValues: Record<string, unknown> = {
          ...(toObjectRecord(formValues)),
        };

        const currentYear = new Date().getFullYear();
        const parseNum = (value: unknown): number | null => {
          if (value === null || value === undefined || value === "") return null;
          const raw = String(value).replace(",", ".").trim();
          const parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const sanitizeDimension = (value: unknown, field: "loa" | "beam" | "draft"): number | null => {
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
          if ((targetValue === null || targetValue === undefined || targetValue === "") && sourceValue !== null && sourceValue !== undefined && sourceValue !== "") {
            normalizedFormValues[to] = sourceValue;
          }
        });

        // Normalize suspicious values from feed/LLM fallback before filling Step 2.
        if (typeof normalizedFormValues.model === "number") {
          normalizedFormValues.model = String(normalizedFormValues.model);
        }
        if (parseNum(normalizedFormValues.price) !== null && (parseNum(normalizedFormValues.price) as number) <= 0) {
          normalizedFormValues.price = null;
        }
        const yearNum = parseNum(normalizedFormValues.year);
        if (yearNum !== null) {
          normalizedFormValues.year =
            yearNum >= 1950 && yearNum <= currentYear + 1
              ? Math.round(yearNum)
              : null;
        }
        normalizedFormValues.loa = sanitizeDimension(normalizedFormValues.loa, "loa");
        normalizedFormValues.beam = sanitizeDimension(normalizedFormValues.beam, "beam");
        normalizedFormValues.draft = sanitizeDimension(normalizedFormValues.draft, "draft");

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
            const consensusValues = toObjectRecord(suggestionsRes.data?.consensus_values);

            Object.entries(consensusValues).forEach(([field, value]) => {
              const current = normalizedFormValues[field];
              const isEmptyCurrent =
                current === null ||
                current === undefined ||
                current === "" ||
                current === "unknown";

              if (isEmptyCurrent && value !== null && value !== undefined && value !== "") {
                normalizedFormValues[field] = value;
              }
            });
          }
        } catch (suggestionError) {
          console.warn("[AI Extraction] Suggestions enrichment failed:", suggestionError);
        }

        // Keep optional equipment conservative and always explicit in the form.
        OPTIONAL_TRI_STATE_FIELDS.forEach((field) => {
          const raw = normalizedFormValues[field];
          normalizedFormValues[field] =
            raw === null || raw === undefined || raw === ""
              ? "unknown"
              : normalizeTriStateValue(raw);
        });

        // Build the merged object (filter nulls only — match old project)
        const fieldsToMerge = Object.fromEntries(
          Object.entries(normalizedFormValues).filter(([, val]) => val !== null),
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
            en: formValues.short_description_en,
          }));
        }
        if (formValues.short_description_nl) {
          setAiTexts((prev) => ({
            ...prev,
            nl: formValues.short_description_nl,
          }));
        }
        if (formValues.short_description_de) {
          setAiTexts((prev) => ({ ...prev, de: formValues.short_description_de }));
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
        toast.success(toastMsg, { id: toastId, duration: 5000 });

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
          { id: toastId },
        );
        return false;
      }
    } catch (err: any) {
      console.error("AI pipeline failed:", err);
      const errorMsg =
        err?.response?.data?.error || err?.message || "AI extraction failed";

      if (speedMode === "deep" && isTimeoutLike(String(errorMsg))) {
        toast.loading("Deep extraction timed out. Retrying with balanced mode...", {
          id: toastId,
        });
        return await handleAiExtract({
          background,
          navigateToStep2,
          speedMode: "balanced",
        });
      }

      toast.error(errorMsg, { id: toastId });
      return false;
    } finally {
      setIsExtracting(false);
      if (!background) {
        setShowExtractModal(false);
      }
    }
  };

  // Auto-trigger extraction when images transition to approved (any mode — matches old project).
  const prevImagesApprovedRef = useRef(imagesApproved);
  useEffect(() => {
    const wasApproved = prevImagesApprovedRef.current;
    prevImagesApprovedRef.current = imagesApproved;

    if (imagesApproved && !wasApproved && !geminiExtracted && !isExtracting) {
      void handleAiExtract({ background: true, navigateToStep2: true, speedMode: "balanced" });
    }
  }, [imagesApproved, geminiExtracted, isExtracting]);

  const handleRegenerateDescription = async () => {
    const targetId = isNewMode ? createdYachtId : yachtId;
    if (!targetId) {
      toast.error("Please save the yacht first before regenerating text.");
      return;
    }

    setIsRegenerating(true);
    const toastId = toast.loading("🪄 Generating new descriptions...");

    try {
      const res = await api.post("/ai/generate-description", {
        yacht_id: targetId,
        tone: aiTone,
        min_words: aiMinWords || 200,
        max_words: aiMaxWords || 500,
      });

      if (res.data?.success && res.data?.descriptions) {
        setAiTexts({
          en: res.data.descriptions.en || "",
          nl: res.data.descriptions.nl || "",
          de: res.data.descriptions.de || "",
        });
        toast.success("Descriptions updated!", { id: toastId });
      } else {
        throw new Error("Failed to generate descriptions.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error || "Failed to regenerate text.", { id: toastId });
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleDictation = () => {
    if (!recognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isDictating) {
      recognition.stop();
      setIsDictating(false);
    } else {
      recognition.lang = selectedLang === 'nl' ? 'nl-NL' : selectedLang === 'de' ? 'de-DE' : 'en-US';
      recognition.start();
      setIsDictating(true);
      toast.success("Listening... Speak now");
    }
  };

  const handleMagicAutoFill = async () => {
    if (!navigator.onLine) {
      toast.error("Magic Auto-fill requires an internet connection. You can fill in details manually.");
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
    setAvailabilityRules([
      ...availabilityRules,
      {
        days_of_week: [],
        start_time: harborDefaults?.opening_hours_start || "09:00",
        end_time: harborDefaults?.opening_hours_end || "17:00"
      },
    ]);
  };

  const removeAvailabilityRule = (index: number) => {
    setAvailabilityRules(availabilityRules.filter((_, i) => i !== index));
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

    const toFormValue = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "boolean") return value ? "true" : "false";
      const stringValue = String(value);
      return stringValue.trim() === "" ? null : stringValue;
    };

    const getFieldValue = (field: string): string | null => {
      const element = document.querySelector(
        `[name="${field}"]`,
      ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;

      if (element) {
        if (element instanceof HTMLInputElement && element.type === "checkbox") {
          return element.checked ? "true" : "false";
        }
        return toFormValue(element.value);
      }

      return toFormValue(selectedYacht?.[field]);
    };

    const normalizeComparableValue = (field: string, value: unknown): string => {
      if (isOptionalTriStateField(field)) {
        return normalizeTriStateValue(value);
      }
      if (typeof value === "boolean") return value ? "true" : "false";
      return String(value ?? "").trim().toLowerCase();
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
    const fields = [
      "year",
      "status",
      "loa",
      "lwl",
      "where",
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
      "ref_harbor_id",
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

    fields.forEach((field) => {
      const value = getFieldValue(field);
      if (value !== null) {
        formData.append(field, value);
      }
    });

    if (!formData.has("status")) {
      formData.append("status", toFormValue(selectedYacht?.status) ?? "Draft");
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
    if (aiTexts.en?.trim()) formData.set("short_description_en", aiTexts.en.trim());
    if (aiTexts.nl?.trim()) formData.set("short_description_nl", aiTexts.nl.trim());
    if (aiTexts.de?.trim()) formData.set("short_description_de", aiTexts.de.trim());

    // Add availability rules
    if (availabilityRules.length > 0) {
      // Expand multiselect arrays back into individual daily rules for backend
      const expandedRules: any[] = [];
      availabilityRules.forEach(ruleGroup => {
        ruleGroup.days_of_week.forEach(day => {
          expandedRules.push({
            day_of_week: day,
            start_time: ruleGroup.start_time,
            end_time: ruleGroup.end_time
          });
        });
      });
      formData.append("availability_rules", JSON.stringify(expandedRules));
    }

    // Attach AI correction context so backend can log proposal-vs-final deltas.
    const extractionValues = toObjectRecord(extractionResult);
    const aiSessionId = confidenceMeta?.ai_session_id || null;
    const modelName = confidenceMeta?.model_name || null;
    const fieldConfidence = confidenceMeta?.field_confidence || {};
    const aiSuggestedFields = Object.entries(extractionValues).filter(([, value]) => value !== null);

    if (aiSessionId) {
      formData.append("ai_session_id", aiSessionId);
    }
    if (modelName) {
      formData.append("model_name", modelName);
    }
    if (Object.keys(fieldConfidence).length > 0) {
      formData.append("field_confidence", JSON.stringify(fieldConfidence));
    }
    formData.append("changed_by_type", role === "admin" ? "admin" : "user");

    let changedAiFieldCount = 0;
    let guessedTooMuchCount = 0;
    for (const [field, aiValue] of aiSuggestedFields) {
      const currentValue = getFieldValue(field) ?? selectedYacht?.[field] ?? null;
      const aiNormalized = normalizeComparableValue(field, aiValue);
      const currentNormalized = normalizeComparableValue(field, currentValue);
      if (aiNormalized !== currentNormalized) {
        changedAiFieldCount++;
        if (isOptionalTriStateField(field) && aiNormalized === "yes" && currentNormalized !== "yes") {
          guessedTooMuchCount++;
        }
      }
    }

    if (aiSessionId && changedAiFieldCount > 0) {
      const autoLabel: CorrectionLabel =
        guessedTooMuchCount > 0 ? "guessed_too_much" : "wrong_text_interpretation";
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
          await api.post(`/yachts/${finalYachtId}`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              "X-Allow-Create-If-Missing": "1",
            },
          });
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
          }
        });
        finalYachtId = res.data.id;
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
          const savedDraft = await createOrReplaceYachtDraft({
            draft_id: snapshot.draftId,
            yacht_id: Number(finalYachtId),
            wizard_step: activeStep,
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

      // (Legacy manual bulk image gallery submission removed; handled by Image Pipeline now)

      toast.success(
        isNewMode
          ? "Vessel Registered Successfully"
          : "Manifest Updated Successfully",
      );
      router.push(`/${locale}/dashboard/${role}/yachts`);
    } catch (err: any) {
      console.error("Submission error:", err);

      if (err.response?.status === 422) {
        setErrors(err.response.data.errors);
        toast.error("Please check required fields");
      } else if (err.response?.status === 403) {
        toast.error("Permission denied.");
      } else if (err.response?.status === 500) {
        toast.error("Server error. Please try again.");
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
      <Toaster position="top-right" />

      {showExtractModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-7 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
              <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Please wait</h3>
            <p className="text-sm text-slate-500 mt-2">
              {extractionType === "gemini"
                ? "AI is analyzing your yacht photos and preparing fields."
                : "🪄 RAG Engine is searching Pinecone to find consensus and auto-filling details..."}
            </p>
            <div className="mt-5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* ── STEP INDICATOR (circles with connecting lines) ──── */}
      <div className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-7 px-6">
          {wizardSteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const isCompleted = step.id < activeStep;
            const isPast = isActive || isCompleted;
            const isLocked = !canProceedFromStep1 && step.id > 1;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepChange(step.id)}
                  disabled={isLocked}
                  title={isLocked ? "Approve images first" : step.label}
                  className={`
                    w-[54px] h-[54px] rounded-full flex items-center justify-center
                    text-[18px] font-bold border-[3px] transition-all duration-300
                    ${isLocked
                      ? "border-slate-200 text-slate-300 bg-slate-100 cursor-not-allowed opacity-50"
                      : isPast
                        ? "border-[#2563eb] text-[#2563eb] bg-white hover:bg-blue-50 cursor-pointer"
                        : "border-[#d4d8de] text-[#b0b5bd] bg-[#f0f2f5] hover:border-[#b0b5bd] cursor-pointer"
                    }
                  `}
                >
                  {isCompleted ? <Check size={20} strokeWidth={3} /> : step.id}
                </button>
                {index < wizardSteps.length - 1 && (
                  <div
                    className={`w-[60px] sm:w-[80px] md:w-[100px] h-[3px] transition-all duration-300 ${step.id < activeStep ? "bg-[#2563eb]" : "bg-[#d4d8de]"
                      }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PAGE HEADER */}
      <div className="bg-[#003566]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-white/70" />
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-serif italic text-white">
              {isNewMode
                ? t?.header?.newTitle || "Register New Vessel"
                : (t?.header?.editTitle || "Edit Vessel")?.replace("{name}", selectedYacht?.boat_name || "Loading...")
              }
            </h1>
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mt-0.5">
              Step {activeStep} of {wizardSteps.length} &middot; {wizardSteps[activeStep - 1]?.label}
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6 lg:p-12 pt-16">
        <form onSubmit={handleSubmit} onChange={handleFormChange} className="space-y-16">
          {/* ERROR SUMMARY */}
          {errors && (
            <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700">
              <div className="flex items-center gap-2 mb-3 font-bold text-sm">
                <AlertCircle size={16} /> Data Conflict Detected
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

          {/* ── STEP 1: IMAGES + AI EXTRACTION ─────────────────── */}
          {activeStep === 1 && (
            <>
              <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#003566] flex items-center gap-3">
                      <Images size={22} className="text-blue-600" /> Vessel
                      Assets & AI Extraction
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Upload images → system auto-optimizes → approve → then AI
                      fills all form fields.
                    </p>
                  </div>
                  {imagesApproved && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-2 rounded-lg">
                      <CheckCircle size={14} /> Images Approved
                    </div>
                  )}
                </div>

                {/* ── Description Field ── */}
                <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" />
                    Vessel Description{" "}
                    <span className="text-slate-400 font-normal">
                      (optional but recommended)
                    </span>
                  </label>
                  <textarea
                    value={boatHint}
                    onChange={(e) => setBoatHint(e.target.value)}
                    placeholder='Brand/Model/Year + short notes (e.g. "Beneteau Oceanis 38, 2016, diesel, 3 cabins, VAT paid, CE docs available")'
                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none transition-all"
                    disabled={isExtracting}
                  />
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Sparkles size={10} /> Adding brand/model/year dramatically
                    improves AI accuracy.
                  </p>
                </div>

                {/* ── Image Upload & Pipeline Grid ── */}
                {pipeline.images.length === 0 ? (
                  <label className="h-64 lg:h-80 bg-white border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group">
                    <Upload
                      size={48}
                      className="text-slate-200 group-hover:text-blue-400 mb-4 transition-colors"
                    />
                    <p className="text-sm font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                      Click to add up to {MAX_IMAGES_UPLOAD} images
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      JPEG, PNG, HEIC auto-optimized by AI
                    </p>
                    <p className="text-xs text-blue-500 mt-1 font-medium">
                      Include HIN plates, docs, registration, engine hours
                    </p>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading || pipeline.isUploading}
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    {/* Stats bar */}
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap items-center gap-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {`${pipeline.stats.total} image${pipeline.stats.total !== 1 ? "s" : ""}`}
                        </p>
                        {pipeline.stats.total > 0 && (
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            {pipeline.stats.processing > 0 && (
                              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" />{" "}
                                {pipeline.stats.processing} processing
                              </span>
                            )}
                            {pipeline.stats.ready > 0 && (
                              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                                {pipeline.stats.ready} ready for review
                              </span>
                            )}
                            {pipeline.stats.approved > 0 && (
                              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                                ✓ {pipeline.stats.approved} approved
                              </span>
                            )}
                            {isReorderingImages && (
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                Saving order...
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                          <button
                            type="button"
                            onClick={() => setImageGridDensity("regular")}
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-bold transition-colors",
                              imageGridDensity === "regular"
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500",
                            )}
                            title="4 images per row"
                          >
                            4
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageGridDensity("compact")}
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-bold transition-colors",
                              imageGridDensity === "compact"
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500",
                            )}
                            title="6 images per row"
                          >
                            6
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageGridDensity("dense")}
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-bold transition-colors",
                              imageGridDensity === "dense"
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500",
                            )}
                            title="8 images per row"
                          >
                            8
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleAutoSortImages()}
                          disabled={isAutoSortingImages || reviewImages.length === 0}
                          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
                        >
                          {isAutoSortingImages ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Wand2 size={12} />
                          )}
                          AI auto-sort
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteAllImagesDialogOpen(true)}
                          disabled={reviewImages.length === 0 || isDeletingAllImages}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
                          title="Delete all images"
                        >
                          {isDeletingAllImages ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash size={12} />
                          )}
                        </button>

                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                          <Upload size={12} /> Add More
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUploading || pipeline.isUploading}
                          />
                        </label>
                      </div>
                    </div>

                    {/* ── Pipeline Image Grid ── */}
                    <DragDropContext onDragEnd={handlePipelineDragEnd}>
                      <Droppable droppableId="pipeline-image-grid" direction="horizontal">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn("grid gap-4", gridClassName)}
                          >
                            {reviewImages.map((img: PipelineImage, index: number) => {
                              const statusConfig: Record<
                                string,
                                { bg: string; text: string; label: string }
                              > = {
                                processing: {
                                  bg: "bg-blue-500",
                                  text: "text-white",
                                  label: "⏳ Processing...",
                                },
                                ready_for_review: {
                                  bg: "bg-amber-500",
                                  text: "text-white",
                                  label: "👁 Ready for Review",
                                },
                                approved: {
                                  bg: "bg-emerald-500",
                                  text: "text-white",
                                  label: "✓ Approved",
                                },
                                processing_failed: {
                                  bg: "bg-red-500",
                                  text: "text-white",
                                  label: "✕ Failed",
                                },
                              };
                              const sc =
                                statusConfig[img.status] || statusConfig.processing;

                              return (
                                <Draggable key={img.id} draggableId={`pipeline-image-${img.id}`} index={index}>
                                  {(dragProvided) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={cn(
                                        "relative group bg-white border shadow-sm overflow-hidden rounded-xl",
                                        img.status === "approved"
                                          ? "border-emerald-300 ring-1 ring-emerald-200"
                                          : img.status === "ready_for_review"
                                            ? "border-amber-300"
                                            : img.status === "processing"
                                              ? "border-blue-200"
                                              : "border-red-300",
                                      )}
                                    >
                                      {/* Image */}
                                      <div className="aspect-square relative flex bg-slate-100 overflow-hidden">
                                        <img
                                          src={
                                            img.thumb_full_url ||
                                            img.optimized_url ||
                                            img.full_url
                                          }
                                          alt={img.original_name || `Yacht image ${index + 1}`}
                                          onClick={() => setSelectedLightboxImageId(img.id)}
                                          className={cn(
                                            "w-full h-full cursor-zoom-in object-cover transition-opacity",
                                            img.enhancement_method === "pending" &&
                                            "opacity-80 grayscale-[0.2]",
                                            img.status === "processing" && "opacity-60"
                                          )}
                                          onError={handleImageError}
                                        />

                                        {/* Loading Overlay for Processing */}
                                        {img.status === "processing" && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                                            <Loader2 size={24} className="animate-spin text-blue-600" />
                                          </div>
                                        )}

                                        {img.enhancement_method === "pending" && (
                                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-bold bg-[#0B1F3A]/30 backdrop-blur-[1px] z-10">
                                            <div className="bg-white/40 p-2 rounded-full mb-2 backdrop-blur-md">
                                              <Loader2
                                                size={18}
                                                className="animate-spin text-white"
                                              />
                                            </div>
                                            <span className="text-[10px] tracking-wider uppercase text-white drop-shadow-md">
                                              Optimizing...
                                            </span>
                                          </div>
                                        )}

                                        {/* Status badge */}
                                        <div
                                          className={`absolute top-2 left-2 ${sc.bg} ${sc.text} text-[9px] font-bold px-2 py-1 rounded-md shadow-md z-20`}
                                        >
                                          {sc.label}
                                        </div>

                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="absolute right-2 bottom-2 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md backdrop-blur active:cursor-grabbing"
                                          title="Drag to reorder"
                                        >
                                          <GripVertical size={14} />
                                        </div>

                                        {/* Quality label */}
                                        {img.quality_label &&
                                          img.status !== "processing" && (
                                            <div
                                              className={cn(
                                                "absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-1 rounded-md backdrop-blur-sm z-20 shadow-md",
                                                img.quality_score &&
                                                  img.quality_score < 70
                                                  ? "bg-red-500/90"
                                                  : "bg-black/60",
                                              )}
                                            >
                                              {img.quality_label}
                                            </div>
                                          )}

                                        {img.category && (
                                          <div className="absolute bottom-2 right-12 z-20 rounded-md bg-[#0B1F3A]/80 px-2 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur-sm">
                                            {img.category}
                                          </div>
                                        )}

                                        {/* AI Enhanced badge */}
                                        {img.enhancement_method === "cloudinary" &&
                                          img.status !== "processing" && (
                                            <div className="absolute bottom-2 left-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5 z-20">
                                              <Sparkles size={10} /> AI Enhanced
                                            </div>
                                          )}
                                      </div>

                                      {/* Controls */}
                                      <div className="p-3 space-y-2">
                                        {/* Quality score bar */}
                                        {img.quality_score !== null && (
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                AI review score
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-400">
                                                {img.quality_score}/100
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                  className={cn(
                                                    "h-full rounded-full transition-all",
                                                    img.quality_score >= 70
                                                      ? "bg-emerald-500"
                                                      : img.quality_score >= 40
                                                        ? "bg-amber-500"
                                                        : "bg-red-500",
                                                  )}
                                                  style={{ width: `${img.quality_score}%` }}
                                                />
                                              </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                              Measures gallery readiness after AI cleanup.
                                            </p>
                                          </div>
                                        )}

                                        {/* Keep original toggle */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-slate-500 font-medium">
                                            Keep original
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              pipeline.toggleKeepOriginal(img.id)
                                            }
                                            className={cn(
                                              "w-8 h-4 rounded-full transition-colors relative",
                                              img.keep_original
                                                ? "bg-blue-500"
                                                : "bg-slate-200",
                                            )}
                                          >
                                            <div
                                              className={cn(
                                                "w-3 h-3 bg-white rounded-full shadow absolute top-0.5 transition-transform",
                                                img.keep_original
                                                  ? "translate-x-4"
                                                  : "translate-x-0.5",
                                              )}
                                            />
                                          </button>
                                        </div>

                                        <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] text-slate-500">
                                          <p className="font-semibold text-slate-700">AI comments</p>
                                          <p className="mt-1 line-clamp-2">
                                            {buildImageAiNotes(img)[0]}
                                          </p>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2">
                                          {img.status === "ready_for_review" && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                pipeline.approveImage(img.id)
                                              }
                                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
                                            >
                                              <Check size={12} /> Approve
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => pipeline.deleteImage(img.id)}
                                            className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1.5 px-3 rounded-md transition-colors flex items-center gap-1"
                                          >
                                            <Trash size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    <Dialog
                      open={selectedLightboxImage !== null}
                      onOpenChange={(open) => {
                        if (!open) {
                          setSelectedLightboxImageId(null);
                        }
                      }}
                    >
                      <DialogContent
                        showCloseButton={false}
                        className="max-w-[min(96vw,1240px)] overflow-hidden rounded-[32px] border border-slate-800/80 bg-[#020817] p-0 shadow-[0_40px_120px_rgba(2,6,23,0.78)]"
                      >
                        {selectedLightboxImage && (
                          <div className="max-h-[92vh] overflow-y-auto">
                            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)]">
                              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
                                <div className="rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 backdrop-blur-xl">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                                    AI Gallery Review
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 backdrop-blur-xl">
                                    {selectedLightboxIndex + 1} / {reviewImages.length}
                                  </span>
                                  <DialogClose asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white transition-colors hover:bg-white/10"
                                      aria-label="Close image review"
                                    >
                                      <X size={18} />
                                    </button>
                                  </DialogClose>
                                </div>
                              </div>

                              <div className="relative flex min-h-[54vh] items-center justify-center px-4 pb-24 pt-24 sm:px-8 lg:px-10">
                                <img
                                  src={
                                    selectedLightboxImage.optimized_url ||
                                    selectedLightboxImage.full_url
                                  }
                                  alt={
                                    selectedLightboxImage.original_name ||
                                    "Selected yacht image"
                                  }
                                  className="max-h-[62vh] w-auto max-w-full rounded-[28px] border border-white/10 bg-slate-950/70 object-contain shadow-[0_30px_100px_rgba(15,23,42,0.65)]"
                                  onError={handleImageError}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => moveLightboxImage("prev")}
                                className="absolute bottom-6 left-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-950/65 text-white shadow-[0_12px_40px_rgba(15,23,42,0.5)] backdrop-blur-xl transition-colors hover:bg-white/10"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLightboxImage("next")}
                                className="absolute bottom-6 left-24 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-950/65 text-white shadow-[0_12px_40px_rgba(15,23,42,0.5)] backdrop-blur-xl transition-colors hover:bg-white/10"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>

                            <div className="border-t border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.96)_100%)] p-6 sm:p-8 lg:p-10">
                              <DialogHeader className="text-left">
                                <div className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                                  Review Details
                                </div>
                                <DialogTitle className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                                  {selectedLightboxImage.original_name || "Image review"}
                                </DialogTitle>
                                <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                  Review the full image, the AI quality score, and the applied corrections before approving it for the final gallery.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="mt-6 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                                  {selectedLightboxImage.category || "General"}
                                </span>
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold capitalize text-violet-700 shadow-sm">
                                  {(selectedLightboxImage.enhancement_method || "none").replace(/_/g, " ")}
                                </span>
                                {selectedLightboxImage.keep_original && (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                                    Keep original
                                  </span>
                                )}
                              </div>

                              <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                                      AI review score
                                    </p>
                                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                                      {selectedLightboxImage.quality_score ?? "—"}
                                      <span className="text-lg text-slate-400">/100</span>
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs font-bold",
                                      (selectedLightboxImage.quality_score ?? 0) >= 70
                                        ? "bg-emerald-50 text-emerald-700"
                                        : (selectedLightboxImage.quality_score ?? 0) >= 40
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-red-50 text-red-700",
                                    )}
                                  >
                                    {(selectedLightboxImage.quality_score ?? 0) >= 70
                                      ? "Gallery ready"
                                      : (selectedLightboxImage.quality_score ?? 0) >= 40
                                        ? "Needs review"
                                        : "Needs correction"}
                                  </span>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-slate-500">
                                  This score reflects how suitable the image is for the public gallery after AI cleanup and classification.
                                </p>

                                <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                                  AI review score
                                </p>
                                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={cn(
                                      "h-full rounded-full bg-gradient-to-r",
                                      (selectedLightboxImage.quality_score ?? 0) >= 70
                                        ? "from-emerald-400 to-emerald-500"
                                        : (selectedLightboxImage.quality_score ?? 0) >= 40
                                          ? "from-amber-400 to-orange-500"
                                          : "from-rose-400 to-red-500",
                                    )}
                                    style={{
                                      width: `${selectedLightboxImage.quality_score ?? 0}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-6 space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                                  AI comments
                                </p>
                                <div className="space-y-2">
                                  {buildImageAiNotes(selectedLightboxImage).map((note) => (
                                    <div
                                      key={note}
                                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                                    >
                                      {note}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                {/* ── Approval Gate ── */}
                {pipeline.stats.total > 0 && (
                  <div
                    className={cn(
                      "rounded-xl p-5 border",
                      imagesApproved
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50 border-amber-200",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={cn(
                            "text-sm font-bold",
                            imagesApproved
                              ? "text-emerald-700"
                              : "text-amber-700",
                          )}
                        >
                          {isNewMode
                            ? imagesApproved
                              ? canProceedFromStep1
                                ? "✅ Images approved — Step 2 is unlocked!"
                                : "🤖 Images approved. AI extraction is still running..."
                              : `⏳ ${pipeline.stats.approved} of ${pipeline.stats.min_required} minimum images approved`
                            : "ℹ️ Edit Manifest mode — Step 2 is unlocked with existing boat details."}
                        </p>
                        {(isNewMode && !imagesApproved) && (
                          <p className="text-xs text-amber-600 mt-1">
                            Step 2 opens after image approval. AI extraction continues in background and fills fields when ready.
                            {pipeline.stats.processing > 0 &&
                              ` ${pipeline.stats.processing} still processing...`}
                          </p>
                        )}
                      </div>
                      {pipeline.stats.ready > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const result = await pipeline.approveAll();
                            if (result.step2_unlocked) {
                              if (isNewMode) {
                                const extractionOk = await handleAiExtract({
                                  background: true,
                                  navigateToStep2: true,
                                  speedMode: "balanced",
                                });
                                if (!extractionOk) {
                                  toast(
                                    "AI extraction timed out. Step 2 is unlocked; you can continue manually and retry AI later.",
                                    { icon: "⚠️" },
                                  );
                                  setActiveStep(2);
                                }
                              } else {
                                toast.success("Images approved. You can manually run AI autofill if needed.");
                              }
                            } else {
                              toast.success("Images approved.");
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-md"
                        >
                          <CheckCircle size={16} /> {isNewMode ? "Approve All" : "Approve All"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Extract with AI Area (Auto-triggered) ── */}
                {(pipeline.stats.total > 0 || imagesApproved || (!isOnline && offlineImages.length > 0)) && (
                  <div className="flex flex-col items-center gap-4 py-4">
                    {/* Offline Skip Button */}
                    {!isOnline ? (
                      <div className="flex flex-col items-center gap-3 w-full max-w-lg">
                        <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg p-4 text-sm w-full flex gap-3 shadow-sm mb-2">
                          <WifiOff className="shrink-0" size={18} />
                          <div>
                            <p className="font-semibold mb-1">AI Extraction Not Available Offline</p>
                            <p>You can skip this step and fill in the boat details manually. Images are saved locally.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveStep(2)}
                          className="w-full py-4 px-8 rounded-xl text-base font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Skip to Step 2 (Manual Fill) <ArrowRight size={20} />
                        </button>
                      </div>
                    ) : (
                      isExtracting && (
                        <div className="w-full max-w-lg flex flex-col items-center justify-center gap-3 py-6 px-4 bg-blue-50/50 rounded-xl border border-blue-100">
                          <Loader2 size={32} className="animate-spin text-blue-600" />
                          <p className="text-blue-800 font-medium">Gemini is analyzing your images...</p>
                        </div>
                      )
                    )}
                    {!geminiExtracted && !isExtracting && isOnline && (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-xs text-slate-400 text-center">
                          {imagesApproved
                            ? `AI is ready to analyze ${pipeline.stats.approved} approved optimized images`
                            : `Upload and approve images first, then AI will analyze them`}
                        </p>

                        {/* Manual Trigger for Edit Mode or Retries */}
                        {imagesApproved && (
                          <button
                            type="button"
                            onClick={() => {
                              toast("Extracting data from images...", { icon: "🪄" });
                              void handleAiExtract();
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Sparkles size={16} /> Run AI Extraction Manually
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                )}

                {/* Extracted Fields Preview intentionally hidden */}
              </div>
            </>
          )}

          {/* ── VIDEO SECTION (After Image Pipeline but inside Step 1) ── */}
          {activeStep === 1 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-8 mb-4">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Video size={18} className="text-blue-500" /> Vessel Video Operations
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                    {t?.video?.manage || "Manage Videos & Social Posting"}
                  </p>
                </div>
                <label className="cursor-pointer bg-[#003566] text-white px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-2">
                  {isUploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={14} />}
                  {t?.video?.upload || "Upload MP4"}
                  <input
                    type="file"
                    className="hidden"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={isUploadingVideo}
                  />
                </label>
              </div>

              <div className="p-6">
                {boatVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-40 gap-3 border-2 border-dashed border-slate-200 rounded-lg">
                    <Video size={32} className="text-slate-500" />
                    <span className="text-xs uppercase font-bold text-slate-500">
                      {t?.video?.noVideo || "No Video uploaded"}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {boatVideos.map((video) => (
                      <div key={video.id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-5 shadow-sm bg-slate-50">
                        <div className="w-full sm:w-40 h-40 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200">
                          {video.thumbnail_url ? (
                            <img src={video.thumbnail_url} className="w-full h-full object-cover" />
                          ) : (
                            <Video size={32} />
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
                              <Play size={18} className="text-white ml-1" />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 space-y-3 pt-1">
                          <div className="flex justify-between items-start">
                            <p className="text-[11px] font-black text-[#003566] uppercase tracking-wider">
                              Delivery Status:
                              <span className={cn(
                                "ml-2 px-2 py-0.5 rounded text-[9px] text-white",
                                video.status === 'published' ? 'bg-emerald-500' :
                                  video.status === 'processing' ? 'bg-amber-500' : 'bg-blue-500'
                              )}>
                                {video.status}
                              </span>
                            </p>
                          </div>

                          <div className="flex gap-4">
                            {video.duration && <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1.5"><Clock size={12} /> {video.duration}s</p>}
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1.5"><Box size={12} /> {video.format}</p>
                          </div>

                          <div className="pt-4 flex flex-wrap gap-2 mt-auto">
                            <Button
                              type="button"
                              variant="outline"
                              className="text-[10px] h-8 px-3 font-bold uppercase tracking-wider bg-white"
                              onClick={() => router.push(`/${locale}/dashboard/${role}/yachts/${yachtId}/video-settings`)}
                              disabled={isNewMode && !createdYachtId}
                            >
                              Social Settings
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              className="text-[10px] h-8 px-4 font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleVideoPublish(video.id)}
                              disabled={isPublishingVideo === video.id || (isNewMode && !createdYachtId)}
                            >
                              {isPublishingVideo === video.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles size={12} className="mr-2" />}
                              Publish
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              className="text-[10px] h-8 px-3 font-bold uppercase bg-red-50 text-red-600 hover:bg-red-100 border-red-100 ml-auto"
                              onClick={() => handleVideoDelete(video.id)}
                              disabled={isNewMode && !createdYachtId}
                            >
                              <Trash size={14} className="mr-1.5" /> Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: SPECS (Analyzed by AI) ──────────────── */}
          {activeStep === 2 && (
            <div
              key={`step2-${formKey}`}
              className="space-y-6 lg:space-y-8 pt-2"
            >
              {/* AI extraction summary intentionally hidden in Step 2 */}
              {confidenceMeta?.ai_session_id && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-800">
                    AI Correction Feedback
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Session: <span className="font-semibold">{confidenceMeta.ai_session_id}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CORRECTION_BUTTONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          setCorrectionLabel((prev) => (prev === item.value ? null : item.value))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                          correctionLabel === item.value
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* --- SECTION 2: CORE SPECS --- */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Coins size={20} className="text-blue-600" /> Essential
                    Registry Data
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2 group">
                    <Label>Vessel Name *</Label>
                    <Input
                      name="boat_name"
                      defaultValue={selectedYacht?.boat_name}
                      placeholder="e.g. M/Y NOBILITY"
                      required
                      needsConfirmation={needsConfirm("boat_name")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Manufacturer / Make</Label>
                    <CatalogAutocomplete
                      endpoint="/api/autocomplete/brands"
                      name="manufacturer"
                      defaultValue={selectedYacht?.manufacturer}
                      placeholder="e.g. Beneteau, Sunseeker"
                      needsConfirmation={needsConfirm("manufacturer")}
                      onSelect={(id, name) => {
                        setSelectedBrandId(Number(id));
                        setSelectedYacht((prev: any) => ({ ...prev, manufacturer: name }));
                      }}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Model</Label>
                    <CatalogAutocomplete
                      endpoint="/api/autocomplete/models"
                      name="model"
                      defaultValue={selectedYacht?.model}
                      placeholder="e.g. Oceanis 38.1"
                      dependsOn="brand_id"
                      dependsOnValue={selectedBrandId}
                      needsConfirmation={needsConfirm("model")}
                      onSelect={(_id, name) => {
                        // When model changes, we update the state so the assistant picks it up
                        setSelectedYacht((prev: any) => ({ ...prev, model: name }));
                      }}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <Label>Verkooplocatie (Haven) *</Label>
                    <Select
                      value={selectedYacht?.ref_harbor_id?.toString() || ""}
                      onValueChange={(val) => {
                        setSelectedYacht((prev: any) => ({ ...prev, ref_harbor_id: Number(val) }));
                      }}
                    >
                      <SelectTrigger className="h-11 border-slate-200">
                        <SelectValue placeholder="Selecteer locatie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {harbors.map((h) => (
                          <SelectItem key={h.id} value={h.id.toString()}>
                            {h.name} ({h.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ── AI ASSISTANT ── */}
                  <div className="md:col-span-2 lg:col-span-3">
                    <BoatCreationAssistant
                      manufacturer={selectedYacht?.manufacturer || ""}
                      model={selectedYacht?.model || ""}
                      autoApply
                      onApply={(specs, mode = "manual") => {
                        const isAuto = mode === "auto";
                        const isEmpty = (value: unknown) =>
                          value === null ||
                          value === undefined ||
                          value === "" ||
                          value === "unknown";

                        setSelectedYacht((prev: any) => {
                          const base = { ...(prev || {}) };
                          const normalizedSpecs = {
                            ...specs,
                            loa: specs.loa ?? specs.length_m,
                            beam: specs.beam ?? specs.beam_m ?? specs.width,
                            draft: specs.draft ?? specs.draft_m ?? specs.draught,
                          };

                          Object.entries(normalizedSpecs).forEach(([field, value]) => {
                            if (value === null || value === undefined || value === "") return;
                            if (isAuto && !isEmpty(base[field])) return;
                            base[field] = value;
                          });

                          return base;
                        });
                        setFormKey(k => k + 1); // Refresh form to show new defaultValues
                        if (!isAuto) {
                          toast.success("AI suggestions applied to form!");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Price (€)</Label>
                    <Input
                      name="price"
                      type="number"
                      defaultValue={selectedYacht?.price}
                      placeholder="1500000"
                      needsConfirmation={needsConfirm("price")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Minimum Bid Amount (€)</Label>
                    <Input
                      name="min_bid_amount"
                      type="number"
                      defaultValue={selectedYacht?.min_bid_amount || ""}
                      placeholder="Auto-calculates 90% of price if empty"
                      step="1000"
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Year Built</Label>
                    <Input
                      name="year"
                      type="number"
                      defaultValue={selectedYacht?.year}
                      placeholder="2024"
                      needsConfirmation={needsConfirm("year")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Boat Type</Label>
                    <CatalogAutocomplete
                      endpoint="/api/autocomplete/types"
                      name="boat_type"
                      defaultValue={selectedYacht?.boat_type}
                      placeholder="e.g. Sailboat, Motorboat"
                      needsConfirmation={needsConfirm("boat_type")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Boat Category</Label>
                    <Input
                      name="boat_category"
                      defaultValue={selectedYacht?.boat_category}
                      placeholder="e.g. Cruiser, Racing, Fishing"
                      needsConfirmation={needsConfirm("boat_category")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>New or Used</Label>
                    <select
                      name="new_or_used"
                      defaultValue={selectedYacht?.new_or_used || ""}
                      className={cn(
                        "w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                        "hover:border-slate-300",
                        "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
                      )}
                    >
                      <option value="">Select…</option>
                      <option value="new">New</option>
                      <option value="used">Used</option>
                    </select>
                  </div>
                  <div className="space-y-2 group">
                    <Label>LOA (Length Overall)</Label>
                    <Input
                      name="loa"
                      defaultValue={selectedYacht?.loa}
                      placeholder="45.5"
                      needsConfirmation={needsConfirm("loa")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>LWL (Waterline Length)</Label>
                    <Input
                      name="lwl"
                      defaultValue={selectedYacht?.lwl}
                      placeholder="40.2"
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>Shipyard / Werf</Label>
                    <Input
                      name="where"
                      defaultValue={selectedYacht?.where}
                      placeholder="e.g. Beneteau, Bavaria"
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>CE Category</Label>
                    <select
                      name="ce_category"
                      defaultValue={selectedYacht?.ce_category || ""}
                      className={cn(
                        "w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                        "hover:border-slate-300",
                        "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
                      )}
                    >
                      <option value="">Select…</option>
                      <option value="A">A — Ocean</option>
                      <option value="B">B — Offshore</option>
                      <option value="C">C — Inshore</option>
                      <option value="D">D — Sheltered Waters</option>
                    </select>
                  </div>
                  <div className="space-y-2 group">
                    <Label>Status</Label>
                    <select
                      name="status"
                      defaultValue={selectedYacht?.status || "Draft"}
                      className={cn(
                        "w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                        "hover:border-slate-300",
                        "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
                      )}
                    >
                      <option value="For Sale">For Sale</option>
                      <option value="For Bid">For Bid</option>
                      <option value="Sold">Sold</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                  <div className="space-y-2 group">
                    <Label>Passenger Capacity</Label>
                    <Input
                      name="passenger_capacity"
                      type="number"
                      defaultValue={selectedYacht?.passenger_capacity}
                      placeholder="12"
                    />
                  </div>
                </div>
              </div>

              {/* --- SECTION 3: TECHNICAL DOSSIER --- */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-10">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Waves size={20} className="text-blue-600" /> Technical
                  Dossier
                </h3>

                {/* Sub-Section: General & Hull */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <SectionHeader
                      icon={<Ship size={16} />}
                      title="Hull & Dimensions"
                    />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1 group">
                        <Label>Beam (Width)</Label>
                        <Input
                          name="beam"
                          defaultValue={selectedYacht?.beam}
                          placeholder="e.g. 8.5m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Draft (Depth)</Label>
                        <Input
                          name="draft"
                          defaultValue={selectedYacht?.draft}
                          placeholder="e.g. 2.1m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Air Draft (Clearance)</Label>
                        <Input
                          name="air_draft"
                          defaultValue={selectedYacht?.air_draft}
                          placeholder="e.g. 4.5m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Displacement</Label>
                        <Input
                          name="displacement"
                          defaultValue={selectedYacht?.displacement}
                          placeholder="e.g. 12000 kg"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Ballast</Label>
                        <Input
                          name="ballast"
                          defaultValue={selectedYacht?.ballast}
                          placeholder="e.g. 3500 kg"
                          needsConfirmation={needsConfirm("ballast")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Hull Type</Label>
                        <Input
                          name="hull_type"
                          defaultValue={selectedYacht?.hull_type}
                          placeholder="e.g. Monohull"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Hull Construction</Label>
                        <Input
                          name="hull_construction"
                          defaultValue={selectedYacht?.hull_construction}
                          placeholder="e.g. GRP / Polyester"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Hull Colour</Label>
                        <Input
                          name="hull_colour"
                          defaultValue={selectedYacht?.hull_colour}
                          placeholder="White"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Hull Number</Label>
                        <Input
                          name="hull_number"
                          defaultValue={selectedYacht?.hull_number}
                          placeholder="e.g. HULL001"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Designer</Label>
                        <Input
                          name="designer"
                          defaultValue={selectedYacht?.designer}
                          placeholder="e.g. Philippe Briand"
                          needsConfirmation={needsConfirm("designer")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Builder</Label>
                        <Input
                          name="builder"
                          defaultValue={selectedYacht?.builder}
                          placeholder="e.g. Beneteau"
                          needsConfirmation={needsConfirm("builder")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Deck Colour</Label>
                        <Input
                          name="deck_colour"
                          defaultValue={selectedYacht?.deck_colour}
                          placeholder="e.g. White"
                          needsConfirmation={needsConfirm("deck_colour")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Deck Construction</Label>
                        <Input
                          name="deck_construction"
                          defaultValue={selectedYacht?.deck_construction}
                          placeholder="e.g. GRP with teak"
                          needsConfirmation={needsConfirm("deck_construction")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Superstructure Colour</Label>
                        <Input
                          name="super_structure_colour"
                          defaultValue={selectedYacht?.super_structure_colour}
                          placeholder="e.g. White"
                          needsConfirmation={needsConfirm(
                            "super_structure_colour",
                          )}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Superstructure Construction</Label>
                        <Input
                          name="super_structure_construction"
                          defaultValue={
                            selectedYacht?.super_structure_construction
                          }
                          placeholder="e.g. GRP"
                          needsConfirmation={needsConfirm(
                            "super_structure_construction",
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <SectionHeader
                      icon={<Zap size={16} />}
                      title="Engine & Performance"
                    />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1 group">
                        <Label>Engine Manufacturer</Label>
                        <Input
                          name="engine_manufacturer"
                          defaultValue={selectedYacht?.engine_manufacturer}
                          placeholder="e.g. CAT / MTU"
                          needsConfirmation={needsConfirm(
                            "engine_manufacturer",
                          )}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Engine Model</Label>
                        <Input
                          name="engine_model"
                          defaultValue={selectedYacht?.engine_model}
                          placeholder="e.g. C32 ACERT"
                          needsConfirmation={needsConfirm("engine_model")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Engine Type</Label>
                        <select
                          name="engine_type"
                          defaultValue={selectedYacht?.engine_type || ""}
                          className={cn(
                            "w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                            "hover:border-slate-300",
                            "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
                          )}
                        >
                          <option value="">Select…</option>
                          <option value="inboard">Inboard</option>
                          <option value="outboard">Outboard</option>
                          <option value="saildrive">Saildrive</option>
                          <option value="sterndrive">Sterndrive</option>
                        </select>
                      </div>
                      <div className="space-y-1 group">
                        <Label>Horse Power</Label>
                        <Input
                          name="horse_power"
                          defaultValue={selectedYacht?.horse_power}
                          placeholder="e.g. 2x 1500HP"
                          needsConfirmation={needsConfirm("horse_power")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Engine Hours</Label>
                        <Input
                          name="hours"
                          defaultValue={selectedYacht?.hours}
                          placeholder="e.g. 450 hrs"
                          needsConfirmation={needsConfirm("hours")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Fuel Type</Label>
                        <Input
                          name="fuel"
                          defaultValue={selectedYacht?.fuel}
                          placeholder="Diesel"
                          needsConfirmation={needsConfirm("fuel")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Engine Quantity</Label>
                        <Input
                          name="engine_quantity"
                          defaultValue={selectedYacht?.engine_quantity}
                          placeholder="e.g. 1, 2, 3"
                          needsConfirmation={needsConfirm("engine_quantity")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Engine Year</Label>
                        <Input
                          name="engine_year"
                          type="number"
                          defaultValue={selectedYacht?.engine_year}
                          placeholder="e.g. 2020"
                          needsConfirmation={needsConfirm("engine_year")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Max Speed</Label>
                        <Input
                          name="max_speed"
                          defaultValue={selectedYacht?.max_speed}
                          placeholder="e.g. 35 kn"
                          needsConfirmation={needsConfirm("max_speed")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Cruising Speed</Label>
                        <Input
                          name="cruising_speed"
                          defaultValue={selectedYacht?.cruising_speed}
                          placeholder="e.g. 25 kn"
                          needsConfirmation={needsConfirm("cruising_speed")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Drive Type</Label>
                        <Input
                          name="drive_type"
                          defaultValue={selectedYacht?.drive_type}
                          placeholder="e.g. Shaft, V-drive, Pod"
                          needsConfirmation={needsConfirm("drive_type")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Propulsion</Label>
                        <Input
                          name="propulsion"
                          defaultValue={selectedYacht?.propulsion}
                          placeholder="e.g. Fixed prop, Folding, Saildrive"
                          needsConfirmation={needsConfirm("propulsion")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Gallons per Hour</Label>
                        <Input
                          name="gallons_per_hour"
                          defaultValue={selectedYacht?.gallons_per_hour}
                          placeholder="e.g. 50"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>Tankage</Label>
                        <Input
                          name="tankage"
                          defaultValue={selectedYacht?.tankage}
                          placeholder="e.g. 2000L"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* --- SECTION 2: CORE SPECS --- */}
              <div className="bg-white p-8 lg:p-10 border border-slate-200 shadow-sm space-y-8">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2 border-b border-slate-200 pb-4 italic">
                  <Coins size={18} /> Essential Registry Data
                </h3>

                {/* Sub-Section: Accommodation */}
                <div className="space-y-5">
                  <SectionHeader
                    icon={<Bed size={16} />}
                    title="Accommodation & Facilities"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <div className="space-y-1 group">
                      <Label>Cabins</Label>
                      <Input
                        name="cabins"
                        type="number"
                        defaultValue={selectedYacht?.cabins}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Berths</Label>
                      <Input
                        name="berths"
                        defaultValue={selectedYacht?.berths}
                        placeholder="6"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Toilet</Label>
                      <TriStateSelect
                        name="toilet"
                        defaultValue={selectedYacht?.toilet}
                        needsConfirmation={needsConfirm("toilet")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Berths (Fixed)</Label>
                      <Input
                        name="berths_fixed"
                        type="number"
                        defaultValue={selectedYacht?.berths_fixed}
                        placeholder="4"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Berths (Extra)</Label>
                      <Input
                        name="berths_extra"
                        type="number"
                        defaultValue={selectedYacht?.berths_extra}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Berths (Crew)</Label>
                      <Input
                        name="berths_crew"
                        type="number"
                        defaultValue={selectedYacht?.berths_crew}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Shower</Label>
                      <Input
                        name="shower"
                        defaultValue={selectedYacht?.shower}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Bath</Label>
                      <Input
                        name="bath"
                        defaultValue={selectedYacht?.bath}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Interior Type</Label>
                      <Input
                        name="interior_type"
                        defaultValue={selectedYacht?.interior_type}
                        placeholder="Classic, wood"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Saloon</Label>
                      <Input
                        name="saloon"
                        defaultValue={selectedYacht?.saloon}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Headroom</Label>
                      <Input
                        name="headroom"
                        defaultValue={selectedYacht?.headroom}
                        placeholder="1.95m"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Separate Dining Area</Label>
                      <Input
                        name="separate_dining_area"
                        defaultValue={selectedYacht?.separate_dining_area}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Engine Room</Label>
                      <Input
                        name="engine_room"
                        defaultValue={selectedYacht?.engine_room}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Spaces Inside</Label>
                      <Input
                        name="spaces_inside"
                        defaultValue={selectedYacht?.spaces_inside}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Upholstery Color</Label>
                      <Input
                        name="upholstery_color"
                        defaultValue={selectedYacht?.upholstery_color}
                        placeholder="Blue"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Matrasses</Label>
                      <Input
                        name="matrasses"
                        defaultValue={selectedYacht?.matrasses}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Cushions</Label>
                      <Input
                        name="cushions"
                        defaultValue={selectedYacht?.cushions}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Curtains</Label>
                      <Input
                        name="curtains"
                        defaultValue={selectedYacht?.curtains}
                        placeholder="White"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Heating</Label>
                      <TriStateSelect
                        name="heating"
                        defaultValue={selectedYacht?.heating}
                        needsConfirmation={needsConfirm("heating")}
                      />
                    </div>
                    <div className="space-y-1 group flex items-center gap-3 pt-5">
                      <input
                        type="checkbox"
                        name="air_conditioning"
                        defaultChecked={
                          selectedYacht?.air_conditioning === true ||
                          selectedYacht?.air_conditioning === "true" ||
                          selectedYacht?.air_conditioning === 1
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label>Air Conditioning</Label>
                    </div>
                    <div className="space-y-1 group flex items-center gap-3 pt-5">
                      <input
                        type="checkbox"
                        name="flybridge"
                        defaultChecked={
                          selectedYacht?.flybridge === true ||
                          selectedYacht?.flybridge === "true" ||
                          selectedYacht?.flybridge === 1
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label>Flybridge</Label>
                    </div>
                    <div className="space-y-1 group">
                      <Label>Cockpit Type</Label>
                      <Input
                        name="cockpit_type"
                        defaultValue={selectedYacht?.cockpit_type}
                        placeholder="Aft cockpit"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Water Tank</Label>
                      <Input
                        name="water_tank"
                        defaultValue={selectedYacht?.water_tank}
                        placeholder="200L"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Water Tank Gauge</Label>
                      <Input
                        name="water_tank_gauge"
                        defaultValue={selectedYacht?.water_tank_gauge}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Water Maker</Label>
                      <Input
                        name="water_maker"
                        defaultValue={selectedYacht?.water_maker}
                        placeholder="60 L/h"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Waste Water Tank</Label>
                      <Input
                        name="waste_water_tank"
                        defaultValue={selectedYacht?.waste_water_tank}
                        placeholder="80L"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Waste Water Gauge</Label>
                      <Input
                        name="waste_water_tank_gauge"
                        defaultValue={selectedYacht?.waste_water_tank_gauge}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Waste Tank Drain Pump</Label>
                      <Input
                        name="waste_water_tank_drainpump"
                        defaultValue={selectedYacht?.waste_water_tank_drainpump}
                        placeholder="Electric"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Deck Suction</Label>
                      <Input
                        name="deck_suction"
                        defaultValue={selectedYacht?.deck_suction}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Water System</Label>
                      <Input
                        name="water_system"
                        defaultValue={selectedYacht?.water_system}
                        placeholder="Pressurized"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Hot Water</Label>
                      <Input
                        name="hot_water"
                        defaultValue={selectedYacht?.hot_water}
                        placeholder="Boiler"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Sea Water Pump</Label>
                      <Input
                        name="sea_water_pump"
                        defaultValue={selectedYacht?.sea_water_pump}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group flex items-center gap-3 pt-5">
                      <input
                        type="checkbox"
                        name="deck_wash_pump"
                        defaultChecked={
                          selectedYacht?.deck_wash_pump === true ||
                          selectedYacht?.deck_wash_pump === "true" ||
                          selectedYacht?.deck_wash_pump === 1
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label>Deck Wash Pump</Label>
                    </div>
                    <div className="space-y-1 group flex items-center gap-3 pt-5">
                      <input
                        type="checkbox"
                        name="deck_shower"
                        defaultChecked={
                          selectedYacht?.deck_shower === true ||
                          selectedYacht?.deck_shower === "true" ||
                          selectedYacht?.deck_shower === 1
                        }
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label>Deck Shower</Label>
                    </div>
                    <div className="space-y-1 group">
                      <Label>Television</Label>
                      <TriStateSelect
                        name="television"
                        defaultValue={selectedYacht?.television}
                        needsConfirmation={needsConfirm("television")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Radio / CD Player</Label>
                      <Input
                        name="cd_player"
                        defaultValue={selectedYacht?.cd_player}
                        placeholder="Pioneer"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Satellite Reception</Label>
                      <Input
                        name="satellite_reception"
                        defaultValue={selectedYacht?.satellite_reception}
                        placeholder="KVH TracVision"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Cooker</Label>
                      <Input
                        name="cooker"
                        defaultValue={selectedYacht?.cooker}
                        placeholder="3-burner"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Cooking Fuel</Label>
                      <Input
                        name="cooking_fuel"
                        defaultValue={selectedYacht?.cooking_fuel}
                        placeholder="Gas"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Oven</Label>
                      <TriStateSelect
                        name="oven"
                        defaultValue={selectedYacht?.oven}
                        needsConfirmation={needsConfirm("oven")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Microwave</Label>
                      <TriStateSelect
                        name="microwave"
                        defaultValue={selectedYacht?.microwave}
                        needsConfirmation={needsConfirm("microwave")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Fridge</Label>
                      <TriStateSelect
                        name="fridge"
                        defaultValue={selectedYacht?.fridge}
                        needsConfirmation={needsConfirm("fridge")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Freezer</Label>
                      <TriStateSelect
                        name="freezer"
                        defaultValue={selectedYacht?.freezer}
                        needsConfirmation={needsConfirm("freezer")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Hot Air Heating</Label>
                      <Input
                        name="hot_air"
                        defaultValue={selectedYacht?.hot_air}
                        placeholder="Webasto"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Stove Heating</Label>
                      <Input
                        name="stove"
                        defaultValue={selectedYacht?.stove}
                        placeholder="Refleks"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Central Heating</Label>
                      <Input
                        name="central_heating"
                        defaultValue={selectedYacht?.central_heating}
                        placeholder="Kabola"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>Control Type</Label>
                      <Input
                        name="control_type"
                        defaultValue={selectedYacht?.control_type}
                        placeholder="e.g. Wheel / Joystick"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Section: Navigation Equipment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Compass size={20} className="text-blue-600" /> Navigation &
                  Electronics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "compass",
                      label: "Compass",
                      ph: "e.g. Ritchie Globemaster",
                    },
                    {
                      name: "depth_instrument",
                      label: "Depth Instrument",
                      ph: "e.g. Simrad IS42",
                    },
                    {
                      name: "wind_instrument",
                      label: "Wind Instrument",
                      ph: "e.g. B&G WS310",
                    },
                    {
                      name: "navigation_lights",
                      label: "Navigation Lights",
                      ph: "e.g. Aqua Signal Series 40",
                    },
                    {
                      name: "autopilot",
                      label: "Autopilot",
                      ph: "e.g. Raymarine EV-200",
                    },
                    {
                      name: "gps",
                      label: "GPS",
                      ph: "e.g. Garmin GPSMap 922xs",
                    },
                    {
                      name: "vhf",
                      label: "VHF / Marifoon",
                      ph: "e.g. Icom IC-M506",
                    },
                    {
                      name: "plotter",
                      label: "Chart Plotter",
                      ph: "e.g. Raymarine Axiom 9",
                    },
                    {
                      name: "speed_instrument",
                      label: "Log / Speed",
                      ph: "e.g. Simrad IS42",
                    },
                    {
                      name: "radar",
                      label: "Radar",
                      ph: "e.g. Furuno DRS4DL+",
                    },
                    {
                      name: "fishfinder",
                      label: "Fishfinder",
                      ph: "e.g. Garmin Striker 7sv",
                    },
                    { name: "ais", label: "AIS", ph: "e.g. em-trak B954" },
                    {
                      name: "log_speed",
                      label: "Log / Speed",
                      ph: "e.g. Simrad IS42",
                    },
                    {
                      name: "rudder_position_indicator",
                      label: "Rudder Position Indicator",
                      ph: "Yes",
                    },
                    {
                      name: "turn_indicator",
                      label: "Turn Indicator",
                      ph: "Yes",
                    },
                    {
                      name: "ssb_receiver",
                      label: "SSB Receiver",
                      ph: "Yes",
                    },
                    {
                      name: "shortwave_radio",
                      label: "Shortwave Radio",
                      ph: "Yes",
                    },
                    {
                      name: "short_band_transmitter",
                      label: "Short Band Transmitter",
                      ph: "Yes",
                    },
                    {
                      name: "satellite_communication",
                      label: "Satellite Communication",
                      ph: "Yes",
                    },
                    {
                      name: "weatherfax_navtex",
                      label: "Weatherfax / Navtex",
                      ph: "Yes",
                    },
                    {
                      name: "charts_guides",
                      label: "Charts / Guides",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      {isOptionalTriStateField(f.name) ? (
                        <TriStateSelect
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      ) : (
                        <Input
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          placeholder={f.ph}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Safety Equipment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Shield size={20} className="text-blue-600" /> Safety Equipment
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "life_raft",
                      label: "Life Raft",
                      ph: "e.g. Viking 6-person",
                    },
                    {
                      name: "epirb",
                      label: "EPIRB",
                      ph: "e.g. ACR GlobalFix V4",
                    },
                    {
                      name: "bilge_pump",
                      label: "Bilge Pump",
                      ph: "e.g. Rule 2000 GPH",
                    },
                    {
                      name: "bilge_pump_manual",
                      label: "Bilge Pump (Manual)",
                      ph: "Yes",
                    },
                    {
                      name: "bilge_pump_electric",
                      label: "Bilge Pump (Electric)",
                      ph: "Yes",
                    },
                    {
                      name: "fire_extinguisher",
                      label: "Fire Extinguisher",
                      ph: "e.g. 2x ABC 2kg",
                    },
                    {
                      name: "mob_system",
                      label: "MOB System",
                      ph: "e.g. Jonbuoy MK5",
                    },
                    {
                      name: "life_jackets",
                      label: "Life Jackets",
                      ph: "e.g. 6x Spinlock 150N",
                    },
                    {
                      name: "radar_reflector",
                      label: "Radar Reflector",
                      ph: "e.g. Echomax EM230",
                    },
                    { name: "flares", label: "Flares", ph: "e.g. Ikaros set" },
                    {
                      name: "life_buoy",
                      label: "Life Buoy",
                      ph: "Yes",
                    },
                    {
                      name: "watertight_door",
                      label: "Watertight Door",
                      ph: "Yes",
                    },
                    {
                      name: "gas_bottle_locker",
                      label: "Gas Bottle Locker",
                      ph: "Yes",
                    },
                    {
                      name: "self_draining_cockpit",
                      label: "Self Draining Cockpit",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      {isOptionalTriStateField(f.name) ? (
                        <TriStateSelect
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      ) : (
                        <Input
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          placeholder={f.ph}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Electrical System */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Zap size={20} className="text-blue-600" /> Electrical System
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "battery",
                      label: "Batteries",
                      ph: "e.g. 4x 12V 125Ah AGM",
                    },
                    {
                      name: "battery_charger",
                      label: "Battery Charger",
                      ph: "e.g. Victron Blue Smart 30A",
                    },
                    {
                      name: "generator",
                      label: "Generator",
                      ph: "e.g. Onan 9kW",
                    },
                    {
                      name: "inverter",
                      label: "Inverter",
                      ph: "e.g. Victron Phoenix 3000W",
                    },
                    {
                      name: "shorepower",
                      label: "Shorepower",
                      ph: "e.g. 230V 16A",
                    },
                    {
                      name: "solar_panel",
                      label: "Solar Panel",
                      ph: "e.g. 2x 100W flexible",
                    },
                    {
                      name: "wind_generator",
                      label: "Wind Generator",
                      ph: "e.g. Silentwind 400+",
                    },
                    {
                      name: "voltage",
                      label: "Voltage",
                      ph: "e.g. 12V / 230V",
                    },
                    {
                      name: "dynamo",
                      label: "Dynamo",
                      ph: "Yes",
                    },
                    {
                      name: "accumonitor",
                      label: "Accumonitor",
                      ph: "Yes",
                    },
                    {
                      name: "voltmeter",
                      label: "Voltmeter",
                      ph: "Yes",
                    },
                    {
                      name: "shore_power_cable",
                      label: "Shore Power Cable",
                      ph: "Yes",
                    },
                    {
                      name: "consumption_monitor",
                      label: "Consumption Monitor",
                      ph: "Yes",
                    },
                    {
                      name: "control_panel",
                      label: "Control Panel",
                      ph: "Yes",
                    },
                    {
                      name: "fuel_tank_gauge",
                      label: "Fuel Tank Gauge",
                      ph: "Yes",
                    },
                    {
                      name: "tachometer",
                      label: "Tachometer",
                      ph: "Yes",
                    },
                    {
                      name: "oil_pressure_gauge",
                      label: "Oil Pressure Gauge",
                      ph: "Yes",
                    },
                    {
                      name: "temperature_gauge",
                      label: "Temperature Gauge",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      {isOptionalTriStateField(f.name) ? (
                        <TriStateSelect
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      ) : (
                        <Input
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          placeholder={f.ph}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Kitchen & Comfort */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Box size={20} className="text-blue-600" /> Kitchen & Comfort
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "oven",
                      label: "Oven",
                      ph: "e.g. Force 10 gas oven",
                    },
                    {
                      name: "microwave",
                      label: "Microwave",
                      ph: "e.g. Samsung 23L",
                    },
                    {
                      name: "fridge",
                      label: "Fridge",
                      ph: "e.g. Isotherm Cruise 130L",
                    },
                    {
                      name: "freezer",
                      label: "Freezer",
                      ph: "e.g. Isotherm 65L top-loading",
                    },
                    {
                      name: "cooker",
                      label: "Cooker",
                      ph: "e.g. 4-burner gas",
                    },
                    {
                      name: "television",
                      label: "Television",
                      ph: 'e.g. Samsung 32" Smart TV',
                    },
                    {
                      name: "cd_player",
                      label: "Radio / CD Player",
                      ph: "e.g. Fusion MS-RA770",
                    },
                    {
                      name: "dvd_player",
                      label: "DVD Player",
                      ph: "e.g. Sony DVP-SR210P",
                    },
                    {
                      name: "satellite_reception",
                      label: "Satellite Reception",
                      ph: "e.g. KVH TracVision TV5",
                    },
                    {
                      name: "water_tank",
                      label: "Water Tank",
                      ph: "200L",
                    },
                    {
                      name: "water_tank_gauge",
                      label: "Water Tank Gauge",
                      ph: "Yes",
                    },
                    {
                      name: "water_maker",
                      label: "Water Maker",
                      ph: "60 L/h",
                    },
                    {
                      name: "waste_water_tank",
                      label: "Waste Water Tank",
                      ph: "80L",
                    },
                    {
                      name: "waste_water_tank_gauge",
                      label: "Waste Water Gauge",
                      ph: "Yes",
                    },
                    {
                      name: "waste_water_tank_drainpump",
                      label: "Waste Tank Drain Pump",
                      ph: "Yes",
                    },
                    {
                      name: "deck_suction",
                      label: "Deck Suction",
                      ph: "Yes",
                    },
                    {
                      name: "water_system",
                      label: "Water System",
                      ph: "Pressurized",
                    },
                    {
                      name: "hot_water",
                      label: "Hot Water",
                      ph: "Boiler",
                    },
                    {
                      name: "sea_water_pump",
                      label: "Sea Water Pump",
                      ph: "Yes",
                    },
                    {
                      name: "deck_wash_pump",
                      label: "Deck Wash Pump",
                      ph: "Yes",
                    },
                    {
                      name: "deck_shower",
                      label: "Deck Shower",
                      ph: "Yes",
                    },
                    {
                      name: "hot_air",
                      label: "Hot Air Heating",
                      ph: "Yes",
                    },
                    {
                      name: "stove",
                      label: "Stove Heating",
                      ph: "Yes",
                    },
                    {
                      name: "central_heating",
                      label: "Central Heating",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      <Input
                        name={f.name}
                        defaultValue={selectedYacht?.[f.name]}
                        placeholder={f.ph}
                        needsConfirmation={needsConfirm(f.name)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Deck Equipment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Anchor size={20} className="text-blue-600" /> Deck Equipment
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "anchor",
                      label: "Anchor",
                      ph: "e.g. 2x Bruce 25kg + 50m chain",
                    },
                    {
                      name: "bow_thruster",
                      label: "Bow Thruster",
                      ph: "yes / no / unknown",
                    },
                    {
                      name: "anchor_winch",
                      label: "Anchor Winch",
                      ph: "e.g. Lofrans Tigres 1500W",
                    },
                    {
                      name: "spray_hood",
                      label: "Spray Hood",
                      ph: "e.g. Sunbrella fabric",
                    },
                    {
                      name: "bimini",
                      label: "Bimini",
                      ph: "e.g. Stainless frame + canvas",
                    },
                    {
                      name: "swimming_platform",
                      label: "Swimming Platform",
                      ph: "e.g. Teak with ladder",
                    },
                    {
                      name: "swimming_ladder",
                      label: "Swimming Ladder",
                      ph: "e.g. 4-step stainless",
                    },
                    {
                      name: "teak_deck",
                      label: "Teak Deck",
                      ph: "e.g. Burmese teak",
                    },
                    {
                      name: "cockpit_table",
                      label: "Cockpit Table",
                      ph: "e.g. Folding teak",
                    },
                    {
                      name: "dinghy",
                      label: "Dinghy",
                      ph: "e.g. Highfield CL310 RIB",
                    },
                    {
                      name: "trailer",
                      label: "Trailer",
                      ph: "yes / no / unknown",
                    },
                    {
                      name: "covers",
                      label: "Covers",
                      ph: "e.g. Full winter cover",
                    },
                    {
                      name: "fenders",
                      label: "Fenders & Lines",
                      ph: "e.g. 6x Polyform F4",
                    },
                    {
                      name: "anchor_connection",
                      label: "Anchor Connection",
                      ph: "Chain / Rope",
                    },
                    {
                      name: "stern_anchor",
                      label: "Stern Anchor",
                      ph: "Yes",
                    },
                    {
                      name: "spud_pole",
                      label: "Spud Pole",
                      ph: "Yes",
                    },
                    {
                      name: "cockpit_tent",
                      label: "Cockpit Tent",
                      ph: "Yes",
                    },
                    {
                      name: "outdoor_cushions",
                      label: "Outdoor Cushions",
                      ph: "Yes",
                    },
                    {
                      name: "sea_rails",
                      label: "Sea Rails",
                      ph: "Yes",
                    },
                    {
                      name: "pushpit_pullpit",
                      label: "Pushpit / Pullpit",
                      ph: "Yes",
                    },
                    {
                      name: "sail_lowering_system",
                      label: "Sail Lowering System",
                      ph: "Yes",
                    },
                    {
                      name: "crutch",
                      label: "Crutch (Schaar)",
                      ph: "Yes",
                    },
                    {
                      name: "dinghy_brand",
                      label: "Dinghy Brand",
                      ph: "Yes",
                    },
                    {
                      name: "outboard_engine",
                      label: "Outboard Engine",
                      ph: "Yes",
                    },
                    {
                      name: "crane",
                      label: "Crane",
                      ph: "Yes",
                    },
                    {
                      name: "davits",
                      label: "Davits",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      {isOptionalTriStateField(f.name) ? (
                        <TriStateSelect
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      ) : (
                        <Input
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          placeholder={f.ph}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Rigging & Sails */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Wind size={20} className="text-blue-600" /> Rigging & Sails
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "sailplan_type",
                      label: "Sailplan Type",
                      ph: "e.g. Sloop / Cutter / Ketch",
                    },
                    {
                      name: "number_of_masts",
                      label: "Number of Masts",
                      ph: "e.g. 1 / 2",
                    },
                    {
                      name: "spars_material",
                      label: "Spars Material",
                      ph: "e.g. Aluminum / Carbon",
                    },
                    { name: "bowsprit", label: "Bowsprit", ph: "Yes / No" },
                    {
                      name: "standing_rig",
                      label: "Standing Rig",
                      ph: "e.g. SS Wire / Rod",
                    },
                    { name: "main_sail", label: "Main Sail", ph: "Yes / No" },
                    {
                      name: "furling_mainsail",
                      label: "Furling Mainsail",
                      ph: "Yes / No",
                    },
                    { name: "jib", label: "Jib", ph: "Yes / No" },
                    { name: "genoa", label: "Genoa", ph: "Yes / No" },
                    { name: "spinnaker", label: "Spinnaker", ph: "Yes / No" },
                    { name: "gennaker", label: "Gennaker", ph: "Yes / No" },
                    { name: "mizzen", label: "Mizzen", ph: "Yes / No" },
                    { name: "winches", label: "Winches", ph: "Yes" },
                    {
                      name: "electric_winches",
                      label: "Electric Winches",
                      ph: "Yes",
                    },
                    {
                      name: "manual_winches",
                      label: "Manual Winches",
                      ph: "Yes",
                    },
                  ].map((f) => (
                    <div key={f.name} className="space-y-1 group">
                      <Label>{f.label}</Label>
                      {isOptionalTriStateField(f.name) ? (
                        <TriStateSelect
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      ) : (
                        <Input
                          name={f.name}
                          defaultValue={selectedYacht?.[f.name]}
                          placeholder={f.ph}
                          needsConfirmation={needsConfirm(f.name)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Registry & Comments */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <FileText size={20} className="text-blue-600" /> Registry &
                  Comments
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1 group">
                    <Label>Owner{"'s"} Comment</Label>
                    <textarea
                      name="owners_comment"
                      defaultValue={selectedYacht?.owners_comment || ""}
                      placeholder="Any seller notes or comments…"
                      className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>Known Defects</Label>
                    <textarea
                      name="known_defects"
                      defaultValue={selectedYacht?.known_defects || ""}
                      placeholder="Any known issues or defects…"
                      className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>Registration Details</Label>
                    <Input
                      name="reg_details"
                      defaultValue={selectedYacht?.reg_details}
                      placeholder="e.g. NL registration, MMSI 244…"
                      needsConfirmation={needsConfirm("reg_details")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>Last Serviced</Label>
                    <Input
                      name="last_serviced"
                      defaultValue={selectedYacht?.last_serviced}
                      placeholder="e.g. March 2024"
                      needsConfirmation={needsConfirm("last_serviced")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: TEXT (AI Generated) ──────────────── */}
          {
            activeStep === 3 && (
              <>
                <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-8">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Globe size={18} className="text-blue-500" /> Vessel
                      Description
                    </h3>

                    {/* Language Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-sm gap-1">
                      {(["nl", "en", "de"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setSelectedLang(lang)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                            selectedLang === lang
                              ? "bg-white text-[#003566] shadow-sm"
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200",
                          )}
                        >
                          {lang === "nl"
                            ? "🇳🇱 NL"
                            : lang === "en"
                              ? "🇬🇧 EN"
                              : "🇩🇪 DE"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-wrap items-end gap-5">
                      <div className="flex-1 min-w-[150px]">
                        <label className="text-xs font-bold text-slate-500 uppercase block">AI Tone</label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 shadow-sm mt-1 focus:border-blue-500 focus:outline-none"
                          value={aiTone}
                          onChange={(e) => setAiTone(e.target.value)}
                        >
                          <option value="professional">Professional</option>
                          <option value="enthusiastic">Enthusiastic</option>
                          <option value="luxurious">Luxurious</option>
                          <option value="concise">Concise & Direct</option>
                          <option value="storytelling">Storytelling</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="text-xs font-bold text-slate-500 uppercase block">Min Words</label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={aiMinWords}
                          onChange={(e) => setAiMinWords(parseInt(e.target.value) || 200)}
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs font-bold text-slate-500 uppercase block">Max Words</label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={aiMaxWords}
                          onChange={(e) => setAiMaxWords(parseInt(e.target.value) || 500)}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleRegenerateDescription}
                        disabled={isRegenerating}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 mt-1 h-9"
                      >
                        {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Regenerate
                      </Button>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                        {selectedLang === "nl"
                          ? "Nederlandse Beschrijving"
                          : selectedLang === "en"
                            ? "English Description"
                            : "Deutsche Beschreibung"}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleDictation}
                          className={cn("flex items-center justify-center w-8 h-8 rounded-full transition-colors", isDictating ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                          title={isDictating ? "Stop recording" : "Start dictation"}
                        >
                          <div className={cn("w-3 h-3 rounded-full", isDictating ? "bg-red-600" : "bg-slate-600")} />
                        </button>

                        <div className="flex items-center gap-2">
                          <select
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1 max-w-[150px] truncate"
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                          >
                            <option value="">Default Voice</option>
                            {voices.map(v => (
                              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if ('speechSynthesis' in window) {
                                if (window.speechSynthesis.speaking) {
                                  window.speechSynthesis.cancel();
                                  setIsPlayingAudio(false);
                                  return;
                                }

                                const utterance = new SpeechSynthesisUtterance(aiTexts[selectedLang]);
                                if (selectedVoice) {
                                  const voice = voices.find(v => v.name === selectedVoice);
                                  if (voice) utterance.voice = voice;
                                } else {
                                  utterance.lang = selectedLang === 'nl' ? 'nl-NL' : selectedLang === 'en' ? 'en-US' : 'de-DE';
                                }

                                utterance.onend = () => setIsPlayingAudio(false);
                                utterance.onerror = () => setIsPlayingAudio(false);

                                window.speechSynthesis.speak(utterance);
                                setIsPlayingAudio(true);
                              } else {
                                toast.error("Text-to-speech not supported in this browser.");
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors",
                              isPlayingAudio
                                ? "text-red-700 bg-red-50 hover:bg-red-100"
                                : "text-[#003566] bg-blue-50 hover:bg-blue-100"
                            )}
                          >
                            {isPlayingAudio ? (
                              <>
                                <div className="w-2 h-2 bg-red-600 rounded-sm animate-pulse" /> Stop Audio
                              </>
                            ) : (
                              <>
                                <Volume2 size={12} /> Play Audio
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <RichTextEditor
                      content={aiTexts[selectedLang]}
                      onChange={(html) =>
                        setAiTexts((prev) => ({ ...prev, [selectedLang]: html }))
                      }
                      placeholder="Review and edit the AI-generated description here..."
                    />
                  </div>
                </div>
              </>
            )
          }

          {/* ── STEP 4: DISPLAY SETTINGS ─────────────────── */}
          {
            activeStep === 4 && (
              <>
                {/* NEW SECTION: SCHEDULING AUTHORITY */}
                <div className="space-y-8 bg-slate-50 p-10 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                    <h3 className="text-[12px] font-black uppercase text-[#003566] tracking-[0.4em] flex items-center gap-3 italic">
                      <Calendar size={20} className="text-blue-600" /> 04.
                      Scheduling Authority
                    </h3>
                    <Button
                      type="button"
                      onClick={addAvailabilityRule}
                      className="bg-[#003566] text-white text-[8px] font-black uppercase tracking-widest px-6 h-8"
                    >
                      {t?.scheduling?.addWindow || "Add Scheduling Window"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {availabilityRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-6 bg-white p-4 border border-slate-100 shadow-sm relative group"
                      >
                        <div className="flex-1 min-w-[300px]">
                          <Label>Days of Week</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              { val: 1, label: "Mon" },
                              { val: 2, label: "Tue" },
                              { val: 3, label: "Wed" },
                              { val: 4, label: "Thu" },
                              { val: 5, label: "Fri" },
                              { val: 6, label: "Sat" },
                              { val: 0, label: "Sun" },
                            ].map((day) => {
                              const isSelected = rule.days_of_week.includes(day.val);
                              return (
                                <button
                                  key={day.val}
                                  type="button"
                                  onClick={() => {
                                    const newDays = isSelected
                                      ? rule.days_of_week.filter(d => d !== day.val)
                                      : [...rule.days_of_week, day.val].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
                                    updateAvailabilityRule(idx, "days_of_week", newDays);
                                  }}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${isSelected
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                    }`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex-1 min-w-[120px]">
                          <Label>{t?.scheduling?.startTime || "Start Time"}</Label>
                          <div className="flex items-center gap-2 bg-slate-50 p-2 border-b border-slate-200">
                            <Clock size={12} className="text-slate-400" />
                            <input
                              type="time"
                              step="900"
                              value={rule.start_time}
                              onChange={(e) =>
                                updateAvailabilityRule(
                                  idx,
                                  "start_time",
                                  e.target.value,
                                )
                              }
                              className="bg-transparent text-xs font-bold text-[#003566] outline-none w-full"
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-[120px]">
                          <Label>{t?.scheduling?.endTime || "End Time"}</Label>
                          <div className="flex items-center gap-2 bg-slate-50 p-2 border-b border-slate-200">
                            <Clock size={12} className="text-slate-400" />
                            <input
                              type="time"
                              step="900"
                              value={rule.end_time}
                              onChange={(e) =>
                                updateAvailabilityRule(
                                  idx,
                                  "end_time",
                                  e.target.value,
                                )
                              }
                              className="bg-transparent text-xs font-bold text-[#003566] outline-none w-full"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAvailabilityRule(idx)}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    ))}

                    {availabilityRules.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-slate-200 bg-white">
                        <Calendar
                          size={32}
                          className="mx-auto text-slate-200 mb-2"
                        />
                        <p className="text-sm font-semibold text-slate-500">
                          {t?.scheduling?.empty || "No scheduling rules defined yet."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
          }

          {/* ── STEP 5: REVIEW & SAVE ────────────────────── */}
          {
            activeStep === 5 && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
                    <FileText size={18} /> {t?.wizard?.review?.title || "Review"}
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">
                    Review all steps before submitting. Completed steps are marked
                    with a blue checkmark in the tab bar above.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {wizardSteps.slice(0, 4).map((step) => (
                      <div
                        key={step.id}
                        className={cn(
                          "p-4 border flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors",
                          isStepComplete(step.id)
                            ? "border-blue-300 bg-blue-50/50"
                            : "border-orange-300 bg-orange-50/50",
                        )}
                        onClick={() => handleStepChange(step.id)}
                      >
                        <span
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                            isStepComplete(step.id)
                              ? "bg-blue-500 text-white"
                              : "bg-orange-400 text-white",
                          )}
                        >
                          {isStepComplete(step.id) ? (
                            <Check size={14} strokeWidth={3} />
                          ) : (
                            step.id
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            {step.label}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {isStepComplete(step.id)
                              ? t?.wizard?.review?.completed || "Completed"
                              : t?.wizard?.review?.notCompleted || "Pending"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── CHECKLIST & COMPLIANCE ── */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                      <CheckSquare size={16} className="text-blue-600" />
                      Compliance & Documenten
                    </h4>
                    <p className="text-xs text-slate-500 mb-6 max-w-2xl">
                      Hieronder ziet u de benodigde documenten voor dit type schip. U kunt deze nu alvast uploaden, of wachten tot het contract door de klant is getekend.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Checklist Requirements Preview */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Benodigde Documenten</h5>
                        {fetchingChecklist ? (
                          <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={16} className="animate-spin" /> Laden...</div>
                        ) : checklistTemplates.length > 0 ? (
                          <div className="space-y-2">
                            {checklistTemplates.map(template => (
                              <div key={template.id} className="mb-4">
                                <p className="font-semibold text-sm text-slate-800 bg-white border border-slate-200 p-2 rounded-md mb-2">{template.name}</p>
                                <div className="space-y-2 pl-4">
                                  {template.items?.map((item: any) => (
                                    <div key={item.id} className="flex gap-3 text-sm text-slate-600 bg-white p-2 rounded-md border border-slate-100 shadow-sm">
                                      <div className="mt-0.5"><div className="w-4 h-4 rounded border-2 border-slate-300" /></div>
                                      <div>
                                        <p className="font-medium text-slate-700">{item.title}</p>
                                        {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic py-4">Geen specifieke documenten vereist voor dit type.</p>
                        )}
                      </div>

                      {/* Document Upload Area */}
                      <div className="space-y-4">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Upload Documenten</h5>

                        {/* Upload Dropzone */}
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors bg-white",
                          isUploadingDocument ? "border-slate-300 opacity-70" : "border-slate-300 hover:bg-slate-50 hover:border-blue-400"
                        )}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploadingDocument ? (
                              <Loader2 size={24} className="text-blue-500 animate-spin mb-2" />
                            ) : (
                              <UploadCloud size={24} className="text-slate-400 mb-2" />
                            )}
                            <p className="text-sm font-medium text-slate-600">
                              {isUploadingDocument ? "Bezig met uploaden..." : "Klik of sleep een document"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">PDF, DOCX, JPG (Max 10MB)</p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,image/jpeg,image/png"
                            onChange={handleDocumentUpload}
                            disabled={isUploadingDocument}
                          />
                        </label>

                        {/* Uploaded Documents List */}
                        {boatDocuments.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <h6 className="text-xs font-semibold text-slate-700">Reeds Geüpload ({boatDocuments.length})</h6>
                            <div className="space-y-2">
                              {boatDocuments.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText size={16} className="text-blue-500 shrink-0" />
                                    <div className="truncate">
                                      <p className="text-sm font-medium text-slate-700 truncate">{doc.file_path.split('/').pop()}</p>
                                      <p className="text-[10px] text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()} • {doc.file_type?.toUpperCase()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                                      <Eye size={14} />
                                    </a>
                                    <button type="button" onClick={() => handleDocumentDelete(doc.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                      <Trash size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── SIGNHOST INTEGRATION ── */}
                  {activeYachtId && (
                    <div className="mb-8">
                      <SignhostFlow
                        yachtId={Number(activeYachtId)}
                        yachtName={selectedYacht?.boat_name || (draft?.data as any)?.step2?.selectedYacht?.boat_name || "Unnamed Vessel"}
                        locationId={selectedYacht?.ref_harbor_id || (draft?.data as any)?.step2?.selectedYacht?.ref_harbor_id || null}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#003566] text-white hover:bg-blue-800 h-14 font-black uppercase text-[11px] tracking-widest transition-all shadow-xl"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin mr-2 w-5 h-5" />
                    ) : (
                      <Save className="mr-2 w-5 h-5" />
                    )}
                    {isNewMode
                      ? t?.wizard?.review?.create || "Create Vessel"
                      : t?.wizard?.review?.update || "Update Vessel"}
                  </Button>
                </div>
              </div>
            )
          }

          {/* ── STEP NAVIGATION ───────────────────────────── */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200 mt-8">
            <Button
              type="button"
              onClick={() => handleStepChange(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-11 px-6 text-xs font-bold uppercase tracking-wider disabled:opacity-30"
            >
              <ChevronLeft size={16} className="mr-1" /> {t?.wizard?.nav?.previous || "Previous"}
            </Button>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Step {activeStep} of {wizardSteps.length}
            </span>
            {activeStep < 5 ? (
              <Button
                type="button"
                onClick={() => {
                  markStepComplete(activeStep);
                  handleStepChange(activeStep + 1);
                }}
                disabled={isNewMode && !canProceedFromStep1 && activeStep === 1}
                className={cn(
                  "h-11 px-6 text-xs font-bold uppercase tracking-wider",
                  isNewMode && !canProceedFromStep1 && activeStep === 1
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-[#003566] text-white hover:bg-blue-800",
                )}
              >
                {isNewMode && !canProceedFromStep1 && activeStep === 1 ? (
                  <>{t?.wizard?.nav?.runExtractionFirst || "Approve Images First"}</>
                ) : (
                  <>
                    {t?.wizard?.nav?.next || "Next"}{" "}
                    <ChevronRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <div />
            )}
          </div>
        </form >
      </div >

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
        description={t?.video?.confirmDelete || "Are you sure you want to remove this video?"}
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={executeVideoDelete}
      />

      <ConfirmDialog
        open={deleteAllImagesDialogOpen}
        onOpenChange={setDeleteAllImagesDialogOpen}
        title="Delete all images"
        description="Are you sure you want to remove all uploaded images from this yacht? This action cannot be undone."
        confirmText={isDeletingAllImages ? "Deleting..." : "Delete all"}
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteAllImages}
      />
    </div >
  );
}

// ---------------- Helper Components ---------------- //

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[13px] font-medium text-slate-700 mb-1.5 block group-hover:text-blue-600 transition-colors">
      {children}
    </label>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    needsConfirmation?: boolean;
    confidence?: number;
  },
) {
  const { needsConfirmation, confidence, ...inputProps } = props;
  return (
    <div className="relative">
      <input
        {...inputProps}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          "placeholder:text-slate-400 placeholder:font-normal",
          needsConfirmation
            ? "border-amber-300 bg-amber-50/50"
            : "border-slate-200",
          inputProps.className,
        )}
      />
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ confirm
        </span>
      )}
    </div>
  );
}

function TriStateSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    needsConfirmation?: boolean;
  },
) {
  const { needsConfirmation, defaultValue, ...selectProps } = props;
  const normalizedDefault = normalizeTriStateValue(defaultValue);

  return (
    <div className="relative">
      <select
        {...selectProps}
        defaultValue={normalizedDefault}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          needsConfirmation ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          selectProps.className,
        )}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="unknown">Unknown</option>
      </select>
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ confirm
        </span>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    </div>
  );
}

// Task 5: mouseover on a record (e.g. FLYBRIDGE) shows the image where AI found this
function AiEvidenceHover({
  field,
  evidence,
  children,
  label,
}: {
  field: string;
  evidence: { imageUrl: string; confidence?: number } | undefined;
  children: React.ReactNode;
  label: string;
}) {
  const [show, setShow] = useState(false);
  if (!evidence?.imageUrl) return <>{children}</>;
  return (
    <div
      className="relative inline-block w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full top-0 z-50 ml-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <p className="text-[9px] font-black uppercase text-slate-600 mb-1.5">
            AI evidence – {label}
            {evidence.confidence != null && ` (${evidence.confidence}%)`}
          </p>
          <img
            src={evidence.imageUrl}
            alt="AI source"
            className="w-full aspect-video object-cover rounded border border-slate-100"
          />
        </div>
      )}
      <span className="absolute top-1 right-1 rounded bg-[#003566] text-white text-[7px] font-bold px-1.5 py-0.5">
        AI
      </span>
    </div>
  );
}
