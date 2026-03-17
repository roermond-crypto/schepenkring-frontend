import { api } from "@/lib/api";

export interface BoatFormConfigFieldOption {
  value: string;
  label: string;
  labels: Record<string, string>;
}

export interface BoatFormConfigField {
  id: number;
  internal_key: string;
  label: string;
  labels: Record<string, string>;
  help_text: string;
  help_texts: Record<string, string>;
  options: BoatFormConfigFieldOption[];
  field_type: string;
  block_key: string;
  step_key: string;
  sort_order: number;
  priority: "primary" | "secondary";
  storage_relation: string | null;
  storage_column: string;
  ai_relevance: boolean;
}

export interface BoatFormConfigBlock {
  block_key: string;
  label: string;
  primary_fields: BoatFormConfigField[];
  secondary_fields: BoatFormConfigField[];
  secondary_count: number;
}

export interface BoatFormConfigPayload {
  boat_type: string | null;
  step: string | null;
  locale: string;
  blocks: BoatFormConfigBlock[];
}

export async function getBoatFormConfig(params?: {
  boatType?: string | null;
  step?: string | null;
  locale?: string | null;
}): Promise<BoatFormConfigPayload> {
  const response = await api.get("/boat-form-config", {
    params: {
      boat_type: params?.boatType ?? undefined,
      step: params?.step ?? undefined,
      locale: params?.locale ?? undefined,
    },
  });

  return response.data.data as BoatFormConfigPayload;
}
