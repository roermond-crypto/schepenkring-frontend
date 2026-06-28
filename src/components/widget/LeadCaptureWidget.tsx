"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, Calendar, Euro, BookOpen, Phone, HelpCircle, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";

// ── Types ───────────────────────────────────────────────────────

type FlowType = "plan_viewing" | "offer" | "brochure" | "callback" | "question";

type WidgetLocale = "nl" | "en" | "de" | "fr";

type BoatContext = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  url?: string | null;
  seller_id?: number | null;
};

type LocationContext = {
  id: number;
  name: string;
};

type WidgetCopy = {
  flows: Record<FlowType, string>;
  success: Record<FlowType, { title: string; body: string }>;
  close: string;
  back: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  helpSubtitle: string;
  aboutBoat: string;
  loadingBoatInfo: string;
  footerTagline: string;
  contactButton: string;
  contactAria: string;
  genericError: string;
  defaultBoatName: string;
  fields: {
    date: string;
    time: string;
    chooseTime: string;
    name: string;
    namePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    email: string;
    emailOptionalLabel: string;
    emailPlaceholder: string;
    messageOptionalLabel: string;
    messagePlaceholderViewing: string;
    messagePlaceholderOffer: string;
    messagePlaceholderCallback: string;
    offerAmountLabel: string;
    offerAmountPlaceholder: string;
    phoneOptionalLabel: string;
    preferredCallTime: string;
    noPreference: string;
    morning: string;
    afternoon: string;
    evening: string;
    question: string;
    questionPlaceholder: string;
  };
  submit: {
    planViewing: string;
    offer: string;
    brochure: string;
    callback: string;
    question: string;
  };
};

// ── Constants ───────────────────────────────────────────────────

const ACCENT = "#C8102E"; // Schepenkring red

const FLOW_TYPES: { type: FlowType; icon: typeof Calendar; emoji: string }[] = [
  { type: "plan_viewing", icon: Calendar, emoji: "📅" },
  { type: "offer", icon: Euro, emoji: "💰" },
  { type: "brochure", icon: BookOpen, emoji: "📄" },
  { type: "callback", icon: Phone, emoji: "📞" },
  { type: "question", icon: HelpCircle, emoji: "❓" },
];

// ── Per-locale copy ─────────────────────────────────────────────

