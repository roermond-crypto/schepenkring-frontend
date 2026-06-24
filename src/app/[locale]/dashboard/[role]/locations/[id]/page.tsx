import { LocationDetailPage } from "@/components/dashboard/LocationDetailPage";

type Props = {
  params: Promise<{ locale: string; role: string; id: string }>;
};

export default async function LocationDetailRoute({ params }: Props) {
  const { locale, role, id } = await params;
  return <LocationDetailPage locale={locale} role={role} locationId={Number(id)} />;
}
