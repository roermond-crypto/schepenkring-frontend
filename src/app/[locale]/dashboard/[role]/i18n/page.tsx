"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Globe,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocaleReport {
  locale: string;
  totalKeys: number;
  encodingIssues: Record<string, string>;   // key → broken value
  missingKeys: string[];
  duplicateValues: Record<string, string[]>; // value → [key1, key2]
  issueCount: number;
}

// ─── Locale data loading ───────────────────────────────────────────────────────

const MOJIBAKE = /Ã[^\s]|â€[™œ"]|Â[\s«»]/;

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, key));
    } else if (typeof v === "string") {
      result[key] = v;
    }
  }
  return result;
}

function analyzeLocale(
  locale: string,
  data: Record<string, unknown>,
  reference: Record<string, string>,
): LocaleReport {
  const flat = flattenKeys(data);
  const encodingIssues: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (MOJIBAKE.test(v)) encodingIssues[k] = v;
  }

  const missingKeys = Object.keys(reference).filter((k) => !(k in flat));

  const valueMap: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v.length > 3) {
      if (!valueMap[v]) valueMap[v] = [];
      valueMap[v].push(k);
    }
  }
  const duplicateValues: Record<string, string[]> = {};
  for (const [v, keys] of Object.entries(valueMap)) {
    if (keys.length > 1) duplicateValues[v] = keys;
  }

  return {
    locale,
    totalKeys: Object.keys(flat).length,
    encodingIssues,
    missingKeys,
    duplicateValues,
    issueCount:
      Object.keys(encodingIssues).length +
      missingKeys.length +
      Object.keys(duplicateValues).length,
  };
}

const LOCALES = ["nl", "en", "de", "fr"] as const;

async function loadLocale(locale: string): Promise<Record<string, unknown>> {
  const mod = await import(`@/locales/${locale}.json`);
  return (mod.default ?? mod) as Record<string, unknown>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ count, label }: { count: number; label: string }) {
  if (count === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={12} />
        {label}: 0
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
      <AlertCircle size={12} />
      {label}: {count}
    </span>
  );
}

