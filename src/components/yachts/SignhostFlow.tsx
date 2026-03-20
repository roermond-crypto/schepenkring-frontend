"use client";

import Image from "next/image";
import { jsPDF } from "jspdf";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  FileCheck,
  FilePenLine,
  FileText,
  Globe2,
  Loader2,
  PencilLine,
  RefreshCw,
  Send,
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
  type SignRequest,
  type SignhostTransaction,
} from "@/lib/api/signhost";
import { useClientSession } from "@/components/session/ClientSessionProvider";

type ContractLanguage = "nl" | "en" | "de" | "fr";
type ContractTemplateKey = "sale_agreement" | "escrow_form";

function mapTransactionToSignRequest(
  transaction: SignhostTransaction,
): SignRequest {
  const normalizedStatus = (transaction.status || "").toUpperCase();
  const signUrl =
    transaction.signing_url_seller ||
    transaction.signing_url_buyer ||
    null;

  return {
    id: transaction.id,
    location_id: 0,
    entity_type: "Yacht",
    entity_id: transaction.yacht_id ?? transaction.deal_id ?? 0,
    provider: "signhost",
    status:
      normalizedStatus === "SIGNED"
        ? "SIGNED"
        : normalizedStatus === "CANCELLED" ||
            normalizedStatus === "REJECTED" ||
            normalizedStatus === "FAILED"
          ? "FAILED"
          : normalizedStatus === "PENDING" ||
              normalizedStatus === "SIGNING" ||
              normalizedStatus === "SENT"
            ? "SENT"
            : "DRAFT",
    signhost_transaction_id: transaction.signhost_transaction_id,
    sign_url: signUrl,
    requested_by_user_id: null,
    metadata: {
      sign_urls: [
        transaction.signing_url_seller
          ? { role: "seller", url: transaction.signing_url_seller }
          : null,
        transaction.signing_url_buyer
          ? { role: "buyer", url: transaction.signing_url_buyer }
          : null,
      ].filter(Boolean),
      transaction_status: transaction.status,
      signed_pdf_path: transaction.signed_pdf_path,
      webhook_last_payload: transaction.webhook_last_payload,
    },
    documents: [],
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  };
}

function resolveContractLanguage(locale: string): ContractLanguage {
  if (
    locale === "nl" ||
    locale === "en" ||
    locale === "de" ||
    locale === "fr"
  ) {
    return locale;
  }
  return "en";
}

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

type YachtContractData = {
  price?: string | number | null;
  year?: string | number | null;
  loa?: string | number | null;
  beam?: string | number | null;
  draft?: string | number | null;
  engine_manufacturer?: string | null;
  engine_model?: string | null;
  hull_construction?: string | null;
  deck_construction?: string | null;
  builder?: string | null;
  hull_number?: string | null;
  reg_details?: string | null;
  boat_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
};

interface SignhostFlowProps {
  yachtId: number | null;
  yachtName: string;
  locationId: number | null;
  yachtData?: YachtContractData | null;
  locationOptions?: LocationOption[];
}

const contractTemplateOptions: Array<{
  value: ContractTemplateKey;
  label: string;
  description: string;
}> = [
  {
    value: "sale_agreement",
    label: "Sale agreement",
    description: "Current vessel agreement template",
  },
  {
    value: "escrow_form",
    label: "Escrow form",
    description: "Language-specific HISWA-RECRON escrow page",
  },
];

const locationCompanyDefaults: Record<
  string,
  Partial<
    Pick<
      ContractDraft,
      | "companyName"
      | "companyAddress"
      | "companyPostalCode"
      | "companyCity"
      | "companyPhone"
      | "companyEmail"
    >
  >
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

const editorCopyByLanguage: Record<
  ContractLanguage,
  {
    dialogTitle: string;
    dialogDescription: string;
    editSectionPrefix: string;
    sellerSection: string;
    buyerSection: string;
    vesselSection: string;
    declarationsSection: string;
    saveDetails: string;
    company: string;
    address: string;
    postalCode: string;
    city: string;
    phone: string;
    email: string;
    name: string;
    passportNumber: string;
    partnerName: string;
    notMarried: string;
    married: string;
    brandType: string;
    buildYear: string;
    dimensions: string;
    buildingMaterial: string;
    builder: string;
    hullCinNumber: string;
    engine: string;
    engineNumber: string;
    registrationNumber: string;
    noShipRegisterEntry: string;
    yesShipRegisterEntry: string;
    registerPlace: string;
    noShipMortgage: string;
    yesShipMortgage: string;
    mortgageParty: string;
    noVatDeclaration: string;
    yesVatDeclaration: string;
    askingPrice: string;
    askingPriceWords: string;
    agreementDate: string;
    agreementCity: string;
    pageTitle: string;
    pageSubtitle: string;
    statusSigned: string;
    statusSent: string;
    statusCancelled: string;
    statusDraft: string;
    editContract: string;
    downloadPdf: string;
    createDeeplink: string;
    openDeeplink: string;
    noLocationSelected: string;
    locationRequired: string;
    locationRequiredHint: string;
    selectedTemplate: string;
    renderUrl: string;
    escrowMember: string;
    escrowBuyerDetails: string;
    sendEscrowToSignhost: string;
    sendToSignhost: string;
  }
