import { AxiosError } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { getBackendApiClient } from "@/lib/server/backend-api";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };

    if (!body.email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const backendApi = getBackendApiClient();
    if (!backendApi) {
      return NextResponse.json(
        { message: "BACKEND_API_URL is not configured" },
        { status: 503 },
      );
    }

    const endpoints = ["/auth/resend-verification", "/auth/email/resend", "/resend-verification"];
    let sent = false;

    for (const endpoint of endpoints) {
      try {
        await backendApi.post(endpoint, body);
        sent = true;
        break;
      } catch (error) {
        if (!(error instanceof AxiosError) || error.response?.status !== 404) {
          throw error;
        }
      }
    }

    if (!sent) {
      return NextResponse.json({ message: "Resend endpoint not available" }, { status: 500 });
    }

    return NextResponse.json({ sent: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 500;
      const message =
        typeof error.response?.data === "object" &&
        error.response?.data &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Unable to resend verification code";

      return NextResponse.json({ message }, { status });
    }

    return NextResponse.json({ message: "Unable to resend verification code" }, { status: 500 });
  }
}
