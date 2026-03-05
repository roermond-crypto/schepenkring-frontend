import axios, { AxiosError, type AxiosRequestConfig } from "axios";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const httpClient = axios.create({
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
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
