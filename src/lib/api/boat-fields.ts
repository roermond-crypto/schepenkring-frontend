import { api } from "@/lib/api";

export const BOAT_FIELD_SOURCES = [
  "yachtshift",
  "scrape",
  "future_import",
] as const;

export const BOAT_FIELD_PRIORITY_OPTIONS = ["primary", "secondary"] as const;

export type BoatFieldSource = (typeof BOAT_FIELD_SOURCES)[number];
export type BoatFieldPriorityValue =
  (typeof BOAT_FIELD_PRIORITY_OPTIONS)[number];

export interface BoatFieldOptionRecord {
  value: string;
  label?: string;
  labels?: Record<string, string>;
}

export interface BoatFieldPriorityRecord {
  id?: number;
  field_id?: number;
  boat_type_key: string;
  priority: BoatFieldPriorityValue;
}

export interface BoatFieldRecord {
  id: number;
  internal_key: string;
  labels_json: Record<string, string>;
  help_json?: Record<string, string> | null;
  options_json?: BoatFieldOptionRecord[] | null;
  field_type: string;
  block_key: string;
  step_key: string;
  sort_order: number;
  storage_relation: string | null;
  storage_column: string;
  ai_relevance: boolean;
  is_active: boolean;
  priorities: BoatFieldPriorityRecord[];
  mappings_count?: number;
  value_observations_count?: number;
  value_observations_total?: number;
}

export interface BoatFieldStorageTarget {
  relation: string | null;
  label: string;
  columns: string[];
}

export interface BoatFieldObservationRecord {
  id: number;
  field_id: number;
  source: BoatFieldSource;
  external_key: string | null;
  external_value: string;
  observed_count: number;
  last_seen_at: string | null;
}

export interface BoatFieldMappingRecord {
  id?: number;
  field_id?: number;
  source: BoatFieldSource;
  external_key: string | null;
  external_value: string;
  normalized_value: string;
  match_type: "exact" | "contains" | "regex" | "manual";
}

export interface BoatFieldMappingsPayload {
  field: {
    id: number;
    internal_key: string;
    labels_json: Record<string, string>;
  };
  source: BoatFieldSource | null;
  mappings: BoatFieldMappingRecord[];
  observations: BoatFieldObservationRecord[];
  source_summary: BoatFieldSourceSummaryRecord[];
}

export interface BoatFieldSourceSummaryRecord {
  source: BoatFieldSource;
  mappings_count: number;
  observed_values_count: number;
  observed_total: number;
  last_seen_at: string | null;
}

export interface BoatFieldUpsertPayload {
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
}

export interface BoatFieldHelpGenerationPayload {
  internal_key: string;
  labels_json: Record<string, string>;
  field_type: string;
  block_key?: string | null;
  step_key?: string | null;
  options_json?: BoatFieldOptionRecord[];
}

export async function listBoatFields(params?: {
  step?: string;
  block?: string;
  search?: string;
  active?: boolean;
}) {
  const response = await api.get("/admin/boat-fields", {
    params: {
      step: params?.step || undefined,
      block: params?.block || undefined,
      search: params?.search || undefined,
      active:
        typeof params?.active === "boolean" ? Number(params.active) : undefined,
    },
  });

  return response.data as {
    data: BoatFieldRecord[];
    meta: {
      storage_targets: BoatFieldStorageTarget[];
    };
  };
}

export async function createBoatField(payload: BoatFieldUpsertPayload) {
  const response = await api.post("/admin/boat-fields", payload);

  return response.data.data as BoatFieldRecord;
}

export async function updateBoatField(
  fieldId: number,
  payload: BoatFieldUpsertPayload,
) {
  const response = await api.put(`/admin/boat-fields/${fieldId}`, payload);

  return response.data.data as BoatFieldRecord;
}

export async function deleteBoatField(fieldId: number) {
  await api.delete(`/admin/boat-fields/${fieldId}`);
}

export async function generateBoatFieldHelp(
  payload: BoatFieldHelpGenerationPayload,
) {
  const response = await api.post("/admin/boat-fields/generate-help", payload);

  return response.data.data as {
    help_json: Record<string, string>;
  };
}

export async function getBoatFieldMappings(
  fieldId: number,
  source: BoatFieldSource,
) {
  const response = await api.get(`/admin/boat-fields/${fieldId}/mappings`, {
    params: { source },
  });

  return response.data.data as BoatFieldMappingsPayload;
}

export async function updateBoatFieldMappings(
  fieldId: number,
  source: BoatFieldSource,
  mappings: Array<
    Pick<
      BoatFieldMappingRecord,
      "external_key" | "external_value" | "normalized_value" | "match_type"
    >
  >,
) {
  const response = await api.put(`/admin/boat-fields/${fieldId}/mappings`, {
    source,
    mappings,
  });

  return response.data.data as {
    field_id: number;
    source: BoatFieldSource;
    mappings: BoatFieldMappingRecord[];
  };
}
