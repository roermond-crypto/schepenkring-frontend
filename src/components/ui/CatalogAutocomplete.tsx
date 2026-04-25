"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { BoatFieldSettingsLink } from "@/components/yachts/BoatFieldSettingsLink";
import { api } from "@/lib/api";

interface Props {
    endpoint: string;
    name: string;
    placeholder?: string;
    defaultValue?: string | null;
    dependsOn?: string;
    dependsOnValue?: number | string | null;
    onSelect?: (id: number | string, name: string) => void;
    needsConfirmation?: boolean;
    showAdminEditLink?: boolean;
}

interface CatalogAutocompleteItem {
    id: number | string;
    name: string;
}

const CATALOG_TEXT = {
    en: {
        verifyAi: "Verify AI",
        searching: "Searching catalog...",
        noMatch: "No canonical match found.",
        saveAsNew: "Will be saved as new string.",
    },
    nl: {
        verifyAi: "Controleer AI",
        searching: "Catalogus wordt doorzocht...",
        noMatch: "Geen canonieke match gevonden.",
        saveAsNew: "Wordt opgeslagen als nieuwe waarde.",
    },
    de: {
        verifyAi: "KI prufen",
        searching: "Katalog wird durchsucht...",
        noMatch: "Kein kanonischer Treffer gefunden.",
        saveAsNew: "Wird als neuer Wert gespeichert.",
    },
    fr: {
        verifyAi: "Verifier l'IA",
        searching: "Recherche dans le catalogue...",
        noMatch: "Aucune correspondance canonique trouvee.",
        saveAsNew: "Sera enregistre comme nouvelle valeur.",
    },
} as const;

export function CatalogAutocomplete({
    endpoint,
    name,
    placeholder,
    defaultValue = "",
    dependsOn,
    dependsOnValue,
    onSelect,
    needsConfirmation,
    showAdminEditLink = true,
}: Props) {
    const locale = useLocale();
    const text = CATALOG_TEXT[locale as keyof typeof CATALOG_TEXT] ?? CATALOG_TEXT.en;
    const [query, setQuery] = useState(defaultValue || "");
    const [results, setResults] = useState<CatalogAutocompleteItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const shouldShowAdminEditLink = showAdminEditLink && Boolean(name);

    useEffect(() => {
        setQuery(defaultValue || "");
    }, [defaultValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 1 && isOpen) {
                setLoading(true);
                try {
                    const normalizedEndpoint = endpoint.replace(/^\/api\//, "").replace(/^\//, "");
                    const params: Record<string, number | string> = { q: query };
                    if (dependsOn && dependsOnValue) {
                        params[dependsOn] = dependsOnValue;
                    }
                    const res = await api.get<CatalogAutocompleteItem[]>(normalizedEndpoint, { params });
                    setResults(Array.isArray(res.data) ? res.data : []);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, isOpen, endpoint, dependsOn, dependsOnValue]);

    const highlighted = Boolean(needsConfirmation) || (query && query.trim().length > 0);

    return (
        <div
            className={cn("relative", isOpen && query.length > 1 && "z-[120]")}
            ref={wrapperRef}
        >
            <input
                type="text"
                name={name}
                value={query}
                autoComplete="off"
                placeholder={placeholder}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className={cn(
                    "w-full bg-white border border-slate-200 rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                    "hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
                    shouldShowAdminEditLink && "pr-12",
                    highlighted && "ring-2 ring-amber-400 border-amber-400 bg-amber-50"
                )}
            />

            {shouldShowAdminEditLink && (
                <BoatFieldSettingsLink
                    fieldName={name}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                />
            )}

            {needsConfirmation && (
                <div
                    className={cn(
                        "absolute top-2 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded shadow-sm",
                        shouldShowAdminEditLink ? "right-11" : "right-2",
                    )}
                >
                    {text.verifyAi}
                </div>
            )}

            {isOpen && (query.length > 1) && (
                <div className="absolute left-0 top-full z-[140] mt-1 w-full rounded-md border border-slate-200 bg-white shadow-xl max-h-60 overflow-auto">
                    {loading ? (
                        <div className="p-3 text-sm text-slate-500 text-center">{text.searching}</div>
                    ) : results.length > 0 ? (
                        <ul className="py-1">
                            {results.map((item) => (
                                <li
                                    key={item.id}
                                    className="px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer font-medium text-slate-800"
                                    onClick={() => {
                                        setQuery(item.name);
                                        setIsOpen(false);
                                        if (onSelect) onSelect(item.id, item.name);
                                    }}
                                >
                                    {item.name}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-3 text-sm text-slate-400 text-center italic">{text.noMatch}<br />{text.saveAsNew}</div>
                    )}
                </div>
            )}
        </div>
    );
}
