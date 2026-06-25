import { api } from "@/lib/api";

// ─── Core action shape returned in resolve responses ─────────────────────────

export type CopilotAction = {
  id?: number | string;
  action_id?: string;
  title?: string;
  label?: string;
  description?: string;
  reason?: string;
  module?: string;
  target_type?: "page" | "modal" | "api" | "search" | "ai" | string;
  deeplink?: string;
  route_template?: string;
  query_template?: string;
  confirmation_required?: boolean;
  risk_level?: "low" | "medium" | "high" | string;
  [key: string]: unknown;
};

export type CopilotResult = {
  id?: number | string;
  type?: string;
  title?: string;
  subtitle?: string;
  deeplink?: string;
  score?: number;
  [key: string]: unknown;
};

export type CopilotAnswer = {
  id?: number | string;
  title?: string;
  answer?: string;
  content?: string;
  text?: string;
  actions?: CopilotAction[];
  [key: string]: unknown;
};

export type MatchType =
  | "deterministic"
  | "phrase_match"
  | "ai_match"
  | "no_match";

export type CopilotResolveResponse = {
  actions: CopilotAction[];
  results: CopilotResult[];
  answers: CopilotAnswer[];
  confidence?: number;
  clarifying_question?: string;
  needs_confirmation?: boolean;
  match_type?: MatchType;
  suggestions?: string[];
  [key: string]: unknown;
};

// ─── Admin catalog action shape ───────────────────────────────────────────────

export type AdminCopilotAction = {
  id: number;
  action_id: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  module?: string | null;
  target_type?: "page" | "modal" | "api" | "search" | "ai";
  route_template?: string | null;
  query_template?: string | null;
  required_params?: string[];
  permission_key?: string | null;
  required_role?: string | null;
  risk_level: "low" | "medium" | "high";
  confirmation_required: boolean;
  enabled: boolean;
  tags?: string[];
  phrases?: AdminCopilotPhrase[];
  created_at?: string;
  updated_at?: string;
};

export type AdminCopilotPhrase = {
  id: number;
  copilot_action_id: number;
  phrase: string;
  language?: string | null;
  priority?: number;
  enabled: boolean;
  action?: Pick<AdminCopilotAction, "id" | "action_id" | "title">;
  created_at?: string;
  updated_at?: string;
};

