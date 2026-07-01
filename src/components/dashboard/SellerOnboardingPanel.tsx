"use client";

import { useEffect, useMemo, useState, useCallback, type FormEvent } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CircleHelp,
  UserRound,
  CheckCircle2,
  CreditCard,
  Search,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { toast } from "react-hot-toast";
import { OnboardingStepper } from "@/components/dashboard/OnboardingStepper";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createSellerOnboardingPaymentSession,
  generateSellerOnboardingContract,
  getSellerOnboardingQuestions,
  getSellerOnboardingStatus,
  getSellerOnboardingPaymentStatus,
  saveSellerOnboardingAnswers,
  saveSellerOnboardingProfile,
  startSellerOnboarding,
  startSellerOnboardingSignhost,
  submitSellerOnboarding,
  type KycQuestion,
  type SellerOnboardingStatus,
} from "@/lib/api/seller-onboarding";
import {
  getProfileSetupStatus,
  saveProfileAddress,
  searchProfileAddresses,
  type AddressPrediction,
} from "@/lib/api/profile-setup";
import { getDictionary, type AppLocale } from "@/lib/i18n";

const BANK_LOGOS = [
  { name: "ABN AMRO", src: "/logos/logo1/Logo-abn.svg" },
  { name: "ING", src: "/logos/logo1/ing-logo.svg" },
  { name: "Rabobank", src: "/logos/banks/rabobank.svg" },
  { name: "Triodos Bank", src: "/logos/logo1/logo-triodos-bank.svg" },
  { name: "bunq", src: "/logos/banks/bunq.svg" },
  { name: "ASN Bank", src: "/logos/banks/asn.svg" },
];

