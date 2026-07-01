"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Upload,
  FileText,
  Camera,
  Anchor,
  Award,
  TrendingUp,
  Phone,
  ShieldCheck,
  MapPin,
  X,
  MessageCircle,
  LogIn,
} from "lucide-react";
import { PublicHeader } from "@/components/common/PublicHeader";
import type { AppLocale } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────

interface Location {
  id: number;
  name: string;
  city?: string;
}

interface IntakeForm {
  seller_first_name: string;
  seller_last_name: string;
  seller_email: string;
  seller_phone: string;
  seller_address: string;
  seller_postal_code: string;
  seller_city: string;
  seller_country: string;
  location_id: number | "";
  boat_brand: string;
  boat_model: string;
  boat_name: string;
  build_year: string;
  length_m: string;
  width_m: string;
  draft_m: string;
  asking_price: string;
  vat_status: string;
  ce_category: string;
  boat_type: string;
  short_description: string;
}

interface ScoreData {
  total: number;
  breakdown: Record<string, number>;
  photo_count: number;
  photo_target: number;
  description_length: number;
  description_target: number;
  missing: { key: string; label: string; severity: string }[];
}

interface SubmitResponse {
  intake: { id: number; status: string; intake_score: number; score: ScoreData; missing_items: ScoreData["missing"] };
  resume_token: string;
}

// T is the BoatIntake section of the locale dictionary
type T = Record<string, unknown>;

function s(t: T, path: string, fallback = ""): string {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = t;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === "string" ? cur : fallback;
}

function arr(t: T, path: string): string[] {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = t;
  for (const p of parts) cur = cur?.[p];
  return Array.isArray(cur) ? (cur as string[]) : [];
}

