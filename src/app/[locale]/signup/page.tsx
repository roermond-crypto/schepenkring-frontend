import { redirect } from "next/navigation";

type SignupPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignupPage({ params }: SignupPageProps) {
  const { locale } = await params;
  redirect(`/${locale}/auth?mode=register`);
}
