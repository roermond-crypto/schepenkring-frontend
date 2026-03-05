import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/roles";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendVerifyEmailResponse = {
  verified?: boolean;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; code?: string };

    if (!body.email || !body.code) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const endpoints = ["/auth/verify-email", "/auth/email/verify", "/verify-email"];
    let payload: BackendVerifyEmailResponse | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await backendApi.post<BackendVerifyEmailResponse>(endpoint, body);
        payload = response.data;
        break;
      } catch (error) {
        if (!(error instanceof AxiosError) || error.response?.status !== 404) {
          throw error;
        }
      }
    }

    if (!payload) {
      return NextResponse.json({ message: "Verification endpoint not available" }, { status: 500 });
    }

    if (payload.token && payload.user) {
      const role = normalizeRole(payload.user.role);
      if (!role) {
        return NextResponse.json({ message: "Unsupported user role" }, { status: 403 });
      }

      const response = NextResponse.json(
        {
          verified: true,
          user: {
            id: payload.user.id,
            name: payload.user.name,
            email: payload.user.email,
            role,
          },
        },
        { status: 200 },
      );

      setAuthCookies(response, {
        token: payload.token,
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          role,
        },
      });

      return response;
    }

    return NextResponse.json({ verified: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 500;
      const message =
        typeof error.response?.data === "object" &&
        error.response?.data &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Email verification failed";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to verify email" }, { status: 500 });
  }
}
