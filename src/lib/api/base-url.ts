export function normalizeApiBaseUrl(rawUrl: string): string {
  const cleaned = rawUrl.trim();

  if (!cleaned) {
    return cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");

    if (normalizedPath === "" || normalizedPath === "/") {
      parsed.pathname = "/api";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    const noTrailingSlash = cleaned.replace(/\/+$/, "");

    if (noTrailingSlash === "" || noTrailingSlash === "/") {
      return "/api";
    }

    return noTrailingSlash;
  }
}
