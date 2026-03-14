"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
    endpoint: string;
    name: string;
    placeholder?: string;
    defaultValue?: string | null;
    dependsOn?: string;
    dependsOnValue?: number | string | null;
    onSelect?: (id: number | string, name: string) => void;
    needsConfirmation?: boolean;
}

interface CatalogAutocompleteItem {
    id: number | string;
    name: string;
}

export function CatalogAutocomplete({
    endpoint,
    name,
    placeholder,
    defaultValue = "",
    dependsOn,
    dependsOnValue,
    onSelect,
    needsConfirmation
}: Props) {
    const [query, setQuery] = useState(defaultValue || "");
    const [results, setResults] = useState<CatalogAutocompleteItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

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
                    let url = `${endpoint}?q=${encodeURIComponent(query)}`;
                    if (dependsOn && dependsOnValue) {
                        url += `&${dependsOn}=${dependsOnValue}`;
                    }
                    // Assuming the api object auto-prepends /api or base url, but here we can just hit the absolute path /api/...
                    // If the project uses a custom api instance from "@/lib/api" we might have issues if it expects token auth
                    // Since /api/autocomplete is Public, standard fetch works.
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        setResults(data);
                    }
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
        <div className="relative" ref={wrapperRef}>
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
                    highlighted && "ring-2 ring-amber-400 border-amber-400 bg-amber-50"
                )}
            />

            {needsConfirmation && (
                <div className="absolute right-2 top-2 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded shadow-sm">
                    Verify AI
                </div>
            )}

            {isOpen && (query.length > 1) && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {loading ? (
                        <div className="p-3 text-sm text-slate-500 text-center">Searching Catalog...</div>
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
                        <div className="p-3 text-sm text-slate-400 text-center italic">No canonical match found.<br />Will be saved as new string.</div>
                    )}
                </div>
            )}
        </div>
    );
}
