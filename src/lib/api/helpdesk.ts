import { api } from "@/lib/api";

export type HelpdeskSession = {
  id: number;
  channel: "phone" | "chat" | "sms" | "email" | string;
  phone_number?: string;
  language?: string;
  status: string;
  tags?: string[];
  events?: Array<{ type: string; at?: string }>;
  transcript?: string;
  created_at?: string;
};

export async function listHelpdeskSessions(): Promise<HelpdeskSession[]> {
  const res = await api.get("/helpdesk/sessions");
  const payload = res.data;
  if (Array.isArray(payload)) return payload as HelpdeskSession[];
  if (Array.isArray(payload?.data)) return payload.data as HelpdeskSession[];
  return [];
}

export async function getHelpdeskSession(id: number): Promise<HelpdeskSession> {
  const res = await api.get(`/helpdesk/sessions/${id}`);
  return (res.data?.data ?? res.data) as HelpdeskSession;
}

export async function startHelpdeskChat(payload: {
  channel?: string;
  language?: string;
  message?: string;
}) {
  const res = await api.post("/helpdesk/chat/start", payload);
  return res.data;
}
