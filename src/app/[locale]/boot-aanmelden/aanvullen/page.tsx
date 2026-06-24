import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function AanvullenPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;

  // Redirect to the main intake page; the token is read from the URL there.
  const dest = token
    ? `/${locale}/boot-aanmelden?token=${encodeURIComponent(token)}`
    : `/${locale}/boot-aanmelden`;

  redirect(dest);
}
