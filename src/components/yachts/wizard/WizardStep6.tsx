"use client";

import React from "react";
import { 
  FileText, 
  Images, 
  Loader2, 
  Sparkles, 
  Eye 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignhostFlow } from "@/components/yachts/SignhostFlow";

interface WizardStep6Props {
  labelText: (key: any, fallback: string) => any;
  isClientRole: boolean;
  normalizedClientContractStatus: string;
  clientContractDescriptionKey: string;
  clientContractStatusKey: string;
  effectiveClientSignhostUrl: string | null;
  handleOpenClientSignhost: () => void;
  activeYachtId: number | null;
  selectedYacht: any;
  draft: any;
  harbors: any[];
  role: string;
  resolvePipelineAssetUrl: (path: string) => string | null;
  handleGenerateSticker: () => Promise<void>;
  isGeneratingSticker: boolean;
  openStickerPreview: () => void;
  downloadStickerPdf: () => void;
}

export function WizardStep6({
  labelText,
  isClientRole,
  normalizedClientContractStatus,
  clientContractDescriptionKey,
  clientContractStatusKey,
  effectiveClientSignhostUrl,
  handleOpenClientSignhost,
  activeYachtId,
  selectedYacht,
  draft,
  harbors,
  role,
  resolvePipelineAssetUrl,
  handleGenerateSticker,
  isGeneratingSticker,
  openStickerPreview,
  downloadStickerPdf,
}: WizardStep6Props) {
  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 p-8 shadow-sm">
        <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
          <FileText size={18} />{" "}
          {isClientRole
            ? labelText(
                normalizedClientContractStatus === "pending_review"
                  ? "stepBrokerReview"
                  : "stepContract",
                normalizedClientContractStatus === "pending_review"
                  ? "Broker Review"
                  : "Contract",
              )
            : labelText("stepContract", "Contract")}
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          {isClientRole
            ? labelText(
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
                normalizedClientContractStatus === "signing"
                  ? "clientReviewContractStatusLabel"
                  : "clientReviewStatusTitle",
                normalizedClientContractStatus === "signing"
                  ? "Contract signing"
                  : "Submitted for Review",
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-100/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-800">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-blue-700"
                />
                {labelText(
                  clientContractStatusKey,
                  normalizedClientContractStatus === "pending_review"
                    ? "Pending broker review"
                    : "Waiting for Signhost invite",
                )}
              </div>
              {effectiveClientSignhostUrl ? (
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
              ) : null}
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
              (draft?.data as any)?.step2?.selectedYacht?.ref_harbor_id ||
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

      {/* ── BOAT STICKER & QR ───────────────────────────── */}
      {role === "admin" && (
        <div className="bg-white border border-slate-200 p-8 shadow-sm">
          <h3 className="text-[12px] font-black text-[#003566] uppercase tracking-[0.3em] flex items-center gap-3 border-b-2 border-[#003566] pb-4 mb-6">
            <Images size={18} />{" "}
            {labelText("stepSticker", "Boat Sticker & QR")}
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            {labelText(
              "stickerStepDescription",
              "Generate and download the high-resolution QR code sticker for this vessel. This sticker can be printed and placed on the boat for easy access to the listing.",
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center min-h-[200px]">
                {selectedYacht?.qr_code_path ? (
                  <div className="text-center">
                    <img
                      src={resolvePipelineAssetUrl(selectedYacht.qr_code_path) || ""}
                      alt={labelText("vesselQrCodeAlt", "Vessel QR Code")}
                      className="w-32 h-32 mx-auto mb-4 bg-white p-2 rounded-lg shadow-sm border"
                    />
                    <p className="text-[10px] text-slate-400 font-mono break-all px-4">
                      {selectedYacht.public_url}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Images size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">
                      {labelText("noQrGeneratedYet", "No QR code generated yet")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGenerateSticker()}
                disabled={!activeYachtId || isGeneratingSticker}
                className="h-12 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider text-xs"
              >
                {isGeneratingSticker ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Sparkles size={16} className="mr-2" />
                )}
                {selectedYacht?.qr_code_path
                  ? labelText("refreshSticker", "Refresh Sticker")
                  : labelText("generateSticker", "Generate Sticker")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openStickerPreview}
                disabled={!activeYachtId}
                className="h-12 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider text-xs"
              >
                <Eye size={16} className="mr-2" />
                {labelText("previewSticker", "Preview Sticker")}
              </Button>
              <Button
                type="button"
                onClick={downloadStickerPdf}
                disabled={!activeYachtId}
                className="h-12 bg-[#003566] text-white hover:bg-blue-800 font-bold uppercase tracking-wider text-xs"
              >
                <FileText size={16} className="mr-2" />
                {labelText("downloadStickerPdf", "Download PDF Sticker")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
