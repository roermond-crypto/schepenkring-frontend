"use client";

import { ExternalLink, GitCompare, Sparkles } from "lucide-react";
import type { BoatMatchResult } from "@/lib/api/boat-match";
import { cn } from "@/lib/utils";

type BoatMatchCardsProps = {
  matchedBoat: BoatMatchResult;
  locale: string;
  onUseBoat: (boatId: number) => void;
  onCompare?: (boatId: number) => void;
  selectedBoatId?: number | null;
  labels: {
    source: string;
    match: string;
    viewBoat: string;
    useBoat: string;
    compare: string;
    exactMatch: string;
    similarMatch: string;
  };
};

function matchPercent(matchType: string) {
  if (matchType === "exact") return 98;
  if (matchType === "fuzzy") return 85;
  if (matchType === "partial") return 72;
  return 60;
}

export function BoatMatchCards({
  matchedBoat,
  locale,
  onUseBoat,
  onCompare,
  selectedBoatId,
  labels,
}: BoatMatchCardsProps) {
  if (!matchedBoat.matched || !matchedBoat.boat) return null;

  const boat = matchedBoat.boat;
  const percent = matchPercent(matchedBoat.match_type);
  const deeplink = `/${locale}/yachts/${boat.id}/${encodeURIComponent(
    String(boat.boat_name ?? `${boat.brand ?? ""}-${boat.model ?? ""}`).toLowerCase().replace(/\s+/g, "-"),
  )}`;
  const isSelected = selectedBoatId === boat.id;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
        {matchedBoat.match_type === "exact" ? labels.exactMatch : labels.similarMatch}
      </p>

      <div
        className={cn(
          "rounded-2xl border p-4 transition-all",
          isSelected
            ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100/50"
            : "border-slate-200 bg-white hover:border-emerald-300",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-600" />
              <h4 className="font-bold text-slate-900">
                {[boat.brand, boat.model, boat.year].filter(Boolean).join(" ")}
              </h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {boat.boat_category ?? boat.boat_type ?? "Motor yacht"}
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            {labels.match}: {percent}%
          </span>
        </div>

        <div className="mt-3 grid gap-1 text-xs text-slate-600">
          <p>{labels.source}</p>
          <p>Boat ID: {boat.id}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={deeplink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={13} />
            {labels.viewBoat}
          </a>
          <button
            type="button"
            onClick={() => onUseBoat(boat.id)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            {labels.useBoat}
          </button>
          {onCompare ? (
            <button
              type="button"
              onClick={() => onCompare(boat.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <GitCompare size={13} />
              {labels.compare}
            </button>
          ) : null}
        </div>
      </div>

      {matchedBoat.similar_boats_count > 1 ? (
        <p className="text-xs text-slate-500">
          + {matchedBoat.similar_boats_count - 1} more similar boats in database
        </p>
      ) : null}
    </div>
  );
}
