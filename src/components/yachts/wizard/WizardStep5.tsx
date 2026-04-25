"use client";

import React from "react";
import { 
  FileText, 
  CheckSquare, 
  Loader2, 
  UploadCloud, 
  Eye, 
  Trash, 
  CheckCircle,
  Globe,
  Save,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WizardStep5Props {
  labelText: (key: any, fallback: string) => any;
  t: any;
  role: string;
  isClientRole: boolean;
  fetchingChecklist: boolean;
  checklistTemplates: any[];
  isUploadingDocument: boolean;
  documentDropTarget: string | null;
  complianceBoatDocuments: any[];
  handleDocumentDragOver: (e: React.DragEvent, target: string) => void;
  handleDocumentDragLeave: (e: React.DragEvent, target: string) => void;
  handleDocumentDrop: (e: React.DragEvent, target: string) => Promise<void>;
  handleDocumentInputChange: (e: React.ChangeEvent<HTMLInputElement>, target: string) => Promise<void>;
  resolveBoatDocumentUrl: (doc: any) => string | null;
  handleDocumentDelete: (id: number) => void;
  
  // Client Review Props
  normalizedClientContractStatus: string;
  clientContractDescriptionKey: string;
  clientBoatApproved: boolean;
  clientSignhostLoading: boolean;
  clientContractStatusKey: string;
  effectiveClientSignhostUrl: string | null;
  handleOpenClientSignhost: () => void;
  handleStepChange: (step: number) => void;

  // Internal Review Props
  activeYachtId: number | null;
  marktplaatsListing: any;
  setMarktplaatsListing: React.Dispatch<React.SetStateAction<any>>;
  sellerPublicationOptions: any[];
  selectedPublicationPlatforms: string[];
  setSelectedPublicationPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  isSavingMarktplaatsListing: boolean;
  isRunningMarktplaatsAction: string | null;
  persistMarktplaatsListing: (targetYachtId: string | number) => Promise<void>;
  runMarktplaatsAction: (action: "retry" | "pause" | "remove" | "sync") => Promise<void>;
  internalReviewStatusKey: string;
  internalReviewApproved: boolean;
  internalReviewSelection: "Draft" | "For Sale";
  setInternalReviewSelection: (val: "Draft" | "For Sale") => void;
  reviewActionLoading: any;
  updateInternalReviewStatus: (status: "Draft" | "For Sale", nextStep?: number) => Promise<void>;
  
  // Submit Props
  isSubmitting: boolean;
}

export function WizardStep5({
  labelText,
  t,
  role,
  isClientRole,
  fetchingChecklist,
  checklistTemplates,
  isUploadingDocument,
  documentDropTarget,
  complianceBoatDocuments,
  handleDocumentDragOver,
  handleDocumentDragLeave,
  handleDocumentDrop,
  handleDocumentInputChange,
  resolveBoatDocumentUrl,
  handleDocumentDelete,
  normalizedClientContractStatus,
  clientContractDescriptionKey,
  clientBoatApproved,
  clientSignhostLoading,
  clientContractStatusKey,
  effectiveClientSignhostUrl,
  handleOpenClientSignhost,
  handleStepChange,
  activeYachtId,
  marktplaatsListing,
  setMarktplaatsListing,
  sellerPublicationOptions,
  selectedPublicationPlatforms,
  setSelectedPublicationPlatforms,
  isSavingMarktplaatsListing,
  isRunningMarktplaatsAction,
  persistMarktplaatsListing,
  runMarktplaatsAction,
  internalReviewStatusKey,
  internalReviewApproved,
  internalReviewSelection,
  setInternalReviewSelection,
  reviewActionLoading,
  updateInternalReviewStatus,
  isSubmitting,
}: WizardStep5Props) {
  const isAdminRole = role === "admin";

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 p-8 shadow-sm">
        <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
          <FileText size={18} />{" "}
          {t?.wizard?.review?.title || labelText("stepReview", "Review")}
        </h3>

        {/* ── CHECKLIST & COMPLIANCE ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <CheckSquare size={16} className="text-blue-600" />
            {labelText(
              "complianceDocumentsTitle",
              "Compliance & delivery documents",
            )}
          </h4>
          <p className="text-xs text-slate-500 mb-6 max-w-2xl">
            {labelText(
              "complianceDocumentsDescription",
              "Upload contract, delivery, or compliance documents here. These stay separate from the AI reference files in Step 1.",
            )}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Checklist Requirements Preview */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Benodigde Documenten
              </h5>
              {fetchingChecklist ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                  <Loader2 size={16} className="animate-spin" /> Laden...
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
              <p className="text-xs text-slate-400">
                {labelText(
                  "referenceDocumentsMovedNotice",
                  "Invoices and leaflets for AI extraction now belong in Step 1 under the image section.",
                )}
              </p>

              {/* Upload Dropzone */}
              <label
                onDragOver={(event) => handleDocumentDragOver(event, "compliance")}
                onDragEnter={(event) => handleDocumentDragOver(event, "compliance")}
                onDragLeave={(event) => handleDocumentDragLeave(event, "compliance")}
                onDrop={(event) => void handleDocumentDrop(event, "compliance")}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors bg-white",
                  isUploadingDocument
                    ? "border-slate-300 opacity-70"
                    : documentDropTarget === "compliance"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 hover:bg-slate-50 hover:border-blue-400",
                )}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isUploadingDocument ? (
                    <Loader2 size={24} className="text-blue-500 animate-spin mb-2" />
                  ) : (
                    <UploadCloud size={24} className="text-slate-400 mb-2" />
                  )}
                  <p className="text-sm font-medium text-slate-600">
                    {isUploadingDocument
                      ? labelText("documentUploading", "Uploading...")
                      : labelText(
                          "clickOrDropDocument",
                          "Click or drag one or more documents",
                        )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, DOC, DOCX, JPG, PNG (Max 10MB each)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,image/jpeg,image/png"
                  onChange={(e) => void handleDocumentInputChange(e, "compliance")}
                  disabled={isUploadingDocument}
                />
              </label>

              {/* Uploaded Documents List */}
              {complianceBoatDocuments.length > 0 ? (
                <div className="space-y-2 mt-4">
                  <h6 className="text-xs font-semibold text-slate-700">
                    {labelText("uploadedDocuments", "Already uploaded ({count})").replace(
                      "{count}",
                      String(complianceBoatDocuments.length),
                    )}
                  </h6>
                  <div className="space-y-2">
                    {complianceBoatDocuments.map((doc) => {
                      const documentUrl = resolveBoatDocumentUrl(doc);
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText size={16} className="text-blue-500 shrink-0" />
                            <div className="truncate">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {doc.file_path.split("/").pop()}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {doc.uploaded_at
                                  ? new Date(doc.uploaded_at).toLocaleDateString()
                                  : ""}
                                {doc.file_type ? ` • ${doc.file_type.toUpperCase()}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {documentUrl ? (
                              <a
                                href={documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Eye size={14} />
                              </a>
                            ) : (
                              <span className="p-1.5 text-slate-300">
                                <Eye size={14} />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDocumentDelete(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-400">
                  {labelText(
                    "noComplianceDocumentsUploaded",
                    "No compliance documents uploaded yet.",
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isAdminRole ? (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Globe size={16} className="text-blue-600" />
                  {labelText("publishingTitle", "Publishing")}
                </h4>
                <p className="mt-2 max-w-2xl text-xs text-slate-500">
                  {labelText(
                    "publishingDescription",
                    "Configure whether this boat should appear in the Marktplaats XML feed. NauticSecure prepares the entry in the background, and Marktplaats imports that feed from your Admarkt account.",
                  )}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                {String(marktplaatsListing.status || "draft").replaceAll("_", " ")}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {labelText("publishToMarktplaats", "Publish to Marktplaats")}
                <input
                  type="checkbox"
                  checked={marktplaatsListing.is_enabled}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      is_enabled: e.target.checked,
                    }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {labelText("autoPublishOnSave", "Auto publish on save")}
                <input
                  type="checkbox"
                  checked={marktplaatsListing.auto_publish}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      auto_publish: e.target.checked,
                    }))
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {labelText("promoteListing", "Promote listing")}
                <input
                  type="checkbox"
                  checked={Boolean(marktplaatsListing.settings_json?.marktplaats_promoted)}
                  disabled={marktplaatsListing.capabilities?.supports_promotion === false}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      settings_json: {
                        ...prev.settings_json,
                        marktplaats_promoted: e.target.checked,
                      },
                    }))
                  }
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("budgetType", "Budget Type")}
                </p>
                <input
                  type="text"
                  value={String(marktplaatsListing.settings_json?.marktplaats_budget_type || "cpc")}
                  disabled={marktplaatsListing.capabilities?.supports_promotion === false}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      settings_json: {
                        ...prev.settings_json,
                        marktplaats_budget_type: e.target.value,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("cpcBid", "CPC Bid")}
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={String(marktplaatsListing.settings_json?.marktplaats_cpc_bid ?? "")}
                  disabled={marktplaatsListing.capabilities?.supports_cpc === false}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      settings_json: {
                        ...prev.settings_json,
                        marktplaats_cpc_bid: e.target.value,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("targetViews", "Target Views")}
                </p>
                <input
                  type="number"
                  value={String(marktplaatsListing.settings_json?.marktplaats_target_views ?? "")}
                  disabled={marktplaatsListing.capabilities?.supports_promotion === false}
                  onChange={(e) =>
                    setMarktplaatsListing((prev: any) => ({
                      ...prev,
                      settings_json: {
                        ...prev.settings_json,
                        marktplaats_target_views: e.target.value,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("lastSync", "Last Sync")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {marktplaatsListing.last_sync_at
                    ? new Date(marktplaatsListing.last_sync_at).toLocaleString()
                    : labelText("notSyncedYet", "Not synced yet")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("feedUrl", "Feed URL")}
                </p>
                {marktplaatsListing.external_url ? (
                  <a
                    href={marktplaatsListing.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    {labelText("openXmlFeed", "Open XML feed")}{" "}
                    <Globe size={14} />
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-700">
                    {labelText("noFeedUrl", "No feed URL available yet")}
                  </p>
                )}
              </div>
            </div>

            {marktplaatsListing.external_id ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {labelText("feedReference", "Feed Reference")}
                </p>
                <p className="mt-2 break-all text-sm text-slate-700">
                  {marktplaatsListing.external_id}
                </p>
              </div>
            ) : null}

            {(marktplaatsListing.last_error_message ||
              (marktplaatsListing.last_validation_errors_json || []).length > 0) && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        {labelText("lastError", "Last error")}
                      </p>
                      {marktplaatsListing.last_error_message && (
                        <p className="mt-1">{marktplaatsListing.last_error_message}</p>
                      )}
                      {(marktplaatsListing.last_validation_errors_json || []).length > 0 && (
                        <p className="mt-1">
                          {(marktplaatsListing.last_validation_errors_json || []).join(" ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            <div className="mt-5 flex flex-wrap gap-3">
              {activeYachtId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void persistMarktplaatsListing(activeYachtId)}
                  disabled={isSavingMarktplaatsListing}
                  className="rounded-lg"
                >
                  {isSavingMarktplaatsListing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {labelText("savePublishingSettings", "Save publishing settings")}
                </Button>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  {labelText(
                    "saveBoatFirstForPublishing",
                    "Save the boat first to create the channel row and trigger background publishing.",
                  )}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => void runMarktplaatsAction("retry")}
                disabled={!activeYachtId || isRunningMarktplaatsAction !== null}
                className="rounded-lg"
              >
                {labelText("rebuildEntry", "Rebuild entry")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runMarktplaatsAction("pause")}
                disabled={!activeYachtId || !marktplaatsListing.external_id || isRunningMarktplaatsAction !== null}
                className="rounded-lg"
              >
                {labelText("pauseInFeed", "Pause in feed")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runMarktplaatsAction("sync")}
                disabled={!activeYachtId || !marktplaatsListing.external_id || isRunningMarktplaatsAction !== null}
                className="rounded-lg"
              >
                {labelText("refreshState", "Refresh state")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runMarktplaatsAction("remove")}
                disabled={!activeYachtId || !marktplaatsListing.external_id || isRunningMarktplaatsAction !== null}
                className="rounded-lg text-red-700"
              >
                {labelText("removeFromFeed", "Remove from feed")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Globe size={16} className="text-blue-600" />
                  {labelText("sellerPublishingTitle", "Publish on sales websites")}
                </h4>
                <p className="mt-2 text-xs text-slate-500">
                  {labelText(
                    "sellerPublishingDescription",
                    "Place your boat once on NauticSecure and choose where else we should publish the listing.",
                  )}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  {labelText(
                    "sellerPublishingBenefit",
                    "You save time, reach more buyers, and keep everything in one dashboard.",
                  )}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                {labelText("sellerPublishingPeriod", "/ 4 weeks")}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sellerPublicationOptions.map((platform) => {
                const selected = selectedPublicationPlatforms.includes(platform.slug);
                return (
                  <button
                    key={platform.slug}
                    type="button"
                    onClick={() =>
                      setSelectedPublicationPlatforms((prev) =>
                        prev.includes(platform.slug)
                          ? prev.filter((item) => item !== platform.slug)
                          : [...prev, platform.slug],
                      )
                    }
                    className={cn(
                      "flex flex-col gap-4 rounded-2xl border p-4 text-left transition-all",
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img
                          src={platform.logo}
                          alt={platform.name}
                          className="h-8 w-auto object-contain"
                        />
                      </div>
                      <span className="text-lg font-black text-slate-800">
                        €{platform.price}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{platform.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {labelText("sellerPublishingPeriod", "/ 4 weeks")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                        selected
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-white text-slate-500",
                      )}
                    >
                      {selected
                        ? labelText("sellerPublishingSelected", "Selected")
                        : labelText("sellerPublishingUnselected", "Choose")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {labelText("sellerPublishingSummary", "Selected websites")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedPublicationPlatforms.length > 0
                      ? selectedPublicationPlatforms
                          .map((slug) => sellerPublicationOptions.find((option) => option.slug === slug)?.name)
                          .filter(Boolean)
                          .join(", ")
                      : labelText("sellerPublishingChoose", "Choose websites")}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {labelText("sellerPublishingTotal", "Total")}
                  </p>
                  <p className="mt-1 text-2xl font-black text-blue-800">
                    €{selectedPublicationPlatforms
                      .reduce((sum, slug) => {
                        const platform = sellerPublicationOptions.find((option) => option.slug === slug);
                        return sum + (platform?.price || 0);
                      }, 0)
                      .toFixed(0)}
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      {labelText("sellerPublishingPeriod", "/ 4 weeks")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              {labelText(
                "sellerPublishingAdminNote",
                "Technical feed and API settings stay available to admins only.",
              )}
            </div>
          </div>
        )}

        {isClientRole ? (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-5 text-sm text-blue-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              {labelText("clientReviewProgressTitle", "Submission progress")}
            </p>
            <p className="mt-3 text-sm leading-6">
              {labelText(
                normalizedClientContractStatus === "pending_review"
                  ? "clientReviewStepDescription"
                  : clientContractDescriptionKey,
                normalizedClientContractStatus === "pending_review"
                  ? "Your vessel has been submitted for broker review. A broker will contact you and send the Signhost contract when everything is ready."
                  : normalizedClientContractStatus === "signing"
                    ? "Your broker sent the Signhost request. Open the contract to review and sign it."
                    : normalizedClientContractStatus === "signed"
                      ? "The Signhost contract has been signed successfully."
                      : normalizedClientContractStatus === "failed"
                        ? "The latest Signhost request needs attention. Open the contract page to continue."
                        : "Your broker approved this vessel. The Signhost invitation will appear here as soon as it is sent.",
              )}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/80 bg-white px-4 py-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {labelText("clientReviewBoatStatusLabel", "Broker review")}
                </p>
                <div className="mt-3 inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                  {labelText(
                    clientBoatApproved
                      ? "clientReviewBoatApproved"
                      : "clientReviewBoatPending",
                    clientBoatApproved
                      ? "Approved by broker"
                      : "Pending broker review",
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-white/80 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {labelText("clientReviewContractStatusLabel", "Contract signing")}
                  </p>
                  {clientSignhostLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  ) : null}
                </div>
                <div className="mt-3 inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                  {labelText(clientContractStatusKey, "Waiting for Signhost invite")}
                </div>
              </div>
            </div>
            {effectiveClientSignhostUrl ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="rounded-2xl bg-[#003566] text-white hover:bg-blue-800"
                  onClick={handleOpenClientSignhost}
                >
                  {labelText(
                    normalizedClientContractStatus === "signing"
                      ? "clientReviewSignNow"
                      : "clientReviewOpenContract",
                    normalizedClientContractStatus === "signing"
                      ? "Sign now"
                      : "Open contract",
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-blue-300 text-blue-800 hover:bg-blue-100"
                  onClick={() => handleStepChange(6)}
                >
                  {labelText("clientReviewOpenContract", "Open contract")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-5 text-sm text-blue-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              {labelText("internalReviewTitle", "Broker review actions")}
            </p>
            <p className="mt-3 leading-6">
              {labelText(
                "internalReviewDescription",
                "Review this client vessel here. Keeping it as draft means it stays under review. Approving it moves the vessel into the live sales flow and lets you continue with Signhost.",
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm">
                <span className="mr-2 text-slate-400">
                  {labelText("internalReviewStatusLabel", "Current review state")}:
                </span>
                {labelText(
                  internalReviewStatusKey,
                  internalReviewApproved ? "Approved for sales flow" : "Pending broker review",
                )}
              </div>
              {activeYachtId ? (
                <>
                  <select
                    className="h-11 min-w-[220px] rounded-2xl border border-blue-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    value={internalReviewSelection}
                    disabled={reviewActionLoading !== null}
                    onChange={(event) =>
                      setInternalReviewSelection(
                        event.target.value as "Draft" | "For Sale",
                      )
                    }
                  >
                    <option value="Draft">
                      {labelText("markPendingReview", "Keep in review")}
                    </option>
                    <option value="For Sale">
                      {labelText("approveVessel", "Approve vessel")}
                    </option>
                  </select>
                  <Button
                    type="button"
                    className="rounded-2xl bg-[#003566] text-white hover:bg-blue-800"
                    disabled={reviewActionLoading !== null}
                    onClick={() =>
                      void updateInternalReviewStatus(
                        internalReviewSelection,
                        internalReviewSelection === "For Sale" ? 6 : undefined,
                      )
                    }
                  >
                    {reviewActionLoading !== null ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle size={16} className="mr-2" />
                    )}
                    {labelText(
                      internalReviewSelection === "For Sale" ? "approveVessel" : "markPendingReview",
                      internalReviewSelection === "For Sale" ? "Approve vessel" : "Keep in review",
                    )}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#003566] text-white hover:bg-blue-800 h-14 font-black uppercase text-[11px] tracking-widest transition-all shadow-xl"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            labelText("saveVessel", "Save vessel")
          )}
        </Button>
      </div>
    </div>
  );
}
