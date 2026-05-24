import { api } from "@/lib/api";

export type SellerDashboardBid = {
  id: number;
  yacht_id?: number;
  boat_name?: string;
  buyer_name?: string;
  amount?: number;
  asking_price?: number;
  status?: string;
  chat_url?: string;
};

export type SellerDashboardBoat = {
  id: number;
  boat_name?: string;
  name?: string;
  status?: string;
  listing_score?: number;
  price?: number;
  year?: number;
  missing_photos?: boolean;
  new_bids_count?: number;
};

export type SellerDashboardSummary = {
  user?: { name?: string; email?: string; role?: string };
  stats?: {
    boat_count?: number;
    open_bids?: number;
    open_conversations?: number;
    pending_tasks?: number;
    contracts?: number;
    potential_sales_value?: number;
  };
  action_needed?: Array<{
    type: string;
    label?: string;
    count?: number;
    href?: string;
  }>;
  boats?: SellerDashboardBoat[];
  latest_bids?: SellerDashboardBid[];
  contracts?: Array<{
    id: number;
    yacht_id?: number;
    boat_name?: string;
    status?: string;
    sign_url?: string;
  }>;
  onboarding?: { progress_percent?: number; steps?: Array<{ key: string; complete: boolean }> };
  recent_activity?: Array<{ id: string; message?: string; created_at?: string }>;
  messages?: Array<{ id: string; sender?: string; preview?: string; created_at?: string }>;
  tips?: Array<{ message?: string }>;
};

export async function getSellerDashboardSummary(): Promise<SellerDashboardSummary> {
  const res = await api.get("/dashboard/seller/summary");
  return (res.data?.data ?? res.data) as SellerDashboardSummary;
}
