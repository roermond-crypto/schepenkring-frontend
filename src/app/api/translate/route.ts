import { NextRequest, NextResponse } from "next/server";

const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL ?? "api@schepen-kring.nl";

export async function POST(request: NextRequest) {
  let body: { texts?: string[]; targetLang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { texts, targetLang = "nl" } = body;
  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ translations: [] });
  }

  // Translate each text via MyMemory (free, no key needed, 10k words/day with email)
  const results = await Promise.all(
    texts.map(async (text) => {
      if (!text || !text.trim()) return text;
      try {
        const url = new URL("https://api.mymemory.translated.net/get");
        url.searchParams.set("q", text.slice(0, 500));
        url.searchParams.set("langpair", `en|${targetLang}`);
        url.searchParams.set("de", MYMEMORY_EMAIL);

        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "Schepenkring/1.0" },
          next: { revalidate: 86400 }, // cache 24h at CDN level
        });

        if (!res.ok) return text;
        const data = (await res.json()) as {
          responseStatus?: number;
          responseData?: { translatedText?: string };
        };

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
        return text;
      } catch {
        return text; // graceful fallback to original on error
      }
    }),
  );

  return NextResponse.json({ translations: results });
}
