import type { Metadata, Viewport } from "next";
import { Geist, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/common/ServiceWorkerRegister";
import Script from "next/script";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Schepenkring CRM",
  description:
    "Internal control center for boats, clients, leads, and operations.",

  manifest: "/manifest.json",
  // The app has its own NL/EN/DE/FR i18n system — Chrome's automatic
  // "Translate this page?" prompt has no business running on top of it,
  // and (per a real production incident) can mangle already-correct
  // translated text when it misfires. See [locale]/layout.tsx for the
  // other half of this fix (a stale hardcoded <html lang="en"> was the
  // actual trigger — corrected there via a synchronous inline script
  // rather than here via headers(), which would force every route in the
  // app to render dynamically and lose static generation entirely).
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // DEFAULT_LOCALE ("nl") as a static fallback — [locale]/layout.tsx
    // corrects this to the real locale client-side before paint.
    <html lang={DEFAULT_LOCALE} translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body
        className={`${geistSans.variable} ${inter.variable} ${playfair.variable} antialiased`}
        suppressHydrationWarning
      >
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places&loading=async`}
            strategy="afterInteractive"
          />
        )}
        <ServiceWorkerRegister />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
