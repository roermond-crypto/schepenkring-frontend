import { NextRequest, NextResponse } from "next/server";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth/session";
import { normalizeApiBaseUrl } from "@/lib/api/base-url";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function handleProxy(request: NextRequest, path: string[]) {
  const configuredBackendUrl =
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://app.schepen-kring.nl/api";

  const backendUrl = normalizeApiBaseUrl(configuredBackendUrl);

  const method = request.method;

  if (!ALLOWED_METHODS.includes(method as (typeof ALLOWED_METHODS)[number])) {
    return NextResponse.json({ message: `Method ${method} is not allowed` }, { status: 405 });
  }

  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const targetUrl = `${backendUrl.replace(/\/$/, "")}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);

  // Strip hop-by-hop headers — undici (Node fetch) rejects requests that
  // include Connection, Keep-Alive, etc. as they are transport-layer only.
  for (const h of ["host", "connection", "keep-alive", "transfer-encoding",
                    "te", "trailer", "upgrade", "proxy-authorization",
                    "proxy-authenticate"]) {
    headers.delete(h);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    method,
    headers,
    // arrayBuffer() preserves raw bytes for both JSON and multipart/form-data uploads.
    // request.text() was corrupting binary image data by decoding it as UTF-8.
    body: method === "GET" ? undefined : await request.arrayBuffer(),
  };

  const backendResponse = await fetch(targetUrl, init);
  // Use arrayBuffer to preserve raw bytes — .text() corrupts binary responses
  // (PDFs, images) by decoding them as UTF-8 and replacing invalid sequences.
  const data = await backendResponse.arrayBuffer();

  return new NextResponse(data, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleProxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleProxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleProxy(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleProxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleProxy(request, path);
}
