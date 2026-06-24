import { type Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { BoatIntakePage } from "@/components/intake/BoatIntakePage";

export const metadata: Metadata = {
  title: "Boot aanmelden — Schepenkring",
  description: "Meld uw boot gratis en vrijblijvend aan bij Schepenkring.",
};

type Props = { params: Promise<{ locale: string }> };

export default async function BootAanmeldenPage({ params }: Props) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const t = (dict as Record<string, unknown>).BoatIntake as Record<string, unknown>;

  return <BoatIntakePage locale={locale} t={t} />;
}
