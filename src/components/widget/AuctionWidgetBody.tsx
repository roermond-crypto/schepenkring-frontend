"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Gavel, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { cn } from "@/lib/utils";

type WidgetColors = {
  launcherStart: string;
  launcherEnd: string;
  headerStart: string;
  headerEnd: string;
  userBubbleStart: string;
  userBubbleEnd: string;
  quickChipBg: string;
  quickChipBorder: string;
  quickChipText: string;
};

type AuctionMode = "bids" | "live";

type RecentBid = {
  id: number;
  amount: number;
  status: string;
  bidder: string;
  placed_at: string;
};

type AuctionState = {
  boat_id: number;
  yacht_id: number;
  location_id: number;
  auction_enabled: boolean;
  allow_bidding: boolean;
  auction_mode: AuctionMode;
  auction_status: string;
  current_bid: number | null;
  highest_bid: number | null;
  starting_bid: number | null;
  minimum_next_bid: number | null;
  min_increment: number | null;
  auction_start: string | null;
  auction_end: string | null;
  starts_in_seconds: number;
  countdown_seconds: number;
  bid_count: number;
  bidder_count: number;
  viewer_can_bid: boolean;
  winner: { bidder: string; amount: number } | null;
  session?: {
    id: number;
    status: string;
    start_time: string;
    end_time: string;
    highest_bid: number | null;
    highest_bidder: string | null;
    last_bid_at: string | null;
    extension_count: number;
    total_bids: number;
    unique_bidders: number;
  } | null;
  recent_bids: RecentBid[];
};

type BidListResponse = {
  boat_id: number;
  yacht_id: number;
  bids: RecentBid[];
};

type BidderSession = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
};

const PUBLIC_API_BASE = normalizeApiBaseUrl(
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_BACKEND_API_URL
    : process.env.BACKEND_API_URL) ?? "https://app.schepen-kring.nl/api",
);

