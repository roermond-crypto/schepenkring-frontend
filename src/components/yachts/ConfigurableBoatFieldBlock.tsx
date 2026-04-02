"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldHelpTooltip } from "@/components/yachts/FieldHelpTooltip";
import {
  type BoatFormConfigBlock,
  type BoatFormConfigField,
  type BoatFormConfigFieldOption,
} from "@/lib/api/boat-form-config";
import { FieldHistoryPopover } from "@/components/yachts/FieldHistoryPopover";
import {
  FieldCorrectionControls,
  type CorrectionLabel,
} from "@/components/yachts/FieldCorrectionControls";
import { BoatFieldSettingsLink } from "@/components/yachts/BoatFieldSettingsLink";

type ConfigurableBoatFieldBlockProps = {
  block: BoatFormConfigBlock;
  icon: ReactNode;
  title: string;
  values: Record<string, unknown> | null;
  yachtId?: number;
  needsConfirm?: (fieldName: string) => boolean;
  optionalTriStateFields?: readonly string[];
  correctionLabels?: Record<string, CorrectionLabel | null>;
  onCorrectionLabelChange?: (
    fieldName: string,
    label: CorrectionLabel | null,
  ) => void;
  yesLabel?: string;
  noLabel?: string;
  unknownLabel?: string;
  gridClassName?: string;
};

const NUMERIC_FIELD_TYPES = new Set(["number", "integer", "decimal", "float"]);

function isPlaceholderFieldText(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "" ||
    [
      "unknown",
      "[object object]",
      "object object",
      "n/a",
      "na",
      "null",
      "undefined",
      "onbekend",
      "unbekannt",
      "inconnu",
    ].includes(normalized)
  );
}

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function sanitizeScalarFieldValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = sanitizeScalarFieldValue(item);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  if (typeof value === "object") {
    const record = toObjectRecord(value);

    for (const key of [
      "value",
      "normalized_value",
      "answer",
      "result",
      "text",
      "name",
      "label",
    ]) {
      if (!(key in record)) {
        continue;
      }

      const normalized = sanitizeScalarFieldValue(record[key]);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  const text = String(value).trim();
  return isPlaceholderFieldText(text) ? null : text;
}

function hasFilledFieldValue(
  value: unknown,
  options?: { treatUnknownAsEmpty?: boolean },
): boolean {
  const treatUnknownAsEmpty = options?.treatUnknownAsEmpty ?? false;

  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "object") return sanitizeScalarFieldValue(value) !== null;

  const normalized = String(value).trim();
  if (!normalized) return false;
  if (
    treatUnknownAsEmpty &&
    (normalized.toLowerCase() === "unknown" ||
      isPlaceholderFieldText(normalized))
  ) {
    return false;
  }

  return !isPlaceholderFieldText(normalized);
}

function normalizeTriStateValue(value: unknown): "yes" | "no" | "" {
  const sanitized = sanitizeScalarFieldValue(value);
  if (sanitized === null) return "";

  const normalized = String(sanitized).trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") {
    return "yes";
  }
  if (normalized === "no" || normalized === "false" || normalized === "0") {
    return "no";
  }

  return normalized === "unknown" ? "" : "";
}

function BlockLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-slate-700 mb-1.5 block group-hover:text-blue-600 transition-colors",
        className,
      )}
    >
      {children}
    </label>
  );
}

function BlockHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    </div>
  );
}

function TextInput({
  needsConfirmation,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  needsConfirmation?: boolean;
}) {
  const sanitizedDefaultValue = sanitizeScalarFieldValue(props.defaultValue);
  const defaultHasValue = hasFilledFieldValue(sanitizedDefaultValue);
  const [hasUserValue, setHasUserValue] = useState<boolean | null>(null);
  const highlighted =
    Boolean(needsConfirmation) || (hasUserValue ?? defaultHasValue);

  return (
    <div className="relative">
      <input
        {...props}
        type={type}
        defaultValue={
          typeof sanitizedDefaultValue === "boolean"
            ? sanitizedDefaultValue
              ? "true"
              : "false"
            : (sanitizedDefaultValue ?? undefined)
        }
        onChange={(event) => {
          setHasUserValue(hasFilledFieldValue(event.target.value));
          props.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          "placeholder:text-slate-400 placeholder:font-normal",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          props.className,
        )}
      />
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          confirm
        </span>
      )}
    </div>
  );
}

function TriStateField({
  needsConfirmation,
  yesLabel = "Yes",
  noLabel = "No",
  unknownLabel = "Unknown",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  needsConfirmation?: boolean;
  yesLabel?: string;
  noLabel?: string;
  unknownLabel?: string;
}) {
  const normalizedDefault = normalizeTriStateValue(props.defaultValue);
  const [currentValue, setCurrentValue] = useState<
    "yes" | "no" | "" | null
  >(null);
  const effectiveValue = currentValue ?? normalizedDefault;

  const highlighted =
    Boolean(needsConfirmation) ||
    hasFilledFieldValue(effectiveValue, { treatUnknownAsEmpty: true });

  return (
    <div className="relative">
      <select
        {...props}
        defaultValue={normalizedDefault}
        onChange={(event) => {
          setCurrentValue(normalizeTriStateValue(event.target.value));
          props.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          props.className,
        )}
      >
        <option value=""></option>
        <option value="yes">{yesLabel}</option>
        <option value="no">{noLabel}</option>
        <option value="unknown">{unknownLabel}</option>
      </select>
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          confirm
        </span>
      )}
    </div>
  );
}

