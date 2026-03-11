"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Eye,
  FileCheck,
  FilePenLine,
  FileText,
  Globe2,
  Loader2,
  Mail,
  PencilLine,
  Printer,
  RefreshCw,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  signhostApi,
  type SignhostDocument,
  type SignRecipient,
  type SignRequest,
} from "@/lib/api/signhost";

type ContractLanguage = "nl" | "en" | "de" | "fr";

type LocationOption = {
  id: number;
  name: string;
  code?: string | null;
};

type ContractDraft = {
  language: ContractLanguage;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  clientName: string;
  clientAddress: string;
  clientPostalCode: string;
  clientCity: string;
  clientPhone: string;
  clientEmail: string;
  passportNumber: string;
  married: "yes" | "no";
  spouseName: string;
  vesselName: string;
  vesselBrandType: string;
  buildYear: string;
  dimensions: string;
  buildingMaterial: string;
  builder: string;
  hullNumber: string;
  engine: string;
  engineNumber: string;
  registrationNumber: string;
  shipRegisterEntry: "yes" | "no";
  shipRegisterPlace: string;
  hasMortgage: "yes" | "no";
  mortgageInFavorOf: string;
  vatDeclaration: "yes" | "no";
  askingPrice: string;
  askingPriceWords: string;
  agreementDate: string;
  agreementCity: string;
};

interface SignhostFlowProps {
  yachtId: number;
  yachtName: string;
  locationId: number | null;
  yachtData?: Record<string, any> | null;
  locationOptions?: LocationOption[];
}

const languageOptions: { value: ContractLanguage; label: string }[] = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

const locationCompanyDefaults: Record<
  string,
  Partial<Pick<
    ContractDraft,
    | "companyName"
    | "companyAddress"
    | "companyPostalCode"
    | "companyCity"
    | "companyPhone"
    | "companyEmail"
  >>
> = {
  roermond: {
    companyName: "Krekelberg Nautic B.V.",
    companyAddress: "Hertenerweg 2",
    companyPostalCode: "6049 AA",
    companyCity: "Herten",
    companyPhone: "0031-(0)475-315661",
    companyEmail: "roermond@schepenkring.nl",
  },
};

const copyByLanguage: Record<
  ContractLanguage,
  {
    title: string;
    subtitle: string;
    sellerLabel: string;
    buyerLabel: string;
    vesselLabel: string;
    declarationsLabel: string;
    closingLabel: string;
    signaturesLabel: string;
    generateLabel: string;
    previewHint: string;
    closingText: (date: string, city: string) => string;
    registerText: (value: string, place: string) => string;
    mortgageText: (value: string, party: string) => string;
    vatText: (value: string) => string;
    priceText: (amount: string, words: string) => string;
  }
