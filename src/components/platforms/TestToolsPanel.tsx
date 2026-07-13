"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Download, Zap, ShieldCheck, FileCode, Braces } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TestConnectionResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
  checked_at: string;
}

interface ValidationIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface FeedPreviewResult {
  xml?: string;
  errors?: string[];
  warnings?: string[];
  valid?: boolean;
  yacht_name?: string;
  error?: string;
}

interface PayloadPreviewResult {
  payload?: Record<string, unknown>;
  yacht_name?: string;
  error?: string;
}

function ToolButton({ onClick, loading, icon: Icon, label }: { onClick: () => void; loading: boolean; icon: typeof Zap; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

export function TestToolsPanel({ platformId }: { platformId: number | null }) {
  const t = useTranslations("Platforms.testTools");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedPreview, setFeedPreview] = useState<FeedPreviewResult | null>(null);

  const [loadingPayload, setLoadingPayload] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState<PayloadPreviewResult | null>(null);

  if (!platformId) {
    return <p className="text-xs text-slate-400 italic">{t("saveFirstHint")}</p>;
  }

  const runTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<TestConnectionResult>(`/admin/platforms/${platformId}/test-connection`);
      setTestResult(res.data);
      toast[res.data.success ? "success" : "error"](res.data.success ? t("connectionSuccess") : t("connectionFailed"));
    } catch {
      toast.error(t("connectionFailed"));
    } finally {
      setTesting(false);
    }
  };

  const runValidate = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const res = await api.post<ValidationResult>(`/admin/platforms/${platformId}/validate`);
      setValidation(res.data);
    } catch {
      toast.error(t("validateFailed"));
    } finally {
      setValidating(false);
    }
  };

  const runPreviewFeed = async () => {
    setLoadingFeed(true);
    setFeedPreview(null);
    try {
      const res = await api.get<FeedPreviewResult>(`/admin/platforms/${platformId}/preview-feed`);
      setFeedPreview(res.data);
    } catch {
      toast.error(t("previewFailed"));
    } finally {
      setLoadingFeed(false);
    }
  };

  const runPreviewPayload = async () => {
    setLoadingPayload(true);
    setPayloadPreview(null);
    try {
      const res = await api.get<PayloadPreviewResult>(`/admin/platforms/${platformId}/preview-payload`);
      setPayloadPreview(res.data);
    } catch {
      toast.error(t("previewFailed"));
    } finally {
      setLoadingPayload(false);
    }
  };

  const downloadFeed = async () => {
    try {
      const res = await api.get<FeedPreviewResult>(`/admin/platforms/${platformId}/preview-feed`);
      if (!res.data.xml) { toast.error(t("previewFailed")); return; }
      const blob = new Blob([res.data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `platform-${platformId}-test-feed.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("previewFailed"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ToolButton onClick={() => void runTestConnection()} loading={testing} icon={Zap} label={testing ? t("testing") : t("testConnection")} />
        <ToolButton onClick={() => void runValidate()} loading={validating} icon={ShieldCheck} label={validating ? t("validating") : t("validate")} />
        <ToolButton onClick={() => void runPreviewFeed()} loading={loadingFeed} icon={FileCode} label={loadingFeed ? t("previewingFeed") : t("previewFeed")} />
        <ToolButton onClick={() => void runPreviewPayload()} loading={loadingPayload} icon={Braces} label={loadingPayload ? t("previewingPayload") : t("previewPayload")} />
        <ToolButton onClick={() => void downloadFeed()} loading={false} icon={Download} label={t("downloadFeed")} />
      </div>

      {testResult && (
        <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-xs", testResult.success ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700")}>
          {testResult.success ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-semibold">{testResult.message}</p>
            {testResult.latency_ms !== null && <p className="opacity-70">{testResult.latency_ms}ms</p>}
          </div>
        </div>
      )}

      {validation && (
        <div className="space-y-1.5">
          {validation.issues.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800">
              <CheckCircle2 size={14} /> {t("noIssues")}
            </p>
          ) : (
            <>
            <p className="text-xs font-semibold text-slate-500">{t("issuesFound", { count: validation.issues.length })}</p>
            {validation.issues.map((issue, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
                  issue.severity === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
                )}
              >
                {issue.severity === "error" ? <XCircle size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
                <div>
                  <p className="font-mono font-semibold opacity-70">{issue.field}</p>
                  <p>{issue.message}</p>
                </div>
              </div>
            ))}
            </>
          )}
        </div>
      )}

      {feedPreview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {feedPreview.error ? (
            <p className="text-xs text-red-600">{feedPreview.error}</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">{feedPreview.yacht_name}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] font-mono text-slate-700">{feedPreview.xml}</pre>
            </>
          )}
        </div>
      )}

      {payloadPreview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {payloadPreview.error ? (
            <p className="text-xs text-red-600">{payloadPreview.error}</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold text-slate-500">{payloadPreview.yacht_name}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] font-mono text-slate-700">
                {JSON.stringify(payloadPreview.payload, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