function SelectInput({
  needsConfirmation,
  options,
  placeholder = "Select...",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  needsConfirmation?: boolean;
  options: BoatFormConfigFieldOption[];
  placeholder?: string;
}) {
  const [currentValue, setCurrentValue] = useState<string | null>(null);
  const sanitizedDefaultValue = sanitizeScalarFieldValue(props.defaultValue);
  const effectiveValue =
    currentValue ??
    (sanitizedDefaultValue === null ? "" : String(sanitizedDefaultValue));

  const highlighted =
    Boolean(needsConfirmation) || hasFilledFieldValue(effectiveValue);

  return (
    <div className="relative">
      <select
        {...props}
        defaultValue={effectiveValue}
        onChange={(event) => {
          setCurrentValue(event.target.value);
          props.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          props.className,
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          confirm
        </span>
      )}
    </div>
  );
}

function DynamicField({
  field,
  value,
  yachtId,
  needsConfirmation,
  isTriState,
  correctionLabel,
  onCorrectionLabelChange,
  yesLabel,
  noLabel,
  unknownLabel,
}: {
  field: BoatFormConfigField;
  value: unknown;
  yachtId?: number;
  needsConfirmation: boolean;
  isTriState: boolean;
  correctionLabel?: CorrectionLabel | null;
  onCorrectionLabelChange?: (label: CorrectionLabel | null) => void;
  yesLabel?: string;
  noLabel?: string;
  unknownLabel?: string;
}) {
  const numeric =
    NUMERIC_FIELD_TYPES.has(field.field_type) ||
    field.field_type.includes("number");
  const selectOptions = field.options ?? [];
  const isSelectField =
    field.field_type === "select" && selectOptions.length > 0;

  const showCorrectionControls =
    correctionLabel !== undefined && typeof onCorrectionLabelChange === "function";

  return (
    <div className="space-y-2 group">
      <div className="flex items-center gap-2">
        <BlockLabel className="mb-0">{field.label}</BlockLabel>
        <FieldHelpTooltip text={field.help_text} label={field.label} />
        <BoatFieldSettingsLink fieldName={field.internal_key} />
        {yachtId && (
          <FieldHistoryPopover
            yachtId={yachtId}
            fieldName={field.internal_key}
            label={field.label}
          />
        )}
      </div>
      {isTriState ? (
        <TriStateField
          name={field.internal_key}
          defaultValue={value as string | undefined}
          needsConfirmation={needsConfirmation}
          yesLabel={yesLabel}
          noLabel={noLabel}
          unknownLabel={unknownLabel}
        />
      ) : isSelectField ? (
        <SelectInput
          name={field.internal_key}
          defaultValue={value as string | undefined}
          needsConfirmation={needsConfirmation}
          options={selectOptions}
        />
      ) : (
        <TextInput
          name={field.internal_key}
          type={numeric ? "number" : "text"}
          defaultValue={value as string | number | undefined}
          needsConfirmation={needsConfirmation}
        />
      )}
      {showCorrectionControls && (
        <FieldCorrectionControls
          activeLabel={correctionLabel}
          onSelect={(label) => onCorrectionLabelChange(label)}
          onClear={() => onCorrectionLabelChange(null)}
        />
      )}
    </div>
  );
}

export function ConfigurableBoatFieldBlock({
  block,
  icon,
  title,
  values,
  yachtId,
  needsConfirm,
  optionalTriStateFields = [],
  correctionLabels,
  onCorrectionLabelChange,
  yesLabel,
  noLabel,
  unknownLabel,
  gridClassName,
}: ConfigurableBoatFieldBlockProps) {
  const secondaryHasValue = useMemo(
    () =>
      block.secondary_fields.some((field) =>
        hasFilledFieldValue(values?.[field.internal_key], {
          treatUnknownAsEmpty:
            field.field_type === "tri_state" ||
            optionalTriStateFields.includes(field.internal_key),
        }),
      ),
    [block.secondary_fields, optionalTriStateFields, values],
  );

  const [expanded, setExpanded] = useState(secondaryHasValue);

  const visibleSecondary = expanded ? block.secondary_fields : [];
  const showToggle = block.secondary_count > 0;

  return (
    <div className="space-y-5">
      <BlockHeader icon={icon} title={title} />
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-5", gridClassName)}>
        {block.primary_fields.map((field) => {
          const isTriState = field.field_type === "tri_state";

          return (
            <DynamicField
              key={`primary-${field.id}`}
              field={field}
              value={values?.[field.internal_key]}
              yachtId={yachtId}
              needsConfirmation={needsConfirm?.(field.internal_key) ?? false}
              isTriState={isTriState}
              correctionLabel={correctionLabels?.[field.internal_key]}
              onCorrectionLabelChange={
                onCorrectionLabelChange
                  ? (label) => onCorrectionLabelChange(field.internal_key, label)
                  : undefined
              }
              yesLabel={yesLabel}
              noLabel={noLabel}
              unknownLabel={unknownLabel}
            />
          );
        })}

        {visibleSecondary.map((field) => {
          const isTriState = field.field_type === "tri_state";

          return (
            <DynamicField
              key={`secondary-${field.id}`}
              field={field}
              value={values?.[field.internal_key]}
              yachtId={yachtId}
              needsConfirmation={needsConfirm?.(field.internal_key) ?? false}
              isTriState={isTriState}
              correctionLabel={correctionLabels?.[field.internal_key]}
              onCorrectionLabelChange={
                onCorrectionLabelChange
                  ? (label) => onCorrectionLabelChange(field.internal_key, label)
                  : undefined
              }
              yesLabel={yesLabel}
              noLabel={noLabel}
              unknownLabel={unknownLabel}
            />
          );
        })}
      </div>

      {showToggle && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded
              ? "- Show less"
              : `+ Show more (${block.secondary_count})`}
          </button>
        </div>
      )}
    </div>
  );
}
