import axios from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.BACKEND_API_URL ??
  "http://localhost:8000/api";

export const api = axios.create({
  baseURL,
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
