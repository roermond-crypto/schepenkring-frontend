import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/lib/i18n";
import { ContextAwareChatWidget } from "@/components/widget/ContextAwareChatWidget";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <>
      {children}
      <ContextAwareChatWidget />
    </>
  );
}
