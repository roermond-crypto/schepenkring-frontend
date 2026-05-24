"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Check, X, ArrowRightLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  acceptBid,
  counterBid,
  listDashboardBids,
  rejectBid,
  type DashboardBid,
} from "@/lib/api/bids-dashboard";
import { cn } from "@/lib/utils";

export function BidsManagementPage({ role }: { role: string }) {
  const t = useTranslations("DashboardBids");
  const [bids, setBids] = useState<DashboardBid[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    else setRefreshing(true);
    try {
      const result = await listDashboardBids();
      setBids(result.data);
    } catch {
      setBids([]);
    } finally {
      if (isInitial) setInitialLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function runAction(
    bidId: number,
    action: "accept" | "reject" | "counter",
    amount?: number,
  ) {
    setActingId(bidId);
    try {
      if (action === "accept") await acceptBid(bidId);
      if (action === "reject") await rejectBid(bidId);
      if (action === "counter" && amount) await counterBid(bidId, { amount });
      toast.success(t(`toasts.${action}`));
      setCounterFor(null);
      setCounterAmount("");
      await load();
    } catch {
      toast.error(t("toasts.failed"));
    } finally {
      setActingId(null);
    }
  }

  if (initialLoading) {
    return <BidsManagementPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black text-[#0B1F3A]">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      {bids.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-700">{t("empty.title")}</p>
          <p className="mt-2 text-sm text-slate-500">{t("empty.subtitle")}</p>
        </div>
      ) : (
        <div className={cn("grid gap-4 transition-opacity", refreshing && "opacity-60")}>
          {bids.map((bid) => (
            <article
              key={bid.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0B1F3A]">
                    {bid.boat_name ?? t("labels.boat")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {bid.buyer_name ?? t("labels.buyer")}
                    {bid.buyer_verified ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {t("labels.verified")}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-3 text-2xl font-black text-[#0B1F3A]">
                    € {Number(bid.amount).toLocaleString()}
                    {bid.asking_price ? (
                      <span className="ml-2 text-sm font-medium text-slate-500">
                        / € {Number(bid.asking_price).toLocaleString()}
                      </span>
                    ) : null}
                  </p>
                  {bid.message ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {bid.message}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold uppercase",
                    bid.status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : bid.status === "accepted"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700",
                  )}
                >
                  {bid.status}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {bid.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={actingId === bid.id}
                      onClick={() => void runAction(bid.id, "accept")}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <Check size={16} />
                      {t("actions.accept")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCounterFor(bid.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                    >
                      <ArrowRightLeft size={16} />
                      {t("actions.counter")}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === bid.id}
                      onClick={() => void runAction(bid.id, "reject")}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                    >
                      <X size={16} />
                      {t("actions.reject")}
                    </button>
                  </>
                ) : null}
                {bid.conversation_id ? (
                  <Link
                    href={`/dashboard/${role}/chat?conversation=${bid.conversation_id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <MessageSquare size={16} />
                    {t("actions.chat")}
                  </Link>
                ) : null}
              </div>

              {counterFor === bid.id ? (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                    {t("counter.amount")}
                    <input
                      type="number"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!counterAmount || actingId === bid.id}
                    onClick={() =>
                      void runAction(bid.id, "counter", Number(counterAmount))
                    }
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t("actions.sendCounter")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BidsManagementPageSkeleton() {
  const t = useTranslations("DashboardBids");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black text-[#0B1F3A]">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <BidCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function BidCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48 rounded-md bg-slate-200" />
          <Skeleton className="h-4 w-32 rounded-md bg-slate-100" />
          <Skeleton className="h-8 w-40 rounded-md bg-slate-200" />
          <Skeleton className="h-16 w-full max-w-md rounded-xl bg-slate-100" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full bg-slate-100" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-24 rounded-xl bg-slate-200" />
        <Skeleton className="h-10 w-28 rounded-xl bg-slate-100" />
        <Skeleton className="h-10 w-24 rounded-xl bg-slate-100" />
      </div>
    </article>
  );
}
