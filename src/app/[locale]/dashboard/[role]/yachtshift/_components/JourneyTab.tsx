"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Route, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { fmt } from "../_types";
import type { FieldHistoryResponse, MappingRow, TestYacht } from "../_types";

const CHANGED_BY_LABEL_KEY: Record<string, "byAi" | "bySystem" | "byImport" | null> = {
  ai: "byAi",
  system: "bySystem",
  import: "byImport",
};

export function JourneyTab() {
  const t = useTranslations("IntegrationCenter.journey");

  const [testYachts, setTestYachts] = useState<TestYacht[]>([]);
  const [selectedYachtId, setSelectedYachtId] = useState("");
  const [manualYachtId, setManualYachtId] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentValue, setCurrentValue] = useState<unknown>(undefined);
  const [result, setResult] = useState<FieldHistoryResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [yachtsRes, mappingsRes] = await Promise.all([
          api.get<{ data: TestYacht[] }>("/admin/test-yachts"),
          api.get<{ data: Record<string, MappingRow[]> }>("/admin/openmarine/mappings"),
        ]);
        setTestYachts(yachtsRes.data.data ?? []);
        const fields = Object.values(mappingsRes.data.data ?? {})
          .flat()
          .map((m) => m.schepenkring_field)
          .filter(Boolean);
        setFieldOptions(Array.from(new Set(fields)));
      } catch {
        // Non-critical — manual field/yacht entry still works.
      }
    })();
  }, []);

  const lookup = async () => {
    const yachtId = selectedYachtId || manualYachtId;
    if (!yachtId || !fieldName) return;
    setLoading(true);
    setResult(null);
    setCurrentValue(undefined);
    try {
      const [historyRes, previewRes] = await Promise.all([
        api.get<FieldHistoryResponse>(`/yachts/${yachtId}/fields/${fieldName}/history`),
        api.get<{ database: Record<string, unknown> }>(`/admin/openmarine/preview/${yachtId}`).catch(() => null),
      ]);
      setResult(historyRes.data);
      if (previewRes) setCurrentValue(previewRes.data.database?.[fieldName]);
    } catch {
      toast.error(t("lookupFailed"));
    } finally {
      setLoading(false);
    }
  };

  const changedByLabel = (change: FieldHistoryResponse["history"][number]) => {
    if (change.user) return `${t("byUser")} ${change.user.name}`;
    const key = change.changed_by_type ? CHANGED_BY_LABEL_KEY[change.changed_by_type] : null;
    return key ? t(key) : (change.changed_by_type ?? "—");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <Route size={13} /> {t("historyTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYachtId}
            onChange={(e) => {
              setSelectedYachtId(e.target.value);
              if (e.target.value) setManualYachtId("");
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">{t("selectTestYacht")}</option>
            {testYachts.map((y) => (
              <option key={y.id} value={y.id}>
                #{y.id} {y.boat_name ?? y.model ?? y.boat_type ?? ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{t("orYachtId")}</span>
          <input
            type="number"
            value={manualYachtId}
            onChange={(e) => {
              setManualYachtId(e.target.value);
              if (e.target.value) setSelectedYachtId("");
            }}
            className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            list="journey-field-options"
            placeholder={t("fieldLabel")}
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <datalist id="journey-field-options">
            {fieldOptions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <Button
            size="sm"
            disabled={loading || (!selectedYachtId && !manualYachtId) || !fieldName}
            onClick={() => void lookup()}
            className="gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {loading ? t("lookingUp") : t("lookup")}
          </Button>
        </div>

        {result && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <p className="text-[10px] font-black uppercase text-slate-400">{t("currentValue")}</p>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
                {currentValue === undefined || currentValue === null || currentValue === "" ? "—" : String(currentValue)}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t("historyTitle")}</p>
              {result.history.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">{t("historyEmpty")}</p>
              ) : (
                <div className="space-y-1.5">
                  {result.history.map((change) => (
                    <div key={change.id} className="rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{changedByLabel(change)}</span>
                        <span className="text-slate-400">{fmt(change.created_at)}</span>
                      </div>
                      <div className="mt-1 font-mono text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400">{t("from")}:</span> {change.old_value ?? "—"}{" "}
                        <span className="text-slate-400">{t("to")}:</span> {change.new_value ?? "—"}
                      </div>
                      {(change.confidence_before !== null || change.confidence_after !== null) && (
                        <p className="mt-1 text-slate-400">
                          {t("confidence")}: {change.confidence_before ?? "—"} → {change.confidence_after ?? "—"}
                        </p>
                      )}
                      {change.reason && (
                        <p className="mt-1 text-slate-400">
                          {t("reason")}: {change.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
