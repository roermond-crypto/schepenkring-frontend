import type { AppLocale } from "@/lib/i18n";

// Each entry matches one of the literal (or near-literal, for the few with
// interpolated names/titles) title/message templates the backend actually
// sends — see NotificationDispatchService::notifyUser call sites across
// app/Actions, app/Jobs, app/Listeners, app/Console/Commands. Several of
// those call sites hardcode Dutch instead of English (e.g. SendSignhostReminders,
// PhoneCallService), so patterns must match regardless of source language —
// this translator normalizes to the *viewing* locale, not the stored one.
const MESSAGE_PATTERNS: Array<{
  test: RegExp;
  key: keyof typeof MESSAGES.en;
}> = [
  { test: /signing request has been resent|ondertekeningsverzoek.*opnieuw verzonden/i, key: "signingResent" },
  { test: /signing request was cancelled|ondertekeningsverzoek.*geannuleerd/i, key: "signingCancelled" },
  { test: /signing request is ready|ondertekeningsverzoek klaar/i, key: "signingReady" },
  { test: /signed documents are ready|ondertekende documenten.*klaar/i, key: "documentsReady" },
  { test: /contract.*ready/i, key: "contractReady" },
  { test: /account has been disabled|account is uitgeschakeld/i, key: "accountDisabled" },
  { test: /location assignment has been cleared|locatietoewijzing.*gewist/i, key: "locationAssignmentCleared" },
  { test: /location assignment has been updated|locatietoewijzing.*bijgewerkt/i, key: "locationAssignmentUpdated" },
  { test: /lead has been assigned|lead.*toegewezen aan (jou|u)/i, key: "leadAssigned" },
  { test: /lead was converted|lead.*geconverteerd/i, key: "leadConverted" },
  { test: /new lead has been created|nieuwe lead.*aangemaakt/i, key: "newLead" },
  { test: /^reminder:|^herinnering:/i, key: "taskReminder" },
  { test: /commented on|reageerde op/i, key: "taskCommented" },
  { test: /contract.*(open|wacht).*ondertekening|het contract staat al 2 dagen open/i, key: "signhostReminder2day" },
  { test: /5 dagen open|second reminder/i, key: "signhostReminder5day" },
  { test: /ondertekeningslink is verlopen|signing link has expired/i, key: "signhostExpired" },
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
    signingResent: "A signing request has been resent.",
    signingCancelled: "A signing request was cancelled.",
    documentsReady: "Signed documents are ready for download.",
    contractReady: "Your contract is ready to sign.",
    accountDisabled: "Your account has been disabled. Please contact support.",
    locationAssignmentUpdated: "Your location assignment has been updated.",
    locationAssignmentCleared: "Your location assignment has been cleared.",
    leadAssigned: "A lead has been assigned to you.",
    leadConverted: "A lead was converted to a client.",
    newLead: "A new lead has been created.",
    taskReminder: "You have a task reminder.",
    taskCommented: "Someone commented on a task.",
    signhostReminder2day: "Your contract is still waiting to be signed.",
    signhostReminder5day: "Your contract is still waiting to be signed — please contact us if you need help.",
    signhostExpired: "The signing link has expired. A new one needs to be created.",
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
    signingResent: "Er is een nieuw ondertekeningsverzoek verzonden.",
    signingCancelled: "Een ondertekeningsverzoek is geannuleerd.",
    documentsReady: "De ondertekende documenten staan klaar om te downloaden.",
    contractReady: "Je contract staat klaar om te ondertekenen.",
    accountDisabled: "Je account is uitgeschakeld. Neem contact op met support.",
    locationAssignmentUpdated: "Je locatietoewijzing is bijgewerkt.",
    locationAssignmentCleared: "Je locatietoewijzing is verwijderd.",
    leadAssigned: "Er is een lead aan je toegewezen.",
    leadConverted: "Een lead is omgezet naar klant.",
    newLead: "Er is een nieuwe lead aangemaakt.",
    taskReminder: "Je hebt een taakherinnering.",
    taskCommented: "Er is gereageerd op een taak.",
    signhostReminder2day: "Je contract staat nog steeds open voor ondertekening.",
    signhostReminder5day: "Je contract staat nog steeds open voor ondertekening — neem contact op als je hulp nodig hebt.",
    signhostExpired: "De ondertekeningslink is verlopen. Er moet een nieuwe worden aangemaakt.",
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
    signingResent: "Eine Signaturanfrage wurde erneut gesendet.",
    signingCancelled: "Eine Signaturanfrage wurde storniert.",
    documentsReady: "Die unterzeichneten Dokumente stehen zum Download bereit.",
    contractReady: "Ihr Vertrag ist bereit zur Unterzeichnung.",
    accountDisabled: "Ihr Konto wurde deaktiviert. Bitte kontaktieren Sie den Support.",
    locationAssignmentUpdated: "Ihre Standortzuweisung wurde aktualisiert.",
    locationAssignmentCleared: "Ihre Standortzuweisung wurde entfernt.",
    leadAssigned: "Ihnen wurde ein Lead zugewiesen.",
    leadConverted: "Ein Lead wurde in einen Kunden umgewandelt.",
    newLead: "Ein neuer Lead wurde erstellt.",
    taskReminder: "Sie haben eine Aufgabenerinnerung.",
    taskCommented: "Jemand hat eine Aufgabe kommentiert.",
    signhostReminder2day: "Ihr Vertrag wartet noch auf die Unterschrift.",
    signhostReminder5day: "Ihr Vertrag wartet noch auf die Unterschrift — kontaktieren Sie uns bei Fragen.",
    signhostExpired: "Der Signaturlink ist abgelaufen. Es muss ein neuer erstellt werden.",
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
    signingResent: "Une demande de signature a été renvoyée.",
    signingCancelled: "Une demande de signature a été annulée.",
    documentsReady: "Les documents signés sont prêts à être téléchargés.",
    contractReady: "Votre contrat est prêt à être signé.",
    accountDisabled: "Votre compte a été désactivé. Veuillez contacter le support.",
    locationAssignmentUpdated: "Votre affectation de site a été mise à jour.",
    locationAssignmentCleared: "Votre affectation de site a été supprimée.",
    leadAssigned: "Un prospect vous a été assigné.",
    leadConverted: "Un prospect a été converti en client.",
    newLead: "Un nouveau prospect a été créé.",
    taskReminder: "Vous avez un rappel de tâche.",
    taskCommented: "Quelqu'un a commenté une tâche.",
    signhostReminder2day: "Votre contrat est toujours en attente de signature.",
    signhostReminder5day: "Votre contrat est toujours en attente de signature — contactez-nous si besoin.",
    signhostExpired: "Le lien de signature a expiré. Un nouveau doit être créé.",
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
