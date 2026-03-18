"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  SyntheticEvent,
  useMemo,
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
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";

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
import { FieldHistoryPopover } from "@/components/yachts/FieldHistoryPopover";
import {
  FieldCorrectionControls,
  CorrectionLabel,
} from "@/components/yachts/FieldCorrectionControls";

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

const DRAFT_KEY_PREFIX = "yacht_draft_";
const MAX_IMAGES_UPLOAD = 50;
const UPLOAD_BATCH_SIZE = 10;
const UPLOAD_MAX_PARALLEL_BATCHES = 2;

// Configuration
const STORAGE_URL = "https://app.schepen-kring.nl/storage/";
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=600&q=80";

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

// Availability Rule Type
type AvailabilityRule = {
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

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
      stepBrokerReview: "Broker Review",
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
        "Your vessel has been submitted for broker review. A broker will contact you and send the Signhost contract when everything is ready.",
      clientReviewStatusTitle: "Submitted for Review",
      clientReviewStatusDescription:
        "This vessel is now waiting for broker review. The contract is not shown to clients at this stage.",
      pendingBrokerReview: "Pending broker review",
      saveVesselFirst: "Save Vessel First",
      imageCountLabel: "Images",
      processingBadge: "processing",
      readyForReviewBadge: "ready for review",
      approvedBadge: "approved",
      savingOrder: "Saving order...",
      aiAutoSort: "AI auto-sort",
      addMoreImages: "Add More",
      deleteAllImages: "Delete all images",
      clickToAddImages: "Click to add up to {count} images",
      uploadingImages: "Uploading images...",
      uploadAreaPendingHelp:
        "This area stays visible until the current upload finishes.",
      uploadAreaFormatsHelp: "JPEG, PNG, HEIC auto-optimized by AI",
      uploadAreaHint: "Include HIN plates, docs, registration, engine hours",
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
        "AI is ready to analyze {count} approved optimized images",
      uploadApproveImagesFirstAi:
        "Upload and approve images first, then AI will analyze them",
      runAiExtractionManually: "Run AI Extraction Manually",
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
      locationRequiredForNextStep:
        "Select a sales location before continuing to the next step.",
      noSpecificDocumentsRequired:
        "No specific documents required for this type.",
      uploadDocuments: "Upload Documents",
      documentUploading: "Uploading...",
      clickOrDropDocument: "Click or drag a document",
      uploadedDocuments: "Already uploaded ({count})",
      deleteAllImagesTitle: "Delete all images",
      deleteAllImagesDescription:
        "Are you sure you want to remove all uploaded images from this yacht? This action cannot be undone.",
      deletingAllImages: "Deleting...",
      deleteAllAction: "Delete all",
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
        "Step 2 opens after image approval. AI extraction continues in background and fills fields when ready.",
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
      harborLocation: "Sales Location (Harbor) *",
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
      stepBrokerReview: "Brokercontrole",
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
      submitForBrokerReview: "Indienen voor brokercontrole",
      finishFlow: "Afronden",
      finishFlowToast: "Vaartuigflow voltooid.",
      contractStepDescription:
        "Beheer het contractsjabloon, druk de PDF af en genereer vanuit deze stap het Signhost-klare contract.",
      reviewContractNotice:
        "Sla dit vaartuig eerst op. De contractflow opent in de volgende stap zodra het vaartuigrecord is opgeslagen.",
      clientReviewStepDescription:
        "Je vaartuig is ingediend voor brokercontrole. Een broker neemt contact op en stuurt het Signhost-contract zodra alles klaar is.",
      clientReviewStatusTitle: "Ingediend voor controle",
      clientReviewStatusDescription:
        "Dit vaartuig wacht nu op brokercontrole. Het contract wordt in deze fase niet aan klanten getoond.",
      pendingBrokerReview: "Wacht op brokercontrole",
      saveVesselFirst: "Sla eerst het vaartuig op",
      imageCountLabel: "Afbeeldingen",
      processingBadge: "in verwerking",
      readyForReviewBadge: "klaar voor controle",
      approvedBadge: "goedgekeurd",
      savingOrder: "Volgorde opslaan...",
      aiAutoSort: "AI automatisch sorteren",
      addMoreImages: "Meer toevoegen",
      deleteAllImages: "Alle afbeeldingen verwijderen",
      clickToAddImages: "Klik om maximaal {count} afbeeldingen toe te voegen",
      uploadingImages: "Afbeeldingen uploaden...",
      uploadAreaPendingHelp:
        "Dit vlak blijft zichtbaar totdat de huidige upload klaar is.",
      uploadAreaFormatsHelp:
        "JPEG, PNG, HEIC worden automatisch door AI geoptimaliseerd",
      uploadAreaHint:
        "Voeg HIN-plaatjes, documenten, registratie en motoruren toe",
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
        "AI staat klaar om {count} goedgekeurde geoptimaliseerde afbeeldingen te analyseren",
      uploadApproveImagesFirstAi:
        "Upload en keur eerst afbeeldingen goed, daarna analyseert AI ze",
      runAiExtractionManually: "Voer AI-extractie handmatig uit",
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
      locationRequiredForNextStep:
        "Selecteer eerst een verkooplocatie voordat je doorgaat naar de volgende stap.",
      noSpecificDocumentsRequired:
        "Geen specifieke documenten vereist voor dit type.",
      uploadDocuments: "Documenten uploaden",
      documentUploading: "Bezig met uploaden...",
      clickOrDropDocument: "Klik of sleep een document",
      uploadedDocuments: "Al geüpload ({count})",
      deleteAllImagesTitle: "Alle afbeeldingen verwijderen",
      deleteAllImagesDescription:
        "Weet je zeker dat je alle geüploade afbeeldingen van dit jacht wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.",
      deletingAllImages: "Verwijderen...",
      deleteAllAction: "Alles verwijderen",
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
      harborLocation: "Verkooplocatie (haven) *",
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
      kitchenComfort: "Kuche und Komfort",
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
      stepBrokerReview: "Broker-Prufung",
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
        "Ihr Schiff wurde zur Broker-Prufung eingereicht. Ein Broker wird Sie kontaktieren und den Signhost-Vertrag senden, sobald alles bereit ist.",
      clientReviewStatusTitle: "Zur Prufung eingereicht",
      clientReviewStatusDescription:
        "Dieses Schiff wartet nun auf die Broker-Prufung. Der Vertrag wird Kunden in dieser Phase nicht angezeigt.",
      pendingBrokerReview: "Wartet auf Broker-Prufung",
      saveVesselFirst: "Schiff zuerst speichern",
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
        "Fügen Sie HIN-Schilder, Dokumente, Registrierung und Motorstunden hinzu",
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
        "Die KI ist bereit, {count} freigegebene optimierte Bilder zu analysieren",
      uploadApproveImagesFirstAi:
        "Lade zuerst Bilder hoch und gib sie frei, dann analysiert die KI sie",
      runAiExtractionManually: "KI-Extraktion manuell ausführen",
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
      locationRequiredForNextStep:
        "Wählen Sie einen Verkaufsstandort, bevor Sie mit dem nächsten Schritt fortfahren.",
      noSpecificDocumentsRequired:
        "Für diesen Typ sind keine speziellen Dokumente erforderlich.",
      uploadDocuments: "Dokumente hochladen",
      documentUploading: "Wird hochgeladen...",
      clickOrDropDocument: "Klicken oder ziehen Sie ein Dokument hierher",
      uploadedDocuments: "Bereits hochgeladen ({count})",
      deleteAllImagesTitle: "Alle Bilder löschen",
      deleteAllImagesDescription:
        "Möchten Sie wirklich alle hochgeladenen Bilder von dieser Yacht entfernen? Diese Aktion kann nicht rückgängig gemacht werden.",
      deletingAllImages: "Löschen...",
      deleteAllAction: "Alle löschen",
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
      harborLocation: "Verkaufsstandort (Hafen) *",
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
      electricalSystem: "Systeme electrique",
      kitchenComfort: "Cuisine et confort",
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
      stepBrokerReview: "Revision du courtier",
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
        "Votre bateau a ete soumis a la revision du courtier. Un courtier vous contactera et enverra le contrat Signhost lorsque tout sera pret.",
      clientReviewStatusTitle: "Soumis pour revision",
      clientReviewStatusDescription:
        "Ce bateau attend maintenant la revision du courtier. Le contrat n'est pas affiche aux clients a ce stade.",
      pendingBrokerReview: "En attente de revision du courtier",
      saveVesselFirst: "Enregistrer d'abord le bateau",
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
        "Ajoutez plaques HIN, documents, immatriculation et heures moteur",
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
        "L'IA est prete a analyser {count} images optimisees approuvees",
      uploadApproveImagesFirstAi:
        "Telechargez et approuvez d'abord les images, puis l'IA les analysera",
      runAiExtractionManually: "Lancer l'extraction IA manuellement",
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
      locationRequiredForNextStep:
        "Selectionnez un lieu de vente avant de passer a l'etape suivante.",
      noSpecificDocumentsRequired:
        "Aucun document specifique requis pour ce type.",
      uploadDocuments: "Telecharger des documents",
      documentUploading: "Telechargement...",
      clickOrDropDocument: "Cliquez ou glissez un document",
      uploadedDocuments: "Deja telecharges ({count})",
      deleteAllImagesTitle: "Supprimer toutes les images",
      deleteAllImagesDescription:
        "Voulez-vous vraiment supprimer toutes les images telechargees de ce yacht ? Cette action est irreversible.",
      deletingAllImages: "Suppression...",
      deleteAllAction: "Tout supprimer",
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
      harborLocation: "Lieu de vente (port) *",
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

export default function YachtEditorPage() {
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
    },
    fr: {
      select: "Selectionner...",
      selectLocation: "Selectionner le port...",
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
      minBidAmount: "Wird automatisch mit 90 % des Preises berechnet, wenn leer",
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
  const yachtFormText =
    YACHT_FORM_TEXT[locale as keyof typeof YACHT_FORM_TEXT] ?? YACHT_FORM_TEXT.en;
  const step2CommonText =
    step2CommonTextByLocale[locale as keyof typeof step2CommonTextByLocale] ??
    step2CommonTextByLocale.en;
  const step2PlaceholderText =
    step2PlaceholderByLocale[locale as keyof typeof step2PlaceholderByLocale] ??
    step2PlaceholderByLocale.en;
  const labelText = (key: keyof typeof yachtFormText.labels, fallback: string) =>
    t?.labels?.[key] || yachtFormText.labels[key] || fallback;
  const placeholderText = (
    key: keyof typeof yachtFormText.placeholders,
    fallback: string,
  ) => t?.placeholders?.[key] || yachtFormText.placeholders[key] || fallback;
  const commonText = (
    key: keyof typeof step2CommonText,
    fallback: string,
  ) => t?.common?.[key] || step2CommonText[key] || fallback;
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
  } = useYachtDraft(yachtId as string);

  // Form State
  const [selectedYacht, setSelectedYacht] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(!isNewMode);
  const [errors, setErrors] = useState<any>(null);

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
  const isPersistedYachtRoute =
    !isNewMode && typeof yachtId === "string" && /^[0-9]+$/.test(yachtId);

  // Gemini Extraction State (Step 1)
  const [isExtracting, setIsExtracting] = useState(false);

  const pipeline = useImagePipeline(activeYachtId, {
    pausePolling: isExtracting,
  });
  const imagesApproved = pipeline.isStep2Unlocked;
  const [reviewImages, setReviewImages] = useState<ReviewPipelineImage[]>([]);
  const [pendingUploadPreviews, setPendingUploadPreviews] = useState<
    ReviewPipelineImage[]
  >([]);

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

        setMarketingVideos(
          payload.filter(
            (video: any) =>
              Number(video?.yacht_id ?? video?.boat_id) ===
              Number(targetYachtId),
          ),
        );
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
      ["queued", "processing", "pending", "rendering"].includes(
        String(video?.status || "").toLowerCase(),
      ),
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

  // Legacy staging for non-image features (Main Profile etc)
  const [aiStaging, setAiStaging] = useState<AiStagedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const hasInFlightImageUploads = isUploading || pipeline.isUploading;
  const hasSelectedHarbor = hasFilledFieldValue(selectedYacht?.ref_harbor_id);
  const persistedPipelineImages = useMemo(
    () => pipeline.images.filter((image) => image.id > 0),
    [pipeline.images],
  );
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
  const displayTotalImageCount =
    persistedPipelineImages.length + pendingUploadPreviews.length;
  const shouldShowImageUploadDropzone =
    reviewImages.length === 0 || hasInFlightImageUploads;
  const shouldShowImageGrid = reviewImages.length > 0;

  // AI Pipeline State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (suppressCreationToasts) {
      hotToast.dismiss();
    }
  }, [suppressCreationToasts]);

  // Gemini Extraction State (Step 1)
  const [boatHint, setBoatHint] = useState("");
  const [geminiExtracted, setGeminiExtracted] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
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
  const [confidenceMeta, setConfidenceMeta] = useState<ConfidenceMeta | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem(`yacht_ai_meta_${yachtId}`);
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
    const key = `yacht_ai_meta_${yachtId}`;
    if (confidenceMeta) {
      localStorage.setItem(key, JSON.stringify(confidenceMeta));
    }
  }, [confidenceMeta, yachtId]);

  // New AI UI Feedback States
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [extractionCountdown, setExtractionCountdown] = useState(60);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Harbors
  const [harbors, setHarbors] = useState<any[]>([]);
  const [isHarborsLoading, setIsHarborsLoading] = useState(false);
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
          const key = image.original_name || "";
          pipelineCounts.set(key, (pipelineCounts.get(key) || 0) + 1);
        });

      const nextPending: ReviewPipelineImage[] = [];
      previous.forEach((image) => {
        const key = image.original_name || "";
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
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] =
    useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<number | null>(null);

  // Fetch Checklist Templates & Documents for Step 5
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
  }, [
    activeStep,
    selectedYacht?.boat_type_id,
    (draft?.data as any)?.boat_type_id,
    isNewMode,
    createdYachtId,
    yachtId,
  ]);

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
          setSelectedYacht((prev: any) => ({
            ...prev,
            ref_harbor_id: list[0].id,
          }));
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
  const lastServerDraftSnapshotRef = useRef<string | null>(null);
  const syncingServerDraftRef = useRef(false);
  const serverSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const serverDraftInitializedRef = useRef(false);
  const serverDraftBootstrapInFlightRef = useRef(false);
  const localPreviewUrlsRef = useRef<Set<string>>(new Set());

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
    const completedKey = `yacht_draft_completed_${yachtId}`;
    if (localStorage.getItem(completedKey)) {
      void clearDraft();
      localStorage.removeItem(completedKey);
      localStorage.removeItem(`yacht_ai_meta_${yachtId}`);
      restoredDraftRef.current = true;
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
  }, [isDraftLoaded, isNewMode, getStepData]);

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
      pipeline.images
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
  }, [pipeline.images]);

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

  // Auto-save current step data when switching tabs
  const handleStepChange = useCallback(
    (newStep: number) => {
      // OFFLINE: allow skipping to any step (no server gating)
      if (!isOnline) {
        if (
          newStep > 1 &&
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
      if (newStep > 2 && !hasSelectedHarbor) {
        toast.error(
          labelText(
            "locationRequiredForNextStep",
            "Select a sales location before continuing to the next step.",
          ),
        );
        return;
      }
      setActiveStep(newStep);
    },
    [
      isOnline,
      isNewMode,
      canProceedFromStep1,
      hasSelectedHarbor,
      offlineImages,
      pipeline.images.length,
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

        // Fetch Boat Videos (Endpoint currently missing/obsolete)
        // try {
        //   const videoRes = await api.get(`/yachts/${yachtId}/boat-videos`);
        //   setBoatVideos(videoRes.data);
        // } catch (e) {
        //   console.error("Failed to fetch boat videos", e);
        // }

        await loadMarketingVideos(yachtId);

        // Load existing availability rules
        if (yacht.availability_rules || yacht.availabilityRules) {
          const rawRules = yacht.availability_rules || yacht.availabilityRules;
          // Condense individual rules back into grouped day arrays
          const groupedRules: AvailabilityRule[] = [];

          rawRules.forEach((rule: any) => {
            const existingGroup = groupedRules.find(
              (g) =>
                g.start_time === rule.start_time &&
                g.end_time === rule.end_time,
            );

            if (existingGroup) {
              if (!existingGroup.days_of_week.includes(rule.day_of_week)) {
                existingGroup.days_of_week.push(rule.day_of_week);
                // Optional: Sort days 1=Mon, 0=Sun (placed at end)
                existingGroup.days_of_week.sort(
                  (a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b),
                );
              }
            } else {
              groupedRules.push({
                days_of_week: [rule.day_of_week],
                start_time: rule.start_time,
                end_time: rule.end_time,
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
      setBoatVideos((prev) => [res.data, ...prev]);
      toast.success(t?.video?.uploaded || "Video uploaded successfully");
    } catch (err) {
      toast.error(t?.video?.uploadFailed || "Video upload failed");
    } finally {
      setIsUploadingVideo(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleGenerateMarketingVideo = async (force = false) => {
    let targetId = isNewMode ? createdYachtId : yachtId;
    if (isNewMode && !targetId) {
      const loadingToastId = toast.loading("Creating vessel draft...");
      try {
        const fd = new FormData();
        fd.append("status", "draft");
        const createRes = await api.post("/yachts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        targetId = createRes.data.id;
        setCreatedYachtId(targetId as number);
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

    setIsGeneratingMarketingVideo(true);
    try {
      const response = await api.post("/social/videos/generate", {
        yacht_id: Number(targetId),
        template_type: "vertical_slideshow_v1",
        force,
      });

      const queuedCount = response.data?.renderable_image_count;
      const message =
        typeof queuedCount === "number"
          ? `Video queued with ${queuedCount} renderable image(s).`
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
  };

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

  // Document Handlers (Step 5)
  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let targetId = isNewMode ? createdYachtId : yachtId;
    if (isNewMode && !targetId) {
      const loadingToastId = toast.loading(
        "Creating vessel draft for document upload...",
      );
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
      setBoatDocuments((prev) => [...prev, res.data]);
      toast.success("Document uploaded successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Document upload failed");
    } finally {
      setIsUploadingDocument(false);
      if (e.target) e.target.value = "";
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

  const handleImageError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
    e.currentTarget.classList.add("opacity-50", "grayscale");
  };

  const getPipelineImageSrc = (image: PipelineImage) =>
    image.thumb_full_url ||
    image.optimized_url ||
    image.full_url ||
    image.client_preview_url ||
    image.url ||
    image.original_temp_url ||
    PLACEHOLDER_IMAGE;

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
    // Check max limit (30)
    if (pipeline.stats.total + files.length > MAX_IMAGES_UPLOAD) {
      toast.error(`Maximum ${MAX_IMAGES_UPLOAD} images allowed per batch.`);
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
      const optimisticImages: ReviewPipelineImage[] = fileArray.map(
        (file, index) => {
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
        },
      );

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
              count: responseImages.length || batchFiles.length,
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
          const key = image.original_name || "";
          uploadedCountsByName.set(
            key,
            (uploadedCountsByName.get(key) || 0) + 1,
          );
        });

        setPendingUploadPreviews((previous) =>
          previous.filter((image) => {
            const key = image.original_name || "";
            const availableCount = uploadedCountsByName.get(key) || 0;
            if (availableCount > 0) {
              uploadedCountsByName.set(key, availableCount - 1);
              return false;
            }
            return true;
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
  const needsConfirm = (fieldName: string) =>
    confidenceMeta?.needs_user_confirmation?.includes(fieldName) ?? false;
  const isOptionalTriStateField = (fieldName: string) =>
    (OPTIONAL_TRI_STATE_FIELDS as readonly string[]).includes(fieldName);

  // ── AI Fill Pipeline ──
  const handleAiExtract = async (options?: {
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
    if (pipeline.images.length === 0) {
      toast.error(
        labelText(
          "uploadOneImageFirst",
          "Please upload at least one image first.",
        ),
      );
      return false;
    }

    setExtractionType("gemini");
    setIsExtracting(true);
    if (!background) {
      setShowExtractModal(true);
    }
    // const toastId = toast.loading(
    //   background
    //     ? labelText(
    //         "aiExtractionStartedBackground",
    //         "🤖 AI extraction started in background...",
    //       )
    //     : labelText(
    //         "aiPipelineAnalyzingImages",
    //         "🤖 AI Pipeline is analyzing your images...",
    //       ),
    // );

    // ── Start Progress & Countdown ──
    setExtractionProgress(5);
    setExtractionCountdown(60);
    setExtractionStatus(
      labelText(
        "connectingGeminiVisionApi",
        "Connecting to Gemini Vision API...",
      ),
    );

    progressIntervalRef.current = setInterval(() => {
      setExtractionProgress((prev) => {
        if (prev >= 95) return prev;
        // Slow down as we approach the end
        const step = prev < 40 ? 4 : prev < 70 ? 2 : 1;
        const next = prev + step;

        // Update status messages based on progress
        if (next < 25)
          setExtractionStatus(
            labelText(
              "analyzingVesselImagesGemini",
              "Analyzing vessel images with Gemini Vision...",
            ),
          );
        else if (next < 50)
          setExtractionStatus(
            labelText(
              "searchingCatalogMatchingModels",
              "Searching catalog for matching models...",
            ),
          );
        else if (next < 80)
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

        return next;
      });
    }, 1500);

    countdownIntervalRef.current = setInterval(() => {
      setExtractionCountdown((prev) => (prev > 1 ? prev - 1 : 1));
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
        const formValues = responseData.step2_form_values;
        const meta = responseData.meta;

        // ── Sanitize: strip ALL "unknown" values from AI response ──
        // AI models sometimes ignore prompt instructions. This guarantees
        // "unknown" never appears in any form field.
        for (const key of Object.keys(formValues)) {
          if (
            typeof formValues[key] === "string" &&
            formValues[key].toLowerCase().trim() === "unknown"
          ) {
            formValues[key] = "";
          }
        }

        const normalizedFormValues: Record<string, unknown> = {
          ...toObjectRecord(formValues),
        };

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
                value !== null &&
                value !== undefined &&
                value !== ""
              ) {
                normalizedFormValues[field] = value;
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
              ? "unknown"
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
          setAiTexts((prev) => ({
            ...prev,
            de: formValues.short_description_de,
          }));
        }
        if (formValues.short_description_fr) {
          setAiTexts((prev) => ({
            ...prev,
            fr: formValues.short_description_fr,
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
      setExtractionProgress(0);
    }
  };

  const handleRegenerateDescription = useCallback(
    async (options?: {
      silent?: boolean;
      signature?: string;
      formValuesOverride?: Record<string, DescriptionFormValue>;
    }) => {
      const targetId = isNewMode ? createdYachtId : yachtId;
      if (!targetId) {
        toast.error("Please save the yacht first before regenerating text.");
        return;
      }

      const requestFormValues =
        options?.formValuesOverride || descriptionFormValues;
      const toastId = options?.silent
        ? null
        : toast.loading("🪄 Building broker-grade descriptions...");
      const requestSignature =
        options?.signature ||
        buildDescriptionRequestSignature(
          requestFormValues,
          aiTone,
          aiMinWords,
          aiMaxWords,
        );

      setIsRegenerating(true);

      try {
        const res = await api.post("/ai/generate-description", {
          yacht_id: targetId,
          tone: aiTone,
          min_words: aiMinWords || 200,
          max_words: aiMaxWords || 500,
          form_values: requestFormValues,
        });

        if (res.data?.success && res.data?.descriptions) {
          setAiTexts({
            en: res.data.descriptions.en || "",
            nl: res.data.descriptions.nl || "",
            de: res.data.descriptions.de || "",
            fr: res.data.descriptions.fr || "",
          });
          lastDescriptionRequestSignatureRef.current = requestSignature;
          if (toastId) {
            toast.success("Descriptions updated from step 2 data.", {
              id: toastId,
            });
          }
        } else {
          throw new Error("Failed to generate descriptions.");
        }
      } catch (e: any) {
        console.error(e);
        if (toastId) {
          toast.error(
            e?.response?.data?.error || "Failed to regenerate text.",
            {
              id: toastId,
            },
          );
        }
      } finally {
        setIsRegenerating(false);
      }
    },
    [
      isNewMode,
      createdYachtId,
      yachtId,
      aiTone,
      aiMinWords,
      aiMaxWords,
      descriptionFormValues,
      toast,
    ],
  );

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
    setAvailabilityRules([
      ...availabilityRules,
      {
        days_of_week: [],
        start_time: harborDefaults?.opening_hours_start || "09:00",
        end_time: harborDefaults?.opening_hours_end || "17:00",
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
    if (aiTexts.en?.trim())
      formData.set("short_description_en", aiTexts.en.trim());
    if (aiTexts.nl?.trim())
      formData.set("short_description_nl", aiTexts.nl.trim());
    if (aiTexts.de?.trim())
      formData.set("short_description_de", aiTexts.de.trim());
    if (aiTexts.fr?.trim())
      formData.set("short_description_fr", aiTexts.fr.trim());

    // Add availability rules
    if (availabilityRules.length > 0) {
      // Expand multiselect arrays back into individual daily rules for backend
      const expandedRules: any[] = [];
      availabilityRules.forEach((ruleGroup) => {
        ruleGroup.days_of_week.forEach((day) => {
          expandedRules.push({
            day_of_week: day,
            start_time: ruleGroup.start_time,
            end_time: ruleGroup.end_time,
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
          },
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
        localStorage.setItem(`yacht_draft_completed_${yachtId}`, "1");
        localStorage.removeItem(`yacht_ai_meta_${yachtId}`);
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
          {wizardSteps.map((step, index) => {
            const isActive = activeStep === step.id;
            const isCompleted =
              !isNewMode ||
              step.id < activeStep ||
              (activeStep === wizardSteps.length &&
                step.id === wizardSteps.length);
            const isPast = isActive || isCompleted;
            const isLocked =
              (!canProceedFromStep1 && step.id > 1) ||
              (isExtracting && step.id > 1) ||
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
                  {isCompleted ? <Check size={20} strokeWidth={3} /> : step.id}
                </button>
                {index < wizardSteps.length - 1 && (
                  <div
                    className={`w-[60px] sm:w-[80px] md:w-[100px] h-[3px] transition-all duration-300 ${
                      step.id < activeStep ? "bg-[#2563eb]" : "bg-[#d4d8de]"
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
              Step {activeStep} of {wizardSteps.length} &middot;{" "}
              {wizardSteps[activeStep - 1]?.label}
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6 lg:p-12 pt-16">
        <form
          onSubmit={handleSubmit}
          onChange={handleFormChange}
          className="space-y-16"
        >
          {/* ERROR SUMMARY */}
          {errors && (
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

          {/* ── STEP 1: IMAGES + AI EXTRACTION ─────────────────── */}
          {activeStep === 1 && (
            <>
              <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#003566] flex items-center gap-3">
                      <Images size={22} className="text-blue-600" />{" "}
                      {labelText(
                        "stepOneTitle",
                        "Vessel Assets & AI Extraction",
                      )}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {labelText(
                        "stepOneDescription",
                        "Upload images -> system auto-optimizes -> approve -> then AI fills all form fields.",
                      )}
                    </p>
                  </div>
                  {imagesApproved && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-2 rounded-lg">
                      <CheckCircle size={14} />{" "}
                      {labelText("imagesApproved", "Images Approved")}
                    </div>
                  )}
                </div>

                {/* ── Description Field ── */}
                <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" />
                    {labelText(
                      "vesselDescriptionHelp",
                      "Vessel Description",
                    )}{" "}
                    <span className="text-slate-400 font-normal">
                      {labelText(
                        "optionalRecommended",
                        "(optional but recommended)",
                      )}
                    </span>
                  </label>
                  <textarea
                    value={boatHint}
                    onChange={(e) => setBoatHint(e.target.value)}
                    placeholder={labelText(
                      "vesselDescriptionPlaceholder",
                      'Brand/Model/Year + short notes (e.g. "Beneteau Oceanis 38, 2016, diesel, 3 cabins, VAT paid, CE docs available")',
                    )}
                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none transition-all"
                    disabled={isExtracting}
                  />
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Sparkles size={10} />{" "}
                    {labelText(
                      "vesselDescriptionAccuracyHint",
                      "Adding brand/model/year dramatically improves AI accuracy.",
                    )}
                  </p>
                </div>

                {/* ── Image Upload & Pipeline Grid ── */}
                {shouldShowImageUploadDropzone && (
                  <label
                    className={cn(
                      "h-64 lg:h-80 bg-white border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all group",
                      hasInFlightImageUploads
                        ? "border-blue-400 bg-blue-50/40 cursor-wait"
                        : "border-slate-300 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50",
                    )}
                  >
                    {hasInFlightImageUploads ? (
                      <Loader2
                        size={48}
                        className="text-blue-400 mb-4 animate-spin"
                      />
                    ) : (
                      <Upload
                        size={48}
                        className="text-slate-200 group-hover:text-blue-400 mb-4 transition-colors"
                      />
                    )}
                    <p
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        hasInFlightImageUploads
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-blue-600",
                      )}
                    >
                      {hasInFlightImageUploads
                        ? labelText("uploadingImages", "Uploading images...")
                        : labelText(
                            "clickToAddImages",
                            `Click to add up to ${MAX_IMAGES_UPLOAD} images`,
                          ).replace("{count}", String(MAX_IMAGES_UPLOAD))}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {hasInFlightImageUploads
                        ? labelText(
                            "uploadAreaPendingHelp",
                            "This area stays visible until the current upload finishes.",
                          )
                        : labelText(
                            "uploadAreaFormatsHelp",
                            "JPEG, PNG, HEIC auto-optimized by AI",
                          )}
                    </p>
                    <p className="text-xs text-blue-500 mt-1 font-medium">
                      {labelText(
                        "uploadAreaHint",
                        "Include HIN plates, docs, registration, engine hours",
                      )}
                    </p>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={hasInFlightImageUploads}
                    />
                  </label>
                )}
                {shouldShowImageGrid && (
                  <div className="space-y-4">
                    {/* Stats bar */}
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap items-center gap-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {`${displayTotalImageCount} ${labelText("imageCountLabel", "Images")}`}
                        </p>
                        {displayTotalImageCount > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                            {displayProcessingCount > 0 && (
                              <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full flex items-center gap-2 min-h-10">
                                <Loader2 size={12} className="animate-spin" />{" "}
                                {displayProcessingCount}{" "}
                                {labelText("processingBadge", "processing")}
                              </span>
                            )}
                            {displayReadyForReviewCount > 0 && (
                              <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full min-h-10 inline-flex items-center">
                                {displayReadyForReviewCount}{" "}
                                {labelText(
                                  "readyForReviewBadge",
                                  "ready for review",
                                )}
                              </span>
                            )}
                            {displayApprovedCount > 0 && (
                              <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full min-h-10 inline-flex items-center">
                                ✓ {displayApprovedCount}{" "}
                                {labelText("approvedBadge", "approved")}
                              </span>
                            )}
                            {isReorderingImages && (
                              <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full min-h-10 inline-flex items-center">
                                {labelText("savingOrder", "Saving order...")}
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
                            title={labelText(
                              "fourImagesPerRow",
                              "4 images per row",
                            )}
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
                            title={labelText(
                              "sixImagesPerRow",
                              "6 images per row",
                            )}
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
                            title={labelText(
                              "eightImagesPerRow",
                              "8 images per row",
                            )}
                          >
                            8
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleAutoSortImages()}
                          disabled={
                            isAutoSortingImages || reviewImages.length === 0
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
                        >
                          {isAutoSortingImages ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Wand2 size={12} />
                          )}
                          {labelText("aiAutoSort", "AI auto-sort")}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteAllImagesDialogOpen(true)}
                          disabled={
                            reviewImages.length === 0 || isDeletingAllImages
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
                          title={labelText(
                            "deleteAllImages",
                            "Delete all images",
                          )}
                        >
                          {isDeletingAllImages ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash size={12} />
                          )}
                        </button>

                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                          <Upload size={12} />{" "}
                          {labelText("addMoreImages", "Add More")}
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={hasInFlightImageUploads}
                          />
                        </label>
                      </div>
                    </div>

                    {/* ── Pipeline Image Grid ── */}
                    <DragDropContext onDragEnd={handlePipelineDragEnd}>
                      <Droppable
                        droppableId="pipeline-image-grid"
                        direction="horizontal"
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn("grid gap-4", gridClassName)}
                          >
                            {reviewImages.map(
                              (img: PipelineImage, index: number) => {
                                const statusConfig: Record<
                                  string,
                                  { bg: string; text: string; label: string }
                                > = {
                                  processing: {
                                    bg: "bg-blue-500",
                                    text: "text-white",
                                    label: `⏳ ${labelText("processingStatusLabel", "Processing...")}`,
                                  },
                                  ready_for_review: {
                                    bg: "bg-amber-500",
                                    text: "text-white",
                                    label: `👁 ${labelText("readyForReviewStatusLabel", "Ready for Review")}`,
                                  },
                                  approved: {
                                    bg: "bg-emerald-500",
                                    text: "text-white",
                                    label: `✓ ${labelText("approvedStatusLabel", "Approved")}`,
                                  },
                                  processing_failed: {
                                    bg: "bg-red-500",
                                    text: "text-white",
                                    label: `✕ ${labelText("failedStatusLabel", "Failed")}`,
                                  },
                                };
                                const sc =
                                  statusConfig[img.status] ||
                                  statusConfig.processing;

                                return (
                                  <Draggable
                                    key={img.id}
                                    draggableId={`pipeline-image-${img.id}`}
                                    index={index}
                                  >
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
                                            key={`img-${img.id}-${getPipelineImageSrc(img)}`}
                                            src={getPipelineImageSrc(img)}
                                            alt={
                                              img.original_name ||
                                              `Yacht image ${index + 1}`
                                            }
                                            onClick={() =>
                                              setSelectedLightboxImageId(img.id)
                                            }
                                            className={cn(
                                              "w-full h-full cursor-zoom-in object-cover transition-opacity",
                                              img.enhancement_method ===
                                                "pending" &&
                                                "opacity-80 grayscale-[0.2]",
                                              img.status === "processing" &&
                                                "opacity-60",
                                            )}
                                            onError={handleImageError}
                                          />

                                          {/* Loading Overlay for Processing */}
                                          {img.status === "processing" && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                                              <Loader2
                                                size={24}
                                                className="animate-spin text-blue-600"
                                              />
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
                                            title={labelText(
                                              "dragToReorder",
                                              "Drag to reorder",
                                            )}
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
                                                {img.quality_label ===
                                                "Acceptable"
                                                  ? labelText(
                                                      "acceptableQuality",
                                                      "Acceptable",
                                                    )
                                                  : img.quality_label ===
                                                      "Offline"
                                                    ? labelText(
                                                        "offlineQuality",
                                                        "Offline",
                                                      )
                                                    : img.quality_label}
                                              </div>
                                            )}

                                          {img.category && (
                                            <div className="absolute bottom-2 right-12 z-20 rounded-md bg-[#0B1F3A]/80 px-2 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur-sm">
                                              {img.category === "general"
                                                ? labelText(
                                                    "generalCategory",
                                                    "General",
                                                  )
                                                : img.category}
                                            </div>
                                          )}

                                          {/* AI Enhanced badge */}
                                          {img.enhancement_method ===
                                            "cloudinary" &&
                                            img.status !== "processing" && (
                                              <div className="absolute bottom-2 left-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5 z-20">
                                                <Sparkles size={10} />{" "}
                                                {labelText(
                                                  "aiEnhanced",
                                                  "AI Enhanced",
                                                )}
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
                                                  {labelText(
                                                    "aiReviewScore",
                                                    "AI review score",
                                                  )}
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
                                                        : img.quality_score >=
                                                            40
                                                          ? "bg-amber-500"
                                                          : "bg-red-500",
                                                    )}
                                                    style={{
                                                      width: `${img.quality_score}%`,
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                              <p className="text-[10px] text-slate-400">
                                                {labelText(
                                                  "galleryReadinessHint",
                                                  "Measures gallery readiness after AI cleanup.",
                                                )}
                                              </p>
                                            </div>
                                          )}

                                          {/* Keep original toggle */}
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 font-medium">
                                              {labelText(
                                                "keepOriginal",
                                                "Keep original",
                                              )}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                pipeline.toggleKeepOriginal(
                                                  img.id,
                                                )
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
                                            <p className="font-semibold text-slate-700">
                                              {labelText(
                                                "aiComments",
                                                "AI comments",
                                              )}
                                            </p>
                                            <p className="mt-1 line-clamp-2">
                                              {buildImageAiNotes(img)[0]}
                                            </p>
                                          </div>

                                          {/* Action buttons */}
                                          <div className="flex gap-2">
                                            {img.status ===
                                              "ready_for_review" && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  pipeline.approveImage(img.id)
                                                }
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
                                              >
                                                <Check size={12} />{" "}
                                                {labelText(
                                                  "approveImage",
                                                  "Approve",
                                                )}
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                pipeline.deleteImage(img.id)
                                              }
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
                              },
                            )}
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
                        className="max-w-[min(96vw,1240px)] overflow-hidden rounded-[32px] border border-slate-200/90 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.18)] dark:border-slate-800/80 dark:bg-[#020817] dark:shadow-[0_40px_120px_rgba(2,6,23,0.78)]"
                      >
                        {selectedLightboxImage && (
                          <div className="max-h-[92vh] overflow-y-auto">
                            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)]">
                              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
                                <div className="rounded-full border border-sky-200/80 bg-white/85 px-4 py-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-cyan-200/70">
                                    {labelText(
                                      "aiGalleryReview",
                                      "AI Gallery Review",
                                    )}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
                                    {selectedLightboxIndex + 1} /{" "}
                                    {reviewImages.length}
                                  </span>
                                  <DialogClose asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-slate-950/60 dark:text-white dark:hover:bg-white/10"
                                      aria-label={labelText(
                                        "closeImageReview",
                                        "Close image review",
                                      )}
                                    >
                                      <X size={18} />
                                    </button>
                                  </DialogClose>
                                </div>
                              </div>

                              <div className="relative flex min-h-[54vh] items-center justify-center px-4 pb-24 pt-24 sm:px-8 lg:px-10">
                                <img
                                  src={getPipelineImageSrc(
                                    selectedLightboxImage,
                                  )}
                                  alt={
                                    selectedLightboxImage.original_name ||
                                    "Selected yacht image"
                                  }
                                  className="max-h-[62vh] w-auto max-w-full rounded-[28px] border border-slate-200/80 bg-white/80 object-contain shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_30px_100px_rgba(15,23,42,0.65)]"
                                  onError={handleImageError}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => moveLightboxImage("prev")}
                                className="absolute bottom-6 left-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-slate-950/65 dark:text-white dark:shadow-[0_12px_40px_rgba(15,23,42,0.5)] dark:hover:bg-white/10"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLightboxImage("next")}
                                className="absolute bottom-6 left-24 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-slate-950/65 dark:text-white dark:shadow-[0_12px_40px_rgba(15,23,42,0.5)] dark:hover:bg-white/10"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>

                            <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.96)_100%)] p-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.98)_100%)] sm:p-8 lg:p-10">
                              <DialogHeader className="text-left">
                                <div className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">
                                  {labelText("reviewDetails", "Review Details")}
                                </div>
                                <DialogTitle className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-4xl">
                                  {selectedLightboxImage.original_name ||
                                    labelText(
                                      "imageReviewTitle",
                                      "Image review",
                                    )}
                                </DialogTitle>
                                <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                                  {labelText(
                                    "imageReviewDescription",
                                    "Review the full image, the AI quality score, and the applied corrections before approving it for the final gallery.",
                                  )}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="mt-6 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                  {selectedLightboxImage.category === "general"
                                    ? labelText("generalCategory", "General")
                                    : selectedLightboxImage.category ||
                                      "General"}
                                </span>
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold capitalize text-violet-700 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300">
                                  {(
                                    selectedLightboxImage.enhancement_method ||
                                    "none"
                                  ).replace(/_/g, " ")}
                                </span>
                                {selectedLightboxImage.keep_original && (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300">
                                    {labelText("keepOriginal", "Keep original")}
                                  </span>
                                )}
                              </div>

                              <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_20px_50px_rgba(2,6,23,0.4)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                                      {labelText(
                                        "aiReviewScore",
                                        "AI review score",
                                      )}
                                    </p>
                                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                                      {selectedLightboxImage.quality_score ??
                                        "—"}
                                      <span className="text-lg text-slate-400 dark:text-slate-500">
                                        /100
                                      </span>
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "rounded-full px-3 py-1 text-xs font-bold",
                                      (selectedLightboxImage.quality_score ??
                                        0) >= 70
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : (selectedLightboxImage.quality_score ??
                                              0) >= 40
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                                    )}
                                  >
                                    {(selectedLightboxImage.quality_score ??
                                      0) >= 70
                                      ? labelText(
                                          "galleryReady",
                                          "Gallery ready",
                                        )
                                      : (selectedLightboxImage.quality_score ??
                                            0) >= 40
                                        ? labelText(
                                            "needsReview",
                                            "Needs review",
                                          )
                                        : labelText(
                                            "needsCorrection",
                                            "Needs correction",
                                          )}
                                  </span>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-300">
                                  {labelText(
                                    "scoreSuitabilityHelp",
                                    "This score reflects how suitable the image is for the public gallery after AI cleanup and classification.",
                                  )}
                                </p>

                                <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                                  {labelText(
                                    "aiReviewScore",
                                    "AI review score",
                                  )}
                                </p>
                                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className={cn(
                                      "h-full rounded-full bg-gradient-to-r",
                                      (selectedLightboxImage.quality_score ??
                                        0) >= 70
                                        ? "from-emerald-400 to-emerald-500"
                                        : (selectedLightboxImage.quality_score ??
                                              0) >= 40
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
                                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                                  {labelText("aiComments", "AI comments")}
                                </p>
                                <div className="space-y-2">
                                  {buildImageAiNotes(selectedLightboxImage).map(
                                    (note) => (
                                      <div
                                        key={note}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-[0_14px_30px_rgba(2,6,23,0.28)]"
                                      >
                                        {note}
                                      </div>
                                    ),
                                  )}
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
                                ? labelText(
                                    "imagesApprovedUnlocked",
                                    "✅ Images approved - Step 2 is unlocked!",
                                  )
                                : labelText(
                                    "imagesApprovedExtractionRunning",
                                    "🤖 Images approved. AI extraction is still running...",
                                  )
                              : labelText(
                                  "approvedMinimumImages",
                                  "⏳ {approved} of {minimum} minimum images approved",
                                )
                                  .replace(
                                    "{approved}",
                                    String(pipeline.stats.approved),
                                  )
                                  .replace(
                                    "{minimum}",
                                    String(pipeline.stats.min_required),
                                  )
                            : labelText(
                                "editManifestUnlocked",
                                "ℹ️ Edit Manifest mode - Step 2 is unlocked with existing boat details.",
                              )}
                        </p>
                        {isNewMode && !imagesApproved && (
                          <p className="text-xs text-amber-600 mt-1">
                            {labelText(
                              "stepTwoUnlockHint",
                              "Step 2 opens after image approval. AI extraction continues in background and fills fields when ready.",
                            )}
                            {pipeline.stats.processing > 0 &&
                              ` ${labelText(
                                "stillProcessingCount",
                                "{count} still processing...",
                              ).replace(
                                "{count}",
                                String(pipeline.stats.processing),
                              )}`}
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
                                  background: false,
                                  navigateToStep2: true,
                                  speedMode: "balanced",
                                });
                                if (!extractionOk) {
                                  toast(
                                    labelText(
                                      "aiTimedOutStepTwo",
                                      "AI extraction timed out. Step 2 is unlocked; you can continue manually and retry AI later.",
                                    ),
                                    { icon: "⚠️" },
                                  );
                                  setActiveStep(2);
                                }
                              } else {
                                toast.success(
                                  labelText(
                                    "imagesApprovedManualAi",
                                    "Images approved. You can manually run AI autofill if needed.",
                                  ),
                                );
                              }
                            } else {
                              toast.success(
                                labelText(
                                  "imagesApprovedShort",
                                  "Images approved.",
                                ),
                              );
                            }
                          }}
                          disabled={isExtracting}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-md"
                        >
                          <CheckCircle size={16} />{" "}
                          {labelText("approveAllImages", "Approve All")}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Extract with AI Area (Auto-triggered) ── */}
                {(pipeline.stats.total > 0 ||
                  imagesApproved ||
                  (!isOnline && offlineImages.length > 0)) && (
                  <div className="flex flex-col items-center gap-4 py-4">
                    {/* Offline Skip Button */}
                    {!isOnline ? (
                      <div className="flex flex-col items-center gap-3 w-full max-w-lg">
                        <div className="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg p-4 text-sm w-full flex gap-3 shadow-sm mb-2">
                          <WifiOff className="shrink-0" size={18} />
                          <div>
                            <p className="font-semibold mb-1">
                              {labelText(
                                "aiExtractionNotAvailableOffline",
                                "AI Extraction Not Available Offline",
                              )}
                            </p>
                            <p>
                              {labelText(
                                "offlineManualHint",
                                "You can skip this step and fill in the boat details manually. Images are saved locally.",
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveStep(2)}
                          disabled={isExtracting}
                          className="w-full py-4 px-8 rounded-xl text-base font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {labelText(
                            "skipToStep2Manual",
                            "Skip to Step 2 (Manual Fill)",
                          )}{" "}
                          <ArrowRight size={20} />
                        </button>
                      </div>
                    ) : (
                      isExtracting && (
                        <div className="w-full max-w-lg flex flex-col items-center justify-center gap-3 py-6 px-4 bg-blue-50/50 rounded-xl border border-blue-100">
                          <Loader2
                            size={32}
                            className="animate-spin text-blue-600"
                          />
                          <p className="text-blue-800 font-medium">
                            {labelText(
                              "geminiAnalyzingImages",
                              "Gemini is analyzing your images...",
                            )}
                          </p>
                        </div>
                      )
                    )}
                    {!geminiExtracted && !isExtracting && isOnline && (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-xs text-slate-400 text-center">
                          {imagesApproved
                            ? labelText(
                                "aiReadyAnalyzeApprovedImages",
                                `AI is ready to analyze ${displayApprovedCount} approved optimized images`,
                              )
                            : labelText(
                                "uploadApproveImagesFirstAi",
                                "Upload and approve images first, then AI will analyze them",
                              )}
                        </p>

                        {/* Manual Trigger for Edit Mode or Retries */}
                        {imagesApproved && (
                          <button
                            type="button"
                            onClick={() => {
                              void handleAiExtract();
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Sparkles size={16} />{" "}
                            {labelText(
                              "runAiExtractionManually",
                              "Run AI Extraction Manually",
                            )}
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
          {activeStep === 1 && role === "admin" && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-8 mb-4">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Video size={18} className="text-blue-500" />{" "}
                    {labelText(
                      "vesselVideoOperations",
                      "Vessel Video Operations",
                    )}
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                    {labelText(
                      "manageVideosSocialPosting",
                      "Manage Videos & Social Posting",
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded shadow-sm"
                    onClick={() => handleGenerateMarketingVideo(false)}
                    disabled={isGeneratingMarketingVideo}
                  >
                    {isGeneratingMarketingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles size={14} className="mr-2" />
                    )}
                    {labelText("generateFromImages", "Generate from images")}
                  </Button>
                  <label className="cursor-pointer bg-[#003566] text-white px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-2">
                    {isUploadingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {labelText("uploadMp4", "Upload MP4")}
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={isUploadingVideo}
                    />
                  </label>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                        {labelText(
                          "automatedSocialVideo",
                          "Automated Social Video",
                        )}
                      </p>
                      <p className="mt-2 text-sm text-emerald-900">
                        {labelText(
                          "queueMarketingVideo",
                          "Queue a marketing video built from the approved boat images. The backend will render it and it will appear in the social video library with status updates.",
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="text-[10px] h-9 px-4 font-bold uppercase tracking-wider bg-white"
                        onClick={() =>
                          router.push(`/${locale}/dashboard/${role}/social`)
                        }
                      >
                        {labelText("openSocialLibrary", "Open Social Library")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-[10px] h-9 px-4 font-bold uppercase tracking-wider bg-white"
                        onClick={() => handleGenerateMarketingVideo(true)}
                        disabled={isGeneratingMarketingVideo}
                      >
                        {labelText("forceRegenerate", "Force Regenerate")}
                      </Button>
                    </div>
                  </div>
                </div>

                {marketingVideos.length > 0 && (
                  <div className="mb-8">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">
                        {labelText(
                          "generatedMarketingVideos",
                          "Generated marketing videos",
                        )}
                      </p>
                      <button
                        type="button"
                        className="text-[10px] uppercase font-black tracking-[0.2em] text-[#003566]"
                        onClick={() =>
                          loadMarketingVideos(
                            isNewMode ? createdYachtId || yachtId : yachtId,
                          )
                        }
                      >
                        {labelText("refresh", "Refresh")}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {marketingVideos.map((video) => (
                        <div
                          key={`marketing-${video.id}`}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {labelText("marketingVideo", "Marketing Video")}{" "}
                                #{video.id}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {labelText("templateLabel", "Template")}:{" "}
                                {video.template_type || "vertical_slideshow_v1"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Trigger: {video.generation_trigger || "created"}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em]",
                                video.status === "ready" ||
                                  video.status === "published"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : video.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700",
                              )}
                            >
                              {video.status || "queued"}
                            </span>
                          </div>
                          {(video.thumbnail_url || video.video_url) && (
                            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              {video.video_url ? (
                                <video
                                  src={video.video_url}
                                  controls
                                  preload="metadata"
                                  poster={video.thumbnail_url || undefined}
                                  className="h-auto max-h-64 w-full bg-black object-contain"
                                />
                              ) : video.thumbnail_url ? (
                                <img
                                  src={video.thumbnail_url}
                                  alt=""
                                  className="h-64 w-full object-cover"
                                />
                              ) : null}
                            </div>
                          )}
                          <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <p>
                              WhatsApp: {video.whatsapp_status || "pending"}
                            </p>
                            <p>Recipient: {video.whatsapp_recipient || "—"}</p>
                            <p>Sent at: {video.whatsapp_sent_at || "—"}</p>
                            <p>
                              {labelText("videoUrlLabel", "Video URL")}:{" "}
                              {video.video_url
                                ? labelText("readyState", "ready")
                                : labelText("waitingState", "waiting")}
                            </p>
                          </div>
                          {video.whatsapp_error ? (
                            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              WhatsApp error: {video.whatsapp_error}
                            </div>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {video.video_url && (
                              <a
                                href={video.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                              >
                                <Eye size={12} className="mr-2" />
                                Open Video
                              </a>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              className="text-[10px] h-8 px-3 font-bold uppercase tracking-wider bg-white"
                              onClick={() =>
                                handleNotifyMarketingVideoOwner(video.id)
                              }
                              disabled={
                                isPublishingVideo === video.id ||
                                !video.video_url
                              }
                            >
                              {isPublishingVideo === video.id ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles size={12} className="mr-2" />
                              )}
                              Send WhatsApp
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-[10px] h-8 px-3 font-bold uppercase tracking-wider bg-white"
                              onClick={() =>
                                router.push(
                                  `/${locale}/dashboard/${role}/social`,
                                )
                              }
                            >
                              View in Social
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      <div
                        key={video.id}
                        className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-5 shadow-sm bg-slate-50"
                      >
                        <div className="w-full sm:w-40 h-40 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              className="w-full h-full object-cover"
                            />
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
                              <span
                                className={cn(
                                  "ml-2 px-2 py-0.5 rounded text-[9px] text-white",
                                  video.status === "published"
                                    ? "bg-emerald-500"
                                    : video.status === "processing"
                                      ? "bg-amber-500"
                                      : "bg-blue-500",
                                )}
                              >
                                {video.status}
                              </span>
                            </p>
                          </div>

                          <div className="flex gap-4">
                            {video.duration && (
                              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Clock size={12} /> {video.duration}s
                              </p>
                            )}
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Box size={12} /> {video.format}
                            </p>
                          </div>

                          <div className="pt-4 flex flex-wrap gap-2 mt-auto">
                            <Button
                              type="button"
                              variant="outline"
                              className="text-[10px] h-8 px-3 font-bold uppercase tracking-wider bg-white"
                              onClick={() =>
                                router.push(
                                  `/${locale}/dashboard/${role}/yachts/${yachtId}/video-settings`,
                                )
                              }
                              disabled={isNewMode && !createdYachtId}
                            >
                              Social Settings
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              className="text-[10px] h-8 px-4 font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleVideoPublish(video.id)}
                              disabled={
                                isPublishingVideo === video.id ||
                                (isNewMode && !createdYachtId)
                              }
                            >
                              {isPublishingVideo === video.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                              ) : (
                                <Sparkles size={12} className="mr-2" />
                              )}
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
                className="space-y-6 lg:space-y-8 pt-2 [&_input]:border-amber-300 [&_input]:bg-amber-50/50 [&_select]:border-amber-300 [&_select]:bg-amber-50/50 [&_[data-slot='select-trigger']]:border-amber-300 [&_[data-slot='select-trigger']]:bg-amber-50/50"
              >
              {/* AI extraction summary intentionally hidden in Step 2 */}

              {/* --- SECTION 2: CORE SPECS --- */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Coins size={20} className="text-blue-600" />{" "}
                    {labelText(
                      "essentialRegistryData",
                      "Essential Registry Data",
                    )}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2 group">
                    <Label>{labelText("vesselName", "Vessel Name *")}</Label>
                      <Input
                        name="boat_name"
                        defaultValue={selectedYacht?.boat_name}
                        placeholder={step2Placeholder("vesselName", "e.g. M/Y NOBILITY")}
                        required
                        needsConfirmation={needsConfirm("boat_name")}
                      />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("manufacturer", "Manufacturer / Make")}</Label>
                      <CatalogAutocomplete
                        endpoint="/api/autocomplete/brands"
                        name="manufacturer"
                        defaultValue={selectedYacht?.manufacturer}
                        placeholder={step2Placeholder("manufacturer", "e.g. Beneteau, Sunseeker")}
                        needsConfirmation={needsConfirm("manufacturer")}
                      onSelect={(id, name) => {
                        setSelectedBrandId(Number(id));
                        setSelectedYacht((prev: any) => ({
                          ...prev,
                          manufacturer: name,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("model", "Model")}</Label>
                      <CatalogAutocomplete
                        endpoint="/api/autocomplete/models"
                        name="model"
                        defaultValue={selectedYacht?.model}
                        placeholder={step2Placeholder("model", "e.g. Oceanis 38.1")}
                        dependsOn="brand_id"
                      dependsOnValue={selectedBrandId}
                      needsConfirmation={needsConfirm("model")}
                      onSelect={(_id, name) => {
                        // When model changes, we update the state so the assistant picks it up
                        setSelectedYacht((prev: any) => ({
                          ...prev,
                          model: name,
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <Label>
                      {labelText("harborLocation", "Sales Location (Harbor) *")}
                    </Label>
                    <Select
                      value={selectedYacht?.ref_harbor_id?.toString() || ""}
                      onValueChange={(val) => {
                        setSelectedYacht((prev: any) => ({
                          ...prev,
                          ref_harbor_id: Number(val),
                        }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-11 border-slate-200",
                          hasFilledFieldValue(selectedYacht?.ref_harbor_id) &&
                            "border-amber-300 bg-amber-50/50",
                        )}
                      >
                        <SelectValue placeholder={commonText("selectLocation", "Select location...")} />
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
                            draft:
                              specs.draft ?? specs.draft_m ?? specs.draught,
                          };

                          Object.entries(normalizedSpecs).forEach(
                            ([field, value]) => {
                              if (
                                value === null ||
                                value === undefined ||
                                value === ""
                              )
                                return;
                              if (isAuto && !isEmpty(base[field])) return;
                              base[field] = value;
                            },
                          );

                          return base;
                        });
                        setFormKey((k) => k + 1); // Refresh form to show new defaultValues
                        if (!isAuto) {
                          toast.success("AI suggestions applied to form!");
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("price", "Price (€)")}</Label>
                    <Input
                      name="price"
                      type="number"
                      defaultValue={selectedYacht?.price}
                      placeholder="1500000"
                      needsConfirmation={needsConfirm("price")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("minBidAmount", "Minimum Bid Amount (€)")}</Label>
                      <Input
                        name="min_bid_amount"
                        type="number"
                        defaultValue={selectedYacht?.min_bid_amount || ""}
                        placeholder={step2Placeholder("minBidAmount", "Auto-calculates 90% of price if empty")}
                        step="1000"
                      />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("yearBuilt", "Year Built")}</Label>
                    <Input
                      name="year"
                      type="number"
                      defaultValue={selectedYacht?.year}
                      placeholder="2024"
                      needsConfirmation={needsConfirm("year")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("boatType", "Boat Type")}</Label>
                      <CatalogAutocomplete
                        endpoint="/api/autocomplete/types"
                        name="boat_type"
                        defaultValue={selectedYacht?.boat_type}
                        placeholder={step2Placeholder("boatType", "e.g. Sailboat, Motorboat")}
                        needsConfirmation={needsConfirm("boat_type")}
                      />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("boatCategory", "Boat Category")}</Label>
                      <Input
                        name="boat_category"
                        defaultValue={selectedYacht?.boat_category}
                        placeholder={step2Placeholder("boatCategory", "e.g. Cruiser, Racing, Fishing")}
                        needsConfirmation={needsConfirm("boat_category")}
                      />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("newOrUsed", "New or Used")}</Label>
                      <SelectField
                        name="new_or_used"
                        defaultValue={selectedYacht?.new_or_used || ""}
                      >
                        <option value="">{commonText("select", "Select...")}</option>
                        <option value="new">{commonText("conditionNew", "New")}</option>
                        <option value="used">{commonText("conditionUsed", "Used")}</option>
                      </SelectField>
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("loa", "LOA (Length Overall)")}</Label>
                    <Input
                      name="loa"
                      defaultValue={selectedYacht?.loa}
                      placeholder="45.5"
                      needsConfirmation={needsConfirm("loa")}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("lwl", "LWL (Waterline Length)")}</Label>
                    <Input
                      name="lwl"
                      defaultValue={selectedYacht?.lwl}
                      placeholder="40.2"
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("shipyard", "Shipyard / Werf")}</Label>
                      <Input
                        name="where"
                        defaultValue={selectedYacht?.where}
                        placeholder={step2Placeholder("shipyard", "e.g. Beneteau, Bavaria")}
                      />
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("ceCategory", "CE Category")}</Label>
                      <SelectField
                        name="ce_category"
                        defaultValue={selectedYacht?.ce_category || ""}
                      >
                        <option value="">{commonText("select", "Select...")}</option>
                        <option value="A">A - {commonText("ceOcean", "Ocean")}</option>
                        <option value="B">B - {commonText("ceOffshore", "Offshore")}</option>
                        <option value="C">C - {commonText("ceInshore", "Inshore")}</option>
                        <option value="D">D - {commonText("ceSheltered", "Sheltered Waters")}</option>
                      </SelectField>
                  </div>
                  <div className="space-y-2 group">
                    <Label>{labelText("status", "Status")}</Label>
                      <SelectField
                        name="status"
                        defaultValue={selectedYacht?.status || "Draft"}
                      >
                        <option value="For Sale">{commonText("statusForSale", "For Sale")}</option>
                        <option value="For Bid">{commonText("statusForBid", "For Bid")}</option>
                        <option value="Sold">{commonText("statusSold", "Sold")}</option>
                        <option value="Draft">{commonText("statusDraft", "Draft")}</option>
                      </SelectField>
                  </div>
                  <div className="space-y-2 group">
                    <Label>
                      {labelText("passengerCapacity", "Passenger Capacity")}
                    </Label>
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
                  <Waves size={20} className="text-blue-600" />{" "}
                  {labelText("technicalDossier", "Technical Dossier")}
                </h3>

                {/* Sub-Section: General & Hull */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <SectionHeader
                      icon={<Ship size={16} />}
                      title={labelText("hullDimensions", "Hull & Dimensions")}
                    />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1 group">
                        <Label>{labelText("beam", "Beam (Width)")}</Label>
                        <Input
                          name="beam"
                          defaultValue={selectedYacht?.beam}
                          placeholder="e.g. 8.5m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("draft", "Draft (Depth)")}</Label>
                        <Input
                          name="draft"
                          defaultValue={selectedYacht?.draft}
                          placeholder="e.g. 2.1m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("airDraft", "Air Draft (Clearance)")}
                        </Label>
                        <Input
                          name="air_draft"
                          defaultValue={selectedYacht?.air_draft}
                          placeholder="e.g. 4.5m"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{extraLabelText("displacement", "Displacement")}</Label>
                        <Input
                          name="displacement"
                          defaultValue={selectedYacht?.displacement}
                          placeholder="e.g. 12000 kg"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("ballast", "Ballast")}</Label>
                        <Input
                          name="ballast"
                          defaultValue={selectedYacht?.ballast}
                          placeholder="e.g. 3500 kg"
                          needsConfirmation={needsConfirm("ballast")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("hullType", "Hull Type")}</Label>
                        <Input
                          name="hull_type"
                          defaultValue={selectedYacht?.hull_type}
                          placeholder="e.g. Monohull"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("hullConstruction", "Hull Construction")}
                        </Label>
                        <Input
                          name="hull_construction"
                          defaultValue={selectedYacht?.hull_construction}
                          placeholder="e.g. GRP / Polyester"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("hullColour", "Hull Colour")}</Label>
                        <Input
                          name="hull_colour"
                          defaultValue={selectedYacht?.hull_colour}
                          placeholder="White"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("hullNumber", "Hull Number")}</Label>
                        <Input
                          name="hull_number"
                          defaultValue={selectedYacht?.hull_number}
                          placeholder="e.g. HULL001"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("designer", "Designer")}</Label>
                        <Input
                          name="designer"
                          defaultValue={selectedYacht?.designer}
                          placeholder="e.g. Philippe Briand"
                          needsConfirmation={needsConfirm("designer")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("builder", "Builder")}</Label>
                        <Input
                          name="builder"
                          defaultValue={selectedYacht?.builder}
                          placeholder="e.g. Beneteau"
                          needsConfirmation={needsConfirm("builder")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("deckColour", "Deck Colour")}</Label>
                        <Input
                          name="deck_colour"
                          defaultValue={selectedYacht?.deck_colour}
                          placeholder="e.g. White"
                          needsConfirmation={needsConfirm("deck_colour")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("deckConstruction", "Deck Construction")}
                        </Label>
                        <Input
                          name="deck_construction"
                          defaultValue={selectedYacht?.deck_construction}
                          placeholder="e.g. GRP with teak"
                          needsConfirmation={needsConfirm("deck_construction")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText(
                            "superStructureColour",
                            "Superstructure Colour",
                          )}
                        </Label>
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
                        <Label>
                          {labelText(
                            "superStructureConstruction",
                            "Superstructure Construction",
                          )}
                        </Label>
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
                      title={labelText(
                        "enginePerformance",
                        "Engine & Performance",
                      )}
                    />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1 group">
                        <Label>
                          {labelText(
                            "engineManufacturer",
                            "Engine Manufacturer",
                          )}
                        </Label>
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
                        <Label>
                          {labelText("engineModel", "Engine Model")}
                        </Label>
                        <Input
                          name="engine_model"
                          defaultValue={selectedYacht?.engine_model}
                          placeholder="e.g. C32 ACERT"
                          needsConfirmation={needsConfirm("engine_model")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("engineType", "Engine Type")}</Label>
                        <SelectField
                          name="engine_type"
                          defaultValue={selectedYacht?.engine_type || ""}
                        >
                          <option value="">Select…</option>
                          <option value="inboard">Inboard</option>
                          <option value="outboard">Outboard</option>
                          <option value="saildrive">Saildrive</option>
                          <option value="sterndrive">Sterndrive</option>
                        </SelectField>
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("horsePower", "Horse Power")}</Label>
                        <Input
                          name="horse_power"
                          defaultValue={selectedYacht?.horse_power}
                          placeholder="e.g. 2x 1500HP"
                          needsConfirmation={needsConfirm("horse_power")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("engineHours", "Engine Hours")}
                        </Label>
                        <Input
                          name="hours"
                          defaultValue={selectedYacht?.hours}
                          placeholder="e.g. 450 hrs"
                          needsConfirmation={needsConfirm("hours")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("fuelType", "Fuel Type")}</Label>
                        <Input
                          name="fuel"
                          defaultValue={selectedYacht?.fuel}
                          placeholder="Diesel"
                          needsConfirmation={needsConfirm("fuel")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("engineQuantity", "Engine Quantity")}
                        </Label>
                        <Input
                          name="engine_quantity"
                          defaultValue={selectedYacht?.engine_quantity}
                          placeholder="e.g. 1, 2, 3"
                          needsConfirmation={needsConfirm("engine_quantity")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("engineYear", "Engine Year")}</Label>
                        <Input
                          name="engine_year"
                          type="number"
                          defaultValue={selectedYacht?.engine_year}
                          placeholder="e.g. 2020"
                          needsConfirmation={needsConfirm("engine_year")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("maxSpeed", "Max Speed")}</Label>
                        <Input
                          name="max_speed"
                          defaultValue={selectedYacht?.max_speed}
                          placeholder="e.g. 35 kn"
                          needsConfirmation={needsConfirm("max_speed")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("cruisingSpeed", "Cruising Speed")}
                        </Label>
                        <Input
                          name="cruising_speed"
                          defaultValue={selectedYacht?.cruising_speed}
                          placeholder="e.g. 25 kn"
                          needsConfirmation={needsConfirm("cruising_speed")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{labelText("driveType", "Drive Type")}</Label>
                        <Input
                          name="drive_type"
                          defaultValue={selectedYacht?.drive_type}
                          placeholder="e.g. Shaft, V-drive, Pod"
                          needsConfirmation={needsConfirm("drive_type")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{extraLabelText("propulsion", "Propulsion")}</Label>
                        <Input
                          name="propulsion"
                          defaultValue={selectedYacht?.propulsion}
                          placeholder="e.g. Fixed prop, Folding, Saildrive"
                          needsConfirmation={needsConfirm("propulsion")}
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>
                          {labelText("gallonsPerHour", "Gallons per Hour")}
                        </Label>
                        <Input
                          name="gallons_per_hour"
                          defaultValue={selectedYacht?.gallons_per_hour}
                          placeholder="e.g. 50"
                        />
                      </div>
                      <div className="space-y-1 group">
                        <Label>{extraLabelText("tankage", "Tankage")}</Label>
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
                  <Coins size={18} />{" "}
                  {labelText(
                    "essentialRegistryData",
                    "Essential Registry Data",
                  )}
                </h3>

                {/* Sub-Section: Accommodation */}
                <div className="space-y-5">
                  <SectionHeader
                    icon={<Bed size={16} />}
                    title={labelText(
                      "accommodationFacilities",
                      "Accommodation & Facilities",
                    )}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <div className="space-y-1 group">
                      <Label>{labelText("cabins", "Cabins")}</Label>
                      <Input
                        name="cabins"
                        type="number"
                        defaultValue={selectedYacht?.cabins}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("berths", "Berths")}</Label>
                      <Input
                        name="berths"
                        defaultValue={selectedYacht?.berths}
                        placeholder="6"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("toilet", "Toilet")}</Label>
                      <TriStateSelect
                        name="toilet"
                        defaultValue={selectedYacht?.toilet}
                        needsConfirmation={needsConfirm("toilet")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("berthsFixed", "Berths (Fixed)")}
                      </Label>
                      <Input
                        name="berths_fixed"
                        type="number"
                        defaultValue={selectedYacht?.berths_fixed}
                        placeholder="4"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("berthsExtra", "Berths (Extra)")}
                      </Label>
                      <Input
                        name="berths_extra"
                        type="number"
                        defaultValue={selectedYacht?.berths_extra}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("berthsCrew", "Berths (Crew)")}</Label>
                      <Input
                        name="berths_crew"
                        type="number"
                        defaultValue={selectedYacht?.berths_crew}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("shower", "Shower")}</Label>
                      <Input
                        name="shower"
                        defaultValue={selectedYacht?.shower}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("bath", "Bath")}</Label>
                      <Input
                        name="bath"
                        defaultValue={selectedYacht?.bath}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("interiorType", "Interior Type")}
                      </Label>
                      <Input
                        name="interior_type"
                        defaultValue={selectedYacht?.interior_type}
                        placeholder="Classic, wood"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("saloon", "Saloon")}</Label>
                      <Input
                        name="saloon"
                        defaultValue={selectedYacht?.saloon}
                        placeholder={yachtFormText.common.yes}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("headroom", "Headroom")}</Label>
                      <Input
                        name="headroom"
                        defaultValue={selectedYacht?.headroom}
                        placeholder="1.95m"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText(
                          "separateDiningArea",
                          "Separate Dining Area",
                        )}
                      </Label>
                      <Input
                        name="separate_dining_area"
                        defaultValue={selectedYacht?.separate_dining_area}
                        placeholder="Yes"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("engineRoom", "Engine Room")}</Label>
                      <Input
                        name="engine_room"
                        defaultValue={selectedYacht?.engine_room}
                        placeholder={yachtFormText.common.yes}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("spacesInside", "Spaces Inside")}</Label>
                      <Input
                        name="spaces_inside"
                        defaultValue={selectedYacht?.spaces_inside}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("upholsteryColor", "Upholstery Color")}
                      </Label>
                      <Input
                        name="upholstery_color"
                        defaultValue={selectedYacht?.upholstery_color}
                        placeholder="Blue"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("matrasses", "Matrasses")}</Label>
                      <Input
                        name="matrasses"
                        defaultValue={selectedYacht?.matrasses}
                        placeholder={yachtFormText.common.yes}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("cushions", "Cushions")}</Label>
                      <Input
                        name="cushions"
                        defaultValue={selectedYacht?.cushions}
                        placeholder={yachtFormText.common.yes}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("curtains", "Curtains")}</Label>
                      <Input
                        name="curtains"
                        defaultValue={selectedYacht?.curtains}
                        placeholder="White"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{extraLabelText("heating", "Heating")}</Label>
                      <TriStateSelect
                        name="heating"
                        defaultValue={selectedYacht?.heating}
                        needsConfirmation={needsConfirm("heating")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("cockpitType", "Cockpit Type")}</Label>
                      <Input
                        name="cockpit_type"
                        defaultValue={selectedYacht?.cockpit_type}
                        placeholder={placeholderText(
                          "cockpitType",
                          "Aft cockpit",
                        )}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("waterTank", "Water Tank")}</Label>
                      <Input
                        name="water_tank"
                        defaultValue={selectedYacht?.water_tank}
                        placeholder={placeholderText("waterTank", "200L")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("waterTankGauge", "Water Tank Gauge")}
                      </Label>
                      <Input
                        name="water_tank_gauge"
                        defaultValue={selectedYacht?.water_tank_gauge}
                        placeholder={placeholderText("waterTankGauge", "Yes")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("waterMaker", "Water Maker")}</Label>
                      <Input
                        name="water_maker"
                        defaultValue={selectedYacht?.water_maker}
                        placeholder={placeholderText("waterMaker", "60 L/h")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("wasteWaterTank", "Waste Water Tank")}
                      </Label>
                      <Input
                        name="waste_water_tank"
                        defaultValue={selectedYacht?.waste_water_tank}
                        placeholder={placeholderText("wasteWaterTank", "80L")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("wasteWaterGauge", "Waste Water Gauge")}
                      </Label>
                      <Input
                        name="waste_water_tank_gauge"
                        defaultValue={selectedYacht?.waste_water_tank_gauge}
                        placeholder={placeholderText("wasteWaterGauge", "Yes")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText(
                          "wasteTankDrainPump",
                          "Waste Tank Drain Pump",
                        )}
                      </Label>
                      <Input
                        name="waste_water_tank_drainpump"
                        defaultValue={selectedYacht?.waste_water_tank_drainpump}
                        placeholder={placeholderText(
                          "wasteTankDrainPump",
                          "Electric",
                        )}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("deckSuction", "Deck Suction")}</Label>
                      <Input
                        name="deck_suction"
                        defaultValue={selectedYacht?.deck_suction}
                        placeholder={placeholderText("deckSuction", "Yes")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("waterSystem", "Water System")}</Label>
                      <Input
                        name="water_system"
                        defaultValue={selectedYacht?.water_system}
                        placeholder={placeholderText(
                          "waterSystem",
                          "Pressurized",
                        )}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("hotWater", "Hot Water")}</Label>
                      <Input
                        name="hot_water"
                        defaultValue={selectedYacht?.hot_water}
                        placeholder={placeholderText("hotWater", "Boiler")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("seaWaterPump", "Sea Water Pump")}
                      </Label>
                      <Input
                        name="sea_water_pump"
                        defaultValue={selectedYacht?.sea_water_pump}
                        placeholder={placeholderText("seaWaterPump", "Yes")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("television", "Television")}</Label>
                      <TriStateSelect
                        name="television"
                        defaultValue={selectedYacht?.television}
                        needsConfirmation={needsConfirm("television")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("cdPlayer", "Radio / CD Player")}
                      </Label>
                      <Input
                        name="cd_player"
                        defaultValue={selectedYacht?.cd_player}
                        placeholder="Pioneer"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("satelliteReception", "Satellite Reception")}
                      </Label>
                      <Input
                        name="satellite_reception"
                        defaultValue={selectedYacht?.satellite_reception}
                        placeholder="KVH TracVision"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("cooker", "Cooker")}</Label>
                      <Input
                        name="cooker"
                        defaultValue={selectedYacht?.cooker}
                        placeholder="3-burner"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("cookingFuel", "Cooking Fuel")}</Label>
                      <Input
                        name="cooking_fuel"
                        defaultValue={selectedYacht?.cooking_fuel}
                        placeholder="Gas"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("oven", "Oven")}</Label>
                      <TriStateSelect
                        name="oven"
                        defaultValue={selectedYacht?.oven}
                        needsConfirmation={needsConfirm("oven")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("microwave", "Microwave")}</Label>
                      <TriStateSelect
                        name="microwave"
                        defaultValue={selectedYacht?.microwave}
                        needsConfirmation={needsConfirm("microwave")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("fridge", "Fridge")}</Label>
                      <TriStateSelect
                        name="fridge"
                        defaultValue={selectedYacht?.fridge}
                        needsConfirmation={needsConfirm("fridge")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("freezer", "Freezer")}</Label>
                      <TriStateSelect
                        name="freezer"
                        defaultValue={selectedYacht?.freezer}
                        needsConfirmation={needsConfirm("freezer")}
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("hotAir", "Hot Air Heating")}</Label>
                      <Input
                        name="hot_air"
                        defaultValue={selectedYacht?.hot_air}
                        placeholder="Webasto"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("stove", "Stove Heating")}</Label>
                      <Input
                        name="stove"
                        defaultValue={selectedYacht?.stove}
                        placeholder="Refleks"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>
                        {labelText("centralHeating", "Central Heating")}
                      </Label>
                      <Input
                        name="central_heating"
                        defaultValue={selectedYacht?.central_heating}
                        placeholder="Kabola"
                      />
                    </div>
                    <div className="space-y-1 group">
                      <Label>{labelText("controlType", "Control Type")}</Label>
                      <Input
                        name="control_type"
                        defaultValue={selectedYacht?.control_type}
                        placeholder="e.g. Wheel / Joystick"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-4 border-t border-slate-100 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="space-y-1 group">
                          <Label>
                            {labelText("airConditioning", "Air Conditioning")}
                          </Label>
                          <TriStateSelect
                            name="air_conditioning"
                            defaultValue={selectedYacht?.air_conditioning}
                            needsConfirmation={needsConfirm("air_conditioning")}
                          />
                        </div>
                        <div className="space-y-1 group">
                          <Label>{labelText("flybridge", "Flybridge")}</Label>
                          <TriStateSelect
                            name="flybridge"
                            defaultValue={selectedYacht?.flybridge}
                            needsConfirmation={needsConfirm("flybridge")}
                          />
                        </div>
                        <div className="space-y-1 group">
                          <Label>
                            {labelText("deckWashPump", "Deck Wash Pump")}
                          </Label>
                          <TriStateSelect
                            name="deck_wash_pump"
                            defaultValue={selectedYacht?.deck_wash_pump}
                            needsConfirmation={needsConfirm("deck_wash_pump")}
                          />
                        </div>
                        <div className="space-y-1 group">
                          <Label>
                            {labelText("deckShower", "Deck Shower")}
                          </Label>
                          <TriStateSelect
                            name="deck_shower"
                            defaultValue={selectedYacht?.deck_shower}
                            needsConfirmation={needsConfirm("deck_shower")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Section: Navigation Equipment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Compass size={20} className="text-blue-600" />{" "}
                  {labelText(
                    "navigationElectronics",
                    "Navigation & Electronics",
                  )}
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
                    <YachtFieldWrapper
                      key={f.name}
                      label={localizeFieldLabel(f.name, f.label)}
                      yachtId={selectedYachtId}
                      fieldName={f.name}
                      correctionLabel={fieldCorrectionLabels[f.name]}
                      onCorrectionLabelChange={(label) =>
                        setFieldCorrectionLabels((p) => ({
                          ...p,
                          [f.name]: label,
                        }))
                      }
                    >
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
                    </YachtFieldWrapper>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Safety Equipment */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Shield size={20} className="text-blue-600" />{" "}
                  {labelText("safetyEquipment", "Safety Equipment")}
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
                    <YachtFieldWrapper
                      key={f.name}
                      label={localizeFieldLabel(f.name, f.label)}
                      yachtId={selectedYachtId}
                      fieldName={f.name}
                      correctionLabel={fieldCorrectionLabels[f.name]}
                      onCorrectionLabelChange={(label) =>
                        setFieldCorrectionLabels((p) => ({
                          ...p,
                          [f.name]: label,
                        }))
                      }
                    >
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
                    </YachtFieldWrapper>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Electrical System */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Zap size={20} className="text-blue-600" />{" "}
                  {sectionText("electricalSystem", "Electrical System")}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "battery",
                      label: labelText("battery", "Batteries"),
                      ph: placeholderText("battery", "e.g. 4x 12V 125Ah AGM"),
                    },
                    {
                      name: "battery_charger",
                      label: labelText("batteryCharger", "Battery Charger"),
                      ph: placeholderText(
                        "batteryCharger",
                        "e.g. Victron Blue Smart 30A",
                      ),
                    },
                    {
                      name: "generator",
                      label: labelText("generator", "Generator"),
                      ph: placeholderText("generator", "e.g. Onan 9kW"),
                    },
                    {
                      name: "inverter",
                      label: labelText("inverter", "Inverter"),
                      ph: placeholderText(
                        "inverter",
                        "e.g. Victron Phoenix 3000W",
                      ),
                    },
                    {
                      name: "shorepower",
                      label: labelText("shorepower", "Shorepower"),
                      ph: placeholderText("shorepower", "e.g. 230V 16A"),
                    },
                    {
                      name: "solar_panel",
                      label: labelText("solarPanel", "Solar Panel"),
                      ph: placeholderText(
                        "solarPanel",
                        "e.g. 2x 100W flexible",
                      ),
                    },
                    {
                      name: "wind_generator",
                      label: labelText("windGenerator", "Wind Generator"),
                      ph: placeholderText(
                        "windGenerator",
                        "e.g. Silentwind 400+",
                      ),
                    },
                    {
                      name: "voltage",
                      label: labelText("voltage", "Voltage"),
                      ph: placeholderText("voltage", "e.g. 12V / 230V"),
                    },
                    {
                      name: "dynamo",
                      label: labelText("dynamo", "Dynamo"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "accumonitor",
                      label: labelText("accumonitor", "Accumonitor"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "voltmeter",
                      label: labelText("voltmeter", "Voltmeter"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "shore_power_cable",
                      label: labelText("shorePowerCable", "Shore Power Cable"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "consumption_monitor",
                      label: labelText(
                        "consumptionMonitor",
                        "Consumption Monitor",
                      ),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "control_panel",
                      label: labelText("controlPanel", "Control Panel"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "fuel_tank_gauge",
                      label: labelText("fuelTankGauge", "Fuel Tank Gauge"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "tachometer",
                      label: labelText("tachometer", "Tachometer"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "oil_pressure_gauge",
                      label: labelText(
                        "oilPressureGauge",
                        "Oil Pressure Gauge",
                      ),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "temperature_gauge",
                      label: labelText("temperatureGauge", "Temperature Gauge"),
                      ph: yachtFormText.common.yes,
                    },
                  ].map((f) => (
                    <YachtFieldWrapper
                      key={f.name}
                      label={localizeFieldLabel(f.name, f.label)}
                      yachtId={selectedYachtId}
                      fieldName={f.name}
                      correctionLabel={fieldCorrectionLabels[f.name]}
                      onCorrectionLabelChange={(label) =>
                        setFieldCorrectionLabels((p) => ({
                          ...p,
                          [f.name]: label,
                        }))
                      }
                    >
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
                    </YachtFieldWrapper>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Kitchen & Comfort */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Box size={20} className="text-blue-600" />{" "}
                  {sectionText("kitchenComfort", "Kitchen & Comfort")}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      name: "oven",
                      label: labelText("oven", "Oven"),
                      ph: "e.g. Force 10 gas oven",
                    },
                    {
                      name: "microwave",
                      label: labelText("microwave", "Microwave"),
                      ph: "e.g. Samsung 23L",
                    },
                    {
                      name: "fridge",
                      label: labelText("fridge", "Fridge"),
                      ph: "e.g. Isotherm Cruise 130L",
                    },
                    {
                      name: "freezer",
                      label: labelText("freezer", "Freezer"),
                      ph: "e.g. Isotherm 65L top-loading",
                    },
                    {
                      name: "cooker",
                      label: labelText("cooker", "Cooker"),
                      ph: "e.g. 4-burner gas",
                    },
                    {
                      name: "television",
                      label: labelText("television", "Television"),
                      ph: placeholderText(
                        "television",
                        'e.g. Samsung 32" Smart TV',
                      ),
                    },
                    {
                      name: "cd_player",
                      label: labelText("cdPlayer", "Radio / CD Player"),
                      ph: placeholderText("cdPlayer", "e.g. Fusion MS-RA770"),
                    },
                    {
                      name: "dvd_player",
                      label: labelText("dvdPlayer", "DVD Player"),
                      ph: placeholderText("dvdPlayer", "e.g. Sony DVP-SR210P"),
                    },
                    {
                      name: "satellite_reception",
                      label: labelText(
                        "satelliteReception",
                        "Satellite Reception",
                      ),
                      ph: placeholderText(
                        "satelliteReception",
                        "e.g. KVH TracVision TV5",
                      ),
                    },
                    {
                      name: "water_tank",
                      label: labelText("waterTank", "Water Tank"),
                      ph: placeholderText("waterTank", "200L"),
                    },
                    {
                      name: "water_tank_gauge",
                      label: labelText("waterTankGauge", "Water Tank Gauge"),
                      ph: placeholderText("waterTankGauge", "Yes"),
                    },
                    {
                      name: "water_maker",
                      label: labelText("waterMaker", "Water Maker"),
                      ph: placeholderText("waterMaker", "60 L/h"),
                    },
                    {
                      name: "waste_water_tank",
                      label: labelText("wasteWaterTank", "Waste Water Tank"),
                      ph: placeholderText("wasteWaterTank", "80L"),
                    },
                    {
                      name: "waste_water_tank_gauge",
                      label: labelText("wasteWaterGauge", "Waste Water Gauge"),
                      ph: placeholderText("wasteWaterGauge", "Yes"),
                    },
                    {
                      name: "waste_water_tank_drainpump",
                      label: labelText(
                        "wasteTankDrainPump",
                        "Waste Tank Drain Pump",
                      ),
                      ph: placeholderText("wasteTankDrainPump", "Yes"),
                    },
                    {
                      name: "deck_suction",
                      label: labelText("deckSuction", "Deck Suction"),
                      ph: placeholderText("deckSuction", "Yes"),
                    },
                    {
                      name: "water_system",
                      label: labelText("waterSystem", "Water System"),
                      ph: placeholderText("waterSystem", "Pressurized"),
                    },
                    {
                      name: "hot_water",
                      label: labelText("hotWater", "Hot Water"),
                      ph: placeholderText("hotWater", "Boiler"),
                    },
                    {
                      name: "sea_water_pump",
                      label: labelText("seaWaterPump", "Sea Water Pump"),
                      ph: placeholderText("seaWaterPump", "Yes"),
                    },
                    {
                      name: "deck_wash_pump",
                      label: labelText("deckWashPump", "Deck Wash Pump"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "deck_shower",
                      label: labelText("deckShower", "Deck Shower"),
                      ph: yachtFormText.common.yes,
                    },
                    {
                      name: "hot_air",
                      label: labelText("hotAir", "Hot Air Heating"),
                      ph: placeholderText("hotAir", "Yes"),
                    },
                    {
                      name: "stove",
                      label: labelText("stove", "Stove Heating"),
                      ph: placeholderText("stove", "Yes"),
                    },
                    {
                      name: "central_heating",
                      label: labelText("centralHeating", "Central Heating"),
                      ph: placeholderText("centralHeating", "Yes"),
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
                  <Anchor size={20} className="text-blue-600" />{" "}
                  {labelText("deckEquipment", "Deck Equipment")}
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
                      label: extraLabelText("outdoorCushions", "Outdoor Cushions"),
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
                    <YachtFieldWrapper
                      key={f.name}
                      label={localizeFieldLabel(f.name, f.label)}
                      yachtId={selectedYachtId}
                      fieldName={f.name}
                      correctionLabel={fieldCorrectionLabels[f.name]}
                      onCorrectionLabelChange={(label) =>
                        setFieldCorrectionLabels((p) => ({
                          ...p,
                          [f.name]: label,
                        }))
                      }
                    >
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
                    </YachtFieldWrapper>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Rigging & Sails */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Wind size={20} className="text-blue-600" />{" "}
                  {labelText("riggingSails", "Rigging & Sails")}
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
                    <YachtFieldWrapper
                      key={f.name}
                      label={localizeFieldLabel(f.name, f.label)}
                      yachtId={selectedYachtId}
                      fieldName={f.name}
                      correctionLabel={fieldCorrectionLabels[f.name]}
                      onCorrectionLabelChange={(label) =>
                        setFieldCorrectionLabels((p) => ({
                          ...p,
                          [f.name]: label,
                        }))
                      }
                    >
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
                    </YachtFieldWrapper>
                  ))}
                </div>
              </div>

              {/* Sub-Section: Registry & Comments */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-8">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <FileText size={20} className="text-blue-600" />{" "}
                  {labelText("registryComments", "Registry & Comments")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1 group">
                    <Label>
                      {labelText("ownerComment", "Owner's Comment")}
                    </Label>
                    <textarea
                      name="owners_comment"
                      defaultValue={selectedYacht?.owners_comment || ""}
                      placeholder={step2Placeholder("ownerComment", "Any seller notes or comments...")}
                      className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>{labelText("knownDefects", "Known Defects")}</Label>
                    <textarea
                      name="known_defects"
                      defaultValue={selectedYacht?.known_defects || ""}
                      placeholder={step2Placeholder("knownDefects", "Any known issues or defects...")}
                      className="w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>
                      {labelText("registrationDetails", "Registration Details")}
                    </Label>
                    <Input
                      name="reg_details"
                      defaultValue={selectedYacht?.reg_details}
                      placeholder={step2Placeholder("registrationDetails", "e.g. NL registration, MMSI 244...")}
                      needsConfirmation={needsConfirm("reg_details")}
                    />
                  </div>
                  <div className="space-y-1 group">
                    <Label>{labelText("lastServiced", "Last Serviced")}</Label>
                    <Input
                      name="last_serviced"
                      defaultValue={selectedYacht?.last_serviced}
                      placeholder={step2Placeholder("lastServiced", "e.g. March 2024")}
                      needsConfirmation={needsConfirm("last_serviced")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: TEXT (AI Generated) ──────────────── */}
          {activeStep === 3 && (
            <>
              <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <Globe size={18} className="text-blue-500" />{" "}
                    {labelText("vesselDescription", "Vessel Description")}
                  </h3>

                  {/* Language Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-sm gap-1">
                    {DESCRIPTION_LANGS.map((lang) => (
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
                        {DESCRIPTION_LANGUAGE_BADGES[lang]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-wrap items-end gap-5">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-xs font-bold text-slate-500 uppercase block">
                        AI Tone
                      </label>
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
                      <label className="text-xs font-bold text-slate-500 uppercase block">
                        Min Words
                      </label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={aiMinWords}
                        onChange={(e) =>
                          setAiMinWords(parseInt(e.target.value) || 200)
                        }
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-bold text-slate-500 uppercase block">
                        Max Words
                      </label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={aiMaxWords}
                        onChange={(e) =>
                          setAiMaxWords(parseInt(e.target.value) || 500)
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleRegenerateDescription()}
                      disabled={isRegenerating}
                      className="bg-blue-600 hover:bg-blue-700 text-white gap-2 mt-1 h-9"
                    >
                      {isRegenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      Regenerate
                    </Button>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                      {DESCRIPTION_LANGUAGE_LABELS[selectedLang]}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleDictation}
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                          isDictating
                            ? "bg-red-100 text-red-600 animate-pulse"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                        )}
                        title={
                          isDictating ? "Stop recording" : "Start dictation"
                        }
                      >
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            isDictating ? "bg-red-600" : "bg-slate-600",
                          )}
                        />
                      </button>

                      <div className="flex items-center gap-2">
                        <select
                          className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1 max-w-[150px] truncate"
                          value={selectedVoice}
                          onChange={(e) => setSelectedVoice(e.target.value)}
                        >
                          <option value="">Default Voice</option>
                          {voices.map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if ("speechSynthesis" in window) {
                              if (window.speechSynthesis.speaking) {
                                window.speechSynthesis.cancel();
                                setIsPlayingAudio(false);
                                return;
                              }

                              const utterance = new SpeechSynthesisUtterance(
                                aiTexts[selectedLang],
                              );
                              if (selectedVoice) {
                                const voice = voices.find(
                                  (v) => v.name === selectedVoice,
                                );
                                if (voice) utterance.voice = voice;
                              } else {
                                utterance.lang =
                                  DESCRIPTION_LANGUAGE_LOCALES[selectedLang];
                              }

                              utterance.onend = () => setIsPlayingAudio(false);
                              utterance.onerror = () =>
                                setIsPlayingAudio(false);

                              window.speechSynthesis.speak(utterance);
                              setIsPlayingAudio(true);
                            } else {
                              toast.error(
                                "Text-to-speech not supported in this browser.",
                              );
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors",
                            isPlayingAudio
                              ? "text-red-700 bg-red-50 hover:bg-red-100"
                              : "text-[#003566] bg-blue-50 hover:bg-blue-100",
                          )}
                        >
                          {isPlayingAudio ? (
                            <>
                              <div className="w-2 h-2 bg-red-600 rounded-sm animate-pulse" />{" "}
                              Stop Audio
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
          )}

          {/* ── STEP 4: DISPLAY SETTINGS ─────────────────── */}
          {activeStep === 4 && (
            <>
              {/* NEW SECTION: SCHEDULING AUTHORITY */}
              <div className="space-y-8 bg-slate-50 p-10 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <h3 className="text-[12px] font-black uppercase text-[#003566] tracking-[0.4em] flex items-center gap-3 italic">
                    <Calendar size={20} className="text-blue-600" /> 04.{" "}
                    {labelText("schedulingAuthority", "Scheduling Authority")}
                  </h3>
                  <Button
                    type="button"
                    onClick={addAvailabilityRule}
                    className="bg-[#003566] text-white text-[8px] font-black uppercase tracking-widest px-6 h-8"
                  >
                    {labelText("addSchedulingWindow", "Add Scheduling Window")}
                  </Button>
                </div>

                <div className="space-y-4">
                  {availabilityRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-6 bg-white p-4 border border-slate-100 shadow-sm relative group"
                    >
                      <div className="flex-1 min-w-[300px]">
                        <Label>{labelText("daysOfWeek", "Days of Week")}</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { val: 1, label: t?.weekdays?.monday || "Mon" },
                            { val: 2, label: t?.weekdays?.tuesday || "Tue" },
                            { val: 3, label: t?.weekdays?.wednesday || "Wed" },
                            { val: 4, label: t?.weekdays?.thursday || "Thu" },
                            { val: 5, label: t?.weekdays?.friday || "Fri" },
                            { val: 6, label: t?.weekdays?.saturday || "Sat" },
                            { val: 0, label: t?.weekdays?.sunday || "Sun" },
                          ].map((day) => {
                            const isSelected = rule.days_of_week.includes(
                              day.val,
                            );
                            return (
                              <button
                                key={day.val}
                                type="button"
                                onClick={() => {
                                  const newDays = isSelected
                                    ? rule.days_of_week.filter(
                                        (d) => d !== day.val,
                                      )
                                    : [...rule.days_of_week, day.val].sort(
                                        (a, b) =>
                                          (a === 0 ? 7 : a) - (b === 0 ? 7 : b),
                                      );
                                  updateAvailabilityRule(
                                    idx,
                                    "days_of_week",
                                    newDays,
                                  );
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                                  isSelected
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
                        <Label>
                          {labelText(
                            "startTime",
                            t?.scheduling?.startTime || "Start Time",
                          )}
                        </Label>
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
                        <Label>
                          {labelText(
                            "endTime",
                            t?.scheduling?.endTime || "End Time",
                          )}
                        </Label>
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
                        {labelText(
                          "noSchedulingRules",
                          "No scheduling rules defined yet.",
                        )}
                      </p>
                      <Button
                        type="button"
                        onClick={addAvailabilityRule}
                        className="mt-4 bg-[#003566] text-white text-[10px] font-black uppercase tracking-widest px-6 h-9"
                      >
                        {labelText(
                          "addSchedulingWindow",
                          "Add Scheduling Window",
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 5: REVIEW & SAVE ────────────────────── */}
          {activeStep === 5 && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 p-8 shadow-sm">
                <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
                  <FileText size={18} />{" "}
                  {t?.wizard?.review?.title ||
                    labelText("stepReview", "Review")}
                </h3>

                {/* ── CHECKLIST & COMPLIANCE ── */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <CheckSquare size={16} className="text-blue-600" />
                    Compliance & Documenten
                  </h4>
                  <p className="text-xs text-slate-500 mb-6 max-w-2xl">
                    Hieronder ziet u de benodigde documenten voor dit type
                    schip. U kunt deze nu alvast uploaden, of wachten tot het
                    contract door de klant is getekend.
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Checklist Requirements Preview */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Benodigde Documenten
                      </h5>
                      {fetchingChecklist ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                          <Loader2 size={16} className="animate-spin" />{" "}
                          Laden...
                        </div>
                      ) : checklistTemplates.length > 0 ? (
                        <div className="space-y-2">
                          {checklistTemplates.map((template) => (
                            <div key={template.id} className="mb-4">
                              <p className="font-semibold text-sm text-slate-800 bg-white border border-slate-200 p-2 rounded-md mb-2">
                                {template.name}
                              </p>
                              <div className="space-y-2 pl-4">
                                {template.items?.map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="flex gap-3 text-sm text-slate-600 bg-white p-2 rounded-md border border-slate-100 shadow-sm"
                                  >
                                    <div className="mt-0.5">
                                      <div className="w-4 h-4 rounded border-2 border-slate-300" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-700">
                                        {item.title}
                                      </p>
                                      {item.description && (
                                        <p className="text-xs text-slate-500">
                                          {item.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic py-4">
                          {labelText(
                            "noSpecificDocumentsRequired",
                            "No specific documents required for this type.",
                          )}
                        </p>
                      )}
                    </div>

                    {/* Document Upload Area */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        {labelText("uploadDocuments", "Upload Documents")}
                      </h5>

                      {/* Upload Dropzone */}
                      <label
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors bg-white",
                          isUploadingDocument
                            ? "border-slate-300 opacity-70"
                            : "border-slate-300 hover:bg-slate-50 hover:border-blue-400",
                        )}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploadingDocument ? (
                            <Loader2
                              size={24}
                              className="text-blue-500 animate-spin mb-2"
                            />
                          ) : (
                            <UploadCloud
                              size={24}
                              className="text-slate-400 mb-2"
                            />
                          )}
                          <p className="text-sm font-medium text-slate-600">
                            {isUploadingDocument
                              ? labelText("documentUploading", "Uploading...")
                              : labelText(
                                  "clickOrDropDocument",
                                  "Click or drag a document",
                                )}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            PDF, DOCX, JPG (Max 10MB)
                          </p>
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
                          <h6 className="text-xs font-semibold text-slate-700">
                            {labelText(
                              "uploadedDocuments",
                              "Already uploaded ({count})",
                            ).replace("{count}", String(boatDocuments.length))}
                          </h6>
                          <div className="space-y-2">
                            {boatDocuments.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <FileText
                                    size={16}
                                    className="text-blue-500 shrink-0"
                                  />
                                  <div className="truncate">
                                    <p className="text-sm font-medium text-slate-700 truncate">
                                      {doc.file_path.split("/").pop()}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {new Date(
                                        doc.uploaded_at,
                                      ).toLocaleDateString()}{" "}
                                      • {doc.file_type?.toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={doc.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Eye size={14} />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDocumentDelete(doc.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                  >
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

                <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                  {labelText(
                    "reviewContractNotice",
                    "Save this vessel first. The contract flow opens in the next step after the vessel record is stored.",
                  )}
                </div>

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
                    ? t?.wizard?.review?.create ||
                      labelText("createVessel", "Create Vessel")
                    : t?.wizard?.review?.update ||
                      labelText("updateVessel", "Update Vessel")}
                </Button>
              </div>
            </div>
          )}

          {activeStep === 6 && (
            <div className="space-y-8">
              <div className="bg-white border border-slate-200 p-8 shadow-sm">
                <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
                  <FileText size={18} />{" "}
                  {isClientRole
                    ? labelText("stepBrokerReview", "Broker Review")
                    : labelText("stepContract", "Contract")}
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  {isClientRole
                    ? labelText(
                        "clientReviewStepDescription",
                        "Your vessel has been submitted for broker review. A broker will contact you and send the Signhost contract when everything is ready.",
                      )
                    : labelText(
                        "contractStepDescription",
                        "Manage the contract template, print the PDF, and generate the Signhost-ready contract from this step.",
                      )}
                </p>

                {isClientRole ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-5 text-sm text-blue-900">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                      {labelText(
                        "clientReviewStatusTitle",
                        "Submitted for Review",
                      )}
                    </p>
                    <p className="mt-3">
                      {labelText(
                        "clientReviewStatusDescription",
                        "This vessel is now waiting for broker review. The contract is not shown to clients at this stage.",
                      )}
                    </p>
                    <div className="mt-4 inline-flex items-center rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 shadow-sm">
                      {labelText(
                        "pendingBrokerReview",
                        "Pending broker review",
                      )}
                    </div>
                  </div>
                ) : activeYachtId ? (
                  <SignhostFlow
                    yachtId={Number(activeYachtId)}
                    yachtName={
                      selectedYacht?.boat_name ||
                      (draft?.data as any)?.step2?.selectedYacht?.boat_name ||
                      "Unnamed Vessel"
                    }
                    locationId={
                      selectedYacht?.ref_harbor_id ||
                      (draft?.data as any)?.step2?.selectedYacht
                        ?.ref_harbor_id ||
                      null
                    }
                    yachtData={
                      selectedYacht ||
                      (draft?.data as any)?.step2?.selectedYacht ||
                      null
                    }
                    locationOptions={harbors}
                  />
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    {labelText(
                      "reviewContractNotice",
                      "Save this vessel first. The contract flow opens in the next step after the vessel record is stored.",
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP NAVIGATION ───────────────────────────── */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200 mt-8">
            <Button
              type="button"
              onClick={() => handleStepChange(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 h-11 px-6 text-xs font-bold uppercase tracking-wider disabled:opacity-30"
            >
              <ChevronLeft size={16} className="mr-1" />{" "}
              {t?.wizard?.nav?.previous || labelText("previous", "Previous")}
            </Button>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Step {activeStep} of {wizardSteps.length}
            </span>
            {activeStep < wizardSteps.length && activeStep !== 5 ? (
              <Button
                type="button"
                onClick={() => {
                  markStepComplete(activeStep);
                  handleStepChange(activeStep + 1);
                }}
                disabled={
                  (isNewMode && !canProceedFromStep1 && activeStep === 1) ||
                  (activeStep === 2 && !hasSelectedHarbor)
                }
                className={cn(
                  "h-11 px-6 text-xs font-bold uppercase tracking-wider",
                  (isNewMode && !canProceedFromStep1 && activeStep === 1) ||
                    (activeStep === 2 && !hasSelectedHarbor)
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-[#003566] text-white hover:bg-blue-800",
                )}
              >
                {isNewMode && !canProceedFromStep1 && activeStep === 1 ? (
                  <>
                    {t?.wizard?.nav?.runExtractionFirst ||
                      labelText("approveImagesFirst", "Approve Images First")}
                  </>
                ) : activeStep === 2 && !hasSelectedHarbor ? (
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
                  isClientRole
                    ? "submitForBrokerReview"
                    : "continueToContract",
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
    </div>
  );
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

function hasFilledFieldValue(
  value: unknown,
  options?: { treatUnknownAsEmpty?: boolean },
): boolean {
  const treatUnknownAsEmpty = options?.treatUnknownAsEmpty ?? false;

  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;

  const normalized = String(value).trim();
  if (!normalized) return false;
  if (treatUnknownAsEmpty && normalized.toLowerCase() === "unknown") {
    return false;
  }

  return true;
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    needsConfirmation?: boolean;
    confidence?: number;
  },
) {
  const { needsConfirmation, confidence, ...inputProps } = props;
  const [hasValue, setHasValue] = useState(() =>
    hasFilledFieldValue(inputProps.value ?? inputProps.defaultValue),
  );

  useEffect(() => {
    setHasValue(
      hasFilledFieldValue(inputProps.value ?? inputProps.defaultValue),
    );
  }, [inputProps.value, inputProps.defaultValue]);

  const highlighted = Boolean(needsConfirmation) || hasValue;

  return (
    <div className="relative">
      <input
        {...inputProps}
        onChange={(event) => {
          setHasValue(hasFilledFieldValue(event.target.value));
          inputProps.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          "placeholder:text-slate-400 placeholder:font-normal",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
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

function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    needsConfirmation?: boolean;
    treatUnknownAsEmpty?: boolean;
  },
) {
  const {
    needsConfirmation,
    treatUnknownAsEmpty = false,
    defaultValue,
    value,
    onChange,
    className,
    children,
    ...selectProps
  } = props;
  const [currentValue, setCurrentValue] = useState(value ?? defaultValue ?? "");

  useEffect(() => {
    setCurrentValue(value ?? defaultValue ?? "");
  }, [value, defaultValue]);

  const highlighted =
    Boolean(needsConfirmation) ||
    hasFilledFieldValue(currentValue, { treatUnknownAsEmpty });

  return (
    <div className="relative">
      <select
        {...selectProps}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setCurrentValue(event.target.value);
          onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          className,
        )}
      >
        {children}
      </select>
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ confirm
        </span>
      )}
    </div>
  );
}

function YachtFieldWrapper({
  children,
  label,
  yachtId,
  fieldName,
  correctionLabel,
  onCorrectionLabelChange,
}: {
  children: React.ReactNode;
  label: string;
  yachtId?: number;
  fieldName: string;
  correctionLabel?: CorrectionLabel | null;
  onCorrectionLabelChange?: (label: CorrectionLabel | null) => void;
}) {
  const isCorrection = correctionLabel !== undefined;

  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          {label}
          {yachtId && (
            <FieldHistoryPopover
              yachtId={yachtId}
              fieldName={fieldName}
              label={label}
            />
          )}
        </Label>
      </div>
      {children}
      {isCorrection && onCorrectionLabelChange && (
        <FieldCorrectionControls
          activeLabel={correctionLabel}
          onSelect={(label) => onCorrectionLabelChange(label)}
          onClear={() => onCorrectionLabelChange(null)}
        />
      )}
    </div>
  );
}

function TriStateSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    needsConfirmation?: boolean;
    yachtId?: number;
    fieldName?: string;
    label?: string;
  },
) {
  const locale = useLocale();
  const formText =
    YACHT_FORM_TEXT[locale as keyof typeof YACHT_FORM_TEXT] ??
    YACHT_FORM_TEXT.en;
  const {
    needsConfirmation,
    defaultValue,
    yachtId,
    fieldName,
    label,
    ...selectProps
  } = props;
  const normalizedDefault = normalizeTriStateValue(defaultValue);
  const [currentValue, setCurrentValue] = useState<"yes" | "no" | null>(
    normalizedDefault,
  );

  useEffect(() => {
    setCurrentValue(normalizedDefault);
  }, [normalizedDefault]);

  const highlighted =
    Boolean(needsConfirmation) ||
    hasFilledFieldValue(currentValue, { treatUnknownAsEmpty: true });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-1">
        {yachtId && fieldName && label && !selectProps.children && (
          <FieldHistoryPopover
            yachtId={yachtId}
            fieldName={fieldName}
            label={label}
          />
        )}
      </div>
      <select
        {...selectProps}
        defaultValue={normalizedDefault ?? undefined}
        onChange={(event) => {
          setCurrentValue(normalizeTriStateValue(event.target.value));
          selectProps.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          selectProps.className,
        )}
      >
        <option value="yes">{formText.common.yes}</option>
        <option value="no">{formText.common.no}</option>
        <option value="unknown">{formText.common.unknown}</option>
      </select>
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ {formText.common.confirm}
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
