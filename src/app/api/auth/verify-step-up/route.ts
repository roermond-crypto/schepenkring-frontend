import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/roles";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendVerifyResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      code?: string;
      otp_challenge_id?: string;
      device_id?: string;
    };

    if (!body.email || !body.code || !body.otp_challenge_id) {
      return NextResponse.json({ message: "Verification payload is incomplete" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const endpoints = ["/auth/login/verify-step-up", "/auth/verify-step-up", "/auth/login/verify-otp"];
    let payload: BackendVerifyResponse | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await backendApi.post<BackendVerifyResponse>(endpoint, body);
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

    const normalizedRole = normalizeRole(payload.user.role);
    if (!normalizedRole) {
      return NextResponse.json({ message: "Unsupported user role" }, { status: 403 });
    }

    const response = NextResponse.json(
      {
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          role: normalizedRole,
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
        role: normalizedRole,
      },
    });

    return response;
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 500;
      const message =
        typeof error.response?.data === "object" &&
        error.response?.data &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Verification failed";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to verify code" }, { status: 500 });
  }
}