function IssueSection({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: "red" | "amber" | "slate";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  const colorMap = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div className={cn("rounded-2xl border", colorMap[color])}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-widest">
          {title} ({count})
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="border-t border-current/10 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
    >
      {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

function LocaleCard({
  report,
  search,
}: {
  report: LocaleReport;
  search: string;
}) {
  const t = useTranslations("I18nQuality");
  const encCount = Object.keys(report.encodingIssues).length;
  const missCount = report.missingKeys.length;
  const dupCount = Object.keys(report.duplicateValues).length;

  const filteredEncoding = useMemo(() => {
    if (!search) return report.encodingIssues;
    const q = search.toLowerCase();
    return Object.fromEntries(
      Object.entries(report.encodingIssues).filter(
        ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q),
      ),
    );
  }, [report.encodingIssues, search]);

  const filteredMissing = useMemo(() => {
    if (!search) return report.missingKeys;
    const q = search.toLowerCase();
    return report.missingKeys.filter((k) => k.toLowerCase().includes(q));
  }, [report.missingKeys, search]);

  return (
    <div
      className={cn(
        "rounded-3xl border bg-white p-5 shadow-sm",
        report.issueCount === 0 ? "border-emerald-200" : "border-rose-200",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black text-white shadow-md",
              report.issueCount === 0
                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-rose-500 to-red-600",
            )}
          >
            {report.locale.toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{report.locale}.json</h3>
            <p className="text-xs text-slate-400">{report.totalKeys} {t("keys")}</p>
          </div>
        </div>
        {report.issueCount === 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <ShieldCheck size={13} />
            {t("clean")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
            <AlertCircle size={13} />
            {t("issuesCount", { count: report.issueCount })}
          </span>
        )}
      </div>

      {/* Issue badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge count={encCount} label={t("badgeEncoding")} />
        <StatusBadge count={missCount} label={t("badgeMissing")} />
        <StatusBadge count={dupCount} label={t("badgeDuplicates")} />
      </div>

      {/* Encoding issues */}
      <IssueSection title={t("sectionEncoding")} count={Object.keys(filteredEncoding).length} color="red">
        <div className="space-y-2 font-mono text-xs">
          {Object.entries(filteredEncoding)
            .slice(0, 50)
            .map(([key, value]) => (
              <div key={key} className="rounded-xl bg-white/70 px-3 py-2">
                <div className="flex items-center text-slate-500">
                  <span className="truncate">{key}</span>
                  <CopyButton text={key} />
                </div>
                <div className="mt-1 text-rose-700 break-all">{value}</div>
              </div>
            ))}
          {Object.keys(filteredEncoding).length > 50 && (
            <p className="text-rose-600">{t("andMore", { count: Object.keys(filteredEncoding).length - 50 })}</p>
          )}
        </div>
      </IssueSection>

      {/* Missing keys */}
      <IssueSection title={t("sectionMissing")} count={filteredMissing.length} color="amber">
        <div className="grid gap-1 font-mono text-xs">
          {filteredMissing.slice(0, 80).map((key) => (
            <div key={key} className="flex items-center rounded-lg bg-white/70 px-2 py-1 text-amber-800">
              <span className="truncate">{key}</span>
              <CopyButton text={key} />
            </div>
          ))}
          {filteredMissing.length > 80 && (
            <p className="text-amber-700">{t("andMore", { count: filteredMissing.length - 80 })}</p>
          )}
        </div>
      </IssueSection>

      {/* Duplicates */}
      <IssueSection title={t("sectionDuplicates")} count={dupCount} color="slate">
        <div className="space-y-2 text-xs">
          {Object.entries(report.duplicateValues)
            .slice(0, 20)
            .map(([value, keys]) => (
              <div key={value} className="rounded-xl bg-white/70 px-3 py-2">
                <div className="mb-1 font-medium text-slate-700 break-all">"{value}"</div>
                <div className="flex flex-wrap gap-1">
                  {keys.map((k) => (
                    <span key={k} className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-600">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </IssueSection>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function I18nAdminPage() {
  const t = useTranslations("I18nQuality");
  const [reports, setReports] = useState<LocaleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastScanned, setLastScanned] = useState<Date | null>(null);

  const runScan = async () => {
    setLoading(true);
    try {
      const loaded = await Promise.all(LOCALES.map((l) => loadLocale(l)));
      const [nlData] = loaded;
      const referenceFlat = flattenKeys(nlData as Record<string, unknown>);

      const newReports = LOCALES.map((locale, i) =>
        analyzeLocale(locale, loaded[i] as Record<string, unknown>, referenceFlat),
      );
      setReports(newReports);
      setLastScanned(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runScan();
  }, []);

  const totalIssues = reports.reduce((sum, r) => sum + r.issueCount, 0);
  const totalKeys = reports[0]?.totalKeys ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-6 py-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20">
            <Globe size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              {t("title")}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {t("summary", { count: LOCALES.length, keys: totalKeys })}
              {lastScanned && t("scannedAt", { time: lastScanned.toLocaleTimeString() })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filterPlaceholder")}
              className="w-56 rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="button"
            onClick={() => void runScan()}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            {t("rescan")}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {reports.map((r) => (
          <div
            key={r.locale}
            className={cn(
              "rounded-2xl border p-4 text-center",
              r.issueCount === 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50",
            )}
          >
            <p className="text-2xl font-black tracking-tight text-slate-800">
              {r.locale.toUpperCase()}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold",
                r.issueCount === 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {r.issueCount === 0 ? (
                <span className="flex items-center justify-center gap-1">
                  <CheckCircle2 size={13} /> {t("clean")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <AlertTriangle size={13} /> {t("issuesCount", { count: r.issueCount })}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">{r.totalKeys} {t("keys")}</p>
          </div>
        ))}
      </div>

      {/* Global summary */}
      {!loading && totalIssues === 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
          <ShieldCheck size={20} />
          <div>
            <p className="font-bold">{t("allCleanTitle")}</p>
            <p className="text-sm">{t("allCleanBody")}</p>
          </div>
        </div>
      )}

      {!loading && totalIssues > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800">
          <AlertTriangle size={20} />
          <div>
            <p className="font-bold">{t("issuesFoundTitle", { count: totalIssues, files: reports.filter((r) => r.issueCount > 0).length })}</p>
            <p className="text-sm">
              {t.rich("issuesFoundBody", {
                command: (chunks) => (
                  <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                    {chunks}
                  </code>
                ),
              })}
            </p>
          </div>
        </div>
      )}

      {/* Locale cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {LOCALES.map((l) => (
            <div key={l} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-200" />
                <div className="h-4 w-24 rounded bg-slate-200" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-3/4 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reports.map((report) => (
            <LocaleCard key={report.locale} report={report} search={search} />
          ))}
        </div>
      )}

      {/* Artisan usage */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-slate-700">
          <FileText size={16} />
          <span className="text-sm font-bold">{t("cliTitle")}</span>
        </div>
        <div className="space-y-2 font-mono text-xs text-slate-600">
          <div className="rounded-xl bg-slate-50 px-4 py-2">
            <span className="text-slate-400">{t("cliScanAll")}</span>
            <div>php artisan translations:scan</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2">
            <span className="text-slate-400">{t("cliScanOne")}</span>
            <div>php artisan translations:scan fr</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2">
            <span className="text-slate-400">{t("cliFix")}</span>
            <div>php artisan translations:scan --fix</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2">
            <span className="text-slate-400">{t("cliJson")}</span>
            <div>php artisan translations:scan --json</div>
          </div>
        </div>
      </div>
    </div>
  );
}
