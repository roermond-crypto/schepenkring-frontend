import { redirect } from "next/navigation";

type LegacyHarborWidgetPageProps = {
  params: Promise<{ locale: string; role: string }>;
};

export default async function LegacyHarborWidgetPage({
  params,
}: LegacyHarborWidgetPageProps) {
  const { locale, role } = await params;
  redirect(`/${locale}/dashboard/${role}/locations/widget`);
}
