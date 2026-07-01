import { LocationFormPage } from "@/components/dashboard/LocationFormPage";

type Props = {
  params: Promise<{ locale: string; role: string; id: string }>;
};

export default async function LocationEditRoute({ params }: Props) {
  const { locale, role, id } = await params;
  return (
    <LocationFormPage locale={locale} role={role} locationId={Number(id)} />
  );
}