> = {
  en: {
    dialogTitle: "Edit contract template",
    dialogDescription:
      "Update the company, client, vessel, and agreement values before generating the PDF.",
    editSectionPrefix: "Edit",
    sellerSection: "Seller / location",
    buyerSection: "Buyer",
    vesselSection: "Vessel",
    declarationsSection: "Declarations",
    saveDetails: "Save details",
    company: "Company",
    address: "Address",
    postalCode: "Postal code",
    city: "City",
    phone: "Phone",
    email: "E-mail",
    name: "Name",
    passportNumber: "Passport number",
    partnerName: "Partner name",
    notMarried: "Not married",
    married: "Married",
    brandType: "Brand / type",
    buildYear: "Build year",
    dimensions: "Dimensions",
    buildingMaterial: "Building material",
    builder: "Builder",
    hullCinNumber: "Hull / CIN number",
    engine: "Engine",
    engineNumber: "Engine number",
    registrationNumber: "Registration number",
    noShipRegisterEntry: "No ship register entry",
    yesShipRegisterEntry: "Yes, ship register entry",
    registerPlace: "If yes, in...",
    noShipMortgage: "No ship mortgage",
    yesShipMortgage: "Yes, ship mortgage",
    mortgageParty: "If yes, in favor of...",
    noVatDeclaration: "No VAT declaration",
    yesVatDeclaration: "Yes, VAT declaration",
    askingPrice: "Asking price",
    askingPriceWords: "Asking price in full words",
    agreementDate: "Agreement date",
    agreementCity: "Agreement city",
    pageTitle: "Digital Signhost signing",
    pageSubtitle: "Contract lifecycle management",
    statusSigned: "Signed",
    statusSent: "Sent for signing",
    statusCancelled: "Cancelled",
    statusDraft: "Draft",
    editContract: "Edit contract",
    downloadPdf: "Download PDF",
    createDeeplink: "Create Signhost deeplink",
    openDeeplink: "Open Signhost deeplink",
    noLocationSelected: "No location selected",
    locationRequired: "Location required",
    locationRequiredHint:
      "Select a sales location in step 2 before generating this contract.",
    selectedTemplate: "Selected template",
    renderUrl: "Render URL",
    escrowMember: "HISWA-RECRON member",
    escrowBuyerDetails: "Buyer details",
    sendEscrowToSignhost: "Send escrow to Signhost",
    sendToSignhost: "Send to Signhost",
  },
  nl: {
    dialogTitle: "Contractsjabloon bewerken",
    dialogDescription:
      "Werk de bedrijfs-, klant-, vaartuig- en overeenkomstgegevens bij voordat je de PDF genereert.",
    editSectionPrefix: "Bewerk",
    sellerSection: "Verkoper / locatie",
    buyerSection: "Koper",
    vesselSection: "Vaartuig",
    declarationsSection: "Verklaringen",
    saveDetails: "Gegevens opslaan",
    company: "Bedrijf",
    address: "Adres",
    postalCode: "Postcode",
    city: "Plaats",
    phone: "Telefoon",
    email: "E-mail",
    name: "Naam",
    passportNumber: "Paspoortnummer",
    partnerName: "Partnernaam",
    notMarried: "Niet gehuwd",
    married: "Gehuwd",
    brandType: "Merk / type",
    buildYear: "Bouwjaar",
    dimensions: "Afmetingen",
    buildingMaterial: "Bouwmateriaal",
    builder: "Bouwer",
    hullCinNumber: "Romp / CIN-nummer",
    engine: "Motor",
    engineNumber: "Motornummer",
    registrationNumber: "Registratienummer",
    noShipRegisterEntry: "Geen scheepsregisterinschrijving",
    yesShipRegisterEntry: "Ja, scheepsregisterinschrijving",
    registerPlace: "Zo ja, te...",
    noShipMortgage: "Geen scheepshypotheek",
    yesShipMortgage: "Ja, scheepshypotheek",
    mortgageParty: "Zo ja, ten gunste van...",
    noVatDeclaration: "Geen btw-verklaring",
    yesVatDeclaration: "Ja, btw-verklaring",
    askingPrice: "Vraagprijs",
    askingPriceWords: "Vraagprijs voluit",
    agreementDate: "Overeenkomstsdatum",
    agreementCity: "Plaats overeenkomst",
    pageTitle: "Digitale ondertekening via Signhost",
    pageSubtitle: "Contract lifecycle management",
    statusSigned: "Ondertekend",
    statusSent: "Verzonden voor ondertekening",
    statusCancelled: "Geannuleerd",
    statusDraft: "Concept",
    editContract: "Contract bewerken",
    downloadPdf: "PDF downloaden",
    createDeeplink: "Signhost deeplink maken",
    openDeeplink: "Open Signhost deeplink",
    noLocationSelected: "Geen locatie geselecteerd",
    locationRequired: "Locatie vereist",
    locationRequiredHint:
      "Selecteer eerst een verkooplocatie in stap 2 voordat je dit contract genereert.",
    selectedTemplate: "Geselecteerd sjabloon",
    renderUrl: "Render-URL",
    escrowMember: "HISWA-RECRON-lid",
    escrowBuyerDetails: "Kopersgegevens",
    sendEscrowToSignhost: "Escrow naar Signhost sturen",
    sendToSignhost: "Naar Signhost sturen",
  },
  de: {
    dialogTitle: "Vertragsvorlage bearbeiten",
    dialogDescription:
      "Aktualisieren Sie die Firmen-, Kunden-, Schiffs- und Vertragsdaten, bevor Sie das PDF erzeugen.",
    editSectionPrefix: "Bearbeite",
    sellerSection: "Verkäufer / Standort",
    buyerSection: "Käufer",
    vesselSection: "Fahrzeug",
    declarationsSection: "Erklärungen",
    saveDetails: "Details speichern",
    company: "Unternehmen",
    address: "Adresse",
    postalCode: "Postleitzahl",
    city: "Ort",
    phone: "Telefon",
    email: "E-Mail",
    name: "Name",
    passportNumber: "Passnummer",
    partnerName: "Partnername",
    notMarried: "Nicht verheiratet",
    married: "Verheiratet",
    brandType: "Marke / Typ",
    buildYear: "Baujahr",
    dimensions: "Abmessungen",
    buildingMaterial: "Baumaterial",
    builder: "Werft / Hersteller",
    hullCinNumber: "Rumpf- / CIN-Nummer",
    engine: "Motor",
    engineNumber: "Motornummer",
    registrationNumber: "Registriernummer",
    noShipRegisterEntry: "Kein Schiffsregistereintrag",
    yesShipRegisterEntry: "Ja, Schiffsregistereintrag",
    registerPlace: "Falls ja, in...",
    noShipMortgage: "Keine Schiffshypothek",
    yesShipMortgage: "Ja, Schiffshypothek",
    mortgageParty: "Falls ja, zugunsten von...",
    noVatDeclaration: "Keine MwSt.-Erklärung",
    yesVatDeclaration: "Ja, MwSt.-Erklärung",
    askingPrice: "Angebotspreis",
    askingPriceWords: "Angebotspreis ausgeschrieben",
    agreementDate: "Vertragsdatum",
    agreementCity: "Vertragsort",
    pageTitle: "Digitale Signhost-Unterzeichnung",
    pageSubtitle: "Contract lifecycle management",
    statusSigned: "Unterzeichnet",
    statusSent: "Zur Unterschrift versendet",
    statusCancelled: "Storniert",
    statusDraft: "Entwurf",
    editContract: "Vertrag bearbeiten",
    downloadPdf: "PDF herunterladen",
    createDeeplink: "Signhost-Deeplink erstellen",
    openDeeplink: "Signhost-Deeplink öffnen",
    noLocationSelected: "Kein Standort ausgewählt",
    locationRequired: "Standort erforderlich",
    locationRequiredHint:
      "Wählen Sie zuerst in Schritt 2 einen Verkaufsstandort aus, bevor Sie diesen Vertrag erzeugen.",
    selectedTemplate: "Ausgewählte Vorlage",
    renderUrl: "Render-URL",
    escrowMember: "HISWA-RECRON-Mitglied",
    escrowBuyerDetails: "Käuferdaten",
    sendEscrowToSignhost: "Escrow an Signhost senden",
    sendToSignhost: "An Signhost senden",
  },
  fr: {
    dialogTitle: "Modifier le modele de contrat",
    dialogDescription:
      "Mettez a jour les donnees de l'entreprise, du client, du bateau et du contrat avant de generer le PDF.",
    editSectionPrefix: "Modifier",
    sellerSection: "Vendeur / site",
    buyerSection: "Acheteur",
    vesselSection: "Bateau",
    declarationsSection: "Declarations",
    saveDetails: "Enregistrer les details",
    company: "Societe",
    address: "Adresse",
    postalCode: "Code postal",
    city: "Ville",
    phone: "Telephone",
    email: "E-mail",
    name: "Nom",
    passportNumber: "Numero de passeport",
    partnerName: "Nom du partenaire",
    notMarried: "Non marie",
    married: "Marie",
    brandType: "Marque / type",
    buildYear: "Annee de construction",
    dimensions: "Dimensions",
    buildingMaterial: "Materiau",
    builder: "Constructeur",
    hullCinNumber: "Numero de coque / CIN",
    engine: "Moteur",
    engineNumber: "Numero de moteur",
    registrationNumber: "Numero d'immatriculation",
    noShipRegisterEntry: "Pas d'inscription au registre naval",
    yesShipRegisterEntry: "Oui, inscription au registre naval",
    registerPlace: "Si oui, a...",
    noShipMortgage: "Pas d'hypotheque maritime",
    yesShipMortgage: "Oui, hypotheque maritime",
    mortgageParty: "Si oui, au profit de...",
    noVatDeclaration: "Pas de declaration TVA",
    yesVatDeclaration: "Oui, declaration TVA",
    askingPrice: "Prix demande",
    askingPriceWords: "Prix demande en toutes lettres",
    agreementDate: "Date du contrat",
    agreementCity: "Ville du contrat",
    pageTitle: "Signature numerique Signhost",
    pageSubtitle: "Contract lifecycle management",
    statusSigned: "Signe",
    statusSent: "Envoye pour signature",
    statusCancelled: "Annule",
    statusDraft: "Brouillon",
    editContract: "Modifier le contrat",
    downloadPdf: "Telecharger le PDF",
    createDeeplink: "Creer le deeplink Signhost",
    openDeeplink: "Ouvrir le deeplink Signhost",
    noLocationSelected: "Aucun lieu selectionne",
    locationRequired: "Lieu requis",
    locationRequiredHint:
      "Selectionnez d'abord un lieu de vente a l'etape 2 avant de generer ce contrat.",
    selectedTemplate: "Modele selectionne",
    renderUrl: "URL de rendu",
    escrowMember: "Membre HISWA-RECRON",
    escrowBuyerDetails: "Coordonnees de l'acheteur",
    sendEscrowToSignhost: "Envoyer l'escrow a Signhost",
    sendToSignhost: "Envoyer a Signhost",
  },
};

