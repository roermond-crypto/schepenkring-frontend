"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Database,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Settings2,
  Shuffle,
  Trash2,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  BOAT_FIELD_PRIORITY_OPTIONS,
  BOAT_FIELD_SOURCES,
  createBoatField,
  deleteBoatField,
  generateBoatFieldHelp,
  getBoatFieldMappings,
  listBoatFields,
  updateBoatField,
  updateBoatFieldMappings,
  type BoatFieldMappingRecord,
  type BoatFieldOptionRecord,
  type BoatFieldPriorityRecord,
  type BoatFieldRecord,
  type BoatFieldSource,
  type BoatFieldSourceSummaryRecord,
  type BoatFieldStorageTarget,
} from "@/lib/api/boat-fields";

const LABEL_LOCALES = ["nl", "en", "de", "fr"] as const;
const HELP_LOCALES = ["nl", "en", "de"] as const;
const FIELD_TYPE_OPTIONS = [
  "text",
  "number",
  "integer",
  "decimal",
  "float",
  "tri_state",
  "select",
] as const;
const MATCH_TYPE_OPTIONS = ["exact", "contains", "regex", "manual"] as const;

type EditableMappingRow = Pick<
  BoatFieldMappingRecord,
  "external_key" | "external_value" | "normalized_value" | "match_type"
>;

type BoatFieldFormState = {
  internal_key: string;
  labels_json: Record<string, string>;
  help_json: Record<string, string>;
  options_json: BoatFieldOptionRecord[];
  field_type: string;
  block_key: string;
  step_key: string;
  sort_order: number;
  storage_relation: string | null;
  storage_column: string;
  ai_relevance: boolean;
  is_active: boolean;
  priorities: BoatFieldPriorityRecord[];
};

const DEFAULT_FORM_STATE: BoatFieldFormState = {
  internal_key: "",
  labels_json: {
    nl: "",
    en: "",
    de: "",
    fr: "",
  },
  help_json: {
    nl: "",
    en: "",
    de: "",
  },
  options_json: [],
  field_type: "text",
  block_key: "interior",
  step_key: "specs",
  sort_order: 0,
  storage_relation: null,
  storage_column: "",
  ai_relevance: true,
  is_active: true,
  priorities: [{ boat_type_key: "default", priority: "primary" }],
};

function mapFieldToFormState(field: BoatFieldRecord): BoatFieldFormState {
  return {
    internal_key: field.internal_key,
    labels_json: {
      nl: field.labels_json?.nl ?? "",
      en: field.labels_json?.en ?? "",
      de: field.labels_json?.de ?? "",
      fr: field.labels_json?.fr ?? "",
    },
    help_json: {
      nl: field.help_json?.nl ?? "",
      en: field.help_json?.en ?? "",
      de: field.help_json?.de ?? "",
    },
    options_json:
      field.options_json?.map((option) => ({
        value: option.value,
        label:
          option.label ??
          option.labels?.en ??
          option.labels?.nl ??
          option.value,
        labels: option.labels ?? {},
      })) ?? [],
    field_type: field.field_type,
    block_key: field.block_key,
    step_key: field.step_key,
    sort_order: field.sort_order ?? 0,
    storage_relation: field.storage_relation ?? null,
    storage_column: field.storage_column ?? "",
    ai_relevance: Boolean(field.ai_relevance),
    is_active: Boolean(field.is_active),
    priorities:
      field.priorities.length > 0
        ? field.priorities.map((priority) => ({
            boat_type_key: priority.boat_type_key,
            priority: priority.priority,
          }))
        : [{ boat_type_key: "default", priority: "primary" }],
  };
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return fallback;
}

function groupFieldsByBlock(fields: BoatFieldRecord[]) {
  return fields.reduce<Record<string, BoatFieldRecord[]>>((groups, field) => {
    if (!groups[field.block_key]) {
      groups[field.block_key] = [];
    }
    groups[field.block_key].push(field);
    return groups;
  }, {});
}

