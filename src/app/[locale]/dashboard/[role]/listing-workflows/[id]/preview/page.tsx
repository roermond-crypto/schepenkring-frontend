"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Ship,
} from "lucide-react";
import { api } from "@/lib/api";
import { normalizeRole } from "@/lib/auth/roles";

type WorkflowPreview = {
  workflow: {
    id: number;
    status: string;
    yacht_id?: number | null;
    last_review_message?: string | null;
  };
  preview: {
    title?: string | null;
    description?: string | null;
    status?: string | null;
    specs?: Record<string, string | number | null>;
    photos?: Array<{ path: string; url: string; original_name?: string | null }>;
  };
};

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const maybe = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };

    return maybe.response?.data?.message || maybe.message || fallback;
  }

  return fallback;
}

export default function ListingWorkflowPreviewPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ role?: string; id?: string }>();
  const role = normalizeRole(params?.role) ?? "client";
  const workflowId = Number(params?.id);
  const [data, setData] = useState<WorkflowPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "changes" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/listing-workflows/${workflowId}/preview`);
      setData(res.data?.data as WorkflowPreview);
    } catch (err) {
      setError(errorMessage(err, "Could not load the listing preview."));
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (workflowId) void loadPreview();
  }, [loadPreview, workflowId]);

  async function submit(action: "approve" | "changes") {
    setSubmitting(action);
    setError(null);

    try {
      const endpoint =
        action === "approve"
          ? `/listing-workflows/${workflowId}/approve`
          : `/listing-workflows/${workflowId}/request-changes`;
      const res = await api.post(endpoint, { message: message || null });
      const workflow = res.data?.data;
      setData((current) =>
        current
          ? {
              ...current,
              workflow,
              preview: workflow.preview ?? current.preview,
            }
          : current,
      );
      setMessage("");
    } catch (err) {
      setError(errorMessage(err, "Could not update the listing workflow."));
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading listing preview
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/dashboard/${role}/yachts/new?fresh=true`)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to intake
          </button>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            <Ship className="h-4 w-4" />
            Listing preview
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {data?.preview.title || "Boat listing"}
          </h1>
        </div>
        <span className="inline-flex min-h-[34px] items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
          {data?.workflow.status || data?.preview.status || "draft"}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {(data?.preview.photos?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {data?.preview.photos?.map((photo) => (
                <div
                  key={photo.path}
                  className="aspect-[4/3] overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                >
                  <img
                    src={photo.url}
                    alt={photo.original_name || "Boat listing photo"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="prose prose-slate max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {data?.preview.description || "No description added yet."}
            </p>
          </div>
        </section>

        <aside className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Specs
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {Object.entries(data?.preview.specs ?? {}).map(([key, value]) =>
                value === null || value === "" ? null : (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="capitalize text-slate-500">{key.replace(/_/g, " ")}</dt>
                    <dd className="text-right font-semibold text-slate-900">{value}</dd>
                  </div>
                ),
              )}
            </dl>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Review message
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => void submit("approve")}
              disabled={submitting !== null}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve listing
            </button>
            <button
              type="button"
              onClick={() => void submit("changes")}
              disabled={submitting !== null}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "changes" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquareText className="h-4 w-4" />
              )}
              Request changes
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
