import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getClientToken } from "@/lib/auth/client-session";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "";

const httpClient = axios.create({
  baseURL: backendBaseUrl || undefined,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

httpClient.interceptors.request.use(
  (config) => {
    const token = getClientToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  if (!httpClient.defaults.baseURL) {
    throw new ApiError(
      "NEXT_PUBLIC_BACKEND_API_URL is not configured. Set it in .env and restart dev server.",
      500,
    );
  }

  try {
    const response = await httpClient.request<T>(config);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const message =
        typeof error.response?.data === "object" &&
        error.response?.data &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : error.message;

      throw new ApiError(message || "Request failed", error.response?.status ?? 500);
    }

    throw new ApiError("Request failed", 500);
  }
}
