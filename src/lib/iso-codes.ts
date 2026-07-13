// Curated ISO code lists for the platform country/language pickers, scoped to
// this platform's realistic markets rather than the full ISO-3166/639 lists.
// Display names are derived at render time via Intl.DisplayNames so we don't
// need to hand-maintain a 4-locale name dictionary for every code.

export const PLATFORM_COUNTRY_CODES = [
  "NL", "BE", "DE", "FR", "GB", "US", "LU", "CH", "AT",
  "ES", "IT", "PT", "DK", "SE", "NO", "FI", "PL", "IE",
] as const;

export const PLATFORM_LANGUAGE_CODES = [
  "nl", "en", "de", "fr", "es", "it", "pt", "da", "sv", "no", "fi", "pl",
] as const;

export function countryDisplayName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function languageDisplayName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code.toLowerCase()) ?? code;
  } catch {
    return code;
  }
}
