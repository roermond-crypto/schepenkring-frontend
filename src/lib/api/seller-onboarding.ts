"use client";

import { api } from "@/lib/api";

export type SellerOnboardingStatus = {
  onboarding_id: number;
  status: string;
  next_step: string | null;
  seller_type?: "private" | "business" | null;
  payment_status: string;
  idin_status: string;
  ideal_status: string;
  kyc_status: string;
  contract_status: string;
  risk_score: number;
  manual_review_required: boolean;
  decision?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  is_currently_valid?: boolean;
  profile?: Record<string, string | null> | null;
  payment?: {
    status: string;
    checkout_url?: string | null;
    paid_at?: string | null;
  } | null;
  contract?: {
    id: number;
    type: string;
    status: string;
    pdf_path?: string | null;
    sign_url?: string | null;
    generated_at?: string | null;
    signed_at?: string | null;
  } | null;
  flags: Array<{
    flag_code: string;
    severity: string;
    message: string;
    is_blocking: boolean;
  }>;
  can_publish_boat: boolean;
  provider_redirect_url?: string | null;
};

export type KycQuestion = {
  id: number;
  key: string;
  prompt: string;
  input_type: string;
  required: boolean;
  seller_type_scope: string;
  conditions?: Record<string, unknown> | null;
  answer?: string | null;
  options: Array<{
    id: number;
    value: string;
    label: string;
  }>;
};

export async function startSellerOnboarding() {
  const res = await api.post("/seller-onboarding/start");
  return res.data?.data as SellerOnboardingStatus;
}

export async function getSellerOnboardingStatus() {
  const res = await api.get("/seller-onboarding/status");
  return res.data?.data as SellerOnboardingStatus;
}

export async function saveSellerOnboardingProfile(payload: Record<string, unknown>) {
  const res = await api.put("/seller-onboarding/profile", payload);
  return res.data?.data as SellerOnboardingStatus;
}

export async function createSellerOnboardingPaymentSession(redirectUrl: string) {
  const res = await api.post("/seller-onboarding/payment/session", {
    redirect_url: redirectUrl,
  });

  return {
    checkoutUrl: res.data?.checkout_url as string | null,
    status: res.data?.data as SellerOnboardingStatus,
  };
}

export async function generateSellerOnboardingContract() {
  const res = await api.post("/seller-onboarding/contract/generate");
  return {
    contract: res.data?.contract,
    status: res.data?.data as SellerOnboardingStatus,
  };
}

export async function getSellerOnboardingQuestions() {
  const res = await api.get("/seller-onboarding/kyc/questions");
  return {
    questions: (res.data?.questions ?? []) as KycQuestion[],
    status: res.data?.data as SellerOnboardingStatus,
  };
}

export async function saveSellerOnboardingAnswers(
  answers: Record<string, { value: string }>,
) {
  const res = await api.post("/seller-onboarding/kyc/answers", { answers });
  return res.data?.data as SellerOnboardingStatus;
}

export async function submitSellerOnboarding() {
  const res = await api.post("/seller-onboarding/submit");
  return {
    decision: res.data?.decision,
    status: res.data?.data as SellerOnboardingStatus,
  };
}

export async function startSellerOnboardingSignhost() {
  const res = await api.post("/seller-onboarding/signhost/start");
  return {
    redirectUrl: res.data?.redirect_url as string | null,
    status: res.data?.data as SellerOnboardingStatus,
  };
}

export async function getSellerOnboardingPaymentStatus() {
  const res = await api.get("/seller-onboarding/payment/status");
  return {
    payment: res.data?.payment,
    data: res.data?.data as SellerOnboardingStatus,
  };
}
