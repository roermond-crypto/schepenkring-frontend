"use client";

import React from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CorrectionLabel =
    | "wrong_image_detection"
    | "wrong_text_interpretation"
    | "guessed_too_much"
    | "duplicate_data_issue"
    | "import_mismatch"
    | "other";

interface FieldCorrectionControlsProps {
    onSelect: (label: CorrectionLabel) => void;
    onClear: () => void;
    activeLabel?: CorrectionLabel | null;
}

const LABELS: { value: CorrectionLabel; label: string; color: string }[] = [
    { value: "wrong_image_detection", label: "Wrong Image Detection", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { value: "wrong_text_interpretation", label: "Wrong Text Info", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "guessed_too_much", label: "AI Hallucination/Guess", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { value: "duplicate_data_issue", label: "Duplicate Data Issue", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "import_mismatch", label: "Import Mismatch", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "other", label: "Other", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

export function FieldCorrectionControls({ onSelect, onClear, activeLabel }: FieldCorrectionControlsProps) {
    return (
        <div className="mt-2 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mr-1">
                <AlertCircle size={10} /> Feedback:
            </div>

            {LABELS.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    onClick={() => onSelect(item.value)}
                    className={cn(
                        "px-2 py-1 rounded-md border text-[10px] font-medium transition-all shadow-sm",
                        activeLabel === item.value
                            ? cn(item.color.replace(/bg-\w+-50/, "bg-white"), "ring-2 ring-blue-500 scale-105")
                            : cn(item.color, "hover:brightness-95")
                    )}
                >
                    {item.label}
                </button>
            ))}

            {activeLabel && (
                <button
                    type="button"
                    onClick={onClear}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title="Clear feedback"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}
