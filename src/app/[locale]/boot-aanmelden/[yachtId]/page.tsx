import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getLocaleOrDefault, isSupportedLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; yachtId: string }> };

// /boot-aanmelden only ever creates a new BoatIntake draft — it has no
// concept of editing an existing Yacht. Rather than building a second
// wizard implementation here, this route satisfies the "edit via
// /boot-aanmelden/{yacht}" URL from the spec as a thin, authenticated
// redirect into the dashboard editor, where ownership is already enforced
// (Yacht update/show is gated by YachtController::authorizeYachtAccess())
// and the seller-mode restrictions from this same change apply.
export default async function BootAanmeldenYachtRedirectPage({ params }: Props) {
  const { locale: rawLocale, yachtId } = await params;

  if (!isSupportedLocale(rawLocale)) {
    notFound();
  }

  const locale = getLocaleOrDefault(rawLocale);
  const session = await getServerSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  redirect(`/${locale}/dashboard/${session.user.role}/yachts/${yachtId}`);
}
