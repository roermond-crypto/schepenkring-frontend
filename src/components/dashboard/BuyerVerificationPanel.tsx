"use client";

import { useEffect, useMemo, useState, useCallback, type FormEvent } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CircleHelp,
  UserRound,
  ArrowRight,
  Search,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { OnboardingStepper } from "@/components/dashboard/OnboardingStepper";
import { cn } from "@/lib/utils";
import {
  getBuyerVerificationQuestions,
  getBuyerVerificationStatus,
  saveBuyerVerificationAnswers,
  saveBuyerVerificationProfile,
  startBuyerVerification,
  startBuyerVerificationSignhost,
  submitBuyerVerification,
  type BuyerKycQuestion,
  type BuyerVerificationStatus,
} from "@/lib/api/buyer-verification";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import {
  saveProfileAddress,
} from "@/lib/api/profile-setup";
import {
  getOnboardingQuestions,
  saveOnboardingQuestionAnswers,
  type OnboardingQuestion,
} from "@/lib/api/onboarding-questions";
import { getDictionary, type AppLocale } from "@/lib/i18n";

type ProfileForm = {
  buyer_type: "private" | "business";
  full_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  birth_date: string;
  company_name: string;
  kvk_number: string;
};

function formatBirthDateLive(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function formatBirthDateForInput(value: string): string {
  const normalized = String(value || "").trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  return normalized;
}

function normalizeBirthDateForSubmit(value: string): string {
  const normalized = String(value || "").trim();
  const displayMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (displayMatch) return `${displayMatch[3]}-${displayMatch[2]}-${displayMatch[1]}`;
  return normalized;
}

function resolveLocaleText(value: Record<string, string> | null | undefined, locale: string): string {
  if (!value) return "";
  return value[locale] || value.nl || value.en || Object.values(value)[0] || "";
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(String(value || "").trim())) ?? "";
}

function buildAddressLine(
  street?: string | null,
  houseNumber?: string | null,
  formatted?: string | null,
) {
  const combined = [street, houseNumber]
    .filter((value) => Boolean(String(value || "").trim()))
    .join(" ");
  return combined || firstNonEmpty(formatted);
}

const defaultProfile: ProfileForm = {
  buyer_type: "private",
  full_name: "",
  email: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "NL",
  birth_date: "",
  company_name: "",
  kvk_number: "",
};

