import { type NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://app.schepen-kring.nl/api";

// Allow cross-origin calls from the public schepenkring.nl site.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/widget/boat-context?boat_id=2006423
 *
 * Resolves which location owns a boat and returns that location's widget
 * settings. Called by the embed script (chat.js) when it auto-detects a
 * boatId from the URL but has no explicit location_id.
 *
 * Tries two backend endpoints in order:
 *   1. /public/widget/boat-context?boat_id=X  (dedicated endpoint)
 *   2. /widget/context?boat_id=X              (general context endpoint)
 *
 * Expected response shape:
 *   { location_id, harbor_id?, harbor_name?, accent_color?, theme?, welcome_text? }
 */
export async function GET(request: NextRequest) {
  const boatId = request.nextUrl.searchParams.get("boat_id");

  if (!boatId || !/^\d+$/.test(boatId)) {
    return NextResponse.json(
      { error: "boat_id must be a numeric string" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const endpoints = [
    `${BACKEND}/public/widget/boat-context?boat_id=${boatId}`,
    `${BACKEND}/widget/context?boat_id=${boatId}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return NextResponse.json(normalise(data), { headers: CORS_HEADERS });
      }
    } catch {
      // try next endpoint
    }
  }

  return NextResponse.json(
    { error: "context_not_found" },
    { status: 404, headers: CORS_HEADERS },
  );
}

/**
 * Normalise the backend response to a stable shape the embed script expects.
 * Different endpoints may use slightly different key names.
 */
function normalise(raw: Record<string, unknown>) {
  const locationId =
    raw.location_id ??
    (raw.location as Record<string, unknown> | null | undefined)?.id ??
    raw.harbor_id ??
    null;

  const harborName =
    raw.harbor_name ??
    (raw.location as Record<string, unknown> | null | undefined)?.name ??
    raw.location_name ??
    null;

  const widgetSettings =
    (raw.widget_settings as Record<string, unknown> | null | undefined) ?? raw;

  return {
    location_id: locationId,
    harbor_id: locationId,
    harbor_name: harborName,
    accent_color: widgetSettings.accent_color ?? widgetSettings.accentColor ?? null,
    theme: widgetSettings.theme ?? widgetSettings.theme_preset ?? "ocean",
    welcome_text: widgetSettings.welcome_text ?? widgetSettings.welcomeText ?? null,
  };
}
