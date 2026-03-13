"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type SuggestionResponse = {
    consensus_values?: Record<string, any>;
    field_confidence?: Record<string, number>;
    field_sources?: Record<string, string>;
    top_matches?: any[];
    warnings?: string[];
};

const suggestionCache = new Map<string, SuggestionResponse>();
const suggestionInFlight = new Map<string, Promise<SuggestionResponse>>();
const autoAppliedSignatures = new Set<string>();

interface BoatCreationAssistantProps {
    manufacturer: string;
    model: string;
    onApply: (specs: Record<string, any>, mode?: "manual" | "auto") => void;
    autoApply?: boolean;
}

export function BoatCreationAssistant({
    manufacturer,
    model,
    onApply,
    autoApply = false,
}: BoatCreationAssistantProps) {
    const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastQuery, setLastQuery] = useState("");

    const query = `${manufacturer} ${model}`.replace(/\s+/g, " ").trim();
    const queryKey = query.toLowerCase();

    useEffect(() => {
        if (query.length < 5 || queryKey === lastQuery) return;

        const cached = suggestionCache.get(queryKey);
        if (cached) {
            setSuggestions(cached);
            setLastQuery(queryKey);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                let pending = suggestionInFlight.get(queryKey);
                if (!pending) {
                    pending = api
                        .post("/ai/suggestions", { query })
                        .then((res) => res.data)
                        .finally(() => {
                            suggestionInFlight.delete(queryKey);
                        });
                    suggestionInFlight.set(queryKey, pending);
                }

                const data = await pending;
                if (data && data.consensus_values) {
                    suggestionCache.set(queryKey, data);
                    setSuggestions(data);
                    setLastQuery(queryKey);
                }
            } catch (e) {
                console.error("AI Suggestions failed", e);
            } finally {
                setIsLoading(false);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [query, queryKey, lastQuery]);

    useEffect(() => {
        const consensus = suggestions?.consensus_values || {};
        const hasSuggestions = Object.keys(consensus).length > 0;

        if (!autoApply || !hasSuggestions || isLoading) return;

        const signature = `${queryKey}::${JSON.stringify(consensus)}`;
        if (autoAppliedSignatures.has(signature)) return;
        autoAppliedSignatures.add(signature);
        onApply(consensus, "auto");
    }, [autoApply, isLoading, onApply, queryKey, suggestions]);

    if (!suggestions && !isLoading) return null;

    const consensus = suggestions?.consensus_values || {};
    const fieldConfidence = suggestions?.field_confidence || {};
    const hasRenderableValue = (value: unknown) =>
        value !== null && value !== undefined && value !== "";
    const formatValue = (field: string, value: unknown) => {
        if (!hasRenderableValue(value)) return null;

        switch (field) {
            case "loa":
            case "beam":
            case "draft":
                return `${value} m`;
            case "price":
                return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                }).format(Number(value));
            case "horse_power":
                return `${value} hp`;
            case "engine_quantity":
                return `${value} engine${Number(value) === 1 ? "" : "s"}`;
            default:
                return String(value);
        }
    };

    const items = [
        { field: "year", label: "Year" },
        { field: "loa", label: "Length" },
        { field: "beam", label: "Beam" },
        { field: "draft", label: "Draft" },
        { field: "fuel", label: "Fuel" },
        { field: "engine_quantity", label: "Engines" },
        { field: "horse_power", label: "Power" },
        { field: "engine_manufacturer", label: "Engine" },
        { field: "price", label: "Price" },
    ]
        .map((item) => ({
            ...item,
            value: formatValue(item.field, consensus[item.field]),
            confidence: typeof fieldConfidence[item.field] === "number"
                ? Math.round(fieldConfidence[item.field] * 100)
                : null,
        }))
        .filter((item) => item.value !== null);

    const hasSuggestions = items.length > 0;
    const warnings = Array.isArray(suggestions?.warnings) ? suggestions.warnings : [];

    if (!hasSuggestions && !isLoading) return null;

    return (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-700 font-medium">
                    <Sparkles size={18} className="text-blue-600 animate-pulse" />
                    <span>AI Creation Assistant</span>
                </div>
                {isLoading && <Loader2 size={16} className="animate-spin text-blue-400" />}
            </div>

            {hasSuggestions ? (
                <div className="space-y-3">
                    <p className="text-sm text-blue-600/80">
                        Based on similar sold boats, we found some typical specs:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((item) => (
                            <div
                                key={item.field}
                                className="text-xs bg-white border border-blue-100 rounded-md p-2 flex justify-between items-center gap-3"
                            >
                                <div className="min-w-0">
                                    <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider block">
                                        {item.label}
                                    </span>
                                    {item.confidence !== null && (
                                        <span className="text-[9px] text-slate-400">
                                            {item.confidence}% confidence
                                        </span>
                                    )}
                                </div>
                                <span className="text-blue-700 font-semibold truncate text-right">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {warnings.length > 0 && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                            {warnings[0]}
                        </p>
                    )}

                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-all group"
                        onClick={() => onApply(consensus, "manual")}
                    >
                        Apply Suggestions <ChevronRight size={14} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                </div>
            ) : isLoading ? (
                <p className="text-xs text-slate-400 italic">Searching historical archive...</p>
            ) : null}
        </div>
    );
}
