"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmt } from "../_types";
import { IntegrationTooltip } from "./IntegrationTooltip";
import type { GenerateResult, MappingRow, MappingSuggestion, MappingVersion, TestYacht } from "../_types";

type Draft = {
  id: number | null;
  schepenkring_field: string;
  openmarine_xml_path: string;
  default_value: string;
  group_label: string;
  is_required: boolean;
  notes: string;
};

const BLANK_DRAFT: Draft = {
  id: null,
  schepenkring_field: "",
  openmarine_xml_path: "",
  default_value: "",
  group_label: "",
  is_required: false,
  notes: "",
};

export function MappingEditorTab() {
  const t = useTranslations("IntegrationCenter.mappingEditor");

  const [groups, setGroups] = useState<Record<string, MappingRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [acceptingField, setAcceptingField] = useState<string | null>(null);

  const [versions, setVersions] = useState<MappingVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [expandedVersionId, setExpandedVersionId] = useState<number | null>(null);
  const [versionDetail, setVersionDetail] = useState<MappingVersion | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const [testYachts, setTestYachts] = useState<TestYacht[]>([]);
  const [selectedTestYachtId, setSelectedTestYachtId] = useState("");
  const [manualYachtId, setManualYachtId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Record<string, MappingRow[]> }>("/admin/openmarine/mappings");
      setGroups(res.data.data ?? {});
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const res = await api.get<{ data: MappingSuggestion[] }>("/admin/openmarine/mappings/suggestions");
      setSuggestions(res.data.data ?? []);
    } catch {
      toast.error(t("suggestionsLoadFailed"));
    } finally {
      setSuggestionsLoading(false);
    }
  }, [t]);

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const res = await api.get<{ data: MappingVersion[] }>("/admin/openmarine/mappings/versions");
      setVersions(res.data.data ?? []);
    } catch {
      toast.error(t("versionsLoadFailed"));
    } finally {
      setVersionsLoading(false);
    }
  }, [t]);

  const loadTestYachts = useCallback(async () => {
    try {
      const res = await api.get<{ data: TestYacht[] }>("/admin/test-yachts");
      setTestYachts(res.data.data ?? []);
    } catch {
      // Non-critical for this panel — the manual yacht-id field still works.
    }
  }, []);

  useEffect(() => {
    void loadMappings();
    void loadSuggestions();
    void loadVersions();
    void loadTestYachts();
  }, [loadMappings, loadSuggestions, loadVersions, loadTestYachts]);

  const allRows = Object.values(groups).flat();

  const startEdit = (row: MappingRow) => {
    setEditingId(row.id);
    setDraft({
      id: row.id,
      schepenkring_field: row.schepenkring_field,
      openmarine_xml_path: row.openmarine_xml_path,
      default_value: row.default_value ?? "",
      group_label: row.group_label ?? "",
      is_required: row.is_required,
      notes: row.notes ?? "",
    });
  };

  const startAdd = () => {
    setEditingId("new");
    setDraft(BLANK_DRAFT);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(BLANK_DRAFT);
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        schepenkring_field: draft.schepenkring_field,
        openmarine_xml_path: draft.openmarine_xml_path,
        default_value: draft.default_value || null,
        group_label: draft.group_label || null,
        is_required: draft.is_required,
        notes: draft.notes || null,
      };
      if (draft.id) {
        await api.put(`/admin/openmarine/mappings/${draft.id}`, payload);
      } else {
        await api.post("/admin/openmarine/mappings", payload);
      }
      toast.success(t("saveSuccess"));
      cancelEdit();
      void loadMappings();
      void loadVersions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: MappingRow) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeletingId(row.id);
    try {
      await api.delete(`/admin/openmarine/mappings/${row.id}`);
      toast.success(t("deleteSuccess"));
      void loadMappings();
      void loadVersions();
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const acceptSuggestion = async (s: MappingSuggestion) => {
    setAcceptingField(s.schepenkring_field);
    try {
      await api.post("/admin/openmarine/mappings", {
        schepenkring_field: s.schepenkring_field,
        openmarine_xml_path: s.suggested_openmarine_xml_path,
        group_label: s.suggested_group_label,
        is_required: false,
        change_note: `Accepted AI suggestion for ${s.schepenkring_field}`,
      });
      toast.success(t("acceptSuccess"));
      setSuggestions((prev) => prev.filter((x) => x.schepenkring_field !== s.schepenkring_field));
      void loadMappings();
      void loadVersions();
    } catch {
      toast.error(t("acceptFailed"));
    } finally {
      setAcceptingField(null);
    }
  };

  const dismissSuggestion = (s: MappingSuggestion) => {
    setSuggestions((prev) => prev.filter((x) => x.schepenkring_field !== s.schepenkring_field));
  };

  const toggleVersion = async (version: MappingVersion) => {
    if (expandedVersionId === version.id) {
      setExpandedVersionId(null);
      setVersionDetail(null);
      return;
    }
    setExpandedVersionId(version.id);
    try {
      const res = await api.get<MappingVersion>(`/admin/openmarine/mappings/versions/${version.id}`);
      setVersionDetail(res.data);
    } catch {
      toast.error(t("versionsLoadFailed"));
    }
  };

  const restoreVersion = async (version: MappingVersion) => {
    if (!window.confirm(t("restoreConfirm"))) return;
    setRestoringId(version.id);
    try {
      await api.post(`/admin/openmarine/mappings/versions/${version.id}/restore`);
      toast.success(t("restoreSuccess"));
      void loadMappings();
      void loadVersions();
      void loadSuggestions();
    } catch {
      toast.error(t("restoreFailed"));
    } finally {
      setRestoringId(null);
    }
  };

  const generate = async () => {
    const yachtId = selectedTestYachtId || manualYachtId;
    if (!yachtId) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.post<GenerateResult>(`/admin/yachts/${yachtId}/open-marine/generate`);
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("generateFailed");
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const fieldOptions = Array.from(new Set([...allRows.map((r) => r.schepenkring_field), ...suggestions.map((s) => s.schepenkring_field)])).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* ── Mapping table ─────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t("fieldColumn")} → {t("pathColumn")}</p>
          <Button size="sm" onClick={startAdd} disabled={editingId !== null} className="gap-1.5 rounded-lg bg-[#003566] text-white hover:bg-[#00284f]">
            <Plus size={13} /> {t("addRow")}
          </Button>
        </div>

        <datalist id="mapping-field-options">
          {fieldOptions.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-3">{t("groupColumn")}</th>
                  <th className="py-2 pr-3">{t("fieldColumn")}</th>
                  <th className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">{t("pathColumn")} <IntegrationTooltip field="mappingPath" /></span>
                  </th>
                  <th className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">{t("defaultColumn")} <IntegrationTooltip field="defaultValue" /></span>
                  </th>
                  <th className="py-2 pr-3">{t("requiredColumn")}</th>
                  <th className="py-2 pr-3">{t("actionsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {editingId === "new" && (
                  <DraftRow draft={draft} setDraft={setDraft} onSave={() => void saveDraft()} onCancel={cancelEdit} saving={saving} />
                )}
                {Object.entries(groups).map(([groupLabel, rows]) =>
                  rows.map((row) =>
                    editingId === row.id ? (
                      <DraftRow key={row.id} draft={draft} setDraft={setDraft} onSave={() => void saveDraft()} onCancel={cancelEdit} saving={saving} />
                    ) : (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="py-2 pr-3 text-xs text-slate-400">{row.group_label ?? groupLabel}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-700 dark:text-slate-200">{row.schepenkring_field || "—"}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-700 dark:text-slate-200">{row.openmarine_xml_path}</td>
                        <td className="py-2 pr-3 text-xs text-slate-400">{row.default_value ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {row.is_required && <Check size={14} className="text-emerald-500" />}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => startEdit(row)} disabled={editingId !== null} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteRow(row)}
                              disabled={deletingId === row.id}
                              className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                            >
                              {deletingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  ),
                )}
                {allRows.length === 0 && editingId !== "new" && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                      {t("noMappings")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AI suggestions ────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <Sparkles size={13} /> {t("suggestionsTitle")} <IntegrationTooltip field="confidenceScore" />
        </p>
        <p className="mt-1 text-xs text-slate-400">{t("suggestionsBody")}</p>

        {suggestionsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("suggestionsEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {suggestions.map((s) => (
              <div
                key={s.schepenkring_field}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 dark:border-blue-900/30 dark:bg-blue-950/20"
              >
                <div className="text-xs">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{s.schepenkring_field}</span>
                  <span className="text-slate-400"> → </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{s.suggested_openmarine_xml_path}</span>
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-slate-900 dark:text-blue-300">
                    {s.confidence}% {t("confidence")}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={acceptingField === s.schepenkring_field}
                    onClick={() => void acceptSuggestion(s)}
                    className="gap-1 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]"
                  >
                    {acceptingField === s.schepenkring_field ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {t("accept")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dismissSuggestion(s)} className="rounded-lg text-xs">
                    <X size={12} /> {t("dismiss")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Test now ──────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <Play size={13} /> {t("testTitle")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTestYachtId}
            onChange={(e) => {
              setSelectedTestYachtId(e.target.value);
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
              if (e.target.value) setSelectedTestYachtId("");
            }}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <Button
            size="sm"
            disabled={generating || (!selectedTestYachtId && !manualYachtId)}
            onClick={() => void generate()}
            className="gap-1.5 rounded-lg bg-[#003566] text-xs text-white hover:bg-[#00284f]"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {generating ? t("generating") : t("generate")}
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                result.validation.valid
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
              )}
            >
              {result.validation.valid ? t("valid") : t("invalid")}
            </div>
            {result.validation.missing_required.length > 0 && (
              <p className="text-xs text-red-600">{t("missingRequired")}: {result.validation.missing_required.join(", ")}</p>
            )}
            {result.validation.errors.length > 0 && (
              <p className="text-xs text-red-600">{t("errors")}: {result.validation.errors.join(", ")}</p>
            )}
            {result.validation.warnings.length > 0 && (
              <p className="text-xs text-amber-600">{t("warnings")}: {result.validation.warnings.join(", ")}</p>
            )}
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("xmlOutput")}</p>
            <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              {result.xml}
            </pre>
          </div>
        )}
      </div>

      {/* ── Version history ───────────────────────────────────────── */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <History size={13} /> {t("versionsTitle")}
        </p>
        {versionsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("versionsEmpty")}</p>
        ) : (
          <div className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-bold">v{v.version}</span>{" "}
                    {v.change_note && <span className="text-slate-400">— {v.change_note}</span>}{" "}
                    <span className="text-slate-400">
                      · {fmt(v.created_at)} {v.created_by ? `${t("byUser")} ${v.created_by.name}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => void toggleVersion(v)} className="gap-1 rounded-lg text-xs">
                      {expandedVersionId === v.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expandedVersionId === v.id ? t("hide") : t("view")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoringId === v.id}
                      onClick={() => void restoreVersion(v)}
                      className="rounded-lg text-xs"
                    >
                      {restoringId === v.id ? <Loader2 size={12} className="animate-spin" /> : t("restore")}
                    </Button>
                  </div>
                </div>
                {expandedVersionId === v.id && (
                  <div className="overflow-x-auto border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                    {versionDetail?.id === v.id && versionDetail.mappings_snapshot ? (
                      <table className="w-full min-w-[600px] text-xs">
                        <thead>
                          <tr className="text-left text-[10px] uppercase text-slate-400">
                            <th className="py-1 pr-3">{t("groupColumn")}</th>
                            <th className="py-1 pr-3">{t("fieldColumn")}</th>
                            <th className="py-1 pr-3">{t("pathColumn")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {versionDetail.mappings_snapshot.map((row) => (
                            <tr key={row.id} className="border-t border-slate-50 dark:border-slate-800/60">
                              <td className="py-1 pr-3 text-slate-400">{row.group_label ?? "—"}</td>
                              <td className="py-1 pr-3 font-mono text-slate-600 dark:text-slate-300">{row.schepenkring_field || "—"}</td>
                              <td className="py-1 pr-3 font-mono text-slate-600 dark:text-slate-300">{row.openmarine_xml_path}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DraftRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="border-b border-blue-100 bg-blue-50/40 dark:border-blue-900/30 dark:bg-blue-950/10">
      <td className="py-1.5 pr-2">
        <input
          value={draft.group_label}
          onChange={(e) => setDraft({ ...draft, group_label: e.target.value })}
          className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          list="mapping-field-options"
          value={draft.schepenkring_field}
          onChange={(e) => setDraft({ ...draft, schepenkring_field: e.target.value })}
          className="w-36 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={draft.openmarine_xml_path}
          onChange={(e) => setDraft({ ...draft, openmarine_xml_path: e.target.value })}
          className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          value={draft.default_value}
          onChange={(e) => setDraft({ ...draft, default_value: e.target.value })}
          className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input type="checkbox" checked={draft.is_required} onChange={(e) => setDraft({ ...draft, is_required: e.target.checked })} />
      </td>
      <td className="py-1.5 pr-2">
        <div className="flex gap-1">
          <button type="button" onClick={onSave} disabled={saving || !draft.openmarine_xml_path} className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          </button>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
