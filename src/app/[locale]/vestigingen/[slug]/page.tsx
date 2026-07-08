import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Mail, Globe, Clock, Anchor } from "lucide-react";
import { PublicHeader } from "@/components/common/PublicHeader";
import { getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://app.schepen-kring.nl/api";

type TeamMember = {
  id: number;
  name: string;
  avatar?: string | null;
  role?: string | null;
};

type Boat = {
  id: number;
  name: string;
  price?: number | null;
  year?: number | null;
  main_image_url?: string | null;
};

type OpeningHours = Record<string, { open?: string; close?: string; closed?: boolean } | null>;

type LocationData = {
  id: number;
  name: string;
  slug: string;
  code?: string | null;
  address_line1?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_hours?: OpeningHours | null;
  hero_image?: string | null;
  location_color?: string | null;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  team: TeamMember[];
  boats: Boat[];
};

async function fetchLocation(slug: string, locale: string): Promise<LocationData | null> {
  try {
    const res = await fetch(
      `${BACKEND}/public/locations/${encodeURIComponent(slug)}?locale=${locale}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as LocationData;
  } catch {
    return null;
  }
}

function formatAddress(loc: LocationData): string {
  const street = [loc.address_line1, loc.street_number].filter(Boolean).join(" ");
  const cityLine = [loc.postal_code, loc.city].filter(Boolean).join(" ");
  return [street, cityLine, loc.country].filter(Boolean).join(", ");
}

function formatPrice(price?: number | null): string | null {
  if (price == null || price <= 0) return null;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

const DAY_LABELS: Record<string, string> = {
  mon: "Maandag",
  tue: "Dinsdag",
  wed: "Woensdag",
  thu: "Donderdag",
  fri: "Vrijdag",
  sat: "Zaterdag",
  sun: "Zondag",
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const location = await fetchLocation(slug, locale);

  if (!location) {
    return { title: "Vestiging niet gevonden | Schepenkring" };
  }

  const title = location.seo_title || `${location.name} | Schepenkring`;
  const description =
    location.seo_description ||
    `Bekijk vestiging ${location.name} van Schepenkring — adres, openingstijden, team en het bootaanbod.`;

  return {
    title,
    description,
    keywords: location.seo_keywords || undefined,
    openGraph: {
      title,
      description,
      images: location.hero_image ? [location.hero_image] : undefined,
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    return notFound();
  }
  const currentLocale = getLocaleOrDefault(locale);

  const location = await fetchLocation(slug, currentLocale);
  if (!location) {
    return notFound();
  }

  const address = formatAddress(location);
  const mapSrc =
    location.latitude && location.longitude
      ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`
      : address
        ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`
        : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader locale={currentLocale} />

      {/* Hero */}
      <div className="relative flex h-64 items-end overflow-hidden bg-[#003566] sm:h-80">
        {location.hero_image ? (
          <Image
            src={location.hero_image}
            alt={location.name}
            fill
            priority
            unoptimized
            className="object-cover opacity-70"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">
            Schepenkring vestiging
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{location.name}</h1>
          {address ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-white/85">
              <MapPin size={15} /> {address}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-10 lg:col-span-2">
          {location.description ? (
            <section>
              <h2 className="mb-3 text-lg font-bold text-[#003566]">Over deze vestiging</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {location.description}
              </p>
            </section>
          ) : null}

          {location.team.length > 0 ? (
            <section>
              <h2 className="mb-4 text-lg font-bold text-[#003566]">Ons team</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {location.team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#003566]/10 text-sm font-bold text-[#003566]">
                      {member.avatar ? (
                        <Image
                          src={member.avatar}
                          alt={member.name}
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        member.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      {member.role ? (
                        <p className="text-xs text-slate-500">{member.role}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#003566]">
              <Anchor size={18} /> Boten te koop bij {location.name}
            </h2>
            {location.boats.length === 0 ? (
              <p className="text-sm text-slate-500">
                Deze vestiging heeft op dit moment geen boten in de aanbieding.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {location.boats.map((boat) => (
                  <Link
                    key={boat.id}
                    href={`/${currentLocale}/aanbod-boten/${boat.id}`}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-[#003566] hover:shadow-md"
                  >
                    <div className="relative h-36 w-full bg-slate-100">
                      {boat.main_image_url ? (
                        <Image
                          src={boat.main_image_url}
                          alt={boat.name}
                          fill
                          unoptimized
                          className="object-cover transition group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <p className="truncate text-sm font-semibold text-slate-900">{boat.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[boat.year, formatPrice(boat.price)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
              Contact
            </h2>
            <ul className="space-y-3 text-sm text-slate-700">
              {address ? (
                <li className="flex items-start gap-2.5">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-[#003566]" />
                  <span>{address}</span>
                </li>
              ) : null}
              {location.phone ? (
                <li className="flex items-center gap-2.5">
                  <Phone size={16} className="shrink-0 text-[#003566]" />
                  <a href={`tel:${location.phone}`} className="hover:text-[#003566]">
                    {location.phone}
                  </a>
                </li>
              ) : null}
              {location.email ? (
                <li className="flex items-center gap-2.5">
                  <Mail size={16} className="shrink-0 text-[#003566]" />
                  <a href={`mailto:${location.email}`} className="hover:text-[#003566]">
                    {location.email}
                  </a>
                </li>
              ) : null}
              {location.website ? (
                <li className="flex items-center gap-2.5">
                  <Globe size={16} className="shrink-0 text-[#003566]" />
                  <a
                    href={location.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#003566]"
                  >
                    {location.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {location.opening_hours ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <Clock size={15} /> Openingstijden
              </h2>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {DAY_ORDER.filter((day) => location.opening_hours?.[day] !== undefined).map(
                  (day) => {
                    const hours = location.opening_hours?.[day];
                    return (
                      <li key={day} className="flex justify-between">
                        <span className="text-slate-500">{DAY_LABELS[day]}</span>
                        <span className="font-medium">
                          {!hours || hours.closed
                            ? "Gesloten"
                            : `${hours.open ?? "—"} – ${hours.close ?? "—"}`}
                        </span>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          ) : null}

          {mapSrc ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={mapSrc}
                title={`Kaart ${location.name}`}
                className="h-56 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
