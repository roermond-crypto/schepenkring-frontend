import axios from "axios";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";

export function getBackendApiClient() {
  const configuredBaseUrl = process.env.BACKEND_API_URL;

  if (!configuredBaseUrl) {
    return null;
  }

  return axios.create({
    baseURL: normalizeApiBaseUrl(configuredBaseUrl),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}
