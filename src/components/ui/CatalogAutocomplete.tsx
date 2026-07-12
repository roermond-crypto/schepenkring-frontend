"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, X, Merge, Loader2 } from "lucide-react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { BoatFieldSettingsLink } from "@/components/yachts/BoatFieldSettingsLink";
import { api } from "@/lib/api";

interface Props {
    /** Matches BoatField.internal_key — e.g. "manufacturer", "model", "boat_type". */
    fieldKey: string;
    name: string;
    placeholder?: string;
    defaultValue?: string | null;
    onSelect?: (id: number | string, value: string) => void;
    needsConfirmation?: boolean;
    showAdminEditLink?: boolean;
    showIcon?: boolean;
    /** Show inline archive/merge affordances — pass true only for admin/employee roles. */
    allowManage?: boolean;
    /**
     * Scopes results to values linked to this parent catalog_values id
     * (e.g. pass the selected Brand's id here for a Model field). Values
     * with no recorded parent still show — the backend filter is
     * inclusive, not exclusive — and this id is also attached when a new
     * value is created, so a Model created while a Brand is selected gets
     * linked to it automatically.
     */
    parentValueId?: number | null;
}

interface CatalogValueItem {
    id: number;
    value: string;
    field_key: string;
    usage_count: number;
    status: string;
}

const TEXT = {
    en: {
        searching: "Searching catalog...",
        noMatch: "No match found.",
        addNew: (q: string) => `Add "${q}" as new value`,
        similarFound: "Similar values already exist:",
        createAnyway: "Create new value anyway",
        cancel: "Cancel",
        used: (n: number) => `used by ${n}`,
        archive: "Archive",
        cannotArchive: "In use — merge into another value to archive",
        mergeInto: (v: string) => `Merging "${v}" into...`,
        pickTarget: "Choose a value to merge into",
        manageDisabled: "New values are not allowed for this field.",
    },
    nl: {
        searching: "Catalogus wordt doorzocht...",
        noMatch: "Geen match gevonden.",
        addNew: (q: string) => `"${q}" toevoegen als nieuwe waarde`,
        similarFound: "Vergelijkbare waarden bestaan al:",
        createAnyway: "Toch nieuwe waarde aanmaken",
        cancel: "Annuleren",
        used: (n: number) => `gebruikt door ${n}`,
        archive: "Archiveren",
        cannotArchive: "In gebruik — samenvoegen om te archiveren",
        mergeInto: (v: string) => `"${v}" samenvoegen met...`,
        pickTarget: "Kies een waarde om mee samen te voegen",
        manageDisabled: "Nieuwe waarden zijn niet toegestaan voor dit veld.",
    },
    de: {
        searching: "Katalog wird durchsucht...",
        noMatch: "Keine Übereinstimmung gefunden.",
        addNew: (q: string) => `"${q}" als neuen Wert hinzufügen`,
        similarFound: "Ähnliche Werte existieren bereits:",
        createAnyway: "Trotzdem neuen Wert erstellen",
        cancel: "Abbrechen",
        used: (n: number) => `verwendet von ${n}`,
        archive: "Archivieren",
        cannotArchive: "In Verwendung — zum Archivieren zusammenführen",
        mergeInto: (v: string) => `"${v}" zusammenführen mit...`,
        pickTarget: "Zielwert auswählen",
        manageDisabled: "Neue Werte sind für dieses Feld nicht erlaubt.",
    },
    fr: {
        searching: "Recherche dans le catalogue...",
        noMatch: "Aucune correspondance trouvée.",
        addNew: (q: string) => `Ajouter "${q}" comme nouvelle valeur`,
        similarFound: "Des valeurs similaires existent déjà :",
        createAnyway: "Créer quand même une nouvelle valeur",
        cancel: "Annuler",
        used: (n: number) => `utilisé par ${n}`,
        archive: "Archiver",
        cannotArchive: "En cours d'utilisation — fusionner pour archiver",
        mergeInto: (v: string) => `Fusionner "${v}" avec...`,
        pickTarget: "Choisir une valeur cible",
        manageDisabled: "Les nouvelles valeurs ne sont pas autorisées pour ce champ.",
    },
} as const;

