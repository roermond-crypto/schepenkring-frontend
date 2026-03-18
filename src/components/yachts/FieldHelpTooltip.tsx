"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FieldHelpTooltipProps = {
  text?: string | null;
  label?: string;
  className?: string;
};

export function FieldHelpTooltip({
  text,
  label,
  className,
}: FieldHelpTooltipProps) {
  const normalizedText = text?.trim();

  if (!normalizedText) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            className,
          )}
          aria-label={label ? `Help for ${label}` : "Field help"}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={8}
        className="max-w-xs rounded-xl bg-slate-950 px-3 py-2 text-left text-[12px] leading-5 text-white shadow-2xl"
      >
        {normalizedText}
      </TooltipContent>
    </Tooltip>
  );
}
