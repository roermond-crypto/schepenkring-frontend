import type { ReactNode } from "react";
import type { PlatformFieldKey } from "@/lib/platform-tooltips-i18n";
import { FieldTooltip } from "@/components/ui/field-tooltip";

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h3 className="text-[11px] font-black text-[#003566] uppercase tracking-[0.25em] border-b border-slate-100 pb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  field,
  children,
  className,
}: {
  label: string;
  hint?: string;
  field?: PlatformFieldKey;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
        {label}
        {field && <FieldTooltip field={field} />}
      </label>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}
