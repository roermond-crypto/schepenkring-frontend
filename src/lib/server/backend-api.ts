import axios from "axios";

export function getBackendApiClient() {
  const baseURL = process.env.BACKEND_API_URL;

  if (!baseURL) {
    return null;
  }

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}
