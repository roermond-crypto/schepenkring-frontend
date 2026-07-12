import { type Metadata } from "next";
import { getDictionary, getLocaleOrDefault } from "@/lib/i18n";
import { BoatIntakePage, type CmsHeroContent } from "@/components/intake/BoatIntakePage";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://app.schepen-kring.nl/api";

type LocaleValue = Partial<Record<"nl" | "en" | "de" | "fr", string>>;
type LocaleListValue = Partial<Record<"nl" | "en" | "de" | "fr", string[]>>;

type CmsSection = {
  component: string;
  is_enabled: boolean;
  content: {
    badge?: LocaleValue;
    title?: LocaleValue;
    subtitle?: LocaleValue;
    trust_items?: LocaleListValue;
  };
};

type CmsPageData = {
  status: string;
  seo?: { title?: LocaleValue; description?: LocaleValue } | null;
  sections: CmsSection[];
};

// Content for this page now lives in the CMS (see /dashboard/admin/content)
// rather than being hardcoded here — this fetch is the only thing standing
// between "edit it in the admin" and "ask a developer to redeploy." Falls
// back to null (and the component's own locales/*.json-driven defaults) on
// any failure, so a CMS outage or an unpublished page never breaks this
// live public page.
async function fetchCmsPage(locale: string): Promise<CmsPageData | null> {
  try {
    const res = await fetch(`${BACKEND}/cms/pages/boot-aanmelden`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: CmsPageData };
    return json.data ?? null;
  } catch {
    return null;
  }
}

function localeValue(value: LocaleValue | undefined, locale: string): string | undefined {
  const v = value?.[locale as keyof LocaleValue];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function localeList(value: LocaleListValue | undefined, locale: string): string[] | undefined {
  const v = value?.[locale as keyof LocaleListValue];
  return Array.isArray(v) && v.length > 0 ? v : undefined;
}

function extractHero(page: CmsPageData | null, locale: string): CmsHeroContent | undefined {
  const hero = page?.sections.find((s) => s.component === "HeroSection" && s.is_enabled);
  if (!hero) return undefined;

  return {
    badge: localeValue(hero.content.badge, locale),
    title: localeValue(hero.content.title, locale),
    subtitle: localeValue(hero.content.subtitle, locale),
    trustItems: localeList(hero.content.trust_items, locale),
  };
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = getLocaleOrDefault(rawLocale);
  const page = await fetchCmsPage(locale);

  const title = localeValue(page?.seo?.title, locale) ?? "Boot aanmelden — Schepenkring";
  const description =
    localeValue(page?.seo?.description, locale) ??
    "Meld uw boot gratis en vrijblijvend aan bij Schepenkring.";

  return { title, description };
}

export default async function BootAanmeldenPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = getLocaleOrDefault(rawLocale);
  const dict = getDictionary(locale);
  const t = (dict as Record<string, unknown>).BoatIntake as Record<string, unknown>;

  const page = await fetchCmsPage(locale);
  const cmsHero = extractHero(page, locale);

  return <BoatIntakePage locale={locale} t={t} cmsHero={cmsHero} />;
}