export type CopilotAuditEvent = {
  id: number;
  user_id?: number | null;
  source?: string | null;
  input_text?: string | null;
  selected_action_id?: string | null;
  deeplink_returned?: string | null;
  confidence?: number | null;
  status?: string | null;
  failure_reason?: string | null;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

// ─── Paginated response wrapper ───────────────────────────────────────────────

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

// ─── Voice settings ───────────────────────────────────────────────────────────

export type CopilotVoiceSettings = {
  tts_enabled?: boolean;
  tts_voice_id?: string | null;
  stt_language?: string | null;
  rate?: number;
};

// ─── Legacy catalog / draft / validate / execute types ───────────────────────

export type CopilotCatalogAction = {
  action_id: string;
  title?: string;
  short_description?: string;
  description?: string;
  module?: string;
  target_type?: "page" | "modal" | "api" | "search" | "ai";
  required_role?: string;
  permission_key?: string | null;
  security_level?: string;
  input_schema?: Record<string, unknown> | null;
  example_inputs?: Array<Record<string, unknown>>;
  example_prompts?: string[];
  side_effects?: string[];
  idempotency_rules?: string[];
  rate_limit_class?: string;
  fresh_auth_required_minutes?: number | null;
  confirmation_required?: boolean;
  route_template?: string | null;
  query_template?: string | null;
  required_params?: string[];
  tags?: string[];
  phrases?: string[];
  [key: string]: unknown;
};

export type CopilotActionCatalogResponse = {
  generated_at?: string;
  count?: number;
  actions: CopilotCatalogAction[];
  [key: string]: unknown;
};

export type CopilotDraftPayload = {
  prompt: string;
  language?: string;
  top_k?: number;
  context?: Record<string, unknown>;
};

export type CopilotDraftResponse = {
  draft_id?: string;
  prompt?: string;
  selected_action?: {
    action_id?: string;
    title?: string;
    params?: Record<string, unknown>;
    risk_level?: string;
    confirmation_required?: boolean;
    input_schema?: Record<string, unknown>;
    example_inputs?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  } | null;
  candidates?: Array<{
    action_id?: string;
    title?: string;
    score?: number;
    reason?: string;
    [key: string]: unknown;
  }>;
  confidence?: number;
  clarifying_question?: string | null;
  match_type?: MatchType;
  suggestions?: string[];
  [key: string]: unknown;
};

export type CopilotValidatePayload = {
  action_id: string;
  payload: Record<string, unknown>;
};

export type CopilotValidateResponse = {
  validation_token?: string;
  action_id?: string;
  requires_confirmation?: boolean;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CopilotExecutePayload = {
  validation_token: string;
  confirm?: boolean;
};

export type CopilotExecuteResponse = {
  status?: string;
  action_id?: string;
  payload?: Record<string, unknown>;
  execution?: {
    execution_type?: string;
    deeplink?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CopilotCreateActionPayload = {
  action_id: string;
  title: string;
  module?: string;
  target_type?: "page" | "modal" | "api" | "search" | "ai";
  route_template?: string | null;
  required_params?: string[];
  permission_key?: string | null;
  risk_level?: string;
  confirmation_required?: boolean;
  enabled?: boolean;
  [key: string]: unknown;
};

export type CopilotCreatePhrasePayload = {
  copilot_action_id: number | string;
  phrase: string;
  language: "en" | "nl" | "de" | string;
  priority?: number;
  enabled?: boolean;
  [key: string]: unknown;
};

// ─── Internal request helpers ─────────────────────────────────────────────────

type RequestAttempt = {
  method: "get" | "post" | "put" | "patch" | "delete";
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
};

type ApiError = {
  response?: {
    status?: number;
  };
};

type DataEnvelope<T> = {
  data?: T;
};

function unwrapData<T>(payload: unknown, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as DataEnvelope<unknown>).data;
    return (data ?? fallback) as T;
  }
  return (payload ?? fallback) as T;
}

async function requestWithFallback<T>(attempts: RequestAttempt[]): Promise<T> {
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const res = await api.request<T>({
        method: attempt.method,
        url: attempt.url,
        data: attempt.data,
        params: attempt.params,
      });
      return res.data;
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const status = apiError?.response?.status;
      const canFallback = status === 404 || status === 405;
      if (!canFallback) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error("Copilot request failed");
}

function normalizeResolveResponse(
  payload: Partial<CopilotResolveResponse> | null | undefined,
): CopilotResolveResponse {
  return {
    actions: Array.isArray(payload?.actions) ? payload!.actions : [],
    results: Array.isArray(payload?.results) ? payload!.results : [],
    answers: Array.isArray(payload?.answers) ? payload!.answers : [],
    confidence:
      typeof payload?.confidence === "number" ? payload.confidence : undefined,
    clarifying_question:
      typeof payload?.clarifying_question === "string"
        ? payload.clarifying_question
        : undefined,
    needs_confirmation:
      typeof payload?.needs_confirmation === "boolean"
        ? payload.needs_confirmation
        : undefined,
    match_type: payload?.match_type as MatchType | undefined,
    suggestions: Array.isArray(payload?.suggestions)
      ? (payload!.suggestions as string[])
      : [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function resolveCopilot(payload: {
  text: string;
  source?: "header" | "chatpage" | string;
  context?: Record<string, unknown>;
}): Promise<CopilotResolveResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/copilot/resolve", data: payload },
    { method: "post", url: "/admin/copilot/resolve", data: payload },
  ]);

  return normalizeResolveResponse(
    unwrapData<Partial<CopilotResolveResponse> | null>(data, null),
  );
}

export async function trackCopilot(payload: {
  source?: string;
  input_text?: string;
  selected_action_id?: string | null;
  deeplink_returned?: string | null;
  [key: string]: unknown;
}): Promise<void> {
  await requestWithFallback([
    { method: "post", url: "/copilot/track", data: payload },
    { method: "post", url: "/admin/copilot/track", data: payload },
  ]);
}

export async function getVoiceSettings(): Promise<CopilotVoiceSettings> {
  const data = await requestWithFallback<unknown>([
    { method: "get", url: "/copilot/voice-settings" },
    { method: "get", url: "/admin/copilot/voice-settings" },
  ]);
  return unwrapData<CopilotVoiceSettings>(data, {});
}

export async function updateVoiceSettings(
  payload: CopilotVoiceSettings,
): Promise<CopilotVoiceSettings> {
  const data = await requestWithFallback<unknown>([
    { method: "put", url: "/copilot/voice-settings", data: payload },
    { method: "post", url: "/copilot/voice-settings", data: payload },
    { method: "put", url: "/admin/copilot/voice-settings", data: payload },
    { method: "post", url: "/admin/copilot/voice-settings", data: payload },
  ]);
  return unwrapData<CopilotVoiceSettings>(data, payload);
}

export async function getCopilotActionCatalog(): Promise<CopilotActionCatalogResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "get", url: "/admin/copilot/action-catalog" },
  ]);
  const payload = unwrapData<Record<string, unknown>>(data, {});
  return {
    ...payload,
    actions: Array.isArray(payload.actions)
      ? (payload.actions as CopilotCatalogAction[])
      : [],
  } as CopilotActionCatalogResponse;
}

