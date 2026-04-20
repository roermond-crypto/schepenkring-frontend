"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type StepItem = {
  key: string;
  label: string;
  active: boolean;
  complete: boolean;
  clickable?: boolean;
};

export function OnboardingStepper({
  steps,
  onStepSelect,
}: {
  steps: StepItem[];
  onStepSelect?: (stepKey: string) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-2 px-1 py-1">
        {steps.map((step, index) => (
          <div key={step.key} className={cn("flex flex-1 flex-col items-center", index === 0 ? "items-start" : index === steps.length - 1 ? "items-end" : "items-center")}>
            <div className="flex w-full items-center">
              {/* Connector Line - Left */}
              <div className={cn("h-[2px] flex-1 rounded-full", index === 0 ? "bg-transparent" : (step.complete || step.active) ? "bg-white/40" : "bg-white/10")} />

              <button
                type="button"
                disabled={!step.clickable}
                onClick={() => onStepSelect?.(step.key)}
                className={cn(
                  "relative flex flex-col items-center",
                  step.clickable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-black transition-all duration-300 shadow-lg",
                    step.complete
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : step.active
                        ? "border-white bg-white text-[#003566] scale-110"
                        : "border-white/20 bg-white/5 text-white/50 backdrop-blur-md",
                    step.clickable && "hover:border-white hover:text-white hover:scale-105",
                  )}
                >
                  {step.complete ? <Check size={16} strokeWidth={4} /> : index + 1}
                </div>
              </button>

              {/* Connector Line - Right */}
              <div className={cn("h-[2px] flex-1 rounded-full", index === steps.length - 1 ? "bg-transparent" : step.complete ? "bg-white/40" : "bg-white/10")} />
            </div>

            <div
              className={cn(
                "mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-center px-1 whitespace-normal max-w-[80px]",
                step.complete
                  ? "text-emerald-300"
                  : step.active
                    ? "text-white"
                    : "text-white/40",
              )}
            >
              {step.label}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