const WIDGET_COPY: Record<WidgetLocale, WidgetCopy> = {
  nl: {
    flows: {
      plan_viewing: "Bezichtiging plannen",
      offer: "Bod uitbrengen",
      brochure: "Brochure ontvangen",
      callback: "Terugbellen",
      question: "Stel een vraag",
    },
    success: {
      plan_viewing: {
        title: "Bezichtiging aangevraagd!",
        body: "We nemen zo snel mogelijk contact met u op om een datum en tijd te bevestigen.",
      },
      offer: {
        title: "Bod ontvangen!",
        body: "Uw bod is doorgegeven aan de verkoper. We nemen spoedig contact met u op.",
      },
      brochure: {
        title: "Brochure onderweg!",
        body: "De brochure wordt zo snel mogelijk naar uw e-mailadres gestuurd.",
      },
      callback: {
        title: "Terugbelverzoek ontvangen!",
        body: "We bellen u zo snel mogelijk terug op het opgegeven nummer.",
      },
      question: {
        title: "Vraag ontvangen!",
        body: "Ons team beantwoordt uw vraag zo snel mogelijk.",
      },
    },
    close: "Sluiten",
    back: "Terug",
    welcomeTitle: "Welkom bij Schepenkring",
    welcomeSubtitle: "Wij helpen u graag met deze boot.",
    helpSubtitle: "Wij helpen u graag",
    aboutBoat: "Over deze boot",
    loadingBoatInfo: "Bootinformatie laden…",
    footerTagline: "Schepenkring · Jachthaven & Jachtmakelaar",
    contactButton: "Contact opnemen",
    contactAria: "Contact Schepenkring",
    genericError: "Er is iets misgegaan. Probeer het opnieuw.",
    defaultBoatName: "Boot",
    fields: {
      date: "Datum",
      time: "Tijd",
      chooseTime: "Kies tijd",
      name: "Naam",
      namePlaceholder: "Uw volledige naam",
      phone: "Telefoonnummer",
      phonePlaceholder: "+31 6 12345678",
      email: "E-mailadres",
      emailOptionalLabel: "E-mailadres (optioneel)",
      emailPlaceholder: "uw@email.nl",
      messageOptionalLabel: "Bericht (optioneel)",
      messagePlaceholderViewing: "Extra informatie...",
      messagePlaceholderOffer: "Toelichting op uw bod...",
      messagePlaceholderCallback: "Eventuele opmerkingen...",
      offerAmountLabel: "Bod (€)",
      offerAmountPlaceholder: "bijv. 45000",
      phoneOptionalLabel: "Telefoonnummer (optioneel)",
      preferredCallTime: "Gewenste beltijd",
      noPreference: "Geen voorkeur",
      morning: "Ochtend (9:00–12:00)",
      afternoon: "Middag (12:00–17:00)",
      evening: "Avond (17:00–20:00)",
      question: "Uw vraag",
      questionPlaceholder: "Stel hier uw vraag over deze boot...",
    },
    submit: {
      planViewing: "Bezichtiging aanvragen",
      offer: "Bod uitbrengen",
      brochure: "Brochure aanvragen",
      callback: "Terugbelverzoek sturen",
      question: "Vraag versturen",
    },
  },
  en: {
    flows: {
      plan_viewing: "Schedule a viewing",
      offer: "Make an offer",
      brochure: "Receive brochure",
      callback: "Request a callback",
      question: "Ask a question",
    },
    success: {
      plan_viewing: {
        title: "Viewing requested!",
        body: "We will contact you as soon as possible to confirm a date and time.",
      },
      offer: {
        title: "Offer received!",
        body: "Your offer has been forwarded to the seller. We will contact you shortly.",
      },
      brochure: {
        title: "Brochure on its way!",
        body: "The brochure will be sent to your email address as soon as possible.",
      },
      callback: {
        title: "Callback request received!",
        body: "We will call you back as soon as possible on the number provided.",
      },
      question: {
        title: "Question received!",
        body: "Our team will answer your question as soon as possible.",
      },
    },
    close: "Close",
    back: "Back",
    welcomeTitle: "Welcome to Schepenkring",
    welcomeSubtitle: "We're happy to help you with this boat.",
    helpSubtitle: "We're happy to help",
    aboutBoat: "About this boat",
    loadingBoatInfo: "Loading boat information…",
    footerTagline: "Schepenkring · Marina & Yacht Brokerage",
    contactButton: "Contact us",
    contactAria: "Contact Schepenkring",
    genericError: "Something went wrong. Please try again.",
    defaultBoatName: "Boat",
    fields: {
      date: "Date",
      time: "Time",
      chooseTime: "Choose time",
      name: "Name",
      namePlaceholder: "Your full name",
      phone: "Phone number",
      phonePlaceholder: "+31 6 12345678",
      email: "Email address",
      emailOptionalLabel: "Email address (optional)",
      emailPlaceholder: "your@email.com",
      messageOptionalLabel: "Message (optional)",
      messagePlaceholderViewing: "Additional information...",
      messagePlaceholderOffer: "Comments about your offer...",
      messagePlaceholderCallback: "Any remarks...",
      offerAmountLabel: "Offer (€)",
      offerAmountPlaceholder: "e.g. 45000",
      phoneOptionalLabel: "Phone number (optional)",
      preferredCallTime: "Preferred call time",
      noPreference: "No preference",
      morning: "Morning (9:00–12:00)",
      afternoon: "Afternoon (12:00–17:00)",
      evening: "Evening (17:00–20:00)",
      question: "Your question",
      questionPlaceholder: "Ask your question about this boat...",
    },
    submit: {
      planViewing: "Request viewing",
      offer: "Submit offer",
      brochure: "Request brochure",
      callback: "Send callback request",
      question: "Send question",
    },
  },
  de: {
    flows: {
      plan_viewing: "Besichtigung planen",
      offer: "Angebot machen",
      brochure: "Broschüre erhalten",
      callback: "Rückruf anfordern",
      question: "Frage stellen",
    },
    success: {
      plan_viewing: {
        title: "Besichtigung angefragt!",
        body: "Wir setzen uns so schnell wie möglich mit Ihnen in Verbindung, um Datum und Uhrzeit zu bestätigen.",
      },
      offer: {
        title: "Angebot erhalten!",
        body: "Ihr Angebot wurde an den Verkäufer weitergeleitet. Wir melden uns in Kürze bei Ihnen.",
      },
      brochure: {
        title: "Broschüre ist unterwegs!",
        body: "Die Broschüre wird so schnell wie möglich an Ihre E-Mail-Adresse gesendet.",
      },
      callback: {
        title: "Rückrufanfrage erhalten!",
        body: "Wir rufen Sie so schnell wie möglich unter der angegebenen Nummer zurück.",
      },
      question: {
        title: "Frage erhalten!",
        body: "Unser Team beantwortet Ihre Frage so schnell wie möglich.",
      },
    },
    close: "Schließen",
    back: "Zurück",
    welcomeTitle: "Willkommen bei Schepenkring",
    welcomeSubtitle: "Wir helfen Ihnen gerne bei diesem Boot.",
    helpSubtitle: "Wir helfen Ihnen gerne",
    aboutBoat: "Über dieses Boot",
    loadingBoatInfo: "Bootsinformationen werden geladen…",
    footerTagline: "Schepenkring · Yachthafen & Yachtmakler",
    contactButton: "Kontakt aufnehmen",
    contactAria: "Schepenkring kontaktieren",
    genericError: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    defaultBoatName: "Boot",
    fields: {
      date: "Datum",
      time: "Uhrzeit",
      chooseTime: "Uhrzeit wählen",
      name: "Name",
      namePlaceholder: "Ihr vollständiger Name",
      phone: "Telefonnummer",
      phonePlaceholder: "+31 6 12345678",
      email: "E-Mail-Adresse",
      emailOptionalLabel: "E-Mail-Adresse (optional)",
      emailPlaceholder: "ihre@email.de",
      messageOptionalLabel: "Nachricht (optional)",
      messagePlaceholderViewing: "Zusätzliche Informationen...",
      messagePlaceholderOffer: "Anmerkungen zu Ihrem Angebot...",
      messagePlaceholderCallback: "Eventuelle Anmerkungen...",
      offerAmountLabel: "Angebot (€)",
      offerAmountPlaceholder: "z. B. 45000",
      phoneOptionalLabel: "Telefonnummer (optional)",
      preferredCallTime: "Gewünschte Rückrufzeit",
      noPreference: "Keine Präferenz",
      morning: "Vormittag (9:00–12:00)",
      afternoon: "Nachmittag (12:00–17:00)",
      evening: "Abend (17:00–20:00)",
      question: "Ihre Frage",
      questionPlaceholder: "Stellen Sie hier Ihre Frage zu diesem Boot...",
    },
    submit: {
      planViewing: "Besichtigung anfragen",
      offer: "Angebot abgeben",
      brochure: "Broschüre anfragen",
      callback: "Rückrufanfrage senden",
      question: "Frage senden",
    },
  },
  fr: {
    flows: {
      plan_viewing: "Planifier une visite",
      offer: "Faire une offre",
      brochure: "Recevoir la brochure",
      callback: "Demander un rappel",
      question: "Poser une question",
    },
    success: {
      plan_viewing: {
        title: "Visite demandée !",
        body: "Nous vous contacterons dès que possible pour confirmer une date et une heure.",
      },
      offer: {
        title: "Offre reçue !",
        body: "Votre offre a été transmise au vendeur. Nous vous contacterons rapidement.",
      },
      brochure: {
        title: "Brochure en route !",
        body: "La brochure sera envoyée à votre adresse e-mail dès que possible.",
      },
      callback: {
        title: "Demande de rappel reçue !",
        body: "Nous vous rappellerons dès que possible au numéro indiqué.",
      },
      question: {
        title: "Question reçue !",
        body: "Notre équipe répondra à votre question dès que possible.",
      },
    },
    close: "Fermer",
    back: "Retour",
    welcomeTitle: "Bienvenue chez Schepenkring",
    welcomeSubtitle: "Nous sommes ravis de vous aider avec ce bateau.",
    helpSubtitle: "Nous sommes ravis de vous aider",
    aboutBoat: "À propos de ce bateau",
    loadingBoatInfo: "Chargement des informations du bateau…",
    footerTagline: "Schepenkring · Port de plaisance & Courtage nautique",
    contactButton: "Nous contacter",
    contactAria: "Contacter Schepenkring",
    genericError: "Une erreur s'est produite. Veuillez réessayer.",
    defaultBoatName: "Bateau",
    fields: {
      date: "Date",
      time: "Heure",
      chooseTime: "Choisir l'heure",
      name: "Nom",
      namePlaceholder: "Votre nom complet",
      phone: "Numéro de téléphone",
      phonePlaceholder: "+31 6 12345678",
      email: "Adresse e-mail",
      emailOptionalLabel: "Adresse e-mail (facultatif)",
      emailPlaceholder: "votre@email.fr",
      messageOptionalLabel: "Message (facultatif)",
      messagePlaceholderViewing: "Informations complémentaires...",
      messagePlaceholderOffer: "Précisions sur votre offre...",
      messagePlaceholderCallback: "Remarques éventuelles...",
      offerAmountLabel: "Offre (€)",
      offerAmountPlaceholder: "ex. 45000",
      phoneOptionalLabel: "Numéro de téléphone (facultatif)",
      preferredCallTime: "Heure de rappel souhaitée",
      noPreference: "Aucune préférence",
      morning: "Matin (9h00–12h00)",
      afternoon: "Après-midi (12h00–17h00)",
      evening: "Soir (17h00–20h00)",
      question: "Votre question",
      questionPlaceholder: "Posez ici votre question sur ce bateau...",
    },
    submit: {
      planViewing: "Demander une visite",
      offer: "Soumettre l'offre",
      brochure: "Demander la brochure",
      callback: "Envoyer la demande de rappel",
      question: "Envoyer la question",
    },
  },
};

