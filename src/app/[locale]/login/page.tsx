import { redirect } from "next/navigation";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  redirect(`/${locale}/auth?mode=login`);
}
