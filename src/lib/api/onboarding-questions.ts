"use client";

import { api } from "@/lib/api";

export type OnboardingQuestionFieldType = "text" | "textarea" | "date" | "select" | "checkbox" | "radio";

export type OnboardingQuestionOption = {
  value: string;
  label: Record<string, string>;
};

export type OnboardingQuestion = {
  id: number;
  step_key: string;
  field_type: OnboardingQuestionFieldType;
  label: Record<string, string>;
  help_text: Record<string, string> | null;
  placeholder: Record<string, string> | null;
  options: OnboardingQuestionOption[] | null;
  required: boolean;
  sort_order: number;
  answer: string | null;
};

export async function getOnboardingQuestions() {
  const res = await api.get("/onboarding-questions");
  return (res.data?.data ?? []) as OnboardingQuestion[];
}

export async function saveOnboardingQuestionAnswers(answers: Record<number, string>) {
  const res = await api.post("/onboarding-questions/answers", { answers });
  return res.data as { message: string };
}
