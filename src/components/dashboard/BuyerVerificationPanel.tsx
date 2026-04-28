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
import {
  getProfileSetupStatus,
  saveProfileAddress,
  searchProfileAddresses,
  type AddressPrediction,
} from "@/lib/api/profile-setup";
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
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const currentStep = status?.next_step ?? (status?.is_currently_valid ? "complete" : "profile");
  const verificationStepActive = currentStep === "verification" || currentStep === "reverification";
  const normalizedCurrentStepKey = verificationStepActive ? "verification" : currentStep;

  const stepConfig = useMemo(
    () => [
      { key: "profile", label: t.steps.profile, icon: UserRound },
      { key: "verification", label: t.steps.verification, icon: ShieldCheck },
      { key: "kyc", label: t.steps.kyc, icon: CircleHelp },
    ],
    [t.steps],
  );

  const currentStepIndex = Math.max(
    stepConfig.findIndex((step) =>
      step.key === "verification" ? verificationStepActive : currentStep === step.key,
    ),
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
    if (addressQuery.trim().length < 3 || selectedPlaceId) {
      if (addressQuery.trim().length < 3) setPredictions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const result = await searchProfileAddresses(addressQuery.trim());
        setPredictions(result.items);
      } catch {
        setPredictions([]);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [addressQuery, selectedPlaceId, visibleStepKey]);

  const handlePredictionSelect = useCallback(async (prediction: AddressPrediction) => {
    setSelectedPlaceId(prediction.place_id);
    setAddressQuery(prediction.description || prediction.main_text || "");
    setPredictions([]);
    try {
      const profileStatus = await saveProfileAddress(prediction.place_id);
      if (profileStatus.address) {
        setProfile(curr => ({
          ...curr,
          address_line_1: buildAddressLine(
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
    } catch {}
  }, []);

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

  async function handleSignhost() {
    try {
      setSaving(true);
      const response = await startBuyerVerificationSignhost();
      const url = response.redirectUrl || response.status?.provider_redirect_url;
      if (url) { window.location.href = url; return; }
      setStatus(response.status);
      toast.error(t.toasts.noSignhostRedirect);
    } catch (error: any) {
      toast.error(t.toasts.signhostError);
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

  function renderInput(label: string, name: keyof ProfileForm, type = "text") {
    const errorList = errors[name];
    const hasError = !!errorList && errorList.length > 0;
    return (
      <label className="flex flex-col gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        <input
          type={type}
          className={cn("h-13 rounded-2xl border bg-white px-5 text-sm font-bold text-slate-700 outline-none transition shadow-sm focus:ring-4 focus:ring-blue-100/50", hasError ? "border-red-500" : "border-slate-100 focus:border-[#003566]")}
          value={profile[name]}
          onChange={(e) => setProfile((c) => ({ ...c, [name]: e.target.value }))}
        />
        {hasError && <p className="text-[10px] font-bold text-red-500 lowercase tracking-normal">{errorList[0]}</p>}
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
        {visibleStepKey === "profile" && (
          <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 mb-4">
                <div className="rounded-2xl bg-blue-50/50 border border-blue-100/50 p-6">
                  <h3 className="text-sm font-bold text-[#003566] mb-4 flex items-center gap-2">
                    <Search size={16} />
                    {t.sections.profile.addressLabel}
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-6 pr-4 text-sm font-bold text-slate-700 outline-none transition shadow-sm focus:border-[#003566] focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                      value={addressQuery}
                      onChange={(e) => { setAddressQuery(e.target.value); setSelectedPlaceId(null); setPredictions([]); }}
                      placeholder={t.sections.profile.addressPlaceholder}
                    />
                    {!!predictions.length && !selectedPlaceId && (
                      <div className="absolute mt-2 w-full z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                        {predictions.map((p) => (
                          <button 
                            key={p.place_id} 
                            type="button" 
                            onClick={() => handlePredictionSelect(p)} 
                            className="block w-full border-b border-slate-50 px-5 py-4 text-left text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-[#003566] transition-colors"
                          >
                            {p.description}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                <div className="md:col-span-2">
                    <button type="submit" disabled={saving} className="rounded-2xl bg-[#003566] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        {saving ? t.actions.saving : t.actions.saveProfile}
                    </button>
                </div>
            </form>
        )}

        {visibleStepKey === "verification" && (
           <div className="text-center">
              <ShieldCheck className="mx-auto h-16 w-16 text-blue-500" />
              <h3 className="mt-4 text-xl font-bold">{t.sections.verification.title}</h3>
              <p className="mt-2 text-slate-600">{currentStep === 'reverification' ? t.sections.verification.reverification : t.sections.verification.description}</p>
              <button onClick={handleSignhost} disabled={saving} className="mt-6 rounded-2xl bg-blue-600 px-6 py-3 text-white">
                {saving ? t.actions.opening : t.sections.verification.action}
              </button>
           </div>
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
      </div>
    </section>
  );
}
