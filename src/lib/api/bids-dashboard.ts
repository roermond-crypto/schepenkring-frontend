import { api } from "@/lib/api";

export type DashboardBid = {
  id: number;
  yacht_id: number;
  boat_name?: string;
  buyer_id?: number;
  buyer_name?: string;
  buyer_verified?: boolean;
  amount: number;
  asking_price?: number;
  status: "pending" | "accepted" | "rejected" | "countered" | string;
  message?: string;
  counter_amount?: number;
  conversation_id?: string;
  created_at?: string;
  allowed_actions?: string[];
};

export async function listDashboardBids(params?: {
  page?: number;
  status?: string;
}): Promise<{ data: DashboardBid[]; meta?: { total?: number } }> {
  const res = await api.get("/bids", { params: { page: 1, ...params } });
  const payload = res.data;
  if (Array.isArray(payload)) return { data: payload as DashboardBid[] };
  if (Array.isArray(payload?.data)) return { data: payload.data as DashboardBid[], meta: payload.meta };
  return { data: [] };
}

export async function acceptBid(bidId: number, payload?: { message?: string }) {
  const res = await api.post(`/bids/${bidId}/accept`, payload ?? {});
  return res.data;
}

export async function rejectBid(bidId: number, payload?: { reason?: string }) {
  const res = await api.post(`/bids/${bidId}/reject`, payload ?? {});
  return res.data;
}

export async function counterBid(bidId: number, payload: { amount: number; message?: string }) {
  const res = await api.post(`/bids/${bidId}/counter`, payload);
  return res.data;
}
