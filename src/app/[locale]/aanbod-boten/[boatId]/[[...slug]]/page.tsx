import type { Metadata } from "next";
import BoatDetailClient from "./BoatDetailClient";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://app.schepen-kring.nl/api";

type BoatData = Record<string, unknown>;

async function fetchBoat(boatId: string): Promise<BoatData | null> {
  const urls = [
    `${BACKEND}/public/boats/${boatId}`,
    `${BACKEND}/public/yachts/${boatId}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) continue;
      const json = (await res.json()) as BoatData;
      return (json?.data ?? json?.boat ?? json?.yacht ?? json) as BoatData;
    } catch {
      /* try next */
    }
  }
  return null;
}

function boatDisplayName(b: BoatData | null, id: string): string {
  if (!b) return `Boot ${id}`;
  for (const key of ["name", "title", "model"]) {
    if (b[key] && String(b[key]).trim()) return String(b[key]);
  }
  return `Boot ${id}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; boatId: string }>;
}): Promise<Metadata> {
  const { boatId } = await params;
  const boat = await fetchBoat(boatId);
  const name = boatDisplayName(boat, boatId);
  return {
    title: `${name} | Schepenkring`,
    description: `Bekijk ${name} op Schepenkring — de grootste jachtmakelaar van Nederland.`,
    openGraph: {
      title: name,
      description: `Bekijk ${name} op Schepenkring`,
    },
  };
}

export default async function BoatDetailPage({
  params,
}: {
  params: Promise<{ locale: string; boatId: string; slug?: string[] }>;
}) {
  const { locale, boatId } = await params;
  const boat = await fetchBoat(boatId);

  const locationId =
    typeof boat?.location_id === "number"
      ? (boat.location_id as number)
      : typeof boat?.location_id === "string"
        ? parseInt(boat.location_id as string, 10)
        : undefined;

  return (
    <BoatDetailClient
      boatId={parseInt(boatId, 10)}
      locationId={Number.isNaN(locationId) ? undefined : locationId}
      boat={boat}
      locale={locale}
    />
  );
}
