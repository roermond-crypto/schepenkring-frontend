import { api } from "@/lib/api";

export type CopilotAction = {
  id?: number | string;
  action_id?: string;
  title?: string;
  label?: string;
  description?: string;
  reason?: string;
  module?: string;
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

export type CopilotResolveResponse = {
  actions: CopilotAction[];
  results: CopilotResult[];
  answers: CopilotAnswer[];
  confidence?: number;
  clarifying_question?: string;
  needs_confirmation?: boolean;
  [key: string]: unknown;
};

type ResolvePayload = {
  text: string;
  source?: "header" | "chatpage" | string;
  context?: Record<string, unknown>;
};

type TrackPayload = {
  source?: string;
  input_text?: string;
  selected_action_id?: string | null;
  deeplink_returned?: string | null;
  [key: string]: unknown;
};

export type CopilotVoiceSettings = {
  tts_enabled?: boolean;
  tts_voice_id?: string | null;
  stt_language?: string | null;
  rate?: number;
};

export type CopilotCatalogAction = {
  action_id: string;
  title?: string;
  short_description?: string;
  description?: string;
  module?: string;
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

type RequestAttempt = {
  method: "get" | "post" | "put" | "patch";
  url: string;
  data?: unknown;
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
  };
}

export async function resolveCopilot(
  payload: ResolvePayload,
): Promise<CopilotResolveResponse> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/copilot/resolve", data: payload },
    { method: "post", url: "/admin/copilot/resolve", data: payload },
  ]);

  return normalizeResolveResponse(
    unwrapData<Partial<CopilotResolveResponse> | null>(data, null),
  );
}

export async function trackCopilot(payload: TrackPayload): Promise<void> {
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

export async function createCopilotAction(
  payload: CopilotCreateActionPayload,
): Promise<Record<string, unknown>> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/actions", data: payload },
  ]);
  return unwrapData<Record<string, unknown>>(data, {});
}

export async function createCopilotPhrase(
  payload: CopilotCreatePhrasePayload,
): Promise<Record<string, unknown>> {
  const data = await requestWithFallback<unknown>([
    { method: "post", url: "/admin/copilot/phrases", data: payload },
  ]);
  return unwrapData<Record<string, unknown>>(data, {});
}
