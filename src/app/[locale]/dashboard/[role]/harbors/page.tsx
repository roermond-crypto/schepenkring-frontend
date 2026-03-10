import { AdminLocationsManagerPage } from "@/components/dashboard/AdminLocationsManagerPage";

type LegacyHarborsPageProps = {
  params: Promise<{ locale: string; role: string }>;
};

export default async function LegacyHarborsPage({
  params,
}: LegacyHarborsPageProps) {
  const { locale, role } = await params;

  return <AdminLocationsManagerPage locale={locale} role={role} />;
}
