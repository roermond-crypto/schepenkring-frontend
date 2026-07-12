import { notFound } from "next/navigation";
import Script from "next/script";
import { isSupportedLocale } from "@/lib/i18n";
import { GlobalChatWidget } from "@/components/widget/GlobalChatWidget";

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
      {/*
        The root layout (above this one, and the only layout allowed to
        render <html>) can't read this segment's `locale` param without
        opting into headers()-based dynamic rendering for the entire app —
        so it ships a static "nl" default. This script corrects it to the
        real locale before the page becomes interactive, which is early
        enough to prevent Chrome's language-mismatch-triggered "Translate
        this page?" prompt (the actual cause of a real incident where it
        mangled already-correct Dutch text, e.g. "boot" -> "laars").
      */}
      <Script
        id="set-html-lang"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(locale)};`,
        }}
      />
      {children}
      <GlobalChatWidget />
    </>
  );
}
