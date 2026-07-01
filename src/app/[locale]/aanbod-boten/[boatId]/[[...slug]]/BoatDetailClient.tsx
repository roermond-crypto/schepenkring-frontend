"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Anchor, Ruler, Calendar, Gauge, MapPin } from "lucide-react";
import { LeadCaptureWidget } from "@/components/widget/LeadCaptureWidget";

type BoatData = Record<string, unknown>;

interface Props {
  boatId: number;
  locationId?: number;
  boat: BoatData | null;
  locale: string;
}

function field(b: BoatData, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = b[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

function formatPrice(b: BoatData): string | null {
  const raw = b.price ?? b.asking_price ?? b.sale_price ?? b.prijs;
  if (raw == null) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (isNaN(num) || num <= 0) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

function firstImageUrl(b: BoatData): string | null {
  const imgs = b.images ?? b.photos ?? b.fotos ?? b.afbeeldingen;
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const img = imgs[0];
  if (typeof img === "string") return img;
  if (img && typeof img === "object") {
    const obj = img as Record<string, unknown>;
    return String(obj.url ?? obj.src ?? obj.path ?? "") || null;
  }
  return null;
}

export default function BoatDetailClient({ boatId, locationId, boat, locale }: Props) {
  const name = boat ? (field(boat, "name", "title", "model") ?? `Boot ${boatId}`) : `Boot ${boatId}`;
  const price = boat ? formatPrice(boat) : null;
  const year = boat ? field(boat, "year", "build_year", "construction_year", "bouwjaar") : null;
  const length = boat ? field(boat, "length", "boat_length", "loa", "lengte") : null;
  const brand = boat ? field(boat, "brand", "make", "manufacturer", "merk") : null;
  const engine = boat ? field(boat, "engine", "engine_type", "motor") : null;
  const description = boat ? field(boat, "description", "details", "omschrijving") : null;
  const locationName = boat ? field(boat, "location_name", "harbor_name", "vestiging") : null;
  const status = boat ? field(boat, "status") : null;
  const heroImage = boat ? firstImageUrl(boat) : null;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      "For Sale": "Te koop",
      "For Bid": "In veiling",
      Sold: "Verkocht",
      Active: "Actief",
      Draft: "Concept",
    };
    return map[s] ?? s;
  };

  const statusColor = (s: string) => {
    if (s === "For Sale" || s === "Active") return "bg-green-100 text-green-700";
    if (s === "Sold") return "bg-gray-200 text-gray-600";
    if (s === "For Bid") return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#003566] transition-colors"
          >
            <ArrowLeft size={15} />
            Terug
          </Link>
          <div className="flex-1" />
          <Image
            src="/schepenkring-logo.png"
            alt="Schepenkring"
            width={130}
            height={34}
            className="h-8 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </header>

      {/* Hero image */}
      {heroImage ? (
        <div className="relative h-72 w-full overflow-hidden bg-gray-200 sm:h-96">
          <Image
            src={heroImage}
            alt={name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-[#003566]/8 sm:h-64">
          <Anchor size={72} className="text-[#003566]/20" />
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left column: boat details */}
          <div className="space-y-6 lg:col-span-7">
            <div>
              {status && (
                <span
                  className={`mb-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusColor(status)}`}
                >
                  {statusLabel(status)}
                </span>
              )}
              <h1 className="text-3xl font-bold text-[#003566]">{name}</h1>
              {price && (
                <p className="mt-2 text-2xl font-semibold text-[#C8102E]">{price}</p>
              )}
            </div>

            {/* Spec chips */}
            {(year || length || brand || engine) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {year && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                      <Calendar size={10} />
                      Bouwjaar
                    </div>
                    <p className="font-bold text-gray-800">{year}</p>
                  </div>
                )}
                {length && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                      <Ruler size={10} />
                      Lengte
                    </div>
                    <p className="font-bold text-gray-800">{length} m</p>
                  </div>
                )}
                {brand && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                      <Anchor size={10} />
                      Merk
                    </div>
                    <p className="font-bold text-gray-800">{brand}</p>
                  </div>
                )}
                {engine && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                      <Gauge size={10} />
                      Motor
                    </div>
                    <p className="font-bold text-gray-800">{engine}</p>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {description && (
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Omschrijving
                </h2>
                <p className="whitespace-pre-line leading-relaxed text-gray-700">
                  {description}
                </p>
              </div>
            )}

            {!boat && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                <p className="font-semibold">Bootgegevens tijdelijk niet beschikbaar</p>
                <p className="mt-1 text-sm">
                  Gebruik het contactformulier rechtsonder om meer informatie op te vragen.
                </p>
              </div>
            )}
          </div>

          {/* Right column: CTA card */}
          <div className="lg:col-span-5">
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
              <div className="bg-[#003566] px-5 py-4">
                <p className="text-sm font-medium text-blue-200">Interesse in dit jacht?</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {price ?? "Prijs op aanvraag"}
                </p>
              </div>

              <div className="space-y-4 px-5 py-5">
                <p className="text-sm text-gray-600">
                  Neem direct contact op met ons team via de contactknop rechtsonder.
                </p>

                <ul className="space-y-2.5">
                  {[
                    { icon: "📅", label: "Bezichtiging plannen" },
                    { icon: "💶", label: "Bod uitbrengen" },
                    { icon: "📄", label: "Brochure aanvragen" },
                    { icon: "📞", label: "Terugbelverzoek" },
                    { icon: "❓", label: "Vraag stellen" },
                  ].map(({ icon, label }) => (
                    <li key={label} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <span className="text-base leading-none">{icon}</span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>

                {locationName && (
                  <div className="flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-400">
                    <MapPin size={11} />
                    Vestiging: {locationName}
                  </div>
                )}

                <div className="rounded-lg bg-[#003566]/5 px-3 py-2.5 text-xs text-[#003566]">
                  Klik op de rode knop rechtsonder in uw scherm om contact op te nemen.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating lead-capture widget ──────────────────────────────
           Fixed container in the bottom-right corner.
           Collapsed: shows the 200 × 56 trigger button (items-end justify-end).
           Expanded: fills the 400 × 640 container with the form panel.
           pointer-events-none on the outer shell prevents the invisible
           portion of the container from blocking page clicks.            */}
      <div
        className="pointer-events-none fixed bottom-0 right-6 z-50"
        style={{ width: "400px", height: "640px" }}
      >
        <div className="pointer-events-auto h-full w-full">
          <LeadCaptureWidget
            boatId={boatId}
            locationId={locationId}
            locale={locale}
            isEmbedded={false}
          />
        </div>
      </div>
    </div>
  );
}
