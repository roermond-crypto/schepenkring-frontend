"use client";

import React from "react";
import {
  Images,
  Ship,
  Shield,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Sparkles,
  Upload,
  GripVertical,
  Wand2,
  Trash,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  WifiOff,
  Video,
  ArrowRight,
  Eye,
  Clock,
  Box,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardInput as Input } from "./WizardHelpers";
import { Label } from "@/components/ui/label";
import { SelectField } from "./WizardHelpers";
import { CatalogAutocomplete } from "@/components/ui/CatalogAutocomplete";
import { cn } from "@/lib/utils";
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
} from "@hello-pangea/dnd";
import { PipelineImage } from "@/hooks/useImagePipeline";

interface WizardStep1Props {
  // Localization & Dicts
  labelText: (key: any, fallback: string) => any;
  role: string;
  isClientRole: boolean;
  isNewMode: boolean;
  isOnline: boolean;

  // Identification State
  step1Type: string;
  setStep1Type: (val: string) => void;
  step1Category: string;
  setStep1Category: (val: string) => void;
  step1Brand: string;
  setStep1Brand: (val: string) => void;
  selectedBrandId: number | null;
  setSelectedBrandId: (val: number | null) => void;
  step1Model: string;
  setStep1Model: (val: string) => void;
  step1Year: string;
  setStep1Year: (val: string) => void;
  boatHint: string;
  setBoatHint: (val: string) => void;

  // Matching State
  isMatchingBoat: boolean;
  matchedBoat: any;

  // AI Extraction State
  isExtracting: boolean;
  hasCompletedAiExtraction: boolean;
  handleAiExtract: (options?: {
    background?: boolean;
    navigateToStep2?: boolean;
    speedMode?: "fast" | "balanced" | "deep";
  }) => Promise<boolean>;

  // Image Upload Props
  shouldShowImageUploadDropzone: boolean;
  hasInFlightImageUploads: boolean;
  MAX_IMAGES_UPLOAD: number;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Image Grid Props
  shouldShowImageGrid: boolean;
  displayTotalImageCount: number;
  displayReadyForReviewCount: number;
  displayApprovedCount: number;
  isReorderingImages: boolean;
  imageGridDensity: "regular" | "compact" | "dense";
  setImageGridDensity: (val: "regular" | "compact" | "dense") => void;
  canManualSortImages: boolean;
  openManualSortDialog: () => void;
  handleAutoSortImages: () => Promise<void>;
  isAutoSortingImages: boolean;
  setDeleteAllImagesDialogOpen: (val: boolean) => void;
  isDeletingAllImages: boolean;

  // Pipeline Props
  pipeline: any;
  reviewImages: PipelineImage[];
  gridClassName: string;
  getPipelineImageSrc: (img: PipelineImage) => string;
  handlePipelineImageError: (img: PipelineImage) => void;
  setSelectedLightboxImageId: (id: number | null) => void;
  isPipelineImageFallbackExhausted: (img: PipelineImage) => boolean;
  getPipelineStatusLabel: (status: any) => string;
  buildImageAiNotes: (img: PipelineImage) => string[];
  handlePipelineDragEnd: (result: any) => void;

  // Manual Sort Props
  manualSortDialogOpen: boolean;
  setManualSortDialogOpen: (val: boolean) => void;
  manualSortImages: PipelineImage[];
  handleManualSortDragEnd: (result: any) => void;
  isSavingManualSort: boolean;
  handleSaveManualSort: () => Promise<void>;

  // Lightbox Props
  selectedLightboxImage: PipelineImage | null;
  selectedLightboxIndex: number;
  moveLightboxImage: (dir: "prev" | "next") => void;

  // Documents Props
  referenceBoatDocuments: any[];
  resolveBoatDocumentUrl: (doc: any) => string | null;
  handleDocumentDelete: (id: number) => void;
  handleReferenceDocumentDragEnd: (result: any) => void;
  isUploadingDocument: boolean;
  documentDropTarget: string | null;
  handleDocumentDragOver: (e: React.DragEvent, target: string) => void;
  handleDocumentDragLeave: (e: React.DragEvent, target: string) => void;
  handleDocumentDrop: (e: React.DragEvent, target: string) => Promise<void>;
  handleDocumentInputChange: (e: React.ChangeEvent<HTMLInputElement>, target: string) => Promise<void>;