// ─── Admin: actions CRUD ──────────────────────────────────────────────────────

export async function listCopilotActions(params?: {
  enabled?: boolean;
  module?: string;
}): Promise<AdminCopilotAction[]> {
  const data = await requestWithFallback<unknown>([
    { method: "get", url: "/admin/copilot/actions", params: params as Record<string, unknown> },
  ]);
  const payload = unwrapData<unknown>(data, []);
  return Array.isArray(payload) ? (payload as AdminCopilotAction[]) : [];
}

export async function createCopilotAction(
  payload: CopilotCreateActionPayload,
): Promise<AdminCopilotAction> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/actions", data: payload },
  ]);
  return unwrapData<AdminCopilotAction>(data, {} as AdminCopilotAction);
}

export async function updateCopilotAction(
  id: number | string,
  payload: Partial<CopilotCreateActionPayload>,
): Promise<AdminCopilotAction> {
  const data = await requestWithFallback<unknown>([
    { method: "put", url: `/admin/copilot/actions/${id}`, data: payload },
    { method: "patch", url: `/admin/copilot/actions/${id}`, data: payload },
  ]);
  return unwrapData<AdminCopilotAction>(data, {} as AdminCopilotAction);
}

export async function deleteCopilotAction(id: number | string): Promise<void> {
  await requestWithFallback([
    { method: "delete", url: `/admin/copilot/actions/${id}` },
  ]);
}

// ─── Admin: phrases CRUD ──────────────────────────────────────────────────────

export async function listCopilotPhrases(params?: {
  action_id?: number | string;
  language?: string;
  enabled?: boolean;
}): Promise<AdminCopilotPhrase[]> {
  const data = await requestWithFallback<unknown>([
    { method: "get", url: "/admin/copilot/phrases", params: params as Record<string, unknown> },
  ]);
  const payload = unwrapData<unknown>(data, []);
  return Array.isArray(payload) ? (payload as AdminCopilotPhrase[]) : [];
}

export async function createCopilotPhrase(
  payload: CopilotCreatePhrasePayload,
): Promise<AdminCopilotPhrase> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/phrases", data: payload },
  ]);
  return unwrapData<AdminCopilotPhrase>(data, {} as AdminCopilotPhrase);
}

export async function updateCopilotPhrase(
  id: number | string,
  payload: { phrase?: string; language?: string; priority?: number; enabled?: boolean },
): Promise<AdminCopilotPhrase> {
  const data = await requestWithFallback<unknown>([
    { method: "put", url: `/admin/copilot/phrases/${id}`, data: payload },
    { method: "patch", url: `/admin/copilot/phrases/${id}`, data: payload },
  ]);
  return unwrapData<AdminCopilotPhrase>(data, {} as AdminCopilotPhrase);
}

export async function deleteCopilotPhrase(id: number | string): Promise<void> {
  await requestWithFallback([
    { method: "delete", url: `/admin/copilot/phrases/${id}` },
  ]);
}

// ─── Admin: audit events ──────────────────────────────────────────────────────

export async function getCopilotAuditEvents(params?: {
  per_page?: number;
  all?: boolean;
  status?: string;
  failed_only?: boolean;
  from?: string;
  to?: string;
}): Promise<Paginated<CopilotAuditEvent>> {
  const data = await requestWithFallback<unknown>([
    { method: "get", url: "/copilot/audit", params: { all: 1, ...params } as Record<string, unknown> },
  ]);
  const payload = unwrapData<Paginated<CopilotAuditEvent>>(data, {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 25,
    total: 0,
  });
  return payload;
}

// ─── Draft / validate / execute (unchanged) ───────────────────────────────────

export async function draftCopilotAction(
  payload: CopilotDraftPayload,
): Promise<CopilotDraftResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/draft", data: payload },
  ]);
  return unwrapData<CopilotDraftResponse>(data, {});
}

export async function validateCopilotAction(
  payload: CopilotValidatePayload,
): Promise<CopilotValidateResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/validate", data: payload },
  ]);
  return unwrapData<CopilotValidateResponse>(data, {});
}

export async function executeCopilotAction(
  payload: CopilotExecutePayload,
): Promise<CopilotExecuteResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/execute", data: payload },
  ]);
  return unwrapData<CopilotExecuteResponse>(data, {});
}
