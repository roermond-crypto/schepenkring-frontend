import { LocationFormPage } from "@/components/dashboard/LocationFormPage";

type Props = {
  params: Promise<{ locale: string; role: string }>;
};

export default async function LocationNewRoute({ params }: Props) {
  const { locale, role } = await params;
  return <LocationFormPage locale={locale} role={role} />;
}
