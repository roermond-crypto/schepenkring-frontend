import { api } from "@/lib/api";

export type ProfileSetupStatus = {
  role: string;
  selected_role: "buyer" | "seller";
  complete: boolean;
  next_route: string;
  address: {
    formatted_address?: string | null;
    street?: string | null;
    house_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_id?: string | null;
  } | null;
};

export type AddressPrediction = {
  place_id: string;
  main_text?: string | null;
  secondary_text?: string | null;
  description?: string | null;
};

export type AddressSearchResult = {
  items: AddressPrediction[];
  error?: string | null;
};

export async function getProfileSetupStatus(): Promise<ProfileSetupStatus> {
  const res = await api.get("/profile-setup/status");
  return res.data?.data as ProfileSetupStatus;
}

export async function searchProfileAddresses(query: string): Promise<AddressSearchResult> {
  const res = await api.get("/profile-setup/address/search", {
    params: { q: query },
  });

  return {
    items: (res.data?.data ?? []) as AddressPrediction[],
    error: (res.data?.error ?? null) as string | null,
  };
}

export async function saveProfileAddress(placeId: string): Promise<ProfileSetupStatus> {
  const res = await api.put("/profile-setup/address", {
    place_id: placeId,
  });

  return res.data?.data as ProfileSetupStatus;
}