async function publicApi<T>(
  path: string,
  options?: RequestInit & { json?: Record<string, unknown> },
): Promise<T> {
  const response = await fetch(`${PUBLIC_API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.json ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
    body: options?.json ? JSON.stringify(options.json) : options?.body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string }).message ||
        `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "€0";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatRelativeTime(value: string) {
  const deltaSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (deltaSeconds < 60) return "just now";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

function sessionStorageKey(boatId: number, locationId?: number) {
  return `auction_bidder_${boatId}_${locationId ?? "default"}`;
}

export function AuctionWidgetBody({
  boatId,
  locationId,
  colors,
  locale: _locale,
}: {
  boatId: number;
  locationId?: number;
  colors: WidgetColors;
  locale?: string;
}) {
  void _locale;
  const t = useTranslations("WidgetAuction");
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [bidder, setBidder] = useState<BidderSession | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(
    null,
  );
  const [registrationForm, setRegistrationForm] = useState({
    full_name: "",
    address: "",
    postal_code: "",
    city: "",
    phone: "",
    email: "",
  });
  const [now, setNow] = useState(Date.now());

  const effectiveLocationId =
    locationId ?? auction?.location_id ?? undefined;

  const fetchAuction = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError(null);

    try {
      const query = effectiveLocationId
        ? `?location_id=${effectiveLocationId}`
        : "";
      const [auctionResponse, bidsResponse] = await Promise.all([
        publicApi<AuctionState>(`/public/boats/${boatId}/auction${query}`),
        publicApi<BidListResponse>(`/public/boats/${boatId}/bids${query}`),
      ]);

      setAuction({
        ...auctionResponse,
        recent_bids: bidsResponse.bids?.length
          ? bidsResponse.bids
          : auctionResponse.recent_bids,
      });

      const nextBid =
        auctionResponse.minimum_next_bid ?? auctionResponse.starting_bid ?? 0;
      setBidAmount((current) => current || String(nextBid));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : t("errors.load"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [boatId, effectiveLocationId, t]);

  useEffect(() => {
    void fetchAuction(true);
  }, [fetchAuction]);

  useEffect(() => {
    const storageKey = sessionStorageKey(boatId, effectiveLocationId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        sessionToken?: string;
        bidder?: BidderSession;
      };
      if (parsed.sessionToken) setSessionToken(parsed.sessionToken);
      if (parsed.bidder) setBidder(parsed.bidder);
    } catch {
      // ignore stale widget bidder session
    }
  }, [boatId, effectiveLocationId]);

  useEffect(() => {
    if (!auction) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [auction]);

  useEffect(() => {
    if (!auction) return;
    const isLive = auction.auction_mode === "live" && auction.auction_status === "active";
    const interval = window.setInterval(
      () => {
        setRefreshing(true);
        void fetchAuction(false);
      },
      isLive ? 5000 : 15000,
    );

    return () => window.clearInterval(interval);
  }, [auction, fetchAuction]);

  const countdownSeconds = useMemo(() => {
    if (!auction) return 0;
    if (auction.auction_status === "scheduled" && auction.auction_start) {
      return Math.max(
        0,
        Math.floor((new Date(auction.auction_start).getTime() - now) / 1000),
      );
    }
    if (auction.auction_end) {
      return Math.max(
        0,
        Math.floor((new Date(auction.auction_end).getTime() - now) / 1000),
      );
    }
    return auction.countdown_seconds ?? 0;
  }, [auction, now]);

  const placeBid = async () => {
    if (!auction || !sessionToken || !effectiveLocationId) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await publicApi<{
        bid: RecentBid;
        current_bid: number;
        minimum_next_bid: number;
        auction: Partial<AuctionState>;
      }>(`/public/boats/${boatId}/bid`, {
        method: "POST",
        headers: {
          "X-Bid-Token": sessionToken,
          "Idempotency-Key": `bid-${boatId}-${Date.now()}`,
        },
        json: {
          amount: Number(bidAmount),
          location_id: effectiveLocationId,
        },
      });

      setAuction((prev) =>
        prev
          ? {
              ...prev,
              ...response.auction,
              current_bid: response.current_bid,
              highest_bid: response.current_bid,
              minimum_next_bid: response.minimum_next_bid,
              recent_bids: [response.bid, ...prev.recent_bids].slice(0, 8),
              bid_count: prev.bid_count + 1,
            }
          : prev,
      );
      setBidAmount(String(response.minimum_next_bid));
    } catch (bidError) {
      setError(
        bidError instanceof Error ? bidError.message : t("errors.placeBid"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registerBidder = async () => {
    setRegistering(true);
    setError(null);
    setRegistrationStatus(null);
    try {
      const response = await publicApi<{
        status: string;
        bidder: BidderSession;
        session_token?: string;
      }>("/public/bids/register", {
        method: "POST",
        json: registrationForm,
      });

      setBidder(response.bidder);
      setRegistrationStatus(response.status);

      if (response.session_token) {
        setSessionToken(response.session_token);
        localStorage.setItem(
          sessionStorageKey(boatId, effectiveLocationId),
          JSON.stringify({
            sessionToken: response.session_token,
            bidder: response.bidder,
          }),
        );
      }
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : t("errors.register"),
      );
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!auction || !auction.auction_enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
        <Gavel className="mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">{t("unavailable.title")}</p>
        <p className="mt-1 text-xs">{t("unavailable.description")}</p>
      </div>
    );
  }

  const canBid =
    auction.allow_bidding &&
    auction.viewer_can_bid &&
    Boolean(sessionToken) &&
    auction.auction_status !== "ended";

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.72),_rgba(248,250,252,0.98)_42%,_#ffffff_100%)] text-slate-900"
      style={{ fontFamily: '"Manrope", "Inter", sans-serif' }}
    >
      <div className="border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-xl">
        <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{
                background: `linear-gradient(145deg, ${colors.headerStart}, ${colors.headerEnd})`,
              }}
            >
              <Gavel size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700/70">
                {auction.auction_mode === "live" ? t("mode.live") : t("mode.bids")}
              </p>
              <h5 className="mt-1 text-lg font-extrabold text-slate-900">
                {auction.auction_mode === "live"
                  ? t("hero.liveTitle")
                  : t("hero.bidTitle")}
              </h5>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {auction.auction_mode === "live"
                  ? t("hero.liveDescription")
                  : t("hero.bidDescription")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {auction.auction_mode === "live" ? t("mode.live") : t("mode.open")}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("common.encrypted")}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {auction.auction_status === "scheduled"
                  ? t("countdown.startsIn")
                  : t("countdown.endsIn")}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                {formatCountdown(countdownSeconds)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-[1fr_auto] gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {t("stats.highestBid")}
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {formatCurrency(auction.highest_bid ?? auction.starting_bid)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {t("stats.bidSummary", {
                    bids: auction.bid_count,
                    bidders: auction.bidder_count,
                  })}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {auction.auction_status === "ended"
                    ? t("status.ended")
                    : auction.auction_status === "scheduled"
                      ? t("status.scheduled")
                      : t("status.winning")}
                </span>
                {auction.session?.highest_bidder ? (
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {auction.session.highest_bidder}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {t("recent.title")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRefreshing(true);
                    void fetchAuction(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700"
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                  />
                  {t("recent.refresh")}
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {auction.recent_bids.slice(0, 4).map((bid) => (
                  <div
                    key={bid.id}
                    className="grid grid-cols-[1fr_auto] items-center border-b border-slate-100 pb-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-xl font-bold text-slate-900">
                        {bid.bidder} {formatCurrency(bid.amount)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-400">
                      {formatRelativeTime(bid.placed_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!sessionToken && (
            <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-bold text-slate-900">
                {t("registration.title")}
              </p>
              <div className="mt-3 grid gap-3">
                {(
                  [
                    ["full_name", t("registration.fields.fullName")],
                    ["address", t("registration.fields.address")],
                    ["postal_code", t("registration.fields.postalCode")],
                    ["city", t("registration.fields.city")],
                    ["phone", t("registration.fields.phone")],
                    ["email", t("registration.fields.email")],
                  ] as const
                ).map(([field, label]) => (
                  <input
                    key={field}
                    value={registrationForm[field]}
                    onChange={(event) =>
                      setRegistrationForm((prev) => ({
                        ...prev,
                        [field]: event.target.value,
                      }))
                    }
                    placeholder={label}
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-sky-400"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={registerBidder}
                disabled={registering}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-extrabold uppercase tracking-[0.16em] text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                }}
              >
                {registering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("registration.button")
                )}
              </button>
              {registrationStatus ? (
                <p className="mt-3 text-xs text-slate-500">
                  {t("registration.status", { status: registrationStatus })}
                </p>
              ) : null}
            </div>
          )}

          <div className="rounded-[28px] border border-white/90 bg-white/92 p-4 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-bold text-slate-900">
              {sessionToken ? t("bidBox.placeTitle") : t("bidBox.completeRegistration")}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t("bidBox.minimumBid")}{" "}
              <span className="font-bold text-emerald-700">
                {formatCurrency(auction.minimum_next_bid ?? auction.starting_bid)}
              </span>
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={auction.minimum_next_bid ?? auction.starting_bid ?? 0}
                step={auction.min_increment ?? 500}
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
                className="h-14 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-3xl font-black text-slate-900 outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={placeBid}
                disabled={!canBid || submitting}
                className="flex h-14 min-w-[160px] items-center justify-center rounded-2xl px-6 text-lg font-extrabold uppercase tracking-[0.14em] text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.userBubbleStart}, ${colors.userBubbleEnd})`,
                }}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t("bidBox.button")
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                {t("bidBox.minimumBid")} {formatCurrency(auction.minimum_next_bid)}
              </span>
              {auction.auction_mode === "live" ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                  {t("bidBox.realTime")}
                </span>
              ) : null}
              {bidder ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {bidder.full_name}
                </span>
              ) : null}
            </div>
          </div>

          {auction.winner ? (
            <div className="rounded-[28px] bg-emerald-50 px-4 py-5 text-center text-emerald-700">
              <p className="text-xl font-extrabold">
                {t("winner.message", {
                  bidder: auction.winner.bidder,
                  amount: formatCurrency(auction.winner.amount),
                })}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