> = {
  nl: {
    title: "Verkoopovereenkomst vaartuig",
    subtitle: "Concept voor digitale ondertekening via Signhost",
    sellerLabel: "Verkoper / verkooplocatie",
    buyerLabel: "Koper",
    vesselLabel: "Vaartuig",
    declarationsLabel: "Verklaringen",
    closingLabel: "Slotverklaring",
    signaturesLabel: "Ondertekening",
    generateLabel: "Genereer contract PDF",
    previewHint:
      "Controleer en werk de gegevens hieronder bij. De preview wordt gebruikt als basis voor het contract-PDF.",
    closingText: (date, city) =>
      `Deze overeenkomst is in tweevoud opgemaakt op ${date} te ${city}.`,
    registerText: (value, place) =>
      `Inschrijving scheepsregister: ${value}${place ? `, in ${place}` : ""}.`,
    mortgageText: (value, party) =>
      `Scheepshypotheek: ${value}${party ? `, ten gunste van ${party}` : ""}.`,
    vatText: (value) => `BTW-verklaring: ${value}.`,
    priceText: (amount, words) =>
      `Vraagprijs: EUR ${amount}${words ? ` (${words} euro)` : ""}.`,
  },
  en: {
    title: "Vessel sale agreement",
    subtitle: "Draft for digital signing through Signhost",
    sellerLabel: "Seller / sales location",
    buyerLabel: "Buyer",
    vesselLabel: "Vessel",
    declarationsLabel: "Declarations",
    closingLabel: "Closing statement",
    signaturesLabel: "Signatures",
    generateLabel: "Generate contract PDF",
    previewHint:
      "Review and update the values below. This preview is used as the basis for the contract PDF.",
    closingText: (date, city) =>
      `This agreement was made up in duplicate on ${date} in ${city}.`,
    registerText: (value, place) =>
      `Entry ship register: ${value}${place ? `, in ${place}` : ""}.`,
    mortgageText: (value, party) =>
      `Ship mortgage: ${value}${party ? `, in favor of ${party}` : ""}.`,
    vatText: (value) => `VAT declaration: ${value}.`,
    priceText: (amount, words) =>
      `Asking price: EUR ${amount}${words ? ` (${words} euro)` : ""}.`,
  },
  de: {
    title: "Kaufvertrag Wasserfahrzeug",
    subtitle: "Entwurf zur digitalen Unterzeichnung via Signhost",
    sellerLabel: "Verkäufer / Verkaufsstandort",
    buyerLabel: "Käufer",
    vesselLabel: "Fahrzeug",
    declarationsLabel: "Erklärungen",
    closingLabel: "Abschlusserklärung",
    signaturesLabel: "Unterschriften",
    generateLabel: "Vertrags-PDF erzeugen",
    previewHint:
      "Prüfen und aktualisieren Sie die Werte unten. Diese Vorschau bildet die Grundlage für das Vertrags-PDF.",
    closingText: (date, city) =>
      `Diese Vereinbarung wurde zweifach am ${date} in ${city} erstellt.`,
    registerText: (value, place) =>
      `Eintrag im Schiffsregister: ${value}${place ? `, in ${place}` : ""}.`,
    mortgageText: (value, party) =>
      `Schiffshypothek: ${value}${party ? `, zugunsten von ${party}` : ""}.`,
    vatText: (value) => `MwSt.-Erklärung: ${value}.`,
    priceText: (amount, words) =>
      `Angebotspreis: EUR ${amount}${words ? ` (${words} Euro)` : ""}.`,
  },
  fr: {
    title: "Contrat de vente du bateau",
    subtitle: "Projet pour signature numerique via Signhost",
    sellerLabel: "Vendeur / site de vente",
    buyerLabel: "Acheteur",
    vesselLabel: "Bateau",
    declarationsLabel: "Declarations",
    closingLabel: "Declaration finale",
    signaturesLabel: "Signatures",
    generateLabel: "Generer le PDF du contrat",
    previewHint:
      "Verifiez et mettez a jour les valeurs ci-dessous. Cet apercu sert de base au PDF du contrat.",
    closingText: (date, city) =>
      `Le present accord a ete etabli en double exemplaire le ${date} a ${city}.`,
    registerText: (value, place) =>
      `Inscription au registre naval: ${value}${place ? `, a ${place}` : ""}.`,
    mortgageText: (value, party) =>
      `Hypotheque maritime: ${value}${party ? `, au profit de ${party}` : ""}.`,
    vatText: (value) => `Declaration TVA: ${value}.`,
    priceText: (amount, words) =>
      `Prix demande: EUR ${amount}${words ? ` (${words} euro)` : ""}.`,
  },
};

const attachmentByLanguage: Record<
  ContractLanguage,
  { href: string; name: string }
> = {
  nl: {
    href: "/contracts/bemiddelingsvoorwaarden-nl.pdf",
    name: "A. Bemiddelingsvoorwaarden (NL)",
  },
  de: {
    href: "/contracts/bemiddelingsvoorwaarden-de.pdf",
    name: "B. Bemiddelingsvoorwaarden (DE)",
  },
  en: {
    href: "/contracts/bemiddelingsvoorwaarden-en.pdf",
    name: "C. Bemiddelingsvoorwaarden (EN)",
  },
  fr: {
    href: "/contracts/bemiddelingsvoorwaarden-en.pdf",
    name: "C. Bemiddelingsvoorwaarden (EN)",
  },
};