type ProfileForm = {
  seller_type: "private" | "business";
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

type PaymentPageContent = {
  title?: string;
  description?: string;
  items?: Array<{ title: string; body: string }>;
  button_label?: string;
  amount_label?: string;
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
  seller_type: "private",
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

const DEFAULT_PAYMENT_CONTENT: Record<string, PaymentPageContent> = {
  nl: {
    title: "Wat betaal je voor de verkoper-onboarding?",
    description: "De eenmalige onboardingkosten dekken het volledige verificatie- en publicatietraject.",
    items: [
      { title: "Identiteitsverificatie (iDIN)", body: "Je identiteit wordt veilig geverifieerd via je eigen bank." },
      { title: "Bankverificatie (iDEAL)", body: "Een €0,01 verificatiebetaling bevestigt je bankrekening." },
      { title: "Contract en ondertekening", body: "Een digitaal verkoopcontract wordt gegenereerd." },
      { title: "Publicatie op Schepenkring", body: "Na goedkeuring kun je direct je boot(en) publiceren." },
    ],
    button_label: "Verder naar betaling",
    amount_label: "Eenmalig €395,00 (incl. BTW)",
  },
  en: {
    title: "What are you paying for?",
    description: "The one-time onboarding fee covers the complete verification process.",
    button_label: "Proceed to payment",
    amount_label: "One-time €395.00 (incl. VAT)",
  },
};

export function SellerOnboardingPanel({ 
  locale, 
  onComplete 
}: { 
  locale: AppLocale;
  onComplete?: () => void;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.SellerOnboardingPanel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kycQ = (dictionary as any).SellerKycQuestions as Record<string, { prompt: string; options: Record<string, string> }> | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SellerOnboardingStatus | null>(null);
  const [payment, setPayment] = useState<SellerOnboardingStatus["payment"] | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [questions, setQuestions] = useState<KycQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [paymentContent, setPaymentContent] = useState<PaymentPageContent | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const currentStep = status?.next_step ?? (status?.is_currently_valid ? "complete" : "profile");

  const stepConfig = useMemo(
    () => [
      { key: "profile", label: t.steps.profile, icon: UserRound },
      { key: "kyc", label: t.steps.kyc, icon: CircleHelp },
      { key: "complete", label: t.steps.signing, icon: ShieldCheck },
    ],
    [t.steps],
  );

  const currentStepIndex = Math.max(
    stepConfig.findIndex((step) => {
      if (currentStep === "complete" || status?.is_currently_valid || currentStep === "manual_review" || currentStep === "rejected") return step.key === "complete";
      if (currentStep === "kyc") return step.key === "kyc";
      return step.key === "profile";
    }),
    0,
  );
  const normalizedCurrentStepKey =
    status?.is_currently_valid || currentStep === "complete"
      ? "complete"
      : currentStep === "kyc"
        ? "kyc"
        : currentStep === "manual_review" || currentStep === "rejected"
          ? currentStep
          : "profile";
  const visibleStepKey = selectedStepKey ?? normalizedCurrentStepKey;

  const stepperItems = useMemo(
    () =>
      stepConfig.map((step, index) => ({
        key: step.key,
        label: step.label,
        active: step.key === visibleStepKey,
        complete:
          step.key === "profile"
            ? Boolean(status?.profile?.full_name && status?.profile?.email)
            : step.key === "kyc"
              ? status?.kyc_status === "completed"
              : Boolean(status?.is_currently_valid),
        clickable: index <= currentStepIndex,
      })),
    [currentStepIndex, visibleStepKey, status, stepConfig],
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await startSellerOnboarding();
      
      // Fetch status and sync payment with Mollie in one go via the new endpoint
      const paymentRes = await getSellerOnboardingPaymentStatus();
      setPayment(paymentRes.payment);
      setStatus(paymentRes.data);

      if (paymentRes.data.is_currently_valid) {
        onComplete?.();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || t.toasts.load);
    } finally {
      setLoading(false);
    }
  }, [t.toasts.load, onComplete]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.profile) {
      try {
        // Pre-fill from boat intake if the user just came from boot-aanmelden
        const intakeRaw = localStorage.getItem("boat_intake_prefill");
        if (intakeRaw) {
          const intake = JSON.parse(intakeRaw) as {
            full_name?: string; email?: string; phone?: string;
            address_line_1?: string; city?: string; postal_code?: string; country?: string;
          };
          setProfile((curr) => ({
            ...curr,
            full_name: curr.full_name || String(intake.full_name ?? ""),
            email: curr.email || String(intake.email ?? ""),
            phone: curr.phone || String(intake.phone ?? ""),
            address_line_1: curr.address_line_1 || String(intake.address_line_1 ?? ""),
            city: curr.city || String(intake.city ?? ""),
            postal_code: curr.postal_code || String(intake.postal_code ?? ""),
            country: curr.country || String(intake.country ?? "NL"),
          }));
          return;
        }
        const raw = localStorage.getItem("user_data");
        if (raw) {
          const parsed = JSON.parse(raw) as { email?: string; name?: string; phone?: string };
          setProfile((curr) => ({
            ...curr,
            email: curr.email || String(parsed.email ?? ""),
            full_name: curr.full_name || String(parsed.name ?? ""),
            phone: curr.phone || String(parsed.phone ?? ""),
          }));
        }
      } catch {
        // ignore parse errors
      }
      return;
    }
    setProfile(curr => ({
        ...curr,
        seller_type: (status.profile?.seller_type as any) || curr.seller_type,
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
        const response = await getSellerOnboardingQuestions();
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
      const nextStatus = await saveSellerOnboardingProfile({
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
      const response = await startSellerOnboardingSignhost();
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

  async function handlePayment() {
    try {
      setSaving(true);
      const redirectUrl = `${window.location.origin}/${locale}/dashboard/seller/onboarding`;
      const response = await createSellerOnboardingPaymentSession(redirectUrl);
      if (response.checkoutUrl) { window.location.href = response.checkoutUrl; return; }
      setStatus(response.status);
      toast.error(t.toasts.noPaymentRedirect);
    } catch (error: any) {
      toast.error(t.toasts.paymentError);
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
      await saveSellerOnboardingAnswers(payload);
      const response = await submitSellerOnboarding();
      setStatus(response.status);
      if (response.status.is_currently_valid) {
        onComplete?.();
      }
      setSelectedStepKey(null);
      toast.success(t.toasts.kycSubmitted);
    } catch (error: any) {
        if (error?.response?.status === 422) {
             const nextErrors: Record<string, string[]> = {};
             Object.entries(error.response.data.errors as Record<string, string[]>).forEach(([k, v]) => {
                const m = k.match(/^answers\.(.+)\.value$/);
                if (m) nextErrors[m[1]] = v;
                else nextErrors[k] = v;
             });
             setErrors(nextErrors);
        }
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

  if (loading) return <SellerOnboardingPanelSkeleton />;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.3)]">
      <div className="border-b border-slate-100 bg-white p-8 sm:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#003566]/15 bg-[#003566]/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#003566]">
              <ShieldCheck size={12} />
              {t.eyebrow}
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-[#003566] tracking-tight">{t.title}</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl font-medium leading-relaxed">
              {t.subtitle}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">{t.currentProgress}</p>
            <div className="text-2xl font-black text-[#003566]">
              {t.flow.stepCounter.replace("{current}", (currentStepIndex + 1).toString()).replace("{total}", stepConfig.length.toString())}
            </div>
          </div>
        </div>

        <div className="mt-8">
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
            <form onSubmit={handleProfileSubmit} className="grid gap-4 md:grid-cols-2">
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

        {visibleStepKey === "kyc" && (
           <form onSubmit={handleKycSubmit} className="space-y-6">
             {questions.map(q => (
               <div key={q.id} className="rounded-2xl border border-slate-200 p-6 bg-white">
                 <p className="font-bold text-[#12325b]">{kycQ?.[q.key]?.prompt ?? q.prompt}</p>
                 <div className="mt-4 flex flex-wrap gap-3">
                   {q.options.map(opt => (
                     <label key={opt.id} className={cn("cursor-pointer rounded-xl border px-4 py-2 transition", answers[q.key] === opt.value ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-200")}>
                       <input type="radio" value={opt.value} checked={answers[q.key] === opt.value} onChange={() => setAnswers(prev => ({ ...prev, [q.key]: opt.value }))} className="hidden" />
                       {kycQ?.[q.key]?.options?.[opt.value] ?? opt.label}
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

        {visibleStepKey === "complete" && (
          <div className="text-center">
             <ShieldCheck className="mx-auto h-16 w-16 text-emerald-500" />
             <h3 className="mt-4 text-xl font-bold">{t.sections.signing.title}</h3>
             <p className="mt-2 text-slate-600">{t.sections.signing.description}</p>
             <Link
               href={`/${locale}/dashboard/seller/yachts`}
               className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-8 py-4 text-white font-bold"
             >
               {t.createFirstBoat}
             </Link>
          </div>
        )}

        {visibleStepKey === "manual_review" && (
          <div className="text-center py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-800">{t.sections.manualReview.title}</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{t.sections.manualReview.description}</p>
          </div>
        )}

        {visibleStepKey === "rejected" && (
          <div className="text-center py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-800">{t.sections.rejected.title}</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{t.sections.rejected.description}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SellerOnboardingPanelSkeleton() {
  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.3)]">
      <div className="border-b border-slate-100 bg-[#003566] p-8 sm:p-10">
        <Skeleton className="h-6 w-40 rounded-full bg-white/20" />
        <Skeleton className="mt-4 h-10 w-72 max-w-full rounded-md bg-white/20" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl rounded-md bg-white/10" />
        <Skeleton className="mt-6 h-16 w-40 rounded-2xl bg-white/10" />
      </div>

      <div className="p-8 sm:p-10">
        <div className="mb-8 flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-full bg-slate-100" />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24 rounded-md bg-slate-200" />
              <Skeleton className="h-11 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-8 h-12 w-full rounded-2xl bg-slate-200 sm:w-48" />
      </div>
    </section>
  );
}
