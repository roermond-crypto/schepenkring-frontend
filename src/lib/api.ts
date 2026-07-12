import axios from "axios";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";
import { getLocaleOrDefault } from "@/lib/i18n";

function resolveBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL;

  let finalUrl = "https://app.schepen-kring.nl/api";
  if (configured) {
    finalUrl = normalizeApiBaseUrl(configured);
  } else if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    finalUrl = "http://localhost:8000/api";
  }

  return finalUrl;
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    // Accept: "application/json",
  },
});

import { getClientToken } from "@/lib/auth/client-session";

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = getClientToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // The backend has no other reliable way to know which of nl/en/de/fr the
  // user actually has selected (the browser's own Accept-Language reflects
  // OS/browser settings, not the in-app language switcher) — this is what
  // lets Laravel's validator (lang/{locale}/validation.php) and anything
  // else locale-dependent on the backend respond in the right language.
  // See App\Http\Middleware\SetLocaleFromRequest.
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  config.headers["Accept-Language"] = getLocaleOrDefault(firstSegment);

  return config;
});
