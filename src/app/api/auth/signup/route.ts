import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendSignupResponse = {
  token?: string;
  data?: {
    id: string | number;
    name: string;
    email: string;
    role?: string;
    type?: string;
  };
  user?: {
    id: string | number;
    name: string;
    email: string;
    role?: string;
    type?: string;
  };
  verification_required?: boolean;
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      location_id?: number;
      website?: string;
      password?: string;
      terms_accepted?: boolean;
    };

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

    const backendResponse = await backendApi.post<BackendSignupResponse>("/auth/register", {
      name,
      email,
      phone: body.phone ?? undefined,
      location_id: body.location_id ?? undefined,
      website: body.website ?? "",
      password,
      password_confirmation: password,
      terms_accepted: body.terms_accepted === true,
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

    const backendUser = payload.data ?? payload.user;

    if (!payload.token || !backendUser) {
      return NextResponse.json({ message: "Invalid signup response" }, { status: 500 });
    }

    const rawType = (backendUser.type ?? backendUser.role ?? "").toLowerCase();
    if (rawType && rawType !== "client") {
      return NextResponse.json(
        { message: "Signup is restricted to client accounts only" },
        { status: 403 },
      );
    }

    const response = NextResponse.json(
      {
        token: payload.token,
        user: {
          id: String(backendUser.id),
          name: backendUser.name,
          email: backendUser.email,
          role: "client" as const,
        },
      },
      { status: 201 },
    );

    setAuthCookies(response, {
      token: payload.token,
      user: {
        id: String(backendUser.id),
        name: backendUser.name,
        email: backendUser.email,
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