function resolveWidgetLocale(locale?: string): WidgetLocale {
  const normalized = (locale || "nl").toLowerCase().split("-")[0];
  if (normalized === "en" || normalized === "de" || normalized === "fr") return normalized;
  return "nl";
}

const WidgetCopyContext = createContext<WidgetCopy>(WIDGET_COPY.nl);
const useWidgetCopy = () => useContext(WidgetCopyContext);

// ── GA4 helper (no-throw) ───────────────────────────────────────

function ga4(eventName: string, params?: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (typeof w.gtag === "function") {
      w.gtag("event", eventName, params ?? {});
    }
  } catch {
    // ignore
  }
}

// ── API base URL for the widget host ───────────────────────────

function resolveApiBase(): string {
  const env =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_API_URL);
  if (env) return normalizeApiBaseUrl(env);
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8000/api";
  }
  return "https://app.schepen-kring.nl/api";
}

async function widgetPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${resolveApiBase()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function widgetGet(path: string) {
  const res = await fetch(`${resolveApiBase()}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Sub-components ──────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-[#C8102E] focus:bg-white placeholder:text-gray-400";

// ── Success screen ──────────────────────────────────────────────

function SuccessScreen({ flowType, onClose }: { flowType: FlowType; onClose: () => void }) {
  const copy = useWidgetCopy();
  const msg = copy.success[flowType];
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "#fef2f2" }}
      >
        <CheckCircle2 size={36} color={ACCENT} />
      </div>
      <h3 className="text-lg font-bold text-gray-800">{msg.title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{msg.body}</p>
      <button
        onClick={onClose}
        className="mt-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: ACCENT }}
      >
        {copy.close}
      </button>
    </div>
  );
}

// ── Flow forms ──────────────────────────────────────────────────

function PlanViewingForm({
  boat,
  location,
  sourceUrl,
  onSuccess,
}: {
  boat: BoatContext;
  location: LocationContext | null;
  sourceUrl: string;
  onSuccess: () => void;
}) {
  const copy = useWidgetCopy();
  const [form, setForm] = useState({
    preferred_date: "",
    preferred_time: "",
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const today = new Date().toISOString().split("T")[0];

  const times = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await widgetPost("widget/plan-viewing", {
        boat_id: boat.id,
        location_id: location?.id ?? null,
        ...form,
        source_url: sourceUrl,
      });
      ga4("widget_plan_viewing_submitted", { boat_id: boat.id, location_id: location?.id });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={copy.fields.date} required>
          <input
            type="date"
            min={today}
            required
            value={form.preferred_date}
            onChange={set("preferred_date")}
            className={inputCls}
          />
        </Field>
        <Field label={copy.fields.time} required>
          <select required value={form.preferred_time} onChange={set("preferred_time")} className={inputCls}>
            <option value="">{copy.fields.chooseTime}</option>
            {times.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={copy.fields.name} required>
        <input type="text" required placeholder={copy.fields.namePlaceholder} value={form.name} onChange={set("name")} className={inputCls} />
      </Field>
      <Field label={copy.fields.phone} required>
        <input type="tel" required placeholder={copy.fields.phonePlaceholder} value={form.phone} onChange={set("phone")} className={inputCls} />
      </Field>
      <Field label={copy.fields.email}>
        <input type="email" placeholder={copy.fields.emailPlaceholder} value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      <Field label={copy.fields.messageOptionalLabel}>
        <textarea rows={2} placeholder={copy.fields.messagePlaceholderViewing} value={form.message} onChange={set("message")} className={inputCls} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : copy.submit.planViewing}
      </button>
    </form>
  );
}

function OfferForm({
  boat,
  location,
  sourceUrl,
  onSuccess,
}: {
  boat: BoatContext;
  location: LocationContext | null;
  sourceUrl: string;
  onSuccess: () => void;
}) {
  const copy = useWidgetCopy();
  const [form, setForm] = useState({ offer_amount: "", name: "", phone: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await widgetPost("widget/offer", {
        boat_id: boat.id,
        location_id: location?.id ?? null,
        offer_amount: parseFloat(form.offer_amount.replace(/[^0-9.]/g, "")),
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        message: form.message || undefined,
        source_url: sourceUrl,
      });
      ga4("widget_offer_submitted", { boat_id: boat.id });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={copy.fields.offerAmountLabel} required>
        <input
          type="number"
          required
          min="1"
          step="500"
          placeholder={copy.fields.offerAmountPlaceholder}
          value={form.offer_amount}
          onChange={set("offer_amount")}
          className={inputCls}
        />
      </Field>
      <Field label={copy.fields.name} required>
        <input type="text" required placeholder={copy.fields.namePlaceholder} value={form.name} onChange={set("name")} className={inputCls} />
      </Field>
      <Field label={copy.fields.phone} required>
        <input type="tel" required placeholder={copy.fields.phonePlaceholder} value={form.phone} onChange={set("phone")} className={inputCls} />
      </Field>
      <Field label={copy.fields.email}>
        <input type="email" placeholder={copy.fields.emailPlaceholder} value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      <Field label={copy.fields.messageOptionalLabel}>
        <textarea rows={2} placeholder={copy.fields.messagePlaceholderOffer} value={form.message} onChange={set("message")} className={inputCls} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : copy.submit.offer}
      </button>
    </form>
  );
}

function BrochureForm({
  boat,
  location,
  sourceUrl,
  onSuccess,
}: {
  boat: BoatContext;
  location: LocationContext | null;
  sourceUrl: string;
  onSuccess: () => void;
}) {
  const copy = useWidgetCopy();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await widgetPost("widget/brochure", {
        boat_id: boat.id,
        location_id: location?.id ?? null,
        ...form,
        source_url: sourceUrl,
      });
      ga4("widget_brochure_requested", { boat_id: boat.id });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={copy.fields.name} required>
        <input type="text" required placeholder={copy.fields.namePlaceholder} value={form.name} onChange={set("name")} className={inputCls} />
      </Field>
      <Field label={copy.fields.email} required>
        <input type="email" required placeholder={copy.fields.emailPlaceholder} value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      <Field label={copy.fields.phoneOptionalLabel}>
        <input type="tel" placeholder={copy.fields.phonePlaceholder} value={form.phone} onChange={set("phone")} className={inputCls} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : copy.submit.brochure}
      </button>
    </form>
  );
}

function CallbackForm({
  boat,
  location,
  sourceUrl,
  onSuccess,
}: {
  boat: BoatContext;
  location: LocationContext | null;
  sourceUrl: string;
  onSuccess: () => void;
}) {
  const copy = useWidgetCopy();
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferred_call_time: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await widgetPost("widget/callback", {
        boat_id: boat.id,
        location_id: location?.id ?? null,
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        preferred_call_time: form.preferred_call_time || undefined,
        message: form.message || undefined,
        source_url: sourceUrl,
      });
      ga4("widget_callback_requested", { boat_id: boat.id });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={copy.fields.name} required>
        <input type="text" required placeholder={copy.fields.namePlaceholder} value={form.name} onChange={set("name")} className={inputCls} />
      </Field>
      <Field label={copy.fields.phone} required>
        <input type="tel" required placeholder={copy.fields.phonePlaceholder} value={form.phone} onChange={set("phone")} className={inputCls} />
      </Field>
      <Field label={copy.fields.emailOptionalLabel}>
        <input type="email" placeholder={copy.fields.emailPlaceholder} value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      <Field label={copy.fields.preferredCallTime}>
        <select value={form.preferred_call_time} onChange={set("preferred_call_time")} className={inputCls}>
          <option value="">{copy.fields.noPreference}</option>
          <option value="ochtend (9:00–12:00)">{copy.fields.morning}</option>
          <option value="middag (12:00–17:00)">{copy.fields.afternoon}</option>
          <option value="avond (17:00–20:00)">{copy.fields.evening}</option>
        </select>
      </Field>
      <Field label={copy.fields.messageOptionalLabel}>
        <textarea rows={2} placeholder={copy.fields.messagePlaceholderCallback} value={form.message} onChange={set("message")} className={inputCls} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : copy.submit.callback}
      </button>
    </form>
  );
}

function QuestionForm({
  boat,
  location,
  sourceUrl,
  onSuccess,
}: {
  boat: BoatContext;
  location: LocationContext | null;
  sourceUrl: string;
  onSuccess: () => void;
}) {
  const copy = useWidgetCopy();
  const [form, setForm] = useState({ question: "", name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await widgetPost("widget/question", {
        boat_id: boat.id,
        location_id: location?.id ?? null,
        question: form.question,
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        source_url: sourceUrl,
      });
      ga4("widget_question_submitted", { boat_id: boat.id });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label={copy.fields.question} required>
        <textarea
          rows={3}
          required
          placeholder={copy.fields.questionPlaceholder}
          value={form.question}
          onChange={set("question")}
          className={inputCls}
        />
      </Field>
      <Field label={copy.fields.name} required>
        <input type="text" required placeholder={copy.fields.namePlaceholder} value={form.name} onChange={set("name")} className={inputCls} />
      </Field>
      <Field label={copy.fields.phone} required>
        <input type="tel" required placeholder={copy.fields.phonePlaceholder} value={form.phone} onChange={set("phone")} className={inputCls} />
      </Field>
      <Field label={copy.fields.emailOptionalLabel}>
        <input type="email" placeholder={copy.fields.emailPlaceholder} value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: ACCENT }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : copy.submit.question}
      </button>
    </form>
  );
}

// ── Main widget component ───────────────────────────────────────

export interface LeadCaptureWidgetProps {
  boatId?: number;
  locationId?: number;
  sourceUrl?: string;
  isEmbedded?: boolean;
  locale?: string;
}

export function LeadCaptureWidget({ boatId, locationId, sourceUrl, isEmbedded, locale }: LeadCaptureWidgetProps) {
  const copy = WIDGET_COPY[resolveWidgetLocale(locale)];
  const [isOpen, setIsOpen]           = useState(false);
  const [activeFlow, setActiveFlow]   = useState<FlowType | null>(null);
  const [success, setSuccess]         = useState<FlowType | null>(null);
  const [boat, setBoat]               = useState<BoatContext | null>(null);
  const [location, setLocation]       = useState<LocationContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const isMobile = useRef(false);

  // Notify parent iframe container about open/close
  const notifyParent = useCallback((open: boolean) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage(
        { type: "LEAD_WIDGET_STATE", isOpen: open, isMobile: isMobile.current },
        "*"
      );
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setSuccess(null);
    setActiveFlow(null);
    notifyParent(true);
    ga4("widget_opened", { boat_id: boatId, location_id: locationId });
  }, [boatId, locationId, notifyParent]);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveFlow(null);
    setSuccess(null);
    notifyParent(false);
  }, [notifyParent]);

  // Load boat/location context once
  useEffect(() => {
    if (!boatId) return;
    setContextLoading(true);
    const params = new URLSearchParams();
    if (boatId)     params.set("boat_id", String(boatId));
    if (locationId) params.set("location_id", String(locationId));
    if (sourceUrl)  params.set("source_url", sourceUrl);
    widgetGet(`widget/context?${params.toString()}`)
      .then((data) => {
        if (data.boat)     setBoat(data.boat);
        if (data.location) setLocation(data.location);
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setContextLoading(false));
  }, [boatId, locationId, sourceUrl]);

  // Mobile detection
  useEffect(() => {
    isMobile.current = window.innerWidth < 640;
    const handler = () => { isMobile.current = window.innerWidth < 640; };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const resolvedSourceUrl = sourceUrl || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <WidgetCopyContext.Provider value={copy}>
      <div className={cn("flex h-full w-full flex-col items-end justify-end", isEmbedded && "bg-transparent")}>
        {/* ── Open panel ── */}
        {isOpen && (
          <div
            className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ border: "1px solid #e5e7eb" }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ background: ACCENT }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white p-1">
                  <Image
                    src="/schepenkring-logo.png"
                    alt="Schepenkring"
                    width={28}
                    height={28}
                    className="object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none text-white">Schepenkring</p>
                  <p className="mt-0.5 text-[10px] leading-none text-red-100">
                    {location ? location.name : copy.helpSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <X size={14} />
              </button>
            </div>

            {/* Boat context strip */}
            {boat && (
              <div
                className="shrink-0 border-b border-gray-100 px-4 py-2.5"
                style={{ background: "#fff8f8" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{copy.aboutBoat}</p>
                <p className="mt-0.5 text-sm font-bold text-gray-800">{boat.name}</p>
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Success screen */}
              {success && (
                <SuccessScreen
                  flowType={success}
                  onClose={() => {
                    setSuccess(null);
                    setActiveFlow(null);
                  }}
                />
              )}

              {/* Flow form */}
              {!success && activeFlow && (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => setActiveFlow(null)}
                    className="flex w-fit items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
                  >
                    <ChevronLeft size={14} />
                    {copy.back}
                  </button>
                  <h3 className="text-base font-bold text-gray-800">{copy.flows[activeFlow]}</h3>

                  {activeFlow === "plan_viewing" && (
                    <PlanViewingForm
                      boat={boat ?? { id: boatId!, name: copy.defaultBoatName }}
                      location={location}
                      sourceUrl={resolvedSourceUrl}
                      onSuccess={() => setSuccess("plan_viewing")}
                    />
                  )}
                  {activeFlow === "offer" && (
                    <OfferForm
                      boat={boat ?? { id: boatId!, name: copy.defaultBoatName }}
                      location={location}
                      sourceUrl={resolvedSourceUrl}
                      onSuccess={() => setSuccess("offer")}
                    />
                  )}
                  {activeFlow === "brochure" && (
                    <BrochureForm
                      boat={boat ?? { id: boatId!, name: copy.defaultBoatName }}
                      location={location}
                      sourceUrl={resolvedSourceUrl}
                      onSuccess={() => setSuccess("brochure")}
                    />
                  )}
                  {activeFlow === "callback" && (
                    <CallbackForm
                      boat={boat ?? { id: boatId!, name: copy.defaultBoatName }}
                      location={location}
                      sourceUrl={resolvedSourceUrl}
                      onSuccess={() => setSuccess("callback")}
                    />
                  )}
                  {activeFlow === "question" && (
                    <QuestionForm
                      boat={boat ?? { id: boatId!, name: copy.defaultBoatName }}
                      location={location}
                      sourceUrl={resolvedSourceUrl}
                      onSuccess={() => setSuccess("question")}
                    />
                  )}
                </div>
              )}

              {/* Main menu */}
              {!success && !activeFlow && (
                <div className="flex flex-col gap-2">
                  <div className="mb-2">
                    <h2 className="text-base font-bold text-gray-800">{copy.welcomeTitle}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">{copy.welcomeSubtitle}</p>
                  </div>

                  {contextLoading && (
                    <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                      <Loader2 size={12} className="animate-spin" />
                      {copy.loadingBoatInfo}
                    </div>
                  )}

                  {FLOW_TYPES.map(({ type, emoji }) => (
                    <button
                      key={type}
                      onClick={() => {
                        setActiveFlow(type);
                        ga4("widget_flow_started", { flow: type, boat_id: boatId });
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5 text-left text-sm font-semibold text-gray-800 transition-all hover:border-[#C8102E]/30 hover:bg-red-50 hover:text-[#C8102E]"
                    >
                      <span className="text-lg leading-none">{emoji}</span>
                      <span>{copy.flows[type]}</span>
                    </button>
                  ))}

                  <p className="mt-3 text-center text-[10px] text-gray-400">
                    {copy.footerTagline}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Launcher button ── */}
        {!isOpen && (
          <button
            onClick={open}
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-100"
            style={{
              background: ACCENT,
              boxShadow: "0 4px 24px rgba(200,16,46,0.35)",
            }}
            aria-label={copy.contactAria}
          >
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white p-0.5">
              <Image
                src="/schepenkring-logo.png"
                alt=""
                width={20}
                height={20}
                className="object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span>{copy.contactButton}</span>
          </button>
        )}
      </div>
    </WidgetCopyContext.Provider>
  );
}
