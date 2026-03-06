export type FriendlyErrorLocale = "en" | "nl" | "de";

export type FriendlyErrorRecord = {
  ai_user_message_nl?: string | null;
  ai_user_message_en?: string | null;
  ai_user_message_de?: string | null;
  ai_dev_summary?: string | null;
  ai_category?: string | null;
  sentry_issue_id?: string | null;
  id?: string | number | null;
  title?: string | null;
  message?: string | null;
};

type FriendlyErrorMessage = {
  title: string;
  body: string;
  referenceCode: string;
  category: string;
  developerSummary: string;
};

type ErrorEnvelope = {
  friendlyMessage?: string;
  referenceCode?: string;
  response?: {
    data?: any;
  };
  message?: string;
};

const defaultCopy = {
  en: {
    title: "Something went wrong",
    body: "We could not complete this action right now. Try again. If it keeps happening, contact support with the reference code.",
    fallbackCategory: "general",
    fallbackDeveloper: "No AI summary available yet.",
  },
  nl: {
    title: "Er ging iets mis",
    body: "We konden deze actie nu niet afronden. Probeer het opnieuw. Neem contact op met support met de referentiecode als het probleem blijft bestaan.",
    fallbackCategory: "algemeen",
    fallbackDeveloper: "Nog geen AI-samenvatting beschikbaar.",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Diese Aktion konnte gerade nicht abgeschlossen werden. Versuchen Sie es erneut. Wenden Sie sich mit dem Referenzcode an den Support, falls das Problem bestehen bleibt.",
    fallbackCategory: "allgemein",
    fallbackDeveloper: "Noch keine KI-Zusammenfassung verfügbar.",
  },
} as const;

function normalizeLocale(locale?: string | null): FriendlyErrorLocale {
  if (locale === "nl" || locale === "de") return locale;
  return "en";
}

export function getErrorReferenceCode(
  error?: Pick<FriendlyErrorRecord, "sentry_issue_id" | "id"> | null,
) {
  const sentryIssueId = String(error?.sentry_issue_id || "").trim();
  if (sentryIssueId) return `ERR-${sentryIssueId.slice(-8).toUpperCase()}`;

  const internalId = error?.id;
  if (internalId !== undefined && internalId !== null && String(internalId).trim()) {
    return `ERR-${String(internalId).padStart(4, "0")}`;
  }

  return "ERR-UNKNOWN";
}

export function getFriendlyErrorMessage(
  error: FriendlyErrorRecord | null | undefined,
  locale?: string | null,
): FriendlyErrorMessage {
  const normalizedLocale = normalizeLocale(locale);
  const base = defaultCopy[normalizedLocale];

  const aiBody =
    normalizedLocale === "nl"
      ? error?.ai_user_message_nl
      : normalizedLocale === "de"
        ? error?.ai_user_message_de
        : error?.ai_user_message_en;

  return {
    title: error?.title || base.title,
    body: aiBody?.trim() || error?.message?.trim() || base.body,
    referenceCode: getErrorReferenceCode(error),
    category: error?.ai_category?.trim() || base.fallbackCategory,
    developerSummary: error?.ai_dev_summary?.trim() || base.fallbackDeveloper,
  };
}

export function getFriendlyErrorFromUnknown(
  error: unknown,
  locale?: string | null,
  fallbackBody?: string,
): FriendlyErrorMessage {
  const normalizedLocale = normalizeLocale(locale);
  const base = defaultCopy[normalizedLocale];
  const envelope = (error || {}) as ErrorEnvelope;

  if (envelope.friendlyMessage || envelope.referenceCode) {
    return {
      title: base.title,
      body: envelope.friendlyMessage || fallbackBody || base.body,
      referenceCode: envelope.referenceCode || "ERR-UNKNOWN",
      category: base.fallbackCategory,
      developerSummary: envelope.message || base.fallbackDeveloper,
    };
  }

  const payload =
    envelope?.response?.data?.error ||
    envelope?.response?.data?.data ||
    envelope?.response?.data;

  if (payload && typeof payload === "object") {
    const next = getFriendlyErrorMessage(payload, normalizedLocale);
    if (!payload?.message && fallbackBody) {
      return {
        ...next,
        body: fallbackBody,
      };
    }
    return next;
  }

  return {
    title: base.title,
    body: envelope?.message?.trim() || fallbackBody || base.body,
    referenceCode: "ERR-UNKNOWN",
    category: base.fallbackCategory,
    developerSummary: envelope?.message?.trim() || base.fallbackDeveloper,
  };
}

export function formatFriendlyErrorLine(
  error: unknown,
  locale?: string | null,
  fallbackBody?: string,
) {
  const friendly = getFriendlyErrorFromUnknown(error, locale, fallbackBody);
  return `${friendly.body} (${friendly.referenceCode})`;
}
