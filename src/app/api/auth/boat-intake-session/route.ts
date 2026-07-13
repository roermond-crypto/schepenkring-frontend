import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/auth/roles";
import { setAuthCookies } from "@/lib/auth/session";
import { getBackendApiClient } from "@/lib/server/backend-api";

type BackendSessionResponse = {
  token?: string;
  user?: {
    id: string | number;
    name: string;
    email: string;
    role?: string;
    type?: string;
  };
  message?: string;
};

// Exchanges a public boat-intake resume token for a real, logged-in
// session on the seller account that was auto-created when the intake
// was submitted — so the seller never has to register again after
// already providing all their details in the public intake form.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { resume_token?: string };
    const resumeToken = body.resume_token?.trim();

    if (!resumeToken) {
      return NextResponse.json({ message: "resume_token is required" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const backendResponse = await backendApi.post<BackendSessionResponse>(
      `/boat-intake/${encodeURIComponent(resumeToken)}/session`,
      { device_name: "web" },
    );

    const payload = backendResponse.data;
    const backendUser = payload.user;

    if (!payload.token || !backendUser) {
      return NextResponse.json({ message: "Invalid session response" }, { status: 500 });
    }

    const normalizedRole = normalizeRole(backendUser.role ?? backendUser.type ?? null) ?? "seller";

    const sessionUser = {
      id: String(backendUser.id),
      name: backendUser.name,
      email: backendUser.email,
      role: normalizedRole,
    };

    const response = NextResponse.json({ token: payload.token, user: sessionUser }, { status: 200 });
    setAuthCookies(response, { token: payload.token, user: sessionUser });

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
          : "Unable to resume this intake session";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to process session" }, { status: 500 });
  }
}
