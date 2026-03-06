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

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const cookieToken = document.cookie
    .split("; ")
    .find((part) => part.startsWith("schepenkring_auth_token="))
    ?.split("=")[1];

  const localStorageToken =
    localStorage.getItem("auth_token") ??
    localStorage.getItem("admin_token") ??
    (() => {
      const raw = localStorage.getItem("user_data");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { token?: string };
        return parsed.token ?? null;
      } catch {
        return null;
      }
    })();

  const token = cookieToken || localStorageToken;
  if (token) {
    config.headers.Authorization = `Bearer ${decodeURIComponent(token)}`;
  }

  return config;
});
