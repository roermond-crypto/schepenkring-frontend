import { api } from "@/lib/api";

export type BidRoutingMode = "direct" | "admin_review" | "broker";

export type LocationBidSettings = {
  bids_page_enabled: boolean;
  seller_bid_notifications_enabled: boolean;
  direct_buyer_seller_chat_enabled: boolean;
  bid_routing_mode: BidRoutingMode;
};

export async function getLocationBidSettings(
  locationId: number,
): Promise<LocationBidSettings> {
  const res = await api.get(`/admin/locations/${locationId}/bid-settings`);
  return (res.data?.data ?? res.data) as LocationBidSettings;
}

export async function updateLocationBidSettings(
  locationId: number,
  payload: Partial<LocationBidSettings>,
): Promise<LocationBidSettings> {
  const res = await api.put(`/admin/locations/${locationId}/bid-settings`, payload);
  return (res.data?.data ?? res.data) as LocationBidSettings;
}

export async function getMyLocationBidSettings(): Promise<LocationBidSettings | null> {
  try {
    const res = await api.get("/me/location/bid-settings");
    return (res.data?.data ?? res.data) as LocationBidSettings;
  } catch {
    return null;
  }
}