function titleCase(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

function boolLabel(language: ContractLanguage, value: "yes" | "no") {
  if (language === "nl") return value === "yes" ? "Ja" : "Nee";
  if (language === "de") return value === "yes" ? "Ja" : "Nein";
  if (language === "fr") return value === "yes" ? "Oui" : "Non";
  return value === "yes" ? "Yes" : "No";
}

function resolveEscrowFormLanguage(
  language: ContractLanguage,
): "nl" | "en" | "de" {
  if (language === "de") return "de";
  if (language === "en" || language === "fr") return "en";
  return "nl";
}

function buildEscrowContractUrl(
  origin: string,
  locale: string,
  language: ContractLanguage,
  draft: ContractDraft,
) {
  const formLanguage = resolveEscrowFormLanguage(language);
  const params = new URLSearchParams({
    memberName: draft.companyName || "",
    contactName: draft.companyName || "",
    memberEmail: draft.companyEmail || "",
    sellerName: draft.companyName || "",
    sellerAddress: draft.companyAddress || "",
    sellerPostalCity: [draft.companyPostalCode, draft.companyCity]
      .filter(Boolean)
      .join(" "),
    sellerPhone: draft.companyPhone || "",
    sellerEmail: draft.companyEmail || "",
    buyerName: draft.clientName || "",
    buyerAddress: draft.clientAddress || "",
    buyerPostalCity: [draft.clientPostalCode, draft.clientCity]
      .filter(Boolean)
      .join(" "),
    buyerPhone: draft.clientPhone || "",
    buyerEmail: draft.clientEmail || "",
    agreementNumber: draft.registrationNumber || "",
    agreementDate: draft.agreementDate || "",
    deliveryDescription: draft.vesselName || "",
    totalAmount: draft.askingPrice || "",
    paidBy: "",
    drawnUpDate: draft.agreementDate || "",
    drawnUpCity: draft.agreementCity || draft.companyCity || "",
    payee1: draft.companyName || "",
    iban1: "",
    amount1: draft.askingPrice || "",
    payee2: "",
    iban2: "",
    amount2: "",
    payee3: "",
    iban3: "",
    amount3: "",
  });

  return `${origin}/${locale}/contracts/escrow/${formLanguage}?${params.toString()}`;
}

function resolveAgreementPdfLanguage(language: ContractLanguage) {
  return language === "fr" ? "en" : language;
}

function getAgreementPdfPath(language: ContractLanguage) {
  const resolvedLanguage = resolveAgreementPdfLanguage(language);
  return `/contracts/bemiddelingsvoorwaarden-${resolvedLanguage}.pdf`;
}

async function fetchAgreementPdfFile(language: ContractLanguage) {
  const resolvedLanguage = resolveAgreementPdfLanguage(language);
  const response = await fetch(getAgreementPdfPath(language));
  if (!response.ok) {
    throw new Error("Failed to load contract agreement PDF.");
  }

  const blob = await response.blob();
  return new File(
    [blob],
    `bemiddelingsvoorwaarden-${resolvedLanguage}.pdf`,
    { type: "application/pdf" },
  );
}

function triggerFileDownload(file: File) {
  const downloadUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

function getAgreementCopy(language: ContractLanguage) {
  switch (language) {
    case "nl":
      return {
        heading: "BEMIDDELINGSOVEREENKOMST",
        referenceLabel: "Referentienummer",
        nameLabel: "Naam",
        addressLabel: "Adres",
        postalCityLabel: "Postcode / plaats",
        phoneLabel: "Telefoonnummer",
        emailLabel: "E-mail",
        passportLabel: "Paspoortnummer",
        marriedLabel: "Gehuwd",
        clientCaption: "Hierna te noemen cliënt",
        intermediaryConnector: "en",
        companyLabel: "Bedrijf",
        intermediaryCaption: "Hierna te noemen bemiddelaar",
        introLabel: "zijn overeengekomen:",
        signatureClient: "handtekening cliënt",
        signatureIntermediary: "handtekening bemiddelaar",
      };
    case "de":
      return {
        heading: "MAKLERVERTRAG",
        referenceLabel: "Referenznummer",
        nameLabel: "Name",
        addressLabel: "Adresse",
        postalCityLabel: "Postleitzahl / Ort",
        phoneLabel: "Telefonnummer",
        emailLabel: "E-Mail",
        passportLabel: "Passnummer",
        marriedLabel: "Verheiratet",
        clientCaption: "nachfolgend Kunde genannt",
        intermediaryConnector: "und",
        companyLabel: "Unternehmen",
        intermediaryCaption: "nachfolgend Vermittler genannt",
        introLabel: "haben vereinbart:",
        signatureClient: "Unterschrift Kunde",
        signatureIntermediary: "Unterschrift Vermittler",
      };
    case "fr":
      return {
        heading: "CONTRAT DE COURTAGE",
        referenceLabel: "Numero de reference",
        nameLabel: "Nom",
        addressLabel: "Adresse",
        postalCityLabel: "Code postal / ville",
        phoneLabel: "Telephone",
        emailLabel: "E-mail",
        passportLabel: "Numero de passeport",
        marriedLabel: "Marie",
        clientCaption: "ci-apres denomme le client",
        intermediaryConnector: "et",
        companyLabel: "Societe",
        intermediaryCaption: "ci-apres denomme l'intermediaire",
        introLabel: "sont convenus de ce qui suit :",
        signatureClient: "signature du client",
        signatureIntermediary: "signature de l'intermediaire",
      };
    default:
      return {
        heading: "BROKER'S AGREEMENT",
        referenceLabel: "Reference number",
        nameLabel: "Name",
        addressLabel: "Address",
        postalCityLabel: "Postal code / city",
        phoneLabel: "Phonenumber",
        emailLabel: "E-mail",
        passportLabel: "Passport number",
        marriedLabel: "Married",
        clientCaption: "Hereafter named client",
        intermediaryConnector: "and",
        companyLabel: "Company",
        intermediaryCaption: "Hereafter named intermediary",
        introLabel: "have agreed:",
        signatureClient: "signature client",
        signatureIntermediary: "signature intermediary",
      };
  }
}

function getAgreementClauses(draft: ContractDraft) {
  const yesNoRegister = `${boolLabel(draft.language, draft.shipRegisterEntry)}${draft.shipRegisterPlace ? ` ${draft.language === "en" ? "in" : draft.language === "de" ? "in" : draft.language === "fr" ? "a" : "te"} ${draft.shipRegisterPlace}` : ""}`;
  const yesNoMortgage = `${boolLabel(draft.language, draft.hasMortgage)}${draft.mortgageInFavorOf ? `${draft.language === "en" ? ", in favor of " : draft.language === "de" ? ", zugunsten von " : draft.language === "fr" ? ", au profit de " : ", ten gunste van "}${draft.mortgageInFavorOf}` : ""}`;

  switch (draft.language) {
    case "nl":
      return [
        `1. dat de cliënt de bemiddelaar de exclusieve opdracht geeft om het vaartuig dat zijn eigendom is te verkopen met de volgende specificatie:<br />Naam: ${draft.vesselName || "………"}<br />Merk / type vaartuig: ${draft.vesselBrandType || "………"}<br />Bouwjaar, circa: ${draft.buildYear || "………"}<br />Afmetingen, circa: ${draft.dimensions || "………"}<br />Bouwmateriaal: ${draft.buildingMaterial || "………"}<br />Bouwer: ${draft.builder || "………"}<br />Rompnummer / CIN nummer: ${draft.hullNumber || "………"}<br />Motor: ${draft.engine || "………"}<br />Motornummer: ${draft.engineNumber || "………"}<br />Registratienummer: ${draft.registrationNumber || "………"}<br />Inschrijving scheepsregister: ${yesNoRegister}<br />Scheepshypotheek: ${yesNoMortgage}<br />BTW-verklaring: ${boolLabel(draft.language, draft.vatDeclaration)}<br />welke opdracht de bemiddelaar aanvaardt door ondertekening van deze overeenkomst.`,
        `2. dat de bemiddelaar dit vaartuig te koop zal aanbieden voor de vraagprijs van EUR ${draft.askingPrice || "………"}${draft.askingPriceWords ? ` (${draft.askingPriceWords})` : ""}.`,
        "3. dat aan de cliënt courtage in rekening wordt gebracht over de laatst schriftelijk vastgelegde verkoopprijs zodra overeenstemming over koop/verkoop is bereikt, ongeacht of die prijs in geld, natura of diensten wordt voldaan.",
        "4. dat de courtage bedraagt:<br />- 8% voor vaartuigen met een koop/verkoopprijs tot en met EUR 100.000 met een minimum van EUR 2.500<br />- 6% voor vaartuigen met een koop/verkoopprijs boven EUR 100.000 met een minimum van EUR 8.000<br />De verschuldigde courtage wordt verhoogd met de wettelijk verschuldigde btw.",
        "5. dat de bemiddelaar de opbrengst voor de cliënt ontvangt via derdengelden.",
        "6. dat het vaartuig van de cliënt gedurende de looptijd van de overeenkomst wordt gestald in de verkoophaven van de bemiddelaar. De stallingssom bedraagt EUR ……… (inclusief btw) per maand of gedeelte daarvan en dient maandelijks vooruit door de cliënt te worden voldaan.<br />De bovenstaande liggelden:<br />- zijn verschuldigd bij beëindiging van de bemiddelingsovereenkomst door rechtsgeldige opzegging.<br />- zijn verschuldigd bij verwijdering van het object uit het verkoopgebied van de bemiddelaar zonder beëindiging van de opdracht.<br />- worden maandelijks berekend indien de boot niet binnen 6 maanden wordt verkocht.<br />Bij verkoop via de jachtmakelaar worden over de eerste 6 maanden geen liggelden berekend.",
        "7. dat de cliënt de bemiddelaar machtigt om proef te varen wanneer hij niet aanwezig is (en zonder zijn voorafgaande toestemming).",
        "8. dat het vaartuig voor rekening en risico van de cliënt blijft, ook tijdens een proefvaart, totdat de eigendomsoverdracht aan de koper is voltooid en de cliënt tot dat moment voor passende verzekering zorgt.",
        "9. dat de cliënt verantwoordelijk is voor de juistheid van zijn beschrijving en de door hem verstrekte gegevens met betrekking tot het vaartuig en dat hij de bemiddelaar vrijwaart voor aanspraken van derden.",
        "10. dat deze overeenkomst voor onbepaalde tijd wordt aangegaan. De cliënt kan de overeenkomst te allen tijde beëindigen tegen betaling aan de bemiddelaar van een vergoeding zoals vastgesteld in artikel 13 van deze algemene voorwaarden. De bemiddelaar kan de overeenkomst te allen tijde om dringende redenen beëindigen.",
        "11. dat op deze overeenkomst de HISWA bemiddelingsvoorwaarden voor vaartuigen van toepassing zijn, waarvan de cliënt door ondertekening kennis heeft genomen.",
      ];
    case "de":
      return [
        `1. dass der Kunde dem Vermittler den exklusiven Auftrag erteilt, das in seinem Eigentum stehende Wasserfahrzeug mit folgender Spezifikation zu verkaufen:<br />Name: ${draft.vesselName || "………"}<br />Marke / Typ Wasserfahrzeug: ${draft.vesselBrandType || "………"}<br />Baujahr, circa: ${draft.buildYear || "………"}<br />Abmessungen, circa: ${draft.dimensions || "………"}<br />Baumaterial: ${draft.buildingMaterial || "………"}<br />Werft / Hersteller: ${draft.builder || "………"}<br />Rumpfnummer / CIN-Nummer: ${draft.hullNumber || "………"}<br />Motor: ${draft.engine || "………"}<br />Motornummer: ${draft.engineNumber || "………"}<br />Registriernummer: ${draft.registrationNumber || "………"}<br />Eintrag im Schiffsregister: ${yesNoRegister}<br />Schiffshypothek: ${yesNoMortgage}<br />MwSt.-Erklärung: ${boolLabel(draft.language, draft.vatDeclaration)}<br />welchen Auftrag der Vermittler durch Unterzeichnung dieses Vertrags annimmt.`,
        `2. dass der Vermittler dieses Wasserfahrzeug zum Angebotspreis von EUR ${draft.askingPrice || "………"}${draft.askingPriceWords ? ` (${draft.askingPriceWords})` : ""} zum Verkauf anbietet.`,
        "3. dass vom Kunden eine Maklerprovision auf den zuletzt schriftlich festgelegten Verkaufspreis geschuldet wird, sobald Einigkeit über Kauf/Verkauf erzielt wurde, unabhängig davon, ob dieser Preis in Geld, in Natur oder in Leistungen erfüllt wird.",
        "4. dass die Maklerprovision beträgt:<br />- 8% für Wasserfahrzeuge mit einem Kauf-/Verkaufspreis bis EUR 100.000 mit einem Minimum von EUR 2.500<br />- 6% für Wasserfahrzeuge mit einem Kauf-/Verkaufspreis über EUR 100.000 mit einem Minimum von EUR 8.000<br />Die geschuldete Provision erhöht sich um die gesetzlich geschuldete Mehrwertsteuer.",
        "5. dass der Vermittler den Erlös für den Kunden über ein Treuhandkonto entgegennimmt.",
        "6. dass das Wasserfahrzeug des Kunden für die Dauer des Vertrags im Verkaufshafen des Vermittlers liegt. Die Liegegebühr beträgt EUR ……… (inklusive Mehrwertsteuer) pro Monat oder Teil eines Monats und ist vom Kunden monatlich im Voraus zu zahlen.<br />Die oben genannten Liegegebühren:<br />- sind bei Beendigung des Maklervertrags durch wirksame Kündigung fällig.<br />- sind fällig bei Entfernung des Objekts aus dem Verkaufsbereich des Maklers ohne Beendigung des Auftrags.<br />- werden monatlich berechnet, wenn das Boot nicht innerhalb von 6 Monaten verkauft wird.<br />Bei Verkauf über den Yachtmakler werden in den ersten 6 Monaten keine Liegegebühren berechnet.",
        "7. dass der Kunde den Vermittler ermächtigt, eine Probefahrt vorzunehmen, wenn er nicht anwesend ist (und ohne seine vorherige Zustimmung).",
        "8. dass das Wasserfahrzeug auf Rechnung und Gefahr des Kunden bleibt, auch während einer Probefahrt, bis das Eigentum auf den Käufer übertragen ist und der Kunde bis dahin eine angemessene Versicherung unterhält.",
        "9. dass der Kunde für die Richtigkeit seiner Beschreibung und der von ihm bereitgestellten Daten zum Wasserfahrzeug verantwortlich ist und den Vermittler von Ansprüchen Dritter freistellt.",
        "10. dass dieser Vertrag auf unbestimmte Zeit geschlossen wird. Der Kunde kann den Vertrag jederzeit gegen Zahlung einer Vergütung an den Vermittler kündigen, wie in Artikel 13 dieser allgemeinen Bedingungen festgelegt. Der Vermittler kann den Vertrag jederzeit aus zwingenden Gründen kündigen.",
        "11. dass für diesen Vertrag die HISWA-Bedingungen für Maklerverträge von Wasserfahrzeugen gelten, von denen der Kunde durch Unterzeichnung Kenntnis genommen hat.",
      ];
    case "fr":
      return [
        `1. que le client confie a l'intermediaire la mission exclusive de vendre le bateau lui appartenant avec les caracteristiques suivantes :<br />Nom : ${draft.vesselName || "………"}<br />Marque / type de bateau : ${draft.vesselBrandType || "………"}<br />Annee de construction, environ : ${draft.buildYear || "………"}<br />Dimensions, environ : ${draft.dimensions || "………"}<br />Materiau de construction : ${draft.buildingMaterial || "………"}<br />Constructeur : ${draft.builder || "………"}<br />Numero de coque / numero CIN : ${draft.hullNumber || "………"}<br />Moteur : ${draft.engine || "………"}<br />Numero du moteur : ${draft.engineNumber || "………"}<br />Numero d'immatriculation : ${draft.registrationNumber || "………"}<br />Inscription au registre naval : ${yesNoRegister}<br />Hypotheque maritime : ${yesNoMortgage}<br />Declaration TVA : ${boolLabel(draft.language, draft.vatDeclaration)}<br />mission acceptee par l'intermediaire lors de la signature du present contrat.`,
        `2. que l'intermediaire proposera ce bateau a la vente au prix demande de EUR ${draft.askingPrice || "………"}${draft.askingPriceWords ? ` (${draft.askingPriceWords})` : ""}.`,
        "3. qu'une commission de courtage est due par le client sur le dernier prix de vente etabli par ecrit des qu'un accord sur l'achat/la vente est atteint, que ce prix soit regle en especes, en nature ou en services.",
        "4. que la commission de courtage est de :<br />- 8% pour les bateaux ayant un prix d'achat/vente jusqu'a EUR 100.000 avec un minimum de EUR 2.500<br />- 6% pour les bateaux ayant un prix d'achat/vente superieur a EUR 100.000 avec un minimum de EUR 8.000<br />La commission due est augmentee de la TVA legalement applicable.",
        "5. que l'intermediaire recevra les fonds pour le client par l'intermediaire d'un compte de tiers.",
        "6. que le bateau du client sera stationne pendant la duree du contrat dans le port de vente de l'intermediaire. Les frais de stationnement sont de EUR ……… (TVA comprise) par mois ou partie de mois et doivent etre payes d'avance chaque mois par le client.<br />Les frais de stationnement ci-dessus :<br />- sont exigibles lors de la resiliation valable du contrat de courtage.<br />- sont exigibles lors du retrait de l'objet de la zone de vente du courtier sans resiliation de la mission.<br />- sont factures mensuellement si le bateau n'est pas vendu dans les 6 mois.<br />En cas de vente par le courtier en yachts, aucun frais d'emplacement n'est facture pendant les 6 premiers mois.",
        "7. que le client autorise l'intermediaire a effectuer un essai en navigation lorsqu'il n'est pas present (et sans son autorisation prealable).",
        "8. que le bateau reste aux frais et risques du client, meme pendant l'essai, jusqu'au transfert de propriete a l'acheteur et que le client souscrit une assurance adequate jusqu'a ce moment.",
        "9. que le client est responsable de l'exactitude de sa description et des donnees fournies concernant le bateau et qu'il garantit l'intermediaire contre toute reclamation de tiers.",
        "10. que le present contrat est conclu pour une duree indeterminee. Le client peut y mettre fin a tout moment moyennant paiement a l'intermediaire d'une indemnite telle que prevue a l'article 13 des presentes conditions generales. L'intermediaire peut y mettre fin a tout moment pour motifs imperieux.",
        "11. que les conditions generales HISWA relatives au contrat de courtage pour bateaux s'appliquent au present contrat et que le client en a pris connaissance en signant.",
      ];
    default:
      return [
        `1. that the client grants the intermediary the exclusive assignment to sell the vessel in his property with the following specification:<br />Name: ${draft.vesselName || "………"}<br />Brand / type vessel: ${draft.vesselBrandType || "………"}<br />Building year, circa: ${draft.buildYear || "………"}<br />Dimensions, circa: ${draft.dimensions || "………"}<br />Building material: ${draft.buildingMaterial || "………"}<br />Builder: ${draft.builder || "………"}<br />Hullnumber / CIN Number: ${draft.hullNumber || "………"}<br />Engine: ${draft.engine || "………"}<br />Engine number: ${draft.engineNumber || "………"}<br />Registration number: ${draft.registrationNumber || "………"}<br />Entry ship register: ${yesNoRegister}<br />Ship mortgage: ${yesNoMortgage}<br />VAT declaration: ${boolLabel(draft.language, draft.vatDeclaration)}<br />whichever assignment the intermediary accepts by signing this agreement.`,
        `2. that the intermediary will put this vessel up for sale for the asking price of EUR ${draft.askingPrice || "………"}${draft.askingPriceWords ? ` (${draft.askingPriceWords} euro)` : ""}.`,
        "3. that a broker's commission is payable by the client for the last sales price established in writing as soon as the consensus ad idem has been reached about the purchase/sale, regardless of the fact whether this sales price is settled in cash, in kind or in services.",
        "4. that the broker's commission is:<br />- 8% for vessels with a purchase/sales price up to EUR 100,000 with a minimum of EUR 2,500<br />- 6% for vessels with a purchase/sales price above EUR 100,000 with a minimum of EUR 8,000<br />The payable broker's commission is increased by the legally payable VAT.",
        "5. that the intermediary will receive proceeds for the client by means of Third party funds.",
        "6. that the vessel of the client will be stored for the term of the agreement in the sales harbor of the intermediary. The storage sum is EUR ……… (including VAT) per month or part of the month, this sum has to be paid in advance by the client every month.<br />The above mooring fees:<br />- are payable upon termination of the brokerage agreement by valid notice.<br />- are payable upon removal of the object from the broker's sales area without termination of the commission.<br />- are charged monthly if the boat is not sold within 6 months.<br />In case of sale through the yacht broker, no berth fees will be charged for the first 6 months.",
        "7. that the client authorizes the intermediary to make a trial run when he is not present (and without his prior permission).",
        "8. that the vessel remains at the account and risk of the client, even during the trial run, until the time that the transfer of property to the buyer is completed and the client takes up adequate insurance until the transfer of the property.",
        "9. that the client is responsible for the correctness of his description and the data provided by him with regard to the vessel and that he/she indemnifies the intermediary from claims by third parties.",
        "10. that this contract is concluded for an indefinite period. The client may terminate the contract at any time on payment to the intermediary of a fee as established in Article 13 of these general terms and conditions. The intermediary may terminate the contract at any time for compelling reasons.",
        "11. that the General Conditions Broker's agreement vessels of HISWA apply to this agreement, with which the client has become acquainted by signing.",
      ];
  }
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
        companyName:
          locationCompanyDefaults[matcher].companyName || location?.name || "",
        companyAddress: locationCompanyDefaults[matcher].companyAddress || "",
        companyPostalCode:
          locationCompanyDefaults[matcher].companyPostalCode || "",
        companyCity: locationCompanyDefaults[matcher].companyCity || cityGuess,
        companyPhone: locationCompanyDefaults[matcher].companyPhone || "",
        companyEmail: locationCompanyDefaults[matcher].companyEmail || "",
        agreementCity:
          locationCompanyDefaults[matcher].companyCity || cityGuess,
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

function getSpecificationRows(draft: ContractDraft) {
  const registerValue = boolLabel(draft.language, draft.shipRegisterEntry);
  const mortgageValue = boolLabel(draft.language, draft.hasMortgage);
  const vatValue = boolLabel(draft.language, draft.vatDeclaration);

  switch (draft.language) {
    case "nl":
      return [
        { label: "Naam", value: draft.vesselName },
        { label: "Merk / type vaartuig", value: draft.vesselBrandType },
        { label: "Bouwjaar, circa", value: draft.buildYear },
        { label: "Afmetingen, circa", value: draft.dimensions },
        { label: "Bouwmateriaal", value: draft.buildingMaterial },
        { label: "Bouwer", value: draft.builder },
        { label: "Rompnummer / CIN nummer", value: draft.hullNumber },
        { label: "Motor", value: draft.engine },
        { label: "Motornummer", value: draft.engineNumber },
        { label: "Registratienummer", value: draft.registrationNumber },
        {
          label: "Inschrijving scheepsregister",
          value: `${registerValue}${draft.shipRegisterPlace ? `, te ${draft.shipRegisterPlace}` : ""}`,
        },
        {
          label: "Scheepshypotheek",
          value: `${mortgageValue}${draft.mortgageInFavorOf ? `, ten gunste van ${draft.mortgageInFavorOf}` : ""}`,
        },
        { label: "BTW-verklaring", value: vatValue },
      ];
    case "de":
      return [
        { label: "Name", value: draft.vesselName },
        { label: "Marke / Typ Wasserfahrzeug", value: draft.vesselBrandType },
        { label: "Baujahr, circa", value: draft.buildYear },
        { label: "Abmessungen, circa", value: draft.dimensions },
        { label: "Baumaterial", value: draft.buildingMaterial },
        { label: "Werft / Hersteller", value: draft.builder },
        { label: "Rumpfnummer / CIN-Nummer", value: draft.hullNumber },
        { label: "Motor", value: draft.engine },
        { label: "Motornummer", value: draft.engineNumber },
        { label: "Registriernummer", value: draft.registrationNumber },
        {
          label: "Eintrag im Schiffsregister",
          value: `${registerValue}${draft.shipRegisterPlace ? `, in ${draft.shipRegisterPlace}` : ""}`,
        },
        {
          label: "Schiffshypothek",
          value: `${mortgageValue}${draft.mortgageInFavorOf ? `, zugunsten von ${draft.mortgageInFavorOf}` : ""}`,
        },
        { label: "MwSt.-Erklärung", value: vatValue },
      ];
    case "fr":
      return [
        { label: "Nom", value: draft.vesselName },
        { label: "Marque / type de bateau", value: draft.vesselBrandType },
        { label: "Annee de construction, environ", value: draft.buildYear },
        { label: "Dimensions, environ", value: draft.dimensions },
        { label: "Materiau de construction", value: draft.buildingMaterial },
        { label: "Constructeur", value: draft.builder },
        { label: "Numero de coque / numero CIN", value: draft.hullNumber },
        { label: "Moteur", value: draft.engine },
        { label: "Numero du moteur", value: draft.engineNumber },
        { label: "Numero d'immatriculation", value: draft.registrationNumber },
        {
          label: "Inscription au registre naval",
          value: `${registerValue}${draft.shipRegisterPlace ? `, a ${draft.shipRegisterPlace}` : ""}`,
        },
        {
          label: "Hypotheque maritime",
          value: `${mortgageValue}${draft.mortgageInFavorOf ? `, au profit de ${draft.mortgageInFavorOf}` : ""}`,
        },
        { label: "Declaration TVA", value: vatValue },
      ];
    default:
      return [
        { label: "Name", value: draft.vesselName },
        { label: "Brand / type vessel", value: draft.vesselBrandType },
        { label: "Building year, circa", value: draft.buildYear },
        { label: "Dimensions, circa", value: draft.dimensions },
        { label: "Building material", value: draft.buildingMaterial },
        { label: "Builder", value: draft.builder },
        { label: "Hullnumber / CIN Number", value: draft.hullNumber },
        { label: "Engine", value: draft.engine },
        { label: "Engine number", value: draft.engineNumber },
        { label: "Registration number", value: draft.registrationNumber },
        {
          label: "Entry ship register",
          value: `${registerValue}${draft.shipRegisterPlace ? `, in ${draft.shipRegisterPlace}` : ""}`,
        },
        {
          label: "Ship mortgage",
          value: `${mortgageValue}${draft.mortgageInFavorOf ? `, in favor of ${draft.mortgageInFavorOf}` : ""}`,
        },
        { label: "VAT declaration", value: vatValue },
      ];
  }
}

function getClauseOneIntro(language: ContractLanguage) {
  switch (language) {
    case "nl":
      return "1. dat de cliënt de bemiddelaar de exclusieve opdracht geeft om het vaartuig dat zijn eigendom is te verkopen met de volgende specificatie:";
    case "de":
      return "1. dass der Kunde dem Vermittler den exklusiven Auftrag erteilt, das in seinem Eigentum stehende Wasserfahrzeug mit folgender Spezifikation zu verkaufen:";
    case "fr":
      return "1. que le client confie a l'intermediaire la mission exclusive de vendre le bateau lui appartenant avec les caracteristiques suivantes :";
    default:
      return "1. that the client grants the intermediary the exclusive assignment to sell the vessel in his property with the following specification:";
  }
}

function getClauseOneClosing(language: ContractLanguage) {
  switch (language) {
    case "nl":
      return "welke opdracht de bemiddelaar aanvaardt door ondertekening van deze overeenkomst.";
    case "de":
      return "welchen Auftrag der Vermittler durch Unterzeichnung dieses Vertrags annimmt.";
    case "fr":
      return "mission acceptee par l'intermediaire lors de la signature du present contrat.";
    default:
      return "whichever assignment the intermediary accepts by signing this agreement.";
  }
}

function renderClauseText(clause: string) {
  return clause.split("<br />").map((part, index) => (
    <Fragment key={`${index}-${part}`}>
      {index > 0 ? <br /> : null}
      {part}
    </Fragment>
  ));
}

function cleanupPdfGenerationArtifacts() {
  document.querySelectorAll("iframe").forEach((node) => {
    const frame = node as HTMLIFrameElement;
    if (
      frame.style.pointerEvents === "none" &&
      frame.style.opacity === "0" &&
      frame.style.position === "fixed"
    ) {
      frame.remove();
    }
  });

  document
    .querySelectorAll(".html2pdf__container, .html2pdf__overlay")
    .forEach((node) => node.remove());

  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
}

async function fetchAssetDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${url}`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read asset: ${url}`));
    reader.readAsDataURL(blob);
  });
}

