import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/roles";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendAuthResponse = {
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  step_up_required?: boolean;
  otp_challenge_id?: string;
  otp_ttl_minutes?: number;
  device_id?: string;
  reasons?: string[];
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      remember_terminal?: boolean;
    };
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const backendResponse = await backendApi.post<BackendAuthResponse>("/auth/login", {
      email,
      password,
      remember_terminal: Boolean(body.remember_terminal),
    });

    const payload = backendResponse.data;

    if (payload.step_up_required && payload.otp_challenge_id) {
      return NextResponse.json(
        {
          step_up_required: true,
          otp_challenge_id: payload.otp_challenge_id,
          otp_ttl_minutes: payload.otp_ttl_minutes,
          device_id: payload.device_id,
          reasons: payload.reasons ?? [],
          message: payload.message ?? "Verification code sent to your email.",
        },
        { status: 200 },
      );
    }

    if (!payload.token || !payload.user) {
      return NextResponse.json({ message: "Invalid login response" }, { status: 500 });
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
          : "Invalid credentials";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to process login" }, { status: 500 });
  }
}