function titleCase(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

function boolLabel(value: "yes" | "no") {
  return value === "yes" ? "Yes" : "No";
}

function extractCity(name?: string | null) {
  if (!name) return "";
  const stripped = name
    .replace(/schepenkring/i, "")
    .replace(/marina/i, "")
    .replace(/harbor/i, "")
    .trim();
  return stripped.split(/\s+/).filter(Boolean)[0] || name;
}

function resolveLocationDefaults(location?: LocationOption | null) {
  const cityGuess = extractCity(location?.name);
  const key = `${location?.code || ""} ${location?.name || ""}`.toLowerCase();

  for (const matcher of Object.keys(locationCompanyDefaults)) {
    if (key.includes(matcher)) {
      return {
        companyName: locationCompanyDefaults[matcher].companyName || location?.name || "",
        companyAddress: locationCompanyDefaults[matcher].companyAddress || "",
        companyPostalCode: locationCompanyDefaults[matcher].companyPostalCode || "",
        companyCity: locationCompanyDefaults[matcher].companyCity || cityGuess,
        companyPhone: locationCompanyDefaults[matcher].companyPhone || "",
        companyEmail: locationCompanyDefaults[matcher].companyEmail || "",
        agreementCity: locationCompanyDefaults[matcher].companyCity || cityGuess,
      };
    }
  }

  return {
    companyName: location?.name || "",
    companyAddress: "",
    companyPostalCode: "",
    companyCity: cityGuess,
    companyPhone: "",
    companyEmail: "",
    agreementCity: cityGuess,
  };
}

function formatAgreementDate(language: ContractLanguage, value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getPreviewHtml(draft: ContractDraft) {
  const copy = copyByLanguage[draft.language];
  const dateLabel = formatAgreementDate(draft.language, draft.agreementDate);

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280;width:240px;">${label}</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">${value || "...................."}</td></tr>`;

  return `
    <html>
      <head>
        <title>${copy.title}</title>
        <style>
          body { font-family: Georgia, serif; padding: 42px; color: #0f172a; }
          h1 { margin: 0 0 6px; font-size: 30px; color: #0b3a6b; }
          h2 { margin: 28px 0 10px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.12em; color: #475569; }
          p { line-height: 1.7; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          .card { border: 1px solid #dbe4f0; border-radius: 16px; padding: 20px; margin-bottom: 18px; }
          .sig { display:flex; gap:32px; margin-top:48px; }
          .sig div { flex:1; border-top:1px solid #cbd5e1; padding-top:12px; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>${copy.title}</h1>
        <p>${copy.subtitle}</p>
        <div class="card">
          <h2>${copy.sellerLabel}</h2>
          <table>
            ${row("Company", draft.companyName)}
            ${row("Address", draft.companyAddress)}
            ${row("Postal code / city", [draft.companyPostalCode, draft.companyCity].filter(Boolean).join(" "))}
            ${row("Phone", draft.companyPhone)}
            ${row("E-mail", draft.companyEmail)}
          </table>
        </div>
        <div class="card">
          <h2>${copy.buyerLabel}</h2>
          <table>
            ${row("Name", draft.clientName)}
            ${row("Address", draft.clientAddress)}
            ${row("Postal code / city", [draft.clientPostalCode, draft.clientCity].filter(Boolean).join(" "))}
            ${row("Phone", draft.clientPhone)}
            ${row("E-mail", draft.clientEmail)}
            ${row("Passport number", draft.passportNumber)}
            ${row("Married", boolLabel(draft.married))}
            ${row("Partner name", draft.spouseName)}
          </table>
        </div>
        <div class="card">
          <h2>${copy.vesselLabel}</h2>
          <table>
            ${row("Name", draft.vesselName)}
            ${row("Brand / type vessel", draft.vesselBrandType)}
            ${row("Building year, circa", draft.buildYear)}
            ${row("Dimensions, circa", draft.dimensions)}
            ${row("Building material", draft.buildingMaterial)}
            ${row("Builder", draft.builder)}
            ${row("Hullnumber / CIN Number", draft.hullNumber)}
            ${row("Engine", draft.engine)}
            ${row("Engine number", draft.engineNumber)}
            ${row("Registration number", draft.registrationNumber)}
          </table>
        </div>
        <div class="card">
          <h2>${copy.declarationsLabel}</h2>
          <p>${copy.registerText(boolLabel(draft.shipRegisterEntry), draft.shipRegisterPlace)}</p>
          <p>${copy.mortgageText(boolLabel(draft.hasMortgage), draft.mortgageInFavorOf)}</p>
          <p>${copy.vatText(boolLabel(draft.vatDeclaration))}</p>
          <p>${copy.priceText(draft.askingPrice, draft.askingPriceWords)}</p>
        </div>
        <div class="card">
          <h2>${copy.closingLabel}</h2>
          <p>${copy.closingText(dateLabel, draft.agreementCity || draft.companyCity)}</p>
        </div>
        <div class="sig">
          <div>${copy.sellerLabel}</div>
          <div>${copy.buyerLabel}</div>
        </div>
      </body>
    </html>
  `;
}

function buildContractDraft(
  yachtName: string,
  yachtData: Record<string, any> | null | undefined,
  location: LocationOption | null | undefined,
): ContractDraft {
  const locationDefaults = resolveLocationDefaults(location);
  const askingPrice =
    yachtData?.price != null && yachtData?.price !== ""
      ? String(yachtData.price)
      : "";
  const buildYear = yachtData?.year ? String(yachtData.year) : "";
  const dimensions = [yachtData?.loa, yachtData?.beam, yachtData?.draft]
    .filter(Boolean)
    .join(" x ");
  const engine = [yachtData?.engine_manufacturer, yachtData?.engine_model]
    .filter(Boolean)
    .join(" ");

  return {
    language: "nl",
    companyName: locationDefaults.companyName || "",
    companyAddress: locationDefaults.companyAddress || "",
    companyPostalCode: locationDefaults.companyPostalCode || "",
    companyCity: locationDefaults.companyCity || "",
    companyPhone: locationDefaults.companyPhone || "",
    companyEmail: locationDefaults.companyEmail || "",
    clientName: "",
    clientAddress: "",
    clientPostalCode: "",
    clientCity: "",
    clientPhone: "",
    clientEmail: "",
    passportNumber: "",
    married: "no",
    spouseName: "",
    vesselName: yachtName || yachtData?.boat_name || "",
    vesselBrandType: [yachtData?.manufacturer, yachtData?.model]
      .filter(Boolean)
      .join(" "),
    buildYear,
    dimensions,
    buildingMaterial:
      yachtData?.hull_construction || yachtData?.deck_construction || "",
    builder: yachtData?.builder || "",
    hullNumber: yachtData?.hull_number || "",
    engine,
    engineNumber: "",
    registrationNumber: yachtData?.reg_details || "",
    shipRegisterEntry: "no",
    shipRegisterPlace: "",
    hasMortgage: "no",
    mortgageInFavorOf: "",
    vatDeclaration: "no",
    askingPrice,
    askingPriceWords: "",
    agreementDate: new Date().toISOString().slice(0, 10),
    agreementCity: locationDefaults.agreementCity || "",
  };
}

function fieldValue(value?: string) {
  return value?.trim() || "—";
}

export function SignhostFlow({
  yachtId,
  yachtName,
  locationId,
  yachtData,
  locationOptions = [],
}: SignhostFlowProps) {
  const t = useTranslations("DashboardSignhostFlow");
  const locale = useLocale();
  const params = useParams<{ role?: string }>();
  const role = params?.role?.toLowerCase();
  const canManageContract = role !== "client";
  const selectedLocation = useMemo(
    () => locationOptions.find((option) => option.id === locationId) || null,
    [locationId, locationOptions],
  );
  const storageKey = `contract_draft_${yachtId}`;

  const [signRequest, setSignRequest] = useState<SignRequest | null>(null);
  const [documents, setDocuments] = useState<SignhostDocument[]>([]);
  const [recipients, setRecipients] = useState<SignRecipient[]>([
    { role: "buyer", name: "", email: "" },
    { role: "seller", name: "", email: "" },
  ]);
  const [draft, setDraft] = useState<ContractDraft>(() =>
    buildContractDraft(yachtName, yachtData, selectedLocation),
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const nextDraft = buildContractDraft(yachtName, yachtData, selectedLocation);

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setDraft(nextDraft);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ContractDraft>;
      setDraft({ ...nextDraft, ...parsed });
    } catch {
      setDraft(nextDraft);
    }
  }, [selectedLocation, storageKey, yachtData, yachtName]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Ignore persistence errors.
    }
  }, [draft, storageKey]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (signRequest?.status === "SENT") {
      interval = setInterval(async () => {
        try {
          const res = await signhostApi.getStatus(signRequest.id);
          if (res.sign_request.status !== signRequest.status) {
            setSignRequest(res.sign_request);
            if (res.sign_request.status === "SIGNED") {
              const docs = await signhostApi.getDocuments(res.sign_request.id);
              setDocuments(docs.documents);
              toast.success("Contract signed successfully.");
            }
          }
        } catch {
          // Keep polling silent.
        }
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [signRequest]);

  const previewCopy = copyByLanguage[draft.language];
  const localeLanguage =
    locale === "nl" || locale === "de" || locale === "fr" || locale === "en"
      ? locale
      : "en";
  const languageAttachment = attachmentByLanguage[localeLanguage];

  const handleFieldChange = <K extends keyof ContractDraft>(
    key: K,
    value: ContractDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleRecipientChange = (
    index: number,
    field: keyof SignRecipient,
    value: string,
  ) => {
    setRecipients((prev) =>
      prev.map((recipient, currentIndex) =>
        currentIndex === index ? { ...recipient, [field]: value } : recipient,
      ),
    );
  };

  const handlePreviewPrint = () => {
    const previewWindow = window.open("", "_blank", "width=960,height=1280");
    if (!previewWindow) {
      toast.error("Popup blocked. Allow popups to print or save PDF.");
      return;
    }

    previewWindow.document.write(getPreviewHtml(draft));
    previewWindow.document.close();
    previewWindow.focus();
    previewWindow.print();
  };

  const handleGenerateContract = async () => {
    if (!locationId) {
      toast.error("Select a sales location before generating the contract.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await signhostApi.generateContract({
        entity_type: "Vessel",
        entity_id: yachtId,
        location_id: locationId,
        title: `${previewCopy.title} - ${draft.vesselName || yachtName}`,
        metadata: {
          boat_name: draft.vesselName || yachtName,
          contract_language: draft.language,
          contract_template: draft,
          location_snapshot: selectedLocation,
        },
      });

      setSignRequest(res.sign_request);
      setDocuments(res.sign_request.documents || []);
      toast.success("Contract PDF generated.");
    } catch {
      toast.error("Failed to generate contract PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendRequest = async () => {
    if (!signRequest) return;

    const validRecipients = recipients
      .map((recipient) => ({
        ...recipient,
        name: recipient.name?.trim() || "",
        email: recipient.email?.trim() || "",
      }))
      .filter((recipient) => recipient.name && recipient.email);

    if (validRecipients.length < 1) {
      toast.error("Add at least one recipient with name and e-mail.");
      return;
    }

    setIsSending(true);
    try {
      const res = await signhostApi.createRequest(
        {
          sign_request_id: signRequest.id,
          recipients: validRecipients,
          reference: `vessel-${yachtId}`,
        },
        `signhost_${signRequest.id}_${Date.now()}`,
      );

      setSignRequest(res.sign_request);
      toast.success("Signature request sent.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send request.");
    } finally {
      setIsSending(false);
    }
  };

  const statusDisplay = useMemo(() => {
    const status = signRequest?.status?.toUpperCase() || "DRAFT";
    switch (status) {
      case "SIGNED":
        return {
          label: "Signed",
          icon: FileCheck,
          tone:
            "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
        };
      case "SENT":
        return {
          label: "Sent for signing",
          icon: Send,
          tone:
            "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
        };
      case "FAILED":
        return {
          label: "Cancelled",
          icon: XCircle,
          tone:
            "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900",
        };
      default:
        return {
          label: "Draft",
          icon: FileText,
          tone:
            "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700",
        };
    }
  }, [signRequest?.status]);

  if (!canManageContract) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <FilePenLine size={18} className="text-[#003566] dark:text-sky-300" />
            Signhost Digitale Ondertekening
          </h4>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Contract Lifecycle Management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]",
              statusDisplay.tone,
            )}
          >
            <statusDisplay.icon size={12} />
            {statusDisplay.label}
          </div>
          <select
            value={draft.language}
            onChange={(event) =>
              handleFieldChange("language", event.target.value as ContractLanguage)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            Edit contract
          </Button>
          <Button
            type="button"
            onClick={handlePreviewPrint}
            className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-[#d7e3f1] bg-gradient-to-br from-[#f8fbff] to-white p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-sky-300">
                  {previewCopy.title}
                </p>
                <h5 className="mt-2 text-3xl font-black italic text-[#003566] dark:text-slate-100">
                  {draft.vesselName || yachtName}
                </h5>
                <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  {previewCopy.previewHint}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-100">
                  <Globe2 size={14} />
                  {titleCase(draft.language)}
                </div>
                <p className="mt-2">
                  {selectedLocation?.name || "No location selected"}
                </p>
              </div>
            </div>

            {!locationId && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Location required</p>
                  <p>
                    Select a sales location in step 2 before generating this contract.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {previewCopy.sellerLabel}
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {fieldValue(draft.companyName)}
                  </p>
                  <p>{fieldValue(draft.companyAddress)}</p>
                  <p>
                    {fieldValue(
                      [draft.companyPostalCode, draft.companyCity]
                        .filter(Boolean)
                        .join(" "),
                    )}
                  </p>
                  <p>{fieldValue(draft.companyPhone)}</p>
                  <p>{fieldValue(draft.companyEmail)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {previewCopy.buyerLabel}
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {fieldValue(draft.clientName)}
                  </p>
                  <p>{fieldValue(draft.clientAddress)}</p>
                  <p>
                    {fieldValue(
                      [draft.clientPostalCode, draft.clientCity]
                        .filter(Boolean)
                        .join(" "),
                    )}
                  </p>
                  <p>{fieldValue(draft.clientPhone)}</p>
                  <p>{fieldValue(draft.clientEmail)}</p>
                  <p>Passport: {fieldValue(draft.passportNumber)}</p>
                  <p>
                    Married: {boolLabel(draft.married)}
                    {draft.spouseName ? ` • ${draft.spouseName}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {previewCopy.vesselLabel}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ["Name", draft.vesselName],
                  ["Brand / type vessel", draft.vesselBrandType],
                  ["Building year, circa", draft.buildYear],
                  ["Dimensions, circa", draft.dimensions],
                  ["Building material", draft.buildingMaterial],
                  ["Builder", draft.builder],
                  ["Hullnumber / CIN Number", draft.hullNumber],
                  ["Engine", draft.engine],
                  ["Engine number", draft.engineNumber],
                  ["Registration number", draft.registrationNumber],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {fieldValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {previewCopy.declarationsLabel}
              </p>
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
                <p>
                  {previewCopy.registerText(
                    boolLabel(draft.shipRegisterEntry),
                    draft.shipRegisterPlace,
                  )}
                </p>
                <p>
                  {previewCopy.mortgageText(
                    boolLabel(draft.hasMortgage),
                    draft.mortgageInFavorOf,
                  )}
                </p>
                <p>{previewCopy.vatText(boolLabel(draft.vatDeclaration))}</p>
                <p>
                  {previewCopy.priceText(
                    draft.askingPrice || "0",
                    draft.askingPriceWords,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {previewCopy.closingLabel}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {previewCopy.closingText(
                  formatAgreementDate(draft.language, draft.agreementDate),
                  draft.agreementCity || draft.companyCity,
                )}
              </p>
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                <div className="border-t border-slate-300 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {previewCopy.sellerLabel}
                </div>
                <div className="border-t border-slate-300 pt-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {previewCopy.buyerLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-slate-800 dark:text-sky-300">
                <FileText size={22} />
              </div>
              <div>
                <h5 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {previewCopy.generateLabel}
                </h5>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Generate the PDF from this contract template, then send it to Signhost.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Button
                type="button"
                onClick={handleGenerateContract}
                disabled={isGenerating || !locationId}
                className="h-11 rounded-xl bg-[#003566] text-white hover:bg-[#00284d] disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {previewCopy.generateLabel}
              </Button>
              <Button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="h-11 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <PencilLine className="mr-2 h-4 w-4" />
                Update contract values
              </Button>
            </div>
          </div>

          {signRequest && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h5 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Signature recipients
              </h5>
              <div className="mt-4 space-y-3">
                {recipients.map((recipient, index) => (
                  <div
                    key={`${recipient.role}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566] dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300">
                      {recipient.role}
                    </div>
                    <div className="grid gap-3">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={recipient.name}
                          onChange={(event) =>
                            handleRecipientChange(index, "name", event.target.value)
                          }
                          placeholder="Full name"
                          className="h-10 pl-9"
                        />
                      </div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={recipient.email}
                          onChange={(event) =>
                            handleRecipientChange(index, "email", event.target.value)
                          }
                          placeholder="E-mail address"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {signRequest.status === "DRAFT" && (
                <Button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={isSending}
                  className="mt-4 h-11 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send for signing
                </Button>
              )}

              {signRequest.status === "SENT" && signRequest.sign_url && (
                <a
                  href={signRequest.sign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  View Signhost status <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h5 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Documents
              </h5>
              <span className="text-xs font-semibold text-slate-400">
                {documents.length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No generated documents yet.
                </div>
              ) : (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "rounded-xl p-3",
                          document.type === "signed"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300",
                        )}
                      >
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {document.type === "signed"
                            ? "Signed contract"
                            : "Original contract"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {document.type === "signed"
                            ? "Sealed by Signhost"
                            : "Draft PDF"}
                        </p>
                      </div>
                    </div>
                    <a
                      href={document.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-blue-600 dark:hover:bg-slate-900"
                    >
                      <Eye size={16} />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <FileText size={20} />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                  {t("agreement.title")}
                </h5>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t("agreement.description")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {languageAttachment.name}
                    </p>
                      <p className="text-xs text-slate-400">
                        {t("agreement.activeLanguage", {
                        language: titleCase(localeLanguage),
                      })}
                    </p>
                  </div>
                  <a
                    href={languageAttachment.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Eye size={14} />
                    {t("agreement.view")}
                  </a>
                  <a
                    href={languageAttachment.href}
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00284d]"
                  >
                    <ExternalLink size={14} />
                    {t("agreement.download")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl dark:border-slate-700 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Edit contract template</DialogTitle>
            <DialogDescription>
              Update the company, client, vessel, and agreement values before generating the PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Seller / location
                </p>
                <div className="mt-4 grid gap-3">
                  <Input
                    value={draft.companyName}
                    onChange={(event) =>
                      handleFieldChange("companyName", event.target.value)
                    }
                    placeholder="Company"
                  />
                  <Input
                    value={draft.companyAddress}
                    onChange={(event) =>
                      handleFieldChange("companyAddress", event.target.value)
                    }
                    placeholder="Address"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.companyPostalCode}
                      onChange={(event) =>
                        handleFieldChange("companyPostalCode", event.target.value)
                      }
                      placeholder="Postal code"
                    />
                    <Input
                      value={draft.companyCity}
                      onChange={(event) =>
                        handleFieldChange("companyCity", event.target.value)
                      }
                      placeholder="City"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.companyPhone}
                      onChange={(event) =>
                        handleFieldChange("companyPhone", event.target.value)
                      }
                      placeholder="Phone"
                    />
                    <Input
                      value={draft.companyEmail}
                      onChange={(event) =>
                        handleFieldChange("companyEmail", event.target.value)
                      }
                      placeholder="E-mail"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Buyer
                </p>
                <div className="mt-4 grid gap-3">
                  <Input
                    value={draft.clientName}
                    onChange={(event) =>
                      handleFieldChange("clientName", event.target.value)
                    }
                    placeholder="Name"
                  />
                  <Input
                    value={draft.clientAddress}
                    onChange={(event) =>
                      handleFieldChange("clientAddress", event.target.value)
                    }
                    placeholder="Address"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.clientPostalCode}
                      onChange={(event) =>
                        handleFieldChange("clientPostalCode", event.target.value)
                      }
                      placeholder="Postal code"
                    />
                    <Input
                      value={draft.clientCity}
                      onChange={(event) =>
                        handleFieldChange("clientCity", event.target.value)
                      }
                      placeholder="City"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.clientPhone}
                      onChange={(event) =>
                        handleFieldChange("clientPhone", event.target.value)
                      }
                      placeholder="Phone"
                    />
                    <Input
                      value={draft.clientEmail}
                      onChange={(event) =>
                        handleFieldChange("clientEmail", event.target.value)
                      }
                      placeholder="E-mail"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.passportNumber}
                      onChange={(event) =>
                        handleFieldChange("passportNumber", event.target.value)
                      }
                      placeholder="Passport number"
                    />
                    <Input
                      value={draft.spouseName}
                      onChange={(event) =>
                        handleFieldChange("spouseName", event.target.value)
                      }
                      placeholder="Partner name"
                    />
                  </div>
                  <select
                    value={draft.married}
                    onChange={(event) =>
                      handleFieldChange("married", event.target.value as "yes" | "no")
                    }
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="no">Not married</option>
                    <option value="yes">Married</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Vessel
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  value={draft.vesselName}
                  onChange={(event) =>
                    handleFieldChange("vesselName", event.target.value)
                  }
                  placeholder="Name"
                />
                <Input
                  value={draft.vesselBrandType}
                  onChange={(event) =>
                    handleFieldChange("vesselBrandType", event.target.value)
                  }
                  placeholder="Brand / type"
                />
                <Input
                  value={draft.buildYear}
                  onChange={(event) =>
                    handleFieldChange("buildYear", event.target.value)
                  }
                  placeholder="Build year"
                />
                <Input
                  value={draft.dimensions}
                  onChange={(event) =>
                    handleFieldChange("dimensions", event.target.value)
                  }
                  placeholder="Dimensions"
                />
                <Input
                  value={draft.buildingMaterial}
                  onChange={(event) =>
                    handleFieldChange("buildingMaterial", event.target.value)
                  }
                  placeholder="Building material"
                />
                <Input
                  value={draft.builder}
                  onChange={(event) =>
                    handleFieldChange("builder", event.target.value)
                  }
                  placeholder="Builder"
                />
                <Input
                  value={draft.hullNumber}
                  onChange={(event) =>
                    handleFieldChange("hullNumber", event.target.value)
                  }
                  placeholder="Hull / CIN number"
                />
                <Input
                  value={draft.engine}
                  onChange={(event) =>
                    handleFieldChange("engine", event.target.value)
                  }
                  placeholder="Engine"
                />
                <Input
                  value={draft.engineNumber}
                  onChange={(event) =>
                    handleFieldChange("engineNumber", event.target.value)
                  }
                  placeholder="Engine number"
                />
                <Input
                  value={draft.registrationNumber}
                  onChange={(event) =>
                    handleFieldChange("registrationNumber", event.target.value)
                  }
                  placeholder="Registration number"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Declarations
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select
                  value={draft.shipRegisterEntry}
                  onChange={(event) =>
                    handleFieldChange(
                      "shipRegisterEntry",
                      event.target.value as "yes" | "no",
                    )
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="no">No ship register entry</option>
                  <option value="yes">Yes, ship register entry</option>
                </select>
                <Input
                  value={draft.shipRegisterPlace}
                  onChange={(event) =>
                    handleFieldChange("shipRegisterPlace", event.target.value)
                  }
                  placeholder="If yes, in..."
                />
                <select
                  value={draft.hasMortgage}
                  onChange={(event) =>
                    handleFieldChange("hasMortgage", event.target.value as "yes" | "no")
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="no">No ship mortgage</option>
                  <option value="yes">Yes, ship mortgage</option>
                </select>
                <Input
                  value={draft.mortgageInFavorOf}
                  onChange={(event) =>
                    handleFieldChange("mortgageInFavorOf", event.target.value)
                  }
                  placeholder="If yes, in favor of..."
                />
                <select
                  value={draft.vatDeclaration}
                  onChange={(event) =>
                    handleFieldChange("vatDeclaration", event.target.value as "yes" | "no")
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="no">No VAT declaration</option>
                  <option value="yes">Yes, VAT declaration</option>
                </select>
                <Input
                  value={draft.askingPrice}
                  onChange={(event) =>
                    handleFieldChange("askingPrice", event.target.value)
                  }
                  placeholder="Asking price"
                />
                <Input
                  value={draft.askingPriceWords}
                  onChange={(event) =>
                    handleFieldChange("askingPriceWords", event.target.value)
                  }
                  placeholder="Asking price in full words"
                />
                <Input
                  type="date"
                  value={draft.agreementDate}
                  onChange={(event) =>
                    handleFieldChange("agreementDate", event.target.value)
                  }
                />
                <Input
                  value={draft.agreementCity}
                  onChange={(event) =>
                    handleFieldChange("agreementCity", event.target.value)
                  }
                  placeholder="Agreement city"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handlePreviewPrint}
              className="rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d]"
            >
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
