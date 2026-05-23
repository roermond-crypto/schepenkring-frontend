"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Download, Loader2, PenLine } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { signhostApi } from "@/lib/api/signhost";
import { getStorageUrl } from "@/lib/storage-url";

type YachtContractData = {
  id: number | string;
  boat_name?: string | null;
  name?: string | null;
  price?: string | number | null;
  year?: number | string | null;
  brand?: string | null;
  location?: string | null;
  loa?: string | number | null;
  beam?: string | number | null;
  main_image_url?: string | null;
  images?: Array<{ url?: string; file_url?: string }>;
  sign_request_id?: number | null;
};

type ClientContractCardProps = {
  yacht: YachtContractData;
  signUrl: string | null;
  status: string;
  dashboardBase: string;
  yachtDetailPath: string;
  content: {
    title: string;
    heading: string;
    subtitle: string;
    cta: string;
  };
};

export function ClientContractCard({
  yacht,
  signUrl,
  status,
  dashboardBase,
  yachtDetailPath,
  content,
}: ClientContractCardProps) {
  const t = useTranslations("DashboardAdminOverview.contractCard");
  const [activeSignUrl, setActiveSignUrl] = useState(signUrl);
  const [refreshing, setRefreshing] = useState(false);

  const boatName = String(yacht.boat_name ?? yacht.name ?? t("fallbackBoatName"));
  const price = Number(yacht.price ?? 0);
  const imageUrl =
    yacht.main_image_url ??
    yacht.images?.[0]?.url ??
    yacht.images?.[0]?.file_url ??
    null;
  const resolvedImage = imageUrl ? getStorageUrl(imageUrl) : null;

  async function handleRefreshSignUrl() {
    if (!yacht.sign_request_id) return;
    setRefreshing(true);
    try {
      const res = await signhostApi.refreshSigningUrl(yacht.sign_request_id);
      const nextUrl = res.sign_url ?? res.url ?? null;
      if (nextUrl) setActiveSignUrl(nextUrl);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#CFDCF2] bg-white shadow-[0_12px_30px_rgba(11,31,58,0.08)] dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-7 py-5 dark:border-slate-700">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1E3A8A]">
          {content.title}
        </p>
        <h2 className="mt-1 text-2xl font-black text-[#0B1F3A] dark:text-slate-100">
          {t("header")}
        </h2>
      </div>

      <div className="grid gap-6 p-7 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {resolvedImage ? (
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={resolvedImage}
                alt={boatName}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              {t("noImage")}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-2xl font-black text-[#0B1F3A] dark:text-slate-100">{boatName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {[yacht.year, yacht.brand, yacht.location].filter(Boolean).join(" · ")}
            </p>
            {price > 0 ? (
              <p className="mt-3 text-3xl font-black text-[#0B1F3A] dark:text-slate-100">
                € {price.toLocaleString("nl-NL")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("dimensions")}
              </p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                LOA: {yacht.loa ?? "—"} · {t("beam")}: {yacht.beam ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t("details")}
              </p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {t("year")}: {yacht.year ?? "—"} · {t("brand")}: {yacht.brand ?? "—"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              {t("signingSection")}
            </p>
            <p className="mt-2 text-sm leading-6 text-blue-900">{content.subtitle}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {activeSignUrl ? (
                <a
                  href={activeSignUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#112f58]"
                >
                  <PenLine size={16} />
                  {content.cta}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRefreshSignUrl()}
                  disabled={refreshing || !yacht.sign_request_id}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {refreshing ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
                  {refreshing ? t("refreshing") : content.cta}
                </button>
              )}
              <Link
                href={yachtDetailPath}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1F3A]"
              >
                <Download size={16} />
                {t("downloadDraft")}
              </Link>
            </div>
            {status === "failed" && yacht.sign_request_id ? (
              <button
                type="button"
                onClick={() => void handleRefreshSignUrl()}
                className="mt-3 text-xs font-semibold text-blue-700 underline"
              >
                {t("refreshLink")}
              </button>
            ) : null}
          </div>

          <Link
            href={`${dashboardBase}/yachts/${yacht.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E3A8A]"
          >
            {t("manageVessel")}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
