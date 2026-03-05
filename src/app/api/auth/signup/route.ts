import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendSignupResponse = {
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: "client";
  };
  verification_required?: boolean;
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };

    const name = body.name?.trim();
    const email = body.email?.trim();
    const password = body.password;

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const backendResponse = await backendApi.post<BackendSignupResponse>("/auth/signup", {
      name,
      email,
      password,
      password_confirmation: password,
      accept_terms: true,
      role: "client",
    });

    const payload = backendResponse.data;

    if (payload.verification_required) {
      return NextResponse.json(
        {
          verification_required: true,
          email,
          message: payload.message ?? "Verification code sent to your email.",
        },
        { status: 200 },
      );
    }

    if (!payload.token || !payload.user) {
      return NextResponse.json({ message: "Invalid signup response" }, { status: 500 });
    }

    if (payload.user.role !== "client") {
      return NextResponse.json(
        { message: "Signup is restricted to client accounts only" },
        { status: 403 },
      );
    }

    const response = NextResponse.json(
      {
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          role: "client" as const,
        },
      },
      { status: 201 },
    );

    setAuthCookies(response, {
      token: payload.token,
      user: {
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        role: "client",
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
          : "Signup failed";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to process signup" }, { status: 500 });
  }
}