function obj(t: T, path: string): Record<string, string> {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = t;
  for (const p of parts) cur = cur?.[p];
  return cur && typeof cur === "object" && !Array.isArray(cur) ? (cur as Record<string, string>) : {};
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://app.schepen-kring.nl/api";

const emptyForm: IntakeForm = {
  seller_first_name: "", seller_last_name: "", seller_email: "", seller_phone: "",
  seller_address: "", seller_postal_code: "", seller_city: "", seller_country: "NL",
  location_id: "", boat_brand: "", boat_model: "", boat_name: "", build_year: "",
  length_m: "", width_m: "", draft_m: "", asking_price: "", vat_status: "unknown",
  ce_category: "unknown", boat_type: "", short_description: "",
};

// ── Main component ───────────────────────────────────────────

export function BoatIntakePage({ locale, t }: { locale: AppLocale; t: T }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [locations, setLocations] = useState<Location[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [photos, setPhotos] = useState<{ id: number; url: string }[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [documents, setDocuments] = useState<{ name: string; type: string }[]>([]);
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const STEPS = arr(t, "steps").length > 0 ? arr(t, "steps") : ["Uw gegevens", "Boot details", "Foto's & docs", "Overzicht"];

  // Load locations from the correct public endpoint
  useEffect(() => {
    fetch(`${API}/public/locations`)
      .then((r) => r.json())
      .then((d) => setLocations(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {});
  }, []);

  // Resume from token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      fetch(`${API}/boat-intake/${token}`).then((r) => r.json()).then((d) => {
        if (d.intake) { setResumeToken(token); setStep(2); }
      }).catch(() => {});
    }
  }, []);

  // Google Places address autocomplete — only initialises if the Maps script
  // loaded successfully (key present + domain authorised). If not, address
  // fields remain plain text inputs with no error shown to the visitor.
  useEffect(() => {
    const setup = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.maps?.places?.Autocomplete || !addressInputRef.current) return;
      try {
        const ac = new g.maps.places.Autocomplete(addressInputRef.current, {
          fields: ["address_components"],
          types: ["address"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.address_components) return;
          let streetNumber = "";
          let route = "";
          let city = "";
          let postal = "";
          let country = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (place.address_components as any[]).forEach((c) => {
            if (c.types.includes("street_number")) streetNumber = c.long_name;
            if (c.types.includes("route")) route = c.short_name;
            if (c.types.includes("locality")) city = c.long_name;
            if (c.types.includes("postal_code")) postal = c.long_name;
            if (c.types.includes("country")) country = c.short_name;
          });
          const street = [route, streetNumber].filter(Boolean).join(" ");
          setForm((prev) => ({
            ...prev,
            ...(street && { seller_address: street }),
            ...(city && { seller_city: city }),
            ...(postal && { seller_postal_code: postal }),
            ...(country && { seller_country: country }),
          }));
        });
      } catch {
        // Places unavailable — input stays as plain text, no error shown
      }
    };

    // Only attempt autocomplete if the Maps script was loaded with a key
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places?.Autocomplete) {
      setup();
    } else {
      const timer = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.maps?.places) {
          clearInterval(timer);
          setup();
        }
      }, 500);
      // Stop polling after 10 s — Maps script may never load
      const abort = setTimeout(() => clearInterval(timer), 10_000);
      return () => { clearInterval(timer); clearTimeout(abort); };
    }
  }, []);

  function setField(key: keyof IntakeForm, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validateStep(n: number): boolean {
    const errs: Record<string, string> = {};
    if (n === 0) {
      if (!form.seller_first_name.trim()) errs.seller_first_name = s(t, "errors.required");
      if (!form.seller_last_name.trim()) errs.seller_last_name = s(t, "errors.required");
      if (!form.seller_email.trim() || !/\S+@\S+\.\S+/.test(form.seller_email))
        errs.seller_email = s(t, "errors.emailInvalid");
      if (!form.seller_phone.trim()) errs.seller_phone = s(t, "errors.required");
      if (!form.location_id) errs.location_id = s(t, "errors.locationRequired");
    }
    if (n === 1) {
      if (!form.boat_brand.trim()) errs.boat_brand = s(t, "errors.required");
      if (!form.boat_model.trim()) errs.boat_model = s(t, "errors.required");
      if (!form.asking_price || Number(form.asking_price) <= 0) errs.asking_price = s(t, "errors.priceInvalid");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleNext() {
    if (!validateStep(step)) return;

    if (step === 1 && !resumeToken) {
      setSubmitting(true);
      try {
        const body: Record<string, unknown> = {
          seller_first_name: form.seller_first_name, seller_last_name: form.seller_last_name,
          seller_email: form.seller_email, seller_phone: form.seller_phone,
          seller_address: form.seller_address || undefined, seller_postal_code: form.seller_postal_code || undefined,
          seller_city: form.seller_city || undefined, seller_country: form.seller_country,
          location_id: form.location_id, boat_brand: form.boat_brand, boat_model: form.boat_model,
          boat_name: form.boat_name || undefined, build_year: form.build_year ? Number(form.build_year) : undefined,
          length_m: form.length_m ? Number(form.length_m) : undefined,
          width_m: form.width_m ? Number(form.width_m) : undefined,
          draft_m: form.draft_m ? Number(form.draft_m) : undefined,
          asking_price: Number(form.asking_price), vat_status: form.vat_status,
          ce_category: form.ce_category, boat_type: form.boat_type || undefined,
          short_description: form.short_description || undefined,
          source_url: window.location.href,
        };
        const res = await fetch(`${API}/boat-intake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const j = await res.json();
          if (j.errors) {
            const normalized: Record<string, string> = {};
            for (const [key, val] of Object.entries(j.errors)) {
              normalized[key] = Array.isArray(val) ? (val[0] as string) : String(val);
            }
            setErrors(normalized);
          }
          return;
        }
        const json: SubmitResponse = await res.json();
        setScore(json.intake.score);
        setResumeToken(json.resume_token);
        // Store intake data so onboarding step 1 can be pre-filled
        try {
          localStorage.setItem("boat_intake_prefill", JSON.stringify({
            full_name: `${form.seller_first_name} ${form.seller_last_name}`.trim(),
            email: form.seller_email,
            phone: form.seller_phone,
            address_line_1: form.seller_address,
            city: form.seller_city,
            postal_code: form.seller_postal_code,
            country: form.seller_country || "NL",
            resume_token: json.resume_token,
          }));
        } catch { /* ignore storage errors */ }
        setStep(2);
      } catch {
        setErrors({ _global: s(t, "errors.globalError") });
      } finally { setSubmitting(false); }
      return;
    }

    if (step < 3) setStep((n) => n + 1);
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || !resumeToken) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setUploadingPhotos(true);
    const fd = new FormData();
    list.forEach((f) => fd.append("photos[]", f));
    try {
      const res = await fetch(`${API}/boat-intake/${resumeToken}/photos`, { method: "POST", body: fd });
      const json = await res.json();
      if (json.uploaded) {
        setPhotos((prev) => [...prev, ...json.uploaded.map((u: { id: number; url: string }) => ({ id: u.id, url: u.url }))]);
        setPhotoCount(json.photo_count as number);
        if (json.score) setScore(json.score as ScoreData);
      }
    } catch { /* silent */ } finally { setUploadingPhotos(false); }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!resumeToken) return;
    try {
      const res = await fetch(`${API}/boat-intake/${resumeToken}/photos/${photoId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.deleted) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        setPhotoCount(json.photo_count as number);
        if (json.score) setScore(json.score as ScoreData);
      }
    } catch { /* silent */ }
  }

  async function handleDocFile(file: File, docType: string) {
    if (!resumeToken) return;
    setUploadingDocs(true);
    const fd = new FormData();
    fd.append("documents[]", file);
    fd.append("document_type", docType);
    try {
      const res = await fetch(`${API}/boat-intake/${resumeToken}/documents`, { method: "POST", body: fd });
      if (res.ok) {
        const json = await res.json();
        setDocuments((prev) => [...prev, { name: file.name, type: docType }]);
        if (json.score) setScore(json.score as ScoreData);
      }
    } catch { /* silent */ } finally { setUploadingDocs(false); }
  }

  const scoreColor = (n: number) => n >= 70 ? "text-green-600" : n >= 50 ? "text-amber-600" : "text-red-600";
  const barColor = (n: number) => n >= 70 ? "bg-green-500" : n >= 50 ? "bg-amber-500" : "bg-red-500";

  const vatOptions = obj(t, "boat.vatOptions");
  const ceOptions = obj(t, "boat.ceOptions");
  const docTypes = obj(t, "media.docTypes");
  const boatTypes = arr(t, "boat.boatTypes");

  const docTypeKeys = ["ce_certificate", "vat_document", "invoice", "registration", "maintenance", "other"] as const;

  return (
    <div className="min-h-screen bg-[#edf3f7]">

      {/* ── Nav — white header with logo ── */}
      <PublicHeader
        locale={locale}
        labels={{
          supply: s(t, "nav.supply", "Aanbod"),
          locations: s(t, "nav.locations", "Vestigingen"),
          about: s(t, "nav.about", "Over ons"),
          login: s(t, "nav.login", "Inloggen"),
        }}
        showBootAanmelden={false}
      />

      {/* ── WhatsApp-style contact bar ── */}
      <div className="bg-[#25D366] text-white">
        <div className="max-w-7xl mx-auto px-5 py-2.5 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 shrink-0">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-none">Schepenkring</p>
            <p className="text-[10px] text-white/80 mt-0.5">{s(t, "whatsapp.status", "Online — wij reageren binnen 1 werkdag")}</p>
          </div>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "31611888904"}`}
            target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full">
            {s(t, "whatsapp.cta", "Chat met ons")}
          </a>
        </div>
      </div>

      {/* ── Hero — boat image with dark overlay ── */}
      <div className="relative bg-[#003566] text-white pb-20 pt-12 sm:pt-16 overflow-hidden">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-image-two.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 select-none pointer-events-none"
        />
        <div className="relative z-10 max-w-3xl mx-auto px-5 text-center">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-white/10 text-xs font-bold tracking-widest uppercase">
            {s(t, "hero.badge", "Gratis aanmelden")}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-4">
            {s(t, "hero.title", "Verkoop uw boot via Schepenkring")}
          </h1>
          <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto">
            {s(t, "hero.subtitle")}
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: ShieldCheck, key: "noCost" },
              { icon: TrendingUp, key: "valuation" },
              { icon: Award, key: "experience" },
              { icon: Phone, key: "personal" },
            ].map(({ icon: Icon, key }) => (
              <div key={key} className="flex flex-col items-center gap-2 text-white/80">
                <Icon className="w-5 h-5 text-[#C8102E]" />
                <span className="text-xs font-medium">{s(t, `hero.trust.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-5 -mt-10 pb-20">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Step bar — horizontal progress stepper */}
          <div className="border-b border-slate-100 px-4 sm:px-8 pt-5 pb-4 bg-slate-50/60">
            <div className="flex items-start">
              {STEPS.map((label, i) => (
                <div key={i} className="relative flex-1 flex flex-col items-center">
                  {/* Left connecting line */}
                  {i > 0 && (
                    <div className={[
                      "absolute top-[13px] right-1/2 left-0 h-0.5",
                      i <= step ? "bg-[#003566]" : "bg-slate-200",
                    ].join(" ")} />
                  )}
                  {/* Right connecting line */}
                  {i < STEPS.length - 1 && (
                    <div className={[
                      "absolute top-[13px] left-1/2 right-0 h-0.5",
                      i < step ? "bg-[#003566]" : "bg-slate-200",
                    ].join(" ")} />
                  )}
                  {/* Circle */}
                  <div className={[
                    "relative z-10 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all shrink-0",
                    i < step
                      ? "bg-green-500 border-green-500 text-white"
                      : i === step
                        ? "bg-[#003566] border-[#003566] text-white ring-4 ring-[#003566]/10"
                        : "bg-white border-slate-300 text-slate-400",
                  ].join(" ")}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {/* Label */}
                  <span className={[
                    "mt-2 text-[10px] sm:text-xs font-semibold text-center leading-tight",
                    i < step ? "text-green-600" : i === step ? "text-[#003566]" : "text-slate-400",
                  ].join(" ")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6 md:p-8">
            {errors._global && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {errors._global}
              </div>
            )}

            {/* ── Step 0: Contact ── */}
            {step === 0 && (
              <div className="space-y-4 sm:space-y-5">
                <h2 className="text-xl font-bold text-slate-900">{s(t, "contact.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={`${s(t, "contact.firstName")} *`} error={errors.seller_first_name}>
                    <input className={inputCls(!!errors.seller_first_name)} value={form.seller_first_name}
                      onChange={(e) => setField("seller_first_name", e.target.value)} placeholder="Jan" autoFocus />
                  </Field>
                  <Field label={`${s(t, "contact.lastName")} *`} error={errors.seller_last_name}>
                    <input className={inputCls(!!errors.seller_last_name)} value={form.seller_last_name}
                      onChange={(e) => setField("seller_last_name", e.target.value)} placeholder="de Vries" />
                  </Field>
                </div>

                <Field label={`${s(t, "contact.email")} *`} error={errors.seller_email}>
                  <input type="email" className={inputCls(!!errors.seller_email)} value={form.seller_email}
                    onChange={(e) => setField("seller_email", e.target.value)} placeholder="jan@voorbeeld.nl" />
                </Field>

                <Field label={`${s(t, "contact.phone")} *`} error={errors.seller_phone}>
                  <input type="tel" className={inputCls(!!errors.seller_phone)} value={form.seller_phone}
                    onChange={(e) => setField("seller_phone", e.target.value)} placeholder="+31 6 12345678" />
                </Field>

                {/* Address with Google Places autocomplete */}
                <Field label={s(t, "contact.streetAddress")} hint={s(t, "contact.addressHint", "Typ uw adres en selecteer uit de suggesties")}>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      ref={addressInputRef}
                      className={inputCls(false) + " pl-9"}
                      value={form.seller_address}
                      onChange={(e) => setField("seller_address", e.target.value)}
                      placeholder="Keizersgracht 1"
                      autoComplete="off"
                    />
                  </div>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label={s(t, "contact.postalCode")}>
                    <input className={inputCls(false)} value={form.seller_postal_code}
                      onChange={(e) => setField("seller_postal_code", e.target.value)} placeholder="1234 AB" />
                  </Field>
                  <Field label={s(t, "contact.city")} className="sm:col-span-2">
                    <input className={inputCls(false)} value={form.seller_city}
                      onChange={(e) => setField("seller_city", e.target.value)} placeholder="Amsterdam" />
                  </Field>
                </div>

                <Field label={`${s(t, "contact.location")} *`} error={errors.location_id}>
                  <select className={inputCls(!!errors.location_id)} value={form.location_id}
                    onChange={(e) => setField("location_id", Number(e.target.value))}>
                    <option value="">{s(t, "contact.locationPlaceholder", "— Selecteer een vestiging —")}</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ""}</option>)}
                  </select>
                  {locations.length === 0 && (
                    <p className="mt-1 text-xs text-slate-400">Vestigingen worden geladen…</p>
                  )}
                </Field>
              </div>
            )}

            {/* ── Step 1: Boat ── */}
            {step === 1 && (
              <div className="space-y-4 sm:space-y-5">
                <h2 className="text-xl font-bold text-slate-900">{s(t, "boat.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={`${s(t, "boat.brand")} *`} error={errors.boat_brand}>
                    <input className={inputCls(!!errors.boat_brand)} value={form.boat_brand}
                      onChange={(e) => setField("boat_brand", e.target.value)} placeholder="Bénéteau" autoFocus />
                  </Field>
                  <Field label={`${s(t, "boat.model")} *`} error={errors.boat_model}>
                    <input className={inputCls(!!errors.boat_model)} value={form.boat_model}
                      onChange={(e) => setField("boat_model", e.target.value)} placeholder="Oceanis 40.1" />
                  </Field>
                </div>

                <Field label={s(t, "boat.name")}>
                  <input className={inputCls(false)} value={form.boat_name}
                    onChange={(e) => setField("boat_name", e.target.value)} placeholder="Zeehond" />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={s(t, "boat.buildYear")}>
                    <input type="number" className={inputCls(false)} value={form.build_year}
                      onChange={(e) => setField("build_year", e.target.value)} placeholder="2018" min={1900} max={2030} />
                  </Field>
                  <Field label={`${s(t, "boat.askingPrice")} *`} error={errors.asking_price}>
                    <input type="number" className={inputCls(!!errors.asking_price)} value={form.asking_price}
                      onChange={(e) => setField("asking_price", e.target.value)} placeholder="75000" min={1} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label={s(t, "boat.length")}>
                    <input type="number" step="0.01" className={inputCls(false)} value={form.length_m}
                      onChange={(e) => setField("length_m", e.target.value)} placeholder="12.5" />
                  </Field>
                  <Field label={s(t, "boat.width")}>
                    <input type="number" step="0.01" className={inputCls(false)} value={form.width_m}
                      onChange={(e) => setField("width_m", e.target.value)} placeholder="4.2" />
                  </Field>
                  <Field label={s(t, "boat.draft")}>
                    <input type="number" step="0.01" className={inputCls(false)} value={form.draft_m}
                      onChange={(e) => setField("draft_m", e.target.value)} placeholder="1.8" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={s(t, "boat.vatStatus")}>
                    <select className={inputCls(false)} value={form.vat_status}
                      onChange={(e) => setField("vat_status", e.target.value)}>
                      {Object.entries(vatOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label={s(t, "boat.ceCategory")}>
                    <select className={inputCls(false)} value={form.ce_category}
                      onChange={(e) => setField("ce_category", e.target.value)}>
                      {Object.entries(ceOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label={s(t, "boat.boatType")}>
                  <select className={inputCls(false)} value={form.boat_type}
                    onChange={(e) => setField("boat_type", e.target.value)}>
                    <option value="">{s(t, "boat.boatTypePlaceholder")}</option>
                    {boatTypes.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </Field>

                <Field label={s(t, "boat.description")}>
                  <textarea rows={5} className={inputCls(false) + " resize-none"} value={form.short_description}
                    onChange={(e) => setField("short_description", e.target.value)}
                    placeholder="..." />
                  <p className="mt-1 text-xs text-slate-400">
                    {s(t, "boat.descriptionHint").replace("{n}", String(form.short_description.length)).replace("{target}", "500")}
                  </p>
                </Field>
              </div>
            )}

            {/* ── Step 2: Photos & docs ── */}
            {step === 2 && (
              <div className="space-y-7 sm:space-y-8">
                <h2 className="text-xl font-bold text-slate-900">{s(t, "media.title")}</h2>

                {/* Photos */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{s(t, "media.photosLabel")}</p>
                      <p className="text-xs text-slate-500">
                        {s(t, "media.photosHint").replace("{n}", String(photoCount))}
                      </p>
                    </div>
                    <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#003566] text-[#003566] text-sm font-semibold hover:bg-[#003566] hover:text-white transition-colors disabled:opacity-50">
                      <Camera className="w-4 h-4" />
                      {uploadingPhotos ? s(t, "media.uploading") : s(t, "media.addPhotos")}
                    </button>
                    <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden"
                      onChange={(e) => handlePhotoFiles(e.target.files)} />
                  </div>

                  {photos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute top-1 right-1 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            aria-label="Verwijder foto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => photoInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-10 text-center hover:border-[#003566] transition-colors">
                      <Camera className="w-9 h-9 sm:w-10 sm:h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">{s(t, "media.dropZone")}</p>
                    </button>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <p className="font-semibold text-slate-800 mb-1">{s(t, "media.docsLabel")}</p>
                  <p className="text-xs text-slate-500 mb-4">{s(t, "media.docsHint")}</p>

                  <div className="space-y-2">
                    {docTypeKeys.map((key) => {
                      const existing = documents.find((d) => d.type === key);
                      const label = docTypes[key] ?? key;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{label}</p>
                              {existing && <p className="text-xs text-green-600 truncate">{existing.name}</p>}
                            </div>
                          </div>
                          {existing ? (
                            <div className="flex items-center gap-1.5 text-green-600 shrink-0">
                              <Check className="w-4 h-4" />
                              <span className="text-xs font-medium">{s(t, "media.uploaded")}</span>
                            </div>
                          ) : (
                            <label className="cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors">
                              <Upload className="w-3.5 h-3.5" />
                              {uploadingDocs ? s(t, "media.uploading") : s(t, "media.uploadBtn")}
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                disabled={uploadingDocs}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocFile(f, key); }} />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Review ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-50 mb-4">
                    <Check className="w-7 h-7 sm:w-8 sm:h-8 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{s(t, "review.title")}</h2>
                  <p className="text-slate-500 text-sm">
                    {s(t, "review.confirm").replace("{email}", form.seller_email)}
                  </p>
                </div>

                {score && (
                  <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      {s(t, "review.completeness")}
                    </p>
                    <div className="flex items-end gap-3 mb-4">
                      <span className={`text-4xl sm:text-5xl font-black ${scoreColor(score.total)}`}>{score.total}%</span>
                      <span className="text-slate-400 text-sm mb-2">{s(t, "review.totalScore")}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden mb-5">
                      <div className={`h-3 rounded-full transition-all ${barColor(score.total)}`} style={{ width: `${score.total}%` }} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        ["fields", s(t, "review.fields")],
                        ["photos", `${s(t, "review.photos")} (${score.photo_count}/${score.photo_target})`],
                        ["description", `${s(t, "review.description")} (${score.description_length}/${score.description_target})`],
                        ["documents", s(t, "review.documents")],
                      ] as const).map(([key, label]) => {
                        const val = score.breakdown[key] ?? 0;
                        return (
                          <div key={key} className="bg-white rounded-xl p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-1 truncate">{label}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${barColor(val)}`} style={{ width: `${val}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${scoreColor(val)}`}>{val}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {score.missing.length > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-bold text-amber-700 mb-2">{s(t, "review.missingTitle")}</p>
                        {score.missing.map((m) => {
                          const tpl = s(t, `review.missing.${m.key}`, m.label);
                          const nums = m.label.match(/\d+/g) ?? [];
                          const label = tpl.replace("{n}", nums[0] ?? "");
                          return <p key={m.key} className="text-xs text-amber-700">• {label}</p>;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Next steps ── */}
                <div className="border border-[#003566]/20 rounded-2xl p-4 sm:p-5 bg-[#003566]/5">
                  <p className="text-xs font-bold text-[#003566] uppercase tracking-wider mb-3">{s(t, "review.nextStepTitle")}</p>
                  <p className="text-sm text-slate-600 mb-4">{s(t, "review.nextStepRegister")}</p>
                  <div className="flex flex-col gap-3">
                    <Link
                      href={`/${locale}/auth?mode=register`}
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-full bg-[#C8102E] text-white text-sm font-bold hover:bg-[#a50d25] transition-colors">
                      <LogIn className="w-4 h-4" />
                      {s(t, "review.registerBtn")}
                    </Link>
                    <Link
                      href={`/${locale}/auth?mode=login`}
                      className="text-center text-sm text-[#003566] font-semibold hover:underline">
                      {s(t, "review.loginBtn")}
                    </Link>
                  </div>
                </div>

                {resumeToken && (
                  <div className="text-center">
                    <a
                      href={`/${locale}/boot-aanmelden/aanvullen?token=${resumeToken}`}
                      className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#003566] transition-colors">
                      <Upload className="w-4 h-4" />
                      {s(t, "review.addDetailsBtn")}
                    </a>
                  </div>
                )}

                <div className="text-center border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500 mb-3">{s(t, "review.outro")}</p>
                  <a href="https://www.schepenkring.nl/aanbod-boten/"
                    className="text-sm text-[#003566] font-semibold hover:underline">
                    {s(t, "review.viewSupply")}
                  </a>
                </div>
              </div>
            )}

            {/* ── Nav buttons ── */}
            {step < 3 && (
              <div className="mt-7 sm:mt-8 flex items-center justify-between border-t border-slate-100 pt-5 sm:pt-6">
                <button onClick={() => setStep((n) => Math.max(0, n - 1))}
                  disabled={step === 0 || !!resumeToken}
                  className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors">
                  {s(t, "nav_buttons.prev")}
                </button>
                <button onClick={handleNext} disabled={submitting}
                  className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#C8102E] text-white text-sm font-bold hover:bg-[#a50d25] transition-colors disabled:opacity-60">
                  {submitting ? s(t, "nav_buttons.loading") :
                    step === 1 && !resumeToken ? s(t, "nav_buttons.submit") :
                    step === 2 ? s(t, "nav_buttons.toReview") :
                    s(t, "nav_buttons.next")}
                  {!submitting && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5 sm:mt-6 flex items-center justify-center gap-1">
          <Anchor className="w-3.5 h-3.5" /> {s(t, "footer")}
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    "w-full rounded-xl border px-4 py-2.5 text-sm bg-white outline-none transition-colors",
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/10",
  ].join(" ");
}

function Field({ label, error, hint, children, className = "" }: {
  label: string; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
