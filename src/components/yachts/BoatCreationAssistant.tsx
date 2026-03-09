"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronRight, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface BoatCreationAssistantProps {
    manufacturer: string;
    model: string;
    onApply: (specs: Record<string, any>) => void;
}

export function BoatCreationAssistant({ manufacturer, model, onApply }: BoatCreationAssistantProps) {
    const [suggestions, setSuggestions] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastQuery, setLastQuery] = useState("");

    const query = `${manufacturer} ${model}`.trim();

    useEffect(() => {
        if (query.length < 5 || query === lastQuery) return;

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await api.post("/ai/suggestions", { query });
                if (res.data && res.data.consensus_values) {
                    setSuggestions(res.data);
                    setLastQuery(query);
                }
            } catch (e) {
                console.error("AI Suggestions failed", e);
            } finally {
                setIsLoading(false);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [query, lastQuery]);

    if (!suggestions && !isLoading) return null;

    const consensus = suggestions?.consensus_values || {};
    const hasSuggestions = Object.keys(consensus).length > 0;

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

                    <div className="grid grid-cols-2 gap-2">
                        {consensus.loa && (
                            <div className="text-xs bg-white border border-blue-100 rounded-md p-2 flex justify-between items-center">
                                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Length</span>
                                <span className="text-blue-700 font-semibold">{consensus.loa} m</span>
                            </div>
                        )}
                        {consensus.beam && (
                            <div className="text-xs bg-white border border-blue-100 rounded-md p-2 flex justify-between items-center">
                                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Beam</span>
                                <span className="text-blue-700 font-semibold">{consensus.beam} m</span>
                            </div>
                        )}
                        {consensus.draft && (
                            <div className="text-xs bg-white border border-blue-100 rounded-md p-2 flex justify-between items-center">
                                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Draft</span>
                                <span className="text-blue-700 font-semibold">{consensus.draft} m</span>
                            </div>
                        )}
                        {consensus.engine_manufacturer && (
                            <div className="text-xs bg-white border border-blue-100 rounded-md p-2 flex justify-between items-center col-span-2">
                                <span className="text-slate-500 font-medium text-[10px] uppercase tracking-wider">Engine</span>
                                <span className="text-blue-700 font-semibold truncate ml-2 text-right">{consensus.engine_manufacturer}</span>
                            </div>
                        )}
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-all group"
                        onClick={() => onApply(consensus)}
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
