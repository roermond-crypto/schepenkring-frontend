import { api } from "@/lib/api";

export type AiKnowledgeArticle = {
  id: number;
  title: string;
  content: string;
  match_type: "brand" | "model" | "boat_type" | "general";
  match_value: string | null;
  tags: string[] | null;
  language: string;
  status: "active" | "draft" | "archived";
  pinecone_id: string | null;
  last_embedded_at: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
};

export async function getKnowledgeArticles(params: {
  search?: string;
  match_type?: string;
  language?: string;
}) {
  const { data } = await api.get("/admin/knowledge-articles", { params });
  return data as { data: AiKnowledgeArticle[] };
}

export async function createKnowledgeArticle(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/knowledge-articles", payload);
  return data;
}

export async function updateKnowledgeArticle(id: number, payload: Record<string, unknown>) {
  const { data } = await api.put(`/admin/knowledge-articles/${id}`, payload);
  return data;
}

export async function deleteKnowledgeArticle(id: number) {
  const { data } = await api.delete(`/admin/knowledge-articles/${id}`);
  return data as { message: string };
}

export async function seedStarterBrandModelKnowledgeArticles() {
  const { data } = await api.post("/admin/knowledge-articles/seed-starter-brands-models");
  return data as { message: string; embedded_attempts: number };
}

export async function translateKnowledgeArticleDraft(payload: Record<string, unknown>) {
  const { data } = await api.post("/admin/knowledge-articles/translate", payload);
  return data as {
    title: string;
    content: string;
    tags: string[];
    source_language: string;
    target_language: string;
    translated: boolean;
  };
}