export function BuyerVerificationPanel({ 
  locale, 
  onComplete 
}: { 
  locale: AppLocale;
  onComplete?: () => void;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.BuyerVerificationPanel;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BuyerVerificationStatus | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [questions, setQuestions] = useState<BuyerKycQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [dynamicQuestions, setDynamicQuestions] = useState<OnboardingQuestion[]>([]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<number, string>>({});
  const [startingSignhost, setStartingSignhost] = useState(false);

  const currentStep = status?.next_step ?? (status?.is_currently_valid ? "complete" : "profile");
  // "reverification" reuses the same UI as "verification" (a previous pass
  // expired) — every other value (profile/verification/kyc/manual_review/
  // rejected/complete) maps to its own render branch below. Previously only
  // "profile" and "kyc" had a branch at all, so manual_review/rejected/
  // verification/complete all silently rendered nothing.
  const normalizedCurrentStepKey = currentStep === "reverification" ? "verification" : currentStep;

  const stepConfig = useMemo(
    () => [
      { key: "profile", label: t.steps.profile, icon: UserRound },
      { key: "verification", label: t.steps.verification, icon: ShieldCheck },
      { key: "kyc", label: t.steps.kyc, icon: CircleHelp },
    ],
    [t.steps],
  );

  const currentStepIndex = Math.max(
    stepConfig.findIndex((step) => currentStep === step.key || normalizedCurrentStepKey === step.key),
    0,
  );
  const visibleStepKey = selectedStepKey ?? normalizedCurrentStepKey;

  const stepperItems = useMemo(
    () =>
      stepConfig.map((step, index) => ({
        key: step.key,
        label: step.label,
        active: step.key === visibleStepKey,
        complete:
            step.key === "profile"
              ? Boolean(status?.profile?.full_name)
              : step.key === "verification"
              ? status?.idin_status === "completed" && status?.ideal_status === "completed"
              : status?.kyc_status === "completed",
        clickable: index <= currentStepIndex,
      })),
    [currentStepIndex, visibleStepKey, status, stepConfig],
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await startBuyerVerification();
      const nextStatus = await getBuyerVerificationStatus();
      setStatus(nextStatus);
      if (nextStatus.is_currently_valid) {
        onComplete?.();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t.toasts.load);
    } finally {
      setLoading(false);
    }
  }, [t.toasts.load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.profile) return;
    setProfile(curr => ({
        ...curr,
        buyer_type: (status.profile?.buyer_type as any) || curr.buyer_type,
        full_name: String(status.profile?.full_name ?? curr.full_name ?? ""),
        email: String(status.profile?.email ?? curr.email ?? ""),
        phone: String(status.profile?.phone ?? curr.phone ?? ""),
        address_line_1: String(status.profile?.address_line_1 ?? curr.address_line_1 ?? ""),
        address_line_2: String(status.profile?.address_line_2 ?? curr.address_line_2 ?? ""),
        city: String(status.profile?.city ?? curr.city ?? ""),
        state: String(status.profile?.state ?? curr.state ?? ""),
        postal_code: String(status.profile?.postal_code ?? curr.postal_code ?? ""),
        country: String(status.profile?.country ?? curr.country ?? "NL"),
        birth_date: formatBirthDateForInput(String(status.profile?.birth_date ?? '')),
        company_name: String(status.profile?.company_name ?? curr.company_name ?? ""),
        kvk_number: String(status.profile?.kvk_number ?? curr.kvk_number ?? ""),
    }));
    const line1 = String(status.profile?.address_line_1 ?? "").trim();
    if (line1) setAddressQuery(line1);
  }, [status?.profile]);

  useEffect(() => {
    if (visibleStepKey !== "kyc") return;
    async function loadQuestions() {
      try {
        const response = await getBuyerVerificationQuestions();
        setQuestions(response.questions);
        setStatus(response.status);
        const nextAnswers: Record<string, string> = {};
        response.questions.forEach((q) => { if (q.answer) nextAnswers[q.key] = q.answer; });
        setAnswers(nextAnswers);
      } catch (error: any) {
        toast.error(t.toasts.questionsLoad);
      }
    }
    void loadQuestions();
  }, [visibleStepKey, t.toasts.questionsLoad]);

  useEffect(() => {
    if (visibleStepKey !== "profile") return;
    async function loadDynamicQuestions() {
      try {
        const items = await getOnboardingQuestions();
        setDynamicQuestions(items);
        const nextAnswers: Record<number, string> = {};
        items.forEach((q) => { if (q.answer) nextAnswers[q.id] = q.answer; });
        setDynamicAnswers(nextAnswers);
      } catch {
        // Additive/optional section — a failure here shouldn't block the core profile form.
      }
    }
    void loadDynamicQuestions();
  }, [visibleStepKey]);

  const applySavedAddress = useCallback(async (placeId: string, formattedAddress: string) => {
    setSelectedPlaceId(placeId);
    setAddressQuery(formattedAddress);
    try {
      const profileStatus = await saveProfileAddress(placeId);
      if (profileStatus.address) {
        setProfile((curr) => ({
          ...curr,
          address_line_1:
            buildAddressLine(
              profileStatus.address?.street,
              profileStatus.address?.house_number,
              profileStatus.address?.formatted_address,
            ) || curr.address_line_1,
          city: firstNonEmpty(profileStatus.address?.city) || curr.city,
          state: firstNonEmpty(profileStatus.address?.region) || curr.state,
          postal_code: firstNonEmpty(profileStatus.address?.postal_code) || curr.postal_code,
          country: firstNonEmpty(profileStatus.address?.country, "NL") || curr.country,
        }));
      }
    } catch {
      toast.error(t.toasts.profileSaveError);
    }
  }, [t.toasts.profileSaveError]);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setErrors({});
      if (selectedPlaceId) await saveProfileAddress(selectedPlaceId).catch(() => null);
      const nextStatus = await saveBuyerVerificationProfile({
        ...profile,
        birth_date: normalizeBirthDateForSubmit(profile.birth_date),
      });
      if (dynamicQuestions.length) {
        await saveOnboardingQuestionAnswers(dynamicAnswers).catch(() => null);
      }
      setStatus(nextStatus);
      setSelectedStepKey(null);
      toast.success(t.toasts.profileSaved);
    } catch (error: any) {
        if (error?.response?.status === 422) setErrors(error.response.data.errors);
        toast.error(t.toasts.profileSaveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleKycSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, { value }]));
    try {
      setSaving(true);
      setErrors({});
      await saveBuyerVerificationAnswers(payload);
      const response = await submitBuyerVerification();
      setStatus(response.status);
      if (response.status.is_currently_valid) {
        onComplete?.();
      }
      setSelectedStepKey(null);
      toast.success(t.toasts.kycSubmitted);
    } catch (error: any) {
        if (error?.response?.status === 422) setErrors(error.response.data.errors);
        toast.error(t.toasts.kycError);
    } finally {
      setSaving(false);
    }
  }

  async function handleStartSignhost() {
    setStartingSignhost(true);
    try {
      const { redirectUrl, status: nextStatus } = await startBuyerVerificationSignhost();
      if (nextStatus) setStatus(nextStatus);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.error(t.toasts.noSignhostRedirect);
      }
    } catch {
      toast.error(t.toasts.signhostError);
    } finally {
      setStartingSignhost(false);
    }
  }

  function renderInput(label: string, name: keyof ProfileForm, type = "text") {
    const errorList = errors[name];
    const hasError = !!errorList && errorList.length > 0;
    const isBirthDate = name === "birth_date";
    return (
      <label className="flex flex-col gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        <input
          type={isBirthDate ? "text" : type}
          inputMode={isBirthDate ? "numeric" : undefined}
          maxLength={isBirthDate ? 10 : undefined}
          placeholder={isBirthDate ? "DD-MM-YYYY" : undefined}
          className={cn("h-13 rounded-2xl border bg-white px-5 text-sm font-bold text-slate-700 outline-none transition shadow-sm focus:ring-4 focus:ring-blue-100/50", hasError ? "border-red-500" : "border-slate-100 focus:border-[#003566]")}
          value={profile[name]}
          onChange={(e) =>
            setProfile((c) => ({
              ...c,
              [name]: isBirthDate ? formatBirthDateLive(e.target.value) : e.target.value,
            }))
          }
        />
        {hasError && <p className="text-[10px] font-bold text-red-500 lowercase tracking-normal">{errorList[0]}</p>}
      </label>
    );
  }

  function renderDynamicQuestion(question: OnboardingQuestion) {
    const label = resolveLocaleText(question.label, locale);
    const help = resolveLocaleText(question.help_text, locale);
    const placeholder = resolveLocaleText(question.placeholder, locale);
    const value = dynamicAnswers[question.id] ?? "";
    const setValue = (next: string) => setDynamicAnswers((prev) => ({ ...prev, [question.id]: next }));

    const fieldClass = "h-13 rounded-2xl border border-slate-100 bg-white px-5 text-sm font-bold text-slate-700 outline-none transition shadow-sm focus:border-[#003566] focus:ring-4 focus:ring-blue-100/50";

    return (
      <label key={question.id} className="flex flex-col gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        {question.required && <span className="text-red-500 normal-case">*</span>}
        {question.field_type === "textarea" ? (
          <textarea
            className={cn(fieldClass, "min-h-24 py-3 normal-case tracking-normal font-medium")}
            placeholder={placeholder}
            value={value}
            required={question.required}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : question.field_type === "select" ? (
          <select
            className={cn(fieldClass, "normal-case tracking-normal font-medium")}
            value={value}
            required={question.required}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">{placeholder || "—"}</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{resolveLocaleText(opt.label, locale) || opt.value}</option>
            ))}
          </select>
        ) : question.field_type === "radio" || question.field_type === "checkbox" ? (
          <div className="flex flex-wrap gap-3 normal-case tracking-normal">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition",
                  value === opt.value ? "bg-blue-50 border-[#003566] text-[#003566]" : "bg-white border-slate-200 text-slate-600",
                )}
              >
                <input
                  type={question.field_type === "radio" ? "radio" : "checkbox"}
                  className="hidden"
                  checked={value === opt.value}
                  onChange={() => setValue(value === opt.value ? "" : opt.value)}
                />
                {resolveLocaleText(opt.label, locale) || opt.value}
              </label>
            ))}
          </div>
        ) : (
          <input
            type="text"
            inputMode={question.field_type === "date" ? "numeric" : undefined}
            maxLength={question.field_type === "date" ? 10 : undefined}
            placeholder={question.field_type === "date" ? "DD-MM-YYYY" : placeholder}
            className={fieldClass}
            value={value}
            required={question.required}
            onChange={(e) => setValue(question.field_type === "date" ? formatBirthDateLive(e.target.value) : e.target.value)}
          />
        )}
        {help && <p className="text-[10px] font-medium text-slate-400 normal-case tracking-normal">{help}</p>}
      </label>
    );
  }

  if (loading) return <div className="flex justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.3)]">
      <div className="relative border-b border-slate-100 bg-[#003566] p-8 sm:p-10 overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-200 border border-white/10 backdrop-blur-md">
            <ShieldCheck size={12} />
            {t.eyebrow}
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight">{t.title}</h2>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-500 font-bold">
              {t.blocks.verificationWarning}
            </p>
          </div>
        </div>
        
        <div className="mt-10">
          <OnboardingStepper
            steps={stepperItems}
            onStepSelect={(key) => {
              const idx = stepConfig.findIndex(s => s.key === key);
              if (idx <= currentStepIndex) setSelectedStepKey(key === normalizedCurrentStepKey ? null : key);
            }}
          />
        </div>
      </div>

      <div className="p-8 sm:p-10">
        {visibleStepKey === "verification" && (
          <div className="rounded-2xl border border-slate-200 p-6 bg-white">
            <h3 className="font-bold text-[#12325b] text-lg mb-2">{t.sections.verification.title}</h3>
            <p className="text-sm text-slate-500 mb-6">
              {currentStep === "reverification" ? t.sections.verification.reverification : t.sections.verification.description}
            </p>
            <button
              type="button"
              onClick={() => void handleStartSignhost()}
              disabled={startingSignhost}
              className="rounded-2xl bg-[#003566] px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {startingSignhost ? t.actions.opening : t.sections.verification.action}
            </button>
          </div>
        )}

        {visibleStepKey === "profile" && (
          <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 mb-4">
                <div className="rounded-2xl bg-blue-50/50 border border-blue-100/50 p-6">
                  <h3 className="text-sm font-bold text-[#003566] mb-4 flex items-center gap-2">
                    <Search size={16} />
                    {t.sections.profile.addressLabel}
                  </h3>
                  <LocationAutocomplete
                    value={addressQuery}
                    placeholder={t.sections.profile.addressPlaceholder}
                    className="h-14 rounded-2xl border-slate-200 text-sm font-bold shadow-sm focus:border-[#003566] focus:ring-4 focus:ring-blue-500/10"
                    onChange={(nextValue) => {
                      setAddressQuery(nextValue);
                      setSelectedPlaceId(null);
                    }}
                    onSelectPlace={(place) => {
                      void applySavedAddress(place.placeId, place.formattedAddress);
                    }}
                  />
                </div>
              </div>
                {renderInput(t.fields.fullName, "full_name")}
                {renderInput(t.fields.email, "email", "email")}
                {renderInput(t.fields.phone, "phone")}
                {renderInput(t.fields.addressLine1, "address_line_1")}
                {renderInput(t.fields.city, "city")}
                {renderInput(t.fields.postalCode, "postal_code")}
                {renderInput(t.fields.country, "country")}
                {renderInput(t.fields.birthDate, "birth_date")}
                {dynamicQuestions.map((question) => renderDynamicQuestion(question))}
                <div className="md:col-span-2">
                    <button type="submit" disabled={saving} className="rounded-2xl bg-[#003566] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? t.actions.saving : t.actions.saveProfile}
                    </button>
                </div>
            </form>
        )}

        {visibleStepKey === "kyc" && (
           <form onSubmit={handleKycSubmit} className="space-y-6">
             {questions.map(q => (
               <div key={q.id} className="rounded-2xl border border-slate-200 p-6 bg-white">
                 <p className="font-bold text-[#12325b]">{q.prompt}</p>
                 <div className="mt-4 flex flex-wrap gap-3">
                   {q.options.map(opt => (
                     <label key={opt.id} className={cn("cursor-pointer rounded-xl border px-4 py-2 transition", answers[q.key] === opt.value ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200")}>
                       <input type="radio" value={opt.value} checked={answers[q.key] === opt.value} onChange={() => setAnswers(prev => ({ ...prev, [q.key]: opt.value }))} className="hidden" />
                       {opt.label}
                     </label>
                   ))}
                 </div>
               </div>
             ))}
             <button type="submit" disabled={saving} className="rounded-2xl bg-[#003566] px-8 py-3 text-white">
                {saving ? t.actions.submitting : t.sections.kyc.action}
             </button>
           </form>
        )}

        {visibleStepKey === "manual_review" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="font-bold text-amber-800">{t.statusValues.manualReview}</p>
            <p className="mt-2 text-sm text-amber-700">{t.blocks.manualReviewBody}</p>
          </div>
        )}

        {visibleStepKey === "rejected" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-bold text-red-800">{t.statusValues.rejected}</p>
            <p className="mt-2 text-sm text-red-700">{t.blocks.rejectedBody}</p>
          </div>
        )}

        {visibleStepKey !== "profile" &&
          visibleStepKey !== "verification" &&
          visibleStepKey !== "kyc" &&
          visibleStepKey !== "manual_review" &&
          visibleStepKey !== "rejected" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="font-bold text-emerald-800">{t.blocks.allDoneBody}</p>
            </div>
          )}
      </div>
    </section>
  );
}