function buildContractDraft(
  yachtName: string,
  yachtData: YachtContractData | null | undefined,
  location: LocationOption | null | undefined,
  language: ContractLanguage,
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
    language,
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

function SectionHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#003566]"
          aria-label={`Edit ${title}`}
        >
          <PencilLine size={14} />
        </button>
      ) : null}
    </div>
  );
}

function addWrappedParagraph(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addLabelValueRows(
  pdf: jsPDF,
  rows: Array<{ label: string; value: string }>,
  startY: number,
  pageWidth: number,
) {
  let y = startY;
  const labelX = pageWidth / 2 - 8;
  const valueX = pageWidth / 2 + 4;
  pdf.setFont("times", "bold");
  rows.forEach((row) => {
    pdf.text(`${row.label}:`, labelX, y, { align: "right" });
    pdf.setFont("times", "normal");
    const valueLines = pdf.splitTextToSize(row.value || "………", 70);
    pdf.text(valueLines, valueX, y);
    y += Math.max(5.5, valueLines.length * 5);
    pdf.setFont("times", "bold");
  });
  pdf.setFont("times", "normal");
  return y;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
      {children}
    </label>
  );
}

function ContractMetaTable({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-[38rem]">
      <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)] gap-x-6 gap-y-1 font-serif text-[15px] leading-6 text-slate-900 dark:text-slate-100">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <p className="text-right font-semibold">{row.label}:</p>
            <p>{row.value}</p>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function SignhostFlow({
  yachtId,
  yachtName,
  locationId,
  yachtData,
  locationOptions = [],
}: SignhostFlowProps) {
  const locale = useLocale();
  const { user } = useClientSession();
  const localeContractLanguage = resolveContractLanguage(locale);
  const params = useParams<{ role?: string }>();
  const role = params?.role?.toLowerCase();
  const canManageContract = role !== "client";
  const selectedLocation = useMemo(
    () => locationOptions.find((option) => option.id === locationId) || null,
    [locationId, locationOptions],
  );
  const storageKey = `contract_draft_${yachtId ?? "draft"}`;

  const [signRequest, setSignRequest] = useState<SignRequest | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(() =>
    buildContractDraft(
      yachtName,
      yachtData,
      selectedLocation,
      localeContractLanguage,
    ),
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSection, setEditorSection] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contractTemplateKey, setContractTemplateKey] =
    useState<ContractTemplateKey>("sale_agreement");

  useEffect(() => {
    const nextDraft = buildContractDraft(
      yachtName,
      yachtData,
      selectedLocation,
      localeContractLanguage,
    );

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setDraft(nextDraft);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ContractDraft>;
      setDraft({
        ...nextDraft,
        ...parsed,
        language: localeContractLanguage,
      });
    } catch {
      setDraft(nextDraft);
    }
  }, [
    localeContractLanguage,
    selectedLocation,
    storageKey,
    yachtData,
    yachtName,
  ]);

  useEffect(() => {
    setDraft((prev) =>
      prev.language === localeContractLanguage
        ? prev
        : { ...prev, language: localeContractLanguage },
    );
  }, [localeContractLanguage]);

  useEffect(() => {
    const trimmedName = user.name?.trim() || "";
    const trimmedEmail = user.email?.trim() || "";
    const trimmedPhone = user.phone?.trim() || "";

    setDraft((prev) => {
      const updates: Partial<ContractDraft> = {};

      if (user.role === "client") {
        if (!prev.clientName && trimmedName) updates.clientName = trimmedName;
        if (!prev.clientEmail && trimmedEmail)
          updates.clientEmail = trimmedEmail;
        if (!prev.clientPhone && trimmedPhone)
          updates.clientPhone = trimmedPhone;
      } else {
        if (!prev.companyEmail && trimmedEmail)
          updates.companyEmail = trimmedEmail;
        if (!prev.companyPhone && trimmedPhone)
          updates.companyPhone = trimmedPhone;
      }

      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [user.email, user.name, user.phone, user.role]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Ignore persistence errors.
    }
  }, [draft, storageKey]);

  useEffect(() => {
    if (!yachtId) return;

    let active = true;
    void signhostApi
      .getYachtStatus(yachtId)
      .then((res) => {
        if (!active || !res.transaction) return;
        setSignRequest(mapTransactionToSignRequest(res.transaction));
      })
      .catch(() => {
        // Silent when no existing Signhost transaction is present yet.
      });

    return () => {
      active = false;
    };
  }, [yachtId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (yachtId && signRequest?.status === "SENT") {
      interval = setInterval(async () => {
        try {
          const res = await signhostApi.getYachtStatus(yachtId);
          if (!res.transaction) return;
          const nextRequest = mapTransactionToSignRequest(res.transaction);
          if (nextRequest.status !== signRequest.status) {
            setSignRequest(nextRequest);
            if (nextRequest.status === "SIGNED") {
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
  }, [signRequest, yachtId]);

  const previewCopy = copyByLanguage[draft.language];
  const agreementCopy = getAgreementCopy(draft.language);
  const editorCopy = editorCopyByLanguage[draft.language];
  const selectedTemplate =
    contractTemplateOptions.find(
      (option) => option.value === contractTemplateKey,
    ) ?? contractTemplateOptions[0];
  const editorSectionTitle =
    editorSection === "seller"
      ? editorCopy.sellerSection
      : editorSection === "buyer"
        ? editorCopy.buyerSection
        : editorSection === "vessel"
          ? editorCopy.vesselSection
          : editorSection === "declarations"
            ? editorCopy.declarationsSection
            : editorSection === "closing"
              ? previewCopy.closingLabel
              : null;

  const handleFieldChange = <K extends keyof ContractDraft>(
    key: K,
    value: ContractDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const resolvedRecipients = [
    {
      role: "buyer" as const,
      name: draft.clientName.trim(),
      email: draft.clientEmail.trim(),
    },
    {
      role: "seller" as const,
      name: draft.companyName.trim(),
      email: draft.companyEmail.trim(),
    },
  ].filter((recipient) => recipient.name && recipient.email);

  const openEditor = (section?: string) => {
    setEditorSection(section ?? null);
    setEditorOpen(true);
  };

  const generatePdfFile = async () => {
    if (contractTemplateKey === "escrow_form") {
      throw new Error("Escrow PDF upload is not supported yet.");
    }

    const pdfCopy = copyByLanguage[draft.language];
    const [schepenkringLogo, nauticLogo] = await Promise.all([
      fetchAssetDataUrl("/schepenkring-logo.png"),
      fetchAssetDataUrl("/nautic.jpg"),
    ]);

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 14;
    const bottomLimit = pageHeight - 18;
    const clauses = getAgreementClauses(draft);

    const addLetterhead = () => {
      pdf.addImage(schepenkringLogo, "PNG", 28, 20, 66, 31);
      pdf.addImage(nauticLogo, "JPEG", 142, 18, 27, 40);
      pdf.setDrawColor(201, 36, 36);
      pdf.line(36, 55, 96, 55);
      pdf.line(171, 55, 182, 55);
    };

    const ensureSpace = (currentY: number, required: number) => {
      if (currentY + required <= bottomLimit) return currentY;
      pdf.addPage();
      pdf.setFont("times", "normal");
      pdf.setFontSize(12);
      return 20;
    };

    addLetterhead();
    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.text(agreementCopy.heading, marginX + 12, 66);

    pdf.setFontSize(12);
    pdf.text(
      `${agreementCopy.referenceLabel}: ${`SK-${draft.language.toUpperCase()}-${draft.vesselName?.slice(0, 3).toUpperCase() || "DOC"}-${draft.agreementDate || "0000-00-00"}`}`,
      marginX + 12,
      75,
    );

    let y = 86;
    y = addLabelValueRows(
      pdf,
      [
        { label: agreementCopy.nameLabel, value: draft.clientName || "………" },
        {
          label: agreementCopy.addressLabel,
          value: draft.clientAddress || "………",
        },
        {
          label: agreementCopy.postalCityLabel,
          value:
            [draft.clientPostalCode, draft.clientCity]
              .filter(Boolean)
              .join(" ") || "………",
        },
        { label: agreementCopy.phoneLabel, value: draft.clientPhone || "………" },
        { label: agreementCopy.emailLabel, value: draft.clientEmail || "………" },
        {
          label: agreementCopy.passportLabel,
          value: draft.passportNumber || "………",
        },
        {
          label: agreementCopy.marriedLabel,
          value: boolLabel(draft.language, draft.married),
        },
      ],
      y,
      pageWidth,
    );

    y += 4;
    pdf.setFont("times", "bold");
    pdf.text(agreementCopy.clientCaption, pageWidth / 2, y, {
      align: "center",
    });
    y += 8;
    pdf.setFont("times", "normal");
    pdf.text(agreementCopy.intermediaryConnector, marginX, y);
    y += 8;

    y = addLabelValueRows(
      pdf,
      [
        {
          label: agreementCopy.companyLabel,
          value: draft.companyName || "………",
        },
        {
          label: agreementCopy.addressLabel,
          value: draft.companyAddress || "………",
        },
        {
          label: agreementCopy.postalCityLabel,
          value:
            [draft.companyPostalCode, draft.companyCity]
              .filter(Boolean)
              .join(" ") || "………",
        },
        { label: agreementCopy.phoneLabel, value: draft.companyPhone || "………" },
        { label: agreementCopy.emailLabel, value: draft.companyEmail || "………" },
      ],
      y,
      pageWidth,
    );

    y += 4;
    pdf.setFont("times", "bold");
    pdf.text(agreementCopy.intermediaryCaption, pageWidth / 2, y, {
      align: "center",
    });
    y += 12;
    pdf.text(agreementCopy.introLabel, marginX, y);
    y += 8;

    pdf.setFont("times", "normal");
    y = addWrappedParagraph(
      pdf,
      getClauseOneIntro(draft.language),
      marginX,
      y,
      180,
      5.2,
    );
    y += 2;
    y = addLabelValueRows(
      pdf,
      getSpecificationRows(draft).map((row) => ({
        label: row.label,
        value: row.value || "………",
      })),
      y,
      pageWidth,
    );
    y += 2;
    y = addWrappedParagraph(
      pdf,
      getClauseOneClosing(draft.language),
      marginX,
      y,
      180,
      5.2,
    );
    y += 4;

    clauses.slice(1).forEach((clause) => {
      const plain = clause.replaceAll("<br />", "\n");
      const estimatedHeight = pdf.splitTextToSize(plain, 180).length * 5.2 + 4;
      y = ensureSpace(y, estimatedHeight);
      y = addWrappedParagraph(pdf, plain, marginX, y, 180, 5.2);
      y += 2;
    });

    y = ensureSpace(y, 24);
    y += 4;
    pdf.text(
      pdfCopy.closingText(
        formatAgreementDate(draft.language, draft.agreementDate),
        draft.agreementCity || draft.companyCity,
      ),
      marginX,
      y,
    );
    y += 16;
    pdf.setFont("times", "bold");
    pdf.text(agreementCopy.signatureClient, marginX, y);
    pdf.text(agreementCopy.signatureIntermediary, marginX + 95, y);

    const blob = pdf.output("blob");
    return new File(
      [blob],
      `${draft.vesselName || yachtName || "contract"}.pdf`,
      {
        type: "application/pdf",
      },
    );
  };

  const handleDownloadGeneratedPdf = async () => {
    if (!yachtId) {
      toast.error("Save the vessel first before downloading the contract PDF.");
      return;
    }

    setIsGenerating(true);
    try {
      const [pdfFile, agreementFile] = await Promise.all([
        generatePdfFile(),
        fetchAgreementPdfFile(draft.language),
      ]);
      triggerFileDownload(pdfFile);
      triggerFileDownload(agreementFile);
      toast.success("Contract documents downloaded.");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to download contract documents.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!yachtId) {
      toast.error("Save the vessel first before generating the contract PDF.");
      return;
    }

    if (!locationId) {
      toast.error("Select a sales location before generating the contract.");
      return;
    }

    setIsGenerating(true);
    try {
      const shouldSendToSignhost = resolvedRecipients.length > 0;
      const contractRenderUrl =
        contractTemplateKey === "escrow_form"
          ? buildEscrowContractUrl(
              window.location.origin,
              locale,
              draft.language,
              draft,
            )
          : undefined;

      const res = await signhostApi.generateYachtContract(yachtId, {
        location_id: locationId,
        title: `${
          contractTemplateKey === "escrow_form"
            ? "Escrow account service form"
            : previewCopy.title
        } - ${draft.vesselName || yachtName}`,
        send_to_signhost: shouldSendToSignhost,
        recipients: shouldSendToSignhost ? resolvedRecipients : undefined,
        reference: `vessel-${yachtId}-contract`,
        idempotencyKey: `contract_${yachtId}_${Date.now()}`,
        metadata: {
          boat_name: draft.vesselName || yachtName,
          contract_language: draft.language,
          agreement_document_language: resolveAgreementPdfLanguage(
            draft.language,
          ),
          agreement_document_path: getAgreementPdfPath(draft.language),
          agreement_document_included: true,
          contract_template_key: contractTemplateKey,
          contract_template: contractTemplateKey,
          contract_template_payload: draft,
          contract_render_url: contractRenderUrl,
          contract_render_language:
            contractTemplateKey === "escrow_form"
              ? resolveEscrowFormLanguage(draft.language)
              : draft.language,
          location_snapshot: selectedLocation,
        },
      });
      const nextSignRequest = res.sign_request
        ? res.sign_request
        : res.transaction
          ? mapTransactionToSignRequest(res.transaction)
          : null;
      const signUrl =
        res.sign_url ||
        res.sign_request?.sign_url ||
        res.transaction?.signing_url_seller ||
        res.transaction?.signing_url_buyer ||
        null;

      if (nextSignRequest) {
        setSignRequest(nextSignRequest);
      }
      if (shouldSendToSignhost && signUrl) {
        window.open(signUrl, "_blank", "noopener,noreferrer");
        toast.success("Contract generated and sent to Signhost.");
      } else if (shouldSendToSignhost) {
        toast.success("Contract generated. Signhost request created.");
      } else {
        toast.success(
          "Contract PDF generated. Add recipient e-mail(s) to send to Signhost.",
        );
      }
    } catch (error: unknown) {
      cleanupPdfGenerationArtifacts();
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : error instanceof Error
            ? error.message
            : "Failed to generate contract PDF.";
      toast.error(message);
    } finally {
      cleanupPdfGenerationArtifacts();
      setIsGenerating(false);
    }
  };

  const statusDisplay = useMemo(() => {
    const status = signRequest?.status?.toUpperCase() || "DRAFT";
    switch (status) {
      case "SIGNED":
        return {
          label: editorCopy.statusSigned,
          icon: FileCheck,
          tone: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
        };
      case "SENT":
        return {
          label: editorCopy.statusSent,
          icon: Send,
          tone: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
        };
      case "FAILED":
        return {
          label: editorCopy.statusCancelled,
          icon: XCircle,
          tone: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900",
        };
      default:
        return {
          label: editorCopy.statusDraft,
          icon: FileText,
          tone: "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700",
        };
    }
  }, [editorCopy, signRequest?.status]);

  if (!canManageContract) {
    return null;
  }

  return (
    <div className="overflow-hidden">
      <div className="">
        <div className="mb-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <FilePenLine
              size={18}
              className="text-[#003566] dark:text-sky-300"
            />
            {editorCopy.pageTitle}
          </h4>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {editorCopy.pageSubtitle}
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
            value={contractTemplateKey}
            onChange={(event) =>
              setContractTemplateKey(event.target.value as ContractTemplateKey)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {contractTemplateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleGenerateContract}
            disabled={isGenerating || !locationId || !yachtId}
            className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d] disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {contractTemplateKey === "escrow_form"
              ? editorCopy.sendEscrowToSignhost
              : editorCopy.sendToSignhost}
          </Button>
          <Button
            type="button"
            onClick={() => openEditor()}
            className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            {editorCopy.editContract}
          </Button>
          <Button
            type="button"
            onClick={handleDownloadGeneratedPdf}
            disabled={isGenerating || !yachtId}
            className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <FileText className="mr-2 h-4 w-4" />
            {editorCopy.downloadPdf}
          </Button>
        </div>
      </div>

      <div className="">
        <div className="">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-sky-300">
              {contractTemplateKey === "escrow_form"
                ? selectedTemplate.label
                : previewCopy.title}
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Globe2 size={14} />
              {titleCase(draft.language)}
              <span className="text-slate-300">•</span>
              {selectedLocation?.name || editorCopy.noLocationSelected}
            </div>
          </div>

          {!locationId && (
            <div className="px-6 mt-5">
              <div className=" flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">{editorCopy.locationRequired}</p>
                  <p>{editorCopy.locationRequiredHint}</p>
                </div>
              </div>
            </div>
          )}

          {contractTemplateKey === "escrow_form" ? (
            <div className="mt-6 space-y-4 px-6 pb-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {editorCopy.selectedTemplate}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTemplate.label}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedTemplate.description}
                </p>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                  {editorCopy.renderUrl}:
                </p>
                <p className="mt-1 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {typeof window !== "undefined"
                    ? buildEscrowContractUrl(
                        window.location.origin,
                        locale,
                        draft.language,
                        draft,
                      )
                    : ""}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {editorCopy.escrowMember}
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
                    {editorCopy.escrowBuyerDetails}
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
                    <p>{fieldValue(draft.vesselName || yachtName)}</p>
                    <p>
                      {previewCopy.priceText(
                        draft.askingPrice || "0",
                        draft.askingPriceWords,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6">
              <div className="mx-auto max-w-[920px] text-slate-900 dark:text-slate-100">
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-6">
                  <div className="flex justify-center">
                    <Image
                      src="/schepenkring-logo.png"
                      alt="Schepenkring"
                      className="h-auto w-[320px] max-w-full object-contain"
                      width={320}
                      height={151}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Image
                      src="/nautic.jpg"
                      alt="Krekelberg Nautic"
                      className="h-auto w-[96px] object-contain"
                      width={96}
                      height={153}
                    />
                  </div>
                  <div />
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                  <div className="border-b border-[#c92424]" />
                  <div />
                  <div className="border-b border-[#c92424]" />
                </div>

                <div className="mt-8 space-y-7 font-serif text-[15px] leading-7">
                  <section>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h5 className="font-serif text-[2rem] font-bold tracking-wide text-slate-900 dark:text-slate-100">
                        {agreementCopy.heading}
                      </h5>
                      <button
                        type="button"
                        onClick={() => openEditor("buyer")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#003566]"
                        aria-label={`Edit ${previewCopy.buyerLabel}`}
                      >
                        <PencilLine size={14} />
                      </button>
                    </div>
                    <p className="font-semibold">
                      {agreementCopy.referenceLabel}:{" "}
                      {fieldValue(
                        `SK-${draft.language.toUpperCase()}-${draft.vesselName?.slice(0, 3).toUpperCase() || "DOC"}-${draft.agreementDate || "0000-00-00"}`,
                      )}
                    </p>
                    <div className="mt-6">
                      <ContractMetaTable
                        rows={[
                          {
                            label: agreementCopy.nameLabel,
                            value: fieldValue(draft.clientName),
                          },
                          {
                            label: agreementCopy.addressLabel,
                            value: fieldValue(draft.clientAddress),
                          },
                          {
                            label: agreementCopy.postalCityLabel,
                            value: fieldValue(
                              [draft.clientPostalCode, draft.clientCity]
                                .filter(Boolean)
                                .join(" "),
                            ),
                          },
                          {
                            label: agreementCopy.phoneLabel,
                            value: fieldValue(draft.clientPhone),
                          },
                          {
                            label: agreementCopy.emailLabel,
                            value: fieldValue(draft.clientEmail),
                          },
                          {
                            label: agreementCopy.passportLabel,
                            value: fieldValue(draft.passportNumber),
                          },
                          {
                            label: agreementCopy.marriedLabel,
                            value: `${boolLabel(draft.language, draft.married)}${draft.spouseName ? ` • ${draft.spouseName}` : ""}`,
                          },
                        ]}
                      />
                    </div>
                    <p className="mt-4 font-semibold">
                      {agreementCopy.clientCaption}
                    </p>
                    <p>{agreementCopy.intermediaryConnector}</p>
                    <div className="mt-4">
                      <ContractMetaTable
                        rows={[
                          {
                            label: agreementCopy.companyLabel,
                            value: fieldValue(draft.companyName),
                          },
                          {
                            label: agreementCopy.addressLabel,
                            value: fieldValue(draft.companyAddress),
                          },
                          {
                            label: agreementCopy.postalCityLabel,
                            value: fieldValue(
                              [draft.companyPostalCode, draft.companyCity]
                                .filter(Boolean)
                                .join(" "),
                            ),
                          },
                          {
                            label: agreementCopy.phoneLabel,
                            value: fieldValue(draft.companyPhone),
                          },
                          {
                            label: agreementCopy.emailLabel,
                            value: fieldValue(draft.companyEmail),
                          },
                        ]}
                      />
                    </div>
                    <p className="mt-4 font-semibold">
                      {agreementCopy.intermediaryCaption}
                    </p>
                  </section>

                  <section>
                    <SectionHeader
                      title={previewCopy.vesselLabel}
                      onEdit={() => openEditor("vessel")}
                    />
                    <p className="mt-4 font-semibold">
                      {agreementCopy.introLabel}
                    </p>
                    <div className="mt-3">
                      <p>{getClauseOneIntro(draft.language)}</p>
                      <div className="mt-3">
                        <ContractMetaTable
                          rows={getSpecificationRows(draft).map((row) => ({
                            label: row.label,
                            value: fieldValue(row.value),
                          }))}
                        />
                      </div>
                      <p className="mt-3">
                        {getClauseOneClosing(draft.language)}
                      </p>
                    </div>
                  </section>

                  <section>
                    <SectionHeader title={previewCopy.declarationsLabel} />
                    <div className="mt-4 space-y-3">
                      {getAgreementClauses(draft)
                        .slice(1)
                        .map((clause, index) => (
                          <p key={`clause-${index + 2}`}>
                            {renderClauseText(clause)}
                          </p>
                        ))}
                    </div>
                  </section>

                  <section>
                    <SectionHeader title={previewCopy.closingLabel} />
                    <p className="mt-4">
                      {previewCopy.closingText(
                        formatAgreementDate(
                          draft.language,
                          draft.agreementDate,
                        ),
                        draft.agreementCity || draft.companyCity,
                      )}
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-10 pt-4">
                      <p className="font-semibold">
                        {agreementCopy.signatureClient}
                      </p>
                      <p className="font-semibold">
                        {agreementCopy.signatureIntermediary}
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl dark:border-slate-700 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>
              {editorSection
                ? `${editorCopy.editSectionPrefix} ${editorSectionTitle}`
                : editorCopy.dialogTitle}
            </DialogTitle>
            <DialogDescription>
              {editorCopy.dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {editorCopy.sellerSection}
                </p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <FieldLabel>{editorCopy.company}</FieldLabel>
                    <Input
                      value={draft.companyName}
                      onChange={(event) =>
                        handleFieldChange("companyName", event.target.value)
                      }
                      placeholder={editorCopy.company}
                    />
                  </div>
                  <div>
                    <FieldLabel>{editorCopy.address}</FieldLabel>
                    <Input
                      value={draft.companyAddress}
                      onChange={(event) =>
                        handleFieldChange("companyAddress", event.target.value)
                      }
                      placeholder={editorCopy.address}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>{editorCopy.postalCode}</FieldLabel>
                      <Input
                        value={draft.companyPostalCode}
                        onChange={(event) =>
                          handleFieldChange(
                            "companyPostalCode",
                            event.target.value,
                          )
                        }
                        placeholder={editorCopy.postalCode}
                      />
                    </div>
                    <div>
                      <FieldLabel>{editorCopy.city}</FieldLabel>
                      <Input
                        value={draft.companyCity}
                        onChange={(event) =>
                          handleFieldChange("companyCity", event.target.value)
                        }
                        placeholder={editorCopy.city}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>{editorCopy.phone}</FieldLabel>
                      <Input
                        value={draft.companyPhone}
                        onChange={(event) =>
                          handleFieldChange("companyPhone", event.target.value)
                        }
                        placeholder={editorCopy.phone}
                      />
                    </div>
                    <div>
                      <FieldLabel>{editorCopy.email}</FieldLabel>
                      <Input
                        value={draft.companyEmail}
                        onChange={(event) =>
                          handleFieldChange("companyEmail", event.target.value)
                        }
                        placeholder={editorCopy.email}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {editorCopy.buyerSection}
                </p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <FieldLabel>{editorCopy.name}</FieldLabel>
                    <Input
                      value={draft.clientName}
                      onChange={(event) =>
                        handleFieldChange("clientName", event.target.value)
                      }
                      placeholder={editorCopy.name}
                    />
                  </div>
                  <div>
                    <FieldLabel>{editorCopy.address}</FieldLabel>
                    <Input
                      value={draft.clientAddress}
                      onChange={(event) =>
                        handleFieldChange("clientAddress", event.target.value)
                      }
                      placeholder={editorCopy.address}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>{editorCopy.postalCode}</FieldLabel>
                      <Input
                        value={draft.clientPostalCode}
                        onChange={(event) =>
                          handleFieldChange(
                            "clientPostalCode",
                            event.target.value,
                          )
                        }
                        placeholder={editorCopy.postalCode}
                      />
                    </div>
                    <div>
                      <FieldLabel>{editorCopy.city}</FieldLabel>
                      <Input
                        value={draft.clientCity}
                        onChange={(event) =>
                          handleFieldChange("clientCity", event.target.value)
                        }
                        placeholder={editorCopy.city}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>{editorCopy.phone}</FieldLabel>
                      <Input
                        value={draft.clientPhone}
                        onChange={(event) =>
                          handleFieldChange("clientPhone", event.target.value)
                        }
                        placeholder={editorCopy.phone}
                      />
                    </div>
                    <div>
                      <FieldLabel>{editorCopy.email}</FieldLabel>
                      <Input
                        value={draft.clientEmail}
                        onChange={(event) =>
                          handleFieldChange("clientEmail", event.target.value)
                        }
                        placeholder={editorCopy.email}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>{editorCopy.passportNumber}</FieldLabel>
                      <Input
                        value={draft.passportNumber}
                        onChange={(event) =>
                          handleFieldChange(
                            "passportNumber",
                            event.target.value,
                          )
                        }
                        placeholder={editorCopy.passportNumber}
                      />
                    </div>
                    <div>
                      <FieldLabel>{editorCopy.partnerName}</FieldLabel>
                      <Input
                        value={draft.spouseName}
                        onChange={(event) =>
                          handleFieldChange("spouseName", event.target.value)
                        }
                        placeholder={editorCopy.partnerName}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>{agreementCopy.marriedLabel}</FieldLabel>
                    <select
                      value={draft.married}
                      onChange={(event) =>
                        handleFieldChange(
                          "married",
                          event.target.value as "yes" | "no",
                        )
                      }
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="no">{editorCopy.notMarried}</option>
                      <option value="yes">{editorCopy.married}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {editorCopy.vesselSection}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>{editorCopy.name}</FieldLabel>
                  <Input
                    value={draft.vesselName}
                    onChange={(event) =>
                      handleFieldChange("vesselName", event.target.value)
                    }
                    placeholder={editorCopy.name}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.brandType}</FieldLabel>
                  <Input
                    value={draft.vesselBrandType}
                    onChange={(event) =>
                      handleFieldChange("vesselBrandType", event.target.value)
                    }
                    placeholder={editorCopy.brandType}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.buildYear}</FieldLabel>
                  <Input
                    value={draft.buildYear}
                    onChange={(event) =>
                      handleFieldChange("buildYear", event.target.value)
                    }
                    placeholder={editorCopy.buildYear}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.dimensions}</FieldLabel>
                  <Input
                    value={draft.dimensions}
                    onChange={(event) =>
                      handleFieldChange("dimensions", event.target.value)
                    }
                    placeholder={editorCopy.dimensions}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.buildingMaterial}</FieldLabel>
                  <Input
                    value={draft.buildingMaterial}
                    onChange={(event) =>
                      handleFieldChange("buildingMaterial", event.target.value)
                    }
                    placeholder={editorCopy.buildingMaterial}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.builder}</FieldLabel>
                  <Input
                    value={draft.builder}
                    onChange={(event) =>
                      handleFieldChange("builder", event.target.value)
                    }
                    placeholder={editorCopy.builder}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.hullCinNumber}</FieldLabel>
                  <Input
                    value={draft.hullNumber}
                    onChange={(event) =>
                      handleFieldChange("hullNumber", event.target.value)
                    }
                    placeholder={editorCopy.hullCinNumber}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.engine}</FieldLabel>
                  <Input
                    value={draft.engine}
                    onChange={(event) =>
                      handleFieldChange("engine", event.target.value)
                    }
                    placeholder={editorCopy.engine}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.engineNumber}</FieldLabel>
                  <Input
                    value={draft.engineNumber}
                    onChange={(event) =>
                      handleFieldChange("engineNumber", event.target.value)
                    }
                    placeholder={editorCopy.engineNumber}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.registrationNumber}</FieldLabel>
                  <Input
                    value={draft.registrationNumber}
                    onChange={(event) =>
                      handleFieldChange(
                        "registrationNumber",
                        event.target.value,
                      )
                    }
                    placeholder={editorCopy.registrationNumber}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {editorCopy.declarationsSection}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>
                    {previewCopy.registerText("", "").split(":")[0]}
                  </FieldLabel>
                  <select
                    value={draft.shipRegisterEntry}
                    onChange={(event) =>
                      handleFieldChange(
                        "shipRegisterEntry",
                        event.target.value as "yes" | "no",
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="no">{editorCopy.noShipRegisterEntry}</option>
                    <option value="yes">
                      {editorCopy.yesShipRegisterEntry}
                    </option>
                  </select>
                </div>
                <div>
                  <FieldLabel>{editorCopy.registerPlace}</FieldLabel>
                  <Input
                    value={draft.shipRegisterPlace}
                    onChange={(event) =>
                      handleFieldChange("shipRegisterPlace", event.target.value)
                    }
                    placeholder={editorCopy.registerPlace}
                  />
                </div>
                <div>
                  <FieldLabel>
                    {previewCopy.mortgageText("", "").split(":")[0]}
                  </FieldLabel>
                  <select
                    value={draft.hasMortgage}
                    onChange={(event) =>
                      handleFieldChange(
                        "hasMortgage",
                        event.target.value as "yes" | "no",
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="no">{editorCopy.noShipMortgage}</option>
                    <option value="yes">{editorCopy.yesShipMortgage}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>{editorCopy.mortgageParty}</FieldLabel>
                  <Input
                    value={draft.mortgageInFavorOf}
                    onChange={(event) =>
                      handleFieldChange("mortgageInFavorOf", event.target.value)
                    }
                    placeholder={editorCopy.mortgageParty}
                  />
                </div>
                <div>
                  <FieldLabel>
                    {previewCopy.vatText("").split(":")[0]}
                  </FieldLabel>
                  <select
                    value={draft.vatDeclaration}
                    onChange={(event) =>
                      handleFieldChange(
                        "vatDeclaration",
                        event.target.value as "yes" | "no",
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="no">{editorCopy.noVatDeclaration}</option>
                    <option value="yes">{editorCopy.yesVatDeclaration}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>{editorCopy.askingPrice}</FieldLabel>
                  <Input
                    value={draft.askingPrice}
                    onChange={(event) =>
                      handleFieldChange("askingPrice", event.target.value)
                    }
                    placeholder={editorCopy.askingPrice}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.askingPriceWords}</FieldLabel>
                  <Input
                    value={draft.askingPriceWords}
                    onChange={(event) =>
                      handleFieldChange("askingPriceWords", event.target.value)
                    }
                    placeholder={editorCopy.askingPriceWords}
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.agreementDate}</FieldLabel>
                  <Input
                    type="date"
                    value={draft.agreementDate}
                    onChange={(event) =>
                      handleFieldChange("agreementDate", event.target.value)
                    }
                  />
                </div>
                <div>
                  <FieldLabel>{editorCopy.agreementCity}</FieldLabel>
                  <Input
                    value={draft.agreementCity}
                    onChange={(event) =>
                      handleFieldChange("agreementCity", event.target.value)
                    }
                    placeholder={editorCopy.agreementCity}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleDownloadGeneratedPdf}
              className="rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <FileText className="mr-2 h-4 w-4" />
              {editorCopy.downloadPdf}
            </Button>
            <Button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d]"
            >
              {editorCopy.saveDetails}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
