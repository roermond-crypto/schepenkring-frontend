import { api } from "@/lib/api";

export type BoatTemplateResult = {
  template_id: number;
  version: number;
  match_level: "exact" | "close" | "model_only";
  source_boat_count: number;
  year_range: { min: number | null; max: number | null };
  known_values: Record<string, string | number | null>;
  required_fields: string[];
  optional_fields: string[];
  missing_fields: string[];
};

export type BoatMatchResult = {
  matched: boolean;
  match_type: "exact" | "fuzzy" | "partial" | "none" | "error";
  message: string;
  boat: {
    id: number;
    brand: string | null;
    model: string | null;
    year: number | null;
    boat_name: string | null;
    boat_type: string | null;
    boat_category: string | null;
    engine_type: string | null;
    engine_manufacturer: string | null;
    fuel: string | null;
    hull_type: string | null;
    hull_construction: string | null;
    common_specs: Record<string, string | number>;
  } | null;
  common_fields?: Record<string, number>;
  similar_boats_count: number;
  template?: BoatTemplateResult | null;
};

/**
 * Search the boat database for a matching boat by brand, model, and/or year.
 * Returns the best match and common field patterns for similar boats.
 */
export async function matchBoat(params: {
  brand?: string;
  model?: string;
  year?: number | string;
}): Promise<BoatMatchResult> {
  const res = await api.post("/boats/match", params);
  return res.data;
}
