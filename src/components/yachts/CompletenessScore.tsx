"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Images, Ship, FileText, Video, Folder, CheckCircle2, AlertTriangle } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────

export type ScoreDimension = {
  filled?: number;
  total?: number;
  count?: number;
  target?: number;
  chars?: number;
  pct: number;
  status?: string;
};

export type CompletenessBreakdown = {
  total: number;
  dimensions: {
    basic_data?: ScoreDimension;
    required?: ScoreDimension;
    description?: ScoreDimension;
    images?: ScoreDimension;
    specs?: ScoreDimension;
    video?: ScoreDimension;
    documents?: ScoreDimension;
  };
  weights?: Record<string, number>;
};

// ── Helpers ──────────────────────────────────────────────────────

function scoreColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-amber-500";
  if (pct >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-400";
  if (pct >= 40) return "bg-orange-400";
  return "bg-red-500";
}

function scoreBgLight(pct: number): string {
  if (pct >= 80) return "bg-emerald-50 border-emerald-100";
  if (pct >= 60) return "bg-amber-50 border-amber-100";
  if (pct >= 40) return "bg-orange-50 border-orange-100";
  return "bg-red-50 border-red-100";
}

function dimensionLabel(key: string): string {
  const map: Record<string, string> = {
    basic_data:  "Basisgegevens",
    required:    "Verplichte velden",
    description: "Omschrijving",
    images:      "Afbeeldingen",
    specs:       "Specificaties",
    video:       "Video",
    documents:   "Documenten",
  };
  return map[key] ?? key;
}

function dimensionDetail(key: string, dim: ScoreDimension): string {
  if (key === "description") return `${dim.chars ?? 0} / ${dim.target ?? 1200} tekens`;
  if (key === "images")      return `${dim.count ?? 0} / ${dim.target ?? 50} foto's`;
  if (key === "video")       return dim.status === "ready" ? "Klaar" : dim.status === "in_progress" ? "Bezig" : "Niet aangemaakt";
  if (key === "documents")   return `${dim.count ?? 0} / ${dim.target ?? 3} documenten`;
  const filled = dim.filled ?? dim.count ?? 0;
  const total  = dim.total  ?? dim.target ?? 1;
  return `${filled} / ${total} velden`;
}

function DimensionIcon({ dim }: { dim: string }) {
  const cls = "shrink-0";
  switch (dim) {
    case "images":      return <Images size={12} className={cls} />;
    case "video":       return <Video size={12} className={cls} />;
    case "documents":   return <Folder size={12} className={cls} />;
    case "description": return <FileText size={12} className={cls} />;
    default:            return <Ship size={12} className={cls} />;
  }
}

// ── Tooltip breakdown ────────────────────────────────────────────

function ScoreTooltip({ breakdown }: { breakdown: CompletenessBreakdown }) {
  const dims = Object.entries(breakdown.dimensions ?? {});
  return (
    <div className="w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Score uitsplitsing
      </p>
      <div className="space-y-2">
        {dims.map(([key, dim]) => (
          <div key={key}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                <DimensionIcon dim={key} />
                {dimensionLabel(key)}
              </span>
              <span className={cn("text-[10px] font-bold tabular-nums", scoreColor(dim.pct))}>
                {dim.pct}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={cn("h-full rounded-full transition-all", scoreBg(dim.pct))}
                  style={{ width: `${Math.min(dim.pct, 100)}%` }}
                />
              </div>
              <span className="min-w-[60px] text-right text-[9px] text-slate-400">
                {dimensionDetail(key, dim)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compact badge (for yacht list) ───────────────────────────────

export function CompletenessScoreBadge({
  score,
  breakdown,
  className,
}: {
  score: number | null | undefined;
  breakdown?: CompletenessBreakdown | null;
  className?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const pct = score ?? 0;

  return (
    <div
      className={cn("relative inline-flex", className)}
      ref={ref}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={cn(
          "flex cursor-default items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums",
          scoreBgLight(pct),
          scoreColor(pct),
        )}
      >
        {pct >= 80 ? (
          <CheckCircle2 size={10} />
        ) : pct < 50 ? (
          <AlertTriangle size={10} />
        ) : null}
        {pct}%
      </div>

      {showTooltip && breakdown && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <ScoreTooltip breakdown={breakdown} />
        </div>
      )}
    </div>
  );
}

// ── Full score card (for yacht detail / wizard) ──────────────────

export function CompletenessScoreCard({
  score,
  breakdown,
  missingRequired,
  onRecalculate,
  loading,
}: {
  score: number | null | undefined;
  breakdown?: CompletenessBreakdown | null;
  missingRequired?: string[];
  onRecalculate?: () => void;
  loading?: boolean;
}) {
  const pct = score ?? 0;
  const dims = Object.entries(breakdown?.dimensions ?? {});

  return (
    <div className={cn("rounded-xl border p-4", scoreBgLight(pct))}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-black text-white"
            style={{
              background: `conic-gradient(${pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444"} ${pct * 3.6}deg, #e5e7eb 0deg)`,
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-black" style={{ color: pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444" }}>
              {pct}
            </span>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Volledigheid</p>
            <p className={cn("text-lg font-black", scoreColor(pct))}>{pct}%</p>
          </div>
        </div>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "…" : "Herberekenen"}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all duration-500", scoreBg(pct))}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Dimension bars */}
      {dims.length > 0 && (
        <div className="space-y-1.5">
          {dims.map(([key, dim]) => (
            <div key={key} className="grid grid-cols-[100px_1fr_40px] items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                <DimensionIcon dim={key} />
                {dimensionLabel(key)}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full rounded-full", scoreBg(dim.pct))}
                  style={{ width: `${Math.min(dim.pct, 100)}%` }}
                />
              </div>
              <span className={cn("text-right text-[10px] font-bold tabular-nums", scoreColor(dim.pct))}>
                {dim.pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Missing required fields warning */}
      {missingRequired && missingRequired.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-500">
            Ontbrekende verplichte velden
          </p>
          <p className="text-[10px] text-red-600">
            {missingRequired.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
