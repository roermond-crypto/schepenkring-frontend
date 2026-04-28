import { api } from "@/lib/api";

export type SellerIntake = {
  id: number;
  status: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  fuel_type: string | null;
  price: number | null;
  description: string | null;
  boat_type: string | null;
  photos: Array<{ path: string; url: string; original_name?: string | null }>;
  photo_count: number;
  payment?: {
    id: number;
    status: string;
    checkout_url?: string | null;
    paid_at?: string | null;
  } | null;
  listing_workflow_id?: number | null;
  submitted_at?: string | null;
  paid_at?: string | null;
};

export type SellerIntakePayload = {
  brand: string;
  model: string;
  year: number;
  length_m: number;
  width_m: number;
  height_m: number;
  fuel_type: string;
  price?: number | null;
  description?: string | null;
  boat_type?: string | null;
};

export async function createOrLoadSellerIntake(
  payload?: Partial<SellerIntakePayload>,
): Promise<SellerIntake> {
  const res = await api.post("/seller-intakes", payload ?? {});
  return res.data?.data as SellerIntake;
}

export async function getSellerIntake(id: number): Promise<SellerIntake> {
  const res = await api.get(`/seller-intakes/${id}`);
  return res.data?.data as SellerIntake;
}

export async function updateSellerIntake(
  id: number,
  payload: SellerIntakePayload,
): Promise<SellerIntake> {
  const res = await api.put(`/seller-intakes/${id}`, payload);
  return res.data?.data as SellerIntake;
}

export async function uploadSellerIntakePhotos(
  id: number,
  files: File[],
): Promise<SellerIntake> {
  const formData = new FormData();
  files.forEach((file) => formData.append("photos[]", file));

  const res = await api.post(`/seller-intakes/${id}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data?.data as SellerIntake;
}

export async function createSellerIntakePaymentSession(
  id: number,
  redirectUrl: string,
): Promise<{ checkoutUrl: string | null; intake: SellerIntake }> {
  const res = await api.post(`/seller-intakes/${id}/payment/session`, {
    redirect_url: redirectUrl,
  });

  return {
    checkoutUrl: (res.data?.checkout_url as string | null) ?? null,
    intake: res.data?.data as SellerIntake,
  };
}
