"use client";

import { useEffect, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import type { AppLocale } from "@/lib/i18n";

type NavItem = {
  id: number;
  label: Partial<Record<AppLocale, string>>;
  url: string;
  open_in_new_tab: boolean;
};

type FooterData = {
  footer: {
    columns: Record<string, NavItem[]>;
    settings: {
      footer_tagline: Partial<Record<AppLocale, string>> | null;
      contact_email: string | null;
      contact_phone: string | null;
      contact_address: string | null;
      social_links: { platform: string; url: string }[] | null;
    };
  };
};

const COLUMN_TITLES: Record<string, Partial<Record<AppLocale, string>>> = {
  company: { nl: "Schepenkring", en: "Schepenkring", de: "Schepenkring", fr: "Schepenkring" },
  support: { nl: "Verkopen", en: "Selling", de: "Verkaufen", fr: "Vendre" },
  general: { nl: "Meer", en: "More", de: "Mehr", fr: "Plus" },
};

export function PublicFooter({ locale }: { locale: AppLocale }) {
  const [data, setData] = useState<FooterData["footer"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: FooterData }>("/navigation")
      .then((res) => {
        if (!cancelled) setData(res.data?.data?.footer ?? null);
      })
      .catch(() => {
        // No footer data — the component below already handles null
        // gracefully by only rendering what it has.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tagline = data?.settings.footer_tagline?.[locale] || data?.settings.footer_tagline?.nl;
  const columns = data?.columns ?? {};

  return (
    <footer className="bg-[#003566] text-white/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        <div className="sm:col-span-2 md:col-span-1">
          <p className="text-lg font-black text-white mb-2">Schepenkring</p>
          {tagline && <p className="text-sm text-white/60">{tagline}</p>}
        </div>

        {Object.entries(columns).map(([columnKey, items]) => (
          <div key={columnKey}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">
              {COLUMN_TITLES[columnKey]?.[locale] || COLUMN_TITLES[columnKey]?.nl || columnKey}
            </p>
            <ul className="space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target={item.open_in_new_tab ? "_blank" : undefined}
                    rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
                    className="hover:text-white transition-colors"
                  >
                    {item.label[locale] || item.label.nl || item.label.en || ""}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">
            {locale === "nl" ? "Contact" : locale === "de" ? "Kontakt" : locale === "fr" ? "Contact" : "Contact"}
          </p>
          <ul className="space-y-2 text-sm">
            {data?.settings.contact_address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/50" />
                <span>{data.settings.contact_address}</span>
              </li>
            )}
            {data?.settings.contact_phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-white/50" />
                <a href={`tel:${data.settings.contact_phone.replace(/\s+/g, "")}`} className="hover:text-white transition-colors">
                  {data.settings.contact_phone}
                </a>
              </li>
            )}
            {data?.settings.contact_email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-white/50" />
                <a href={`mailto:${data.settings.contact_email}`} className="hover:text-white transition-colors">
                  {data.settings.contact_email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Schepenkring
      </div>
    </footer>
  );
}
