import { type AppLocale } from "@/lib/i18n";

type LandingPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export default async function LandingPage({ params }: LandingPageProps) {
  await params;

  return <main className="min-h-screen" />;
}
