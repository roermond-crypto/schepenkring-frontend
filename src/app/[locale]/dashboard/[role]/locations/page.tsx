import { AdminLocationsManagerPage } from "@/components/dashboard/AdminLocationsManagerPage";

type AdminLocationsPageProps = {
  params: Promise<{ locale: string; role: string }>;
};

export default async function AdminLocationsPage({
  params,
}: AdminLocationsPageProps) {
  const { locale, role } = await params;

  return <AdminLocationsManagerPage locale={locale} role={role} />;
}
