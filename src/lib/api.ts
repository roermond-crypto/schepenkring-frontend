import axios from "axios";

function resolveBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL;
  if (configured) return configured;
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return "http://localhost:8000/api";
  }
  return "https://app.schepen-kring.nl/api";
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

  return config;
});
