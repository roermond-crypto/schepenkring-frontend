"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ExternalLink,
  FileCheck,
  FilePenLine,
  FileText,
  Globe2,
  Loader2,
  PencilLine,
  Printer,
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
} from "@/lib/api/signhost";

type ContractLanguage = "nl" | "en" | "de" | "fr";
type ContractTemplateKey = "sale_agreement" | "escrow_form";

function resolveContractLanguage(locale: string): ContractLanguage {
  if (locale === "nl" || locale === "en" || locale === "de" || locale === "fr") {
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
  yachtId: number;
  yachtName: string;
  locationId: number | null;
  yachtData?: YachtContractData | null;
  locationOptions?: LocationOption[];
}

const languageOptions: { value: ContractLanguage; label: string }[] = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

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
    printPdf: string;
    createDeeplink: string;
    openDeeplink: string;
    noLocationSelected: string;
    locationRequired: string;
    locationRequiredHint: string;
    selectedTemplate: string;
    renderUrl: string;
    escrowMember: string;
    escrowBuyerDetails: string;
    generateEscrowPdf: string;
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
    printPdf: "Print / Save PDF",
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
    generateEscrowPdf: "Generate escrow PDF",
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
    printPdf: "PDF afdrukken / opslaan",
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
    generateEscrowPdf: "Escrow-PDF genereren",
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
    printPdf: "PDF drucken / speichern",
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
    generateEscrowPdf: "Escrow-PDF erzeugen",
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
    printPdf: "Imprimer / enregistrer le PDF",
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
    generateEscrowPdf: "Generer le PDF escrow",
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

function resolveEscrowFormLanguage(language: ContractLanguage): "nl" | "en" | "de" {
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
  const agreementCopy = getAgreementCopy(draft.language);
  const dateLabel = formatAgreementDate(draft.language, draft.agreementDate);
  const reference = `SK-${draft.language.toUpperCase()}-${draft.vesselName?.slice(0, 3).toUpperCase() || "DOC"}-${draft.agreementDate || "0000-00-00"}`;
  const lineValue = (value?: string) => value?.trim() || "………";
  const clauses = getAgreementClauses(draft)
    .map((clause) => `<p class="clause">${clause}</p>`)
    .join("");

  return `
    <html>
      <head>
        <title>${agreementCopy.heading}</title>
        <style>
          @page { size: A4; margin: 22mm 18mm; }
          body { font-family: "Times New Roman", Georgia, serif; color: #111827; font-size: 13px; line-height: 1.35; }
          .page { max-width: 760px; margin: 0 auto; }
          .topline { font-size: 12px; margin: 0 0 18px; white-space: pre-line; }
          h1 { margin: 12px 0 16px; font-size: 28px; text-align: center; letter-spacing: 0.04em; }
          .meta p { margin: 4px 0; }
          .label { display: inline-block; min-width: 150px; }
          .intro { margin: 12px 0 14px; }
          .clause { margin: 0 0 12px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 36px; }
          .sigline { border-top: 1px solid #111827; padding-top: 34px; }
        </style>
      </head>
      <body>
        <div class="page">
          <p class="topline">__________\n\n______________________________\n\n____</p>
          <h1>${agreementCopy.heading}</h1>
          <div class="meta">
            <p><span class="label">${agreementCopy.referenceLabel}:</span> ${reference}</p>
            <p><span class="label">${agreementCopy.nameLabel}:</span> ${lineValue(draft.clientName)}</p>
            <p><span class="label">${agreementCopy.addressLabel}:</span> ${lineValue(draft.clientAddress)}</p>
            <p><span class="label">${agreementCopy.postalCityLabel}:</span> ${lineValue([draft.clientPostalCode, draft.clientCity].filter(Boolean).join(" "))}</p>
            <p><span class="label">${agreementCopy.phoneLabel}:</span> ${lineValue(draft.clientPhone)}</p>
            <p><span class="label">${agreementCopy.emailLabel}:</span> ${lineValue(draft.clientEmail)}</p>
            <p><span class="label">${agreementCopy.passportLabel}:</span> ${lineValue(draft.passportNumber)}</p>
            <p><span class="label">${agreementCopy.marriedLabel}:</span> ${boolLabel(draft.language, draft.married)}</p>
          </div>
          <p>${agreementCopy.clientCaption}</p>
          <p>${agreementCopy.intermediaryConnector}</p>
          <div class="meta">
            <p><span class="label">${agreementCopy.companyLabel}:</span> ${lineValue(draft.companyName)}</p>
            <p><span class="label">${agreementCopy.addressLabel}:</span> ${lineValue(draft.companyAddress)}</p>
            <p><span class="label">${agreementCopy.postalCityLabel}:</span> ${lineValue([draft.companyPostalCode, draft.companyCity].filter(Boolean).join(" "))}</p>
            <p><span class="label">${agreementCopy.phoneLabel}:</span> ${lineValue(draft.companyPhone)}</p>
            <p><span class="label">${agreementCopy.emailLabel}:</span> ${lineValue(draft.companyEmail)}</p>
          </div>
          <p>${agreementCopy.intermediaryCaption}</p>
          <p class="intro">${agreementCopy.introLabel}</p>
          ${clauses}
          <p>${copy.closingText(dateLabel, draft.agreementCity || draft.companyCity)}</p>
          <div class="signatures">
            <div class="sigline">${agreementCopy.signatureClient}</div>
            <div class="sigline">${agreementCopy.signatureIntermediary}</div>
          </div>
        </div>
      </body>
    </html>
  `;
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
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#003566]"
        aria-label={`Edit ${title}`}
      >
        <PencilLine size={14} />
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
      {children}
    </label>
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
  const localeContractLanguage = resolveContractLanguage(locale);
  const params = useParams<{ role?: string }>();
  const role = params?.role?.toLowerCase();
  const canManageContract = role !== "client";
  const selectedLocation = useMemo(
    () => locationOptions.find((option) => option.id === locationId) || null,
    [locationId, locationOptions],
  );
  const storageKey = `contract_draft_${yachtId}`;

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
  const [isSending, setIsSending] = useState(false);
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
  const agreementCopy = getAgreementCopy(draft.language);
  const editorCopy = editorCopyByLanguage[draft.language];
  const selectedTemplate = contractTemplateOptions.find(
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

  const openEditor = (section?: string) => {
    setEditorSection(section ?? null);
    setEditorOpen(true);
  };

  const handlePreviewPrint = () => {
    if (contractTemplateKey === "escrow_form") {
      const escrowUrl = buildEscrowContractUrl(
        window.location.origin,
        locale,
        draft.language,
        draft,
      );
      const previewWindow = window.open(
        escrowUrl,
        "_blank",
        "width=960,height=1280",
      );
      if (!previewWindow) {
        toast.error("Popup blocked. Allow popups to print or save PDF.");
      }
      return;
    }

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
      const contractRenderUrl =
        contractTemplateKey === "escrow_form"
          ? buildEscrowContractUrl(
              window.location.origin,
              locale,
              draft.language,
              draft,
            )
          : undefined;

      const res = await signhostApi.generateContract({
        entity_type: "Vessel",
        entity_id: yachtId,
        location_id: locationId,
        title: `${
          contractTemplateKey === "escrow_form"
            ? "Escrow account service form"
            : previewCopy.title
        } - ${draft.vesselName || yachtName}`,
        metadata: {
          boat_name: draft.vesselName || yachtName,
          contract_language: draft.language,
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
      setSignRequest(res.sign_request);
      toast.success("Contract PDF generated.");
    } catch {
      toast.error("Failed to generate contract PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSignhostDeeplink = async () => {
    if (!signRequest) {
      toast.error("Generate the contract PDF first.");
      return;
    }

    const recipients = [
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

    if (recipients.length === 0) {
      toast.error("Add buyer or seller name and e-mail before creating the deeplink.");
      return;
    }

    setIsSending(true);
    try {
      const res = await signhostApi.createRequest(
        {
          sign_request_id: signRequest.id,
          recipients,
          reference: `vessel-${yachtId}`,
        },
        `signhost_${signRequest.id}_${Date.now()}`,
      );
      setSignRequest(res.sign_request);
      toast.success("Signhost deeplink created.");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to create Signhost deeplink.";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const statusDisplay = useMemo(() => {
    const status = signRequest?.status?.toUpperCase() || "DRAFT";
    switch (status) {
      case "SIGNED":
        return {
          label: editorCopy.statusSigned,
          icon: FileCheck,
          tone:
            "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
        };
      case "SENT":
        return {
          label: editorCopy.statusSent,
          icon: Send,
          tone:
            "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900",
        };
      case "FAILED":
        return {
          label: editorCopy.statusCancelled,
          icon: XCircle,
          tone:
            "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900",
        };
      default:
        return {
          label: editorCopy.statusDraft,
          icon: FileText,
          tone:
            "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700",
        };
    }
  }, [editorCopy, signRequest?.status]);

  if (!canManageContract) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-900/80">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <FilePenLine size={18} className="text-[#003566] dark:text-sky-300" />
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
              setContractTemplateKey(
                event.target.value as ContractTemplateKey,
              )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {contractTemplateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={draft.language}
            disabled
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
            onClick={handleGenerateContract}
            disabled={isGenerating || !locationId}
            className="rounded-xl bg-[#003566] text-white hover:bg-[#00284d] disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {contractTemplateKey === "escrow_form"
              ? editorCopy.generateEscrowPdf
              : previewCopy.generateLabel}
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
            onClick={handlePreviewPrint}
            className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Printer className="mr-2 h-4 w-4" />
            {editorCopy.printPdf}
          </Button>
          {signRequest && !signRequest.sign_url && (
            <Button
              type="button"
              onClick={handleCreateSignhostDeeplink}
              disabled={isSending}
              className="rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {editorCopy.createDeeplink}
            </Button>
          )}
          {signRequest?.sign_url && (
            <a
              href={signRequest.sign_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {editorCopy.openDeeplink}
            </a>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-3xl border border-[#d7e3f1] bg-gradient-to-br from-[#f8fbff] to-white p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">{editorCopy.locationRequired}</p>
                  <p>{editorCopy.locationRequiredHint}</p>
                </div>
              </div>
            )}

            {contractTemplateKey === "escrow_form" ? (
              <div className="mt-6 space-y-4">
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
              <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-8 py-10 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                <div className="mx-auto max-w-4xl text-slate-900 dark:text-slate-100">
                  <div className="mb-8 border-t border-slate-400 pt-4">
                    <h5 className="text-center font-serif text-4xl font-bold tracking-wide text-[#0b2c5f] dark:text-slate-100">
                      {agreementCopy.heading}
                    </h5>
                  </div>

                  <div className="space-y-8 font-serif text-[15px] leading-7">
                    <section>
                      <SectionHeader
                        title={previewCopy.sellerLabel}
                        onEdit={() => openEditor("seller")}
                      />
                      <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr]">
                        <p>{agreementCopy.companyLabel}:</p>
                        <p>{fieldValue(draft.companyName)}</p>
                        <p>{agreementCopy.addressLabel}:</p>
                        <p>{fieldValue(draft.companyAddress)}</p>
                        <p>{agreementCopy.postalCityLabel}:</p>
                        <p>
                          {fieldValue(
                            [draft.companyPostalCode, draft.companyCity]
                              .filter(Boolean)
                              .join(" "),
                          )}
                        </p>
                        <p>{agreementCopy.phoneLabel}:</p>
                        <p>{fieldValue(draft.companyPhone)}</p>
                        <p>{agreementCopy.emailLabel}:</p>
                        <p>{fieldValue(draft.companyEmail)}</p>
                      </div>
                    </section>

                    <section>
                      <SectionHeader
                        title={previewCopy.buyerLabel}
                        onEdit={() => openEditor("buyer")}
                      />
                      <div className="mt-4 grid gap-2 md:grid-cols-[180px_1fr]">
                        <p>{agreementCopy.nameLabel}:</p>
                        <p>{fieldValue(draft.clientName)}</p>
                        <p>{agreementCopy.addressLabel}:</p>
                        <p>{fieldValue(draft.clientAddress)}</p>
                        <p>{agreementCopy.postalCityLabel}:</p>
                        <p>
                          {fieldValue(
                            [draft.clientPostalCode, draft.clientCity]
                              .filter(Boolean)
                              .join(" "),
                          )}
                        </p>
                        <p>{agreementCopy.phoneLabel}:</p>
                        <p>{fieldValue(draft.clientPhone)}</p>
                        <p>{agreementCopy.emailLabel}:</p>
                        <p>{fieldValue(draft.clientEmail)}</p>
                        <p>{agreementCopy.passportLabel}:</p>
                        <p>{fieldValue(draft.passportNumber)}</p>
                        <p>{agreementCopy.marriedLabel}:</p>
                        <p>
                          {boolLabel(draft.language, draft.married)}
                          {draft.spouseName ? ` • ${draft.spouseName}` : ""}
                        </p>
                      </div>
                    </section>

                    <section>
                      <SectionHeader
                        title={previewCopy.vesselLabel}
                        onEdit={() => openEditor("vessel")}
                      />
                      <div className="mt-4 space-y-4">
                        <p>
                          1. that the client grants the intermediary the exclusive assignment to sell the vessel in his property with the following specification:
                        </p>
                        <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                          <p>{editorCopy.name}:</p>
                          <p>{fieldValue(draft.vesselName)}</p>
                          <p>{editorCopy.brandType}:</p>
                          <p>{fieldValue(draft.vesselBrandType)}</p>
                          <p>{editorCopy.buildYear}:</p>
                          <p>{fieldValue(draft.buildYear)}</p>
                          <p>{editorCopy.dimensions}:</p>
                          <p>{fieldValue(draft.dimensions)}</p>
                          <p>{editorCopy.buildingMaterial}:</p>
                          <p>{fieldValue(draft.buildingMaterial)}</p>
                          <p>{editorCopy.builder}:</p>
                          <p>{fieldValue(draft.builder)}</p>
                          <p>{editorCopy.hullCinNumber}:</p>
                          <p>{fieldValue(draft.hullNumber)}</p>
                          <p>{editorCopy.engine}:</p>
                          <p>{fieldValue(draft.engine)}</p>
                          <p>{editorCopy.engineNumber}:</p>
                          <p>{fieldValue(draft.engineNumber)}</p>
                          <p>{editorCopy.registrationNumber}:</p>
                          <p>{fieldValue(draft.registrationNumber)}</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <SectionHeader
                        title={previewCopy.declarationsLabel}
                        onEdit={() => openEditor("declarations")}
                      />
                      <div className="mt-4 space-y-3">
                        <p>
                          {previewCopy.registerText(
                            boolLabel(draft.language, draft.shipRegisterEntry),
                            draft.shipRegisterPlace,
                          )}
                        </p>
                        <p>
                          {previewCopy.mortgageText(
                            boolLabel(draft.language, draft.hasMortgage),
                            draft.mortgageInFavorOf,
                          )}
                        </p>
                        <p>
                          {previewCopy.vatText(
                            boolLabel(draft.language, draft.vatDeclaration),
                          )}
                        </p>
                        <p>
                          {previewCopy.priceText(
                            draft.askingPrice || "0",
                            draft.askingPriceWords,
                          )}
                        </p>
                      </div>
                    </section>

                    <section>
                      <SectionHeader
                        title={previewCopy.closingLabel}
                        onEdit={() => openEditor("closing")}
                      />
                      <p className="mt-4">
                        {previewCopy.closingText(
                          formatAgreementDate(draft.language, draft.agreementDate),
                          draft.agreementCity || draft.companyCity,
                        )}
                      </p>
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
            <DialogDescription>{editorCopy.dialogDescription}</DialogDescription>
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
                          handleFieldChange("companyPostalCode", event.target.value)
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
                          handleFieldChange("clientPostalCode", event.target.value)
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
                          handleFieldChange("passportNumber", event.target.value)
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
                      handleFieldChange("registrationNumber", event.target.value)
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
                  <FieldLabel>{previewCopy.registerText("", "").split(":")[0]}</FieldLabel>
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
                    <option value="yes">{editorCopy.yesShipRegisterEntry}</option>
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
                  <FieldLabel>{previewCopy.mortgageText("", "").split(":")[0]}</FieldLabel>
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
                  <FieldLabel>{previewCopy.vatText("").split(":")[0]}</FieldLabel>
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
              {editorCopy.saveDetails}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
