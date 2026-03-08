import { redirect } from "next/navigation";

type LegacyHarborPerformancePageProps = {
  params: Promise<{ locale: string; role: string }>;
};

export default async function LegacyHarborPerformancePage({
  params,
}: LegacyHarborPerformancePageProps) {
  const { locale, role } = await params;
  redirect(`/${locale}/dashboard/${role}/performance`);
}