export function BoatFieldSettingsPage() {
  const [fields, setFields] = useState<BoatFieldRecord[]>([]);
  const [storageTargets, setStorageTargets] = useState<BoatFieldStorageTarget[]>(
    [],
  );
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<BoatFieldFormState>(
    DEFAULT_FORM_STATE,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] =
    useState<BoatFieldSource>("scrape");
  const [mappingRows, setMappingRows] = useState<EditableMappingRow[]>([]);
  const [sourceSummary, setSourceSummary] = useState<BoatFieldSourceSummaryRecord[]>(
    [],
  );
  const [observations, setObservations] = useState<
    Array<{
      id: number;
      source: BoatFieldSource;
      external_key: string | null;
      external_value: string;
      observed_count: number;
      last_seen_at: string | null;
    }>
  >([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [deletingField, setDeletingField] = useState(false);
  const [generatingHelp, setGeneratingHelp] = useState(false);

  const selectedField =
    fields.find((field) => field.id === selectedFieldId) ?? null;

  const filteredFields = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return fields;

    return fields.filter((field) => {
      const labels = Object.values(field.labels_json ?? {});
      return (
        field.internal_key.toLowerCase().includes(needle) ||
        field.block_key.toLowerCase().includes(needle) ||
        field.step_key.toLowerCase().includes(needle) ||
        labels.some((label) => label.toLowerCase().includes(needle))
      );
    });
  }, [fields, searchQuery]);

  const groupedFields = useMemo(
    () => groupFieldsByBlock(filteredFields),
    [filteredFields],
  );

  const stepSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          fields
            .map((field) => field.step_key)
            .concat(fieldForm.step_key)
            .filter(Boolean),
        ),
      ).sort(),
    [fieldForm.step_key, fields],
  );

  const blockSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          fields
            .map((field) => field.block_key)
            .concat(fieldForm.block_key)
            .filter(Boolean),
        ),
      ).sort(),
    [fieldForm.block_key, fields],
  );

  const availableStorageColumns = useMemo(() => {
    const selectedTarget =
      storageTargets.find(
        (target) => (target.relation ?? null) === fieldForm.storage_relation,
      ) ?? storageTargets[0];

    return selectedTarget?.columns ?? [];
  }, [fieldForm.storage_relation, storageTargets]);

  const selectedSourceSummary = useMemo(
    () =>
      sourceSummary.find((summary) => summary.source === selectedSource) ?? null,
    [selectedSource, sourceSummary],
  );

  const loadFields = async (preferredFieldId?: number | null) => {
    try {
      setLoadingFields(true);
      const response = await listBoatFields();
      const nextFields = response.data ?? [];
      setFields(nextFields);
      setStorageTargets(response.meta?.storage_targets ?? []);

      const nextSelectedId =
        (preferredFieldId &&
        nextFields.some((field) => field.id === preferredFieldId)
          ? preferredFieldId
          : selectedFieldId &&
              nextFields.some((field) => field.id === selectedFieldId)
            ? selectedFieldId
            : nextFields[0]?.id) ?? null;

      setSelectedFieldId(nextSelectedId);

      if (nextSelectedId) {
        const nextSelectedField = nextFields.find(
          (field) => field.id === nextSelectedId,
        );
        if (nextSelectedField) {
          setFieldForm(mapFieldToFormState(nextSelectedField));
        }
      } else {
        setFieldForm((previous) => ({
          ...DEFAULT_FORM_STATE,
          storage_relation:
            response.meta?.storage_targets?.[0]?.relation ?? null,
          storage_column:
            response.meta?.storage_targets?.[0]?.columns?.[0] ?? "",
          block_key: previous.block_key || DEFAULT_FORM_STATE.block_key,
          step_key: previous.step_key || DEFAULT_FORM_STATE.step_key,
        }));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load boat fields."));
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    void loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadMappings = async () => {
      if (!selectedFieldId) {
        setMappingRows([]);
        setSourceSummary([]);
        setObservations([]);
        return;
      }

      try {
        setLoadingMappings(true);
        const payload = await getBoatFieldMappings(selectedFieldId, selectedSource);
        setMappingRows(
          (payload.mappings ?? []).map((mapping) => ({
            external_key: mapping.external_key ?? "",
            external_value: mapping.external_value ?? "",
            normalized_value: mapping.normalized_value ?? "",
            match_type: mapping.match_type ?? "exact",
          })),
        );
        setSourceSummary(payload.source_summary ?? []);
        setObservations(payload.observations ?? []);
      } catch (error) {
        setMappingRows([]);
        setSourceSummary([]);
        setObservations([]);
        toast.error(getApiErrorMessage(error, "Failed to load mappings."));
      } finally {
        setLoadingMappings(false);
      }
    };

    void loadMappings();
  }, [selectedFieldId, selectedSource]);

  const handleCreateNewField = () => {
    const fallbackTarget = storageTargets[0];
    setSelectedFieldId(null);
    setFieldForm({
      ...DEFAULT_FORM_STATE,
      storage_relation: fallbackTarget?.relation ?? null,
      storage_column: fallbackTarget?.columns?.[0] ?? "",
    });
    setMappingRows([]);
    setSourceSummary([]);
    setObservations([]);
  };

  const handleSelectField = (field: BoatFieldRecord) => {
    setSelectedFieldId(field.id);
    setFieldForm(mapFieldToFormState(field));
  };

  const handleFieldChange = <K extends keyof BoatFieldFormState>(
    key: K,
    value: BoatFieldFormState[K],
  ) => {
    setFieldForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleLabelChange = (locale: (typeof LABEL_LOCALES)[number], value: string) => {
    setFieldForm((previous) => ({
      ...previous,
      labels_json: {
        ...previous.labels_json,
        [locale]: value,
      },
    }));
  };

  const handleHelpChange = (locale: (typeof HELP_LOCALES)[number], value: string) => {
    setFieldForm((previous) => ({
      ...previous,
      help_json: {
        ...previous.help_json,
        [locale]: value,
      },
    }));
  };

  const handlePriorityChange = (
    index: number,
    patch: Partial<BoatFieldPriorityRecord>,
  ) => {
    setFieldForm((previous) => ({
      ...previous,
      priorities: previous.priorities.map((priority, priorityIndex) =>
        priorityIndex === index ? { ...priority, ...patch } : priority,
      ),
    }));
  };

  const handleAddPriority = () => {
    setFieldForm((previous) => ({
      ...previous,
      priorities: [
        ...previous.priorities,
        { boat_type_key: "", priority: "secondary" },
      ],
    }));
  };

  const handleRemovePriority = (index: number) => {
    setFieldForm((previous) => ({
      ...previous,
      priorities:
        previous.priorities.length === 1
          ? [{ boat_type_key: "default", priority: "primary" }]
          : previous.priorities.filter((_, priorityIndex) => priorityIndex !== index),
    }));
  };

  const handleOptionChange = (
    index: number,
    patch: Partial<BoatFieldOptionRecord>,
  ) => {
    setFieldForm((previous) => ({
      ...previous,
      options_json: previous.options_json.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    }));
  };

  const handleAddOption = () => {
    setFieldForm((previous) => ({
      ...previous,
      options_json: [...previous.options_json, { value: "", label: "" }],
    }));
  };

  const handleRemoveOption = (index: number) => {
    setFieldForm((previous) => ({
      ...previous,
      options_json: previous.options_json.filter(
        (_, optionIndex) => optionIndex !== index,
      ),
    }));
  };

  const handleMappingChange = (
    index: number,
    patch: Partial<EditableMappingRow>,
  ) => {
    setMappingRows((previous) =>
      previous.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, ...patch } : mapping,
      ),
    );
  };

  const handleAddMappingRow = (
    row?: Partial<EditableMappingRow> & { external_value?: string },
  ) => {
    setMappingRows((previous) => [
      ...previous,
      {
        external_key: row?.external_key ?? "",
        external_value: row?.external_value ?? "",
        normalized_value: row?.normalized_value ?? "",
        match_type: row?.match_type ?? "exact",
      },
    ]);
  };

  const handleRemoveMappingRow = (index: number) => {
    setMappingRows((previous) =>
      previous.filter((_, mappingIndex) => mappingIndex !== index),
    );
  };

  const handleApplyObservation = (observation: {
    external_key: string | null;
    external_value: string;
  }) => {
    const alreadyMapped = mappingRows.some(
      (mapping) =>
        mapping.external_value.trim().toLowerCase() ===
          observation.external_value.trim().toLowerCase() &&
        (mapping.external_key ?? "").trim().toLowerCase() ===
          (observation.external_key ?? "").trim().toLowerCase(),
    );

    if (alreadyMapped) {
      return;
    }

    handleAddMappingRow({
      external_key: observation.external_key ?? "",
      external_value: observation.external_value,
      normalized_value: "",
      match_type: "exact",
    });
  };

  const handleSaveField = async () => {
    const cleanedPriorities = fieldForm.priorities
      .map((priority) => ({
        boat_type_key: priority.boat_type_key.trim() || "default",
        priority: priority.priority,
      }))
      .filter(
        (priority, index, collection) =>
          collection.findIndex(
            (candidate) => candidate.boat_type_key === priority.boat_type_key,
          ) === index,
      );

    const hasLabel = Object.values(fieldForm.labels_json).some(
      (value) => value.trim() !== "",
    );

    if (!fieldForm.internal_key.trim()) {
      toast.error("Internal key is required.");
      return;
    }

    if (!hasLabel) {
      toast.error("Add at least one translated label.");
      return;
    }

    if (!fieldForm.storage_column.trim()) {
      toast.error("Storage column is required.");
      return;
    }

    try {
      setSavingField(true);
      const cleanedOptions =
        fieldForm.field_type === "select"
          ? fieldForm.options_json
              .map((option) => ({
                value: option.value?.trim() ?? "",
                label: option.label?.trim() ?? "",
              }))
              .filter((option) => option.value !== "")
          : [];

      const payload = {
        ...fieldForm,
        internal_key: fieldForm.internal_key.trim(),
        field_type: fieldForm.field_type.trim(),
        block_key: fieldForm.block_key.trim(),
        step_key: fieldForm.step_key.trim(),
        storage_relation: fieldForm.storage_relation?.trim() || null,
        storage_column: fieldForm.storage_column.trim(),
        labels_json: Object.fromEntries(
          Object.entries(fieldForm.labels_json).map(([locale, label]) => [
            locale,
            label.trim(),
          ]),
        ),
        help_json: Object.fromEntries(
          Object.entries(fieldForm.help_json).map(([locale, helpText]) => [
            locale,
            helpText.trim(),
          ]),
        ),
        options_json: cleanedOptions,
        priorities: cleanedPriorities,
      };

      const savedField = selectedFieldId
        ? await updateBoatField(selectedFieldId, payload)
        : await createBoatField(payload);

      toast.success(
        selectedFieldId ? "Boat field updated." : "Boat field created.",
      );
      await loadFields(savedField.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save boat field."));
    } finally {
      setSavingField(false);
    }
  };

  const handleGenerateHelp = async () => {
    const hasLabel = Object.values(fieldForm.labels_json).some(
      (value) => value.trim() !== "",
    );

    if (!fieldForm.internal_key.trim()) {
      toast.error("Add an internal key before generating help text.");
      return;
    }

    if (!hasLabel) {
      toast.error("Add at least one translated label before generating help text.");
      return;
    }

    try {
      setGeneratingHelp(true);
      const generated = await generateBoatFieldHelp({
        internal_key: fieldForm.internal_key.trim(),
        labels_json: Object.fromEntries(
          Object.entries(fieldForm.labels_json).map(([locale, label]) => [
            locale,
            label.trim(),
          ]),
        ),
        field_type: fieldForm.field_type.trim(),
        block_key: fieldForm.block_key.trim(),
        step_key: fieldForm.step_key.trim(),
        options_json:
          fieldForm.field_type === "select"
            ? fieldForm.options_json
                .map((option) => ({
                  value: option.value?.trim() ?? "",
                  label: option.label?.trim() ?? "",
                  labels: option.labels,
                }))
                .filter((option) => option.value !== "")
            : [],
      });

      setFieldForm((previous) => ({
        ...previous,
        help_json: {
          ...previous.help_json,
          ...generated.help_json,
        },
      }));
      toast.success("Help text generated. Review it before saving.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to generate help text."));
    } finally {
      setGeneratingHelp(false);
    }
  };

  const handleDeleteField = async () => {
    if (!selectedFieldId || !selectedField) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete field "${selectedField.internal_key}"?`)
    ) {
      return;
    }

    try {
      setDeletingField(true);
      await deleteBoatField(selectedFieldId);
      toast.success("Boat field deleted.");
      await loadFields(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete boat field."));
    } finally {
      setDeletingField(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedFieldId) {
      toast.error("Save the field before managing mappings.");
      return;
    }

    try {
      setSavingMappings(true);
      await updateBoatFieldMappings(
        selectedFieldId,
        selectedSource,
        mappingRows.map((mapping) => ({
          external_key: mapping.external_key.trim() || null,
          external_value: mapping.external_value.trim(),
          normalized_value: mapping.normalized_value.trim(),
          match_type: mapping.match_type,
        })),
      );
      toast.success("Mappings updated.");
      const refreshedMappings = await getBoatFieldMappings(
        selectedFieldId,
        selectedSource,
      );
      setMappingRows(
        refreshedMappings.mappings.map((mapping) => ({
          external_key: mapping.external_key ?? "",
          external_value: mapping.external_value,
          normalized_value: mapping.normalized_value,
          match_type: mapping.match_type,
        })),
      );
      setSourceSummary(refreshedMappings.source_summary ?? []);
      setObservations(refreshedMappings.observations ?? []);
      await loadFields(selectedFieldId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save mappings."));
    } finally {
      setSavingMappings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-semibold text-slate-950">
              <Settings2 className="h-8 w-8 text-blue-600" />
              Boat Field Settings
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Central control for dynamic boat form fields, per-boat-type
              priority, and normalized source mappings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadFields(selectedFieldId)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleCreateNewField}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus size={16} />
              New Field
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by field, block, step or label"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-250px)] space-y-5 overflow-y-auto p-4">
              {loadingFields ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading fields...
                </div>
              ) : Object.keys(groupedFields).length === 0 ? (
                <p className="text-sm text-slate-500">
                  No fields found for the current search.
                </p>
              ) : (
                Object.entries(groupedFields).map(([blockKey, blockFields]) => (
                  <div key={blockKey} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {blockKey.replaceAll("_", " ")}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {blockFields.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {blockFields.map((field) => {
                        const selected = field.id === selectedFieldId;

                        return (
                          <button
                            key={field.id}
                            type="button"
                            onClick={() => handleSelectField(field)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-3 text-left transition-all",
                              selected
                                ? "border-blue-300 bg-blue-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {field.labels_json.en ||
                                    field.labels_json.nl ||
                                    field.internal_key}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {field.internal_key}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                {field.field_type}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                              <span>{field.step_key}</span>
                              <span>Mappings {field.mappings_count ?? 0}</span>
                              <span>
                                Usage {field.value_observations_total ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {selectedField ? selectedField.internal_key : "New boat field"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Configure labels, storage target, AI relevance, and
                    per-boat-type priority.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {selectedField && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {selectedField.mappings_count ?? 0} mappings,{" "}
                      {selectedField.value_observations_total ?? 0} observed uses,{" "}
                      {selectedField.value_observations_count ?? 0} raw values
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveField}
                    disabled={savingField}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingField ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Field
                  </button>
                  {selectedField && (
                    <button
                      type="button"
                      onClick={handleDeleteField}
                      disabled={deletingField}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingField ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Database size={16} className="text-blue-600" />
                      Internal Config
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Internal Key
                        </label>
                        <input
                          value={fieldForm.internal_key}
                          onChange={(event) =>
                            handleFieldChange("internal_key", event.target.value)
                          }
                          placeholder="fuel_type"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        />
                      </div>

                      {LABEL_LOCALES.map((locale) => (
                        <div key={locale}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Label {locale.toUpperCase()}
                          </label>
                          <input
                            value={fieldForm.labels_json[locale] ?? ""}
                            onChange={(event) =>
                              handleLabelChange(locale, event.target.value)
                            }
                            placeholder={`Label in ${locale.toUpperCase()}`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                          />
                        </div>
                      ))}

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Field Type
                        </label>
                        <select
                          value={fieldForm.field_type}
                          onChange={(event) =>
                            handleFieldChange("field_type", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        >
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Sort Order
                        </label>
                        <input
                          type="number"
                          value={fieldForm.sort_order}
                          onChange={(event) =>
                            handleFieldChange(
                              "sort_order",
                              Number.parseInt(event.target.value || "0", 10),
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Block
                        </label>
                        <input
                          list="boat-field-block-suggestions"
                          value={fieldForm.block_key}
                          onChange={(event) =>
                            handleFieldChange("block_key", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        />
                        <datalist id="boat-field-block-suggestions">
                          {blockSuggestions.map((block) => (
                            <option key={block} value={block} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Step / Tab
                        </label>
                        <input
                          list="boat-field-step-suggestions"
                          value={fieldForm.step_key}
                          onChange={(event) =>
                            handleFieldChange("step_key", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        />
                        <datalist id="boat-field-step-suggestions">
                          {stepSuggestions.map((step) => (
                            <option key={step} value={step} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Storage Target
                        </label>
                        <select
                          value={fieldForm.storage_relation ?? "__root__"}
                          onChange={(event) => {
                            const nextRelation =
                              event.target.value === "__root__"
                                ? null
                                : event.target.value;
                            const nextTarget =
                              storageTargets.find(
                                (target) =>
                                  (target.relation ?? null) === nextRelation,
                              ) ?? storageTargets[0];

                            setFieldForm((previous) => ({
                              ...previous,
                              storage_relation: nextRelation,
                              storage_column: nextTarget?.columns?.includes(
                                previous.storage_column,
                              )
                                ? previous.storage_column
                                : nextTarget?.columns?.[0] ?? "",
                            }));
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        >
                          {storageTargets.map((target) => (
                            <option
                              key={target.relation ?? "__root__"}
                              value={target.relation ?? "__root__"}
                            >
                              {target.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Storage Column
                        </label>
                        <select
                          value={fieldForm.storage_column}
                          onChange={(event) =>
                            handleFieldChange("storage_column", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                        >
                          {availableStorageColumns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <Sparkles size={16} className="text-blue-600" />
                          Field Help
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          These explanations are shown behind the help icon on
                          the yacht form.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateHelp}
                        disabled={generatingHelp}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingHelp ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        Generate with AI
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      {HELP_LOCALES.map((locale) => (
                        <div key={locale}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Help {locale.toUpperCase()}
                          </label>
                          <textarea
                            value={fieldForm.help_json[locale] ?? ""}
                            onChange={(event) =>
                              handleHelpChange(locale, event.target.value)
                            }
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <GitBranch size={16} className="text-blue-600" />
                      Priority Per Boat Type
                    </div>
                    <div className="space-y-3">
                      {fieldForm.priorities.map((priority, index) => (
                        <div
                          key={`${priority.boat_type_key}-${index}`}
                          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                        >
                          <input
                            value={priority.boat_type_key}
                            onChange={(event) =>
                              handlePriorityChange(index, {
                                boat_type_key: event.target.value,
                              })
                            }
                            placeholder="default, motorboat, sailboat"
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                          />
                          <select
                            value={priority.priority}
                            onChange={(event) =>
                              handlePriorityChange(index, {
                                priority: event.target.value as
                                  | "primary"
                                  | "secondary",
                              })
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                          >
                            {BOAT_FIELD_PRIORITY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemovePriority(index)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddPriority}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <Plus size={16} />
                        Add Boat Type Priority
                      </button>
                    </div>
                  </div>

                  {fieldForm.field_type === "select" && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Settings2 size={16} className="text-blue-600" />
                        Select Options
                      </div>
                      <div className="space-y-3">
                        {fieldForm.options_json.length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                            No select options configured yet.
                          </div>
                        )}

                        {fieldForm.options_json.map((option, index) => (
                          <div
                            key={`${option.value}-${index}`}
                            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            <input
                              value={option.value ?? ""}
                              onChange={(event) =>
                                handleOptionChange(index, {
                                  value: event.target.value,
                                })
                              }
                              placeholder="value"
                              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                            />
                            <input
                              value={option.label ?? ""}
                              onChange={(event) =>
                                handleOptionChange(index, {
                                  label: event.target.value,
                                })
                              }
                              placeholder="Label"
                              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(index)}
                              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <Plus size={16} />
                          Add Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Flags
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Control whether the field is active and whether AI should
                      receive the normalized value.
                    </p>
                  </div>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <span className="text-sm font-medium text-slate-700">
                      AI relevance
                    </span>
                    <input
                      type="checkbox"
                      checked={fieldForm.ai_relevance}
                      onChange={(event) =>
                        handleFieldChange("ai_relevance", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <span className="text-sm font-medium text-slate-700">
                      Active
                    </span>
                    <input
                      type="checkbox"
                      checked={fieldForm.is_active}
                      onChange={(event) =>
                        handleFieldChange("is_active", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Shuffle className="h-5 w-5 text-blue-600" />
                    Mapping Hub
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Map external source values to one normalized internal value.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {BOAT_FIELD_SOURCES.map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        selectedSource === source
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </div>

              {!selectedFieldId ? (
                <div className="p-5 text-sm text-slate-500">
                  Save the field first, then define source mappings and usage
                  normalization.
                </div>
              ) : (
                <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {sourceSummary.map((summary) => (
                        <div
                          key={summary.source}
                          className={cn(
                            "rounded-2xl border p-4 transition-colors",
                            selectedSource === summary.source
                              ? "border-blue-200 bg-blue-50"
                              : "border-slate-200 bg-slate-50",
                          )}
                        >
                          <p className="text-sm font-semibold capitalize text-slate-900">
                            {summary.source.replace(/_/g, " ")}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {summary.mappings_count} mappings
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {summary.observed_total} observations
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {summary.observed_values_count} raw values
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        Value mappings for <span className="font-mono">{selectedSource}</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleAddMappingRow()}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <Plus size={16} />
                          Add Mapping
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveMappings}
                          disabled={savingMappings}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingMappings ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          Save Mappings
                        </button>
                      </div>
                    </div>

                    {loadingMappings ? (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading mappings...
                      </div>
                    ) : mappingRows.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No mappings yet for this source.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mappingRows.map((mapping, index) => (
                          <div
                            key={`${mapping.external_value}-${index}`}
                            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_140px_auto]"
                          >
                            <input
                              value={mapping.external_key ?? ""}
                              onChange={(event) =>
                                handleMappingChange(index, {
                                  external_key: event.target.value,
                                })
                              }
                              placeholder="External key"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                            />
                            <input
                              value={mapping.external_value}
                              onChange={(event) =>
                                handleMappingChange(index, {
                                  external_value: event.target.value,
                                })
                              }
                              placeholder="External value"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                            />
                            <input
                              value={mapping.normalized_value}
                              onChange={(event) =>
                                handleMappingChange(index, {
                                  normalized_value: event.target.value,
                                })
                              }
                              placeholder="Normalized value"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                            />
                            <select
                              value={mapping.match_type}
                              onChange={(event) =>
                                handleMappingChange(index, {
                                  match_type: event.target.value as
                                    | "exact"
                                    | "contains"
                                    | "regex"
                                    | "manual",
                                })
                              }
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                            >
                              {MATCH_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveMappingRow(index)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">
                        Observed raw values
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Usage stats from imports and scrapes help decide whether
                        a field should stay primary or secondary.
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {selectedSourceSummary?.observed_total ?? 0} observations
                        across{" "}
                        {selectedSourceSummary?.observed_values_count ??
                          observations.length}{" "}
                        raw values for this source.
                      </p>
                    </div>

                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                      {observations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          No observed values yet for this source.
                        </div>
                      ) : (
                        observations.map((observation) => (
                          <div
                            key={observation.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-slate-900">
                                  {observation.external_value}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {observation.external_key || "No external key"}
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {observation.observed_count}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApplyObservation(observation)}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              <Plus size={14} />
                              Add mapping row
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