export function CatalogAutocomplete({
    fieldKey,
    name,
    placeholder,
    defaultValue = "",
    onSelect,
    needsConfirmation,
    showAdminEditLink = true,
    showIcon = false,
    allowManage = false,
    parentValueId = null,
}: Props) {
    const locale = useLocale();
    const text = TEXT[locale as keyof typeof TEXT] ?? TEXT.en;
    const [query, setQuery] = useState(defaultValue || "");
    const [results, setResults] = useState<CatalogValueItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [meta, setMeta] = useState<{ allow_new_values: boolean; allow_inline_archive: boolean } | null>(null);
    const [suggestions, setSuggestions] = useState<CatalogValueItem[] | null>(null);
    const [creating, setCreating] = useState(false);
    const [mergingFrom, setMergingFrom] = useState<CatalogValueItem | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const shouldShowAdminEditLink = showAdminEditLink && Boolean(name);

    useEffect(() => {
        setQuery(defaultValue || "");
    }, [defaultValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSuggestions(null);
                setMergingFrom(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (!isOpen) return;
            setLoading(true);
            try {
                const res = await api.get<{ data: CatalogValueItem[]; meta: { field: { allow_new_values: boolean; allow_inline_archive: boolean } | null } }>(
                    "catalog-values",
                    {
                        params: {
                            field_key: fieldKey,
                            q: query,
                            limit: 20,
                            ...(parentValueId ? { parent_value_id: parentValueId } : {}),
                        },
                    },
                );
                setResults(Array.isArray(res.data?.data) ? res.data.data : []);
                setMeta(res.data?.meta?.field ?? null);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, isOpen, fieldKey, parentValueId]);

    const highlighted = Boolean(needsConfirmation) || (query && query.trim().length > 0);
    const normalizedQuery = query.trim().toLowerCase();
    const exactMatch = results.some((r) => r.value.trim().toLowerCase() === normalizedQuery);
    const canOfferCreate =
        !mergingFrom && normalizedQuery !== "" && !exactMatch && (meta ? meta.allow_new_values : true);

    const selectValue = (item: CatalogValueItem) => {
        setQuery(item.value);
        setIsOpen(false);
        setSuggestions(null);
        onSelect?.(item.id, item.value);
    };

    const createValue = async (force = false) => {
        setCreating(true);
        try {
            const res = await api.post<{ data: CatalogValueItem }>("catalog-values", {
                field_key: fieldKey,
                value: query.trim(),
                force,
                ...(parentValueId ? { parent_value_id: parentValueId } : {}),
            });
            setSuggestions(null);
            selectValue(res.data.data);
        } catch (e: any) {
            const backendSuggestions = e?.response?.data?.suggestions;
            if (Array.isArray(backendSuggestions) && backendSuggestions.length > 0) {
                setSuggestions(backendSuggestions);
            } else {
                console.error(e);
            }
        } finally {
            setCreating(false);
        }
    };

    const archiveOrMerge = async (item: CatalogValueItem) => {
        if (item.usage_count > 0) {
            setMergingFrom(item);
            return;
        }
        setBusyId(item.id);
        try {
            await api.post(`admin/catalog-values/${item.id}/archive`, {});
            setResults((prev) => prev.filter((r) => r.id !== item.id));
        } catch (e) {
            console.error(e);
        } finally {
            setBusyId(null);
        }
    };

    const confirmMerge = async (target: CatalogValueItem) => {
        if (!mergingFrom) return;
        setBusyId(mergingFrom.id);
        try {
            await api.post(`admin/catalog-values/${mergingFrom.id}/merge`, { target_id: target.id });
            setResults((prev) => prev.filter((r) => r.id !== mergingFrom.id));
            setMergingFrom(null);
        } catch (e) {
            console.error(e);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div
            className={cn("relative", isOpen && "z-[120]")}
            ref={wrapperRef}
        >
            {showIcon && (
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
            )}
            <input
                type="text"
                name={name}
                value={query}
                autoComplete="off"
                placeholder={placeholder}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setSuggestions(null);
                }}
                onFocus={() => setIsOpen(true)}
                className={cn(
                    "w-full bg-white border border-slate-200 rounded-md py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
                    showIcon ? "pl-10 pr-3.5" : "px-3.5",
                    "hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
                    shouldShowAdminEditLink && "pr-12",
                    highlighted && "ring-2 ring-amber-400 border-amber-400 bg-amber-50",
                )}
            />

            {shouldShowAdminEditLink && (
                <BoatFieldSettingsLink
                    fieldName={name}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                />
            )}

            {isOpen && (
                <div className="absolute left-0 top-full z-[140] mt-1 w-full rounded-md border border-slate-200 bg-white shadow-xl max-h-72 overflow-auto">
                    {mergingFrom && (
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-800 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1"><Merge className="h-3 w-3" /> {text.mergeInto(mergingFrom.value)}</span>
                            <button
                                type="button"
                                className="text-amber-600 hover:text-amber-800"
                                onClick={() => setMergingFrom(null)}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {suggestions && suggestions.length > 0 && (
                        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
                            <p className="text-xs font-semibold text-blue-800 mb-1.5">{text.similarFound}</p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => selectValue(s)}
                                        className="text-xs px-2 py-1 rounded-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"
                                    >
                                        {s.value}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => void createValue(true)}
                                disabled={creating}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
                            >
                                {creating ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : null}
                                {text.createAnyway}
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="p-3 text-sm text-slate-500 text-center">{text.searching}</div>
                    ) : results.length > 0 || canOfferCreate ? (
                        <ul className="py-1">
                            {results.map((item) => (
                                <li
                                    key={item.id}
                                    className="px-4 py-2 text-sm hover:bg-blue-50 cursor-pointer font-medium text-slate-800 flex items-center justify-between gap-2 group"
                                    onClick={() => (mergingFrom ? void confirmMerge(item) : selectValue(item))}
                                >
                                    <span className="truncate">{item.value}</span>
                                    <span className="flex items-center gap-2 flex-shrink-0">
                                        {item.usage_count > 0 && (
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                {text.used(item.usage_count)}
                                            </span>
                                        )}
                                        {allowManage && !mergingFrom && meta?.allow_inline_archive && (
                                            <button
                                                type="button"
                                                title={item.usage_count > 0 ? text.cannotArchive : text.archive}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void archiveOrMerge(item);
                                                }}
                                                disabled={busyId === item.id}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                                            >
                                                {busyId === item.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : item.usage_count > 0 ? (
                                                    <Merge className="h-3.5 w-3.5" />
                                                ) : (
                                                    <X className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                            {canOfferCreate && (
                                <li
                                    className="px-4 py-2 text-sm hover:bg-emerald-50 cursor-pointer font-semibold text-emerald-700 border-t border-slate-100"
                                    onClick={() => void createValue(false)}
                                >
                                    {creating ? <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                    {text.addNew(query.trim())}
                                </li>
                            )}
                        </ul>
                    ) : mergingFrom ? (
                        <div className="p-3 text-xs text-slate-400 text-center italic">{text.pickTarget}</div>
                    ) : (
                        <div className="p-3 text-sm text-slate-400 text-center italic">
                            {text.noMatch}
                            {meta && !meta.allow_new_values && (
                                <>
                                    <br />
                                    {text.manageDisabled}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
