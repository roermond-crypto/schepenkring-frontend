import type { Metadata, Viewport } from "next";
import { Geist, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/common/ServiceWorkerRegister";
import Script from "next/script";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${inter.variable} ${playfair.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places&loading=async`}
          strategy="afterInteractive"
        />
        <ServiceWorkerRegister />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
