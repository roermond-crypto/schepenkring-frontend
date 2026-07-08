"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MessageSquare, Sailboat, TrendingUp, CheckCircle2, Calendar, HelpCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import {
  getSellerDashboardSummary,
  type SellerDashboardSummary,
} from "@/lib/api/seller-dashboard";
import { cn } from "@/lib/utils";

export function SellerDashboardPanel({ locale, role }: { locale: AppLocale; role: string }) {
  const t = getDictionary(locale).SellerDashboard;
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const root = `/dashboard/${role}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSellerDashboardSummary();
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <SellerDashboardPanelSkeleton />;
  }

  const stats = summary?.stats ?? {};
  const statCards = [
    { label: t.stats.boats, value: stats.boat_count ?? 0, href: `${root}/yachts`, icon: Sailboat },
    { label: t.stats.bids, value: stats.open_bids ?? 0, href: `${root}/bids`, icon: TrendingUp },
    { label: t.stats.chats, value: stats.open_conversations ?? 0, href: `${root}/chat`, icon: MessageSquare },
    { label: t.stats.viewings ?? "Bezichtigingen", value: (stats as Record<string, number>).pending_viewings ?? 0, href: `${root}/chat`, icon: Calendar },
    { label: t.stats.questions ?? "Vragen", value: (stats as Record<string, number>).open_questions ?? 0, href: `${root}/chat`, icon: HelpCircle },
    { label: t.stats.contracts, value: stats.contracts ?? 0, href: `${root}/yachts`, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {(summary?.action_needed ?? []).length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary!.action_needed!.map((item) => (
            <div
              key={item.type}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
            >
              <p className="text-sm font-bold text-amber-900">{item.label ?? item.type}</p>
              {item.href ? (
                <Link
                  href={item.href}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-950"
                >
                  {t.actions.view}
                  <ArrowRight size={14} />
                </Link>
              ) : null}
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-[#CFDCF2] bg-white p-5 shadow-sm transition hover:border-[#1E3A8A]"
          >
            <div className="flex items-center justify-between">
              <card.icon className="h-5 w-5 text-[#1E3A8A]" />
              <span className="text-2xl font-black text-[#0B1F3A]">{card.value}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">{card.label}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#CFDCF2] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-[#0B1F3A]">{t.sections.boats}</h2>
          <div className="mt-4 space-y-3">
            {(summary?.boats ?? []).slice(0, 5).map((boat) => (
              <Link
                key={boat.id}
                href={`${root}/yachts/${boat.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-[#0B1F3A]">
                    {boat.boat_name ?? boat.name ?? `#${boat.id}`}
                  </p>
                  <p className="text-xs text-slate-500">{boat.status ?? "draft"}</p>
                </div>
                {boat.new_bids_count ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                    {boat.new_bids_count} {t.labels.bids}
                  </span>
                ) : null}
              </Link>
            ))}
            {(summary?.boats ?? []).length === 0 && (
              <p className="text-sm text-slate-500">{t.empty.boats}</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#CFDCF2] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-[#0B1F3A]">{t.sections.latestBids}</h2>
          <div className="mt-4 space-y-3">
            {(summary?.latest_bids ?? []).slice(0, 5).map((bid) => (
              <div
                key={bid.id}
                className="rounded-xl border border-slate-100 px-4 py-3"
              >
                <p className="font-semibold text-[#0B1F3A]">{bid.boat_name ?? t.labels.bid}</p>
                <p className="text-sm text-slate-600">
                  {bid.buyer_name ?? t.labels.buyer} · €{(bid.amount ?? 0).toLocaleString()}
                </p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`${root}/bids`}
                    className={cn(
                      "rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white",
                    )}
                  >
                    {t.actions.manageBid}
                  </Link>
                  {bid.chat_url ? (
                    <Link
                      href={bid.chat_url}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      {t.actions.openChat}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
            {(summary?.latest_bids ?? []).length === 0 && (
              <p className="text-sm text-slate-500">{t.empty.bids}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SellerDashboardPanelSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[#CFDCF2] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-5 rounded-md bg-slate-200" />
              <Skeleton className="h-8 w-10 rounded-md bg-slate-200" />
            </div>
            <Skeleton className="mt-3 h-4 w-24 rounded-md bg-slate-100" />
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <section
            key={sectionIndex}
            className="rounded-2xl border border-[#CFDCF2] bg-white p-6 shadow-sm"
          >
            <Skeleton className="h-6 w-40 rounded-md bg-slate-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36 rounded-md bg-slate-200" />
                    <Skeleton className="h-3 w-20 rounded-md bg-slate-100" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
