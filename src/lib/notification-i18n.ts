import type { AppLocale } from "@/lib/i18n";

const MESSAGE_PATTERNS: Array<{
  test: RegExp;
  key: keyof typeof MESSAGES.en;
}> = [
  { test: /signing request is ready/i, key: "signingReady" },
  { test: /contract.*ready/i, key: "contractReady" },
  { test: /new bid/i, key: "newBid" },
  { test: /bid.*received/i, key: "newBid" },
  { test: /message.*received|new message/i, key: "newMessage" },
  { test: /task.*assigned|new task/i, key: "newTask" },
  { test: /boat.*approved|listing.*approved/i, key: "boatApproved" },
  { test: /payment.*received/i, key: "paymentReceived" },
];

const MESSAGES = {
  en: {
    signingReady: "A signing request is ready.",
    contractReady: "Your contract is ready to sign.",
    newBid: "You received a new bid.",
    newMessage: "You have a new message.",
    newTask: "A new task was assigned to you.",
    boatApproved: "Your boat listing was approved.",
    paymentReceived: "Payment was received.",
    defaultMessage: "Notification update",
    defaultSender: "System",
  },
  nl: {
    signingReady: "Er staat een ondertekeningsverzoek klaar.",
    contractReady: "Je contract staat klaar om te ondertekenen.",
    newBid: "Je hebt een nieuw bod ontvangen.",
    newMessage: "Je hebt een nieuw bericht.",
    newTask: "Er is een nieuwe taak aan je toegewezen.",
    boatApproved: "Je bootadvertentie is goedgekeurd.",
    paymentReceived: "Betaling is ontvangen.",
    defaultMessage: "Melding",
    defaultSender: "Systeem",
  },
  de: {
    signingReady: "Eine Signaturanfrage ist bereit.",
    contractReady: "Ihr Vertrag ist bereit zur Unterzeichnung.",
    newBid: "Sie haben ein neues Gebot erhalten.",
    newMessage: "Sie haben eine neue Nachricht.",
    newTask: "Eine neue Aufgabe wurde Ihnen zugewiesen.",
    boatApproved: "Ihr Boots-Inserat wurde genehmigt.",
    paymentReceived: "Zahlung wurde erhalten.",
    defaultMessage: "Benachrichtigung",
    defaultSender: "System",
  },
  fr: {
    signingReady: "Une demande de signature est prête.",
    contractReady: "Votre contrat est prêt à être signé.",
    newBid: "Vous avez reçu une nouvelle offre.",
    newMessage: "Vous avez un nouveau message.",
    newTask: "Une nouvelle tâche vous a été assignée.",
    boatApproved: "Votre annonce de bateau a été approuvée.",
    paymentReceived: "Le paiement a été reçu.",
    defaultMessage: "Notification",
    defaultSender: "Système",
  },
} as const;

export function translateNotificationMessage(
  message: string | undefined,
  locale: AppLocale,
): string {
  const text = String(message ?? "").trim();
  if (!text) return MESSAGES[locale]?.defaultMessage ?? MESSAGES.en.defaultMessage;

  const bucket = MESSAGES[locale] ?? MESSAGES.en;
  for (const pattern of MESSAGE_PATTERNS) {
    if (pattern.test.test(text)) {
      return bucket[pattern.key];
    }
  }

  return text;
}

export function translateNotificationSender(
  sender: string | undefined,
  locale: AppLocale,
): string {
  const normalized = String(sender ?? "").trim().toLowerCase();
  if (!normalized || normalized === "system" || normalized === "systeem") {
    return MESSAGES[locale]?.defaultSender ?? MESSAGES.en.defaultSender;
  }
  return String(sender);
}
