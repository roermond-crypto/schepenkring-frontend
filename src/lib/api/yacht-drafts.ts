import { api } from "@/lib/api";

export interface YachtDraftRecord {
  id: number;
  user_id: number;
  draft_id: string;
  yacht_id: number | null;
  status: "active" | "submitted" | "abandoned";
  wizard_step: number;
  payload_json: Record<string, unknown> | null;
  ui_state_json: Record<string, unknown> | null;
  images_manifest_json: Record<string, unknown> | null;
  ai_state_json: Record<string, unknown> | null;
  version: number;
  last_client_saved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateOrReplaceDraftPayload = {
  draft_id: string;
  yacht_id?: number | null;
  status?: "active" | "submitted" | "abandoned";
  wizard_step?: number;
  payload_json?: Record<string, unknown>;
  ui_state_json?: Record<string, unknown>;
  images_manifest_json?: Record<string, unknown>;
  ai_state_json?: Record<string, unknown>;
  version?: number;
  client_saved_at?: string;
};

export type PatchDraftPayload = {
  version: number;
  status?: "active" | "submitted" | "abandoned";
  wizard_step?: number;
  payload_patch?: Record<string, unknown>;
  ui_state_patch?: Record<string, unknown>;
  images_manifest_patch?: Record<string, unknown>;
  ai_state_patch?: Record<string, unknown>;
  client_saved_at?: string;
};

export async function createOrReplaceYachtDraft(
  payload: CreateOrReplaceDraftPayload,
): Promise<YachtDraftRecord> {
  const res = await api.post("/yacht-drafts", payload);
  return res.data;
}

export async function patchYachtDraft(
  draftId: string,
  payload: PatchDraftPayload,
): Promise<YachtDraftRecord> {
  const res = await api.patch(`/yacht-drafts/${encodeURIComponent(draftId)}`, payload);
  return res.data;
}

export async function getYachtDraft(draftId: string): Promise<YachtDraftRecord> {
  const res = await api.get(`/yacht-drafts/${encodeURIComponent(draftId)}`);
  return res.data;
}

export async function attachYachtToDraft(
  draftId: string,
  payload: { yacht_id: number; version?: number },
): Promise<YachtDraftRecord> {
  const res = await api.post(`/yacht-drafts/${encodeURIComponent(draftId)}/attach-yacht`, payload);
  return res.data;
}

export async function commitYachtDraft(
  draftId: string,
  payload?: { version?: number },
): Promise<YachtDraftRecord> {
  const res = await api.post(`/yacht-drafts/${encodeURIComponent(draftId)}/commit`, payload || {});
  return res.data;
}

