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

// Colors here are tuned for the actual container this renders inside
// (a white card, see SellerOnboardingPanel/BuyerVerificationPanel) — the
// previous version used white-on-white styling (border-white, bg-white/5,
// text-white/40) apparently written for a dark background, which made the
// connecting lines and pending-step state nearly invisible. Completed
// state also used emerald (green); changed to the brand blue (#003566)
// per spec.
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
              <div className={cn("h-[3px] flex-1 rounded-full", index === 0 ? "bg-transparent" : (step.complete || step.active) ? "bg-[#003566]" : "bg-slate-200")} />

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
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[13px] font-black transition-all duration-300 shadow-md",
                    step.complete
                      ? "border-[#003566] bg-[#003566] text-white"
                      : step.active
                        ? "border-[#003566] bg-white text-[#003566] scale-110 ring-4 ring-[#003566]/15"
                        : "border-slate-300 bg-slate-50 text-slate-400",
                    step.clickable && "hover:border-[#003566] hover:scale-105",
                  )}
                >
                  {step.complete ? <Check size={16} strokeWidth={4} /> : index + 1}
                </div>
              </button>

              {/* Connector Line - Right */}
              <div className={cn("h-[3px] flex-1 rounded-full", index === steps.length - 1 ? "bg-transparent" : step.complete ? "bg-[#003566]" : "bg-slate-200")} />
            </div>

            <div
              className={cn(
                "mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-center px-1 whitespace-normal max-w-[80px]",
                step.complete
                  ? "text-[#003566]"
                  : step.active
                    ? "text-slate-900"
                    : "text-slate-400",
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