  // Video Props
  showStepOneVideoSection: boolean;
  marketingVideos: any[];
  isGeneratingMarketingVideo: boolean;
  handleGenerateMarketingVideo: (force: boolean) => void;
  isUploadingVideo: boolean;
  handleVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPublishingVideo: number | null;
  handleNotifyMarketingVideoOwner: (id: number) => void;
  socialLibraryHref: string;
  loadMarketingVideos: (id: string | number) => void;
  yachtId: string | number;
  createdYachtId: number | null;
  handleVideoPublish: (id: number) => void;
  handleVideoDelete: (id: number) => void;
  boatVideos: any[];
  t: any;
  locale: string;

  // Navigation
  setActiveStep: (step: number) => void;
  offlineImages: any[];
  router: any;
  canProceedFromStep1: boolean;
  shouldRefreshAiExtraction: boolean;
  toast: any;
}

export const WizardStep1: React.FC<WizardStep1Props> = ({
  labelText,
  role,
  isClientRole,
  isNewMode,
  isOnline,
  step1Type,
  setStep1Type,
  step1Category,
  setStep1Category,
  step1Brand,
  setStep1Brand,
  selectedBrandId,
  setSelectedBrandId,
  step1Model,
  setStep1Model,
  step1Year,
  setStep1Year,
  boatHint,
  setBoatHint,
  isMatchingBoat,
  matchedBoat,
  isExtracting,
  hasCompletedAiExtraction,
  handleAiExtract,
  shouldShowImageUploadDropzone,
  hasInFlightImageUploads,
  MAX_IMAGES_UPLOAD,
  handleImageUpload,
  shouldShowImageGrid,
  displayTotalImageCount,
  displayReadyForReviewCount,
  displayApprovedCount,
  isReorderingImages,
  imageGridDensity,
  setImageGridDensity,
  canManualSortImages,
  openManualSortDialog,
  handleAutoSortImages,
  isAutoSortingImages,
  setDeleteAllImagesDialogOpen,
  isDeletingAllImages,
  pipeline,
  reviewImages,
  gridClassName,
  getPipelineImageSrc,
  handlePipelineImageError,
  setSelectedLightboxImageId,
  isPipelineImageFallbackExhausted,
  getPipelineStatusLabel,
  buildImageAiNotes,
  handlePipelineDragEnd,
  manualSortDialogOpen,
  setManualSortDialogOpen,
  manualSortImages,
  handleManualSortDragEnd,
  isSavingManualSort,
  handleSaveManualSort,
  selectedLightboxImage,
  selectedLightboxIndex,
  moveLightboxImage,
  referenceBoatDocuments,
  resolveBoatDocumentUrl,
  handleDocumentDelete,
  handleReferenceDocumentDragEnd,
  isUploadingDocument,
  documentDropTarget,
  handleDocumentDragOver,
  handleDocumentDragLeave,
  handleDocumentDrop,
  handleDocumentInputChange,
  showStepOneVideoSection,
  marketingVideos,
  isGeneratingMarketingVideo,
  handleGenerateMarketingVideo,
  isUploadingVideo,
  handleVideoUpload,
  isPublishingVideo,
  handleNotifyMarketingVideoOwner,
  socialLibraryHref,
  loadMarketingVideos,
  yachtId,
  createdYachtId,
  handleVideoPublish,
  handleVideoDelete,
  boatVideos,
  t,
  locale,
  setActiveStep,
  offlineImages,
  router,
  canProceedFromStep1,
  shouldRefreshAiExtraction,
  toast,
}) => {
  const imagesApproved = displayApprovedCount > 0 && displayApprovedCount === displayTotalImageCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-bold text-[#003566] flex items-center gap-3">
            <Images size={22} className="text-blue-600" />{" "}
            {labelText("stepOneTitle", "Vessel Assets & AI Extraction")}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {labelText(
              "stepOneDescription",
              "Upload images -> system auto-optimizes -> approve -> then AI fills all form fields."
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

      {/* ── Boat Classification & Identification ── */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-visible z-20 relative">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 rounded-t-lg">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Shield size={16} className="text-blue-600" />
            {labelText("vesselIdentification", "Vessel Identification")}
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {labelText(
              "classificationDescription" as any,
              "Select the type of boat to show the right fields",
            )}
          </p>
        </div>
        <div className="p-6 space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 group">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-blue-600 transition-colors">
              {labelText("boatType", "Boat Type")}
            </Label>
            <CatalogAutocomplete
              endpoint="/api/autocomplete/types"
              name="boat_type"
              placeholder="e.g. Motor Yacht, Sailing Boat"
              defaultValue={step1Type}
              onSelect={(_, name) => setStep1Type(name)}
            />
          </div>

          <div className="space-y-2 group">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-blue-600 transition-colors">
              {labelText("boatCategory", "Boat Category")}
            </Label>
            <SelectField
              name="boat_category"
              value={step1Category}
              onChange={(e) => setStep1Category(e.target.value)}
            >
              <option value=""></option>
              <option value="Motorboat">Motorboat</option>
              <option value="Sailboat">Sailboat</option>
              <option value="RIB / Inflatable">RIB / Inflatable</option>
              <option value="Watercraft">Watercraft</option>
              <option value="Houseboat">Houseboat</option>
              <option value="Commercial Vessel">Commercial Vessel</option>
            </SelectField>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 group">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-blue-600 transition-colors">
              {labelText("brand", "Brand")}
            </Label>
            <CatalogAutocomplete
              endpoint="/api/autocomplete/brands"
              name="brand"
              placeholder="e.g. Beneteau"
              defaultValue={step1Brand}
              onSelect={(id, name) => {
                setStep1Brand(name);
                setSelectedBrandId(Number(id));
              }}
            />
          </div>

          <div className="space-y-2 group">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-blue-600 transition-colors">
              {labelText("model", "Model")}
            </Label>
            <CatalogAutocomplete
              endpoint="/api/autocomplete/models"
              name="model"
              placeholder="e.g. Oceanis 38"
              defaultValue={step1Model}
              dependsOn="brand_id"
              dependsOnValue={selectedBrandId}
              onSelect={(_, name) => setStep1Model(name)}
            />
          </div>

          <div className="space-y-2 group">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-blue-600 transition-colors">
              {labelText("year", "Year")}
            </Label>
            <Input
              type="number"
              value={step1Year}
              onChange={(e) => setStep1Year(e.target.value)}
              placeholder="e.g. 2016"
              className="bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 h-11 transition-all"
            />
          </div>
        </div>

        {/* Match Indicator */}
        {step1Brand.trim().length >= 2 && (
          <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
            {isMatchingBoat ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100">
                <Loader2 size={12} className="animate-spin text-blue-500" />
                {labelText("matchingBoat", "Searching database...")}
              </div>
            ) : matchedBoat?.matched ? (
              <div
                className={cn(
                  "flex flex-col gap-1 text-xs px-4 py-3 rounded-xl border transition-all",
                  matchedBoat.match_type === "exact"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/50"
                    : "bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-100/50"
                )}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2">
                    {matchedBoat.match_type === "exact" ? (
                      <CheckCircle size={14} className="text-emerald-600" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-600" />
                    )}
                    {matchedBoat.match_type === "exact"
                      ? labelText("boatMatchFound", "Boat found in database")
                      : labelText("boatMatchPartial", "Partial match found")}
                  </span>
                  <span className="opacity-75 bg-white/50 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    {matchedBoat.similar_boats_count}{" "}
                    {labelText("similarBoatsFound", "similar boats")}
                  </span>
                </div>
                <span className="ml-6 text-[11px] font-medium opacity-80 leading-relaxed">
                  {matchedBoat.message}
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Additional Hint Textarea */}
        <div className="space-y-3 relative z-10 border-t border-slate-100 pt-6">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <FileText size={14} className="text-blue-500" />
            {labelText("vesselDescriptionHelp", "Vessel Description")}{" "}
            <span className="text-slate-400 font-normal normal-case tracking-normal">
              {labelText("(optional but recommended)", "(optional but recommended)")}
            </span>
          </Label>
          <textarea
            value={boatHint}
            onChange={(e) => setBoatHint(e.target.value)}
            placeholder={labelText(
              "boatHintPlaceholder",
              'Short notes (e.g. "VAT paid, CE docs available, first owner")'
            )}
            className="w-full h-24 bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none resize-none transition-all relative z-10"
            disabled={isExtracting}
          />
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
            <Sparkles size={12} className="text-blue-400 animate-pulse" />{" "}
            {labelText(
              "boatIdentificationHint",
              "Adding brand/model/year helps the AI find similar boats for better results."
            )}
          </p>
        </div>
        </div>
      </div>

      {/* ── Image Upload & Pipeline Grid ── */}
      {shouldShowImageUploadDropzone && (
        <label
          className={cn(
            "h-64 lg:h-80 bg-white border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all group",
            hasInFlightImageUploads
              ? "border-blue-400 bg-blue-50/40 cursor-wait"
              : "border-slate-300 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50"
          )}
        >
          {hasInFlightImageUploads ? (
            <Loader2 size={48} className="text-blue-400 mb-4 animate-spin" />
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
                : "text-slate-400 group-hover:text-blue-600"
            )}
          >
            {hasInFlightImageUploads
              ? labelText("uploadingImages", "Uploading images...")
              : labelText(
                  "clickToAddImages",
                  `Click to add up to ${MAX_IMAGES_UPLOAD} images`
                ).replace("{count}", String(MAX_IMAGES_UPLOAD))}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {hasInFlightImageUploads
              ? labelText(
                  "uploadAreaPendingHelp",
                  "This area stays visible until the current upload finishes."
                )
              : labelText(
                  "uploadAreaFormatsHelp",
                  "JPEG, PNG, HEIC auto-optimized by AI"
                )}
          </p>
          <p className="text-xs text-blue-500 mt-1 font-medium">
            {labelText(
              "uploadAreaHint",
              "Include HIN plates, docs, registration, engine hours"
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
                  {displayReadyForReviewCount > 0 && (
                    <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full min-h-10 inline-flex items-center">
                      {displayReadyForReviewCount}{" "}
                      {labelText("readyForReviewBadge", "ready for review")}
                    </span>
                  )}
                  {displayApprovedCount > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full min-h-10 inline-flex items-center">
                      ✓ {displayApprovedCount} {labelText("approvedBadge", "approved")}
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
                {(["regular", "compact", "dense"] as const).map((density, idx) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => setImageGridDensity(density)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-bold transition-colors",
                      imageGridDensity === density ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {[4, 6, 8][idx]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={openManualSortDialog}
                disabled={!canManualSortImages || isReorderingImages}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <GripVertical size={12} />
                {labelText("manualSortImages", "Manual sort")}
              </button>

              <button
                type="button"
                onClick={() => void handleAutoSortImages()}
                disabled={isAutoSortingImages || reviewImages.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
              >
                {isAutoSortingImages ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {labelText("aiAutoSort", "AI auto-sort")}
              </button>

              <button
                type="button"
                onClick={() => setDeleteAllImagesDialogOpen(true)}
                disabled={reviewImages.length === 0 || isDeletingAllImages}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
              >
                {isDeletingAllImages ? <Loader2 size={12} className="animate-spin" /> : <Trash size={12} />}
              </button>

              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Upload size={12} /> {labelText("addMoreImages", "Add More")}
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
            <Droppable droppableId="pipeline-image-grid" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("grid gap-4", gridClassName)}
                >
                  {reviewImages.map((img, index) => {
                    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                      processing: { bg: "bg-blue-500", text: "text-white", label: `⏳ ${labelText("processingStatusLabel", "Processing...")}` },
                      ready_for_review: { bg: "bg-amber-500", text: "text-white", label: `👁 ${labelText("readyForReviewStatusLabel", "Ready for Review")}` },
                      approved: { bg: "bg-emerald-500", text: "text-white", label: `✓ ${labelText("approvedStatusLabel", "Approved")}` },
                      processing_failed: { bg: "bg-red-500", text: "text-white", label: `✕ ${labelText("failedStatusLabel", "Failed")}` },
                    };
                    const sc = statusConfig[img.status] || statusConfig.processing;

                    return (
                      <Draggable key={img.id} draggableId={`pipeline-image-${img.id}`} index={index}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              "relative group bg-white border shadow-sm overflow-hidden rounded-xl",
                              img.status === "approved" ? "border-emerald-300 ring-1 ring-emerald-200" :
                              img.status === "ready_for_review" ? "border-amber-300" :
                              img.status === "processing" ? "border-blue-200" : "border-red-300"
                            )}
                          >
                            <div className="aspect-square relative flex bg-slate-100 overflow-hidden">
                              <img
                                src={getPipelineImageSrc(img)}
                                alt={img.original_name || `Yacht image ${index + 1}`}
                                onClick={() => setSelectedLightboxImageId(img.id)}
                                className={cn(
                                  "w-full h-full cursor-zoom-in object-cover transition-opacity",
                                  img.status === "processing" && "opacity-60",
                                  isPipelineImageFallbackExhausted(img) && "opacity-50 grayscale"
                                )}
                                onError={() => handlePipelineImageError(img)}
                              />
                              {img.status === "processing" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                                  <Loader2 size={24} className="animate-spin text-blue-600" />
                                </div>
                              )}
                              <div className={`absolute top-2 left-2 ${sc.bg} ${sc.text} text-[9px] font-bold px-2 py-1 rounded-md shadow-md z-20`}>
                                {sc.label}
                              </div>
                              <div {...dragProvided.dragHandleProps} className="absolute right-2 bottom-2 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md backdrop-blur active:cursor-grabbing">
                                <GripVertical size={14} />
                              </div>
                              {img.quality_label && img.status !== "processing" && (
                                <div className={cn("absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-1 rounded-md backdrop-blur-sm z-20 shadow-md", (img.quality_score ?? 0) < 70 ? "bg-red-500/90" : "bg-black/60")}>
                                  {img.quality_label}
                                </div>
                              )}
                            </div>
                            <div className="p-3 space-y-2">
                              {img.quality_score !== null && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{labelText("aiReviewScore", "AI review score")}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{img.quality_score}/100</span>
                                  </div>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={cn("h-full transition-all", (img.quality_score ?? 0) >= 70 ? "bg-emerald-500" : (img.quality_score ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${img.quality_score}%` }} />
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">{labelText("keepOriginal", "Keep original")}</span>
                                <button type="button" onClick={() => pipeline.toggleKeepOriginal(img.id)} className={cn("w-8 h-4 rounded-full relative transition-colors", img.keep_original ? "bg-blue-500" : "bg-slate-200")}>
                                  <div className={cn("w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform", img.keep_original ? "translate-x-4" : "translate-x-0.5")} />
                                </button>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {img.status === "ready_for_review" && (
                                  <button onClick={() => pipeline.approveImage(img.id)} className="flex-1 bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded-md flex items-center justify-center gap-1"><Check size={12} /> Approve</button>
                                )}
                                <button onClick={() => pipeline.deleteImage(img.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-md"><Trash size={12} /></button>
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
        </div>
      )}

      {/* Manual Sort Dialog */}
      <Dialog open={manualSortDialogOpen} onOpenChange={setManualSortDialogOpen}>
        <DialogContent className="flex h-[min(94vh,980px)] w-[min(96vw,1400px)] max-w-none flex-col overflow-hidden rounded-[32px] p-0 shadow-2xl">
          <DialogHeader className="p-8 border-b">
            <DialogTitle className="text-3xl font-bold">Manual Sort</DialogTitle>
            <DialogDescription>Drag images to control the order they appear in the gallery.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <DragDropContext onDragEnd={handleManualSortDragEnd}>
              <Droppable droppableId="manual-image-sort-list">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                    {manualSortImages.map((img, index) => (
                      <Draggable key={img.id} draggableId={`manual-image-sort-${img.id}`} index={index}>
                        {(dragProvided) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className="flex items-center gap-6 bg-white p-4 rounded-2xl border shadow-sm group">
                            <div className="text-2xl font-bold text-slate-300 w-12">{index + 1}</div>
                            <img src={getPipelineImageSrc(img)} alt="" className="w-24 h-24 rounded-xl object-cover" />
                            <div className="flex-1 font-semibold">{img.original_name}</div>
                            <GripVertical className="text-slate-300" />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
          <div className="p-6 border-t flex justify-end gap-4 bg-white">
            <Button variant="outline" onClick={() => setManualSortDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveManualSort} disabled={isSavingManualSort}>
              {isSavingManualSort ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
              Save Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedLightboxImage} onOpenChange={(open) => !open && setSelectedLightboxImageId(null)}>
        <DialogContent className="max-w-[min(96vw,1240px)] p-0 rounded-[32px] overflow-hidden bg-white">
          {selectedLightboxImage && (
            <div className="flex flex-col max-h-[92vh]">
              <div className="relative bg-slate-900 flex items-center justify-center p-12 min-h-[50vh]">
                <img src={getPipelineImageSrc(selectedLightboxImage)} alt="" className="max-h-[60vh] object-contain" />
                <button onClick={() => moveLightboxImage("prev")} className="absolute left-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronLeft /></button>
                <button onClick={() => moveLightboxImage("next")} className="absolute right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronRight /></button>
                <DialogClose className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X size={18} /></DialogClose>
              </div>
              <div className="p-8 space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">{selectedLightboxImage.original_name}</DialogTitle>
                  <DialogDescription>AI Review Details</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 rounded-2xl border bg-slate-50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Quality Score</p>
                    <p className="text-4xl font-bold mt-2">{selectedLightboxImage.quality_score}/100</p>
                    <div className="h-2 w-full bg-slate-200 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${selectedLightboxImage.quality_score}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Comments</p>
                    {buildImageAiNotes(selectedLightboxImage).map(note => (
                      <div key={note} className="text-sm p-3 bg-blue-50 rounded-lg text-blue-800">{note}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reference Documents Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b pb-5">
          <h4 className="text-sm font-bold flex items-center gap-2"><FileText size={16} className="text-blue-600" /> Reference Documents</h4>
          <p className="text-sm text-slate-500 mt-1">Upload invoices, brochures, or spec sheets for AI extraction.</p>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,360px)_1fr]">
          <label
            onDragOver={(e) => handleDocumentDragOver(e, "ai_reference")}
            onDrop={(e) => void handleDocumentDrop(e, "ai_reference")}
            className={cn(
              "flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
              isUploadingDocument ? "opacity-50 cursor-wait" : "cursor-pointer hover:bg-blue-50/50"
            )}
          >
            {isUploadingDocument ? <Loader2 className="animate-spin text-blue-500" /> : <UploadCloud size={32} className="text-slate-300" />}
            <p className="text-sm font-semibold mt-4">Click or drag files here</p>
            <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,image/*" onChange={(e) => void handleDocumentInputChange(e, "ai_reference")} disabled={isUploadingDocument} />
          </label>
          <div className="bg-slate-50 rounded-2xl p-4">
            <DragDropContext onDragEnd={handleReferenceDocumentDragEnd}>
              <Droppable droppableId="reference-documents" direction="vertical">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3"
                  >
                    {referenceBoatDocuments.map((doc, index) => (
                      <Draggable
                        key={`reference-document-${doc.id}`}
                        draggableId={`reference-document-${doc.id}`}
                        index={index}
                      >
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                {...dragProvided.dragHandleProps}
                                className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-full bg-slate-100 text-slate-500 active:cursor-grabbing"
                                title="Drag to reorder"
                              >
                                <GripVertical size={14} />
                              </div>
                              <FileText className="shrink-0 text-blue-500" />
                              <span className="truncate text-sm font-medium">
                                {doc.file_path.split("/").pop()}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={resolveBoatDocumentUrl(doc) || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600"
                              >
                                <Eye size={14} />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDocumentDelete(doc.id)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      </div>

      {/* Video Section */}
      {showStepOneVideoSection && role === "admin" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-8 shadow-sm">
          <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
            <div>
              <h3 className="font-bold flex items-center gap-2">
                <Video size={18} className="text-blue-500" /> Marketing Videos
              </h3>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">
                Manage Videos & Social Posting
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleGenerateMarketingVideo(false)}
                disabled={isGeneratingMarketingVideo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-[10px]"
              >
                {isGeneratingMarketingVideo ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Sparkles size={14} className="mr-2" />
                )}
                Generate from images
              </Button>
              <label className="bg-[#003566] hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-[10px] px-6 py-2.5 rounded cursor-pointer flex items-center gap-2">
                <Upload size={14} /> Upload MP4
                <input
                  type="file"
                  className="hidden"
                  accept="video/mp4"
                  onChange={handleVideoUpload}
                  disabled={isUploadingVideo}
                />
              </label>
            </div>
          </div>
          <div className="p-6">
            {marketingVideos.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">
                    Generated marketing videos
                  </p>
                  <button
                    type="button"
                    className="text-[10px] uppercase font-black tracking-[0.2em] text-[#003566]"
                    onClick={() => loadMarketingVideos(createdYachtId || yachtId)}
                  >
                    Refresh
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
                            Marketing Video #{video.id}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Template: {video.template_type || "vertical_slideshow_v1"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em]",
                            video.status === "ready" || video.status === "published"
                              ? "bg-emerald-100 text-emerald-700"
                              : video.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {video.status || "queued"}
                        </span>
                      </div>
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
                          onClick={() => handleNotifyMarketingVideoOwner(video.id)}
                          disabled={isPublishingVideo === video.id || !video.video_url}
                        >
                          {isPublishingVideo === video.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles size={12} className="mr-2" />
                          )}
                          Send WhatsApp
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
                          alt=""
                        />
                      ) : (
                        <Video size={32} />
                      )}
                    </div>
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="flex justify-between items-start">
                        <p className="text-[11px] font-black text-[#003566] uppercase tracking-wider">
                          Status:
                          <span
                            className={cn(
                              "ml-2 px-2 py-0.5 rounded text-[9px] text-white",
                              video.status === "published"
                                ? "bg-emerald-500"
                                : video.status === "processing"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                            )}
                          >
                            {video.status}
                          </span>
                        </p>
                      </div>
                      <div className="pt-4 flex flex-wrap gap-2 mt-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="text-[10px] h-8 px-3 font-bold uppercase tracking-wider bg-white"
                          onClick={() =>
                            router.push(
                              `/${locale}/dashboard/${role}/yachts/${yachtId}/video-settings`
                            )
                          }
                          disabled={isNewMode && !createdYachtId}
                        >
                          Social Settings
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

      {/* ── Approval Gate ── */}
      {pipeline.stats.total > 0 && (
        <div
          className={cn(
            "mt-6 rounded-xl border p-5",
            imagesApproved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={cn("text-sm font-bold", imagesApproved ? "text-emerald-700" : "text-amber-700")}>
                {isNewMode
                  ? imagesApproved
                    ? canProceedFromStep1
                      ? labelText("imagesApprovedUnlocked", "✅ Images approved - Step 2 is unlocked!")
                      : labelText("imagesApprovedExtractionRunning", "🤖 Images approved. AI extraction is still running...")
                    : labelText("approvedMinimumImages", "⏳ {approved} of {minimum} minimum images approved")
                        .replace("{approved}", String(pipeline.stats.approved))
                        .replace("{minimum}", String(pipeline.stats.min_required))
                  : labelText("editManifestUnlocked", "ℹ️ Edit Manifest mode - Step 2 is unlocked with existing boat details.")}
              </p>
              {isNewMode && !imagesApproved && (
                <p className="mt-1 text-xs text-amber-600">
                  {labelText("stepTwoUnlockHint", "Step 2 opens after image approval. AI extraction starts when you click Approve All.")}
                  {pipeline.stats.processing > 0 &&
                    ` ${labelText("stillProcessingCount", "{count} still processing...").replace("{count}", String(pipeline.stats.processing))}`}
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
                      if (hasCompletedAiExtraction && !shouldRefreshAiExtraction) {
                        setActiveStep(2);
                      } else {
                        const extractionOk = await handleAiExtract({
                          background: false,
                          navigateToStep2: true,
                          speedMode: "balanced",
                        });
                        if (!extractionOk) {
                          toast(
                            labelText(
                              "aiTimedOutStepTwo",
                              "AI extraction timed out. Step 2 is unlocked; you can continue manually and retry AI later."
                            ),
                            { icon: "⚠️" }
                          );
                          setActiveStep(2);
                        }
                      }
                    } else {
                      toast.success(
                        labelText("imagesApprovedManualAi", "Images approved. You can manually run AI autofill if needed.")
                      );
                    }
                  } else {
                    toast.success(labelText("imagesApprovedShort", "Images approved."));
                  }
                }}
                disabled={isNewMode && isExtracting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
              >
                <CheckCircle size={16} /> {labelText("approveAllImages", "Approve All")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Extraction Bar */}
      <div className="flex flex-col items-center gap-4 py-8 border-t">
        {!isOnline ? (
          <div className="bg-amber-50 border-amber-200 p-4 rounded-xl flex gap-3 text-sm text-amber-800">
             <WifiOff />
             <p>Offline: Fill details manually or skip to Step 2.</p>
             <button onClick={() => setActiveStep(2)} className="bg-amber-600 text-white px-4 py-1 rounded-lg">Skip</button>
          </div>
        ) : (
          <>
            {isExtracting ? (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="font-bold text-blue-600">Gemini is analyzing your assets...</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleAiExtract();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-12 py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center gap-3 uppercase tracking-widest"
              >
                <Sparkles /> Start AI Extraction
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
