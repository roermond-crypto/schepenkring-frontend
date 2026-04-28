"use client";

import { api } from "@/lib/api";

export type BuyerVerificationStatus = {
  verification_id: number;
  status: string;
  next_step: string | null;
  buyer_type?: "private" | "business" | null;
  idin_status: string;
  ideal_status: string;
  kyc_status: string;
  risk_score: number;
  manual_review_required: boolean;
  decision?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  is_currently_valid?: boolean;
  profile?: Record<string, string | null> | null;
  flags: Array<{
    flag_code: string;
    severity: string;
    message: string;
    is_blocking: boolean;
  }>;
  provider_redirect_url?: string | null;
};

export type BuyerKycQuestion = {
  id: number;
  key: string;
  prompt: string;
  input_type: string;
  required: boolean;
  audience: string;
  conditions?: Record<string, unknown> | null;
  answer?: string | null;
  options: Array<{
    id: number;
    value: string;
    label: string;
  }>;
};

export async function startBuyerVerification() {
  const res = await api.post("/buyer-verification/start");
  return res.data?.data as BuyerVerificationStatus;
}

export async function getBuyerVerificationStatus() {
  const res = await api.get("/buyer-verification/status");
  return res.data?.data as BuyerVerificationStatus;
}

export async function saveBuyerVerificationProfile(payload: Record<string, unknown>) {
  const res = await api.put("/buyer-verification/profile", payload);
  return res.data?.data as BuyerVerificationStatus;
}

export async function getBuyerVerificationQuestions() {
  const res = await api.get("/buyer-verification/kyc/questions");
  return {
    questions: (res.data?.questions ?? []) as BuyerKycQuestion[],
    status: res.data?.data as BuyerVerificationStatus,
  };
}

export async function saveBuyerVerificationAnswers(
  answers: Record<string, { value: string }>,
) {
  const res = await api.post("/buyer-verification/kyc/answers", { answers });
  return res.data?.data as BuyerVerificationStatus;
}

export async function submitBuyerVerification() {
  const res = await api.post("/buyer-verification/submit");
  return {
    decision: res.data?.decision,
    status: res.data?.data as BuyerVerificationStatus,
  };
}

export async function startBuyerVerificationSignhost() {
  const res = await api.post("/buyer-verification/signhost/start");
  return {
    redirectUrl: res.data?.redirect_url as string | null,
    status: res.data?.data as BuyerVerificationStatus,
  };
}
